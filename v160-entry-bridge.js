'use strict';
/* Mon SAEIV 1.0.61 — pont entre le sas de connexion et le moteur conducteur.
   Ce garde démarre dans <head>, avant le runtime historique. L’écran local V13 est
   soit supprimé du parcours cloud, soit placé au-dessus de toutes les autres couches
   quand il est réellement utilisé en mode local. */
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
    const st=document.createElement('style');
    st.id='v160EntryStyle';
    st.textContent=`
      #v156CloudAuth{display:none!important;pointer-events:none!important}
      #v13Auth.v13-auth{z-index:2147483647!important;pointer-events:auto!important;isolation:isolate!important}
      #v13Auth .v13-auth-card,#v13Auth form,#v13Auth label,#v13Auth input,#v13Auth select,#v13Auth button{pointer-events:auto!important}
      html[data-saeiv-entry="cloud"] #v13Auth{display:none!important;pointer-events:none!important}
    `;
    (document.head||document.documentElement).appendChild(st);
  }

  function markEntry(){
    document.documentElement.dataset.saeivEntry=cloudEntry()?'cloud':'local';
  }

  function hardenLegacyAuth(){
    const cloud=cloudEntry();
    document.documentElement.dataset.saeivEntry=cloud?'cloud':'local';
    const oldCloud=q('v156CloudAuth');
    if(oldCloud){
      oldCloud.classList.add('hidden');
      oldCloud.style.setProperty('display','none','important');
      oldCloud.style.setProperty('pointer-events','none','important');
    }
    const root=q('v13Auth');
    if(!root)return;
    if(cloud){
      root.classList.add('hidden');
      root.setAttribute('aria-hidden','true');
      root.style.setProperty('display','none','important');
      root.style.setProperty('pointer-events','none','important');
      return;
    }
    root.classList.remove('hidden');
    root.removeAttribute('aria-hidden');
    root.style.removeProperty('display');
    root.style.setProperty('z-index','2147483647','important');
    root.style.setProperty('pointer-events','auto','important');
    root.style.setProperty('isolation','isolate','important');
    root.querySelectorAll('form,label,input,select,button,.v13-auth-card').forEach(el=>{
      el.style.setProperty('pointer-events','auto','important');
    });
  }

  function startEarlyObserver(){
    // Uniquement les créations/suppressions de nœuds : aucune observation de class/style,
    // donc aucun risque de boucle de mutations pendant le chargement du gros runtime.
    const mo=new MutationObserver(mutations=>{
      let relevant=false;
      outer:for(const m of mutations){
        for(const n of m.addedNodes){
          if(n.nodeType!==1)continue;
          if(n.id==='v13Auth'||n.id==='v156CloudAuth'||n.querySelector?.('#v13Auth,#v156CloudAuth')){
            relevant=true;break outer;
          }
        }
      }
      if(relevant)hardenLegacyAuth();
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
    return mo;
  }

  function cachedDriverUnlock(){
    if(!cloudEntry())return false;
    const p=cachedProfile();
    if(!p||p.role!=='driver'||!p.matricule)return false;
    const unlock=window.MonSAEIVAuthV13?.remoteUnlock;
    if(typeof unlock!=='function')return false;
    try{
      unlock(p.matricule,p.network||'fluo');
      hardenLegacyAuth();
      document.documentElement.dataset.cloudDriverUnlocked='1';
      return true;
    }catch(e){
      console.warn('[Mon SAEIV] déverrouillage cloud anticipé',e);
      return false;
    }
  }

  function retryCachedUnlock(){
    if(!cloudEntry())return;
    let tries=0;
    const run=()=>{
      if(cachedDriverUnlock())return;
      if(++tries<200)setTimeout(run,50);
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

  function protectEntry(){
    if(requested==='local'||requested==='cloud'){
      try{localStorage.setItem(ENTRY_MODE_KEY,requested)}catch{}
    }
    markEntry();
    setTimeout(()=>{
      if(window.MonSAEIVCloudV156?.user||window.MonSAEIVCloudV156?.profile)return;
      if(cloudEntry()&&cachedDriverUnlock())return;
      if(mode()==='local'&&localAccount())return;
      gateway(profileRole());
    },10000);
  }

  // Tout ce qui protège l’écran V13 démarre immédiatement dans <head>, et non plus
  // après DOMContentLoaded. C’est essentiel si un module historique ralentit ensuite.
  installEarlyGuard();
  markEntry();
  const earlyObserver=startEarlyObserver();
  interceptClicks();
  protectEntry();
  retryCachedUnlock();

  function init(){
    markEntry();
    hardenLegacyAuth();
    retryCachedUnlock();
  }

  window.MonSAEIVEntryBridgeV160={
    installed:true,version:VERSION,openGateway:gateway,cachedDriverUnlock,
    hardenLegacyAuth,earlyObserver
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
