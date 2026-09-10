'use strict';
/* Mon SAEIV 1.0.79 — réparation locale minimale après absence.
   Ordre de recherche :
   1) replacement direct sans toucher aux autres courses (moteur v178) ;
   2) si nécessaire, micro-réorganisation limitée à 2 conducteurs et 2 courses existantes ;
   3) jamais de remaniement global : on minimise d'abord le nombre de courses déplacées,
      puis le nombre de conducteurs impactés, puis le coût/HLP/coupures.
*/
(()=>{
  if(window.MonSAEIVMinimalRepairV179?.installed)return;

  const VERSION='1.0.79';
  const q=id=>document.getElementById(id);
  const cloud=()=>window.MonSAEIVCloudV156;
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const engine=()=>window.MonSAEIVGenerationEngineV167;
  const smart=()=>window.MonSAEIVSmartRestV177;
  const v178=()=>window.MonSAEIVSickReassignmentV178;
  const client=()=>cloud()?.client||null;
  const profile=()=>cloud()?.profile||null;

  const POLICY=Object.freeze({
    maxMovedExistingCourses:2,
    maxAffectedExistingDrivers:2,
    maxCandidateBlockers:8
  });
  const WORK_TYPES=new Set(['regular','school','tad','annex','other']);
  const MOVABLE_TYPES=new Set(['regular','school','tad']);
  let running=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mm=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
  const duration=(a,b)=>{let x=mm(a),y=mm(b);if(x===null||y===null)return 0;if(y<x)y+=1440;return Math.max(0,y-x)};
  const dayAdd=(iso,n)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
  const overlaps=(a0,a1,b0,b1)=>{const a=mm(a0),b=mm(a1),c=mm(b0),d=mm(b1);if([a,b,c,d].some(x=>x===null))return false;return a<d&&b>c};
  const validPoint=p=>!!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const isFullDayAbsence=x=>['rh','cp'].includes(String(x?.type||'').toLowerCase())||['RH','CP'].includes(String(x?.payload?.absence_kind||'').toUpperCase());

  function status(text,kind=''){
    const el=q('v165Status');if(el){el.textContent=text||'';el.className=`v165-status ${kind}`}
  }
  function driverName(id,drivers=board()?.drivers||[]){
    const d=(drivers||[]).find(x=>String(x.user_id)===String(id));
    return d?.display_name||d?.matricule||'Conducteur';
  }
  function rejectReason(check){
    if(check?.conflicts?.length)return check.conflicts.map(x=>x.message||x.reason||(`HLP impossible : ${x.missingMinutes||'?'} min manquantes`)).filter(Boolean).join(' · ');
    if(check?.rse?.ok===false)return(check.rse.issues||[]).map(x=>x.message).filter(Boolean).join(' · ')||'Contrôle RSE refusé';
    return null;
  }
  async function rebuild(driverId,date){
    const c=client();const{data,error}=await c.functions.invoke('rebuild-driver-day',{body:{driverUserId:driverId,serviceDate:date}});
    if(error)throw error;return data||{};
  }

  function activityFromItem(x){
    return{
      planItemId:x.id,id:x.payload?.segment_id||x.id,line:x.line||'',dept:x.payload?.dept||x.linked?.dept||'',type:x.type,
      start:String(x.start_time||'').slice(0,5),end:String(x.end_time||'').slice(0,5),
      origin:x.origin||'',destination:x.destination||'',originCoords:x.origin_coords||null,destinationCoords:x.destination_coords||null,
      driveMinutes:Number(x.drive_minutes)||duration(x.start_time,x.end_time),lineDistanceKm:x.line_distance_km??null,regime:'eu561',linked:x.linked||{}
    };
  }
  function queueSegment(row){
    const s=row.course_snapshot||{};
    return{
      id:row.segment_id||s.payload?.segment_id||s.id||row.id,
      dept:s.payload?.dept||s.linked?.dept||'',type:s.type||'regular',line:s.line||row.line||'',
      start:String(s.start_time||row.start_time||'').slice(0,5),end:String(s.end_time||row.end_time||'').slice(0,5),
      origin:s.origin||'',destination:s.destination||'',originCoords:s.origin_coords||null,destinationCoords:s.destination_coords||null,
      driveMinutes:Number(s.drive_minutes)||duration(s.start_time||row.start_time,s.end_time||row.end_time),
      lineDistanceKm:s.line_distance_km??null,regime:'eu561',linked:s.linked||{}
    };
  }
  function currentActivities(items,driverId,excludeIds=new Set()){
    return (items||[])
      .filter(x=>String(x.driver_user_id)===String(driverId)&&WORK_TYPES.has(String(x.type||''))&&!excludeIds.has(String(x.id)))
      .map(activityFromItem)
      .sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
  }
  function planRowFromQueue(queue,targetDriver,userId,orgId){
    const s=queue.course_snapshot||{},seg=queueSegment(queue);
    return{
      organization_id:orgId,driver_user_id:targetDriver,client_id:s.client_id||`reassign-${queue.id}`,
      service_date:queue.service_date,sort_index:Number.isFinite(Number(s.sort_index))?Number(s.sort_index):(mm(seg.start)||0)*10,
      type:s.type||seg.type,label:s.label||`${seg.line} · ${seg.destination}`,line:s.line||seg.line,
      start_time:s.start_time||`${seg.start}:00`,end_time:s.end_time||`${seg.end}:00`,origin:s.origin||seg.origin,destination:s.destination||seg.destination,
      origin_coords:s.origin_coords||seg.originCoords,destination_coords:s.destination_coords||seg.destinationCoords,
      origin_kind:s.origin_kind||'stop',destination_kind:s.destination_kind||'stop',regime:'eu561',line_distance_km:s.line_distance_km??seg.lineDistanceKm,
      drive_minutes:s.drive_minutes??seg.driveMinutes,notes:s.notes||null,
      linked:{...(s.linked||{}),reassigned_after_sick_leave:true,original_driver_user_id:queue.original_driver_user_id,reassignment_queue_id:queue.id,minimal_repair:true},
      source:'dispatch',locked_by_exploitation:true,status:'ok',conflict_minutes:0,generated_from_prev:null,generated_from_next:null,
      created_by:userId,updated_by:userId,
      payload:{...(s.payload||{}),segment_id:queue.segment_id||s.payload?.segment_id||seg.id,created_from:'reassignment_v179_minimal_repair',reassigned_after_sick_leave:true,original_driver_user_id:queue.original_driver_user_id,reassignment_queue_id:queue.id,minimal_repair:true,rse_regime:'eu561',rse_policy:'all_lines_eu561'}
    };
  }

  async function fetchContext(date){
    const c=client(),p=profile(),from=dayAdd(date,-28),to=dayAdd(date,1);
    const [{data:drivers,error:de},{data:settings,error:se},{data:items,error:ie},{data:history,error:he},{data:unavailability,error:ue}]=await Promise.all([
      c.from('profiles').select('user_id,matricule,display_name,active').eq('organization_id',p.organization_id).eq('role','driver').eq('active',true),
      c.from('driver_settings').select('user_id,bus_parking,known_lines').eq('organization_id',p.organization_id),
      c.from('plan_items').select('*').eq('organization_id',p.organization_id).eq('service_date',date),
      c.from('plan_items').select('driver_user_id,service_date,type,start_time,end_time,source,payload').eq('organization_id',p.organization_id).gte('service_date',from).lte('service_date',to),
      c.from('driver_unavailability').select('id,driver_user_id,service_date,start_time,end_time,reason,kind').eq('organization_id',p.organization_id).eq('service_date',date)
    ]);
    if(de)throw de;if(se)throw se;if(ie)throw ie;if(he)throw he;if(ue)throw ue;
    const sm=new Map();for(const x of settings||[])sm.set(String(x.user_id),x);
    return{drivers:drivers||[],settings:sm,items:items||[],history:history||[],unavailability:unavailability||[]};
  }

  function blocked(driverId,date,seg,ctx){
    if(ctx.items.some(x=>String(x.driver_user_id)===String(driverId)&&isFullDayAbsence(x)))return'RH/CP';
    const u=ctx.unavailability.find(x=>String(x.driver_user_id)===String(driverId)&&x.service_date===date&&overlaps(seg.start,seg.end,x.start_time,x.end_time));
    if(u)return u.kind==='sick'?'arrêt maladie':`indisponible ${String(u.start_time).slice(0,5)}–${String(u.end_time).slice(0,5)}`;
    return null;
  }
  function restCheck(driverId,date,activities,setting,ctx){
    const sr=smart();if(!sr?.weeklyRestCheck)return{ok:true,penalty:0,note:''};
    return sr.weeklyRestCheck({history:ctx.history,driverId,date,activities,park:setting.bus_parking,compactOnly:false,alreadyWorkingToday:activities.length>1});
  }
  function blockerDistance(item,seg){
    const a=mm(item.start_time),b=mm(item.end_time),s=mm(seg.start),e=mm(seg.end);
    if([a,b,s,e].some(x=>x===null))return 99999;
    if(a<e&&b>s)return 0;
    return Math.min(Math.abs(a-e),Math.abs(s-b));
  }
  function combos(xs,n){
    if(n===1)return xs.map(x=>[x]);
    const out=[];for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)out.push([xs[i],xs[j]]);return out;
  }

  async function findMinimalRepair(queue,ctx){
    const eng=engine(),seg=queueSegment(queue);if(!eng?.scoreCandidate)return null;
    let best=null;
    for(const target of ctx.drivers){
      const targetId=String(target.user_id);
      if(targetId===String(queue.original_driver_user_id))continue;
      const tSetting=ctx.settings.get(targetId);
      if(!validPoint(tSetting?.bus_parking)||!Array.isArray(tSetting?.known_lines)||!tSetting.known_lines.length)continue;
      if(blocked(targetId,queue.service_date,seg,ctx))continue;
      if(eng.knowsLine&&!eng.knowsLine(seg,tSetting))continue;

      const movable=ctx.items
        .filter(x=>String(x.driver_user_id)===targetId&&MOVABLE_TYPES.has(String(x.type||''))&&x.id)
        .sort((a,b)=>blockerDistance(a,seg)-blockerDistance(b,seg))
        .slice(0,POLICY.maxCandidateBlockers);

      for(let movedCount=1;movedCount<=POLICY.maxMovedExistingCourses;movedCount++){
        if(movable.length<movedCount)continue;
        for(const subset of combos(movable,movedCount)){
          const removed=new Set(subset.map(x=>String(x.id)));
          const targetCurrent=currentActivities(ctx.items,targetId,removed);
          const targetBase=eng.scoreCandidate(seg,target,targetCurrent,tSetting,{compactOnly:false});
          if(!targetBase?.ok)continue;
          const targetActivities=[...targetCurrent,{...seg,regime:'eu561'}].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
          const targetRest=restCheck(targetId,queue.service_date,targetActivities,tSetting,ctx);
          if(!targetRest?.ok)continue;

          for(const receiver of ctx.drivers){
            const receiverId=String(receiver.user_id);
            if(receiverId===targetId||receiverId===String(queue.original_driver_user_id))continue;
            const rSetting=ctx.settings.get(receiverId);
            if(!validPoint(rSetting?.bus_parking)||!Array.isArray(rSetting?.known_lines)||!rSetting.known_lines.length)continue;
            let receiverActs=currentActivities(ctx.items,receiverId),moveCost=0,ok=true;
            const moveChecks=[];
            for(const item of [...subset].sort((a,b)=>(mm(a.start_time)??9999)-(mm(b.start_time)??9999))){
              const bseg=activityFromItem(item);
              if(blocked(receiverId,queue.service_date,bseg,ctx)){ok=false;break}
              if(eng.knowsLine&&!eng.knowsLine(bseg,rSetting)){ok=false;break}
              const sc=eng.scoreCandidate(bseg,receiver,receiverActs,rSetting,{compactOnly:false});
              if(!sc?.ok){ok=false;break}
              moveCost+=Number(sc.score||0);moveChecks.push({item,score:sc});
              receiverActs=[...receiverActs,bseg].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
            }
            if(!ok)continue;
            const receiverRest=restCheck(receiverId,queue.service_date,receiverActs,rSetting,ctx);
            if(!receiverRest?.ok)continue;

            const score=movedCount*1e9+Number(targetBase.score||0)+moveCost+Number(targetRest.penalty||0)+Number(receiverRest.penalty||0);
            const plan={queue,target,targetId,receiver,receiverId,subset,targetBase,targetRest,receiverRest,moveChecks,score,movedCount};
            if(!best||score<best.score)best=plan;
          }
        }
        if(best&&best.movedCount===movedCount)break;
      }
    }
    return best;
  }

  async function rollbackRepair(plan,insertedId,userId){
    const c=client(),p=profile();
    if(insertedId)await c.from('plan_items').delete().eq('organization_id',p.organization_id).eq('id',insertedId);
    for(const item of plan.subset){
      await c.from('plan_items').update({driver_user_id:plan.targetId,updated_by:item.updated_by||userId||null}).eq('organization_id',p.organization_id).eq('id',item.id);
    }
    try{await rebuild(plan.targetId,plan.queue.service_date)}catch{}
    try{await rebuild(plan.receiverId,plan.queue.service_date)}catch{}
  }

  async function applyRepair(plan,userId){
    const c=client(),p=profile();let insertedId=null;
    try{
      for(const item of plan.subset){
        const{error}=await c.from('plan_items').update({driver_user_id:plan.receiverId,updated_by:userId||null}).eq('organization_id',p.organization_id).eq('id',item.id);
        if(error)throw error;
      }
      const row=planRowFromQueue(plan.queue,plan.targetId,userId,p.organization_id);
      const{data,error}=await c.from('plan_items').insert(row).select('id').single();if(error)throw error;insertedId=data.id;

      const targetCheck=await rebuild(plan.targetId,plan.queue.service_date),targetReason=rejectReason(targetCheck);
      if(targetReason)throw new Error(`${driverName(plan.targetId)} : ${targetReason}`);
      const receiverCheck=await rebuild(plan.receiverId,plan.queue.service_date),receiverReason=rejectReason(receiverCheck);
      if(receiverReason)throw new Error(`${driverName(plan.receiverId)} : ${receiverReason}`);

      const movedText=plan.subset.map(x=>`${x.line||'Course'} ${String(x.start_time||'').slice(0,5)} ${driverName(plan.targetId)}→${driverName(plan.receiverId)}`).join(' ; ');
      const reason=`Réorganisation minimale : ${plan.movedCount} course${plan.movedCount>1?'s':''} existante${plan.movedCount>1?'s':''} déplacée${plan.movedCount>1?'s':''} entre 2 conducteurs. ${movedText}`;
      const{error:qe}=await c.from('planning_reassignment_queue').update({status:'placed',assigned_driver_user_id:plan.targetId,result_reason:reason,placed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('organization_id',p.organization_id).eq('id',plan.queue.id);
      if(qe)throw qe;

      return{ok:true,queue:plan.queue,driverId:plan.targetId,driverName:driverName(plan.targetId),repair:true,movedCount:plan.movedCount,affectedDrivers:2,changes:plan.subset.map(x=>({line:x.line||'Course',start:String(x.start_time||'').slice(0,5),from:driverName(plan.targetId),to:driverName(plan.receiverId)}))};
    }catch(err){
      await rollbackRepair(plan,insertedId,userId);
      return{ok:false,queue:plan.queue,reason:err?.message||String(err)};
    }
  }

  async function repairRemaining(scopeIds,userId){
    const c=client(),p=profile(),results=[],contexts=new Map();
    const{data:rows,error}=await c.from('planning_reassignment_queue').select('*').eq('organization_id',p.organization_id).in('id',scopeIds).eq('status','unplaced').order('service_date').order('start_time');
    if(error)throw error;
    let i=0;
    for(const row of rows||[]){
      i++;status(`🧩 Réorganisation locale ${i}/${rows.length} · ${row.service_date} · ${row.line||'Course'}…`,'busy');
      let ctx=contexts.get(row.service_date);if(!ctx){ctx=await fetchContext(row.service_date);contexts.set(row.service_date,ctx)}
      const plan=await findMinimalRepair(row,ctx);
      if(!plan){
        const reason='Aucune micro-réorganisation conforme trouvée dans la limite de 2 conducteurs / 2 courses déplacées.';
        await c.from('planning_reassignment_queue').update({result_reason:reason,updated_at:new Date().toISOString()}).eq('organization_id',p.organization_id).eq('id',row.id);
        results.push({ok:false,queue:row,reason});continue;
      }
      const applied=await applyRepair(plan,userId);results.push(applied);
      contexts.set(row.service_date,await fetchContext(row.service_date));
      await new Promise(r=>setTimeout(r,0));
    }
    return results;
  }

  async function scopeRows(){
    const c=client(),p=profile();
    const{data,error}=await c.from('planning_reassignment_queue').select('id,status').eq('organization_id',p.organization_id).in('status',['pending','unplaced']).order('service_date').order('start_time');
    if(error)throw error;return data||[];
  }
  async function finalRows(ids){
    const c=client(),p=profile();if(!ids.length)return[];
    const{data,error}=await c.from('planning_reassignment_queue').select('*').eq('organization_id',p.organization_id).in('id',ids).order('service_date').order('start_time');
    if(error)throw error;return data||[];
  }

  function renderFinal(rows,repairs){
    const modal=q('v178ResultsModal'),box=q('v178Results');if(!modal||!box)return;
    const repairMap=new Map((repairs||[]).filter(x=>x.repair).map(x=>[String(x.queue.id),x]));
    const placed=rows.filter(x=>x.status==='placed'),failed=rows.filter(x=>x.status!=='placed');
    const repaired=placed.filter(x=>repairMap.has(String(x.id))).length,direct=placed.length-repaired;
    const moved=[...repairMap.values()].reduce((s,x)=>s+Number(x.movedCount||0),0);
    box.innerHTML=`<div class="v178-summary"><b>${placed.length} replacée${placed.length>1?'s':''}</b>${failed.length?` · <b>${failed.length} non placée${failed.length>1?'s':''}</b>`:''}<br>Stratégie : zéro changement d'abord, puis micro-réorganisation seulement si indispensable. ${direct} replacement${direct>1?'s':''} direct${direct>1?'s':''}, ${repaired} avec réorganisation minimale, ${moved} course${moved>1?'s':''} existante${moved>1?'s':''} déplacée${moved>1?'s':''} au total.<br>Limite automatique : au maximum ${POLICY.maxMovedExistingCourses} courses existantes et ${POLICY.maxAffectedExistingDrivers} conducteurs impactés pour débloquer une course ; jamais de reconstruction globale.</div>`+
      (rows.length?rows.map(row=>{
        const r=repairMap.get(String(row.id)),course=`${esc(row.line||'Course')} · ${esc(String(row.start_time||'').slice(0,5))}–${esc(String(row.end_time||'').slice(0,5))}`;
        if(row.status==='placed'){
          const changes=r?.changes?.length?`<br><b>Réorganisation :</b> ${r.changes.map(x=>`${esc(x.line)} ${esc(x.start)} : ${esc(x.from)} → ${esc(x.to)}`).join(' ; ')}`:'<br>Aucune autre course déplacée.';
          return `<div class="v178-result ok"><b>✅ ${course}</b><br>${esc(row.service_date)} · ${esc(driverName(row.original_driver_user_id))} → <b>${esc(driverName(row.assigned_driver_user_id))}</b>${changes}</div>`;
        }
        return `<div class="v178-result bad"><b>⚠ ${course}</b><br>${esc(row.service_date)} · reste non placée<br>${esc(row.result_reason||'Aucune solution conforme dans la limite de réorganisation minimale.')}</div>`;
      }).join(''):'<div class="v178-result">Aucune course en attente.</div>');
    modal.classList.remove('hidden');
  }

  function updateTexts(){
    const modal=q('v178SickModal');if(modal){
      const p=modal.querySelector('.v178-head p');if(p)p.textContent="Déclare une période d'arrêt. Les courses sont libérées puis replacées avec le moins de changements possible sur les autres services.";
      const note=modal.querySelector('.v178-note');if(note)note.innerHTML='Mon SAEIV cherche d’abord un replacement <b>sans déplacer aucune course</b>. Si c’est impossible, il peut réorganiser localement au maximum <b>2 courses existantes entre 2 conducteurs</b>, uniquement si cela permet de récupérer la couverture. Aucun planning global n’est régénéré.';
    }
  }

  async function intercept(e){
    const btn=e.target?.closest?.('#v178Reassign');if(!btn||running)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const c=client(),p=profile(),base=v178();if(!c||!p||!base?.reassignUnplaced)return;
    running=true;btn.disabled=true;btn.textContent='↪ REPLACEMENT MINIMAL…';
    try{
      const before=await scopeRows(),ids=before.map(x=>x.id);
      if(!ids.length){await base.reassignUnplaced();return}
      status('↪ Recherche d’abord des replacements sans modifier les autres plannings…','busy');
      await base.reassignUnplaced();
      q('v178ResultsModal')?.classList.add('hidden');
      const{data:{user}}=await c.auth.getUser();
      const repairs=await repairRemaining(ids,user?.id||null);
      await board()?.refresh?.();await smart()?.loadUnavailability?.(q('v165Date')?.value);
      const rows=await finalRows(ids);renderFinal(rows,repairs);
      const placed=rows.filter(x=>x.status==='placed').length,remaining=rows.length-placed,repaired=repairs.filter(x=>x.ok&&x.repair).length,moved=repairs.filter(x=>x.ok&&x.repair).reduce((s,x)=>s+Number(x.movedCount||0),0);
      status(`✅ Replacement terminé : ${placed}/${rows.length} replacée${placed>1?'s':''} · ${repaired} avec micro-réorganisation · ${moved} course${moved>1?'s':''} existante${moved>1?'s':''} déplacée${moved>1?'s':''}${remaining?` · ${remaining} reste${remaining>1?'nt':''} non placée${remaining>1?'s':''}`:''}.`,'ok');
    }catch(err){
      status(`Replacement minimal interrompu : ${err?.message||err}`,'err');
    }finally{
      running=false;btn.disabled=false;btn.textContent='↪ REPLACER COURSE NON PLACÉE';
    }
  }

  function boot(){
    document.addEventListener('click',intercept,true);
    let tries=0;const t=setInterval(()=>{
      if(q('v178Reassign')&&v178()?.installed){clearInterval(t);updateTexts()}
      else if(++tries>240)clearInterval(t);
    },250);
  }

  window.MonSAEIVMinimalRepairV179={installed:true,version:VERSION,policy:POLICY,repairRemaining};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();