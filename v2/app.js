/* Mon SAEIV 2.0 — prototype pédagogique, sans serveur ni données opérationnelles */
'use strict';
(function () {
  const STORAGE = 'monsaeiv-v2-demo-v1';
  const DRIVERS = [
    {id:'manu', name:'Manu', number:'C-001'},
    {id:'alex', name:'Alex', number:'C-002'},
    {id:'samira', name:'Samira', number:'C-003'}
  ];
  const VEHICLES = ['Crossway 312','Crossway 417','Territo 204'];
  const TRIPS = [
    {line:'026', dest:'Metz', from:'Château-Salins', times:['06:25','06:40','07:05','07:40'],
     stops:['Château-Salins — Gare routière','Delme — Centre','Solgne — Place','Metz — Gare routière']},
    {line:'143', dest:'Sarrebourg', from:'Château-Salins', times:['08:10','08:55','09:40','10:35'],
     stops:['Château-Salins — Gare routière','Dieuze — Centre','Bénestroff','Sarrebourg — Gare routière']},
    {line:'160', dest:'Château-Salins', from:'Dieuze', times:['12:00','12:35','13:20','14:10'],
     stops:['Dieuze — Centre','Val-de-Bride','Morhange','Château-Salins — Gare routière']}
  ];
  const today = new Date();
  const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const fromIso = x => {const a=x.split('-').map(Number);return new Date(a[0],a[1]-1,a[2]);};
  const monday = new Date(today.getFullYear(),today.getMonth(),today.getDate());
  monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  function dateAt(day) {const d = new Date(monday);d.setDate(monday.getDate()+day);return iso(d);}
  const labels = {course:'Course',hlp:'HLP',pause:'Coupure',service:'Service'};
  const icons = {dashboard:'◈',route:'◎',tickets:'▤',incidents:'⚑',planning:'▦',week:'▧',fleet:'▣',settings:'⚙'};
  const menus = {
    driver:[['dashboard','Vue conducteur'],['route','Parcours & arrêts'],['tickets','Caisse & TAD'],['incidents','Incidents']],
    ops:[['planning','Planning journalier'],['week','Semainier'],['fleet','Véhicules'],['settings','Paramètres']]
  };
  const base = [
    ['manu','06:25','07:40','course','026 · Château-Salins → Metz','Crossway 312'],
    ['manu','07:40','08:05','hlp','HLP · Retour dépôt','Crossway 312'],
    ['manu','08:10','10:35','course','143 · Château-Salins → Sarrebourg','Crossway 312'],
    ['manu','10:35','12:00','pause','Coupure',''],
    ['manu','12:00','14:10','course','160 · Dieuze → Château-Salins','Crossway 312'],
    ['alex','07:05','09:15','course','084 · Château-Salins → Nancy','Crossway 417'],
    ['alex','09:15','09:35','hlp','HLP · Mise en place','Crossway 417'],
    ['alex','11:45','14:20','course','166 · Nancy → Château-Salins','Crossway 417'],
    ['samira','06:50','09:40','course','156 · Morhange → Metz','Territo 204'],
    ['samira','09:40','10:10','pause','Pause',''],
    ['samira','10:10','12:25','course','155 · Metz → Morhange','Territo 204']
  ];
  function seeded(){
    const out=[];
    for(let i=0;i<5;i++){
      base.forEach((b,j)=>out.push({id:'demo-'+i+'-'+j,date:dateAt(i),driver:b[0],start:b[1],end:b[2],type:b[3],label:b[4],vehicle:b[5]}));
    }
    return out;
  }
  let data;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE)||'null');
    data = saved && Array.isArray(saved.activities) ? saved : null;
  } catch(e){ data = null; }
  if(!data) data={activities:seeded(),incidents:[],tickets:0};
  const state={role:'driver',view:'dashboard',day:iso(today),trip:0,stop:0,board:0,alight:0,tad:[],weekDriver:'manu'};
  const content=document.querySelector('#content');
  const nav=document.querySelector('#navigation');
  const byId=id=>document.getElementById(id);
  const html=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mins=s=>{const a=s.split(':');return Number(a[0])*60+Number(a[1]);};
  const duration=a=>Math.max(0,mins(a.end)-mins(a.start));
  const hourText=n=>Math.floor(n/60)+' h '+String(n%60).padStart(2,'0');
  const frDate=x=>fromIso(x).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  const range=a=>a.start+'–'+a.end;
  const driverName=id=>(DRIVERS.find(d=>d.id===id)||{}).name || id;
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){}}
  function activities(day,driver){
    return data.activities.filter(a=>a.date===day&&(!driver||a.driver===driver)).sort((a,b)=>mins(a.start)-mins(b.start));
  }
  function stats(list){
    const ordered=list.slice().sort((a,b)=>mins(a.start)-mins(b.start));
    if(!ordered.length)return {work:0,span:0,overlaps:[],long:false};
    const overlaps=[];
    for(let i=1;i<ordered.length;i++){
      if(mins(ordered[i].start)<mins(ordered[i-1].end))overlaps.push(ordered[i-1].label+' / '+ordered[i].label);
    }
    const span=Math.max(...ordered.map(a=>mins(a.end)))-Math.min(...ordered.map(a=>mins(a.start)));
    return {work:ordered.reduce((s,a)=>s+(a.type==='pause'?0:duration(a)),0),span,overlaps,long:span>13*60};
  }
  function warningList(day){
    const result=[];
    DRIVERS.forEach(d=>{
      const s=stats(activities(day,d.id));
      s.overlaps.forEach(pair=>result.push('Chevauchement pour '+d.name+' : '+pair));
      if(s.long)result.push('Amplitude de '+hourText(s.span)+' pour '+d.name+' : contrôle RSE nécessaire selon le régime applicable.');
    });
    return result;
  }
  function panel(title,body,extra){return '<section class="card '+(extra||'')+'"><h2 style="font-size:16px;margin:0 0 15px">'+title+'</h2>'+body+'</section>';}
  function button(label,act,cls,attr){return '<button type="button" class="btn '+(cls||'')+'" data-action="'+act+'" '+(attr||'')+'>'+label+'</button>';}
  function renderNav(){
    byId('roleDriver').classList.toggle('active',state.role==='driver');
    byId('roleOps').classList.toggle('active',state.role==='ops');
    byId('roleDriver').setAttribute('aria-pressed',String(state.role==='driver'));
    byId('roleOps').setAttribute('aria-pressed',String(state.role==='ops'));
    nav.innerHTML=menus[state.role].map(pair=>'<button class="nav-link '+(state.view===pair[0]?'active':'')+'" data-view="'+pair[0]+'" type="button">'+icons[pair[0]]+' <span>'+pair[1]+'</span></button>').join('');
    byId('breadcrumb').textContent=state.role==='driver'?'CONDUCTEUR':'EXPLOITATION';
    byId('datePill').textContent=frDate(state.day);
    byId('pageTitle').textContent=menus[state.role].find(v=>v[0]===state.view)?.[1]||'Mon SAEIV';
  }
  function render(){
    renderNav();
    const views={dashboard:driverDashboard,route:driverRoute,tickets:driverTickets,incidents:driverIncidents,
      planning:opsPlanning,week:opsWeek,fleet:opsFleet,settings:opsSettings};
    content.innerHTML=views[state.view]();
  }
  function statCard(label,value,detail){return '<article class="card"><span class="eyebrow">'+label+'</span><strong class="stat-value">'+value+'</strong><div class="stat-detail">'+detail+'</div></article>';}
  function tripSelect(){
    return '<div class="field"><label>Course de démonstration<select id="tripSelect" data-change="trip">'+
      TRIPS.map((t,i)=>'<option value="'+i+'" '+(state.trip===i?'selected':'')+'>'+html(t.line+' · '+t.from+' → '+t.dest)+'</option>').join('')+
      '</select></label></div>';
  }
  function routeCard(){
    const t=TRIPS[state.trip], n=state.stop, done=n>=t.stops.length-1;
    return '<section class="card"><div class="section-head" style="margin:0 0 12px"><h2>Suivi de parcours</h2><span class="status-tag warn">SIMULATION</span></div>'+
      tripSelect()+'<div class="fine-print" style="margin-top:18px">ARRÊT ACTUEL</div><div class="stop-current">'+html(t.stops[n])+'</div>'+
      '<div class="fine-print">PROCHAIN ARRÊT</div><div class="stop-next">'+(done?'Terminus atteint':html(t.stops[n+1]))+'</div>'+
      '<div class="progress"><span style="width:'+(100*n/(t.stops.length-1))+'%"></span></div>'+
      '<p class="fine-print">Annonce préparée : '+(done?'« Terminus, '+html(t.stops[n])+'. »':'« Prochain arrêt, '+html(t.stops[n+1])+'. »')+'</p>'+
      '<div class="btn-row">'+button('← Précédent','prevStop','muted',n===0?'disabled':'')+
      button(done?'Terminus':'Arrêt suivant →','nextStop','accent',done?'disabled':'')+
      button('Recaler au départ','resetStop','muted')+'</div>'+
      '<p class="fine-print">Voix identique Android/iPhone : à connecter au serveur audio ultérieurement.</p></section>';
  }
  function scheduleBlock(){
    const s=activities(state.day,'manu');
    return '<div class="timeline">'+(s.length?s.map(a=>
      '<div class="timeline-entry"><div class="timeline-hour">'+range(a)+'</div><span class="type-dot '+a.type+'"></span><div class="timeline-item"><strong>'+html(a.label)+'</strong><small>'+labels[a.type]+' • '+html(a.vehicle||'Sans véhicule')+'</small></div></div>').join(''):'<p class="fine-print">Aucun service pour cette date.</p>')+'</div>';
  }
  function driverDashboard(){
    const s=stats(activities(state.day,'manu'));const t=TRIPS[state.trip];
    return '<div class="hero card"><div><span class="route-pill">LIGNE '+html(t.line)+'</span><h2>Bonjour, Manu 👋</h2><p>Votre espace conducteur • parcours fictifs de démonstration</p></div><div class="hero-route"><small>DESTINATION</small><strong>'+html(t.dest)+'</strong><small>Départ '+t.times[0]+'</small></div></div>'+
      '<div class="grid cols-3" style="margin-top:16px">'+statCard('Amplitude planifiée',hourText(s.span),'Inclut les coupures et temps intermédiaires')+
      statCard('Temps d’activités hors coupures',hourText(s.work),'Calcul indicatif de la maquette')+
      statCard('Voyageurs / à bord',String(state.board-state.alight),'Entrées '+state.board+' • sorties '+state.alight)+'</div>'+
      '<div class="grid cols-2" style="margin-top:16px">'+routeCard()+panel('Mon service du jour',scheduleBlock())+'</div>';
  }
  function driverRoute(){
    const t=TRIPS[state.trip];
    return '<div class="grid cols-2">'+routeCard()+panel('Thermomètre de ligne',
      '<div class="stop-list">'+t.stops.map((stop,i)=>
      '<div class="stop-item '+(i===state.stop?'active':i<state.stop?'done':'')+'"><span>'+String(i+1).padStart(2,'0')+' <strong>'+html(stop)+'</strong></span><span>'+t.times[i]+' '+(i===state.stop?'●':i<state.stop?'✓':'')+'</span></div>').join('')+'</div>')+'</div>';
  }
  function driverTickets(){
    const a=state.board-state.alight;
    return '<div class="grid cols-3">'+statCard('Ventes saisies',String(data.tickets),'Simulation locale, aucune émission de titre')+
       statCard('Montées',String(state.board),'Décompte du véhicule de démonstration')+
       statCard('À bord',String(a),'Descentes '+state.alight)+'</div>'+
       '<div class="grid cols-2" style="margin-top:16px">'+panel('Compteur voyageurs',
       '<div class="counter-wrap"><div class="counter"><span>Montées</span><b>'+state.board+'</b><div class="counter-actions">'+button('−','boardDown','muted')+button('+','boardUp','accent')+'</div></div>'+
       '<div class="counter"><span>Descentes</span><b>'+state.alight+'</b><div class="counter-actions">'+button('−','alightDown','muted')+button('+','alightUp','accent')+'</div></div></div>')+
       panel('Billetterie — brouillon',
       '<p class="fine-print">Pour tester le parcours, une vente fictive peut être enregistrée localement. Aucun paiement ni titre réel n’est généré.</p>'+
       button('Enregistrer une vente fictive','sellTicket','accent'))+'</div>'+
       '<div class="section-head"><h2>Transport à la demande (TAD)</h2></div>'+
       panel('Arrêts demandés',TRIPS[state.trip].stops.map((s,i)=>
       '<label class="checkbox-line"><input type="checkbox" data-tad="'+i+'" '+(state.tad.includes(i)?'checked':'')+'>'+html(s)+'</label>').join('')+
       '<p class="fine-print">Simulation des demandes de desserte. Le calcul d’itinéraire sera relié aux données officielles dans une version ultérieure.</p>');
  }
  function driverIncidents(){
    return '<div class="grid cols-2">'+panel('Signaler un incident',
      '<div class="incident"><label for="incidentText" class="fine-print">Note de service (démonstration)</label>'+
      '<textarea id="incidentText" maxlength="600" placeholder="Décrivez votre incident..."></textarea>'+
      button('Enregistrer la note','saveIncident','accent')+'</div><p class="fine-print">Cette note reste sur ce navigateur. Aucune transmission à l’exploitation.</p>')+
      panel('Notes enregistrées',data.incidents.length?'<div class="timeline">'+data.incidents.slice().reverse().map(x=>
      '<div class="timeline-entry"><div class="timeline-item"><small>'+html(x.when)+'</small><strong>'+html(x.message)+'</strong></div></div>').join('')+'</div>':'<div class="empty">Aucune note enregistrée</div>')+'</div>';
  }
  function dayControls(){
    return '<div class="field"><label>Journée<input aria-label="Journée" type="date" id="dayInput" data-change="day" value="'+state.day+'"></label>'+
    button('◀ Jour précédent','previousDay','muted small')+button('Jour suivant ▶','followingDay','muted small')+'</div>';
  }
  function dayTable(){
    const rows=DRIVERS.map(d=>{
      const list=activities(state.day,d.id),s=stats(list);
      return '<tr><td class="driver-name">'+d.name+'<div class="fine-print">'+d.number+'</div></td>'+
       '<td>'+ (list.length?list.map(a=>'<span class="chip '+a.type+'" title="'+html(range(a))+'">'+
       html(range(a)+' '+a.label)+'</span>').join(''):'<span class="fine-print">Non affecté</span>')+'</td>'+
       '<td>'+hourText(s.work)+'</td><td>'+hourText(s.span)+'</td>'+
       '<td>'+(s.overlaps.length?'<span class="status-tag bad">Chevauchement</span>':s.long?'<span class="status-tag warn">À vérifier</span>':'<span class="status-tag good">Sans conflit détecté</span>')+'</td></tr>';
    }).join('');
    return '<div class="table-scroll"><table class="planning-table"><thead><tr><th>Conducteur</th><th>Services, courses, HLP et coupures (ordre chronologique)</th><th>Activités *</th><th>Amplitude</th><th>Contrôle</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function validations(day){
    const w=warningList(day);
    return '<div class="validation">'+(w.length?w.map(s=>'<div class="validation-row">⚠ '+html(s)+'</div>').join(''):
      '<div class="validation-row ok">✓ Aucun chevauchement ou dépassement du seuil indicatif détecté.</div>')+
      '<p class="fine-print">* Décompte simplifié à but d’interface : ne constitue ni un calcul de paie ni une validation réglementaire. Les repos, RSE, pauses, travail effectif et régimes applicables nécessitent un moteur métier vérifié.</p></div>';
  }
  function opsPlanning(){
    const all=activities(state.day),n=all.filter(a=>a.type==='course').length;
    return '<div class="section-head" style="margin-top:0"><div><h2>Vue globale • '+html(frDate(state.day))+'</h2><p>Plusieurs activités et lignes par conducteur</p></div>'+dayControls()+'</div>'+
    '<div class="grid cols-3">'+statCard('Conducteurs affectés',String(new Set(all.map(a=>a.driver)).size),'Sur '+DRIVERS.length+' profils de démonstration')+
    statCard('Courses voyageurs',String(n),'HLP et coupures distincts')+
    statCard('Points de vigilance',String(warningList(state.day).length),'Contrôles partiels uniquement')+'</div>'+
    '<div class="section-head"><div><h2>Tableau des services</h2><p>Édition d’un brouillon enregistré sur cet appareil</p></div>'+
    '<div class="btn-row">'+button('+ Ajouter une activité','newActivity','accent')+button('Exporter CSV','exportCsv','muted')+button('Imprimer','print','muted')+'</div></div>'+
    dayTable()+'<div class="section-head"><h2>Vérifications du planning</h2></div>'+validations(state.day)+
    '<div class="section-head"><h2>Publication</h2></div>'+
    panel('Brouillon local — non publié','<p class="fine-print">La publication aux conducteurs sera activée après création du serveur, de l’authentification et des contrôles réglementaires.</p>'+
    '<button type="button" class="btn" disabled>Publier aux conducteurs (non connecté)</button>');
  }
  function opsWeek(){
    const dates=Array.from({length:7},(_,i)=>dateAt(i));
    return '<div class="section-head" style="margin-top:0"><div><h2>Semainier d’exploitation</h2><p>Semaine du '+html(frDate(dates[0]))+'</p></div>'+
    '<div class="field"><label>Conducteur<select id="weekDriver" data-change="weekDriver">'+
    DRIVERS.map(d=>'<option value="'+d.id+'" '+(state.weekDriver===d.id?'selected':'')+'>'+d.name+'</option>').join('')+
    '</select></label></div></div>'+
    '<div class="grid cols-2">'+dates.map(day=>{
      const list=activities(day,state.weekDriver),s=stats(list);
      return '<section class="card"><div class="section-head" style="margin-top:0"><h2>'+html(frDate(day))+'</h2><span class="status-tag '+(s.overlaps.length?'bad':s.long?'warn':'muted')+'">'+hourText(s.span)+' amplitude</span></div>'+
      (list.length?'<div class="timeline">'+list.map(a=>
      '<div class="timeline-entry"><span class="timeline-hour">'+range(a)+'</span><span class="type-dot '+a.type+'"></span><span class="timeline-item"><strong>'+html(a.label)+'</strong><small>'+labels[a.type]+'</small></span></div>').join('')+'</div>':'<div class="empty">Repos / aucune affectation</div>')+
      '</section>';
    }).join('')+'</div><p class="fine-print">Vérification du repos entre journées et gestion des services franchissant minuit à développer dans le moteur de planning.</p>';
  }
  function opsFleet(){
    return '<div class="grid cols-3">'+VEHICLES.map((v,i)=>panel(html(v),
      '<p class="fine-print">Véhicule fictif pour la maquette.</p><span class="status-tag muted">Disponibilité non synchronisée</span>')).join('')+
      '</div><div class="section-head"><h2>Attribution des véhicules</h2></div>'+
      panel('Prochaine étape','<p>La gestion des affectations véhicules, indisponibilités, places, équipements, girouettes et conflits sera reliée aux services conducteur lors du raccordement serveur.</p>');
  }
  function opsSettings(){
    return '<div class="grid cols-2">'+
    panel('Accès et profils','<p>Compte d’exploitation cible : <strong>Anthony</strong>.</p><p class="fine-print">Ce prototype utilise uniquement un changement de rôle de démonstration. Il n’y a pas de vraie connexion, aucun mot de passe ni protection des données.</p>')+
    panel('Architecture prévue','<div class="timeline"><div class="timeline-entry">GitHub : code et historique</div><div class="timeline-entry">Serveur Ubuntu personnel : API, base et calculs</div><div class="timeline-entry">Audio serveur : voix identiques sur les appareils</div><div class="timeline-entry">GTFS : courses exactes, variantes et tracés</div></div>')+
    panel('Réglementation et planning','<p class="fine-print">Moteur à construire avec règles configurables selon les textes, conventions, accords et dérogations pertinents. Aucune amplitude maximale universelle ni durée minimale de repos n’est présumée ici.</p>')+
    panel('Données de démonstration','<p class="fine-print">Les modifications sont enregistrées uniquement dans ce navigateur. Réinitialiser efface le brouillon et les notes locales de la maquette.</p>'+button('Réinitialiser la démonstration','resetDemo','danger'))+'</div>';
  }
  function csvCell(s){return '"'+String(s).replace(/"/g,'""')+'"';}
  function exportCsv(){
    const rows=[['Date','Conducteur','Début','Fin','Type','Désignation','Véhicule']];
    activities(state.day).forEach(a=>rows.push([a.date,driverName(a.driver),a.start,a.end,labels[a.type],a.label,a.vehicle]));
    const csv='\ufeff'+rows.map(a=>a.map(csvCell).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='MonSAEIV2-planning-'+state.day+'.csv';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function newActivity(){
    byId('driverSelect').innerHTML=DRIVERS.map(d=>'<option value="'+d.id+'">'+d.name+'</option>').join('');
    byId('activityForm').reset();byId('formError').hidden=true;byId('activityDialog').showModal();
  }
  function action(act){
    if(act==='nextStop')state.stop=Math.min(TRIPS[state.trip].stops.length-1,state.stop+1);
    if(act==='prevStop')state.stop=Math.max(0,state.stop-1);
    if(act==='resetStop')state.stop=0;
    if(act==='boardUp')state.board++;
    if(act==='boardDown')state.board=Math.max(state.alight,state.board-1);
    if(act==='alightUp')state.alight=Math.min(state.board,state.alight+1);
    if(act==='alightDown')state.alight=Math.max(0,state.alight-1);
    if(act==='sellTicket'){data.tickets++;save();}
    if(act==='previousDay'){const d=fromIso(state.day);d.setDate(d.getDate()-1);state.day=iso(d);}
    if(act==='followingDay'){const d=fromIso(state.day);d.setDate(d.getDate()+1);state.day=iso(d);}
    if(act==='newActivity'){newActivity();return;}
    if(act==='saveIncident'){
      const value=byId('incidentText').value.trim();
      if(!value){alert('Saisissez une description.');return;}
      data.incidents.push({when:new Date().toLocaleString('fr-FR'),message:value});save();
    }
    if(act==='resetDemo'){
      if(!confirm('Réinitialiser toutes les données de démonstration locales ?'))return;
      data={activities:seeded(),incidents:[],tickets:0};save();
    }
    if(act==='exportCsv'){exportCsv();return;}
    if(act==='print'){window.print();return;}
    render();
  }
  document.addEventListener('click',e=>{
    const view=e.target.closest('[data-view]');
    if(view){state.view=view.dataset.view;render();return;}
    const target=e.target.closest('[data-action]');
    if(target && !target.disabled)action(target.dataset.action);
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.change==='trip'){state.trip=Number(el.value);state.stop=0;state.tad=[];render();}
    if(el.dataset.change==='day'){state.day=el.value;render();}
    if(el.dataset.change==='weekDriver'){state.weekDriver=el.value;render();}
    if(el.dataset.tad!==undefined){
      const num=Number(el.dataset.tad);
      state.tad=el.checked?[...new Set([...state.tad,num])]:state.tad.filter(x=>x!==num);
    }
  });
  byId('roleDriver').addEventListener('click',()=>{state.role='driver';state.view='dashboard';render();});
  byId('roleOps').addEventListener('click',()=>{state.role='ops';state.view='planning';render();});
  byId('closeDialog').addEventListener('click',()=>byId('activityDialog').close());
  byId('cancelDialog').addEventListener('click',()=>byId('activityDialog').close());
  byId('activityForm').addEventListener('submit',e=>{
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const start=String(form.get('start')), end=String(form.get('end'));
    const label=String(form.get('label')||'').trim();
    if(mins(end)<=mins(start)||!label){
      const error=byId('formError');error.hidden=false;
      error.textContent='Cette première maquette accepte uniquement des activités sur une même journée, avec une heure de fin postérieure au début.';
      return;
    }
    data.activities.push({id:'added-'+Date.now(),date:state.day,driver:String(form.get('driver')),
      type:String(form.get('type')),start,end,label,vehicle:String(form.get('vehicle')||'').trim()});
    save();byId('activityDialog').close();render();
  });
  render();
})();
