'use strict';
/* Mon SAEIV 1.0.48 — fil continu Ma journée.
   Un seul orchestrateur pilote désormais course -> HLP -> course -> étape suivante.
   Il laisse le planning enregistrer la progression, mais ne dépend plus d'un clic DOM au bon milliseconde. */
(()=>{
  if(window.MonSAEIVFlowV148?.installed)return;
  const VERSION='1.0.48';
  const q=id=>document.getElementById(id);
  const DAY_KEY='fluo-v143-day-running';
  const PREPARED_KEY='fluo-v316-prepared-item';
  const PROGRESS_KEY='fluo-saeiv-planning-progress-v316';
  let token=0,armTimer=null,transitionTimer=null,lastLaunched=null;

  const dayRunning=()=>sessionStorage.getItem(DAY_KEY)==='1';
  const setDayRunning=v=>v?sessionStorage.setItem(DAY_KEY,'1'):sessionStorage.removeItem(DAY_KEY);
  const visible=e=>!!e&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none';
  const planItems=()=>{try{return window.FluoPlanningV316?.items?.()||[]}catch{return[]}};
  const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
  function progress(){try{const p=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null');return p&&typeof p==='object'?p:{date:today(),done:{},activeId:null}}catch{return{date:today(),done:{},activeId:null}}}
  function sortedToday(){return planItems().filter(x=>x.date===today()).sort((a,b)=>String(a.start||'').localeCompare(String(b.start||'')))}
  function itemById(id){return planItems().find(x=>String(x.id)===String(id))||null}
  function currentItem(){const p=progress(),xs=sortedToday();if(p.date===today()&&p.activeId){const a=xs.find(x=>String(x.id)===String(p.activeId)&&!p.done?.[x.id]);if(a)return a}return xs.find(x=>!p.done?.[x.id])||null}
  function activeDomId(){const a=q('v316TodayPanel')?.querySelector('.v316-today-item.active:not(.done)');return a?.querySelector('[data-v316-prepare],[data-v316-hlp-next],[data-v316-hlp],[data-v316-done]')?.dataset?.v316Prepare||a?.querySelector('[data-v316-hlp-next]')?.dataset?.v316HlpNext||a?.querySelector('[data-v316-hlp]')?.dataset?.v316Hlp||a?.querySelector('[data-v316-done]')?.dataset?.v316Done||null}

  function ensureUi(){
    if(!q('v148FlowStyle')){const s=document.createElement('style');s.id='v148FlowStyle';s.textContent=`
      #v148Transition{position:fixed;z-index:2147483450;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:#07121b;color:#eef8fd}#v148Transition.hidden{display:none!important}.v148-card{width:min(520px,100%);padding:20px;border:1px solid #355163;border-radius:18px;background:#0b202b;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.55)}.v148-card b{display:block;font-size:1.05rem}.v148-card span{display:block;margin-top:7px;color:#9db2be;font-size:.72rem}.v148-spin{width:34px;height:34px;margin:0 auto 13px;border:4px solid #294554;border-top-color:#ffd000;border-radius:50%;animation:v148spin .8s linear infinite}@keyframes v148spin{to{transform:rotate(360deg)}}body.v148-flowing #v125PassengerEnd{display:none!important}
    `;document.head.appendChild(s)}
    if(!q('v148Transition'))document.body.insertAdjacentHTML('beforeend',`<div id="v148Transition" class="hidden"><div class="v148-card"><div class="v148-spin"></div><b id="v148TransitionTitle">Préparation de la suite…</b><span id="v148TransitionSub">Ma journée reste active.</span></div></div>`)
  }
  function showTransition(title='Préparation de la suite…',sub='Ma journée reste active.'){ensureUi();document.body.classList.add('v148-flowing');q('v148TransitionTitle').textContent=title;q('v148TransitionSub').textContent=sub;q('v148Transition').classList.remove('hidden');clearTimeout(transitionTimer);transitionTimer=setTimeout(()=>hideTransition(),30000)}
  function hideTransition(){clearTimeout(transitionTimer);transitionTimer=null;q('v148Transition')?.classList.add('hidden');document.body.classList.remove('v148-flowing');q('v125PassengerEnd')?.classList.add('hidden')}
  function cancelArm(){if(armTimer)clearInterval(armTimer);armTimer=null}

  function armPreparedCourse(item,flowToken){
    cancelArm();const id=String(item.id),started=Date.now();let clicked=false,preflightClicked=false,prepareTried=false;
    showTransition(`Préparation de ${item.line||item.linked?.routeShort||'la course'}…`,`Départ prévu ${item.start||'—'} · ouverture automatique de la navigation.`);
    armTimer=setInterval(async()=>{
      if(flowToken!==token||!dayRunning()){cancelArm();hideTransition();return}
      if(state?.running){cancelArm();hideTransition();lastLaunched=id;return}
      const prepared=sessionStorage.getItem(PREPARED_KEY);
      if(prepared!==id){
        if(!prepareTried&&Date.now()-started>1100&&window.FluoPlanningV316?.prepareLinkedCourse){prepareTried=true;try{await window.FluoPlanningV316.prepareLinkedCourse(item)}catch(e){console.warn('[Mon SAEIV] préparation automatique',e)}}
        if(Date.now()-started>28000){cancelArm();hideTransition()}return;
      }
      if(visible(q('v136Preflight'))){const go=q('v136PreflightGo');if(go?.dataset?.target&&!preflightClicked){preflightClicked=true;go.click()}return}
      // Une question métier (réservation / TAD) doit rester volontairement interactive.
      if(visible(q('v3120DemandPreflight'))){hideTransition();return}
      const start=q('start');
      if(!clicked&&start&&!start.disabled&&state?.pattern){clicked=true;start.click();return}
      if(clicked&&Date.now()-started>28000){cancelArm();hideTransition()}
    },120)
  }

  function startHlp(item,flowToken,{manual=false}={}){
    showTransition('Préparation du haut-le-pied…',`${item.origin||'Position actuelle'} → ${item.destination||'prise de service'}`);
    q('v316HlpPreview')?.classList.add('hidden');q('v29Hlp')?.classList.add('hidden');
    const api=window.MonSAEIVDayAutopilotV144;
    if(!api?.startHlp){if(flowToken===token){hideTransition();alert('Le module de navigation HLP n’est pas chargé. Ferme puis rouvre Mon SAEIV.')}return}
    Promise.resolve(api.startHlp(item,{manual})).then(()=>{if(flowToken===token){lastLaunched=String(item.id);setTimeout(hideTransition,250)}}).catch(e=>{if(flowToken===token){hideTransition();alert(`HLP impossible : ${e?.message||e}`)}})
  }

  function launchItem(item,flowToken,{manual=false}={}){
    if(!item||flowToken!==token)return hideTransition();
    if(item.type==='hlp'){startHlp(item,flowToken,{manual});return}
    if(item.linked){armPreparedCourse(item,flowToken);return}
    // Coupure, pause, prise/fin de service : pas de faux écran de navigation.
    hideTransition();
    try{document.getElementById('v316TodayMode')?.click()}catch{}
  }

  function followActive(previousId,flowToken,attempt=0){
    if(flowToken!==token||!dayRunning())return hideTransition();
    if(state?.running)return setTimeout(()=>followActive(previousId,flowToken,attempt+1),120);
    const item=currentItem();
    if(!item){hideTransition();return}
    if(previousId&&String(item.id)===String(previousId)&&attempt<180)return setTimeout(()=>followActive(previousId,flowToken,attempt+1),100);
    launchItem(item,flowToken)
  }

  function beginDay(){setDayRunning(true);const t=++token;showTransition('Ouverture de Ma journée…','Préparation automatique de la première étape.');setTimeout(()=>followActive(null,t),260)}
  function afterCourseFinish(previousId){if(!dayRunning())return;const t=++token;showTransition('Course terminée','Préparation automatique de l’étape suivante.');setTimeout(()=>followActive(previousId,t),140)}
  function afterHlpFinish(id){if(!dayRunning())return;const t=++token;showTransition('Haut-le-pied terminé','Préparation de la suite de la journée.');setTimeout(()=>followActive(id,t),180)}

  function installClicks(){
    document.addEventListener('click',e=>{
      const startDay=e.target.closest?.('#v316StartDay');if(startDay){setDayRunning(true);const t=++token;showTransition('Ouverture de Ma journée…','Préparation automatique de la première étape.');setTimeout(()=>followActive(null,t),320);return}
      if(e.target.closest?.('#v316LeaveDay')){setDayRunning(false);++token;cancelArm();hideTransition();return}
      const h=e.target.closest?.('[data-v316-hlp],[data-v316-hlp-next]');if(h){
        const id=h.dataset.v316Hlp||h.dataset.v316HlpNext,item=itemById(id);if(!item)return;
        e.preventDefault();e.stopImmediatePropagation();const t=++token;if(dayRunning())startHlp(item,t,{manual:false});else startHlp(item,t,{manual:true});return;
      }
      const fin=e.target.closest?.('#finish');if(fin&&dayRunning()){
        const prev=sessionStorage.getItem(PREPARED_KEY)||progress()?.activeId||activeDomId()||lastLaunched||'';
        showTransition('Course terminée','Enchaînement de Ma journée…');setTimeout(()=>afterCourseFinish(prev),0);
      }
    },true);
    window.addEventListener('mon-saeiv-hlp-complete',e=>afterHlpFinish(e?.detail?.itemId||lastLaunched||''));
  }

  function boot(){ensureUi();installClicks();window.MonSAEIVFlowV148={installed:true,version:VERSION,start:beginDay,launchItemById:id=>{const x=itemById(id);if(x){const t=++token;launchItem(x,t,{manual:!dayRunning()})}},dayRunning};console.info('[Mon SAEIV] 1.0.48 fil continu Ma journée actif')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
