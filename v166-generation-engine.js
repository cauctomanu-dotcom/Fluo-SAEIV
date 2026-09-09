'use strict';
/* Mon SAEIV 1.0.68 — moteur de génération exploitation transactionnel.
   Corrige le cas « 0 segment placé » : chaque segment est proposé, enregistré,
   reconstruit avec HLP/coupures puis validé RSE individuellement. Une course qui
   échoue est retirée seule ; les courses déjà valides restent placées. */
(()=>{
  if(window.MonSAEIVGenerationEngineV166?.installed)return;
  const VERSION='1.0.68';
  const q=id=>document.getElementById(id);
  const cloud=()=>window.MonSAEIVCloudV156;
  const client=()=>cloud()?.client||null;
  const profile=()=>cloud()?.profile||null;
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const mm=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
  const duration=(a,b)=>{let x=mm(a),y=mm(b);if(x===null||y===null)return 0;if(y<x)y+=1440;return Math.max(0,y-x)};
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  const validPoint=p=>!!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const hav=(a,b)=>{if(!validPoint(a)||!validPoint(b))return null;const R=6371,r=x=>x*Math.PI/180,dLat=r(Number(b.lat)-Number(a.lat)),dLon=r(Number(b.lon)-Number(a.lon)),z=Math.sin(dLat/2)**2+Math.cos(r(Number(a.lat)))*Math.cos(r(Number(b.lat)))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(z))};
  const estimateMinutes=km=>km==null?0:Math.max(1,Math.ceil(km/42*60));
  const timeDb=v=>/^\d{2}:\d{2}$/.test(String(v||''))?`${v}:00`:null;
  const clientId=seg=>`seg-${hash(seg.id)}`;
  const dateValue=()=>q('v165Date')?.value||new Date().toISOString().slice(0,10);
  let running=false;

  function status(text,kind=''){
    const el=q('v165Status');if(el){el.textContent=text||'';el.className=`v165-status ${kind}`}
  }
  function assignmentFor(seg,items){
    return items.find(x=>['regular','school'].includes(x.type)&&(x.payload?.segment_id===seg.id||(String(x.linked?.tripId||'')===String(seg.tripId||'')&&String(x.linked?.dept||'')===String(seg.dept||''))))||null;
  }
  function asActivity(x){
    return {id:x.payload?.segment_id||x.id,line:x.line||'',type:x.type,start:String(x.start_time||'').slice(0,5),end:String(x.end_time||'').slice(0,5),origin:x.origin||'',destination:x.destination||'',originCoords:x.origin_coords||null,destinationCoords:x.destination_coords||null,driveMinutes:Number(x.drive_minutes)||duration(x.start_time,x.end_time),regime:x.regime||'national50'};
  }
  function workingItems(items,driverId){
    return items.filter(x=>String(x.driver_user_id)===String(driverId)&&!['auto_hlp','auto_cut'].includes(x.source)).map(asActivity).sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
  }
  function scoreCandidate(seg,driver,current,parking){
    const park=parking.get(String(driver.user_id));if(!validPoint(park))return{ok:false,reason:'stationnement bus absent'};
    const s=mm(seg.start),e0=mm(seg.end);if(s===null||e0===null)return{ok:false,reason:'horaire invalide'};let e=e0;if(e<s)e+=1440;
    const xs=[...current].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
    for(const x of xs){let a=mm(x.start),b=mm(x.end);if(a===null||b===null)continue;if(b<a)b+=1440;if(s<b&&e>a)return{ok:false,reason:'chevauchement'}}
    let prev=null,next=null;
    for(const x of xs){const a=mm(x.start),b=mm(x.end);if(a===null||b===null)continue;let bb=b;if(bb<a)bb+=1440;if(bb<=s)prev=x;else if(a>=e&&!next)next=x}
    const from=prev?.destinationCoords||park,to=next?.originCoords||park,k1=hav(from,seg.originCoords),k2=hav(seg.destinationCoords,to);if(k1===null||k2===null)return{ok:false,reason:'coordonnées manquantes'};
    const m1=estimateMinutes(k1),m2=estimateMinutes(k2);
    if(prev){const pe=mm(prev.end);if(pe!==null&&s-pe<m1)return{ok:false,reason:'HLP avant probablement impossible'}}
    if(next){let ns=mm(next.start);if(ns!==null&&ns<e)ns+=1440;if(ns!==null&&ns-e<m2)return{ok:false,reason:'HLP après probablement impossible'}}
    const all=[...xs,seg].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999)),first=all[0],last=all.at(-1),fm=mm(first.start),le0=mm(last.end);let amplitude=0;
    if(fm!==null&&le0!==null){let le=le0;if(le<fm)le+=1440;amplitude=(le+estimateMinutes(hav(last.destinationCoords,park)||0))-(fm-estimateMinutes(hav(park,first.originCoords)||0))}
    if(amplitude>780)return{ok:false,reason:'amplitude estimée > 13 h'};
    const work=all.reduce((z,x)=>z+(['cut','pause'].includes(x.type)?0:duration(x.start,x.end)),0)+m1+m2;if(work>600)return{ok:false,reason:'travail estimé > 10 h'};
    const eu=all.some(x=>x.regime==='eu561'),drive=all.reduce((z,x)=>z+(['regular','school','tad','hlp'].includes(x.type)?(Number(x.driveMinutes)||duration(x.start,x.end)):0),0)+m1+m2;if(eu&&drive>540)return{ok:false,reason:'conduite estimée > 9 h'};
    let idle=0;if(prev){const pe=mm(prev.end);if(pe!==null)idle+=Math.max(0,s-pe-m1)}if(next){let ns=mm(next.start);if(ns!==null&&ns<e)ns+=1440;if(ns!==null)idle+=Math.max(0,ns-e-m2)}
    return{ok:true,score:(k1+k2)*24+idle*.22+amplitude*.025,hlpKm:k1+k2,idle};
  }
  function rowFor(seg,driverId,userId,orgId,date){
    return{organization_id:orgId,driver_user_id:driverId,client_id:clientId(seg),service_date:date,sort_index:(mm(seg.start)||0)*10,type:seg.type,label:`${seg.line} · ${seg.destination}`,line:seg.line,start_time:timeDb(seg.start),end_time:timeDb(seg.end),origin:seg.origin,destination:seg.destination,origin_coords:seg.originCoords,destination_coords:seg.destinationCoords,origin_kind:'stop',destination_kind:'stop',regime:seg.regime,line_distance_km:seg.lineDistanceKm,drive_minutes:seg.driveMinutes,notes:null,linked:seg.linked,source:'dispatch',locked_by_exploitation:true,status:'ok',conflict_minutes:0,created_by:userId,updated_by:userId,payload:{segment_id:seg.id,created_from:'generation_engine_v166',rse_regime:seg.regime}};
  }
  async function invokeRebuild(driverId,date){
    const c=client();const {data,error}=await c.functions.invoke('rebuild-driver-day',{body:{driverUserId:driverId,serviceDate:date}});if(error)throw error;return data||{};
  }
  function rejectReason(check){
    if(check?.conflicts?.length)return `HLP impossible : ${check.conflicts[0].missingMinutes||'?'} min manquantes`;
    if(check?.rse?.ok===false)return(check.rse.issues||[]).map(x=>x.message).filter(Boolean).join(' · ')||'contrôle RSE refusé';
    return null;
  }
  async function fetchState(date){
    const c=client(),p=profile();
    const [{data:drivers,error:de},{data:items,error:ie},{data:settings,error:se}]=await Promise.all([
      c.from('profiles').select('user_id,matricule,display_name,active').eq('organization_id',p.organization_id).eq('role','driver').eq('active',true),
      c.from('plan_items').select('*').eq('organization_id',p.organization_id).eq('service_date',date).order('start_time',{ascending:true,nullsFirst:false}),
      c.from('driver_settings').select('user_id,bus_parking').eq('organization_id',p.organization_id)
    ]);if(de)throw de;if(ie)throw ie;if(se)throw se;
    const parking=new Map();for(const s of settings||[])if(validPoint(s.bus_parking))parking.set(String(s.user_id),s.bus_parking);
    return{drivers:drivers||[],items:items||[],parking};
  }

  async function generate(){
    if(running)return;
    const c=client(),p=profile(),b=board();if(!c||!p||!b)return status('Session Exploitation indisponible.','err');
    const allSegments=b.segments||[];if(!allSegments.length)return status('Charge d’abord les segments du jour.','err');
    running=true;const button=q('v165Generate');if(button){button.disabled=true;button.textContent='✨ GÉNÉRATION EN COURS…'}
    const date=dateValue();let placed=0,rejectedByServer=0,examined=0,lastReject='';
    try{
      await b.refresh?.();
      let {drivers,items,parking}=await fetchState(date);
      if(!drivers.length)throw new Error('Aucun conducteur actif dans la société.');
      const usable=drivers.filter(d=>parking.has(String(d.user_id)));
      if(!usable.length)throw new Error('Aucun conducteur n’a de « Stationnement bus » géolocalisé.');
      const {data:{user}}=await c.auth.getUser();
      const working=new Map(drivers.map(d=>[String(d.user_id),workingItems(items,d.user_id)]));
      const free=allSegments.filter(s=>!assignmentFor(s,items)).slice().sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999)||String(a.line||'').localeCompare(String(b.line||''),'fr',{numeric:true}));
      if(!free.length){status('Toutes les courses sont déjà placées.','ok');return}
      status(`Génération sûre · ${free.length} segments à étudier…`,'busy');
      for(const seg of free){
        examined++;
        const ranked=[];
        for(const d of usable){const r=scoreCandidate(seg,d,working.get(String(d.user_id))||[],parking);if(r.ok)ranked.push({d,r})}
        ranked.sort((a,b)=>a.r.score-b.r.score);
        if(!ranked.length)continue;
        let accepted=false;
        for(const cand of ranked){
          const driverId=String(cand.d.user_id),cid=clientId(seg);
          status(`✨ ${placed} placé${placed>1?'s':''} · test ${seg.line||'course'} ${seg.start} → ${cand.d.display_name||cand.d.matricule} · ${examined}/${free.length}`,'busy');
          const {error:ins}=await c.from('plan_items').upsert(rowFor(seg,driverId,user?.id||null,p.organization_id,date),{onConflict:'driver_user_id,client_id'});if(ins){lastReject=ins.message||String(ins);rejectedByServer++;continue}
          let check=null,reason=null;
          try{check=await invokeRebuild(driverId,date);reason=rejectReason(check)}catch(err){reason=err?.message||String(err)}
          if(reason){
            lastReject=reason;rejectedByServer++;
            await c.from('plan_items').delete().eq('driver_user_id',driverId).eq('client_id',cid);
            try{await invokeRebuild(driverId,date)}catch{}
            continue;
          }
          accepted=true;placed++;
          working.get(driverId).push(seg);working.get(driverId).sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
          items.push(rowFor(seg,driverId,user?.id||null,p.organization_id,date));
          break;
        }
        if(examined%80===0){await new Promise(r=>setTimeout(r,0))}
      }
      await b.refresh?.();
      const remaining=allSegments.filter(s=>!assignmentFor(s,b.items||[])).length;
      if(placed){status(`✅ Génération terminée : ${placed} segment${placed>1?'s':''} placé${placed>1?'s':''}. HLP + coupures recalculés et affichés sur la grille · ${remaining} non placé${remaining>1?'s':''}.`,'ok')}
      else{status(`⚠ 0 segment placé. ${rejectedByServer?`${rejectedByServer} proposition${rejectedByServer>1?'s':''} refusée${rejectedByServer>1?'s':''} par HLP/RSE. `:''}${lastReject?`Dernier motif : ${lastReject}`:'Aucun enchaînement compatible avec les conducteurs disponibles.'}`,'err')}
    }catch(e){status(`Génération interrompue : ${e?.message||e}`,'err')}
    finally{running=false;if(button){button.disabled=false;button.textContent='✨ GÉNÉRATION INTELLIGENTE'}}
  }

  function intercept(e){const btn=e.target?.closest?.('#v165Generate');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();generate()}
  document.addEventListener('click',intercept,true);
  window.MonSAEIVGenerationEngineV166={installed:true,version:VERSION,generate,get running(){return running}};
})();