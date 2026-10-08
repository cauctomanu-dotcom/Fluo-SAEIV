'use strict';
/* Mon SAEIV 1.0.92 — locked shared draft -> validation -> publication; consent flow. */
(()=>{
 if(window.MonSAEIVPlanningV187?.installed)return;
 const q=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot','\'':'&#39;'}[c]));
 const cloud=()=>window.MonSAEIVCloudV156,client=()=>cloud()?.client,profile=()=>cloud()?.profile,org=()=>profile()?.organization_id;
 const val=id=>q(id)?.value||'',today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const P={lock:null,heartbeat:null,subscription:null,driver:null,drivers:[],date:today(),draft:null,official:null,items:[],changes:[],published:[],busy:false};
 const status=(message,error=false)=>{const e=q('v187Status');if(e){e.textContent=message;e.style.color=error?'#ffb1b1':'#b5ffd7'}};
 const error=e=>status(e?.message||String(e),true);
 const call=async(name,args)=>{const {data,error}=await client().rpc(name,args);if(error)throw error;return data};
 const select=async(table,filters,columns='*')=>{let r=client().from(table).select(columns).eq('organization_id',org());for(const [key,value]of Object.entries(filters||{}))r=r.eq(key,value);const {data,error}=await r;if(error)throw error;return data||[]};
 const ready=()=>!!client()&&!!profile()&&['admin','dispatcher'].includes(profile().role);
 function install(){
  if(q('v187Planning')||!ready()||!q('v157Dispatch'))return;
  const css=document.createElement('style');css.textContent='#v187Planning{color:#e2f3fc;background:#0a2030;border:1px solid #426c84;margin:12px 0;padding:14px;border-radius:16px}#v187Planning.hide{display:none}#v187Planning .v187row{display:flex;align-items:end;gap:8px;flex-wrap:wrap;margin:8px 0}#v187Planning label{display:grid;gap:4px;min-width:125px;flex:1;font-size:.7rem}#v187Planning input,#v187Planning select,#v187Planning textarea{padding:9px;background:#071722;border:1px solid #426377;border-radius:8px;color:white;width:100%}#v187Planning button{min-height:40px;padding:8px 12px}#v187Planning .v187item{display:grid;grid-template-columns:100px 105px 100px 100px 1fr 1fr auto;gap:6px;align-items:end;margin:6px 0}#v187Planning .v187item input,#v187Planning .v187item select{min-width:0}#v187Planning h3{color:#ffdd7c;margin-top:16px}#v187Planning .v187requests article{border-bottom:1px solid #315265;padding:10px}#v187Planning .v187locked{background:#563710;color:#fff1ce;padding:8px;border-radius:8px}#v187Planning .v187info{font-size:.73rem;color:#b5cdda}#v187Planning .v187actions{display:flex;flex-wrap:wrap;gap:7px}@media(max-width:850px){#v187Planning .v187item{grid-template-columns:repeat(2,minmax(0,1fr))}#v187Planning .v187item>button{grid-column:span 2}}';
  document.head.append(css);
  const root=document.createElement('section');root.id='v187Planning';
  root.innerHTML='<h2>📆 Planning collaboratif — nouvelles publications</h2><p class="v187info">Les brouillons sont invisibles aux conducteurs. Ce module n’écrase pas les anciens plannings.</p><div id="v187Status" role="status"></div>'+
    '<div class="v187row"><label>Conducteur<select id="v187Driver"></select></label><label>Date<input type="date" id="v187Date"></label><button id="v187Load">Ouvrir la journée</button><button id="v187Lock">🔒 Verrouiller</button><button id="v187Unlock">Libérer le verrou</button></div>'+
    '<div id="v187LockStatus" class="v187locked">Lecture seule · prendre un verrou pour modifier</div>'+
    '<h3>Journée préparée</h3><div id="v187Items"></div><div class="v187actions"><button id="v187Import">Importer le planning existant</button><button id="v187Add">＋ Activité</button><button id="v187Draft">Enregistrer brouillon</button><button id="v187Validate">Valider</button><button id="v187Publish">Publier au conducteur</button></div>'+
    '<p id="v187Official" class="v187info"></p><div class="v187actions"><button id="v187VehicleException">Exception véhicule ponctuelle</button></div><h3>Modification d’un planning déjà communiqué</h3><label>Motif précis de la modification proposée<textarea id="v187Summary" rows="2" placeholder="Jeudi : prise de service à 07:10 au lieu de 08:00…"></textarea></label><div class="v187actions"><button id="v187Propose">Envoyer au conducteur pour accord</button></div>'+
    '<h3>Publication par période et destinataires</h3><div class="v187row"><label>Du<input id="v187From" type="date"></label><label>Au<input id="v187To" type="date"></label><label>Conducteurs (Ctrl/clic multiple)<select id="v187Recipients" multiple size="4"></select></label><button id="v187PublishPeriod">Publier les brouillons validés sélectionnés</button></div>'+
    '<h3>Modifications en attente / historique</h3><button id="v187Reload">↻ Actualiser la toolbox</button><div id="v187Changes" class="v187requests"></div><h3>Journal d’audit</h3><div id="v187Audit" class="v187requests"></div>';
  const host=q('v157OpsView');host.insertAdjacentElement('afterend',root);
  root.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;
    const actions={v187Load:loadDay,v187Lock:takeLock,v187Unlock:releaseLock,v187Import:importLegacy,v187Add:addItem,v187Draft:saveDraft,v187Validate:validate,v187Publish:publish,v187Propose:propose,v187Reload:loadToolbox,v187PublishPeriod:publishPeriod,v187VehicleException:vehicleException};
    if(actions[b.id])actions[b.id]().catch(error);
    if(b.dataset.remove!==undefined){if(!hasLock())return error(Error('Verrou requis'));P.items.splice(Number(b.dataset.remove),1);renderItems()}
    if(b.dataset.finalize)finalize(b.dataset.finalize).catch(error);
    if(b.dataset.cancel)cancelChange(b.dataset.cancel).catch(error);
  });
  root.addEventListener('change',ev=>{if(ev.target.id==='v187Driver')P.driver=ev.target.value;if(ev.target.id==='v187Date')P.date=ev.target.value});
  q('v187Date').value=P.date;q('v187From').value=P.date;q('v187To').value=P.date;
  loadDrivers().then(()=>loadToolbox()).catch(error);
  setupRealtime();
 }
 function hasLock(){return !!P.lock && !!P.lock.id && P.lock.date===P.date}
 function showLock(){
  const el=q('v187LockStatus');if(!el)return;
  el.textContent=hasLock()?'🔒 Verrou détenu pour '+P.date+' · autres exploitants en lecture seule':'🔎 Lecture seule · demander le verrou pour modifier';
  el.style.background=hasLock()?'#133c2b':'#51361b';
  for(const b of ['v187Draft','v187Validate','v187Publish','v187Propose','v187Import','v187Add'])
   if(q(b))q(b).disabled=!hasLock();
 }
 async function loadDrivers(){
  const {data,error}=await client().from('profiles').select('user_id,display_name,matricule').eq('organization_id',org()).eq('role','driver').order('display_name');
  if(error)throw error;P.drivers=data||[];
  const opts=P.drivers.map(d=>'<option value="'+esc(d.user_id)+'">'+esc(d.display_name||d.matricule)+'</option>').join('');
  q('v187Driver').innerHTML=opts;q('v187Recipients').innerHTML=opts;
  P.driver=P.drivers.some(d=>d.user_id===P.driver)?P.driver:P.drivers[0]?.user_id||null;
  q('v187Driver').value=P.driver||'';
 }
 async function takeLock(){
  P.date=val('v187Date');if(!P.date)throw Error('Choisir une date');
  if(P.lock&&P.lock.date!==P.date)await releaseLock();
  const name=profile()?.display_name||profile()?.matricule||'Exploitation';
  const answer=await call('saeiv_acquire_lock',{p_start:P.date,p_end:P.date,p_name:name});
  if(!answer.ok){q('v187LockStatus').textContent='En cours de modification par '+answer.owner+' depuis '+new Date(answer.since).toLocaleTimeString('fr-FR');P.lock=null;showLock();return}
  P.lock={id:answer.id,date:P.date};
  clearInterval(P.heartbeat);
  P.heartbeat=setInterval(async()=>{try{if(!await call('saeiv_heartbeat_lock',{p_id:P.lock?.id})) {P.lock=null;showLock();status('Verrou expiré. Reprendre le verrou.',true)}}catch{P.lock=null;showLock()}},25000);
  showLock();status('Verrou acquis');await loadDay();
 }
 async function releaseLock(){
  clearInterval(P.heartbeat);P.heartbeat=null;const lock=P.lock;P.lock=null;showLock();
  if(lock)await call('saeiv_release_lock',{p_id:lock.id,p_force:false});status('Verrou libéré');
 }
 async function loadDay(){
  if(!client()||!P.driver)return;
  P.date=val('v187Date')||today();P.driver=val('v187Driver');
  if(P.lock&&P.lock.date!==P.date)await releaseLock();
  const [draft,official]=await Promise.all([
    select('saeiv_planning_days',{driver_user_id:P.driver,service_date:P.date}),
    select('saeiv_published_days',{driver_user_id:P.driver,service_date:P.date})]);
  P.draft=draft[0]||null;P.official=official[0]||null;
  P.items=structuredClone(P.draft?.items||P.official?.items||[]);
  q('v187Official').textContent=P.official?'Planning officiel publié · révision '+P.official.revision+' du '+new Date(P.official.published_at).toLocaleString('fr-FR'):'Aucune première publication pour cette journée';
  renderItems();showLock();
  status((P.draft?'Brouillon : '+P.draft.status:'Aucun brouillon')+' · '+(P.official?'Officiel présent':'Non publié'));
 }
 function renderItems(){
  const el=q('v187Items');if(!el)return;el.replaceChildren();
  P.items.forEach((x,i)=>{
   const row=document.createElement('div');row.className='v187item';row.dataset.index=i;
   const fields=[['type','Type','select'],['line','Ligne','text'],['start','Début','time'],['end','Fin','time'],['origin','Départ','text'],['destination','Destination','text']];
   for(const [key,label,type]of fields){
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement(type==='select'?'select':'input');
    if(type==='select')for(const t of ['regular','school','tad','hlp','start','cut','pause','end','annex','other']){
      const o=document.createElement('option');o.value=t;o.textContent=t;input.appendChild(o);
    }else input.type=type;
    input.value=String(x[key]||'');input.disabled=!hasLock();
    input.addEventListener('change',()=>{x[key]=input.value});
    wrap.appendChild(input);row.appendChild(wrap);
   }
   const del=document.createElement('button');del.textContent='Retirer';del.dataset.remove=i;del.disabled=!hasLock();row.appendChild(del);el.appendChild(row);
  });
  if(!P.items.length)el.textContent='Aucune activité. Importer le planning existant ou ajouter une activité.';
 }
 function addItem(){if(!hasLock())throw Error('Verrou requis');P.items.push({id:crypto.randomUUID(),date:P.date,type:'regular',line:'',start:'08:00',end:'09:00',origin:'',destination:'',label:'',notes:''});renderItems()}
 async function importLegacy(){
  if(!hasLock())throw Error('Verrou requis');
  const {data,error}=await client().from('plan_items').select('*').eq('organization_id',org()).eq('driver_user_id',P.driver).eq('service_date',P.date).order('sort_index');if(error)throw error;
  P.items=(data||[]).map(x=>({...x.payload,id:x.client_id||x.id,date:P.date,type:x.type,line:x.line||'',label:x.label||'',start:(x.start_time||'').slice(0,5),end:(x.end_time||'').slice(0,5),origin:x.origin||'',destination:x.destination||'',linked:x.linked||null,source:x.source}));
  renderItems();status('Planning historique copié localement en brouillon · publication séparée');
 }
 async function saveDraft(){
  if(!hasLock()||!P.driver)throw Error('Prendre le verrou et choisir un conducteur');
  const row={organization_id:org(),driver_user_id:P.driver,service_date:P.date,items:P.items,status:'draft',updated_by:cloud()?.user?.id};
  const {error}=await client().from('saeiv_planning_days').upsert(row,{onConflict:'organization_id,driver_user_id,service_date'});
  if(error)throw error;await loadDay();status('Brouillon enregistré (invisible côté conducteur)');
 }
 async function validate(){
  if(!hasLock())throw Error('Verrou requis');
  if(!P.draft)await saveDraft();
  if(P.draft.status!=='draft')throw Error('Pour modifier un brouillon validé, enregistrer d’abord ses changements');
  await call('saeiv_validate_day',{p_day:P.draft.id});await loadDay();status('Brouillon validé, non publié');
 }
 async function publish(){
  if(!hasLock())throw Error('Verrou requis');
  if(P.official)throw Error('Planning déjà communiqué. Envoyer une proposition et attendre la réponse du conducteur.');
  if(P.draft?.status!=='validated')throw Error('Valider avant de publier');
  await call('saeiv_publish_first_day',{p_day:P.draft.id});await loadDay();await loadToolbox();
  status('Première publication faite : le conducteur peut consulter le planning');
 }
 async function propose(){
  if(!hasLock())throw Error('Verrou requis');
  if(!P.official)throw Error('Cette journée n’a pas encore été publiée. Utiliser Première publication.');
  const summary=val('v187Summary').trim();if(!summary)throw Error('Préciser le changement proposé');
  await call('saeiv_propose_change',{p_driver:P.driver,p_date:P.date,p_items:P.items,p_summary:summary});
  await loadToolbox();status('Proposition envoyée, ancien planning conservé jusqu’à validation exploitation');
 }
 async function vehicleException(){
  if(!hasLock())throw Error('Verrou requis pour une exception véhicule');
  const lines=await select('saeiv_company_lines',{});
  if(!lines.length)throw Error('Configurer les lignes exploitées en Administration');
  const answer=prompt('Choisir le numéro de la ligne parmi :\n'+lines.map((l,i)=>(i+1)+' : '+l.department+' '+l.line_code).join('\n'),'1');if(answer===null)return;
  const l=lines[Number(answer)-1];if(!l)throw Error('Ligne invalide');
  const type=prompt('Type exceptionnel : bus, minibus ou van','bus');if(type===null)return;
  if(!['bus','minibus','van'].includes(type))throw Error('Type invalide');
  const reason=prompt('Motif de cette exception pour le '+P.date,'Exception exploitation');if(reason===null)return;
  const {error}=await client().from('saeiv_vehicle_exceptions').insert({organization_id:org(),line_id:l.id,service_date:P.date,vehicle_type:type,reason,created_by:cloud()?.user?.id});if(error)throw error;
  status('Exception véhicule enregistrée pour '+l.line_code);
 }
 async function publishPeriod(){
  const start=val('v187From'),end=val('v187To'),targets=[...q('v187Recipients').selectedOptions].map(x=>x.value);
  if(!start||!end||end<start||!targets.length)throw Error('Période et conducteurs obligatoires');
  const dates=[],cursor=new Date(start+'T12:00:00'),limit=new Date(end+'T12:00:00');
  while(cursor<=limit&&dates.length<32){dates.push([cursor.getFullYear(),String(cursor.getMonth()+1).padStart(2,'0'),String(cursor.getDate()).padStart(2,'0')].join('-'));cursor.setDate(cursor.getDate()+1)}
  if(cursor<=limit)throw Error('Maximum 32 jours par lot');
  let ok=0,skipped=0;
  for(const day of dates){
   const answer=await call('saeiv_acquire_lock',{p_start:day,p_end:day,p_name:profile()?.display_name||'Exploitation'});
   if(!answer.ok){skipped+=targets.length;continue}
   try{
    for(const driver_user_id of targets){
     const [draft]=await select('saeiv_planning_days',{driver_user_id,service_date:day}),[published]=await select('saeiv_published_days',{driver_user_id,service_date:day});
     if(!draft||draft.status!=='validated'||published){skipped++;continue}
     await call('saeiv_publish_first_day',{p_day:draft.id});ok++;
    }
   }finally{await call('saeiv_release_lock',{p_id:answer.id,p_force:false})}
  }
  await loadToolbox();status('Premières publications : '+ok+' ; ignorées (non validées/déjà publiées/verrouillées) : '+skipped);
 }
 async function loadToolbox(){
  if(!ready()||!q('v187Changes'))return;
  const [changes,audit,locks]=await Promise.all([
   select('saeiv_change_requests',{}),select('saeiv_planning_audit',{}),select('saeiv_planning_locks',{})]);
  P.changes=changes.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const names=Object.fromEntries(P.drivers.map(d=>[d.user_id,d.display_name||d.matricule]));
  q('v187Changes').innerHTML=P.changes.slice(0,70).map(x=>'<article><b>'+esc(names[x.driver_user_id]||'Conducteur')+' · '+esc(x.service_date)+' · '+esc(x.status.toUpperCase())+'</b><div>'+esc(x.summary)+'</div><small>Envoyée '+new Date(x.created_at).toLocaleString('fr-FR')+' · Vue '+(x.seen_at?new Date(x.seen_at).toLocaleString('fr-FR'):'non')+' · Réponse '+(x.response_at?new Date(x.response_at).toLocaleString('fr-FR'):'attendue')+'</small> <span>'+(x.status==='accepted'?'<button data-finalize="'+esc(x.id)+'">Valider et publier la modification</button>':'')+(x.status==='pending'||x.status==='accepted'?'<button data-cancel="'+esc(x.id)+'">Annuler</button>':'')+'</span></article>').join('')||'<p>Aucune modification.</p>';
  q('v187Audit').innerHTML=audit.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,30).map(x=>'<article>'+esc(x.event)+' · '+esc(x.service_date||'')+' · '+new Date(x.at).toLocaleString('fr-FR')+'</article>').join('')||'<p>Aucun évènement.</p>';
  const occupied=locks.filter(x=>new Date(x.expires_at)>new Date()&&x.owner_id!==cloud()?.user?.id);
  if(occupied.length&&!hasLock())q('v187LockStatus').textContent='Édition par '+occupied[0].owner_name+' depuis '+new Date(occupied[0].acquired_at).toLocaleTimeString('fr-FR');
 }
 async function finalize(id){
  const [req]=P.changes.filter(x=>x.id===id);if(!req)return;
  const lock=await call('saeiv_acquire_lock',{p_start:req.service_date,p_end:req.service_date,p_name:profile()?.display_name||'Exploitation'});
  if(!lock.ok)throw Error('En cours de modification par '+lock.owner);
  try{await call('saeiv_finalize_change',{p_change:id})}finally{await call('saeiv_release_lock',{p_id:lock.id,p_force:false})}
  await loadToolbox();if(P.driver===req.driver_user_id&&P.date===req.service_date)await loadDay();status('Modification acceptée puis validée et publiée par exploitation');
 }
 async function cancelChange(id){if(!confirm('Annuler cette proposition de modification ?'))return;await call('saeiv_cancel_change',{p_change:id});await loadToolbox();status('Proposition annulée')}
 function setupRealtime(){
  if(P.subscription||!ready())return;
  P.subscription=client().channel('saeiv-planning-org-'+org());
  for(const table of ['saeiv_planning_days','saeiv_planning_locks','saeiv_published_days','saeiv_change_requests','saeiv_notifications']){
   P.subscription.on('postgres_changes',{event:'*',schema:'public',table,filter:'organization_id=eq.'+org()},()=>{loadToolbox().catch(()=>{});if(table==='saeiv_planning_days'||table==='saeiv_published_days')loadDay().catch(()=>{})});
  }
  P.subscription.subscribe();
 }
 function tick(){
  if(!ready()||!q('v157Dispatch'))return;
  install();
  const box=q('v187Planning'),ops=q('v157OpsView');if(box&&ops){box.classList.toggle('hide',ops.classList.contains('hidden'))}
 }
 window.addEventListener('pagehide',()=>{clearInterval(P.heartbeat)});
 async function generateDraft(){
  if(!hasLock())throw Error('Verrouiller d’abord la journée du planning');
  const board=window.MonSAEIVOperationsBoardV165,engine=window.MonSAEIVGenerationEngineV167;
  if(!board?.refresh||!engine?.scoreCandidate)throw Error('Moteur de génération indisponible');
  if(!window.MonSAEIVSmartRestV177?.weeklyRestCheck)throw Error('Contrôle repos indisponible : génération bloquée par sécurité');
  const date=P.date,sourceDate=q('v165Date');
  if(sourceDate&&sourceDate.value!==date){sourceDate.value=date;sourceDate.dispatchEvent(new Event('change',{bubbles:true}))}
  await board.refresh();
  const segments=board.segments||[];if(!segments.length)throw Error('Aucune course GTFS chargée pour ce jour');
  const startHistory=new Date(date+'T12:00:00Z');startHistory.setUTCDate(startHistory.getUTCDate()-28);
  const fromHistory=startHistory.toISOString().slice(0,10);
  const [drivers,settings,existing,drafts,published,lines,rules,exceptions,history,unavailable,historicalPublished]=await Promise.all([
   client().from('profiles').select('user_id,matricule,display_name,active,depot_id,weekly_contract_minutes').eq('organization_id',org()).eq('role','driver').eq('active',true).then(x=>{if(x.error)throw x.error;return x.data||[]}),
   select('driver_settings',{}),select('plan_items',{service_date:date}),
   select('saeiv_planning_days',{service_date:date}),select('saeiv_published_days',{service_date:date}),
   select('saeiv_company_lines',{}),select('saeiv_vehicle_rules',{}),select('saeiv_vehicle_exceptions',{service_date:date}),
   client().from('plan_items').select('driver_user_id,service_date,type,start_time,end_time,source,payload').eq('organization_id',org()).gte('service_date',fromHistory).lte('service_date',date).then(x=>{if(x.error)throw x.error;return x.data||[]}),
   select('driver_unavailability',{service_date:date}),
   client().from('saeiv_published_days').select('driver_user_id,service_date,items').eq('organization_id',org()).gte('service_date',fromHistory).lte('service_date',date).then(x=>{if(x.error)throw x.error;return x.data||[]})
  ]);
  const settingsBy=new Map(settings.map(x=>[x.user_id,x])),draftBy=new Map(drafts.map(x=>[x.driver_user_id,x]));
  const historyWork=[...history];
  for(const day of historicalPublished){if(day.service_date===date)continue;for(const item of day.items||[])historyWork.push({driver_user_id:day.driver_user_id,service_date:day.service_date,type:item.type||'regular',start_time:item.start||item.start_time,end_time:item.end||item.end_time,source:'dispatch',payload:item})}
  const absenceCheck=(driver,seg,current)=>{
   const absolute=history.some(x=>x.driver_user_id===driver&&x.service_date===date&&(
    ['rh','cp'].includes(String(x.type||'').toLowerCase())||['RH','CP'].includes(String(x.payload?.absence_kind||'').toUpperCase())));
   if(absolute)return false;
   const toMin=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
   const overlap=(a,b,c,d)=>{const vals=[a,b,c,d].map(toMin);return vals.every(Number.isFinite)&&vals[0]<vals[3]&&vals[1]>vals[2]};
   return !unavailable.some(x=>x.driver_user_id===driver&&(overlap(seg.start,seg.end,x.start_time,x.end_time)||current.some(y=>overlap(y.start,y.end,x.start_time,x.end_time))));
  };
  const publishedIds=new Set(published.map(x=>x.driver_user_id));
  const eligible=drivers.filter(d=>!publishedIds.has(d.user_id));
  if(!eligible.length)throw Error('Toutes les journées sont déjà publiées : les changements doivent faire l’objet d’un accord');
  const activities=new Map(eligible.map(d=>[d.user_id,Array.isArray(draftBy.get(d.user_id)?.items)?
   structuredClone(draftBy.get(d.user_id).items):
   existing.filter(x=>x.driver_user_id===d.user_id).map(x=>({...x.payload,id:x.client_id||x.id,date,type:x.type,line:x.line,
    start:String(x.start_time||'').slice(0,5),end:String(x.end_time||'').slice(0,5),origin:x.origin||'',destination:x.destination||'',
    originCoords:x.origin_coords||null,destinationCoords:x.destination_coords||null,linked:x.linked||null,driveMinutes:x.drive_minutes||0}))]));
  const used=new Set();
  for(const activitiesDay of activities.values())for(const a of activitiesDay){if(a.segment_id)used.add(String(a.segment_id));if(a.linked?.tripId)used.add(String(a.linked.tripId))}
  const activeLines=lines.filter(x=>x.active&&(x.start_date<=date)&&(!x.end_date||x.end_date>=date));
  const key=x=>String(x||'').replace(/\s+/g,'').toUpperCase();
  const allowed=seg=>!lines.length||activeLines.some(l=>l.department===String(seg.dept||seg.linked?.dept||'')&&key(l.line_code)===key(seg.line));
  const choseVehicle=seg=>{
   const l=activeLines.find(l=>l.department===String(seg.dept||'')&&key(l.line_code)===key(seg.line));
   if(!l)return 'bus';
   const exception=exceptions.find(x=>x.line_id===l.id);if(exception)return exception.vehicle_type;
   const r=rules.filter(x=>x.line_id===l.id);
   if(!r.length)return 'bus';
   const chosen=['van','minibus','bus'].find(t=>r.some(x=>x.vehicle_type===t&&x.policy==='preferred')) ||
     ['bus','minibus','van'].find(t=>r.some(x=>x.vehicle_type===t&&x.policy==='required')) ||
     ['bus','minibus','van'].find(t=>r.some(x=>x.vehicle_type===t&&x.policy==='allowed')) ;
   return chosen||null;
  };
  let assigned=0,unplaced=0,restricted=0;
  for(const seg of segments){
   if(used.has(String(seg.id))||used.has(String(seg.tripId||'')))continue;
   if(!allowed(seg)){restricted++;continue}
   const vehicleType=choseVehicle(seg);if(!vehicleType){restricted++;continue}
   const ranked=[];
   for(const driver of eligible){
    const day=activities.get(driver.user_id),setting=settingsBy.get(driver.user_id);
    const scoring=engine.scoreCandidate(seg,driver,day.filter(x=>['regular','school','tad'].includes(x.type)),setting||{},{compactOnly:false});
    if(!scoring.ok||!absenceCheck(driver.user_id,seg,day)||day.some(x=>['rh','cp'].includes(String(x.type||'').toLowerCase())))continue;
    const rank=engine.planningRank(day.filter(x=>['regular','school','tad'].includes(x.type)),setting||{},scoring);
    const dailyTarget=Number(driver.weekly_contract_minutes)>0?Number(driver.weekly_contract_minutes)/5:420;
    const nextDay=[...day.filter(x=>['regular','school','tad'].includes(x.type)),seg];
    const rest=window.MonSAEIVSmartRestV177?.weeklyRestCheck?.({history:historyWork,driverId:driver.user_id,date,activities:nextDay,
      park:setting?.bus_parking,compactOnly:!!day.length,alreadyWorkingToday:!!day.length})||{ok:true,penalty:0};
    if(!rest.ok)continue;
    const contractPenalty=Math.abs(Number(scoring.economy?.work||0)-dailyTarget)*20;
    ranked.push({driver,rank,contractPenalty:contractPenalty+Number(rest.penalty||0)});
   }
   ranked.sort((a,b)=>a.rank.dayTier-b.rank.dayTier||a.contractPenalty-b.contractPenalty||a.rank.compactPenalty-b.rank.compactPenalty||a.rank.incremental-b.rank.incremental);
   if(!ranked.length){unplaced++;continue}
   const target=ranked[0].driver.user_id;
   activities.get(target).push({id:'gtfs-'+String(seg.id),segment_id:String(seg.id),date,type:seg.type||'regular',
    line:String(seg.line||''),dept:String(seg.dept||''),start:seg.start,end:seg.end,
    origin:seg.origin||'',destination:seg.destination||'',originCoords:seg.originCoords||null,
    destinationCoords:seg.destinationCoords||null,driveMinutes:Number(seg.driveMinutes||0),
    linked:seg.linked||null,vehicle_type:vehicleType,regime:'eu561',source:'auto_service'});
   used.add(String(seg.id));assigned++;
  }
  let written=0;for(const [driver_user_id,items]of activities){
   if(!items.length)continue;
   const existingDraft=draftBy.get(driver_user_id);
   if(existingDraft?.status==='published')continue;
   const {error}=await client().from('saeiv_planning_days').upsert({
    organization_id:org(),driver_user_id,service_date:date,items,status:'draft',updated_by:cloud()?.user?.id
   },{onConflict:'organization_id,driver_user_id,service_date'});
   if(error)throw error;written++;
  }
  await loadDay();
  status('Pré-génération enregistrée en BROUILLONS · '+assigned+' courses affectées · '+unplaced+' non placées · '+restricted+' hors périmètre/contraintes · '+written+' journées. Contrôle RSE serveur requis avant validation définitive.');
 }

 function appendCollective(tasks){if(!hasLock())throw Error('Verrou obligatoire');if(P.official)throw Error('Planning déjà publié');for(const t of tasks){const i=P.items.findIndex(x=>x.id===t.id);if(i<0)P.items.push(t);else P.items[i]=t}renderItems();}
 window.MonSAEIVPlanningV187={installed:true,install,loadDay,loadToolbox,generateDraft,appendCollective,get state(){return P}};
 setInterval(tick,1300);
})();