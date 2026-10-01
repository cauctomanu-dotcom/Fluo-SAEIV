'use strict';
/* Mon SAEIV 1.0.82 — supervision exploitation temps réel.
   Réutilise saeiv_live_courses : aucune seconde géolocalisation et aucun flux public supplémentaire. */
(()=>{
  if(window.MonSAEIVLiveSupervisionV183?.installed)return;
  const VERSION='1.0.82',q=id=>document.getElementById(id);
  const S={open:false,map:null,markers:new Map(),rows:[],profiles:new Map(),timer:null,busy:false,fitOnce:false,lastRefresh:0};
  const cloud=()=>window.MonSAEIVCloudV156;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=()=>['dispatcher','admin'].includes(String(cloud()?.profile?.role||''));
  const ageSeconds=r=>Math.max(0,(Date.now()-new Date(r.observed_at).getTime())/1000);
  const roundMin=s=>Math.max(1,Math.round(Math.abs(Number(s)||0)/60));
  function stageLabel(stage){return stage==='hlp'?'Haut-le-pied':stage==='waiting'?'En attente départ':'En service'}
  function delayText(v){
    if(!Number.isFinite(Number(v)))return 'Écart inconnu';
    const s=Number(v);if(Math.abs(s)<60)return 'À l’heure';
    return s>0?`+${roundMin(s)} min`:`−${roundMin(s)} min`;
  }
  function stateOf(r){
    const age=ageSeconds(r),d=Number(r.delay_seconds);
    if(age>180)return{key:'lost',label:'GPS ancien',rank:100};
    if(age>60)return{key:'stale',label:'Position ancienne',rank:90};
    if(Number.isFinite(d)&&d>=600)return{key:'late',label:'Retard important',rank:80};
    if(Number.isFinite(d)&&d>=180)return{key:'warn',label:'Retard',rank:60};
    if(Number.isFinite(d)&&d<=-120)return{key:'early',label:'Avance',rank:45};
    return{key:'ok',label:'À l’heure',rank:10};
  }
  function installUi(){
    if(q('v183Supervision'))return;
    const style=document.createElement('style');style.id='v183SupervisionStyle';style.textContent=`
      #v183Open{white-space:nowrap}.v183-root{position:fixed;z-index:49000;inset:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#061019;color:#f4f8fa}.v183-root.hidden{display:none!important}.v183-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #294454;background:#0b1d28}.v183-title b,.v183-title span{display:block}.v183-title b{font-size:1.15rem}.v183-title span{margin-top:2px;color:#91a9b5;font-size:.64rem}.v183-actions{display:flex;gap:7px;align-items:center}.v183-actions button{min-height:38px;padding:7px 10px}.v183-live{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid #2f6e49;border-radius:999px;background:#0c2b1a;color:#bfffd0;font-size:.62rem;font-weight:950}.v183-live:before{content:'';width:7px;height:7px;border-radius:50%;background:#55d981;box-shadow:0 0 0 4px rgba(85,217,129,.12)}
      .v183-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;padding:9px 12px;border-bottom:1px solid #253e4c;background:#081721}.v183-kpi{padding:8px 10px;border:1px solid #2d4859;border-radius:11px;background:#0d202c}.v183-kpi b,.v183-kpi span{display:block}.v183-kpi b{font-size:1.05rem}.v183-kpi span{margin-top:2px;color:#8fa6b2;font-size:.54rem;text-transform:uppercase;letter-spacing:.05em}
      .v183-work{min-height:0;display:grid;grid-template-columns:350px minmax(0,1fr)}.v183-side{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);border-right:1px solid #294454;background:#091923}.v183-filters{padding:10px;border-bottom:1px solid #294454}.v183-filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.v183-filter-grid .wide{grid-column:1/-1}.v183-filters input,.v183-filters select{min-height:39px;padding:7px 8px}.v183-statusline{margin-top:7px;color:#90a7b2;font-size:.59rem}.v183-list{min-height:0;overflow:auto;padding:8px;display:grid;align-content:start;gap:7px}.v183-card{width:100%;min-height:0;padding:10px;border:1px solid #304d5d;border-radius:12px;background:#0b202b;color:#f4f8fa;text-align:left}.v183-card:hover{background:#102b39}.v183-card.late{border-color:#a24d50;background:#35191b}.v183-card.warn{border-color:#a67b22;background:#30260d}.v183-card.early{border-color:#377a99;background:#102a38}.v183-card.stale,.v183-card.lost{border-color:#596772;background:#20272c}.v183-card-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.v183-line{display:inline-flex;min-width:46px;justify-content:center;padding:4px 7px;border-radius:7px;background:#ffd000;color:#121212;font-size:.72rem;font-weight:1000}.v183-delta{font-size:.82rem;font-weight:1000}.v183-card strong,.v183-card small{display:block}.v183-card strong{margin-top:7px;font-size:.72rem}.v183-card small{margin-top:3px;color:#9eb3bd;font-size:.56rem;line-height:1.35}.v183-card .v183-state{margin-top:7px;color:#d8e7ed;font-weight:850}.v183-empty{padding:22px 12px;color:#91a8b3;text-align:center;font-size:.68rem;line-height:1.5}
      .v183-map-wrap{position:relative;min-width:0;min-height:0;background:#0b1c26}.v183-map{width:100%;height:100%;min-height:360px}.v183-map-note{position:absolute;z-index:900;left:12px;bottom:12px;max-width:420px;padding:8px 10px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(5,16,24,.9);color:#c6d7de;font-size:.58rem;backdrop-filter:blur(7px)}.v183-bus-icon{background:transparent;border:0}.v183-marker{display:flex;align-items:center;gap:4px;transform:translate(-50%,-50%);white-space:nowrap}.v183-marker .bus{display:grid;place-items:center;width:31px;height:31px;border:2px solid #fff;border-radius:9px;background:#173747;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.45);font-size:16px}.v183-marker .tag{padding:4px 6px;border:1px solid #fff;border-radius:7px;background:#0b1e29;color:#fff;font-size:10px;font-weight:1000;box-shadow:0 3px 12px rgba(0,0,0,.4)}.v183-marker.late .bus,.v183-marker.late .tag{background:#8f3035}.v183-marker.warn .bus,.v183-marker.warn .tag{background:#80600f}.v183-marker.early .bus,.v183-marker.early .tag{background:#176589}.v183-marker.stale .bus,.v183-marker.stale .tag,.v183-marker.lost .bus,.v183-marker.lost .tag{background:#505b63}.v183-popup{min-width:210px}.v183-popup b{font-size:14px}.v183-popup div{margin-top:5px;font-size:12px}.v183-popup .delta{font-size:18px;font-weight:1000}
      @media(max-width:820px){.v183-work{grid-template-columns:290px minmax(0,1fr)}.v183-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:640px){.v183-root{grid-template-rows:auto auto minmax(0,1fr)}.v183-top{padding:8px;align-items:flex-start}.v183-title span,.v183-live{display:none}.v183-actions button{font-size:.65rem}.v183-kpis{grid-template-columns:repeat(3,1fr);padding:6px}.v183-kpi{padding:6px}.v183-work{display:grid;grid-template-columns:1fr;grid-template-rows:42% 58%}.v183-side{border-right:0;border-bottom:1px solid #294454}.v183-map{min-height:260px}.v183-filter-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend',`
      <section id="v183Supervision" class="v183-root hidden" aria-label="Supervision exploitation temps réel">
        <header class="v183-top"><div class="v183-title"><b>🗺 Supervision réseau</b><span>Tous les véhicules actifs de votre société · Mon SAEIV ${VERSION}</span></div><div class="v183-actions"><span class="v183-live">TEMPS RÉEL</span><button id="v183Refresh" type="button">↻ Actualiser</button><button id="v183Fit" type="button">◎ Tout voir</button><button id="v183Close" type="button">Fermer</button></div></header>
        <div id="v183Kpis" class="v183-kpis"></div>
        <div class="v183-work">
          <aside class="v183-side"><div class="v183-filters"><div class="v183-filter-grid"><input id="v183Search" class="wide" type="search" placeholder="Ligne, destination, conducteur…"><select id="v183Line"><option value="">Toutes les lignes</option></select><select id="v183State"><option value="">Tous les états</option><option value="late">Retards importants</option><option value="warn">Retards</option><option value="early">Avances</option><option value="hlp">Haut-le-pied</option><option value="stale">GPS ancien</option></select></div><div id="v183Status" class="v183-statusline">Connexion au serveur…</div></div><div id="v183Vehicles" class="v183-list"></div></aside>
          <main class="v183-map-wrap"><div id="v183Map" class="v183-map"></div><div class="v183-map-note">Les positions proviennent du même flux que l’information voyageurs. Une donnée ancienne est signalée plutôt que présentée comme actuelle.</div></main>
        </div>
      </section>`);
    q('v183Close')?.addEventListener('click',close);
    q('v183Refresh')?.addEventListener('click',()=>refresh(true));
    q('v183Fit')?.addEventListener('click',fitAll);
    ['v183Search','v183Line','v183State'].forEach(id=>q(id)?.addEventListener(id==='v183Search'?'input':'change',render));
  }
  function addOpenButton(){
    const top=q('v157Dispatch')?.querySelector('.v157-top-actions');if(!top||q('v183Open')||!allowed())return;
    const b=document.createElement('button');b.id='v183Open';b.type='button';b.textContent='🗺 Supervision temps réel';b.addEventListener('click',open);top.prepend(b);
  }
  function ensureLeaflet(){
    if(window.L)return Promise.resolve(window.L);
    return new Promise((resolve,reject)=>{
      if(!document.querySelector('link[data-v183-leaflet]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';l.dataset.v183Leaflet='1';document.head.appendChild(l)}
      let s=document.querySelector('script[data-v183-leaflet]');if(!s){s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.dataset.v183Leaflet='1';document.head.appendChild(s)}
      const done=()=>window.L?resolve(window.L):reject(new Error('Leaflet indisponible'));if(window.L)return done();s.addEventListener('load',done,{once:true});s.addEventListener('error',()=>reject(new Error('Carte indisponible')),{once:true});
    });
  }
  async function initMap(){
    if(S.map)return S.map;const L=await ensureLeaflet();
    S.map=L.map('v183Map',{zoomControl:true,preferCanvas:true}).setView([48.9,6.2],8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(S.map);
    setTimeout(()=>S.map.invalidateSize(),80);return S.map;
  }
  async function open(){
    if(!allowed())return;installUi();S.open=true;q('v183Supervision')?.classList.remove('hidden');document.body.style.overflow='hidden';
    try{await initMap()}catch(e){q('v183Status').textContent=e.message||'Carte indisponible'}
    await refresh(true);clearInterval(S.timer);S.timer=setInterval(()=>{if(S.open&&!document.hidden)refresh(false)},5000);
  }
  function close(){S.open=false;q('v183Supervision')?.classList.add('hidden');document.body.style.overflow='';clearInterval(S.timer);S.timer=null}
  async function loadProfiles(){
    const c=cloud(),org=c?.profile?.organization_id;if(!c?.client||!org)return;
    const {data,error}=await c.client.from('profiles').select('user_id,display_name,matricule,role,active').eq('organization_id',org).eq('active',true);
    if(error)throw error;S.profiles=new Map((data||[]).map(x=>[String(x.user_id),x]));
  }
  async function refresh(force=false){
    if(S.busy||!S.open||!allowed())return;const c=cloud(),org=c?.profile?.organization_id;if(!c?.client||!org){q('v183Status').textContent='Compte exploitation non connecté.';return}
    S.busy=true;if(force)q('v183Status').textContent='Actualisation…';
    try{
      if(!S.profiles.size||force)await loadProfiles();
      const since=new Date(Date.now()-10*60*1000).toISOString();
      const {data,error}=await c.client.from('saeiv_live_courses').select('owner_id,organization_id,public_id,service_date,department,route_id,trip_id,line,destination,stage,latitude,longitude,accuracy_m,observed_at,delay_seconds,stop_index,start_index').eq('organization_id',org).gte('observed_at',since).order('observed_at',{ascending:false});
      if(error)throw error;S.rows=(data||[]).map(r=>({...r,driver:S.profiles.get(String(r.owner_id))||null}));S.lastRefresh=Date.now();syncLineFilter();render();
      q('v183Status').textContent=`Dernière actualisation ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · ${S.rows.length} véhicule${S.rows.length>1?'s':''}`;
    }catch(e){console.warn('[Supervision]',e);q('v183Status').textContent=`Supervision indisponible : ${e.message||e}`}
    finally{S.busy=false}
  }
  function syncLineFilter(){
    const el=q('v183Line');if(!el)return;const selected=el.value,lines=[...new Set(S.rows.map(r=>String(r.line||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
    el.innerHTML='<option value="">Toutes les lignes</option>'+lines.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(lines.includes(selected))el.value=selected;
  }
  function filtered(){
    const search=String(q('v183Search')?.value||'').trim().toLowerCase(),line=q('v183Line')?.value||'',wanted=q('v183State')?.value||'';
    return S.rows.filter(r=>{
      const st=stateOf(r),p=r.driver||{},hay=[r.line,r.destination,r.department,p.display_name,p.matricule].join(' ').toLowerCase();
      if(search&&!hay.includes(search))return false;if(line&&String(r.line)!==line)return false;
      if(wanted==='hlp'&&r.stage!=='hlp')return false;if(wanted==='stale'&&!['stale','lost'].includes(st.key))return false;if(['late','warn','early'].includes(wanted)&&st.key!==wanted)return false;return true;
    }).sort((a,b)=>stateOf(b).rank-stateOf(a).rank||Number(b.delay_seconds||0)-Number(a.delay_seconds||0));
  }
  function renderKpis(){
    const rows=S.rows,states=rows.map(stateOf),late=states.filter(s=>['late','warn'].includes(s.key)).length,early=states.filter(s=>s.key==='early').length,stale=states.filter(s=>['stale','lost'].includes(s.key)).length,hlp=rows.filter(r=>r.stage==='hlp').length,ok=states.filter(s=>s.key==='ok').length;
    const vals=[[rows.length,'Véhicules actifs'],[ok,'À l’heure'],[late,'En retard'],[early,'En avance'],[hlp,'Haut-le-pied'],[stale,'GPS ancien']];q('v183Kpis').innerHTML=vals.map(([n,l])=>`<div class="v183-kpi"><b>${n}</b><span>${l}</span></div>`).join('');
  }
  function driverLabel(r){const p=r.driver;return p?.display_name||p?.matricule?`${p.display_name||'Conducteur'}${p.matricule?` · ${p.matricule}`:''}`:'Conducteur connecté'}
  function renderList(rows){
    const box=q('v183Vehicles');if(!box)return;if(!rows.length){box.innerHTML='<div class="v183-empty">Aucun véhicule ne correspond aux filtres actuels.</div>';return}
    box.innerHTML=rows.map(r=>{const st=stateOf(r),age=Math.round(ageSeconds(r));return `<button class="v183-card ${st.key}" type="button" data-v183-id="${esc(r.owner_id)}"><div class="v183-card-head"><span class="v183-line">${esc(r.line||'—')}</span><span class="v183-delta">${esc(delayText(r.delay_seconds))}</span></div><strong>${esc(r.destination||'Destination non renseignée')}</strong><small>${esc(driverLabel(r))}</small><small>${esc(stageLabel(r.stage))} · position reçue il y a ${age<60?`${age} s`:`${Math.floor(age/60)} min`}</small><small class="v183-state">${esc(st.label)}</small></button>`}).join('');
    box.querySelectorAll('[data-v183-id]').forEach(b=>b.addEventListener('click',()=>focusVehicle(b.dataset.v183Id)));
  }
  function markerHtml(r,st){return `<div class="v183-marker ${st.key}"><span class="bus">🚌</span><span class="tag">${esc(r.line||'—')} · ${esc(delayText(r.delay_seconds))}</span></div>`}
  function renderMap(rows){
    if(!S.map||!window.L)return;const keep=new Set(rows.map(r=>String(r.owner_id)));
    for(const [id,m] of S.markers)if(!keep.has(id)){m.remove();S.markers.delete(id)}
    for(const r of rows){const id=String(r.owner_id),st=stateOf(r),lat=Number(r.latitude),lon=Number(r.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;let m=S.markers.get(id),icon=window.L.divIcon({className:'v183-bus-icon',html:markerHtml(r,st),iconSize:[150,36],iconAnchor:[18,18]});
      if(!m){m=window.L.marker([lat,lon],{icon,zIndexOffset:st.rank*10}).addTo(S.map);S.markers.set(id,m)}else{m.setLatLng([lat,lon]);m.setIcon(icon);m.setZIndexOffset(st.rank*10)}
      m.bindPopup(`<div class="v183-popup"><b>Ligne ${esc(r.line||'—')}</b><div>${esc(r.destination||'')}</div><div class="delta">${esc(delayText(r.delay_seconds))}</div><div>${esc(stageLabel(r.stage))}</div><div>${esc(driverLabel(r))}</div><div>${esc(st.label)}</div></div>`);
    }
    if(!S.fitOnce&&rows.length){S.fitOnce=true;fitAll()}
  }
  function render(){const rows=filtered();renderKpis();renderList(rows);renderMap(rows)}
  function focusVehicle(id){const m=S.markers.get(String(id));if(!m||!S.map)return;S.map.setView(m.getLatLng(),Math.max(S.map.getZoom(),14),{animate:true});m.openPopup()}
  function fitAll(){if(!S.map||!S.markers.size)return;const bounds=window.L.latLngBounds([...S.markers.values()].map(m=>m.getLatLng()));if(bounds.isValid())S.map.fitBounds(bounds.pad(.18),{maxZoom:14})}
  function watch(){installUi();let tries=0;const tick=()=>{addOpenButton();if(!q('v183Open')&&tries++<120)setTimeout(tick,250)};tick();document.addEventListener('visibilitychange',()=>{if(S.open&&document.visibilityState==='visible'){setTimeout(()=>S.map?.invalidateSize(),100);refresh(true)}})}
  window.MonSAEIVLiveSupervisionV183={installed:true,version:VERSION,open,close,refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();