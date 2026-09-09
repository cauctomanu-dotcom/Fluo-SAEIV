'use strict';
/* Mon SAEIV 1.0.61 — sas de connexion isolé.
   Cette page ne charge aucun moteur conducteur historique. */
(()=>{
  const VERSION='1.0.61';
  const SUPABASE_URL='https://xpmrnwipnoekiycghwli.supabase.co';
  const SUPABASE_KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
  const ENTRY_MODE_KEY='mon-saeiv-cloud-entry-v156';
  const PROFILE_CACHE='mon-saeiv-cloud-profile-v156';
  const LOCAL_ACCOUNT_KEY='fluoSaeivAccountV13';
  const q=id=>document.getElementById(id);
  const S={role:'driver',client:null,profile:null};

  function localAccount(){try{return JSON.parse(localStorage.getItem(LOCAL_ACCOUNT_KEY)||'null')}catch{return null}}
  function setStatus(text,kind=''){const e=q('gatewayStatus');if(!e)return;e.textContent=text||'';e.className=`status ${kind}`}
  function roleLabel(role){return role==='admin'?'Administrateur':role==='dispatcher'?"Agent d’exploitation":'Conducteur'}
  function initialRole(){
    const params=new URLSearchParams(location.search);
    const fromQuery=params.get('role');
    const fromHash=String(location.hash||'').replace('#','');
    const v=fromQuery||fromHash;
    return ['driver','dispatcher','admin'].includes(v)?v:'driver';
  }
  function selectRole(role,writeHash=true){
    S.role=['driver','dispatcher','admin'].includes(role)?role:'driver';
    document.querySelectorAll('[data-role]').forEach(a=>a.classList.toggle('active',a.dataset.role===S.role));
    q('driverPanel')?.classList.toggle('show',S.role==='driver');
    q('managementPanel')?.classList.toggle('show',S.role!=='driver');
    q('managementRegisterForm')?.classList.add('hidden');
    if(S.role!=='driver'){
      q('managementTitle').textContent=S.role==='admin'?'Connexion Administrateur':'Connexion Exploitant';
      q('managementHelp').textContent=S.role==='admin'
        ?'L’administrateur gère les comptes, les droits et la société. Les droits sont vérifiés par le serveur.'
        :'L’exploitant gère les conducteurs et leurs plannings. Il n’a pas accès aux outils d’administration.';
    }
    if(writeHash&&history.replaceState)history.replaceState(null,'',`${location.pathname}${location.search}#${S.role}`);
    setStatus('');
  }

  async function client(){
    if(S.client)return S.client;
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    S.client=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return S.client;
  }
  async function profileFor(userId){
    const c=await client();
    const {data,error}=await c.from('profiles').select('user_id,organization_id,depot_id,matricule,display_name,role,network,active').eq('user_id',userId).maybeSingle();
    if(error)throw error;
    if(!data?.active)throw new Error('Compte inactif ou non rattaché à une société.');
    return data;
  }
  function saveProfile(p){try{localStorage.setItem(PROFILE_CACHE,JSON.stringify(p))}catch{}}
  function goApp(mode='cloud'){
    try{localStorage.setItem(ENTRY_MODE_KEY,mode)}catch{}
    location.replace(`./app.html?v=${VERSION}&entry=${mode}`);
  }

  function prefillLocal(){
    const a=localAccount();if(!a?.matricule)return;
    q('localBox')?.classList.add('show');
    q('localText').innerHTML=`Profil conducteur local détecté : <b>matricule ${String(a.matricule).replace(/[<>]/g,'')}</b>. Il n’est pas supprimé.`;
    if(q('driverMatricule'))q('driverMatricule').value=a.matricule;
    if(q('driverRegMatricule'))q('driverRegMatricule').value=a.matricule;
    const net=a.networkKey||a.network||a.network_key;
    const sel=q('driverNetwork');
    if(net&&sel&&Array.from(sel.options).some(o=>o.value===String(net)))sel.value=String(net);
  }

  async function adoptTokens(access_token,refresh_token){
    const c=await client();
    const {data,error}=await c.auth.setSession({access_token,refresh_token});
    if(error||!data.session)throw error||new Error('Session serveur impossible à ouvrir.');
    return data.session;
  }

  async function loginDriver(matricule,password){
    const r=await fetch(`${SUPABASE_URL}/functions/v1/login-driver`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({matricule:String(matricule||'').trim(),password})});
    const b=await r.json().catch(()=>({}));
    if(!r.ok||!b.ok)throw new Error(b.error||'Matricule ou mot de passe incorrect.');
    const session=await adoptTokens(b.access_token,b.refresh_token);
    const profile=await profileFor(session.user.id);
    if(profile.role!=='driver'){
      await (await client()).auth.signOut().catch(()=>{});
      throw new Error(`Ce compte est ${roleLabel(profile.role)}, pas Conducteur.`);
    }
    saveProfile(profile);return profile;
  }

  async function driverLogin(e){
    e.preventDefault();setStatus('Connexion conducteur…','busy');
    try{await loginDriver(q('driverMatricule').value,q('driverPassword').value);setStatus('Connexion réussie.','ok');goApp('cloud')}
    catch(err){setStatus(err?.message||'Connexion impossible.','err')}
  }

  async function driverRegister(e){
    e.preventDefault();
    const password=q('driverRegPassword').value;
    if(password!==q('driverConfirm').value)return setStatus('Les deux mots de passe ne correspondent pas.','err');
    setStatus('Création du compte conducteur…','busy');
    try{
      const matricule=q('driverRegMatricule').value.trim();
      const r=await fetch(`${SUPABASE_URL}/functions/v1/register-member`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({password,organizationCode:q('driverOrg').value.trim(),matricule,displayName:q('driverName').value.trim(),inviteCode:q('driverInvite').value.trim(),network:q('driverNetwork').value})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok||!b.ok)throw new Error(b.error||'Création impossible.');
      if(b.profile?.role!=='driver')throw new Error(`Ce code d’invitation correspond au rôle ${roleLabel(b.profile?.role)}, pas Conducteur.`);
      await loginDriver(matricule,password);setStatus('Compte créé.','ok');goApp('cloud');
    }catch(err){setStatus(err?.message||'Création impossible.','err')}
  }

  async function loginManagement(email,password){
    const c=await client();
    const {data,error}=await c.auth.signInWithPassword({email:String(email||'').trim(),password});
    if(error||!data.session)throw error||new Error('Connexion impossible.');
    const profile=await profileFor(data.user.id);
    if(profile.role!==S.role){
      await c.auth.signOut().catch(()=>{});
      throw new Error(`Ce compte est ${roleLabel(profile.role)}, pas ${roleLabel(S.role)}.`);
    }
    saveProfile(profile);return profile;
  }

  async function managementLogin(e){
    e.preventDefault();setStatus(`Connexion ${roleLabel(S.role)}…`,'busy');
    try{await loginManagement(q('managementEmail').value,q('managementPassword').value);setStatus('Connexion réussie.','ok');goApp('cloud')}
    catch(err){setStatus(err?.message||'Connexion impossible.','err')}
  }

  async function managementRegister(e){
    e.preventDefault();
    const password=q('managementRegPassword').value;
    if(password!==q('managementConfirm').value)return setStatus('Les deux mots de passe ne correspondent pas.','err');
    setStatus('Création du compte de gestion…','busy');
    try{
      const email=q('managementRegEmail').value.trim();
      const r=await fetch(`${SUPABASE_URL}/functions/v1/register-member`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email,password,organizationCode:q('managementOrg').value.trim(),matricule:q('managementMatricule').value.trim(),displayName:q('managementName').value.trim(),inviteCode:q('managementInvite').value.trim(),network:'fluo'})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok||!b.ok)throw new Error(b.error||'Création impossible.');
      if(b.profile?.role!==S.role)throw new Error(`Le code utilisé crée un compte ${roleLabel(b.profile?.role)}, pas ${roleLabel(S.role)}.`);
      await loginManagement(email,password);setStatus('Compte créé.','ok');goApp('cloud');
    }catch(err){setStatus(err?.message||'Création impossible.','err')}
  }

  async function inspectSession(){
    try{
      const c=await client();
      const {data:{session}}=await c.auth.getSession();
      if(!session)return;
      const p=await profileFor(session.user.id);S.profile=p;saveProfile(p);
      q('sessionBox')?.classList.add('show');
      q('sessionText').innerHTML=`Session serveur déjà active : <b>${String(p.display_name||p.matricule).replace(/[<>]/g,'')}</b> · ${roleLabel(p.role)}.`;
    }catch(err){console.warn('[Mon SAEIV gateway] session',err)}
  }

  function bind(){
    document.querySelectorAll('[data-role]').forEach(a=>a.addEventListener('click',()=>selectRole(a.dataset.role,false)));
    window.addEventListener('hashchange',()=>selectRole(initialRole(),false));
    q('driverLoginForm')?.addEventListener('submit',driverLogin);
    q('driverRegisterForm')?.addEventListener('submit',driverRegister);
    q('managementLoginForm')?.addEventListener('submit',managementLogin);
    q('managementRegisterForm')?.addEventListener('submit',managementRegister);
    q('showDriverRegister')?.addEventListener('click',()=>{q('driverRegisterForm')?.classList.remove('hidden');q('showDriverRegister')?.classList.add('hidden')});
    q('hideDriverRegister')?.addEventListener('click',()=>{q('driverRegisterForm')?.classList.add('hidden');q('showDriverRegister')?.classList.remove('hidden')});
    q('showManagementRegister')?.addEventListener('click',()=>q('managementRegisterForm')?.classList.toggle('hidden'));
    q('openLocal')?.addEventListener('click',()=>goApp('local'));
    q('linkLocal')?.addEventListener('click',()=>{selectRole('driver');q('driverRegisterForm')?.classList.remove('hidden');q('showDriverRegister')?.classList.add('hidden');q('driverInvite')?.focus()});
    q('resumeSession')?.addEventListener('click',()=>goApp('cloud'));
    q('dropSession')?.addEventListener('click',async()=>{try{await (await client()).auth.signOut()}catch{};try{localStorage.removeItem(PROFILE_CACHE)}catch{};S.profile=null;q('sessionBox')?.classList.remove('show');setStatus('Session serveur fermée.','ok')});
  }

  function init(){
    selectRole(initialRole(),false);prefillLocal();bind();inspectSession();
    document.documentElement.dataset.monSaeivGateway=VERSION;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
