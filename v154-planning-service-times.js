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

/* Mon SAEIV 1.0.57 — création de ligne : arrêts intermédiaires manuels + horaires automatiques. */
(()=>{
  if(window.MonSAEIVLineCreatorStopsV157?.installed)return;
  const q=id=>document.getElementById(id);
  const DB_NAME='fluo-saeiv-custom-lines-v25',STORE='lines';
  const R={origin:null,terminus:null,via:[],stops:null,stopsPromise:null,hits:[],busy:false};
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=s=>`${s?.dept||''}:${s?.id||norm(s?.name)}`;
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():`custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const delay=ms=>new Promise(r=>setTimeout(r,ms));

  function status(text,kind=''){const e=q('v25Status');if(e){e.textContent=text;e.className=`v25-status ${kind}`}}
  async function loadStops(){
    if(R.stops)return R.stops;if(R.stopsPromise)return R.stopsPromise;
    R.stopsPromise=Promise.all(['54','57','67','68'].map(async dept=>{try{const data=window.FluoFlatData?.stops?await window.FluoFlatData.stops(dept):await (await fetch(`./data/${dept}/stops.json`,{cache:'no-store'})).json();return(data?.stops||[]).map(s=>({...s,dept:String(s.dept||dept),lat:Number(s.lat),lon:Number(s.lon)})).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon))}catch{return[]}})).then(parts=>{R.stops=parts.flat();return R.stops}).finally(()=>{R.stopsPromise=null});
    return R.stopsPromise
  }
  function stopSearch(text){
    const s=norm(text);if(!s||!R.stops)return[];const bits=s.split(' ').filter(Boolean);
    return R.stops.map(x=>{const hay=norm(`${x.name} ${x.code||''} ${x.dept}`);let score=0;if(norm(x.name).startsWith(s))score+=40;if(hay.startsWith(s))score+=20;if(bits.every(b=>hay.includes(b)))score+=10;return{x,score}}).filter(z=>z.score>0).sort((a,b)=>b.score-a.score||String(a.x.name).localeCompare(String(b.x.name),'fr')).slice(0,40).map(z=>z.x)
  }
  function endpointFromUi(which){
    const cached=R[which];if(cached)return cached;const input=q(which==='origin'?'v25OriginSearch':'v25TerminusSearch'),selected=q(which==='origin'?'v25OriginSelected':'v25TerminusSelected');const name=String(input?.value||'').trim();if(!name||!R.stops)return null;
    const dept=String(selected?.textContent||'').match(/·\s*(54|57|67|68)\s*$/)?.[1]||'';const xs=R.stops.filter(s=>norm(s.name)===norm(name)&&(!dept||String(s.dept)===dept));return xs[0]||null
  }
  function renderVia(){
    const box=q('v157ViaList');if(!box)return;if(!R.via.length){box.innerHTML='<div class="v157-empty">Aucun arrêt intermédiaire. Ajoute les arrêts dans leur ordre de passage.</div>';return}
    box.innerHTML=R.via.map((s,i)=>`<div class="v157-via-item" data-i="${i}"><div><b>${i+1}. ${esc(s.name)}</b><span>${esc(s.code||'sans code')} · Fluo ${esc(s.dept||'')}</span></div><div class="v157-via-actions"><button type="button" data-v157-act="up" ${i===0?'disabled':''}>↑</button><button type="button" data-v157-act="down" ${i===R.via.length-1?'disabled':''}>↓</button><button type="button" data-v157-act="remove" class="danger">✕</button></div></div>`).join('')
  }
  function renderHits(){
    const box=q('v157ViaResults');if(!box)return;box.innerHTML=R.hits.length?R.hits.map((s,i)=>`<button type="button" class="v157-hit" data-v157-add="${i}"><b>${esc(s.name)}</b><span>${esc(s.code||'sans code')} · Fluo ${esc(s.dept||'')}</span></button>`).join(''):'<div class="v157-empty">Aucun arrêt trouvé.</div>';box.classList.toggle('hidden',!R.hits.length)
  }
  function addVia(stop){
    if(!stop)return;const o=endpointFromUi('origin'),t=endpointFromUi('terminus'),k=key(stop);if((o&&key(o)===k)||(t&&key(t)===k)){status('Cet arrêt est déjà le départ ou le terminus.','err');return}if(R.via.some(s=>key(s)===k)){status('Cet arrêt est déjà dans la ligne.','err');return}if(R.via.length>=48){status('Maximum 48 arrêts intermédiaires pour un même parcours.','err');return}R.via.push(stop);renderVia();q('v157ViaSearch').value='';R.hits=[];renderHits();status(`${R.via.length} arrêt${R.via.length>1?'s':''} intermédiaire${R.via.length>1?'s':''} sélectionné${R.via.length>1?'s':''}. Les horaires seront calculés automatiquement.`,'ok')
  }

  function injectUi(){
    if(q('v157Via'))return true;const terminus=q('v25TerminusSearch')?.closest('label'),grid=terminus?.parentElement;if(!terminus||!grid)return false;
    const css=document.createElement('style');css.id='v157ViaStyle';css.textContent=`
      .v157-via{grid-column:1/-1;padding:10px;border:1px solid #355163;border-radius:13px;background:#081923}.v157-via-head b,.v157-via-head span{display:block}.v157-via-head b{font-size:.76rem}.v157-via-head span{margin-top:2px;color:#9fb5c0;font-size:.62rem;line-height:1.4}.v157-via-search{position:relative;margin-top:8px}.v157-results{position:absolute;z-index:8;left:0;right:0;top:100%;max-height:250px;overflow:auto;border:1px solid #496878;border-radius:10px;background:#071721;box-shadow:0 14px 30px rgba(0,0,0,.45)}.v157-results.hidden{display:none!important}.v157-hit{display:block;width:100%;min-height:0;padding:8px 9px;border:0;border-bottom:1px solid #213b49;border-radius:0;background:transparent;text-align:left}.v157-hit:last-child{border-bottom:0}.v157-hit b,.v157-hit span{display:block}.v157-hit span{margin-top:2px;color:#91a8b6;font-size:.58rem}.v157-list{display:grid;gap:6px;margin-top:8px}.v157-via-item{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px;border:1px solid #2d4859;border-radius:10px;background:#071721}.v157-via-item b,.v157-via-item span{display:block}.v157-via-item b{font-size:.69rem}.v157-via-item span{margin-top:2px;color:#91a8b6;font-size:.58rem}.v157-via-actions{display:flex;gap:4px}.v157-via-actions button{min-width:36px;min-height:34px;padding:4px 7px}.v157-empty{padding:8px;color:#91a8b6;font-size:.62rem}.v157-auto-note{margin-top:8px;padding:7px 8px;border:1px solid #5f5524;border-radius:9px;background:#27220c;color:#ffe58a;font-size:.61rem;font-weight:800}@media(max-width:680px){.v157-via-item{grid-template-columns:1fr}.v157-via-actions{justify-content:flex-end}}
    `;document.head.appendChild(css);
    const wrap=document.createElement('div');wrap.id='v157Via';wrap.className='wide v157-via';wrap.innerHTML='<div class="v157-via-head"><b>＋ Arrêts intermédiaires</b><span>Ajoute ici les arrêts réellement desservis, dans l’ordre de passage. Tu peux ensuite les remonter, les descendre ou les supprimer.</span></div><div class="v157-via-search"><input id="v157ViaSearch" type="search" autocomplete="off" placeholder="Rechercher un arrêt Fluo 54, 57, 67 ou 68…"><div id="v157ViaResults" class="v157-results hidden"></div></div><div id="v157ViaList" class="v157-list"></div><div class="v157-auto-note">⏱ Une seule heure à saisir : l’heure de départ. Tous les horaires suivants sont calculés automatiquement à partir du trajet routier entre les arrêts.</div>';
    terminus.insertAdjacentElement('afterend',wrap);renderVia();
    q('v157ViaSearch')?.addEventListener('input',async e=>{await loadStops();const text=e.target.value;R.hits=text.trim().length>=2?stopSearch(text):[];renderHits()});
    q('v157ViaResults')?.addEventListener('click',e=>{const b=e.target.closest('[data-v157-add]');if(!b)return;addVia(R.hits[Number(b.dataset.v157Add)])});
    q('v157ViaList')?.addEventListener('click',e=>{const row=e.target.closest('[data-i]'),act=e.target.closest('[data-v157-act]')?.dataset.v157Act;if(!row||!act)return;const i=Number(row.dataset.i);if(!Number.isInteger(i)||!R.via[i])return;if(act==='remove')R.via.splice(i,1);else if(act==='up'&&i>0)[R.via[i-1],R.via[i]]=[R.via[i],R.via[i-1]];else if(act==='down'&&i<R.via.length-1)[R.via[i],R.via[i+1]]=[R.via[i+1],R.via[i]];renderVia()});
    return true
  }

  function wireEndpoint(which,inputId,resultsId){
    const input=q(inputId),box=q(resultsId);input?.addEventListener('input',()=>{R[which]=null});box?.addEventListener('click',e=>{const row=e.target.closest('[data-i]');if(!row)return;const s=box._v25?.[Number(row.dataset.i)];if(s)R[which]={...s,dept:String(s.dept||'')};setTimeout(()=>{const ep=endpointFromUi(which);if(ep)R.via=R.via.filter(x=>key(x)!==key(ep));renderVia()},0)},true)
  }

  function db(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id'});s.createIndex('createdAt','createdAt');s.createIndex('code','code')}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
  async function putLine(line){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put({...line,updatedAt:new Date().toISOString(),appVersion:'V157'});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
  async function getLine(id){const d=await db();return new Promise((res,rej)=>{const r=d.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
  async function deleteLine(id){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}

  function baseSeconds(raw){const m=String(raw||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*3600+Number(m[2])*60:null}
  function gtfsTime(total){total=Math.max(0,Math.round(total));const h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
  function displayTime(total){total=((Math.round(total)%86400)+86400)%86400;return `${String(Math.floor(total/3600)).padStart(2,'0')}:${String(Math.floor(total%3600/60)).padStart(2,'0')}`}
  async function routeThrough(stops){
    if(stops.length<2)throw new Error('parcours incomplet');if(stops.length>50)throw new Error('trop d’arrêts pour le calcul routier');const coords=stops.map(s=>`${Number(s.lon)},${Number(s.lat)}`).join(';');const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&alternatives=false`,{cache:'no-store'});if(!r.ok)throw new Error(`routage HTTP ${r.status}`);const rt=(await r.json())?.routes?.[0];if(!rt||!Array.isArray(rt.legs)||rt.legs.length!==stops.length-1)throw new Error('itinéraire routier incomplet');return{legs:rt.legs,shape:(rt.geometry?.coordinates||[]).map(c=>[Number(c[1]),Number(c[0])])}
  }
  function buildSchedule(stops,legs,raw){
    const start=baseSeconds(raw);if(start===null)throw new Error('heure de départ invalide');let t=start,km=0;const rows=[],times=[];const first=stops[0];rows.push({name:first.name,time:displayTime(t),gtfs:gtfsTime(t),profile:'Départ',km:0,lat:first.lat,lon:first.lon,id:first.id,dept:first.dept});times.push([gtfsTime(t),gtfsTime(t)]);
    for(let i=0;i<legs.length;i++){const leg=legs[i],seconds=Math.max(1,Number(leg.duration)||0),meters=Math.max(0,Number(leg.distance)||0);t+=seconds;km+=meters/1000;const last=i===legs.length-1,arr=t,dep=last?arr:arr+30,s=stops[i+1];rows.push({name:s.name,time:displayTime(arr),gtfs:gtfsTime(arr),profile:last?'Terminus':'Arrêt intermédiaire',km,lat:s.lat,lon:s.lon,id:s.id,dept:s.dept});times.push([gtfsTime(arr),gtfsTime(dep)]);if(!last)t=dep}
    return{rows,times,arrivalDisplay:displayTime(t),totalMinutes:Math.max(1,Math.round((t-start)/60)),distanceKm:km}
  }

  function addBridgeItem(line,transient){
    const box=q('v25SavedList');if(!box)return null;[...box.querySelectorAll('[data-id]')].find(x=>x.dataset.id===line.id)?.remove();const el=document.createElement('div');el.className='v25-saved-item';el.dataset.id=line.id;if(transient)el.style.display='none';el.innerHTML=`<div><strong>${esc(line.code||'EX')} · ${esc(line.origin?.name||'Départ')} → ${esc(line.terminus?.name||'Terminus')}</strong><span>${line.stops.length} arrêts · ${line.distanceKm.toFixed(1).replace('.',',')} km · départ ${esc(line.departureTime)}</span></div><div class="buttons"><button data-action="load" type="button">Charger</button><button data-action="delete" class="danger" type="button">Supprimer</button></div>`;box.prepend(el);return el
  }
  async function bridgeToLegacy(line,persist){
    await putLine(line);const item=addBridgeItem(line,!persist);item?.querySelector('[data-action="load"]')?.click();for(let i=0;i<20;i++){await delay(60);const txt=String(q('v25Status')?.textContent||'');if(txt.includes(line.code)&&txt.includes('charg'))break}if(!persist){await deleteLine(line.id);item?.remove()}else window.dispatchEvent(new Event('fluo:custom-lines-request'))
  }

  async function generate(){
    if(R.busy)return;await loadStops();const origin=endpointFromUi('origin'),terminus=endpointFromUi('terminus');if(!origin||!terminus)return status('Choisis réellement un arrêt de départ et un terminus dans les listes.','err');if(key(origin)===key(terminus))return status('Le départ et le terminus doivent être différents.','err');const raw=q('v25DepartureTime')?.value;if(baseSeconds(raw)===null)return status('Renseigne uniquement l’heure de départ.','err');const code=String(q('v25Code')?.value||'EX').trim()||'EX';
    const seen=new Set([key(origin)]),via=[];for(const s of R.via){const k=key(s);if(k===key(terminus)||seen.has(k))continue;seen.add(k);via.push(s)}const stops=[origin,...via,terminus];R.busy=true;const btn=q('v25Generate');if(btn)btn.disabled=true;q('v25Preview')?.classList.add('hidden');status(`Calcul de la ligne · ${stops.length} arrêts dans l’ordre choisi…`,'busy');
    try{const routed=await routeThrough(stops);status('Calcul automatique de tous les horaires depuis l’heure de départ…','busy');const sched=buildSchedule(stops,routed.legs,raw),line={id:uuid(),code,name:code,createdAt:new Date().toISOString(),origin:{...origin},terminus:{...terminus},departureTime:raw,arrivalTime:sched.arrivalDisplay,totalMinutes:sched.totalMinutes,distanceKm:sched.distanceKm,dwellSeconds:30,shape:routed.shape,stops:sched.rows,times:sched.times,headsign:terminus.name,trace_source:'custom_osrm_v157_manual_sequence',manual_stop_sequence:true,viaStops:via.map(s=>({id:s.id,name:s.name,dept:s.dept,lat:s.lat,lon:s.lon,code:s.code||''}))};const persist=q('v25Save')?.checked!==false;await bridgeToLegacy(line,persist);status(`✅ Ligne ${code} créée · ${line.stops.length} arrêts · horaires calculés automatiquement · arrivée ${line.arrivalTime}${persist?' · enregistrée':''}.`,'ok')}
    catch(e){status(`Création impossible : ${e.message||e}. Vérifie le parcours et la connexion Internet.`, 'err')}finally{R.busy=false;if(btn)btn.disabled=false}
  }

  function wireSaved(){
    q('v25SavedList')?.addEventListener('click',async e=>{const act=e.target.closest('[data-action]')?.dataset.action,item=e.target.closest('[data-id]');if(act!=='load'||!item)return;try{const line=await getLine(item.dataset.id);if(!line)return;R.origin=line.origin||null;R.terminus=line.terminus||null;R.via=(line.viaStops?.length?line.viaStops:(line.stops||[]).slice(1,-1)).map(s=>({id:s.id,name:s.name,dept:String(s.dept||''),lat:Number(s.lat),lon:Number(s.lon),code:s.code||''}));renderVia()}catch{}},true)
  }
  function replaceGenerate(){const old=q('v25Generate');if(!old||old.dataset.v157==='1')return;const b=old.cloneNode(true);b.dataset.v157='1';old.replaceWith(b);b.addEventListener('click',generate)}

  async function install(){
    if(!injectUi())return false;await loadStops();wireEndpoint('origin','v25OriginSearch','v25OriginResults');wireEndpoint('terminus','v25TerminusSearch','v25TerminusResults');wireSaved();replaceGenerate();window.MonSAEIVLineCreatorStopsV157={installed:true,version:'1.0.57',get intermediateStops(){return[...R.via]},generate};console.info('[Mon SAEIV] création de ligne : arrêts intermédiaires + horaires automatiques actifs');return true
  }
  function boot(tries=0){if(window.MonSAEIVLineCreatorStopsV157?.installed)return;install().then(ok=>{if(!ok&&tries<40)setTimeout(()=>boot(tries+1),100)}).catch(()=>{if(tries<40)setTimeout(()=>boot(tries+1),100)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
})();
