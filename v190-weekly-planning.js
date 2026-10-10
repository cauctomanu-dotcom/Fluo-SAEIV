'use strict';
/* Mon SAEIV 1.0.94 — ONE planning generator, existing exploitation toolbar */
(()=>{
 if(window.MonSAEIVWeeklyV190?.installed)return;
 const q=id=>document.getElementById(id),board=()=>window.MonSAEIVOperationsBoardV165,planner=()=>window.MonSAEIVPlanningV187,cloud=()=>window.MonSAEIVCloudV156;
 const antoniPilot=()=>String(cloud()?.profile?.organization_id||'')==='533814ff-a356-4b65-ba94-c5ca36ce917a';
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const today=()=>new Date().toLocaleDateString('en-CA');
 const plus=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
 const length=(a,b)=>Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000)+1;
 const S={busy:false,counts:new Map(),driver:null,rangeStart:null};
 const from=()=>S.rangeStart||q('v165Date')?.value||today(),to=()=>q('v190End')?.value||from();
 const period=()=>{const a=from(),b=to(),n=length(a,b);if(!Number.isFinite(n)||n<1||n>31)throw Error('Choisir une période de 1 à 31 jours, Du inclus et Au inclus.');return{a,b,n}};
 function notify(msg,bad=false){const e=q('v190Status');if(e){e.textContent=msg;e.style.color=bad?'#ffa7a7':'#b7ffce'}}
 const handle=e=>notify(e?.message||String(e),true);
 function dates(){const {a,n}=period();return Array.from({length:n},(_,i)=>plus(a,i))}
 function ribbon(){const x=q('v190Days');if(!x)return;let ds;try{ds=dates()}catch(e){notify(e.message,true);return}
  const count=ds.length;q('v190Count').textContent=count===1?'Journée unique':count+' journées, du '+ds[0]+' au '+ds[count-1];
  x.innerHTML=count===1?'':ds.map(d=>'<button type="button" data-day="'+d+'" class="'+(d===board()?.date?'active':'')+'">'+d.slice(8)+'/'+d.slice(5,7)+(S.counts.has(d)?' · '+S.counts.get(d):'')+'</button>').join('');
 }
 async function selectDay(date){
  await board().setDate(date);
  await board().loadSegments();
  // Keep the visible date equal to the selected GTFS service day.
  // Previously resetting the input to "Du" after loading another day caused
  // generateDraft to silently switch back to the first day of the period.
  if(!antoniPilot()&&q('v165Date'))q('v165Date').value=from();
  ribbon();
 }
 async function loadPeriod(){if(S.busy)return;const {a,n}=period();S.busy=true;S.counts.clear();q('v165LoadSegments').disabled=true;
  try{for(let i=0;i<n;i++){const day=plus(a,i);notify('Chargement des segments '+(i+1)+'/'+n+' · '+day);await board().setDate(day);await board().loadSegments();S.counts.set(day,board().segments.length);ribbon()}
    await selectDay(a);notify('Segments chargés pour '+n+' journée(s). Cliquer un jour ci-dessous pour afficher ses courses.')}
  finally{try{if(board()?.date!==a)await selectDay(a)}catch(e){handle(e)}S.busy=false;q('v165LoadSegments').disabled=false}
 }
 async function generate(driverId=null){if(S.busy)return;const {a,b,n}=period();
  let scopeWarning='';try{const c=cloud()?.client,p=cloud()?.profile;if(c&&p){const check=await c.from('saeiv_company_lines').select('id',{count:'exact',head:true}).eq('organization_id',p.organization_id).eq('active',true);if(!check.error&&check.count===0)scopeWarning='\n\n⚠ Aucune ligne exploitée déclarée dans Administration : TOUTES les courses GTFS du périmètre 54/57 seront examinées. Avec 101 conducteurs, toutes les courses régionales ne peuvent pas être affectées. Configure les lignes de ton entreprise pour un planning réel.'}}catch(e){console.warn('[SAEIV] lignes exploitées inconnues',e)}
  if(!confirm('Générer '+n+' journée(s)'+(driverId?' pour le conducteur sélectionné':' pour les conducteurs disponibles')+' en BROUILLONS ? Aucune publication automatique.'+scopeWarning))return;
  S.busy=true;const button=q('v165Generate');button.disabled=true;
  try{notify('Génération intelligente du '+a+' au '+b+'…');const results=await planner().generateDateRange(a,b,{driverId});
    const bad=results.filter(x=>!x.ok),already=results.filter(x=>x.unchanged),created=results.filter(x=>x.ok&&!x.unchanged&&!x.empty),empty=results.filter(x=>x.empty);
    ribbon();
    notify('Brouillons : '+already.length+' journée(s) déjà préparée(s), '+created.length+' avec nouvelles affectations, '+empty.length+' sans circulation GTFS. '+bad.length+' erreur(s) réelle(s). '+(bad.length?'Détail dans le journal de génération. ':'')+'Contrôler les repos et la RSE avant validation.',bad.length>0);
  }finally{S.busy=false;button.disabled=false}
 }
 function toggle(id){const e=q(id);if(!e)throw Error('Module non chargé. Rafraîchir la page');e.dataset.open=e.dataset.open==='1'?'0':'1';e.classList.toggle('hide',e.dataset.open!=='1');if(e.dataset.open==='1')e.scrollIntoView({behavior:'smooth',block:'start'})}
 const minute=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})/);return m?+m[1]*60+(+m[2]):null};
 const segmentUsed=(seg,items)=>(items||[]).some(x=>String(x.segment_id||x.payload?.segment_id||'')===String(seg.id)||(
  seg.tripId&&String(x.linked?.tripId||'')===String(seg.tripId)));
 function activity(seg,date){return {id:'gtfs-'+seg.id,segment_id:String(seg.id),date,type:seg.type||'regular',line:seg.line,dept:seg.dept,
  start:seg.start,end:seg.end,origin:seg.origin,destination:seg.destination,originCoords:seg.originCoords||null,
  destinationCoords:seg.destinationCoords||null,driveMinutes:seg.driveMinutes||0,linked:seg.linked||null,
  regime:'eu561',source:'manual_dispatch',label:seg.line+' · '+seg.destination}}
 async function build(driverId){
  const date=board()?.date||from();
  await planner().openDriverDraft(driverId,date);
  try{await board().loadSegments()}catch(e){await planner().releaseLock();throw e}
  const db=cloud()?.client,org=cloud()?.profile?.organization_id;
  const [drafts,official]=await Promise.all([
   db.from('saeiv_planning_days').select('driver_user_id,items').eq('organization_id',org).eq('service_date',date),
   db.from('saeiv_published_days').select('driver_user_id,items').eq('organization_id',org).eq('service_date',date)
  ]);
  if(drafts.error)throw drafts.error;if(official.error)throw official.error;
  const occupied=[...board().items,...(drafts.data||[]).flatMap(x=>x.items||[]),...(official.data||[]).flatMap(x=>x.items||[])];
  const available=board().segments.filter(x=>!segmentUsed(x,occupied));
  S.driver=driverId;
  const modal=q('v190Builder');modal.classList.remove('hide');
  const who=board().drivers.find(x=>x.user_id===driverId);
  q('v190BuilderTitle').textContent='Construire le planning · '+(who?.display_name||who?.matricule||'Conducteur')+' · '+date;
  const render=()=>{
   const occupied=planner().state.items||[];
   if(q('v198Assigned'))q('v198Assigned').innerHTML=occupied.filter(x=>['regular','school','tad','annex','other'].includes(x.type)).map(x=>
    '<article><div><strong>'+esc(x.line||x.label||'Course')+' · '+esc(x.start)+' → '+esc(x.end)+'</strong><small>'+esc(x.origin||'')+' → '+esc(x.destination||'')+'</small></div><button type="button" data-v198-remove-course="'+esc(x.id)+'">Retirer du brouillon</button></article>').join('')||'<p>Aucune course encore placée pour ce conducteur.</p>';
   q('v190Free').innerHTML=available.length?available.map(x=>
    '<article><div><strong>'+esc(x.line)+' · '+esc(x.start)+' → '+esc(x.end)+'</strong><small>'+esc(x.origin)+' → '+esc(x.destination)+'</small></div><button type="button" data-add-segment="'+esc(x.id)+'">＋ Ajouter</button></article>').join(''):'<p>Aucun segment libre pour cette journée.</p>';q('v190FreeCount').textContent=available.length+' segment(s) restant(s)'};
  modal.onclick=async ev=>{if(ev.target.closest('#v190Close')){await close();return}
    const remove=ev.target.closest('[data-v198-remove-course]');if(remove){
     const item=(planner().state.items||[]).find(x=>String(x.id)===remove.dataset.v198RemoveCourse);
     if(!item||!confirm('Retirer cette course du BROUILLON de ce conducteur ?'))return;
     try{await planner().removeActivity(item.id);const replacement=board().segments.find(x=>String(x.id)===String(item.segment_id));if(replacement&&!available.some(x=>x.id===replacement.id))available.push(replacement);render();notify('Course retirée du brouillon. Service et HLP seront recalculés.')}catch(e){handle(e)}return;
    }
    const b=ev.target.closest('[data-add-segment]');if(!b)return;const seg=available.find(x=>x.id===b.dataset.addSegment);if(!seg)return;
    try{
      if((planner().state.items||[]).some(x=>{const a=minute(x.start),z=minute(x.end),s=minute(seg.start),e=minute(seg.end);return [a,z,s,e].every(Number.isFinite)&&a<e&&z>s}))throw Error('Cette course chevauche déjà une activité de ce conducteur');
      await planner().appendActivities([activity(seg,date)]);
      available.splice(available.indexOf(seg),1);render();notify('Segment ajouté : prise de service, HLP, coupure et fin de service recalculés. Contrôler les estimations HLP et RSE.');
    }catch(e){handle(e)}
  };render();modal.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function close(){q('v190Builder')?.classList.add('hide');S.driver=null;try{await planner()?.releaseLock?.();await board()?.refresh?.()}catch(e){handle(e)}}
 function install(){const tool=q('v165Board'),date=q('v165Date');if(!tool||!date||q('v190End'))return;
  const style=document.createElement('style');style.textContent='#v165Board .v194DriverActions{margin-top:6px;display:flex;flex-wrap:wrap;gap:4px}#v165Board .v194DriverActions button{padding:5px;font-size:.55rem;min-height:28px}#v190Days{display:flex;gap:5px;flex-wrap:wrap;margin:5px 0}#v190Days button{font-size:.7rem;padding:5px 8px;min-height:31px}#v190Days button.active{border-color:#eebd59;color:#ffe6a0}#v190Builder.hide{display:none!important}#v190Builder{background:#0a2230;border:1px solid #527b95;border-radius:14px;padding:14px;margin-top:12px}#v190Free{max-height:450px;overflow:auto}#v190Free article{display:flex;align-items:center;justify-content:space-between;padding:9px;gap:10px;border-bottom:1px solid #325067}#v190Free small{display:block;color:#a8c4ce}#v190Status{font-size:.75rem;padding:5px}';
  document.head.append(style);
  const label=date.closest('label');if(label)for(const n of label.childNodes)if(n.nodeType===3&&n.textContent.trim()==='Date')n.textContent='Du ';
  const au=document.createElement('label');au.textContent='Au ';au.innerHTML='Au <input id="v190End" type="date">';label.insertAdjacentElement('afterend',au);
  S.rangeStart=date.value;q('v190End').value=date.value;const toolbar=tool.querySelector('.v165-toolbar');
  const pub=document.createElement('button');pub.type='button';pub.id='v190Publications';pub.textContent='📋 Brouillons / publications';toolbar.append(pub);
  const billets=document.createElement('button');billets.id='v190Billets';billets.type='button';billets.textContent='🎟 Billets CO';toolbar.append(billets);
  const line=document.createElement('div');line.innerHTML='<div id="v190Count"></div><div id="v190Days"></div><div id="v190Status" role="status"></div>';toolbar.insertAdjacentElement('afterend',line);
  const modal=document.createElement('section');modal.id='v190Builder';modal.className='hide';modal.innerHTML='<h3 id="v190BuilderTitle">Construire le planning</h3><p>Le planning du conducteur est enregistré en brouillon. Tu peux retirer une course ou ajouter un segment encore disponible. La prise de service, les HLP et les coupures sont recalculés en estimation après chaque modification.</p><h4>Courses du conducteur</h4><div id="v198Assigned"></div><h4>Segments encore libres</h4><strong id="v190FreeCount"></strong><div id="v190Free"></div><button type="button" id="v190Close">Terminer et revenir au tableau</button>';tool.append(modal);
  date.addEventListener('change',()=>{
    if(!antoniPilot()||!S.busy)S.rangeStart=date.value;
    if(to()<from())q('v190End').value=from();
    S.counts.clear();ribbon();
  });
  q('v190End').addEventListener('change',ribbon);
  q('v190Days').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b)selectDay(b.dataset.day).catch(handle)});
  q('v190Publications').onclick=()=>toggle('v187Planning');
  q('v190Billets').onclick=()=>toggle('v189Root');
  q('v165Grid').addEventListener('click',e=>{const buildButton=e.target.closest('[data-v194-build]'),genButton=e.target.closest('[data-v194-generate]');
   if(buildButton)build(buildButton.dataset.v194Build).catch(handle);
   if(genButton)generate(genButton.dataset.v194Generate).catch(handle);
  },true);
  ribbon();
 }
 function intercept(e){const target=e.target?.closest?.('#v165Generate,#v165LoadSegments');if(!target||!q('v190End'))return;
  e.preventDefault();e.stopImmediatePropagation();
  if(target.id==='v165Generate')generate().catch(handle);else loadPeriod().catch(handle);
 }
 window.addEventListener('click',intercept,true);
 window.MonSAEIVWeeklyV190={installed:true,install,generate,loadPeriod,build,close};
 setInterval(install,950);
})();