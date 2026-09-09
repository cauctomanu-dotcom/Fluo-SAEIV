'use strict';
/* Mon SAEIV 1.0.63 — gestion explicite des comptes serveur par l'administrateur. */
(()=>{
  if(window.MonSAEIVAdminAccountsV161?.installed)return;
  const VERSION='1.0.63';
  const SUPABASE_URL='https://xpmrnwipnoekiycghwli.supabase.co';
  const SUPABASE_KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=r=>r==='admin'?'Administrateur':r==='dispatcher'?"Agent d’exploitation":'Conducteur';
  let installing=false;

  function cloud(){return window.MonSAEIVCloudV156}
  function adminProfile(){const p=cloud()?.profile;return p?.role==='admin'&&p.active!==false?p:null}

  function installUi(){
    if(q('v161AccountsPanel')||installing)return !!q('v161AccountsPanel');
    const host=q('v157AdminView');
    if(!host||!adminProfile())return false;
    installing=true;
    const style=document.createElement('style');
    style.id='v161AccountsStyle';
    style.textContent=`
      .v161-panel{margin-top:12px;padding:13px;border:1px solid #6f3c3e;border-radius:15px;background:#1d1115}
      .v161-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.v161-head h3{margin:0}.v161-help{margin:6px 0 0;color:#d3afb1;font-size:.68rem;line-height:1.45}
      .v161-list{display:grid;gap:8px;margin-top:10px}.v161-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid #503033;border-radius:12px;background:#100b0d}.v161-row b,.v161-row span{display:block}.v161-row span{margin-top:2px;color:#b99da0;font-size:.62rem}
      .v161-delete{min-height:40px!important;padding:7px 10px!important;border-color:#a84d52!important;background:#421b20!important;color:#ffd6d3!important}.v161-self{padding:5px 8px;border-radius:999px;background:#3c3412;color:#ffe99b;font-size:.58rem;font-weight:900}.v161-status{min-height:1.2em;margin-top:8px;color:#c5a8aa;font-size:.66rem}.v161-status.ok{color:#9cf4b7}.v161-status.err{color:#ffaaa5}.v161-status.busy{color:#ffe28a}
      @media(max-width:580px){.v161-row{grid-template-columns:1fr}.v161-delete{width:100%}}
    `;
    document.head.appendChild(style);
    host.insertAdjacentHTML('beforeend',`<section id="v161AccountsPanel" class="v161-panel"><div class="v161-head"><div><h3>🗑 Supprimer un compte serveur</h3><p class="v161-help">La suppression efface le compte d’authentification et ses données serveur associées. Le profil local enregistré sur l’appareil de la personne n’est pas touché.</p></div><button id="v161RefreshAccounts" type="button">↻ Actualiser</button></div><div id="v161AccountsList" class="v161-list"></div><div id="v161AccountsStatus" class="v161-status"></div></section>`);
    q('v161RefreshAccounts')?.addEventListener('click',loadAccounts);
    q('v161AccountsList')?.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-v161-delete]');
      if(b)deleteAccount(b.dataset.v161Delete,b.dataset.v161Name||'ce compte');
    });
    installing=false;
    loadAccounts();
    return true;
  }

  function status(text,kind=''){const el=q('v161AccountsStatus');if(el){el.textContent=text||'';el.className=`v161-status ${kind}`}}

  async function loadAccounts(){
    const p=adminProfile(),c=cloud()?.client,list=q('v161AccountsList');
    if(!p||!c||!list)return;
    status('Chargement des comptes…','busy');
    try{
      const {data,error}=await c.from('profiles').select('user_id,matricule,display_name,role,network,active,created_at').eq('organization_id',p.organization_id).order('created_at',{ascending:true});
      if(error)throw error;
      if(!data?.length){list.innerHTML='<div style="color:#b99da0;font-size:.7rem">Aucun compte serveur.</div>';status('Aucun compte.','ok');return}
      list.innerHTML=data.map(m=>{
        const self=m.user_id===p.user_id;
        const name=esc(m.display_name||m.matricule||'Compte');
        const safeId=esc(m.user_id);
        return `<div class="v161-row"><div><b>${name}</b><span>Matricule ${esc(m.matricule||'—')} · ${esc(roleLabel(m.role))}${m.active===false?' · INACTIF':''}</span></div>${self?'<span class="v161-self">TON COMPTE</span>':`<button class="v161-delete" type="button" data-v161-delete="${safeId}" data-v161-name="${name}">SUPPRIMER</button>`}</div>`;
      }).join('');
      status(`${data.length} compte(s) serveur.`,'ok');
    }catch(e){status(e?.message||'Impossible de charger les comptes.','err')}
  }

  async function deleteAccount(userId,name){
    const p=adminProfile(),c=cloud()?.client;
    if(!p||!c||!userId)return;
    if(!confirm(`Supprimer définitivement ${name} du serveur Mon SAEIV ?\n\nLe profil local de son appareil ne sera pas supprimé.`))return;
    status(`Suppression de ${name}…`,'busy');
    try{
      const {data:{session}}=await c.auth.getSession();
      if(!session?.access_token)throw new Error('Session administrateur expirée. Reconnecte-toi.');
      const r=await fetch(`${SUPABASE_URL}/functions/v1/delete-member`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({targetUserId:userId})});
      const body=await r.json().catch(()=>({}));
      if(!r.ok||!body.ok)throw new Error(body.error||`Suppression HTTP ${r.status}`);
      status(`${name} a été supprimé du serveur.`,'ok');
      await loadAccounts();
      q('v157MembersRefresh')?.click();
      q('v157Refresh')?.click();
    }catch(e){status(e?.message||'Suppression impossible.','err')}
  }

  function watch(){
    if(installUi())return;
    let tries=0;
    const timer=setInterval(()=>{if(installUi()||++tries>240)clearInterval(timer)},250);
    const mo=new MutationObserver(()=>installUi());
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }

  window.MonSAEIVAdminAccountsV161={installed:true,version:VERSION,installUi,loadAccounts};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();
