'use strict';
/* Mon SAEIV 1.0.32 — consultation des journaux fiabilisée, sans modifier les données enregistrées. */
(()=>{
  const DB_NAME='fluo-saeiv-journal-v13';
  const ACCOUNT_KEY='fluoSaeivAccountV13';
  const q=id=>document.getElementById(id);
  const J={db:null,map:null,current:null,rendering:false,installed:false};

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function account(){try{return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null')}catch{return null}}
  function matricule(){return String(account()?.matricule||'').trim()}
  function fmtDate(v){try{return new Date(v).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'medium'})}catch{return v||'—'}}
  function fmtTime(v){try{return new Date(v).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return v||'—'}}
  function fmtDelay(v){const n=Number(v);if(!Number.isFinite(n))return '—';const s=Math.round(n),sign=s<0?'−':'+';const a=Math.abs(s);return `${sign}${Math.floor(a/60)}:${String(a%60).padStart(2,'0')}`;}
  function status(s){if(s?.status==='open')return ['EN COURS','v23-status-open'];if(s?.status==='interrupted')return ['INTERROMPU','v23-status-interrupted'];return ['TERMINÉ',''];}

  function openDb(){
    if(J.db)return Promise.resolve(J.db);
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>{
        const d=r.result;
        if(!d.objectStoreNames.contains('sessions')){const s=d.createObjectStore('sessions',{keyPath:'id'});s.createIndex('startedAt','startedAt');s.createIndex('matricule','matricule');}
        if(!d.objectStoreNames.contains('events')){const e=d.createObjectStore('events',{keyPath:'id',autoIncrement:true});e.createIndex('sessionId','sessionId');e.createIndex('ts','ts');e.createIndex('type','type');}
      };
      r.onsuccess=()=>{J.db=r.result;resolve(J.db)};
      r.onerror=()=>reject(r.error||new Error('IndexedDB indisponible'));
    });
  }
  async function allSessions(){const d=await openDb();return new Promise((res,rej)=>{const r=d.transaction('sessions').objectStore('sessions').getAll();r.onsuccess=()=>res((r.result||[]).sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||''))));r.onerror=()=>rej(r.error)});}
  async function getSession(id){const d=await openDb();return new Promise((res,rej)=>{const r=d.transaction('sessions').objectStore('sessions').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)});}
  async function getEvents(id){const d=await openDb();return new Promise((res,rej)=>{const r=d.transaction('events').objectStore('events').index('sessionId').getAll(id);r.onsuccess=()=>res((r.result||[]).sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||''))));r.onerror=()=>rej(r.error)});}
  async function removeSession(id){
    const d=await openDb();return new Promise((res,rej)=>{
      const tx=d.transaction(['sessions','events'],'readwrite');tx.objectStore('sessions').delete(id);
      const store=tx.objectStore('events'),idx=store.index('sessionId'),cur=idx.openKeyCursor(IDBKeyRange.only(id));
      cur.onsuccess=()=>{const c=cur.result;if(c){store.delete(c.primaryKey);c.continue();}};
      tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('Suppression annulée'));
    });
  }

  function sessionsForDriver(xs){const m=matricule();return m?xs.filter(s=>String(s.matricule||'').toLowerCase()===m.toLowerCase()):xs;}

  function ensureDetail(){
    if(q('v132JournalDetail'))return;
    const st=document.createElement('style');st.id='v132JournalStyle';st.textContent=`
      #v13JournalSheet.v132-open{z-index:60000!important}
      .v132-detail-backdrop{position:fixed;z-index:61000;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:12px;background:rgba(0,0,0,.82)}.v132-detail-backdrop.hidden{display:none!important}
      .v132-detail{width:min(980px,100%);max-height:95dvh;display:flex;flex-direction:column;padding:14px;border:1px solid rgba(255,255,255,.16);border-radius:22px;background:#0d202c;box-shadow:0 -22px 70px rgba(0,0,0,.58)}
      .v132-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v132-head h2{margin:3px 0 4px}.v132-head p{margin:0;color:#9fb0bb;font-size:.74rem}.v132-scroll{overflow:auto}.v132-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:11px 0}.v132-card{padding:9px;border:1px solid #2e4656;border-radius:12px;background:#081720}.v132-card span{display:block;color:#8fa5b3;font-size:.64rem}.v132-card b{display:block;margin-top:2px}.v132-map{height:320px;border:1px solid #355163;border-radius:15px;overflow:hidden;background:#10202a}.v132-note{margin:6px 2px;color:#8295a3;font-size:.66rem}.v132-table{margin-top:10px;border:1px solid #2e4656;border-radius:13px;overflow:auto}.v132-table table{width:100%;border-collapse:collapse;font-size:.74rem}.v132-table th,.v132-table td{padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;white-space:nowrap}.v132-table th{position:sticky;top:0;background:#10202c;color:#a6b6c1}.v132-table td:nth-child(2){min-width:190px;white-space:normal;font-weight:850}.v132-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}
      @media(max-width:680px){.v132-detail-backdrop{padding:0}.v132-detail{max-height:97dvh;border-radius:22px 22px 0 0;padding-bottom:calc(12px + env(safe-area-inset-bottom))}.v132-summary{grid-template-columns:1fr 1fr}.v132-actions{grid-template-columns:1fr}.v132-map{height:280px}}
    `;document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend',`<div id="v132JournalDetail" class="v132-detail-backdrop hidden" role="dialog" aria-modal="true"><div class="v132-detail"><div class="v132-head"><div><div class="v13-logo">JOURNAL DE SERVICE</div><h2 id="v132Title">Détail du service</h2><p id="v132Subtitle"></p></div><button id="v132Close" type="button">Fermer</button></div><div class="v132-scroll"><div id="v132Summary" class="v132-summary"></div><div id="v132Map" class="v132-map"></div><div class="v132-note">Le journal reste stocké localement sur cet appareil. La carte est reconstruite à partir du tracé et des positions enregistrées.</div><div id="v132Table" class="v132-table"></div></div><div class="v132-actions"><button id="v132Download" class="primary" type="button">📄 Exporter ce journal</button><button id="v132Delete" class="danger" type="button">🗑 Supprimer ce journal</button></div></div></div>`);
    q('v132Close')?.addEventListener('click',closeDetail);
    q('v132JournalDetail')?.addEventListener('click',e=>{if(e.target===q('v132JournalDetail'))closeDetail()});
    q('v132Download')?.addEventListener('click',()=>{if(J.current)exportOne(J.current.session,J.current.events)});
    q('v132Delete')?.addEventListener('click',async()=>{const s=J.current?.session;if(!s||s.status==='open')return;if(!confirm(`Supprimer définitivement le journal ${s.route||''} du ${fmtDate(s.startedAt)} ?`))return;await removeSession(s.id);closeDetail();await render();});
  }

  function point(e){const lat=Number.isFinite(Number(e?.fusedLat))?Number(e.fusedLat):Number(e?.lat),lon=Number.isFinite(Number(e?.fusedLon))?Number(e.fusedLon):Number(e?.lon);return Number.isFinite(lat)&&Number.isFinite(lon)?[lat,lon]:null;}
  function routePoints(s,ev){if(Array.isArray(s?.routeShape)&&s.routeShape.length>1)return s.routeShape.map(p=>[Number(p[0]),Number(p[1])]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));return ev.filter(e=>e.type==='GPS_SAMPLE').map(point).filter(Boolean);}
  function stopRows(s,ev){
    const m=new Map();for(const e of ev){if(e.type!=='STOP_ARRIVAL'&&e.type!=='STOP_PASSED')continue;const k=Number.isInteger(e.stopIndex)?`i${e.stopIndex}`:`n${e.stopName||''}`,old=m.get(k);if(!old||e.type==='STOP_ARRIVAL')m.set(k,e);}
    const rows=[...m.values()].sort((a,b)=>Number(a.stopIndex??9999)-Number(b.stopIndex??9999)||String(a.ts||'').localeCompare(String(b.ts||'')));
    if(s?.startStop&&!rows.some(r=>Number(r.stopIndex)===Number(s.startStopIndex))){const first=ev.find(e=>e.type==='GPS_SAMPLE'),p=point(first);rows.unshift({stopIndex:Number(s.startStopIndex||0),stopName:s.startStop,ts:s.startedAt,scheduledTime:s.scheduledDeparture||null,scheduleDeltaSec:s.scheduledDeparture?Math.round((new Date(s.startedAt)-new Date(s.scheduledDeparture))/1000):null,lat:p?.[0]??null,lon:p?.[1]??null,speedKmh:0});}
    return rows;
  }
  function rowPoint(r,s){if(Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lon)))return [Number(r.lat),Number(r.lon)];const st=Array.isArray(s?.routeStops)?s.routeStops.find(x=>Number(x.index)===Number(r.stopIndex)):null;return st&&Number.isFinite(Number(st.lat))&&Number.isFinite(Number(st.lon))?[Number(st.lat),Number(st.lon)]:null;}

  function closeMap(){if(J.map){try{J.map.remove()}catch{}J.map=null;}}
  function drawMap(s,ev,rows){
    const el=q('v132Map');if(!el)return;closeMap();el.innerHTML='';
    if(typeof L==='undefined'){el.innerHTML='<div class="v23-empty">Carte indisponible hors connexion ; les passages restent consultables ci-dessous.</div>';return;}
    try{
      const route=routePoints(s,ev),markers=rows.map(r=>({r,p:rowPoint(r,s)})).filter(x=>x.p),center=route[0]||markers[0]?.p||[48.7,6.2];
      const map=L.map(el,{zoomControl:true,attributionControl:true}).setView(center,13);J.map=map;L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);const bounds=[];
      if(route.length>1){L.polyline(route,{weight:6,opacity:.88}).addTo(map);bounds.push(...route)}
      markers.forEach((x,i)=>{bounds.push(x.p);L.circleMarker(x.p,{radius:i===0?7:6,weight:2,fillOpacity:1}).addTo(map).bindPopup(`<b>${esc(x.r.stopName||'Arrêt')}</b><br>Passage : ${esc(fmtTime(x.r.ts))}<br>Prévu : ${esc(x.r.scheduledTime?fmtTime(x.r.scheduledTime):'—')}<br>Écart : ${esc(fmtDelay(x.r.scheduleDeltaSec))}`)});
      if(bounds.length>1)try{map.fitBounds(bounds,{padding:[28,28],maxZoom:16})}catch{}
      setTimeout(()=>{try{map.invalidateSize()}catch{}},100);
    }catch(err){closeMap();el.innerHTML=`<div class="v23-empty">Carte momentanément indisponible.<br>${esc(err?.message||err)}</div>`;}
  }

  async function openDetail(id){
    ensureDetail();
    try{
      const [s,ev]=await Promise.all([getSession(id),getEvents(id)]);if(!s)throw new Error('Journal introuvable.');
      const rows=stopRows(s,ev),gps=ev.filter(e=>e.type==='GPS_SAMPLE').length;J.current={session:s,events:ev};
      q('v132Title').textContent=`${s.route||'Ligne'} · ${s.destination||''}`;q('v132Subtitle').textContent=`${fmtDate(s.startedAt)} · ${s.serviceMode||''}${s.tripId?` · trip ${s.tripId}`:''}`;
      q('v132Summary').innerHTML=`<div class="v132-card"><span>ARRÊTS PASSÉS</span><b>${rows.length}</b></div><div class="v132-card"><span>DISTANCE</span><b>${Number.isFinite(Number(s.distanceKm))?String(s.distanceKm).replace('.',',')+' km':'—'}</b></div><div class="v132-card"><span>VITESSE MAX</span><b>${Number.isFinite(Number(s.maxSpeedKmh))?s.maxSpeedKmh+' km/h':'—'}</b></div><div class="v132-card"><span>POINTS GPS</span><b>${gps}</b></div>`;
      q('v132Table').innerHTML=rows.length?`<table><thead><tr><th>#</th><th>Arrêt</th><th>Passage réel</th><th>Prévu</th><th>Écart</th><th>Vitesse</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.stopName||'—')}</td><td>${esc(fmtTime(r.ts))}</td><td>${esc(r.scheduledTime?fmtTime(r.scheduledTime):'—')}</td><td>${esc(fmtDelay(r.scheduleDeltaSec))}</td><td>${Number.isFinite(Number(r.speedKmh))?Number(r.speedKmh).toFixed(1).replace('.',',')+' km/h':'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="v23-empty">Aucun passage d’arrêt enregistré dans ce service.</div>';
      const del=q('v132Delete');if(del){del.disabled=s.status==='open';del.textContent=s.status==='open'?'Service en cours — suppression impossible':'🗑 Supprimer ce journal';}
      q('v132JournalDetail').classList.remove('hidden');setTimeout(()=>drawMap(s,ev,rows),40);
    }catch(err){alert(`Impossible d’ouvrir ce journal : ${err?.message||err}`);}
  }
  function closeDetail(){q('v132JournalDetail')?.classList.add('hidden');closeMap();J.current=null;}

  function exportOne(s,ev){
    try{if(window.MonSAEVJournalPDF?.exportIds){window.MonSAEVJournalPDF.exportIds([s.id]);return;}}catch{}
    const rows=stopRows(s,ev);const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Journal ${esc(s.route||'Mon SAEIV')}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{margin-bottom:4px}.muted{color:#555}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px;border-bottom:1px solid #ccc;text-align:left}th{background:#eee}</style></head><body><div class="muted">MON SAEIV · JOURNAL DE SERVICE</div><h1>${esc(s.route||'—')} · ${esc(s.destination||'')}</h1><div class="muted">${esc(fmtDate(s.startedAt))} · ${esc(s.serviceMode||'')}</div><table><thead><tr><th>#</th><th>Arrêt</th><th>Passage</th><th>Prévu</th><th>Écart</th><th>Vitesse</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.stopName||'—')}</td><td>${esc(fmtTime(r.ts))}</td><td>${esc(r.scheduledTime?fmtTime(r.scheduledTime):'—')}</td><td>${esc(fmtDelay(r.scheduleDeltaSec))}</td><td>${Number.isFinite(Number(r.speedKmh))?Number(r.speedKmh).toFixed(1).replace('.',',')+' km/h':'—'}</td></tr>`).join('')}</tbody></table></body></html>`;const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`journal-${String(s.route||'service').replace(/[^a-z0-9_-]+/gi,'-')}.html`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  async function render(){
    const list=q('v13JournalList');if(!list||J.rendering)return;J.rendering=true;list.dataset.v23Rendered='1';
    try{
      const xs=sessionsForDriver(await allSessions());
      list.innerHTML=xs.length?xs.map(s=>{const [lab,cl]=status(s);return `<div class="v13-session v23-session v132-session" data-v132-id="${esc(s.id)}" data-session-id="${esc(s.id)}"><div class="v23-session-row"><input class="v23-select" type="checkbox" data-select-id="${esc(s.id)}" ${s.status==='open'?'disabled':''}><div class="v23-session-main"><strong>${esc(s.route||'—')} · ${esc(s.destination||'')}</strong><span>${esc(fmtDate(s.startedAt))} · ${esc(s.serviceMode||'')} ${s.tripId?`· trip ${esc(s.tripId)}`:''}</span><span>${Number(s.stopEvents||0)} arrêts · ${Number(s.samples||0)} points GPS · max ${Number.isFinite(Number(s.maxSpeedKmh))?esc(s.maxSpeedKmh):'—'} km/h · ${Number.isFinite(Number(s.distanceKm))?esc(s.distanceKm):'—'} km</span></div><span class="v13-session-badge ${cl}">${lab}</span></div><div class="v23-session-actions"><button type="button" data-v132-action="view">🗺 Voir le journal</button><button type="button" data-v132-action="download">📄 Exporter</button>${s.status==='open'?'':`<button type="button" class="v23-delete" data-v132-action="delete">🗑 Supprimer</button>`}</div></div>`}).join(''):'<div class="v23-empty"><strong>Aucun service enregistré</strong><br>Les journaux apparaîtront ici après une prise de service.</div>';
      const storage=q('v13Storage');if(storage){try{const est=await navigator.storage?.estimate?.();if(est)storage.textContent=`Stockage local utilisé : ${(est.usage/1024/1024).toFixed(1)} Mo sur cet appareil.`}catch{}}
    }catch(err){list.innerHTML=`<div class="v23-empty"><strong>Journal indisponible</strong><br>${esc(err?.message||err)}</div>`;}
    finally{J.rendering=false;}
  }

  async function openJournal(){
    const sheet=q('v13JournalSheet');if(!sheet)return;sheet.classList.add('v132-open');sheet.classList.remove('hidden');await render();
  }
  function closeJournal(){q('v13JournalSheet')?.classList.add('hidden');q('v13JournalSheet')?.classList.remove('v132-open');}

  function install(){
    if(J.installed)return;J.installed=true;ensureDetail();
    document.addEventListener('click',e=>{
      const journalBtn=e.target.closest?.('#v13JournalBtn');
      if(journalBtn){e.preventDefault();e.stopImmediatePropagation();openJournal();return;}
      if(e.target.closest?.('#v13JournalClose')){e.preventDefault();e.stopImmediatePropagation();closeJournal();return;}
      const item=e.target.closest?.('.v132-session');if(!item)return;
      if(e.target.matches?.('.v23-select')){e.stopImmediatePropagation();return;}
      const id=item.dataset.v132Id;if(!id)return;const action=e.target.closest?.('[data-v132-action]')?.dataset.v132Action||'view';
      e.preventDefault();e.stopImmediatePropagation();
      if(action==='view'){openDetail(id);return;}
      if(action==='download'){Promise.all([getSession(id),getEvents(id)]).then(([s,ev])=>{if(s)exportOne(s,ev)}).catch(err=>alert(`Export impossible : ${err?.message||err}`));return;}
      if(action==='delete'){getSession(id).then(async s=>{if(!s||s.status==='open')return;if(confirm(`Supprimer définitivement ce journal ${s.route||''} du ${fmtDate(s.startedAt)} ?`)){await removeSession(id);await render();}}).catch(err=>alert(`Suppression impossible : ${err?.message||err}`));}
    },true);
    q('v13JournalSheet')?.addEventListener('click',e=>{if(e.target===q('v13JournalSheet'))closeJournal()});
    const list=q('v13JournalList');if(list)new MutationObserver(()=>{if(J.rendering||q('v13JournalSheet')?.classList.contains('hidden'))return;if(list.querySelector('.v13-session:not(.v132-session)'))setTimeout(render,30)}).observe(list,{childList:true});
    window.MonSAEIVJournalsV132={open:openJournal,render,openDetail,version:'1.0.32'};
    console.info('[Mon SAEIV] journaux 1.0.32 actifs');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
