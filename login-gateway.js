'use strict';
/* Mon SAEIV 1.0.63 — sas de connexion isolé + transfert du profil local. */
(()=>{
  if(window.MonSAEIVGatewayV163?.installed)return;
  const VERSION='1.0.63';
  const SUPABASE_URL='https://xpmrnwipnoekiycghwli.supabase.co';
  const SUPABASE_KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
  const ENTRY_MODE_KEY='mon-saeiv-cloud-entry-v156';
  const PROFILE_CACHE='mon-saeiv-cloud-profile-v156';
  const LOCAL_ACCOUNT_KEY='fluoSaeivAccountV13';
  const BACKUP_FORMAT='mon-saeiv-local-backup';
  const q=id=>document.getElementById(id);
  const S={role:'driver',client:null,profile:null};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function localAccount(){try{return JSON.parse(localStorage.getItem(LOCAL_ACCOUNT_KEY)||'null')}catch{return null}}
  function setStatus(text,kind=''){const e=q('gatewayStatus');if(e){e.textContent=text||'';e.className=`status ${kind}`}}
  function roleLabel(role){return role==='admin'?'Administrateur':role==='dispatcher'?"Agent d’exploitation":'Conducteur'}
  function initialRole(){
    const params=new URLSearchParams(location.search);
    const v=params.get('role')||String(location.hash||'').replace('#','');
    return ['driver','dispatcher','admin'].includes(v)?v:'driver';
  }
  function selectRole(role,writeHash=true){
    S.role=['driver','dispatcher','admin'].includes(role)?role:'driver';
    document.querySelectorAll('[data-role]').forEach(a=>a.classList.toggle('active',a.dataset.role===S.role));
    q('driverPanel')?.classList.toggle('show',S.role==='driver');
    q('managementPanel')?.classList.toggle('show',S.role!=='driver');
    q('managementRegisterForm')?.classList.add('hidden');
    if(S.role!=='driver'){
      if(q('managementTitle'))q('managementTitle').textContent=S.role==='admin'?'Connexion Administrateur':'Connexion Exploitant';
      if(q('managementHelp'))q('managementHelp').textContent=S.role==='admin'
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
    location.replace(`./app.html?v=${VERSION}&entry=${encodeURIComponent(mode)}`);
  }

  function prefillLocal(){
    const a=localAccount();
    const exportBtn=q('exportLocal');
    if(exportBtn)exportBtn.disabled=!a?.matricule;
    if(!a?.matricule)return;
    q('localBox')?.classList.add('show');
    if(q('localText'))q('localText').innerHTML=`Profil conducteur local détecté : <b>matricule ${esc(a.matricule)}</b>. Il reste stocké sur cet appareil.`;
    if(q('driverMatricule'))q('driverMatricule').value=a.matricule;
    if(q('driverRegMatricule'))q('driverRegMatricule').value=a.matricule;
    const net=a.networkKey||a.network||a.network_key;
    const sel=q('driverNetwork');
    if(net&&sel&&Array.from(sel.options).some(o=>o.value===String(net)))sel.value=String(net);
  }

  function isCloudKey(key){
    return key===PROFILE_CACHE||key===ENTRY_MODE_KEY||/^sb-/i.test(key)||/^supabase/i.test(key)||/^mon-saeiv-cloud-/i.test(key);
  }
  function localEntries(){
    const entries={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key||isCloudKey(key))continue;
      const value=localStorage.getItem(key);
      if(value!==null)entries[key]=value;
    }
    return entries;
  }
  function backupFileName(matricule){
    const d=new Date();
    const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `Mon-SAEIV-profil-local-${String(matricule||'conducteur').replace(/[^a-z0-9_-]+/gi,'-')}-${day}.json`;
  }
  async function exportLocal(){
    const a=localAccount();
    if(!a?.matricule)return setStatus('Aucun profil local détecté sur cet appareil.','err');
    const payload={format:BACKUP_FORMAT,formatVersion:1,appVersion:VERSION,exportedAt:new Date().toISOString(),matricule:String(a.matricule),entries:localEntries()};
    const text=JSON.stringify(payload,null,2);
    const name=backupFileName(a.matricule);
    try{
      const file=new File([text],name,{type:'application/json'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        try{
          await navigator.share({files:[file],title:'Sauvegarde locale Mon SAEIV'});
          setStatus('Sauvegarde locale exportée. Garde ce fichier : il permet de remettre ton profil sur le PC.','ok');
          return;
        }catch(e){if(e?.name==='AbortError')return}
      }
      const url=URL.createObjectURL(file);
      const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
      setStatus('Sauvegarde locale téléchargée.','ok');
    }catch(e){setStatus(e?.message||'Export impossible.','err')}
  }
  function purgeCloudKeys(){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&isCloudKey(k))keys.push(k)}
    keys.forEach(k=>localStorage.removeItem(k));
  }
  async function importLocal(file){
    if(!file)return;
    setStatus('Lecture de la sauvegarde locale…','busy');
    try{
      const data=JSON.parse(await file.text());
      if(data?.format!==BACKUP_FORMAT||data?.formatVersion!==1||!data.entries||typeof data.entries!=='object')throw new Error('Ce fichier n’est pas une sauvegarde locale Mon SAEIV valide.');
      if(!Object.prototype.hasOwnProperty.call(data.entries,LOCAL_ACCOUNT_KEY))throw new Error('Le fichier ne contient pas de profil conducteur local.');
      localStorage.clear();
      for(const [key,value] of Object.entries(data.entries)){
        if(isCloudKey(key)||typeof value!=='string')continue;
        localStorage.setItem(key,value);
      }
      purgeCloudKeys();
      const a=localAccount();
      if(!a?.matricule)throw new Error('Le profil local n’a pas pu être restauré.');
      setStatus(`Profil local ${a.matricule} importé. Rechargement…`,'ok');
      setTimeout(()=>location.replace(`./?v=${VERSION}&imported=1#driver`),500);
    }catch(e){setStatus(e?.message||'Import impossible.','err')}
    finally{if(q('importLocalFile'))q('importLocalFile').value=''}
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
    if(password.length<6)return setStatus('Le mot de passe conducteur doit contenir au moins 6 caractères.','err');
    if(password!==q('driverConfirm').value)return setStatus('Les deux mots de passe ne correspondent pas.','err');
    setStatus('Création / liaison du compte conducteur…','busy');
    try{
      const matricule=q('driverRegMatricule').value.trim();
      const r=await fetch(`${SUPABASE_URL}/functions/v1/register-member`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({password,organizationCode:q('driverOrg').value.trim(),matricule,displayName:q('driverName').value.trim(),inviteCode:q('driverInvite').value.trim(),network:q('driverNetwork').value})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok||!b.ok)throw new Error(b.error||'Création impossible.');
      if(b.profile?.role!=='driver')throw new Error(`Ce code d’invitation correspond au rôle ${roleLabel(b.profile?.role)}, pas Conducteur.`);
      await loginDriver(matricule,password);setStatus('Compte conducteur créé et lié.','ok');goApp('cloud');
    }catch(err){setStatus(err?.message||'Création impossible.','err')}
  }

  async function loginManagement(email,password){
    const c=await client();
    const {data,error}=await c.auth.signInWithPassword({email:String(email||'').trim(),password});
    if(error||!data.session)throw error||new Error('Connexion impossible.');
    const profile=await profileFor(data.user.id);
    if(profile.role!==S.role){await c.auth.signOut().catch(()=>{});throw new Error(`Ce compte est ${roleLabel(profile.role)}, pas ${roleLabel(S.role)}.`)}
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
    if(password.length<8)return setStatus('Le mot de passe de gestion doit contenir au moins 8 caractères.','err');
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

  async function dropSession(silent=false){
    try{await (await client()).auth.signOut()}catch{}
    try{localStorage.removeItem(PROFILE_CACHE);localStorage.removeItem(ENTRY_MODE_KEY)}catch{}
    S.profile=null;q('sessionBox')?.classList.remove('show');
    if(!silent)setStatus('Session serveur fermée. Le profil local reste intact.','ok');
  }
  async function inspectSession(){
    try{
      const c=await client();
      const {data:{session}}=await c.auth.getSession();
      if(!session)return;
      const p=await profileFor(session.user.id);S.profile=p;saveProfile(p);
      q('sessionBox')?.classList.add('show');
      if(q('sessionText'))q('sessionText').innerHTML=`Session serveur déjà active : <b>${esc(p.display_name||p.matricule)}</b> · ${esc(roleLabel(p.role))}.`;
    }catch(err){
      console.warn('[Mon SAEIV gateway] ancienne session supprimée',err);
      await dropSession(true);
    }
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
    q('linkLocal')?.addEventListener('click',()=>{selectRole('driver');q('driverRegisterForm')?.classList.remove('hidden');q('showDriverRegister')?.classList.add('hidden');prefillLocal();q('driverInvite')?.focus()});
    q('resumeSession')?.addEventListener('click',()=>goApp('cloud'));
    q('dropSession')?.addEventListener('click',()=>dropSession(false));
    q('exportLocal')?.addEventListener('click',exportLocal);
    q('importLocal')?.addEventListener('click',()=>q('importLocalFile')?.click());
    q('importLocalFile')?.addEventListener('change',e=>importLocal(e.target.files?.[0]));
  }

  function init(){
    selectRole(initialRole(),false);prefillLocal();bind();inspectSession();
    if(new URLSearchParams(location.search).get('imported')==='1')setStatus('Profil local importé sur cet appareil.','ok');
    document.documentElement.dataset.monSaeivGateway=VERSION;
  }
  window.MonSAEIVGatewayV163={installed:true,version:VERSION,exportLocal,importLocal,localAccount};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
