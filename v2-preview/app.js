/* Mon SAEIV 2.0 — planning autonome local, conduite Fluo réelle via /secours.html. */
'use strict';
(() => {
  const KEY='monsaeiv-v2-preview-operations-1';
  const types={course:'Course voyageurs',school:'Scolaire',hlp:'Haut-le-pied',pause:'Coupure',other:'Autre activité'};
  const navs={driver:[['home','Accueil'],['driver','Cockpit conducteur'],['mine','Ma feuille de service']],ops:[['home','Tableau de bord'],['planning','Journée globale'],['week','Semainier équipe'],['day','Journée conducteur'],['drivers','Collaborateurs'],['vehicles','Parc véhicules'],['organization','Entreprise & modules'],['backup','Sauvegardes']]};
  const ico={home:'◈',driver:'🚌',mine:'◷',planning:'▦',week:'▧',day:'◷',drivers:'♙',vehicles:'▣',organization:'⚙',backup:'⬇'};
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ymd=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const parseDay=s=>{const t=String(s).split('-').map(Number);return new Date(t[0],t[1]-1,t[2]);};
  const dateText=s=>parseDay(s).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const clock=t=>{const p=t.split(':').map(Number);return p[0]*60+p[1];};
  const isTime=t=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
  const isDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(parseDay(d).getTime());
  const fmt=n=>Math.floor(n/60)+' h '+String(n%60).padStart(2,'0');
  const uid=()=>globalThis.crypto && crypto.randomUUID?crypto.randomUUID():'local-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const empty=()=>({version:1,drivers:[],vehicles:[],activities:[],updatedAt:''});
  let store=empty(),storageError='';
  try {
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved&&saved.version===1&&Array.isArray(saved.drivers)&&Array.isArray(saved.activities)&&Array.isArray(saved.vehicles))store=saved;
  }catch(e){storageError='Lecture du stockage impossible, exporter une sauvegarde dès que possible.';}
  store.settings={name:'Mon entreprise',...store.settings};
  const state={role:'ops',view:'planning',date:ymd(new Date()),driverId:store.drivers[0]?.id||'',
    weekId:store.drivers[0]?.id||'',openDriver:store.drivers[0]?.id||'',filter:'all',
    search:'',depot:'',mode:'timeline',lastWeek:'week'};
  function persist(){
    try{store.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(store));storageError='';}
    catch(e){storageError='Enregistrement local impossible : vérifiez l’espace disponible. Exportez immédiatement vos données.';}
  }
  const namedDriver=id=>store.drivers.find(d=>d.id===id)?.name||'Conducteur supprimé';
  const namedVehicle=id=>store.vehicles.find(v=>v.id===id)?.name||'Sans véhicule';
  const datetime=(date,time,addDay=false)=>{
    const d=parseDay(date);const [h,m]=time.split(':').map(Number);d.setHours(h,m,0,0);
    if(addDay)d.setDate(d.getDate()+1);return d.getTime();
  };
  const start=a=>datetime(a.date,a.start);
  const end=a=>datetime(a.date,a.end,clock(a.end)<=clock(a.start));
  const minutes=a=>Math.round((end(a)-start(a))/60000);
  const rowTimes=a=>a.start+' – '+a.end+(end(a)-start(a)>0&&clock(a.end)<=clock(a.start)?' (+1 j)':'');
  function dayBounds(day){const a=parseDay(day),b=new Date(a);b.setDate(b.getDate()+1);return [a.getTime(),b.getTime()];}
  function onDay(day,driverId=null){
    const [from,to]=dayBounds(day);
    return store.activities.filter(a=>(!driverId||a.driverId===driverId)&&start(a)<to&&end(a)>from)
      .sort((a,b)=>start(a)-start(b)||a.label.localeCompare(b.label,'fr'));
  }
  function forDriver(id){return store.activities.filter(a=>a.driverId===id).sort((a,b)=>start(a)-start(b));}
  function timeStats(list){
    if(!list.length)return {work:0,amplitude:0,overlap:[],first:0,last:0};
    const sorted=[...list].sort((a,b)=>start(a)-start(b)),first=Math.min(...list.map(start)),last=Math.max(...list.map(end));
    let highEnd=-Infinity,highAct=null;const overlap=[];
    for(const a of sorted){
      if(start(a)<highEnd)overlap.push([highAct,a]);
      if(end(a)>highEnd){highEnd=end(a);highAct=a;}
    }
    return {work:sorted.reduce((n,a)=>n+(a.type==='pause'?0:minutes(a)),0),amplitude:Math.round((last-first)/60000),overlap,first,last};
  }
  function conflictData(day){
    const result=[];
    for(const d of store.drivers){
      const s=timeStats(onDay(day,d.id));
      for(const [a,b] of s.overlap)result.push({kind:'overlap',message:'Chevauchement — '+d.name+' : '+a.label+' / '+b.label});
      if(s.amplitude>14*60)result.push({kind:'duration',message:'Amplitude supérieure à 14 h pour '+d.name+' : '+fmt(s.amplitude)+' (vérification manuelle obligatoire).'});
    }
    const acts=onDay(day).filter(a=>a.vehicleId&&a.type!=='pause');
    const byVehicle=new Map();
    for(const a of acts){const k=a.vehicleId;if(!byVehicle.has(k))byVehicle.set(k,[]);byVehicle.get(k).push(a);}
    for(const [vid,items] of byVehicle){
      items.sort((a,b)=>start(a)-start(b));
      for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
        if(start(items[j])>=end(items[i]))break;
        if(items[i].driverId!==items[j].driverId)result.push({kind:'vehicle',message:'Même véhicule ('+namedVehicle(vid)+') attribué simultanément à '+namedDriver(items[i].driverId)+' et '+namedDriver(items[j].driverId)});
      }
    }
    return result;
  }
  function htmlButton(text,act,cls='',attrs=''){return '<button type="button" class="btn '+cls+'" data-action="'+act+'" '+attrs+'>'+text+'</button>';}
  function htmlCard(title,body,cls=''){return '<section class="card '+cls+'"><h2 style="font-size:17px;margin:0 0 12px">'+title+'</h2>'+body+'</section>';}
  function info(t){return '<p class="fine-print">'+t+'</p>';}
  function groupStats(day){const tasks=onDay(day);return [store.drivers.filter(d=>tasks.some(a=>a.driverId===d.id)).length,tasks.filter(a=>['course','school'].includes(a.type)).length,conflictData(day).length];}
  function selectDrivers(id,emptyOption=false,selectId=state.driverId){
    const items=store.drivers.map(d=>'<option value="'+esc(d.id)+'" '+(d.id===selectId?'selected':'')+'>'+esc(d.name)+'</option>').join('');
    return '<select id="'+id+'">'+(emptyOption?'<option value="">Choisir un conducteur</option>':'')+items+'</select>';
  }
  function daySelect(){return '<div class="field"><label>Date<input type="date" data-input="date" value="'+esc(state.date)+'"></label>'+
    htmlButton('◀','prevDate','muted small','aria-label="Jour précédent"')+htmlButton('▶','nextDate','muted small','aria-label="Jour suivant"')+'</div>';}
  function activityChips(a){
    return '<div class="timeline-entry"><div class="timeline-hour">'+esc(rowTimes(a))+'</div><span class="type-dot '+(a.type==='school'?'course':a.type==='other'?'service':a.type)+'"></span><div class="timeline-item"><strong>'+esc(a.label)+'</strong><small>'+
      esc(types[a.type]||a.type)+(a.from||a.to?' · '+esc([a.from,a.to].filter(Boolean).join(' → ')):'')+
      (a.vehicleId?' · '+esc(namedVehicle(a.vehicleId)):'')+(a.note?' · '+esc(a.note):'')+
      '</small></div></div>';
  }
  function driving(){
    const n=onDay(state.date,state.driverId);
    return '<div class="hero card"><div><span class="route-pill">FLUO 54 / 57</span><h2>Conduite opérationnelle</h2><p>Utilise le moteur de conduite existant, ses données officielles, le GPS, les annonces et le thermomètre des arrêts.</p></div>'+
      '<div class="hero-route"><span class="status-tag good">Moteur Fluo existant</span></div></div>'+
      '<div class="section-head"><h2>Démarrer une course</h2></div>'+
      '<div class="grid cols-2">'+htmlCard('Ouvrir le SAEIV de secours',
      '<p>Accède au vrai conducteur, sans connexion Supabase. Tu peux sélectionner ta ligne, ton horaire et démarrer le suivi GPS.</p>'+
      '<a class="btn accent link-btn" href="../secours.html">🚌 Ouvrir mon SAEIV conducteur</a>'+
      info('La page de conduite reste autonome pendant le développement de la nouvelle interface.'))+
      htmlCard('Planning personnel sur cet appareil',
      (store.drivers.length?'<label class="fine-print">Conducteur local</label>'+selectDrivers('selfDriver',false,state.driverId)+
      '<p>'+n.length+' activité(s) le '+esc(dateText(state.date))+'.</p>':info('Ajoute d’abord ton profil dans Exploitation → Conducteurs pour consulter tes services.'))+
      htmlButton('Voir mon planning','gotoMine','muted'))+
      '</div>'+
      '<div class="section-head"><h2>Accès rapide</h2></div>'+
      htmlCard('Fonctions de conduite disponibles dans le SAEIV existant',
      '<div class="feature-grid"><span>✓ Lignes réelles 54/57</span><span>✓ Courses GTFS</span><span>✓ GPS / arrêt suivant</span><span>✓ Annonces voyageurs</span><span>✓ Mode TAD</span><span>✓ Thermomètre de ligne</span></div>'+
      info('Les horaires, déviations et données GPS doivent toujours être vérifiés avant utilisation.'))
    ;
  }
  function mine(){
    const driver=state.driverId;
    return '<div class="section-head" style="margin-top:0"><div><h2>Mes services</h2><p>Planning stocké uniquement dans ce navigateur, sans connexion à l’entreprise</p></div>'+daySelect()+'</div>'+
      (!store.drivers.length?htmlCard('Aucun conducteur',info('Crée un profil conducteur dans Exploitation → Conducteurs.')) :
        '<div class="field" style="margin-bottom:15px"><label>Conducteur '+selectDrivers('selfDriver',false,driver)+'</label></div>'+
        htmlCard('Service du '+esc(dateText(state.date)),onDay(state.date,driver).length?
          '<div class="timeline">'+onDay(state.date,driver).map(activityChips).join('')+'</div>':'<div class="empty">Aucun service enregistré ce jour</div>')+
        info('Cette vue ne vérifie pas une identité : à utiliser uniquement sur un appareil personnel ou de confiance.')
      );
  }
  function matchingDrivers(){
    const q=(state.search||'').trim().toLocaleLowerCase('fr');
    return store.drivers.filter(d=>(!state.depot||d.depot===state.depot)&&
      (!q||[d.name,d.number,d.depot].join(' ').toLocaleLowerCase('fr').includes(q)));
  }
  function filters(){
    const depots=[...new Set(store.drivers.map(d=>d.depot||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    return '<div class="planner-filters"><label>Rechercher un conducteur<input id="driverSearch" type="search" autocomplete="off" placeholder="Nom ou matricule" value="'+esc(state.search||'')+'"></label>'+
      '<label>Dépôt<select id="depotFilter"><option value="">Tous les dépôts</option>'+depots.map(d=>
      '<option value="'+esc(d)+'" '+(state.depot===d?'selected':'')+'>'+esc(d)+'</option>').join('')+'</select></label>'+
      '<div class="planner-mode" aria-label="Type de planning">'+htmlButton('Frise','timelineMode',state.mode==='timeline'?'accent small':'muted small')+
      htmlButton('Liste','listMode',state.mode==='list'?'accent small':'muted small')+'</div></div>';
  }
  function timeLegend(){
    let parts='';
    for(let i=0;i<=24;i+=2)parts+='<span style="left:'+(i/24*100)+'%">'+String(i).padStart(2,'0')+' h</span>';
    return '<div class="clock-ruler">'+parts+'</div>';
  }
  function segment(a,day){
    const [d0,d1]=dayBounds(day),x=Math.max(d0,start(a)),y=Math.min(d1,end(a));
    const left=(x-d0)/(d1-d0)*100,width=Math.max(.4,(y-x)/(d1-d0)*100);
    const type=['course','school','hlp','pause','other'].includes(a.type)?a.type:'other';
    const title=rowTimes(a)+' · '+types[a.type]+' · '+a.label;
    return '<button type="button" class="planning-segment '+type+'" data-action="edit" data-id="'+esc(a.id)+
      '" draggable="true" aria-label="Modifier '+esc(title)+'" title="'+esc(title)+'" style="left:'+left.toFixed(3)+'%;width:'+width.toFixed(3)+'%">'+
      '<span>'+esc(a.label)+'</span></button>';
  }
  function plannerTimeline(day){
    const people=matchingDrivers();
    if(!people.length)return '<div class="empty">Aucun conducteur ne correspond aux filtres. Ajoute des conducteurs ou change la recherche.</div>';
    return '<div class="planner-grid"><div class="planner-ruler"><div class="planner-name">CONDUCTEURS</div><div class="planner-hours">'+timeLegend()+'</div><div class="planner-amplitude">AMPLITUDE</div></div>'+
      people.map(d=>{
        const items=onDay(day,d.id),st=timeStats(items);
        return '<div class="planner-line" data-drop-driver="'+esc(d.id)+'" data-drop-date="'+esc(day)+'">'+
        '<div class="planner-name"><b>'+esc(d.name)+'</b><small>'+esc(d.depot||d.number||'Sans dépôt')+'</small>'+
        '<button type="button" class="inline-add" data-action="addForDriver" data-driver="'+esc(d.id)+'" aria-label="Ajouter un segment pour '+esc(d.name)+'">＋</button></div>'+
        '<div class="planner-hours planner-track">'+(items.length?items.map(a=>segment(a,day)).join(''):'<span class="track-empty">Aucune affectation</span>')+'</div>'+
        '<div class="planner-amplitude"><strong>'+fmt(st.amplitude)+'</strong><small>'+items.length+' segments</small>'+
        (st.overlap.length?'<em class="rse-danger">Conflit</em>':'')+'</div></div>';
      }).join('')+'</div>';
  }
  function plannerList(day){
    return '<div class="table-scroll"><table class="planning-table"><thead><tr><th>Conducteur</th><th>Journée détaillée — plusieurs courses possibles</th><th>Activités*</th><th>Amplitude*</th><th>Alertes</th></tr></thead><tbody>'+
      matchingDrivers().map(d=>{
        const items=onDay(day,d.id),st=timeStats(items);
        return '<tr><td class="driver-name">'+esc(d.name)+'<div class="fine-print">'+esc(d.depot||d.number||'')+'</div>'+
        htmlButton('+ Segment','addForDriver','muted small','data-driver="'+esc(d.id)+'"')+'</td><td>'+
        (items.length?'<div class="day-segments">'+items.map(a=>
        '<div class="activity-row"><div><span class="chip '+esc(a.type)+'">'+esc(rowTimes(a))+' · '+esc(a.label)+'</span><small>'+esc(types[a.type]||'')+'</small></div>'+
        htmlButton('Modifier','edit','muted small','data-id="'+esc(a.id)+'"')+htmlButton('×','delete','danger small','data-id="'+esc(a.id)+'"')).join('')+'</div>':
        '<span class="fine-print">Repos / non affecté</span>')+'</td><td>'+fmt(st.work)+'</td><td>'+fmt(st.amplitude)+'</td><td>'+
        (st.overlap.length?'<span class="status-tag bad">Chevauchement</span>':'<span class="status-tag muted">À contrôler</span>')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  function planning(){
    const summary=groupStats(state.date);
    return '<div class="maquette-intro"><div><span class="kicker">EXPLOITATION · PLANIFICATION</span><h2>Journée globale</h2><p>Toutes les équipes, plusieurs lignes et activités par conducteur, sur une frise de 24 heures.</p></div>'+
      '<div class="btn-row">'+htmlButton('+ Créer une activité','addActivity','accent')+htmlButton('Exporter CSV','csv','muted')+htmlButton('Imprimer','print','muted')+'</div></div>'+
      '<div class="planner-toolbar">'+daySelect()+'</div>'+
      '<div class="grid cols-3 planner-metrics">'+stat('Conducteurs affectés',summary[0],store.drivers.length+' collaborateurs')+
      stat('Courses voyageurs / scolaires',summary[1],'Courses distinctes des HLP et coupures')+
      stat('Points à contrôler',summary[2],'Contrôles partiels, pas une validation RSE')+'</div>'+
      filters()+
      '<section class="planner-surface"><div class="planner-surface-head"><h3>'+esc(dateText(state.date))+'</h3>'+
      '<div class="planner-key"><span><i class="key-course"></i> Course</span><span><i class="key-school"></i> Scolaire</span><span><i class="key-hlp"></i> HLP</span><span><i class="key-pause"></i> Coupure</span></div></div>'+
      (store.drivers.length?(state.mode==='list'?plannerList(state.date):plannerTimeline(state.date)):
      '<div class="empty">Aucun conducteur enregistré. Crée tes collaborateurs pour composer de véritables journées de service.</div>')+'</section>'+
      '<div class="section-head"><h2>Contrôles et anomalies</h2></div>'+validation(state.date)+
      info('Amplitude indicative : du début du premier segment à la fin du dernier. 14 h n’est pas un plafond légal automatique : repos, RSE, conventions et dérogations restent à contrôler.')+
      htmlCard('Travail collaboratif non activé',info('Les brouillons de ce navigateur ne sont pas encore publiés aux conducteurs ; la synchronisation requiert un serveur et un contrôle d’accès.'),'space-top');
  }
  function stat(label,value,sub){return '<article class="card"><span class="eyebrow">'+esc(label)+'</span><strong class="stat-value">'+esc(value)+'</strong><div class="stat-detail">'+esc(sub)+'</div></article>';}
  function validation(day){
    const rows=conflictData(day);
    return '<div class="validation">'+(rows.length?rows.map(r=>'<div class="validation-row">⚠ '+esc(r.message)+'</div>').join(''):
      '<div class="validation-row ok">Aucun chevauchement évident détecté sur cette journée. Les repos et autres contraintes légales restent à vérifier.</div>')+'</div>';
  }
  function week(){
    const monday=parseDay(state.date);monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
    const dates=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return ymd(d);});
    const people=matchingDrivers();
    return '<div class="maquette-intro"><div><span class="kicker">EXPLOITATION · PLANIFICATION</span><h2>Semainier équipe</h2><p>Une ligne par conducteur, sept jours et toutes les affectations de la semaine.</p></div>'+
      '<div class="btn-row">'+htmlButton('← Semaine','prevWeek','muted')+htmlButton('Semaine →','nextWeek','muted')+'</div></div>'+
      '<div class="section-head" style="margin-top:0"><h2>Du '+esc(dateText(dates[0]))+' au '+esc(dateText(dates[6]))+'</h2></div>'+
      filters().replace('planner-mode','planner-mode hidden')+
      (!people.length?'<div class="empty">Aucun conducteur : ajoute tes collaborateurs ou modifie les filtres.</div>':
        '<div class="weekly-scroll"><div class="weekly-grid"><div class="weekly-head">CONDUCTEUR</div>'+
        dates.map(d=>'<button class="weekly-head day-head" type="button" data-action="openDay" data-date="'+d+'">'+
        esc(parseDay(d).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}))+'</button>').join('')+
        people.map(d=>'<div class="weekly-driver"><strong>'+esc(d.name)+'</strong><small>'+esc(d.depot||d.number||'')+'</small></div>'+
          dates.map(day=>{
            const items=onDay(day,d.id),st=timeStats(items),issues=st.overlap.length;
            return '<div class="weekly-cell" data-drop-driver="'+esc(d.id)+'" data-drop-date="'+day+'">'+
            '<button class="weekly-cell-open" type="button" data-action="openDriverDay" data-driver="'+esc(d.id)+'" data-date="'+day+'" aria-label="Voir la journée de '+esc(d.name)+' '+day+'">'+
            (items.length?'<strong>'+items.length+' segment'+(items.length>1?'s':'')+'</strong><small>'+fmt(st.amplitude)+' amp.</small>':
             '<span class="weekly-off">Repos / non affecté</span>')+'</button>'+
            (items.length?items.slice(0,3).map(a=>'<button type="button" class="weekly-chip '+esc(a.type)+'" draggable="true" data-action="edit" data-id="'+esc(a.id)+'" title="'+esc(rowTimes(a)+' · '+a.label)+'">'+esc(a.label)+'</button>').join(''):'')+
            (issues?'<span class="rse-danger">Chevauchement</span>':'')+
            '<button class="weekly-add" type="button" data-action="addOnDay" data-driver="'+esc(d.id)+'" data-date="'+day+'">+ activité</button>'+
            '</div>';
          }).join('')).join('')+'</div></div>')+
      info('Clique sur une case pour consulter la journée complète ou ajouter une activité. Le glisser-déposer modifie une affectation locale ; vérifier les conséquences et les règles RSE.');
  }
  function driverDay(){
    const d=store.drivers.find(d=>d.id===state.openDriver)||store.drivers[0],list=d?onDay(state.date,d.id):[],st=timeStats(list);
    return '<div class="maquette-intro"><div><span class="kicker">EXPLOITATION · JOURNÉE CONDUCTEUR</span><h2>'+
      esc(d?.name||'Conducteur')+'</h2><p>'+esc(dateText(state.date))+' · plusieurs courses, HLP, coupures et changements de ligne</p></div>'+
      '<div class="btn-row">'+htmlButton('← Semainier','backWeek','muted')+
      htmlButton('+ Ajouter un segment','addForDriver','accent','data-driver="'+esc(d?.id||'')+'"')+'</div></div>'+
      '<div class="grid cols-3 planner-metrics">'+stat('Amplitude',fmt(st.amplitude),'Indicative, à contrôler')+
      stat('Activités hors coupure',fmt(st.work),'Calcul brut, sans portée réglementaire')+
      stat('Nombre de segments',list.length,'Services et activités de la journée')+'</div>'+
      '<div class="planner-surface"><div class="planner-surface-head"><h3>Frise 24 heures</h3></div>'+
      '<div class="planner-hours planner-track single-track">'+list.map(a=>segment(a,state.date)).join('')+'</div>'+
      '<div class="service-segments">'+(list.length?list.map(a=>
      '<div class="service-piece"><span class="type-dot '+esc(a.type)+'"></span><div class="service-time">'+esc(rowTimes(a))+'</div>'+
      '<div class="service-desc"><strong>'+esc(a.label)+'</strong><small>'+esc(types[a.type])+(a.from?' · '+esc(a.from):'')+(a.to?' → '+esc(a.to):'')+
      (a.vehicleId?' · '+esc(namedVehicle(a.vehicleId)):'')+'</small></div>'+
      htmlButton('Modifier','edit','muted small','data-id="'+esc(a.id)+'"')+'</div>').join(''):'<div class="empty">Aucune activité enregistrée.</div>')+'</div></div>'+
      '<div class="section-head"><h2>Vérifications</h2></div>'+validation(state.date);
  }
  function drivers(){
    return '<div class="maquette-intro"><div><span class="kicker">ENTREPRISE · COLLABORATEURS</span><h2>Conducteurs & agents</h2><p>Profils, matricules et dépôts pour la construction des services.</p></div></div>'+
      '<div class="grid cols-2">'+htmlCard('Créer un conducteur',
      '<form id="newDriverForm" class="inline-form"><label>Nom affiché<input name="name" maxlength="90" autocomplete="off" required placeholder="Nom / prénom"></label>'+
      '<label>Matricule<input name="number" maxlength="40" placeholder="Ex. 0042"></label>'+
      '<label>Dépôt<input name="depot" maxlength="80" placeholder="Ex. Château-Salins"></label>'+
      '<button class="btn accent" type="submit">Ajouter à l’effectif</button></form>')+
      htmlCard('Collaborateurs enregistrés',store.drivers.length?'<div class="rows">'+store.drivers.map(d=>
        '<div class="person-row"><div><strong>'+esc(d.name)+'</strong><small>'+esc(d.number||'Sans matricule')+
        ' · '+esc(d.depot||'Dépôt non renseigné')+' · '+forDriver(d.id).length+' activité(s)</small></div>'+
        '<div class="btn-row">'+htmlButton('Dépôt','setDepot','muted small','data-id="'+esc(d.id)+'"')+
        htmlButton('Renommer','renameDriver','muted small','data-id="'+esc(d.id)+'"')+
        htmlButton('Supprimer','deleteDriver','danger small','data-id="'+esc(d.id)+'"')+'</div></div>').join('')+'</div>':
      '<div class="empty">Aucun collaborateur enregistré</div>')+'</div>'+
      info('Les profils restent locaux : un compte partagé et ses droits nécessitent le serveur.');
  }
  function vehicles(){
    return '<div class="grid cols-2">'+htmlCard('Ajouter un véhicule',
    '<form id="newVehicleForm" class="inline-form"><label>Immatriculation, parc ou identifiant<input name="name" maxlength="90" required placeholder="Ex. Crossway 312"></label><button class="btn accent" type="submit">Ajouter le véhicule</button></form>')+
    htmlCard('Parc local',store.vehicles.length?'<div class="rows">'+store.vehicles.map(v=>'<div class="person-row"><strong>'+esc(v.name)+'</strong>'+htmlButton('Supprimer','deleteVehicle','danger small','data-id="'+esc(v.id)+'"')+'</div>').join('')+'</div>':'<div class="empty">Aucun véhicule saisi.</div>')+'</div>'+
    info('L’ajout d’un véhicule permet de signaler une double affectation simultanée, entre deux conducteurs. La disponibilité réelle n’est pas synchronisée.')
    ;
  }
  function home(){
    const g=groupStats(state.date);
    return '<div class="maquette-intro"><div><span class="kicker">MON SAEIV 2.0 · ESPACE ENTREPRISE</span>'+
      '<h2>'+esc(store.settings?.name||'Mon entreprise')+'</h2>'+
      '<p>Conduite • exploitation • collaborateurs • annonces • caisse • réseau</p></div>'+
      '<div class="btn-row">'+htmlButton('Journée globale','gotoPlanning','accent')+
      htmlButton('Semainier équipe','gotoWeek','muted')+'</div></div>'+
      '<div class="grid cols-3 planner-metrics">'+stat('Conducteurs affectés',g[0],dateText(state.date))+
      stat('Courses prévues',g[1],'Scolaires et lignes régulières')+
      stat('Alertes planning',g[2],'Vérifications partielles')+'</div>'+
      '<div class="section-head"><h2>Les espaces de Mon SAEIV</h2></div>'+
      '<div class="module-grid">'+[
        ['🚌','Conducteur','Cockpit, arrêts, navigation, GPS, annonces, formation','gotoDriver','live'],
        ['▦','Exploitation','Journée globale, frises et construction des services','gotoPlanning','live'],
        ['▧','Planning équipe','Semainier, collaborateurs et changements de ligne','gotoWeek','live'],
        ['♙','Collaborateurs','Effectifs, matricules et dépôts','gotoDrivers','live'],
        ['▣','Matériel','Affectations et conflits véhicules','gotoVehicles','live'],
        ['🔊','Annonces','Voix unique serveur et annonces de sécurité','none','planned'],
        ['▤','Caisse & titres','Billetterie et Billet CO — billet collectif','none','planned'],
        ['⇄','Communication','Messages entre l’exploitation et les conducteurs','none','planned'],
        ['⚙','Administration','Sociétés, comptes, personnalisation et droits','gotoOrganization','partial']
      ].map(([icon,title,desc,action,status])=>
        '<div class="module-card"><div class="module-icon">'+icon+'</div><h3>'+title+'</h3><p>'+desc+'</p>'+
        '<span class="status-tag '+(status==='live'?'good':status==='planned'?'warn':'muted')+'">'+
        (status==='live'?'Accès local':status==='planned'?'À raccorder':'Partiel')+'</span>'+
        (action!=='none'?htmlButton('Ouvrir',''+action,'muted small'):'')+'</div>').join('')+'</div>';
  }
  function organization(){
    return '<div class="maquette-intro"><div><span class="kicker">ADMINISTRATION</span><h2>Personnaliser Mon SAEIV</h2>'+
      '<p>Identité de l’entreprise, dépôts et futurs modules de gestion.</p></div></div>'+
      '<div class="grid cols-2">'+htmlCard('Nom de l’espace entreprise',
      '<form class="inline-form" id="organizationForm"><label>Entreprise ou réseau<input name="name" required maxlength="90" value="'+esc(store.settings?.name||'Mon entreprise')+'"></label>'+
      '<button type="submit" class="btn accent">Enregistrer</button></form>')+
      htmlCard('État des connexions','<p>Planning : local sur cet appareil.</p><p>Conduite : SAEIV Fluo existant.</p>'+
      '<p class="fine-print">Voix serveur, comptes et publication multi-conducteurs : non raccordés. Aucun mot de passe réel dans cet espace.</p>')+'</div>';
  }
  function backup(){
    return htmlCard('Sauvegarder ton travail',
      '<p>Les plannings, conducteurs et véhicules sont enregistrés automatiquement dans le navigateur utilisé. Pour éviter de les perdre lors d’un changement de téléphone, de navigateur ou d’un nettoyage des données, télécharge régulièrement une sauvegarde.</p>'+
      '<div class="btn-row">'+htmlButton('⬇ Télécharger la sauvegarde JSON','exportBackup','accent')+
      htmlButton('⬆ Restaurer un fichier JSON','importBackup','muted')+htmlButton('Exporter les services en CSV','csvAll','muted')+'</div>'+
      '<p class="fine-print">Dernier enregistrement : '+esc(store.updatedAt?new Date(store.updatedAt).toLocaleString('fr-FR'):'Aucun')+'</p>')+
      '<div class="section-head"><h2>Contenu enregistré</h2></div>'+
      '<div class="grid cols-3">'+stat('Conducteurs',store.drivers.length,'Profils locaux')+stat('Véhicules',store.vehicles.length,'Parc local')+stat('Activités',store.activities.length,'Toutes dates confondues')+'</div>'+
      htmlCard('Confidentialité',info('Les données restent sur cet appareil sauf si tu exportes ou partages un fichier. GitHub Pages est un site statique public : n’inscris pas de mots de passe, de données médicales ni de données privées sensibles dans l’outil.'),'space-top');
  }
  const pages={home:home,driver:driving,mine,planning,week,day:driverDay,drivers,vehicles,organization,backup};
  function render(){
    if(!navs[state.role].some(v=>v[0]===state.view))state.view=navs[state.role][0][0];
    $('roleDriver').classList.toggle('active',state.role==='driver');$('roleOps').classList.toggle('active',state.role==='ops');
    $('roleDriver').setAttribute('aria-pressed',String(state.role==='driver'));$('roleOps').setAttribute('aria-pressed',String(state.role==='ops'));
    $('navigation').innerHTML=navs[state.role].map(v=>'<button class="nav-link '+(state.view===v[0]?'active':'')+'" data-view="'+v[0]+'" type="button">'+ico[v[0]]+' <span>'+v[1]+'</span></button>').join('');
    $('breadcrumb').textContent=state.role==='driver'?'CONDUITE':'EXPLOITATION';
    $('pageTitle').textContent=navs[state.role].find(v=>v[0]===state.view)?.[1]||'Mon SAEIV';
    $('datePill').textContent=dateText(state.date);
    $('statusBanner').textContent=storageError||'PRÉVISUALISATION À VALIDER : copie de test, données locales indépendantes du 2.0 publié. Les comptes, l’audio serveur et la publication des plannings ne sont pas encore opérationnels.';
    $('content').innerHTML=pages[state.view]();
  }
  function openActivity(id){
    if(!store.drivers.length){alert('Ajoute d’abord un conducteur.');state.view='drivers';render();return;}
    const a=store.activities.find(v=>v.id===id);
    $('activityTitle').textContent=a?'Modifier une activité':'Ajouter une activité';
    $('activityForm').reset();$('formError').hidden=true;
    $('activityId').value=a?.id||'';
    $('activityDriver').innerHTML=store.drivers.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('');
    $('activityVehicle').innerHTML='<option value="">Sans véhicule attribué</option>'+store.vehicles.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+'</option>').join('');
    $('activityDriver').value=a?.driverId||store.drivers[0].id;
    $('activityDate').value=a?.date||state.date;
    $('activityType').value=a?.type||'course';
    $('activityStart').value=a?.start||'08:00';
    $('activityEnd').value=a?.end||'09:00';
    $('activityLabel').value=a?.label||'';
    $('activityFrom').value=a?.from||'';
    $('activityTo').value=a?.to||'';
    $('activityVehicle').value=a?.vehicleId||'';
    $('activityNote').value=a?.note||'';
    $('activityDialog').showModal();
  }
  function download(name,data,mime){
    const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  function csv(rows){
    return '\ufeff'+rows.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  }
  function exportCsv(all=false){
    const items=all?[...store.activities].sort((a,b)=>start(a)-start(b)):onDay(state.date);
    const rows=[['Date de début','Conducteur','Matricule','Début','Fin','Type','Ligne / description','Départ','Arrivée','Véhicule','Note']];
    items.forEach(a=>rows.push([a.date,namedDriver(a.driverId),store.drivers.find(d=>d.id===a.driverId)?.number||'',a.start,a.end,types[a.type],a.label,a.from,a.to,a.vehicleId?namedVehicle(a.vehicleId):'',a.note]));
    download('MonSAEIV2-services-'+(all?'complets':state.date)+'.csv',csv(rows),'text/csv;charset=utf-8');
  }
  function backupExport(){download('MonSAEIV2-sauvegarde-'+ymd(new Date())+'.json',JSON.stringify(store,null,2),'application/json');}
  function safeImport(raw){
    if(!raw||raw.version!==1||!Array.isArray(raw.activities)||!Array.isArray(raw.drivers)||!Array.isArray(raw.vehicles))throw Error('Format de sauvegarde non reconnu.');
    if(raw.activities.length>20000||raw.drivers.length>1000||raw.vehicles.length>1000)throw Error('Fichier trop volumineux.');
    const text=(v,max=120)=>String(v==null?'':v).slice(0,max);
    const drivers=raw.drivers.map(d=>({id:text(d.id,100),name:text(d.name,90),number:text(d.number,40),depot:text(d.depot,80)}));
    const vehicles=raw.vehicles.map(v=>({id:text(v.id,100),name:text(v.name,90)}));
    const ids=new Set(drivers.map(d=>d.id)),vids=new Set(vehicles.map(v=>v.id));
    const activities=raw.activities.map(a=>{
      if(!isDay(a.date)||!isTime(a.start)||!isTime(a.end)||!types[a.type]||!ids.has(a.driverId)||a.vehicleId&&!vids.has(a.vehicleId))
        throw Error('Au moins une activité contient des dates, heures ou affectations invalides.');
      return {id:text(a.id,100),date:a.date,driverId:a.driverId,type:a.type,start:a.start,end:a.end,label:text(a.label,120),from:text(a.from),to:text(a.to),vehicleId:text(a.vehicleId,100),note:text(a.note,300)};
    });
    if(new Set(drivers.map(d=>d.id)).size!==drivers.length||new Set(activities.map(a=>a.id)).size!==activities.length)throw Error('Identifiants dupliqués dans la sauvegarde.');
    return {version:1,drivers,vehicles,activities,settings:{name:text(raw.settings?.name||'Mon entreprise',90)},updatedAt:text(raw.updatedAt,60)};
  }
  function navigate(view,role){
    if(role)state.role=role;
    state.view=view;render();
  }
  function onAction(kind,id){
    const pending=window.__pendingActionElement||null;
    if(kind==='timelineMode'||kind==='listMode'){state.mode=kind==='timelineMode'?'timeline':'list';render();return;}
    if(kind==='prevWeek'||kind==='nextWeek'){
      const d=parseDay(state.date);d.setDate(d.getDate()+(kind==='prevWeek'?-7:7));state.date=ymd(d);render();return;
    }
    if(kind==='openDay'||kind==='openDriverDay'){
      if(pending?.dataset.date)state.date=pending.dataset.date;
      if(kind==='openDriverDay'&&pending?.dataset.driver)state.openDriver=pending.dataset.driver;
      navigate(kind==='openDay'?'planning':'day','ops');return;
    }
    if(kind==='backWeek'){navigate('week','ops');return;}
    if(kind==='gotoPlanning'||kind==='gotoWeek'||kind==='gotoDriver'||kind==='gotoVehicles'||kind==='gotoOrganization'){
      const target={gotoPlanning:'planning',gotoWeek:'week',gotoDriver:'driver',gotoVehicles:'vehicles',gotoOrganization:'organization'}[kind];
      navigate(target,target==='driver'?'driver':'ops');return;
    }
    if(kind==='addForDriver'||kind==='addOnDay'){
      if(pending?.dataset.date)state.date=pending.dataset.date;
      openActivity(null);
      if(pending?.dataset.driver)$('activityDriver').value=pending.dataset.driver;
      if(pending?.dataset.date)$('activityDate').value=pending.dataset.date;
      return;
    }
    if(kind==='prevDate'||kind==='nextDate'){
      const d=parseDay(state.date);d.setDate(d.getDate()+(kind==='prevDate'?-1:1));state.date=ymd(d);
    }
    else if(kind==='gotoMine'){state.role='driver';state.view='mine';}
    else if(kind==='gotoDrivers'){state.role='ops';state.view='drivers';}
    else if(kind==='addActivity'||kind==='edit'){openActivity(kind==='edit'?id:null);return;}
    else if(kind==='delete'){
      const a=store.activities.find(a=>a.id===id);
      if(!a||!confirm('Supprimer « '+a.label+' » ('+dateText(a.date)+') ?'))return;
      store.activities=store.activities.filter(v=>v.id!==id);persist();
    }
    else if(kind==='deleteDriver'){
      const d=store.drivers.find(d=>d.id===id);if(!d)return;
      if(store.activities.some(a=>a.driverId===id)){alert('Supprime ou réattribue d’abord ses activités.');return;}
      if(!confirm('Supprimer le conducteur '+d.name+' ?'))return;
      store.drivers=store.drivers.filter(v=>v.id!==id);
      state.driverId=store.drivers[0]?.id||'';state.weekId=state.driverId;state.openDriver=state.driverId;persist();
    }
    else if(kind==='setDepot'){const d=store.drivers.find(d=>d.id===id);if(!d)return;const v=prompt('Dépôt du conducteur',d.depot||'');if(v===null)return;d.depot=v.trim().slice(0,80);persist();}
    else if(kind==='renameDriver'){
      const d=store.drivers.find(d=>d.id===id);if(!d)return;
      const value=prompt('Nom du conducteur',d.name);if(!value)return;
      d.name=value.trim().slice(0,90);persist();
    }
    else if(kind==='deleteVehicle'){
      const v=store.vehicles.find(v=>v.id===id);if(!v)return;
      if(store.activities.some(a=>a.vehicleId===id)){alert('Ce véhicule est affecté à des activités. Retire ces affectations avant la suppression.');return;}
      if(!confirm('Supprimer le véhicule '+v.name+' ?'))return;
      store.vehicles=store.vehicles.filter(v=>v.id!==id);persist();
    }
    else if(kind==='csv'||kind==='csvAll'){exportCsv(kind==='csvAll');return;}
    else if(kind==='exportBackup'){backupExport();return;}
    else if(kind==='importBackup'){$('backupFile').click();return;}
    else if(kind==='print'){window.print();return;}
    render();
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-view]');if(btn){state.view=btn.dataset.view;render();return;}
    const act=e.target.closest('[data-action]');if(act&&!act.disabled){window.__pendingActionElement=act;onAction(act.dataset.action,act.dataset.id);window.__pendingActionElement=null;}
  });
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset.input==='date'&&isDay(t.value)){state.date=t.value;render();}
    if(t.id==='selfDriver'){state.driverId=t.value;render();}
    if(t.id==='weekDriver'){state.weekId=t.value;render();}
    if(t.id==='driverSearch'){state.search=t.value;render();}
    if(t.id==='depotFilter'){state.depot=t.value;render();}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id==='organizationForm'){
      e.preventDefault();const val=String(new FormData(e.target).get('name')||'').trim();
      if(val)store.settings.name=val.slice(0,90);persist();render();
    }
    if(e.target.id==='newDriverForm'){
      e.preventDefault();
      const d=new FormData(e.target),name=String(d.get('name')||'').trim(),number=String(d.get('number')||'').trim();
      if(!name)return;
      const id=uid();store.drivers.push({id,name:name.slice(0,90),number:number.slice(0,40),depot:String(d.get('depot')||'').trim().slice(0,80)});
      if(!state.driverId)state.driverId=id;if(!state.weekId)state.weekId=id;persist();render();
    }
    if(e.target.id==='newVehicleForm'){
      e.preventDefault();const d=new FormData(e.target),name=String(d.get('name')||'').trim();
      if(!name)return;store.vehicles.push({id:uid(),name:name.slice(0,90)});persist();render();
    }
  });
  $('activityForm').addEventListener('submit',e=>{
    e.preventDefault();
    const d=new FormData(e.target),v=k=>String(d.get(k)||'').trim();
    if(!isDay(v('date'))||!isTime(v('start'))||!isTime(v('end'))||!types[v('type')]||!store.drivers.some(x=>x.id===v('driverId'))||!v('label')){
      $('formError').hidden=false;$('formError').textContent='Renseigne un conducteur, une date, des heures et une description valides.';return;
    }
    const activity={id:v('id')||uid(),date:v('date'),driverId:v('driverId'),type:v('type'),
      start:v('start'),end:v('end'),label:v('label').slice(0,120),from:v('from').slice(0,120),
      to:v('to').slice(0,120),vehicleId:v('vehicleId'),note:v('note').slice(0,300)};
    const idx=store.activities.findIndex(a=>a.id===activity.id);
    if(idx>=0)store.activities[idx]=activity;else store.activities.push(activity);
    persist();$('activityDialog').close();render();
  });
  $('closeDialog').addEventListener('click',()=>$('activityDialog').close());
  $('cancelDialog').addEventListener('click',()=>$('activityDialog').close());
  $('backupFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>10_000_000)throw Error('Sauvegarde trop volumineuse.');
      const next=safeImport(JSON.parse(await file.text()));
      if(!confirm('Restaurer ce fichier ? Les données actuellement enregistrées sur cet appareil seront remplacées.'))return;
      store=next;persist();state.driverId=store.drivers[0]?.id||'';state.weekId=state.driverId;render();
      alert('Sauvegarde restaurée : '+store.activities.length+' activité(s).');
    }catch(err){alert('Importation refusée : '+err.message);}
    finally{e.target.value='';}
  });
  document.addEventListener('dragstart',e=>{
    const target=e.target.closest?.('[data-id][draggable="true"]');
    if(!target)return;
    const a=store.activities.find(x=>x.id===target.dataset.id);
    if(!a)return;
    try{e.dataTransfer.setData('text/plain',a.id);e.dataTransfer.effectAllowed='move';}catch(_){}
  });
  document.addEventListener('dragover',e=>{
    if(e.target.closest?.('[data-drop-driver]')){e.preventDefault();e.dataTransfer.dropEffect='move';}
  });
  document.addEventListener('drop',e=>{
    const target=e.target.closest?.('[data-drop-driver]');
    if(!target)return;
    e.preventDefault();const id=e.dataTransfer.getData('text/plain');
    const a=store.activities.find(x=>x.id===id);
    if(!a)return;
    const newDriver=target.dataset.dropDriver,newDate=target.dataset.dropDate;
    if(!store.drivers.some(d=>d.id===newDriver)||!isDay(newDate))return;
    if(a.driverId===newDriver&&a.date===newDate)return;
    const next=store.activities.map(x=>x===a?{...a,driverId:newDriver,date:newDate}:x);
    if(!confirm('Réaffecter « '+a.label+' » à '+namedDriver(newDriver)+' le '+dateText(newDate)+' ? Les conflits et repos devront être revérifiés.'))return;
    store.activities=next;persist();render();
  });
  $('roleDriver').addEventListener('click',()=>{state.role='driver';state.view='driver';render();});
  $('roleOps').addEventListener('click',()=>{state.role='ops';state.view='planning';render();});
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
  render();
})();