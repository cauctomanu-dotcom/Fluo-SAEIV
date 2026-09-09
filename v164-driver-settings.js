'use strict';
/* Mon SAEIV 1.0.72 — réglages conducteur sans observer DOM global.
   Stationnement bus + lignes connues, modifiables par le conducteur et l'exploitation.
   Cette réécriture remplace la boucle MutationObserver qui pouvait figer toute l'application. */
(()=>{
  if(window.MonSAEIVDriverSettingsV164?.installed)return;

  const VERSION='1.0.72';
  const LOCAL_KEY='fluo-saeiv-bus-parking-v164';
  const KNOWN_LOCAL_KEY='fluo-saeiv-known-lines-v171';
  const SAVED_ADDRESSES='fluo-saeiv-saved-addresses-v318';
  const q=id=>document.getElementById(id);
  const S={parking:null,knownLines:[],settings:new Map(),modalDriverId:null,modalLines:[],driverLoaded:false,exploitLoaded:false};
  const cloud=()=>window.MonSAEIVCloudV156;
  const session=()=>cloud()?.client&&cloud()?.user&&cloud()?.profile?cloud():null;
  const driverSession=()=>session()?.profile?.role==='driver'?session():null;
  const exploitationSession=()=>['dispatcher','admin'].includes(session()?.profile?.role)?session():null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').trim();

  function normalizeLine(x){
    const dept=String(x?.dept||'').replace(/\D/g,'').slice(0,2);
    const line=String(x?.line||x?.code||'').trim().toUpperCase().replace(/\s+/g,'');
    return dept&&line?{dept,line}:null;
  }
  function lineKey(x){const n=normalizeLine(x);return n?`${n.dept}|${norm(n.line)}`:''}
  function normalizeLines(xs){
    const out=[],seen=new Set();
    for(const x of Array.isArray(xs)?xs:[]){const n=normalizeLine(x);if(!n)continue;const k=lineKey(n);if(seen.has(k))continue;seen.add(k);out.push(n)}
    return out.sort((a,b)=>a.dept.localeCompare(b.dept)||a.line.localeCompare(b.line,'fr',{numeric:true}));
  }
  function localParking(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch{return null}}
  function localKnown(){try{return normalizeLines(JSON.parse(localStorage.getItem(KNOWN_LOCAL_KEY)||'[]'))}catch{return[]}}
  function setLocalKnown(lines){S.knownLines=normalizeLines(lines);try{localStorage.setItem(KNOWN_LOCAL_KEY,JSON.stringify(S.knownLines))}catch{}}
  function setLocalParking(p){
    S.parking=p||null;try{localStorage.setItem(LOCAL_KEY,JSON.stringify(p||{}))}catch{}
    try{
      let xs=JSON.parse(localStorage.getItem(SAVED_ADDRESSES)||'[]');if(!Array.isArray(xs))xs=[];
      xs=xs.filter(a=>String(a?.id)!=='bus-parking-v164');
      if(p?.address&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)))xs.push({id:'bus-parking-v164',label:'Stationnement bus',address:p.address,name:p.address,lat:Number(p.lat),lon:Number(p.lon),updatedAt:new Date().toISOString()});
      localStorage.setItem(SAVED_ADDRESSES,JSON.stringify(xs));
    }catch{}
  }
  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
  function status(id,text,kind=''){const e=q(id);if(e){setText(e,text||'');const cls=`v164-status ${kind}`;if(e.className!==cls)e.className=cls}}

  function installStyle(){
    if(q('v164Style'))return;
    const st=document.createElement('style');st.id='v164Style';st.textContent=`
      .v164-box{margin:12px 0;padding:12px;border:1px solid #496878;border-radius:13px;background:#081923}.v164-box h4{margin:0}.v164-box p{margin:5px 0 9px!important;color:#9fb4bf!important;font-size:.66rem!important;line-height:1.45}.v164-box label{font-size:.68rem}.v164-box input,.v164-box select{margin-top:5px}.v164-actions{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:8px}.v164-status{min-height:1.2em;margin-top:7px;color:#9fb4bf;font-size:.64rem}.v164-status.ok{color:#9cf4b7}.v164-status.err{color:#ffaaa5}.v164-status.busy{color:#ffe28a}
      .v171-line-add{display:grid;grid-template-columns:90px 1fr auto;gap:6px;align-items:end}.v171-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.v171-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #46677a;border-radius:999px;background:#102735;color:#eef7fb;font-size:.6rem;font-weight:800}.v171-chip button{min-height:20px!important;padding:0 4px!important;border:0!important;background:transparent!important;color:#ffb4b0!important}.v171-empty{padding:7px;border:1px dashed #435d6a;border-radius:9px;color:#8ea4af;font-size:.61rem}.v171-known-btn{width:100%;min-height:27px!important;margin-top:5px!important;padding:3px 6px!important;font-size:.5rem!important}.v171-known-btn.missing{border-color:#9a7727!important;color:#ffe49a!important}.v171-driver-known-summary{margin-top:4px!important;color:#8da5b1!important;font-size:.5rem!important}
      .v171-modal{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.72)}.v171-modal.hidden{display:none!important}.v171-modal-card{width:min(620px,100%);max-height:88vh;overflow:auto;padding:16px;border:1px solid #496878;border-radius:18px;background:#0b202c;box-shadow:0 30px 80px rgba(0,0,0,.55)}.v171-modal-head{display:flex;gap:8px;align-items:center}.v171-modal-head h3{margin:0;flex:1}.v171-catalog{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.v171-catalog button{min-height:28px;padding:4px 7px;font-size:.54rem}.v171-modal-actions{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:12px}
      @media(max-width:560px){.v164-actions,.v171-line-add,.v171-modal-actions{grid-template-columns:1fr}.v171-modal{padding:7px;align-items:end}.v171-modal-card{max-height:92vh;border-radius:18px 18px 0 0}}
    `;document.head.appendChild(st);
  }
  function renderChips(boxId,lines,prefix){
    const box=q(boxId);if(!box)return;
    const xs=normalizeLines(lines);
    const html=xs.length?xs.map(x=>`<span class="v171-chip">${esc(x.dept)} · ${esc(x.line)} <button type="button" data-${prefix}-remove="${esc(lineKey(x))}" aria-label="Retirer">×</button></span>`).join(''):'<div class="v171-empty">Aucune ligne renseignée.</div>';
    if(box.innerHTML!==html)box.innerHTML=html;
  }

  async function geocode(text){
    const s=String(text||'').trim();if(!s)throw new Error('Saisis l’adresse du stationnement bus.');
    try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&accept-language=fr&q=${encodeURIComponent(s)}`,{headers:{Accept:'application/json'}});if(r.ok){const x=(await r.json())?.[0];if(x)return{lat:Number(x.lat),lon:Number(x.lon),address:x.display_name||s}}}catch{}
    const r=await fetch(`https://photon.komoot.io/api/?limit=1&lang=fr&q=${encodeURIComponent(s)}`);if(!r.ok)throw new Error('Recherche d’adresse indisponible.');const f=(await r.json())?.features?.[0];if(!f)throw new Error('Adresse introuvable.');return{lat:Number(f.geometry.coordinates[1]),lon:Number(f.geometry.coordinates[0]),address:[f.properties?.name,f.properties?.street,f.properties?.postcode,f.properties?.city].filter(Boolean).join(', ')||s};
  }
  async function persistKnownLines(userId,organizationId,lines){
    const C=session();if(!C)throw new Error('Session serveur indisponible.');const clean=normalizeLines(lines);
    const{error}=await C.client.from('driver_settings').upsert({user_id:userId,organization_id:organizationId,known_lines:clean,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;return clean;
  }
  async function persistParking(p){
    const C=driverSession();if(!C)throw new Error('Compte conducteur serveur non connecté.');
    const clean={label:'Stationnement bus',address:String(p?.address||'').trim(),lat:Number(p?.lat),lon:Number(p?.lon),updatedAt:new Date().toISOString()};
    const{error}=await C.client.from('driver_settings').upsert({user_id:C.user.id,organization_id:C.profile.organization_id,bus_parking:clean,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;setLocalParking(clean);return clean;
  }

  function installDriverUi(){
    const C=driverSession(),card=q('v156AccountSheet')?.querySelector('.v156-account-card');if(!C||!card)return false;installStyle();
    if(!q('v164ParkingBox')){
      const actions=card.querySelector('.v156-account-actions');const html=`<section id="v164ParkingBox" class="v164-box"><h4>🚌 Stationnement bus</h4><p>Lieu où ton bus est réellement stationné. Ce n’est pas le dépôt de la société.</p><label>Adresse<input id="v164ParkingAddress" type="text" autocomplete="street-address" placeholder="Numéro, rue, commune…"></label><div class="v164-actions"><button id="v164ParkingSave" class="primary" type="button">ENREGISTRER</button><button id="v164ParkingCheck" type="button">🔎 Vérifier</button></div><div id="v164ParkingStatus" class="v164-status"></div></section>`;
      if(actions)actions.insertAdjacentHTML('beforebegin',html);else card.insertAdjacentHTML('beforeend',html);
    }
    if(!q('v171KnownLinesBox'))q('v164ParkingBox')?.insertAdjacentHTML('afterend',`<section id="v171KnownLinesBox" class="v164-box"><h4>🛣 Lignes que je connais</h4><p>Ces lignes sont prises en compte par la génération Exploitation.</p><div class="v171-line-add"><label>Département<select id="v171SelfDept"><option>57</option><option>54</option><option>67</option><option>68</option></select></label><label>Ligne<input id="v171SelfLine" type="text" placeholder="Ex. 57R026"></label><button id="v171SelfAdd" type="button">+ Ajouter</button></div><div id="v171SelfChips" class="v171-chips"></div><button id="v171SelfSave" class="primary" type="button" style="width:100%;margin-top:9px">ENREGISTRER MES LIGNES</button><div id="v171KnownStatus" class="v164-status"></div></section>`);
    const p=S.parking||localParking();if(p?.address&&q('v164ParkingAddress')&&q('v164ParkingAddress').value!==p.address)q('v164ParkingAddress').value=p.address;
    renderChips('v171SelfChips',S.knownLines,'v171-self');return true;
  }
  async function loadDriverSettings(){
    const C=driverSession();if(!C)return;
    try{
      const{data,error}=await C.client.from('driver_settings').select('bus_parking,known_lines').eq('user_id',C.user.id).maybeSingle();if(error)throw error;
      const rp=data?.bus_parking&&Object.keys(data.bus_parking).length?data.bus_parking:null,lp=localParking();
      if(rp?.address)setLocalParking(rp);else if(lp?.address&&Number.isFinite(Number(lp.lat))&&Number.isFinite(Number(lp.lon)))await persistParking(lp);else S.parking=lp;
      const remote=normalizeLines(data?.known_lines||[]),loc=localKnown();if(remote.length)setLocalKnown(remote);else if(loc.length){await persistKnownLines(C.user.id,C.profile.organization_id,loc);setLocalKnown(loc)}else setLocalKnown([]);
      S.driverLoaded=true;installDriverUi();
    }catch(e){console.warn('[Mon SAEIV] réglages conducteur',e);S.parking=localParking();setLocalKnown(localKnown())}
  }
  async function checkParking(){const input=q('v164ParkingAddress'),raw=input?.value.trim();status('v164ParkingStatus','Vérification…','busy');try{const p=await geocode(raw);S.parking={label:'Stationnement bus',...p};input.value=p.address;status('v164ParkingStatus',`Adresse trouvée : ${p.address}`,'ok')}catch(e){status('v164ParkingStatus',e.message||String(e),'err')}}
  async function saveParking(){const input=q('v164ParkingAddress'),raw=input?.value.trim();if(!raw)return status('v164ParkingStatus','Renseigne le stationnement bus.','err');status('v164ParkingStatus','Enregistrement…','busy');try{let p=S.parking;if(!p||p.address!==raw||!Number.isFinite(Number(p.lat)))p=await geocode(raw);const clean=await persistParking(p);input.value=clean.address;status('v164ParkingStatus','✅ Stationnement bus synchronisé.','ok')}catch(e){status('v164ParkingStatus',e.message||String(e),'err')}}
  function addSelfLine(){const n=normalizeLine({dept:q('v171SelfDept')?.value,line:q('v171SelfLine')?.value});if(!n)return status('v171KnownStatus','Saisis une ligne.','err');S.knownLines=normalizeLines([...S.knownLines,n]);if(q('v171SelfLine'))q('v171SelfLine').value='';renderChips('v171SelfChips',S.knownLines,'v171-self');status('v171KnownStatus','Modification prête à enregistrer.','busy')}
  async function saveSelfLines(){const C=driverSession();if(!C)return;status('v171KnownStatus','Enregistrement…','busy');try{const clean=await persistKnownLines(C.user.id,C.profile.organization_id,S.knownLines);setLocalKnown(clean);renderChips('v171SelfChips',clean,'v171-self');status('v171KnownStatus',`✅ ${clean.length} ligne${clean.length>1?'s':''} enregistrée${clean.length>1?'s':''}.`,'ok')}catch(e){status('v171KnownStatus',e.message||String(e),'err')}}

  function installModal(){
    if(q('v171LinesModal'))return;installStyle();document.body.insertAdjacentHTML('beforeend',`<div id="v171LinesModal" class="v171-modal hidden"><div class="v171-modal-card"><div class="v171-modal-head"><h3 id="v171ModalTitle">Lignes connues</h3><button id="v171ModalClose" type="button">✕</button></div><p style="color:#9fb4bf;font-size:.67rem">L’exploitation et le conducteur partagent la même liste de compétences.</p><div class="v171-line-add"><label>Département<select id="v171ModalDept"><option>57</option><option>54</option><option>67</option><option>68</option></select></label><label>Ligne<input id="v171ModalLine" type="text" placeholder="Ex. 57R026"></label><button id="v171ModalAdd" type="button">+ Ajouter</button></div><div id="v171ModalChips" class="v171-chips"></div><div id="v171ModalCatalog" class="v171-catalog"></div><div class="v171-modal-actions"><button id="v171ModalSave" class="primary" type="button">ENREGISTRER</button><button id="v171ModalCancel" type="button">Annuler</button></div><div id="v171ModalStatus" class="v164-status"></div></div></div>`);
  }
  function availableCatalog(){const b=window.MonSAEIVOperationsBoardV165,seen=new Map();for(const s of b?.segments||[]){const n=normalizeLine({dept:s.dept||s.linked?.dept,line:s.line});if(n)seen.set(lineKey(n),n)}return[...seen.values()].sort((a,b)=>a.dept.localeCompare(b.dept)||a.line.localeCompare(b.line,'fr',{numeric:true}))}
  function renderModal(){
    renderChips('v171ModalChips',S.modalLines,'v171-modal');const cat=q('v171ModalCatalog');if(!cat)return;const selected=new Set(S.modalLines.map(lineKey));const xs=availableCatalog().filter(x=>!selected.has(lineKey(x))).slice(0,80);
    const html=xs.length?`<span style="width:100%;font-size:.58rem;color:#8098a5">Lignes visibles dans la Toolbox :</span>${xs.map(x=>`<button type="button" data-v171-catalog="1" data-dept="${esc(x.dept)}" data-line="${esc(x.line)}">+ ${esc(x.dept)} · ${esc(x.line)}</button>`).join('')}`:'';if(cat.innerHTML!==html)cat.innerHTML=html;
  }
  function closeModal(){q('v171LinesModal')?.classList.add('hidden');S.modalDriverId=null;S.modalLines=[]}
  async function openModal(driverId){
    const C=exploitationSession();if(!C)return;installModal();S.modalDriverId=String(driverId);const b=window.MonSAEIVOperationsBoardV165,d=b?.drivers?.find(x=>String(x.user_id)===String(driverId));setText(q('v171ModalTitle'),`Lignes connues · ${d?.display_name||d?.matricule||'Conducteur'}`);
    let row=S.settings.get(String(driverId));if(!row){const{data,error}=await C.client.from('driver_settings').select('user_id,bus_parking,known_lines').eq('user_id',driverId).maybeSingle();if(error)return status('v171ModalStatus',error.message,'err');row=data||{user_id:driverId,known_lines:[]};S.settings.set(String(driverId),row)}
    S.modalLines=normalizeLines(row.known_lines||[]);renderModal();status('v171ModalStatus',S.modalLines.length?'Modifie puis enregistre.':'Aucune ligne renseignée.','busy');q('v171LinesModal').classList.remove('hidden');
  }
  function addModalLine(){const n=normalizeLine({dept:q('v171ModalDept')?.value,line:q('v171ModalLine')?.value});if(!n)return status('v171ModalStatus','Saisis une ligne.','err');S.modalLines=normalizeLines([...S.modalLines,n]);if(q('v171ModalLine'))q('v171ModalLine').value='';renderModal()}
  async function saveModalLines(){const C=exploitationSession();if(!C||!S.modalDriverId)return;status('v171ModalStatus','Enregistrement…','busy');try{const clean=await persistKnownLines(S.modalDriverId,C.profile.organization_id,S.modalLines);const old=S.settings.get(S.modalDriverId)||{};S.settings.set(S.modalDriverId,{...old,user_id:S.modalDriverId,known_lines:clean});decorateExploitationGrid();status('v171ModalStatus',`✅ ${clean.length} ligne${clean.length>1?'s':''} enregistrée${clean.length>1?'s':''}.`,'ok');setTimeout(closeModal,350)}catch(e){status('v171ModalStatus',e.message||String(e),'err')}}
  async function loadExploitationSettings(){const C=exploitationSession();if(!C)return;const{data,error}=await C.client.from('driver_settings').select('user_id,bus_parking,known_lines').eq('organization_id',C.profile.organization_id);if(error){console.warn('[Mon SAEIV] compétences conducteurs',error);return}S.settings.clear();for(const x of data||[])S.settings.set(String(x.user_id),x);S.exploitLoaded=true;decorateExploitationGrid()}
  function decorateExploitationGrid(){
    if(!exploitationSession())return;for(const row of document.querySelectorAll('.v165-driver-row')){const lane=row.querySelector('[data-driver-lane]'),meta=row.querySelector('.v165-driver-meta');if(!lane||!meta)continue;const id=String(lane.dataset.driverLane||''),lines=normalizeLines(S.settings.get(id)?.known_lines||[]);
      let summary=meta.querySelector('.v171-driver-known-summary');if(!summary){summary=document.createElement('small');summary.className='v171-driver-known-summary';meta.appendChild(summary)}const txt=lines.length?`🛣 ${lines.length} ligne${lines.length>1?'s':''} connue${lines.length>1?'s':''}`:'⚠ Lignes connues non renseignées';setText(summary,txt);
      let btn=meta.querySelector('.v171-known-btn');if(!btn){btn=document.createElement('button');btn.type='button';btn.className='v171-known-btn';btn.dataset.v171EditLines=id;meta.appendChild(btn)}const bt=lines.length?'🛣 Modifier les lignes connues':'🛣 Renseigner les lignes connues';setText(btn,bt);btn.classList.toggle('missing',!lines.length);
    }
  }

  function click(e){
    const t=e.target;
    if(t.closest?.('#v164ParkingSave')){e.preventDefault();saveParking();return}if(t.closest?.('#v164ParkingCheck')){e.preventDefault();checkParking();return}if(t.closest?.('#v171SelfAdd')){e.preventDefault();addSelfLine();return}if(t.closest?.('#v171SelfSave')){e.preventDefault();saveSelfLines();return}
    const sr=t.closest?.('[data-v171-self-remove]');if(sr){S.knownLines=S.knownLines.filter(x=>lineKey(x)!==sr.dataset.v171SelfRemove);renderChips('v171SelfChips',S.knownLines,'v171-self');return}
    const edit=t.closest?.('[data-v171-edit-lines]');if(edit){e.preventDefault();e.stopPropagation();openModal(edit.dataset.v171EditLines);return}if(t.closest?.('#v171ModalClose,#v171ModalCancel')){closeModal();return}if(t.closest?.('#v171ModalAdd')){addModalLine();return}if(t.closest?.('#v171ModalSave')){saveModalLines();return}
    const mr=t.closest?.('[data-v171-modal-remove]');if(mr){S.modalLines=S.modalLines.filter(x=>lineKey(x)!==mr.dataset.v171ModalRemove);renderModal();return}const cat=t.closest?.('[data-v171-catalog]');if(cat){S.modalLines=normalizeLines([...S.modalLines,{dept:cat.dataset.dept,line:cat.dataset.line}]);renderModal()}
  }
  function keydown(e){if(e.key==='Enter'&&e.target?.id==='v171SelfLine'){e.preventDefault();addSelfLine()}if(e.key==='Enter'&&e.target?.id==='v171ModalLine'){e.preventDefault();addModalLine()}}

  async function boot(){
    installStyle();document.addEventListener('click',click,true);document.addEventListener('keydown',keydown,true);
    let tries=0,roleReady=false;
    const timer=setInterval(async()=>{
      tries++;
      if(driverSession()){
        roleReady=true;installDriverUi();if(!S.driverLoaded)await loadDriverSettings();
        if(q('v171KnownLinesBox')&&S.driverLoaded){clearInterval(timer);return}
      }else if(exploitationSession()){
        roleReady=true;installModal();if(!S.exploitLoaded)await loadExploitationSettings();decorateExploitationGrid();
      }
      if(tries>=240)clearInterval(timer);
    },500);
    // Exploitation : décoration légère et idempotente, sans MutationObserver global.
    setInterval(()=>{if(exploitationSession()){decorateExploitationGrid()}},1500);
  }

  window.MonSAEIVDriverSettingsV164={installed:true,version:VERSION,load:loadDriverSettings,save:saveParking,persist:persistParking,getBusParking:()=>S.parking||localParking(),getKnownLines:()=>normalizeLines(S.knownLines),normalizeLines,lineKey,refreshExploitation:loadExploitationSettings};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
