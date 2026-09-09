'use strict';
/* Mon SAEIV 1.0.72 — génération Exploitation économique + RSE sur toutes les lignes.
   Règles internes :
   - toute ligne est traitée comme relevant de la RSE 561/2006, quelle que soit sa distance ;
   - une coupure hors Stationnement bus est classée 50 % ;
   - une coupure au Stationnement bus est classée 0 % ;
   - optimisation financière de référence : gazole 2,10 €/L, 30 L/100 km, coût horaire conducteur de référence 20 €/h.
   Le coût horaire est un paramètre de comparaison interne et pourra être rendu configurable par société. */
(()=>{
  if(window.MonSAEIVGenerationEngineV167?.installed)return;
  const VERSION='1.0.72';
  const ECON=Object.freeze({dieselEurPerLiter:2.10,busLitersPer100Km:30,referenceLaborEurPerHour:20,offParkingCutPct:50,parkingCutPct:0,samePlaceMeters:120});
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
  const estimateMinutes=km=>km==null?0:Math.max(0,km<.12?0:Math.ceil((km*1.18)/42*60));
  const near=(a,b)=>{const km=hav(a,b);return km!==null&&km*1000<ECON.samePlaceMeters};
  const fuelCost=km=>Math.max(0,Number(km)||0)*(ECON.busLitersPer100Km/100)*ECON.dieselEurPerLiter;
  const paidCutCost=(minutes,pct)=>Math.max(0,minutes)/60*ECON.referenceLaborEurPerHour*(pct/100);
  const timeDb=v=>/^\d{2}:\d{2}$/.test(String(v||''))?`${v}:00`:null;
  const clientId=seg=>`seg-${hash(seg.id)}`;
  const dateValue=()=>q('v165Date')?.value||new Date().toISOString().slice(0,10);
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').trim();
  let running=false;

  function status(text,kind=''){const el=q('v165Status');if(el){el.textContent=text||'';el.className=`v165-status ${kind}`}}
  function assignmentFor(seg,items){return (items||[]).find(x=>['regular','school'].includes(x.type)&&(x.payload?.segment_id===seg.id||(String(x.linked?.tripId||'')===String(seg.tripId||'')&&String(x.linked?.dept||'')===String(seg.dept||''))))||null}
  function asActivity(x){return{id:x.payload?.segment_id||x.id,line:x.line||'',dept:x.linked?.dept||x.payload?.dept||'',type:x.type,start:String(x.start_time||'').slice(0,5),end:String(x.end_time||'').slice(0,5),origin:x.origin||'',destination:x.destination||'',originCoords:x.origin_coords||null,destinationCoords:x.destination_coords||null,driveMinutes:Number(x.drive_minutes)||duration(x.start_time,x.end_time),regime:'eu561'}}
  function workingItems(items,driverId){return (items||[]).filter(x=>String(x.driver_user_id)===String(driverId)&&!['auto_hlp','auto_cut','auto_service'].includes(x.source)).map(asActivity).sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999))}
  function normalizeKnown(xs){const out=[],seen=new Set();for(const x of Array.isArray(xs)?xs:[]){const dept=String(x?.dept||'').replace(/\D/g,'').slice(0,2),line=String(x?.line||x?.code||'').trim().toUpperCase().replace(/\s+/g,'');if(!dept||!line)continue;const k=`${dept}|${norm(line)}`;if(seen.has(k))continue;seen.add(k);out.push({dept,line,key:k})}return out}
  function segmentLineKey(seg){const dept=String(seg?.dept||seg?.linked?.dept||String(seg?.id||'').split('|')[0]||'').replace(/\D/g,'').slice(0,2),line=String(seg?.line||'').trim().toUpperCase().replace(/\s+/g,'');return dept&&line?`${dept}|${norm(line)}`:''}
  function knowsLine(seg,settings){const k=segmentLineKey(seg);return !!k&&normalizeKnown(settings?.known_lines).some(x=>x.key===k)}

  function gapEconomy(a,b,park){
    const ae=mm(a.end),bs0=mm(b.start);if(ae===null||bs0===null)return{ok:false,reason:'horaire invalide'};
    let bs=bs0;if(bs<ae)bs+=1440;const gap=bs-ae;
    const directKm=hav(a.destinationCoords,b.originCoords);if(directKm===null)return{ok:false,reason:'coordonnées HLP intermédiaire manquantes'};
    const directMin=estimateMinutes(directKm);if(gap<directMin)return{ok:false,reason:`HLP impossible entre ${a.line||'course'} et ${b.line||'course'}`};
    const directCut=gap-directMin,directPct=near(b.originCoords,park)?0:50;
    const directCost=fuelCost(directKm*1.18)+paidCutCost(directCut,directPct);
    let chosen={mode:'direct',hlpKm:directKm*1.18,hlpMinutes:directMin,cutMinutes:directCut,cutPct:directPct,costEur:directCost,paidCutMinutes:directPct===50?directCut:0};
    const k1=hav(a.destinationCoords,park),k2=hav(park,b.originCoords);
    if(k1!==null&&k2!==null){
      const m1=estimateMinutes(k1),m2=estimateMinutes(k2);
      if(m1+m2<=gap){
        const cut=Math.max(0,gap-m1-m2),viaKm=(k1+k2)*1.18,viaCost=fuelCost(viaKm);
        if(viaCost+0.01<chosen.costEur)chosen={mode:'parking',hlpKm:viaKm,hlpMinutes:m1+m2,cutMinutes:cut,cutPct:0,costEur:viaCost,paidCutMinutes:0};
      }
    }
    return{ok:true,...chosen};
  }

  function scheduleEconomy(all,park){
    const xs=[...all].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
    if(!xs.length)return{ok:true,hlpKm:0,hlpMinutes:0,cutMinutes:0,paidCutMinutes:0,cutCount:0,maxCut:0,maxPaidCut:0,costEur:0,amplitude:0,work:0,drive:0,score:0};
    const first=xs[0],last=xs.at(-1),firstKm=hav(park,first.originCoords),lastKm=hav(last.destinationCoords,park);
    if(firstKm===null||lastKm===null)return{ok:false,reason:'coordonnées HLP début/fin manquantes'};
    let hlpKm=(firstKm+lastKm)*1.18,hlpMinutes=estimateMinutes(firstKm)+estimateMinutes(lastKm),cutMinutes=0,paidCutMinutes=0,costEur=fuelCost(hlpKm);
    const cuts=[],paidCuts=[];
    for(let i=0;i<xs.length-1;i++){
      const g=gapEconomy(xs[i],xs[i+1],park);if(!g.ok)return g;
      hlpKm+=g.hlpKm;hlpMinutes+=g.hlpMinutes;cutMinutes+=g.cutMinutes;paidCutMinutes+=g.paidCutMinutes;costEur+=g.costEur;
      if(g.cutMinutes>0){cuts.push(g.cutMinutes);if(g.cutPct===50)paidCuts.push(g.cutMinutes)}
    }
    const fm=mm(first.start),le0=mm(last.end);let amplitude=0;
    if(fm!==null&&le0!==null){let le=le0;if(le<fm)le+=1440;amplitude=(le+estimateMinutes(lastKm)+5)-(fm-estimateMinutes(firstKm)-10)}
    const courseWork=xs.reduce((z,x)=>z+duration(x.start,x.end),0),work=courseWork+hlpMinutes+15,drive=xs.reduce((z,x)=>z+(Number(x.driveMinutes)||duration(x.start,x.end)),0)+hlpMinutes;
    const maxCut=cuts.length?Math.max(...cuts):0,maxPaidCut=paidCuts.length?Math.max(...paidCuts):0,cutCount=cuts.length;
    let score=costEur*100+cutCount*170+paidCutMinutes*3+amplitude*.05;
    if(cutCount>2)score+=(cutCount-2)*350;
    if(maxPaidCut>=120)score+=2500+(maxPaidCut-120)*15;
    if(maxCut>=240)score+=(maxCut-240)*4;
    return{ok:true,hlpKm,hlpMinutes,cutMinutes,paidCutMinutes,cutCount,maxCut,maxPaidCut,costEur,amplitude,work,drive,score};
  }

  function scoreCandidate(seg,driver,current,setting,{compactOnly=false}={}){
    const park=setting?.bus_parking;if(!validPoint(park))return{ok:false,reason:'stationnement bus absent'};
    const known=normalizeKnown(setting?.known_lines);if(!known.length)return{ok:false,reason:'lignes connues non renseignées'};if(!knowsLine(seg,setting))return{ok:false,reason:`ligne ${seg.line||''} non déclarée comme connue`};
    const s=mm(seg.start),e0=mm(seg.end);if(s===null||e0===null)return{ok:false,reason:'horaire invalide'};let e=e0;if(e<s)e+=1440;
    const xs=[...current].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));
    for(const x of xs){let a=mm(x.start),b=mm(x.end);if(a===null||b===null)continue;if(b<a)b+=1440;if(s<b&&e>a)return{ok:false,reason:'chevauchement'}}
    const all=[...xs,{...seg,regime:'eu561'}].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999)),eco=scheduleEconomy(all,park);if(!eco.ok)return eco;
    if(eco.amplitude>780)return{ok:false,reason:'amplitude estimée > 13 h (mode automatique conservateur)'};
    if(eco.work>600)return{ok:false,reason:'travail estimé > 10 h'};
    if(eco.drive>540)return{ok:false,reason:'conduite estimée > 9 h'};
    if(compactOnly&&(eco.maxPaidCut>=120||eco.cutCount>3))return{ok:false,reason:eco.maxPaidCut>=120?'coupure 50 % ≥ 2 h évitée en passe économique':'trop de coupures pour la passe économique'};
    return{ok:true,score:eco.score,hlpKm:eco.hlpKm,hlpMinutes:eco.hlpMinutes,cutMinutes:eco.cutMinutes,paidCutMinutes:eco.paidCutMinutes,cutCount:eco.cutCount,maxCut:eco.maxCut,maxPaidCut:eco.maxPaidCut,costEur:eco.costEur,economy:eco};
  }

  function rowFor(seg,driverId,userId,orgId,date){return{organization_id:orgId,driver_user_id:driverId,client_id:clientId(seg),service_date:date,sort_index:(mm(seg.start)||0)*10,type:seg.type,label:`${seg.line} · ${seg.destination}`,line:seg.line,start_time:timeDb(seg.start),end_time:timeDb(seg.end),origin:seg.origin,destination:seg.destination,origin_coords:seg.originCoords,destination_coords:seg.destinationCoords,origin_kind:'stop',destination_kind:'stop',regime:'eu561',line_distance_km:seg.lineDistanceKm,drive_minutes:seg.driveMinutes,notes:null,linked:{...(seg.linked||{}),rse_policy:'all_lines_eu561'},source:'dispatch',locked_by_exploitation:true,status:'ok',conflict_minutes:0,created_by:userId,updated_by:userId,payload:{segment_id:seg.id,created_from:'generation_engine_v172_financial',rse_regime:'eu561',rse_policy:'all_lines_eu561',dept:seg.dept||seg.linked?.dept||null}}}
  async function invokeRebuild(driverId,date){const c=client();const{data,error}=await c.functions.invoke('rebuild-driver-day',{body:{driverUserId:driverId,serviceDate:date}});if(error)throw error;return data||{}}
  function rejectReason(check){if(check?.conflicts?.length)return`HLP impossible : ${check.conflicts[0].missingMinutes||'?'} min manquantes`;if(check?.rse?.ok===false)return(check.rse.issues||[]).map(x=>x.message).filter(Boolean).join(' · ')||'contrôle RSE refusé';return null}
  async function fetchState(date){const c=client(),p=profile();const[{data:drivers,error:de},{data:items,error:ie},{data:settings,error:se}]=await Promise.all([c.from('profiles').select('user_id,matricule,display_name,active').eq('organization_id',p.organization_id).eq('role','driver').eq('active',true),c.from('plan_items').select('*').eq('organization_id',p.organization_id).eq('service_date',date).order('start_time',{ascending:true,nullsFirst:false}),c.from('driver_settings').select('user_id,bus_parking,known_lines').eq('organization_id',p.organization_id)]);if(de)throw de;if(ie)throw ie;if(se)throw se;const map=new Map();for(const s of settings||[])map.set(String(s.user_id),s);return{drivers:drivers||[],items:items||[],settings:map}}

  async function generate(){
    if(running)return;const c=client(),p=profile(),b=board();if(!c||!p||!b)return status('Session Exploitation indisponible.','err');
    const allSegments=b.segments||[];if(!allSegments.length)return status('Charge d’abord les segments du jour.','err');
    for(const s of allSegments)s.regime='eu561';
    running=true;const button=q('v165Generate');if(button){button.disabled=true;button.textContent='✨ GÉNÉRATION ÉCONOMIQUE…'}
    const date=dateValue();let placed=0,rejectedByServer=0,lastReject='';const rejectedPairs=new Set();
    try{
      await b.refresh?.();let{drivers,items,settings}=await fetchState(date);if(!drivers.length)throw new Error('Aucun conducteur actif dans la société.');
      const withParking=drivers.filter(d=>validPoint(settings.get(String(d.user_id))?.bus_parking)),configured=withParking.filter(d=>normalizeKnown(settings.get(String(d.user_id))?.known_lines).length);
      if(!withParking.length)throw new Error('Aucun conducteur n’a de « Stationnement bus » géolocalisé.');
      if(!configured.length)throw new Error('Aucun conducteur n’a encore de lignes connues renseignées.');
      const{data:{user}}=await c.auth.getUser(),working=new Map(drivers.map(d=>[String(d.user_id),workingItems(items,d.user_id)]));
      const free=allSegments.filter(s=>!assignmentFor(s,items)).slice().sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999)||String(a.line||'').localeCompare(String(b.line||''),'fr',{numeric:true}));
      if(!free.length){status('Toutes les courses sont déjà placées.','ok');return}
      const pending=new Map(free.map(s=>[s.id,s]));
      for(const pass of [{name:'financière',compactOnly:true},{name:'couverture',compactOnly:false}]){
        if(!pending.size)break;let passIndex=0;
        status(pass.compactOnly?`💶 Passe financière · gazole ${ECON.dieselEurPerLiter.toFixed(2).replace('.',',')} €/L · coupures hors stationnement = 50 % · ${pending.size} segments…`:`🧩 Passe de couverture · ${pending.size} segments restants…`,'busy');
        for(const seg of [...pending.values()]){
          passIndex++;const ranked=[];
          for(const d of configured){const pair=`${seg.id}|${d.user_id}`;if(rejectedPairs.has(pair))continue;const r=scoreCandidate(seg,d,working.get(String(d.user_id))||[],settings.get(String(d.user_id)),{compactOnly:pass.compactOnly});if(r.ok)ranked.push({d,r})}
          ranked.sort((a,b)=>a.r.score-b.r.score);if(!ranked.length)continue;
          for(const cand of ranked){
            const driverId=String(cand.d.user_id),cid=clientId(seg),pair=`${seg.id}|${driverId}`;
            status(`✨ ${placed} placé${placed>1?'s':''} · ${pass.name} · ${seg.line||'course'} ${seg.start} → ${cand.d.display_name||cand.d.matricule} · coût estimé ${cand.r.costEur.toFixed(2).replace('.',',')} € · ${passIndex}/${pending.size}`,'busy');
            const{error:ins}=await c.from('plan_items').upsert(rowFor(seg,driverId,user?.id||null,p.organization_id,date),{onConflict:'driver_user_id,client_id'});
            if(ins){lastReject=ins.message||String(ins);rejectedByServer++;rejectedPairs.add(pair);continue}
            let check=null,reason=null;try{check=await invokeRebuild(driverId,date);reason=rejectReason(check)}catch(err){reason=err?.message||String(err)}
            if(reason){lastReject=reason;rejectedByServer++;rejectedPairs.add(pair);await c.from('plan_items').delete().eq('driver_user_id',driverId).eq('client_id',cid);try{await invokeRebuild(driverId,date)}catch{}continue}
            placed++;working.get(driverId).push({...seg,regime:'eu561'});working.get(driverId).sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));items.push(rowFor(seg,driverId,user?.id||null,p.organization_id,date));pending.delete(seg.id);break;
          }
          if(passIndex%40===0)await new Promise(r=>setTimeout(r,0));
        }
      }
      await b.refresh?.();const current=b.items||[],remaining=allSegments.filter(s=>!assignmentFor(s,current));let noQualified=0;
      for(const s of remaining)if(!configured.some(d=>knowsLine(s,settings.get(String(d.user_id)))))noQualified++;
      if(placed)status(`✅ Génération terminée : ${placed} segment${placed>1?'s':''} placé${placed>1?'s':''}. Priorité au coût estimé : coupures 50 % + HLP/gazole ${ECON.dieselEurPerLiter.toFixed(2).replace('.',',')} €/L + nombre de coupures. ${remaining.length} non placé${remaining.length>1?'s':''}${noQualified?`, dont ${noQualified} sans conducteur compétent`:''}.`,'ok');
      else status(`⚠ 0 segment placé. ${noQualified?`${noQualified} sans conducteur compétent. `:''}${rejectedByServer?`${rejectedByServer} proposition${rejectedByServer>1?'s':''} refusée${rejectedByServer>1?'s':''} par HLP/RSE. `:''}${lastReject?`Dernier motif : ${lastReject}`:'Vérifie les lignes connues, le stationnement bus et les horaires.'}`,'err');
    }catch(e){status(`Génération interrompue : ${e?.message||e}`,'err')}
    finally{running=false;if(button){button.disabled=false;button.textContent='✨ GÉNÉRATION INTELLIGENTE'}}
  }

  function intercept(e){const btn=e.target?.closest?.('#v165Generate');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();generate()}
  document.addEventListener('click',intercept,true);
  window.MonSAEIVGenerationEngineV167={installed:true,version:VERSION,generate,scoreCandidate,knowsLine,economics:ECON,get running(){return running}};
})();