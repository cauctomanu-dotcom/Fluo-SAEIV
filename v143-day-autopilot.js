'use strict';
/* Mon SAEIV 1.0.43 — pilote automatique de « Ma journée ».
   - une fin de course intermédiaire n'ouvre plus la feuille PDF/comptage ;
   - une course liée est préparée puis bascule automatiquement en navigation ;
   - un haut-le-pied lié ouvre immédiatement la navigation HLP, affiche le compte à rebours,
     démarre le suivi à l'heure prévue et lance la course voyageurs à l'arrivée au départ. */
(()=>{
  if(window.MonSAEIVDayAutopilotV143?.installed)return;
  const q=id=>document.getElementById(id);
  const PREPARED_KEY='fluo-v316-prepared-item';
  const DAY_KEY='fluo-v143-day-running';
  let suppressTimer=null;
  let courseArm=null;
  let hlpArm=null;

  const dayRunning=()=>sessionStorage.getItem(DAY_KEY)==='1';
  const setDayRunning=v=>v?sessionStorage.setItem(DAY_KEY,'1'):sessionStorage.removeItem(DAY_KEY);
  const todayItems=()=>[...(q('v316TodayPanel')?.querySelectorAll('.v316-today-item')||[])];
  const activeItem=()=>q('v316TodayPanel')?.querySelector('.v316-today-item.active:not(.done)')||null;

  function hasContinuation(){
    const xs=todayItems(),a=activeItem(),i=xs.indexOf(a);
    if(i<0)return false;
    return xs.slice(i+1).some(x=>!x.classList.contains('done'));
  }

  function hideIntermediateEnd(){q('v125PassengerEnd')?.classList.add('hidden')}
  function suppressIntermediateEnd(ms=2800){
    clearInterval(suppressTimer);
    const until=Date.now()+ms;
    hideIntermediateEnd();
    suppressTimer=setInterval(()=>{
      hideIntermediateEnd();
      if(Date.now()>=until){clearInterval(suppressTimer);suppressTimer=null}
    },45);
  }

  function clearCourseArm(){
    if(courseArm?.timer)clearInterval(courseArm.timer);
    courseArm=null;
  }
  function visible(id){
    const e=q(id);
    return !!e&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none';
  }

  function armCourseStart(itemId){
    if(!dayRunning()||!itemId)return;
    clearCourseArm();
    const a={itemId:String(itemId),started:Date.now(),clicked:false,preflight:false,timer:null};
    courseArm=a;
    a.timer=setInterval(()=>{
      if(courseArm!==a||!dayRunning()){clearCourseArm();return}
      if(state?.running){clearCourseArm();return}
      const prepared=sessionStorage.getItem(PREPARED_KEY);
      if(prepared!==a.itemId){
        if(Date.now()-a.started>20000)clearCourseArm();
        return;
      }

      // Le contrôle « Prêt à partir » reste exécuté, puis Ma journée poursuit automatiquement.
      if(visible('v136Preflight')){
        const go=q('v136PreflightGo');
        if(go?.dataset?.target&&!a.preflight){a.preflight=true;go.click()}
        return;
      }

      // Les lignes avec montées sur réservation gardent leur question métier.
      // L'automatisme attend la réponse du conducteur au lieu d'inventer une réservation.
      if(visible('v3120DemandPreflight'))return;

      const start=q('start');
      if(!a.clicked&&start&&!start.disabled&&state?.pattern){
        a.clicked=true;
        start.click();
        return;
      }
      if(a.clicked&&Date.now()-a.started>20000)clearCourseArm();
    },120);
  }

  function clockFromActive(){
    const raw=(activeItem()?.querySelector('.v316-time b')?.textContent||'').trim();
    const m=raw.match(/^(\d{1,2}):(\d{2})$/);
    if(!m)return null;
    const d=new Date();
    d.setHours(Number(m[1]),Number(m[2]),0,0);
    return d;
  }
  function fmtCountdown(sec){
    sec=Math.max(0,Math.ceil(sec));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return h?`${h} h ${String(m).padStart(2,'0')} min`:`${m}:${String(s).padStart(2,'0')}`;
  }
  function haversine(lat1,lon1,lat2,lon2){
    const R=6371000,r=Math.PI/180;
    const a1=lat1*r,a2=lat2*r,da=(lat2-lat1)*r,dl=(lon2-lon1)*r;
    const a=Math.sin(da/2)**2+Math.cos(a1)*Math.cos(a2)*Math.sin(dl/2)**2;
    return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  function clearHlpArm(){
    if(hlpArm?.timer)clearInterval(hlpArm.timer);
    if(hlpArm?.watch!==null&&hlpArm?.watch!==undefined){
      try{navigator.geolocation.clearWatch(hlpArm.watch)}catch{}
    }
    hlpArm=null;
  }

  function launchNextAfterHlp(attempt=0){
    if(!dayRunning())return;
    const a=activeItem(),prep=a?.querySelector('[data-v316-prepare]');
    if(prep){prep.click();return}
    if(attempt<30)setTimeout(()=>launchNextAfterHlp(attempt+1),100);
  }

  function completeHlp(a){
    if(hlpArm!==a||a.completed)return;
    a.completed=true;
    if(a.watch!==null){try{navigator.geolocation.clearWatch(a.watch)}catch{}a.watch=null}
    if(a.timer){clearInterval(a.timer);a.timer=null}
    const live=q('v29HlpLive');
    if(live&&/Arrêter|⏸/.test(live.textContent||''))live.click();
    q('v29HlpClose')?.click();
    const cur=activeItem(),done=cur?.querySelector('[data-v316-done]');
    if(done)done.click();
    setTimeout(()=>launchNextAfterHlp(),180);
  }

  function startHlpLive(a){
    if(hlpArm!==a||a.liveStarted)return;
    const live=q('v29HlpLive');
    if(!live||live.disabled)return;
    a.liveStarted=true;
    if(!/Arrêter|⏸/.test(live.textContent||''))live.click();

    const idx=Number(q('startStop')?.value||0),st=state?.pattern?.stops?.[idx];
    if(!st)return;
    const status=q('v29HlpStatus');
    if(status){status.className='v29-status ok';status.textContent=`Haut-le-pied en cours · destination : ${st.name}`}
    a.watch=navigator.geolocation.watchPosition(p=>{
      if(hlpArm!==a||a.completed)return;
      const c=p.coords||{},lat=Number(c.latitude),lon=Number(c.longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
      const d=haversine(lat,lon,Number(st.lat),Number(st.lon));
      const accuracy=Number(c.accuracy)||15;
      const threshold=Math.max(40,Math.min(70,accuracy*1.25+22));
      a.hits=d<=threshold?a.hits+1:0;
      if(status){status.className='v29-status ok';status.textContent=`Haut-le-pied en cours · ${Math.max(0,Math.round(d))} m du départ de ${st.name}`}
      if(d<=22||a.hits>=2)completeHlp(a);
    },e=>{
      if(status){status.className='v29-status err';status.textContent=`GPS haut-le-pied : ${e.message||'indisponible'}`}
    },{enableHighAccuracy:true,timeout:15000,maximumAge:250});
  }

  function armHlp(itemId){
    if(!dayRunning()||!itemId)return;
    clearHlpArm();
    const a={itemId:String(itemId),started:Date.now(),timer:null,watch:null,hits:0,liveStarted:false,completed:false};
    hlpArm=a;
    a.timer=setInterval(()=>{
      if(hlpArm!==a||!dayRunning()){clearHlpArm();return}
      const sheet=q('v29Hlp'),live=q('v29HlpLive');
      if(!sheet||sheet.classList.contains('hidden')||!live||live.disabled){
        if(Date.now()-a.started>25000)clearHlpArm();
        return;
      }
      const dep=clockFromActive(),left=dep?(dep.getTime()-Date.now())/1000:0;
      if(left>0){
        const status=q('v29HlpStatus'),instruction=q('v29HlpInstruction');
        if(status){status.className='v29-status busy';status.textContent=`Itinéraire prêt · départ haut-le-pied dans ${fmtCountdown(left)}`}
        if(instruction)instruction.textContent=`Départ HLP dans ${fmtCountdown(left)}`;
        return;
      }
      startHlpLive(a);
    },250);
  }

  function handleActiveAfterDayStart(attempt=0){
    if(!dayRunning())return;
    const a=activeItem();
    if(!a){
      if(attempt<30)setTimeout(()=>handleActiveAfterDayStart(attempt+1),100);
      return;
    }
    const prep=a.querySelector('[data-v316-prepare]');
    if(prep){armCourseStart(prep.dataset.v316Prepare);return}
    const hlpNext=a.querySelector('[data-v316-hlp-next]');
    if(hlpNext){
      q('v316HlpPreview')?.classList.add('hidden');
      hlpNext.click();
    }
  }

  // Lorsqu'une étape suit la course, la feuille « PDF de cette course / PDF de la journée »
  // est masquée pour ne pas interrompre le service.
  q('finish')?.addEventListener('click',()=>{
    if(dayRunning()&&sessionStorage.getItem(PREPARED_KEY)&&hasContinuation())suppressIntermediateEnd();
  },true);

  document.addEventListener('click',e=>{
    const startDay=e.target.closest?.('#v316StartDay');
    if(startDay){
      setDayRunning(true);
      setTimeout(()=>handleActiveAfterDayStart(),120);
      return;
    }
    if(e.target.closest?.('#v316LeaveDay')){
      setDayRunning(false);clearCourseArm();clearHlpArm();return;
    }
    const prep=e.target.closest?.('[data-v316-prepare]');
    if(prep&&dayRunning()){armCourseStart(prep.dataset.v316Prepare);return}
    const hlpNext=e.target.closest?.('[data-v316-hlp-next]');
    if(hlpNext&&dayRunning())setTimeout(()=>armHlp(hlpNext.dataset.v316HlpNext),160);
  },true);

  document.title='Mon SAEIV · 1.0.43';
  const bi=q('buildInfo');if(bi)bi.textContent='Version 1.0.43';
  const version=q('v137Identity')?.querySelector('.v137-version');if(version)version.textContent='Version 1.0.43';
  window.MonSAEIVDayAutopilotV143={
    installed:true,version:'1.0.43',
    start:()=>{setDayRunning(true);handleActiveAfterDayStart()},
    stop:()=>{setDayRunning(false);clearCourseArm();clearHlpArm()},
    dayRunning
  };
  console.info('[Mon SAEIV] 1.0.43 Ma journée : navigation automatique, HLP et enchaînement actifs');
})();
