'use strict';
/* Mon SAEIV 1.0.53 — UX conducteur + orchestrateur Ma journée événementiel.
   - un seul orchestrateur course -> HLP -> course, sans boucle de polling
   - destination = véritable terminus desservi
   - menu conducteur simplifié
   - HLP aligné visuellement sur le cockpit conducteur
   - anciens accès restent disponibles via Mon profil / Fiches horaires / Admin
*/
(()=>{
  if(window.MonSAEIVFlowV148?.installed)return;
  const VERSION='1.0.56';
  const q=id=>document.getElementById(id);
  const DAY_KEY='fluo-v143-day-running';
  const PREPARED_KEY='fluo-v316-prepared-item';
  const PROGRESS_KEY='fluo-saeiv-planning-progress-v316';
  const PHASE={IDLE:'idle',PREPARING:'preparing-course',PREFLIGHT:'preflight',COURSE:'course',HLP:'hlp',BREAK:'break',END:'end'};
  let phase=PHASE.IDLE, token=0, transitionTimer=null, courseObserver=null, scheduleTimer=null, lastLaunched=null;

  const dayRunning=()=>sessionStorage.getItem(DAY_KEY)==='1';
  const setDayRunning=v=>v?sessionStorage.setItem(DAY_KEY,'1'):sessionStorage.removeItem(DAY_KEY);
  const visible=e=>!!e&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none';
  const appState=()=>{try{return state}catch{return null}};
  const planItems=()=>{try{return window.FluoPlanningV316?.items?.()||[]}catch{return[]}};
  const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
  function progress(){try{const p=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null');return p&&typeof p==='object'?p:{date:today(),done:{},activeId:null}}catch{return{date:today(),done:{},activeId:null}}}
  function sortedToday(){return planItems().filter(x=>x.date===today()).sort((a,b)=>String(a.start||'').localeCompare(String(b.start||'')))}
  function itemById(id){return planItems().find(x=>String(x.id)===String(id))||null}
  function currentItem(){const p=progress(),xs=sortedToday();if(p.date===today()&&p.activeId){const a=xs.find(x=>String(x.id)===String(p.activeId)&&!p.done?.[x.id]);if(a)return a}return xs.find(x=>!p.done?.[x.id])||null}
  function hasPendingAfter(id){const xs=sortedToday(),i=xs.findIndex(x=>String(x.id)===String(id)),p=progress();return i>=0&&xs.slice(i+1).some(x=>!p.done?.[x.id])}

  function terminusIndex(pattern=appState()?.pattern){
    const stops=pattern?.stops||[];if(!stops.length)return -1;
    if(appState()?.service?.mode==='tad'&&appState()?.service?.tadStops instanceof Set){
      const start=Number(q('startStop')?.value||0),ids=[...appState().service.tadStops].map(Number).filter(i=>Number.isInteger(i)&&i>=start&&i<stops.length).sort((a,b)=>a-b);
      if(ids.length)return ids[ids.length-1];
    }
    return stops.length-1;
  }
  function terminusName(pattern=appState()?.pattern){const i=terminusIndex(pattern);return i>=0?String(pattern?.stops?.[i]?.name||pattern?.headsign||'').trim():String(pattern?.headsign||'').trim()}
  function spokenLocal(v){try{return typeof spoken==='function'?spoken(v):String(v||'')}catch{return String(v||'')}}
  function lineCodeLocal(v){try{return typeof spokenLineCode==='function'?spokenLineCode(v):String(v||'')}catch{return String(v||'')}}
  function newLineIdentity(){return `Ligne ${lineCodeLocal(appState()?.route?.short||'')}, à destination de ${spokenLocal(terminusName())}.`}
  function installTerminusIdentity(){
    try{globalThis.lineIdentity=newLineIdentity}catch{}
    syncTerminusUi();
    try{
      if(typeof globalThis.populateRuns==='function'&&!globalThis.populateRuns.__v153){const base=globalThis.populateRuns;const wrap=function(...a){const r=base.apply(this,a);queueMicrotask(refreshTripOptions);return r};wrap.__v153=true;globalThis.populateRuns=wrap}
      if(typeof globalThis.populateFormationPatterns==='function'&&!globalThis.populateFormationPatterns.__v153){const base=globalThis.populateFormationPatterns;const wrap=function(...a){const r=base.apply(this,a);queueMicrotask(refreshFormationOptions);return r};wrap.__v153=true;globalThis.populateFormationPatterns=wrap}
    }catch{}
  }
  function clock(v){try{return v?.toLocaleTimeString?.('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}catch{return'—'}}
  function refreshTripOptions(){const sel=q('trip'),xs=appState()?.runOptions||[];if(!sel||!xs.length)return;xs.forEach((r,i)=>{const o=sel.querySelector(`option[value="${i}"]`);if(!o)return;const p=r.pattern,origin=p?.stops?.[0]?.name||'Départ',dest=p?.stops?.at(-1)?.name||p?.headsign||'Terminus';const suffix=(o.textContent.match(/ · \d+ arrêts.*$/)||[''])[0];const next=`${clock(r.originDeparture)} · ${origin} → ${dest}${suffix}`;if(o.textContent!==next)o.textContent=next})}
  function refreshFormationOptions(){const sel=q('formationPattern'),xs=appState()?.patterns||[];if(!sel||!xs.length)return;xs.forEach((p,i)=>{const o=sel.querySelector(`option[value="${i}"]`);if(!o)return;const origin=p?.stops?.[0]?.name||'Départ',dest=p?.stops?.at(-1)?.name||p?.headsign||'Terminus',dir=p?.direction!==''&&p?.direction!=null?` · sens ${Number(p.direction)+1}`:'';const next=`${origin} → ${dest}${dir} · ${p?.stops?.length||0} arrêts`;if(!o.textContent.startsWith(`${origin} → ${dest}`))o.textContent=next})}
  function syncTerminusUi(){const name=terminusName();if(!name)return;const h=q('headsign');if(h)h.textContent=name}

  function ensureUi(){
    if(!q('v148FlowStyle')){const s=document.createElement('style');s.id='v148FlowStyle';s.textContent=`
      #v148Transition{position:fixed;z-index:2147483450;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:#07121b;color:#eef8fd}#v148Transition.hidden{display:none!important}.v148-card{width:min(520px,100%);padding:20px;border:1px solid #355163;border-radius:18px;background:#0b202b;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.55)}.v148-card b{display:block;font-size:1.05rem}.v148-card span{display:block;margin-top:7px;color:#9db2be;font-size:.72rem}.v148-spin{width:34px;height:34px;margin:0 auto 13px;border:4px solid #294554;border-top-color:#ffd000;border-radius:50%;animation:v148spin .8s linear infinite}@keyframes v148spin{to{transform:rotate(360deg)}}body.v148-flowing #v125PassengerEnd{display:none!important}
      #v316MenuItems>.v153-hidden-menu{display:none!important}
      #v144HlpDriver{background:radial-gradient(circle at 85% 0,#123146 0,#071620 42%,#040b11 100%)!important}
      #v144HlpDriver .v144-hlp-head{background:#0d202c!important;border-bottom:1px solid #355163!important}
      #v144HlpDriver .v144-hlp-head small{color:#ffd000!important;letter-spacing:.1em!important}
      #v144HlpDriver .v144-hlp-map{border-radius:18px!important;border-color:#3d6073!important}
      #v144HlpDriver .v144-nav-card,#v144HlpDriver .v144-metric{background:#081923!important;border-color:#2d4859!important}
      #v144HlpDriver .v144-arrow{background:#ffd000!important;color:#111!important}
      .v153-hlp-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:5px}.v153-hlp-badges span{display:inline-flex!important;padding:5px 8px!important;border:1px solid #3d6073!important;border-radius:999px!important;background:#173444!important;color:#eef8fd!important;font-size:.58rem!important;font-weight:950!important}.v153-hlp-badges span:first-child{background:#ffd000!important;border-color:#ffd000!important;color:#111!important}
      .v153-profile-logout{width:100%;margin-top:12px;border-color:#704040!important;background:#301c1d!important;color:#ffd0cd!important}
      .v153-timetable-saved{white-space:nowrap}
      #v156DayScreen{position:fixed;z-index:2147483300;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at 85% 0,#15364a 0,#071620 46%,#03090d 100%);color:#eef8fd}#v156DayScreen.hidden{display:none!important}.v156-day-card{width:min(720px,100%);max-height:92dvh;overflow:auto;padding:22px;border:1px solid #38596b;border-radius:22px;background:#0b202b;box-shadow:0 28px 90px rgba(0,0,0,.6)}.v156-day-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#ffd000;color:#111;font-size:.65rem;font-weight:950}.v156-day-card h2{margin:12px 0 4px;font-size:1.65rem}.v156-day-card p{margin:0;color:#a9bec9}.v156-day-time{display:flex;align-items:baseline;gap:10px;margin:20px 0}.v156-day-time b{font-size:2.5rem;color:#ffd000}.v156-day-time span{font-weight:850;color:#adc1cb}.v156-day-actions{display:grid;gap:9px;margin-top:18px}.v156-day-actions button{min-height:54px;font-weight:950}.v156-day-actions .primary{background:#ffd000;color:#111}.v156-day-next{margin-top:18px;padding:12px;border:1px solid #315061;border-radius:13px;background:#071720;color:#a9bec9;font-size:.72rem}.v156-day-next b{display:block;color:#eef8fd;margin-bottom:3px}body.v156-day-screen #v148Transition{z-index:2147483450}
    `;document.head.appendChild(s)}
    if(!q('v148Transition'))document.body.insertAdjacentHTML('beforeend',`<div id="v148Transition" class="hidden"><div class="v148-card"><div class="v148-spin"></div><b id="v148TransitionTitle">Préparation de la suite…</b><span id="v148TransitionSub">Ma journée reste active.</span></div></div>`)
    if(!q('v156DayScreen'))document.body.insertAdjacentHTML('beforeend',`<div id="v156DayScreen" class="hidden" role="dialog" aria-modal="true" aria-label="Ma journée"><section class="v156-day-card"><span id="v156DayBadge" class="v156-day-badge">MA JOURNÉE</span><h2 id="v156DayTitle">Étape en cours</h2><p id="v156DayDetail"></p><div class="v156-day-time"><b id="v156DayStart">—</b><span>→</span><b id="v156DayEnd">—</b></div><div id="v156DayActions" class="v156-day-actions"></div><div id="v156DayNext" class="v156-day-next"></div></section></div>`)
    tidyMainMenu();enhanceTimetables();enhanceProfile();enhanceAdmin();unifyHlpCockpit();
  }
  function showTransition(title='Préparation de la suite…',sub='Ma journée reste active.'){ensureUi();document.body.classList.add('v148-flowing');q('v148TransitionTitle').textContent=title;q('v148TransitionSub').textContent=sub;q('v148Transition').classList.remove('hidden');clearTimeout(transitionTimer);transitionTimer=setTimeout(hideTransition,30000)}
  function hideTransition(){clearTimeout(transitionTimer);transitionTimer=null;q('v148Transition')?.classList.add('hidden');document.body.classList.remove('v148-flowing')}

  function tidyMainMenu(){
    const menu=q('v316MenuItems');if(!menu)return;
    const profile=q('v137ProfileBtn')||q('v133ProfileBtn');
    const keep=new Set([profile?.id,'v3125NetworkSheetsBtn','v107RadioMainBtn','v110ChangeNetworkBtn','v29AdminBtn'].filter(Boolean));
    [...menu.children].forEach(el=>{if(el.tagName==='BUTTON')el.classList.toggle('v153-hidden-menu',!keep.has(el.id))});
    const desired=[profile?.id,'v3125NetworkSheetsBtn','v107RadioMainBtn','v110ChangeNetworkBtn','v29AdminBtn'].filter(Boolean);
    let after=q('v110NetworkBadge')||null;
    for(const id of desired){const el=q(id);if(!el||el.classList.contains('v153-hidden-menu'))continue;if(after?.parentElement===menu){if(after.nextElementSibling!==el)after.insertAdjacentElement('afterend',el)}else if(menu.firstElementChild!==el)menu.prepend(el);after=el}
  }
  function enhanceProfile(){
    const body=q('v137DriverHub')?.querySelector('.v137-body');if(!body||q('v153ProfileLogout'))return;
    const b=document.createElement('button');b.id='v153ProfileLogout';b.type='button';b.className='v153-profile-logout';b.textContent='↪ Déconnexion';b.addEventListener('click',()=>{q('v137DriverHub')?.classList.add('hidden');const legacy=q('v110LogoutBtn');if(legacy)legacy.click();else window.MonSAEIVAuthV13?.logout?.()});body.appendChild(b)
  }
  function enhanceTimetables(){
    const bar=q('v3125TimetableBrowser')?.querySelector('.v3125-toolbar');if(!bar||q('v153SavedSheetsBtn'))return;
    const b=document.createElement('button');b.id='v153SavedSheetsBtn';b.type='button';b.className='v153-timetable-saved';b.textContent='🗂 Mes fiches enregistrées';b.addEventListener('click',()=>{q('v3125TimetableBrowser')?.classList.add('hidden');q('v24SheetsBtn')?.click()});bar.appendChild(b)
  }
  function enhanceAdmin(){
    const body=q('v29AdminBody');if(!body||q('v153AdminScheduleBtn'))return;
    const wrap=document.createElement('div');wrap.className='v102-admin-toolbox';wrap.id='v153AdminScheduleBox';wrap.innerHTML='<div><b>Fiches horaires</b><span>Création et paramétrage réservés à l’administration.</span></div><button id="v153AdminScheduleBtn" class="primary" type="button">📄 Créer une fiche horaire</button>';
    body.prepend(wrap);q('v153AdminScheduleBtn')?.addEventListener('click',()=>{q('v29Admin')?.classList.add('hidden');q('v16CalcOpen')?.click()})
  }
  function unifyHlpCockpit(){
    const h=q('v144HlpDriver')?.querySelector('.v144-hlp-head>div:first-child');if(!h||h.querySelector('.v153-hlp-badges'))return;
    const badges=document.createElement('div');badges.className='v153-hlp-badges';badges.innerHTML='<span>HLP</span><span>HAUT-LE-PIED</span><span>GPS</span>';h.prepend(badges)
  }

  function setPhase(next){phase=next;document.body.dataset.saeivDayPhase=next}
  function disconnectCourseObserver(){courseObserver?.disconnect();courseObserver=null}
  function clearSchedule(){if(scheduleTimer!==null)clearTimeout(scheduleTimer);scheduleTimer=null}
  function showDayScreen(item,kind){ensureUi();clearSchedule();const meta={start:'Prise de service',end:'Fin de service',annex:'Travail annexe',availability:'Mise à disposition',other:'Autre étape',pause:'Pause',cut:'Coupure'};q('v156DayBadge').textContent=kind==='break'?'COUPURE · MA JOURNÉE':'MA JOURNÉE';q('v156DayTitle').textContent=item.label||meta[item.type]||'Étape en cours';q('v156DayDetail').textContent=[meta[item.type],item.origin&&item.destination?`${item.origin} → ${item.destination}`:''].filter(Boolean).join(' · ');q('v156DayStart').textContent=item.start||'—';q('v156DayEnd').textContent=item.end||'—';const xs=sortedToday(),i=xs.findIndex(x=>String(x.id)===String(item.id)),next=xs.slice(i+1).find(x=>!progress().done?.[x.id]);q('v156DayNext').innerHTML=next?`<b>Étape suivante</b>${next.start||'—'} · ${next.label||meta[next.type]||next.type}`:'<b>Dernière étape</b>La journée sera terminée après cette étape.';q('v156DayActions').innerHTML=kind==='break'?'<button id="v156ResumeDay" class="primary" type="button">▶ REPRENDRE MA JOURNÉE</button>':'<button id="v156CompleteStep" class="primary" type="button">✓ TERMINER CETTE ÉTAPE</button>';q('v156DayScreen').classList.remove('hidden');document.body.classList.add('v156-day-screen')}
  function hideDayScreen(){q('v156DayScreen')?.classList.add('hidden');document.body.classList.remove('v156-day-screen')}
  function minuteUntilEnd(item){const m=String(item.end||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;const now=new Date(),end=new Date(now);end.setHours(Number(m[1]),Number(m[2]),0,0);if(end.getTime()<now.getTime()-43200000)end.setDate(end.getDate()+1);return end.getTime()-now.getTime()}
  function completeItem(item){if(!item)return;clearSchedule();window.FluoPlanningV316?.markDone?.(item.id)}
  function waitForCourseStart(item,flowToken){
    disconnectCourseObserver();hideDayScreen();setPhase(PHASE.PREFLIGHT);
    const attempt=()=>{
      if(flowToken!==token||!dayRunning()){disconnectCourseObserver();hideTransition();return true}
      if(appState()?.running){disconnectCourseObserver();lastLaunched=String(item.id);setPhase(PHASE.COURSE);hideTransition();syncTerminusUi();return true}
      if(appState()?.pattern&&typeof globalThis.startGps==='function'){globalThis.startGps();return false}
      return false
    };
    if(attempt())return;
    courseObserver=new MutationObserver(()=>attempt());courseObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled','style']})
  }
  async function launchCourse(item,flowToken){
    setPhase(PHASE.PREPARING);showTransition(`Préparation de ${item.line||item.linked?.routeShort||'la course'}…`,`Départ prévu ${item.start||'—'} · ouverture de la navigation.`);
    try{
      const ok=await window.FluoPlanningV316?.prepareLinkedCourse?.(item);if(flowToken!==token)return;
      if(ok===false)throw new Error('préparation refusée');
      syncTerminusUi();refreshTripOptions();waitForCourseStart(item,flowToken)
    }catch(e){if(flowToken===token){setPhase(PHASE.IDLE);hideTransition();alert(`Impossible de préparer la course : ${e?.message||e}`)}}
  }
  function launchHlp(item,flowToken,{manual=false}={}){
    hideDayScreen();setPhase(PHASE.HLP);showTransition('Préparation du haut-le-pied…',`${item.origin||'Position actuelle'} → ${item.destination||'prise de service'}`);
    q('v316HlpPreview')?.classList.add('hidden');q('v29Hlp')?.classList.add('hidden');
    const api=window.MonSAEIVDayAutopilotV144;if(!api?.startHlp){hideTransition();setPhase(PHASE.IDLE);alert('Le module GPS HLP n’est pas chargé.');return}
    Promise.resolve(api.startHlp(item,{manual})).then(()=>{if(flowToken===token){lastLaunched=String(item.id);unifyHlpCockpit();hideTransition()}}).catch(e=>{if(flowToken===token){hideTransition();setPhase(PHASE.IDLE);alert(`HLP impossible : ${e?.message||e}`)}})
  }
  function launchCurrent(flowToken,{manual=false}={}){
    if(flowToken!==token)return;const item=currentItem();if(!item){setPhase(PHASE.END);hideTransition();hideDayScreen();setDayRunning(false);window.FluoPlanningV316?.renderToday?.();return}
    if(item.type==='hlp'){launchHlp(item,flowToken,{manual});return}
    if(item.linked){launchCourse(item,flowToken);return}
    if(item.type==='cut'){setPhase(PHASE.BREAK);hideTransition();showDayScreen(item,'break');return}
    setPhase(PHASE.PREFLIGHT);hideTransition();showDayScreen(item,'step');const left=minuteUntilEnd(item);if(left!==null){if(left<=0)queueMicrotask(()=>completeItem(item));else scheduleTimer=setTimeout(()=>completeItem(item),Math.min(left,2147483647))}
  }
  function beginDay(){setDayRunning(true);hideDayScreen();const t=++token;showTransition('Ouverture de Ma journée…','Préparation de la première étape.');queueMicrotask(()=>launchCurrent(t))}
  function afterHlp(id){if(!dayRunning())return;const cur=currentItem();if(cur&&String(cur.id)===String(id))completeItem(cur)}

  function installEvents(){
    document.addEventListener('click',e=>{
      const startDay=e.target.closest?.('#v316StartDay');if(startDay){e.preventDefault();e.stopImmediatePropagation();beginDay();return}
      if(e.target.closest?.('#v316LeaveDay')){setDayRunning(false);++token;disconnectCourseObserver();clearSchedule();setPhase(PHASE.IDLE);hideTransition();hideDayScreen();return}
      if(e.target.closest?.('#v156CompleteStep')){e.preventDefault();completeItem(currentItem());return}
      if(e.target.closest?.('#v156ResumeDay')){e.preventDefault();const item=currentItem();if(item?.type==='cut')completeItem(item);else launchCurrent(++token);return}
      const h=e.target.closest?.('[data-v316-hlp],[data-v316-hlp-next]');if(h){const id=h.dataset.v316Hlp||h.dataset.v316HlpNext,item=itemById(id);if(!item)return;e.preventDefault();e.stopImmediatePropagation();const t=++token;launchHlp(item,t,{manual:!dayRunning()});return}
    },true);
    document.addEventListener('change',e=>{if(e.target?.matches?.('.tad-stop-checkbox,#startStop,#trip'))queueMicrotask(syncTerminusUi)},true);
    window.addEventListener('mon-saeiv-hlp-complete',e=>afterHlp(e?.detail?.itemId||lastLaunched||''));
    window.addEventListener('mon-saeiv-planning-progress',()=>{if(!dayRunning())return;showTransition('Étape terminée','Préparation automatique de la suite.');queueMicrotask(()=>launchCurrent(++token))});
    window.addEventListener('mon-saeiv-network-change',()=>queueMicrotask(tidyMainMenu));
    const menu=q('v316MenuItems');if(menu)new MutationObserver(()=>queueMicrotask(tidyMainMenu)).observe(menu,{childList:true});
    const admin=q('v29AdminBody');if(admin)new MutationObserver(()=>{if(!admin.classList.contains('hidden'))enhanceAdmin()}).observe(admin,{childList:true,attributes:true,attributeFilter:['class']});
    const hub=q('v137DriverHub');if(hub)new MutationObserver(()=>enhanceProfile()).observe(hub,{childList:true,subtree:true});
  }

  function boot(){ensureUi();installTerminusIdentity();installEvents();setPhase(PHASE.IDLE);[250,900,2200].forEach(ms=>setTimeout(()=>{ensureUi();syncTerminusUi();refreshTripOptions()},ms));window.MonSAEIVFlowV148={installed:true,version:VERSION,start:beginDay,launchItemById:id=>{const x=itemById(id);if(x){const t=++token;if(x.type==='hlp')launchHlp(x,t,{manual:!dayRunning()});else if(x.linked)launchCourse(x,t);else launchCurrent(t)}},dayRunning,get phase(){return phase},terminusName};console.info('[Mon SAEIV] 1.0.56 Ma journée dédiée et enchaînement événementiel actifs')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
