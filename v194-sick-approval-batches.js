'use strict';
/* SAEIV 1.0.95 — sick leave: propose redistributed official services as one consent-gated batch per day */
(()=>{
if(window.MonSAEIVSickApprovalV194?.installed)return;
const cloud=()=>window.MonSAEIVCloudV156,db=()=>cloud()?.client,profile=()=>cloud()?.profile;
const engine=()=>window.MonSAEIVGenerationEngineV167,rest=()=>window.MonSAEIVSmartRestV177;
const toMin=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d\d)/);return m?Number(m[1])*60+Number(m[2]):null};
const duration=x=>{const a=toMin(x.start),b=toMin(x.end);return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,b-a):0};
const work=x=>['regular','school','tad','annex','other'].includes(String(x.type||'').toLowerCase());
const overlap=(a,b)=>{const v=[a.start,a.end,b.start,b.end].map(toMin);return v.every(Number.isFinite)&&v[0]<v[3]&&v[1]>v[2]};
const addDay=(start,i)=>{const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)};
const friendly=e=>e?.message||String(e);
const fetchRows=async(q)=>{const {data,error}=await q;if(error)throw error;return data||[]};
const compact=x=>({id:x.id||x.segment_id||crypto.randomUUID(),date:x.date,type:x.type||'regular',line:x.line||'',start:String(x.start||x.start_time||'').slice(0,5),end:String(x.end||x.end_time||'').slice(0,5),origin:x.origin||'',destination:x.destination||'',originCoords:x.originCoords||x.origin_coords||null,destinationCoords:x.destinationCoords||x.destination_coords||null,driveMinutes:Number(x.driveMinutes||x.drive_minutes)||duration(x),linked:x.linked||null,dept:x.dept||x.linked?.dept||'',regime:'eu561',segment_id:x.segment_id||x.payload?.segment_id||null});
async function forDay(day,driverId,reason){
 const org=profile()?.organization_id;
 const [official,drivers,settings,absence,conflicts]=await Promise.all([
  fetchRows(db().from('saeiv_published_days').select('driver_user_id,items,revision').eq('organization_id',org).eq('service_date',day)),
  fetchRows(db().from('profiles').select('user_id,display_name,matricule,active,is_test_driver,depot_id,weekly_contract_minutes').eq('organization_id',org).eq('role','driver').eq('active',true)),
  fetchRows(db().from('driver_settings').select('user_id,bus_parking,known_lines').eq('organization_id',org)),
  fetchRows(db().from('driver_unavailability').select('driver_user_id,start_time,end_time,kind').eq('organization_id',org).eq('service_date',day)),
  fetchRows(db().from('saeiv_change_requests').select('driver_user_id,status').eq('organization_id',org).eq('service_date',day).in('status',['pending','accepted']))
 ]);
 const sick=official.find(x=>x.driver_user_id===driverId);
 if(!sick)return {date:day,skipped:true,info:'Pas de planning officiellement publié'};
 const displaced=(sick.items||[]).filter(work).map(compact);
 if(!displaced.length)return {date:day,skipped:true,info:'Aucun service publié à replacer'};
 const pending=new Set(conflicts.map(x=>x.driver_user_id));
 if(pending.has(driverId))throw Error('Modification déjà en cours pour le conducteur absent');
 if(!absence.some(x=>x.driver_user_id===driverId&&x.kind==='sick'))throw Error('Enregistrer d’abord l’arrêt maladie');
 const profiles=new Map(drivers.map(x=>[x.user_id,x])),configuration=new Map(settings.map(x=>[x.user_id,x]));
 const items=new Map(official.filter(x=>x.driver_user_id!==driverId&&!pending.has(x.driver_user_id)).map(x=>[x.driver_user_id,structuredClone(x.items||[])]));
 const modified=new Set();
 for(const seg of displaced){
  const ranked=[];
  for(const [targetId,dayItems]of items){
   const d=profiles.get(targetId);if(!d||dayItems.some(x=>['rh','cp','sick'].includes(String(x.type).toLowerCase())))continue;
   const blocks=absence.filter(x=>x.driver_user_id===targetId);
   if(blocks.some(x=>['sick','rest','leave'].includes(x.kind)||overlap({start:String(x.start_time||'').slice(0,5),end:String(x.end_time||'').slice(0,5)},seg)))continue;
   if(dayItems.some(x=>work(x)&&overlap(x,seg)))continue;
   const existing=dayItems.filter(work).map(compact);
   const evaluation=engine()?.scoreCandidate?.(seg,d,existing,configuration.get(targetId)||{},{compactOnly:false});
   if(!evaluation?.ok)continue;
   const score=engine()?.planningRank?.(existing,configuration.get(targetId)||{},evaluation)||{dayTier:0,compactPenalty:0,incremental:0};
   ranked.push({id:targetId,rank:score,cost:Math.abs((d.weekly_contract_minutes||2100)/5-existing.reduce((n,x)=>n+duration(x),0)-duration(seg))});
  }
  ranked.sort((a,b)=>a.rank.dayTier-b.rank.dayTier||a.cost-b.cost||a.rank.compactPenalty-b.rank.compactPenalty||a.rank.incremental-b.rank.incremental);
  if(!ranked.length)throw Error('Course '+(seg.line||'')+' '+seg.start+'–'+seg.end+' non replaçable avec les contrôles HLP/horaires. Aucune demande envoyée pour cette journée');
  const chosen=ranked[0].id;
  const newItem={...seg,id:'reassigned-'+(seg.segment_id||seg.id)+'-'+day,source:'sick_reassignment',notes:'Réaffectation après arrêt maladie · contrôle RSE/HLP définitif requis'};
  items.get(chosen).push(newItem);modified.add(chosen);
 }
 const proposed=[{driver_id:driverId,items:[{id:'sick-'+day,date:day,type:'sick',label:'Arrêt de travail',start:'00:00',end:'23:59',notes:reason}]}];
 for(const id of modified)proposed.push({driver_id:id,items:items.get(id)});
 const {data:lock,error:lockErr}=await db().rpc('saeiv_acquire_lock',{p_start:day,p_end:day,p_name:profile().display_name||'Exploitation'});
 if(lockErr)throw lockErr;if(!lock?.ok)throw Error('Planning verrouillé par '+(lock?.owner||'un autre exploitant'));
 try{
  const r=await db().rpc('saeiv_propose_change_batch',{p_date:day,p_reason:reason+' · '+displaced.length+' service(s) à replacer. Vérifiez votre proposition.',p_changes:proposed,p_sick_driver:driverId});
  if(r.error)throw r.error;
  return{date:day,batch_id:r.data,drivers:modified.size,services:displaced.length};
 }finally{const x=await db().rpc('saeiv_release_lock',{p_id:lock.id,p_force:false});if(x.error)console.warn('[SAEIV] unlock sick batch',x.error)}
}
async function propose(from,to,driverId,reason='Réaffectation à la suite d’un arrêt maladie'){
 if(!db()||!['admin','dispatcher'].includes(profile()?.role))throw Error('Accès exploitation nécessaire');
 const days=Math.round((new Date(to+'T12:00:00Z')-new Date(from+'T12:00:00Z'))/86400000)+1;
 if(days<1||days>31)throw Error('Arrêt de 1 à 31 jours maximum par préparation');
 const result=[];
 for(let i=0;i<days;i++){
  const date=addDay(from,i);
  try{result.push(await forDay(date,driverId,reason))}
  catch(e){result.push({date,error:friendly(e)})}
 }
 return result;
}
window.MonSAEIVSickApprovalV194={installed:true,propose,forDay};
})();