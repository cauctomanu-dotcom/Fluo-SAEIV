'use strict';
/* SAEIV v1.0.93 -- bulk assign 100 seeded drivers within their current company. */
(()=>{
if(window.MonSAEIVBulkDriversV191?.installed)return;
const q=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cl=()=>window.MonSAEIVCloudV156,db=()=>cl()?.client,p=()=>cl()?.profile;
let drivers=[],depots=[];
const status=(s,b=false)=>{const x=q('v191Status');if(x){x.textContent=s;x.style.color=b?'#ffaaaa':'#9ffac5'}};
async function load(){
const org=p()?.organization_id;if(!org)return;
const [a,b]=await Promise.all([
 db().from('profiles').select('user_id,display_name,matricule,depot_id,is_test_driver').eq('organization_id',org).eq('role','driver').eq('is_test_driver',true).order('matricule'),
 db().from('depots').select('id,name,code').eq('organization_id',org).eq('active',true)
]);if(a.error)throw a.error;if(b.error)throw b.error;
drivers=a.data||[];depots=b.data||[];
q('v191Depot').innerHTML='<option value="">Choisir un dépôt</option>'+depots.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+' ('+esc(x.code)+')</option>').join('');
q('v191Drivers').innerHTML=drivers.map(d=>'<label style="display:flex;gap:8px;align-items:center;padding:5px"><input type="checkbox" data-driver-id="'+esc(d.user_id)+'" style="width:auto">'+esc(d.matricule)+' · '+esc(d.display_name)+' <small>'+(d.depot_id?'Déjà affecté':'Sans dépôt')+'</small></label>').join('');
status(drivers.length+' conducteurs de test disponibles dans cette entreprise.');
}
async function assign(){
const depot=q('v191Depot').value,chosen=[...document.querySelectorAll('#v191Drivers [data-driver-id]:checked')].map(x=>x.dataset.driverId);
if(!depot||!chosen.length)throw Error('Sélectionner le dépôt et les conducteurs');
if(!depots.some(x=>x.id===depot))throw Error('Dépôt hors de votre entreprise');
if(!confirm('Affecter '+chosen.length+' conducteur(s) de TEST au dépôt ? Les matricules et plannings seront conservés.'))return;
const org=p()?.organization_id;
let done=0;for(const id of chosen){
 const {data,error}=await db().from('profiles').update({depot_id:depot}).eq('organization_id',org).eq('user_id',id).eq('role','driver').eq('is_test_driver',true).select('user_id');
 if(error){status(done+' conducteur(s) affectés, erreur : '+error.message,true);return}
 if(data?.length)done++;
}
await load();status(done+' conducteur(s) affectés au dépôt. Aucun compte transféré entre entreprises.');
}
function install(){
if(q('v191Root')||p()?.role!=='admin'||!db()||!q('v157AdminView'))return;
const s=document.createElement('section');s.id='v191Root';s.style.cssText='border:1px solid #42697f;border-radius:12px;padding:14px;margin:12px 0;background:#0d2836';
s.innerHTML='<h3>👥 Affectation groupée des 100 conducteurs tests</h3><p>Cocher les conducteurs, choisir un dépôt de votre société, puis affecter. Les comptes, matricules et historiques sont conservés. Aucun transfert d’entreprise n’est autorisé ici.</p><div id="v191Status"></div><label>Dépôt de destination<select id="v191Depot"></select></label><p><button id="v191All">Tout cocher</button> <button id="v191None">Tout décocher</button> <button id="v191Load">Actualiser</button></p><div id="v191Drivers" style="max-height:350px;overflow:auto"></div><button id="v191Assign">Affecter les conducteurs sélectionnés</button><p style="font-size:.7rem">La nomination des administrateurs et les transferts interentreprises seront réservés au compte propriétaire de la plateforme.</p>';
q('v157AdminView').appendChild(s);
q('v191All').onclick=()=>document.querySelectorAll('#v191Drivers [data-driver-id]').forEach(x=>x.checked=true);
q('v191None').onclick=()=>document.querySelectorAll('#v191Drivers [data-driver-id]').forEach(x=>x.checked=false);
q('v191Load').onclick=()=>load().catch(e=>status(e.message,true));
q('v191Assign').onclick=()=>assign().catch(e=>status(e.message,true));
load().catch(e=>status(e.message,true));
}
window.MonSAEIVBulkDriversV191={installed:true,install,load};
setInterval(install,1400);
})();