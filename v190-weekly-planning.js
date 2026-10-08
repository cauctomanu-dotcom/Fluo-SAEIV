'use strict';
(()=>{
if(window.MonSAEIVWeeklyV190?.installed)return;
const q=id=>document.getElementById(id);
const d=(iso,offset)=>{const x=new Date(iso+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+offset);return x.toISOString().slice(0,10)};
const monday=iso=>{const n=new Date(iso+'T12:00:00Z').getUTCDay();return d(iso,-((n+6)%7))};
const pl=()=>window.MonSAEIVPlanningV187,cl=()=>window.MonSAEIVCloudV156;
async function render(){
const root=q('v190Week'),state=pl()?.state;if(!root||!state?.driver)return;
const from=monday(q('v190WeekStart')?.value||state.date),to=d(from,6);
q('v190WeekStart').value=from;
const org=cl()?.profile?.organization_id,c=cl()?.client;
const [draft,pub]=await Promise.all([
c.from('saeiv_planning_days').select('service_date,status,items').eq('organization_id',org).eq('driver_user_id',state.driver).gte('service_date',from).lte('service_date',to),
c.from('saeiv_published_days').select('service_date,items,revision').eq('organization_id',org).eq('driver_user_id',state.driver).gte('service_date',from).lte('service_date',to)
]);
if(draft.error)throw draft.error;if(pub.error)throw pub.error;
const drafts=new Map((draft.data||[]).map(x=>[x.service_date,x])),published=new Map((pub.data||[]).map(x=>[x.service_date,x]));
const names=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
root.innerHTML=names.map((day,i)=>{
const date=d(from,i),a=drafts.get(date),b=published.get(date),items=a?.items||b?.items||[];
const mins=items.reduce((n,x)=>{const t=v=>{const m=String(v||'').match(/^(\d\d):(\d\d)/);return m?Number(m[1])*60+Number(m[2]):null},start=t(x.start),end=t(x.end);return n+(start===null||end===null?0:Math.max(0,end-start))},0);
return '<article class="v190day"><button data-open-day="'+date+'"><strong>'+day+' '+date.slice(8)+'</strong></button><small>'+(a?.status|| (b?'publié':'vide'))+'</small><b>'+Math.floor(mins/60)+'h'+String(mins%60).padStart(2,'0')+'</b><p>'+items.slice(0,6).map(x=>String(x.start||'')+' '+String(x.line||x.label||x.type||'')).join(' · ')+'</p></article>';
}).join('');
}
function install(){
if(q('v190Wrapper')||!q('v187Planning'))return;
const style=document.createElement('style');style.textContent='#v190Wrapper{border:1px solid #406779;border-radius:12px;padding:12px;margin:8px 0}#v190Week{display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));gap:6px;overflow-x:auto}#v190Week .v190day{background:#112d40;padding:9px;border:1px solid #31556a;border-radius:10px}#v190Week small,#v190Week b{display:block}#v190Week p{font-size:.65rem}';document.head.append(style);
const wrapper=document.createElement('section');wrapper.id='v190Wrapper';wrapper.innerHTML='<h3>📅 Planification hebdomadaire</h3><p>Vue du lundi au dimanche. Cliquer un jour pour le préparer, valider ou publier indépendamment.</p><label>Début de semaine<input type="date" id="v190WeekStart"></label><button id="v190Prev">◀ Semaine précédente</button><button id="v190Next">Semaine suivante ▶</button><button id="v190Refresh">Actualiser</button><button id="v190GenerateWeek">✨ Créer les brouillons de la semaine</button><div id="v190Week"></div>';
q('v187Planning').insertBefore(wrapper,q('v187Planning').children[2]||null);
q('v190WeekStart').value=monday(pl()?.state?.date||new Date().toISOString().slice(0,10));
for(const [id,offset]of [['v190Prev',-7],['v190Next',7]])q(id).addEventListener('click',()=>{q('v190WeekStart').value=d(q('v190WeekStart').value,offset);render().catch(console.warn)});
q('v190Refresh').addEventListener('click',()=>render().catch(console.warn));
q('v190GenerateWeek').addEventListener('click',async()=>{const btn=q('v190GenerateWeek');if(!confirm('Créer les brouillons des 7 journées sélectionnées ? Aucune publication automatique.'))return;btn.disabled=true;try{await pl().generateWeekDrafts(q('v190WeekStart').value);await render()}catch(e){alert(e.message||e)}finally{btn.disabled=false}});
q('v190WeekStart').addEventListener('change',()=>render().catch(console.warn));
q('v190Week').addEventListener('click',e=>{const b=e.target.closest('[data-open-day]');if(!b)return;q('v187Date').value=b.dataset.openDay;q('v187Date').dispatchEvent(new Event('change',{bubbles:true}));pl().loadDay().catch(console.warn)});
render().catch(console.warn);
}
window.MonSAEIVWeeklyV190={installed:true,install,render,monday};
setInterval(()=>{if(cl()?.profile&&['admin','dispatcher'].includes(cl().profile.role))install()},1100);
})();