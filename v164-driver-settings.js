'use strict';
/* Mon SAEIV 1.0.66 — réglage Conducteur « Stationnement bus ».
   Le dépôt société reste une notion séparée ; chaque conducteur renseigne l'endroit réel où son bus est stationné. */
(()=>{
  if(window.MonSAEIVDriverSettingsV164?.installed)return;
  const VERSION='1.0.66';
  const LOCAL_KEY='fluo-saeiv-bus-parking-v164';
  const SAVED_ADDRESSES='fluo-saeiv-saved-addresses-v318';
  const q=id=>document.getElementById(id);
  const S={parking:null,installed:false,prompted:false};
  const cloud=()=>window.MonSAEIVCloudV156;
  const ready=()=>cloud()?.client&&cloud()?.user&&cloud()?.profile?.role==='driver'?cloud():null;
  function local(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch{return null}}
  function saveLocal(p){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(p||{}))}catch{}S.parking=p||null;syncSavedAddress(p)}
  function syncSavedAddress(p){
    try{
      let xs=JSON.parse(localStorage.getItem(SAVED_ADDRESSES)||'[]');if(!Array.isArray(xs))xs=[];xs=xs.filter(a=>String(a?.id)!=='bus-parking-v164');
      if(p?.address&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)))xs.push({id:'bus-parking-v164',label:'Stationnement bus',address:p.address,name:p.address,lat:Number(p.lat),lon:Number(p.lon),updatedAt:new Date().toISOString()});
      localStorage.setItem(SAVED_ADDRESSES,JSON.stringify(xs));
    }catch{}
  }
  function status(text,kind=''){const e=q('v164ParkingStatus');if(e){e.textContent=text||'';e.className=`v164-status ${kind}`}}
  async function geocode(text){
    const s=String(text||'').trim();if(!s)throw new Error('Saisis l’adresse du stationnement bus.');
    try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&accept-language=fr&q=${encodeURIComponent(s)}`,{headers:{Accept:'application/json'}});if(r.ok){const x=(await r.json())?.[0];if(x)return{lat:Number(x.lat),lon:Number(x.lon),address:x.display_name||s}}}catch{}
    const r=await fetch(`https://photon.komoot.io/api/?limit=1&lang=fr&q=${encodeURIComponent(s)}`);if(!r.ok)throw new Error('Recherche d’adresse indisponible.');const f=(await r.json())?.features?.[0];if(!f)throw new Error('Adresse introuvable.');return{lat:Number(f.geometry.coordinates[1]),lon:Number(f.geometry.coordinates[0]),address:[f.properties?.name,f.properties?.street,f.properties?.postcode,f.properties?.city].filter(Boolean).join(', ')||s}
  }
  function installUi(){
    const card=q('v156AccountSheet')?.querySelector('.v156-account-card');if(!card||q('v164ParkingBox'))return !!q('v164ParkingBox');
    const style=document.createElement('style');style.id='v164Style';style.textContent=`
      .v164-box{margin:12px 0;padding:12px;border:1px solid #496878;border-radius:13px;background:#081923}.v164-box h4{margin:0}.v164-box p{margin:5px 0 9px!important;color:#9fb4bf!important;font-size:.66rem!important;line-height:1.45}.v164-box label{font-size:.68rem}.v164-box input{margin-top:5px}.v164-actions{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:8px}.v164-status{min-height:1.2em;margin-top:7px;color:#9fb4bf;font-size:.64rem}.v164-status.ok{color:#9cf4b7}.v164-status.err{color:#ffaaa5}.v164-status.busy{color:#ffe28a}.v164-required{border-color:#d5aa16!important;box-shadow:0 0 0 1px rgba(255,208,0,.25)}
      @media(max-width:560px){.v164-actions{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
    const actions=card.querySelector('.v156-account-actions');const html=`<section id="v164ParkingBox" class="v164-box"><h4>🚌 Stationnement bus</h4><p>Indique l’endroit où ton bus est réellement stationné. <b>Ce n’est pas le dépôt de la société</b> : le dépôt reste une donnée d’entreprise distincte.</p><label>Adresse du stationnement bus<input id="v164ParkingAddress" type="text" autocomplete="street-address" placeholder="Numéro, rue, commune…"></label><div class="v164-actions"><button id="v164ParkingSave" class="primary" type="button">ENREGISTRER LE STATIONNEMENT</button><button id="v164ParkingCheck" type="button">🔎 Vérifier</button></div><div id="v164ParkingStatus" class="v164-status"></div></section>`;
    if(actions)actions.insertAdjacentHTML('beforebegin',html);else card.insertAdjacentHTML('beforeend',html);
    q('v164ParkingSave')?.addEventListener('click',save);
    q('v164ParkingCheck')?.addEventListener('click',check);
    const p=S.parking||local();if(p?.address){q('v164ParkingAddress').value=p.address;status(p.pending?'Stationnement à valider…':'Stationnement bus enregistré.',p.pending?'busy':'ok')}
    return true;
  }
  async function normalized(p){
    if(!p?.address)return null;
    if(Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&!p.pending)return {label:'Stationnement bus',address:p.address,lat:Number(p.lat),lon:Number(p.lon),updatedAt:p.updatedAt||new Date().toISOString()};
    const g=await geocode(p.address);return {label:'Stationnement bus',address:g.address||p.address,lat:Number(g.lat),lon:Number(g.lon),updatedAt:new Date().toISOString()};
  }
  async function load(){
    const C=ready();if(!C)return null;
    try{
      const {data,error}=await C.client.from('driver_settings').select('bus_parking').eq('user_id',C.user.id).maybeSingle();if(error)throw error;
      const remote=data?.bus_parking&&Object.keys(data.bus_parking).length?data.bus_parking:null,loc=local();
      if(remote?.address){const p=await normalized(remote);if(remote.pending||!Number.isFinite(Number(remote.lat))||!Number.isFinite(Number(remote.lon)))await persist(p);else saveLocal(p);return p}
      if(loc?.address){const p=await normalized(loc);await persist(p);return p}
      S.parking=null;return null;
    }catch(e){console.warn('[Mon SAEIV] stationnement bus',e);S.parking=local();return S.parking}
  }
  async function persist(p){const C=ready();if(!C)throw new Error('Compte conducteur serveur non connecté.');const clean={label:'Stationnement bus',address:String(p?.address||'').trim(),lat:Number(p?.lat),lon:Number(p?.lon),updatedAt:p?.updatedAt||new Date().toISOString()};const {error}=await C.client.from('driver_settings').upsert({user_id:C.user.id,organization_id:C.profile.organization_id,bus_parking:clean,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;saveLocal(clean);return clean}
  async function check(){const input=q('v164ParkingAddress'),raw=input?.value.trim();status('Vérification de l’adresse…','busy');try{const p=await geocode(raw);input.value=p.address;S.parking={label:'Stationnement bus',...p};status(`Adresse trouvée : ${p.address}`,'ok')}catch(e){status(e.message||String(e),'err')}}
  async function save(){
    const input=q('v164ParkingAddress'),raw=input?.value.trim();if(!raw)return status('Renseigne le lieu où le bus est stationné.','err');status('Enregistrement…','busy');
    try{let p=S.parking;if(!p||p.address!==raw||!Number.isFinite(Number(p.lat))){p=await geocode(raw)}p={label:'Stationnement bus',address:p.address||raw,lat:Number(p.lat),lon:Number(p.lon),updatedAt:new Date().toISOString()};await persist(p);input.value=p.address;input.classList.remove('v164-required');status('✅ Stationnement bus synchronisé avec ton compte. Il est aussi disponible comme adresse enregistrée dans le planning.','ok');window.dispatchEvent(new CustomEvent('mon-saeiv-bus-parking-changed',{detail:p}))}catch(e){status(e.message||String(e),'err')}
  }
  function renameDepotWording(){
    const replacements=[
      ['Dépôt, terminus, arrêt, adresse…','Stationnement bus, terminus, arrêt, adresse…'],
      ['Terminus, départ de ligne, dépôt, adresse…','Terminus, départ de ligne, stationnement bus, adresse…'],
      ['Ex. Baronville, dépôt, gare…','Ex. Baronville, stationnement bus, gare…']
    ];
    document.querySelectorAll('input[placeholder]').forEach(el=>{for(const [a,b] of replacements)if(el.placeholder===a)el.placeholder=b});
  }
  function remindIfMissing(){
    if(S.prompted||S.parking?.address||!ready())return;S.prompted=true;
    setTimeout(()=>{
      installUi();const input=q('v164ParkingAddress');if(input){input.classList.add('v164-required');status('À renseigner : ton stationnement bus permet de préparer correctement les débuts, fins de service et hauts-le-pied.','busy')}
    },1200);
  }
  async function boot(){
    renameDepotWording();const mo=new MutationObserver(()=>{renameDepotWording();if(ready())installUi()});mo.observe(document.documentElement,{childList:true,subtree:true});
    let tries=0;const t=setInterval(async()=>{if(ready()){clearInterval(t);installUi();await load();const p=S.parking||local();if(p?.address&&q('v164ParkingAddress')){q('v164ParkingAddress').value=p.address;status(p.pending?'Stationnement bus à valider.':'Stationnement bus synchronisé.',p.pending?'busy':'ok')}remindIfMissing()}else if(++tries>240)clearInterval(t)},250);
  }
  window.MonSAEIVDriverSettingsV164={installed:true,version:VERSION,load,save,persist,getBusParking:()=>S.parking||local()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();