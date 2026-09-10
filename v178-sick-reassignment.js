'use strict';
/* Mon SAEIV 1.0.78 — arrêt maladie + replacement minimal des courses libérées.
   Principe : aucune course déjà placée chez un autre conducteur n'est déplacée.
   Seuls les HLP/coupures/prise-fin de service des conducteurs receveurs sont recalculés. */
(()=>{
  if(window.MonSAEIVSickReassignmentV178?.installed)return;
  const VERSION='1.0.78';
  const q=id=>document.getElementById(id);
  const cloud=()=>window.MonSAEIVCloudV156;
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const engine=()=>window.MonSAEIVGenerationEngineV167;
  const smart=()=>window.MonSAEIVSmartRestV177;
  const client=()=>cloud()?.client||null;
  const profile=()=>cloud()?.profile||null;
  const S={busy:false,lastResults:[]};
  const WORK_TYPES=new Set(['regular','school','tad','annex','other']);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mm=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
  const duration=(a,b)=>{let x=mm(a),y=mm(b);if(x===null||y===null)return 0;if(y<x)y+=1440;return Math.max(0,y-x)};
  const dayAdd=(iso,n)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
  const datesBetween=(a,b)=>{const out=[];for(let d=a;d&&b&&d<=b&&out.length<370;d=dayAdd(d,1))out.push(d);return out};
  const dateValue=()=>q('v165Date')?.value||new Date().toISOString().slice(0,10);
  const overlaps=(a0,a1,b0,b1)=>{const a=mm(a0),b=mm(a1),c=mm(b0),d=mm(b1);if([a,b,c,d].some(x=>x===null))return false;return a<d&&b>c};
  const validPoint=p=>!!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const isFullDayAbsence=x=>['rh','cp'].includes(String(x?.type||'').toLowerCase())||['RH','CP'].includes(String(x?.payload?.absence_kind||'').toUpperCase());
  const driverName=(id,drivers=board()?.drivers||[])=>drivers.find(d=>String(d.user_id)===String(id))?.display_name||drivers.find(d=>String(d.user_id)===String(id))?.matricule||'Conducteur';

  function status(text,kind=''){const el=q('v165Status');if(el){el.textContent=text||'';el.className=`v165-status ${kind}`}}
  function modalStatus(text,kind=''){const el=q('v178SickStatus');if(el){el.textContent=text||'';el.className=`v178-status ${kind}`}}

  function activityFromItem(x){return{
    id:x.payload?.segment_id||x.id,
    line:x.line||'',dept:x.payload?.dept||x.linked?.dept||'',type:x.type,
    start:String(x.start_time||'').slice(0,5),end:String(x.end_time||'').slice(0,5),
    origin:x.origin||'',destination:x.destination||'',originCoords:x.origin_coords||null,destinationCoords:x.destination_coords||null,
    driveMinutes:Number(x.drive_minutes)||duration(x.start_time,x.end_time),regime:'eu561',linked:x.linked||{}
  }}
  function currentActivities(items,driverId){return (items||[]).filter(x=>String(x.driver_user_id)===String(driverId)&&WORK_TYPES.has(String(x.type||''))).map(activityFromItem).sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999))}
  function queueSegment(row){const s=row.course_snapshot||{};return{
    id:row.segment_id||s.payload?.segment_id||s.id||row.id,
    dept:s.payload?.dept||s.linked?.dept||'',type:s.type||'regular',line:s.line||row.line||'',
    start:String(s.start_time||row.start_time||'').slice(0,5),end:String(s.end_time||row.end_time||'').slice(0,5),
    origin:s.origin||'',destination:s.destination||'',originCoords:s.origin_coords||null,destinationCoords:s.destination_coords||null,
    driveMinutes:Number(s.drive_minutes)||duration(s.start_time||row.start_time,s.end_time||row.end_time),
    lineDistanceKm:s.line_distance_km??null,regime:'eu561',linked:s.linked||{}
  }}
  function planRowFromQueue(queue,targetDriver,userId,orgId){const s=queue.course_snapshot||{},seg=queueSegment(queue);return{
    organization_id:orgId,driver_user_id:targetDriver,client_id:s.client_id||`reassign-${queue.id}`,
    service_date:queue.service_date,sort_index:Number.isFinite(Number(s.sort_index))?Number(s.sort_index):(mm(seg.start)||0)*10,
    type:s.type||seg.type,label:s.label||`${seg.line} · ${seg.destination}`,line:s.line||seg.line,
    start_time:s.start_time||`${seg.start}:00`,end_time:s.end_time||`${seg.end}:00`,origin:s.origin||seg.origin,destination:s.destination||seg.destination,
    origin_coords:s.origin_coords||seg.originCoords,destination_coords:s.destination_coords||seg.destinationCoords,
    origin_kind:s.origin_kind||'stop',destination_kind:s.destination_kind||'stop',regime:'eu561',line_distance_km:s.line_distance_km??seg.lineDistanceKm,
    drive_minutes:s.drive_minutes??seg.driveMinutes,notes:s.notes||null,
    linked:{...(s.linked||{}),reassigned_after_sick_leave:true,original_driver_user_id:queue.original_driver_user_id,reassignment_queue_id:queue.id},
    source:'dispatch',locked_by_exploitation:true,status:'ok',conflict_minutes:0,generated_from_prev:null,generated_from_next:null,
    created_by:userId,updated_by:userId,payload:{...(s.payload||{}),segment_id:queue.segment_id||s.payload?.segment_id||seg.id,created_from:'reassignment_v178',reassigned_after_sick_leave:true,original_driver_user_id:queue.original_driver_user_id,reassignment_queue_id:queue.id,rse_regime:'eu561',rse_policy:'all_lines_eu561'}
  }}
  async function rebuild(driverId,date){const c=client();const{data,error}=await c.functions.invoke('rebuild-driver-day',{body:{driverUserId:driverId,serviceDate:date}});if(error)throw error;return data||{}}
  function rejectReason(check){if(check?.conflicts?.length)return check.conflicts.map(x=>x.message||x.reason||(`HLP impossible : ${x.missingMinutes||'?'} min manquantes`)).filter(Boolean).join(' · ');if(check?.rse?.ok===false)return(check.rse.issues||[]).map(x=>x.message).filter(Boolean).join(' · ')||'Contrôle RSE refusé';return null}

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

  function candidateBlocked(driverId,date,seg,ctx){
    if(ctx.items.some(x=>String(x.driver_user_id)===String(driverId)&&isFullDayAbsence(x)))return'RH/CP';
    const u=ctx.unavailability.find(x=>String(x.driver_user_id)===String(driverId)&&x.service_date===date&&overlaps(seg.start,seg.end,x.start_time,x.end_time));
    if(u)return u.kind==='sick'?'arrêt maladie':`indisponible ${String(u.start_time).slice(0,5)}–${String(u.end_time).slice(0,5)}`;
    return null;
  }

  async function rankCandidates(queue,ctx,compactOnly){
    const eng=engine(),sr=smart(),seg=queueSegment(queue),ranked=[];
    for(const d of ctx.drivers){
      const id=String(d.user_id);if(id===String(queue.original_driver_user_id))continue;
      const setting=ctx.settings.get(id);if(!validPoint(setting?.bus_parking)||!Array.isArray(setting?.known_lines)||!setting.known_lines.length)continue;
      const blocked=candidateBlocked(id,queue.service_date,seg,ctx);if(blocked)continue;
      const current=currentActivities(ctx.items,id),base=eng?.scoreCandidate?.(seg,d,current,setting,{compactOnly});if(!base?.ok)continue;
      let rest={ok:true,penalty:0,note:''};
      if(sr?.weeklyRestCheck)rest=sr.weeklyRestCheck({history:ctx.history,driverId:id,date:queue.service_date,activities:[...current,{...seg,regime:'eu561'}],park:setting.bus_parking,compactOnly,alreadyWorkingToday:current.length>0});
      if(!rest?.ok)continue;
      ranked.push({driver:d,score:Number(base.score||0)+Number(rest.penalty||0),base,rest});
    }
    return ranked.sort((a,b)=>a.score-b.score);
  }

  async function attemptQueueRow(queue,ctx,userId){
    const c=client(),p=profile(),tried=[];
    for(const compactOnly of [true,false]){
      const ranked=await rankCandidates(queue,ctx,compactOnly);
      for(const cand of ranked){
        const id=String(cand.driver.user_id);if(tried.includes(id))continue;tried.push(id);
        const row=planRowFromQueue(queue,id,userId,p.organization_id);let insertedId=null;
        try{
          const{data:existing}=await c.from('plan_items').select('id,driver_user_id').eq('organization_id',p.organization_id).eq('service_date',queue.service_date).contains('payload',{segment_id:queue.segment_id}).maybeSingle();
          if(existing){await c.from('planning_reassignment_queue').update({status:'placed',assigned_driver_user_id:existing.driver_user_id,result_reason:'Déjà replacée',placed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',queue.id);return{ok:true,queue,driverId:existing.driver_user_id,driverName:driverName(existing.driver_user_id,ctx.drivers),already:true}}
          const{data,error}=await c.from('plan_items').insert(row).select('id').single();if(error)throw error;insertedId=data.id;
          const check=await rebuild(id,queue.service_date),reason=rejectReason(check);if(reason)throw new Error(reason);
          await c.from('planning_reassignment_queue').update({status:'placed',assigned_driver_user_id:id,result_reason:'Replacée sans déplacer de course existante',placed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',queue.id);
          ctx.items.push({...row,id:insertedId});
          return{ok:true,queue,driverId:id,driverName:cand.driver.display_name||cand.driver.matricule||'Conducteur',costEur:cand.base?.costEur??null,restNote:cand.rest?.note||''};
        }catch(err){
          if(insertedId){await c.from('plan_items').delete().eq('organization_id',p.organization_id).eq('id',insertedId);try{await rebuild(id,queue.service_date)}catch{}}
        }
      }
    }
    const reason='Aucun conducteur compatible sans modifier une course déjà placée.';
    await c.from('planning_reassignment_queue').update({status:'unplaced',assigned_driver_user_id:null,result_reason:reason,updated_at:new Date().toISOString()}).eq('id',queue.id);
    return{ok:false,queue,reason};
  }

  async function reassignUnplaced(){
    if(S.busy)return;const c=client(),p=profile();if(!c||!p)return status('Session Exploitation indisponible.','err');S.busy=true;const btn=q('v178Reassign');if(btn){btn.disabled=true;btn.textContent='↪ REPLACEMENT…'}status('Recherche des courses libérées à replacer…','busy');
    try{
      const{data:queue,error}=await c.from('planning_reassignment_queue').select('*').eq('organization_id',p.organization_id).in('status',['pending','unplaced']).order('service_date').order('start_time');if(error)throw error;
      if(!(queue||[]).length){S.lastResults=[];openResults([]);status('Aucune course libérée par un arrêt maladie à replacer.','ok');return}
      const{data:{user}}=await c.auth.getUser();const results=[],contexts=new Map();let done=0;
      for(const row of queue){
        let ctx=contexts.get(row.service_date);if(!ctx){ctx=await fetchContext(row.service_date);contexts.set(row.service_date,ctx)}
        status(`↪ ${done}/${queue.length} · ${row.service_date} · ${row.line||'Course'} ${String(row.start_time||'').slice(0,5)}…`,'busy');
        const r=await attemptQueueRow(row,ctx,user?.id||null);results.push(r);done++;if(done%10===0)await new Promise(r=>setTimeout(r,0));
      }
      S.lastResults=results;await board()?.refresh?.();await smart()?.loadUnavailability?.(dateValue());openResults(results);
      const placed=results.filter(x=>x.ok).length,remaining=results.length-placed;status(`✅ Replacement terminé : ${placed} course${placed>1?'s':''} replacée${placed>1?'s':''}${remaining?` · ${remaining} reste${remaining>1?'nt':''} non placée${remaining>1?'s':''}`:''}. Aucune course déjà planifiée chez les autres conducteurs n'a été déplacée.`,'ok');
    }catch(err){status(`Replacement interrompu : ${err?.message||err}`,'err')}finally{S.busy=false;if(btn){btn.disabled=false;btn.textContent='↪ REPLACER COURSE NON PLACÉE'}}
  }

  function installStyle(){if(q('v178Style'))return;const s=document.createElement('style');s.id='v178Style';s.textContent=`
    .v178-sick-open{border-color:#9b4561!important;background:#3a1723!important;color:#ffd6df!important}.v178-reassign{border-color:#2f7f70!important;background:#103b34!important;color:#c9fff1!important}.v177-unavailable[title*="Arrêt maladie"]{display:none!important}.v178-sick-band{position:absolute;inset:2px 0 2px 0;border:1px solid #d85a78;border-radius:8px;background:repeating-linear-gradient(135deg,rgba(116,22,48,.55) 0,rgba(116,22,48,.55) 9px,rgba(65,13,31,.42) 9px,rgba(65,13,31,.42) 18px);z-index:1;pointer-events:none;display:flex;align-items:center;justify-content:center;color:#ffd8e0;font-size:.58rem;font-weight:1000;letter-spacing:.03em}.v178-backdrop{position:fixed;inset:0;z-index:2147483630;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(6px)}.v178-backdrop.hidden{display:none!important}.v178-card{width:min(720px,96vw);max-height:92dvh;overflow:auto;padding:17px;border:1px solid #52697a;border-radius:20px;background:linear-gradient(180deg,#102936,#071721);box-shadow:0 30px 90px rgba(0,0,0,.7)}.v178-head{display:flex;gap:10px;align-items:flex-start}.v178-head h3{margin:0}.v178-head p{margin:4px 0 0;color:#9eb3be;font-size:.67rem;line-height:1.45}.v178-head button{margin-left:auto}.v178-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.v178-form label{font-size:.67rem}.v178-form .wide{grid-column:1/-1}.v178-form input,.v178-form select{width:100%;min-height:44px;margin-top:5px;padding:8px;border:1px solid #3d6072;border-radius:10px;background:#05151f;color:#fff}.v178-note{grid-column:1/-1;padding:10px;border:1px solid #5c4050;border-radius:10px;background:#21121a;color:#d7bac4;font-size:.64rem;line-height:1.5}.v178-actions{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end}.v178-actions .primary{border:0;background:linear-gradient(135deg,#ffd000,#ffad00);color:#111}.v178-status{min-height:1.3em;margin-top:10px;color:#aabdc7;font-size:.65rem}.v178-status.err{color:#ffaaa5}.v178-status.ok{color:#9cf4b7}.v178-results{display:grid;gap:7px;margin-top:12px}.v178-result{padding:9px;border:1px solid #365464;border-radius:11px;background:#081923;font-size:.64rem;line-height:1.45}.v178-result.ok{border-color:#367956;background:#0d281d}.v178-result.bad{border-color:#814353;background:#2b141b}.v178-result b{font-size:.68rem}.v178-summary{padding:10px;border:1px solid #49606d;border-radius:10px;background:#0a1b25;color:#c9d9e0;font-size:.65rem;line-height:1.5}@media(max-width:620px){.v178-backdrop{padding:0;align-items:flex-end}.v178-card{width:100vw;max-height:94dvh;border-radius:20px 20px 0 0}.v178-form{grid-template-columns:1fr}.v178-form .wide,.v178-note,.v178-actions{grid-column:auto}}
  `;document.head.appendChild(s)}

  function ensureUi(){
    installStyle();const toolbar=q('v165Board')?.querySelector('.v165-toolbar');
    if(toolbar&&!q('v178SickOpen')){const b=document.createElement('button');b.id='v178SickOpen';b.type='button';b.className='v178-sick-open';b.textContent='🤒 Arrêt maladie';b.addEventListener('click',()=>openSick());toolbar.insertBefore(b,q('v165Status')||null)}
    if(toolbar&&!q('v178Reassign')){const b=document.createElement('button');b.id='v178Reassign';b.type='button';b.className='v178-reassign';b.textContent='↪ REPLACER COURSE NON PLACÉE';b.addEventListener('click',reassignUnplaced);toolbar.insertBefore(b,q('v165Status')||null)}
    if(!q('v178SickModal'))document.body.insertAdjacentHTML('beforeend',`<div id="v178SickModal" class="v178-backdrop hidden" role="dialog" aria-modal="true"><section class="v178-card"><header class="v178-head"><div><h3>🤒 Arrêt maladie</h3><p>Déclare une période d'arrêt. Les courses déjà prévues sur cette période sont retirées du conducteur et mises dans la file de replacement, sans toucher aux plannings des autres conducteurs.</p></div><button id="v178SickClose" type="button">✕</button></header><form id="v178SickForm" class="v178-form"><label class="wide">Conducteur<select id="v178SickDriver" required></select></label><label>Du<input id="v178SickFrom" type="date" required></label><label>Au<input id="v178SickTo" type="date" required></label><label class="wide">Motif<input id="v178SickReason" type="text" maxlength="120" value="Arrêt maladie"></label><div class="v178-note">Mon SAEIV ne remanie pas les autres services. Les courses du conducteur absent deviennent uniquement « à replacer ». Le bouton <b>REPLACER COURSE NON PLACÉE</b> cherchera des créneaux compatibles chez les autres conducteurs en conservant leurs courses existantes.</div><div class="v178-actions"><button id="v178SickCancel" type="button">Annuler</button><button class="primary" type="submit">ENREGISTRER L'ARRÊT</button></div></form><div id="v178SickStatus" class="v178-status"></div></section></div>`);
    if(!q('v178ResultsModal'))document.body.insertAdjacentHTML('beforeend',`<div id="v178ResultsModal" class="v178-backdrop hidden" role="dialog" aria-modal="true"><section class="v178-card"><header class="v178-head"><div><h3>↪ Résultat du replacement</h3><p>Résumé précis des courses déplacées après l'absence.</p></div><button id="v178ResultsClose" type="button">✕</button></header><div id="v178Results" class="v178-results"></div></section></div>`);
    q('v178SickClose')?.addEventListener('click',closeSick);q('v178SickCancel')?.addEventListener('click',closeSick);q('v178SickModal')?.addEventListener('click',e=>{if(e.target===q('v178SickModal'))closeSick()});q('v178SickForm')?.addEventListener('submit',saveSick);
    q('v178ResultsClose')?.addEventListener('click',()=>q('v178ResultsModal')?.classList.add('hidden'));q('v178ResultsModal')?.addEventListener('click',e=>{if(e.target===q('v178ResultsModal'))q('v178ResultsModal').classList.add('hidden')});
  }
  function fillDrivers(){const el=q('v178SickDriver'),ds=board()?.drivers||[];if(!el)return;el.innerHTML=ds.map(d=>`<option value="${esc(d.user_id)}">${esc(d.display_name||d.matricule)}</option>`).join('')}
  function openSick(driverId=null){ensureUi();fillDrivers();if(driverId)q('v178SickDriver').value=driverId;const d=dateValue();q('v178SickFrom').value=d;q('v178SickTo').value=d;q('v178SickReason').value='Arrêt maladie';modalStatus('');q('v178SickModal').classList.remove('hidden')}
  function closeSick(){if(S.busy)return;q('v178SickModal')?.classList.add('hidden');modalStatus('')}

  async function saveSick(e){
    e.preventDefault();if(S.busy)return;const c=client(),p=profile(),driver=q('v178SickDriver')?.value,from=q('v178SickFrom')?.value,to=q('v178SickTo')?.value,reason=String(q('v178SickReason')?.value||'').trim()||'Arrêt maladie';if(!c||!p||!driver||!from||!to)return;if(to<from)return modalStatus('La date de fin doit être après ou égale à la date de début.','err');S.busy=true;modalStatus('Enregistrement de l’arrêt et libération des courses…');
    try{
      const{data,error}=await c.rpc('register_sick_leave',{p_organization_id:p.organization_id,p_driver_user_id:driver,p_from:from,p_to:to,p_reason:reason});if(error)throw error;
      await board()?.refresh?.();await smart()?.loadUnavailability?.(dateValue());await loadAndDecorateSick();
      const n=Number(data?.displacedCourses||0),days=Number(data?.days||datesBetween(from,to).length);modalStatus(`✅ Arrêt enregistré sur ${days} jour${days>1?'s':''}. ${n} course${n>1?'s':''} libérée${n>1?'s':''} et placée${n>1?'s':''} dans la file « à replacer ». Les autres plannings n'ont pas été modifiés.`,'ok');
    }catch(err){modalStatus(err?.message||String(err),'err')}finally{S.busy=false}
  }

  function openResults(results){ensureUi();const box=q('v178Results');if(!box)return;const placed=results.filter(x=>x.ok).length,failed=results.length-placed;box.innerHTML=`<div class="v178-summary"><b>${placed} replacée${placed>1?'s':''}</b>${failed?` · <b>${failed} non placée${failed>1?'s':''}</b>`:''}<br>Aucune course existante chez les autres conducteurs n'a été déplacée. Seuls leurs HLP, coupures et temps de prise/fin de service sont recalculés autour des nouvelles affectations.</div>`+(results.length?results.map(r=>{const qrow=r.queue||{},course=`${esc(qrow.line||'Course')} · ${esc(String(qrow.start_time||'').slice(0,5))}–${esc(String(qrow.end_time||'').slice(0,5))}`;return r.ok?`<div class="v178-result ok"><b>✅ ${course}</b><br>${esc(qrow.service_date)} · ancien conducteur : ${esc(driverName(qrow.original_driver_user_id))}<br>→ <b>${esc(r.driverName||driverName(r.driverId))}</b>${r.costEur!=null?` · coût estimé ${Number(r.costEur).toFixed(2).replace('.',',')} €`:''}${r.restNote?`<br>${esc(r.restNote)}`:''}</div>`:`<div class="v178-result bad"><b>⚠ ${course}</b><br>${esc(qrow.service_date)} · reste non placée<br>${esc(r.reason||'Aucun conducteur compatible.')}</div>`}).join(''):'<div class="v178-result">Aucune course en attente.</div>');q('v178ResultsModal').classList.remove('hidden')}

  async function loadAndDecorateSick(){
    document.querySelectorAll('.v178-sick-band').forEach(x=>x.remove());const c=client(),p=profile(),date=dateValue();if(!c||!p)return;const{data,error}=await c.from('driver_unavailability').select('id,driver_user_id,service_date,reason,kind').eq('organization_id',p.organization_id).eq('service_date',date).eq('kind','sick');if(error)return;
    for(const a of data||[]){const lane=document.querySelector(`[data-driver-lane="${CSS.escape(String(a.driver_user_id))}"]`);if(!lane)continue;const band=document.createElement('div');band.className='v178-sick-band';band.textContent='🤒 ARRÊT MALADIE';band.title=a.reason||'Arrêt maladie';lane.appendChild(band)}
  }

  function boot(){let tries=0;const t=setInterval(async()=>{const p=profile();if(q('v165Board')&&p&&['dispatcher','admin'].includes(p.role)){clearInterval(t);ensureUi();await loadAndDecorateSick();q('v165Date')?.addEventListener('change',()=>setTimeout(loadAndDecorateSick,250));document.addEventListener('click',e=>{if(e.target?.closest?.('#v165Refresh,#v157OpsTab,#v165OpsTab'))setTimeout(loadAndDecorateSick,500)},true);setInterval(()=>{if(!q('v165Board')?.classList.contains('hidden'))loadAndDecorateSick()},6000)}else if(++tries>240)clearInterval(t)},250)}
  window.MonSAEIVSickReassignmentV178={installed:true,version:VERSION,openSick,reassignUnplaced,decorate:loadAndDecorateSick};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();