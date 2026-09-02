'use strict';
/* Mon SAEIV 1.0.47 — enchaînement Ma journée robuste + Journaux restaurés.
   - FIN pendant Ma journée : masque définitivement l'écran intermédiaire puis attend que le planning
     marque réellement l'étape terminée avant de lancer la suivante.
   - Course suivante : préparation puis démarrage automatique (préflight respecté).
   - HLP suivant : lancement automatique du cockpit HLP V144.
   - Coupure/pause/fin : aucune fausse page d'export/journal entre les étapes.
   - Journaux : nouvelle vue plein écran responsive, consultation fiable et suppression restaurée.
*/
(()=>{
  if(window.MonSAEIVFlowJournalsV147?.installed)return;
  const q=id=>document.getElementById(id);
  const DAY_KEY='fluo-v143-day-running';
  const PREPARED_KEY='fluo-v316-prepared-item';
  const DB_NAME='fluo-saeiv-journal-v13';
  const ACCOUNT_KEY='fluoSaeivAccountV13';
  let transitionToken=0, transitionTimer=null, journalDb=null, journalMap=null;

  const dayRunning=()=>sessionStorage.getItem(DAY_KEY)==='1';
  const visible=e=>!!e&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none';
  const activeDayItem=()=>q('v316TodayPanel')?.querySelector('.v316-today-item.active:not(.done)')||null;
  const actionId=el=>el?.dataset?.v316Prepare||el?.dataset?.v316HlpNext||el?.dataset?.v316Hlp||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{try{return new Date(v).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}catch{return v||'—'}};
  const fmtTime=v=>{try{return new Date(v).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}catch{return v||'—'}};
  const fmtDelta=sec=>{const n=Number(sec);if(!Number.isFinite(n))return'—';const s=Math.round(n),sign=s<0?'−':'+';const a=Math.abs(s);return`${sign}${Math.floor(a/60)}:${String(a%60).padStart(2,'0')}`};

  function installStyle(){
    if(q('v147FixStyle'))return;
    const s=document.createElement('style');s.id='v147FixStyle';s.textContent=`
      body.v147-day-transition #v125PassengerEnd{display:none!important}
      #v147JournalHub{position:fixed;z-index:2147483500;inset:0;background:#061019;color:#eef8fd;display:grid;grid-template-rows:auto 1fr;overflow:hidden}#v147JournalHub.hidden{display:none!important}
      .v147-j-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 10px max(12px,env(safe-area-inset-left));border-bottom:1px solid #2e4a5a;background:#0b202b}.v147-j-head h2{margin:2px 0;font-size:1.2rem}.v147-j-head p{margin:0;color:#94aab6;font-size:.68rem}.v147-j-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.v147-j-actions button{min-height:38px;padding:7px 10px;font-size:.67rem}
      .v147-j-body{min-height:0;overflow:auto;padding:12px max(12px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}.v147-j-loading,.v147-j-empty{padding:32px 15px;text-align:center;color:#9fb3bd}.v147-j-error{padding:13px;border:1px solid #7b4448;border-radius:13px;background:#351d21;color:#ffd5d1}
      .v147-j-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:9px}.v147-j-card{padding:12px;border:1px solid #2e4a5a;border-radius:15px;background:#0b202b}.v147-j-cardtop{display:grid;grid-template-columns:1fr auto;gap:9px}.v147-j-card strong,.v147-j-card span{display:block}.v147-j-card strong{font-size:.9rem}.v147-j-card span{margin-top:3px;color:#96adb8;font-size:.65rem}.v147-j-badge{height:max-content;padding:5px 8px;border-radius:999px;background:#173543;color:#d8edf6;font-size:.55rem;font-weight:950}.v147-j-badge.open{background:#153b28;color:#caffd8}.v147-j-badge.interrupted{background:#4b3515;color:#ffe0a6}.v147-j-cardactions{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-top:10px}.v147-j-cardactions button{min-height:40px;padding:7px;font-size:.65rem}.v147-danger{border-color:#8c4749!important;background:#4b2225!important;color:#ffd7d4!important}
      .v147-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.v147-stat{padding:10px;border:1px solid #2e4a5a;border-radius:12px;background:#0a1d27}.v147-stat span{display:block;color:#899fab;font-size:.55rem;font-weight:950}.v147-stat b{display:block;margin-top:3px;font-size:.95rem}.v147-map{height:min(36vh,310px);min-height:190px;margin:10px 0;border:1px solid #355163;border-radius:14px;overflow:hidden;background:#10202a}.v147-map.hidden{display:none!important}.v147-table{width:100%;overflow:auto;border:1px solid #2e4a5a;border-radius:13px}.v147-table table{width:100%;border-collapse:collapse;font-size:.69rem}.v147-table th,.v147-table td{padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;white-space:nowrap}.v147-table th{position:sticky;top:0;z-index:2;background:#102630;color:#a9bac3}.v147-table td:nth-child(2){min-width:180px;white-space:normal;font-weight:850}
      @media(max-width:680px){.v147-j-head{align-items:stretch;flex-direction:column}.v147-j-actions{justify-content:flex-start}.v147-summary{grid-template-columns:1fr 1fr}.v147-j-cardactions{grid-template-columns:1fr 1fr}.v147-j-cardactions .v147-danger{grid-column:1/-1}.v147-map{height:250px}}
      @media(orientation:landscape) and (max-height:650px){.v147-j-head{padding:5px 8px;align-items:center;flex-direction:row}.v147-j-head p{display:none}.v147-j-body{padding:6px 8px}.v147-map{height:42vh;min-height:150px}.v147-summary{grid-template-columns:repeat(4,1fr)}.v147-stat{padding:6px}.v147-table th,.v147-table td{padding:6px 7px}}
    `;document.head.appendChild(s);
  }

  // ---------- Ma journée ----------
  function hideIntermediateEnd(){const e=q('v125PassengerEnd');if(e)e.classList.add('hidden')}
  function beginTransition(){installStyle();document.body.classList.add('v147-day-transition');hideIntermediateEnd();clearInterval(transitionTimer);const until=Date.now()+30000;transitionTimer=setInterval(()=>{hideIntermediateEnd();if(Date.now()>until){clearInterval(transitionTimer);transitionTimer=null;document.body.classList.remove('v147-day-transition');hideIntermediateEnd()}},60)}
  function endTransition(){clearInterval(transitionTimer);transitionTimer=null;hideIntermediateEnd();document.body.classList.remove('v147-day-transition')}

  function startPreparedCourse(itemId,token){
    const started=Date.now();let clicked=false,preflight=false;
    const timer=setInterval(()=>{
      if(token!==transitionToken||!dayRunning()){clearInterval(timer);endTransition();return}
      if(state?.running){clearInterval(timer);endTransition();return}
      if(sessionStorage.getItem(PREPARED_KEY)!==String(itemId)){if(Date.now()-started>20000){clearInterval(timer);endTransition()}return}
      const pf=q('v136Preflight');if(visible(pf)){const go=q('v136PreflightGo');if(go?.dataset?.target&&!preflight){preflight=true;go.click()}return}
      if(visible(q('v3120DemandPreflight')))return;
      const start=q('start');if(!clicked&&start&&!start.disabled&&state?.pattern){clicked=true;start.click();return}
      if(clicked&&Date.now()-started>20000){clearInterval(timer);endTransition()}
    },100);
  }

  function launchActiveNext(previousId,token,attempt=0){
    if(token!==transitionToken||!dayRunning())return endTransition();
    hideIntermediateEnd();
    if(state?.running)return setTimeout(()=>launchActiveNext(previousId,token,attempt+1),120);
    if(visible(q('v144HlpDriver'))){endTransition();return}
    const a=activeDayItem();
    if(!a){if(attempt<140)return setTimeout(()=>launchActiveNext(previousId,token,attempt+1),100);endTransition();return}
    const prep=a.querySelector('[data-v316-prepare]'),hn=a.querySelector('[data-v316-hlp-next]'),h=a.querySelector('[data-v316-hlp]');
    const candidate=prep||hn||h,id=actionId(candidate);
    if(id&&String(id)===String(previousId)){if(attempt<140)return setTimeout(()=>launchActiveNext(previousId,token,attempt+1),100);endTransition();return}
    if(prep){prep.click();startPreparedCourse(prep.dataset.v316Prepare,token);return}
    if(hn){hn.click();setTimeout(()=>{if(token===transitionToken)endTransition()},600);return}
    if(h){h.click();setTimeout(()=>{if(token===transitionToken)endTransition()},600);return}
    // Coupure / pause / disponibilité / fin de service : aucune page de fin intermédiaire.
    setTimeout(()=>{hideIntermediateEnd();endTransition()},700);
  }

  function afterFinish(previousId){const token=++transitionToken;beginTransition();setTimeout(()=>launchActiveNext(previousId,token),180)}
  function kickDay(token,attempt=0){if(token!==transitionToken||!dayRunning())return;const a=activeDayItem();if(!a){if(attempt<100)setTimeout(()=>kickDay(token,attempt+1),100);return}const prep=a.querySelector('[data-v316-prepare]'),hn=a.querySelector('[data-v316-hlp-next]'),h=a.querySelector('[data-v316-hlp]');if(prep){prep.click();startPreparedCourse(prep.dataset.v316Prepare,token)}else if(hn)hn.click();else if(h)h.click()}

  function installDayFlow(){
    document.addEventListener('click',e=>{
      const sd=e.target.closest?.('#v316StartDay');if(sd){const token=++transitionToken;setTimeout(()=>kickDay(token),220);return}
      const fin=e.target.closest?.('#finish');if(fin&&dayRunning()){
        const previous=sessionStorage.getItem(PREPARED_KEY)||actionId(activeDayItem()?.querySelector('[data-v316-prepare],[data-v316-hlp-next],[data-v316-hlp]'))||'';
        setTimeout(()=>afterFinish(previous),0);
      }
    },true);
  }

  // ---------- Journaux ----------
  function account(){try{return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null')}catch{return null}}
  function driverId(){return String(account()?.matricule||'').trim()}
  function openDb(){if(journalDb)return Promise.resolve(journalDb);return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onsuccess=()=>{journalDb=r.result;resolve(journalDb)};r.onerror=()=>reject(r.error||new Error('Impossible d’ouvrir les journaux'));r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('sessions')){const s=d.createObjectStore('sessions',{keyPath:'id'});s.createIndex('startedAt','startedAt');s.createIndex('matricule','matricule')}if(!d.objectStoreNames.contains('events')){const ev=d.createObjectStore('events',{keyPath:'id',autoIncrement:true});ev.createIndex('sessionId','sessionId');ev.createIndex('ts','ts');ev.createIndex('type','type')}}})}
  async function sessions(){const d=await openDb();const xs=await new Promise((res,rej)=>{const r=d.transaction('sessions','readonly').objectStore('sessions').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)}),id=driverId();return xs.filter(s=>!id||String(s.matricule||'').trim().toLowerCase()===id.toLowerCase()).sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||'')))}
  async function sessionFor(id){const d=await openDb();return new Promise((res,rej)=>{const r=d.transaction('sessions','readonly').objectStore('sessions').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
  async function eventsFor(id){const d=await openDb();return new Promise((res,rej)=>{const st=d.transaction('events','readonly').objectStore('events');let r;try{r=st.index('sessionId').getAll(id)}catch{r=st.getAll()}r.onsuccess=()=>{let xs=r.result||[];if(!st.indexNames.contains('sessionId'))xs=xs.filter(e=>String(e.sessionId)===String(id));res(xs.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||''))))};r.onerror=()=>rej(r.error)})}
  async function deleteJournal(id){
    const d=await openDb();
    await new Promise((res,rej)=>{
      const tx=d.transaction(['sessions','events'],'readwrite'),ss=tx.objectStore('sessions'),es=tx.objectStore('events');ss.delete(id);
      try{const idx=es.index('sessionId'),r=idx.openCursor(IDBKeyRange.only(id));r.onsuccess=()=>{const c=r.result;if(c){c.delete();c.continue()}}}catch{const r=es.openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(String(c.value?.sessionId)===String(id))c.delete();c.continue()}}}
      tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error||new Error('Suppression impossible'));tx.onabort=()=>rej(tx.error||new Error('Suppression annulée'));
    });
  }
  function stopRows(s,events){const by=new Map();for(const e of events){if(e.type!=='STOP_ARRIVAL'&&e.type!=='STOP_PASSED')continue;const k=Number.isInteger(e.stopIndex)?String(e.stopIndex):String(e.stopName||e.ts),old=by.get(k);if(!old||e.type==='STOP_ARRIVAL')by.set(k,e)}return [...by.values()].sort((a,b)=>Number(a.stopIndex??9999)-Number(b.stopIndex??9999)||String(a.ts||'').localeCompare(String(b.ts||'')))}
  function point(e){const lat=Number.isFinite(Number(e?.fusedLat))?Number(e.fusedLat):Number(e?.lat),lon=Number.isFinite(Number(e?.fusedLon))?Number(e.fusedLon):Number(e?.lon);return Number.isFinite(lat)&&Number.isFinite(lon)?[lat,lon]:null}
  function closeMap(){if(journalMap){try{journalMap.remove()}catch{}journalMap=null}}
  function drawMap(events){const el=q('v147JournalMap');if(!el)return;closeMap();const pts=events.filter(e=>e.type==='GPS_SAMPLE').map(point).filter(Boolean);if(typeof L==='undefined'||pts.length<2){el.classList.add('hidden');return}try{el.classList.remove('hidden');journalMap=L.map(el,{zoomControl:true}).setView(pts[0],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(journalMap);L.polyline(pts,{weight:5,opacity:.9}).addTo(journalMap);journalMap.fitBounds(pts,{padding:[20,20],maxZoom:16});setTimeout(()=>journalMap?.invalidateSize(),120)}catch{el.classList.add('hidden');closeMap()}}

  function ensureJournalUi(){
    installStyle();if(q('v147JournalHub'))return;
    document.body.insertAdjacentHTML('beforeend',`<section id="v147JournalHub" class="hidden"><header class="v147-j-head"><div><div class="eyebrow">MON SAEIV · JOURNAUX</div><h2 id="v147JournalTitle">Historique des services</h2><p id="v147JournalSub">Les journaux sont conservés localement sur cet appareil.</p></div><div class="v147-j-actions"><button id="v147JournalBack" class="hidden" type="button">← Journaux</button><button id="v147JournalDelete" class="v147-danger hidden" type="button">🗑 Supprimer</button><button id="v147JournalClose" type="button">Fermer</button></div></header><main id="v147JournalBody" class="v147-j-body"></main></section>`);
    q('v147JournalClose').onclick=closeJournal;q('v147JournalBack').onclick=renderJournals;q('v147JournalDelete').onclick=async()=>{const id=q('v147JournalDelete').dataset.id;if(id)await requestDelete(id,true)};
  }
  function status(s){if(s?.status==='open')return['EN COURS','open'];if(s?.status==='interrupted')return['INTERROMPU','interrupted'];return['TERMINÉ','']}
  async function renderJournals(){ensureJournalUi();closeMap();q('v147JournalHub').classList.remove('hidden');q('v147JournalBack').classList.add('hidden');q('v147JournalDelete').classList.add('hidden');q('v147JournalTitle').textContent='Historique des services';q('v147JournalSub').textContent='Consulte, exporte ou supprime un journal.';const body=q('v147JournalBody');body.innerHTML='<div class="v147-j-loading">Chargement des journaux…</div>';try{const xs=await sessions();body.innerHTML=xs.length?`<div class="v147-j-list">${xs.map(s=>{const [lab,cl]=status(s);return`<article class="v147-j-card"><div class="v147-j-cardtop"><div><strong>${esc(s.route||'—')} · ${esc(s.destination||'')}</strong><span>${esc(fmtDate(s.startedAt))} · ${esc(s.serviceMode||'service')}</span><span>${Number(s.stopEvents||0)} arrêts · ${Number(s.samples||0)} points GPS · ${Number.isFinite(Number(s.distanceKm))?String(s.distanceKm).replace('.',',')+' km':'distance —'}</span></div><span class="v147-j-badge ${cl}">${lab}</span></div><div class="v147-j-cardactions"><button type="button" data-v147-open="${esc(s.id)}">🗺 Consulter</button><button type="button" data-v147-export="${esc(s.id)}">📄 Exporter</button><button class="v147-danger" type="button" data-v147-delete="${esc(s.id)}">🗑</button></div></article>`}).join('')}</div>`:'<div class="v147-j-empty"><b>Aucun journal enregistré.</b></div>'}catch(e){body.innerHTML=`<div class="v147-j-error"><b>Impossible de lire les journaux.</b><br>${esc(e?.message||e)}</div>`}}
  async function openJournal(id){ensureJournalUi();const body=q('v147JournalBody');body.innerHTML='<div class="v147-j-loading">Ouverture du journal…</div>';q('v147JournalBack').classList.remove('hidden');q('v147JournalDelete').classList.remove('hidden');q('v147JournalDelete').dataset.id=id;try{const [s,events]=await Promise.all([sessionFor(id),eventsFor(id)]);if(!s)throw new Error('Journal introuvable');const rows=stopRows(s,events),gps=events.filter(e=>e.type==='GPS_SAMPLE').length;q('v147JournalTitle').textContent=`${s.route||'Ligne'} · ${s.destination||''}`;q('v147JournalSub').textContent=`${fmtDate(s.startedAt)} · ${s.serviceMode||'service'}`;body.innerHTML=`<div class="v147-summary"><div class="v147-stat"><span>ARRÊTS</span><b>${rows.length}</b></div><div class="v147-stat"><span>DISTANCE</span><b>${Number.isFinite(Number(s.distanceKm))?String(s.distanceKm).replace('.',',')+' km':'—'}</b></div><div class="v147-stat"><span>VITESSE MAX</span><b>${Number.isFinite(Number(s.maxSpeedKmh))?Math.round(Number(s.maxSpeedKmh))+' km/h':'—'}</b></div><div class="v147-stat"><span>POINTS GPS</span><b>${gps}</b></div></div><div id="v147JournalMap" class="v147-map"></div><div class="v147-table">${rows.length?`<table><thead><tr><th>#</th><th>Arrêt</th><th>Réel</th><th>Prévu</th><th>Écart</th><th>Vitesse</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.stopName||'—')}</td><td>${esc(fmtTime(r.ts))}</td><td>${esc(r.scheduledTime?fmtTime(r.scheduledTime):'—')}</td><td>${esc(fmtDelta(r.scheduleDeltaSec))}</td><td>${Number.isFinite(Number(r.speedKmh))?Math.round(Number(r.speedKmh))+' km/h':'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="v147-j-empty">Aucun passage d’arrêt enregistré.</div>'}</div>`;setTimeout(()=>drawMap(events),40)}catch(e){body.innerHTML=`<div class="v147-j-error"><b>Impossible d’ouvrir ce journal.</b><br>${esc(e?.message||e)}</div>`}}
  async function requestDelete(id,fromDetail=false){const s=await sessionFor(id);if(!s)return renderJournals();if(!confirm(`Supprimer définitivement le journal « ${s.route||'Service'} · ${s.destination||''} » du ${fmtDate(s.startedAt)} ?`))return;try{await deleteJournal(id);closeMap();await renderJournals()}catch(e){alert(`Suppression impossible : ${e?.message||e}`)}}
  async function exportJournal(id){try{const [s,events]=await Promise.all([sessionFor(id),eventsFor(id)]);if(!s)throw new Error('Journal introuvable');const rows=stopRows(s,events),html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Journal ${esc(s.route||'Mon SAEIV')}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px;border-bottom:1px solid #ccc;text-align:left}th{background:#eee}</style></head><body><small>MON SAEIV · JOURNAL</small><h1>${esc(s.route||'—')} · ${esc(s.destination||'')}</h1><p>${esc(fmtDate(s.startedAt))}</p><table><thead><tr><th>#</th><th>Arrêt</th><th>Réel</th><th>Prévu</th><th>Écart</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.stopName||'—')}</td><td>${esc(fmtTime(r.ts))}</td><td>${esc(r.scheduledTime?fmtTime(r.scheduledTime):'—')}</td><td>${esc(fmtDelta(r.scheduleDeltaSec))}</td></tr>`).join('')}</tbody></table></body></html>`,url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`journal-${String(s.route||'service').replace(/[^a-z0-9_-]+/gi,'-')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e){alert(`Export impossible : ${e?.message||e}`)}}
  function closeJournal(){q('v147JournalHub')?.classList.add('hidden');closeMap()}

  function hookJournalMenu(){
    const old=q('v13JournalBtn');
    if(old&&!q('v147JournalBtn')){const b=old.cloneNode(true);b.id='v147JournalBtn';b.textContent='📘 Journaux';old.style.display='none';old.insertAdjacentElement('afterend',b);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();q('v316MenuBackdrop')?.classList.add('hidden');renderJournals()})}
  }
  function installJournalFlow(){ensureJournalUi();hookJournalMenu();const menu=q('v316MenuItems');if(menu)new MutationObserver(()=>hookJournalMenu()).observe(menu,{childList:true,subtree:false});document.addEventListener('click',e=>{const o=e.target.closest?.('[data-v147-open]');if(o){e.preventDefault();openJournal(o.dataset.v147Open);return}const d=e.target.closest?.('[data-v147-delete]');if(d){e.preventDefault();requestDelete(d.dataset.v147Delete);return}const x=e.target.closest?.('[data-v147-export]');if(x){e.preventDefault();exportJournal(x.dataset.v147Export)}},true)}

  function versionUi(){document.title='Mon SAEIV · 1.0.47';const b=q('buildInfo');if(b)b.textContent='Version 1.0.47';const v=q('v137Identity')?.querySelector('.v137-version');if(v)v.textContent='Version 1.0.47'}
  function install(){installStyle();installDayFlow();installJournalFlow();versionUi();setTimeout(versionUi,700);window.MonSAEIVFlowJournalsV147={installed:true,version:'1.0.47',openJournals:renderJournals};console.info('[Mon SAEIV] 1.0.47 enchaînement Ma journée + journaux corrigés')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
