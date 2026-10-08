'use strict';
/* SAEIV 1.0.95 - Edit an already published driver day via consent, not via direct update. */
(()=>{
if(window.MonSAEIVPublishedEditV193?.installed)return;
const q=id=>document.getElementById(id),cloud=()=>window.MonSAEIVCloudV156,db=()=>cloud()?.client,profile=()=>cloud()?.profile;
const board=()=>window.MonSAEIVOperationsBoardV165;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const M={driver:null,date:null,items:[],official:null,busy:false};
const msg=(s,err=false)=>{if(q('v193Status')){q('v193Status').textContent=s;q('v193Status').style.color=err?'#ffaaaa':'#aefac9'}};
function ensure(){
if(q('v193EditModal'))return;
const style=document.createElement('style');style.textContent='#v193EditModal.hide{display:none!important}#v193EditModal{position:fixed;inset:0;z-index:200000;background:#03121bcc;display:flex;align-items:center;justify-content:center;padding:12px}#v193EditModal .inner{background:#0c2636;color:#f3fbff;border:1px solid #54738a;border-radius:18px;max-width:990px;width:100%;padding:16px;max-height:91vh;overflow:auto}#v193EditModal .head{display:flex;justify-content:space-between;gap:15px;align-items:center}#v193EditModal .item{display:grid;grid-template-columns:1fr 90px 90px 100px 1fr 1fr auto;gap:6px;align-items:end;border-bottom:1px solid #30526a;padding:8px 0}#v193EditModal label{display:grid;gap:5px;font-size:.65rem}#v193EditModal input,#v193EditModal textarea,#v193EditModal select{width:100%;min-height:37px;border-radius:7px;background:#051725;border:1px solid #5e7890;padding:7px;color:#fff}#v193EditModal button{padding:7px;min-height:35px}#v193EditModal .lineactions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}@media(max-width:800px){#v193EditModal .item{grid-template-columns:repeat(2,minmax(0,1fr))}}';
document.head.append(style);
const el=document.createElement('section');el.id='v193EditModal';el.className='hide';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
el.innerHTML='<div class="inner"><div class="head"><h2 id="v193Title">Modifier le planning</h2><button id="v193Close" type="button">Fermer</button></div><p>Le planning déjà communiqué reste officiel jusqu’à l’accord du conducteur ET la confirmation de l’exploitation. Chaque retrait ou changement est soumis au conducteur.</p><div id="v193Status"></div><div id="v193Items"></div><label>Motif de la modification (obligatoire)<textarea id="v193Reason" rows="2" placeholder="Service supprimé, nouveau lieu, horaire modifié…"></textarea></label><div class="lineactions"><button id="v193Submit" type="button">✉️ Envoyer au conducteur pour accord</button><button id="v193Reset" type="button">Annuler les modifications locales</button></div></div>';
document.body.append(el);
q('v193Close').onclick=()=>el.classList.add('hide');
q('v193Reset').onclick=()=>{M.items=structuredClone(M.official?.items||[]);render();msg('Ancien planning restauré dans cet éditeur.')};
q('v193Submit').onclick=()=>submit().catch(e=>msg(e.message||String(e),true));
el.addEventListener('click',e=>{const x=e.target.closest('[data-remove]');if(x){M.items.splice(Number(x.dataset.remove),1);render()}});
el.addEventListener('change',e=>{const input=e.target.closest('[data-edit-field]');if(input&&M.items[Number(input.dataset.index)])M.items[Number(input.dataset.index)][input.dataset.editField]=input.value});
}
const field=(i,k,label,t='text')=>'<label>'+esc(label)+'<input data-index="'+i+'" data-edit-field="'+k+'" type="'+t+'" value="'+esc(M.items[i][k]||'')+'"></label>';
function render(){
const box=q('v193Items');if(!box)return;
box.innerHTML=M.items.map((x,i)=>'<div class="item">'+field(i,'line','Ligne')+field(i,'start','Début','time')+field(i,'end','Fin','time')+field(i,'type','Type')+field(i,'origin','Départ')+field(i,'destination','Arrivée')+'<button type="button" data-remove="'+i+'">🗑 Retirer</button></div>').join('')||'<p>Plus aucune activité : demander la suppression de tous les services de cette journée.</p>';
}
async function open(driverId){
if(!db()||!['admin','dispatcher'].includes(profile()?.role))throw Error('Accès exploitation requis');
ensure();const day=board()?.date;if(!day)throw Error('Choisir la journée dans le générateur');
const org=profile().organization_id;
const [{data,error},pending]=await Promise.all([
 db().from('saeiv_published_days').select('*').eq('organization_id',org).eq('driver_user_id',driverId).eq('service_date',day).maybeSingle(),
 db().from('saeiv_change_requests').select('id,status').eq('organization_id',org).eq('driver_user_id',driverId).eq('service_date',day).in('status',['pending','accepted'])
]);
if(error)throw error;if(pending.error)throw pending.error;
if(!data)throw Error('Aucun planning déjà publié : utiliser le bouton « Construire » de ce conducteur.');
if(pending.data?.length)throw Error('Une modification attend déjà une réponse ou une validation pour ce conducteur.');
M.driver=driverId;M.date=day;M.official=data;M.items=structuredClone(data.items||[]);
const driver=board().drivers.find(x=>x.user_id===driverId);
q('v193Title').textContent='✏️ Modifier / retirer · '+(driver?.display_name||driver?.matricule||'Conducteur')+' · '+day;
q('v193Reason').value='';render();msg('Modification locale, non publiée.');q('v193EditModal').classList.remove('hide');
}
function valid(){
if(JSON.stringify(M.items)===JSON.stringify(M.official?.items))throw Error('Aucune modification à soumettre.');
const time=x=>{const m=String(x||'').match(/^(\d\d):(\d\d)/);return m?Number(m[1])*60+Number(m[2]):null};
for(const x of M.items)if(time(x.start)===null||time(x.end)===null||time(x.start)>=time(x.end))throw Error('Horaires incohérents pour '+(x.line||x.label||'une activité'));
const sorted=[...M.items].filter(x=>!['hlp','cut','pause','start','end'].includes(x.type)).sort((a,b)=>time(a.start)-time(b.start));
for(let i=1;i<sorted.length;i++)if(time(sorted[i-1].end)>time(sorted[i].start))throw Error('Des courses se chevauchent. Corriger avant envoi.');
}
async function submit(){
if(M.busy)return;valid();const reason=q('v193Reason').value.trim();if(reason.length<5)throw Error('Indiquer le motif précis (5 caractères minimum).');
M.busy=true;let lock=null;
try{
 const {data,error}=await db().rpc('saeiv_acquire_lock',{p_start:M.date,p_end:M.date,p_name:profile()?.display_name||'Exploitation'});
 if(error)throw error;if(!data?.ok)throw Error('Date verrouillée par '+(data?.owner||'un autre exploitant'));lock=data.id;
 const answer=await db().rpc('saeiv_propose_change',{p_driver:M.driver,p_date:M.date,p_items:M.items,p_summary:reason});
 if(answer.error)throw answer.error;
 msg('✅ Proposition envoyée au conducteur. Ancien planning maintenu jusqu’à acceptation et revalidation.');
 setTimeout(()=>q('v193EditModal')?.classList.add('hide'),300);
}finally{
 if(lock){const res=await db().rpc('saeiv_release_lock',{p_id:lock,p_force:false});if(res.error)console.warn('[SAEIV] release lock',res.error)}
 M.busy=false;
}
}
function intercept(e){const b=e.target?.closest?.('[data-v195-edit]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();(window.MonSAEIVSegmentChangeV195?.open?window.MonSAEIVSegmentChangeV195.open({driver_user_id:b.dataset.v195Edit,service_date:board()?.date}):open(b.dataset.v195Edit)).catch(e=>{ensure();q('v193EditModal').classList.remove('hide');msg(e.message||String(e),true)})}
window.addEventListener('click',intercept,true);
window.MonSAEIVPublishedEditV193={installed:true,open};
})();