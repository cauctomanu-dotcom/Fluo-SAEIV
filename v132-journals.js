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

/* Mon SAEIV — pont de compatibilité : le compte conducteur historique reste utilisable.
   Le compte Supabase est une extension facultative du compte local, jamais un remplacement. */
(()=>{
  if(window.MonSAEIVLegacyAccountBridge?.installed)return;
  const ACCOUNT_KEY='fluoSaeivAccountV13';
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localAccount=()=>{try{return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null')}catch{return null}};

  function addStyle(){
    if(q('legacyAccountBridgeStyle'))return;
    const s=document.createElement('style');s.id='legacyAccountBridgeStyle';s.textContent=`
      .legacy-account-card{margin:11px 0 13px;padding:12px;border:1px solid #3f7650;border-radius:14px;background:linear-gradient(135deg,#0d2b1a,#0a2015)}
      .legacy-account-card strong,.legacy-account-card span{display:block}.legacy-account-card strong{color:#caffd7;font-size:.82rem}.legacy-account-card span{margin-top:3px;color:#a9c9b2;font-size:.68rem;line-height:1.4}
      .legacy-account-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.legacy-account-actions button{min-height:42px}
      .legacy-account-actions .local{border-color:#58a66d;background:#164629;color:#e6ffec}
      .legacy-role-help{margin:10px 0;padding:10px;border:1px solid #304b5a;border-radius:12px;background:#071923;color:#9fb5c0;font-size:.66rem;line-height:1.45}
      .legacy-role-help b{color:#fff}.legacy-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:7px}.legacy-role-grid div{padding:7px;border:1px solid #294250;border-radius:9px;background:#0b1e29}
      @media(max-width:600px){.legacy-account-actions,.legacy-role-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function useLocal(){
    q('v156CloudAuth')?.classList.add('hidden');
    const auth=q('v13Auth');if(auth)auth.classList.remove('hidden');
    const a=localAccount();
    const matricule=q('v13Matricule');if(a?.matricule&&matricule)matricule.value=a.matricule;
    setTimeout(()=>q('v13Password')?.focus(),80);
  }

  function associateLocal(){
    const a=localAccount();
    q('v156RegisterTab')?.click();
    const m=q('v156RegMatricule');if(m&&a?.matricule)m.value=a.matricule;
    const status=q('v156CloudStatus');if(status){status.textContent=`Association du compte existant · matricule ${a?.matricule||''}. Le compte local et ses données resteront conservés sur cet appareil.`;status.className='v156-cloud-status ok'}
    q('v156RegEmail')?.focus();
  }

  function install(){
    const cloud=q('v156CloudAuth'),card=cloud?.querySelector('.v156-cloud-card');
    if(!cloud||!card){setTimeout(install,100);return}
    if(q('legacyAccountCard'))return;
    addStyle();
    const a=localAccount();
    const anchor=card.querySelector('.v156-cloud-tabs')||card.querySelector('form');
    if(a&&anchor){
      const box=document.createElement('div');box.id='legacyAccountCard';box.className='legacy-account-card';box.innerHTML=`
        <strong>✓ Ton compte conducteur actuel est toujours là</strong>
        <span>Matricule <b>${esc(a.matricule||'—')}</b>. Ton mot de passe local, tes journaux, ta caisse et tes données enregistrées n'ont pas été supprimés.</span>
        <div class="legacy-account-actions">
          <button id="legacyUseLocal" class="local" type="button">🚌 Ouvrir mon compte actuel</button>
          <button id="legacyLinkCloud" type="button">☁ Activer la synchronisation</button>
        </div>`;
      anchor.insertAdjacentElement('beforebegin',box);
      q('legacyUseLocal')?.addEventListener('click',useLocal);
      q('legacyLinkCloud')?.addEventListener('click',associateLocal);
    }
    const role=document.createElement('div');role.id='legacyRoleHelp';role.className='legacy-role-help';role.innerHTML=`
      <b>Trois rôles distincts</b> — le rôle est défini par le code d'invitation et contrôlé par le serveur.
      <div class="legacy-role-grid"><div>🚌 <b>Conducteur</b><br>Conduite et planning personnel.</div><div>🗂 <b>Exploitation</b><br>Gestion opérationnelle des conducteurs.</div><div>⚙️ <b>Administration</b><br>Comptes, rôles et invitations.</div></div>`;
    const note=card.querySelector('.v156-cloud-note');(note||card).insertAdjacentElement(note?'beforebegin':'beforeend',role);
  }

  window.MonSAEIVLegacyAccountBridge={installed:true,useLocal,associateLocal};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80),{once:true});else setTimeout(install,80);
})();

/* Mon SAEIV — séparation nette Administration / Exploitation. */
(()=>{
  if(window.MonSAEIVRoleUiV158?.installed)return;
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=r=>r==='admin'?'Administrateur':r==='dispatcher'?'Agent d’exploitation':'Conducteur';
  const R={profile:null,client:null,members:[]};

  function addStyle(){
    if(q('v158RoleStyle'))return;
    const s=document.createElement('style');s.id='v158RoleStyle';s.textContent=`
      .v158-role-nav{display:flex;gap:7px;flex-wrap:wrap;margin:11px 0 0}.v158-role-nav.hidden{display:none!important}.v158-role-nav button.active{border-color:#ffd000;background:#3c330a;color:#fff2a3}
      .v158-admin-home{margin-top:12px;padding:13px;border:1px solid #5c5030;border-radius:17px;background:linear-gradient(180deg,#171b20,#111820)}.v158-admin-home.hidden{display:none!important}
      .v158-admin-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v158-admin-head h2{margin:3px 0}.v158-admin-head p{margin:4px 0 0;color:#aab9c0;font-size:.72rem}
      .v158-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.v158-stat{padding:12px;border:1px solid #3b4c56;border-radius:13px;background:#0b151c}.v158-stat b{display:block;font-size:1.35rem}.v158-stat span{color:#9fb1ba;font-size:.65rem}
      .v158-admin-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:11px;margin-top:11px}.v158-card{padding:12px;border:1px solid #344b58;border-radius:14px;background:#0b1821}.v158-card h3{margin:0 0 8px}.v158-members{display:grid;gap:6px;max-height:460px;overflow:auto}.v158-member{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px;border:1px solid #2b424e;border-radius:11px;background:#07131b}.v158-member b,.v158-member span{display:block}.v158-member span{margin-top:2px;color:#94a8b2;font-size:.62rem}
      .v158-badge{padding:4px 7px;border-radius:999px;font-size:.58rem;font-weight:950}.v158-badge.driver{background:#163e2b;color:#b9f6cf}.v158-badge.dispatcher{background:#17394d;color:#c6ecff}.v158-badge.admin{background:#493d11;color:#ffeda0}
      .v158-admin-note{padding:10px;border:1px solid #4e472c;border-radius:11px;background:#25200c;color:#e8dda8;font-size:.68rem;line-height:1.45}.v158-dispatch-mark{color:#57d1ff!important}.v158-admin-mark{color:#ffd000!important}
      @media(max-width:850px){.v158-admin-grid{grid-template-columns:1fr}.v158-stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:560px){.v158-admin-head{flex-direction:column}.v158-stats{grid-template-columns:1fr}.v158-role-nav{display:grid;grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  function ensureUi(){
    addStyle();
    const root=q('v157Dispatch');if(!root||q('v158AdminHome'))return;
    const top=root.querySelector('.v157-top'),grid=root.querySelector('.v157-grid');if(!top||!grid)return;
    top.insertAdjacentHTML('afterend',`
      <div id="v158RoleNav" class="v158-role-nav hidden"><button id="v158AdminTab" type="button">⚙️ Administration</button><button id="v158DispatchTab" type="button">🗂 Exploitation</button></div>
      <section id="v158AdminHome" class="v158-admin-home hidden">
        <div class="v158-admin-head"><div><div class="v158-admin-mark" style="font-size:.64rem;font-weight:1000;letter-spacing:.12em">ADMINISTRATION DE LA SOCIÉTÉ</div><h2>Administration Mon SAEIV</h2><p>Comptes, rôles et invitations. La gestion quotidienne des services reste dans l'onglet Exploitation.</p></div><button id="v158GoDispatch" type="button">Ouvrir l'exploitation →</button></div>
        <div class="v158-stats"><div class="v158-stat"><b id="v158DriverStat">0</b><span>Conducteurs</span></div><div class="v158-stat"><b id="v158DispatcherStat">0</b><span>Agents d'exploitation</span></div><div class="v158-stat"><b id="v158AdminStat">0</b><span>Administrateurs</span></div></div>
        <div class="v158-admin-grid"><div class="v158-card"><h3>Membres de la société</h3><div id="v158MemberStatus" class="v157-status"></div><div id="v158Members" class="v158-members"></div></div><div class="v158-card"><h3>Accès et invitations</h3><div class="v158-admin-note">Un <b>agent d'exploitation</b> gère les plannings. Un <b>administrateur</b> gère les comptes, les rôles et les invitations, et peut ouvrir l'espace Exploitation.</div><div id="v158InviteHost" style="margin-top:10px"></div></div></div>
      </section>`);
    q('v158AdminTab')?.addEventListener('click',()=>setAdminMode(true));q('v158DispatchTab')?.addEventListener('click',()=>setAdminMode(false));q('v158GoDispatch')?.addEventListener('click',()=>setAdminMode(false));
  }

  async function loadMembers(){
    if(R.profile?.role!=='admin'||!R.client)return;
    const status=q('v158MemberStatus');if(status)status.textContent='Chargement…';
    try{
      const {data,error}=await R.client.from('profiles').select('user_id,matricule,display_name,role,network,active').order('role').order('matricule');if(error)throw error;R.members=data||[];
      const active=R.members.filter(x=>x.active!==false);q('v158DriverStat')&&(q('v158DriverStat').textContent=active.filter(x=>x.role==='driver').length);q('v158DispatcherStat')&&(q('v158DispatcherStat').textContent=active.filter(x=>x.role==='dispatcher').length);q('v158AdminStat')&&(q('v158AdminStat').textContent=active.filter(x=>x.role==='admin').length);
      const box=q('v158Members');if(box)box.innerHTML=R.members.length?R.members.map(x=>`<div class="v158-member"><div><b>${esc(x.display_name||x.matricule)}</b><span>Matricule ${esc(x.matricule)} · ${esc(x.network||'—')}${x.active===false?' · compte inactif':''}</span></div><span class="v158-badge ${esc(x.role)}">${esc(roleLabel(x.role))}</span></div>`).join(''):'<div class="v157-empty">Aucun membre.</div>';
      if(status)status.textContent=`${R.members.length} membre${R.members.length>1?'s':''}.`;
    }catch(e){if(status)status.textContent=e.message||String(e)}
  }

  function moveInvite(){const invite=q('v157Invite'),host=q('v158InviteHost');if(invite&&host&&invite.parentElement!==host){invite.classList.remove('hidden');host.appendChild(invite)}}
  function setAdminMode(adminMode){
    if(R.profile?.role!=='admin')return;const grid=q('v157Dispatch')?.querySelector('.v157-grid');q('v158AdminHome')?.classList.toggle('hidden',!adminMode);grid?.classList.toggle('hidden',adminMode);q('v158AdminTab')?.classList.toggle('active',adminMode);q('v158DispatchTab')?.classList.toggle('active',!adminMode);if(adminMode){moveInvite();loadMembers()}
  }
  function applyRole(profile,client){
    ensureUi();R.profile=profile;R.client=client;const title=q('v157Title'),subtitle=q('v157Subtitle'),eyebrow=q('v157Dispatch')?.querySelector('.v157-top div[style*="letter-spacing"]'),nav=q('v158RoleNav');
    if(profile.role==='admin'){
      if(title)title.textContent='Administration Mon SAEIV';if(subtitle)subtitle.textContent='Gestion des comptes et des accès · Exploitation disponible dans un onglet séparé.';if(eyebrow){eyebrow.textContent='MON SAEIV · ADMINISTRATION';eyebrow.classList.add('v158-admin-mark');eyebrow.classList.remove('v158-dispatch-mark')}nav?.classList.remove('hidden');setAdminMode(true);
    }else{
      if(title)title.textContent='Espace exploitation';if(subtitle)subtitle.textContent='Gestion opérationnelle des conducteurs et de leurs plannings.';if(eyebrow){eyebrow.textContent='MON SAEIV · EXPLOITATION';eyebrow.classList.add('v158-dispatch-mark');eyebrow.classList.remove('v158-admin-mark')}nav?.classList.add('hidden');q('v158AdminHome')?.classList.add('hidden');q('v157Dispatch')?.querySelector('.v157-grid')?.classList.remove('hidden');q('v157Invite')?.classList.add('hidden');
    }
  }

  function install(){
    ensureUi();const api=window.MonSAEIVDispatchV157;if(!api){setTimeout(install,100);return}if(api.__roleSeparated)return;
    const oldOpen=api.open.bind(api);api.open=async(profile,client)=>{const r=await oldOpen(profile,client);applyRole(profile,client);return r};api.__roleSeparated=true;
  }
  window.MonSAEIVRoleUiV158={installed:true,version:'1.0.56',applyRole,setAdminMode,loadMembers};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,120),{once:true});else setTimeout(install,120);
})();
