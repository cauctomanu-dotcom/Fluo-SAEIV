'use strict';
/* Mon SAEIV 1.0.56 — page de connexion serveur autonome.
   Conducteur / Exploitant / Administrateur sont séparés sans overlay au-dessus du SAEIV.
   Quand cette page est visible, les autres écrans sont réellement retirés de l'affichage :
   aucun ancien modal ne peut intercepter les appuis tactiles sur iPhone. */
(()=>{
  if(window.MonSAEIVRoleLoginV158?.installed)return;

  const VERSION='1.0.56';
  const SUPABASE_URL='https://xpmrnwipnoekiycghwli.supabase.co';
  const SUPABASE_KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
  const q=id=>document.getElementById(id);
  const R={role:'driver',tempClient:null};

  function localAccount(){try{return JSON.parse(localStorage.getItem('fluoSaeivAccountV13')||'null')}catch{return null}}
  function status(text,kind=''){
    const e=q('v158Status');
    if(!e)return;
    e.textContent=text||'';
    e.className=`v158-status ${kind}`;
  }
  function titleForRole(){return R.role==='driver'?'Conducteur':R.role==='dispatcher'?"Agent d’exploitation":'Administrateur'}

  function installStyle(){
    if(q('v158RoleLoginStyle'))return;
    const s=document.createElement('style');
    s.id='v158RoleLoginStyle';
    s.textContent=`
      #v156CloudAuth.v158-superseded{display:none!important}
      body.v158-login-active{margin:0!important;overflow:auto!important;min-height:100dvh!important;background:#04090d!important}
      body.v158-login-active>:not(#v158RoleAuth){display:none!important}
      #v158RoleAuth{display:block;position:relative!important;z-index:0!important;min-height:100dvh;padding:calc(20px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(circle at 85% 0,#17394c 0,#071620 46%,#03090d 100%);color:#f7fbfe;pointer-events:auto!important;touch-action:auto!important;-webkit-user-select:auto!important}
      #v158RoleAuth.hidden{display:none!important}
      #v158RoleAuth *{box-sizing:border-box}
      #v158RoleAuth button,#v158RoleAuth input,#v158RoleAuth select{pointer-events:auto!important;-webkit-tap-highlight-color:rgba(255,208,0,.15)}
      #v158RoleAuth button{touch-action:manipulation!important;cursor:pointer}
      #v158RoleAuth input,#v158RoleAuth select{touch-action:auto!important;-webkit-user-select:text!important;user-select:text!important}
      .v158-card{width:min(680px,100%);margin:0 auto;padding:20px;border:1px solid #3d6073;border-radius:22px;background:linear-gradient(180deg,#102936,#071721);box-shadow:0 25px 80px rgba(0,0,0,.5)}
      .v158-eyebrow{color:#ffd000;font-size:.68rem;font-weight:1000;letter-spacing:.13em}.v158-card h2{margin:6px 0 8px}.v158-card>p{margin:0 0 14px;color:#a9bdc7;font-size:.78rem;line-height:1.48}
      .v158-role-choice{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:15px 0}.v158-role-choice button{min-height:68px;padding:10px 12px}.v158-role-choice button b,.v158-role-choice button span{display:block}.v158-role-choice button span{margin-top:4px;color:#9db2bd;font-size:.62rem}.v158-role-choice button.active{border-color:#ffd000;background:#3c330a;color:#fff3a0}.v158-role-choice button.active span{color:#e7d982}
      .v158-panel{padding:14px;border:1px solid #314b5a;border-radius:16px;background:#081923}.v158-panel.hidden{display:none!important}.v158-panel h3{margin:0 0 10px}.v158-form{display:grid;gap:10px}.v158-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v158-wide{grid-column:1/-1}
      .v158-form label{display:flex;flex-direction:column;gap:6px;color:#b5c7d0;font-size:.78rem;font-weight:800}.v158-form input,.v158-form select{width:100%;min-height:52px;padding:12px;background:#06151f;color:#fff;border:1px solid #3a5c6d;border-radius:13px;font:inherit;color-scheme:dark}.v158-form input:focus,.v158-form select:focus{outline:2px solid #ffd000;outline-offset:1px;border-color:#ffd000}
      .v158-form button,.v158-role-choice button,.v158-link,.v158-recovery{min-height:52px;border:1px solid #355163;border-radius:13px;background:#173345;color:#fff;font:inherit;font-weight:900}.v158-form button.primary{border:0;background:linear-gradient(135deg,#ffd000,#ffad00);color:#151515}
      .v158-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}.v158-link{margin-top:10px;width:100%;background:transparent;border-style:dashed}.v158-status{min-height:1.35em;margin-top:11px;color:#a9bdc7;font-size:.72rem}.v158-status.ok{color:#9cf4b7}.v158-status.err{color:#ffaaa5}.v158-status.busy{color:#ffe28a}.v158-note{margin-top:11px;padding:10px 11px;border:1px solid #314a59;border-radius:12px;background:#07131c;color:#98adb8;font-size:.66rem;line-height:1.45}
      .v158-recovery{width:100%;margin-top:10px;border-color:#3487a8!important;background:#102f3e!important;color:#c7ecfb!important}
      @media(max-width:600px){#v158RoleAuth{padding-left:0;padding-right:0;padding-bottom:0}.v158-card{min-height:100dvh;margin:0;border-right:0;border-left:0;border-bottom:0;border-radius:22px 22px 0 0;padding:18px 16px calc(22px + env(safe-area-inset-bottom))}.v158-role-choice,.v158-grid,.v158-actions{grid-template-columns:1fr}.v158-wide{grid-column:auto}.v158-role-choice button{min-height:58px}}
    `;
    document.head.appendChild(s);
  }

  function addUi(){
    if(q('v158RoleAuth'))return;
    installStyle();
    document.body.insertAdjacentHTML('beforeend',`
      <main id="v158RoleAuth" class="hidden" aria-label="Connexion Mon SAEIV">
        <section class="v158-card">
          <div class="v158-eyebrow">MON SAEIV · CONNEXION</div>
          <h2>Qui se connecte ?</h2>
          <p>Choisis ton espace. Le serveur vérifie ensuite le rôle réel du compte : sélectionner Administrateur ne donne jamais les droits administrateur à un autre compte.</p>
          <div class="v158-role-choice" aria-label="Choix du rôle">
            <button type="button" data-v158-role="driver" class="active"><b>🚌 Conducteur</b><span>Matricule + mot de passe</span></button>
            <button type="button" data-v158-role="dispatcher"><b>🎧 Exploitant</b><span>Gestion des conducteurs et plannings</span></button>
            <button type="button" data-v158-role="admin"><b>⚙ Administrateur</b><span>Comptes, droits et société</span></button>
          </div>

          <section id="v158DriverLogin" class="v158-panel">
            <h3>Connexion Conducteur</h3>
            <form id="v158DriverLoginForm" class="v158-form">
              <label>Matricule<input id="v158DriverMatricule" type="text" autocomplete="username" autocapitalize="characters" required></label>
              <label>Mot de passe<input id="v158DriverPassword" type="password" autocomplete="current-password" minlength="8" required></label>
              <button class="primary" type="submit">OUVRIR MON SAEIV</button>
            </form>
            <button id="v158DriverFirst" class="v158-link" type="button">Première connexion conducteur</button>
          </section>

          <section id="v158DriverRegister" class="v158-panel hidden">
            <h3>Première connexion Conducteur</h3>
            <form id="v158DriverRegisterForm" class="v158-form"><div class="v158-grid">
              <label>Code société<input id="v158DriverOrg" type="text" value="PILOTE" maxlength="40" required></label>
              <label>Code d’invitation<input id="v158DriverInvite" type="text" autocomplete="one-time-code" required></label>
              <label>Matricule<input id="v158DriverRegMatricule" type="text" maxlength="40" autocapitalize="characters" required></label>
              <label>Nom affiché<input id="v158DriverName" type="text" maxlength="80"></label>
              <label>Mot de passe<input id="v158DriverRegPassword" type="password" autocomplete="new-password" minlength="8" required></label>
              <label>Confirmer<input id="v158DriverConfirm" type="password" autocomplete="new-password" minlength="8" required></label>
              <label class="v158-wide">Réseau<select id="v158DriverNetwork"><option value="fluo">Fluo Grand Est</option><option value="stan">STAN</option><option value="lemet">LE MET’</option><option value="temob">TeMo’b</option><option value="rgtr">RGTR</option><option value="tice">TICE</option></select></label>
            </div><div class="v158-actions"><button class="primary" type="submit">CRÉER MON COMPTE</button><button id="v158DriverBack" type="button">Retour</button></div></form>
            <div class="v158-note">Aucune adresse e-mail n’est demandée au conducteur. Son identifiant de connexion reste son matricule.</div>
          </section>

          <section id="v158Management" class="v158-panel hidden">
            <h3 id="v158ManagementTitle">Connexion Exploitation</h3>
            <form id="v158ManagementLoginForm" class="v158-form">
              <label>Adresse e-mail<input id="v158ManagementEmail" type="email" autocomplete="email" required></label>
              <label>Mot de passe<input id="v158ManagementPassword" type="password" autocomplete="current-password" minlength="8" required></label>
              <button class="primary" type="submit">SE CONNECTER</button>
            </form>
            <button id="v158ManagementFirst" class="v158-link" type="button">Première connexion / invitation</button>
            <form id="v158ManagementRegisterForm" class="v158-form hidden" style="margin-top:10px"><div class="v158-grid">
              <label class="v158-wide">Adresse e-mail<input id="v158ManagementRegEmail" type="email" required></label>
              <label>Code société<input id="v158ManagementOrg" type="text" value="PILOTE" required></label>
              <label>Code d’invitation<input id="v158ManagementInvite" type="text" required></label>
              <label>Matricule / identifiant<input id="v158ManagementMatricule" type="text" required></label>
              <label>Nom affiché<input id="v158ManagementName" type="text"></label>
              <label>Mot de passe<input id="v158ManagementRegPassword" type="password" minlength="8" required></label>
              <label>Confirmer<input id="v158ManagementConfirm" type="password" minlength="8" required></label>
            </div><button class="primary" type="submit">CRÉER LE COMPTE DE GESTION</button></form>
          </section>

          <div id="v158Status" class="v158-status"></div>
          <div class="v158-note">Le formulaire affiché dépend du rôle choisi, mais les droits restent contrôlés côté serveur selon le rôle attribué par la société.</div>
        </section>
      </main>
    `);

    document.querySelectorAll('[data-v158-role]').forEach(b=>b.addEventListener('click',()=>selectRole(b.dataset.v158Role)));
    q('v158DriverLoginForm')?.addEventListener('submit',driverLogin);
    q('v158DriverRegisterForm')?.addEventListener('submit',driverRegister);
    q('v158ManagementLoginForm')?.addEventListener('submit',managementLogin);
    q('v158ManagementRegisterForm')?.addEventListener('submit',managementRegister);
    q('v158DriverFirst')?.addEventListener('click',()=>showDriverRegister(true));
    q('v158DriverBack')?.addEventListener('click',()=>showDriverRegister(false));
    q('v158ManagementFirst')?.addEventListener('click',()=>q('v158ManagementRegisterForm')?.classList.toggle('hidden'));
    prefillLocal();
    installRecoveryButton();
  }

  function prefillLocal(){
    const a=localAccount();if(!a?.matricule)return;
    if(q('v158DriverMatricule'))q('v158DriverMatricule').value=a.matricule;
    if(q('v158DriverRegMatricule'))q('v158DriverRegMatricule').value=a.matricule;
    const net=a.networkKey||a.network||a.network_key;
    const sel=q('v158DriverNetwork');
    if(net&&sel&&Array.from(sel.options).some(o=>o.value===String(net)))sel.value=String(net);
  }

  function selectRole(role){
    R.role=['driver','dispatcher','admin'].includes(role)?role:'driver';
    document.querySelectorAll('[data-v158-role]').forEach(b=>b.classList.toggle('active',b.dataset.v158Role===R.role));
    q('v158DriverLogin')?.classList.toggle('hidden',R.role!=='driver');
    q('v158DriverRegister')?.classList.add('hidden');
    q('v158Management')?.classList.toggle('hidden',R.role==='driver');
    q('v158ManagementRegisterForm')?.classList.add('hidden');
    if(R.role!=='driver'&&q('v158ManagementTitle'))q('v158ManagementTitle').textContent=R.role==='admin'?'Connexion Administrateur':"Connexion Agent d’exploitation";
    status('');
  }

  function showDriverRegister(show){
    q('v158DriverLogin')?.classList.toggle('hidden',show);
    q('v158DriverRegister')?.classList.toggle('hidden',!show);
    if(show)prefillLocal();
    status('');
  }

  async function mainClient(){
    for(let i=0;i<50;i++){
      const c=window.MonSAEIVCloudV156?.client;
      if(c)return c;
      await new Promise(r=>setTimeout(r,100));
    }
    throw new Error('Le module serveur n’est pas encore prêt. Recharge l’application.');
  }
  async function tempClient(){
    if(R.tempClient)return R.tempClient;
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    R.tempClient=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    return R.tempClient;
  }
  async function adoptSession(access_token,refresh_token){
    const c=await mainClient();
    const {error}=await c.auth.setSession({access_token,refresh_token});
    if(error)throw error;
    status('Connexion réussie.','ok');
  }

  async function driverLogin(e){
    e?.preventDefault?.();status('Connexion conducteur…','busy');
    try{
      const r=await fetch(`${SUPABASE_URL}/functions/v1/login-driver`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({matricule:q('v158DriverMatricule').value.trim(),password:q('v158DriverPassword').value})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok||!b.ok)throw new Error(b.error||'Matricule ou mot de passe incorrect');
      await adoptSession(b.access_token,b.refresh_token);
    }catch(err){status(err.message||'Connexion impossible.','err')}
  }

  async function driverRegister(e){
    e?.preventDefault?.();
    const password=q('v158DriverRegPassword').value;
    if(password!==q('v158DriverConfirm').value)return status('Les deux mots de passe ne correspondent pas.','err');
    status('Création du compte conducteur…','busy');
    try{
      const matricule=q('v158DriverRegMatricule').value.trim();
      const r=await fetch(`${SUPABASE_URL}/functions/v1/register-member`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({password,organizationCode:q('v158DriverOrg').value.trim(),matricule,displayName:q('v158DriverName').value.trim(),inviteCode:q('v158DriverInvite').value.trim(),network:q('v158DriverNetwork').value})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok||!b.ok)throw new Error(b.error||'Création impossible');
      if(b.profile?.role!=='driver')throw new Error(`Ce code d’invitation correspond au rôle ${b.profile?.role||'inconnu'}, pas Conducteur.`);
      q('v158DriverMatricule').value=matricule;q('v158DriverPassword').value=password;showDriverRegister(false);await driverLogin();
    }catch(err){status(err.message||'Création impossible.','err')}
  }

  async function managementLogin(e){
    e?.preventDefault?.();status(`Connexion ${titleForRole()}…`,'busy');
    try{
      const tmp=await tempClient();
      const email=q('v158ManagementEmail').value.trim(),password=q('v158ManagementPassword').value;
      const {data,error}=await tmp.auth.signInWithPassword({email,password});
      if(error||!data.session)throw error||new Error('Connexion impossible');
      const {data:profile,error:pErr}=await tmp.from('profiles').select('role,active').eq('user_id',data.user.id).maybeSingle();
      if(pErr)throw pErr;if(!profile?.active)throw new Error('Compte inactif.');
      if(profile.role!==R.role)throw new Error(`Ce compte est ${profile.role==='admin'?'Administrateur':profile.role==='dispatcher'?"Agent d’exploitation":'Conducteur'}, pas ${titleForRole()}.`);
      await adoptSession(data.session.access_token,data.session.refresh_token);
    }catch(err){status(err.message||'Connexion impossible.','err')}
  }

  async function managementRegister(e){
    e?.preventDefault?.();
    const password=q('v158ManagementRegPassword').value;
    if(password!==q('v158ManagementConfirm').value)return status('Les deux mots de passe ne correspondent pas.','err');
    status('Création du compte de gestion…','busy');
    try{
      const email=q('v158ManagementRegEmail').value.trim();
      const r=await fetch(`${SUPABASE_URL}/functions/v1/register-member`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email,password,organizationCode:q('v158ManagementOrg').value.trim(),matricule:q('v158ManagementMatricule').value.trim(),displayName:q('v158ManagementName').value.trim(),inviteCode:q('v158ManagementInvite').value.trim(),network:'fluo'})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok||!b.ok)throw new Error(b.error||'Création impossible');
      if(b.profile?.role!==R.role)throw new Error(`Le code utilisé a créé un compte ${b.profile?.role==='admin'?'Administrateur':b.profile?.role==='dispatcher'?"Agent d’exploitation":'Conducteur'}. Utilise ensuite le bouton correspondant à ce rôle.`);
      q('v158ManagementEmail').value=email;q('v158ManagementPassword').value=password;q('v158ManagementRegisterForm').classList.add('hidden');await managementLogin();
    }catch(err){status(err.message||'Création impossible.','err')}
  }

  function installRecoveryButton(){
    const auth=q('v13Auth');if(!auth||q('v158ServerRecovery'))return;
    const b=document.createElement('button');b.id='v158ServerRecovery';b.type='button';b.className='v158-recovery';b.textContent='☁ Connexion serveur / changer de rôle';
    b.addEventListener('click',()=>window.MonSAEIVCloudV156?.showCloudLogin?.());
    const form=auth.querySelector('form');(form?.parentElement||auth).appendChild(b);
  }

  function syncVisibility(){
    const old=q('v156CloudAuth'),mine=q('v158RoleAuth');if(!old||!mine)return;
    old.classList.add('v158-superseded');
    const shown=!old.classList.contains('hidden');
    mine.classList.toggle('hidden',!shown);
    document.body.classList.toggle('v158-login-active',shown);
    if(shown)prefillLocal();
  }

  function watch(){
    addUi();installRecoveryButton();
    let tries=0;
    const findOld=()=>{
      const old=q('v156CloudAuth');
      if(!old){if(++tries<80)setTimeout(findOld,100);return}
      syncVisibility();
      new MutationObserver(syncVisibility).observe(old,{attributes:true,attributeFilter:['class']});
    };
    findOld();
    [500,1500,3500].forEach(ms=>setTimeout(installRecoveryButton,ms));
  }

  window.MonSAEIVRoleLoginV158={installed:true,version:VERSION,open:()=>window.MonSAEIVCloudV156?.showCloudLogin?.(),selectRole};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(watch,80),{once:true});else setTimeout(watch,80);
})();
