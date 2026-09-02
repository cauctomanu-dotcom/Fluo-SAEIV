'use strict';
/* Mon SAEIV 1.0.52 — création de fiche horaire réservée à l'administration.
   - retire l'accès « Créer une fiche horaire » du menu conducteur
   - conserve la fonction existante V16
   - ajoute l'accès dans Admin, après déverrouillage
*/
(()=>{
  if(window.MonSAEIVAdminScheduleV152?.installed)return;
  const q=id=>document.getElementById(id);

  function installStyle(){
    if(q('v152AdminScheduleStyle'))return;
    const s=document.createElement('style');
    s.id='v152AdminScheduleStyle';
    s.textContent=`
      #v16CalcOpen{display:none!important}
      .v152-admin-tool{margin:0 0 14px;padding:13px;border:1px solid #3d5b6b;border-radius:14px;background:linear-gradient(135deg,#102b39,#0a1d27)}
      .v152-admin-tool h3{margin:0 0 5px;color:#f3f8fb;font-size:.92rem}
      .v152-admin-tool p{margin:0 0 10px;color:#9fb4bf;font-size:.68rem;line-height:1.45}
      .v152-admin-tool button{width:100%}
    `;
    document.head.appendChild(s);
  }

  function openScheduleCreator(){
    const admin=q('v29Admin');
    if(admin)admin.classList.add('hidden');
    const launcher=q('v16CalcOpen');
    if(!launcher){
      alert('Le module de création de fiche horaire n’est pas disponible.');
      return;
    }
    launcher.click();
  }

  function ensureAdminTool(){
    installStyle();
    const body=q('v29AdminBody');
    if(!body||q('v152AdminScheduleTool'))return;
    const section=document.createElement('section');
    section.id='v152AdminScheduleTool';
    section.className='v152-admin-tool';
    section.innerHTML=`<h3>📄 Fiches horaires</h3><p>Création et génération d’une nouvelle fiche horaire. Cette fonction est réservée au mode administrateur.</p><button id="v152CreateScheduleSheet" class="primary" type="button">CRÉER UNE FICHE HORAIRE</button>`;
    body.insertAdjacentElement('afterbegin',section);
    q('v152CreateScheduleSheet')?.addEventListener('click',openScheduleCreator);
  }

  function keepDriverMenuClean(){
    const launcher=q('v16CalcOpen');
    if(launcher)launcher.style.setProperty('display','none','important');
  }

  function install(){
    installStyle();
    ensureAdminTool();
    keepDriverMenuClean();
    const menu=q('v316MenuItems');
    if(menu)new MutationObserver(()=>keepDriverMenuClean()).observe(menu,{childList:true,subtree:false});
    const admin=q('v29Admin');
    if(admin)new MutationObserver(()=>ensureAdminTool()).observe(admin,{childList:true,subtree:true});
    [0,250,800,2000,5000].forEach(ms=>setTimeout(()=>{ensureAdminTool();keepDriverMenuClean()},ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.MonSAEIVAdminScheduleV152={installed:true,version:'1.0.52',open:openScheduleCreator};
  console.info('[Mon SAEIV] 1.0.52 création fiche horaire déplacée dans Admin');
})();
