'use strict';
/* Mon SAEIV 1.0.86 — démarrage terrain + correctifs :
   - entrée Exploitation sans flash de l'écran conducteur ;
   - détection hors parcours sur GPS BRUT et recalcul réellement routier ;
   - guidage basé sur la distance parcourue sur la route, pas la distance à vol d'oiseau ;
   - réveil/auto-récupération du moteur vocal ;
   - reprise de la dernière course avec arrêts demandés conservés. */
(()=>{
  if(window.MonSAEIVRuntimeV184?.installed)return;
  const VERSION='1.0.86';
  const PROFILE_CACHE='mon-saeiv-cloud-profile-v156';
  const RESUME_KEY='mon-saeiv-resume-v184';
  const q=id=>document.getElementById(id);
  const finite=v=>Number.isFinite(Number(v));
  const clamp=(a,b,v)=>Math.max(a,Math.min(b,v));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ---------- Entrée Exploitation / Administration : aucun écran conducteur ne doit peindre ----------
  function cachedProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_CACHE)||'null')}catch{return null}}
  function requestedRole(){
    const p=new URLSearchParams(location.search).get('role');
    const c=cachedProfile()?.role;
    return ['dispatcher','admin'].includes(p)?p:['dispatcher','admin'].includes(c)?c:null;
  }
  const managementRole=requestedRole();
  if(managementRole){
    document.documentElement.dataset.v184Management=managementRole;
    const st=document.createElement('style');st.id='v184ManagementGuard';st.textContent=`
      html[data-v184-management] body{background:#061019!important}
      html[data-v184-management] body>.app,
      html[data-v184-management] #setup,
      html[data-v184-management] #driver,
      html[data-v184-management] #v13Auth,
      html[data-v184-management] #v156CloudAuth,
      html[data-v184-management] #v158RoleAuth,
      html[data-v184-management] #v3127UsageNotice{display:none!important;visibility:hidden!important}
    `;(document.head||document.documentElement).appendChild(st);
  }

  // ---------- Géométrie fiable ----------
  const rad=x=>x*Math.PI/180;
  function meters(aLat,aLon,bLat,bLon){
    const R=6371000,dLat=rad(bLat-aLat),dLon=rad(bLon-aLon),q=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
  }
  function cleanShape(shape){return (shape||[]).map(p=>[Number(p?.[0]),Number(p?.[1])]).filter(p=>finite(p[0])&&finite(p[1]))}
  function cumulative(shape){const c=[0];for(let i=1;i<shape.length;i++)c.push(c[i-1]+meters(shape[i-1][0],shape[i-1][1],shape[i][0],shape[i][1]));return c}
  function projectSegment(lat,lon,a,b){
    const lat0=rad(lat),mx=111320*Math.cos(lat0),my=110540;
    const ax=(a[1]-lon)*mx,ay=(a[0]-lat)*my,bx=(b[1]-lon)*mx,by=(b[0]-lat)*my,dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
    const t=den?clamp(0,1,-((ax*dx)+(ay*dy))/den):0,x=ax+dx*t,y=ay+dy*t;
    return{t,d:Math.hypot(x,y),lat:a[0]+(b[0]-a[0])*t,lon:a[1]+(b[1]-a[1])*t};
  }
  function projectOn(shape,cum,lat,lon,start=0,end=null){
    if(!shape?.length||shape.length<2)return null;end=Math.min(shape.length-2,end??shape.length-2);start=clamp(0,end,start);let best=null;
    for(let i=start;i<=end;i++){const p=projectSegment(lat,lon,shape[i],shape[i+1]);if(!best||p.d<best.d){const seg=Math.max(.01,cum[i+1]-cum[i]);best={...p,segment:i,along:cum[i]+seg*p.t}}}
    return best;
  }
  function atAlong(shape,cum,along){
    if(!shape?.length)return null;along=clamp(0,cum.at(-1)||0,Number(along)||0);let i=0;while(i<cum.length-2&&cum[i+1]<along)i++;const d=Math.max(.01,cum[i+1]-cum[i]),f=clamp(0,1,(along-cum[i])/d);return[shape[i][0]+(shape[i+1][0]-shape[i][0])*f,shape[i][1]+(shape[i+1][1]-shape[i][1])*f]
  }
  function officialModel(){
    try{const sh=cleanShape(state?.fusion?.shape?.length>=2?state.fusion.shape:state?.pattern?.shape);if(sh.length<2)return null;return{shape:sh,cum:cumulative(sh)}}catch{return null}
  }
  function rawPosition(p=typeof state!=='undefined'?state?.pos:null){const c=p?.coords;return c&&finite(c.latitude)&&finite(c.longitude)?{lat:Number(c.latitude),lon:Number(c.longitude),accuracy:Number(c.accuracy||999),speed:finite(c.speed)&&Number(c.speed)>=0?Number(c.speed):0,heading:finite(c.heading)?Number(c.heading):null}:null}

  // ---------- Démarrage / reprise : HLP ou déjà sur la ligne ----------
  const StartFlow={asking:null,lastMode:null,lastTripId:null,resumeHint:null,lastRecalibration:null};
  function currentTripId(){try{return String(state?.run?.trip?.id||'')}catch{return''}}
  function setStartDecision(mode,tripId=currentTripId()){StartFlow.lastMode=mode||null;StartFlow.lastTripId=String(tripId||'');return mode}
  function lastStartMode(){const trip=currentTripId();return !StartFlow.lastTripId||StartFlow.lastTripId===trip?StartFlow.lastMode:null}
  function setResumeHint(index){const n=Number(index);StartFlow.resumeHint=Number.isInteger(n)?n:null}
  function clearResumeHint(){StartFlow.resumeHint=null}
  function gpsPositionV186(){
    const live=rawPosition();
    if(live&&live.accuracy<=100&&Date.now()-Number(state?.pos?.timestamp||0)<15000)return Promise.resolve({coords:{latitude:live.lat,longitude:live.lon,accuracy:live.accuracy,speed:live.speed,heading:live.heading},timestamp:Date.now()});
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation)return reject(new Error('GPS indisponible'));
      navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:250});
    });
  }
  function ensureStartModeUi(){
    if(q('v186StartMode'))return;
    const st=document.createElement('style');st.id='v186StartModeStyle';
    st.textContent='#v186StartMode{position:fixed;inset:0;z-index:2147483600;background:rgba(2,9,14,.84);display:flex;align-items:center;justify-content:center;padding:18px}#v186StartMode.hidden{display:none!important}#v186StartMode .v186-card{width:min(520px,100%);background:#0b1b27;border:1px solid #35566b;border-radius:20px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.5)}#v186StartMode h2{margin:0 0 7px;font-size:1.25rem;color:#fff}#v186StartMode p{margin:0 0 16px;color:#b9cfdb;line-height:1.45}#v186StartMode .v186-actions{display:grid;gap:10px}#v186StartMode button{min-height:56px;border-radius:14px;font-weight:800;font-size:.95rem}#v186StartHlp{background:#503b13;border-color:#9b7525;color:#fff1c3}#v186StartLine{background:#123f32;border-color:#2f8c67;color:#d9ffef}#v186StartCancel{min-height:42px!important;background:#172630;color:#b8cbd5}';
    document.head.appendChild(st);
    const el=document.createElement('div');el.id='v186StartMode';el.className='hidden';
    el.innerHTML='<div class="v186-card" role="dialog" aria-modal="true" aria-labelledby="v186StartTitle"><h2 id="v186StartTitle">Situation au démarrage</h2><p id="v186StartText">Indique où se trouve le véhicule par rapport à la course.</p><div class="v186-actions"><button id="v186StartHlp" type="button">🚌 Je suis en HLP vers le départ de ligne</button><button id="v186StartLine" type="button">📍 Je suis déjà sur la ligne</button><button id="v186StartCancel" type="button">Annuler</button></div></div>';
    document.body.appendChild(el);
  }
  function askStartMode(opts={}){
    if(StartFlow.asking)return StartFlow.asking;
    ensureStartModeUi();const el=q('v186StartMode'),title=q('v186StartTitle'),txt=q('v186StartText');
    if(title)title.textContent=opts.resume?'Reprendre la course':'Démarrer la course';
    if(txt)txt.textContent=opts.resume?'Tu reprends une course interrompue. Es-tu actuellement en haut-le-pied vers le départ, ou déjà positionné sur la ligne ?':'Es-tu en haut-le-pied vers le départ de ligne, ou déjà positionné sur la ligne ?';
    el?.classList.remove('hidden');
    StartFlow.asking=new Promise(resolve=>{
      const finish=mode=>{el?.classList.add('hidden');q('v186StartHlp')?.removeEventListener('click',hlp);q('v186StartLine')?.removeEventListener('click',line);q('v186StartCancel')?.removeEventListener('click',cancel);StartFlow.asking=null;resolve(mode)};
      const hlp=()=>finish('hlp'),line=()=>finish('line'),cancel=()=>finish(null);
      q('v186StartHlp')?.addEventListener('click',hlp,{once:true});q('v186StartLine')?.addEventListener('click',line,{once:true});q('v186StartCancel')?.addEventListener('click',cancel,{once:true});
    });
    return StartFlow.asking;
  }
  function sequentialStopAlong(model){
    const stops=state?.pattern?.stops||[],out=[];let from=0;
    for(const s of stops){
      if(!finite(s?.lat)||!finite(s?.lon)){out.push(null);continue}
      const p=projectOn(model.shape,model.cum,Number(s.lat),Number(s.lon),Math.max(0,from-2));
      if(p){from=p.segment;out.push(p.along)}else out.push(null);
    }
    return out;
  }
  function segmentAtAlong(cum,along){let i=0;while(i<cum.length-2&&cum[i+1]<along)i++;return i}
  async function recalibrateFromPosition(pos,opts={}){
    const c=pos?.coords||pos;
    if(!c||(!finite(c.latitude)&&!finite(c.lat)))throw new Error('Position GPS indisponible.');
    if(typeof ensureExactPatternGeometry==='function'&&state?.pattern)try{await ensureExactPatternGeometry(state.pattern)}catch{}
    const model=officialModel();if(!model)throw new Error('Tracé de la course indisponible.');
    const lat=Number(c.latitude??c.lat),lon=Number(c.longitude??c.lon),accuracy=Math.max(3,Number(c.accuracy||20));
    const stops=state?.pattern?.stops||[];if(stops.length<2)throw new Error('Arrêts de la course indisponibles.');
    const alongs=sequentialStopAlong(model),startIndex=clamp(0,stops.length-1,Number(q('startStop')?.value||0));
    const pref=Number(opts.preferredCurrent),hint=Number.isInteger(pref)?clamp(startIndex,stops.length-1,pref):null;
    let fromSeg=0;
    if(hint!==null&&finite(alongs[Math.max(startIndex,hint-1)])){const minAlong=Math.max(0,Number(alongs[Math.max(startIndex,hint-1)])-350);fromSeg=segmentAtAlong(model.cum,minAlong)}
    let proj=projectOn(model.shape,model.cum,lat,lon,fromSeg);if(!proj&&fromSeg)proj=projectOn(model.shape,model.cum,lat,lon);if(!proj)throw new Error('Impossible de te recaler sur le tracé.');
    const maxOff=Math.max(260,accuracy*4.5);if(proj.d>maxOff)throw new Error('Le véhicule est à environ '+Math.round(proj.d)+' m de la ligne. Choisis HLP si tu rejoins encore le départ.');
    const passTolerance=Math.min(12,Math.max(4,accuracy*.35));let current=startIndex;
    for(let i=startIndex;i<alongs.length;i++){if(finite(alongs[i])&&Number(alongs[i])<=proj.along+passTolerance)current=i;else if(finite(alongs[i])&&Number(alongs[i])>proj.along+passTolerance)break}
    current=clamp(startIndex,stops.length-1,current);
    let target=null;try{if(typeof nextOperationalStop==='function')target=nextOperationalStop(current)}catch{}
    if(!Number.isInteger(target))target=current<stops.length-1?current+1:current;target=clamp(current,stops.length-1,target);
    state.current=current;state.target=target;
    if(state.fusion){state.fusion.lastAlong=proj.along;state.fusion.displayAlong=proj.along;state.fusion.lastSegment=proj.segment}
    let departureAllowed=true;try{const dep=typeof selectedDepartureDate==='function'?selectedDepartureDate():null;if(dep&&Date.now()<dep.getTime())departureAllowed=false}catch{}
    const startAlong=finite(alongs[startIndex])?Number(alongs[startIndex]):0,beyondStart=current>startIndex||proj.along>startAlong+35;
    if(beyondStart&&departureAllowed){state.departed=true;state.firstLegDepartureSeen=true;try{if(typeof clearDepartureScheduling==='function')clearDepartureScheduling()}catch{}}
    else if(!departureAllowed){state.departed=false;state.firstLegDepartureSeen=false}
    state.announced=false;state.arrivalAnnounced=false;state.nextStopDueAt=state.departed&&target>current?Date.now()+5000:null;state.midpointAnnounced=false;state.reached=false;state.minDist=Infinity;
    if(state.service?.requestedStops instanceof Set)state.service.requestedStops=new Set([...state.service.requestedStops].map(Number).filter(i=>Number.isInteger(i)&&i>current));
    try{if(typeof labels==='function')labels()}catch{}try{if(typeof renderRequestsButton==='function')renderRequestsButton()}catch{}try{if(typeof updateRequestAlert==='function')updateRequestAlert(true)}catch{}try{if(typeof updateDepartureDisplay==='function')updateDepartureDisplay()}catch{}
    N.guidance.key='';N.guidance.route=null;N.guidance.model=null;N.guidance.maneuvers=[];N.guidance.spoken.clear();clearRecovery();
    const rp=rawPosition(pos)||{lat,lon,accuracy,speed:Number(c.speed||0),heading:c.heading};if(state?.running&&rp)buildGuidance(rp,true).catch(()=>{});
    StartFlow.lastRecalibration={at:Date.now(),current,target,offRouteM:Math.round(proj.d),along:Math.round(proj.along)};
    try{window.FluoJournalCore?.log?.('COURSE_RECALAGE_GPS_V186',{current,target,offRouteM:Math.round(proj.d),source:opts.source||'start'})}catch{}
    const cur=stops[current]?.name||'arrêt courant',nxt=stops[target]?.name||'terminus',status=q('status');if(status)status.textContent='Recalé sur la ligne · '+cur+' → '+nxt;
    return StartFlow.lastRecalibration;
  }

  // ---------- Navigation 1.0.83 ----------
  const N={recovery:{active:false,calculating:false,route:null,model:null,maneuvers:[],spoken:new Set(),rejoinAlong:null,lastCalc:0,offSince:0,offRecoverySince:0,line:null},guidance:{key:'',loading:false,route:null,model:null,maneuvers:[],spoken:new Set()},lastOfficial:null,lastTarget:null};
  window.MonSAEIVNavigationV184={version:VERSION,isRecovering:()=>N.recovery.active};

  function setTurnUi(arrow,text,distance){
    for(const id of ['turnArrow','v15TurnArrow'])if(q(id))q(id).textContent=arrow;
    for(const id of ['turnInstruction','v15TurnInstruction'])if(q(id))q(id).textContent=text;
    for(const id of ['turnDistance','v15TurnDistance'])if(q(id))q(id).textContent=distance;
  }
  function distanceText(m){if(!finite(m))return'—';m=Math.max(0,Number(m));return m<1000?`${Math.round(m/5)*5} m`:`${(m/1000).toFixed(m<10000?1:0).replace('.',',')} km`}
  function roadSuffix(step){const n=String(step?.name||'').trim();return n?` sur ${n}`:''}
  function instruction(step){
    const m=step?.maneuver||step||{},type=String(m.type||'').toLowerCase(),mod=String(m.modifier||'').toLowerCase(),road=roadSuffix(step),exit=Number(m.exit||0);
    if(/roundabout|rotary/.test(type))return exit?`Au rond-point, prenez la ${exit===1?'1re':`${exit}e`} sortie${road}`:`Au rond-point, poursuivez${road}`;
    if(type==='fork')return mod.includes('right')?`À la bifurcation, restez à droite${road}`:mod.includes('left')?`À la bifurcation, restez à gauche${road}`:`À la bifurcation, continuez${road}`;
    if(type==='merge')return mod.includes('right')?`Insérez-vous à droite${road}`:mod.includes('left')?`Insérez-vous à gauche${road}`:`Insérez-vous${road}`;
    if(type==='end of road')return mod.includes('right')?`Au bout de la route, tournez à droite${road}`:`Au bout de la route, tournez à gauche${road}`;
    if(type==='on ramp'||type==='off ramp')return mod.includes('right')?`Prenez la bretelle à droite${road}`:mod.includes('left')?`Prenez la bretelle à gauche${road}`:`Prenez la bretelle${road}`;
    if(mod.includes('uturn'))return'Faites demi-tour';
    if(mod==='sharp right')return`Tournez franchement à droite${road}`;if(mod==='slight right')return`Prenez légèrement à droite${road}`;if(mod==='right')return`Tournez à droite${road}`;
    if(mod==='sharp left')return`Tournez franchement à gauche${road}`;if(mod==='slight left')return`Prenez légèrement à gauche${road}`;if(mod==='left')return`Tournez à gauche${road}`;
    return`Continuez tout droit${road}`;
  }
  function arrow(step){const m=step?.maneuver||step||{},t=String(m.type||''),mod=String(m.modifier||'');if(/roundabout|rotary/.test(t))return'⟳';if(mod.includes('uturn'))return'↶';if(mod==='slight right')return'↗';if(mod.includes('right'))return'↱';if(mod==='slight left')return'↖';if(mod.includes('left'))return'↰';return'↑'}
  function meaningful(step){const m=step?.maneuver||{},t=String(m.type||'').toLowerCase(),mod=String(m.modifier||'').toLowerCase(),d=Number(step?.distance||0);if(t==='arrive'||t==='depart')return false;if(d<12)return false;if(/roundabout|rotary|fork|merge|end of road|on ramp|off ramp|turn/.test(t))return true;return /left|right|uturn/.test(mod)&&mod!=='straight'}
  function flattenSteps(route){return(route?.legs||[]).flatMap(l=>l.steps||[]).filter(meaningful)}
  function routeShape(route){return cleanShape(route?.shape?.length?route.shape:(route?.geometry?.coordinates||[]).map(c=>[c[1],c[0]]))}
  function mapManeuvers(route){
    const shape=routeShape(route),cum=cumulative(shape),out=[];let fromSeg=0;
    for(const st of flattenSteps(route)){const loc=st?.maneuver?.location;if(!loc||!finite(loc[0])||!finite(loc[1]))continue;let p=projectOn(shape,cum,Number(loc[1]),Number(loc[0]),Math.max(0,fromSeg-2));if(!p)continue;fromSeg=p.segment;out.push({step:st,along:p.along,segment:p.segment})}
    return{shape,cum,maneuvers:out}
  }
  async function fetchRoute(points){
    const coords=points.map(p=>`${Number(p[1]).toFixed(6)},${Number(p[0]).toFixed(6)}`).join(';');
    const url=`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&continue_straight=true`;
    const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`routage HTTP ${r.status}`);const d=await r.json();if(d?.code!=='Ok'||!d.routes?.length)throw new Error('aucun itinéraire routier');
    const rt=d.routes[0];rt.shape=(rt.geometry?.coordinates||[]).map(c=>[Number(c[1]),Number(c[0])]);return rt;
  }
  function sampleOfficial(model,a,b,maxPoints=10){
    if(!model||!finite(a)||!finite(b))return[];a=Math.max(0,Number(a));b=Math.max(a+1,Number(b));const n=clamp(2,maxPoints,Math.ceil((b-a)/450)+1),pts=[];
    for(let i=0;i<n;i++){const p=atAlong(model.shape,model.cum,a+(b-a)*(i/(n-1)));if(p)pts.push(p)}return pts;
  }
  function targetAlong(model,index){
    const existing=state?.fusion?.stopAlong?.[index];if(finite(existing))return Number(existing);const s=state?.pattern?.stops?.[index];if(!s)return null;return projectOn(model.shape,model.cum,Number(s.lat),Number(s.lon))?.along??null
  }
  function drawRecovery(route){
    const sh=routeShape(route);if(N.recovery.line&&state?.nav?.map){try{state.nav.map.removeLayer(N.recovery.line)}catch{}}N.recovery.line=null;
    if(state?.nav?.map&&window.L&&sh.length>1)N.recovery.line=L.polyline(sh,{color:'#36c8ff',weight:7,opacity:.95,dashArray:'12 7'}).addTo(state.nav.map);
  }
  function clearRecovery(reason=''){const R=N.recovery;if(R.line&&state?.nav?.map){try{state.nav.map.removeLayer(R.line)}catch{}}R.line=null;R.active=false;R.calculating=false;R.route=null;R.model=null;R.maneuvers=[];R.spoken.clear();R.rejoinAlong=null;R.offSince=0;R.offRecoverySince=0;if(reason&&q('routeState')){q('routeState').textContent=reason;q('routeState').className='route-state good'}}
  function chooseRejoin(model,proj){
    if(!model||!proj)return null;const t=targetAlong(model,state?.target),base=Math.max(Number(proj.along||0),Number(state?.fusion?.lastAlong||0)||0);let along=base+650;if(finite(t)){const remain=Number(t)-base;if(remain<180)along=Number(t);else along=Math.min(Number(t)-30,base+clamp(350,900,remain*.58))}along=clamp(0,model.cum.at(-1)||0,along);const p=atAlong(model.shape,model.cum,along);return p?{along,p,base}:null
  }
  async function calculateRecovery(pos,force=false){
    const R=N.recovery,now=Date.now();if(R.calculating||!pos||state?.mode!=='gps'||window.FluoOpsV29?.isDeviationActive?.())return false;if(!force&&now-R.lastCalc<5000)return false;const model=officialModel();if(!model)return false;const proj=projectOn(model.shape,model.cum,pos.lat,pos.lon);const rejoin=chooseRejoin(model,proj);if(!rejoin)return false;
    R.calculating=true;R.lastCalc=now;if(q('routeState')){q('routeState').textContent='RECALCUL DE L’ITINÉRAIRE…';q('routeState').className='route-state warn'};
    try{
      let route;if(window.FluoOpsV29?.routeWithAvoids)route=await window.FluoOpsV29.routeWithAvoids({lat:pos.lat,lon:pos.lon},{lat:rejoin.p[0],lon:rejoin.p[1]});else route=await fetchRoute([[pos.lat,pos.lon],rejoin.p]);
      const mapped=mapManeuvers(route);if(mapped.shape.length<2)throw new Error('itinéraire vide');R.active=true;R.route=route;R.model={shape:mapped.shape,cum:mapped.cum};R.maneuvers=mapped.maneuvers;R.spoken.clear();R.rejoinAlong=rejoin.along;R.offRecoverySince=0;drawRecovery(route);
      try{window.FluoJournalCore?.log?.('AUTO_REROUTE_V184',{offRouteM:Math.round(proj?.d||0),rejoinAlongM:Math.round(rejoin.along),distanceM:Math.round(route.distance||0),durationS:Math.round(route.duration||0)})}catch{}
      return true;
    }catch(e){console.warn('[V184] recalcul',e);if(q('routeState')){q('routeState').textContent='HORS PARCOURS · RECALCUL À RÉESSAYER';q('routeState').className='route-state bad'};return false}
    finally{R.calculating=false}
  }
  function activeManeuver(model,mans,pos,lastSegment=0){
    if(!model||!mans?.length)return null;const p=projectOn(model.shape,model.cum,pos.lat,pos.lon,Math.max(0,lastSegment-8));if(!p)return null;let m=mans.find(x=>x.along>=p.along-5)||null;if(!m)return{projection:p,maneuver:null,distance:Infinity};return{projection:p,maneuver:m,distance:Math.max(0,m.along-p.along)}
  }
  let navSayBase=null;
  function speakManeuver(bucket,item,pos,prefix){
    if(!item?.maneuver||localStorage.getItem('fluoNavVoiceV184')==='off'||typeof navSayBase!=='function')return;const d=item.distance,sp=Math.max(0,Number(pos.speed||0)),far=clamp(130,380,90+sp*10),near=clamp(38,120,22+sp*3.6),m=item.maneuver,key=`${prefix}-${Math.round(m.along)}-${m.step?.maneuver?.type||''}-${m.step?.maneuver?.modifier||''}`;
    if(d<=far&&d>near+25&&!bucket.has(`${key}-far`)){bucket.add(`${key}-far`);navSayBase(`Dans ${Math.max(50,Math.round(d/50)*50)} mètres, ${instruction(m.step).toLowerCase()}.`,{priority:29,kind:'navigation',ephemeral:true,v184:true})}
    if(d<=near&&!bucket.has(`${key}-near`)){bucket.add(`${key}-near`);navSayBase(`${instruction(m.step)}.`,{priority:31,kind:'navigation',ephemeral:true,v184:true})}
  }
  function renderGuidance(item,pos,label='ITINÉRAIRE'){if(!item?.maneuver)return;setTurnUi(arrow(item.maneuver.step),instruction(item.maneuver.step),item.distance<18?'MAINTENANT':distanceText(item.distance));speakManeuver(label==='RECALCUL'?N.recovery.spoken:N.guidance.spoken,item,pos,label.toLowerCase());if(q('routeState')){q('routeState').textContent=label==='RECALCUL'?`RECALCUL ACTIF · retour sur ligne`:'PARCOURS ROUTIER';q('routeState').className=`route-state ${label==='RECALCUL'?'warn':'good'}`}}

  async function buildGuidance(pos,force=false){
    const G=N.guidance,model=officialModel();if(!model||!state?.pattern||!Number.isInteger(state?.target)||state.target>=state.pattern.stops.length)return false;const proj=projectOn(model.shape,model.cum,pos.lat,pos.lon),end=targetAlong(model,state.target);if(!proj||!finite(end)||Number(end)<=proj.along+20)return false;const key=`${state?.run?.trip?.id||state?.route?.id||''}|${state.current}|${state.target}`;if(!force&&G.key===key&&G.route)return true;if(G.loading)return false;G.loading=true;
    try{let pts=sampleOfficial(model,proj.along,Number(end),10);const target=state.pattern.stops[state.target];if(target&&pts.length){pts[0]=[proj.lat,proj.lon];pts[pts.length-1]=[Number(target.lat),Number(target.lon)]}if(pts.length<2)return false;const route=await fetchRoute(pts),mapped=mapManeuvers(route);G.key=key;G.route=route;G.model={shape:mapped.shape,cum:mapped.cum};G.maneuvers=mapped.maneuvers;G.spoken.clear();return true}catch(e){console.warn('[V184] guidage routier',e);return false}finally{G.loading=false}
  }
  function updateNormalGuidance(pos){const G=N.guidance;if(!G.route||!G.model){buildGuidance(pos).catch(()=>{});return}const item=activeManeuver(G.model,G.maneuvers,pos);if(item?.maneuver)renderGuidance(item,pos,'ITINÉRAIRE')}
  function updateRecovery(pos){
    const R=N.recovery,official=officialModel();if(!R.active||!official)return false;const op=projectOn(official.shape,official.cum,pos.lat,pos.lon),returnThreshold=clamp(24,55,16+pos.accuracy*1.15);
    if(op&&op.d<=returnThreshold&&(!finite(R.rejoinAlong)||op.along>=Number(R.rejoinAlong)-140)){clearRecovery('PARCOURS REPRIS');N.guidance.key='';N.guidance.route=null;buildGuidance(pos,true).catch(()=>{});return false}
    const item=activeManeuver(R.model,R.maneuvers,pos);if(item?.projection){const off=item.projection.d;if(off>Math.max(70,pos.accuracy*2)){if(!R.offRecoverySince)R.offRecoverySince=Date.now();if(Date.now()-R.offRecoverySince>3500)calculateRecovery(pos,true).catch(()=>{});}else R.offRecoverySince=0}if(item?.maneuver)renderGuidance(item,pos,'RECALCUL');else{setTurnUi('↑','Rejoignez le parcours',R.rejoinAlong&&op?distanceText(Math.max(0,R.rejoinAlong-op.along)):'—')}
    return true;
  }
  function monitorNavigation(p){
    if(typeof state==='undefined'||!state?.running||state.mode!=='gps'||window.FluoOpsV29?.isDeviationActive?.()){N.recovery.offSince=0;return}if(N.lastTarget!==state.target){N.lastTarget=state.target;N.guidance.key='';N.guidance.route=null;N.guidance.model=null;N.guidance.maneuvers=[];N.guidance.spoken.clear()}const pos=rawPosition(p);if(!pos||pos.accuracy>80)return;if(updateRecovery(pos))return;const model=officialModel();if(!model)return;const proj=projectOn(model.shape,model.cum,pos.lat,pos.lon);N.lastOfficial=proj;const trigger=clamp(38,82,24+pos.accuracy*1.45);
    if(proj&&proj.d>trigger){if(!N.recovery.offSince)N.recovery.offSince=Date.now();if(Date.now()-N.recovery.offSince>=2500)calculateRecovery(pos).catch(()=>{})}else{N.recovery.offSince=0;updateNormalGuidance(pos)}
  }

  // ---------- Reprise dernière course ----------
  const R={resuming:false,restoring:false};window.MonSAEIVResumeV184={version:VERSION,get resuming(){return R.resuming},save:saveResume};
  function serviceDateValue(){return q('serviceDate')?.value||''}
  function resumeSnapshot(){try{const x=JSON.parse(localStorage.getItem(RESUME_KEY)||'null');if(!x||Date.now()-Number(x.savedAt||0)>18*3600000)return null;return x}catch{return null}}
  function saveResume(reason='checkpoint'){
    try{
      if(typeof state==='undefined'||!state?.running||state.mode!=='gps'||!['regular','tad'].includes(state.service?.mode)||!state?.run?.trip||!state?.route)return false;
      const rec={version:VERSION,savedAt:Date.now(),reason,dept:String(state.dept||q('dept')?.value||''),routeId:String(state.route.id||''),routeShort:String(state.route.short||''),tripId:String(state.run.trip.id||''),serviceDate:serviceDateValue(),serviceMode:state.service.mode,startStop:Number(q('startStop')?.value||0),current:Number(state.current),target:Number(state.target),departed:!!state.departed,firstLegDepartureSeen:!!state.firstLegDepartureSeen,requestedStops:[...state.service.requestedStops],tadStops:[...state.service.tadStops],destination:String(state.pattern?.headsign||state.pattern?.stops?.at(-1)?.name||'')};
      localStorage.setItem(RESUME_KEY,JSON.stringify(rec));refreshResumeButton();return true;
    }catch(e){console.warn('[V184] sauvegarde reprise',e);return false}
  }
  async function waitFor(fn,ms=8000){const end=Date.now()+ms;while(Date.now()<end){try{const v=fn();if(v)return v}catch{}await sleep(80)}throw new Error('Le chargement de la course n’a pas abouti.')}
  function addResumeUi(){
    const anchor=document.querySelector('.start-actions');if(!anchor||q('v184Resume'))return;const st=document.createElement('style');st.id='v184Style';st.textContent=`#v184Resume{width:100%;margin-top:9px;border-color:#4f8faf;background:#103349;color:#d8f3ff}#v184Resume.hidden{display:none!important}#v184ResumeStatus{margin-top:6px;color:#9fc5d7;font-size:.68rem}`;document.head.appendChild(st);const box=document.createElement('div');box.innerHTML='<button id="v184Resume" class="hidden" type="button">↩ Reprendre la dernière course</button><div id="v184ResumeStatus"></div>';anchor.insertAdjacentElement('afterend',box);q('v184Resume')?.addEventListener('click',()=>restoreLastCourse().catch(e=>{q('v184ResumeStatus').textContent=`Reprise impossible : ${e.message||e}`}));refreshResumeButton()
  }
  function refreshResumeButton(){const b=q('v184Resume'),x=resumeSnapshot();if(!b)return;b.classList.toggle('hidden',!x);if(x)b.textContent=`↩ Reprendre ${x.routeShort||'la dernière course'} · ${x.destination||''}`}
  async function restoreLastCourse(){
    if(R.restoring)return;
    const x=resumeSnapshot();if(!x)throw new Error('Aucune course récente à reprendre.');
    R.restoring=true;const status=q('v184ResumeStatus');if(status)status.textContent='Restauration de la course et des arrêts demandés…';
    try{
      if(typeof loadDept!=='function'||typeof loadRoute!=='function'||typeof selectRun!=='function')throw new Error('Moteur de course indisponible.');
      await Promise.resolve(loadDept(x.dept));await waitFor(()=>state?.routes?.length);
      const route=state.routes.find(r=>String(r.id)===String(x.routeId));if(!route)throw new Error('La ligne sauvegardée n’existe plus dans les données actuelles.');
      if(q('route'))q('route').value=String(route.id);await Promise.resolve(loadRoute(route));await waitFor(()=>state?.patterns?.length);
      if(typeof setServiceMode==='function')setServiceMode(x.serviceMode==='tad'?'tad':'regular');
      if(q('serviceDate')&&x.serviceDate)q('serviceDate').value=x.serviceDate;
      if(typeof populateRuns==='function')populateRuns();await waitFor(()=>state?.runOptions?.length);
      const i=state.runOptions.findIndex(r=>String(r.trip?.id)===String(x.tripId));if(i<0)throw new Error('La course exacte n’est plus disponible à cette date.');
      if(q('trip'))q('trip').value=String(i);await Promise.resolve(selectRun(i));await waitFor(()=>state?.pattern&&state?.run);
      if(q('startStop'))q('startStop').value=String(clamp(0,state.pattern.stops.length-1,Number(x.startStop)||0));
      state.service.requestedStops=new Set((x.requestedStops||[]).map(Number).filter(Number.isInteger));
      state.service.tadStops=new Set((x.tadStops||[]).map(Number).filter(Number.isInteger));
      if(typeof renderRequestsButton==='function')renderRequestsButton();

      setResumeHint(Number(x.current));
      R.resuming=true;
      await Promise.resolve(startGps());
      await sleep(220);
      const mode=lastStartMode();

      if(mode==='hlp'&&!state?.running){
        if(status)status.textContent='Reprise préparée en HLP · les arrêts demandés seront conservés au démarrage de la ligne.';
        return;
      }
      if(!state?.running)throw new Error('Le GPS n’a pas pu redémarrer la course.');

      if(mode!=='line'&&mode!=='hlp'){
        state.current=clamp(0,state.pattern.stops.length-1,Number(x.current)||0);
        state.target=clamp(Math.min(state.current+1,state.pattern.stops.length-1),state.pattern.stops.length-1,Number(x.target)||Math.min(state.current+1,state.pattern.stops.length-1));
        state.departed=x.departed!==false;state.firstLegDepartureSeen=x.firstLegDepartureSeen!==false;
      }

      state.service.requestedStops=new Set((x.requestedStops||[]).map(Number).filter(idx=>Number.isInteger(idx)&&idx>state.current));
      if(state.service.mode==='tad')state.service.tadStops=new Set((x.tadStops||[]).map(Number).filter(Number.isInteger));
      state.announced=false;state.arrivalAnnounced=false;
      if(mode!=='line')state.nextStopDueAt=state.departed?Date.now()+5000:null;
      state.midpointAnnounced=false;state.reached=false;state.minDist=Infinity;
      if(finite(state.fusion?.stopAlong?.[state.current])&&mode!=='line')state.fusion.lastAlong=Number(state.fusion.stopAlong[state.current]);
      if(typeof labels==='function')labels();
      if(typeof renderRequestsButton==='function')renderRequestsButton();
      if(typeof updateRequestAlert==='function')updateRequestAlert(true);
      if(status){
        if(mode==='line')status.textContent='Course reprise et recalée sur la position GPS · '+state.service.requestedStops.size+' arrêt(s) demandé(s) conservé(s).';
        else status.textContent='Course reprise · '+state.service.requestedStops.size+' arrêt(s) demandé(s) restauré(s).';
      }
      saveResume('resumed');
    }finally{
      clearResumeHint();R.resuming=false;R.restoring=false;
    }
  }

  // ---------- Robustesse audio ----------
  const speechWatch={current:null,since:0};
  function wakeSpeech(){
    try{const sp=window.speechSynthesis;if(!sp)return;sp.getVoices?.();if(sp.paused)sp.resume();const a=typeof state!=='undefined'?state?.audio:null;if(a&&!a.current&&a.queue?.length&&typeof pumpSpeech==='function')setTimeout(()=>{try{pumpSpeech()}catch{}},20)}catch{}
  }
  function speechHealth(){
    try{const sp=window.speechSynthesis,a=typeof state!=='undefined'?state?.audio:null;if(!sp||!a)return;if(sp.paused)sp.resume();const cur=a.current;if(cur!==speechWatch.current){speechWatch.current=cur;speechWatch.since=Date.now();return}if(!cur){if(a.queue?.length&&typeof pumpSpeech==='function')pumpSpeech();return}if(cur.mode==='local'&&Date.now()-speechWatch.since>6500&&!sp.speaking&&!sp.pending&&!sp.paused){const item=cur.item;console.warn('[V184] moteur vocal local figé : relance');try{sp.cancel()}catch{}a.current=null;if(item&&!item.cancelled){item.cancelled=false;item.seq=Date.now()+Math.random();a.queue.unshift(item)}speechWatch.current=null;speechWatch.since=Date.now();setTimeout(()=>{try{pumpSpeech()}catch{}},180)}}catch{}
  }

  function openManagementWhenReady(){if(!managementRole)return;let tries=0;const run=()=>{const p=window.MonSAEIVCloudV156?.profile||cachedProfile();const api=window.MonSAEIVDispatchV157;if(p&&['dispatcher','admin'].includes(p.role)&&api?.open){Promise.resolve(api.open()).catch(console.warn);return}if(++tries<240)setTimeout(run,100)};run()}

  function installRuntime(){
    if(window.MonSAEIVRuntimeV184.runtimeInstalled)return;window.MonSAEIVRuntimeV184.runtimeInstalled=true;addResumeUi();openManagementWhenReady();
    // L'ancien moteur V103 garde sa propre référence vocale. On le maintient muet,
    // tout en conservant le bouton GPS vocal comme commande du nouveau guidage V184.
    const syncNavVoicePreference=()=>{try{const legacy=localStorage.getItem('fluoNavVoice')!=='off';localStorage.setItem('fluoNavVoiceV184',legacy?'on':'off');localStorage.setItem('fluoNavVoice','off')}catch{}};
    try{if(localStorage.getItem('fluoNavVoiceV184')===null)localStorage.setItem('fluoNavVoiceV184',localStorage.getItem('fluoNavVoice')==='off'?'off':'on');localStorage.setItem('fluoNavVoice','off')}catch{}
    ['navVoiceBtn','v15NavVoice'].forEach(id=>q(id)?.addEventListener('click',()=>setTimeout(syncNavVoicePreference,0),{capture:true}));q('navVoiceSetup')?.addEventListener('change',()=>setTimeout(syncNavVoicePreference,0),{capture:true});
    // Supprime les anciennes voix de navigation ; V184 est l'unique source des consignes droite/gauche.
    try{navSayBase=say;const oldSay=say;say=function(text,opts={}){if(opts?.kind==='navigation'&&!opts?.v184)return;return oldSay(text,opts)}}catch(e){console.warn('[V184] filtre voix navigation',e)}
    try{const baseProcess=processPos;processPos=function(p){const r=baseProcess(p);try{monitorNavigation(p)}catch(e){console.warn('[V184] navigation',e)}return r}}catch(e){console.warn('[V184] position wrapper',e)}
    try{const baseEnter=enterDriver;enterDriver=function(mode){const r=baseEnter(mode);N.guidance={key:'',loading:false,route:null,model:null,maneuvers:[],spoken:new Set()};clearRecovery();setTimeout(()=>{const p=rawPosition();if(p)buildGuidance(p,true).catch(()=>{});wakeSpeech();saveResume('service-start')},350);return r}}catch{}
    try{const baseRequest=requestStop;requestStop=function(){const r=baseRequest.apply(this,arguments);setTimeout(()=>saveResume('requested-stop'),0);return r}}catch{}
    try{const baseAdvance=advance;advance=function(){const r=baseAdvance.apply(this,arguments);setTimeout(()=>saveResume('stop-passed'),0);return r}}catch{}
    try{const basePrevious=previous;previous=function(){const r=basePrevious.apply(this,arguments);setTimeout(()=>saveResume('previous-stop'),0);return r}}catch{}
    try{const baseFinish=finish;finish=function(){saveResume('course-closed');clearRecovery();return baseFinish.apply(this,arguments)}}catch{}
    ['pointerdown','touchend','click'].forEach(ev=>document.addEventListener(ev,wakeSpeech,{capture:true,passive:true}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(wakeSpeech,80)});window.addEventListener('pageshow',()=>setTimeout(wakeSpeech,80));window.addEventListener('focus',()=>setTimeout(wakeSpeech,80));try{speechSynthesis?.addEventListener?.('voiceschanged',wakeSpeech)}catch{}
    setInterval(()=>{speechHealth();if(typeof state!=='undefined'&&state?.running)saveResume('checkpoint')},2000);
  }

  window.MonSAEIVCourseStartV186={version:VERSION,askStartMode,gpsPosition:gpsPositionV186,recalibrateFromPosition,setDecision:setStartDecision,lastMode:lastStartMode,setResumeHint,clearResumeHint,get resumeHint(){return StartFlow.resumeHint},get lastRecalibration(){return StartFlow.lastRecalibration}};
  window.MonSAEIVRuntimeV184={installed:true,runtimeInstalled:false,version:VERSION,restoreLastCourse,saveResume,wakeSpeech};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installRuntime,0),{once:true});else setTimeout(installRuntime,0);
})();
