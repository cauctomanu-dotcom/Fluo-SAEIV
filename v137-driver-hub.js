'use strict';
/* Mon SAEIV 1.0.37 — Espace conducteur centralisé.
   Regroupe Journaux, statistiques, véhicule, contacts et fin de journée
   dans Mon profil, sans intervenir sur l'écran de connexion. */
(()=>{
  if(window.MonSAEIVV137?.installed)return;
  const VERSION='1.0.37';
  const q=id=>document.getElementById(id);
  const ACCOUNT='fluoSaeivAccountV13';
  let installed=false;

  function account(){try{return JSON.parse(localStorage.getItem(ACCOUNT)||'null')}catch{return null}}
  function authVisible(){const a=q('v13Auth');return !!a && !a.classList.contains('hidden') && getComputedStyle(a).display!=='none'}
  function networkLabel(){return window.MonSAEIVDriverNetwork?.label||window.MonSAEIVDriverNetwork?.name||'Réseau non sélectionné'}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function closeMenu(){q('v316MenuBackdrop')?.classList.add('hidden')}

  function style(){
    if(q('v137Style'))return;
    const s=document.createElement('style');s.id='v137Style';s.textContent=`
      .v137-backdrop{position:fixed;z-index:2147483250;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(1,7,11,.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.v137-backdrop.hidden{display:none!important}
      .v137-shell{width:min(920px,100%);max-height:95dvh;display:flex;flex-direction:column;overflow:hidden;border:1px solid #3b5969;border-radius:22px;background:#0a1d27;box-shadow:0 30px 100px rgba(0,0,0,.72)}
      .v137-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #294554}.v137-head h2{margin:3px 0}.v137-head p{margin:2px 0;color:#9cb1bc;font-size:.7rem}.v137-body{padding:14px 16px 18px;overflow:auto}
      .v137-identity{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px;border:1px solid #355163;border-radius:16px;background:linear-gradient(135deg,#102c3b,#0a1d27)}.v137-identity small{display:block;color:#8fa6b2;font-size:.6rem;font-weight:900}.v137-identity b{display:block;margin-top:3px;font-size:1.12rem}.v137-version{padding:7px 9px;border:1px solid #456778;border-radius:999px;color:#cbe0e9;font-size:.6rem;font-weight:900;white-space:nowrap}
      .v137-section{margin-top:13px}.v137-section h3{margin:0 0 8px;font-size:.78rem;color:#b9cbd4;text-transform:uppercase;letter-spacing:.05em}.v137-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.v137-card{min-height:96px;padding:12px;border:1px solid #304d5d;border-radius:15px;background:#091a24;text-align:left;color:#edf8fd}.v137-card:hover{border-color:#58788a}.v137-card strong{display:block;font-size:.9rem}.v137-card span{display:block;margin-top:5px;color:#8fa6b2;font-size:.64rem;line-height:1.35}.v137-card .ico{font-size:1.35rem;margin-bottom:6px}.v137-note{margin-top:12px;padding:10px;border:1px solid #344d5b;border-radius:12px;color:#8fa6b2;font-size:.62rem;line-height:1.4}
      @media(max-width:680px){.v137-backdrop{padding:0;align-items:flex-end}.v137-shell{max-height:98dvh;border-radius:22px 22px 0 0}.v137-body{padding:11px}.v137-grid{grid-template-columns:1fr}.v137-card{min-height:82px}.v137-head{padding:12px}}
    `;document.head.appendChild(s)
  }

  function ensureHub(){
    style();
    if(q('v137DriverHub'))return q('v137DriverHub');
    document.body.insertAdjacentHTML('beforeend',`<div id="v137DriverHub" class="v137-backdrop hidden" role="dialog" aria-modal="true"><section class="v137-shell"><header class="v137-head"><div><div class="eyebrow">MON SAEIV · ESPACE CONDUCTEUR</div><h2>👤 Mon profil</h2><p>Tout ce qui concerne le conducteur, regroupé au même endroit.</p></div><button id="v137Close" type="button">Fermer</button></header><div class="v137-body"><div id="v137Identity" class="v137-identity"></div><section class="v137-section"><h3>Mon activité</h3><div class="v137-grid"><button class="v137-card" data-v137-open="stats"><div class="ico">📊</div><strong>Statistiques</strong><span>Ponctualité, avance, retard, note, kilomètres et respect des limitations.</span></button><button class="v137-card" data-v137-open="journals"><div class="ico">📁</div><strong>Mes journaux</strong><span>Consulter l'historique détaillé de mes courses et les exports.</span></button><button class="v137-card" data-v137-open="endday"><div class="ico">🌙</div><strong>Fin de journée</strong><span>Récapitulatif des courses, voyageurs, caisse, incidents et retour véhicule.</span></button><button class="v137-card" data-v137-open="vehicle"><div class="ico">🚌</div><strong>Mon véhicule / prise de service</strong><span>Véhicule du jour, contrôles de départ et informations de retour.</span></button></div></section><section class="v137-section"><h3>Mes informations de travail</h3><div class="v137-grid"><button class="v137-card" data-v137-open="contacts"><div class="ico">☎️</div><strong>Contacts exploitation</strong><span>Régulation, exploitation, astreinte, atelier et urgence interne.</span></button><button class="v137-card" data-v137-open="planning"><div class="ico">📅</div><strong>Mon planning</strong><span>Accès direct à mon planning sans chercher dans le menu.</span></button></div></section><div class="v137-note">Les fonctions restent les mêmes : Mon profil sert désormais de point d'entrée unique pour les informations liées au conducteur. Les fonctions de conduite courante restent accessibles normalement dans le cockpit.</div></div></section></div>`);
    q('v137Close')?.addEventListener('click',closeHub);
    q('v137DriverHub')?.addEventListener('click',e=>{if(e.target===q('v137DriverHub'))closeHub()});
    q('v137DriverHub')?.addEventListener('click',e=>{const b=e.target.closest?.('[data-v137-open]');if(!b)return;openSection(b.dataset.v137Open)});
    return q('v137DriverHub')
  }

  function refreshIdentity(){
    const a=account(),veh=window.MonSAEIVV136?.vehicle?.()||null;
    const v=veh?.vehicleId?` · véhicule ${esc(veh.vehicleId)}`:'';
    const el=q('v137Identity');if(!el)return;
    el.innerHTML=`<div><small>CONDUCTEUR</small><b>${esc(a?.matricule||'Profil local')}</b><small style="margin-top:6px">${esc(networkLabel())}${v}</small></div><div class="v137-version">Version ${VERSION}</div>`
  }

  function openHub(){
    if(authVisible())return;
    closeMenu();ensureHub();refreshIdentity();q('v137DriverHub').classList.remove('hidden')
  }
  function closeHub(){q('v137DriverHub')?.classList.add('hidden')}
  function openSection(which){
    closeHub();
    if(which==='journals'){(window.MonSAEIVV135?.openJournals||window.MonSAEIVV133?.openJournals)?.();return}
    if(which==='stats'){window.MonSAEIVV136?.openProfile?.();return}
    if(which==='vehicle'){window.MonSAEIVV136?.openVehicle?.();return}
    if(which==='contacts'){window.MonSAEIVV136?.openContacts?.();return}
    if(which==='endday'){window.MonSAEIVV136?.openEndDay?.();return}
    if(which==='planning'){q('v316PlanningBtn')?.click();return}
  }

  function tidyMenu(){
    if(authVisible())return;
    const menu=q('v316MenuItems');if(!menu)return;
    let profile=q('v137ProfileBtn')||q('v133ProfileBtn');
    if(!profile){profile=document.createElement('button');profile.id='v137ProfileBtn';profile.type='button';profile.className='v316-menu-entry';menu.prepend(profile)}
    if(profile.id!=='v137ProfileBtn')profile.id='v137ProfileBtn';
    if(profile.textContent!=='👤 Mon profil')profile.textContent='👤 Mon profil';
    profile.classList.add('v316-menu-entry');
    for(const id of ['v135JournalBtn','v13JournalBtn','v136VehicleBtn','v136ContactsBtn','v136EndDayBtn']){const el=q(id);if(el)el.style.setProperty('display','none','important')}
  }

  function profileRouter(e){
    const b=e.target.closest?.('#v137ProfileBtn,#v133ProfileBtn');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();openHub()
  }

  function install(){
    if(installed)return;installed=true;
    ensureHub();
    document.addEventListener('click',profileRouter,true);
    const auth=q('v13Auth');if(auth)new MutationObserver(()=>{if(!authVisible()){tidyMenu();refreshIdentity()}}).observe(auth,{attributes:true,attributeFilter:['class','style']});
    const menu=q('v316MenuItems');if(menu)new MutationObserver(()=>queueMicrotask(tidyMenu)).observe(menu,{childList:true});
    [0,500,1500,4000].forEach(ms=>setTimeout(()=>{tidyMenu();refreshIdentity()},ms));
    window.addEventListener('mon-saeiv-network-change',()=>setTimeout(refreshIdentity,0));
    document.title=`Mon SAEIV · ${VERSION}`;
    const bi=q('buildInfo');if(bi)bi.textContent=`Version ${VERSION}`;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.MonSAEIVV137={installed:true,version:VERSION,openProfile:openHub,openSection};
  console.info('[Mon SAEIV] 1.0.37 Espace conducteur centralisé actif');
})();
