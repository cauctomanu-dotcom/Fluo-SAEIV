'use strict';
/* SAEIV 1.0.104: render the temporary company/crew data where dispatchers need it. */
(()=>{
 if(window.MonSAEIVHolidayCrewV201?.installed)return;
 const q=id=>document.getElementById(id);
 const board=()=>window.MonSAEIVOperationsBoardV165,cloud=()=>window.MonSAEIVCloudV156;
 let lastCount=null,loading=false;
 async function install(){
  const b=board(),root=q('v165Board');
  if(root&&b){
   let label=q('v201OperatorLabel');
   if(!label){label=document.createElement('p');label.id='v201OperatorLabel';label.style.cssText='padding:7px 10px;margin:7px 0;background:#103b4d;border:1px solid #5795a5;border-radius:8px;color:#e7f8ff;font-weight:750';root.prepend(label)}
   label.textContent=b.currentOperator?'🏢 '+b.currentOperator+' · Toussaint 2026 · '+b.drivers.length+' conducteurs tests affectés. Les autres comptes restent disponibles hors de cette période.':'Périmètre de la journée : conducteurs de la société pilote (hors groupe Toussaint).';
  }
  const panel=q('v186Admin'),client=cloud()?.client,org=cloud()?.profile?.organization_id;
  if(!panel||!client||!org||cloud()?.profile?.role!=='admin'||loading)return;
  let section=q('v201CrewBox');
  if(!section){
   section=document.createElement('section');section.id='v201CrewBox';
   section.innerHTML='<h3>👥 René Antoni · équipe Toussaint 2026</h3><p id="v201CrewCount">Chargement des 27 conducteurs tests…</p><div id="v201CrewList"></div><small>Périmètre de simulation : du 17 octobre au 1er novembre. Aucun compte conducteur déplacé, aucun brouillon supprimé.</small>';
   panel.append(section);
  }
  if(lastCount!==null)return;
  loading=true;
  try{
   const [members,profiles]=await Promise.all([
    client.from('saeiv_operator_driver_memberships').select('driver_user_id').eq('organization_id',org).eq('operator_name','René Antoni').eq('valid_from','2026-10-17'),
    client.from('profiles').select('user_id,display_name,matricule').eq('organization_id',org).eq('role','driver')
   ]);
   if(members.error)throw members.error;if(profiles.error)throw profiles.error;
   const crew=new Set((members.data||[]).map(x=>x.driver_user_id));
   const people=(profiles.data||[]).filter(x=>crew.has(x.user_id));
   lastCount=people.length;
   q('v201CrewCount').textContent='✅ '+people.length+' conducteurs de démonstration rattachés au groupe René Antoni, sur 100 comptes tests. Les lignes Fluo de la société sont enregistrées pour la période.';
   const list=document.createElement('div');list.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:6px 0';
   for(const p of people){const span=document.createElement('span');span.style.cssText='background:#163e4d;padding:4px 8px;border-radius:7px;font-size:.69rem';span.textContent=p.display_name||p.matricule||'Conducteur';list.append(span)}
   q('v201CrewList').replaceChildren(list);
  }catch(e){q('v201CrewCount').textContent='Impossible de charger le groupe : '+(e.message||String(e))}
  finally{loading=false}
 }
 window.addEventListener('saeiv-board-updated',install);
 setInterval(install,1800);
 window.MonSAEIVHolidayCrewV201={installed:true,install};
})();