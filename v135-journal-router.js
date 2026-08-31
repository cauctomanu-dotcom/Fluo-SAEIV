'use strict';
/* Mon SAEIV 1.0.35 — routeur unique Journaux + cohérence de version.
   Objectif principal : empêcher les anciens contrôleurs Journaux V13/V23/V132
   d'intercepter le clic avant le moteur V133 sur Safari/iOS. */
(()=>{
  if(window.MonSAEIVV135?.installed)return;
  const VERSION='1.0.35';
  const q=id=>document.getElementById(id);
  const seen=new WeakSet();

  function closeLegacy(){
    q('v316MenuBackdrop')?.classList.add('hidden');
    ['v13JournalSheet','v23JournalDetail','v132JournalDetail'].forEach(id=>q(id)?.classList.add('hidden'));
  }

  function openCurrentJournals(){
    closeLegacy();
    const api=window.MonSAEIVV133;
    if(api?.openJournals){
      api.openJournals();
      requestAnimationFrame(()=>window.MonSAEIVV134?.promote?.(q('v133JournalHub')));
      setTimeout(()=>window.MonSAEIVV134?.promote?.(q('v133JournalHub')),60);
      return;
    }
    console.error('[Mon SAEIV] moteur Journaux V133 indisponible');
    alert('Le module Journaux n’est pas encore prêt. Ferme puis rouvre Mon SAEIV et réessaie.');
  }

  function bindJournalButton(){
    let b=q('v135JournalBtn')||q('v13JournalBtn');
    if(!b||seen.has(b))return;
    // Changer l'identifiant est volontaire : les anciens écouteurs délégués
    // recherchent #v13JournalBtn et ne pourront donc plus intercepter le clic.
    if(b.id==='v13JournalBtn')b.id='v135JournalBtn';
    b.textContent='📁 Journaux';
    b.setAttribute('aria-label','Ouvrir les journaux');
    seen.add(b);
    b.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      openCurrentJournals();
    },true);
  }

  function versionUi(){
    document.title=`Mon SAEIV · ${VERSION}`;
    const e=document.querySelector('.top .eyebrow');if(e)e.textContent=`MON SAEIV · ${VERSION}`;
    const b=q('buildInfo');if(b)b.textContent=`Version ${VERSION}`;
  }

  function install(){
    bindJournalButton();versionUi();
    const menu=q('v316MenuItems');
    if(menu)new MutationObserver(()=>{bindJournalButton();versionUi()}).observe(menu,{childList:true,subtree:true});
    new MutationObserver(()=>bindJournalButton()).observe(document.documentElement,{childList:true,subtree:true});
    [250,900,3800,5600].forEach(ms=>setTimeout(()=>{bindJournalButton();versionUi()},ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('pageshow',()=>setTimeout(install,0));
  window.MonSAEIVV135={installed:true,openJournals:openCurrentJournals,version:VERSION};
  console.info('[Mon SAEIV] 1.0.35 routeur unique Journaux actif');
})();
