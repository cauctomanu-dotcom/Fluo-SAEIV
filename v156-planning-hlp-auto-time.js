'use strict';
/* Mon SAEIV 1.0.56 — durée automatique des hauts-le-pied dans Mon planning.
   La durée provient de l'itinéraire routier estimé et est arrondie à la minute,
   sans marge ni temps ajouté. Départ saisi => arrivée calculée ; arrivée saisie => départ calculé. */
(()=>{
  if(window.MonSAEIVPlanningHlpAutoTimeV156?.installed)return;
  const VERSION='1.0.56';
  const q=id=>document.getElementById(id);
  const S={durationMinutes:null,distanceKm:null,routeSignature:'',dirty:true,busy:null,timer:null,anchor:'start',suppress:false,resubmitting:false,token:0};

  function minute(v){
    const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;
    const h=Number(m[1]),mn=Number(m[2]);if(h<0||h>23||mn<0||mn>59)return null;
    return h*60+mn;
  }
  function clock(total){
    if(!Number.isFinite(Number(total)))return'';
    const n=((Math.round(Number(total))%1440)+1440)%1440;
    return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  }
  function validPoint(p){return !!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))}
  function fmtDuration(m){m=Math.max(1,Math.round(Number(m)||0));return m>=60?`${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')}`:`${m} min`}
  function fmtKm(km){const n=Number(km);return Number.isFinite(n)?`${n.toFixed(n>=10?1:2).replace('.',',')} km`:'—'}
  function isHlp(){return q('v316Type')?.value==='hlp'}

  function ensureUi(){
    const guide=q('v317HlpGuide');if(!guide)return null;
    let box=q('v156HlpAutoTime');if(box)return box;
    const style=document.createElement('style');style.id='v156HlpAutoTimeStyle';style.textContent=`
      .v156-hlp-time{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin-top:10px;padding:10px 11px;border:1px solid #3d6073;border-radius:12px;background:#071721}.v156-hlp-time.hidden{display:none!important}.v156-hlp-time b,.v156-hlp-time span{display:block}.v156-hlp-time b{font-size:.72rem}.v156-hlp-time span{margin-top:2px;color:#a6bbc5;font-size:.62rem;line-height:1.35}.v156-hlp-time.ok{border-color:#397c51;background:#0c2718}.v156-hlp-time.busy{border-color:#807025;background:#29240d}.v156-hlp-time.err{border-color:#8a4446;background:#2d1719}.v156-hlp-time button{min-height:36px;padding:6px 9px;font-size:.6rem}@media(max-width:680px){.v156-hlp-time{grid-template-columns:1fr}.v156-hlp-time button{width:100%}}
    `;document.head.appendChild(style);
    box=document.createElement('div');box.id='v156HlpAutoTime';box.className='v156-hlp-time';box.innerHTML='<div><b id="v156HlpAutoTimeTitle">⏱ Durée HLP automatique</b><span id="v156HlpAutoTimeStatus">Choisis le départ et la destination. Aucun temps supplémentaire ne sera ajouté.</span></div><button id="v156HlpAutoTimeRecalc" type="button">↻ Recalculer</button>';
    const pair=guide.querySelector('.v317-place-pair');(pair||guide).insertAdjacentElement('afterend',box);
    q('v156HlpAutoTimeRecalc')?.addEventListener('click',()=>{S.dirty=true;calculate(true)});
    return box;
  }
  function setStatus(text,kind=''){
    const box=ensureUi(),e=q('v156HlpAutoTimeStatus');if(!box||!e)return;
    box.className=`v156-hlp-time${kind?` ${kind}`:''}`;e.textContent=text;
  }
  function syncVisibility(){
    const box=ensureUi(),on=isHlp();box?.classList.toggle('hidden',!on);
    const drive=q('v316DriveMinutes');if(drive){drive.readOnly=on;drive.toggleAttribute('aria-readonly',on)}
    if(!on){clearTimeout(S.timer);return}
    if(S.durationMinutes&&!S.dirty)applyTimes();else scheduleCalculate(80);
  }

  function draftPoint(which){
    try{
      const p=which==='origin'?(typeof draftOrigin!=='undefined'?draftOrigin:null):(typeof draftDestination!=='undefined'?draftDestination:null);
      if(validPoint(p))return{lat:Number(p.lat),lon:Number(p.lon),name:p.name||''};
    }catch{}
    return null;
  }
  function rawPlace(which){
    const card=document.querySelector(`.v317-place-card[data-v317-place="${which}"]`),kind=card?.querySelector('.v317-place-kind')?.value||'stop';
    if(kind==='address')return String(card?.querySelector('.v317-place-address')?.value||q(which==='origin'?'v316Origin':'v316Destination')?.value||'').trim();
    return String(q(which==='origin'?'v316Origin':'v316Destination')?.value||card?.querySelector('.v317-place-search')?.value||'').trim();
  }
  async function geocode(text){
    const s=String(text||'').trim();if(!s)throw new Error('lieu non renseigné');
    try{if(typeof v317Geocode==='function'){const p=await v317Geocode(s);if(validPoint(p))return p}}catch{}
    const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&accept-language=fr&q=${encodeURIComponent(s)}`,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`géocodage HTTP ${r.status}`);const x=(await r.json())?.[0];if(!x)throw new Error(`lieu introuvable : ${s}`);
    return{lat:Number(x.lat),lon:Number(x.lon),name:x.display_name||s};
  }
  async function resolvePoint(which){const p=draftPoint(which);if(p)return p;return geocode(rawPlace(which))}

  async function routeEstimate(start,end){
    if(window.FluoOpsV29?.routeWithAvoids){
      try{const r=await window.FluoOpsV29.routeWithAvoids(start,end);if(Number(r?.duration)>0&&Number(r?.distance)>0)return r}catch(e){console.warn('[Mon SAEIV] calcul HLP avec évitements indisponible, repli OSRM',e)}
    }
    const u=`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false&steps=false&alternatives=false`;
    const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(`routage HTTP ${r.status}`);
    const rt=(await r.json())?.routes?.[0];if(!rt||!Number.isFinite(Number(rt.duration)))throw new Error('aucun itinéraire routier trouvé');return rt;
  }
  function signature(a,b){return `${Number(a.lat).toFixed(5)},${Number(a.lon).toFixed(5)}>${Number(b.lat).toFixed(5)},${Number(b.lon).toFixed(5)}`}

  function applyTimes(){
    if(!isHlp()||!Number.isFinite(S.durationMinutes))return false;
    const start=q('v316Start'),end=q('v316End'),drive=q('v316DriveMinutes'),distance=q('v316Distance');if(!start||!end)return false;
    S.suppress=true;
    try{
      const a=minute(start.value),b=minute(end.value);
      if(S.anchor==='end'&&b!==null)start.value=clock(b-S.durationMinutes);
      else if(a!==null)end.value=clock(a+S.durationMinutes);
      else if(b!==null)start.value=clock(b-S.durationMinutes);
      if(drive)drive.value=String(S.durationMinutes);
      if(distance&&Number.isFinite(S.distanceKm))distance.value=S.distanceKm.toFixed(1);
    }finally{S.suppress=false}
    return true;
  }

  async function calculate(force=false){
    if(!isHlp())return false;
    ensureUi();clearTimeout(S.timer);
    if(S.busy&&!force)return S.busy;
    const token=++S.token;
    const job=(async()=>{
      try{
        const oRaw=rawPlace('origin'),dRaw=rawPlace('destination');
        if(!oRaw||!dRaw){S.durationMinutes=null;S.distanceKm=null;S.routeSignature='';setStatus('Choisis le départ et la destination. Aucun temps supplémentaire ne sera ajouté.');return false}
        setStatus('Calcul de l’itinéraire HLP…','busy');
        const [a,b]=await Promise.all([resolvePoint('origin'),resolvePoint('destination')]);if(token!==S.token)return false;
        const sig=signature(a,b);
        if(!force&&!S.dirty&&S.routeSignature===sig&&S.durationMinutes){applyTimes();return true}
        const route=await routeEstimate(a,b);if(token!==S.token)return false;
        const seconds=Number(route.duration),meters=Number(route.distance||0);if(!Number.isFinite(seconds)||seconds<=0)throw new Error('durée routière indisponible');
        S.durationMinutes=Math.max(1,Math.round(seconds/60));S.distanceKm=Number.isFinite(meters)&&meters>=0?meters/1000:null;S.routeSignature=sig;S.dirty=false;applyTimes();
        setStatus(`Durée routière estimée : ${fmtDuration(S.durationMinutes)}${Number.isFinite(S.distanceKm)?` · ${fmtKm(S.distanceKm)}`:''}. Aucune marge ajoutée.`,'ok');return true;
      }catch(e){if(token!==S.token)return false;S.durationMinutes=null;S.distanceKm=null;S.routeSignature='';S.dirty=true;setStatus(`Impossible de calculer le HLP : ${e.message||e}`,'err');return false}
    })();
    S.busy=job;job.finally(()=>{if(S.busy===job)S.busy=null});return job;
  }
  function scheduleCalculate(delay=500){if(!isHlp())return;clearTimeout(S.timer);S.timer=setTimeout(()=>calculate(false),delay)}
  function markPlaceDirty(){if(!isHlp())return;S.dirty=true;S.durationMinutes=null;S.distanceKm=null;S.routeSignature='';scheduleCalculate(450)}

  function install(){
    const form=q('v316Editor');if(!form)return;
    ensureUi();
    q('v316Type')?.addEventListener('change',()=>{S.dirty=true;S.durationMinutes=null;S.distanceKm=null;S.routeSignature='';S.anchor='start';queueMicrotask(syncVisibility)});
    q('v316Start')?.addEventListener('input',()=>{if(S.suppress||!isHlp())return;S.anchor='start';applyTimes()});
    q('v316Start')?.addEventListener('change',()=>{if(S.suppress||!isHlp())return;S.anchor='start';applyTimes()});
    q('v316End')?.addEventListener('input',()=>{if(S.suppress||!isHlp())return;S.anchor='end';applyTimes()});
    q('v316End')?.addEventListener('change',()=>{if(S.suppress||!isHlp())return;S.anchor='end';applyTimes()});

    const guide=q('v317HlpGuide');
    guide?.addEventListener('input',e=>{if(e.target.matches?.('.v317-place-address'))markPlaceDirty()});
    guide?.addEventListener('change',e=>{if(e.target.closest?.('.v317-place-card'))markPlaceDirty()});
    guide?.addEventListener('click',e=>{if(e.target.closest?.('[data-v317-stop-id],.v317-address-check,.v318-saved-address'))setTimeout(markPlaceDirty,80)});
    guide?.querySelectorAll('.v317-place-selected').forEach(el=>new MutationObserver(()=>markPlaceDirty()).observe(el,{childList:true,characterData:true,subtree:true}));

    new MutationObserver(()=>{if(!form.classList.contains('hidden'))queueMicrotask(syncVisibility)}).observe(form,{attributes:true,attributeFilter:['class']});
    form.addEventListener('submit',async e=>{
      if(!isHlp()||S.resubmitting)return;
      if(!S.dirty&&S.durationMinutes){applyTimes();return}
      e.preventDefault();e.stopImmediatePropagation();
      const ok=await calculate(true);if(!ok){alert('Le temps du haut-le-pied n’a pas pu être calculé. Vérifie le départ et la destination.');return}
      S.resubmitting=true;try{form.requestSubmit()}finally{setTimeout(()=>{S.resubmitting=false},0)}
    },true);
    syncVisibility();
    window.MonSAEIVPlanningHlpAutoTimeV156={installed:true,version:VERSION,recalculate:()=>calculate(true),get durationMinutes(){return S.durationMinutes},get distanceKm(){return S.distanceKm}};
    console.info('[Mon SAEIV] 1.0.56 HLP : durée routière automatique sans marge active');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
