'use strict';
/* Mon SAEIV 1.0.55 — taux de coupure dans Mon planning.
   Une coupure peut être comptée/payée à 0, 25, 50, 75 ou 100 %.
   Toute la coupure reste dans l'amplitude ; seule la fraction choisie rejoint le temps de travail. */
(()=>{
  if(window.MonSAEIVPlanningCutsV155?.installed)return;
  const VERSION='1.0.55';
  const ALLOWED=[0,25,50,75,100];
  const q=id=>document.getElementById(id);
  let editingCutId=null,renderQueued=false;

  function pct(v){const n=Number(v);return ALLOWED.includes(n)?n:0}
  function minute(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
  function duration(start,end){let a=minute(start),b=minute(end);if(a===null||b===null)return 0;if(b<a)b+=1440;return Math.max(0,b-a)}
  function countedMinutes(item){return item?.type==='cut'?duration(item.start,item.end)*pct(item.cutPercent)/100:0}
  function fmt(m){m=Math.max(0,Math.round(Number(m)||0));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')}`}
  function items(){try{return window.FluoPlanningV316?.items?.()||[]}catch{return[]}}

  function ensureStyle(){if(q('v155CutStyle'))return;const s=document.createElement('style');s.id='v155CutStyle';s.textContent=`
    .v155-cut-badge{display:inline-flex;margin-left:6px;padding:3px 7px;border:1px solid #79691e;border-radius:999px;background:#332d0c;color:#ffe58a;font-size:.58rem;font-weight:950;white-space:nowrap}
    .v155-cut-detail{display:block!important;margin-top:3px!important;color:#ffe58a!important;font-size:.62rem!important;font-weight:850!important}
    #v155CutPercentWrap small{display:block;margin-top:2px}
  `;document.head.appendChild(s)}
  function ensureField(){
    const form=q('v316Editor');if(!form)return null;
    let wrap=q('v155CutPercentWrap');if(wrap)return wrap;
    wrap=document.createElement('label');wrap.id='v155CutPercentWrap';wrap.className='hidden';wrap.innerHTML=`Part de coupure comptée / payée
      <select id="v155CutPercent" aria-label="Pourcentage de coupure comptée et payée">
        ${ALLOWED.map(n=>`<option value="${n}">${n} %</option>`).join('')}
      </select>
      <small id="v155CutPercentHelp" style="color:#9fb5c0;font-size:.62rem;font-weight:700;line-height:1.35">La coupure reste entièrement dans l’amplitude. Seule cette part est ajoutée au temps de travail et correspond à la part payée.</small>`;
    const notes=q('v316Notes')?.closest('label');if(notes)notes.insertAdjacentElement('beforebegin',wrap);else form.querySelector('.v316-form-grid')?.appendChild(wrap);
    q('v155CutPercent')?.addEventListener('change',refreshHelp);
    return wrap
  }
  function itemById(id){return items().find(x=>String(x.id)===String(id))||null}
  function inferCurrentCut(){
    if(editingCutId){const x=itemById(editingCutId);if(x)return x}
    const type=q('v316Type')?.value;if(type!=='cut')return null;
    const start=q('v316Start')?.value,end=q('v316End')?.value,label=q('v316Label')?.value||'';
    return items().find(x=>x.type==='cut'&&x.start===start&&x.end===end&&String(x.label||'')===String(label))||null
  }
  function refreshHelp(){
    const sel=q('v155CutPercent'),help=q('v155CutPercentHelp');if(!sel||!help)return;
    const d=duration(q('v316Start')?.value,q('v316End')?.value),p=pct(sel.value),counted=d*p/100;
    help.textContent=`${fmt(d)} de coupure · ${p} % = ${fmt(counted)} comptées dans le travail et payées. L’amplitude conserve ${fmt(d)}.`
  }
  function sync(){
    const wrap=ensureField(),type=q('v316Type')?.value||'';if(!wrap)return;
    const on=type==='cut';wrap.classList.toggle('hidden',!on);if(!on)return;
    const item=inferCurrentCut(),sel=q('v155CutPercent');if(sel){const wanted=pct(item?.cutPercent);if(sel.value!==String(wanted))sel.value=String(wanted)}
    refreshHelp()
  }
  function annotatePlanner(){
    const xs=items();
    document.querySelectorAll('#v316PlanList [data-v316-id]').forEach(card=>{
      card.querySelectorAll('.v155-cut-badge,.v155-cut-detail').forEach(x=>x.remove());
      const item=xs.find(x=>String(x.id)===String(card.dataset.v316Id));if(item?.type!=='cut')return;
      const p=pct(item.cutPercent),counted=countedMinutes(item),strong=card.querySelector('.v316-plan-text strong'),small=card.querySelector('.v316-plan-text small');
      if(strong)strong.insertAdjacentHTML('beforeend',`<span class="v155-cut-badge">${p} %</span>`);
      if(small){const d=document.createElement('span');d.className='v155-cut-detail';d.textContent=`${fmt(duration(item.start,item.end))} de coupure · ${fmt(counted)} comptées/payées`;small.insertAdjacentElement('afterend',d)}
    });
  }
  function annotateToday(){
    const cuts=items().filter(x=>x.type==='cut'),cards=[...document.querySelectorAll('#v316TodayList .v316-today-item')];
    for(const card of cards){card.querySelectorAll('.v155-cut-badge,.v155-cut-detail').forEach(x=>x.remove());const t=card.querySelector('.v316-time b')?.textContent?.trim(),e=card.querySelector('.v316-time span')?.textContent?.trim();const item=cuts.find(x=>x.start===t&&x.end===e);if(!item)continue;const p=pct(item.cutPercent),counted=countedMinutes(item),strong=card.querySelector('strong'),small=card.querySelector('small');if(strong)strong.insertAdjacentHTML('beforeend',`<span class="v155-cut-badge">${p} %</span>`);if(small){const d=document.createElement('span');d.className='v155-cut-detail';d.textContent=`${fmt(counted)} comptées/payées`;small.insertAdjacentElement('afterend',d)}}
  }
  function annotate(){renderQueued=false;annotatePlanner();annotateToday()}
  function scheduleAnnotate(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(annotate)}

  function install(){
    ensureStyle();ensureField();
    document.addEventListener('click',e=>{
      const edit=e.target.closest?.('[data-v316-edit]');if(edit){editingCutId=edit.dataset.v316Edit;queueMicrotask(sync);return}
      if(e.target.closest?.('#v316AddItem')){editingCutId=null;queueMicrotask(sync)}
    },true);
    q('v316Type')?.addEventListener('change',()=>{if(q('v316Type')?.value!=='cut')editingCutId=null;queueMicrotask(sync)});
    q('v316Start')?.addEventListener('input',refreshHelp);q('v316Start')?.addEventListener('change',refreshHelp);q('v316End')?.addEventListener('input',refreshHelp);q('v316End')?.addEventListener('change',refreshHelp);
    const form=q('v316Editor');if(form){new MutationObserver(()=>{if(!form.classList.contains('hidden'))queueMicrotask(sync)}).observe(form,{attributes:true,attributeFilter:['class']});form.addEventListener('submit',()=>{if(q('v316Type')?.value==='cut')refreshHelp();setTimeout(scheduleAnnotate,0)},true)}
    [q('v316PlanList'),q('v316TodayList'),q('v316DaySummary'),q('v316WeekSummary')].filter(Boolean).forEach(el=>new MutationObserver(scheduleAnnotate).observe(el,{childList:true,subtree:true}));
    sync();scheduleAnnotate();
    window.MonSAEIVPlanningCutsV155={installed:true,version:VERSION,allowed:[...ALLOWED],percent:pct,countedMinutes,annotate:scheduleAnnotate};
    console.info('[Mon SAEIV] 1.0.55 coupures : 0 / 25 / 50 / 75 / 100 %')
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
