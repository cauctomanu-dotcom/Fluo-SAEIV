'use strict';
/* ANTONI PILOT ONLY. No global GTFS, driver cockpit or PILOTE overrides. */
(()=>{
 if(window.MonSAEIVAntoniPilotV202?.installed)return;
 const ANTONI='533814ff-a356-4b65-ba94-c5ca36ce917a';
 const q=id=>document.getElementById(id);
 const cloud=()=>window.MonSAEIVCloudV156;
 const board=()=>window.MonSAEIVOperationsBoardV165;
 const isPilot=()=>String(cloud()?.profile?.organization_id||'')===ANTONI &&
   ['dispatcher','admin'].includes(String(cloud()?.profile?.role||''));
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const mins=s=>{const m=String(s||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
 const span=(a,b)=>{let s=mins(a),e=mins(b);if(s===null||e===null)return 0;if(e<s)e+=1440;return e-s};
 const human=n=>Math.floor(n/60)+' h '+String(n%60).padStart(2,'0');
 function installStyle(){
  if(q('antoniPilotVisuals'))return;
  const st=document.createElement('style');st.id='antoniPilotVisuals';
  st.textContent=[
   'body.saeiv-antoni-pilot #v165Board,body.saeiv-antoni-pilot #v157Dispatch,body.saeiv-antoni-pilot #v187Planning{background:#f4f7fa!important;color:#1d3444!important;border:1px solid #d5e1e8!important;border-radius:19px!important}',
   'body.saeiv-antoni-pilot #v165Board{font-size:14px!important;line-height:1.5!important;padding:clamp(10px,2vw,23px)!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-toolbar,body.saeiv-antoni-pilot #v165Board .v165-toolbox,body.saeiv-antoni-pilot #v165Board .v165-advice,body.saeiv-antoni-pilot #v165Board .v165-metric,body.saeiv-antoni-pilot #v165Board .v165-alert,body.saeiv-antoni-pilot #v165Board .v165-grid-wrap{background:#fff!important;color:#263e4d!important;border:1px solid #d8e4e9!important;border-radius:13px!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-metric b{color:#20394a!important;font-size:1.22rem!important}body.saeiv-antoni-pilot #v165Board .v165-metric span{color:#536c78!important;font-size:.82rem!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-work{grid-template-columns:minmax(270px,30%) minmax(0,1fr)!important;align-items:start!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-toolbox{position:sticky!important;max-height:76vh!important;top:10px!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-seg{color:#213846!important;background:#f7fbfc!important;border:1px solid #d8e5e9!important;border-radius:12px!important;padding:11px!important;margin:5px 0!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-seg small,body.saeiv-antoni-pilot #v165Board .v165-seg span{font-size:.78rem!important;color:#455f70!important;line-height:1.5!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-seg b{font-size:.93rem!important;color:#163347!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-timehead{background:#e9f0f4!important;color:#19384a!important;position:sticky!important;top:0!important;z-index:8!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-time-label,body.saeiv-antoni-pilot #v165Board .v165-driver-meta{background:#f5f9fc!important;color:#163347!important;border-right:1px solid #dbe5e9!important;position:sticky!important;left:0!important;z-index:4!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-driver-meta{padding:13px 11px!important;min-height:114px!important;overflow:visible!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-driver-meta span,body.saeiv-antoni-pilot #v165Board .v165-driver-meta small{font-size:.78rem!important;line-height:1.4!important;color:#506a79!important}',
   'body.saeiv-antoni-pilot #v165Board .v198-driver-name{font-size:1rem!important;font-weight:800!important;text-align:left!important;color:#125277!important;min-height:37px!important;white-space:normal!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-driver-row{border-bottom:1px solid #dce6ea!important;min-height:114px!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-lane{background:repeating-linear-gradient(90deg,#fbfdfe 0,#fbfdfe 79px,#e8eff2 80px)!important;min-height:114px!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-block{font-size:.76rem!important;line-height:1.4!important;min-height:40px!important;border-radius:7px!important;overflow:hidden!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-grid-wrap{max-height:76vh!important;overflow:auto!important;overscroll-behavior:contain!important}',
   'body.saeiv-antoni-pilot #v165Board button,body.saeiv-antoni-pilot #v165Board input,body.saeiv-antoni-pilot #v165Board select{font-size:13px!important;min-height:39px!important}',
   'body.saeiv-antoni-pilot #v165Board input,body.saeiv-antoni-pilot #v165Board select{color:#203747!important;background:#fff!important;border:1px solid #a8bcc9!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-status,body.saeiv-antoni-pilot #v165Board #v190Status{font-size:13px!important;font-weight:650!important}',
   'body.saeiv-antoni-pilot #v165Board #v190Builder{background:#fff!important;color:#1e3746!important;border-color:#c1d7e3!important}',
   'body.saeiv-antoni-pilot #v165Board .v165-toolbox h3,body.saeiv-antoni-pilot #v165Board .v165-advice h3{font-size:1.04rem!important;color:#183747!important}',
   '#antoniPilotHead{background:linear-gradient(115deg,#f5fafc,#e7f3f7);border:1px solid #c9e0e8;padding:17px 20px;border-radius:15px;margin-bottom:13px;color:#16394b}',
   '#antoniPilotHead h2{font-size:1.4rem;letter-spacing:-.025em;margin:0 0 6px;color:#123b51}#antoniPilotHead p{font-size:.86rem;line-height:1.55;margin:0;color:#416173}',
   '.antoni-open-day{display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:6px 10px!important;margin-top:8px!important;background:#0a5978!important;color:#fff!important;border:1px solid #0a5978!important;border-radius:8px!important;font-weight:800!important;min-height:38px!important}',
   '#antoniPilotModal{position:fixed;inset:0;z-index:2147483590;background:rgba(9,25,36,.64);display:flex;justify-content:center;align-items:center;padding:16px}',
   '#antoniPilotModal[hidden]{display:none!important}#antoniPilotModal .antoni-panel{background:#fff;color:#17384b;border-radius:18px;max-width:1000px;width:100%;max-height:94dvh;overflow:auto;box-shadow:0 22px 70px #071b2655;border:1px solid #d6e5ee}',
   '#antoniPilotModal header{position:sticky;top:0;z-index:1;background:#fff;border-bottom:1px solid #dbe6ec;padding:18px 23px;display:flex;justify-content:space-between;align-items:center;gap:12px}#antoniPilotModal h2{font-size:1.36rem;color:#15384a;margin:0}#antoniPilotModal header p{margin:4px 0 0;color:#567181}',
   '#antoniPilotModal .antoni-body{padding:20px 23px}#antoniPilotModal .antoni-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:17px}#antoniPilotModal .antoni-stat{border:1px solid #d6e5ea;border-radius:11px;background:#f2f7fa;padding:13px;font-weight:800}#antoniPilotModal .antoni-stat small{display:block;font-weight:500;color:#527080;margin-bottom:4px;font-size:.8rem}',
   '#antoniPilotModal .antoni-item{display:grid;grid-template-columns:130px 120px 1fr;gap:12px;align-items:start;padding:13px 14px;border-bottom:1px solid #e0eaee;font-size:.9rem}#antoniPilotModal .antoni-item:nth-child(2n){background:#f6f9fb}#antoniPilotModal .antoni-item strong{color:#144661}#antoniPilotModal .antoni-item small{display:block;color:#617988;font-size:.78rem}',
   '#antoniPilotClose{font-size:15px;min-width:45px;min-height:45px;border-radius:10px;background:#eef4f7;color:#183e50;border:1px solid #bfd2dd}',
   '@media(max-width:900px){body.saeiv-antoni-pilot #v165Board .v165-work{grid-template-columns:1fr!important}body.saeiv-antoni-pilot #v165Board .v165-toolbox{position:static!important;max-height:36vh!important}#antoniPilotModal .antoni-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}',
   '@media(max-width:650px){#antoniPilotModal{padding:0;align-items:flex-end}#antoniPilotModal .antoni-panel{border-radius:18px 18px 0 0;max-height:96dvh}#antoniPilotModal .antoni-item{grid-template-columns:87px 1fr}#antoniPilotModal .antoni-item .antoni-desc{grid-column:1/-1}body.saeiv-antoni-pilot #v165Board{padding:8px!important}}'
  ].join('\n');
  document.head.append(st);
 }
 function installModal(){
  if(q('antoniPilotModal'))return;
  const root=document.createElement('div');root.id='antoniPilotModal';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Journée du conducteur');
  root.innerHTML='<section class="antoni-panel"><header><div><h2 id="antoniPilotModalTitle">Journée du conducteur</h2><p id="antoniPilotModalSub"></p></div><button id="antoniPilotClose" type="button" aria-label="Fermer le détail">✕</button></header><div class="antoni-body"><div class="antoni-stats" id="antoniPilotStats"></div><div id="antoniPilotRows"></div></div></section>';
  document.body.append(root);q('antoniPilotClose').addEventListener('click',close);
  root.addEventListener('click',e=>{if(e.target===root)close()});
 }
 function close(){if(q('antoniPilotModal'))q('antoniPilotModal').hidden=true}
 function open(driverId){
  if(!isPilot())return;
  const b=board();if(!b)return;
  installModal();
  const driver=(b.drivers||[]).find(x=>String(x.user_id)===String(driverId));
  if(!driver)return;
  const date=b.date;
  const items=[...(b.items||[]),...(b.draftItems||[])].filter(x=>
    String(x.driver_user_id)===String(driverId)&&String(x.service_date||date)===String(date)&&x.start_time&&x.end_time)
    .sort((a,b)=>(mins(a.start_time)??99999)-(mins(b.start_time)??99999));
  const trips=items.filter(x=>['regular','school','tad'].includes(x.type));
  const first=items[0],last=items[items.length-1],amplitude=first&&last?span(first.start_time,last.end_time):0;
  const totalDriving=trips.reduce((t,x)=>t+span(x.start_time,x.end_time),0);
  const status=(b.officialDriverIds||[]).includes(String(driverId))?'Planning publié':(b.draftDriverIds||[]).includes(String(driverId))?'Brouillon de test':'Aucun brouillon enregistré';
  q('antoniPilotModalTitle').textContent=driver.display_name||driver.matricule||'Conducteur';
  q('antoniPilotModalSub').textContent='Matricule '+driver.matricule+' · '+date+' · '+status;
  const stats=[['Début',first?.start_time?.slice(0,5)||'—'],['Fin',last?.end_time?.slice(0,5)||'—'],['Amplitude',first?human(amplitude):'—'],['Courses',String(trips.length)]];
  q('antoniPilotStats').innerHTML=stats.map(x=>'<div class="antoni-stat"><small>'+esc(x[0])+'</small>'+esc(x[1])+'</div>').join('');
  q('antoniPilotRows').innerHTML=items.length?items.map(x=>{
    const mode=x.linked?.reservationRequired||x.linked?.serviceMode==='tad'?'TAD · sous réserve de réservation':
      x.type==='school'?'Scolaire':x.type==='hlp'?'Haut-le-pied':x.type==='cut'?'Coupure':x.type==='start'?'Prise de service':x.type==='end'?'Fin de service':'Course régulière';
    const detail=[x.line,(x.origin||'')+' → '+(x.destination||'')].filter(Boolean).join(' · ');
    return '<div class="antoni-item"><strong>'+esc(String(x.start_time).slice(0,5))+' – '+esc(String(x.end_time).slice(0,5))+'</strong><span>'+esc(mode)+'</span><div class="antoni-desc">'+esc(detail)+'<small>'+esc(x.notes||x.label||'')+'</small></div></div>';
  }).join(''):'<p>Aucune activité enregistrée à cette date. Vérifie le journal de génération et les segments de la journée.</p>';
  q('antoniPilotModal').hidden=false;
  q('antoniPilotClose').focus();
 }
 function sync(){
  installStyle();
  if(!document.body)return;
  const on=isPilot();document.body.classList.toggle('saeiv-antoni-pilot',on);
  if(!on)return;
  installModal();
  const root=q('v165Board');if(!root)return;
  if(!q('antoniPilotHead')){
    const h=document.createElement('section');h.id='antoniPilotHead';
    h.innerHTML='<h2>Exploitation · Transports René Antoni</h2><p>Environnement de test isolé · 27 conducteurs de départ · courses chargées selon chaque jour de circulation Fluo. Les TAD sont planifiés d’office et peuvent être retirés du brouillon en l’absence de réservation. Anciennes références 54R3xx : correspondance de numérotation actuelle à vérifier sur Fluo avant publication.</p>';
    root.prepend(h);
  }
  root.querySelectorAll('.v165-driver-meta').forEach(meta=>{
    if(meta.querySelector('[data-antoni-open-day]'))return;
    const button=document.createElement('button');button.type='button';button.className='antoni-open-day';
    button.dataset.antoniOpenDay=meta.closest('.v165-driver-row')?.querySelector('[data-driver-lane]')?.dataset.driverLane||'';
    button.textContent='Voir la journée';
    if(button.dataset.antoniOpenDay)meta.append(button);
  });
 }
 document.addEventListener('click',e=>{
  if(!isPilot())return;
  const el=e.target.closest?.('[data-antoni-open-day],#v165Grid [data-v198-driver-id]');
  if(!el)return;
  e.preventDefault();e.stopImmediatePropagation();
  open(el.dataset.antoniOpenDay||el.dataset.v198DriverId);
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 const start=()=>{sync();setInterval(sync,1200)};
 window.MonSAEIVAntoniPilotV202={installed:true,version:'1.0.113',sync,openDriverDay:open,closeDriverDay:close};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
