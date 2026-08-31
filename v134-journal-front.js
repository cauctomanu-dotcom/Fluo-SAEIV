'use strict';
/* Mon SAEIV 1.0.34 — force Journaux / Mon profil au premier plan, notamment sur Safari iOS. */
(()=>{
  if(window.MonSAEIVV134?.installed)return;
  const q=id=>document.getElementById(id);
  const TOP='2147483000';
  const watched=new WeakSet();

  function closeCompetingLayers(){
    const menu=q('v316MenuBackdrop');
    if(menu){menu.classList.add('hidden');menu.setAttribute('aria-hidden','true');}
    ['v13JournalSheet','v23JournalDetail','v132JournalDetail'].forEach(id=>q(id)?.classList.add('hidden'));
  }

  function promote(el){
    if(!el||el.classList.contains('hidden'))return;
    closeCompetingLayers();
    // Safari/iOS peut conserver un ancien contexte d'empilement. Replacer le panneau
    // à la fin du body et imposer la couche maximale garantit un vrai premier plan.
    if(el.parentElement!==document.body||el!==document.body.lastElementChild)document.body.appendChild(el);
    el.style.setProperty('position','fixed','important');
    el.style.setProperty('z-index',TOP,'important');
    el.style.setProperty('inset','0','important');
    el.style.setProperty('visibility','visible','important');
    el.style.setProperty('opacity','1','important');
    el.style.setProperty('pointer-events','auto','important');
    el.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      closeCompetingLayers();
      if(el!==document.body.lastElementChild)document.body.appendChild(el);
      el.style.setProperty('z-index',TOP,'important');
    });
    setTimeout(()=>{closeCompetingLayers();el.style.setProperty('z-index',TOP,'important')},80);
    setTimeout(()=>{closeCompetingLayers();el.style.setProperty('z-index',TOP,'important')},220);
  }

  function watch(el){
    if(!el||watched.has(el))return;
    watched.add(el);
    new MutationObserver(()=>{if(!el.classList.contains('hidden'))promote(el)}).observe(el,{attributes:true,attributeFilter:['class','style']});
    if(!el.classList.contains('hidden'))promote(el);
  }

  function attach(){
    watch(q('v133JournalHub'));
    watch(q('v133ProfileSheet'));
  }

  const style=document.createElement('style');
  style.id='v134JournalFrontStyle';
  style.textContent=`#v133JournalHub,#v133ProfileSheet{z-index:${TOP}!important}#v133JournalHub:not(.hidden),#v133ProfileSheet:not(.hidden){visibility:visible!important;opacity:1!important;pointer-events:auto!important}`;
  document.head.appendChild(style);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
  new MutationObserver(attach).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',()=>setTimeout(attach,0));
  window.addEventListener('orientationchange',()=>setTimeout(()=>{attach();promote(q('v133JournalHub'));promote(q('v133ProfileSheet'))},80));
  window.MonSAEIVV134={installed:true,promote,version:'1.0.34'};
  console.info('[Mon SAEIV] 1.0.34 affichage Journaux/Profil au premier plan actif');
})();
