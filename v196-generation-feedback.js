'use strict';
/* 1.0.97 — observable, verified, interruptible multi-day generation, using the existing engine. */
(()=>{
 if(window.MonSAEIVGenerationFeedbackV196?.installed)return;
 const q=id=>document.getElementById(id),board=()=>window.MonSAEIVOperationsBoardV165,planner=()=>window.MonSAEIVPlanningV187,cloud=()=>window.MonSAEIVCloudV156;
 const G={busy:false,cancel:false,history:[]};
 const dateAt=(start,index)=>{const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+index);return d.toISOString().slice(0,10)};
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const error=e=>e?.message||String(e);
 function install(){
  if(q('v196Progress')||!q('v190Status'))return;
  const box=document.createElement('section');box.id='v196Progress';box.setAttribute('role','status');
  box.style.cssText='display:none;border:1px solid #426680;background:#0a2435;padding:12px;border-radius:12px;margin-top:6px;color:#f0f8ff';
  box.innerHTML='<b id="v196Title">Génération en attente</b><progress id="v196Bar" max="100" value="0" style="width:100%;display:block;margin:8px 0"></progress><div id="v196Details"></div><button id="v196Cancel" type="button">Arrêter après cette journée</button><div id="v196Log" style="max-height:190px;overflow:auto;font-size:.72rem;margin-top:8px"></div>';
  q('v190Status').insertAdjacentElement('afterend',box);
  q('v196Cancel').onclick=()=>{G.cancel=true;q('v196Cancel').disabled=true;note('Arrêt demandé : fin de la journée en cours, sans supprimer les brouillons déjà sauvegardés.')};
 }
 function note(message){
  const x=q('v196Log');if(x){const line=document.createElement('div');line.textContent=new Date().toLocaleTimeString('fr-FR')+' · '+message;x.prepend(line)}
 }
 function progress(message,done,total){
  install();const x=q('v196Progress');if(x)x.style.display='block';
  if(q('v196Title'))q('v196Title').textContent=message;
  if(q('v196Bar'))q('v196Bar').value=Math.min(100,Math.round(done/total*100));
  if(q('v190Status'))q('v190Status').textContent=message;
  if(q('v196Details'))q('v196Details').textContent='Journées terminées : '+done+' / '+total;
 }
 async function fetchVersions(org,date){
  const {data,error:dbError}=await cloud().client.from('saeiv_planning_days').select('driver_user_id,revision,items').eq('organization_id',org).eq('service_date',date);
  if(dbError)throw dbError;return new Map((data||[]).map(x=>[x.driver_user_id,x]));
 }
 async function run(from,to,{driverId=null,onProgress=null}={}){
  if(G.busy)throw Error('Une génération est déjà en cours');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw Error('Dates invalides');
  const total=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;
  if(total<1||total>31)throw Error('Sélectionner entre 1 et 31 jours');
  if(!cloud()?.client||!cloud()?.profile?.organization_id||!board()?.setDate||!planner()?.generateDraft)throw Error('Modules d’exploitation non chargés. Recharger la page puis réessayer');
  const org=cloud().profile.organization_id;
  const results=[];G.busy=true;G.cancel=false;G.history=[];
  install();if(q('v196Cancel'))q('v196Cancel').disabled=false;
  try{
   for(let i=0;i<total;i++){
    if(G.cancel){note('Génération interrompue à votre demande');break}
    const day=dateAt(from,i);let result={date:day,ok:false};
    try{
     progress('Journée '+(i+1)+'/'+total+' · '+day+' · chargement des segments…',i,total);
     onProgress?.({phase:'load',date:day,dayIndex:i+1,dayCount:total});
     await board().setDate(day);
     await board().loadSegments();
     const n=board().segments.length;
     const regular=board().segments.filter(x=>x.type==='regular').length,school=board().segments.filter(x=>x.type==='school').length;
     note(day+' : '+n+' segments ACTIFS ce jour (réguliers '+regular+', scolaires '+school+', autres '+(n-regular-school)+')');
     if(!n){result={date:day,ok:true,empty:true,saved:0,services:0,segments:0};note('ℹ️ '+day+' : aucun service GTFS actif. Aucun brouillon inutile créé');onProgress?.({phase:'empty',date:day,dayIndex:i+1,dayCount:total})}else{
     const before=await fetchVersions(org,day);
     if(!q('v187Date'))throw Error('Éditeur de brouillons non initialisé');
     q('v187Date').value=day;planner().state.date=day;
     if(driverId){if(!q('v187Driver'))throw Error('Sélecteur conducteur indisponible');q('v187Driver').value=driverId;planner().state.driver=driverId}
     progress('Journée '+(i+1)+'/'+total+' · '+day+' · calcul des affectations…',i,total);
     await planner().takeLock();
     if(!planner().state.lock||planner().state.lock.date!==day)throw Error('Verrou de planification non obtenu');
     const stats=await planner().generateDraft({driverId,onProgress:detail=>{
      if(detail.phase==='assign'&&q('v196Details'))q('v196Details').textContent='Jour '+(i+1)+'/'+total+' · segments examinés '+detail.processed+'/'+detail.total+' · affectés '+detail.assigned+' · sans conducteur '+detail.unplaced;
     }});
     const after=await fetchVersions(org,day);
     const saved=[...after].filter(([key,row])=>!before.has(key)||JSON.stringify(row.items)!==JSON.stringify(before.get(key).items));
     if(!saved.length)throw Error('Aucun nouveau brouillon. '+(stats?.assigned||0)+' courses placées, '+(stats?.unplaced||0)+' impossibles, '+(stats?.restricted||0)+' exclues. '+(stats?.topReasons||[]).slice(0,4).map(x=>x.reason+' ('+x.count+')').join(' · '));
     const services=saved.reduce((n,[,r])=>n+(r.items?.length||0),0);
     result={date:day,ok:true,saved:saved.length,services,gtfsSegments:n,regular,school,...stats};
     note('✅ '+day+' : '+n+' courses du calendrier GTFS · '+(stats?.assigned||0)+' nouvelles affectations · '+(stats?.unplaced||0)+' non placées · '+saved.length+' brouillons modifiés');
     if(stats?.topReasons?.length)note('Causes de refus : '+stats.topReasons.map(x=>x.reason+' ('+x.count+')').join(' · '));
     onProgress?.({phase:'finished',date:day,dayIndex:i+1,dayCount:total,...result});
     }
    }catch(e){
     result.error=error(e);note('❌ '+day+' : '+result.error);
     onProgress?.({phase:'error',date:day,dayIndex:i+1,dayCount:total,error:result.error});
    }finally{
     try{if(planner().state.lock)await planner().releaseLock()}catch(e){note('⚠ Verrou '+day+' : '+error(e))}
    }
    results.push(result);
    progress('Journées traitées : '+results.length+'/'+total,results.length,total);
    await new Promise(resolve=>setTimeout(resolve,10));
   }
   const ok=results.filter(x=>x.ok).length,failed=results.filter(x=>!x.ok);
   const empty=results.filter(x=>x.empty).length,assigned=results.reduce((n,x)=>n+(x.assigned||0),0);
   const summary='Semaine : '+(ok-empty)+' jour(s) avec brouillons, '+empty+' jour(s) sans circulation GTFS, '+assigned+' nouvelles courses affectées. '+failed.length+' erreur(s).'+(failed.length?' Détails : '+failed.map(x=>x.date+' : '+x.error).join(' ; '):'');
   if(q('v196Title'))q('v196Title').textContent=summary;
   if(q('v190Status'))q('v190Status').textContent=summary;
   G.history=results;
   return results;
  }finally{
   G.busy=false;if(q('v196Cancel'))q('v196Cancel').disabled=true;
   try{await board().setDate(from);await board().loadSegments()}catch(e){note('Retour au premier jour : '+error(e))}
  }
 }
 function attach(){const p=planner();if(!p||p.__v196Patch)return;p.__v196Patch=true;p.generateDateRange=run}
 window.MonSAEIVGenerationFeedbackV196={installed:true,install,run,get history(){return G.history}};
 attach();setInterval(()=>{attach();install()},1100);
})();