'use strict';
/* Mon SAEIV 1.0.30 — changement de réseau sans déconnexion + conduite paysage obligatoire. */
(()=>{
  const VERSION='1.0.32';
  const q=id=>document.getElementById(id);
  const html=document.documentElement;
  let driving=false;

  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  // ---------- Changement de réseau sans déconnexion ----------
  function courseIsActive(){
    const driver=q('driver');
    return !!driver && !driver.classList.contains('hidden');
  }
  function closeNetworkPicker(){q('v110NetworkPicker')?.classList.add('hidden');}
  function showNetworkToast(net){
    let toast=q('v130NetworkToast');
    if(!toast){
      toast=document.createElement('div');
      toast.id='v130NetworkToast';
      toast.setAttribute('role','status');
      document.body.appendChild(toast);
    }
    toast.innerHTML=`Réseau actif : <b>${escapeHtml(net.label)}</b>`;
    toast.classList.add('show');
    clearTimeout(showNetworkToast.timer);
    showNetworkToast.timer=setTimeout(()=>toast.classList.remove('show'),2200);
  }
  function switchNetwork(key){
    const networks=window.MonSAEIVAuthV13?.networks||{};
    const net=networks[String(key||'')];
    if(!net)return false;
    if(courseIsActive()){
      alert('Termine d’abord la course en cours avant de changer de réseau.');
      return false;
    }
    if(window.MonSAEIVDriverNetwork?.key===net.key){
      closeNetworkPicker();
      return true;
    }
    window.MonSAEIVDriverNetwork=net;
    html.dataset.driverNetwork=net.key;
    window.dispatchEvent(new CustomEvent('mon-saeiv-network-change',{detail:net}));
    try{window.MonSAEIVNetworkProfiles?.renderIdentity?.();}catch{}
    closeNetworkPicker();
    showNetworkToast(net);
    return true;
  }
  function installNetworkOverride(){
    const picker=q('v110NetworkPicker');
    if(!picker||picker.dataset.v130NetworkOverride==='1')return;
    picker.dataset.v130NetworkOverride='1';
    const p=picker.querySelector('header p');
    if(p)p.textContent='Choisis le réseau à utiliser. Ton profil conducteur reste connecté : seul le réseau actif change.';
    picker.addEventListener('click',e=>{
      const button=e.target.closest?.('[data-v110-network]');
      if(!button)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      switchNetwork(button.dataset.v110Network);
    },true);
  }

  // ---------- Navigation exclusivement en paysage ----------
  function ensureLandscapeGate(){
    let gate=q('v130LandscapeGate');
    if(gate)return gate;
    gate=document.createElement('div');
    gate.id='v130LandscapeGate';
    gate.setAttribute('role','status');
    gate.setAttribute('aria-live','polite');
    gate.innerHTML='<div class="v130-landscape-card"><div class="v130-phone">↻</div><h2>Tournez votre téléphone</h2><p>La navigation Mon SAEIV est disponible uniquement en <b>mode paysage</b>.</p><small>La préparation des courses reste utilisable en portrait.</small></div>';
    document.body.appendChild(gate);
    return gate;
  }
  function portrait(){return window.matchMedia?.('(orientation: portrait)').matches ?? (innerHeight>innerWidth);}
  function syncLandscapeGate(){
    ensureLandscapeGate();
    html.classList.toggle('v130-driving',driving);
    html.classList.toggle('v130-driving-portrait',driving&&portrait());
  }
  async function requestLandscape(){
    driving=true;
    syncLandscapeGate();
    try{
      if(screen.orientation?.lock)await screen.orientation.lock('landscape');
    }catch(err){
      // iOS/Safari et certaines PWA ne permettent pas le verrouillage : l’écran de rotation prend le relais.
      console.info('[Mon SAEIV] verrouillage paysage non disponible',err?.name||err);
    }
    syncLandscapeGate();
  }
  function releaseLandscape(){
    driving=false;
    html.classList.remove('v130-driving','v130-driving-portrait');
    try{screen.orientation?.unlock?.();}catch{}
  }
  function syncDrivingState(){
    const driver=q('driver');
    const active=!!driver&&!driver.classList.contains('hidden');
    if(active){
      if(!driving)driving=true;
      syncLandscapeGate();
    }else if(driving){
      releaseLandscape();
    }
  }
  function installOrientationHooks(){
    ensureLandscapeGate();
    const launchIds=new Set(['start','simulate','v30CollectiveGps','v30CollectiveSim']);
    document.addEventListener('click',e=>{
      const button=e.target.closest?.('button');
      if(button&&launchIds.has(button.id)&&!button.disabled)requestLandscape();
    },true);
    const driver=q('driver');
    if(driver)new MutationObserver(syncDrivingState).observe(driver,{attributes:true,attributeFilter:['class']});
    const media=window.matchMedia?.('(orientation: portrait)');
    if(media?.addEventListener)media.addEventListener('change',syncLandscapeGate);else media?.addListener?.(syncLandscapeGate);
    window.addEventListener('orientationchange',()=>setTimeout(syncLandscapeGate,80));
    window.addEventListener('resize',syncLandscapeGate);
    syncDrivingState();
  }

  function installStyles(){
    if(q('v130SessionOrientationStyle'))return;
    const st=document.createElement('style');
    st.id='v130SessionOrientationStyle';
    st.textContent=`
      #v130NetworkToast{position:fixed;z-index:59000;left:50%;top:max(14px,env(safe-area-inset-top));transform:translate(-50%,-18px);opacity:0;pointer-events:none;padding:10px 14px;border:1px solid #4f7183;border-radius:999px;background:#0b202c;color:#eaf7fc;box-shadow:0 14px 35px rgba(0,0,0,.38);font-size:.76rem;transition:.18s ease}#v130NetworkToast b{color:#ffd000}#v130NetworkToast.show{opacity:1;transform:translate(-50%,0)}
      #v130LandscapeGate{display:none;position:fixed;z-index:58000;inset:0;align-items:center;justify-content:center;padding:max(22px,env(safe-area-inset-top)) max(22px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(22px,env(safe-area-inset-left));background:radial-gradient(circle at 50% 20%,#15384b 0,#071620 46%,#03090e 100%);color:#fff;text-align:center}
      #v130LandscapeGate .v130-landscape-card{width:min(500px,100%);padding:26px 22px;border:1px solid rgba(126,164,185,.34);border-radius:24px;background:rgba(13,32,44,.96);box-shadow:0 24px 70px rgba(0,0,0,.5)}
      #v130LandscapeGate .v130-phone{display:flex;width:74px;height:48px;margin:0 auto 16px;align-items:center;justify-content:center;border:3px solid #ffd000;border-radius:12px;color:#ffd000;font-size:2rem;font-weight:1000;transform:rotate(-8deg)}
      #v130LandscapeGate h2{margin:0;font-size:1.6rem}#v130LandscapeGate p{margin:10px 0 0;color:#d5e4eb;font-size:.92rem;line-height:1.45}#v130LandscapeGate small{display:block;margin-top:10px;color:#93adba;font-size:.72rem}
      @media (orientation:portrait){html.v130-driving #v130LandscapeGate{display:flex}html.v130-driving #driver{visibility:hidden!important}html.v130-driving body{overflow:hidden!important}}
    `;
    document.head.appendChild(st);
  }

  function versionLabel(){
    document.title=`Mon SAEIV · ${VERSION}`;
    const eyebrow=document.querySelector('.top .eyebrow');if(eyebrow)eyebrow.textContent=`MON SAEIV · ${VERSION}`;
    const build=q('buildInfo');if(build)build.textContent=`Version ${VERSION}`;
  }

  function boot(){
    installStyles();
    installNetworkOverride();
    installOrientationHooks();
    versionLabel();
    setTimeout(()=>{installNetworkOverride();versionLabel();syncDrivingState();},300);
    setTimeout(()=>{installNetworkOverride();versionLabel();syncDrivingState();},2200);
    setTimeout(versionLabel,5200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.MonSAEIVV130={switchNetwork,requestLandscape,releaseLandscape,syncDrivingState};
})();
