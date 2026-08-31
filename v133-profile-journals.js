'use strict';
/* Mon SAEIV 1.0.33 — Journaux indépendants + Mon profil statistiques conducteur. */
(()=>{
  if(window.MonSAEIVV133?.installed)return;
  const VERSION='1.0.33';
  const DB_NAME='fluo-saeiv-journal-v13';
  const ACCOUNT_KEY='fluoSaeivAccountV13';
  const q=id=>document.getElementById(id);
  const S={dbPromise:null,journalMap:null,currentSession:null,installed:false};

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function account(){try{return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null')}catch{return null}}
  function driverId(){return String(account()?.matricule||'').trim();}
  function fmtDate(v){try{return new Date(v).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}catch{return v||'—'}}
  function fmtTime(v){try{return new Date(v).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}catch{return v||'—'}}
  function pct(n,d){return d?Math.round(n*1000/d)/10:0;}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function fmtDelta(sec){const n=Number(sec);if(!Number.isFinite(n))return '—';const s=Math.round(n),sign=s<0?'−':'+';const a=Math.abs(s);return `${sign}${Math.floor(a/60)}:${String(a%60).padStart(2,'0')}`;}
  function closeHamburger(){q('v316MenuBackdrop')?.classList.add('hidden');}
  function hideLegacyJournals(){['v13JournalSheet','v23JournalDetail','v132JournalDetail'].forEach(id=>q(id)?.classList.add('hidden'));}

  function openDb(){
    if(S.dbPromise)return S.dbPromise;
    S.dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('Le stockage local IndexedDB n’est pas disponible sur cet appareil.'));
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>{
        const d=r.result;
        if(!d.objectStoreNames.contains('sessions')){const s=d.createObjectStore('sessions',{keyPath:'id'});s.createIndex('startedAt','startedAt');s.createIndex('matricule','matricule');}
        if(!d.objectStoreNames.contains('events')){const e=d.createObjectStore('events',{keyPath:'id',autoIncrement:true});e.createIndex('sessionId','sessionId');e.createIndex('ts','ts');e.createIndex('type','type');}
      };
      r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>{try{d.close()}catch{}S.dbPromise=null};resolve(d)};
      r.onerror=()=>{S.dbPromise=null;reject(r.error||new Error('Impossible d’ouvrir les journaux locaux.'))};
      r.onblocked=()=>console.warn('[Mon SAEIV] IndexedDB journaux bloquée par un autre onglet');
    });
    return S.dbPromise;
  }
  async function allSessions(){const d=await openDb();return new Promise((res,rej)=>{const r=d.transaction('sessions','readonly').objectStore('sessions').getAll();r.onsuccess=()=>res((r.result||[]).sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||''))));r.onerror=()=>rej(r.error)});}
  async function allEvents(){const d=await openDb();return new Promise((res,rej)=>{const r=d.transaction('events','readonly').objectStore('events').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});}
  async function eventsFor(id){const d=await openDb();return new Promise((res,rej)=>{const store=d.transaction('events','readonly').objectStore('events');let r;try{r=store.index('sessionId').getAll(id)}catch{r=store.getAll()}r.onsuccess=()=>{let xs=r.result||[];if(!store.indexNames.contains('sessionId'))xs=xs.filter(e=>e.sessionId===id);res(xs.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||''))))};r.onerror=()=>rej(r.error)});}
  async function sessionFor(id){const d=await openDb();return new Promise((res,rej)=>{const r=d.transaction('sessions','readonly').objectStore('sessions').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)});}
  function mineSessions(xs){const id=driverId();return id?xs.filter(s=>String(s.matricule||'').trim().toLowerCase()===id.toLowerCase()):xs;}

  function installStyle(){
    if(q('v133Style'))return;
    const st=document.createElement('style');st.id='v133Style';st.textContent=`
      .v133-backdrop{position:fixed;z-index:72000;inset:0;display:flex;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));background:rgba(1,7,11,.86);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}.v133-backdrop.hidden{display:none!important}
      .v133-shell{width:min(1050px,100%);max-height:96dvh;display:flex;flex-direction:column;overflow:hidden;border:1px solid #385668;border-radius:22px;background:#081923;box-shadow:0 28px 90px rgba(0,0,0,.65)}
      .v133-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid #294554}.v133-head h2{margin:2px 0 3px}.v133-head p{margin:0;color:#94aab6;font-size:.72rem}.v133-head-actions{display:flex;gap:7px}.v133-body{overflow:auto;padding:13px 16px 18px}
      .v133-loading,.v133-empty{padding:28px 16px;text-align:center;color:#9fb3bd}.v133-error{padding:13px;border:1px solid #7a4448;border-radius:13px;background:#331d21;color:#ffd5d1}
      .v133-journal-list{display:grid;gap:8px}.v133-session{padding:11px;border:1px solid #2e4a5a;border-radius:14px;background:#0b202b}.v133-session-main{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start}.v133-session strong,.v133-session span{display:block}.v133-session strong{font-size:.9rem}.v133-session span{margin-top:3px;color:#96adb8;font-size:.67rem}.v133-badge{padding:5px 8px;border-radius:999px;background:#173543;color:#d8edf6;font-size:.58rem;font-weight:950}.v133-badge.open{background:#153b28;color:#caffd8}.v133-badge.interrupted{background:#4b3515;color:#ffe0a6}.v133-session-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.v133-session-actions button{min-height:38px;padding:7px 10px;font-size:.69rem}
      .v133-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.v133-card{padding:10px;border:1px solid #2e4a5a;border-radius:13px;background:#0a1d27}.v133-card span{display:block;color:#8fa5b1;font-size:.58rem;font-weight:900;letter-spacing:.04em}.v133-card b{display:block;margin-top:3px;font-size:1rem}.v133-card small{display:block;margin-top:3px;color:#78909d;font-size:.57rem}
      .v133-map{height:300px;margin:10px 0;border:1px solid #355163;border-radius:14px;overflow:hidden;background:#10202a}.v133-map.hidden{display:none!important}.v133-table{overflow:auto;border:1px solid #2e4a5a;border-radius:13px}.v133-table table{width:100%;border-collapse:collapse;font-size:.7rem}.v133-table th,.v133-table td{padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;white-space:nowrap}.v133-table th{position:sticky;top:0;background:#102630;color:#a9bac3;z-index:2}.v133-table td:nth-child(2){min-width:180px;white-space:normal;font-weight:850}
      .v133-profile-hero{display:grid;grid-template-columns:150px 1fr;gap:13px;align-items:center;padding:14px;border:1px solid #3a596a;border-radius:18px;background:linear-gradient(135deg,#102a38,#0a1d27)}.v133-score{display:flex;width:132px;height:132px;align-items:center;justify-content:center;flex-direction:column;border:8px solid #ffd000;border-radius:50%;background:#07151e}.v133-score b{font-size:2.2rem;line-height:1}.v133-score span{margin-top:2px;color:#9fb4be;font-size:.62rem}.v133-profile-hero h3{margin:0 0 5px;font-size:1.15rem}.v133-profile-hero p{margin:0;color:#a6bac4;font-size:.72rem;line-height:1.45}
      .v133-bars{display:grid;gap:10px;margin-top:12px}.v133-stat{padding:11px;border:1px solid #2e4a5a;border-radius:13px;background:#091c26}.v133-stat-head{display:flex;justify-content:space-between;gap:10px;align-items:end}.v133-stat-head span{color:#a8bbc5;font-size:.72rem}.v133-stat-head b{font-size:1.05rem}.v133-track{height:9px;margin-top:7px;overflow:hidden;border-radius:999px;background:#162f3b}.v133-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#ffd000,#ffae00)}
      .v133-punct-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.v133-punct{padding:12px;border:1px solid #2e4a5a;border-radius:13px;background:#0a1d27;text-align:center}.v133-punct span{display:block;color:#8fa5b1;font-size:.62rem;font-weight:900}.v133-punct b{display:block;margin-top:3px;font-size:1.35rem}.v133-note{margin-top:12px;padding:10px 11px;border:1px solid #665d2c;border-radius:12px;background:#2c2812;color:#f3e4a1;font-size:.66rem;line-height:1.45}.v133-method{margin-top:9px;color:#78909d;font-size:.59rem;line-height:1.45}
      #v13JournalSheet,#v23JournalDetail,#v132JournalDetail{z-index:100!important}
      @media(max-width:680px){.v133-backdrop{padding:0;align-items:flex-end}.v133-shell{max-height:98dvh;border-radius:20px 20px 0 0}.v133-body{padding:10px}.v133-summary{grid-template-columns:1fr 1fr}.v133-profile-hero{grid-template-columns:1fr;text-align:center}.v133-score{margin:auto}.v133-punct-grid{grid-template-columns:1fr}.v133-head{padding:11px}.v133-map{height:250px}}
    `;document.head.appendChild(st);
  }

  function ensureUi(){
    installStyle();
    if(!q('v133JournalHub'))document.body.insertAdjacentHTML('beforeend',`<div id="v133JournalHub" class="v133-backdrop hidden" role="dialog" aria-modal="true"><section class="v133-shell"><header class="v133-head"><div><div class="eyebrow">MON SAEIV · JOURNAUX</div><h2 id="v133JournalTitle">Historique des services</h2><p id="v133JournalSub">Les données restent stockées localement sur cet appareil.</p></div><div class="v133-head-actions"><button id="v133JournalBack" class="hidden" type="button">← Retour</button><button id="v133JournalClose" type="button">Fermer</button></div></header><div id="v133JournalBody" class="v133-body"></div></section></div>`);
    if(!q('v133ProfileSheet'))document.body.insertAdjacentHTML('beforeend',`<div id="v133ProfileSheet" class="v133-backdrop hidden" role="dialog" aria-modal="true"><section class="v133-shell"><header class="v133-head"><div><div class="eyebrow">MON SAEIV</div><h2>👤 Mon profil</h2><p id="v133ProfileSub">Statistiques calculées à partir de tes journaux locaux.</p></div><button id="v133ProfileClose" type="button">Fermer</button></header><div id="v133ProfileBody" class="v133-body"></div></section></div>`);
    q('v133JournalClose')?.addEventListener('click',closeJournalHub);
    q('v133JournalBack')?.addEventListener('click',renderJournalList);
    q('v133JournalHub')?.addEventListener('click',e=>{if(e.target===q('v133JournalHub'))closeJournalHub()});
    q('v133ProfileClose')?.addEventListener('click',()=>q('v133ProfileSheet')?.classList.add('hidden'));
    q('v133ProfileSheet')?.addEventListener('click',e=>{if(e.target===q('v133ProfileSheet'))q('v133ProfileSheet').classList.add('hidden')});
  }

  function ensureProfileButton(){
    const menu=q('v316MenuItems');if(!menu)return;
    let b=q('v133ProfileBtn');
    if(!b){b=document.createElement('button');b.id='v133ProfileBtn';b.type='button';b.className='v316-menu-entry';b.textContent='👤 Mon profil';b.addEventListener('click',openProfile);}
    const journal=q('v13JournalBtn');
    if(journal?.parentElement===menu){if(b.parentElement!==menu)journal.insertAdjacentElement('afterend',b);else if(journal.nextElementSibling!==b)journal.insertAdjacentElement('afterend',b)}
    else if(b.parentElement!==menu)menu.prepend(b);
  }

  function statusLabel(s){if(s?.status==='open')return ['EN COURS','open'];if(s?.status==='interrupted')return ['INTERROMPU','interrupted'];return ['TERMINÉ',''];}
  function stopRows(s,events){
    const by=new Map();
    for(const e of events){if(e.type!=='STOP_ARRIVAL'&&e.type!=='STOP_PASSED')continue;const key=Number.isInteger(e.stopIndex)?String(e.stopIndex):String(e.stopName||e.ts),old=by.get(key);if(!old||e.type==='STOP_ARRIVAL')by.set(key,e)}
    const rows=[...by.values()].sort((a,b)=>Number(a.stopIndex??9999)-Number(b.stopIndex??9999)||String(a.ts||'').localeCompare(String(b.ts||'')));
    if(s?.startStop&&!rows.some(r=>Number(r.stopIndex)===Number(s.startStopIndex)))rows.unshift({stopIndex:Number(s.startStopIndex||0),stopName:s.startStop,ts:s.startedAt,scheduledTime:s.scheduledDeparture||null,scheduleDeltaSec:s.scheduledDeparture?Math.round((new Date(s.startedAt)-new Date(s.scheduledDeparture))/1000):null,speedKmh:0});
    return rows;
  }

  function closeJournalMap(){if(S.journalMap){try{S.journalMap.remove()}catch{}S.journalMap=null;}}
  function eventPoint(e){const lat=Number.isFinite(Number(e?.fusedLat))?Number(e.fusedLat):Number(e?.lat),lon=Number.isFinite(Number(e?.fusedLon))?Number(e.fusedLon):Number(e?.lon);return Number.isFinite(lat)&&Number.isFinite(lon)?[lat,lon]:null;}
  function drawJournalMap(s,events){
    const el=q('v133Map');if(!el)return;closeJournalMap();
    const pts=events.filter(e=>e.type==='GPS_SAMPLE').map(eventPoint).filter(Boolean);
    if(typeof L==='undefined'||pts.length<2){el.classList.add('hidden');return;}
    try{el.classList.remove('hidden');const map=L.map(el,{zoomControl:true,attributionControl:true}).setView(pts[0],13);S.journalMap=map;L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);L.polyline(pts,{weight:5,opacity:.9}).addTo(map);map.fitBounds(pts,{padding:[24,24],maxZoom:16});setTimeout(()=>map.invalidateSize(),80)}catch(err){console.warn('[Mon SAEIV] carte journal',err);el.classList.add('hidden');closeJournalMap();}
  }

  async function renderJournalList(){
    ensureUi();closeJournalMap();S.currentSession=null;
    q('v133JournalTitle').textContent='Historique des services';q('v133JournalSub').textContent='Touche une course pour consulter ses passages, horaires et données enregistrées.';q('v133JournalBack').classList.add('hidden');
    const body=q('v133JournalBody');body.innerHTML='<div class="v133-loading">Chargement des journaux…</div>';
    try{
      const xs=mineSessions(await allSessions());
      body.innerHTML=xs.length?`<div class="v133-journal-list">${xs.map(s=>{const [lab,cl]=statusLabel(s);return `<article class="v133-session"><div class="v133-session-main"><div><strong>${esc(s.route||'—')} · ${esc(s.destination||'')}</strong><span>${esc(fmtDate(s.startedAt))} · ${esc(s.serviceMode||'service')}</span><span>${Number(s.stopEvents||0)} arrêts · ${Number(s.samples||0)} points GPS · ${Number.isFinite(Number(s.distanceKm))?String(s.distanceKm).replace('.',',')+' km':'distance —'}</span></div><span class="v133-badge ${cl}">${lab}</span></div><div class="v133-session-actions"><button type="button" data-v133-open="${esc(s.id)}">🗺 Consulter</button><button type="button" data-v133-export="${esc(s.id)}">📄 Exporter PDF</button></div></article>`}).join('')}</div>`:'<div class="v133-empty"><b>Aucun journal enregistré.</b><br>Les prochaines prises de service apparaîtront ici.</div>';
    }catch(err){body.innerHTML=`<div class="v133-error"><b>Impossible de lire les journaux.</b><br>${esc(err?.message||err)}<br><br><button id="v133JournalRetry" type="button">Réessayer</button></div>`;q('v133JournalRetry')?.addEventListener('click',()=>{S.dbPromise=null;renderJournalList()});}
  }

  async function openJournalDetail(id){
    ensureUi();const body=q('v133JournalBody');body.innerHTML='<div class="v133-loading">Ouverture du journal…</div>';q('v133JournalBack').classList.remove('hidden');
    try{
      const [s,events]=await Promise.all([sessionFor(id),eventsFor(id)]);if(!s)throw new Error('Ce journal n’existe plus dans le stockage local.');S.currentSession=s;
      const rows=stopRows(s,events),gps=events.filter(e=>e.type==='GPS_SAMPLE').length;
      q('v133JournalTitle').textContent=`${s.route||'Ligne'} · ${s.destination||''}`;q('v133JournalSub').textContent=`${fmtDate(s.startedAt)} · ${s.serviceMode||'service'}${s.tripId?` · trip ${s.tripId}`:''}`;
      body.innerHTML=`<div class="v133-summary"><div class="v133-card"><span>ARRÊTS</span><b>${rows.length}</b></div><div class="v133-card"><span>DISTANCE</span><b>${Number.isFinite(Number(s.distanceKm))?String(s.distanceKm).replace('.',',')+' km':'—'}</b></div><div class="v133-card"><span>VITESSE MAX</span><b>${Number.isFinite(Number(s.maxSpeedKmh))?Math.round(Number(s.maxSpeedKmh))+' km/h':'—'}</b></div><div class="v133-card"><span>POINTS GPS</span><b>${gps}</b></div></div><div id="v133Map" class="v133-map"></div><div class="v133-table">${rows.length?`<table><thead><tr><th>#</th><th>Arrêt</th><th>Réel</th><th>Prévu</th><th>Écart</th><th>Vitesse</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.stopName||'—')}</td><td>${esc(fmtTime(r.ts))}</td><td>${esc(r.scheduledTime?fmtTime(r.scheduledTime):'—')}</td><td>${esc(fmtDelta(r.scheduleDeltaSec))}</td><td>${Number.isFinite(Number(r.speedKmh))?Math.round(Number(r.speedKmh))+' km/h':'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="v133-empty">Aucun passage d’arrêt n’a été enregistré sur cette course.</div>'}</div>`;
      setTimeout(()=>drawJournalMap(s,events),20);
    }catch(err){body.innerHTML=`<div class="v133-error"><b>Impossible d’ouvrir ce journal.</b><br>${esc(err?.message||err)}</div>`;}
  }

  async function exportJournal(id){
    try{if(window.MonSAEVJournalPDF?.exportIds){await window.MonSAEVJournalPDF.exportIds([id]);return;}}catch(err){console.warn('[Mon SAEIV] export PDF historique',err)}
    try{
      const [s,events]=await Promise.all([sessionFor(id),eventsFor(id)]);if(!s)throw new Error('Journal introuvable');const rows=stopRows(s,events),html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Journal ${esc(s.route||'Mon SAEIV')}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{margin-bottom:4px}.muted{color:#666}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}th,td{padding:8px;border-bottom:1px solid #ccc;text-align:left}th{background:#eee}</style></head><body><div class="muted">MON SAEIV · JOURNAL</div><h1>${esc(s.route||'—')} · ${esc(s.destination||'')}</h1><div class="muted">${esc(fmtDate(s.startedAt))}</div><table><thead><tr><th>#</th><th>Arrêt</th><th>Réel</th><th>Prévu</th><th>Écart</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.stopName||'—')}</td><td>${esc(fmtTime(r.ts))}</td><td>${esc(r.scheduledTime?fmtTime(r.scheduledTime):'—')}</td><td>${esc(fmtDelta(r.scheduleDeltaSec))}</td></tr>`).join('')}</tbody></table></body></html>`,blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`journal-${String(s.route||'service').replace(/[^a-z0-9_-]+/gi,'-')}.html`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(err){alert(`Export impossible : ${err?.message||err}`)}
  }

  function openJournalHub(){ensureUi();hideLegacyJournals();closeHamburger();q('v133JournalHub').classList.remove('hidden');renderJournalList();}
  function closeJournalHub(){q('v133JournalHub')?.classList.add('hidden');closeJournalMap();S.currentSession=null;}

  function punctualitySamples(events,sessionIds){
    const byStop=new Map();
    for(const e of events){if(!sessionIds.has(e.sessionId)||!Number.isFinite(Number(e.scheduleDeltaSec)))continue;if(e.type!=='STOP_ARRIVAL'&&e.type!=='STOP_PASSED')continue;const key=`${e.sessionId}|${Number.isInteger(e.stopIndex)?e.stopIndex:e.stopName||e.ts}`,old=byStop.get(key);if(!old||e.type==='STOP_ARRIVAL')byStop.set(key,e)}
    const stopVals=[...byStop.values()].map(e=>Number(e.scheduleDeltaSec));if(stopVals.length)return stopVals;
    return events.filter(e=>sessionIds.has(e.sessionId)&&e.type==='GPS_SAMPLE'&&Number.isFinite(Number(e.scheduleDeltaSec))).map(e=>Number(e.scheduleDeltaSec));
  }
  function profileStats(sessions,events){
    const ids=new Set(sessions.map(s=>s.id)),deltas=punctualitySamples(events,ids);let early=0,ontime=0,late=0;
    for(const d of deltas){if(d < -60)early++;else if(d > 300)late++;else ontime++;}
    const n=deltas.length,earlyPct=pct(early,n),ontimePct=pct(ontime,n),latePct=pct(late,n),avgDelta=n?deltas.reduce((a,b)=>a+b,0)/n:null;
    const speed=events.filter(e=>ids.has(e.sessionId)&&e.type==='GPS_SAMPLE'&&Number.isFinite(Number(e.speedKmh))&&Number.isFinite(Number(e.roadLimitKmh))&&Number(e.roadLimitKmh)>=10&&Number(e.roadLimitKmh)<=140);
    let compliant=0,excess=[];for(const e of speed){const v=Number(e.speedKmh),lim=Number(e.roadLimitKmh);if(v<=lim+5)compliant++;else excess.push(v-lim)}
    const roadPct=speed.length?pct(compliant,speed.length):null;
    const punctScore=n?clamp((ontimePct + earlyPct*.6 + latePct*.3)/10,0,10):null;
    const roadScore=roadPct===null?null:clamp(roadPct/10,0,10);
    const global=punctScore===null?(roadScore??null):roadScore===null?punctScore:punctScore*.65+roadScore*.35;
    return {sessions:sessions.length,distance:sessions.reduce((a,s)=>a+(Number(s.distanceKm)||0),0),deltas:n,earlyPct,ontimePct,latePct,avgDelta,speedSamples:speed.length,roadPct,avgExcess:excess.length?excess.reduce((a,b)=>a+b,0)/excess.length:null,punctScore,roadScore,global};
  }
  function statBar(label,value,sub=''){const valid=value!==null&&value!==undefined&&Number.isFinite(Number(value)),v=valid?clamp(Number(value),0,100):0;return `<div class="v133-stat"><div class="v133-stat-head"><span>${esc(label)}</span><b>${valid?String(Math.round(Number(value)*10)/10).replace('.',',')+' %':'—'}</b></div><div class="v133-track"><div class="v133-fill" style="width:${v}%"></div></div>${sub?`<div class="v133-method">${esc(sub)}</div>`:''}</div>`;}

  async function openProfile(){
    ensureUi();closeHamburger();const sheet=q('v133ProfileSheet'),body=q('v133ProfileBody');sheet.classList.remove('hidden');body.innerHTML='<div class="v133-loading">Calcul de tes statistiques…</div>';
    try{
      const [sx,events]=await Promise.all([allSessions(),allEvents()]),sessions=mineSessions(sx),st=profileStats(sessions,events),id=driverId()||'Conducteur';const note=st.global===null?'—':(Math.round(st.global*10)/10).toFixed(1).replace('.',',');
      body.innerHTML=`<section class="v133-profile-hero"><div class="v133-score"><b>${note}</b><span>/ 10${st.roadPct===null?'':' · provisoire'}</span></div><div><h3>${esc(id)}</h3><p>${st.sessions} course${st.sessions>1?'s':''} enregistrée${st.sessions>1?'s':''} · ${st.distance.toFixed(1).replace('.',',')} km journalisés. La note combine la ponctualité et, lorsqu’elle est disponible, l’indicateur de respect des limitations de vitesse.</p></div></section><div class="v133-punct-grid"><div class="v133-punct"><span>EN AVANCE</span><b>${st.deltas?String(st.earlyPct).replace('.',',')+' %':'—'}</b></div><div class="v133-punct"><span>À L’HEURE</span><b>${st.deltas?String(st.ontimePct).replace('.',',')+' %':'—'}</b></div><div class="v133-punct"><span>EN RETARD</span><b>${st.deltas?String(st.latePct).replace('.',',')+' %':'—'}</b></div></div><div class="v133-summary" style="margin-top:10px"><div class="v133-card"><span>POINTS DE PONCTUALITÉ</span><b>${st.deltas||0}</b><small>arrêts évalués en priorité</small></div><div class="v133-card"><span>ÉCART MOYEN</span><b>${st.avgDelta===null?'—':fmtDelta(st.avgDelta)}</b></div><div class="v133-card"><span>NOTE PONCTUALITÉ</span><b>${st.punctScore===null?'—':st.punctScore.toFixed(1).replace('.',',')+' / 10'}</b></div><div class="v133-card"><span>ÉCHANTILLONS VITESSE</span><b>${st.speedSamples}</b></div></div><div class="v133-bars">${statBar('Ponctualité : à l’heure',st.deltas?st.ontimePct:null,'À l’heure = entre 1 min d’avance et 5 min de retard.')}${statBar('Respect du code de la route · vitesse',st.roadPct,'Tolérance technique : vitesse enregistrée ≤ limitation + 5 km/h.')}</div><div class="v133-note"><b>⚠️ Statistique vitesse indicative pour le moment.</b><br>Les limitations de vitesse de la carte ne sont pas encore suffisamment fiables. Le pourcentage de respect du code de la route et la note globale peuvent donc être faussés jusqu’à ce que la source de limitations soit corrigée.</div><div class="v133-method">Calcul de la note : ponctualité 65 % + respect des limitations 35 %. Si aucune limitation exploitable n’est enregistrée, la note repose uniquement sur la ponctualité. Avance : plus de 1 minute avant l’horaire. À l’heure : de −1 min à +5 min. Retard : plus de 5 minutes.</div>`;
    }catch(err){body.innerHTML=`<div class="v133-error"><b>Impossible de calculer le profil.</b><br>${esc(err?.message||err)}</div>`;}
  }

  function versionUi(){document.title=`Mon SAEIV · ${VERSION}`;const e=document.querySelector('.top .eyebrow');if(e)e.textContent=`MON SAEIV · ${VERSION}`;const b=q('buildInfo');if(b)b.textContent=`Version ${VERSION}`;}
  function install(){
    if(S.installed)return;S.installed=true;ensureUi();ensureProfileButton();versionUi();
    document.addEventListener('click',e=>{
      const journal=e.target.closest?.('#v13JournalBtn');if(journal){e.preventDefault();e.stopImmediatePropagation();openJournalHub();return;}
      const open=e.target.closest?.('[data-v133-open]');if(open){e.preventDefault();openJournalDetail(open.dataset.v133Open);return;}
      const exp=e.target.closest?.('[data-v133-export]');if(exp){e.preventDefault();exportJournal(exp.dataset.v133Export);return;}
    },true);
    q('v316MenuBtn')?.addEventListener('click',()=>setTimeout(ensureProfileButton,0));
    const menu=q('v316MenuItems');if(menu)new MutationObserver(()=>ensureProfileButton()).observe(menu,{childList:true});
    setTimeout(()=>{ensureProfileButton();versionUi()},500);setTimeout(versionUi,3500);
    window.MonSAEIVV133={installed:true,openJournals:openJournalHub,openProfile,profileStats,version:VERSION};
    console.info('[Mon SAEIV] 1.0.33 journaux indépendants + profil actif');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
