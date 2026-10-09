'use strict';
/* Mon SAEIV 1.0.92 — driver inbox: published days, consent and notifications. */
(()=>{
 if(window.MonSAEIVDriverInboxV188?.installed)return;
 const q=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cl=()=>window.MonSAEIVCloudV156,profile=()=>cl()?.profile,db=()=>cl()?.client,user=()=>cl()?.user;
 const eligible=()=>profile()?.role==='driver'&&!!profile()?.organization_id&&!!user()?.id&&!!db();
 const I={channel:null,changes:[],published:[],notes:[],open:false,loading:false};
 function message(text,bad=false){const box=q('v188Status');if(box){box.textContent=text;box.style.color=bad?'#ffb5b5':'#b2ffcc'}}
 function install(){
  if(q('v188Open')||!eligible())return;
  const setup=q('setup');if(!setup)return;
  const css=document.createElement('style');css.textContent='#v188Open{position:static;display:block;width:100%;max-width:420px;margin:10px 0;padding:11px 14px;background:#13425e;border:1px solid #70abcc;color:#f5fcff;border-radius:12px;font-weight:900;box-shadow:0 5px 14px #0006}#setup.hidden #v188Open,#driver:not(.hidden)~#v188Open{display:none!important}#v188Sheet{position:fixed;inset:0;z-index:2147482700;background:#040f17ed;color:#e8f7ff;overflow:auto;padding:20px}#v188Sheet[hidden]{display:none!important}#v188Sheet .shell{max-width:840px;margin:0 auto;background:#0a2230;border:1px solid #40647b;border-radius:16px;padding:16px}#v188Sheet .top{display:flex;justify-content:space-between;gap:8px;align-items:center}#v188Sheet article{padding:12px;margin:10px 0;border:1px solid #456375;border-radius:10px}#v188Sheet .buttons{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}#v188Sheet button{padding:10px;min-height:43px;font-weight:900}#v188Sheet .good{background:#153f2a;color:#bbffcd}#v188Sheet .bad{background:#57302c;color:#ffe0dc}#v188Sheet h3{color:#ffde76}#v188Sheet small{color:#b0c8d5}#v188Sheet .v188task{border-bottom:1px solid #304b5c;padding:4px;font-size:.82rem}';
  document.head.appendChild(css);
  const open=document.createElement('button');open.id='v188Open';open.type='button';open.textContent='📆 Mes plannings';const gpsPanel=setup.querySelector('.gps-test');if(gpsPanel)gpsPanel.insertAdjacentElement('afterend',open);else setup.prepend(open);
  const sheet=document.createElement('section');sheet.id='v188Sheet';sheet.hidden=true;
  sheet.innerHTML='<div class="shell"><div class="top"><h2>📆 Mon planning communiqué</h2><button id="v188Close">Fermer</button></div><p>Seuls les plannings publiés ici sont officiels pour le nouveau circuit de validation. Une proposition n’efface jamais le planning précédent avant validation finale.</p><div id="v188Status" role="status"></div><button id="v188Refresh">↻ Actualiser</button><h3>Modifications proposées</h3><div id="v188Requests"></div><h3>Plannings publiés</h3><div id="v188Published"></div><h3>Notifications</h3><div id="v188Notifications"></div></div>';
  document.body.appendChild(sheet);
  open.addEventListener('click',async()=>{I.open=true;sheet.hidden=false;await reload().catch(e=>message(e.message||String(e),true))});
  q('v188Close').addEventListener('click',()=>{I.open=false;sheet.hidden=true});
  q('v188Refresh').addEventListener('click',()=>reload().catch(e=>message(e.message||String(e),true)));
  sheet.addEventListener('click',e=>{
   const btn=e.target.closest('button');if(!btn)return;
   if(btn.dataset.reply)respond(btn.dataset.reply,btn.dataset.result).catch(x=>message(x.message||String(x),true));
   if(btn.dataset.note)markRead(btn.dataset.note).catch(x=>message(x.message||String(x),true));
  });
  subscribe();
  updateBadge().catch(()=>{});
 }
 async function select(table){const {data,error}=await db().from(table).select('*').eq('recipient_user_id',user().id).eq('organization_id',profile().organization_id).order('created_at',{ascending:false}).limit(60);if(error)throw error;return data||[]}
 async function reload(){
  if(!eligible()||I.loading)return;I.loading=true;
  try{
   const id=user().id,org=profile().organization_id;
   const [changes,published,notes]=await Promise.all([
    db().from('saeiv_change_requests').select('*').eq('organization_id',org).eq('driver_user_id',id).order('created_at',{ascending:false}).limit(60),
    db().from('saeiv_published_days').select('*').eq('organization_id',org).eq('driver_user_id',id).order('service_date',{ascending:false}).limit(90),
    select('saeiv_notifications')]);
   for(const x of [changes,published])if(x.error)throw x.error;
   I.changes=changes.data||[];I.published=published.data||[];I.notes=notes;
   render();await markSeen();updateBadge();message('Dernière mise à jour : '+new Date().toLocaleTimeString('fr-FR'));
  }finally{I.loading=false}
 }
 function brief(items){return (items||[]).map(x=>'<div class="v188task">'+esc(String(x.start||x.start_time||'').slice(0,5))+' → '+esc(String(x.end||x.end_time||'').slice(0,5))+' · '+esc(x.line||'')+' · '+esc(x.origin||x.label||x.type||'')+' → '+esc(x.destination||'')+'</div>').join('')||'<i>Aucune activité.</i>'}
 function render(){
  q('v188Requests').innerHTML=I.changes.map(x=>'<article><strong>'+esc(x.service_date)+' · '+esc(x.status.toUpperCase())+'</strong><p>'+esc(x.summary)+'</p>'+
   '<small>Proposée '+new Date(x.created_at).toLocaleString('fr-FR')+(x.batch_id?' · Réaffectation liée à d’autres conducteurs':'')+'</small>'+
   '<details><summary>Voir l’ancien planning et la proposition</summary><h4>Ancien planning officiel</h4>'+brief(x.previous_items)+'<h4>Nouveau planning proposé</h4>'+brief(x.proposed_items)+'</details>'+
   (x.status==='pending'&&!x.response_exempt?'<div class="buttons"><button class="good" data-reply="'+esc(x.id)+'" data-result="accepted">✅ J’accepte</button><button class="bad" data-reply="'+esc(x.id)+'" data-result="refused">❌ Je refuse</button></div>':'')+
   (x.response_exempt?'<p>Arrêt maladie enregistré : vos anciens services sont en attente de réaffectation. Aucun accord requis de votre part.</p>':x.status==='accepted'?'<p>Votre accord est enregistré. Le planning précédent reste officiel jusqu’aux accords des autres conducteurs concernés et à la validation de l’exploitation.</p>':x.status==='refused'?'<p>Votre refus est transmis. Si cette proposition fait partie d’un groupe, toute sa republication est bloquée.</p>':'')+'</article>').join('')||'<p>Aucune proposition en attente.</p>';
  q('v188Published').innerHTML=I.published.map(x=>'<article><strong>'+esc(x.service_date)+' · Version '+esc(x.revision)+'</strong> <small>Publié '+new Date(x.published_at).toLocaleString('fr-FR')+'</small>'+brief(x.items)+'</article>').join('')||'<p>Aucun planning publié par le nouveau circuit.</p>';
  q('v188Notifications').innerHTML=I.notes.map(x=>'<article><b>'+esc(x.title)+'</b> · <small>'+new Date(x.created_at).toLocaleString('fr-FR')+'</small><p>'+esc(x.message)+'</p>'+(x.read_at?'':'<button data-note="'+esc(x.id)+'">Marquer comme lu</button>')+'</article>').join('')||'<p>Aucune notification.</p>';
 }
 async function markSeen(){
  for(const x of I.changes.filter(x=>x.status==='pending'&&!x.seen_at)){
   const {error}=await db().rpc('saeiv_mark_change_seen',{p_change:x.id});if(error)console.warn('[SAEIV] lecture proposition',error.message);
  }
 }
 async function respond(id,response){
  const x=I.changes.find(y=>y.id===id);if(!x||x.status!=='pending')throw Error('Proposition déjà traitée');
  if(!confirm(response==='accepted'?'Confirmer que vous acceptez cette modification ? Le changement ne sera officiel qu’après validation exploitation.':'Confirmer que vous refusez cette modification ?'))return;
  const {error}=await db().rpc('saeiv_respond_change',{p_change:id,p_response:response});if(error)throw error;
  await reload();message(response==='accepted'?'Accord envoyé à l’exploitation : ancien planning conservé':'Refus transmis à l’exploitation');
 }
 async function markRead(id){const {error}=await db().from('saeiv_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_user_id',user().id);if(error)throw error;await reload()}
 async function updateBadge(){
  if(!eligible())return;
  const {data,error}=await db().from('saeiv_change_requests').select('id').eq('organization_id',profile().organization_id).eq('driver_user_id',user().id).eq('status','pending');
  if(!error&&q('v188Open'))q('v188Open').textContent='📆 Mes plannings'+(data?.length?' · '+data.length+' proposition(s)':'');
 }
 function subscribe(){
  if(I.channel||!eligible())return;
  I.channel=db().channel('saeiv-driver-inbox-'+user().id);
  for(const table of ['saeiv_change_requests','saeiv_published_days','saeiv_notifications']){
   I.channel.on('postgres_changes',{event:'*',schema:'public',table,filter:(table==='saeiv_notifications'?'recipient_user_id':'driver_user_id')+'=eq.'+user().id},()=>{updateBadge().catch(()=>{});if(I.open)reload().catch(()=>{})});
  }
  I.channel.subscribe();
 }
 window.MonSAEIVDriverInboxV188={installed:true,install,reload};
 setInterval(()=>{if(eligible())install();else if(q('v188Open')){q('v188Open').remove();q('v188Sheet')?.remove();if(I.channel){db()?.removeChannel(I.channel);I.channel=null}}},1800);
})();