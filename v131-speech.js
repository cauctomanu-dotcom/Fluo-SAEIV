'use strict';
/* Mon SAEIV — moteur vocal prioritaire cloud + secours système.
   Les annonces voyageurs utilisent la même voix IA sur Android/iPhone quand la session serveur est active.
   En cas d'absence réseau/TTS, le moteur Web Speech local reprend automatiquement. */
(()=>{
  const VERSION='1.0.80';
  const START_RETRY_MS=2200, CANCEL_RESTART_MS=140, RECENT_MS=12000, IDENTITY_STOP_INTERVAL=5;
  const CLOUD_URL='https://xpmrnwipnoekiycghwli.supabase.co/functions/v1/passenger-tts';
  const CLOUD_KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
  const CLOUD_CACHE='mon-saeiv-passenger-tts-v1';
  const CLOUD_TIMEOUT_MS=7000;
  let installed=false, watchdog=null, identityAnchorStop=null, identityCourseKey=null, cloudBackoffUntil=0;
  const recent=new Map();

  function getAudioState(){try{return (typeof state!=='undefined'&&state?.audio)?state.audio:null}catch{return null}}
  function synth(){return ('speechSynthesis'in window)?window.speechSynthesis:null}
  function rawText(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function safePronunciation(text){const raw=rawText(text);if(!raw)return'';try{let t=raw;t=t.replace(/\b(Place\s+du\s+)Marche\b/gi,(_,p)=>`${p}Marché`);t=t.replace(/\bArs(?=[\s-]+Laquenexy\b)/gi,'Arse');t=t.replace(/\bcimeti(?:e|è|é)re\b/gi,'cime-tière');return rawText(t)||raw}catch{return raw}}
  function passengerVoicePreference(){try{return localStorage.getItem('fluoPassengerVoice')==='male'?'male':'female'}catch{return'female'}}
  function voiceText(v){return `${v?.name||''} ${v?.voiceURI||''} ${v?.lang||''}`}
  function voiceProfile(){
    const s=synth(),pref=passengerVoicePreference();
    if(!s)return{voice:null,pref,pitch:pref==='male'?.52:1.04,matched:false};
    const vs=(s.getVoices?.()||[]).filter(v=>/^fr([_-]|$)/i.test(v.lang||''));
    if(!vs.length)return{voice:null,pref,pitch:pref==='male'?.52:1.04,matched:false};
    const female=/(audrey|aur[eé]lie|am[eé]lie|marie|virginie|hortense|c[eé]line|samantha|victoria|ava|zo[eé]|female|femme|feminin|féminin)/i;
    const male=/(thomas|daniel|nicolas|henri|paul|jacques|olivier|alain|gerard|g[eé]rard|jean|louis|male|homme|masculin)/i;
    const exact=pref==='male'?vs.find(v=>male.test(voiceText(v))):vs.find(v=>female.test(voiceText(v)));
    if(exact)return{voice:exact,pref,pitch:1,matched:true};
    const opposite=pref==='male'?female:male,neutral=vs.find(v=>!opposite.test(voiceText(v)));
    return{voice:neutral||vs[0],pref,pitch:pref==='male'?.52:1.04,matched:false};
  }
  function frenchVoice(){return voiceProfile().voice}
  function duckStart(kind){try{window.MonSAEIVRadio?.duckStart?.(kind)}catch{}}
  function duckEnd(kind){try{window.MonSAEIVRadio?.duckEnd?.(kind)}catch{}}
  function stateTarget(){try{return Number.isInteger(state?.target)?state.target:null}catch{return null}}
  function currentStopIndex(){try{return Number.isInteger(state?.current)?state.current:null}catch{return null}}
  function courseKey(){try{return `${state?.route?.id||state?.route?.short||''}|${state?.pattern?.id||state?.pattern?.headsign||''}|${document.getElementById('startStop')?.value||''}`}catch{return''}}
  function destinationCadenceAllows(text,kind){
    const current=currentStopIndex();if(!Number.isInteger(current))return true;
    const key=courseKey();if(key!==identityCourseKey){identityCourseKey=key;identityAnchorStop=null}
    const containsDestination=/\bà destination de\b/i.test(rawText(text));
    if((kind==='departure'||kind==='system')&&containsDestination){identityAnchorStop=current;return true}
    if(kind!=='identity')return true;
    if(identityAnchorStop===null||current<identityAnchorStop){identityAnchorStop=current;return true}
    if(current-identityAnchorStop<IDENTITY_STOP_INTERVAL)return false;identityAnchorStop=current;return true;
  }
  function semantic(text,opts,kind){
    const t=rawText(text),target=Number.isInteger(opts?.targetIndex)?opts.targetIndex:(kind==='stop'?stateTarget():null);
    let role=opts?.role||null;if(!role&&kind==='stop'&&/^Prochain arrêt\b/i.test(t))role='next-stop';if(!role&&kind==='stop'&&/^Arrêt\b/i.test(t))role='arrival';
    let key=opts?.key||null;if(!key&&role&&Number.isInteger(target))key=`${role}:${target}`;return{role,target,key};
  }
  function obsolete(item){
    if(!item||item.cancelled)return true;if(typeof item.valid==='function'){try{if(!item.valid())return true}catch{return true}}
    if((item.role==='next-stop'||item.role==='arrival')&&Number.isInteger(item.target)){
      let running=false,target=null,arrival=false;try{running=!!state?.running;target=state?.target;arrival=!!state?.arrivalAnnounced}catch{}
      if(!running||target!==item.target)return true;if(item.role==='next-stop'&&arrival)return true;
    }return false;
  }
  function cleanRecent(){const now=Date.now();for(const[k,v]of recent)if(now-v>RECENT_MS)recent.delete(k)}
  function duplicate(audio,item){cleanRecent();if(!item.key)return false;if(recent.has(item.key))return true;if(audio?.current?.item?.key===item.key&&!audio.current.item.cancelled)return true;return(audio?.queue||[]).some(x=>x?.key===item.key&&!x.cancelled)}
  function purge(audio){if(audio)audio.queue=(audio.queue||[]).filter(x=>!obsolete(x))}

  function cloudCandidate(item){
    const C=window.MonSAEIVCloudV156;
    return Date.now()>=cloudBackoffUntil&&navigator.onLine!==false&&!!C?.client&&!!C?.user&&['departure','identity','stop','system'].includes(item?.kind);
  }
  function cacheRequest(text,pref){return new Request(`${location.origin}/__mon_saeiv_tts_cache__/${pref}.mp3?text=${encodeURIComponent(text)}`)}
  async function getCloudBlob(text,pref,signal){
    const key=cacheRequest(text,pref);
    try{if('caches'in window){const c=await caches.open(CLOUD_CACHE),hit=await c.match(key);if(hit)return await hit.blob()}}catch{}
    const C=window.MonSAEIVCloudV156,{data}=await C.client.auth.getSession(),token=data?.session?.access_token;if(!token)throw new Error('cloud-no-session');
    const r=await fetch(CLOUD_URL,{method:'POST',signal,headers:{Authorization:`Bearer ${token}`,apikey:CLOUD_KEY,'Content-Type':'application/json'},body:JSON.stringify({text,voice:pref})});
    if(!r.ok){const e=new Error(`cloud-${r.status}`);e.status=r.status;throw e}
    const blob=await r.blob();if(!blob.size)throw new Error('cloud-empty');
    try{if('caches'in window){const c=await caches.open(CLOUD_CACHE);await c.put(key,new Response(blob,{headers:{'Content-Type':'audio/mpeg'}}))}}catch{}
    return blob;
  }
  function markCloudLabel(){
    const el=document.getElementById('voiceActual');if(!el)return;const male=passengerVoicePreference()==='male';
    el.textContent=`Voix IA OpenAI · ${male?'Homme (Cedar)':'Femme (Marin)'} · identique Android/iPhone`;
  }

  function installEngine(){
    if(installed)return true;const a=getAudioState(),sp=synth();
    if(!a||!sp||typeof SpeechSynthesisUtterance==='undefined'||typeof pumpSpeech!=='function'||typeof say!=='function')return false;
    installed=true;const baseCancel=sp.cancel.bind(sp);let restartNotBefore=0;
    function cancelSafely(){try{baseCancel()}catch{}restartNotBefore=Date.now()+CANCEL_RESTART_MS}
    function disposeCloud(cur,finishDuck=true){
      if(!cur)return;cur.finished=true;try{cur.abort?.abort()}catch{}try{cur.audio?.pause()}catch{}try{if(cur.audio)cur.audio.src=''}catch{}try{if(cur.objectUrl)URL.revokeObjectURL(cur.objectUrl)}catch{}if(finishDuck&&cur.ducked){cur.ducked=false;duckEnd(cur.kind)}
    }
    function cancelCurrent(reason='superseded'){
      const audio=getAudioState(),cur=audio?.current;if(!cur)return;if(cur.item)cur.item.cancelled=true;cur.cancelReason=reason;
      if(cur.mode==='cloud')disposeCloud(cur,true);else cancelSafely();if(audio.current===cur)audio.current=null;
    }

    pumpSpeech=function(){
      const audio=getAudioState(),s=synth();if(!audio||!s||audio.current)return;purge(audio);if(!audio.queue?.length)return;if(s.paused){try{s.resume()}catch{}}
      const wait=Math.max(0,restartNotBefore-Date.now());if(wait>0){setTimeout(()=>{try{pumpSpeech()}catch{}},wait+10);return}
      audio.queue.sort((x,y)=>Number(y.priority||0)-Number(x.priority||0)||Number(x.seq||0)-Number(y.seq||0));
      let item=audio.queue.shift();while(item&&obsolete(item))item=audio.queue.shift();if(!item)return;
      const original=rawText(item.text);if(!original)return setTimeout(()=>pumpSpeech(),20);const prepared=safePronunciation(original),token=++audio.token;

      const launchLocal=(text,usePreferred=true,retry=0)=>{
        if(obsolete(item))return setTimeout(()=>pumpSpeech(),20);let finished=false,started=false,startWatch=null,endWatch=null;
        const u=new SpeechSynthesisUtterance(rawText(text)||original);u.lang='fr-FR';u.rate=item.kind==='navigation'?.98:.92;u.volume=1;
        if(usePreferred){const p=voiceProfile();if(p.voice)u.voice=p.voice;u.pitch=p.pitch;if(p.pref==='male'&&!p.matched)u.rate*=.94}
        audio.current={priority:Number(item.priority??50),kind:item.kind||'general',token,item,mode:'local'};
        const cleanup=()=>{clearTimeout(startWatch);clearTimeout(endWatch)};
        const complete=()=>{if(finished)return;finished=true;cleanup();duckEnd(item.kind);if(audio.current?.token===token)audio.current=null;setTimeout(()=>pumpSpeech(),30)};
        const fallback=reason=>{if(finished)return;finished=true;cleanup();duckEnd(item.kind);if(audio.current?.token===token)audio.current=null;if(item.cancelled||obsolete(item))return setTimeout(()=>pumpSpeech(),30);console.warn('[Mon SAEIV] reprise synthèse vocale locale',reason||'sans détail');cancelSafely();if(retry<1)setTimeout(()=>launchLocal(original,false,retry+1),CANCEL_RESTART_MS+30);else setTimeout(()=>pumpSpeech(),CANCEL_RESTART_MS+30)};
        u.onstart=()=>{if(obsolete(item)){item.cancelled=true;cancelSafely();return complete()}started=true;clearTimeout(startWatch);if(item.key)recent.set(item.key,Date.now());duckStart(item.kind);const maxMs=Math.min(45000,Math.max(9000,3500+u.text.length*105));endWatch=setTimeout(()=>{if(!finished)fallback('annonce locale bloquée')},maxMs)};
        u.onend=complete;u.onerror=e=>{const code=String(e?.error||'speech-error');if(item.cancelled||obsolete(item)||code==='canceled'||code==='interrupted')return complete();fallback(code)};
        startWatch=setTimeout(()=>{if(!started&&!finished)fallback('démarrage vocal local sans réponse')},START_RETRY_MS);try{if(s.paused)s.resume();s.speak(u)}catch(e){fallback(e?.message||e)}
      };

      const launchCloud=async()=>{
        if(!cloudCandidate(item))return launchLocal(prepared,true,0);
        const controller=new AbortController(),cur={priority:Number(item.priority??50),kind:item.kind||'general',token,item,mode:'cloud',abort:controller,audio:null,objectUrl:null,ducked:false,finished:false};audio.current=cur;
        const timeout=setTimeout(()=>controller.abort('timeout'),CLOUD_TIMEOUT_MS);
        try{
          const pref=passengerVoicePreference(),blob=await getCloudBlob(prepared,pref,controller.signal);clearTimeout(timeout);
          if(cur.finished||audio.current!==cur||obsolete(item)){disposeCloud(cur,false);return setTimeout(()=>pumpSpeech(),20)}
          cur.objectUrl=URL.createObjectURL(blob);const media=new Audio(cur.objectUrl);cur.audio=media;media.preload='auto';media.volume=1;
          const done=()=>{if(cur.finished)return;disposeCloud(cur,true);if(audio.current===cur)audio.current=null;setTimeout(()=>pumpSpeech(),30)};
          media.onplaying=()=>{if(cur.finished)return;if(item.key)recent.set(item.key,Date.now());if(!cur.ducked){cur.ducked=true;duckStart(item.kind)}markCloudLabel()};
          media.onended=done;media.onerror=()=>{if(cur.finished)return;disposeCloud(cur,true);if(audio.current===cur)audio.current=null;if(item.cancelled||obsolete(item))return setTimeout(()=>pumpSpeech(),20);launchLocal(prepared,true,0)};
          await media.play();
        }catch(e){
          clearTimeout(timeout);if(cur.finished)return;if(audio.current===cur)audio.current=null;disposeCloud(cur,true);
          if(item.cancelled||obsolete(item))return setTimeout(()=>pumpSpeech(),20);
          const status=Number(e?.status||0);cloudBackoffUntil=Date.now()+(status===503||status===401?300000:15000);console.warn('[Mon SAEIV] TTS cloud indisponible, secours local',e?.message||e);launchLocal(prepared,true,0);
        }
      };
      launchCloud();
    };

    say=function(text,opts={}){
      const audio=getAudioState(),s=synth(),txt=rawText(text);if(!audio||!s||!txt)return;const kind=opts.kind||'general';
      if(audio.passengerEnabled===false&&['departure','identity','stop'].includes(kind))return;if(!destinationCadenceAllows(txt,kind))return;
      const meta=semantic(txt,opts,kind),item={text:txt,priority:Number(opts.priority??50),kind,ephemeral:!!opts.ephemeral,seq:Date.now()+Math.random(),role:meta.role,target:meta.target,key:meta.key,valid:opts.valid||null,cancelled:false};
      purge(audio);if(duplicate(audio,item))return;if(item.role==='arrival'&&Number.isInteger(item.target))audio.queue=(audio.queue||[]).filter(x=>!(x.role==='next-stop'&&x.target===item.target));
      const cur=audio.current,curP=Number(cur?.priority||0),mustPreempt=!!cur&&(item.priority>curP||(item.role==='arrival'&&cur?.item?.role==='next-stop'&&cur.item.target===item.target));
      if(cur&&item.ephemeral&&curP>=item.priority)return;if(mustPreempt){cancelCurrent('higher-priority');setTimeout(()=>{audio.queue.push(item);pumpSpeech()},CANCEL_RESTART_MS+20);return}audio.queue.push(item);pumpSpeech();
    };

    watchdog=setInterval(()=>{const audio=getAudioState();if(!audio)return;purge(audio);const cur=audio.current;if(cur?.item&&obsolete(cur.item)){cancelCurrent('obsolete');setTimeout(()=>pumpSpeech(),CANCEL_RESTART_MS+20)}else if(!cur)try{pumpSpeech()}catch{}},180);
    document.addEventListener('click',()=>{try{if(sp.paused)sp.resume()}catch{}},{capture:true,passive:true});
    document.addEventListener('change',e=>{if(e.target?.id==='passengerVoiceGender')setTimeout(()=>{if(window.MonSAEIVCloudV156?.user)markCloudLabel()},30)},true);
    window.addEventListener('pageshow',()=>{try{if(sp.paused)sp.resume()}catch{};setTimeout(()=>pumpSpeech(),120)});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){try{if(sp.paused)sp.resume()}catch{};setTimeout(()=>pumpSpeech(),120)}});
    window.MonSAEIVSpeechV131={version:VERSION,safePronunciation,frenchVoice,voiceProfile,cloud:true,restart:()=>{try{sp.resume()}catch{};setTimeout(()=>pumpSpeech(),80)},invalidate:()=>{const audio=getAudioState();purge(audio);if(audio?.current?.item&&obsolete(audio.current.item))cancelCurrent('invalidate')}};
    window.MonSAEIVSpeechV148=window.MonSAEIVSpeechV131;setTimeout(()=>{if(window.MonSAEIVCloudV156?.user)markCloudLabel()},1800);
    console.info('[Mon SAEIV] moteur vocal cloud OpenAI + secours local actif');return true;
  }
  function versionLabel(){document.title=`Mon SAEIV · ${VERSION}`;const b=document.getElementById('buildInfo');if(b)b.textContent=`Version ${VERSION}`}
  function boot(){versionLabel();if(!installEngine()){let tries=0;const t=setInterval(()=>{if(installEngine()||++tries>60)clearInterval(t)},125)}setTimeout(versionLabel,6000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
