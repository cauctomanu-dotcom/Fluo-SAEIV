'use strict';
/* Mon SAEIV 1.0.50 — routeur unique Journaux.
   Priorité à V150 : arrivée réelle, départ réel, temps d'arrêt et preuve de régulation.
   V147 puis V133 restent uniquement des secours de compatibilité. */
(()=>{
  if(window.MonSAEIVV135?.installed)return;
  const VERSION='1.0.50';
  const q=id=>document.getElementById(id);
  const seen=new WeakSet();

  function closeLegacy(){
    q('v316MenuBackdrop')?.classList.add('hidden');
    ['v13JournalSheet','v23JournalDetail','v132JournalDetail','v133JournalHub','v147JournalHub'].forEach(id=>q(id)?.classList.add('hidden'));
  }

  function openCurrentJournals(attempt=0){
    closeLegacy();
    const modern=window.MonSAEIVJournalV150;
    if(typeof modern?.openJournals==='function'){
      modern.openJournals();
      const hub=q('v150Hub');if(hub){hub.classList.remove('hidden');if(hub!==document.body.lastElementChild)document.body.appendChild(hub)}
      return;
    }
    if(attempt<30){setTimeout(()=>openCurrentJournals(attempt+1),100);return}
    const v147=window.MonSAEIVFlowJournalsV147;
    if(typeof v147?.openJournals==='function'){v147.openJournals();return}
    const v133=window.MonSAEIVV133;
    if(typeof v133?.openJournals==='function'){v133.openJournals();return}
    alert('Le module Journaux n’est pas encore prêt. Ferme puis rouvre Mon SAEIV et réessaie.');
  }

  function bindJournalButton(){
    let b=q('v135JournalBtn')||q('v13JournalBtn');
    if(!b||seen.has(b))return;
    if(b.id==='v13JournalBtn')b.id='v135JournalBtn';
    b.textContent='📁 Journaux';b.setAttribute('aria-label','Ouvrir les journaux');seen.add(b);
    b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openCurrentJournals()},true);
  }

  function versionUi(){document.title=`Mon SAEIV · ${VERSION}`;const e=document.querySelector('.top .eyebrow');if(e)e.textContent=`MON SAEIV · ${VERSION}`;const b=q('buildInfo');if(b)b.textContent=`Version ${VERSION}`}
  function install(){bindJournalButton();versionUi();const menu=q('v316MenuItems');if(menu)new MutationObserver(bindJournalButton).observe(menu,{childList:true,subtree:true});new MutationObserver(bindJournalButton).observe(document.documentElement,{childList:true,subtree:true});[250,900,2500].forEach(ms=>setTimeout(bindJournalButton,ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('pageshow',()=>setTimeout(install,0));
  window.MonSAEIVV135={installed:true,openJournals:openCurrentJournals,version:VERSION};
  console.info('[Mon SAEIV] 1.0.50 routeur Journaux régulation actif');
})();
