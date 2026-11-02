/* Mon SAEIV 2.0 — planning autonome local, conduite Fluo réelle via /secours.html. */
'use strict';
(() => {
  const KEY='monsaeiv-v2-local-operations-1';
  const types={course:'Course voyageurs',school:'Scolaire',hlp:'Haut-le-pied',pause:'Coupure',other:'Autre activité'};
  const navs={driver:[['driver','Conduite Fluo'],['mine','Mon planning']],ops:[['planning','Planning du jour'],['week','Semainier'],['drivers','Conducteurs'],['vehicles','Véhicules'],['backup','Sauvegardes']]};
  const ico={driver:'🚌',mine:'◷',planning:'▦',week:'▧',drivers:'♙',vehicles:'▣',backup:'⬇'};
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
  const state={role:'driver',view:'driver',date:ymd(new Date()),driverId:store.drivers[0]?.id||'',weekId:store.drivers[0]?.id||'',filter:'all'};
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
  function planning(){
    const selected=onDay(state.date),summary=groupStats(state.date);
    return '<div class="section-head" style="margin-top:0"><div><h2>Journée du '+esc(dateText(state.date))+'</h2><p>Toutes les affectations, courses, HLP et coupures</p></div>'+daySelect()+'</div>'+
      '<div class="grid cols-3">'+
      stat('Conducteurs affectés',summary[0],'Profils locaux : '+store.drivers.length)+
      stat('Courses',summary[1],'Voyageurs + scolaires')+
      stat('Alertes',summary[2],'Contrôles partiels, sans validation RSE')+'</div>'+
      '<div class="section-head"><div><h2>Tableau de service</h2><p>Enregistrement automatique sur cet appareil</p></div>'+
      '<div class="btn-row">'+htmlButton('+ Ajouter une activité','addActivity','accent')+htmlButton('Exporter CSV','csv','muted')+htmlButton('Imprimer','print','muted')+'</div></div>'+
      (store.drivers.length?'<div class="table-scroll"><table class="planning-table"><thead><tr><th>Conducteur</th><th>Activités (modifiables)</th><th>Temps hors coupure*</th><th>Amplitude*</th><th>État</th></tr></thead><tbody>'+
        store.drivers.map(d=>{
          const items=onDay(state.date,d.id),s=timeStats(items);
          return '<tr><td class="driver-name">'+esc(d.name)+'</td><td>'+
          (items.length?items.map(a=>'<div class="activity-row"><span class="chip '+esc(a.type)+'">'+esc(rowTimes(a))+' · '+esc(a.label)+(a.vehicleId?' · '+esc(namedVehicle(a.vehicleId)):'')+'</span>'+
            '<span class="inline-buttons">'+htmlButton('Modifier','edit','muted small','data-id="'+esc(a.id)+'"')+htmlButton('×','delete','danger small','data-id="'+esc(a.id)+'" aria-label="Supprimer cette activité"')+'</span></div>').join(''):'<span class="fine-print">Aucun service</span>')+'</td><td>'+fmt(s.work)+'</td><td>'+fmt(s.amplitude)+'</td><td><span class="status-tag '+(s.overlap.length?'bad':s.amplitude>840?'warn':'muted')+'">'+(s.overlap.length?'Chevauchement':s.amplitude>840?'Vérifier':'À contrôler')+'</span></td></tr>';
        }).join('')+'</tbody></table></div>':
        htmlCard('Commencer',info('Pour utiliser ton planning, commence par créer un conducteur puis ajoute ses activités du jour.')+htmlButton('Ajouter un conducteur','gotoDrivers','accent'))) +
      '<div class="section-head"><h2>Vérifications techniques</h2></div>'+
      validation(state.date)+info('* Temps d’activités = total des durées saisies moins les coupures ; ne constitue pas un calcul réglementaire de travail effectif. L’amplitude est la période entre le premier début et la dernière fin, avec prise en compte des activités franchissant minuit.')+
      htmlCard('État des plannings',info('Ces services sont enregistrés localement. Ils ne sont pas publiés aux autres conducteurs. Pour transférer le planning, exporte une sauvegarde JSON dans Sauvegardes.'), 'space-top');
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
    return '<div class="section-head" style="margin-top:0"><div><h2>Semainier</h2><p>Semaine du '+esc(dateText(dates[0]))+'</p></div><div class="field">'+daySelect()+
    (store.drivers.length?'<label>Conducteur '+selectDrivers('weekDriver',false,state.weekId)+'</label>':'')+'</div></div>'+
    (!store.drivers.length?htmlCard('Aucun conducteur',info('Ajoute un conducteur pour construire un semainier réel.')) :
      '<div class="grid cols-2">'+dates.map(d=>{
        const list=onDay(d,state.weekId),s=timeStats(list);
        return htmlCard(esc(dateText(d))+' · '+fmt(s.amplitude)+' amplitude',list.length?'<div class="timeline">'+list.map(activityChips).join('')+'</div>':'<div class="empty">Aucun service saisi</div>');
      }).join('')+'</div>')+
    info('Les activités qui franchissent minuit apparaissent sur les deux dates concernées. Les chevauchements et repos doivent être contrôlés sur l’ensemble des journées.')
    ;
  }
  function drivers(){
    return '<div class="grid cols-2">'+htmlCard('Ajouter un conducteur',
    '<form id="newDriverForm" class="inline-form"><label>Nom affiché<input name="name" maxlength="90" autocomplete="off" required placeholder="Nom ou matricule"></label><label>Matricule facultatif<input name="number" maxlength="40" placeholder="Ex. 0042"></label><button class="btn accent" type="submit">Créer le conducteur</button></form>')+
    htmlCard('Conducteurs locaux',store.drivers.length?'<div class="rows">'+store.drivers.map(d=>'<div class="person-row"><div><strong>'+esc(d.name)+'</strong><small>'+esc(d.number||'Sans matricule')+' · '+forDriver(d.id).length+' activité(s)</small></div><div>'+htmlButton('Renommer','renameDriver','muted small','data-id="'+esc(d.id)+'"')+htmlButton('Supprimer','deleteDriver','danger small','data-id="'+esc(d.id)+'"')+'</div></div>').join('')+'</div>':'<div class="empty">Aucun conducteur. Crée le premier ci-contre.</div>')+'</div>'+
    info('Aucun compte sécurisé n’est créé : il s’agit de profils de planning locaux. Les vrais comptes et droits seront intégrés avec le serveur.')
    ;
  }
  function vehicles(){
    return '<div class="grid cols-2">'+htmlCard('Ajouter un véhicule',
    '<form id="newVehicleForm" class="inline-form"><label>Immatriculation, parc ou identifiant<input name="name" maxlength="90" required placeholder="Ex. Crossway 312"></label><button class="btn accent" type="submit">Ajouter le véhicule</button></form>')+
    htmlCard('Parc local',store.vehicles.length?'<div class="rows">'+store.vehicles.map(v=>'<div class="person-row"><strong>'+esc(v.name)+'</strong>'+htmlButton('Supprimer','deleteVehicle','danger small','data-id="'+esc(v.id)+'"')+'</div>').join('')+'</div>':'<div class="empty">Aucun véhicule saisi.</div>')+'</div>'+
    info('L’ajout d’un véhicule permet de signaler une double affectation simultanée, entre deux conducteurs. La disponibilité réelle n’est pas synchronisée.')
    ;
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
  const pages={driver:driving,mine,planning,week,drivers,vehicles,backup};
  function render(){
    if(!navs[state.role].some(v=>v[0]===state.view))state.view=navs[state.role][0][0];
    $('roleDriver').classList.toggle('active',state.role==='driver');$('roleOps').classList.toggle('active',state.role==='ops');
    $('roleDriver').setAttribute('aria-pressed',String(state.role==='driver'));$('roleOps').setAttribute('aria-pressed',String(state.role==='ops'));
    $('navigation').innerHTML=navs[state.role].map(v=>'<button class="nav-link '+(state.view===v[0]?'active':'')+'" data-view="'+v[0]+'" type="button">'+ico[v[0]]+' <span>'+v[1]+'</span></button>').join('');
    $('breadcrumb').textContent=state.role==='driver'?'CONDUITE':'EXPLOITATION';
    $('pageTitle').textContent=navs[state.role].find(v=>v[0]===state.view)?.[1]||'Mon SAEIV';
    $('datePill').textContent=dateText(state.date);
    $('statusBanner').textContent=storageError||'Conduite : SAEIV Fluo réel. Exploitation : planning utilisable et sauvegardé sur cet appareil, sans synchronisation ni publication serveur.';
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
    const drivers=raw.drivers.map(d=>({id:text(d.id,100),name:text(d.name,90),number:text(d.number,40)}));
    const vehicles=raw.vehicles.map(v=>({id:text(v.id,100),name:text(v.name,90)}));
    const ids=new Set(drivers.map(d=>d.id)),vids=new Set(vehicles.map(v=>v.id));
    const activities=raw.activities.map(a=>{
      if(!isDay(a.date)||!isTime(a.start)||!isTime(a.end)||!types[a.type]||!ids.has(a.driverId)||a.vehicleId&&!vids.has(a.vehicleId))
        throw Error('Au moins une activité contient des dates, heures ou affectations invalides.');
      return {id:text(a.id,100),date:a.date,driverId:a.driverId,type:a.type,start:a.start,end:a.end,label:text(a.label,120),from:text(a.from),to:text(a.to),vehicleId:text(a.vehicleId,100),note:text(a.note,300)};
    });
    if(new Set(drivers.map(d=>d.id)).size!==drivers.length||new Set(activities.map(a=>a.id)).size!==activities.length)throw Error('Identifiants dupliqués dans la sauvegarde.');
    return {version:1,drivers,vehicles,activities,updatedAt:text(raw.updatedAt,60)};
  }
  function onAction(kind,id){
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
      state.driverId=store.drivers[0]?.id||'';state.weekId=state.driverId;persist();
    }
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
    const act=e.target.closest('[data-action]');if(act&&!act.disabled)onAction(act.dataset.action,act.dataset.id);
  });
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset.input==='date'&&isDay(t.value)){state.date=t.value;render();}
    if(t.id==='selfDriver'){state.driverId=t.value;render();}
    if(t.id==='weekDriver'){state.weekId=t.value;render();}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id==='newDriverForm'){
      e.preventDefault();
      const d=new FormData(e.target),name=String(d.get('name')||'').trim(),number=String(d.get('number')||'').trim();
      if(!name)return;
      const id=uid();store.drivers.push({id,name:name.slice(0,90),number:number.slice(0,40)});
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
  $('roleDriver').addEventListener('click',()=>{state.role='driver';state.view='driver';render();});
  $('roleOps').addEventListener('click',()=>{state.role='ops';state.view='planning';render();});
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
  render();
})();