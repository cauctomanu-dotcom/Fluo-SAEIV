'use strict';
/* Mon SAEIV 1.0.46 — pont fiable entre Mon planning et l'assistant TAD 1.0.45.
   Ce module est volontairement léger : il fonctionne même si le planning est créé après son chargement
   et même si une ancienne page index.html est encore utilisée par la PWA. */
(()=>{
  if(window.MonSAEIVPlanningTadBridgeV146?.installed)return;
  const q=id=>document.getElementById(id);
  let loading=false,tries=0;

  function loadV145(){
    if(window.MonSAEIVPlanningTadV145?.installed)return Promise.resolve(true);
    if(loading)return new Promise(resolve=>{
      let n=0;const t=setInterval(()=>{if(window.MonSAEIVPlanningTadV145?.installed){clearInterval(t);resolve(true)}else if(++n>50){clearInterval(t);resolve(false)}},100)
    });
    loading=true;
    return new Promise(resolve=>{
      const old=q('v146V145Loader')||document.querySelector('script[src*="v145-planning-tad.js"]');
      if(old&&window.MonSAEIVPlanningTadV145?.installed){loading=false;resolve(true);return}
      const s=document.createElement('script');s.id='v146V145Loader';s.async=false;
      s.src=`./v145-planning-tad.js?v=1.0.46&t=${Date.now()}`;
      s.onload=()=>{loading=false;resolve(!!window.MonSAEIVPlanningTadV145?.installed)};
      s.onerror=()=>{loading=false;resolve(false)};
      document.head.appendChild(s);
    })
  }

  async function sync(reason='sync'){
    const type=q('v316Type')?.value;
    if(type!=='tad'){
      try{window.MonSAEIVPlanningTadV145?.sync?.()}catch{}
      return false;
    }
    const ok=await loadV145();
    if(!ok){
      console.error('[Mon SAEIV] assistant TAD planning indisponible',reason);
      return false;
    }
    try{
      window.MonSAEIVPlanningTadV145.sync?.();
      const guide=q('v145TadGuide');
      if(guide){
        guide.classList.remove('hidden');
        guide.scrollIntoView?.({behavior:'smooth',block:'nearest'});
      }
      return !!guide;
    }catch(e){console.error('[Mon SAEIV] sync TAD planning',e);return false}
  }

  function onChange(e){
    if(e.target?.id!=='v316Type')return;
    if(e.target.value==='tad')setTimeout(()=>sync('type-change'),0);
    else setTimeout(()=>window.MonSAEIVPlanningTadV145?.sync?.(),0)
  }
  function onClick(e){
    if(e.target.closest?.('#v316AddItem,[data-v316-edit],#v316PlanningBtn,[data-v137-open="planning"]')){
      setTimeout(()=>sync('planner-open'),80);
      setTimeout(()=>sync('planner-open-late'),350)
    }
  }

  document.addEventListener('change',onChange,true);
  document.addEventListener('click',onClick,true);
  const mo=new MutationObserver(()=>{
    if(q('v316Editor')&&!q('v316Editor').classList.contains('hidden')&&q('v316Type')?.value==='tad')sync('mutation')
  });
  if(document.body)mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  else document.addEventListener('DOMContentLoaded',()=>mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']}),{once:true});

  [150,600,1500,3500].forEach(ms=>setTimeout(()=>sync(`startup-${ms}`),ms));
  window.MonSAEIVPlanningTadBridgeV146={installed:true,version:'1.0.46',sync,loadV145};
  console.info('[Mon SAEIV] 1.0.46 pont TAD planning actif');
})();