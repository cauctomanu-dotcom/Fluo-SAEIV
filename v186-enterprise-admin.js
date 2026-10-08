'use strict';
/* Mon SAEIV 1.0.92 — company, depot, operated lines, vehicles and drivers */
(()=>{
 if(window.MonSAEIVEnterpriseV186?.installed)return;
 const q=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cloud=()=>window.MonSAEIVCloudV156,client=()=>cloud()?.client,profile=()=>cloud()?.profile,org=()=>profile()?.organization_id;
 const value=id=>q(id)?.value?.trim()||'', A={depots:[],lines:[],drivers:[],rules:[],selected:null,loading:false};
 const notify=(message,error=false)=>{const e=q('v186Status');if(e){e.textContent=message;e.style.color=error?'#ffb5ad':'#baffd2'}};
 const fail=e=>notify(e.message||String(e),true);
 const field=(id,name,type='text')=>'<label>'+esc(name)+'<input id="'+id+'" type="'+type+'"></label>';
 async function query(table,columns='*'){const {data,error}=await client().from(table).select(columns).eq('organization_id',org());if(error)throw error;return data||[]}
 async function mutate(table,row,id){let x=client().from(table);const {error}=id?await x.update(row).eq('id',id).eq('organization_id',org()):await x.insert({...row,organization_id:org()});if(error)throw error}
 function install(){
  if(q('v186Admin')||profile()?.role!=='admin'||!client()||!q('v157AdminView'))return;
  const css=document.createElement('style');css.textContent='#v186Admin{background:#0a2030;border:1px solid #456a83;padding:12px;margin:12px 0;border-radius:16px;color:#edf8ff}#v186Admin .fields{display:flex;flex-wrap:wrap;gap:8px;align-items:end}#v186Admin label{display:grid;gap:5px;flex:1;min-width:130px;font-size:.75rem}#v186Admin input,#v186Admin select,#v186Admin textarea{background:#081622;border:1px solid #587485;padding:9px;color:#fff;border-radius:9px;width:100%;min-height:40px}#v186Admin button{padding:9px;min-height:38px}#v186Admin section{border-top:1px solid #34576c;margin-top:15px;padding-top:12px}#v186Admin .entry{display:flex;justify-content:space-between;gap:10px;padding:7px;border-bottom:1px solid #34566a}#v186Admin table{border-collapse:collapse;width:100%}#v186Admin td,#v186Admin th{border-bottom:1px solid #385365;padding:6px}#v186Admin .scroll{overflow:auto}';
  document.head.appendChild(css);
  const el=document.createElement('div');el.id='v186Admin';
  el.innerHTML='<h2>🏢 Entreprise et exploitation</h2><p>Administration multi-dépôts · lignes Fluo 54/57 · contrats et véhicules</p><div id="v186Status" role="status"></div>'+
   '<section><h3>Entreprise</h3><div class="fields">'+field('v186OrgName','Nom')+field('v186OrgCode','Code / sigle')+field('v186OrgEmail','Contact email')+field('v186OrgPhone','Téléphone')+'</div><label>Description<textarea id="v186OrgDescription"></textarea></label><label><input id="v186OrgActive" type="checkbox"> Active</label><button id="v186SaveOrg">Enregistrer entreprise</button></section>'+
   '<section><h3>Dépôts</h3><div class="fields">'+field('v186DepotName','Nom')+field('v186DepotCode','Code')+field('v186DepotAddress','Adresse')+field('v186DepotLat','Latitude','number')+field('v186DepotLon','Longitude','number')+'<button id="v186AddDepot">Ajouter</button></div><div id="v186Depots"></div></section>'+
   '<section><h3>Lignes exploitées</h3><div class="fields">'+field('v186LineCode','Ligne')+'<label>Département<select id="v186LineDept"><option>54</option><option>57</option><option>67</option><option>68</option></select></label>'+field('v186LineStart','Début','date')+field('v186LineEnd','Fin','date')+'<button id="v186AddLine">Ajouter</button></div><div id="v186Lines"></div></section>'+
   '<section><h3>Règles de véhicules</h3><div id="v186Vehicles" class="scroll"></div></section>'+
   '<section><h3>Contrat et fiche conducteur</h3><div class="fields"><label>Conducteur<select id="v186DriverPick"></select></label><button id="v186DriverLoad">Charger</button></div><div class="fields">'+field('v186First','Prénom')+field('v186Last','Nom')+field('v186Matricule','Matricule')+'<button id="v186AutoMatricule">Générer matricule</button></div><div class="fields"><label>Dépôt principal<select id="v186DriverDepot"></select></label><label>Contrat<select id="v186Contract"><option value="">—</option><option>CDD</option><option>CDI</option><option>Intérim</option><option>Temps partiel</option><option>Autre</option></select></label>'+field('v186Hours','Heures/semaine','number')+'<label><input id="v186DriverActive" type="checkbox"> Actif</label></div><label>Lignes connues<textarea id="v186LinesKnown" placeholder="54:4464, 57:57R026…"></textarea></label><button id="v186DriverSave">Enregistrer conducteur</button></section>';
  q('v157AdminView').appendChild(el);
  const handlers={v186SaveOrg:saveOrg,v186AddDepot:addDepot,v186AddLine:addLine,v186DriverLoad:showDriver,v186AutoMatricule:autoMatricule,v186DriverSave:saveDriver};
  el.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
   const fn=handlers[b.id];if(fn)fn().catch(fail);
   if(b.dataset.depot)editDepot(b.dataset.depot).catch(fail);
   if(b.dataset.line)toggleLine(b.dataset.line).catch(fail);
   if(b.dataset.link)linkDepots(b.dataset.link).catch(fail);
  });
  el.addEventListener('change',event=>{const target=event.target;
   if(target.id==='v186DriverPick')showDriver().catch(fail);
   if(target.dataset.vehicle)saveVehicle(target).catch(fail);
  });load().catch(fail);
 }
 async function load(){
  if(!q('v186Admin')||A.loading)return;A.loading=true;
  try{
   const {data:o,error}=await client().from('organizations').select('*').eq('id',org()).single();if(error)throw error;
   for(const [id,key] of [['v186OrgName','name'],['v186OrgCode','code'],['v186OrgEmail','contact_email'],['v186OrgPhone','contact_phone'],['v186OrgDescription','description']])q(id).value=o[key]||'';
   q('v186OrgActive').checked=o.active!==false;
   [A.depots,A.lines,A.drivers,A.rules]=await Promise.all([
     query('depots'),query('saeiv_company_lines'),
     client().from('profiles').select('user_id,organization_id,depot_id,matricule,display_name,role,active,first_name,last_name,contract_type,weekly_contract_minutes').eq('organization_id',org()).eq('role','driver').then(({data,error})=>{if(error)throw error;return data||[]}),
     query('saeiv_vehicle_rules')]);
   render();notify('Données synchronisées');
  }finally{A.loading=false}
 }
 function render(){
  q('v186Depots').innerHTML=A.depots.map(d=>'<div class="entry">'+esc(d.name)+' ('+esc(d.code)+') '+(d.active?'Actif':'Inactif')+'<button data-depot="'+esc(d.id)+'">Modifier</button></div>').join('')||'<p>Aucun dépôt</p>';
  q('v186Lines').innerHTML=A.lines.map(d=>'<div class="entry">'+esc(d.department)+' · '+esc(d.line_code)+' · '+esc(d.start_date)+' → '+esc(d.end_date||'en cours')+'<span><button data-link="'+esc(d.id)+'">Dépôts</button> <button data-line="'+esc(d.id)+'">'+(d.active?'Désactiver':'Réactiver')+'</button></span></div>').join('')||'<p>Aucune ligne rattachée</p>';
  const sel=q('v186DriverPick'),was=sel.value;sel.innerHTML='<option value="">Sélectionner…</option>'+A.drivers.map(d=>'<option value="'+esc(d.user_id)+'">'+esc(d.display_name||d.matricule)+'</option>').join('');if(A.drivers.some(d=>d.user_id===was))sel.value=was;
  q('v186DriverDepot').innerHTML='<option value="">Sans dépôt</option>'+A.depots.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('');
  const types=[['bus','Bus/autocar'],['minibus','Minibus'],['van','Camionnette']],policies=[['required','Obligatoire'],['allowed','Autorisé'],['preferred','À privilégier'],['forbidden','Interdit']];
  q('v186Vehicles').innerHTML='<table><thead><tr><th>Ligne</th>'+types.map(x=>'<th>'+x[1]+'</th>').join('')+'</tr></thead><tbody>'+A.lines.filter(l=>l.active).map(l=>'<tr><th>'+esc(l.department)+' '+esc(l.line_code)+'</th>'+types.map(([t])=>{
   const existing=A.rules.find(x=>x.line_id===l.id&&x.vehicle_type===t),selected=existing?.policy||(t==='bus'?'required':'forbidden');
   return '<td><select data-vehicle="'+esc(t)+'" data-line-id="'+esc(l.id)+'">'+policies.map(([p,label])=>'<option value="'+p+'" '+(p===selected?'selected':'')+'>'+label+'</option>').join('')+'</select></td>';
  }).join('')+'</tr>').join('')+'</tbody></table>';
 }
 async function saveOrg(){
  const {error}=await client().from('organizations').update({name:value('v186OrgName'),code:value('v186OrgCode'),contact_email:value('v186OrgEmail')||null,contact_phone:value('v186OrgPhone')||null,description:value('v186OrgDescription'),active:q('v186OrgActive').checked}).eq('id',org());if(error)throw error;notify('Entreprise enregistrée');
 }
 async function addDepot(){
  if(!value('v186DepotName')||!value('v186DepotCode'))throw Error('Nom et code obligatoires');
  await mutate('depots',{name:value('v186DepotName'),code:value('v186DepotCode').toUpperCase(),address:value('v186DepotAddress')||null,latitude:value('v186DepotLat')?Number(value('v186DepotLat')):null,longitude:value('v186DepotLon')?Number(value('v186DepotLon')):null});await load();
 }
 async function editDepot(id){
  const old=A.depots.find(x=>x.id===id);if(!old)return;
  const name=prompt('Nom dépôt',old.name);if(name===null)return;
  const code=prompt('Code',old.code);if(code===null)return;
  const address=prompt('Adresse',old.address||'');if(address===null)return;
  const active=confirm('Dépôt actif ?');
  await mutate('depots',{name,code:code.toUpperCase(),address,active},id);await load();
 }
 async function addLine(){
  if(!value('v186LineCode'))throw Error('Numéro obligatoire');
  await mutate('saeiv_company_lines',{line_code:value('v186LineCode'),department:value('v186LineDept'),start_date:value('v186LineStart')||new Date().toISOString().slice(0,10),end_date:value('v186LineEnd')||null});await load();
 }
 async function toggleLine(id){const x=A.lines.find(x=>x.id===id);if(!x)return;await mutate('saeiv_company_lines',{active:!x.active,end_date:x.active?new Date().toISOString().slice(0,10):null},id);await load()}
 async function linkDepots(id){
  const {data,error}=await client().from('saeiv_line_depots').select('depot_id').eq('line_id',id);if(error)throw error;
  const current=(data||[]).map(x=>x.depot_id),catalog=A.depots.map((d,i)=>(i+1)+' : '+d.name).join('\n');
  const answer=prompt('Sélectionner les numéros de dépôts séparés par des virgules\n'+catalog,A.depots.map((d,i)=>current.includes(d.id)?i+1:null).filter(Boolean).join(','));if(answer===null)return;
  const next=[...new Set(answer.split(',').map(x=>A.depots[Number(x.trim())-1]?.id).filter(Boolean))];
  const add=next.filter(x=>!current.includes(x)),del=current.filter(x=>!next.includes(x));
  if(add.length){const r=await client().from('saeiv_line_depots').insert(add.map(depot_id=>({organization_id:org(),line_id:id,depot_id})));if(r.error)throw r.error}
  if(del.length){const r=await client().from('saeiv_line_depots').delete().eq('line_id',id).in('depot_id',del);if(r.error)throw r.error}notify('Ligne rattachée aux dépôts');
 }
 async function saveVehicle(el){
  const {error}=await client().from('saeiv_vehicle_rules').upsert({line_id:el.dataset.lineId,organization_id:org(),vehicle_type:el.dataset.vehicle,policy:el.value,updated_at:new Date().toISOString()},{onConflict:'line_id,vehicle_type'});if(error)throw error;notify('Règle véhicule enregistrée');
 }
 async function showDriver(){
  const d=A.drivers.find(x=>x.user_id===value('v186DriverPick'));A.selected=d||null;if(!d)return;
  q('v186First').value=d.first_name||'';q('v186Last').value=d.last_name||'';q('v186Matricule').value=d.matricule||'';
  q('v186DriverDepot').value=d.depot_id||'';q('v186Contract').value=d.contract_type||'';
  q('v186Hours').value=d.weekly_contract_minutes===null?'':d.weekly_contract_minutes/60;q('v186DriverActive').checked=d.active;
  const {data,error}=await client().from('driver_settings').select('known_lines').eq('user_id',d.user_id).maybeSingle();if(error)throw error;
  q('v186LinesKnown').value=(Array.isArray(data?.known_lines)?data.known_lines:[]).map(x=>typeof x==='string'?x:((x?.dept?x.dept+':':'')+(x?.line||x?.short||''))).filter(Boolean).join(', ');
 }
 async function autoMatricule(){
  if(!A.selected||!value('v186DriverDepot'))throw Error('Choisir conducteur et dépôt');
  const {data,error}=await client().rpc('saeiv_next_matricule',{p_depot:value('v186DriverDepot')});if(error)throw error;
  q('v186Matricule').value=data;notify('Matricule réservé : '+data+'. Enregistrer la fiche.');
 }
 async function saveDriver(){
  const d=A.selected;if(!d)throw Error('Choisir un conducteur');
  const h=value('v186Hours'),hours=h===''?null:Number(h);if(hours!==null&&(!Number.isFinite(hours)||hours<0||hours>60))throw Error('Heures invalides');
  const first=value('v186First'),last=value('v186Last');
  const {error}=await client().from('profiles').update({first_name:first||null,last_name:last||null,display_name:(first+' '+last).trim()||d.display_name,
    matricule:value('v186Matricule'),depot_id:value('v186DriverDepot')||null,contract_type:value('v186Contract')||null,
    weekly_contract_minutes:hours===null?null:Math.round(hours*60),active:q('v186DriverActive').checked})
   .eq('user_id',d.user_id).eq('organization_id',org());if(error)throw error;
  const lines=[...new Set(value('v186LinesKnown').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean))].map(x=>{const m=x.match(/^(54|57|67|68)\s*[:|/ -]\s*(.+)$/);return m?{dept:m[1],line:m[2]}:{dept:'57',line:x}});
  const {data:settings,error:se}=await client().from('driver_settings').select('user_id').eq('user_id',d.user_id).maybeSingle();if(se)throw se;
  const r=settings?await client().from('driver_settings').update({known_lines:lines}).eq('user_id',d.user_id):
   await client().from('driver_settings').insert({user_id:d.user_id,organization_id:org(),known_lines:lines});
  if(r.error)throw r.error;await load();q('v186DriverPick').value=d.user_id;notify('Fiche et lignes connues enregistrées');
 }
 window.MonSAEIVEnterpriseV186={installed:true,install,load};
 setInterval(()=>{if(profile()?.role==='admin')install()},1200);
})();