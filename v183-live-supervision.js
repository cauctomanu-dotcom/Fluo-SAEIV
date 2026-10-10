'use strict';
/* Mon SAEIV 1.0.89 — supervision exploitation temps réel + simulation conducteurs test. */
(()=>{
  if(window.MonSAEIVLiveSupervisionV183?.installed)return;
  const VERSION='1.0.116',q=id=>document.getElementById(id);
  const S={open:false,map:null,markers:new Map(),rows:[],profiles:new Map(),timer:null,busy:false,fitOnce:false,routeIndexes:new Map(),routePayloads:new Map(),selected:null,sending:false};
  const cloud=()=>window.MonSAEIVCloudV156;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=()=>['dispatcher','admin'].includes(String(cloud()?.profile?.role||''));
  const isTestProfile=p=>/^TEST\d+$/i.test(String(p?.matricule||'').trim());
  const localIso=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const timeText=(d=new Date())=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  const timeMinute=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);return m?Number(m[1])*60+Number(m[2])+(Number(m[3]||0)/60):null};
  const validCoord=p=>!!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const age=r=>Math.max(0,(Date.now()-new Date(r.observed_at).getTime())/1000);
  const mins=s=>Math.max(1,Math.round(Math.abs(Number(s)||0)/60));
  function stageLabel(s){return s==='hlp'?'Haut-le-pied':s==='waiting'?'En attente départ':'En service'}
  function delayText(v){if(!Number.isFinite(Number(v)))return'Écart inconnu';const s=Number(v);if(Math.abs(s)<60)return'À l’heure';return s>0?`+${mins(s)} min`:`−${mins(s)} min`}
  function stateOf(r){const a=age(r),d=Number(r.delay_seconds);if(a>180)return{key:'lost',label:'GPS ancien',rank:100};if(a>60)return{key:'stale',label:'Position ancienne',rank:90};if(Number.isFinite(d)&&d>=600)return{key:'late',label:'Retard important',rank:80};if(Number.isFinite(d)&&d>=180)return{key:'warn',label:'Retard',rank:60};if(Number.isFinite(d)&&d<=-120)return{key:'early',label:'Avance',rank:45};return{key:'ok',label:'À l’heure',rank:10}}
  function installUi(){
    if(q('v183Supervision'))return;
    const style=document.createElement('style');style.id='v183SupervisionStyle';style.textContent=`
      #v183Open{white-space:nowrap}
      .v183-root{position:fixed;z-index:49000;inset:0;width:100%;height:100dvh;max-height:100dvh;overflow:hidden;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#061019;color:#f4f8fa;overscroll-behavior:none}
      .v183-root.hidden{display:none!important}
      .v183-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #294454;background:#0b1d28;flex-wrap:wrap}
      .v183-title{min-width:0;flex:1 1 260px}.v183-title b,.v183-title span{display:block}.v183-title b{font-size:1.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v183-title span{margin-top:2px;color:#91a9b5;font-size:.64rem}
      .v183-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.v183-actions button{min-height:38px;padding:7px 10px;white-space:nowrap}
      .v183-live{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid #2f6e49;border-radius:999px;background:#0c2b1a;color:#bfffd0;font-size:.62rem;font-weight:950}.v183-live:before{content:'';width:7px;height:7px;border-radius:50%;background:#55d981}
      .v183-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;padding:9px 12px;border-bottom:1px solid #253e4c;background:#081721}
      .v183-kpi{min-width:0;padding:8px 10px;border:1px solid #2d4859;border-radius:11px;background:#0d202c}.v183-kpi b,.v183-kpi span{display:block}.v183-kpi b{font-size:1.05rem}.v183-kpi span{margin-top:2px;color:#8fa6b2;font-size:.54rem;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v183-mobile-tabs{display:none}
      .v183-work{min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(310px,350px) minmax(0,1fr)}
      .v183-side{min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);border-right:1px solid #294454;background:#091923}
      .v183-filters{padding:10px;border-bottom:1px solid #294454}.v183-filter-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}.v183-filter-grid .wide{grid-column:1/-1}
      .v183-filters input,.v183-filters select{width:100%;min-width:0;min-height:39px;padding:7px 8px}.v183-statusline{margin-top:7px;color:#90a7b2;font-size:.59rem;white-space:normal;line-height:1.35}
      .v183-list{min-width:0;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px;display:grid;align-content:start;gap:7px}
      .v183-card{width:100%;min-width:0;padding:10px;border:1px solid #304d5d;border-radius:12px;background:#0b202b;color:#f4f8fa;text-align:left;overflow:hidden}.v183-card.simulated{box-shadow:inset 3px 0 #8d6de8}.v183-card.late{border-color:#a24d50;background:#35191b}.v183-card.warn{border-color:#a67b22;background:#30260d}.v183-card.early{border-color:#377a99;background:#102a38}.v183-card.stale,.v183-card.lost{border-color:#596772;background:#20272c}
      .v183-card-head{display:flex;justify-content:space-between;align-items:center;gap:8px;min-width:0}.v183-line{display:inline-flex;min-width:46px;justify-content:center;padding:4px 7px;border-radius:7px;background:#ffd000;color:#121212;font-size:.72rem;font-weight:1000}.v183-delta{min-width:0;font-size:.82rem;font-weight:1000;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v183-card strong,.v183-card small{display:block;overflow:hidden;text-overflow:ellipsis}.v183-card strong{margin-top:7px;font-size:.72rem;white-space:nowrap}.v183-card small{margin-top:3px;color:#9eb3bd;font-size:.56rem;white-space:nowrap}.v183-card .v183-state{margin-top:7px;color:#d8e7ed;font-weight:850}.v183-empty{padding:22px 12px;color:#91a8b3;text-align:center;font-size:.68rem}
      .v183-map-wrap{position:relative;min-width:0;min-height:0;overflow:hidden;background:#0b1c26}.v183-map{width:100%;height:100%;min-height:360px}
      .v183-map-note{position:absolute;z-index:900;left:12px;bottom:12px;max-width:min(440px,calc(100% - 24px));padding:8px 10px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(5,16,24,.9);color:#c6d7de;font-size:.58rem;line-height:1.35}
      .v183-bus-icon{background:transparent!important;border:0!important}.v183-marker{display:grid;place-items:center;width:32px;height:32px;border:2px solid #fff;border-radius:50%;background:#173747;box-shadow:0 2px 9px rgba(0,0,0,.55);font-size:18px;line-height:1}.v183-marker.late{background:#8f3035}.v183-marker.warn{background:#80600f}.v183-marker.early{background:#176589}.v183-marker.stale,.v183-marker.lost{background:#505b63}.v183-marker.simulated{outline:2px dashed #c6b8ff;outline-offset:2px}.v183-sim-badge{display:inline-flex;margin-left:6px;padding:2px 5px;border:1px solid #7257bf;border-radius:999px;background:#251a46;color:#dcd1ff;font-size:.48rem;font-weight:950;vertical-align:middle}.v183-popup{min-width:210px}.v183-popup b{font-size:14px}.v183-popup div{margin-top:5px;font-size:12px}.v183-popup .delta{font-size:18px;font-weight:1000}
      /* Calm shared supervision for dispatchers on phone and desktop. */
      .v183-root{background:#f4f6f8;color:#243d4d}
      .v183-top{background:#fff;color:#243d4d;border-color:#d8e2e8}
      .v183-title span,.v183-statusline{color:#587181;font-size:.8rem}
      .v183-kpis,.v183-side,.v183-filters,.v183-mobile-tabs{background:#f1f5f7;border-color:#d7e1e7}
      .v183-kpi{background:#fff;border-color:#d7e1e7;color:#244154}
      .v183-kpi span{color:#577184;font-size:.69rem}
      .v183-card{background:#fff;color:#243e51;border-color:#d5e1e8;box-shadow:none}
      .v183-card strong{font-size:.97rem;color:#1e3a4e;white-space:normal}
      .v183-card small{font-size:.77rem;color:#566e7c;white-space:normal;line-height:1.45}
      .v183-card .v183-state{color:#3c5c71;font-size:.79rem}
      .v183-card.late,.v183-card.warn,.v183-card.early,.v183-card.stale,.v183-card.lost{background:#fff;border-left-width:5px}
      .v183-card.late{border-left-color:#c16a66}.v183-card.warn{border-left-color:#baa26a}.v183-card.early{border-left-color:#6b97b0}.v183-card.stale,.v183-card.lost{border-left-color:#a4adb4}
      .v183-line{background:#e6eef3;color:#274c63;font-size:.9rem}
      .v183-delta{font-size:.94rem;color:#28475a}
      .v183-mobile-tabs button{min-height:46px;background:#fff;color:#315269;border-color:#d1dee6;font-size:.96rem}
      .v183-mobile-tabs button.active{background:#315f78;color:#fff;border-color:#315f78}
      .v183-list{gap:10px;padding:12px}
      .v183-actions button,.v183-filters input,.v183-filters select{min-height:44px;font-size:.88rem}
      #v183VehiclePanel{position:fixed;inset:0;z-index:49001;display:grid;place-items:center;padding:16px;background:rgba(20,38,50,.58)}
      #v183VehiclePanel[hidden]{display:none!important}
      #v183VehiclePanel .v183-sheet{background:#fff;color:#243d4d;width:min(560px,100%);max-height:92dvh;overflow:auto;border-radius:16px;padding:20px;box-shadow:0 22px 65px #06152244}
      #v183VehiclePanel h2{margin:0 0 6px;font-size:1.4rem;color:#24485f}
      #v183VehiclePanel p{font-size:.9rem;color:#516a7a;line-height:1.5}
      #v183VehiclePanel label{display:block;margin:14px 0 5px;font-weight:750}
      #v183VehiclePanel textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;min-height:110px;background:#fff;color:#223d4f;border:1px solid #acbfcb;border-radius:10px;font:400 16px/1.5 system-ui;padding:11px}
      #v183VehiclePanel .v183-panel-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:13px}
      #v183VehiclePanel button{min-height:44px;border-radius:9px;padding:9px 13px;border:1px solid #c1d2dc;background:#eaf0f3;color:#29495f;font-size:.92rem;font-weight:750}
      #v183VehiclePanel #v183SendMessage{background:#315f78;color:#fff;border-color:#315f78}
      #v183VehiclePanel .v183-panel-status{min-height:1.6em;font-size:.9rem;color:#4f6675}
      @media(max-width:1000px){
        .v183-work{grid-template-columns:minmax(280px,34vw) minmax(0,1fr)}
        .v183-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
      @media(max-width:700px){
        .v183-root{font-size:14px}
        .v183-title b{font-size:1.05rem}
        .v183-mobile-tabs{gap:9px;padding:10px}
        .v183-actions button{font-size:.85rem}
        .v183-list{padding:12px}
        .v183-card{padding:14px}
        .v183-card strong{font-size:1.02rem}
        .v183-card small{font-size:.8rem}
        #v183VehiclePanel{padding:0;align-items:end}
        #v183VehiclePanel .v183-sheet{border-radius:16px 16px 0 0;max-height:95dvh;padding:18px}
      
        .v183-root{grid-template-rows:auto auto auto minmax(0,1fr);padding-bottom:env(safe-area-inset-bottom)}
        .v183-top{padding:calc(8px + env(safe-area-inset-top)) 10px 8px;gap:8px;align-items:stretch}
        .v183-title{flex-basis:100%}.v183-title b{font-size:1rem}.v183-title span{display:none}
        .v183-actions{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.v183-actions .v183-live{display:none}.v183-actions button{width:100%;min-width:0;min-height:40px;padding:6px 5px;font-size:.67rem;overflow:hidden;text-overflow:ellipsis}
        .v183-kpis{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;padding:6px 8px;-webkit-overflow-scrolling:touch}.v183-kpis::-webkit-scrollbar{display:none}
        .v183-kpi{flex:0 0 102px;scroll-snap-align:start;padding:6px 8px}.v183-kpi b{font-size:.94rem}.v183-kpi span{font-size:.49rem}
        .v183-mobile-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px 8px;border-bottom:1px solid #294454;background:#091923}.v183-mobile-tabs button{min-height:40px;border-radius:10px;background:#102633;color:#c9dce5;border:1px solid #304d5d;font-weight:850}.v183-mobile-tabs button.active{background:#17445a;border-color:#4e9dc3;color:#fff}
        .v183-work{display:block;position:relative;height:100%;min-height:0}
        .v183-side,.v183-map-wrap{position:absolute;inset:0;width:100%;height:100%;min-height:0;border:0}
        .v183-root[data-mobile-view="map"] .v183-side{display:none}.v183-root[data-mobile-view="list"] .v183-map-wrap{display:none}
        .v183-side{display:grid;grid-template-rows:auto minmax(0,1fr);border-bottom:0}.v183-map{height:100%;min-height:0}
        .v183-filters{padding:8px}.v183-filter-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}.v183-filters input,.v183-filters select{min-height:40px;font-size:16px}
        .v183-statusline{font-size:.58rem}.v183-list{padding:7px 8px calc(10px + env(safe-area-inset-bottom))}
        .v183-card{padding:10px 11px}.v183-card strong{font-size:.76rem}.v183-card small{font-size:.6rem}
        .v183-map-note{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));max-width:none;font-size:.55rem}
        .leaflet-control-zoom{margin-top:8px!important;margin-left:8px!important}
      }
      @media(max-width:390px){
        .v183-actions button{font-size:.61rem}.v183-kpi{flex-basis:94px}.v183-filter-grid{grid-template-columns:1fr}.v183-filter-grid .wide{grid-column:auto}
      }
      @media(orientation:landscape) and (max-height:520px) and (max-width:900px){
        .v183-root{grid-template-rows:auto auto minmax(0,1fr)}.v183-kpis{display:none}.v183-mobile-tabs{padding:4px 8px}.v183-mobile-tabs button{min-height:34px}.v183-top{padding:6px 8px}.v183-title{display:none}.v183-actions{grid-template-columns:repeat(3,1fr)}
      }
    `;document.head.appendChild(style);
    const soft=document.createElement('style');soft.id='v183CalmSharedOverrides';soft.textContent=[
      '#v183Supervision .v183-mobile-tabs{background:#eef3f6;border-color:#d5e1e7}',
      '#v183Supervision .v183-mobile-tabs button{background:#fff;color:#315268;border:1px solid #ccdbe4;font-size:.92rem;min-height:45px}',
      '#v183Supervision .v183-mobile-tabs button.active{background:#315f78;color:#fff;border-color:#315f78}',
      '#v183Supervision .v183-card{background:#fff;color:#263f50;border:1px solid #d5e1e8}',
      '#v183Supervision .v183-card strong{font-size:.98rem;color:#223c4d;white-space:normal}',
      '#v183Supervision .v183-card small{font-size:.78rem;color:#57707e;white-space:normal}',
      '#v183Supervision .v183-filters{background:#f1f5f7}',
      '#v183Supervision .v183-kpi{background:#fff;color:#263f50}',
      '@media(max-width:700px){#v183Supervision .v183-actions button{font-size:.83rem!important}#v183Supervision .v183-card{padding:14px}#v183Supervision .v183-list{padding:11px}}'
    ].join('\n');document.head.append(soft);
    document.body.insertAdjacentHTML('beforeend',`<section id="v183Supervision" class="v183-root hidden"><header class="v183-top"><div class="v183-title"><b>🗺 Supervision réseau</b><span>Tous les véhicules actifs de votre société · Mon SAEIV ${VERSION}</span></div><div class="v183-actions"><span class="v183-live">TEMPS RÉEL</span><button id="v183Refresh">↻ Actualiser</button><button id="v183Fit">◎ Tout voir</button><button id="v183Close">Fermer</button></div></header><div id="v183Kpis" class="v183-kpis"></div><nav class="v183-mobile-tabs" aria-label="Vue supervision"><button id="v183MobileMap" class="active" type="button">🗺 Carte</button><button id="v183MobileList" type="button">🚌 Véhicules <span id="v183MobileCount"></span></button></nav><div class="v183-work"><aside class="v183-side"><div class="v183-filters"><div class="v183-filter-grid"><input id="v183Search" class="wide" type="search" placeholder="Ligne, destination, conducteur…"><select id="v183Line"><option value="">Toutes les lignes</option></select><select id="v183State"><option value="">Tous les états</option><option value="late">Retards importants</option><option value="warn">Retards</option><option value="early">Avances</option><option value="hlp">Haut-le-pied</option><option value="stale">GPS ancien</option></select></div><div id="v183Status" class="v183-statusline">Connexion au serveur…</div></div><div id="v183Vehicles" class="v183-list"></div></aside><main class="v183-map-wrap"><div id="v183Map" class="v183-map"></div><div class="v183-map-note">Le 🚌 est centré exactement sur la position partagée. En service normal, cette position est recalée sur le tracé routier ; en déviation/recalcul, elle suit la position GPS réelle.</div></main></div></section>`);
    document.body.insertAdjacentHTML('beforeend','<section id="v183VehiclePanel" hidden role="dialog" aria-modal="true" aria-label="Détails du véhicule"><div class="v183-sheet"><h2 id="v183VehicleTitle">Véhicule</h2><p id="v183VehicleMeta"></p><label for="v183DirectText">Message au conducteur</label><textarea id="v183DirectText" maxlength="800" placeholder="Consigne courte et claire. À consulter uniquement à l’arrêt."></textarea><p>Le message est envoyé uniquement au conducteur de ce véhicule, dans votre entreprise. Aucun changement de planning n’est déclenché.</p><div class="v183-panel-actions"><button type="button" id="v183SendMessage">Envoyer le message</button><button type="button" id="v183ShowPosition">Voir la position</button><button type="button" id="v183VehicleClose">Fermer</button></div><p class="v183-panel-status" id="v183VehicleStatus" role="status"></p></div></section>');
    q('v183VehicleClose').addEventListener('click',closeVehicle);
    q('v183VehiclePanel').addEventListener('click',e=>{if(e.target===q('v183VehiclePanel'))closeVehicle()});
    q('v183SendMessage').addEventListener('click',()=>sendDirectMessage().catch(e=>vehicleStatus(e.message||String(e),true)));
    q('v183ShowPosition').addEventListener('click',()=>{const id=S.selected?.owner_id;closeVehicle();if(id)focusVehicle(id)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!q('v183VehiclePanel')?.hidden)closeVehicle()});
    q('v183Close')?.addEventListener('click',close);q('v183Refresh')?.addEventListener('click',()=>refresh(true));q('v183Fit')?.addEventListener('click',()=>{setMobileView('map');setTimeout(fitAll,50)});q('v183MobileMap')?.addEventListener('click',()=>setMobileView('map'));q('v183MobileList')?.addEventListener('click',()=>setMobileView('list'));['v183Search','v183Line','v183State'].forEach(id=>q(id)?.addEventListener(id==='v183Search'?'input':'change',render));
  }
  function addOpenButton(){const top=q('v157Dispatch')?.querySelector('.v157-top-actions');if(!top||q('v183Open')||!allowed())return;const b=document.createElement('button');b.id='v183Open';b.type='button';b.textContent='🗺 Supervision temps réel';b.addEventListener('click',open);top.prepend(b)}
  function ensureLeaflet(){if(window.L)return Promise.resolve(window.L);return new Promise((resolve,reject)=>{if(!document.querySelector('link[data-v183-leaflet]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';l.dataset.v183Leaflet='1';document.head.appendChild(l)}let s=document.querySelector('script[data-v183-leaflet]');if(!s){s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.dataset.v183Leaflet='1';document.head.appendChild(s)}const done=()=>window.L?resolve(window.L):reject(new Error('Leaflet indisponible'));if(window.L)return done();s.addEventListener('load',done,{once:true});s.addEventListener('error',()=>reject(new Error('Carte indisponible')),{once:true})})}
  function isMobileLayout(){return !!window.matchMedia?.('(max-width:700px)').matches}
  function setMobileView(view='map'){
    const root=q('v183Supervision');if(!root)return;const next=view==='list'?'list':'map';root.dataset.mobileView=next;
    q('v183MobileMap')?.classList.toggle('active',next==='map');q('v183MobileList')?.classList.toggle('active',next==='list');
    if(next==='map')setTimeout(()=>{try{S.map?.invalidateSize()}catch{}},60);
  }
  function shapePoint(shape,ratio){
    const pts=(Array.isArray(shape)?shape:[]).filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])));
    if(!pts.length)return null;if(pts.length===1)return{lat:Number(pts[0][0]),lon:Number(pts[0][1])};
    const r=Math.max(0,Math.min(1,Number(ratio)||0)),lens=[],rad=Math.PI/180;
    let total=0;
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],lat=(Number(a[0])+Number(b[0]))/2*rad,dx=(Number(b[1])-Number(a[1]))*Math.cos(lat),dy=Number(b[0])-Number(a[0]),len=Math.hypot(dx,dy);lens.push(len);total+=len}
    if(total<=0)return{lat:Number(pts[0][0]),lon:Number(pts[0][1])};
    let target=total*r,walk=0;
    for(let i=0;i<lens.length;i++){const len=lens[i];if(walk+len>=target||i===lens.length-1){const f=len>0?(target-walk)/len:0,a=pts[i],b=pts[i+1];return{lat:Number(a[0])+(Number(b[0])-Number(a[0]))*f,lon:Number(a[1])+(Number(b[1])-Number(a[1]))*f}}walk+=len}
    return{lat:Number(pts.at(-1)[0]),lon:Number(pts.at(-1)[1])}
  }
  function linearPoint(a,b,ratio){
    if(!validCoord(a)||!validCoord(b))return validCoord(a)?{lat:Number(a.lat),lon:Number(a.lon)}:validCoord(b)?{lat:Number(b.lat),lon:Number(b.lon)}:null;
    const r=Math.max(0,Math.min(1,Number(ratio)||0));return{lat:Number(a.lat)+(Number(b.lat)-Number(a.lat))*r,lon:Number(a.lon)+(Number(b.lon)-Number(a.lon))*r}
  }
  async function routeShape(item){
    const linked=item?.linked||{},dept=String(linked.dept||item?.payload?.dept||'').replace(/\D/g,'').slice(0,2),routeId=String(linked.routeId||'');
    if(!dept||!routeId)return null;
    let index=S.routeIndexes.get(dept);
    if(!index){
      try{const r=await fetch(new URL(`./data/${dept}/routes.json?v=${VERSION}`,document.baseURI),{cache:'no-store'});if(!r.ok)return null;index=await r.json();S.routeIndexes.set(dept,index)}catch{return null}
    }
    const route=(index?.routes||[]).find(x=>String(x.id)===routeId)||null;if(!route?.file)return null;
    const key=`${dept}|${route.file}`;let payload=S.routePayloads.get(key);
    if(!payload){
      try{const r=await fetch(new URL(`./data/${dept}/${route.file}?v=${VERSION}`,document.baseURI),{cache:'no-store'});if(!r.ok)return null;payload=await r.json();S.routePayloads.set(key,payload)}catch{return null}
    }
    const patterns=payload?.patterns||[],pi=Number(linked.patternIndex),shapeId=String(linked.patternShapeId||''),tripId=String(linked.tripId||'');
    let pattern=Number.isInteger(pi)?patterns[pi]:null;
    if(shapeId&&String(pattern?.shape_id||'')!==shapeId)pattern=patterns.find(p=>String(p?.shape_id||'')===shapeId)||pattern;
    if(tripId&&!pattern?.trips?.some?.(x=>String(x?.id||'')===tripId))pattern=patterns.find(p=>(p?.trips||[]).some(x=>String(x?.id||'')===tripId))||pattern;
    return Array.isArray(pattern?.shape)&&pattern.shape.length>1?pattern.shape:null
  }
  async function simulatedRows(org){
    const c=cloud(),tests=[...S.profiles.values()].filter(p=>p?.role==='driver'&&p?.active!==false&&isTestProfile(p));if(!c?.client||!org||!tests.length)return[];
    const now=new Date(),date=localIso(now),clock=timeText(now),nowMinute=timeMinute(clock),testIds=new Set(tests.map(x=>String(x.user_id)));
    const{data,error}=await c.client.from('plan_items').select('id,driver_user_id,service_date,type,line,start_time,end_time,origin,destination,origin_coords,destination_coords,linked,payload,source').eq('organization_id',org).eq('service_date',date).in('type',['regular','school','tad','hlp']).lte('start_time',clock).gte('end_time',clock).order('start_time',{ascending:false});
    if(error)throw error;
    const chosen=new Map();
    for(const item of data||[]){const id=String(item.driver_user_id);if(!testIds.has(id))continue;const old=chosen.get(id),priority=item.type==='hlp'?1:2,oldPriority=old?.type==='hlp'?1:2;if(!old||priority>oldPriority)chosen.set(id,item)}
    const out=[];
    for(const item of chosen.values()){
      const driver=S.profiles.get(String(item.driver_user_id))||null,start=timeMinute(item.start_time),end=timeMinute(item.end_time);if(start===null||end===null)continue;let e=end;if(e<start)e+=1440;let n=nowMinute;if(n<start&&e>1440)n+=1440;const ratio=e>start?Math.max(0,Math.min(1,(n-start)/(e-start))):0;
      const shape=item.type==='hlp'?null:await routeShape(item),point=shapePoint(shape,ratio)||linearPoint(item.origin_coords,item.destination_coords,ratio);if(!point)continue;
      const linked=item.linked||{};
      out.push({owner_id:String(item.driver_user_id),organization_id:org,public_id:`sim-${item.id}`,service_date:date,department:String(linked.dept||item.payload?.dept||''),route_id:String(linked.routeId||''),trip_id:String(linked.tripId||''),line:item.line||'',destination:item.destination||'',stage:item.type==='hlp'?'hlp':'service',latitude:point.lat,longitude:point.lon,accuracy_m:0,observed_at:now.toISOString(),delay_seconds:0,stop_index:null,start_index:Number(linked.startStopIndex)||0,driver,simulated:true,simulation_progress:ratio});
    }
    return out
  }
  async function initMap(){if(S.map)return S.map;const L=await ensureLeaflet();S.map=L.map('v183Map',{zoomControl:true,preferCanvas:true}).setView([48.9,6.2],8);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(S.map);setTimeout(()=>S.map.invalidateSize(),80);return S.map}
  async function open(){if(!allowed())return;installUi();S.open=true;const root=q('v183Supervision');root?.classList.remove('hidden');document.body.style.overflow='hidden';setMobileView(isMobileLayout()?'list':'map');try{await initMap()}catch(e){q('v183Status').textContent=e.message||'Carte indisponible'}setTimeout(()=>S.map?.invalidateSize(),80);await refresh(true);clearInterval(S.timer);S.timer=setInterval(()=>{if(S.open&&!document.hidden)refresh(false)},5000)}
  function close(){closeVehicle();S.open=false;q('v183Supervision')?.classList.add('hidden');document.body.style.overflow='';clearInterval(S.timer);S.timer=null}
  async function loadProfiles(){const c=cloud(),org=c?.profile?.organization_id;if(!c?.client||!org)return;const{data,error}=await c.client.from('profiles').select('user_id,display_name,matricule,role,active').eq('organization_id',org).eq('active',true);if(error)throw error;S.profiles=new Map((data||[]).map(x=>[String(x.user_id),x]))}
  async function refresh(force=false){if(S.busy||!S.open||!allowed())return;const c=cloud(),org=c?.profile?.organization_id;if(!c?.client||!org){q('v183Status').textContent='Compte exploitation non connecté.';return}S.busy=true;if(force)q('v183Status').textContent='Actualisation…';try{if(!S.profiles.size||force)await loadProfiles();const since=new Date(Date.now()-10*60*1000).toISOString();const[{data,error},simulated]=await Promise.all([c.client.from('saeiv_live_courses').select('owner_id,organization_id,public_id,service_date,department,route_id,trip_id,line,destination,stage,latitude,longitude,accuracy_m,observed_at,delay_seconds,stop_index,start_index').eq('organization_id',org).gte('observed_at',since).order('observed_at',{ascending:false}),simulatedRows(org)]);if(error)throw error;const live=(data||[]).map(r=>({...r,driver:S.profiles.get(String(r.owner_id))||null})),liveOwners=new Set(live.map(r=>String(r.owner_id))),sims=(simulated||[]).filter(r=>!liveOwners.has(String(r.owner_id)));S.rows=[...live,...sims];syncLineFilter();render();q('v183Status').textContent=`Actualisé ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · ${S.rows.length} véhicule${S.rows.length>1?'s':''}${sims.length?` · ${sims.length} simulation${sims.length>1?'s':''} TEST`:''}`}catch(e){console.warn('[Supervision]',e);q('v183Status').textContent=`Supervision indisponible : ${e.message||e}`}finally{S.busy=false}}
  function syncLineFilter(){const el=q('v183Line');if(!el)return;const selected=el.value,lines=[...new Set(S.rows.map(r=>String(r.line||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));el.innerHTML='<option value="">Toutes les lignes</option>'+lines.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(lines.includes(selected))el.value=selected}
  function filtered(){const search=String(q('v183Search')?.value||'').trim().toLowerCase(),line=q('v183Line')?.value||'',wanted=q('v183State')?.value||'';return S.rows.filter(r=>{const st=stateOf(r),p=r.driver||{},hay=[r.line,r.destination,r.department,p.display_name,p.matricule].join(' ').toLowerCase();if(search&&!hay.includes(search))return false;if(line&&String(r.line)!==line)return false;if(wanted==='hlp'&&r.stage!=='hlp')return false;if(wanted==='stale'&&!['stale','lost'].includes(st.key))return false;if(['late','warn','early'].includes(wanted)&&st.key!==wanted)return false;return true}).sort((a,b)=>stateOf(b).rank-stateOf(a).rank||Number(b.delay_seconds||0)-Number(a.delay_seconds||0))}
  function renderKpis(){const rows=S.rows,states=rows.map(stateOf),late=states.filter(s=>['late','warn'].includes(s.key)).length,early=states.filter(s=>s.key==='early').length,stale=states.filter(s=>['stale','lost'].includes(s.key)).length,hlp=rows.filter(r=>r.stage==='hlp').length,ok=states.filter(s=>s.key==='ok').length;q('v183Kpis').innerHTML=[[rows.length,'Véhicules actifs'],[ok,'À l’heure'],[late,'En retard'],[early,'En avance'],[hlp,'Haut-le-pied'],[stale,'GPS ancien']].map(([n,l])=>`<div class="v183-kpi"><b>${n}</b><span>${l}</span></div>`).join('')}
  function driverLabel(r){const p=r.driver;return p?.display_name||p?.matricule?`${p.display_name||'Conducteur'}${p.matricule?` · ${p.matricule}`:''}`:'Conducteur connecté'}
  function renderList(rows){const box=q('v183Vehicles'),count=q('v183MobileCount');if(count)count.textContent=rows.length?`(${rows.length})`:'';if(!box)return;if(!rows.length){box.innerHTML='<div class="v183-empty">Aucun véhicule ne correspond aux filtres.</div>';return}box.innerHTML=rows.map(r=>{const st=stateOf(r),a=Math.round(age(r));return`<button class="v183-card ${st.key} ${r.simulated?'simulated':''}" data-v183-id="${esc(r.owner_id)}"><div class="v183-card-head"><span class="v183-line">${esc(r.line||'—')}</span><span class="v183-delta">${esc(delayText(r.delay_seconds))}</span></div><strong>${esc(r.destination||'Destination non renseignée')}${r.simulated?'<span class="v183-sim-badge">SIMULATION</span>':''}</strong><small>${esc(driverLabel(r))}</small><small>${r.simulated?`🧪 Planning simulé · ${Math.round(Number(r.simulation_progress||0)*100)} % de la course`:`${esc(stageLabel(r.stage))} · position il y a ${a<60?`${a} s`:`${Math.floor(a/60)} min`}`}</small><small class="v183-state">${r.simulated?'Simulation à l’heure':esc(st.label)}</small></button>`}).join('');box.querySelectorAll('[data-v183-id]').forEach(b=>b.addEventListener('click',()=>openVehicle(b.dataset.v183Id)))}
  function vehicleStatus(message,problem=false){const el=q('v183VehicleStatus');if(el){el.textContent=message;el.style.color=problem?'#a33339':'#3f6254'}}
  function closeVehicle(){if(q('v183VehiclePanel'))q('v183VehiclePanel').hidden=true;S.selected=null}
  function openVehicle(id){
    const current=S.rows.find(r=>String(r.owner_id)===String(id));
    if(!current||!allowed())return;
    const p=S.profiles.get(String(current.owner_id));
    if(!p||p.role!=='driver'||p.active===false||String(current.organization_id)!==String(cloud()?.profile?.organization_id))return;
    S.selected=current;
    q('v183VehicleTitle').textContent='Ligne '+(current.line||'—')+' · '+(p.display_name||p.matricule||'Conducteur');
    q('v183VehicleMeta').textContent=(current.simulated?'Simulation · ':'GPS · ')+stageLabel(current.stage)+' · '+delayText(current.delay_seconds)+' · '+(current.destination||'Destination non renseignée');
    q('v183DirectText').value='';
    q('v183VehiclePanel').hidden=false;
    vehicleStatus('Rédige une consigne courte. Le conducteur pourra la lire à un moment sûr.');
    q('v183DirectText').focus();
  }
  async function sendDirectMessage(){
    if(S.sending)return;
    const row=S.selected,c=cloud(),body=String(q('v183DirectText')?.value||'').trim();
    if(!row||!c?.client||!c.profile?.organization_id||!allowed())throw Error('Aucun véhicule de votre société sélectionné.');
    if(!body||body.length>800)throw Error('Rédige un message de 1 à 800 caractères.');
    const recipient=S.profiles.get(String(row.owner_id));
    if(!recipient||recipient.role!=='driver'||recipient.active===false||String(row.organization_id)!==String(c.profile.organization_id))
      throw Error('Le conducteur ne fait pas partie de votre entreprise.');
    S.sending=true;q('v183SendMessage').disabled=true;vehicleStatus('Envoi du message…');
    try{
      const note={organization_id:c.profile.organization_id,recipient_user_id:row.owner_id,kind:'dispatch_direct',
        title:'Message de l’exploitation · Ligne '+String(row.line||'—').slice(0,40),message:body,
        payload:{department:row.department||null,line:row.line||null,trip_id:row.trip_id||null,service_date:row.service_date||null,source:'live_supervision',simulation:Boolean(row.simulated)}};
      const {error}=await c.client.from('saeiv_notifications').insert(note);
      if(error)throw error;
      vehicleStatus('Message transmis au compte du conducteur. Réception en direct si son SAEIV est ouvert et connecté.');
      q('v183DirectText').value='';
    }finally{S.sending=false;q('v183SendMessage').disabled=false}
  }
  function markerHtml(st,r){return`<div class="v183-marker ${st.key} ${r?.simulated?'simulated':''}" aria-label="Bus">🚌</div>`}
  function renderMap(rows){if(!S.map||!window.L)return;const keep=new Set(rows.map(r=>String(r.owner_id)));for(const[id,m]of S.markers)if(!keep.has(id)){m.remove();S.markers.delete(id)}for(const r of rows){const id=String(r.owner_id),st=stateOf(r),lat=Number(r.latitude),lon=Number(r.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;const icon=L.divIcon({className:'v183-bus-icon',html:markerHtml(st,r),iconSize:[32,32],iconAnchor:[16,16],popupAnchor:[0,-18]});let m=S.markers.get(id);if(!m){m=L.marker([lat,lon],{icon,zIndexOffset:st.rank*10}).addTo(S.map);S.markers.set(id,m)}else{m.setLatLng([lat,lon]);m.setIcon(icon);m.setZIndexOffset(st.rank*10)}m.bindTooltip(`${r.simulated?'🧪':'🚌'} ${r.line||'—'} · ${r.simulated?'simulation':delayText(r.delay_seconds)}`,{direction:'top',offset:[0,-14],opacity:.92});m.bindPopup(`<div class="v183-popup"><b>Ligne ${esc(r.line||'—')}${r.simulated?' · SIMULATION':''}</b><div>${esc(r.destination||'')}</div><div class="delta">${esc(r.simulated?'À l’heure simulée':delayText(r.delay_seconds))}</div><div>${esc(stageLabel(r.stage))}</div><div>${esc(driverLabel(r))}</div><div>${esc(r.simulated?'Position calculée depuis le planning':st.label)}</div></div>`)}if(!S.fitOnce&&rows.length){S.fitOnce=true;fitAll()}}
  function render(){const rows=filtered();renderKpis();renderList(rows);renderMap(rows)}
  function focusVehicle(id){const m=S.markers.get(String(id));if(!m||!S.map)return;const go=()=>{try{S.map.invalidateSize();S.map.setView(m.getLatLng(),Math.max(S.map.getZoom(),15),{animate:true});m.openPopup()}catch{}};if(isMobileLayout()){setMobileView('map');setTimeout(go,70)}else go()}
  function fitAll(){if(!S.map||!S.markers.size)return;const b=L.latLngBounds([...S.markers.values()].map(m=>m.getLatLng()));if(b.isValid())S.map.fitBounds(b.pad(.18),{maxZoom:14})}
  function watch(){installUi();let n=0;const tick=()=>{addOpenButton();if(!q('v183Open')&&n++<160)setTimeout(tick,250)};tick();document.addEventListener('visibilitychange',()=>{if(S.open&&!document.hidden){setTimeout(()=>S.map?.invalidateSize(),80);refresh(true)}});const resize=()=>{if(!S.open)return;if(!isMobileLayout())q('v183Supervision')?.removeAttribute('data-mobile-view');else if(!q('v183Supervision')?.dataset.mobileView)setMobileView('list');setTimeout(()=>S.map?.invalidateSize(),100)};window.addEventListener('resize',resize,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(resize,120),{passive:true})}
  window.MonSAEIVLiveSupervisionV183={installed:true,version:VERSION,open,close,refresh,openVehicle};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();
