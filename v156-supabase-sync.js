'use strict';
/* Mon SAEIV 1.0.56 — comptes Supabase, multi-appareils et synchronisation planning. */
(()=>{
  if(window.MonSAEIVCloudV156?.installed)return;
  const VERSION='1.0.56';
  const SUPABASE_URL='https://xpmrnwipnoekiycghwli.supabase.co';
  const SUPABASE_KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
  const PROFILE_CACHE='mon-saeiv-cloud-profile-v156';
  const q=id=>document.getElementById(id);
  const S={client:null,user:null,profile:null,channel:null,pushTimer:null,pullTimer:null,suppressPush:false,initializing:false,lastSync:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=r=>r==='admin'?'Administrateur':r==='dispatcher'?'Agent d’exploitation':'Conducteur';
  const timeDb=v=>/^\d{2}:\d{2}$/.test(String(v||''))?`${v}:00`:null;
  const timeUi=v=>String(v||'').slice(0,5);
  const allowedTypes=new Set(['start','regular','school','tad','hlp','annex','availability','cut','pause','end','other']);

  function cacheProfile(p){try{localStorage.setItem(PROFILE_CACHE,JSON.stringify(p))}catch{}}
  function cachedProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_CACHE)||'null')}catch{return null}}
  function setCloudStatus(text,kind=''){
    const el=q('v156CloudStatus');if(el){el.textContent=text;el.className=`v156-cloud-status ${kind}`}
    const chip=q('v156CloudChip');if(chip){chip.textContent=S.profile?`☁ ${S.profile.matricule} · ${roleLabel(S.profile.role)}`:'☁ Compte serveur'}
  }

  function addUi(){
    if(q('v156CloudAuth'))return;
    const style=document.createElement('style');style.id='v156CloudStyle';style.textContent=`
      .v156-cloud-auth{position:fixed;z-index:49000;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.82);backdrop-filter:blur(8px)}
      .v156-cloud-card{width:min(560px,100%);max-height:94dvh;overflow:auto;padding:19px;border:1px solid #3d6073;border-radius:22px;background:linear-gradient(180deg,#102936,#071721);box-shadow:0 30px 90px rgba(0,0,0,.62)}
      .v156-cloud-logo{color:#ffd000;font-size:.68rem;font-weight:1000;letter-spacing:.13em}.v156-cloud-card h2{margin:5px 0 4px}.v156-cloud-card p{margin:0 0 13px;color:#a9bdc7;font-size:.75rem;line-height:1.45}
      .v156-cloud-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px}.v156-cloud-tabs button.active{border-color:#ffd000;background:#3c330a;color:#fff3a0}
      .v156-cloud-form{display:grid;gap:10px}.v156-cloud-form.hidden{display:none!important}.v156-cloud-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v156-cloud-grid .wide{grid-column:1/-1}
      .v156-cloud-status{min-height:1.3em;margin-top:10px;color:#a9bdc7;font-size:.72rem}.v156-cloud-status.ok{color:#9cf4b7}.v156-cloud-status.err{color:#ffaaa5}.v156-cloud-status.busy{color:#ffe28a}
      .v156-cloud-note{margin-top:12px;padding:9px 10px;border:1px solid #314a59;border-radius:11px;background:#07131c;color:#98adb8;font-size:.66rem;line-height:1.45}
      #v156CloudChip{min-height:36px!important;padding:6px 9px!important;font-size:.66rem!important}
      .v156-account-sheet{position:fixed;z-index:52000;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.72)}
      .v156-account-card{width:min(480px,100%);padding:16px;border:1px solid #3d6073;border-radius:18px;background:#0d202c}.v156-account-card h3{margin:0 0 8px}.v156-account-card p{color:#a9bdc7;font-size:.72rem}.v156-account-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      @media(max-width:600px){.v156-cloud-grid,.v156-account-actions{grid-template-columns:1fr}.v156-cloud-grid .wide{grid-column:auto}.v156-cloud-auth{padding:0;align-items:flex-end}.v156-cloud-card{border-radius:22px 22px 0 0;max-height:97dvh}}
    `;document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend',`
      <div id="v156CloudAuth" class="v156-cloud-auth">
        <div class="v156-cloud-card">
          <div class="v156-cloud-logo">MON SAEIV · COMPTE SERVEUR</div>
          <h2>Connexion sécurisée</h2>
          <p>Ton compte permet de retrouver ton planning sur plusieurs appareils et de recevoir les modifications de l’exploitation.</p>
          <div class="v156-cloud-tabs"><button id="v156LoginTab" class="active" type="button">Se connecter</button><button id="v156RegisterTab" type="button">Créer mon compte</button></div>
          <form id="v156LoginForm" class="v156-cloud-form">
            <label>Adresse e-mail<input id="v156LoginEmail" type="email" autocomplete="email" required></label>
            <label>Mot de passe<input id="v156LoginPassword" type="password" autocomplete="current-password" minlength="8" required></label>
            <button class="primary" type="submit">SE CONNECTER</button>
          </form>
          <form id="v156RegisterForm" class="v156-cloud-form hidden">
            <div class="v156-cloud-grid">
              <label class="wide">Adresse e-mail<input id="v156RegEmail" type="email" autocomplete="email" required></label>
              <label>Mot de passe<input id="v156RegPassword" type="password" autocomplete="new-password" minlength="8" required></label>
              <label>Confirmer<input id="v156RegConfirm" type="password" autocomplete="new-password" minlength="8" required></label>
              <label>Code société<input id="v156RegOrg" type="text" value="PILOTE" maxlength="40" required></label>
              <label>Matricule<input id="v156RegMatricule" type="text" maxlength="40" required></label>
              <label class="wide">Nom affiché<input id="v156RegName" type="text" maxlength="80" placeholder="Prénom / nom"></label>
              <label>Réseau<select id="v156RegNetwork"><option value="fluo">Fluo Grand Est</option><option value="stan">STAN</option><option value="lemet">LE MET’</option><option value="temob">TeMo’b</option><option value="rgtr">RGTR</option><option value="tice">TICE</option></select></label>
              <label>Code d’invitation<input id="v156RegInvite" type="text" autocomplete="one-time-code" required></label>
            </div>
            <button class="primary" type="submit">CRÉER LE COMPTE</button>
          </form>
          <div id="v156CloudStatus" class="v156-cloud-status"></div>
          <div class="v156-cloud-note">Le rôle Conducteur / Exploitation / Administrateur est attribué par la société via le code d’invitation. Il n’est jamais choisi librement sur cet écran.</div>
        </div>
      </div>
      <div id="v156AccountSheet" class="v156-account-sheet hidden"><div class="v156-account-card"><h3>☁ Compte Mon SAEIV</h3><div id="v156AccountInfo"></div><div class="v156-account-actions"><button id="v156SyncNow" type="button">↻ Synchroniser</button><button id="v156CloudLogout" class="danger" type="button">Déconnexion serveur</button></div><button id="v156AccountClose" class="full" type="button" style="margin-top:8px">Fermer</button></div></div>
    `);
    const localAuth=q('v13Auth');if(localAuth)localAuth.classList.add('hidden');
    q('v156LoginTab')?.addEventListener('click',()=>switchMode('login'));q('v156RegisterTab')?.addEventListener('click',()=>switchMode('register'));
    q('v156LoginForm')?.addEventListener('submit',login);q('v156RegisterForm')?.addEventListener('submit',register);
    q('v156CloudLogout')?.addEventListener('click',logoutCloud);q('v156SyncNow')?.addEventListener('click',async()=>{await pushPlanning();await pullPlanning();});
    q('v156AccountClose')?.addEventListener('click',()=>q('v156AccountSheet')?.classList.add('hidden'));q('v156AccountSheet')?.addEventListener('click',e=>{if(e.target===q('v156AccountSheet'))q('v156AccountSheet').classList.add('hidden')});
  }
  function switchMode(mode){const reg=mode==='register';q('v156LoginForm')?.classList.toggle('hidden',reg);q('v156RegisterForm')?.classList.toggle('hidden',!reg);q('v156LoginTab')?.classList.toggle('active',!reg);q('v156RegisterTab')?.classList.toggle('active',reg);setCloudStatus('')}

  async function loadClient(){
    if(S.client)return S.client;
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    S.client=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return S.client;
  }
  async function getProfile(userId){
    const c=await loadClient();
    const {data,error}=await c.from('profiles').select('user_id,organization_id,depot_id,matricule,display_name,role,network,active').eq('user_id',userId).maybeSingle();
    if(error)throw error;if(!data?.active)throw new Error('Compte inactif ou non rattaché à une société.');return data;
  }
  function showAccountButton(){
    const bar=q('v13Userbar');if(!bar||q('v156CloudChip'))return;
    const b=document.createElement('button');b.id='v156CloudChip';b.type='button';b.textContent='☁ Compte serveur';b.addEventListener('click',openAccount);bar.appendChild(b);
  }
  function openAccount(){const p=S.profile;if(!p)return;const info=q('v156AccountInfo');if(info)info.innerHTML=`<p><b>${esc(p.display_name||p.matricule)}</b><br>Matricule ${esc(p.matricule)} · ${esc(roleLabel(p.role))}<br>Société ${esc(p.organization_id)}<br>Dernière synchro : ${S.lastSync?new Date(S.lastSync).toLocaleTimeString('fr-FR'):'—'}</p>`;q('v156AccountSheet')?.classList.remove('hidden')}

  async function login(e){e.preventDefault();setCloudStatus('Connexion…','busy');try{const c=await loadClient(),email=q('v156LoginEmail').value.trim(),password=q('v156LoginPassword').value;const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;await afterAuth(data.session)}catch(err){setCloudStatus(err.message||'Connexion impossible.','err')}}
  async function register(e){
    e.preventDefault();const email=q('v156RegEmail').value.trim(),password=q('v156RegPassword').value,confirm=q('v156RegConfirm').value;if(password!==confirm){setCloudStatus('Les deux mots de passe ne correspondent pas.','err');return}
    setCloudStatus('Création du compte…','busy');try{
      const c=await loadClient();const r=await fetch(`${SUPABASE_URL}/functions/v1/register-member`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email,password,organizationCode:q('v156RegOrg').value.trim(),matricule:q('v156RegMatricule').value.trim(),displayName:q('v156RegName').value.trim(),inviteCode:q('v156RegInvite').value.trim(),network:q('v156RegNetwork').value})});const body=await r.json().catch(()=>({}));if(!r.ok||!body.ok)throw new Error(body.error||`Inscription HTTP ${r.status}`);
      const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;await afterAuth(data.session);
    }catch(err){setCloudStatus(err.message||'Création impossible.','err')}
  }
  async function logoutCloud(){try{await S.client?.auth.signOut()}catch{};try{S.channel&&await S.client?.removeChannel(S.channel)}catch{};S.user=null;S.profile=null;S.channel=null;localStorage.removeItem(PROFILE_CACHE);q('v156AccountSheet')?.classList.add('hidden');q('v156CloudAuth')?.classList.remove('hidden');q('v13Auth')?.classList.add('hidden');setCloudStatus('Déconnecté du serveur.');switchMode('login')}

  function stripPrivate(item){const out={};for(const [k,v] of Object.entries(item||{})){if(!k.startsWith('_server')&&k!=='_lockedByExploitation')out[k]=v}return out}
  function localToRow(item,index){
    const p=S.profile,u=S.user;if(!p||!u)return null;const type=allowedTypes.has(item.type)?item.type:'other';
    return {organization_id:p.organization_id,driver_user_id:u.id,client_id:String(item.id||`local-${index}`),service_date:item.date||new Date().toISOString().slice(0,10),sort_index:index*10,type,label:item.label||null,line:item.line||null,start_time:timeDb(item.start),end_time:timeDb(item.end),origin:item.origin||null,destination:item.destination||null,origin_coords:item.originCoords||null,destination_coords:item.destinationCoords||null,origin_kind:item.originKind||null,destination_kind:item.destinationKind||null,regime:item.regime||null,line_distance_km:Number.isFinite(Number(item.lineDistanceKm))?Number(item.lineDistanceKm):null,drive_minutes:Number.isFinite(Number(item.driveMinutes))?Math.round(Number(item.driveMinutes)):null,notes:item.notes||null,linked:item.linked||null,source:'driver',locked_by_exploitation:false,status:'ok',conflict_minutes:0,created_by:u.id,updated_by:u.id,payload:stripPrivate(item)};
  }
  function rowToLocal(r){
    const base=r.payload&&typeof r.payload==='object'?{...r.payload}:{};return {...base,id:r.client_id||base.id||`srv-${r.id}`,date:r.service_date,type:r.type,label:r.label||base.label||'',line:r.line||base.line||'',start:timeUi(r.start_time)||base.start||'',end:timeUi(r.end_time)||base.end||'',origin:r.origin||base.origin||'',destination:r.destination||base.destination||'',originCoords:r.origin_coords||base.originCoords||null,destinationCoords:r.destination_coords||base.destinationCoords||null,originKind:r.origin_kind||base.originKind||null,destinationKind:r.destination_kind||base.destinationKind||null,regime:r.regime||base.regime||'auto',lineDistanceKm:r.line_distance_km==null?(base.lineDistanceKm??null):Number(r.line_distance_km),driveMinutes:r.drive_minutes==null?(base.driveMinutes??null):Number(r.drive_minutes),notes:r.notes||base.notes||'',linked:r.linked||base.linked||null,_serverId:r.id,_serverSource:r.source,_lockedByExploitation:!!r.locked_by_exploitation,_serverStatus:r.status,_serverConflictMinutes:Number(r.conflict_minutes||0),_serverRevision:Number(r.revision||1)}
  }
  async function pushPlanning(){
    if(!S.client||!S.user||S.profile?.role!=='driver'||S.suppressPush||!window.FluoPlanningV316?.items)return;
    const all=window.FluoPlanningV316.items(),local=all.filter(x=>!x._lockedByExploitation&&(!x._serverSource||x._serverSource==='driver'));
    const rows=local.map(localToRow).filter(Boolean);
    try{
      if(rows.length){const {error}=await S.client.from('plan_items').upsert(rows,{onConflict:'driver_user_id,client_id'});if(error)throw error}
      const {data:server,error}=await S.client.from('plan_items').select('id,client_id').eq('driver_user_id',S.user.id).eq('source','driver');if(error)throw error;
      const keep=new Set(local.map(x=>String(x.id)));const remove=(server||[]).filter(x=>x.client_id&&!keep.has(String(x.client_id))).map(x=>x.id);if(remove.length){const {error:del}=await S.client.from('plan_items').delete().in('id',remove);if(del)throw del}
      S.lastSync=Date.now();setCloudStatus('Planning synchronisé.','ok');
    }catch(e){console.warn('[Mon SAEIV] push planning',e);setCloudStatus('Synchronisation différée : '+(e.message||e),'err')}
  }
  async function pullPlanning(){
    if(!S.client||!S.user||S.profile?.role!=='driver'||!window.FluoPlanningV316?.syncFromServer)return;
    try{const {data,error}=await S.client.from('plan_items').select('*').eq('driver_user_id',S.user.id).order('service_date',{ascending:true}).order('start_time',{ascending:true,nullsFirst:false}).order('sort_index',{ascending:true});if(error)throw error;S.suppressPush=true;try{window.FluoPlanningV316.syncFromServer((data||[]).map(rowToLocal))}finally{S.suppressPush=false}S.lastSync=Date.now();setCloudStatus('Planning à jour.','ok');window.dispatchEvent(new CustomEvent('mon-saeiv-cloud-planning-synced',{detail:{count:data?.length||0}}))}catch(e){console.warn('[Mon SAEIV] pull planning',e);setCloudStatus('Mode hors ligne : planning local conservé.','err')}
  }
  async function initialPlanningSync(){if(S.profile?.role!=='driver')return;await pushPlanning();await pullPlanning();subscribePlanning()}
  function schedulePush(){if(S.suppressPush||S.profile?.role!=='driver')return;clearTimeout(S.pushTimer);S.pushTimer=setTimeout(pushPlanning,650)}
  function schedulePull(){if(S.profile?.role!=='driver')return;clearTimeout(S.pullTimer);S.pullTimer=setTimeout(pullPlanning,450)}
  function subscribePlanning(){if(!S.client||!S.user)return;try{S.channel&&S.client.removeChannel(S.channel)}catch{};S.channel=S.client.channel(`planning-${S.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'plan_items',filter:`driver_user_id=eq.${S.user.id}`},schedulePull).subscribe()}
  function protectOfficialPlanning(){document.addEventListener('click',e=>{const b=e.target.closest?.('[data-v316-edit],[data-v316-dup]');if(!b)return;const id=b.dataset.v316Edit||b.dataset.v316Dup,item=window.FluoPlanningV316?.items?.().find(x=>String(x.id)===String(id));if(item?._lockedByExploitation){e.preventDefault();e.stopImmediatePropagation();alert('Cette activité a été créée par l’exploitation et est verrouillée. Contacte l’exploitation pour la modifier.')}},true)}

  async function afterAuth(session){
    if(!session?.user)throw new Error('Session absente');S.user=session.user;let profile;
    try{profile=await getProfile(session.user.id);cacheProfile(profile)}catch(e){const cached=cachedProfile();if(cached?.user_id===session.user.id)profile=cached;else throw e}
    S.profile=profile;showAccountButton();setCloudStatus(`Connecté · ${roleLabel(profile.role)}`,'ok');q('v156CloudAuth')?.classList.add('hidden');
    if(profile.role==='driver'){
      q('v13Auth')?.classList.add('hidden');const unlock=window.MonSAEIVAuthV13?.remoteUnlock;if(typeof unlock!=='function')throw new Error('Le module conducteur n’est pas prêt pour la connexion serveur. Recharge l’application.');unlock(profile.matricule,profile.network||'fluo');await initialPlanningSync();
    }else{
      q('v13Auth')?.classList.add('hidden');let tries=0;const open=()=>{if(window.MonSAEIVDispatchV157?.open)return window.MonSAEIVDispatchV157.open(profile,S.client);if(++tries<30)setTimeout(open,100)};open();
    }
  }

  async function init(){
    if(S.initializing)return;S.initializing=true;addUi();protectOfficialPlanning();window.addEventListener('mon-saeiv-planning-changed',schedulePush);window.addEventListener('online',async()=>{if(S.user){await pushPlanning();await pullPlanning()}});
    try{const c=await loadClient();const {data:{session}}=await c.auth.getSession();if(session)await afterAuth(session);else{q('v156CloudAuth')?.classList.remove('hidden');setCloudStatus('Connecte-toi pour activer la synchronisation.')}
      c.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){q('v156CloudAuth')?.classList.remove('hidden')}else if(session&&event==='SIGNED_IN'&&!S.user)afterAuth(session).catch(e=>setCloudStatus(e.message||e,'err'))});
    }catch(e){console.error('[Mon SAEIV] Supabase init',e);setCloudStatus('Serveur indisponible : '+(e.message||e),'err');q('v156CloudAuth')?.classList.remove('hidden')}
    finally{S.initializing=false}
  }

  window.MonSAEIVCloudV156={installed:true,version:VERSION,get client(){return S.client},get profile(){return S.profile},get user(){return S.user},sync:async()=>{await pushPlanning();await pullPlanning()},pullPlanning,pushPlanning,logout:logoutCloud};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80),{once:true});else setTimeout(init,80);
})();
