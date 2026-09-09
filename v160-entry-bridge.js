'use strict';
/* Mon SAEIV 1.0.61 — pont entre le sas de connexion et le moteur conducteur.
   Le vieil écran cloud V156 reste désactivé dans app.html : toute connexion passe
   désormais par index.html, qui ne charge aucun moteur historique. */
(()=>{
  if(window.MonSAEIVEntryBridgeV160?.installed)return;
  const VERSION='1.0.61';
  const ENTRY_MODE_KEY='mon-saeiv-cloud-entry-v156';
  const LOCAL_ACCOUNT_KEY='fluoSaeivAccountV13';
  const q=id=>document.getElementById(id);

  function localAccount(){try{return JSON.parse(localStorage.getItem(LOCAL_ACCOUNT_KEY)||'null')}catch{return null}}
  function mode(){try{return localStorage.getItem(ENTRY_MODE_KEY)||''}catch{return ''}}
  function gateway(role='driver'){
    const r=['driver','dispatcher','admin'].includes(role)?role:'driver';
    location.replace(`./?v=${VERSION}&role=${r}`);
  }
  function profileRole(){return window.MonSAEIVCloudV156?.profile?.role||'driver'}

  function installStyle(){
    if(q('v160EntryStyle'))return;
    const st=document.createElement('style');st.id='v160EntryStyle';
    st.textContent='#v156CloudAuth{display:none!important}';
    document.head.appendChild(st);
  }
  function keepLegacyCloudHidden(){q('v156CloudAuth')?.classList.add('hidden')}

  async function signOutToGateway(){
    try{await window.MonSAEIVCloudV156?.client?.auth?.signOut?.()}catch{}
    try{localStorage.removeItem('mon-saeiv-cloud-profile-v156');localStorage.setItem(ENTRY_MODE_KEY,'cloud')}catch{}
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
    const attach=()=>{
      const old=q('v156CloudAuth');if(!old)return false;
      keepLegacyCloudHidden();
      new MutationObserver(keepLegacyCloudHidden).observe(old,{attributes:true,attributeFilter:['class','style']});
      return true;
    };
    if(attach())return;
    const mo=new MutationObserver(()=>{if(attach())mo.disconnect()});
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }

  function protectEntry(){
    const requested=new URLSearchParams(location.search).get('entry');
    if(requested==='local'||requested==='cloud'){try{localStorage.setItem(ENTRY_MODE_KEY,requested)}catch{}}
    // Une ouverture directe d'app.html sans session ni profil local ne doit plus
    // réactiver le vieux formulaire V156 : retour au sas après le délai d'amorçage.
    setTimeout(()=>{
      if(window.MonSAEIVCloudV156?.user||window.MonSAEIVCloudV156?.profile)return;
      if(mode()==='local'&&localAccount())return;
      gateway('driver');
    },8000);
  }

  function init(){installStyle();keepLegacyCloudHidden();interceptClicks();observeLegacyAuth();protectEntry()}
  window.MonSAEIVEntryBridgeV160={installed:true,version:VERSION,openGateway:gateway};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
