'use strict';
/* SAEIV 1.0.96 — the existing "Modifier le segment" modal, redesigned for dispatch consent. */
(()=>{
 if(window.MonSAEIVSegmentChangeV195?.installed)return;
 const q=id=>document.getElementById(id),cloud=()=>window.MonSAEIVCloudV156,
   db=()=>cloud()?.client,p=()=>cloud()?.profile,board=()=>window.MonSAEIVOperationsBoardV165;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const hh=t=>String(t||'').slice(0,5);
 const mins=t=>{const m=hh(t).match(/^(\d\d):(\d\d)$/);return m?+m[1]*60+(+m[2]):null};
 const S={old:[],segments:[],oldIndex:null,newIndex:null,driver:null,date:null,busy:false,version:0};
 const msg=(s,error=false)=>{const e=q('v174Status');if(e){e.textContent=s;e.className='v174-status '+(error?'err':'ok')}};
 const fromLegacy=x=>({
   id:String(x.client_id||x.id),legacy_item_id:String(x.id),segment_id:x.payload?.segment_id||null,
   type:x.type,line:x.line||'',start:hh(x.start_time),end:hh(x.end_time),
   origin:x.origin||'',destination:x.destination||'',originCoords:x.origin_coords||null,
   destinationCoords:x.destination_coords||null,linked:x.linked||{},notes:x.notes||''
 });
 const unique=x=>String(x.segment_id||x.payload?.segment_id||x.linked?.tripId||x.id||'');
 const format=x=>[x.line||'Sans ligne',x.start+'–'+x.end,(x.origin||'Départ')+' → '+(x.destination||'Arrivée')].join(' · ');
 const validTime=x=>mins(x.start)!==null&&mins(x.end)!==null&&mins(x.start)<mins(x.end);
 const isCourse=x=>['regular','school','tad','annex','other'].includes(String(x?.type||''));
 const tokensMatch=(query,item)=>norm(query).trim().split(/\s+/).filter(Boolean).every(t=>norm(format(item)+' '+(item.routeLong||'')+' '+(item.dept||'')).includes(t));
 function css(){
  if(q('v196Style'))return;
  const st=document.createElement('style');st.id='v196Style';st.textContent=
  '#v174Editor .v174-modal{width:min(760px,98vw)}#v196Form{display:grid;gap:12px;margin-top:13px}#v196Form .v196-identity{display:flex;gap:9px;flex-wrap:wrap}#v196Form .v196-identity div{padding:8px 12px;background:#0c2b3e;border:1px solid #466679;border-radius:10px;flex:1}#v196Form .v196-combo{position:relative}#v196Form label{display:grid;gap:5px;font-size:.76rem;font-weight:700}#v196Form input,#v196Form textarea{width:100%;min-height:44px;border:1px solid #60829a;border-radius:10px;background:#061a29;color:#fff;padding:9px}#v196Form .v196-list{max-height:220px;overflow:auto;background:#082335;border:1px solid #7193a5;border-radius:10px;margin-top:3px}#v196Form .v196-choice{display:block;text-align:left;width:100%;padding:10px;border:0;border-bottom:1px solid #315264;background:transparent;color:white;font-size:.73rem;line-height:1.4;cursor:pointer}#v196Form .v196-choice:hover,#v196Form .v196-choice:focus{background:#214759}#v196Form .v196-selected{border:1px solid #50798f;background:#092838;border-radius:11px;padding:10px;font-size:.74rem}#v196Form .v196-preview{background:#112a30;border-left:4px solid #eac46c;padding:11px;border-radius:9px;line-height:1.5;font-size:.78rem}#v196Form .v196-help{font-size:.67rem;color:#afc5d4;font-weight:400}#v196Form .v196-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}#v196Form button.primary{border:0;background:#ffd060;color:#16212a;font-weight:800;padding:12px;border-radius:10px}#v196Form button:disabled{opacity:.55}#v196Form .v196-warning{color:#ffe4a1;font-size:.68rem}@media(max-width:620px){#v196Form .v196-actions button{flex:1 1 100%}}';
  document.head.append(st);
 }
 function suggestions(which){
  const source=which==='old'?S.old:S.segments,query=q(which==='old'?'v196Old':'v196Replacement')?.value||'',
   container=q(which==='old'?'v196OldList':'v196ReplacementList');
  if(!container)return;
  // Empty search opens the initial dropdown; typing narrows the available line/segment list.
  const matches=source.map((x,i)=>({x,i})).filter(({x})=>tokensMatch(query,x)).slice(0,55);
  container.innerHTML=matches.length?matches.map(({x,i})=>'<button type="button" class="v196-choice" data-v196-pick="'+which+'" data-index="'+i+'">'+esc(format(x))+'</button>').join(''):
    '<div class="v196-help" style="padding:9px">Aucun segment correspondant. Vérifie les départements chargés et la date.</div>';
 }
 function select(which,index){
  const obj=which==='old'?S.old[index]:S.segments[index];if(!obj)return;
  if(which==='old'){S.oldIndex=index;q('v196Old').value=format(obj);q('v196OldList').innerHTML=''}
  else{S.newIndex=index;q('v196Replacement').value=format(obj);q('v196ReplacementList').innerHTML='';q('v196Delete').checked=false}
  updateSummary();
 }
 function updateSummary(){
  const old=S.old[S.oldIndex],replacement=S.segments[S.newIndex],deleteOnly=q('v196Delete')?.checked;
  const preview=q('v196Preview');if(!preview)return;
  preview.innerHTML='<strong>Avant :</strong> '+(old?esc(format(old)):'<em>Choisis une course supprimée</em>')+
   '<div><strong>Après :</strong> '+(deleteOnly?'Suppression de cette course, sans remplacement':replacement?esc(format(replacement)):'Choisis une course de remplacement ou coche « Supprimer sans remplacement »')+'</div>'+
   '<p class="v196-help">L’ancien planning restera officiel jusqu’à ce que le conducteur accepte la proposition et que l’exploitation la revalide.</p>';
  q('v196Send').disabled=!old||(!deleteOnly&&!replacement)||S.busy;
 }
 function resetReplacement(){S.newIndex=null;q('v196Replacement').value='';q('v196ReplacementList').innerHTML='';updateSummary()}
 function bindCombo(inputId,which){
  const input=q(inputId);
  input.addEventListener('focus',()=>suggestions(which));
  input.addEventListener('input',()=>{if(which==='old')S.oldIndex=null;else S.newIndex=null;suggestions(which);updateSummary()});
  input.addEventListener('keydown',e=>{
   if(e.key==='Escape'){q(which==='old'?'v196OldList':'v196ReplacementList').innerHTML='';return}
   if(e.key==='Enter'){const first=q(which==='old'?'v196OldList':'v196ReplacementList').querySelector('[data-v196-pick]');if(first){e.preventDefault();select(which,Number(first.dataset.index))}}
  });
 }
 function ui(item){
  css();q('v174Title').textContent='Modifier un service · demande au conducteur';
  q('v174Subtitle').textContent='Sélectionne la course à retirer, puis son éventuel remplacement.';
  q('v174EditorBody').innerHTML='<form id="v196Form">'+
   '<div class="v196-identity"><div><small>Conducteur</small><strong id="v196DriverName"></strong></div><div><small>Journée</small><strong id="v196Day"></strong></div></div>'+
   '<label>1. Ligne / segment supprimé <span class="v196-help">Tape le numéro, le nom d’une ville ou l’horaire, puis sélectionne la course réellement prévue.</span><div class="v196-combo"><input id="v196Old" type="search" autocomplete="off" role="combobox" aria-controls="v196OldList" aria-autocomplete="list" placeholder="Ex. 57, Sarrebourg, 06:37…" required><div id="v196OldList" class="v196-list"></div></div></label>'+
   '<label>2. Ligne / segment de remplacement <span class="v196-help">Recherche parmi les courses GTFS disponibles pour cette journée.</span><div class="v196-combo"><input id="v196Replacement" type="search" autocomplete="off" role="combobox" aria-controls="v196ReplacementList" aria-autocomplete="list" placeholder="Numéro de ligne, ville, horaire…"><div id="v196ReplacementList" class="v196-list"></div></div></label>'+
   '<label style="display:flex;align-items:center;gap:9px;flex-direction:row"><input id="v196Delete" type="checkbox" style="width:20px;min-height:20px">Supprimer cette course sans remplacement</label>'+
   '<div class="v196-preview" id="v196Preview"></div>'+
   '<label>3. Notes / motif à communiquer au conducteur<textarea id="v196Reason" rows="3" minlength="5" placeholder="Ex. Service supprimé après réorganisation, remplacement sur la ligne 57…"></textarea></label>'+
   '<div class="v196-warning" id="v196Legality">Contrôle préliminaire des horaires avant envoi. HLP et RSE complets à valider avant republication.</div>'+
   '<div class="v196-actions"><button type="button" data-v174-cancel>Annuler</button><button type="submit" id="v196Send" class="primary" disabled>Enregistrer, recalculer et envoyer au conducteur</button></div></form>';
  q('v196DriverName').textContent=(board()?.drivers||[]).find(d=>String(d.user_id)===String(item.driver_user_id))?.display_name||'Conducteur';
  q('v196Day').textContent=item.service_date||'';
  bindCombo('v196Old','old');bindCombo('v196Replacement','new');
  q('v196Form').addEventListener('click',e=>{const b=e.target.closest('[data-v196-pick]');if(b)select(b.dataset.v196Pick,Number(b.dataset.index))});
  q('v196Delete').addEventListener('change',()=>{if(q('v196Delete').checked)resetReplacement();q('v196Replacement').disabled=q('v196Delete').checked;updateSummary()});
  q('v196Form').addEventListener('submit',ev=>{ev.preventDefault();send().catch(e=>msg(e?.message||String(e),true))});
  updateSummary();
 }
 function sameLegacy(a,b){return String(a.id||'')===String(b.client_id||b.id||'')||String(a.legacy_item_id||'')===String(b.id||'')||
  String(a.segment_id||'')===String(b.payload?.segment_id||'')&&!!a.segment_id||
  (!!a.line&&a.line===b.line&&hh(a.start)===hh(b.start_time)&&hh(a.end)===hh(b.end_time)) }
 async function open(item){
  if(!db()||!p()?.organization_id)throw Error('Connexion exploitation requise');
  if(!['admin','dispatcher'].includes(p().role))throw Error('Accès exploitation requis');
  const request=++S.version;S.driver=item.driver_user_id;S.date=item.service_date||board()?.date;S.old=[];S.segments=[];S.oldIndex=null;S.newIndex=null;S.busy=false;
  if(!q('v174Editor'))window.MonSAEIVGridEditorV174?.decorate?.();
  if(!q('v174Editor'))throw Error('Fenêtre de modification non chargée : actualiser la page');
  ui(item);q('v174Editor').classList.remove('hidden');msg('Chargement des courses du conducteur et des lignes disponibles…');
  const org=p().organization_id,date=S.date;
  const [published,legacy,active,drafts]=await Promise.all([
   db().from('saeiv_published_days').select('items').eq('organization_id',org).eq('driver_user_id',S.driver).eq('service_date',date).maybeSingle(),
   db().from('plan_items').select('*').eq('organization_id',org).eq('driver_user_id',S.driver).eq('service_date',date).order('sort_index'),
   db().from('plan_items').select('driver_user_id,payload,linked').eq('organization_id',org).eq('service_date',date).in('type',['regular','school','tad']),
   db().from('saeiv_planning_days').select('driver_user_id,items').eq('organization_id',org).eq('service_date',date)
  ]);
  if(request!==S.version)return;
  for(const response of [published,legacy,active,drafts])if(response.error)throw response.error;
  S.old=(published.data?.items||(legacy.data||[]).map(fromLegacy)).filter(isCourse);
  if(!S.old.length)throw Error('Aucune course à modifier pour ce conducteur à cette date');
  const target=S.old.findIndex(x=>sameLegacy(x,item));
  if(target>=0)select('old',target);else if(S.old.length===1)select('old',0);
  const visible=(board()?.segments||[]);if(board()?.date!==date||!visible.length){throw Error('Charger les segments GTFS de cette journée avant de sélectionner un remplacement.')}
  const assigned=new Set((active.data||[]).filter(x=>String(x.driver_user_id)!==String(S.driver)).flatMap(x=>[x.payload?.segment_id,x.linked?.tripId]).filter(Boolean).map(String));
  for(const draft of drafts.data||[])if(draft.driver_user_id!==S.driver)for(const a of draft.items||[]){if(a.segment_id)assigned.add(String(a.segment_id));if(a.linked?.tripId)assigned.add(String(a.linked.tripId))}
  const {data:allOfficial,error}=await db().from('saeiv_published_days').select('driver_user_id,items').eq('organization_id',org).eq('service_date',date);
  if(error)throw error;if(request!==S.version)return;
  for(const d of allOfficial||[])if(d.driver_user_id!==S.driver)for(const a of d.items||[]){if(a.segment_id)assigned.add(String(a.segment_id));if(a.linked?.tripId)assigned.add(String(a.linked.tripId))}
  S.segments=visible.filter(x=>!assigned.has(String(x.id))&&(!x.tripId||!assigned.has(String(x.tripId)))&&validTime(x));
  msg(S.segments.length+' segments disponibles. Recherche par numéro de ligne, ville ou horaire.');
  updateSummary();
 }
 async function estimate(old,replacement){
  const engine=window.MonSAEIVGenerationEngineV167;
  if(!engine?.scoreCandidate||!replacement)return 'Suppression sans remplacement : vérification HLP/RSE globale à effectuer avant validation finale.';
  const record=await db().from('driver_settings').select('bus_parking,known_lines').eq('organization_id',p().organization_id).eq('user_id',S.driver).maybeSingle();
  if(record.error)throw record.error;
  const driver=board()?.drivers?.find(d=>String(d.user_id)===String(S.driver));
  const keep=S.old.filter(x=>x!==old&&isCourse(x));
  const evaluation=engine.scoreCandidate(replacement,driver||{user_id:S.driver},keep,record.data||{},{compactOnly:false});
  if(evaluation?.ok)return 'Contrôle provisoire : aucun conflit HLP estimé, HLP '+Number(evaluation.hlpKm||0).toFixed(1)+' km. Contrôle réglementaire RSE complet requis avant revalidation.';
  const reason=evaluation?.reason||'Contrôle HLP indisponible';
  if(/chevauchement|amplitude|travail estimé|conduite estimée|HLP impossible/.test(reason))
    throw Error('Recalcul provisoire défavorable : '+reason+'. Choisir un autre segment.');
  return '⚠ Calcul HLP incomplet : '+reason+'. Un exploitant devra vérifier la faisabilité avant revalidation.';
 }

 async function send(){
  if(S.busy)return;
  const old=S.old[S.oldIndex],replacement=S.segments[S.newIndex],deleteOnly=q('v196Delete')?.checked;
  if(!old)throw Error('Sélectionne la course à supprimer dans la liste');
  if(!deleteOnly&&!replacement)throw Error('Choisis une course de remplacement ou coche « Supprimer sans remplacement »');
  const reason=q('v196Reason').value.trim();if(reason.length<5)throw Error('Indique le motif de la modification (5 caractères minimum)');
  if(replacement){
   if(!validTime(replacement))throw Error('Horaires de remplacement invalides');
   for(const a of S.old)if(a!==old&&isCourse(a)&&validTime(a)&&mins(a.start)<mins(replacement.end)&&mins(a.end)>mins(replacement.start))throw Error('Chevauchement avec une autre course du conducteur : remplacement refusé');
  }
  if(!confirm('Envoyer cette proposition au conducteur ? Son planning actuel restera inchangé jusqu’à son accord et à la validation de l’exploitation.'))return;
  S.busy=true;let lockId=null;const button=q('v196Send');button.disabled=true;
  try{
   const result=await estimate(old,deleteOnly?null:replacement);q('v196Legality').textContent=result;
   msg('Contrôle des conflits et envoi de la demande au conducteur…');
   const {data:lock,error:lockError}=await db().rpc('saeiv_acquire_lock',{p_start:S.date,p_end:S.date,p_name:p().display_name||'Exploitation'});
   if(lockError)throw lockError;
   if(!lock?.ok)throw Error('Journée verrouillée par '+(lock?.owner||'un autre agent'));lockId=lock.id;
   const proposal=replacement&&!deleteOnly?{
     id:'gtfs-'+String(replacement.id),segment_id:String(replacement.id),date:S.date,
     type:replacement.type||'regular',line:replacement.line||'',label:(replacement.line||'Ligne')+' · '+replacement.destination,
     start:replacement.start,end:replacement.end,origin:replacement.origin||'',destination:replacement.destination||'',
     originCoords:replacement.originCoords||null,destinationCoords:replacement.destinationCoords||null,
     driveMinutes:replacement.driveMinutes||null,linked:replacement.linked||null,
     dept:replacement.dept||'',source:'dispatch_proposed',notes:reason
   }:null;
   const {data,error}=await db().rpc('saeiv_propose_segment_change',{
    p_driver:S.driver,p_date:S.date,p_remove_id:String(old.id),p_replacement:proposal,p_reason:reason
   });
   if(error)throw error;
   msg('✅ Proposition n°'+String(data).slice(0,8)+' envoyée dans « Mes plannings ». Le conducteur peut accepter ou refuser. Aucune course officielle modifiée.');
   q('v196Form').querySelectorAll('input,textarea').forEach(x=>x.disabled=true);
  }finally{
   if(lockId){const r=await db().rpc('saeiv_release_lock',{p_id:lockId,p_force:false});if(r.error)console.warn('[SAEIV] verrou à libérer',r.error)}
   S.busy=false;
   if(button&&!q('v196Reason')?.disabled)updateSummary();
  }
 }
 window.MonSAEIVSegmentChangeV195={installed:true,open,format,tokensMatch};
})();