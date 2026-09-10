'use strict';
/* Mon SAEIV 1.0.77 — indisponibilités horaires + génération respectant le repos hebdomadaire.
   Politique interne de planification :
   - après 5 journées consécutives : 45 h de repos prioritaire ;
   - un 6e jour peut être utilisé seulement en passe de couverture, avec forte pénalité ;
   - après 6 journées consécutives : 35 h de repos minimum configuré avant toute reprise ;
   - jamais de 7e journée consécutive ;
   - RH/CP et indisponibilités horaires bloquent la génération.
   Note : 35 h est une règle métier interne Mon SAEIV, pas la définition légale du repos hebdomadaire réduit du règlement 561/2006. */
(()=>{
  if(window.MonSAEIVSmartRestV177?.installed)return;
  const VERSION='1.0.77';
  const q=id=>document.getElementById(id);
  const cloud=()=>window.MonSAEIVCloudV156;
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const baseEngine=()=>window.MonSAEIVGenerationEngineV167;
  const profile=()=>cloud()?.profile||null;
  const client=()=>cloud()?.client||null;
  const S={busy:false,unavailability:[],driverId:null,lastDate:null};
  const REST={normalHours:45,afterSixHours:35,maxConsecutiveDays:6,sixthDayPenalty:250000};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mm=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
  const clock=n=>{const x=((Math.round(n)%1440)+1440)%1440;return `${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`};
  const timeDb=v=>/^\d{2}:\d{2}$/.test(String(v||''))?`${v}:00`:null;
  const dateValue=()=>q('v165Date')?.value||new Date().toISOString().slice(0,10);
  const dayAdd=(iso,n)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
  const dayDiff=(a,b)=>Math.round((new Date(`${b}T12:00:00Z`)-new Date(`${a}T12:00:00Z`))/86400000);
  const validPoint=p=>!!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const hav=(a,b)=>{if(!validPoint(a)||!validPoint(b))return null;const R=6371,r=x=>x*Math.PI/180,dLat=r(Number(b.lat)-Number(a.lat)),dLon=r(Number(b.lon)-Number(a.lon)),z=Math.sin(dLat/2)**2+Math.cos(r(Number(a.lat)))*Math.cos(r(Number(b.lat)))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(z))};
  const estimateMinutes=km=>km==null?0:Math.max(0,km<.12?0:Math.ceil((km*1.18)/42*60));
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  const isAbsence=x=>['rh','cp'].includes(String(x?.type||'').toLowerCase())||['RH','CP'].includes(String(x?.payload?.absence_kind||'').toUpperCase());
  const isCommercial=x=>['regular','school','tad','annex','other'].includes(String(x?.type||''));
  const assignmentFor=(seg,items)=>(items||[]).find(x=>['regular','school','tad'].includes(String(x.type||''))&&(x.payload?.segment_id===seg.id||(String(x.linked?.tripId||'')===String(seg.tripId||'')&&String(x.linked?.dept||'')===String(seg.dept||''))))||null;
  const overlaps=(a0,a1,b0,b1)=>{const a=mm(a0),b=mm(a1),c=mm(b0),d=mm(b1);if([a,b,c,d].some(x=>x===null))return false;return a<d&&b>c};

  function status(text,kind=''){
    const el=q('v165Status');if(el){el.textContent=text||'';el.className=`v165-status ${kind}`}
  }
  function asActivity(x){return{id:x.payload?.segment_id||x.id,line:x.line||'',dept:x.linked?.dept||x.payload?.dept||'',type:x.type,start:String(x.start_time||'').slice(0,5),end:String(x.end_time||'').slice(0,5),origin:x.origin||'',destination:x.destination||'',originCoords:x.origin_coords||null,destinationCoords:x.destination_coords||null,driveMinutes:Number(x.drive_minutes)||Math.max(0,(mm(x.end_time)||0)-(mm(x.start_time)||0)),regime:'eu561'}}
  function currentActivities(items,driverId){return (items||[]).filter(x=>String(x.driver_user_id)===String(driverId)&&isCommercial(x)&&!isAbsence(x)).map(asActivity).sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999))}

  function serviceWindow(activities,park){
    const xs=[...activities].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));if(!xs.length||!validPoint(park))return null;
    const first=xs[0],last=xs.at(-1),k1=hav(park,first.originCoords),k2=hav(last.destinationCoords,park);if(k1===null||k2===null)return null;
    const firstStart=mm(first.start),lastEnd0=mm(last.end);if(firstStart===null||lastEnd0===null)return null;let lastEnd=lastEnd0;if(lastEnd<firstStart)lastEnd+=1440;
    return{start:firstStart-estimateMinutes(k1)-10,end:lastEnd+estimateMinutes(k2)+5};
  }

  function dutyMap(history,driverId,targetDate){
    const by=new Map();
    for(const x of history||[]){if(String(x.driver_user_id)!==String(driverId)||x.service_date>=targetDate||isAbsence(x)||!isCommercial(x))continue;let d=by.get(x.service_date);if(!d){d={date:x.service_date,worked:true,start:null,end:null};by.set(x.service_date,d)}const s=mm(x.start_time),e=mm(x.end_time);if(s!==null&&(d.start===null||s<d.start))d.start=s;if(e!==null&&(d.end===null||e>d.end))d.end=e}
    // Les temps de prise/fin de service donnent des bornes plus précises quand ils existent.
    for(const x of history||[]){if(String(x.driver_user_id)!==String(driverId)||x.service_date>=targetDate||isAbsence(x))continue;const d=by.get(x.service_date);if(!d)continue;if(x.type==='start'&&x.source==='auto_service'){const s=mm(x.start_time);if(s!==null)d.start=s}if(x.type==='end'&&x.source==='auto_service'){const e=mm(x.end_time);if(e!==null)d.end=e}}
    return by;
  }

  function priorBlock(history,driverId,targetDate){
    const by=dutyMap(history,driverId,targetDate),dates=[...by.keys()].sort();if(!dates.length)return null;const lastDate=dates.at(-1),last=by.get(lastDate);let streak=0,cursor=lastDate;
    while(by.has(cursor)&&streak<21){streak++;cursor=dayAdd(cursor,-1)}
    return{streak,lastDate,lastEnd:last?.end??null,lastStart:last?.start??null};
  }

  function weeklyRestCheck({history,driverId,date,activities,park,compactOnly,alreadyWorkingToday}){
    const block=priorBlock(history,driverId,date);if(!block)return{ok:true,penalty:0,note:''};const win=serviceWindow(activities,park);if(!win)return{ok:true,penalty:0,note:''};
    const delta=dayDiff(block.lastDate,date),rest=block.lastEnd===null?99999:delta*1440+win.start-block.lastEnd;
    if(block.streak>=REST.maxConsecutiveDays){
      if(delta===1)return{ok:false,reason:`repos obligatoire : ${block.streak} jours consécutifs déjà effectués`};
      if(rest<REST.afterSixHours*60)return{ok:false,reason:`repos après 6 jours insuffisant : ${Math.max(0,rest/60).toFixed(1).replace('.',',')} h disponibles / ${REST.afterSixHours} h requises`};
      return{ok:true,penalty:0,note:`repos ${Math.round(rest/60)} h après ${block.streak} jours`};
    }
    if(block.streak===5){
      if(delta===1){
        if(alreadyWorkingToday)return{ok:true,penalty:REST.sixthDayPenalty,note:'6e jour déjà engagé · repos 35 h à protéger ensuite'};
        if(compactOnly)return{ok:false,reason:'45 h de repos hebdomadaire prioritaire après 5 jours'};
        return{ok:true,penalty:REST.sixthDayPenalty,note:'6e jour exceptionnel · repos 35 h à protéger ensuite'};
      }
      if(rest<REST.normalHours*60)return{ok:false,reason:`repos après 5 jours insuffisant : ${Math.max(0,rest/60).toFixed(1).replace('.',',')} h disponibles / ${REST.normalHours} h requises`};
    }
    return{ok:true,penalty:0,note:''};
  }

  function unavailabilityFor(driverId,date,rows){return (rows||[]).filter(x=>String(x.driver_user_id)===String(driverId)&&x.service_date===date)}
  function availabilityCheck(driverId,date,seg,current,unavailability,items){
    if((items||[]).some(x=>String(x.driver_user_id)===String(driverId)&&x.service_date===date&&isAbsence(x)))return{ok:false,reason:'conducteur en RH/CP'};
    const us=unavailabilityFor(driverId,date,unavailability);
    if(us.some(u=>overlaps(seg.start,seg.end,u.start_time,u.end_time)))return{ok:false,reason:`indisponible ${String(us.find(u=>overlaps(seg.start,seg.end,u.start_time,u.end_time))?.start_time||'').slice(0,5)}–${String(us.find(u=>overlaps(seg.start,seg.end,u.start_time,u.end_time))?.end_time||'').slice(0,5)}`};
    for(const x of current){for(const u of us)if(overlaps(x.start,x.end,u.start_time,u.end_time))return{ok:false,reason:'planning existant chevauche une indisponibilité'}}
    return{ok:true};
  }

  function rowFor(seg,driverId,userId,orgId,date){return{organization_id:orgId,driver_user_id:driverId,client_id:`seg-${hash(seg.id)}`,service_date:date,sort_index:(mm(seg.start)||0)*10,type:seg.type,label:`${seg.line} · ${seg.destination}`,line:seg.line,start_time:timeDb(seg.start),end_time:timeDb(seg.end),origin:seg.origin,destination:seg.destination,origin_coords:seg.originCoords,destination_coords:seg.destinationCoords,origin_kind:'stop',destination_kind:'stop',regime:'eu561',line_distance_km:seg.lineDistanceKm,drive_minutes:seg.driveMinutes,notes:null,linked:{...(seg.linked||{}),rse_policy:'all_lines_eu561'},source:'dispatch',locked_by_exploitation:true,status:'ok',conflict_minutes:0,created_by:userId,updated_by:userId,payload:{segment_id:seg.id,created_from:'generation_engine_v177_rest',rse_regime:'eu561',rse_policy:'all_lines_eu561',dept:seg.dept||seg.linked?.dept||null}}}
  async function rebuild(driverId,date){const c=client();const{data,error}=await c.functions.invoke('rebuild-driver-day',{body:{driverUserId:driverId,serviceDate:date}});if(error)throw error;return data||{}}
  function rejectReason(check){if(check?.conflicts?.length)return check.conflicts.map(x=>x.message||x.reason||(`HLP impossible ${x.missingMinutes||''}`)).filter(Boolean).join(' · ');if(check?.rse?.ok===false)return(check.rse.issues||[]).map(x=>x.message).filter(Boolean).join(' · ')||'contrôle RSE refusé';return null}

  async function fetchPlanningContext(date){
    const c=client(),p=profile(),from=dayAdd(date,-28),to=dayAdd(date,2);
    const [{data:drivers,error:de},{data:items,error:ie},{data:history,error:he},{data:settings,error:se},{data:unavailability,error:ue}]=await Promise.all([
      c.from('profiles').select('user_id,matricule,display_name,active').eq('organization_id',p.organization_id).eq('role','driver').eq('active',true),
      c.from('plan_items').select('*').eq('organization_id',p.organization_id).eq('service_date',date).order('start_time',{ascending:true,nullsFirst:false}),
      c.from('plan_items').select('driver_user_id,service_date,type,start_time,end_time,source,payload').eq('organization_id',p.organization_id).gte('service_date',from).lte('service_date',to),
      c.from('driver_settings').select('user_id,bus_parking,known_lines').eq('organization_id',p.organization_id),
      c.from('driver_unavailability').select('id,driver_user_id,service_date,start_time,end_time,reason').eq('organization_id',p.organization_id).eq('service_date',date)
    ]);
    if(de)throw de;if(ie)throw ie;if(he)throw he;if(se)throw se;if(ue)throw ue;const sm=new Map();for(const s of settings||[])sm.set(String(s.user_id),s);return{drivers:drivers||[],items:items||[],history:history||[],settings:sm,unavailability:unavailability||[]};
  }

  async function smartGenerate(){
    if(S.busy)return;const c=client(),p=profile(),b=board(),engine=baseEngine();if(!c||!p||!b||!engine?.scoreCandidate)return status('Moteur de génération indisponible.','err');const segments=b.segments||[];if(!segments.length)return status('Charge d’abord les segments du jour.','err');const date=dateValue(),button=q('v165Generate');S.busy=true;if(button){button.disabled=true;button.textContent='✨ GÉNÉRATION RSE + REPOS…'}let placed=0,rejected=0,protectedRest=0,lastReject='';const rejectedPairs=new Set();
    try{
      await b.refresh?.();let{drivers,items,history,settings,unavailability}=await fetchPlanningContext(date);const configured=drivers.filter(d=>validPoint(settings.get(String(d.user_id))?.bus_parking)&&Array.isArray(settings.get(String(d.user_id))?.known_lines)&&settings.get(String(d.user_id)).known_lines.length);if(!configured.length)throw new Error('Aucun conducteur avec stationnement bus et lignes connues.');const free=segments.filter(s=>!assignmentFor(s,items)).slice().sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));if(!free.length){status('Toutes les courses sont déjà placées.','ok');return}const pending=new Map(free.map(s=>[s.id,s])),working=new Map(drivers.map(d=>[String(d.user_id),currentActivities(items,d.user_id)]));const{data:{user}}=await c.auth.getUser();
      for(const pass of [{name:'repos + économique',compactOnly:true},{name:'couverture',compactOnly:false}]){
        if(!pending.size)break;let i=0;for(const seg of [...pending.values()]){i++;const ranked=[];
          for(const d of configured){const id=String(d.user_id),pair=`${seg.id}|${id}`;if(rejectedPairs.has(pair))continue;const current=working.get(id)||[],setting=settings.get(id),avail=availabilityCheck(id,date,seg,current,unavailability,items);if(!avail.ok)continue;const base=engine.scoreCandidate(seg,d,current,setting,{compactOnly:pass.compactOnly});if(!base?.ok)continue;const all=[...current,{...seg,regime:'eu561'}].sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));const rest=weeklyRestCheck({history,driverId:id,date,activities:all,park:setting.bus_parking,compactOnly:pass.compactOnly,alreadyWorkingToday:current.length>0});if(!rest.ok){if(String(rest.reason||'').includes('45 h'))protectedRest++;continue}ranked.push({d,base,rest,score:Number(base.score||0)+Number(rest.penalty||0)})}
          ranked.sort((a,b)=>a.score-b.score);if(!ranked.length)continue;
          for(const cand of ranked){const id=String(cand.d.user_id),cid=`seg-${hash(seg.id)}`,pair=`${seg.id}|${id}`;status(`✨ ${placed} placé${placed>1?'s':''} · ${pass.name} · ${seg.line||'course'} ${seg.start} → ${cand.d.display_name||cand.d.matricule}${cand.rest.note?` · ${cand.rest.note}`:''}`,'busy');const{error:ins}=await c.from('plan_items').upsert(rowFor(seg,id,user?.id||null,p.organization_id,date),{onConflict:'driver_user_id,client_id'});if(ins){lastReject=ins.message||String(ins);rejected++;rejectedPairs.add(pair);continue}let check=null,reason=null;try{check=await rebuild(id,date);reason=rejectReason(check)}catch(err){reason=err?.message||String(err)}if(reason){lastReject=reason;rejected++;rejectedPairs.add(pair);await c.from('plan_items').delete().eq('driver_user_id',id).eq('client_id',cid);try{await rebuild(id,date)}catch{}continue}placed++;working.get(id).push({...seg,regime:'eu561'});working.get(id).sort((a,b)=>(mm(a.start)??9999)-(mm(b.start)??9999));items.push(rowFor(seg,id,user?.id||null,p.organization_id,date));pending.delete(seg.id);break}
          if(i%30===0){await b.refresh?.();await loadUnavailability(date);await new Promise(r=>setTimeout(r,0))}
        }
      }
      await b.refresh?.();await loadUnavailability(date);decorateGrid();const remaining=segments.filter(s=>!assignmentFor(s,b.items||[])).length;status(`✅ Génération terminée : ${placed} segment${placed>1?'s':''} placé${placed>1?'s':''} · ${remaining} restant${remaining>1?'s':''}. Repos 45 h prioritaire après 5 jours, 6e jour seulement en couverture, 35 h minimum ensuite.${protectedRest?` ${protectedRest} proposition${protectedRest>1?'s':''} écartée${protectedRest>1?'s':''} pour protéger le repos.`:''}`,'ok');
    }catch(e){status(`Génération interrompue : ${e?.message||e}${lastReject?` · ${lastReject}`:''}`,'err')}finally{S.busy=false;if(button){button.disabled=false;button.textContent='✨ GÉNÉRATION INTELLIGENTE'}}
  }

  function installStyle(){if(q('v177Style'))return;const s=document.createElement('style');s.id='v177Style';s.textContent=`
    .v177-open{border-color:#8b5966!important;background:#321923!important;color:#ffd8df!important}.v177-unavailable{position:absolute;top:2px;height:70px;border:1px dashed #e86d83;border-radius:7px;background:repeating-linear-gradient(135deg,rgba(146,36,59,.34) 0,rgba(146,36,59,.34) 7px,rgba(94,27,44,.18) 7px,rgba(94,27,44,.18) 14px);pointer-events:none;z-index:1}.v177-badge{display:block!important;margin-top:4px!important;color:#ffb4c1!important;font-size:.5rem!important;font-weight:900}.v177-rest-badge{display:block!important;margin-top:4px!important;color:#b8e6ff!important;font-size:.49rem!important}
    .v177-backdrop{position:fixed;inset:0;z-index:2147483620;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.76);backdrop-filter:blur(6px)}.v177-backdrop.hidden{display:none!important}.v177-card{width:min(620px,96vw);max-height:92dvh;overflow:auto;padding:17px;border:1px solid #52697a;border-radius:20px;background:linear-gradient(180deg,#102936,#071721)}.v177-head{display:flex;gap:10px;align-items:flex-start}.v177-head h3{margin:0}.v177-head p{margin:4px 0 0;color:#9eb3be;font-size:.67rem;line-height:1.4}.v177-head button{margin-left:auto}.v177-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.v177-form label{font-size:.67rem}.v177-form .wide{grid-column:1/-1}.v177-form input,.v177-form select{width:100%;min-height:44px;margin-top:5px;padding:8px;border:1px solid #3d6072;border-radius:10px;background:#05151f;color:#fff}.v177-actions{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end}.v177-actions .primary{border:0;background:linear-gradient(135deg,#ffd000,#ffad00);color:#111}.v177-list{display:grid;gap:6px;margin-top:12px}.v177-item{display:flex;gap:8px;align-items:center;padding:8px;border:1px solid #5c4050;border-radius:10px;background:#21121a;font-size:.64rem}.v177-item span{flex:1}.v177-item button{min-height:30px;padding:4px 7px}.v177-status{min-height:1.2em;margin-top:9px;color:#aabdc7;font-size:.64rem}.v177-status.err{color:#ffaaa5}.v177-status.ok{color:#9cf4b7}.v177-note{grid-column:1/-1;padding:9px;border:1px solid #365261;border-radius:10px;background:#081923;color:#a8bbc5;font-size:.63rem;line-height:1.45}@media(max-width:620px){.v177-backdrop{padding:0;align-items:flex-end}.v177-card{width:100vw;max-height:94dvh;border-radius:20px 20px 0 0}.v177-form{grid-template-columns:1fr}.v177-form .wide,.v177-note,.v177-actions{grid-column:auto}}
  `;document.head.appendChild(s)}

  function ensureUi(){
    installStyle();const toolbar=q('v165Board')?.querySelector('.v165-toolbar');if(toolbar&&!q('v177Open')){const b=document.createElement('button');b.id='v177Open';b.type='button';b.className='v177-open';b.textContent='⛔ Indispo horaire';b.addEventListener('click',()=>openModal());toolbar.insertBefore(b,q('v165Status')||null)}
    if(!q('v177Modal'))document.body.insertAdjacentHTML('beforeend',`<div id="v177Modal" class="v177-backdrop hidden" role="dialog" aria-modal="true"><section class="v177-card"><header class="v177-head"><div><h3>Indisponibilité horaire</h3><p>Bloque uniquement une plage de la journée. Les courses et HLP ne pourront pas chevaucher ce créneau.</p></div><button id="v177Close" type="button">✕</button></header><form id="v177Form" class="v177-form"><label class="wide">Conducteur<select id="v177Driver" required></select></label><label>Date<input id="v177Date" type="date" required></label><label>Motif<input id="v177Reason" type="text" maxlength="120" placeholder="Rendez-vous, indisponibilité personnelle…"></label><label>De<input id="v177From" type="time" required></label><label>À<input id="v177To" type="time" required></label><div class="v177-note">Exemple : <b>11:30 → 13:30</b>. Une coupure libre peut couvrir ce créneau, mais aucune course, prise de service, fin de service ou HLP ne peut s'y placer.</div><div class="v177-actions"><button id="v177Cancel" type="button">Annuler</button><button class="primary" type="submit">ENREGISTRER L'INDISPO</button></div></form><div id="v177Existing" class="v177-list"></div><div id="v177Status" class="v177-status"></div></section></div>`);
    q('v177Close')?.addEventListener('click',closeModal);q('v177Cancel')?.addEventListener('click',closeModal);q('v177Modal')?.addEventListener('click',e=>{if(e.target===q('v177Modal'))closeModal()});q('v177Form')?.addEventListener('submit',saveUnavailability);q('v177Driver')?.addEventListener('change',renderExisting);q('v177Date')?.addEventListener('change',renderExisting);q('v177Existing')?.addEventListener('click',deleteUnavailability)
  }
  function fillDrivers(selected=null){const el=q('v177Driver'),ds=board()?.drivers||[];if(!el)return;el.innerHTML=ds.map(d=>`<option value="${esc(d.user_id)}" ${String(d.user_id)===String(selected||S.driverId||'')?'selected':''}>${esc(d.display_name||d.matricule)}</option>`).join('')}
  function modalStatus(text,kind=''){const e=q('v177Status');if(e){e.textContent=text||'';e.className=`v177-status ${kind}`}}
  async function openModal(driverId=null){ensureUi();S.driverId=driverId||S.driverId||board()?.drivers?.[0]?.user_id||null;fillDrivers(S.driverId);q('v177Date').value=dateValue();q('v177From').value='11:30';q('v177To').value='13:30';q('v177Reason').value='';q('v177Modal').classList.remove('hidden');await renderExisting()}
  function closeModal(){if(S.busy)return;q('v177Modal')?.classList.add('hidden');modalStatus('')}
  async function renderExisting(){const c=client(),p=profile(),driver=q('v177Driver')?.value,date=q('v177Date')?.value,box=q('v177Existing');if(!c||!p||!driver||!date||!box)return;const{data,error}=await c.from('driver_unavailability').select('*').eq('organization_id',p.organization_id).eq('driver_user_id',driver).eq('service_date',date).order('start_time');if(error){box.innerHTML='';return modalStatus(error.message,'err')}box.innerHTML=(data||[]).length?`<b style="font-size:.65rem">Indisponibilités enregistrées</b>`+(data||[]).map(x=>`<div class="v177-item"><span><b>${esc(String(x.start_time).slice(0,5))}–${esc(String(x.end_time).slice(0,5))}</b><br>${esc(x.reason||'Indisponibilité')}</span><button type="button" data-v177-delete="${esc(x.id)}">🗑</button></div>`).join(''):'<div style="color:#7f98a5;font-size:.62rem">Aucune indisponibilité sur cette date.</div>'}
  async function saveUnavailability(e){e.preventDefault();if(S.busy)return;const c=client(),p=profile(),driver=q('v177Driver')?.value,date=q('v177Date')?.value,start=q('v177From')?.value,end=q('v177To')?.value,reason=String(q('v177Reason')?.value||'').trim()||'Indisponibilité personnelle';if(!c||!p||!driver||!date||!start||!end)return;if((mm(end)??0)<=(mm(start)??0))return modalStatus('L’heure de fin doit être après l’heure de début.','err');S.busy=true;modalStatus('Enregistrement…');try{const{data:{user}}=await c.auth.getUser();const{error}=await c.from('driver_unavailability').insert({organization_id:p.organization_id,driver_user_id:driver,service_date:date,start_time:timeDb(start),end_time:timeDb(end),reason,created_by:user?.id||null});if(error)throw error;const{data:over}=await c.from('plan_items').select('id,type,line,start_time,end_time').eq('driver_user_id',driver).eq('service_date',date);const conflicts=(over||[]).filter(x=>['start','regular','school','tad','hlp','annex','end','other'].includes(String(x.type||''))&&overlaps(x.start_time,x.end_time,start,end));modalStatus(conflicts.length?`⚠ Indisponibilité enregistrée, mais ${conflicts.length} activité${conflicts.length>1?'s':''} existante${conflicts.length>1?'s':''} la chevauche${conflicts.length>1?'nt':''}. Il faut les réaffecter.`:'✅ Indisponibilité enregistrée. La génération ne placera rien sur ce créneau.',conflicts.length?'err':'ok');await loadUnavailability(date);decorateGrid();await renderExisting()}catch(err){modalStatus(err?.message||String(err),'err')}finally{S.busy=false}}
  async function deleteUnavailability(e){const b=e.target.closest?.('[data-v177-delete]');if(!b||S.busy)return;const c=client(),p=profile();if(!c||!p)return;S.busy=true;try{const{error}=await c.from('driver_unavailability').delete().eq('organization_id',p.organization_id).eq('id',b.dataset.v177Delete);if(error)throw error;await loadUnavailability(dateValue());decorateGrid();await renderExisting();modalStatus('Indisponibilité supprimée.','ok')}catch(err){modalStatus(err?.message||String(err),'err')}finally{S.busy=false}}

  async function loadUnavailability(date=dateValue()){const c=client(),p=profile();if(!c||!p)return[];const{data,error}=await c.from('driver_unavailability').select('id,driver_user_id,service_date,start_time,end_time,reason').eq('organization_id',p.organization_id).eq('service_date',date);if(error){console.warn('[Mon SAEIV] indisponibilités',error);return S.unavailability}S.unavailability=data||[];S.lastDate=date;return S.unavailability}
  function decorateGrid(){
    document.querySelectorAll('.v177-unavailable,.v177-badge,.v177-rest-badge').forEach(x=>x.remove());const date=dateValue();for(const u of S.unavailability.filter(x=>x.service_date===date)){const lane=document.querySelector(`[data-driver-lane="${CSS.escape(String(u.driver_user_id))}"]`);if(!lane)continue;const a=mm(u.start_time),b=mm(u.end_time);if(a===null||b===null)continue;const el=document.createElement('div');el.className='v177-unavailable';el.style.left=`${a/1440*100}%`;el.style.width=`${Math.max(.3,(b-a)/1440*100)}%`;el.title=`Indisponible ${clock(a)}–${clock(b)} · ${u.reason||''}`;lane.appendChild(el);const meta=lane.closest('.v165-driver-row')?.querySelector('.v165-driver-meta');if(meta){const badge=document.createElement('span');badge.className='v177-badge';badge.textContent=`⛔ ${clock(a)}–${clock(b)} ${u.reason?`· ${u.reason}`:''}`;meta.appendChild(badge)}}
  }
  async function refreshDecor(){await loadUnavailability(dateValue());decorateGrid()}

  function interceptGeneration(e){const btn=e.target?.closest?.('#v165Generate');if(!btn)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();smartGenerate()}
  function boot(){
    window.addEventListener('click',interceptGeneration,true);
    let tries=0;const t=setInterval(async()=>{const p=profile();if(q('v165Board')&&p&&['dispatcher','admin'].includes(p.role)){clearInterval(t);ensureUi();await refreshDecor();q('v165Date')?.addEventListener('change',()=>setTimeout(refreshDecor,200));document.addEventListener('click',e=>{if(e.target?.closest?.('#v165Refresh,#v157OpsTab,#v165OpsTab'))setTimeout(refreshDecor,500)},true);setInterval(()=>{if(!q('v165Board')?.classList.contains('hidden'))decorateGrid()},3000)}else if(++tries>240)clearInterval(t)},250)
  }
  window.MonSAEIVSmartRestV177={installed:true,version:VERSION,generate:smartGenerate,openUnavailability:openModal,loadUnavailability,weeklyRestCheck,policy:REST};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();