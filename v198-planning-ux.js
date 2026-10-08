'use strict';
/* SAEIV 1.1.00 — simple planning actions in the actual dispatch grid, not a competing editor. */
(()=>{
 if(window.MonSAEIVPlanningUXV198?.installed)return;
 const q=id=>document.getElementById(id),board=()=>window.MonSAEIVOperationsBoardV165,
 planner=()=>window.MonSAEIVPlanningV187,cloud=()=>window.MonSAEIVCloudV156,db=()=>cloud()?.client;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const D={driver:null,busy:false,simplified:false};
 const status=(msg,problem=false)=>{const n=q('v198Status');if(n){n.textContent=msg;n.style.color=problem?'#ffc4ac':'#bbf2d1'}};
 const dates=(date,delta)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10)};
 const hasWork=items=>(items||[]).some(x=>['regular','school','tad','annex','other'].includes(x.type));
 async function restCheck(driverId,date){
  const org=cloud()?.profile?.organization_id,lo=dates(date,-6),hi=dates(date,6);
  const [drafts,published]=await Promise.all([
   db().from('saeiv_planning_days').select('service_date,items').eq('organization_id',org).eq('driver_user_id',driverId).gte('service_date',lo).lte('service_date',hi),
   db().from('saeiv_published_days').select('service_date,items').eq('organization_id',org).eq('driver_user_id',driverId).gte('service_date',lo).lte('service_date',hi)
  ]);
  if(drafts.error)throw drafts.error;if(published.error)throw published.error;
  const days=new Map((drafts.data||[]).map(x=>[x.service_date,hasWork(x.items)]));
  for(const x of published.data||[])days.set(x.service_date,hasWork(x.items));
  if(!days.get(date))return;
  for(let i=-6;i<=0;i++){let streak=0;for(let k=i;k<i+7;k++){if(days.get(dates(date,k)))streak++;else break}
   if(streak===7)throw Error('Sept journées travaillées consécutives détectées pour ce conducteur. Programmer son repos puis vérifier les exigences réglementaires avant de valider.')}
 }
 async function checkService(driverId,date){
  const {data,error}=await db().from('driver_settings').select('bus_parking').eq('organization_id',cloud().profile.organization_id).eq('user_id',driverId).maybeSingle();
  if(error)throw error;
  const engine=window.MonSAEIVServiceBlocksV197;
  if(!engine?.compose)throw Error('Calcul des prises de service/HLP indisponible');
  const result=engine.compose(planner().state.items,data?.bus_parking,date);
  if(result.issues.length)throw Error('Service incomplet : '+result.issues.slice(0,3).join(' ; ')+'. Corriger avant validation.');
  await restCheck(driverId,date);
 }
 function labelFor(id){const d=board()?.drivers.find(x=>String(x.user_id)===String(id));return d?.display_name||d?.matricule||'Conducteur'}
 function update(){
  const root=q('v198Controls'),b=board();if(!root||!b)return;
  const drafts=b.draftDriverIds||[],official=b.officialDriverIds||[],date=b.date||'';
  q('v198DateSummary').textContent='Planning du '+date+' · '+drafts.length+' conducteur(s) avec brouillon · '+official.length+' planning(s) déjà communiqué(s).';
  const id=D.driver,picked=q('v198Selected');
  if(!id){picked.hidden=true;return}
  const driver=b.drivers.find(x=>String(x.user_id)===String(id));
  if(!driver){D.driver=null;picked.hidden=true;return}
  picked.hidden=false;
  const state=official.map(String).includes(String(id))?'publié':drafts.map(String).includes(String(id))?'brouillon':'non préparé';
  q('v198SelectedTitle').textContent=labelFor(id)+' · '+date+' · '+state;
  q('v198SelectedHelp').textContent=state==='publié'?'Planning communiqué : choisir la course concernée et celle qui doit la remplacer. Le conducteur donnera son accord.':state==='brouillon'?'Travail en cours : modifier les courses directement, puis valider et publier.':'Aucun brouillon : utiliser Construire ou Générer.';
  q('v198Build').hidden=state==='publié';
  q('v198Validate').hidden=state!=='brouillon';
  q('v198Publish').hidden=state!=='brouillon';
  q('v198EditPublished').hidden=state!=='publié';
  root.querySelectorAll('[data-v198-driver-id]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v198DriverId===id)));
  document.querySelectorAll('#v165Grid .v165-driver-row').forEach(row=>row.classList.toggle('v198-picked',row.querySelector('[data-v198-driver-id]')?.dataset.v198DriverId===id));
 }
 function choose(id){D.driver=id;update();q('v198Controls')?.scrollIntoView({behavior:'smooth',block:'nearest'})}
 async function editPublished(){
  if(!D.driver||!board()?.officialDriverIds?.includes(D.driver))throw Error('Ce planning n’est pas encore publié. Ouvrir Construire.');
  if(!board().segments.length)await board().loadSegments();
  if(!window.MonSAEIVSegmentChangeV195?.open)throw Error('Sélecteur des courses indisponible');
  await window.MonSAEIVSegmentChangeV195.open({driver_user_id:D.driver,service_date:board().date});
 }
 async function validateOrPublish(mode,id=D.driver){
  if(!id)throw Error('Cliquer d’abord sur un conducteur dans le tableau');
  const p=planner(),date=board().date;
  if(!p?.openDriverDraft)throw Error('Gestion des brouillons indisponible');
  if(board().officialDriverIds?.includes(String(id)))throw Error('Planning déjà publié : les changements exigent l’accord du conducteur.');
  if(D.busy)throw Error('Une autre opération est en cours');
  D.busy=true;let locked=false;
  try{
   status((mode==='validate'?'Vérification':'Publication')+' · '+labelFor(id)+' · '+date);
   const state=await p.openDriverDraft(id,date);locked=true;
   if(!state.draft)throw Error('Aucun brouillon enregistré. Construire le planning en premier.');
   if(mode==='validate'){
    if(state.draft.status==='validated'){status('Ce brouillon est déjà validé. Il peut être publié.');return}
    if(state.draft.status!=='draft')throw Error('Brouillon dans un état non modifiable');
    await checkService(id,date);
    await p.saveDraft(); // regenerate missing service markers on older drafts before validation
    await p.validate();
    status('Planning du '+date+' validé pour '+labelFor(id)+'. Il reste NON communiqué tant que tu ne cliques pas sur Publier.');
   }else{
    if(state.draft.status!=='validated')throw Error('Ce brouillon n’est pas encore validé : cliquer d’abord sur Valider.');
    await restCheck(id,date);
    if(!confirm('Publier le planning VALIDÉ du '+date+' à '+labelFor(id)+' ? Le conducteur le verra. Toute modification suivante nécessitera son accord.'))return;
    await p.publish();
    status('Planning communiqué au conducteur. Les modifications suivantes exigeront son accord.');
   }
  }finally{
   try{if(locked)await p.releaseLock()}catch(e){console.warn('[SAEIV] verrou',e)}
   D.busy=false;try{await board().refresh()}catch(e){status('Action effectuée, mais actualisation impossible : '+e.message,true)}
   update();
  }
 }
 async function bulkDay(mode){
  if(D.busy)throw Error('Une validation ou publication est déjà en cours');
  if(!db()||!board()?.date)throw Error('Planning indisponible');
  const date=board().date,organization_id=cloud().profile.organization_id;
  const {data,error}=await db().from('saeiv_planning_days').select('driver_user_id,status,items').eq('organization_id',organization_id).eq('service_date',date);
  if(error)throw error;
  const official=new Set(board().officialDriverIds||[]);
  const eligible=(data||[]).filter(x=>!official.has(x.driver_user_id)&&hasWork(x.items));
  if(mode==='publish'&&eligible.some(x=>x.status==='draft'))throw Error('Il reste '+eligible.filter(x=>x.status==='draft').length+' brouillon(s) non validé(s). Valide-les avant de publier la journée.');
  const target=eligible.filter(x=>mode==='validate'?x.status==='draft':x.status==='validated');
  if(!target.length)throw Error(mode==='validate'?'Aucun brouillon à valider pour cette journée.':'Aucun planning validé à publier pour cette journée.');
  if(!confirm((mode==='validate'?'Valider ':'PUBLIER ET COMMUNIQUER ')+target.length+' planning(s) pour le '+date+' ? '+(mode==='publish'?'Les conducteurs recevront leur planning, toute nouvelle modification nécessitera leur accord.':'Les services seront contrôlés un par un ; les journées présentant des anomalies resteront en brouillon.')))return;
  D.busy=true;let ok=0;const failures=[],p=planner();
  try{
   for(const row of target){
    let locked=false;
    try{
     status((mode==='validate'?'Validation':'Publication')+' de la journée · '+(ok+failures.length+1)+' / '+target.length+' · '+labelFor(row.driver_user_id));
     const state=await p.openDriverDraft(row.driver_user_id,date);locked=true;
     if(mode==='validate'){
      await checkService(row.driver_user_id,date);
      await p.saveDraft();await p.validate();
     }else{
      if(state.draft?.status!=='validated')throw Error('Brouillon non validé');
      await restCheck(row.driver_user_id,date);await p.publish();
     }
     ok++;
    }catch(e){failures.push(labelFor(row.driver_user_id)+' : '+(e.message||String(e)))}
    finally{try{if(locked)await p.releaseLock()}catch(e){failures.push('Verrou : '+e.message)}}
    await new Promise(r=>setTimeout(r,0));
   }
  }finally{
   D.busy=false;try{await board().refresh()}catch(e){failures.push('Actualisation : '+e.message)}
   update();
   const message=(mode==='validate'?'Validés':'Publiés')+' : '+ok+'/'+target.length+'.'+(failures.length?' Non traités : '+failures.slice(0,5).join(' ; ')+(failures.length>5?' · '+(failures.length-5)+' autre(s)':''):'');
   status(message,failures.length>0);
  }
 }

 async function runSelected(action){
  if(!D.driver)throw Error('Choisir un conducteur');
  if(action==='build')await window.MonSAEIVWeeklyV190.build(D.driver);
  if(action==='edit')await editPublished();
  if(action==='validate'||action==='publish')await validateOrPublish(action);
 }
 function simplifyAdvanced(){
  const root=q('v187Planning');if(!root||root.dataset.v198Simple)return;
  root.dataset.v198Simple='1';
  root.querySelector('h2').textContent='📨 Suivi des modifications de planning';
  const sub=root.querySelector('p.v187info');if(sub)sub.textContent='Suivez ici les demandes envoyées aux conducteurs et leurs réponses. La construction et la validation se font directement dans le tableau de planning.';
  const heading=[...root.querySelectorAll('h3')].find(x=>x.textContent.includes('Réaffectations groupées'));
  if(heading){
   const details=document.createElement('details');details.id='v198Advanced';
   const summary=document.createElement('summary');summary.textContent='Outils avancés (verrous, exceptions, publications groupées)';details.append(summary);
   let el=root.querySelector('#v187Status')?.nextElementSibling;
   while(el&&el!==heading){const next=el.nextElementSibling;details.append(el);el=next}
   root.insertBefore(details,heading);
   heading.textContent='Changements touchant plusieurs conducteurs';
   const p=document.createElement('p');p.className='v187info';p.textContent='Lorsqu’un service est réaffecté à plusieurs conducteurs, chacun doit accepter. Un refus bloque la republication de l’ensemble.';heading.insertAdjacentElement('afterend',p);
  }
  for(const h of root.querySelectorAll('h3')){
   if(h.textContent.includes('Modifications en attente'))h.textContent='Demandes envoyées et réponses';
   if(h.textContent.includes('Journal d’audit'))h.textContent='Historique des actions';
  }
 }
 function install(){
  const b=q('v165Board');if(!b||q('v198Controls')){simplifyAdvanced();return}
  const css=document.createElement('style');css.textContent='#v198Controls{margin:8px 0;border:1px solid #4a7186;border-radius:14px;background:#0b2432;padding:12px;color:#e7f5fc}#v198Controls .actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}#v198Controls button{padding:9px;border:1px solid #51788d;border-radius:9px;min-height:38px}#v198Controls button[hidden]{display:none}#v198Controls small{display:block;color:#b0c9d4;margin-top:5px}#v198Controls .chosen{border-top:1px solid #42617a;padding-top:10px;margin-top:12px}#v165Grid .v165-driver-row.v198-picked .v165-driver-meta{background:#163c4c}#v187Planning #v198Advanced{border:1px solid #3b596c;border-radius:11px;padding:9px;margin-top:9px}#v187Planning #v198Advanced summary{cursor:pointer;color:#c9dce6}';
  document.head.append(css);
  const el=document.createElement('section');el.id='v198Controls';
  el.innerHTML='<b>🚌 Tableau de planning</b><p id="v198DateSummary"></p><small>Les plannings en préparation apparaissent directement sur les conducteurs, avec leurs prises de service, HLP, coupures et fins de service estimés. Clique sur un conducteur pour agir.</small>'+
   '<div class="actions"><button id="v198ValidateDay">✅ Valider les brouillons du jour</button><button id="v198PublishDay">📤 Publier les validés du jour</button></div><div class="chosen" id="v198Selected" hidden><b id="v198SelectedTitle"></b><small id="v198SelectedHelp"></small><div class="actions"><button id="v198Build">🧩 Construire / retirer des courses</button><button id="v198Validate">✅ Valider le brouillon</button><button id="v198Publish">📤 Publier au conducteur</button><button id="v198EditPublished">✏️ Modifier une course publiée</button></div></div><p id="v198Status" role="status"></p>';
  const alert=q('v165Alert');alert?.insertAdjacentElement('beforebegin',el);
  for(const [id,action]of [['v198Build','build'],['v198Validate','validate'],['v198Publish','publish'],['v198EditPublished','edit']]){
   q(id).addEventListener('click',()=>runSelected(action).catch(e=>status(e?.message||String(e),true)));
  }
  q('v198ValidateDay').addEventListener('click',()=>bulkDay('validate').catch(e=>status(e?.message||String(e),true)));
  q('v198PublishDay').addEventListener('click',()=>bulkDay('publish').catch(e=>status(e?.message||String(e),true)));
  const oldButton=q('v190Publications');if(oldButton)oldButton.textContent='📨 Suivi des demandes';
  b.addEventListener('click',e=>{const button=e.target.closest('[data-v198-driver-id]');if(button){e.preventDefault();choose(button.dataset.v198DriverId)}});
  window.addEventListener('saeiv-board-updated',update);
  simplifyAdvanced();update();
 }
 window.MonSAEIVPlanningUXV198={installed:true,install,choose,validateOrPublish,bulkDay,editPublished,simplifyAdvanced};
 setInterval(install,1100);
})();