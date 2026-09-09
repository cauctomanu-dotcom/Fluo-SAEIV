'use strict';
/* Mon SAEIV 1.0.60 — démarrage propre après externalisation complète du runtime.
   Ce fichier ne contient aucune logique métier de conduite : il verrouille seulement
   la version publiée, le démarrage serveur et la reprise propre de la PWA. */
(()=>{
  if(window.MonSAEIVCleanRuntimeV159?.installed)return;

  const VERSION='1.0.60';
  const q=id=>document.getElementById(id);
  const CLEAN_CACHE='mon-saeiv-clean-1.0.60';
  let reloading=false;

  function stamp(){
    document.title=`Mon SAEIV · ${VERSION}`;
    const e=document.querySelector('.top .eyebrow');
    if(e)e.textContent=`MON SAEIV · ${VERSION}`;
    const b=q('buildInfo');
    if(b){b.textContent=`Version ${VERSION}`;b.hidden=true;b.setAttribute('aria-hidden','true')}
    document.documentElement.dataset.monSaeivVersion=VERSION;
  }

  function forceServerEntry(){
    // La page de connexion autonome V158 est désormais l'unique porte d'entrée.
    // Un ancien choix « profil local » ne doit plus remettre l'ancien overlay V13
    // devant l'écran de rôle lors d'une nouvelle ouverture.
    try{localStorage.setItem('mon-saeiv-cloud-entry-v156','cloud')}catch{}
  }

  async function clearOldCaches(){
    if(!('caches' in window))return;
    try{
      const keys=await caches.keys();
      await Promise.allSettled(keys.filter(k=>(/mon-saeiv|fluo-saeiv/i.test(k)&&k!==CLEAN_CACHE)).map(k=>caches.delete(k)));
    }catch{}
  }

  function showBootFailure(message){
    if(q('v159BootFailure'))return;
    const box=document.createElement('div');
    box.id='v159BootFailure';
    box.setAttribute('role','alert');
    box.style.cssText='position:fixed;z-index:2147483646;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:760px;margin:auto;padding:12px 13px;border:1px solid #8a4446;border-radius:14px;background:#351d20;color:#ffe0dd;font:700 13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 16px 50px rgba(0,0,0,.5)';
    box.innerHTML='<b>Mon SAEIV n’a pas terminé son chargement.</b><div id="v159BootFailureText" style="margin-top:4px;font-weight:500"></div><button id="v159BootReload" type="button" style="width:100%;min-height:44px;margin-top:9px;border:0;border-radius:10px;background:#ffd000;color:#151515;font-weight:900">RECHARGER PROPREMENT</button>';
    document.body.appendChild(box);
    q('v159BootFailureText').textContent=String(message||'Erreur de démarrage.');
    q('v159BootReload')?.addEventListener('click',async()=>{
      try{
        const regs=await navigator.serviceWorker?.getRegistrations?.();
        await Promise.allSettled((regs||[]).map(r=>r.unregister()));
        await clearOldCaches();
      }catch{}
      location.replace(`${location.pathname}?v=${VERSION}&clean=${Date.now()}`);
    });
  }

  async function installWorker(){
    if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))return;
    try{
      const reg=await navigator.serviceWorker.register(`./sw.js?v=${VERSION}`,{updateViaCache:'none'});
      await reg.update().catch(()=>{});
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(reloading)return;
        const key='mon-saeiv-clean-controller-reload-1.0.60';
        try{
          if(sessionStorage.getItem(key)==='1')return;
          sessionStorage.setItem(key,'1');
        }catch{}
        reloading=true;
        location.reload();
      });
    }catch(e){console.warn('[Mon SAEIV] service worker propre',e)}
  }

  function healthCheck(){
    const coreOk=typeof window.MonSAEIVAuthV13?.remoteUnlock==='function';
    const setupOk=!!q('setup')&&!!q('driver')&&!!q('start')&&!!q('route');
    const cloudLoaded=!!window.MonSAEIVCloudV156?.installed;
    const roleLoaded=!!window.MonSAEIVRoleLoginV158?.installed;
    if(!coreOk||!setupOk||!cloudLoaded||!roleLoaded){
      const missing=[];
      if(!setupOk)missing.push('interface conducteur');
      if(!coreOk)missing.push('pont de connexion conducteur');
      if(!cloudLoaded)missing.push('connexion serveur');
      if(!roleLoaded)missing.push('sélecteur de rôle');
      showBootFailure(`Module(s) manquant(s) : ${missing.join(', ')}.`);
    }
  }

  function init(){
    forceServerEntry();
    stamp();
    // L'ancien avis plein écran ne doit jamais survivre au nouveau runtime. Le
    // générateur le remplace déjà par un encart, ceci couvre uniquement un DOM
    // repris depuis un très vieux cache pendant la bascule.
    q('v3127UsageNotice')?.remove();
    clearOldCaches();
    installWorker();
    [0,250,900,2500].forEach(ms=>setTimeout(stamp,ms));
    setTimeout(healthCheck,4500);
  }

  window.MonSAEIVCleanRuntimeV159={installed:true,version:VERSION,stamp,clearOldCaches,healthCheck};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
