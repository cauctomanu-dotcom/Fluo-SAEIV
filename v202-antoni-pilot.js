'use strict';
/* Shared, company-neutral dispatcher UI. Original planners and GTFS unchanged. */
(()=>{
 if(window.MonSAEIVAntoniPilotV202?.installed)return;
 const q=id=>document.getElementById(id),cloud=()=>window.MonSAEIVCloudV156,board=()=>window.MonSAEIVOperationsBoardV165;
 const permitted=()=>['dispatcher','admin'].includes(String(cloud()?.profile?.role||''));
 const pad=n=>String(n).padStart(2,'0');
 const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const date=s=>{const m=String(s||'').match(/^(\d{4})-(\d\d)-(\d\d)$/);return m?new Date(+m[1],+m[2]-1,+m[3],12):new Date()};
 const add=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d)};
 const labelDate=s=>date(s).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
 const css=[
 'body.saeiv-shared-ops #v157Dispatch{background:#f3f5f7!important;color:#293d4b!important;font:400 15px/1.5 system-ui,-apple-system,sans-serif!important}',
 'body.saeiv-shared-ops #v157Dispatch .v157-shell{box-sizing:border-box;width:min(1860px,100%)!important;max-width:none!important;padding:clamp(10px,1.6vw,24px)!important}',
 'body.saeiv-shared-ops #v157Dispatch .v157-top,body.saeiv-shared-ops #v157Dispatch .v157-panel,body.saeiv-shared-ops #v157Dispatch .v157-role-tabs,body.saeiv-shared-ops #v157Dispatch .v157-admin-hero{background:#fff!important;color:#293f4d!important;border:1px solid #dce5e9!important;border-radius:12px!important;box-shadow:none!important}',
 'body.saeiv-shared-ops #v157Dispatch .v157-top{align-items:center;padding:16px 20px!important}body.saeiv-shared-ops #v157Dispatch .v157-top h1{color:#284557!important;font-size:24px!important}body.saeiv-shared-ops #v157Dispatch .v157-top p{color:#627989!important;font-size:14px!important}body.saeiv-shared-ops #v157Dispatch #v157Eyebrow{color:#537a90!important;font-size:11px!important}',
 'body.saeiv-shared-ops #v157Dispatch .v157-role-badge{background:#eaf2f6!important;color:#33586c!important;border-color:#d2e1e9!important;font-size:11px!important}',
 'body.saeiv-shared-ops #v157Dispatch .v157-top-actions button,body.saeiv-shared-ops #v157Dispatch .v157-role-tabs button{background:#eff3f6!important;color:#33586c!important;border:1px solid #d0dfe7!important;font-size:14px!important;border-radius:9px!important}',
 'body.saeiv-shared-ops #v157Dispatch .v157-role-tabs button.active{background:#dcebf1!important;color:#285870!important;border-color:#adc9d8!important}',
 'body.saeiv-shared-ops #v157Dispatch .v157-admin-hero p,body.saeiv-shared-ops #v157Dispatch .v157-panel small{color:#5f7585!important;font-size:13px!important}body.saeiv-shared-ops #v157Dispatch .v157-panel h2,body.saeiv-shared-ops #v157Dispatch .v157-panel h3{color:#294658!important}',
 'body.saeiv-shared-ops #v165Board{--sa-track:1680px;color:#2b4150!important;background:transparent!important;border:none!important;padding:0!important;font:400 15px/1.55 system-ui,sans-serif!important;min-width:0;max-width:100%}',
 'body.saeiv-shared-ops #v165Board .v165-toolbar,body.saeiv-shared-ops #v165Board .v165-toolbox,body.saeiv-shared-ops #v165Board .v165-advice,body.saeiv-shared-ops #v165Board .v165-grid-wrap,body.saeiv-shared-ops #v165Board .v165-metric,body.saeiv-shared-ops #v165Board #v198Controls{background:#fff!important;color:#294254!important;border:1px solid #dce5e9!important;border-radius:12px!important;box-shadow:none!important}',
 'body.saeiv-shared-ops #v165Board .v165-toolbar{padding:14px!important;margin-top:10px!important;position:static!important;z-index:auto!important;gap:9px!important;align-items:center!important}',
 'body.saeiv-shared-ops #v165Board .v165-toolbar button,body.saeiv-shared-ops #v165Board #v198Controls button{background:#edf3f6!important;color:#2d566c!important;border:1px solid #cfdee6!important;border-radius:8px!important;font:650 14px system-ui!important;min-height:43px!important;padding:9px 12px!important;white-space:normal!important}',
 'body.saeiv-shared-ops #v165Board #v165Generate{background:#416e87!important;color:#fff!important;border-color:#416e87!important}',
 'body.saeiv-shared-ops #v165Board .v165-depts label{background:#f2f6f8!important;border-color:#d8e4e9!important;color:#426175!important;padding:8px!important;font-size:13px!important}',
 'body.saeiv-shared-ops #v165Board .v165-status,body.saeiv-shared-ops #v165Board #v190Status{color:#566f7e!important;font-size:13px!important;line-height:1.5!important}',
 'body.saeiv-shared-ops #v165Board .v165-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;margin:11px 0!important}body.saeiv-shared-ops #v165Board .v165-metric{padding:13px!important}body.saeiv-shared-ops #v165Board .v165-metric b{font-size:21px!important;color:#294456!important}body.saeiv-shared-ops #v165Board .v165-metric span{font-size:13px!important;color:#647b88!important}',
 'body.saeiv-shared-ops #v165Board .v165-alert{background:#f2f6f8!important;color:#566f7e!important;border:1px solid #dce5e9!important;font-size:13px!important;font-weight:500!important}',
 'body.saeiv-shared-ops #v165Board .v165-work{display:grid;grid-template-columns:minmax(270px,310px) minmax(0,1fr);gap:12px;min-width:0;align-items:start}',
 'body.saeiv-shared-ops #v165Board .v165-toolbox{position:sticky!important;top:12px!important;max-height:70vh!important;overflow:auto!important;padding:13px!important}body.saeiv-shared-ops #v165Board .v165-toolbox-head{background:#fff!important;color:#29495b!important;border-color:#dce5e9!important}',
 'body.saeiv-shared-ops #v165Board .v165-toolbox h3,body.saeiv-shared-ops #v165Board .v165-advice h3{font-size:17px!important;color:#294658!important}body.saeiv-shared-ops #v165Board .v165-advice-list{font-size:13px!important;color:#5f7583!important}',
 'body.saeiv-shared-ops #v165Board .v165-toolbox input,body.saeiv-shared-ops #v165Board .v165-toolbox select{font:400 14px system-ui!important;color:#2f4758!important;background:#fff!important;min-height:42px!important;border:1px solid #b9ccd6!important;min-width:0!important}',
 'body.saeiv-shared-ops #v165Board .v165-seg{background:#f9fbfc!important;border:1px solid #d9e4e9!important;color:#284454!important;padding:12px!important}body.saeiv-shared-ops #v165Board .v165-seg.assigned{background:#edf6f1!important}body.saeiv-shared-ops #v165Board .v165-seg b{font-size:15px!important;color:#2b4354!important}body.saeiv-shared-ops #v165Board .v165-seg span{font-size:13px!important;color:#4d6373!important}body.saeiv-shared-ops #v165Board .v165-seg small{font-size:12px!important;color:#647986!important}',
 'body.saeiv-shared-ops #v165Board .v165-auto-note{background:#f4f7f9!important;color:#5b7481!important;font-size:13px!important;line-height:1.5!important;border-color:#dce5e9!important}',
 'body.saeiv-shared-ops #v165Board .v165-grid-wrap{position:relative;max-height:74vh!important;overflow:auto!important;overscroll-behavior:contain;background:#fff!important}',
 'body.saeiv-shared-ops #v165Board .v165-timehead,body.saeiv-shared-ops #v165Board .v165-driver-row{grid-template-columns:205px minmax(var(--sa-track),1fr)!important}',
 'body.saeiv-shared-ops #v165Board .v165-timehead{background:#ecf2f5!important;color:#2d4b5e!important}body.saeiv-shared-ops #v165Board .v165-time-label{background:#ecf2f5!important;color:#2d4b5e!important;position:sticky!important;left:0!important;z-index:8!important;font-size:14px!important}',
 'body.saeiv-shared-ops #v165Board .v165-hours,body.saeiv-shared-ops #v165Board .v165-lane{min-width:var(--sa-track)!important}body.saeiv-shared-ops #v165Board .v165-hour{font-size:12px!important;color:#5a7584!important;border-color:#c7d8e0!important}',
 'body.saeiv-shared-ops #v165Board .v165-driver-row{background:#fff!important;border-color:#e0e9ed!important;min-height:98px!important}body.saeiv-shared-ops #v165Board .v165-driver-meta{position:sticky!important;left:0!important;z-index:5!important;background:#fff!important;padding:10px!important;min-height:98px!important}',
 'body.saeiv-shared-ops #v165Board .v198-driver-name{font-size:15px!important;color:#2c5973!important;font-weight:800!important;text-align:left!important}body.saeiv-shared-ops #v165Board .v165-driver-meta span,body.saeiv-shared-ops #v165Board .v165-driver-meta small{font-size:12px!important;color:#5d7482!important}',
 'body.saeiv-shared-ops #v165Board .v165-lane{min-height:98px!important;background:repeating-linear-gradient(90deg,#fff 0,#fff 79px,#edf3f6 80px)!important}',
 'body.saeiv-shared-ops #v165Board .v165-block{height:32px!important;font:700 12px system-ui!important;background:#dcebf2!important;color:#294a5e!important;border:1px solid #a8c4d1!important;border-radius:6px!important;padding:7px!important;overflow:hidden!important;text-overflow:clip!important;min-width:12px!important}body.saeiv-shared-ops #v165Board .v165-block:nth-child(even){top:48px!important}body.saeiv-shared-ops #v165Board .v165-block.hlp{background:#e7ecee!important;color:#445967!important;border-color:#b7c5cd!important}body.saeiv-shared-ops #v165Board .v165-block.cut,body.saeiv-shared-ops #v165Board .v165-block.pause{background:#eeeae2!important;color:#665b47!important;border-color:#cdc5b5!important}',
 'body.saeiv-shared-ops #v165Board #v198Controls,body.saeiv-shared-ops #v165Board #v198DayDetail{background:#fff!important;color:#314f61!important;border-color:#dce5e9!important}body.saeiv-shared-ops #v165Board #v198DayDetail h3{color:#2f566d!important}body.saeiv-shared-ops #v165Board #v198DayActivities .v198-detail-item{color:#314b5a!important;font-size:14px!important}body.saeiv-shared-ops #v165Board #v198DayActivities .v198-detail-time{color:#32617d!important}body.saeiv-shared-ops #v165Board #v198DayActivities .v198-detail-content small{color:#647b89!important;font-size:12px!important}',
 'body.saeiv-shared-ops #v165Board #v201OperatorLabel{display:none!important}',
 '#saeivWorkHeader{display:flex;gap:14px;justify-content:space-between;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid #dce5e9;border-radius:12px;padding:16px;margin-bottom:12px;color:#2b4556}#saeivWorkHeader h2{margin:0;font-size:20px;color:#31546a}#saeivWorkHeader p{margin:3px 0 0;font-size:13px;color:#607887}',
 '#saeivWorkToggle{background:#edf3f6;border:1px solid #cadbe3;color:#2e566d;min-height:43px;border-radius:9px;padding:8px 13px;font-size:14px;font-weight:700}',
 '#saeivDateBar{display:flex;gap:13px;align-items:end;flex-wrap:wrap;background:#fff;color:#29485a;border:1px solid #dce5e9;border-radius:12px;padding:15px;margin:12px 0;position:relative;z-index:10}',
 '#saeivDateBar .saeiv-date-field{display:flex;gap:8px;align-items:end;flex-wrap:wrap}#saeivDateBar label{display:flex;flex-direction:column;gap:5px;font-size:14px;font-weight:750;color:#29495b;line-height:1.4}',
 '#saeivDateBar input[type=date]{box-sizing:border-box;appearance:auto;-webkit-appearance:auto;pointer-events:auto!important;display:block!important;width:178px;max-width:100%;min-height:46px;padding:9px 11px;font:650 16px system-ui;background:white;color:#213c4d;color-scheme:light;border:1px solid #b6cad4;border-radius:8px}',
 '#saeivDateBar button{min-height:45px;padding:9px 13px;background:#eef4f7;color:#30576e;border:1px solid #cbdce4;border-radius:8px;font:700 14px system-ui;cursor:pointer}',
 '#saeivDateBar #saeivDayLabel{color:#4b6878;font-size:14px;font-weight:650;padding:12px 10px;background:#f2f6f8;border-radius:8px;align-self:end}',
 '#saeivDateBar .saeiv-date-hint{margin:0;flex:1 1 100%;color:#718390;font-size:12px;line-height:1.5}',
 '#saeivCalendar{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:15px;background:rgba(19,34,45,.58)}#saeivCalendar[hidden]{display:none!important}',
 '#saeivCalendar .cal-card{background:#fff;color:#294759;border-radius:15px;border:1px solid #dce5e9;width:min(370px,100%);max-height:94dvh;overflow:auto;padding:16px;box-shadow:0 16px 54px #132d3f48}',
 '#saeivCalendar .cal-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:13px}#saeivCalendar .cal-head strong{font-size:17px;text-transform:capitalize}',
 '#saeivCalendar button{background:#f2f6f8;border:1px solid #d9e4e9;border-radius:8px;min-height:42px;min-width:40px;font:700 15px system-ui;color:#315369;cursor:pointer}',
 '#saeivCalendar .cal-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}#saeivCalendar .cal-days button{min-width:0;padding:0;background:white}#saeivCalendar .cal-days button[aria-current=date]{background:#315f7b;color:#fff;border-color:#315f7b}',
 '#saeivCalendar .cal-weekday{color:#65808f;font-size:12px;font-weight:750;text-align:center;padding:7px 0}#saeivCalendar .cal-foot{margin-top:13px;display:flex;justify-content:end;gap:8px}#saeivCalendar #calToday{margin-right:auto}',
 '#saeivGridTools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;background:#fff;border:1px solid #dce5e9;border-radius:10px;padding:10px 13px;color:#547182;font-size:13px;margin:10px 0 8px}#saeivGridTools span{margin-right:auto}#saeivGridTools button{min-width:38px;min-height:38px;background:#f1f5f7;border:1px solid #cddce4;border-radius:8px;color:#325a70;font:700 16px system-ui}',
 'body.saeiv-shared-ops.saeiv-hide-toolbox #v165Board .v165-work{grid-template-columns:minmax(0,1fr)!important}body.saeiv-shared-ops.saeiv-hide-toolbox #v165Board .v165-toolbox{display:none!important}',
 '@media(max-width:1120px){body.saeiv-shared-ops #v165Board .v165-work{grid-template-columns:1fr!important}body.saeiv-shared-ops #v165Board .v165-toolbox{position:static!important;max-height:40vh!important}}',
 '@media(max-width:680px){body.saeiv-shared-ops #v157Dispatch .v157-top{flex-direction:column;align-items:stretch!important}body.saeiv-shared-ops #v165Board .v165-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}body.saeiv-shared-ops #v165Board .v165-toolbar>button{flex:1 1 45%}body.saeiv-shared-ops #v165Board .v165-timehead,body.saeiv-shared-ops #v165Board .v165-driver-row{grid-template-columns:155px minmax(var(--sa-track),1fr)!important}body.saeiv-shared-ops #v165Board .v165-driver-meta{width:155px!important}#saeivDateBar{gap:9px}#saeivDateBar .saeiv-date-field{flex:1 1 100%}#saeivDateBar label{flex:1 1 60%}#saeivDateBar input[type=date]{width:100%}#saeivDateBar #saeivDayLabel{flex:1 1 100%}}'
 ];
 let calInput=null,calMonth=null,returnFocus=null,scale=1680;
 function style(){if(q('saeivSharedDispatchStyle'))return;const node=document.createElement('style');node.id='saeivSharedDispatchStyle';node.textContent=css.join('\n');document.head.append(node)}
 function dateLabel(){const el=q('saeivDayLabel');if(el)el.textContent='Journée affichée : '+date(board()?.date||q('v165Date')?.value).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
 function makeCalendar(){
  if(q('saeivCalendar'))return;
  const root=document.createElement('section');root.id='saeivCalendar';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Calendrier du planning');
  root.innerHTML='<div class="cal-card"><div id="calPurpose" style="font-weight:750;margin-bottom:8px;color:#5a7484"></div><div class="cal-head"><button id="calPrev" type="button" aria-label="Mois précédent">‹</button><strong id="calMonth"></strong><button id="calNext" type="button" aria-label="Mois suivant">›</button></div><div class="cal-days"><span class="cal-weekday">Lun</span><span class="cal-weekday">Mar</span><span class="cal-weekday">Mer</span><span class="cal-weekday">Jeu</span><span class="cal-weekday">Ven</span><span class="cal-weekday">Sam</span><span class="cal-weekday">Dim</span></div><div class="cal-days" id="calDays"></div><div class="cal-foot"><button id="calToday" type="button">Aujourd’hui</button><button id="calClose" type="button">Fermer</button></div></div>';
  document.body.append(root);
  root.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b){if(e.target===root)closeCalendar();return}
   if(b.dataset.date)return choose(b.dataset.date);
   if(b.id==='calClose')return closeCalendar();
   if(b.id==='calToday')return choose(iso(new Date()));
   if(b.id==='calPrev'||b.id==='calNext'){calMonth.setMonth(calMonth.getMonth()+(b.id==='calNext'?1:-1));renderCalendar()}
  });
 }
 function renderCalendar(){
  if(!calMonth)return;
  q('calMonth').textContent=calMonth.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const y=calMonth.getFullYear(),m=calMonth.getMonth(),last=new Date(y,m+1,0).getDate(),blanks=(new Date(y,m,1).getDay()+6)%7,sel=q(calInput)?.value;
  let html='';for(let i=0;i<blanks;i++)html+='<span aria-hidden="true"></span>';
  for(let day=1;day<=last;day++){const key=iso(new Date(y,m,day,12));html+='<button type="button" data-date="'+key+'"'+(sel===key?' aria-current="date"':'')+' aria-label="'+day+'/'+pad(m+1)+'/'+y+'">'+day+'</button>'}
  q('calDays').innerHTML=html;
 }
 function openCalendar(id,trigger){
  if(!q(id))return;
  calInput=id;returnFocus=trigger;const d=date(q(id).value||q('v165Date')?.value);
  calMonth=new Date(d.getFullYear(),d.getMonth(),1,12);
  q('calPurpose').textContent=id==='v165Date'?'Choisir le début de période':'Choisir la fin de période';
  q('saeivCalendar').hidden=false;renderCalendar();q('calClose').focus();
 }
 function closeCalendar(){q('saeivCalendar').hidden=true;calInput=null;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true})}
 function choose(value){
  const el=q(calInput),start=q('v165Date'),end=q('v190End');
  if(!el)return;el.value=value;
  if(el===start&&end?.value&&end.value<value){end.value=value;end.dispatchEvent(new Event('change',{bubbles:true}))}
  if(el===end&&start?.value&&start.value>value){start.value=value;start.dispatchEvent(new Event('change',{bubbles:true}))}
  el.dispatchEvent(new Event('change',{bubbles:true}));closeCalendar();
 }
 function makeDates(root){
  if(q('saeivDateBar'))return;
  const start=q('v165Date'),end=q('v190End'),toolbar=root.querySelector('.v165-toolbar');
  if(!start||!end||!toolbar)return;
  const l1=start.closest('label'),l2=end.closest('label');if(!l1||!l2)return;
  const bar=document.createElement('section');bar.id='saeivDateBar';bar.setAttribute('aria-label','Dates de planification');
  bar.innerHTML='<div id="saeivStart" class="saeiv-date-field"></div><div id="saeivEnd" class="saeiv-date-field"></div><button id="saeivDayPrev" type="button" aria-label="Journée précédente">‹</button><span id="saeivDayLabel"></span><button id="saeivDayNext" type="button" aria-label="Journée suivante">›</button><p class="saeiv-date-hint">Du et Au délimitent la période de génération. Le jour affiché dans le tableau peut ensuite être parcouru avec les flèches.</p>';
  toolbar.insertAdjacentElement('beforebegin',bar);
  q('saeivStart').append(l1);q('saeivEnd').append(l2);
  if(l1.firstChild?.nodeType===3)l1.firstChild.textContent='Du';
  if(l2.firstChild?.nodeType===3)l2.firstChild.textContent='Au';
  for(const [container,id] of [['saeivStart','v165Date'],['saeivEnd','v190End']]){
   const b=document.createElement('button');b.type='button';b.textContent='Calendrier';b.setAttribute('aria-label','Ouvrir le calendrier '+(id==='v165Date'?'de début':'de fin'));
   b.addEventListener('click',()=>openCalendar(id,b));q(container).append(b);
  }
  for(const [id,step] of [['saeivDayPrev',-1],['saeivDayNext',1]]){
   q(id).addEventListener('click',async()=>{
    try{await board().setDate(add(board().date||start.value,step));
     // The period start and the displayed day are separate.
     if(window.MonSAEIVWeeklyV190?.rangeStart)start.value=window.MonSAEIVWeeklyV190.rangeStart;
     dateLabel();
    }catch(e){q('saeivDayLabel').textContent='Date non chargée : '+(e.message||String(e))}
   });
  }
  dateLabel();
 }
 function makeHeader(root){
  if(q('saeivWorkHeader'))return;
  const h=document.createElement('section');h.id='saeivWorkHeader';
  h.innerHTML='<div><h2>Préparation des services</h2><p>Planning commun à toutes les sociétés · courses et conducteurs filtrés selon votre entreprise.</p></div><button id="saeivWorkToggle" type="button" aria-expanded="true">Masquer les segments</button>';
  root.prepend(h);
  q('saeivWorkToggle').addEventListener('click',()=>{
   const hide=document.body.classList.toggle('saeiv-hide-toolbox');
   q('saeivWorkToggle').textContent=hide?'Afficher les segments':'Masquer les segments';
   q('saeivWorkToggle').setAttribute('aria-expanded',String(!hide));
  });
 }
 function makeZoom(root){
  if(q('saeivGridTools'))return;
  const grid=q('v165Grid');if(!grid)return;
  const tools=document.createElement('div');tools.id='saeivGridTools';
  tools.innerHTML='<span>Planning horaire · défile horizontalement · touche un conducteur pour sa journée</span><button id="saeivZoomOut" type="button" aria-label="Réduire le zoom">−</button><button id="saeivZoomIn" type="button" aria-label="Agrandir le zoom">+</button>';
  grid.insertAdjacentElement('beforebegin',tools);
  for(const [id,diff] of [['saeivZoomOut',-240],['saeivZoomIn',240]])q(id).addEventListener('click',()=>{scale=Math.max(1200,Math.min(2640,scale+diff));root.style.setProperty('--sa-track',scale+'px')});
 }
 function sync(){
  const active=permitted();
  document.body?.classList.toggle('saeiv-shared-ops',active);
  if(!active)return;
  style();const root=q('v165Board');if(!root)return;
  for(const id of ['antoniPilotVisuals','antoniPilotNav','antoniPilotHead','antoniLinesPanel','antoniPilotModal'])q(id)?.remove();
  document.body.classList.remove('saeiv-antoni-pilot');delete document.body.dataset.antoniView;
  makeHeader(root);makeDates(root);makeZoom(root);dateLabel();
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&q('saeivCalendar')&&!q('saeivCalendar').hidden)closeCalendar()});
 document.addEventListener('saeiv-board-updated',dateLabel);
 const init=()=>{makeCalendar();sync();setInterval(sync,1500)};
 window.MonSAEIVAntoniPilotV202={installed:true,version:'1.0.117',sync,openDriverDay:id=>window.MonSAEIVPlanningUXV198?.choose?.(String(id))};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
