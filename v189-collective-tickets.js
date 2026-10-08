'use strict';
/* Mon SAEIV 1.0.93 — Billets éco / billets collectifs */
(()=>{
 if(window.MonSAEIVCollectivesV189?.installed)return;
 const q=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot','\'':'&#39;'}[c]));
 const cl=()=>window.MonSAEIVCloudV156,db=()=>cl()?.client,p=()=>cl()?.profile,org=()=>p()?.organization_id,planner=()=>window.MonSAEIVPlanningV187;
 const C={tickets:[],selected:null,busy:false};
 const v=id=>q(id)?.value?.trim()||'';
 const status=(s,bad=false)=>{const x=q('v189Status');if(x){x.textContent=s;x.style.color=bad?'#ffa3a3':'#b8ffd1'}};
 const err=e=>status(e?.message||String(e),true);
 const field=(id,label,type='text',value='')=>'<label>'+esc(label)+'<input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></label>';
 function ui(){
  if(q('v189Root')||!db()||!['admin','dispatcher'].includes(p()?.role)||!q('v157Dispatch'))return;
  const css=document.createElement('style');
  css.textContent='#v189Root{background:#0a2030;color:#eef8ff;border:1px solid #54778d;border-radius:17px;padding:14px;margin:12px 0}#v189Root.hide{display:none!important}#v189Root label{display:grid;gap:3px;min-width:130px;flex:1;font-size:.72rem}#v189Root .row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:end}#v189Root input,#v189Root select,#v189Root textarea{background:#061926;color:#fff;border:1px solid #4e7185;border-radius:8px;padding:9px;width:100%;min-height:39px}#v189Root button{min-height:40px;padding:8px}#v189Root .ticket{border:1px solid #40647a;border-radius:12px;padding:11px;margin:9px 0}#v189Root .legs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#v189Root h3{color:#ffe5a0}#v189Root .days label{min-width:auto;display:flex;align-items:center}#v189Root small{color:#a9c4d2}';
  document.head.append(css);
  const root=document.createElement('section');root.id='v189Root';root.className='hide';
  root.innerHTML='<h2>🎟 Billet éco · billets collectifs</h2><p>Une demande peut comprendre un aller simple, un aller-retour ou un transport avec immobilisation du véhicule sur place. Enregistrement séparé, puis affectation dans les brouillons du planning.</p><div id="v189Status" role="status"></div>'+
  '<div class="row">'+field('v189Ref','Référence billet')+field('v189Title','Client / intitulé')+'<label>Nature<input id="v189Nature" value="Transport collectif"></label><label>Type<select id="v189Pattern"><option value="one_way">Aller simple</option><option value="round_trip">Aller-retour</option><option value="stay_return">Aller · attente sur place · retour</option></select></label></div>'+
  '<div class="row"><label>Fréquence<select id="v189Rec"><option value="once">Exceptionnel</option><option value="weekly">Hebdomadaire récurrent</option></select></label>'+field('v189Date','Date prévue','date')+field('v189From','Début récurrence','date')+field('v189Until','Fin récurrence','date')+field('v189Passengers','Voyageurs','number')+'<label>Véhicule<select id="v189Vehicle"><option value="">Indifférent</option><option value="bus">Autocar</option><option value="minibus">Minibus</option><option value="van">Camionnette</option></select></label></div>'+
  '<div class="row days">'+['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d,i)=>'<label><input type="checkbox" data-weekday="'+(i+1)+'">'+d+'</label>').join('')+'</div>'+
  '<h3>Trajets et horaires</h3><div id="v189Legs"></div><label>Observations<textarea id="v189Notes" rows="2"></textarea></label><div class="row"><button id="v189Save">Enregistrer le billet</button><button id="v189Reload">Actualiser</button><button id="v189New">Nouveau billet</button></div>'+
  '<h3>Billets à affecter</h3><p>Pour placer un billet, choisir un conducteur et ouvrir le brouillon à la date du trajet. Les activités restent non publiées tant que l’exploitation ne les a pas validées.</p><div id="v189List"></div>';
  q('v157OpsView').insertAdjacentElement('afterend',root);
  q('v189Pattern').addEventListener('change',drawLegs);
  q('v189Rec').addEventListener('change',recurring);
  root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
   if(b.id==='v189Save')save().catch(err);
   if(b.id==='v189Reload')load().catch(err);
   if(b.id==='v189New')clear();
   if(b.dataset.edit)edit(b.dataset.edit);
   if(b.dataset.assign)assign(b.dataset.assign).catch(err);
  });
  clear();load().catch(err);
 }
 function recurring(){const is=v('v189Rec')==='weekly';q('v189From').disabled=!is;q('v189Until').disabled=!is;document.querySelectorAll('#v189Root [data-weekday]').forEach(e=>e.disabled=!is)}
 const labels=['Aller','Retour'];
 function drawLegs(){
  const pattern=v('v189Pattern'),size=pattern==='one_way'?1:2;
  q('v189Legs').innerHTML=Array.from({length:size},(_,i)=>'<div class="ticket"><h4>'+(i===0?'Trajet aller':'Trajet retour')+'</h4><div class="row">'+field('v189Origin'+i,'Adresse de départ')+field('v189Dest'+i,'Adresse destination')+field('v189Start'+i,'Départ','time')+field('v189End'+i,'Arrivée','time')+'</div></div>').join('')+
   (pattern==='stay_return'?'<p>Le véhicule reste à destination entre les trajets : cette immobilisation compte dans l’amplitude et la disponibilité du véhicule.</p>':'');
 }
 function clear(){
  C.selected=null;
  for(const id of ['v189Ref','v189Title','v189Date','v189From','v189Until','v189Passengers','v189Notes'])q(id).value='';
  q('v189Nature').value='Transport collectif';q('v189Vehicle').value='';q('v189Pattern').value='one_way';q('v189Rec').value='once';
  document.querySelectorAll('#v189Root [data-weekday]').forEach(e=>e.checked=false);
  recurring();drawLegs();
 }
 const min=t=>{const m=String(t).match(/^(\d{2}):(\d{2})$/);return m?+m[1]*60+(+m[2]):null};
 const validateLegs=legs=>{
  if(!legs.length||legs.some(x=>!x.origin||!x.destination||min(x.start)===null||min(x.end)===null||min(x.end)<=min(x.start)))throw Error('Renseigner adresses et horaires de chaque trajet, fin après début');
  if(legs.length===2&&min(legs[1].start)<min(legs[0].end))throw Error('Retour avant la fin de l’aller');
 };
 async function save(){
  if(C.busy)return;const legs=Array.from({length:v('v189Pattern')==='one_way'?1:2},(_,i)=>({origin:v('v189Origin'+i),destination:v('v189Dest'+i),start:v('v189Start'+i),end:v('v189End'+i)}));
  validateLegs(legs);
  const reference=v('v189Ref'),title=v('v189Title'),date=v('v189Date'),recurrent=v('v189Rec')==='weekly';
  if(!reference||!title||!date)throw Error('Référence, intitulé et date obligatoires');
  const weekdays=[...document.querySelectorAll('#v189Root [data-weekday]:checked')].map(e=>Number(e.dataset.weekday));
  if(recurrent&&(!v('v189From')||!v('v189Until')||v('v189Until')<v('v189From')||!weekdays.length))throw Error('Récurrence : début, fin et jours nécessaires');
  const row={organization_id:org(),reference,title,nature:v('v189Nature'),pattern:v('v189Pattern'),recurrence:v('v189Rec'),service_date:date,
   valid_from:recurrent?v('v189From'):null,valid_until:recurrent?v('v189Until'):null,weekdays:recurrent?weekdays:[],
   passengers:v('v189Passengers')?Number(v('v189Passengers')):null,vehicle_type:v('v189Vehicle')||null,legs,notes:v('v189Notes')};
  C.busy=true;try{
   const request=C.selected?db().from('saeiv_collective_tickets').update(row).eq('id',C.selected).eq('organization_id',org()):db().from('saeiv_collective_tickets').insert(row);
   const {error}=await request;if(error)throw error;status('Billet collectif sauvegardé');clear();await load();
  }finally{C.busy=false}
 }
 async function load(){
  const {data,error}=await db().from('saeiv_collective_tickets').select('*').eq('organization_id',org()).order('service_date',{ascending:true}).limit(500);
  if(error)throw error;C.tickets=data||[];render();
 }
 function render(){
  q('v189List').innerHTML=C.tickets.map(x=>'<article class="ticket"><strong>'+esc(x.reference)+' · '+esc(x.title)+'</strong><small> · '+esc(x.nature)+' · '+esc(x.pattern)+' · '+esc(x.recurrence)+'</small><div>'+esc(x.service_date)+' · '+esc(x.legs.map(l=>l.origin+' → '+l.destination).join(' / '))+'</div><div class="row"><button data-edit="'+esc(x.id)+'">Modifier</button><button data-assign="'+esc(x.id)+'">Ajouter au brouillon du planning</button></div></article>').join('')||'<p>Aucun billet enregistré</p>';
 }
 function edit(id){
  const x=C.tickets.find(x=>x.id===id);if(!x)return;C.selected=id;
  for(const [key,k] of [['v189Ref','reference'],['v189Title','title'],['v189Nature','nature'],['v189Pattern','pattern'],['v189Rec','recurrence'],['v189Date','service_date'],['v189From','valid_from'],['v189Until','valid_until'],['v189Passengers','passengers'],['v189Vehicle','vehicle_type'],['v189Notes','notes']])q(key).value=x[k]??'';
  recurring();document.querySelectorAll('#v189Root [data-weekday]').forEach(e=>e.checked=(x.weekdays||[]).includes(Number(e.dataset.weekday)));drawLegs();
  (x.legs||[]).forEach((l,i)=>{for(const [key,k] of [['Origin','origin'],['Dest','destination'],['Start','start'],['End','end']])if(q('v189'+key+i))q('v189'+key+i).value=l[k]||''});
  q('v189Root').scrollIntoView({behavior:'smooth'});
 }
 function occurrence(x,date){
  if(x.recurrence==='once')return x.service_date===date;
  const day=new Date(date+'T12:00:00Z').getUTCDay(),weekday=day===0?7:day;
  return date>=x.valid_from&&date<=x.valid_until&&(x.weekdays||[]).includes(weekday);
 }
 async function assign(id){
  const x=C.tickets.find(y=>y.id===id),state=planner()?.state;
  if(!x||!state?.driver)throw Error('Ouvrir d’abord un conducteur dans Planning collaboratif');
  const date=state.date;
  if(!occurrence(x,date))throw Error('Ce billet ne correspond pas au '+date+' ; adapter le jour du planning');
  if(!state.lock||!(date>=state.lock.start&&date<=state.lock.end))throw Error('Verrouiller d’abord la journée ou la semaine');
  if(state.official)throw Error('Planning déjà publié : préparer une proposition de changement, pas un ajout direct');
  const items=state.items||[];
  const a=Number(x.passengers||0);
  const tasks=x.legs.map((leg,i)=>({id:'collective-'+x.id+'-'+date+'-'+i,date,type:'other',source:'collective',collective_id:x.id,
   collective_reference:x.reference,vehicle_type:x.vehicle_type,passengers:a,label:'Billet collectif '+x.reference+' · '+x.title,
   start:leg.start,end:leg.end,origin:leg.origin,destination:leg.destination,notes:x.notes||'',linked:{ticket:x.reference}}));
  for(const t of tasks){
   const st=min(t.start),end=min(t.end);
   if(items.some(y=>y.id!==t.id&&min(y.start)<end&&min(y.end)>st))throw Error('Chevauchement avec une activité du planning. Affectation refusée.');
  }
  for(const t of tasks){const old=items.findIndex(y=>y.id===t.id);if(old<0)items.push(t);else items[old]=t}
  await planner().loadDay?.(); // redraw is explicit in planner bridge below
  status('Billet placé pour '+date+'. Enregistrer le brouillon puis valider.');window.dispatchEvent(new CustomEvent('saeiv-collective-assigned',{detail:{id,date}}));
 }
 window.MonSAEIVCollectivesV189={installed:true,install:ui,load,occurrence};
 setInterval(()=>{if(db()&&['admin','dispatcher'].includes(p()?.role))ui();const e=q('v189Root');if(e)e.classList.toggle('hide',q('v157OpsView')?.classList.contains('hidden'))},1200);
})();