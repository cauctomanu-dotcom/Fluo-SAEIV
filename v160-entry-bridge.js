'use strict';
/* Mon SAEIV 1.0.61 — pont entre le sas de connexion et le moteur conducteur.
   La connexion serveur est faite dans index.html. Dans app.html, l'ancien écran
   local V13 ne doit jamais repasser devant une session cloud déjà authentifiée. */
(()=>{
  if(window.MonSAEIVEntryBridgeV160?.installed)return;
  const VERSION='1.0.61';
  const ENTRY_MODE_KEY='mon-saeiv-cloud-entry-v156';
  const LOCAL_ACCOUNT_KEY='fluoSaeivAccountV13';
  const PROFILE_CACHE='mon-saeiv-cloud-profile-v156';
  const q=id=>document.getElementById(id);
  const requested=new URLSearchParams(location.search).get('entry');

  function localAccount(){try{return JSON.parse(localStorage.getItem(LOCAL_ACCOUNT_KEY)||'null')}catch{return null}}
  function cachedProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_CACHE)||'null')}catch{return null}}
  function mode(){try{return localStorage.getItem(ENTRY_MODE_KEY)||''}catch{return ''}}
  function cloudEntry(){return requested==='cloud'||mode()==='cloud'}
  function gateway(role='driver'){
    const r=['driver','dispatcher','admin'].includes(role)?role:'driver';
    location.replace(`./?v=${VERSION}&role=${r}`);
  }
  function profileRole(){return window.MonSAEIVCloudV156?.profile?.role||cachedProfile()?.role||'driver'}

  function installEarlyGuard(){
    if(q('v160EntryStyle'))return;
    const st=document.createElement('style');st.id='v160EntryStyle';
    st.textContent=cloudEntry()
      ? '#v13Auth,#v156CloudAuth{display:none!important}'
      : '#v156CloudAuth{display:none!important}';
    (document.head||document.documentElement).appendChild(st);
  }
  installEarlyGuard();

  function keepLegacyHidden(){
    q('v156CloudAuth')?.classList.add('hidden');
    if(cloudEntry())q('v13Auth')?.classList.add('hidden');
  }

  function cachedDriverUnlock(){
    if(!cloudEntry())return false;
    const p=cachedProfile();
    if(!p||p.role!=='driver'||!p.matricule)return false;
    const unlock=window.MonSAEIVAuthV13?.remoteUnlock;
    if(typeof unlock!=='function')return false;
    try{
      unlock(p.matricule,p.network||'fluo');
      q('v13Auth')?.classList.add('hidden');
      document.documentElement.dataset.cloudDriverUnlocked='1';
      return true;
    }catch(e){console.warn('[Mon SAEIV] déverrouillage cloud anticipé',e);return false}
  }

  function retryCachedUnlock(){
    if(!cloudEntry())return;
    let tries=0;
    const run=()=>{
      if(cachedDriverUnlock())return;
      if(++tries<120)setTimeout(run,50);
    };
    run();
  }

  async function signOutToGateway(){
    try{await window.MonSAEIVCloudV156?.client?.auth?.signOut?.()}catch{}
    try{localStorage.removeItem(PROFILE_CACHE);localStorage.setItem(ENTRY_MODE_KEY,'cloud')}catch{}
    gateway(profileRole());
  }

  function interceptClicks(){
    document.addEventListener('click',e=>{
      const t=e.target?.closest?.('#v156LocalCloudEntry,#v156ServerRecovery,#v156CloudLogout');
      if(!t)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      if(t.id==='v156CloudLogout')signOutToGateway();else gateway('driver');
    },true);
  }

  function observeLegacyAuth(){
    const mo=new MutationObserver(()=>keepLegacyHidden());
    mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    keepLegacyHidden();
  }

  function protectEntry(){
    if(requested==='local'||requested==='cloud'){
      try{localStorage.setItem(ENTRY_MODE_KEY,requested)}catch{}
    }
    setTimeout(()=>{
      if(window.MonSAEIVCloudV156?.user||window.MonSAEIVCloudV156?.profile)return;
      if(cloudEntry()&&cachedDriverUnlock())return;
      if(mode()==='local'&&localAccount())return;
      gateway(profileRole());
    },10000);
  }

  function init(){
    installEarlyGuard();
    keepLegacyHidden();
    retryCachedUnlock();
    interceptClicks();
    observeLegacyAuth();
    protectEntry();
  }

  window.MonSAEIVEntryBridgeV160={installed:true,version:VERSION,openGateway:gateway,cachedDriverUnlock};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
