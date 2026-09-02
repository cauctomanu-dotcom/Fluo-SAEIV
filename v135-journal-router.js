'use strict';
/* Mon SAEIV 1.0.49 — routeur unique Journaux.
   Tous les accès Journaux doivent ouvrir la vue restaurée V147 (consultation + export + suppression).
   Les anciens moteurs V133/V23/V13 ne servent plus qu'en secours si le module moderne n'a pas encore fini de charger. */
(()=>{
  if(window.MonSAEIVV135?.installed)return;
  const VERSION='1.0.49';
  const q=id=>document.getElementById(id);
  const seen=new WeakSet();

  function closeLegacy(){
    q('v316MenuBackdrop')?.classList.add('hidden');
    ['v13JournalSheet','v23JournalDetail','v132JournalDetail','v133JournalHub'].forEach(id=>q(id)?.classList.add('hidden'));
  }

  function openModernJournals(){
    const api=window.MonSAEIVFlowJournalsV147;
    if(typeof api?.openJournals!=='function')return false;
    closeLegacy();
    api.openJournals();
    const hub=q('v147JournalHub');
    if(hub){
      hub.classList.remove('hidden');
      if(hub!==document.body.lastElementChild)document.body.appendChild(hub);
      hub.style.setProperty('z-index','2147483600','important');
    }
    return true;
  }

  function openCurrentJournals(attempt=0){
    closeLegacy();
    if(openModernJournals())return;
    // V147 est chargé après ce routeur dans l'index. Si l'utilisateur ouvre
    // très vite le profil au démarrage, on lui laisse le temps d'arriver.
    if(attempt<30){setTimeout(()=>openCurrentJournals(attempt+1),100);return}
    const fallback=window.MonSAEIVV133;
    if(typeof fallback?.openJournals==='function'){
      fallback.openJournals();
      requestAnimationFrame(()=>window.MonSAEIVV134?.promote?.(q('v133JournalHub')));
      return;
    }
    console.error('[Mon SAEIV] aucun moteur Journaux disponible');
    alert('Le module Journaux n’est pas encore prêt. Ferme puis rouvre Mon SAEIV et réessaie.');
  }

  function bindJournalButton(){
    let b=q('v135JournalBtn')||q('v13JournalBtn');
    if(!b||seen.has(b))return;
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
    if(menu)new MutationObserver(()=>{bindJournalButton()}).observe(menu,{childList:true,subtree:true});
    new MutationObserver(()=>bindJournalButton()).observe(document.documentElement,{childList:true,subtree:true});
    [250,900,2500].forEach(ms=>setTimeout(bindJournalButton,ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('pageshow',()=>setTimeout(install,0));
  window.MonSAEIVV135={installed:true,openJournals:openCurrentJournals,version:VERSION};
  console.info('[Mon SAEIV] 1.0.49 routeur Journaux moderne actif');
})();
