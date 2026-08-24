'use strict';

const $ = id => document.getElementById(id);
// Fluo SAEIV V23.1 — calcul horaires + journaux cartographiques/effaçables + déploiement forcé.
// Le moteur de suivi utilise la progression le long du shape, le cap tangent au parcours et un lissage circulaire.
const ui = {
  dept:$('dept'), route:$('route'), serviceDate:$('serviceDate'), startStop:$('startStop'), trip:$('trip'), formationPattern:$('formationPattern'), scheduleSetup:$('scheduleSetup'), formationSetup:$('formationSetup'),
  status:$('status'), start:$('start'), simulate:$('simulate'), simSpeed:$('simSpeed'), simScale:$('simScale'), simDelay:$('simDelay'), simDelayWrap:$('simDelayWrap'),
  setup:$('setup'), driver:$('driver'), gpsPill:$('gpsPill'), gpsTest:$('gpsTest'), gpsTestResult:$('gpsTestResult'),
  routeBadge:$('routeBadge'), modeBadge:$('modeBadge'), headsign:$('headsign'), current:$('current'), next:$('next'),
  distance:$('distance'), announceState:$('announceState'), accuracy:$('accuracy'), speed:$('speed'), threshold:$('threshold'),
  prev:$('prev'), speak:$('speak'), nextBtn:$('nextBtn'), finish:$('finish'), recenter:$('recenter'), buildInfo:$('buildInfo'),
  simControls:$('simControls'), simPlayPause:$('simPlayPause'), simSkip:$('simSkip'),
  map:$('map'), followMap:$('followMap'), routeState:$('routeState'), remaining:$('remaining'), departureTime:$('departureTime'), departureCountdown:$('departureCountdown'), nextScheduled:$('nextScheduled'), fusionQuality:$('fusionQuality'), courseInfo:$('courseInfo'),
  regularMode:$('regularMode'), tadMode:$('tadMode'), formationMode:$('formationMode'), serviceModeHelp:$('serviceModeHelp'), tadPanel:$('tadPanel'), tadStopList:$('tadStopList'), tadSummary:$('tadSummary'), tadAll:$('tadAll'), tadNone:$('tadNone'),
  serviceBadge:$('serviceBadge'), requestsBtn:$('requestsBtn'), requestsCount:$('requestsCount'), requestsSheet:$('requestsSheet'), requestsList:$('requestsList'), requestsClose:$('requestsClose'), requestsDone:$('requestsDone'), requestsClear:$('requestsClear'), requestAlert:$('requestAlert'), requestAlertStop:$('requestAlertStop'),
  schedulePanel:$('schedulePanel'), scheduleLabel:$('scheduleLabel'), scheduleDelta:$('scheduleDelta'), scheduleReference:$('scheduleReference'), scheduleMetric:$('scheduleMetric'), scheduleMetricBox:$('scheduleMetricBox'), departureStrip:$('departureStrip'), nextScheduledWrap:$('nextScheduledWrap')
};

const state = {
  dept:null, routes:[], route:null, patterns:[], pattern:null, services:{}, runOptions:[], run:null,
  current:0, target:1, watch:null, pos:null, running:false, mode:null,
  announced:false, arrivalAnnounced:false, nextStopDueAt:null, firstLegDepartureSeen:false, reached:false, minDist:Infinity, lastAdvance:0, midpointAnnounced:false, departed:true, departureTimers:[], departureTicker:null,
  sim:{raf:null, playing:false, segmentFrom:0, segmentTo:1, fraction:0, holdUntil:0, speedMps:13.89, scale:10, delaySeconds:0, lastTs:0, path:[], pathIndex:0, pathFraction:0, heldTarget:-1},
  nav:{map:null,routeLine:null,busMarker:null,stopMarkers:[],follow:true,lastHeading:0,lastDisplayLat:null,lastDisplayLon:null,lastDisplayAt:0},
  wakeLock:null, wakeLockTimer:null,
  fusion:{shape:[],cum:[],stopAlong:[],lastAlong:null,lastSegment:null,snapped:null,confidence:0,offRoute:Infinity,lastRaw:null,lastSnapAt:null,displayAlong:null,displayHeading:null},
  audio:{queue:[],current:null,token:0,requestChimeCtx:null,lastRequestChimeAt:0},
  service:{mode:'regular',tadStops:new Set(),requestedStops:new Set(),requestAlertIndex:null,requestChimedStops:new Set()},
  punctuality:{ticker:null,deltaSeconds:null,plannedTime:null,status:'unknown'}
};

const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(t,k=''){ ui.status.textContent=t; ui.status.className='status '+k; }
function dist(a,b,c,d){ const R=6371000,r=x=>x*Math.PI/180,dp=r(c-a),dl=r(d-b),q=Math.sin(dp/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dl/2)**2; return 2*R*Math.asin(Math.sqrt(q)); }
function fmt(m){ return !Number.isFinite(m)?'—':m>=1000?`${(m/1000).toFixed(m>=10000?0:1).replace('.',',')} km`:`${Math.round(m)} m`; }
function pumpSpeech(){
  if(!('speechSynthesis' in window)||state.audio.current||!state.audio.queue.length) return;
  state.audio.queue.sort((a,b)=>b.priority-a.priority||a.seq-b.seq);
  const item=state.audio.queue.shift(), token=++state.audio.token;
  const u=new SpeechSynthesisUtterance(item.text); u.lang='fr-FR'; u.rate=.92; u.volume=1;
  state.audio.current={priority:item.priority,kind:item.kind,token};
  const done=()=>{ if(state.audio.current?.token===token) state.audio.current=null; setTimeout(pumpSpeech,20); };
  u.onend=done; u.onerror=done; speechSynthesis.speak(u);
}
function say(text,opts={}){
  if(!('speechSynthesis' in window)||!text) return;
  const item={text,priority:Number(opts.priority??50),kind:opts.kind||'general',ephemeral:!!opts.ephemeral,seq:Date.now()+Math.random()};
  const cur=state.audio.current;
  // Une annonce d'arrêt doit toujours pouvoir prendre la main immédiatement.
  if(cur && (item.kind==='stop'||item.priority>cur.priority)){
    speechSynthesis.cancel(); state.audio.current=null;
    state.audio.queue=state.audio.queue.filter(x=>x.priority>=item.priority);
  }else if(cur && item.ephemeral && cur.priority>=item.priority){ return; }
  if(item.kind==='stop') state.audio.queue=state.audio.queue.filter(x=>x.priority>=item.priority);
  state.audio.queue.push(item); pumpSpeech();
}
function spoken(s){ return String(s).replace(/\s+-\s+/g,', ').replace(/GARE ROUTIERE/gi,'Gare routière').trim(); }
// Prononciation des codes Fluo : 57R026 -> « 57 R 26 », R033 -> « R 33 », R361 -> « R 361 ».
// Seuls les zéros placés au début du bloc numérique APRES la/les lettre(s) sont supprimés.
function spokenLineCode(value){
  const raw=String(value??'').trim().toUpperCase();
  const compact=raw.replace(/[^0-9A-ZÀ-ÖØ-Þ]/g,'');
  const m=compact.match(/^(\d+)?([A-ZÀ-ÖØ-Þ]+)(\d+)$/);
  if(!m) return spoken(raw);
  const prefix=m[1]||'';
  const letters=[...m[2]].join(' ');
  const digits=(m[3].replace(/^0+(?=\d)/,'')||'0');
  return [prefix,letters,digits].filter(Boolean).join(' ');
}

function requestChimeContext(){
  const C=window.AudioContext||window.webkitAudioContext; if(!C) return null;
  if(!state.audio.requestChimeCtx){
    try{ state.audio.requestChimeCtx=new C({latencyHint:'interactive'}); }catch{ state.audio.requestChimeCtx=new C(); }
  }
  if(state.audio.requestChimeCtx.state==='suspended') state.audio.requestChimeCtx.resume().catch(()=>{});
  return state.audio.requestChimeCtx;
}
function primeRequestChime(){ requestChimeContext(); }
function playRequestChime(index){
  const now=Date.now();
  if(now-state.audio.lastRequestChimeAt<900) return;
  state.audio.lastRequestChimeAt=now;
  const ctx=requestChimeContext(); if(!ctx) return;
  // Deux notes descendantes, type bouton arrêt demandé : « ding-dong ».
  const notes=[880,659], t0=ctx.currentTime+.025;
  notes.forEach((freq,i)=>{
    const o=ctx.createOscillator(), g=ctx.createGain(), t=t0+i*.22;
    o.type='sine'; o.frequency.value=freq;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.28,t+.025);
    g.gain.exponentialRampToValueAtTime(.0001,t+.20);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+.22);
  });
}
async function jget(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }


