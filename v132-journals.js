'use strict';
/* Mon SAEIV 1.0.35 — ancien contrôleur Journaux V132 neutralisé.
   Le moteur actif est désormais v133-profile-journals.js. Ce fichier reste publié
   uniquement pour ne pas casser les anciens caches PWA qui le référencent encore. */
(()=>{
  window.MonSAEIVJournalsV132={
    deprecated:true,
    version:'1.0.35',
    open(){ return window.MonSAEIVV133?.openJournals?.(); },
    render(){ return window.MonSAEIVV133?.openJournals?.(); }
  };
  console.info('[Mon SAEIV] ancien contrôleur Journaux V132 neutralisé');
})();
