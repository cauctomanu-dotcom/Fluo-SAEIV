'use strict';
/* Mon SAEIV 1.0.56 — durées automatiques dans Mon planning.
   Prise de service : 10 minutes.
   Fin de service : 5 minutes.
   HLP : durée calculée sur l'itinéraire routier, sans marge ni temps ajouté. */
(()=>{
  if(window.MonSAEIVPlanningServiceTimesV154?.installed)return;
  const VERSION='1.0.56';
  const PLAN_KEY='fluo-saeiv-planning-v316';
  const FIXED=Object.freeze({start:10,end:5});
  const q=id=>document.getElementById(id);
  const H={minutes:null,km:null,signature:'',dirty:true,busy:null,timer:null,anchor:'start',suppress:false,resubmitting:false,token:0};

  function minute(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;const h=Number(m[1]),mn=Number(m[2]);return h>=0&&h<=23&&mn>=0&&mn<=59?h*60+mn:null}
  function clock(total){if(!Number.isFinite(Number(total)))return'';const n=((Math.round(Number(total))%1440)+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
  function durationFor(type){return FIXED[String(type||'')]||null}
  function expectedEnd(type,start){const d=durationFor(type),m=minute(start);return d&&m!==null?clock(m+d):null}
  function isHlp(){return q('v316Type')?.value==='hlp'}
  function validPoint(p){return !!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))}

  function fixedHelper(){
    const input=q('v316End'),label=input?.closest('label');if(!label)return null;
    let h=q('v154FixedDurationHelp');if(!h){h=document.createElement('small');h.id='v154FixedDurationHelp';h.style.cssText='display:none;margin-top:2px;color:#ffd000;font-size:.62rem;font-weight:850';label.appendChild(h)}return h
  }
  function syncFixed(){
    const type=q('v316Type')?.value,d=durationFor(type),start=q('v316Start'),end=q('v316End'),h=fixedHelper();if(!end)return;
    if(!d){end.readOnly=false;end.removeAttribute('aria-readonly');end.removeAttribute('data-v154-fixed');if(h)h.style.display='none';return}
    const e=expectedEnd(type,start?.value);if(e)end.value=e;end.readOnly=true;end.setAttribute('aria-readonly','true');end.dataset.v154Fixed=String(d);
    if(h){h.textContent=type==='start'?'Durée automatique : 10 minutes':'Durée automatique : 5 minutes';h.style.display='block'}
  }
  function normalizeExisting(){
    let live=[];try{live=window.FluoPlanningV316?.items?.()||[]}catch{}if(!Array.isArray(live)||!live.length)return 0;let changed=0;
    for(const item of live){const e=expectedEnd(item?.type,item?.start);if(!e||item.end===e)continue;item.end=e;item.updatedAt=new Date().toISOString();changed++}
    if(!changed)return 0;
    try{const stored=JSON.parse(localStorage.getItem(PLAN_KEY)||'{}');if(Array.isArray(stored.items)){const byId=new Map(live.map(x=>[String(x.id),x]));for(const x of stored.items){const n=byId.get(String(x.id));if(n&&durationFor(n.type)){x.end=n.end;x.updatedAt=n.updatedAt}}localStorage.setItem(PLAN_KEY,JSON.stringify(stored))}}catch(e){console.warn('[Mon SAEIV] normalisation durées planning',e)}
    try{window.dispatchEvent(new CustomEvent('mon-saeiv-planning-durations-normalized',{detail:{changed}}))}catch{}return changed
  }

  function ensureHlpUi(){
    const guide=q('v317HlpGuide');if(!guide)return null;let box=q('v154HlpAutoTime');if(box)return box;
    const st=document.createElement('style');st.id='v154HlpAutoTimeStyle';st.textContent='.v154-hlp-time{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin-top:10px;padding:10px 11px;border:1px solid #3d6073;border-radius:12px;background:#071721}.v154-hlp-time.hidden{display:none!important}.v154-hlp-time b,.v154-hlp-time span{display:block}.v154-hlp-time b{font-size:.72rem}.v154-hlp-time span{margin-top:2px;color:#a6bbc5;font-size:.62rem;line-height:1.35}.v154-hlp-time.ok{border-color:#397c51;background:#0c2718}.v154-hlp-time.busy{border-color:#807025;background:#29240d}.v154-hlp-time.err{border-color:#8a4446;background:#2d1719}.v154-hlp-time button{min-height:36px;padding:6px 9px;font-size:.6rem}@media(max-width:680px){.v154-hlp-time{grid-template-columns:1fr}.v154-hlp-time button{width:100%}}';document.head.appendChild(st);
    box=document.createElement('div');box.id='v154HlpAutoTime';box.className='v154-hlp-time';box.innerHTML='<div><b>⏱ Durée HLP automatique</b><span id="v154HlpAutoTimeStatus">Choisis le départ et la destination. Aucun temps supplémentaire ne sera ajouté.</span></div><button id="v154HlpAutoTimeRecalc" type="button">↻ Recalculer</button>';
    const pair=guide.querySelector('.v317-place-pair');(pair||guide).insertAdjacentElement('afterend',box);q('v154HlpAutoTimeRecalc')?.addEventListener('click',()=>{H.dirty=true;calculateHlp(true)});return box
  }
  function hlpStatus(text,kind=''){const box=ensureHlpUi(),e=q('v154HlpAutoTimeStatus');if(!box||!e)return;box.className=`v154-hlp-time${kind?` ${kind}`:''}`;e.textContent=text}
  function fmtDuration(m){m=Math.max(1,Math.round(Number(m)||0));return m>=60?`${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')}`:`${m} min`}
  function fmtKm(km){const n=Number(km);return Number.isFinite(n)?`${n.toFixed(n>=10?1:2).replace('.',',')} km`:'—'}

  function draftPoint(which){
    try{const p=which==='origin'?(typeof draftOrigin!=='undefined'?draftOrigin:null):(typeof draftDestination!=='undefined'?draftDestination:null);if(validPoint(p))return{lat:Number(p.lat),lon:Number(p.lon),name:p.name||''}}catch{}return null
  }
  function rawPlace(which){
    const card=document.querySelector(`.v317-place-card[data-v317-place="${which}"]`),kind=card?.querySelector('.v317-place-kind')?.value||'stop';
    if(kind==='address')return String(card?.querySelector('.v317-place-address')?.value||q(which==='origin'?'v316Origin':'v316Destination')?.value||'').trim();
    return String(q(which==='origin'?'v316Origin':'v316Destination')?.value||'').trim()
  }
  async function geocode(text){
    const s=String(text||'').trim();if(!s)throw new Error('lieu non renseigné');
    try{if(typeof v317Geocode==='function'){const p=await v317Geocode(s);if(validPoint(p))return p}}catch{}
    const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&accept-language=fr&q=${encodeURIComponent(s)}`,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`géocodage HTTP ${r.status}`);const x=(await r.json())?.[0];if(!x)throw new Error(`lieu introuvable : ${s}`);return{lat:Number(x.lat),lon:Number(x.lon),name:x.display_name||s}
  }
  async function resolvePoint(which){return draftPoint(which)||geocode(rawPlace(which))}
  async function routeEstimate(a,b){
    if(window.FluoOpsV29?.routeWithAvoids){try{const r=await window.FluoOpsV29.routeWithAvoids(a,b);if(Number(r?.duration)>0)return r}catch(e){console.warn('[Mon SAEIV] routage HLP avec évitements indisponible',e)}}
    const u=`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&steps=false&alternatives=false`,r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(`routage HTTP ${r.status}`);const rt=(await r.json())?.routes?.[0];if(!rt||!Number.isFinite(Number(rt.duration)))throw new Error('aucun itinéraire routier trouvé');return rt
  }
  function pointSignature(a,b){return `${Number(a.lat).toFixed(5)},${Number(a.lon).toFixed(5)}>${Number(b.lat).toFixed(5)},${Number(b.lon).toFixed(5)}`}
  function applyHlpTimes(){
    if(!isHlp()||!Number.isFinite(H.minutes))return false;const start=q('v316Start'),end=q('v316End'),drive=q('v316DriveMinutes'),distance=q('v316Distance');if(!start||!end)return false;H.suppress=true;
    try{const a=minute(start.value),b=minute(end.value);if(H.anchor==='end'&&b!==null)start.value=clock(b-H.minutes);else if(a!==null)end.value=clock(a+H.minutes);else if(b!==null)start.value=clock(b-H.minutes);if(drive)drive.value=String(H.minutes);if(distance&&Number.isFinite(H.km))distance.value=H.km.toFixed(1)}finally{H.suppress=false}return true
  }
  async function calculateHlp(force=false){
    if(!isHlp())return false;ensureHlpUi();clearTimeout(H.timer);if(H.busy&&!force)return H.busy;const token=++H.token;
    const job=(async()=>{try{
      const o=rawPlace('origin'),d=rawPlace('destination');if(!o||!d){H.minutes=null;H.km=null;H.signature='';hlpStatus('Choisis le départ et la destination. Aucun temps supplémentaire ne sera ajouté.');return false}
      hlpStatus('Calcul de l’itinéraire HLP…','busy');const [a,b]=await Promise.all([resolvePoint('origin'),resolvePoint('destination')]);if(token!==H.token)return false;const sig=pointSignature(a,b);
      if(!force&&!H.dirty&&H.signature===sig&&H.minutes){applyHlpTimes();return true}
      const route=await routeEstimate(a,b);if(token!==H.token)return false;const seconds=Number(route.duration),meters=Number(route.distance);if(!Number.isFinite(seconds)||seconds<=0)throw new Error('durée routière indisponible');
      H.minutes=Math.max(1,Math.round(seconds/60));H.km=Number.isFinite(meters)&&meters>=0?meters/1000:null;H.signature=sig;H.dirty=false;applyHlpTimes();hlpStatus(`Durée routière estimée : ${fmtDuration(H.minutes)}${Number.isFinite(H.km)?` · ${fmtKm(H.km)}`:''}. Aucune marge ajoutée.`,'ok');return true
    }catch(e){if(token!==H.token)return false;H.minutes=null;H.km=null;H.signature='';H.dirty=true;hlpStatus(`Impossible de calculer le HLP : ${e.message||e}`,'err');return false}})();
    H.busy=job;job.finally(()=>{if(H.busy===job)H.busy=null});return job
  }
  function scheduleHlp(ms=450){if(!isHlp())return;clearTimeout(H.timer);H.timer=setTimeout(()=>calculateHlp(false),ms)}
  function dirtyHlp(){if(!isHlp())return;H.dirty=true;H.minutes=null;H.km=null;H.signature='';scheduleHlp()}
  function syncHlp(){
    const box=ensureHlpUi(),on=isHlp();box?.classList.toggle('hidden',!on);const drive=q('v316DriveMinutes');if(drive){drive.readOnly=on;drive.toggleAttribute('aria-readonly',on)}
    if(!on){clearTimeout(H.timer);return}if(H.minutes&&!H.dirty)applyHlpTimes();else scheduleHlp(80)
  }

  function install(){
    const type=q('v316Type'),start=q('v316Start'),end=q('v316End'),form=q('v316Editor');if(!form)return;
    type?.addEventListener('change',()=>{syncFixed();H.dirty=true;H.minutes=null;H.km=null;H.signature='';H.anchor='start';queueMicrotask(syncHlp)});
    start?.addEventListener('input',()=>{syncFixed();if(H.suppress||!isHlp())return;H.anchor='start';applyHlpTimes()});start?.addEventListener('change',()=>{syncFixed();if(H.suppress||!isHlp())return;H.anchor='start';applyHlpTimes()});
    end?.addEventListener('input',()=>{if(durationFor(type?.value))syncFixed();if(H.suppress||!isHlp())return;H.anchor='end';applyHlpTimes()});end?.addEventListener('change',()=>{if(H.suppress||!isHlp())return;H.anchor='end';applyHlpTimes()});
    const guide=q('v317HlpGuide');guide?.addEventListener('input',e=>{if(e.target.matches?.('.v317-place-address'))dirtyHlp()});guide?.addEventListener('change',e=>{if(e.target.closest?.('.v317-place-card'))dirtyHlp()});guide?.addEventListener('click',e=>{if(e.target.closest?.('[data-v317-stop-id],.v317-address-check'))setTimeout(dirtyHlp,80)});guide?.querySelectorAll('.v317-place-selected').forEach(el=>new MutationObserver(dirtyHlp).observe(el,{childList:true,characterData:true,subtree:true}));
    form.addEventListener('submit',syncFixed,true);
    form.addEventListener('submit',async e=>{if(!isHlp()||H.resubmitting)return;if(!H.dirty&&H.minutes){applyHlpTimes();return}e.preventDefault();e.stopImmediatePropagation();const ok=await calculateHlp(true);if(!ok){alert('Le temps du haut-le-pied n’a pas pu être calculé. Vérifie le départ et la destination.');return}H.resubmitting=true;try{form.requestSubmit()}finally{setTimeout(()=>{H.resubmitting=false},0)}},true);
    new MutationObserver(()=>{if(!form.classList.contains('hidden'))queueMicrotask(()=>{syncFixed();syncHlp()})}).observe(form,{attributes:true,attributeFilter:['class']});
    normalizeExisting();syncFixed();syncHlp();
    window.MonSAEIVPlanningServiceTimesV154={installed:true,version:VERSION,durations:{priseDeServiceMinutes:10,finDeServiceMinutes:5},normalize:normalizeExisting,syncEditor:()=>{syncFixed();syncHlp()},recalculateHlp:()=>calculateHlp(true),get hlpMinutes(){return H.minutes}};
    console.info('[Mon SAEIV] 1.0.56 planning : prise 10 min · fin 5 min · HLP automatique sans marge')
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