function cssColor(hex, fallback='#ffd000'){
  const h=String(hex||'').replace('#','').trim(); return /^[0-9a-fA-F]{6}$/.test(h)?`#${h}`:fallback;
}
function bearing(a,b,c,d){
  const r=x=>x*Math.PI/180, y=Math.sin(r(d-b))*Math.cos(r(c));
  const x=Math.cos(r(a))*Math.sin(r(c))-Math.sin(r(a))*Math.cos(r(c))*Math.cos(r(d-b));
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function pointSegmentProjection(lat,lon,a,b){
  const R=6371000, ref=(lat+a[0]+b[0])/3*Math.PI/180;
  const proj=(la,lo)=>[lo*Math.PI/180*R*Math.cos(ref),la*Math.PI/180*R];
  const p=proj(lat,lon), p1=proj(a[0],a[1]), p2=proj(b[0],b[1]);
  const dx=p2[0]-p1[0],dy=p2[1]-p1[1], den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((p[0]-p1[0])*dx+(p[1]-p1[1])*dy)/den)):0;
  const qx=p1[0]+t*dx,qy=p1[1]+t*dy;
  return {d:Math.hypot(p[0]-qx,p[1]-qy),t,lat:a[0]+(b[0]-a[0])*t,lon:a[1]+(b[1]-a[1])*t};
}
function angleDiff(a,b){ const d=Math.abs((a-b)%360); return d>180?360-d:d; }
// V20 — moteur de géométrie : jamais de ligne droite entre les arrêts.
// 1) shapes.txt Fluo complet = source de référence.
// 2) si une course ne possède réellement aucun shape, routage routier OSM/OSRM entre les arrêts.
const V20Geometry = {
  token: 0,
  cacheKey: 'fluo_v20_road_geometry_cache',
  cache: new Map(),
  maxCached: 24,
};
function loadV20GeometryCache(){
  try{
    const raw=JSON.parse(localStorage.getItem(V20Geometry.cacheKey)||'{}');
    for(const [k,v] of Object.entries(raw)) if(Array.isArray(v?.shape)&&v.shape.length>=2) V20Geometry.cache.set(k,v);
  }catch{}
}
function saveV20GeometryCache(){
  try{
    const xs=[...V20Geometry.cache.entries()].sort((a,b)=>(b[1]?.savedAt||0)-(a[1]?.savedAt||0)).slice(0,V20Geometry.maxCached);
    localStorage.setItem(V20Geometry.cacheKey,JSON.stringify(Object.fromEntries(xs)));
  }catch{}
}
loadV20GeometryCache();
function courseShape(){
  const p=state.pattern; if(!p) return [];
  // V20: on ne fabrique plus JAMAIS un pseudo-tracé en reliant les arrêts par des segments droits.
  return Array.isArray(p.shape)&&p.shape.length>=2?p.shape:[];
}
function prepareCourseGeometry(){
  let shape=courseShape().map(p=>[Number(p[0]),Number(p[1])]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  const stops=state.pattern?.stops||[];
  if(shape.length>=2&&stops.length>=2){
    const direct=dist(shape[0][0],shape[0][1],stops[0].lat,stops[0].lon)+dist(shape.at(-1)[0],shape.at(-1)[1],stops.at(-1).lat,stops.at(-1).lon);
    const reverse=dist(shape.at(-1)[0],shape.at(-1)[1],stops[0].lat,stops[0].lon)+dist(shape[0][0],shape[0][1],stops.at(-1).lat,stops.at(-1).lon);
    if(reverse+30<direct) shape.reverse();
  }
  if(shape.length<2){
    state.fusion={shape:[],cum:[],stopAlong:new Array(stops.length).fill(null),lastAlong:null,lastSegment:null,snapped:null,confidence:0,offRoute:Infinity,lastRaw:null,lastSnapAt:null,displayAlong:null,displayHeading:null};
    return;
  }
  const cum=[0]; for(let i=1;i<shape.length;i++) cum.push(cum[i-1]+dist(shape[i-1][0],shape[i-1][1],shape[i][0],shape[i][1]));
  const stopAlong=[]; let searchFrom=0;
  for(const st of stops){
    let best={d:Infinity,along:null,seg:searchFrom};
    for(let i=searchFrom;i<shape.length-1;i++){
      const q=pointSegmentProjection(st.lat,st.lon,shape[i],shape[i+1]);
      const along=cum[i]+q.t*(cum[i+1]-cum[i]);
      if(q.d<best.d) best={d:q.d,along,seg:i};
      if(best.d<6&&i>searchFrom+180) break;
    }
    stopAlong.push(best.along); searchFrom=Math.max(searchFrom,best.seg);
  }
  state.fusion={shape,cum,stopAlong,lastAlong:null,lastSegment:null,snapped:null,confidence:0,offRoute:Infinity,lastRaw:null,lastSnapAt:null,displayAlong:null,displayHeading:null};
}
function v20PatternKey(pattern=state.pattern){
  const stops=pattern?.stops||[];
  return [state.dept||'',state.route?.id||state.route?.short||'',pattern?.shape_id||'',stops.map(s=>s.id||`${s.lat},${s.lon}`).join('>')].join('|');
}
function mergeGeometry(target,coords){
  for(const c of coords||[]){
    const p=[Number(c[1]),Number(c[0])]; if(!Number.isFinite(p[0])||!Number.isFinite(p[1])) continue;
    const z=target.at(-1); if(!z||dist(z[0],z[1],p[0],p[1])>.8) target.push(p);
  }
}
async function routeRoadChunk(stops){
  const coords=stops.map(s=>`${Number(s.lon).toFixed(7)},${Number(s.lat).toFixed(7)}`).join(';');
  const url=`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&alternatives=false&continue_straight=true`;
  const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`routage HTTP ${r.status}`);
  const data=await r.json(), route=data?.routes?.[0], geometry=route?.geometry?.coordinates;
  if(data?.code!=='Ok'||!Array.isArray(geometry)||geometry.length<2) throw new Error('aucune géométrie routière');
  return geometry;
}
async function roadGeometryForStops(stops){
  if(!Array.isArray(stops)||stops.length<2) throw new Error('pas assez d’arrêts');
  const all=[];
  // Le serveur public accepte un nombre limité de via-points : on travaille par blocs avec chevauchement.
  const max=45;
  for(let i=0;i<stops.length-1;){
    const end=Math.min(stops.length,i+max), chunk=stops.slice(i,end);
    const geometry=await routeRoadChunk(chunk); mergeGeometry(all,geometry);
    if(end>=stops.length) break;
    i=end-1;
  }
  if(all.length<2) throw new Error('tracé routier vide');
  return all;
}
function geometrySourceLabel(pattern=state.pattern){
  const src=pattern?.trace_source||'';
  if(src==='fluo_gtfs_full') return `tracé officiel Fluo complet (${pattern.shape?.length||0} points)`;
  if(src==='fluo_gtfs') return `tracé officiel Fluo (${pattern.shape?.length||0} points)`;
  if(src==='fusion_override') return 'tracé Fluo corrigé';
  if(src==='road_fallback_osm') return 'tracé routier OSM (shape Fluo absent)';
  return src||'tracé en préparation';
}
async function ensureExactPatternGeometry(pattern=state.pattern){
  if(!pattern) return false;
  if(Array.isArray(pattern.shape)&&pattern.shape.length>=2 && pattern.trace_source!=='stops_fallback'){
    prepareCourseGeometry(); return true;
  }
  const token=++V20Geometry.token, key=v20PatternKey(pattern), hit=V20Geometry.cache.get(key);
  ui.start.disabled=true; ui.simulate.disabled=true;
  if(hit?.shape?.length>=2){
    pattern.shape=hit.shape.map(p=>[Number(p[0]),Number(p[1])]); pattern.trace_source='road_fallback_osm';
    if(token===V20Geometry.token&&pattern===state.pattern){ prepareCourseGeometry(); refreshStartAvailability(); }
    return true;
  }
  status('Cette course n’a pas de shape Fluo exploitable : reconstruction du tracé routier exact…');
  try{
    const shape=await roadGeometryForStops(pattern.stops||[]);
    if(token!==V20Geometry.token||pattern!==state.pattern) return false;
    pattern.shape=shape; pattern.trace_source='road_fallback_osm';
    V20Geometry.cache.set(key,{shape,savedAt:Date.now()}); saveV20GeometryCache();
    prepareCourseGeometry(); refreshStartAvailability();
    if(state.nav?.map) drawRoute();
    status('Tracé routier reconstruit : la ligne suit désormais la voirie.','ok');
    return true;
  }catch(e){
    if(token!==V20Geometry.token||pattern!==state.pattern) return false;
    prepareCourseGeometry(); ui.start.disabled=true; ui.simulate.disabled=true;
    status(`Impossible de reconstruire le tracé routier (${e.message}). Le SAEIV ne dessinera pas de lignes droites entre les arrêts.`,'err');
    return false;
  }
}
function pointAtRouteAlong(along){
  const f=state.fusion, shape=f.shape||[], cum=f.cum||[];
  if(shape.length<2||cum.length!==shape.length||!Number.isFinite(along)) return null;
  const total=cum[cum.length-1]||0, x=Math.max(0,Math.min(total,along));
  let lo=0,hi=cum.length-1;
  while(lo<hi){ const mid=Math.floor((lo+hi+1)/2); if(cum[mid]<=x) lo=mid; else hi=mid-1; }
  const i=Math.min(shape.length-2,lo), a=cum[i], b=cum[i+1], t=b>a?(x-a)/(b-a):0;
  return {lat:shape[i][0]+(shape[i+1][0]-shape[i][0])*t,lon:shape[i][1]+(shape[i+1][1]-shape[i][1])*t,segment:i};
}
function routeHeadingAtAlong(along){
  const f=state.fusion, total=f.cum?.at(-1)||0;
  if(!Number.isFinite(along)||total<=0) return Number(state.nav.lastHeading||0);
  // Une fenêtre de plusieurs dizaines de mètres évite les oscillations de cap sur chaque micro-segment du GTFS.
  const behind=pointAtRouteAlong(Math.max(0,along-8));
  const ahead=pointAtRouteAlong(Math.min(total,along+32));
  if(!behind||!ahead) return Number(state.nav.lastHeading||0);
  return bearing(behind.lat,behind.lon,ahead.lat,ahead.lon);
}
function smoothHeading(prev,next,alpha=.3){
  if(!Number.isFinite(next)) return Number.isFinite(prev)?prev:0;
  if(!Number.isFinite(prev)) return next;
  const delta=((next-prev+540)%360)-180;
  return (prev+delta*Math.max(0,Math.min(1,alpha))+360)%360;
}
function snapToCourse(c,timestamp=Date.now()){
  const f=state.fusion, shape=f.shape;
  if(!shape?.length||shape.length<2) return {lat:c.latitude,lon:c.longitude,along:null,off:Infinity,confidence:0,segment:null,heading:state.nav.lastHeading||0};
  const acc=Math.max(3,Number(c.accuracy)||35), sp=Number.isFinite(c.speed)&&c.speed>=0?c.speed:0;
  const rawHeading=Number.isFinite(c.heading)&&c.heading>=0?c.heading:null;
  const raw={lat:Number(c.latitude),lon:Number(c.longitude)};
  const rawTravel=f.lastRaw?dist(f.lastRaw.lat,f.lastRaw.lon,raw.lat,raw.lon):0;
  const elapsed=f.lastSnapAt?Math.max(.02,Math.min(5,(Number(timestamp||Date.now())-f.lastSnapAt)/1000)):1;
  // Fenêtre plausible de progression. Elle empêche un croisement ou deux tronçons proches de téléporter le bus loin devant.
  const plausibleForward=Math.max(95,rawTravel*4.2,sp*elapsed*5+acc*2.2);
  const plausibleBack=Math.max(35,acc*1.3,rawTravel*1.8);
  let lo=0,hi=shape.length-2;
  if(Number.isInteger(f.lastSegment)&&f.offRoute<220){ lo=Math.max(0,f.lastSegment-70); hi=Math.min(shape.length-2,f.lastSegment+190); }
  let best=null;
  const inspect=(i)=>{
    const q=pointSegmentProjection(raw.lat,raw.lon,shape[i],shape[i+1]);
    const along=f.cum[i]+q.t*(f.cum[i+1]-f.cum[i]);
    const tangent=bearing(shape[i][0],shape[i][1],shape[i+1][0],shape[i+1][1]);
    let score=q.d;
    // Le cap GPS ne sert que comme aide. Le tracé officiel reste l'autorité.
    if(rawHeading!==null&&sp>2.2) score+=Math.min(35,angleDiff(rawHeading,tangent)*.16);
    if(Number.isFinite(f.lastAlong)){
      const delta=along-f.lastAlong;
      if(delta < -plausibleBack) score+=700+(-delta-plausibleBack)*1.7;
      if(delta > plausibleForward) score+=650+(delta-plausibleForward)*1.25;
    }
    if(!best||score<best.score) best={...q,along,segment:i,score,tangent};
  };
  for(let i=lo;i<=hi;i++) inspect(i);
  if(!best||best.d>Math.max(170,acc*3.8)){
    best=null;
    for(let i=0;i<shape.length-1;i++) inspect(i);
  }
  const accept=best&&best.d<=Math.max(95,acc*2.9);
  f.lastRaw=raw; f.lastSnapAt=Number(timestamp||Date.now());
  if(!accept){
    f.offRoute=best?.d??Infinity; f.confidence=0;
    const h=smoothHeading(f.displayHeading,rawHeading??f.displayHeading,.18); f.displayHeading=h;
    return {lat:raw.lat,lon:raw.lon,along:null,off:f.offRoute,confidence:0,segment:null,heading:h};
  }
  // Progression monotone souple : on tolère un petit recul GPS, jamais un saut important vers une branche voisine.
  let acceptedAlong=best.along;
  if(Number.isFinite(f.lastAlong)) acceptedAlong=Math.max(f.lastAlong-plausibleBack,Math.min(f.lastAlong+plausibleForward,acceptedAlong));
  f.lastAlong=acceptedAlong; f.lastSegment=best.segment; f.offRoute=best.d;
  f.confidence=Math.max(5,Math.min(99,Math.round(100-best.d/Math.max(1,acc)*18-Math.max(0,acc-8)*.55)));
  // Le point affiché est recalculé SUR le shape avec l'along accepté, donc le pictogramme ne zigzague pas entre deux segments.
  if(!Number.isFinite(f.displayAlong)) f.displayAlong=acceptedAlong;
  const maxLag=Math.max(24,rawTravel*1.7,sp*elapsed*1.7);
  const diff=acceptedAlong-f.displayAlong;
  f.displayAlong += Math.max(-maxLag,Math.min(maxLag,diff)) * (sp>2?0.72:0.48);
  if(Math.abs(diff)<1.2) f.displayAlong=acceptedAlong;
  const display=pointAtRouteAlong(f.displayAlong)||{lat:best.lat,lon:best.lon,segment:best.segment};
  const routeH=routeHeadingAtAlong(f.displayAlong);
  // Si le cap matériel est cohérent avec la route, on en garde une petite part; sinon on privilégie le cap tangent au parcours.
  let targetH=routeH;
  if(rawHeading!==null&&sp>3&&angleDiff(rawHeading,routeH)<38) targetH=smoothHeading(routeH,rawHeading,.22);
  const alpha=sp>12?0.42:sp>4?0.32:0.2;
  f.displayHeading=smoothHeading(f.displayHeading,targetH,alpha);
  return {lat:display.lat,lon:display.lon,along:f.displayAlong,rawAlong:best.along,off:best.d,confidence:f.confidence,segment:display.segment??best.segment,heading:f.displayHeading};
}
function routeDistanceToStop(targetIndex,c){
  const snap=state.fusion.snapped, sa=state.fusion.stopAlong?.[targetIndex];
  if(snap&&Number.isFinite(snap.along)&&Number.isFinite(sa)){
    const d=sa-snap.along; if(d>=-80) return Math.max(0,d);
  }
  const st=state.pattern?.stops?.[targetIndex]; return st?dist(c.latitude,c.longitude,st.lat,st.lon):Infinity;
}
function ensureMap(){
  if(state.nav.map||typeof L==='undefined'||!ui.map) return;
  state.nav.map=L.map(ui.map,{zoomControl:true,attributionControl:true}).setView([48.7,6.2],9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.nav.map);
  state.nav.map.on('dragstart zoomstart',()=>{state.nav.follow=false; syncFollowButton();});
}
function syncFollowButton(){ if(ui.followMap) ui.followMap.textContent=state.nav.follow?'🎯 Suivi automatique':'🎯 Reprendre le suivi'; }
function busIcon(heading=0){
  return L.divIcon({className:'',html:`<div class="bus-pin" style="transform:rotate(${Math.round(heading)}deg)">➤</div>`,iconSize:[32,32],iconAnchor:[16,16]});
}
function stopIcon(index){
  const classes=['stop-pin'];
  let size=10;
  if(index===state.current) classes.push('current-stop');
  if(index===state.target){ classes.push('next-stop'); size=16; }
  if(state.service.mode!=='tad'&&state.service.requestedStops.has(index)) classes.push('requested-stop');
  if(state.service.mode==='tad'&&state.service.tadStops.has(index)) classes.push('tad-stop');
  return L.divIcon({className:'',html:`<div class="${classes.join(' ')}"></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
}
function drawRoute(){
  ensureMap(); if(!state.nav.map||!state.pattern) return;
  if(state.nav.routeLine){ state.nav.map.removeLayer(state.nav.routeLine); state.nav.routeLine=null; }
  state.nav.stopMarkers.forEach(m=>state.nav.map.removeLayer(m)); state.nav.stopMarkers=[];
  const shape=state.fusion.shape?.length>=2?state.fusion.shape:[];
  if(shape.length>=2){
    // V20: la polyligne ne vient que de la géométrie officielle/routée, jamais des seuls arrêts.
    state.nav.routeLine=L.polyline(shape,{color:cssColor(state.route?.color,'#ffd000'),weight:6,opacity:.92,lineJoin:'round',lineCap:'round'}).addTo(state.nav.map);
  }
  state.pattern.stops.forEach((s,i)=>{
    const m=L.marker([s.lat,s.lon],{icon:stopIcon(i),keyboard:false})
      .bindTooltip(`${i+1}. ${s.name}`,{direction:'top',offset:[0,-5]})
      .addTo(state.nav.map);
    state.nav.stopMarkers.push(m);
  });
  if(state.nav.routeLine){ const b=state.nav.routeLine.getBounds(); if(b.isValid()) state.nav.map.fitBounds(b,{padding:[24,24]}); }
  else if(state.pattern.stops.length){ const b=L.latLngBounds(state.pattern.stops.map(s=>[s.lat,s.lon])); if(b.isValid()) state.nav.map.fitBounds(b,{padding:[24,24]}); }
  setTimeout(()=>state.nav.map?.invalidateSize(),80);
}
function updateStopMarkers(){
  if(!state.nav.map||!state.nav.stopMarkers.length) return;
  state.nav.stopMarkers.forEach((m,i)=>m.setIcon(stopIcon(i)));
}
function updateNavigation(p,snap=null){
  if(!state.running||!state.pattern||typeof L==='undefined') return;
  ensureMap(); if(!state.nav.map) return;
  const c=p.coords, fused=snap||state.fusion.snapped||{lat:c.latitude,lon:c.longitude,off:Infinity,confidence:0,heading:state.nav.lastHeading||0};
  const lat=Number(fused.lat), lon=Number(fused.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;
  const h=Number.isFinite(fused.heading)?fused.heading:(Number.isFinite(state.fusion.displayHeading)?state.fusion.displayHeading:state.nav.lastHeading||0);
  state.nav.lastHeading=h;
  // Leaflet est le moteur de secours. La position et le cap proviennent exactement du même état stabilisé que MapLibre.
  if(!state.nav.busMarker) state.nav.busMarker=L.marker([lat,lon],{icon:busIcon(h),zIndexOffset:1000,keyboard:false}).addTo(state.nav.map);
  else{ state.nav.busMarker.setLatLng([lat,lon]); state.nav.busMarker.setIcon(busIcon(h)); }
  const off=Number.isFinite(fused.off)?fused.off:Infinity;
  if(Number.isFinite(off)){
    if(fused.confidence>0&&off<90){ ui.routeState.textContent=`FUSION ${fused.confidence}%`; ui.routeState.className='route-state good'; }
    else if(off<220){ ui.routeState.textContent=`ÉCART ${fmt(off)}`; ui.routeState.className='route-state warn'; }
    else{ ui.routeState.textContent=`HORS PARCOURS · ${fmt(off)}`; ui.routeState.className='route-state bad'; }
  }
  if(ui.fusionQuality) ui.fusionQuality.textContent=fused.confidence?`${fused.confidence}%`:'BRUT';
  if(state.nav.follow){
    const z=Math.max(state.nav.map.getZoom(),15);
    state.nav.map.setView([lat,lon],z,{animate:false});
  }
}

// V8 — modes de service TAD et demandes clients
function setServiceMode(mode){
  state.service.mode=['tad','formation'].includes(mode)?mode:'regular';
  state.service.requestedStops.clear(); state.service.requestAlertIndex=null; state.service.requestChimedStops.clear();
  ui.regularMode?.classList.toggle('active',state.service.mode==='regular');
  ui.tadMode?.classList.toggle('active',state.service.mode==='tad');
  ui.formationMode?.classList.toggle('active',state.service.mode==='formation');
  ui.tadPanel?.classList.toggle('hidden',state.service.mode!=='tad');
  ui.scheduleSetup?.classList.toggle('hidden',state.service.mode==='formation');
  ui.formationSetup?.classList.toggle('hidden',state.service.mode!=='formation');
  ui.simDelayWrap?.classList.toggle('hidden',state.service.mode==='formation');
  if(ui.serviceModeHelp){
    ui.serviceModeHelp.textContent=state.service.mode==='tad'
      ? 'TAD : choisis d’abord ton arrêt de départ, puis uniquement les arrêts à desservir. Le dernier arrêt sélectionné devient le terminus et les autres arrêts n’imposent aucun détour.'
      : state.service.mode==='formation'
      ? 'Formation : choisis la ligne puis le sens/parcours. GPS, carte, annonces, demandes clients et simulation restent actifs, mais aucun horaire, départ T−5/T−1 ni calcul avance/retard n’est utilisé.'
      : 'Ligne régulière : tous les arrêts de la course restent desservis. Les demandes clients peuvent être ajoutées pendant le service.';
  }
  if(state.service.mode!=='tad') state.service.tadStops.clear(); else renderTadStopList(true);
  if(state.route){ if(state.service.mode==='formation') populateFormationPatterns(); else populateRuns(); }
  refreshStartAvailability(); renderRequestsButton(); updateRequestAlert(false); updateStopMarkers();
}
function stopScheduleLabel(index){
  if(!state.run) return '';
  const a=arrivalFor(state.run.trip,index,state.run.serviceDate), d=departureFor(state.run.trip,index,state.run.serviceDate);
  const x=d||a; return x?formatClock(x):'';
}
function tadSelectedIndices(){ return [...state.service.tadStops].filter(i=>Number.isInteger(i)).sort((a,b)=>a-b); }
function tadTerminusIndex(){
  const start=Number(ui.startStop?.value||0), future=tadSelectedIndices().filter(i=>i>start);
  return future.length?future[future.length-1]:null;
}
function nextOperationalStop(fromIndex){
  if(!state.pattern) return null;
  if(state.service.mode!=='tad') return fromIndex+1<state.pattern.stops.length?fromIndex+1:null;
  for(const i of tadSelectedIndices()) if(i>fromIndex) return i;
  return null;
}
function previousOperationalStop(fromIndex){
  if(!state.pattern) return null;
  if(state.service.mode!=='tad') return fromIndex>0?fromIndex-1:null;
  const xs=tadSelectedIndices().filter(i=>i<fromIndex); return xs.length?xs[xs.length-1]:null;
}
function operationalEndIndex(){
  if(!state.pattern) return 0;
  if(state.service.mode!=='tad') return state.pattern.stops.length-1;
  const xs=tadSelectedIndices(); return xs.length?xs[xs.length-1]:Number(ui.startStop?.value||0);
}
function operationalRemaining(){
  if(!state.pattern) return 0;
  if(state.service.mode!=='tad') return Math.max(0,state.pattern.stops.length-state.target);
  return tadSelectedIndices().filter(i=>i>=state.target).length;
}
function renderTadStopList(reset=false){
  if(!ui.tadStopList) return;
  if(!state.pattern||!state.run){
    state.service.tadStops.clear(); ui.tadStopList.innerHTML='<div class="stop-check"><div></div><div class="stop-check-main"><span class="stop-check-name">Choisis d’abord une course</span></div><div></div></div>';
    if(ui.tadSummary) ui.tadSummary.textContent='Choisis d’abord une course.'; return;
  }
  const start=Math.max(0,Number(ui.startStop.value||0));
  if(reset) state.service.tadStops.clear();
  for(const i of [...state.service.tadStops]) if(i<start||i>=state.pattern.stops.length) state.service.tadStops.delete(i);
  // L'arrêt choisi dans « Arrêt de prise de service » est toujours le départ TAD, mais n'impose aucun autre arrêt.
  state.service.tadStops.add(start);
  const terminus=tadTerminusIndex();
  ui.tadStopList.innerHTML=state.pattern.stops.map((st,i)=>{
    const before=i<start, origin=i===start, checked=state.service.tadStops.has(i), isTerminus=i===terminus;
    const meta=[stopScheduleLabel(i),before?'avant le départ TAD':origin?'DÉPART TAD':isTerminus?'TERMINUS TAD':checked?'arrêt à desservir':'non desservi'].filter(Boolean).join(' · ');
    const tag=origin?'DÉPART':isTerminus?'TERMINUS':checked?'TAD':'IGNORÉ';
    return `<label class="stop-check ${checked?'tad-selected':''} ${isTerminus?'tad-terminus':''}"><input class="tad-stop-checkbox" type="checkbox" data-index="${i}" ${checked?'checked':''} ${(before||origin)?'disabled':''}><span class="stop-check-main"><span class="stop-check-name">${i+1}. ${esc(st.name)}</span><span class="stop-check-meta">${esc(meta)}</span></span><span class="stop-check-tag">${tag}</span></label>`;
  }).join('');
  updateTadSummary();
}
function updateTadSummary(){
  if(!ui.tadSummary||!state.pattern) return;
  const start=Number(ui.startStop.value||0), future=tadSelectedIndices().filter(i=>i>start), origin=state.pattern.stops[start], term=future.length?state.pattern.stops[future[future.length-1]]:null;
  ui.tadSummary.textContent=term
    ? `Départ : ${origin?.name||'—'} · ${future.length} arrêt${future.length>1?'s':''} à desservir · Terminus : ${term.name}. Le tracé s'arrête à ce dernier arrêt.`
    : `Départ : ${origin?.name||'—'} · sélectionne au moins un arrêt à desservir ; le dernier sélectionné deviendra automatiquement le terminus.`;
  refreshStartAvailability(); updateStopMarkers();
}
function refreshStartAvailability(){
  const base=!!state.pattern&&state.pattern.stops.length>=2;
  let valid=base;
  if(base&&state.service.mode==='tad'){
    const start=Number(ui.startStop.value||0); valid=nextOperationalStop(start)!==null;
  }
  ui.start.disabled=!valid; ui.simulate.disabled=!valid;
  ui.start.textContent=state.service.mode==='tad'?'🛰 PRISE DE SERVICE TAD GPS':state.service.mode==='formation'?'🎓 DÉMARRER LA FORMATION GPS':'🛰 PRISE DE SERVICE GPS';
  ui.simulate.textContent=state.service.mode==='tad'?'▶︎ SIMULER LE TAD':state.service.mode==='formation'?'▶︎ SIMULER LA FORMATION':'▶︎ SIMULER CETTE COURSE';
}
function renderRequestsButton(){
  if(!ui.requestsBtn) return;
  const n=[...state.service.requestedStops].filter(i=>i>state.current).length;
  ui.requestsBtn.classList.toggle('hidden',state.service.mode==='tad');
  if(ui.requestsCount) ui.requestsCount.textContent=String(n);
}
function renderRequestSheet(){
  if(!ui.requestsList||!state.pattern) return;
  ui.requestsList.innerHTML=state.pattern.stops.map((st,i)=>{
    const past=i<=state.current, checked=state.service.requestedStops.has(i), meta=[stopScheduleLabel(i),past?'déjà passé':''].filter(Boolean).join(' · ');
    return `<label class="stop-check ${checked?'requested':''}"><input class="request-stop-checkbox" type="checkbox" data-index="${i}" ${checked?'checked':''} ${past?'disabled':''}><span class="stop-check-main"><span class="stop-check-name">${i+1}. ${esc(st.name)}</span><span class="stop-check-meta">${esc(meta)}</span></span><span class="stop-check-tag">${checked?'🔔 DEMANDÉ':'ARRÊT'}</span></label>`;
  }).join('');
}
function openRequests(){ if(state.service.mode==='tad'||!state.pattern) return; renderRequestSheet(); ui.requestsSheet?.classList.remove('hidden'); }
function closeRequests(){ ui.requestsSheet?.classList.add('hidden'); }
function clearRequests(){
  state.service.requestedStops.clear(); state.service.requestAlertIndex=null; state.service.requestChimedStops.clear();
  renderRequestSheet(); renderRequestsButton(); updateRequestAlert(false); updateStopMarkers();
}
function updateRequestAlert(showForTarget=false){
  if(!ui.requestAlert) return;
  const idx=state.target, requested=state.service.mode!=='tad'&&Number.isInteger(idx)&&state.service.requestedStops.has(idx);
  if(requested&&showForTarget){
    const wasVisible=!ui.requestAlert.classList.contains('hidden')&&state.service.requestAlertIndex===idx;
    state.service.requestAlertIndex=idx;
    ui.requestAlertStop.textContent=state.pattern?.stops?.[idx]?.name||'—';
    ui.requestAlert.classList.remove('hidden');
    // V21 : le signal sonore est synchronisé avec l'apparition visuelle de l'arrêt demandé.
    if(!wasVisible&&!state.service.requestChimedStops.has(idx)){
      state.service.requestChimedStops.add(idx); playRequestChime(idx);
    }
  }else if(!requested||state.service.requestAlertIndex!==idx){
    state.service.requestAlertIndex=null; ui.requestAlert.classList.add('hidden');
  }
}
function requestStop(index,checked){
  if(!state.pattern||index<=state.current) return;
  // Ce geste utilisateur sert aussi à armer Web Audio pour que le ding-dong puisse jouer plus tard sur iPhone.
  primeRequestChime();
  if(checked){
    state.service.requestedStops.add(index); state.service.requestChimedStops.delete(index);
  }else{
    state.service.requestedStops.delete(index); state.service.requestChimedStops.delete(index);
  }
  if(!checked&&state.service.requestAlertIndex===index) state.service.requestAlertIndex=null;
  renderRequestsButton(); renderRequestSheet(); updateStopMarkers();
  if(index===state.target){
    let show=false;
    if(checked&&state.running&&state.departed&&state.pos){ const q=state.fusion.snapped||state.pos.coords; show=legProgress(q.lat??q.latitude,q.lon??q.longitude)>=.06; }
    updateRequestAlert(show);
  }
}

function resetSelections(level='dept'){
  if(level==='dept'){
    state.routes=[]; state.route=null; state.patterns=[]; state.pattern=null;
    ui.route.disabled=true; ui.route.innerHTML='<option>Choisir d’abord un département</option>';
  }
  if(level==='dept'||level==='route'){
    state.patterns=[]; state.pattern=null; state.runOptions=[]; state.run=null;
    ui.trip.disabled=true; ui.trip.innerHTML='<option>Choisir d’abord une ligne</option>';
    if(ui.formationPattern){ ui.formationPattern.disabled=true; ui.formationPattern.innerHTML='<option>Choisir d’abord une ligne</option>'; }
    ui.startStop.disabled=true; ui.startStop.innerHTML='<option>Choisir d’abord une course/parcours</option>';
    ui.start.disabled=true; ui.simulate.disabled=true;
    state.service.tadStops.clear(); state.service.requestedStops.clear(); state.service.requestAlertIndex=null; state.service.requestChimedStops.clear();
    renderTadStopList(); renderRequestsButton(); updateRequestAlert(false);
    if(ui.courseInfo) ui.courseInfo.textContent='Aucune course sélectionnée.';
  }
}

async function loadDept(d){
  if(!d){ resetSelections('dept'); state.dept=null; status('Choisis un département.'); return; }
  state.dept=d; resetSelections('dept');
  ui.route.innerHTML='<option>Chargement…</option>';
  status(`Chargement des lignes ${d}…`);
  try{
    const [data,svc]=await Promise.all([jget(`data/${d}/routes.json`),jget(`data/${d}/services.json`).catch(()=>({services:{}}))]);
    state.routes=data.routes||[]; state.services=svc.services||{};
    ui.route.innerHTML='<option value="">Choisir une ligne…</option>'+state.routes.map(r=>`<option value="${esc(r.id)}">${esc(r.short)} — ${esc(r.long)}</option>`).join('');
    ui.route.disabled=false;
    status(`${state.routes.length} lignes · ${data.stop_count} points d’arrêt chargés.`, 'ok');
  }catch(e){
    ui.route.innerHTML='<option>Données indisponibles</option>';
    status(`Impossible de charger les données ${d}: ${e.message}. Vérifie que l’action GitHub Pages a terminé la publication.`, 'err');
  }
}

async function loadRoute(r){
  state.route=r; resetSelections('route');
  ui.trip.innerHTML='<option>Chargement des courses exactes…</option>';
  try{
    const data=await jget(`data/${state.dept}/${r.file}`);
    state.patterns=data.patterns||[];
    if(state.service.mode==='formation') populateFormationPatterns(); else populateRuns();
    const count=state.patterns.reduce((n,p)=>n+(p.trips?.length||0),0);
    status(state.service.mode==='formation'
      ? `${state.patterns.length} parcours disponibles pour ${r.short}. Choisis le sens/parcours de formation ; aucun horaire ne sera appliqué.`
      : `${count} courses GTFS disponibles pour ${r.short}. Choisis l’heure : la variante exacte sera sélectionnée automatiquement.`, 'ok');
  }catch(e){ status(`Courses impossibles à charger: ${e.message}`,'err'); }
}

function ymd(date){ return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`; }
function serviceActive(serviceId,date){
  const r=state.services?.[serviceId]; if(!r) return true;
  const key=ymd(date), ex=r.exceptions?.[key]; if(ex===1) return true; if(ex===2) return false;
  if(r.start&&key<r.start) return false; if(r.end&&key>r.end) return false;
  const wd=(date.getDay()+6)%7; return !!r.days?.[wd];
}
function gtfsSeconds(t){ if(!t) return null; const m=String(t).match(/^(\d+):(\d{2})(?::(\d{2}))?$/); return m?(+m[1]*3600 + +m[2]*60 + +(m[3]||0)):null; }
function serviceMidnight(date){ return new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0,0); }
function departureFor(trip,startIndex,serviceDate){
  const pair=trip?.times?.[startIndex], raw=pair?.[1]||pair?.[0], sec=gtfsSeconds(raw); if(sec===null) return null;
  return new Date(serviceMidnight(serviceDate).getTime()+sec*1000);
}
function arrivalFor(trip,index,serviceDate){
  const pair=trip?.times?.[index], raw=pair?.[0]||pair?.[1], sec=gtfsSeconds(raw); if(sec===null) return null;
  return new Date(serviceMidnight(serviceDate).getTime()+sec*1000);
}
function lineIdentity(){ return `Ligne ${spokenLineCode(state.route?.short||'')}, à destination de ${spoken(state.pattern?.headsign||state.pattern?.stops?.at(-1)?.name||'')}.`; }
function formatClock(d){ return d?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—'; }
function signedDuration(seconds){
  if(!Number.isFinite(seconds)) return '—';
  const sign=seconds<0?'−':'+'; const a=Math.abs(Math.round(seconds));
  return `${sign}${Math.floor(a/60)}:${String(a%60).padStart(2,'0')}`;
}
function scheduleClass(deltaSeconds){
  // Convention demandée : avance rouge ; à l'heure bleu ; retard <5 vert ; 5–10 jaune ; 10+ orange.
  // Une tolérance de ±1 minute évite que l'affichage change de statut pour quelques secondes.
  if(deltaSeconds < -60) return {key:'advance',label:'AVANCE'};
  if(deltaSeconds <= 60) return {key:'ontime',label:'À L’HEURE'};
  if(deltaSeconds < 300) return {key:'late-green',label:'RETARD'};
  if(deltaSeconds < 600) return {key:'late-yellow',label:'RETARD'};
  return {key:'late-orange',label:'RETARD'};
}
function plannedTimeAtPosition(){
  if(!state.run||!state.pattern) return null;
  const trip=state.run.trip, date=state.run.serviceDate, along=state.fusion.snapped?.along, xs=state.fusion.stopAlong||[];
  if(Number.isFinite(along)&&xs.length===state.pattern.stops.length&&xs.length){
    if(along<=xs[0]+1) return departureFor(trip,0,date)||arrivalFor(trip,0,date);
    for(let i=0;i<xs.length-1;i++){
      const a=xs[i], b=xs[i+1]; if(!Number.isFinite(a)||!Number.isFinite(b)||along>b+1) continue;
      const ta=departureFor(trip,i,date)||arrivalFor(trip,i,date), tb=arrivalFor(trip,i+1,date)||departureFor(trip,i+1,date);
      if(!ta||!tb) return ta||tb||null;
      const f=b>a?Math.max(0,Math.min(1,(along-a)/(b-a))):0;
      return new Date(ta.getTime()+(tb.getTime()-ta.getTime())*f);
    }
    return arrivalFor(trip,xs.length-1,date)||departureFor(trip,xs.length-1,date);
  }
  const i=Math.min(state.current,state.pattern.stops.length-1), j=Math.min(state.target,state.pattern.stops.length-1);
  const ta=departureFor(trip,i,date)||arrivalFor(trip,i,date), tb=arrivalFor(trip,j,date)||departureFor(trip,j,date);
  if(!ta) return tb||null; if(!tb||i===j||!state.pos) return ta;
  const f=legProgress(state.pos.coords.latitude,state.pos.coords.longitude);
  return new Date(ta.getTime()+(tb.getTime()-ta.getTime())*f);
}
function setScheduleDisplay(kind,label,value,reference){
  if(!ui.schedulePanel) return;
  ui.schedulePanel.className=`schedule-panel ${kind}`;
  ui.scheduleLabel.textContent=label; ui.scheduleDelta.textContent=value;
  ui.scheduleReference.textContent=reference||'Référence horaire de la course';
  ui.scheduleMetric.textContent=(label==='PRÉ-DÉPART'||label==='HORAIRE INDISPONIBLE')?'—':`${label} ${value}`;
}
function updateScheduleAdherence(){
  if(state.service.mode==='formation') return;
  if(!state.running||!state.run){ setScheduleDisplay('ontime','HORAIRE INDISPONIBLE','—','Aucune course horaire active'); return; }
  const dep=selectedDepartureDate(), now=Date.now();
  if(!state.departed&&dep&&now<dep.getTime()&&state.mode!=='simulation'){
    const left=(dep.getTime()-now)/1000; const m=Math.floor(left/60), sec=Math.floor(left%60);
    setScheduleDisplay('ontime','PRÉ-DÉPART',`T−${m}:${String(sec).padStart(2,'0')}`,`Départ théorique ${formatClock(dep)}`); return;
  }
  if(!state.departed&&state.mode==='simulation'){
    setScheduleDisplay('ontime','PRÉ-DÉPART','SIM','La régulation s’active au départ simulé'); return;
  }
  const planned=plannedTimeAtPosition(); if(!planned){ setScheduleDisplay('ontime','HORAIRE INDISPONIBLE','—','Horaire GTFS absent à cette position'); return; }
  const actualMs=state.mode==='simulation'?planned.getTime()+Number(state.sim.delaySeconds||0)*1000:Date.now();
  const delta=(actualMs-planned.getTime())/1000, cls=scheduleClass(delta);
  state.punctuality.deltaSeconds=delta; state.punctuality.plannedTime=planned; state.punctuality.status=cls.key;
  setScheduleDisplay(cls.key,cls.label,signedDuration(delta),`Horaire théorique interpolé ${formatClock(planned)} · course exacte`);
}
function startPunctualityTicker(){
  if(state.punctuality.ticker) clearInterval(state.punctuality.ticker);
  if(state.service.mode==='formation') return;
  state.punctuality.ticker=setInterval(updateScheduleAdherence,1000); updateScheduleAdherence();
}
function clearPunctualityTicker(){ if(state.punctuality.ticker){ clearInterval(state.punctuality.ticker); state.punctuality.ticker=null; } }
function parseServiceDate(){
  const raw=ui.serviceDate?.value; if(!raw) return serviceMidnight(new Date());
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?new Date(+m[1],+m[2]-1,+m[3],0,0,0,0):serviceMidnight(new Date());
}
function variantHint(pattern){
  const s=pattern?.stops||[]; if(s.length<4) return '';
  const picks=[Math.floor((s.length-1)*.33),Math.floor((s.length-1)*.66)].filter((x,i,a)=>x>0&&x<s.length-1&&a.indexOf(x)===i);
  return picks.length?` · via ${picks.map(i=>s[i].name.split(' - ')[0]).join(' / ')}`:'';
}
function populateFormationPatterns(){
  state.runOptions=[]; state.run=null; state.pattern=null;
  if(!ui.formationPattern) return;
  if(!state.route||!state.patterns.length){ ui.formationPattern.disabled=true; ui.formationPattern.innerHTML='<option>Choisir d’abord une ligne</option>'; return; }
  ui.formationPattern.innerHTML='<option value="">Choisir le sens / parcours…</option>'+state.patterns.map((p,i)=>{
    const origin=p.stops?.[0]?.name||'Départ', dest=p.headsign||p.stops?.at(-1)?.name||'Terminus';
    const dir=p.direction!==''&&p.direction!=null?` · sens ${Number(p.direction)+1}`:'';
    return `<option value="${i}">${esc(origin)} → ${esc(dest)}${esc(dir)} · ${p.stops.length} arrêts${esc(variantHint(p))}</option>`;
  }).join('');
  ui.formationPattern.disabled=false;
  ui.startStop.disabled=true; ui.startStop.innerHTML='<option>Choisir d’abord un parcours</option>'; ui.start.disabled=true; ui.simulate.disabled=true;
  if(ui.courseInfo) ui.courseInfo.textContent=`${state.patterns.length} parcours disponibles en mode Formation. Aucun horaire n’est utilisé.`;
  status(`Mode Formation : choisis un sens/parcours pour ${state.route.short}.`, 'ok');
}
async function selectFormationPattern(i){
  const p=Number.isInteger(i)?state.patterns[i]||null:null;
  state.run=null; state.pattern=p; V20Geometry.token++;
  if(!p){ ui.startStop.disabled=true; ui.startStop.innerHTML='<option>Choisir d’abord un parcours</option>'; ui.start.disabled=true; ui.simulate.disabled=true; if(ui.courseInfo) ui.courseInfo.textContent='Aucun parcours de formation sélectionné.'; return; }
  ui.startStop.innerHTML=p.stops.map((s,n)=>`<option value="${n}">${n+1}. ${esc(s.name)}</option>`).join('');
  ui.startStop.disabled=false; ui.startStop.value='0';
  state.service.requestedStops.clear(); state.service.requestAlertIndex=null; state.service.requestChimedStops.clear(); state.service.tadStops.clear();
  prepareCourseGeometry(); renderRequestsButton();
  const ok=await ensureExactPatternGeometry(p); if(p!==state.pattern) return;
  if(ok) refreshStartAvailability(); else {ui.start.disabled=true;ui.simulate.disabled=true;}
  if(ui.courseInfo) ui.courseInfo.textContent=`FORMATION · ${p.stops.length} arrêts · ${geometrySourceLabel(p)} · sens/parcours sans horaire`;
  updateDepartureDisplay();
}
function populateRuns(){
  if(!state.route||!state.patterns.length){ ui.trip.disabled=true; return; }
  const serviceDate=parseServiceDate(), candidates=[];
  for(let pi=0;pi<state.patterns.length;pi++){
    const pattern=state.patterns[pi];
    for(const trip of (pattern.trips||[])){
      if(!serviceActive(trip.service,serviceDate)) continue;
      const dep=departureFor(trip,0,serviceDate); if(!dep) continue;
      candidates.push({trip,pattern,patternIndex:pi,serviceDate,originDeparture:dep});
    }
  }
  candidates.sort((a,b)=>a.originDeparture-b.originDeparture||a.pattern.stops.length-b.pattern.stops.length||String(a.trip.id).localeCompare(String(b.trip.id)));
  state.runOptions=candidates;
  ui.trip.innerHTML=candidates.length?'<option value="">Choisir le départ exact…</option>'+candidates.map((r,i)=>{
    const origin=r.pattern.stops[0]?.name||'Départ', dest=r.pattern.headsign||r.pattern.stops.at(-1)?.name||'Terminus';
    return `<option value="${i}">${esc(formatClock(r.originDeparture))} · ${esc(origin)} → ${esc(dest)} · ${r.pattern.stops.length} arrêts${esc(variantHint(r.pattern))}</option>`;
  }).join(''):'<option value="">Aucune course ce jour</option>';
  ui.trip.disabled=!candidates.length;
  state.run=null; state.pattern=null; state.service.tadStops.clear(); state.service.requestedStops.clear(); state.service.requestAlertIndex=null; state.service.requestChimedStops.clear(); ui.startStop.disabled=true; ui.startStop.innerHTML='<option>Choisir d’abord une course</option>'; ui.start.disabled=true; ui.simulate.disabled=true; renderTadStopList(); renderRequestsButton();
  if(ui.courseInfo) ui.courseInfo.textContent=candidates.length?`${candidates.length} départs trouvés pour cette date.`:'Aucune course active à cette date.';
  if(candidates.length){
    const now=new Date(), same=ymd(serviceDate)===ymd(now);
    let pick=same?candidates.findIndex(r=>r.originDeparture>=now):-1;
    if(pick>=0){ ui.trip.value=String(pick); selectRun(pick); }
  }
}
async function selectRun(i){
  const r=Number.isInteger(i)?state.runOptions[i]||null:null;
  state.run=r; state.pattern=r?.pattern||null; V20Geometry.token++;
  if(!r){ state.pattern=null; state.service.tadStops.clear(); state.service.requestedStops.clear(); state.service.requestAlertIndex=null; state.service.requestChimedStops.clear(); ui.startStop.disabled=true; ui.startStop.innerHTML='<option>Choisir d’abord une course</option>'; ui.start.disabled=true; ui.simulate.disabled=true; renderTadStopList(); renderRequestsButton(); updateDepartureDisplay(); return; }
  ui.startStop.innerHTML=state.pattern.stops.map((s,n)=>{
    const d=departureFor(r.trip,n,r.serviceDate), t=d?` · ${formatClock(d)}`:'';
    return `<option value="${n}">${n+1}. ${esc(s.name)}${esc(t)}</option>`;
  }).join('');
  ui.startStop.disabled=false; ui.startStop.value='0';
  prepareCourseGeometry();
  state.service.requestedStops.clear(); state.service.requestAlertIndex=null; state.service.requestChimedStops.clear();
  if(state.service.mode==='tad') renderTadStopList(true); else state.service.tadStops.clear();
  renderRequestsButton(); ui.start.disabled=true; ui.simulate.disabled=true;
  const ok=await ensureExactPatternGeometry(state.pattern); if(r!==state.run) return;
  if(state.service.mode==='tad') renderTadStopList(false);
  if(ok) refreshStartAvailability(); else {ui.start.disabled=true;ui.simulate.disabled=true;}
  if(ui.courseInfo){
    const end=arrivalFor(r.trip,state.pattern.stops.length-1,r.serviceDate);
    ui.courseInfo.textContent=`Course exacte ${formatClock(r.originDeparture)} → ${formatClock(end)} · ${state.pattern.stops.length} arrêts · ${geometrySourceLabel(state.pattern)} · trip_id ${r.trip.id}`;
  }
  updateDepartureDisplay();
}
function selectedDepartureDate(){ return state.run?departureFor(state.run.trip,Number(ui.startStop.value||0),state.run.serviceDate):null; }
function secureMessage(){ if(window.isSecureContext) return null; return `Cette page n’est pas dans un contexte sécurisé (${location.protocol}). Le GPS réel exige HTTPS. La simulation, elle, fonctionne sans GPS.`; }

async function keepScreenAwake(){
  if(!state.running||document.visibilityState!=='visible'||!('wakeLock' in navigator)) return;
  try{
    if(state.wakeLock&&!state.wakeLock.released) return;
    const sentinel=await navigator.wakeLock.request('screen');
    state.wakeLock=sentinel;
    sentinel.addEventListener('release',()=>{
      if(state.wakeLock===sentinel) state.wakeLock=null;
      // iOS peut relâcher le verrou pendant une rotation/changement d'état : on le reprend tant que le service est actif.
      if(state.running&&document.visibilityState==='visible') setTimeout(()=>keepScreenAwake(),250);
    },{once:true});
  }catch(e){ console.warn('Wake Lock indisponible',e?.name||e); }
  if(!state.wakeLockTimer){
    state.wakeLockTimer=setInterval(()=>{
      if(state.running&&document.visibilityState==='visible'&&(!state.wakeLock||state.wakeLock.released)) keepScreenAwake();
    },12000);
  }
}
async function releaseScreenAwake(){
  if(state.wakeLockTimer){ clearInterval(state.wakeLockTimer); state.wakeLockTimer=null; }
  const lock=state.wakeLock; state.wakeLock=null;
  try{ if(lock&&!lock.released) await lock.release(); }catch{}
}
function restoreScreenWake(){ if(state.running&&document.visibilityState==='visible') keepScreenAwake(); }
document.addEventListener('visibilitychange',restoreScreenWake);
window.addEventListener('focus',restoreScreenWake,{passive:true});
window.addEventListener('pageshow',restoreScreenWake,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(restoreScreenWake,250),{passive:true});
function gpsOnce(){ return new Promise((ok,ko)=>{ if(!navigator.geolocation) return ko(new Error('Géolocalisation absente du navigateur.')); navigator.geolocation.getCurrentPosition(ok,ko,{enableHighAccuracy:true,timeout:15000,maximumAge:1000}); }); }
async function testGps(){
  const sec=secureMessage();
  if(sec){ ui.gpsTestResult.textContent=sec; status(sec,'err'); return; }
  ui.gpsTestResult.textContent='Recherche de la position…';
  try{
    const p=await gpsOnce(); state.pos=p;
    ui.gpsPill.className='pill on'; ui.gpsPill.textContent='GPS OK';
    ui.gpsTestResult.textContent=`GPS OK · précision ±${Math.round(p.coords.accuracy)} m`;
    status('Le GPS est autorisé. Tu peux choisir une ligne ou lancer une simulation.','ok');
  }catch(e){
    const m=e.code===1?'Autorisation GPS refusée. Vérifie Réglages > Confidentialité et sécurité > Service de localisation > Safari.':(e.message||'GPS indisponible');
    ui.gpsTestResult.textContent=m; status(m,'err');
  }
}

function clearDepartureScheduling(){
  state.departureTimers.forEach(clearTimeout); state.departureTimers=[];
  if(state.departureTicker){ clearInterval(state.departureTicker); state.departureTicker=null; }
}
function updateDepartureDisplay(){
  if(!ui.departureTime) return;
  const dep=selectedDepartureDate(); ui.departureTime.textContent=dep?formatClock(dep):'Non sélectionné';
  if(!dep){ ui.departureCountdown.textContent='Annonces pré-départ indisponibles'; return; }
  const ms=dep-Date.now();
  if(ms>0){ const m=Math.floor(ms/60000), sec=Math.floor((ms%60000)/1000); ui.departureCountdown.textContent=`T−${m}:${String(sec).padStart(2,'0')}`; }
  else ui.departureCountdown.textContent=state.departed?'En service':`Départ prévu ${Math.ceil(-ms/60000)} min auparavant`;
}
function scheduleDepartureAnnouncements(){
  clearDepartureScheduling(); updateDepartureDisplay();
  const dep=selectedDepartureDate(); if(!dep){ state.departed=true; return; }
  const now=Date.now(), at5=dep.getTime()-5*60000, at1=dep.getTime()-60000;
  state.departed=now>=dep.getTime();
  const later=(when,fn)=>{ if(when>now+100) state.departureTimers.push(setTimeout(fn,when-now)); };
  later(at5,()=>say('Départ dans cinq minutes.',{priority:90,kind:'departure'}));
  later(at1,()=>say(`${lineIdentity()} Départ dans une minute.`,{priority:90,kind:'departure'}));
  later(dep.getTime(),()=>{ state.departed=true; updateDepartureDisplay(); });
  state.departureTicker=setInterval(updateDepartureDisplay,1000);
}
function legProgress(lat,lon){
  const a=state.fusion.stopAlong?.[state.current], b=state.fusion.stopAlong?.[state.target], x=state.fusion.snapped?.along;
  if(Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(x)&&b>a) return Math.max(0,Math.min(1,(x-a)/(b-a)));
  const A=state.pattern?.stops?.[state.current],B=state.pattern?.stops?.[state.target]; if(!A||!B) return 0;
  const total=dist(A.lat,A.lon,B.lat,B.lon); return total?Math.max(0,Math.min(1,dist(A.lat,A.lon,lat,lon)/total)):0;
}
function threshold(speed){ const v=Number.isFinite(speed)&&speed>=0?speed:8.3; return Math.max(150,Math.min(520,v*18+45)); }
function labels(){
  const p=state.pattern,c=p?.stops[state.current],n=p?.stops[state.target];
  ui.current.textContent=c?.name||'Départ'; ui.next.textContent=n?.name||'TERMINUS';
  ui.remaining.textContent=p?operationalRemaining():'—'; updateStopMarkers(); renderRequestsButton();
  ui.prev.disabled=previousOperationalStop(state.current)===null; ui.nextBtn.disabled=!n; ui.speak.disabled=!n;
  if(ui.nextScheduled){
    const at=state.service.mode!=='formation'&&n&&state.run?arrivalFor(state.run.trip,state.target,state.run.serviceDate):null;
    ui.nextScheduled.textContent=at?`Prévu ${formatClock(at)}`:'—';
  }
  if(!n){ ui.distance.textContent='Terminus'; ui.announceState.textContent=state.mode==='simulation'?'Simulation arrivée au terminus':'Service terminé'; }
}
function nextStopDelayMs(){
  // En simulation, le délai suit l'accélération du temps afin de tester le scénario sans attendre 15 s réelles à x10/x40.
  const scale=state.mode==='simulation'?Math.max(1,Number(state.sim.scale||1)):1;
  return 15000/scale;
}
function armNextStopAnnouncement(){
  if(!state.pattern?.stops?.[state.target]){ state.nextStopDueAt=null; return; }
  state.nextStopDueAt=Date.now()+nextStopDelayMs();
}
function announce(force=false){
  const s=state.pattern?.stops[state.target]; if(!s) return;
  say(`Prochain arrêt, ${spoken(s.name)}.`,{priority:100,kind:'stop'}); state.announced=true; state.nextStopDueAt=null;
  ui.announceState.textContent=force?'Annonce manuelle':(state.mode==='simulation'?'Prochain arrêt annoncé (simulation)':'Prochain arrêt annoncé');
}
function announceArrival(){
  const s=state.pattern?.stops[state.target]; if(!s||state.arrivalAnnounced) return;
  const isTerminus=nextOperationalStop(state.target)===null;
  say(isTerminus?`Arrêt, ${spoken(s.name)}. Terminus.`:`Arrêt, ${spoken(s.name)}.`,{priority:120,kind:'stop'});
  state.arrivalAnnounced=true;
  // Si l'inter-arrêt était exceptionnellement très court, on ne prononce plus "Prochain arrêt" après l'arrivée.
  state.announced=true; state.nextStopDueAt=null;
  ui.announceState.textContent=isTerminus?'Arrivée au terminus':`Arrivée : ${s.name}`;
}
function advance(manual=false){
  if(!state.pattern||state.target>=state.pattern.stops.length) return;
  const reachedIndex=state.target;
  state.current=reachedIndex;
  if(state.service.mode!=='tad'){ state.service.requestedStops.delete(reachedIndex); state.service.requestChimedStops.delete(reachedIndex); }
  const nx=nextOperationalStop(state.current); state.target=nx===null?state.pattern.stops.length:nx;
  state.announced=false; state.arrivalAnnounced=false; state.midpointAnnounced=false; state.reached=false; state.minDist=Infinity; state.lastAdvance=Date.now(); state.firstLegDepartureSeen=true; armNextStopAnnouncement(); labels(); renderRequestsButton();
  // Dès que l'arrêt précédent vient d'être franchi, une éventuelle demande sur le prochain arrêt devient prioritaire visuellement.
  updateRequestAlert(true);
}
function previous(){
  const prev=previousOperationalStop(state.current); if(prev===null) return;
  state.target=state.current; state.current=prev; state.announced=false; state.arrivalAnnounced=false; state.nextStopDueAt=null; state.firstLegDepartureSeen=false; state.midpointAnnounced=false; state.reached=false; state.minDist=Infinity; state.lastAdvance=Date.now(); labels(); updateRequestAlert(false);
  if(state.mode==='simulation') syncSimulationToState();
}

function processPos(p){
  state.pos=p;
  const c=p.coords, snap=snapToCourse(c,p.timestamp||Date.now()); state.fusion.snapped=snap;
  updateNavigation(p,snap);
  if(state.running) updateScheduleAdherence();
  if(state.mode==='simulation'){
    ui.gpsPill.className='pill on'; ui.gpsPill.textContent='SIMULATION';
  }else{
    ui.gpsPill.className='pill on'; ui.gpsPill.textContent='GPS actif';
  }
  ui.accuracy.textContent=state.mode==='simulation'?'±5 m simulés':`±${Math.round(c.accuracy||0)} m`;
  const sp=Number.isFinite(c.speed)&&c.speed>=0?c.speed:null;
  ui.speed.textContent=sp===null?'—':`${Math.round(sp*3.6)} km/h`;
  if(!state.running) return;
  const t=state.pattern?.stops[state.target]; if(!t) return;
  const physicalD=dist(c.latitude,c.longitude,t.lat,t.lon), routeD=routeDistanceToStop(state.target,c), reach=65;
  ui.distance.textContent=fmt(routeD);
  if(!state.announced){
    const wait=state.nextStopDueAt?Math.max(0,Math.ceil((state.nextStopDueAt-Date.now())/1000)):null;
    ui.threshold.textContent=wait===null?'au départ':`${wait} s`;
  }else ui.threshold.textContent='annoncé';
  const good=(c.accuracy||999)<=120;
  const origin=state.pattern.stops[state.current], originD=origin?dist(c.latitude,c.longitude,origin.lat,origin.lon):Infinity;
  if(!state.departed){
    const moved=originD>80;
    if(moved||(sp!==null&&sp>4)){ state.departed=true; updateDepartureDisplay(); }
  }
  if(!state.departed){ ui.announceState.textContent='En attente du départ prévu'; return; }
  // Première sortie du point de départ (notamment Formation) : le compte à rebours du prochain arrêt commence seulement quand le véhicule quitte réellement le poteau.
  if(!state.firstLegDepartureSeen && originD>35){ state.firstLegDepartureSeen=true; armNextStopAnnouncement(); }
  const prog=legProgress(snap.lat,snap.lon);
  if(state.service.mode!=='tad'&&state.service.requestedStops.has(state.target)&&prog>=.06) updateRequestAlert(true);
  if(!state.midpointAnnounced&&prog>=.5){ state.midpointAnnounced=true; say(lineIdentity(),{priority:40,kind:'identity',ephemeral:true}); }
  // Règle V11 : "Prochain arrêt" est prononcé environ 15 secondes après avoir quitté l'arrêt précédent.
  if(!state.announced&&state.nextStopDueAt&&Date.now()>=state.nextStopDueAt) announce(false);
  // À l'arrivée, une seconde annonce nomme explicitement le poteau. La zone s'adapte à la précision GPS.
  const arrivalZone=Math.max(28,Math.min(55,(c.accuracy||10)*1.2+18));
  if(good&&!state.arrivalAnnounced&&(physicalD<=arrivalZone||routeD<=arrivalZone)) announceArrival();
  if(good&&physicalD<=reach){ state.reached=true; state.minDist=Math.min(state.minDist,physicalD); }
  if(state.reached) state.minDist=Math.min(state.minDist,physicalD);
  const targetAlong=state.fusion.stopAlong?.[state.target], passedAlong=Number.isFinite(snap.along)&&Number.isFinite(targetAlong)&&snap.along>targetAlong+42;
  if(good&&((state.reached&&physicalD>=Math.max(reach+25,state.minDist+35))||passedAlong)){ advance(false); return; }
  const followingIndex=nextOperationalStop(state.target), following=followingIndex===null?null:state.pattern.stops[followingIndex];
  if(good&&following&&physicalD>220){ const df=dist(c.latitude,c.longitude,following.lat,following.lon); if(df<100&&df<physicalD*.45) advance(false); }
}
function geoErr(e){ ui.gpsPill.className='pill'; ui.gpsPill.textContent='GPS erreur'; status(e.code===1?'Autorisation GPS refusée.':'Position GPS indisponible.','err'); }

function enterDriver(mode){
  const s=Number(ui.startStop.value||0);
  state.current=Math.min(Math.max(0,s),state.pattern.stops.length-1);
  if(state.service.mode==='tad') state.service.tadStops.add(state.current);
  const nx=nextOperationalStop(state.current); state.target=nx===null?state.pattern.stops.length:nx;
  state.announced=false; state.arrivalAnnounced=false; state.nextStopDueAt=null; state.firstLegDepartureSeen=false; state.midpointAnnounced=false; state.reached=false; state.minDist=Infinity; state.lastAdvance=Date.now()-10000;
  prepareCourseGeometry();
  state.running=true; state.mode=mode; keepScreenAwake();
  startPunctualityTicker();
  ui.setup.classList.add('hidden'); ui.driver.classList.remove('hidden');
  ui.driver.classList.toggle('formation-running',state.service.mode==='formation');
  ui.routeBadge.textContent=state.route.short; ui.headsign.textContent=state.pattern.headsign;
  ui.serviceBadge.textContent=state.service.mode==='tad'?'TAD':state.service.mode==='formation'?'FORMATION':'RÉGULIER';
  ui.serviceBadge.className=state.service.mode==='tad'?'servicebadge tad':state.service.mode==='formation'?'servicebadge formation':'servicebadge';
  renderRequestsButton(); updateRequestAlert(false); labels();
  state.nav.follow=true; syncFollowButton(); drawRoute();
  if(mode==='simulation'){
    ui.modeBadge.textContent='SIMULATION'; ui.modeBadge.className='modebadge sim';
    ui.simControls.classList.remove('hidden'); ui.recenter.classList.add('hidden');
  }else{
    ui.modeBadge.textContent='GPS RÉEL'; ui.modeBadge.className='modebadge';
    ui.simControls.classList.add('hidden'); ui.recenter.classList.remove('hidden');
  }
}

async function startGps(){
  const sec=secureMessage(); if(sec){ status(sec,'err'); return; }
  if(!state.pattern) return;
  enterDriver('gps');
  if(state.service.mode==='formation'){ clearDepartureScheduling(); state.departed=true; say(`Mode formation. ${lineIdentity()}`,{priority:30,kind:'system'}); }
  else { scheduleDepartureAnnouncements(); say('Annonces activées.',{priority:20,kind:'system'}); }
  state.watch=navigator.geolocation.watchPosition(processPos,geoErr,{enableHighAccuracy:true,timeout:15000,maximumAge:1000});
}

function syntheticPosition(lat,lon,speed,heading=null){
  return {timestamp:Date.now(),coords:{latitude:lat,longitude:lon,accuracy:5,altitude:null,altitudeAccuracy:null,heading:heading,speed:speed}};
}
function interpolate(a,b,f){ return {lat:a.lat+(b.lat-a.lat)*f,lon:a.lon+(b.lon-a.lon)*f}; }
function stopSimulationLoop(){ if(state.sim.raf!==null){ cancelAnimationFrame(state.sim.raf); state.sim.raf=null; } state.sim.playing=false; }
function nearestShapeIndex(lat,lon,shape){
  let bi=0,bd=Infinity; shape.forEach((p,i)=>{const d=dist(lat,lon,p[0],p[1]);if(d<bd){bd=d;bi=i;}}); return bi;
}
function buildSimulationPath(){
  const stops=state.pattern.stops, shape=(state.fusion.shape?.length>=2?state.fusion.shape:(state.pattern.shape?.length>=2?state.pattern.shape:stops.map(s=>[s.lat,s.lon])));
  const a=stops[state.current], z=stops[operationalEndIndex()];
  let i0=nearestShapeIndex(a.lat,a.lon,shape), i1=nearestShapeIndex(z.lat,z.lon,shape);
  let path=i0<=i1?shape.slice(i0,i1+1):shape.slice(i1,i0+1).reverse();
  // On force les vrais poteaux aux extrémités pour que le moteur touche bien départ/terminus.
  if(!path.length) path=[[a.lat,a.lon],[z.lat,z.lon]];
  path[0]=[a.lat,a.lon]; path[path.length-1]=[z.lat,z.lon];
  return path;
}
function syncSimulationToState(){
  const s=state.sim; s.path=buildSimulationPath(); s.pathIndex=0; s.pathFraction=0; s.holdUntil=0; s.heldTarget=-1; s.lastTs=performance.now();
}
function simulationArrivedAtTerminus(){
  if(state.target<state.pattern.stops.length){ if(!state.arrivalAnnounced) announceArrival(); advance(true); }
  stopSimulationLoop();
  ui.simPlayPause.textContent='▶︎ Reprendre'; ui.announceState.textContent='Simulation terminée au terminus';
  ui.gpsPill.textContent='SIMULATION FINIE';
}
function simulationFrame(ts){
  const s=state.sim;
  if(!state.running||state.mode!=='simulation'||!s.playing) return;
  if(!s.lastTs) s.lastTs=ts;
  const dt=Math.min(.5,Math.max(0,(ts-s.lastTs)/1000)); s.lastTs=ts;
  if(s.path.length<2||s.pathIndex>=s.path.length-1){ simulationArrivedAtTerminus(); return; }

  if(s.holdUntil){
    if(performance.now()<s.holdUntil){ s.raf=requestAnimationFrame(simulationFrame); return; }
    s.holdUntil=0;
  }

  let virtualTravel=s.speedMps*s.scale*dt;
  while(virtualTravel>0 && s.pathIndex<s.path.length-1){
    const a=s.path[s.pathIndex], b=s.path[s.pathIndex+1];
    const seg=Math.max(1,dist(a[0],a[1],b[0],b[1]));
    const remaining=(1-s.pathFraction)*seg;
    const step=Math.min(18,virtualTravel,remaining);
    s.pathFraction=Math.min(1,s.pathFraction+step/seg); virtualTravel-=step;
    const lat=a[0]+(b[0]-a[0])*s.pathFraction, lon=a[1]+(b[1]-a[1])*s.pathFraction;
    processPos(syntheticPosition(lat,lon,s.speedMps,bearing(a[0],a[1],b[0],b[1])));

    const target=state.pattern.stops[state.target];
    if(target && state.target!==s.heldTarget && dist(lat,lon,target.lat,target.lon)<22){
      s.heldTarget=state.target; s.holdUntil=performance.now()+700; ui.announceState.textContent='Arrêt simulé au poteau'; break;
    }
    if(s.pathFraction>=1){ s.pathIndex++; s.pathFraction=0; }
  }
  if(s.pathIndex>=s.path.length-1){
    const z=s.path[s.path.length-1]; processPos(syntheticPosition(z[0],z[1],0)); simulationArrivedAtTerminus(); return;
  }
  s.raf=requestAnimationFrame(simulationFrame);
}
function startSimulation(){
  if(!state.pattern) return;
  clearDepartureScheduling();
  enterDriver('simulation');
  const s=state.sim;
  s.speedMps=Number(ui.simSpeed.value||50)/3.6; s.scale=Number(ui.simScale.value||10); s.delaySeconds=Number(ui.simDelay?.value||0);
  s.playing=false; syncSimulationToState(); s.lastTs=performance.now();
  ui.gpsPill.className='pill on'; ui.gpsPill.textContent='SIMULATION';
  ui.accuracy.textContent='±5 m simulés';
  const p=s.path[0]; state.pos=syntheticPosition(p[0],p[1],0); updateNavigation(state.pos);
  if(state.service.mode==='formation'){
    state.departed=true; s.playing=true; ui.simPlayPause.disabled=false; ui.simSkip.disabled=false; ui.simPlayPause.textContent='⏸ Pause simulation';
    ui.announceState.textContent=`Formation simulée x${s.scale} · ${Math.round(s.speedMps*3.6)} km/h`;
    say(`Mode formation. ${lineIdentity()}`,{priority:30,kind:'system'}); processPos(syntheticPosition(p[0],p[1],s.speedMps)); s.raf=requestAnimationFrame(simulationFrame); return;
  }
  state.departed=false;
  ui.simPlayPause.textContent='Pré-départ…'; ui.simPlayPause.disabled=true; ui.simSkip.disabled=true;
  ui.announceState.textContent='Pré-départ simulé : test des annonces T−5 et T−1';
  ui.departureTime.textContent='Simulation'; ui.departureCountdown.textContent='T−5:00 simulé';
  say('Départ dans cinq minutes.',{priority:90,kind:'departure'});
  state.departureTimers.push(setTimeout(()=>{ ui.departureCountdown.textContent='T−1:00 simulé'; say(`${lineIdentity()} Départ dans une minute.`,{priority:90,kind:'departure'}); },1800));
  state.departureTimers.push(setTimeout(()=>{ state.departed=true; s.playing=true; s.lastTs=performance.now(); ui.simPlayPause.disabled=false; ui.simSkip.disabled=false; ui.simPlayPause.textContent='⏸ Pause simulation'; ui.departureCountdown.textContent='En service simulé'; ui.announceState.textContent=`Simulation du tracé GTFS x${s.scale} · ${Math.round(s.speedMps*3.6)} km/h`; processPos(syntheticPosition(p[0],p[1],s.speedMps)); s.raf=requestAnimationFrame(simulationFrame); },3900));
}
function toggleSimulation(){
  if(state.mode!=='simulation') return;
  const s=state.sim;
  if(s.playing){ stopSimulationLoop(); ui.simPlayPause.textContent='▶︎ Reprendre simulation'; ui.announceState.textContent='Simulation en pause'; }
  else{ s.playing=true; s.lastTs=performance.now(); ui.simPlayPause.textContent='⏸ Pause simulation'; ui.announceState.textContent='Simulation reprise'; s.raf=requestAnimationFrame(simulationFrame); }
}
function skipSimulationStop(){
  if(state.mode!=='simulation'||!state.pattern||state.target>=state.pattern.stops.length) return;
  const targetIndex=state.target, t=state.pattern.stops[targetIndex];
  processPos(syntheticPosition(t.lat,t.lon,0)); advance(true);
  if(targetIndex>=operationalEndIndex()){ simulationArrivedAtTerminus(); return; }
  // Repart du point du shape le plus proche du poteau sauté, puis poursuit le vrai tracé jusqu'au dernier arrêt opérationnel.
  const full=(state.fusion.shape?.length>=2?state.fusion.shape:(state.pattern.shape?.length>=2?state.pattern.shape:state.pattern.stops.map(s=>[s.lat,s.lon])));
  const endIndex=operationalEndIndex();
  const zi=nearestShapeIndex(state.pattern.stops[endIndex].lat,state.pattern.stops[endIndex].lon,full);
  const ti=nearestShapeIndex(t.lat,t.lon,full);
  s.path=ti<=zi?full.slice(ti,zi+1):full.slice(zi,ti+1).reverse();
  if(!s.path.length){ const z=state.pattern.stops[endIndex]; s.path=[[t.lat,t.lon],[z.lat,z.lon]]; }
  s.path[0]=[t.lat,t.lon]; s.pathIndex=0; s.pathFraction=0; s.holdUntil=0; s.heldTarget=-1; s.lastTs=performance.now();
  ui.announceState.textContent='Arrêt suivant simulé';
}

function finish(){
  state.running=false;
  if(state.watch!==null){ navigator.geolocation.clearWatch(state.watch); state.watch=null; }
  stopSimulationLoop(); clearDepartureScheduling();
  window.speechSynthesis?.cancel(); state.audio.queue=[]; state.audio.current=null; releaseScreenAwake();
  clearPunctualityTicker(); state.punctuality.deltaSeconds=null; state.punctuality.plannedTime=null; state.punctuality.status='unknown';
  state.mode=null; state.nav.follow=true; syncFollowButton(); ui.driver.classList.add('hidden'); ui.driver.classList.remove('formation-running'); ui.setup.classList.remove('hidden');
}
function recenter(){
  if(!state.pos||!state.pattern||state.mode==='simulation') return;
  let bi=-1,bd=Infinity; const c=state.pos.coords;
  state.pattern.stops.forEach((s,i)=>{ const d=dist(c.latitude,c.longitude,s.lat,s.lon); if(d<bd){bd=d;bi=i;} });
  if(bi>=0){
    if(state.service.mode==='tad'){
      const xs=tadSelectedIndices(), past=xs.filter(i=>i<=bi), future=xs.filter(i=>i>bi);
      state.current=past.length?past[past.length-1]:Number(ui.startStop.value||0); state.target=future.length?future[0]:state.pattern.stops.length;
    }else{
      state.current=bi; state.target=Math.min(bi+1,state.pattern.stops.length);
      for(const i of [...state.service.requestedStops]) if(i<=state.current) state.service.requestedStops.delete(i);
    }
    state.fusion.lastAlong=state.fusion.stopAlong?.[bi]??null; state.fusion.lastSegment=null; state.announced=false; state.arrivalAnnounced=false; state.nextStopDueAt=null; state.firstLegDepartureSeen=false; state.midpointAnnounced=false; state.reached=false; state.minDist=Infinity; state.lastAdvance=Date.now(); labels(); renderRequestsButton(); updateRequestAlert(false); ui.announceState.textContent=`Recalé à ${fmt(bd)} du poteau`;
  }
}

ui.dept.addEventListener('change',e=>loadDept(e.target.value));
ui.route.addEventListener('change',()=>{ const r=state.routes.find(x=>x.id===ui.route.value); if(r) loadRoute(r); else resetSelections('route'); });
ui.serviceDate.addEventListener('change',()=>{ if(state.route&&state.service.mode!=='formation') populateRuns(); });
ui.trip.addEventListener('change',()=>{ if(ui.trip.value==='') selectRun(null); else selectRun(Number(ui.trip.value)); });
ui.startStop.addEventListener('change',()=>{ updateDepartureDisplay(); if(state.service.mode==='tad') renderTadStopList(false); refreshStartAvailability(); labels(); });
ui.gpsTest.addEventListener('click',testGps);
ui.start.addEventListener('click',startGps);
ui.simulate.addEventListener('click',startSimulation);
ui.finish.addEventListener('click',finish);
ui.speak.addEventListener('click',()=>announce(true));
ui.nextBtn.addEventListener('click',()=>{ advance(true); if(state.mode==='simulation') syncSimulationToState(); });
ui.prev.addEventListener('click',previous);
ui.recenter.addEventListener('click',recenter);
ui.simPlayPause.addEventListener('click',toggleSimulation);
ui.simSkip.addEventListener('click',skipSimulationStop);
ui.followMap.addEventListener('click',()=>{ state.nav.follow=true; syncFollowButton(); if(state.pos&&state.nav.map) state.nav.map.setView([state.pos.coords.latitude,state.pos.coords.longitude],Math.max(state.nav.map.getZoom(),15),{animate:true}); });
ui.regularMode?.addEventListener('click',()=>setServiceMode('regular'));
ui.tadMode?.addEventListener('click',()=>setServiceMode('tad'));
ui.formationMode?.addEventListener('click',()=>setServiceMode('formation'));
ui.formationPattern?.addEventListener('change',()=>{ if(ui.formationPattern.value==='') selectFormationPattern(null); else selectFormationPattern(Number(ui.formationPattern.value)); });
ui.tadStopList?.addEventListener('change',e=>{
  const cb=e.target.closest('.tad-stop-checkbox'); if(!cb) return;
  const i=Number(cb.dataset.index), start=Number(ui.startStop.value||0); if(!Number.isInteger(i)||i<=start) return;
  if(cb.checked) state.service.tadStops.add(i); else state.service.tadStops.delete(i);
  renderTadStopList(false);
});
ui.tadAll?.addEventListener('click',()=>{
  if(!state.pattern) return; const start=Number(ui.startStop.value||0); state.service.tadStops=new Set(state.pattern.stops.map((_,i)=>i).filter(i=>i>=start)); renderTadStopList(false);
});
ui.tadNone?.addEventListener('click',()=>{
  const start=Number(ui.startStop.value||0); state.service.tadStops=new Set([start]); renderTadStopList(false);
});
ui.requestsBtn?.addEventListener('click',openRequests);
ui.requestsClose?.addEventListener('click',closeRequests);
ui.requestsDone?.addEventListener('click',closeRequests);
ui.requestsClear?.addEventListener('click',clearRequests);
ui.requestsSheet?.addEventListener('click',e=>{ if(e.target===ui.requestsSheet) closeRequests(); });
ui.requestsList?.addEventListener('change',e=>{ const cb=e.target.closest('.request-stop-checkbox'); if(!cb) return; requestStop(Number(cb.dataset.index),cb.checked); });

(async()=>{
  if(ui.serviceDate&&!ui.serviceDate.value){ const n=new Date(); ui.serviceDate.value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
  setServiceMode('regular');
  try{ const b=await jget('data/build.json'); ui.buildInfo.textContent=`Données générées : ${new Date(b.generated_at).toLocaleString('fr-FR')} · ${b.version||'V11 ANNONCES ARRÊT'}`; }catch{}
  if(!window.isSecureContext) status('Copie locale : le GPS réel sera bloqué. La simulation reste disponible dès que les données de ligne sont servies par GitHub Pages.','err');
})();
if('serviceWorker' in navigator&&location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
