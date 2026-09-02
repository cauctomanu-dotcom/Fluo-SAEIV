'use strict';
/* Mon SAEIV 1.0.45 — TAD dans Mon planning.
   Le type TAD utilise désormais un vrai assistant : département, ligne, course exacte,
   arrêt de départ et arrêts réellement desservis. Le dernier arrêt coché devient le terminus.
   La sélection est convertie dans le format de planning existant (linked + tadStops), afin que
   « Ma journée » puisse ensuite préparer et lancer exactement ce TAD. */
(()=>{
  if(window.MonSAEIVPlanningTadV145?.installed)return;
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let editingId=null,loadToken=0,initializedKey='';

  function plannerDate(){return q('v316DayTabs')?.querySelector('button.active')?.dataset?.v316Date||q('serviceDate')?.value||new Date().toISOString().slice(0,10)}
  function currentItem(){try{return (window.FluoPlanningV316?.items?.()||[]).find(x=>String(x.id)===String(editingId))||null}catch{return null}}
  function setStatus(text,kind=''){const e=q('v145TadStatus');if(!e)return;e.className=`v145-tad-status ${kind||''}`;e.textContent=text}
  function compact(s){return String(s||'').trim().split(/\s+-\s+/)[0].trim()||String(s||'').trim()}
  function timeFor(index){try{const d=departureFor(state.run.trip,index,state.run.serviceDate)||arrivalFor(state.run.trip,index,state.run.serviceDate);return d?formatClock(d):''}catch{return ''}}
  function terminusIndex(){const xs=[...(state?.service?.tadStops||[])].map(Number).filter(Number.isInteger).sort((a,b)=>a-b);return xs.length?xs.at(-1):Math.max(0,Number(q('v145TadStart')?.value||0))}

  function ensureUi(){
    const editor=q('v316Editor');if(!editor||q('v145TadGuide'))return;
    const anchor=q('v317RegularGuide')||q('v317HlpGuide')||editor.querySelector('.v316-notes');
    anchor?.insertAdjacentHTML('afterend',`<section id="v145TadGuide" class="v145-tad-guide hidden">
      <div class="v145-tad-title"><div><b>📞 Course TAD</b><span>Choisis la course exacte, puis uniquement les arrêts réellement prévus. Le dernier arrêt coché devient le terminus TAD.</span></div><span class="v145-tad-badge">PLANNING TAD</span></div>
      <div class="v145-tad-grid">
        <label>Département<select id="v145TadDept"><option value="57">57 · Moselle</option><option value="54">54 · Meurthe-et-Moselle</option><option value="67">67 · Bas-Rhin</option><option value="68">68 · Haut-Rhin</option></select></label>
        <label class="wide">Ligne<select id="v145TadRoute" disabled><option value="">Choisir d’abord un département…</option></select></label>
        <label class="wide">Course / heure exacte<select id="v145TadTrip" disabled><option value="">Choisir d’abord une ligne…</option></select></label>
        <label class="wide">Arrêt de départ TAD<select id="v145TadStart" disabled><option value="">Choisir d’abord une course…</option></select></label>
      </div>
      <div class="v145-tad-stop-head"><div><b>Arrêts à desservir</b><span>Le départ reste toujours sélectionné. Coche ensuite les arrêts demandés / réservés pour cette course.</span></div><div><button id="v145TadAll" type="button">Tout cocher</button><button id="v145TadNone" type="button">Tout retirer</button></div></div>
      <div id="v145TadStops" class="v145-tad-stops"><div class="v145-tad-empty">Choisis d’abord une course TAD.</div></div>
      <div id="v145TadSummary" class="v145-tad-summary">Aucun TAD préparé.</div>
      <div id="v145TadStatus" class="v145-tad-status">Choisis un département.</div>
    </section>`);
    const st=document.createElement('style');st.id='v145TadStyle';st.textContent=`
      .v145-tad-guide{margin-top:10px;padding:12px;border:1px solid #42697b;border-radius:15px;background:linear-gradient(180deg,#0c2430,#081923)}.v145-tad-guide.hidden{display:none!important}.v145-tad-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v145-tad-title b,.v145-tad-title span{display:block}.v145-tad-title b{font-size:.9rem}.v145-tad-title div>span{margin-top:3px;color:#9fb6c1;font-size:.68rem;line-height:1.4}.v145-tad-badge{flex:0 0 auto;padding:5px 7px;border:1px solid #8a7427;border-radius:999px;background:#332b08;color:#ffe88c;font-size:.55rem;font-weight:950}.v145-tad-grid{display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:10px}.v145-tad-grid .wide{grid-column:auto}.v145-tad-stop-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-end;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}.v145-tad-stop-head b,.v145-tad-stop-head span{display:block}.v145-tad-stop-head span{margin-top:2px;color:#91a7b3;font-size:.62rem}.v145-tad-stop-head>div:last-child{display:flex;gap:6px}.v145-tad-stop-head button{min-height:34px;padding:6px 8px;font-size:.6rem}.v145-tad-stops{display:grid;gap:5px;max-height:285px;margin-top:8px;overflow:auto}.v145-tad-stop{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px;border:1px solid #2d4859;border-radius:10px;background:#071721}.v145-tad-stop.selected{border-color:#79651e;background:#27220b}.v145-tad-stop.terminus{border-color:#ffd000;box-shadow:inset 3px 0 0 #ffd000}.v145-tad-stop input{width:19px;min-height:19px;accent-color:#ffd000}.v145-tad-stop strong{display:block;font-size:.7rem}.v145-tad-stop small{display:block;margin-top:2px;color:#91a7b3;font-size:.58rem}.v145-tad-stop em{padding:3px 6px;border-radius:999px;background:#173747;color:#d9ecf4;font-size:.52rem;font-style:normal;font-weight:950}.v145-tad-stop.terminus em{background:#ffd000;color:#111}.v145-tad-empty,.v145-tad-summary,.v145-tad-status{margin-top:8px;padding:8px 9px;border:1px solid #2d4859;border-radius:10px;background:#071721;color:#a9bdc7;font-size:.65rem;line-height:1.35}.v145-tad-summary{color:#dbeaf0}.v145-tad-status.ok{border-color:#397c51;color:#d1ffdc}.v145-tad-status.err{border-color:#8a4446;color:#ffd6d3}.v145-tad-status.busy{border-color:#807025;color:#ffe895}
      @media(max-width:680px){.v145-tad-grid{grid-template-columns:1fr}.v145-tad-grid .wide{grid-column:auto}.v145-tad-stop-head{align-items:stretch;flex-direction:column}.v145-tad-stop-head>div:last-child{display:grid;grid-template-columns:1fr 1fr}.v145-tad-stops{max-height:240px}}
    `;document.head.appendChild(st);
    q('v145TadDept')?.addEventListener('change',()=>loadLines());
    q('v145TadRoute')?.addEventListener('change',()=>loadTrips());
    q('v145TadTrip')?.addEventListener('change',()=>selectTrip());
    q('v145TadStart')?.addEventListener('change',()=>changeStart());
    q('v145TadStops')?.addEventListener('change',e=>{const cb=e.target.closest?.('[data-v145-stop]');if(!cb)return;const i=Number(cb.dataset.v145Stop),start=Number(q('v145TadStart')?.value||0);if(!Number.isInteger(i)||i<=start)return;if(cb.checked)state.service.tadStops.add(i);else state.service.tadStops.delete(i);renderStops();linkCurrentTad()});
    q('v145TadAll')?.addEventListener('click',()=>{if(!state?.pattern)return;const start=Number(q('v145TadStart')?.value||0);state.service.tadStops=new Set(state.pattern.stops.map((_,i)=>i).filter(i=>i>=start));renderStops();linkCurrentTad()});
    q('v145TadNone')?.addEventListener('click',()=>{if(!state?.pattern)return;const start=Number(q('v145TadStart')?.value||0);state.service.tadStops=new Set([start]);renderStops();linkCurrentTad()});
  }

  function forceTadEditorUi(){
    ensureUi();const isTad=q('v316Type')?.value==='tad';q('v145TadGuide')?.classList.toggle('hidden',!isTad);if(!isTad){initializedKey='';return}
    q('v317RegularGuide')?.classList.add('hidden');q('v317HlpGuide')?.classList.add('hidden');
    for(const id of ['v318RawStart','v318RawEnd','v317RawLine','v317RawOrigin','v317RawDestination','v317RawRegime','v317RawDistance','v317RawDrive'])q(id)?.classList.add('hidden');
    q('v316Editor')?.querySelector('.v316-link-tools')?.classList.add('hidden');q('v316LinkStatus')?.classList.add('hidden');
    const item=currentItem(),key=`${editingId||'new'}|${plannerDate()}|${item?.linked?.tripId||''}`;
    if(initializedKey!==key){initializedKey=key;initTad(item)}
  }

  async function setTadMode(){
    const date=plannerDate();if(q('serviceDate'))q('serviceDate').value=date;
    if(q('lineTypeFilter')){q('lineTypeFilter').value='all';q('lineTypeFilter').dispatchEvent(new Event('change',{bubbles:true}))}
    if(typeof window.FluoSetServiceModeV313==='function')window.FluoSetServiceModeV313('tad');else if(typeof setServiceMode==='function')setServiceMode('tad');
  }

  async function loadLines(preselect=null){
    const token=++loadToken,dept=q('v145TadDept')?.value||'57',sel=q('v145TadRoute');if(!sel)return;
    sel.disabled=true;sel.innerHTML='<option value="">Chargement des lignes…</option>';q('v145TadTrip').disabled=true;q('v145TadStart').disabled=true;q('v145TadStops').innerHTML='<div class="v145-tad-empty">Chargement…</div>';setStatus('Chargement des lignes TAD…','busy');
    try{await setTadMode();if(q('dept'))q('dept').value=dept;await loadDept(dept);if(token!==loadToken)return;const routes=[...(state?.routes||[])].sort((a,b)=>String(a.short||'').localeCompare(String(b.short||''),'fr',{numeric:true}));sel.innerHTML='<option value="">Choisir une ligne…</option>'+routes.map(r=>`<option value="${esc(r.id)}">${esc(r.short||'Ligne')}${r.long?` — ${esc(r.long)}`:''}</option>`).join('');sel.disabled=false;if(preselect&&routes.some(r=>String(r.id)===String(preselect)))sel.value=String(preselect);setStatus(`${routes.length} ligne${routes.length>1?'s':''} disponible${routes.length>1?'s':''}. Choisis la ligne TAD.`,'ok');if(sel.value)await loadTrips()}catch(e){sel.innerHTML='<option value="">Lignes indisponibles</option>';setStatus(`Impossible de charger les lignes : ${e.message||e}`,'err')}
  }

  async function loadTrips(preselectTripId=null){
    const token=++loadToken,routeId=q('v145TadRoute')?.value,sel=q('v145TadTrip');if(!routeId||!sel)return;sel.disabled=true;sel.innerHTML='<option value="">Chargement des courses…</option>';q('v145TadStart').disabled=true;q('v145TadStops').innerHTML='<div class="v145-tad-empty">Choisis d’abord une course.</div>';setStatus('Chargement des courses exactes TAD…','busy');
    try{await setTadMode();const route=(state?.routes||[]).find(r=>String(r.id)===String(routeId));if(!route)throw new Error('ligne introuvable');if(q('route'))q('route').value=route.id;await loadRoute(route);if(token!==loadToken)return;const runs=(state?.runOptions||[]).map((r,i)=>({r,i}));sel.innerHTML=runs.length?'<option value="">Choisir la course / l’heure exacte…</option>'+runs.map(({r,i})=>{const a=compact(r.pattern?.stops?.[0]?.name||'Départ'),z=compact(r.pattern?.headsign||r.pattern?.stops?.at(-1)?.name||'Terminus');return`<option value="${i}" data-trip="${esc(r.trip?.id||'')}">${esc(formatClock(r.originDeparture))} · ${esc(a)} → ${esc(z)}</option>`}).join(''):'<option value="">Aucune course ce jour</option>';sel.disabled=!runs.length;if(preselectTripId){const o=[...sel.options].find(o=>String(o.dataset.trip||'')===String(preselectTripId));if(o)sel.value=o.value}setStatus(runs.length?`${runs.length} course${runs.length>1?'s':''} disponible${runs.length>1?'s':''} ce jour. Choisis l’heure exacte.`:'Aucune course disponible ce jour.',runs.length?'ok':'err');if(sel.value)await selectTrip()}catch(e){sel.innerHTML='<option value="">Courses indisponibles</option>';setStatus(`Impossible de charger les courses : ${e.message||e}`,'err')}
  }

  async function selectTrip(preselectStart=null,preselectStops=null){
    const idx=Number(q('v145TadTrip')?.value);if(!Number.isInteger(idx)||!state?.runOptions?.[idx])return;setStatus('Préparation de la course TAD…','busy');
    try{await selectRun(idx);const main=q('startStop'),sel=q('v145TadStart');if(!state?.pattern||!sel)throw new Error('parcours indisponible');sel.innerHTML=(state.pattern.stops||[]).map((s,i)=>`<option value="${i}">${i+1}. ${esc(s.name)}${timeFor(i)?` · ${esc(timeFor(i))}`:''}</option>`).join('');sel.disabled=false;const start=Math.max(0,Math.min(state.pattern.stops.length-1,Number.isInteger(Number(preselectStart))?Number(preselectStart):0));sel.value=String(start);if(main){main.value=String(start);main.dispatchEvent(new Event('change',{bubbles:true}))}const chosen=Array.isArray(preselectStops)?preselectStops.map(Number).filter(i=>Number.isInteger(i)&&i>=start&&i<state.pattern.stops.length):[start];state.service.tadStops=new Set(chosen.length?chosen:[start]);state.service.tadStops.add(start);renderStops();linkCurrentTad();setStatus('✅ Course TAD chargée. Choisis maintenant uniquement les arrêts à desservir.','ok')}catch(e){setStatus(`Impossible de préparer cette course : ${e.message||e}`,'err')}
  }

  function changeStart(){
    if(!state?.pattern)return;const start=Number(q('v145TadStart')?.value||0);if(q('startStop')){q('startStop').value=String(start);q('startStop').dispatchEvent(new Event('change',{bubbles:true}))}state.service.tadStops=new Set([...(state.service.tadStops||[])].map(Number).filter(i=>i>=start));state.service.tadStops.add(start);renderStops();linkCurrentTad()
  }

  function renderStops(){
    const box=q('v145TadStops'),sum=q('v145TadSummary');if(!box||!state?.pattern){if(box)box.innerHTML='<div class="v145-tad-empty">Choisis d’abord une course TAD.</div>';return}const start=Number(q('v145TadStart')?.value||0),term=terminusIndex(),stops=state.pattern.stops||[];
    box.innerHTML=stops.map((s,i)=>{const before=i<start,origin=i===start,checked=state.service.tadStops.has(i),last=i===term&&checked;return`<label class="v145-tad-stop ${checked?'selected':''} ${last?'terminus':''}"><input type="checkbox" data-v145-stop="${i}" ${checked?'checked':''} ${(before||origin)?'disabled':''}><span><strong>${i+1}. ${esc(s.name)}</strong><small>${esc(timeFor(i))}${before?' · avant le départ':origin?' · départ TAD':last?' · terminus TAD':checked?' · à desservir':' · non desservi'}</small></span><em>${origin?'DÉPART':last?'TERMINUS':checked?'TAD':'IGNORÉ'}</em></label>`}).join('');
    const chosen=[...state.service.tadStops].map(Number).filter(i=>i>=start).sort((a,b)=>a-b),z=stops[chosen.at(-1)]||stops[start],a=stops[start];if(sum)sum.textContent=`${state.route?.short||'TAD'} · ${a?.name||'Départ'} → ${z?.name||'Terminus'} · ${chosen.length} arrêt${chosen.length>1?'s':''} desservi${chosen.length>1?'s':''}.`;
  }

  function linkCurrentTad(){
    if(!state?.pattern||!state?.run||q('v316Type')?.value!=='tad')return;const start=Number(q('v145TadStart')?.value||0);if(q('startStop'))q('startStop').value=String(start);try{q('v316LinkCourse')?.click();q('v316Type').value='tad';const z=state.pattern.stops?.[terminusIndex()];setStatus(`✅ TAD prêt pour le planning${z?` · terminus ${z.name}`:''}.`,'ok')}catch(e){setStatus(`TAD non lié au planning : ${e.message||e}`,'err')}
  }

  async function initTad(item=null){
    ensureUi();const linked=item?.linked||null,dept=String(linked?.dept||'57');if(q('v145TadDept'))q('v145TadDept').value=['54','57','67','68'].includes(dept)?dept:'57';q('v145TadRoute').innerHTML='<option value="">Chargement…</option>';q('v145TadTrip').innerHTML='<option value="">Chargement…</option>';q('v145TadStart').innerHTML='<option value="">Chargement…</option>';
    await loadLines(linked?.routeId||null);if(linked?.routeId&&q('v145TadRoute'))q('v145TadRoute').value=String(linked.routeId);if(q('v145TadRoute')?.value){await loadTrips(linked?.tripId||null);if(linked?.tripId){const o=[...q('v145TadTrip').options].find(o=>String(o.dataset.trip||'')===String(linked.tripId));if(o)q('v145TadTrip').value=o.value}if(q('v145TadTrip')?.value)await selectTrip(Number(linked?.startStopIndex||0),linked?.tadStops||[])}
  }

  function install(){
    ensureUi();
    document.addEventListener('click',e=>{const edit=e.target.closest?.('[data-v316-edit]'),add=e.target.closest?.('#v316AddItem');if(edit)editingId=edit.dataset.v316Edit;if(add)editingId=null;setTimeout(forceTadEditorUi,0)},true);
    q('v316Type')?.addEventListener('change',()=>{if(q('v316Type').value==='tad'){initializedKey='';setTimeout(forceTadEditorUi,0)}else setTimeout(forceTadEditorUi,0)});
    const ed=q('v316Editor');if(ed)new MutationObserver(()=>{if(!ed.classList.contains('hidden'))setTimeout(forceTadEditorUi,0)}).observe(ed,{attributes:true,attributeFilter:['class']});
    [100,500,1200].forEach(ms=>setTimeout(forceTadEditorUi,ms));
    document.title='Mon SAEIV · 1.0.45';const bi=q('buildInfo');if(bi)bi.textContent='Version 1.0.45';const ver=q('v137Identity')?.querySelector('.v137-version');if(ver)ver.textContent='Version 1.0.45';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.MonSAEIVPlanningTadV145={installed:true,version:'1.0.45',sync:forceTadEditorUi};
  console.info('[Mon SAEIV] 1.0.45 assistant TAD de planning actif');
})();
