'use strict';
/* Mon SAEIV 1.0.76 — RH / congés payés dans la grille Exploitation.
   Les indisponibilités sont des journées verrouillées par l'exploitation :
   - RH = repos hebdomadaire ;
   - CP = congés payés ;
   - elles bloquent la génération automatique et le placement manuel des courses ;
   - elles ne sont jamais comptées comme travail, conduite, HLP ou coupure par le serveur RSE. */
(()=>{
  if(window.MonSAEIVDriverAbsencesV176?.installed)return;
  const VERSION='1.0.76';
  const q=id=>document.getElementById(id);
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const cloud=()=>window.MonSAEIVCloudV156;
  const profile=()=>cloud()?.profile||null;
  const isAbsence=x=>['rh','cp'].includes(String(x?.type||'').toLowerCase())||['RH','CP'].includes(String(x?.payload?.absence_kind||'').toUpperCase());
  const labelFor=k=>k==='RH'?'Repos hebdomadaire':'Congés payés';
  const S={busy:false,driverId:null};

  function setStatus(text,kind=''){
    const el=q('v176Status');if(el){el.textContent=text||'';el.className=`v176-status ${kind}`}
  }
  function currentDate(){return q('v165Date')?.value||new Date().toISOString().slice(0,10)}
  function datesBetween(a,b){
    const out=[],start=new Date(`${a}T12:00:00Z`),end=new Date(`${b}T12:00:00Z`);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return out;
    for(let d=new Date(start);d<=end&&out.length<370;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));
    return out;
  }
  function driverName(id){const d=(board()?.drivers||[]).find(x=>String(x.user_id)===String(id));return d?.display_name||d?.matricule||'Conducteur'}

  function installStyle(){
    if(q('v176Style'))return;
    const st=document.createElement('style');st.id='v176Style';st.textContent=`
      .v176-day-btn{width:100%;min-height:30px!important;margin-top:6px!important;padding:4px 6px!important;border-color:#526979!important;background:#122b39!important;color:#eef7fb!important;font-size:.5rem!important}
      .v176-badge{display:inline-flex!important;margin-top:5px!important;padding:3px 7px!important;border-radius:999px!important;font-size:.5rem!important;font-weight:1000!important;letter-spacing:.04em}.v176-badge.rh{background:#15462d;color:#c9ffda!important}.v176-badge.cp{background:#493c13;color:#ffed9f!important}
      .v165-block[title^="RH "]{top:7px!important;height:62px!important;border-color:#388e5a!important;background:#16452d!important;color:#d7ffe4!important;font-size:.62rem!important;font-weight:950!important;display:flex;align-items:center;justify-content:center;z-index:2}.v165-block[title^="CP "]{top:7px!important;height:62px!important;border-color:#b58e25!important;background:#493b10!important;color:#fff0ae!important;font-size:.62rem!important;font-weight:950!important;display:flex;align-items:center;justify-content:center;z-index:2}
      .v176-toolbar-btn{border-color:#6a5e2d!important;background:#28220d!important;color:#ffeca1!important}
      .v176-backdrop{position:fixed;z-index:2147483600;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.76);backdrop-filter:blur(6px)}.v176-backdrop.hidden{display:none!important}.v176-card{width:min(620px,96vw);max-height:92dvh;overflow:auto;padding:17px;border:1px solid #426174;border-radius:20px;background:linear-gradient(180deg,#102936,#071721);box-shadow:0 30px 90px rgba(0,0,0,.68)}.v176-head{display:flex;gap:10px;align-items:flex-start}.v176-head h3{margin:0}.v176-head p{margin:4px 0 0;color:#9eb2bd;font-size:.67rem}.v176-head button{margin-left:auto}.v176-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.v176-form label{font-size:.68rem}.v176-form .wide{grid-column:1/-1}.v176-form input,.v176-form select{width:100%;min-height:44px;margin-top:5px;padding:8px;border:1px solid #3d6072;border-radius:10px;background:#05151f;color:#fff}.v176-note{grid-column:1/-1;padding:10px;border:1px solid #3b5463;border-radius:11px;background:#081923;color:#a9bdc7;font-size:.65rem;line-height:1.45}.v176-actions{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end}.v176-actions .primary{border:0;background:linear-gradient(135deg,#ffd000,#ffad00);color:#111}.v176-status{min-height:1.3em;margin-top:9px;color:#aabdc7;font-size:.65rem}.v176-status.err{color:#ffaaa5}.v176-status.ok{color:#9cf4b7}.v176-status.busy{color:#ffe28a}
      @media(max-width:620px){.v176-backdrop{padding:0;align-items:flex-end}.v176-card{width:100vw;max-height:94dvh;border-radius:20px 20px 0 0}.v176-form{grid-template-columns:1fr}.v176-form .wide,.v176-note,.v176-actions{grid-column:auto}}
    `;document.head.appendChild(st)
  }

  function ensureUi(){
    installStyle();
    const toolbar=q('v165Board')?.querySelector('.v165-toolbar');
    if(toolbar&&!q('v176Open')){const b=document.createElement('button');b.id='v176Open';b.type='button';b.className='v176-toolbar-btn';b.textContent='🌙 RH / 🏖 CP';b.addEventListener('click',()=>openModal());toolbar.insertBefore(b,q('v165Status')||null)}
    if(!q('v176Modal'))document.body.insertAdjacentHTML('beforeend',`
      <div id="v176Modal" class="v176-backdrop hidden" role="dialog" aria-modal="true" aria-label="RH et congés payés">
        <section class="v176-card"><header class="v176-head"><div><h3>Disponibilité du conducteur</h3><p>Place un RH ou des congés payés directement dans le planning Exploitation.</p></div><button id="v176Close" type="button">✕</button></header>
        <form id="v176Form" class="v176-form">
          <label class="wide">Conducteur<select id="v176Driver" required></select></label>
          <label>Statut<select id="v176Kind"><option value="RH">RH · Repos hebdomadaire</option><option value="CP">CP · Congés payés</option><option value="AVAILABLE">Disponible · retirer RH/CP</option></select></label>
          <label>Du<input id="v176From" type="date" required></label>
          <label>Au<input id="v176To" type="date" required></label>
          <div class="v176-note">Un conducteur en <b>RH</b> ou en <b>CP</b> est indisponible pour toute la journée. La génération intelligente et le placement manuel ne doivent lui attribuer aucune course. Par sécurité, s'il possède déjà des courses sur la période, Mon SAEIV refuse l'absence tant qu'elles n'ont pas été retirées ou réaffectées.</div>
          <div class="v176-actions"><button type="button" id="v176Cancel">Annuler</button><button class="primary" type="submit">ENREGISTRER</button></div>
        </form><div id="v176Status" class="v176-status"></div></section>
      </div>`);
    q('v176Close')?.addEventListener('click',closeModal);q('v176Cancel')?.addEventListener('click',closeModal);q('v176Modal')?.addEventListener('click',e=>{if(e.target===q('v176Modal'))closeModal()});q('v176Form')?.addEventListener('submit',save);
  }

  function populateDrivers(selected=null){
    const sel=q('v176Driver'),ds=board()?.drivers||[];if(!sel)return;
    sel.innerHTML=ds.map(d=>`<option value="${String(d.user_id).replace(/"/g,'&quot;')}" ${String(d.user_id)===String(selected||S.driverId||'')?'selected':''}>${String(d.display_name||d.matricule||'Conducteur').replace(/[<>&]/g,'')}</option>`).join('');
  }
  function openModal(driverId=null){
    ensureUi();S.driverId=driverId||S.driverId||board()?.drivers?.[0]?.user_id||null;populateDrivers(S.driverId);const d=currentDate();q('v176From').value=d;q('v176To').value=d;q('v176Kind').value='RH';setStatus('');q('v176Modal')?.classList.remove('hidden')
  }
  function closeModal(){if(S.busy)return;q('v176Modal')?.classList.add('hidden');setStatus('')}

  function decorateRows(){
    ensureUi();const b=board();if(!b)return;
    document.querySelectorAll('[data-driver-lane]').forEach(lane=>{
      const id=lane.dataset.driverLane,meta=lane.closest('.v165-driver-row')?.querySelector('.v165-driver-meta');if(!meta)return;
      const absence=(b.items||[]).find(x=>String(x.driver_user_id)===String(id)&&isAbsence(x));
      let badge=meta.querySelector('.v176-badge');
      if(absence){const kind=String(absence.type||absence.payload?.absence_kind||'').toUpperCase();if(!badge){badge=document.createElement('span');badge.className='v176-badge';meta.appendChild(badge)}badge.className=`v176-badge ${kind.toLowerCase()}`;badge.textContent=kind==='CP'?'🏖 CP · Congés payés':'🌙 RH · Repos hebdomadaire'}else badge?.remove();
      if(!meta.querySelector('[data-v176-driver]')){const btn=document.createElement('button');btn.type='button';btn.className='v176-day-btn';btn.dataset.v176Driver=id;btn.textContent='📅 RH / CP / Disponible';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openModal(id)});meta.appendChild(btn)}
    })
  }

  async function refreshBoard(){try{await board()?.refresh?.()}catch(e){console.warn('[Mon SAEIV] actualisation après RH/CP',e)}setTimeout(decorateRows,80)}
  async function save(e){
    e.preventDefault();if(S.busy)return;const c=cloud()?.client,p=profile();if(!c||!p||!['dispatcher','admin'].includes(p.role))return setStatus('Session Exploitation indisponible.','err');
    const driverId=q('v176Driver')?.value,kind=q('v176Kind')?.value,from=q('v176From')?.value,to=q('v176To')?.value,days=datesBetween(from,to);if(!driverId||!days.length)return setStatus('Conducteur ou période invalide.','err');
    S.busy=true;setStatus('Enregistrement…','busy');
    try{
      const {data:existing,error:readErr}=await c.from('plan_items').select('id,service_date,type,source,payload').eq('organization_id',p.organization_id).eq('driver_user_id',driverId).gte('service_date',days[0]).lte('service_date',days.at(-1));if(readErr)throw readErr;
      const abs=(existing||[]).filter(isAbsence),work=(existing||[]).filter(x=>!isAbsence(x)&&!String(x.source||'').startsWith('auto_')&&['regular','school','tad','hlp','annex','availability','other'].includes(String(x.type||'')));
      if(kind!=='AVAILABLE'&&work.length){const dates=[...new Set(work.map(x=>x.service_date))];throw new Error(`${driverName(driverId)} a déjà ${work.length} activité${work.length>1?'s':''} sur ${dates.length} jour${dates.length>1?'s':''}. Retire ou réaffecte d'abord ces courses avant de poser ${kind}.`)}
      if(abs.length){const ids=abs.map(x=>x.id);for(let i=0;i<ids.length;i+=100){const {error}=await c.from('plan_items').delete().eq('organization_id',p.organization_id).in('id',ids.slice(i,i+100));if(error)throw error}}
      if(kind!=='AVAILABLE'){
        const autos=(existing||[]).filter(x=>String(x.source||'').startsWith('auto_')).map(x=>x.id);for(let i=0;i<autos.length;i+=100){const {error}=await c.from('plan_items').delete().eq('organization_id',p.organization_id).in('id',autos.slice(i,i+100));if(error)throw error}
        const {data:{user}}=await c.auth.getUser();const label=labelFor(kind),rows=days.map((date,i)=>({organization_id:p.organization_id,driver_user_id:driverId,client_id:`absence-${kind.toLowerCase()}-${date}`,service_date:date,sort_index:-100000+i,type:kind.toLowerCase(),label:`${kind} · ${label}`,line:kind,start_time:'00:00:00',end_time:'23:59:00',origin:label,destination:label,origin_kind:'absence',destination_kind:'absence',regime:'none',drive_minutes:0,notes:kind==='RH'?'Repos hebdomadaire planifié par l’exploitation.':'Congés payés planifiés par l’exploitation.',linked:{absence:true,kind},source:'dispatch',locked_by_exploitation:true,status:'ok',conflict_minutes:0,created_by:user?.id||null,updated_by:user?.id||null,payload:{absence_kind:kind,absence_all_day:true,absence_label:label,created_from:'v176-driver-absences'}}));
        for(let i=0;i<rows.length;i+=100){const {error}=await c.from('plan_items').upsert(rows.slice(i,i+100),{onConflict:'driver_user_id,client_id'});if(error)throw error}
      }
      await refreshBoard();setStatus(kind==='AVAILABLE'?`✅ ${driverName(driverId)} remis disponible sur ${days.length} jour${days.length>1?'s':''}.`:`✅ ${driverName(driverId)} placé en ${kind} sur ${days.length} jour${days.length>1?'s':''}.`,'ok');setTimeout(()=>{if(!S.busy)closeModal()},900)
    }catch(err){setStatus(err?.message||String(err),'err')}
    finally{S.busy=false}
  }

  function installEvents(){
    document.addEventListener('click',e=>{if(e.target?.closest?.('#v165Refresh,#v165OpsTab,#v157OpsTab'))setTimeout(decorateRows,350)},true);
    q('v165Date')?.addEventListener('change',()=>setTimeout(decorateRows,500));
    window.addEventListener('mon-saeiv-cloud-planning-synced',()=>setTimeout(decorateRows,200));
  }
  function boot(){let tries=0;const t=setInterval(()=>{const p=profile();if(q('v165Board')&&p&&['dispatcher','admin'].includes(p.role)){clearInterval(t);ensureUi();decorateRows();installEvents();setInterval(()=>{if(!q('v165Board')?.classList.contains('hidden'))decorateRows()},2500)}else if(++tries>240)clearInterval(t)},250)}
  window.MonSAEIVDriverAbsencesV176={installed:true,version:VERSION,open:openModal,refresh:decorateRows,isAbsence};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
