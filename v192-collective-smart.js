'use strict';
(()=>{
if(window.MonSAEIVCollectiveSmartV192?.installed)return;
const q=id=>document.getElementById(id);
const c=()=>window.MonSAEIVCloudV156?.client,p=()=>window.MonSAEIVCloudV156?.profile,plan=()=>window.MonSAEIVPlanningV187;
const toMin=t=>{const m=String(t||'').match(/^(\d{2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
const conflicts=(left,right)=>left.some(a=>right.some(b=>{const [s,e,x,y]=[a.start||a.start_time,a.end||a.end_time,b.start||b.start_time,b.end||b.end_time].map(toMin);return [s,e,x,y].every(Number.isFinite)&&s<y&&e>x}));
async function suggest(id){
const ticket=window.MonSAEIVCollectivesV189?.state?.tickets?.find(x=>x.id===id),state=plan()?.state,org=p()?.organization_id;
if(!ticket||!state?.date||!org)throw Error('Ouvrir le planning collaboratif');
if(!window.MonSAEIVCollectivesV189.occurrence(ticket,state.date))throw Error('Billet non prévu pour ce jour');
if(!state.lock||state.lock.date!==state.date)throw Error('Prendre le verrou du jour avant attribution');
const [drivers,days,published,unavailable]=await Promise.all([
c().from('profiles').select('user_id,display_name,weekly_contract_minutes').eq('organization_id',org).eq('role','driver').eq('active',true),
c().from('saeiv_planning_days').select('driver_user_id,items').eq('organization_id',org).eq('service_date',state.date),
c().from('saeiv_published_days').select('driver_user_id').eq('organization_id',org).eq('service_date',state.date),
c().from('driver_unavailability').select('driver_user_id,start_time,end_time').eq('organization_id',org).eq('service_date',state.date)
]);
for(const r of [drivers,days,published,unavailable])if(r.error)throw r.error;
const booked=new Set((published.data||[]).map(x=>x.driver_user_id));
const saved=new Map((days.data||[]).map(x=>[x.driver_user_id,x.items||[]]));
const candidates=[];
for(const d of drivers.data||[]){
if(booked.has(d.user_id))continue;
const items=saved.get(d.user_id)||[],abs=(unavailable.data||[]).filter(x=>x.driver_user_id===d.user_id);
if(conflicts(items,ticket.legs)||conflicts(abs,ticket.legs))continue;
const total=items.reduce((n,x)=>n+Math.max(0,(toMin(x.end)||0)-(toMin(x.start)||0)),0);
const ticketMin=ticket.legs.reduce((n,x)=>n+Math.max(0,(toMin(x.end)||0)-(toMin(x.start)||0)),0);
candidates.push({driver:d,score:Math.abs((d.weekly_contract_minutes||2100)/5-total-ticketMin)});
}
candidates.sort((a,b)=>a.score-b.score);
if(!candidates.length)throw Error('Aucun conducteur disponible sans conflit horaire');
const d=candidates[0].driver;
if(!confirm('Conducteur suggéré : '+(d.display_name||d.user_id)+'.\nPlacement en BROUILLON seulement. Distances HLP, retour et conformité RSE à vérifier. Confirmer ?'))return;
q('v187Driver').value=d.user_id;q('v187Driver').dispatchEvent(new Event('change',{bubbles:true}));await plan().loadDay();
plan().appendCollective(ticket.legs.map((leg,i)=>({id:'collective-'+ticket.id+'-'+state.date+'-'+i,date:state.date,type:'other',source:'collective',label:'Billet collectif '+ticket.reference,
start:leg.start,end:leg.end,origin:leg.origin,destination:leg.destination,notes:'Suggestion automatique. Contrôler HLP et RSE',collective_id:ticket.id,passengers:ticket.passengers,vehicle_type:ticket.vehicle_type})));
alert('Suggestion placée dans le brouillon. Enregistrer puis contrôler la faisabilité.');
}
function install(){const root=q('v189Root');if(!root||root.dataset.v192)return;root.dataset.v192='1';
const list=q('v189List');
const inject=()=>{for(const b of list.querySelectorAll('[data-assign]')){if(b.parentElement.querySelector('[data-smart="'+b.dataset.assign+'"]'))continue;const button=document.createElement('button');button.textContent='✨ Placement assisté';button.type='button';button.dataset.smart=b.dataset.assign;b.after(button)}};
const observer=new MutationObserver(inject);observer.observe(list,{childList:true});inject();
list.addEventListener('click',e=>{const b=e.target.closest('[data-smart]');if(b)suggest(b.dataset.smart).catch(err=>alert(err.message))});
}
window.MonSAEIVCollectiveSmartV192={installed:true,install,suggest};setInterval(install,1500);
})();