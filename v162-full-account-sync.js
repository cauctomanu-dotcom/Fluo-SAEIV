'use strict';
/* Mon SAEIV 1.0.75 — synchronisation intégrale du compte conducteur.
   LocalStorage + tous les stockages IndexedDB métier + journaux + statistiques sont répliqués sur Supabase.
   Les journaux sont fusionnés sans effacement local et une fin de course est protégée contre un pull concurrent. */
(()=>{
  if(window.MonSAEIVFullSyncV162?.installed)return;
  const VERSION='1.0.75';
  const JOURNAL_DB='fluo-saeiv-journal-v13';
  const ACCOUNT_KEY='fluoSaeivAccountV13';
  const META_KEY='mon-saeiv-full-sync-meta-v162';
  const ENTRY_MODE_KEY='mon-saeiv-cloud-entry-v156';
  const PROFILE_CACHE='mon-saeiv-cloud-profile-v156';
  const EXTRA_STORES=[
    {db:'fluo-saeiv-fiches-horaires-v24',store:'sheets',create(d){if(!d.objectStoreNames.contains('sheets')){const s=d.createObjectStore('sheets',{keyPath:'id'});s.createIndex('createdAt','createdAt')}}},
    {db:'fluo-saeiv-custom-lines-v25',store:'lines',create(d){if(!d.objectStoreNames.contains('lines')){const s=d.createObjectStore('lines',{keyPath:'id'});s.createIndex('createdAt','createdAt');s.createIndex('code','code')}}},
    {db:'fluo-saeiv-prepared-tad-v26',store:'tads',create(d){if(!d.objectStoreNames.contains('tads')){const s=d.createObjectStore('tads',{keyPath:'id'});s.createIndex('date','serviceDate');s.createIndex('matricule','matricule')}}},
    {db:'fluo-saeiv-prepared-collective-v304',store:'collectives',create(d){if(!d.objectStoreNames.contains('collectives')){const s=d.createObjectStore('collectives',{keyPath:'id'});s.createIndex('date','serviceDate');s.createIndex('matricule','matricule')}}}
  ];
  const S={busy:false,initialized:false,channel:null,timer:null,pullTimer:null,lastFullSync:0,pendingPull:false,finishGuardUntil:0};
  const q=id=>document.getElementById(id);

  function cloud(){return window.MonSAEIVCloudV156}
  function ready(){const c=cloud();return c?.client&&c?.user&&c?.profile?.role==='driver'?c:null}
  function isCloudKey(key){
    return key===META_KEY||key===PROFILE_CACHE||key===ENTRY_MODE_KEY||/^sb-/i.test(key)||/^supabase/i.test(key)||/^mon-saeiv-cloud-/i.test(key);
  }
  function localState(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key||isCloudKey(key))continue;
      const value=localStorage.getItem(key);if(value!==null)out[key]=value;
    }
    return out;
  }
  function stableString(v){try{return JSON.stringify(v,Object.keys(v||{}).sort())}catch{return ''}}
  function jsonSafe(v){try{return JSON.parse(JSON.stringify(v))}catch{return null}}
  function meta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function saveMeta(patch){try{localStorage.setItem(META_KEY,JSON.stringify({...meta(),...patch}))}catch{}}
  function setStatus(text,kind='ok'){
    const el=q('v156CloudStatus');if(el){el.textContent=text;el.className=`v156-cloud-status ${kind}`}
    const btn=q('v156SyncNow');if(btn)btn.textContent='↻ Synchroniser tout le compte';
  }

  function openJournalDb(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('IndexedDB indisponible'));
      const r=indexedDB.open(JOURNAL_DB,1);
      r.onupgradeneeded=()=>{
        const d=r.result;
        if(!d.objectStoreNames.contains('sessions')){const s=d.createObjectStore('sessions',{keyPath:'id'});s.createIndex('startedAt','startedAt');s.createIndex('matricule','matricule')}
        if(!d.objectStoreNames.contains('events')){const e=d.createObjectStore('events',{keyPath:'id',autoIncrement:true});e.createIndex('sessionId','sessionId');e.createIndex('ts','ts');e.createIndex('type','type')}
      };
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Impossible d’ouvrir les journaux'));
    });
  }
  function openExtraDb(cfg){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(cfg.db,1);
      r.onupgradeneeded=()=>cfg.create(r.result);
      r.onsuccess=()=>{const d=r.result;if(!d.objectStoreNames.contains(cfg.store)){d.close();return reject(new Error(`Stockage ${cfg.db}/${cfg.store} absent`))}resolve(d)};
      r.onerror=()=>reject(r.error||new Error(`Impossible d’ouvrir ${cfg.db}`));
    });
  }
  async function readStore(db,name){return new Promise((res,rej)=>{const r=db.transaction(name,'readonly').objectStore(name).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
  async function readJournals(){const db=await openJournalDb();try{const [sessions,events]=await Promise.all([readStore(db,'sessions'),readStore(db,'events')]);return {sessions,events}}finally{try{db.close()}catch{}}}
  function eventSignature(e){return `${String(e?.sessionId||'global')}|${String(e?.ts||'')}|${String(e?.type||'')}|${String(e?.stopIndex??'')}|${String(e?.control||e?.reason||'')}`}
  function sessionFreshness(s){const v=s?.endedAt||s?.lastCheckpointAt||s?.updatedAt||s?.startedAt||'';const n=Date.parse(v);return Number.isFinite(n)?n:0}
  async function mergeJournals(remoteSessions,remoteEvents){
    const db=await openJournalDb();
    try{
      const localSessions=await readStore(db,'sessions'),localEvents=await readStore(db,'events');
      const byId=new Map();
      for(const x of remoteSessions||[]){if(x?.id!=null)byId.set(String(x.id),x)}
      for(const x of localSessions||[]){if(x?.id==null)continue;const k=String(x.id),old=byId.get(k);if(!old||sessionFreshness(x)>=sessionFreshness(old))byId.set(k,x)}
      const signatures=new Set(localEvents.map(eventSignature));
      await new Promise((res,rej)=>{
        const tx=db.transaction(['sessions','events'],'readwrite'),ss=tx.objectStore('sessions'),es=tx.objectStore('events');
        for(const x of byId.values())ss.put(x);
        for(const x of remoteEvents||[]){if(!x)continue;const sig=eventSignature(x);if(signatures.has(sig))continue;signatures.add(sig);const v={...x};delete v.id;es.add(v)}
        tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error||new Error('Fusion journaux impossible'));tx.onabort=()=>rej(tx.error||new Error('Fusion journaux annulée'));
      });
      return {sessions:byId.size,events:signatures.size};
    }finally{try{db.close()}catch{}}
  }
  async function readExtraStores(){
    const out={};
    for(const cfg of EXTRA_STORES){const db=await openExtraDb(cfg);try{out[`${cfg.db}/${cfg.store}`]=jsonSafe(await readStore(db,cfg.store))||[]}finally{try{db.close()}catch{}}}
    return out;
  }
  async function replaceExtraStores(remote){
    if(!remote||typeof remote!=='object')return 0;let count=0;
    for(const cfg of EXTRA_STORES){const key=`${cfg.db}/${cfg.store}`;if(!Object.prototype.hasOwnProperty.call(remote,key))continue;const rows=Array.isArray(remote[key])?remote[key]:[],db=await openExtraDb(cfg);try{await new Promise((res,rej)=>{const tx=db.transaction(cfg.store,'readwrite'),st=tx.objectStore(cfg.store);st.clear();for(const row of rows){if(row!=null)st.put(row)}tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error||new Error(`Restauration ${key} impossible`));tx.onabort=()=>rej(tx.error||new Error(`Restauration ${key} annulée`))});count+=rows.length}finally{try{db.close()}catch{}}}
    return count;
  }
  function mineSessions(xs,matricule){const id=String(matricule||'').trim().toLowerCase();return id?xs.filter(s=>String(s?.matricule||'').trim().toLowerCase()===id):xs}
  function computeStats(sessions,events){
    try{if(typeof window.MonSAEIVV133?.profileStats==='function')return window.MonSAEIVV133.profileStats(sessions,events)}catch(e){console.warn('[Mon SAEIV] stats sync',e)}
    return {sessions:sessions.length,distance:sessions.reduce((a,s)=>a+(Number(s?.distanceKm)||0),0),events:events.length};
  }
  function isoOrNull(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString()}
  function eventKey(e,index){return `${String(e?.sessionId||'global')}::${String(e?.id??`${e?.ts||'event'}-${e?.type||'x'}-${index}`)}`}
  async function pagedSelect(builderFactory,pageSize=1000){let from=0,out=[];for(;;){const {data,error}=await builderFactory(from,from+pageSize-1);if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<pageSize)break;from+=pageSize}return out}
  async function upsertChunks(table,rows,onConflict,size=350){const c=ready()?.client;if(!c)return;for(let i=0;i<rows.length;i+=size){const {error}=await c.from(table).upsert(rows.slice(i,i+size),{onConflict});if(error)throw error}}
  async function deleteMissing(table,keyColumn,keep){const c=ready()?.client,u=ready()?.user;if(!c||!u)return;const rows=await pagedSelect((from,to)=>c.from(table).select(keyColumn).eq('user_id',u.id).range(from,to));const stale=rows.map(x=>String(x[keyColumn])).filter(k=>!keep.has(k));for(let i=0;i<stale.length;i+=150){const {error}=await c.from(table).delete().eq('user_id',u.id).in(keyColumn,stale.slice(i,i+150));if(error)throw error}}

  async function pushStateOnly(silent=true){
    const C=ready();if(!C||S.busy)return;const state=localState();
    try{const {error}=await C.client.from('account_state').upsert({user_id:C.user.id,state,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;saveMeta({lastPushAt:Date.now(),lastStateHash:stableString(state)});if(!silent)setStatus('Compte synchronisé.','ok')}
    catch(e){console.warn('[Mon SAEIV] push état complet',e);if(!silent)setStatus('Synchronisation différée : '+(e.message||e),'err')}
  }
  async function pushAll({silent=false}={}){
    const C=ready();if(!C||S.busy)return false;
    if(window.state?.running){await pushStateOnly(true);if(!silent)setStatus('Compte synchronisé. Le journal du service en cours sera envoyé à la fin.','ok');return true}
    S.busy=true;
    try{
      const [jr,extra]=await Promise.all([readJournals(),readExtraStores()]);
      const state=localState(),sessions=mineSessions(jr.sessions,C.profile.matricule),ids=new Set(sessions.map(s=>String(s.id))),events=jr.events.filter(e=>!e?.sessionId||ids.has(String(e.sessionId))),stats=computeStats(sessions,events),now=new Date().toISOString();
      const {error:stateErr}=await C.client.from('account_state').upsert({user_id:C.user.id,state,stats,updated_at:now},{onConflict:'user_id'});if(stateErr)throw stateErr;
      const sessionRows=sessions.map(s=>({user_id:C.user.id,session_id:String(s.id),started_at:isoOrNull(s.startedAt),payload:s,updated_at:now}));await upsertChunks('journal_sessions',sessionRows,'user_id,session_id');await deleteMissing('journal_sessions','session_id',new Set(sessionRows.map(x=>x.session_id)));
      const eventRows=events.map((e,i)=>({user_id:C.user.id,event_key:eventKey(e,i),session_id:e?.sessionId==null?null:String(e.sessionId),event_ts:isoOrNull(e?.ts),payload:e,updated_at:now}));await upsertChunks('journal_events',eventRows,'user_id,event_key');await deleteMissing('journal_events','event_key',new Set(eventRows.map(x=>x.event_key)));
      const storeRows=Object.entries(extra).map(([store_key,payload])=>({user_id:C.user.id,store_key,payload,updated_at:now}));await upsertChunks('account_stores',storeRows,'user_id,store_key');
      S.lastFullSync=Date.now();const extraCount=Object.values(extra).reduce((n,x)=>n+(Array.isArray(x)?x.length:0),0);saveMeta({lastPushAt:S.lastFullSync,lastServerAt:now,lastStateHash:stableString(state),sessionCount:sessions.length,eventCount:events.length,extraCount});
      if(!silent)setStatus(`Compte complet synchronisé · ${sessions.length} journal${sessions.length>1?'x':''} · statistiques et données métier à jour.`,'ok');
      window.dispatchEvent(new CustomEvent('mon-saeiv-full-account-synced',{detail:{direction:'push',sessions:sessions.length,events:events.length,extraCount,stats}}));return true;
    }catch(e){console.warn('[Mon SAEIV] push compte complet',e);if(!silent)setStatus('Synchronisation complète différée : '+(e.message||e),'err');return false}
    finally{S.busy=false}
  }
  function applyState(remote){const before=localState(),next=remote&&typeof remote==='object'?remote:{};for(const key of Object.keys(before)){if(!(key in next))localStorage.removeItem(key)}for(const [key,value] of Object.entries(next)){if(isCloudKey(key)||typeof value!=='string')continue;localStorage.setItem(key,value)}return stableString(before)!==stableString(localState())}
  async function pullAll({silent=false,allowReload=true}={}){
    const C=ready();if(!C||S.busy)return false;
    if(window.state?.running){S.pendingPull=true;return false}
    if(Date.now()<S.finishGuardUntil){S.pendingPull=true;clearTimeout(S.pullTimer);S.pullTimer=setTimeout(()=>pullAll({silent:true,allowReload:false}),Math.max(250,S.finishGuardUntil-Date.now()+250));return false}
    S.busy=true;
    try{
      const {data:accountRow,error:ae}=await C.client.from('account_state').select('state,stats,updated_at').eq('user_id',C.user.id).maybeSingle();if(ae)throw ae;if(!accountRow){S.busy=false;return await pushAll({silent})}
      const [sessionRows,eventRows,storeRows]=await Promise.all([
        pagedSelect((from,to)=>C.client.from('journal_sessions').select('session_id,payload,started_at,updated_at').eq('user_id',C.user.id).order('started_at',{ascending:true,nullsFirst:false}).range(from,to)),
        pagedSelect((from,to)=>C.client.from('journal_events').select('event_key,session_id,payload,event_ts,updated_at').eq('user_id',C.user.id).order('event_ts',{ascending:true,nullsFirst:false}).range(from,to)),
        pagedSelect((from,to)=>C.client.from('account_stores').select('store_key,payload,updated_at').eq('user_id',C.user.id).range(from,to))
      ]);
      const sessions=sessionRows.map(r=>r.payload).filter(Boolean),events=eventRows.map(r=>r.payload).filter(Boolean),remoteStores=Object.fromEntries(storeRows.map(r=>[r.store_key,Array.isArray(r.payload)?r.payload:[]]));
      const stateChanged=applyState(accountRow.state||{}),journalMerge=await mergeJournals(sessions,events);const extraCount=storeRows.length?await replaceExtraStores(remoteStores):0;
      S.lastFullSync=Date.now();S.pendingPull=false;saveMeta({lastPullAt:S.lastFullSync,lastServerAt:accountRow.updated_at,sessionCount:journalMerge.sessions,eventCount:journalMerge.events,extraCount});
      if(!silent)setStatus(`Compte restauré depuis le serveur · ${journalMerge.sessions} journal${journalMerge.sessions>1?'x':''} conservé${journalMerge.sessions>1?'s':''} · statistiques et données métier synchronisées.`,'ok');
      window.dispatchEvent(new CustomEvent('mon-saeiv-full-account-synced',{detail:{direction:'pull',sessions:journalMerge.sessions,events:journalMerge.events,extraCount,stats:accountRow.stats||{}}}));
      const guard='mon-saeiv-full-sync-reloaded-v162';if(stateChanged&&allowReload&&sessionStorage.getItem(guard)!=='1'){sessionStorage.setItem(guard,'1');setTimeout(()=>location.reload(),180);return true}return true;
    }catch(e){console.warn('[Mon SAEIV] pull compte complet',e);if(!silent)setStatus('Restauration serveur différée : '+(e.message||e),'err');return false}
    finally{S.busy=false}
  }
  async function serverHasData(){const C=ready();if(!C)return false;const [{data:a,error:ae},{data:j,error:je}]=await Promise.all([C.client.from('account_state').select('user_id').eq('user_id',C.user.id).maybeSingle(),C.client.from('journal_sessions').select('session_id').eq('user_id',C.user.id).limit(1)]);if(ae)throw ae;if(je)throw je;return !!a||!!j?.length}
  async function initialSync(){if(S.initialized||!ready())return;S.initialized=true;try{if(await serverHasData())await pullAll({silent:false,allowReload:true});else await pushAll({silent:false})}catch(e){console.warn('[Mon SAEIV] initial full sync',e);setStatus('Compte local conservé · serveur momentanément indisponible.','err')}subscribe()}
  function scheduleFull(delay=2500){clearTimeout(S.timer);S.timer=setTimeout(()=>pushAll({silent:true}),delay)}
  function schedulePull(delay=1400){clearTimeout(S.pullTimer);S.pullTimer=setTimeout(()=>pullAll({silent:true,allowReload:false}),delay)}
  function subscribe(){const C=ready();if(!C)return;try{if(S.channel)C.client.removeChannel(S.channel)}catch{}S.channel=C.client.channel(`full-account-${C.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'account_state',filter:`user_id=eq.${C.user.id}`},()=>{if(!S.busy)schedulePull()}).on('postgres_changes',{event:'*',schema:'public',table:'journal_sessions',filter:`user_id=eq.${C.user.id}`},()=>{if(!S.busy)schedulePull(2200)}).on('postgres_changes',{event:'*',schema:'public',table:'account_stores',filter:`user_id=eq.${C.user.id}`},()=>{if(!S.busy)schedulePull(2200)}).subscribe()}
  async function syncNow(){const ok=await pushAll({silent:false});if(ok)await pullAll({silent:true,allowReload:false});return ok}
  function installHooks(){
    const bindButton=()=>{const b=q('v156SyncNow');if(!b||b.dataset.v162Bound)return;b.dataset.v162Bound='1';b.textContent='↻ Synchroniser tout le compte';b.addEventListener('click',()=>setTimeout(syncNow,0))};bindButton();const mo=new MutationObserver(bindButton);mo.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('#finish')){S.finishGuardUntil=Date.now()+5000;clearTimeout(S.pullTimer);S.pendingPull=true;setTimeout(async()=>{S.finishGuardUntil=0;await syncNow();if(S.pendingPull)schedulePull(500)},1800)}else scheduleFull(4500)},true);
    window.addEventListener('mon-saeiv-planning-changed',()=>scheduleFull(3000));window.addEventListener('online',()=>setTimeout(syncNow,400));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!window.state?.running)pushAll({silent:true});else if(document.visibilityState==='visible'&&S.pendingPull)schedulePull(500)});setInterval(()=>{if(ready()&&!window.state?.running)pushAll({silent:true})},60000);
  }
  function boot(){installHooks();let tries=0;const t=setInterval(()=>{if(ready()){clearInterval(t);initialSync()}else if(++tries>240)clearInterval(t)},250)}
  window.MonSAEIVFullSyncV162={installed:true,version:VERSION,sync:syncNow,push:pushAll,pull:pullAll,readJournals,readExtraStores,localState,get lastSync(){return S.lastFullSync}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();