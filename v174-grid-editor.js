'use strict';
/* Mon SAEIV 1.0.74 — édition directe de la grille Exploitation.
   - sélection multiple fiable sur grille desktop/mobile ;
   - suppression groupée des courses sélectionnées ;
   - clic droit sur un bloc = édition ;
   - clic sur une activité dans le détail journée = édition ;
   - pourcentage des coupures modifiable (0/25/50) et conservé aux recalculs ;
   - suppression des Conducteurs fictifs de test depuis l'Exploitation. */
(()=>{
  if(window.MonSAEIVGridEditorV174?.installed)return;
  const VERSION='1.0.74';
  const q=id=>document.getElementById(id);
  const S={selected:new Set(),last:null,down:null,detailDriverId:null,busy:false,editing:null,installed:false};
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const cloud=()=>window.MonSAEIVCloudV156;
  const perf=()=>window.MonSAEIVExploitationPerformanceV167;
  const serviceGrid=()=>window.MonSAEIVServiceGridV168;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mm=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
  const timeDb=v=>/^\d{2}:\d{2}$/.test(String(v||''))?`${v}:00`:null;
  const isCourse=x=>!!x?.id&&!String(x.source||'').startsWith('auto_')&&['regular','school','tad'].includes(String(x.type||''));
  const isCut=x=>x?.source==='auto_cut'||x?.type==='cut';
  const itemsForDriver=id=>(board()?.items||[]).filter(x=>String(x.driver_user_id)===String(id)&&x.start_time&&x.end_time).slice().sort((a,b)=>(mm(a.start_time)??9999)-(mm(b.start_time)??9999)||(Number(a.sort_index)||0)-(Number(b.sort_index)||0));
  const driverName=id=>{const d=(board()?.drivers||[]).find(x=>String(x.user_id)===String(id));return d?.display_name||d?.matricule||'Conducteur'};

  function itemForBlock(block){
    const b=board();if(!b||!block)return null;
    const explicit=block.dataset?.v172ItemId||block.dataset?.v173ItemId||block.dataset?.v174ItemId;
    if(explicit){const hit=(b.items||[]).find(x=>String(x.id)===String(explicit));if(hit)return hit}
    const lane=block.closest?.('[data-driver-lane]');if(!lane)return null;
    const items=(b.items||[]).filter(x=>String(x.driver_user_id)===String(lane.dataset.driverLane)&&x.start_time&&x.end_time),blocks=[...lane.querySelectorAll(':scope > .v165-block')],idx=blocks.indexOf(block);
    return idx>=0?items[idx]||null:null;
  }
  function installStyle(){
    if(q('v174Style'))return;
    const s=document.createElement('style');s.id='v174Style';s.textContent=`
      #v172SelectionBar{display:none!important}.v174-selectbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0;padding:9px 10px;border:1px solid #4b6d80;border-radius:12px;background:#091c27;font-size:.64rem}.v174-selectbar b{margin-right:auto}.v174-selectbar button{min-height:34px;padding:5px 9px;font-size:.58rem}.v174-selectbar .trash{border-color:#b65055;background:#542126;color:#ffe0de}.v174-selectbar button:disabled{opacity:.42}.v165-block.v174-selected{z-index:30!important;outline:3px solid #ffd000!important;outline-offset:2px;filter:brightness(1.2)!important;box-shadow:0 0 0 4px rgba(255,208,0,.18)!important}.v165-block.v174-course{cursor:grab!important;user-select:none}.v165-block.v174-editable::before{content:'✎';position:absolute;left:2px;top:1px;font-size:.42rem;opacity:.65}.v174-test-badge{display:inline-block!important;margin-top:4px!important;padding:2px 6px;border-radius:999px;background:#4a2c72;color:#f2ddff!important;font-size:.48rem!important;font-weight:900}.v174-delete-test{width:100%;min-height:28px!important;margin-top:5px!important;padding:4px 6px!important;border-color:#99494e!important;background:#441c20!important;color:#ffd8d5!important;font-size:.5rem!important}
      .v173-item.v174-detail-editable{cursor:pointer;position:relative}.v173-item.v174-detail-editable:hover{outline:2px solid #ffd000}.v173-item.v174-detail-editable::after{content:'Cliquer pour modifier';position:absolute;right:7px;top:5px;color:#dacb7d;font-size:.48rem;font-weight:800}
      .v174-backdrop{position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.75);backdrop-filter:blur(5px)}.v174-backdrop.hidden{display:none}.v174-modal{width:min(660px,96vw);max-height:92vh;overflow:auto;padding:16px;border:1px solid #4a6a7b;border-radius:20px;background:linear-gradient(180deg,#102936,#071721);box-shadow:0 30px 95px rgba(0,0,0,.68)}.v174-head{display:flex;gap:10px;align-items:flex-start}.v174-head h3{margin:0}.v174-head p{margin:4px 0 0;color:#9eb3be;font-size:.66rem}.v174-close{margin-left:auto}.v174-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.v174-form label{font-size:.66rem}.v174-form .wide{grid-column:1/-1}.v174-form input,.v174-form select,.v174-form textarea{width:100%;min-height:42px;margin-top:5px;padding:8px;border:1px solid #3d6072;border-radius:10px;background:#05151f;color:#fff}.v174-form textarea{min-height:82px;resize:vertical}.v174-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.v174-actions .primary{border:0;background:linear-gradient(135deg,#ffd000,#ffad00);color:#151515}.v174-readonly{margin-top:12px;padding:10px;border:1px solid #355264;border-radius:11px;background:#081923;color:#b6c8d1;font-size:.66rem;line-height:1.5}.v174-status{min-height:1.2em;margin-top:8px;color:#9eb3be;font-size:.62rem}.v174-status.err{color:#ffaaa5}.v174-status.ok{color:#9cf4b7}
      @media(max-width:620px){.v174-selectbar{position:sticky;bottom:5px;z-index:35;box-shadow:0 -8px 24px rgba(0,0,0,.35)}.v174-selectbar b{flex:1 1 100%}.v174-backdrop{padding:0;align-items:flex-end}.v174-modal{width:100vw;max-height:94dvh;border-radius:20px 20px 0 0}.v174-form{grid-template-columns:1fr}.v174-form .wide{grid-column:auto}}
    `;document.head.appendChild(s)
  }
  function ensureUi(){
    installStyle();
    if(!q('v174SelectionBar')&&q('v165Grid')){
      const bar=document.createElement('div');bar.id='v174SelectionBar';bar.className='v174-selectbar';bar.innerHTML='<b id="v174SelectionCount">Sélection : 0 segment</b><span style="color:#7f98a5">Clic = sélectionner · Maj+clic = plage · clic droit = modifier</span><button id="v174SelectAll" type="button">☑ Tous les segments visibles</button><button id="v174Clear" type="button">Désélectionner</button><button id="v174Trash" class="trash" type="button" disabled>🗑 Retirer de la grille</button>';q('v165Grid').insertAdjacentElement('beforebegin',bar)
    }
    if(!q('v174Editor'))document.body.insertAdjacentHTML('beforeend','<div id="v174Editor" class="v174-backdrop hidden" role="dialog" aria-modal="true"><section class="v174-modal"><header class="v174-head"><div><h3 id="v174Title">Modifier le segment</h3><p id="v174Subtitle"></p></div><button id="v174Close" class="v174-close" type="button">✕</button></header><div id="v174EditorBody"></div><div id="v174Status" class="v174-status"></div></section></div>');
  }
  function updateSelectionUi(){
    const n=S.selected.size,c=q('v174SelectionCount'),t=q('v174Trash');if(c)c.textContent=`Sélection : ${n} segment${n>1?'s':''}`;if(t){t.disabled=!n||S.busy;t.textContent=n?`🗑 Retirer ${n} segment${n>1?'s':''}`:'🗑 Retirer de la grille'}
    document.querySelectorAll('.v165-block').forEach(el=>{const item=itemForBlock(el),id=item?.id?String(item.id):'';el.classList.toggle('v174-selected',!!id&&S.selected.has(id))})
  }
  function decorate(){
    ensureUi();
    document.querySelectorAll('[data-driver-lane]').forEach(lane=>{
      const blocks=[...lane.querySelectorAll(':scope > .v165-block')];blocks.forEach(block=>{const item=itemForBlock(block);if(!item)return;block.dataset.v174ItemId=String(item.id);block.classList.toggle('v174-course',isCourse(item));block.classList.toggle('v174-editable',isCourse(item)||isCut(item));if(isCourse(item)||isCut(item))block.title=`${block.title||''} · Clic droit : modifier`});
      const id=lane.dataset.driverLane,d=(board()?.drivers||[]).find(x=>String(x.user_id)===String(id)),meta=lane.closest('.v165-driver-row')?.querySelector('.v165-driver-meta');
      if(meta&&d&&/^TEST\d{2}$/i.test(String(d.matricule||''))){if(!meta.querySelector('.v174-test-badge'))meta.insertAdjacentHTML('beforeend','<span class="v174-test-badge">🧪 Conducteur fictif</span>');if(!meta.querySelector('[data-v174-delete-test]')){const btn=document.createElement('button');btn.type='button';btn.className='v174-delete-test';btn.dataset.v174DeleteTest=String(id);btn.textContent='🗑 Supprimer ce conducteur test';meta.appendChild(btn)}}
    });
    if(!q('v173DayBackdrop')?.classList.contains('hidden'))decorateDetail();updateSelectionUi();
  }
  function toggle(item,shift=false){
    if(!isCourse(item)||S.busy)return;const id=String(item.id),driverId=String(item.driver_user_id);
    if(shift&&S.last?.driverId===driverId){const xs=itemsForDriver(driverId).filter(isCourse),a=xs.findIndex(x=>String(x.id)===S.last.id),b=xs.findIndex(x=>String(x.id)===id);if(a>=0&&b>=0)for(let i=Math.min(a,b);i<=Math.max(a,b);i++)S.selected.add(String(xs[i].id))}else S.selected.has(id)?S.selected.delete(id):S.selected.add(id);
    S.last={id,driverId};updateSelectionUi();
  }
  function selectAll(){document.querySelectorAll('.v165-block').forEach(el=>{const item=itemForBlock(el);if(isCourse(item))S.selected.add(String(item.id))});updateSelectionUi()}
  function clear(){S.selected.clear();S.last=null;updateSelectionUi()}
  async function rebuild(driverId,date){const c=cloud()?.client;if(!c||!driverId||!date)return null;const{data,error}=await c.functions.invoke('rebuild-driver-day',{body:{driverUserId:driverId,serviceDate:date}});if(error)throw error;return data}
  async function refresh(){if(perf()?.safeRefresh)return perf().safeRefresh();return board()?.refresh?.()}
  async function trash(){
    if(S.busy)return;const b=board(),c=cloud()?.client,p=cloud()?.profile;if(!b||!c||!p)return;const rows=(b.items||[]).filter(x=>S.selected.has(String(x.id))&&isCourse(x));if(!rows.length)return clear();if(rows.length>1&&!confirm(`Retirer ${rows.length} segments de la grille ?`))return;S.busy=true;updateSelectionUi();
    try{for(let i=0;i<rows.length;i+=100){const ids=rows.slice(i,i+100).map(x=>x.id),{error}=await c.from('plan_items').delete().eq('organization_id',p.organization_id).in('id',ids);if(error)throw error}const affected=new Map();rows.forEach(x=>affected.set(`${x.driver_user_id}|${x.service_date}`,x));for(const x of affected.values())try{await rebuild(x.driver_user_id,x.service_date)}catch(e){console.warn('[Mon SAEIV] rebuild after multidelete',e)}clear();await refresh();decorate();const st=q('v165Status');if(st){st.textContent=`✅ ${rows.length} segment${rows.length>1?'s':''} retiré${rows.length>1?'s':''}. HLP, coupures et RSE recalculés.`;st.className='v165-status ok'}}catch(e){alert(e?.message||String(e))}finally{S.busy=false;updateSelectionUi()}
  }

  function editorStatus(text,kind=''){const el=q('v174Status');if(el){el.textContent=text||'';el.className=`v174-status ${kind}`}}
  function closeEditor(){q('v174Editor')?.classList.add('hidden');S.editing=null;editorStatus('')}
  function openEditor(item){
    if(!item)return;ensureUi();S.editing=item;const d=driverName(item.driver_user_id);q('v174Title').textContent=isCut(item)?'Modifier la coupure':'Modifier le segment';q('v174Subtitle').textContent=`${d} · ${item.service_date||''} · ${String(item.start_time||'').slice(0,5)}–${String(item.end_time||'').slice(0,5)}`;
    const body=q('v174EditorBody');
    if(isCut(item)){
      const pct=Number(item.payload?.cut_percentage??item.linked?.cut_percentage);body.innerHTML=`<form id="v174CutForm" class="v174-form"><label>Pourcentage<select id="v174CutPct"><option value="0" ${pct===0?'selected':''}>0 %</option><option value="25" ${pct===25?'selected':''}>25 %</option><option value="50" ${pct!==0&&pct!==25?'selected':''}>50 %</option></select></label><label class="wide">Notes<textarea id="v174CutNotes">${esc(item.notes||'')}</textarea></label><div class="wide v174-readonly">Lieu : <b>${esc(item.origin||item.destination||'—')}</b><br>La durée de la coupure reste calculée automatiquement entre les courses. Seul son pourcentage est modifié manuellement.</div><div class="wide v174-actions"><button type="button" data-v174-cancel>Annuler</button><button class="primary" type="submit">ENREGISTRER</button></div></form>`;
      q('v174CutForm')?.addEventListener('submit',saveCut);q('v174Editor')?.classList.remove('hidden');return;
    }
    if(isCourse(item)){
      const drivers=(board()?.drivers||[]).map(d=>`<option value="${esc(d.user_id)}" ${String(d.user_id)===String(item.driver_user_id)?'selected':''}>${esc(d.display_name||d.matricule)}</option>`).join('');body.innerHTML=`<form id="v174CourseForm" class="v174-form"><label>Conducteur<select id="v174Driver">${drivers}</select></label><label>Ligne<input id="v174Line" value="${esc(item.line||'')}"></label><label>Début<input id="v174Start" type="time" value="${esc(String(item.start_time||'').slice(0,5))}" required></label><label>Fin<input id="v174End" type="time" value="${esc(String(item.end_time||'').slice(0,5))}" required></label><label class="wide">Libellé<input id="v174Label" value="${esc(item.label||'')}"></label><label class="wide">Notes<textarea id="v174Notes">${esc(item.notes||'')}</textarea></label><div class="wide v174-readonly">${esc(item.origin||'Départ')} → ${esc(item.destination||'Arrivée')}<br>Les lieux et coordonnées de la course restent liés au segment d'origine afin de conserver un calcul HLP cohérent.</div><div class="wide v174-actions"><button type="button" data-v174-cancel>Annuler</button><button class="primary" type="submit">ENREGISTRER ET RECALCULER</button></div></form>`;
      q('v174CourseForm')?.addEventListener('submit',saveCourse);q('v174Editor')?.classList.remove('hidden');return;
    }
    body.innerHTML=`<div class="v174-readonly">Cette activité est calculée automatiquement par Mon SAEIV. Elle se modifie en changeant les courses qui l'entourent.</div><div class="v174-actions"><button type="button" data-v174-cancel>Fermer</button></div>`;q('v174Editor')?.classList.remove('hidden');
  }
  async function saveCourse(e){
    e.preventDefault();if(S.busy||!S.editing)return;const item=S.editing,c=cloud()?.client,p=cloud()?.profile;if(!c||!p)return;const oldDriver=String(item.driver_user_id),newDriver=String(q('v174Driver')?.value||oldDriver),start=q('v174Start')?.value,end=q('v174End')?.value;if(!start||!end)return editorStatus('Horaires incomplets.','err');S.busy=true;editorStatus('Enregistrement et recalcul…');
    try{const payload={...(item.payload||{}),manual_edit:true,manual_edit_at:new Date().toISOString()};const patch={driver_user_id:newDriver,line:String(q('v174Line')?.value||'').trim(),label:String(q('v174Label')?.value||'').trim()||null,start_time:timeDb(start),end_time:timeDb(end),notes:String(q('v174Notes')?.value||'').trim()||null,payload,updated_by:cloud()?.user?.id||null};const{error}=await c.from('plan_items').update(patch).eq('organization_id',p.organization_id).eq('id',item.id);if(error)throw error;await rebuild(oldDriver,item.service_date);if(newDriver!==oldDriver)await rebuild(newDriver,item.service_date);await refresh();closeEditor();decorate();serviceGrid()?.openDriverDay?.(newDriver)}catch(err){editorStatus(err?.message||String(err),'err')}finally{S.busy=false}
  }
  async function saveCut(e){
    e.preventDefault();if(S.busy||!S.editing)return;const item=S.editing,c=cloud()?.client,p=cloud()?.profile;if(!c||!p)return;const pct=Number(q('v174CutPct')?.value);if(![0,25,50].includes(pct))return;S.busy=true;editorStatus('Enregistrement du pourcentage…');
    try{if(item.generated_from_prev&&item.generated_from_next){const{error:oe}=await c.from('cut_overrides').upsert({organization_id:p.organization_id,driver_user_id:item.driver_user_id,service_date:item.service_date,generated_from_prev:item.generated_from_prev,generated_from_next:item.generated_from_next,cut_percentage:pct,updated_by:cloud()?.user?.id||null,updated_at:new Date().toISOString()},{onConflict:'driver_user_id,service_date,generated_from_prev,generated_from_next'});if(oe)throw oe}
      const payload={...(item.payload||{}),cut_percentage:pct,manual_percentage_override:true},linked={...(item.linked||{}),cut_percentage:pct,manual_percentage_override:true},place=item.origin||item.destination||'Lieu de coupure',notes=String(q('v174CutNotes')?.value||'').trim()||'Pourcentage modifié manuellement par l’exploitation.';const{error}=await c.from('plan_items').update({line:`Coupure ${pct} %`,label:`Coupure ${pct} % · ${place}`,payload,linked,notes,updated_by:cloud()?.user?.id||null}).eq('organization_id',p.organization_id).eq('id',item.id);if(error)throw error;if(item.generated_from_prev&&item.generated_from_next)await rebuild(item.driver_user_id,item.service_date);await refresh();closeEditor();decorate();serviceGrid()?.openDriverDay?.(item.driver_user_id)}catch(err){editorStatus(err?.message||String(err),'err')}finally{S.busy=false}
  }
  function decorateDetail(){
    const list=q('v173DayBody')?.querySelector('.v173-list');if(!list)return;let driverId=S.detailDriverId;if(!driverId){const title=q('v173DayTitle')?.textContent||'';const d=(board()?.drivers||[]).find(x=>(x.display_name||x.matricule||'')===title);driverId=d?.user_id||null}if(!driverId)return;const xs=itemsForDriver(driverId),rows=[...list.querySelectorAll(':scope > .v173-item')];rows.forEach((row,i)=>{const item=xs[i];if(!item)return;row.dataset.v174ItemId=String(item.id);row.classList.add('v174-detail-editable');row.title=isCut(item)||isCourse(item)?'Cliquer pour modifier':'Cliquer pour afficher les détails'})
  }
  async function deleteTestDriver(id){
    if(S.busy||!id)return;const c=cloud()?.client;if(!c)return;if(!confirm(`Supprimer ${driverName(id)} ?\n\nCe bouton est réservé aux conducteurs fictifs de test.`))return;S.busy=true;
    try{const{error}=await c.rpc('delete_test_driver',{p_user_id:id});if(error)throw error;await refresh();decorate();const st=q('v165Status');if(st){st.textContent='✅ Conducteur fictif supprimé.';st.className='v165-status ok'}}catch(e){alert(e?.message||String(e))}finally{S.busy=false}
  }

  function onPointerDown(e){
    const block=e.target?.closest?.('.v165-block');if(block&&block.closest?.('#v165Grid')){const item=itemForBlock(block);if(isCourse(item))S.down={id:String(item.id),x:e.clientX,y:e.clientY,t:Date.now(),shift:!!e.shiftKey}}
    const meta=e.target?.closest?.('.v165-driver-meta');if(meta){const lane=meta.closest('.v165-driver-row')?.querySelector('[data-driver-lane]');if(lane)S.detailDriverId=lane.dataset.driverLane}
  }
  function onPointerUp(e){const d=S.down;S.down=null;if(!d||Date.now()-d.t>900)return;const block=e.target?.closest?.('.v165-block');if(!block)return;const item=itemForBlock(block);if(!item||String(item.id)!==d.id)return;if(Math.hypot((e.clientX||0)-d.x,(e.clientY||0)-d.y)>7)return;toggle(item,d.shift)}
  function onContext(e){const block=e.target?.closest?.('.v165-block');if(block&&block.closest?.('#v165Grid')){const item=itemForBlock(block);if(item){e.preventDefault();e.stopPropagation();openEditor(item);return}}const row=e.target?.closest?.('.v173-item');if(row){const item=(board()?.items||[]).find(x=>String(x.id)===String(row.dataset.v174ItemId));if(item){e.preventDefault();openEditor(item)}}}
  function onClick(e){
    const del=e.target?.closest?.('[data-v174-delete-test]');if(del){e.preventDefault();e.stopImmediatePropagation();deleteTestDriver(del.dataset.v174DeleteTest);return}
    if(e.target?.closest?.('#v174SelectAll')){e.preventDefault();selectAll();return}if(e.target?.closest?.('#v174Clear')){e.preventDefault();clear();return}if(e.target?.closest?.('#v174Trash')){e.preventDefault();trash();return}if(e.target?.closest?.('#v174Close,[data-v174-cancel]')){e.preventDefault();closeEditor();return}
    if(e.target===q('v174Editor')){closeEditor();return}
    const detail=e.target?.closest?.('.v173-item');if(detail&&detail.closest?.('#v173DayBody')){const item=(board()?.items||[]).find(x=>String(x.id)===String(detail.dataset.v174ItemId));if(item){e.preventDefault();openEditor(item);return}}
    const meta=e.target?.closest?.('.v165-driver-meta');if(meta&&!e.target.closest('button,input,select,a')){const lane=meta.closest('.v165-driver-row')?.querySelector('[data-driver-lane]');if(lane)S.detailDriverId=lane.dataset.driverLane;setTimeout(decorateDetail,40)}
  }
  function onKey(e){if(e.key==='Escape'&&!q('v174Editor')?.classList.contains('hidden')){e.preventDefault();closeEditor();return}const tag=String(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag)||e.target?.isContentEditable)return;if((e.key==='Delete'||e.key==='Backspace')&&S.selected.size){e.preventDefault();trash()}}
  function boot(){
    let tries=0;const t=setInterval(()=>{if(q('v165Grid')&&board()){clearInterval(t);S.installed=true;ensureUi();decorate();document.addEventListener('pointerdown',onPointerDown,true);document.addEventListener('pointerup',onPointerUp,true);document.addEventListener('contextmenu',onContext,true);document.addEventListener('click',onClick,true);document.addEventListener('keydown',onKey,true);const mo=new MutationObserver(()=>requestAnimationFrame(decorate));mo.observe(q('v165Grid'),{childList:true,subtree:true});setInterval(()=>{decorate();decorateDetail()},1800)}else if(++tries>240)clearInterval(t)},250)
  }
  window.MonSAEIVGridEditorV174={installed:true,version:VERSION,decorate,openEditor,clear,trash,get selected(){return [...S.selected]}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();