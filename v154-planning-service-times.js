'use strict';
/* Mon SAEIV 1.0.54 — durées métier fixes dans Mon planning.
   Prise de service : 10 minutes.
   Fin de service : 5 minutes.
   La fin est calculée automatiquement depuis l'heure de début et les éléments déjà
   enregistrés sont normalisés en mémoire + localStorage sans toucher aux autres étapes. */
(()=>{
  if(window.MonSAEIVPlanningServiceTimesV154?.installed)return;
  const VERSION='1.0.54';
  const PLAN_KEY='fluo-saeiv-planning-v316';
  const FIXED=Object.freeze({start:10,end:5});
  const q=id=>document.getElementById(id);

  function minute(v){
    const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;
    const h=Number(m[1]),mn=Number(m[2]);if(!Number.isFinite(h)||!Number.isFinite(mn))return null;
    return h*60+mn;
  }
  function clock(total){
    if(!Number.isFinite(Number(total)))return'';
    const n=((Math.round(Number(total))%1440)+1440)%1440;
    return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  }
  function durationFor(type){return FIXED[String(type||'')]||null}
  function expectedEnd(type,start){const d=durationFor(type),m=minute(start);return d&&m!==null?clock(m+d):null}

  function helper(){
    const input=q('v316End'),label=input?.closest('label');if(!label)return null;
    let h=q('v154FixedDurationHelp');
    if(!h){h=document.createElement('small');h.id='v154FixedDurationHelp';h.style.cssText='display:none;margin-top:2px;color:#ffd000;font-size:.62rem;font-weight:850';label.appendChild(h)}
    return h;
  }
  function syncEditor(){
    const type=q('v316Type')?.value,d=durationFor(type),start=q('v316Start'),end=q('v316End'),h=helper();if(!end)return;
    if(!d){end.readOnly=false;end.removeAttribute('aria-readonly');end.removeAttribute('data-v154-fixed');if(h)h.style.display='none';return}
    const e=expectedEnd(type,start?.value);if(e)end.value=e;
    end.readOnly=true;end.setAttribute('aria-readonly','true');end.dataset.v154Fixed=String(d);
    if(h){h.textContent=type==='start'?'Durée automatique : 10 minutes':'Durée automatique : 5 minutes';h.style.display='block'}
  }

  function normalizeExisting(){
    let live=[];try{live=window.FluoPlanningV316?.items?.()||[]}catch{}
    if(!Array.isArray(live)||!live.length)return 0;
    let changed=0;
    for(const item of live){const e=expectedEnd(item?.type,item?.start);if(!e||item.end===e)continue;item.end=e;item.updatedAt=new Date().toISOString();changed++}
    if(!changed)return 0;
    try{
      const stored=JSON.parse(localStorage.getItem(PLAN_KEY)||'{}');
      if(Array.isArray(stored.items)){
        const byId=new Map(live.map(x=>[String(x.id),x]));
        for(const x of stored.items){const n=byId.get(String(x.id));if(n&&durationFor(n.type)){x.end=n.end;x.updatedAt=n.updatedAt}}
        localStorage.setItem(PLAN_KEY,JSON.stringify(stored));
      }
    }catch(e){console.warn('[Mon SAEIV] normalisation durées planning',e)}
    try{window.dispatchEvent(new CustomEvent('mon-saeiv-planning-durations-normalized',{detail:{changed}}))}catch{}
    return changed;
  }

  function install(){
    const type=q('v316Type'),start=q('v316Start'),end=q('v316End'),form=q('v316Editor');
    type?.addEventListener('change',syncEditor);
    start?.addEventListener('input',syncEditor);start?.addEventListener('change',syncEditor);
    end?.addEventListener('input',()=>{if(durationFor(type?.value))syncEditor()});
    form?.addEventListener('submit',syncEditor,true);
    if(form)new MutationObserver(()=>{if(!form.classList.contains('hidden'))queueMicrotask(syncEditor)}).observe(form,{attributes:true,attributeFilter:['class']});
    normalizeExisting();syncEditor();
    window.MonSAEIVPlanningServiceTimesV154={installed:true,version:VERSION,durations:{priseDeServiceMinutes:10,finDeServiceMinutes:5},normalize:normalizeExisting,syncEditor};
    console.info('[Mon SAEIV] 1.0.54 durées planning : prise 10 min · fin 5 min')
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
