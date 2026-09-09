'use strict';
/* Mon SAEIV 1.0.72 — garde anti-boucle DOM.
   Neutralise uniquement l'observer global de v164-driver-settings qui se réveille
   sur ses propres écritures DOM et peut saturer le thread principal après connexion. */
(()=>{
  if(window.MonSAEIVMutationLoopGuardV172?.installed)return;
  const Native=window.MutationObserver;
  if(typeof Native!=='function')return;

  function GuardedMutationObserver(callback){
    let src='';
    try{src=Function.prototype.toString.call(callback)}catch{}
    const isDriverSettingsObserver=src.includes('renameDepotWording')&&(src.includes('installDriverUi')||src.includes('decorateExploitationGrid'));
    if(!isDriverSettingsObserver)return new Native(callback);

    const observer=new Native(()=>{});
    const nativeObserve=observer.observe.bind(observer);
    observer.observe=(target,options)=>{
      if(target===document.documentElement&&options?.childList&&options?.subtree){
        console.info('[Mon SAEIV] observer global v164 neutralisé — anti-freeze actif');
        return;
      }
      return nativeObserve(target,options);
    };
    return observer;
  }

  try{Object.setPrototypeOf(GuardedMutationObserver,Native)}catch{}
  GuardedMutationObserver.prototype=Native.prototype;
  window.MutationObserver=GuardedMutationObserver;
  window.MonSAEIVMutationLoopGuardV172={installed:true,version:'1.0.72',Native};

  // Filet de sécurité : si la fiche Compte conducteur apparaît après l'initialisation,
  // relance une seule fois le chargement des réglages sans observer tout le document.
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const api=window.MonSAEIVDriverSettingsV164,cloud=window.MonSAEIVCloudV156;
    if(api?.installed&&cloud?.profile?.role==='driver'&&document.getElementById('v156AccountSheet')&&!document.getElementById('v171KnownLinesBox')){
      Promise.resolve(api.load?.()).catch(()=>{});
    }
    if(tries>=120)clearInterval(timer);
  },1000);
})();