'use strict';
/* Mon SAEIV — moteur vocal prioritaire cloud + secours système.
   Les annonces voyageurs utilisent la même voix IA sur Android/iPhone quand la session serveur est active.
   En cas d'absence réseau/TTS, le moteur Web Speech local reprend automatiquement. */
(()=>{
  const VERSION='1.0.104';
  const START_RETRY_MS=2200, CANCEL_RESTART_MS=140, RECENT_MS=12000, IDENTITY_STOP_INTERVAL=5;
  const CLOUD_URL='https://xpmrnwipnoekiycghwli.supabase.co/functions/v1/passenger-tts';
  const CLOUD_KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
  const CLOUD_CACHE='mon-saeiv-passenger-tts-v1';
  const CLOUD_TIMEOUT_MS=7000, CLOUD_START_TIMEOUT_MS=1800;
  const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let installed=false, watchdog=null, identityAnchorStop=null, identityCourseKey=null, cloudBackoffUntil=0;
  // Sortie SAEIV dédiée. La radio conserve son propre <audio>; les annonces iPhone
  // passent par ce contexte Web Audio et ne dépendent jamais de l'état du lecteur musique.
  const announcementOutput={ctx:null,gain:null,unlocked:false,unlockPromise:null,currentSource:null,htmlMedia:null,mediaUnlocked:false,lastProbe:''};
  let firstGesturePrimed=false,firstGestureAt=0,cloudSessionReady=false;
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
  function announcementContext(){
    if(!IS_IOS)return null;
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    if(announcementOutput.ctx?.state==='closed'){
      announcementOutput.ctx=null;announcementOutput.gain=null;announcementOutput.unlocked=false;
    }
    if(!announcementOutput.ctx){
      try{announcementOutput.ctx=new C({latencyHint:'interactive'})}catch{announcementOutput.ctx=new C()}
      announcementOutput.gain=announcementOutput.ctx.createGain();
      announcementOutput.gain.gain.value=1;
      announcementOutput.gain.connect(announcementOutput.ctx.destination);
      announcementOutput.ctx.addEventListener?.('statechange',()=>{
        announcementOutput.unlocked=announcementOutput.ctx?.state==='running';
        if(announcementOutput.ctx?.state==='interrupted'||announcementOutput.ctx?.state==='suspended'){
          announcementOutput.ctx.resume?.().then(()=>{announcementOutput.unlocked=announcementOutput.ctx?.state==='running'}).catch(()=>{});
        }
      });
    }
    return announcementOutput.ctx;
  }
  // Une seule initialisation partagée entre pointerdown, touchstart, clic et lecture.
  // Sur Safari iOS le resume() doit être déclenché pendant le geste utilisateur.
  function unlockAnnouncementAudio(){
    if(!IS_IOS)return Promise.resolve(true);
    if(announcementOutput.unlockPromise)return announcementOutput.unlockPromise;
    const run=async()=>{
      let ctx=announcementContext();if(!ctx)return false;
      try{
        if(ctx.state==='closed'){announcementOutput.ctx=null;announcementOutput.gain=null;ctx=announcementContext()}
        if(ctx?.state!=='running')await ctx?.resume?.();
        if(!ctx||ctx.state!=='running'){announcementOutput.unlocked=false;return false}
        // Un buffer muet prépare Web Audio sans diffuser de son et sans toucher au lecteur radio.
        const buffer=ctx.createBuffer(1,1,ctx.sampleRate),source=ctx.createBufferSource();
        source.buffer=buffer;source.connect(announcementOutput.gain);source.start(0);
        announcementOutput.unlocked=true;
        return true;
      }catch(e){
        announcementOutput.unlocked=false;
        console.warn('[Mon SAEIV] moteur audio à réactiver',e?.message||e);
        return false;
      }
    };
    announcementOutput.unlockPromise=run().finally(()=>{announcementOutput.unlockPromise=null;updateAudioIndicator()});
    return announcementOutput.unlockPromise;
  }

  function iosMedia(){
    if(!IS_IOS)return null;
    if(!announcementOutput.htmlMedia){
      const media=document.createElement('audio');
      media.setAttribute('playsinline','');media.setAttribute('webkit-playsinline','');
      media.preload='auto';media.volume=1;media.muted=false;media.style.display='none';
      media.id='v131AnnouncementMedia';
      document.body.appendChild(media);
      announcementOutput.htmlMedia=media;
    }
    return announcementOutput.htmlMedia;
  }
  function beepWav(){
    // 240 ms soft sine test tone. Generated locally: no network or cloud dependency.
    const rate=22050,count=Math.round(rate*.24),length=44+count*2;
    const buffer=new ArrayBuffer(length),view=new DataView(buffer);
    const letters=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};
    letters(0,'RIFF');view.setUint32(4,length-8,true);letters(8,'WAVE');
    letters(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
    view.setUint16(22,1,true);view.setUint32(24,rate,true);
    view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
    letters(36,'data');view.setUint32(40,count*2,true);
    for(let i=0;i<count;i++){
      const fade=Math.min(1,i/450,(count-1-i)/450),sample=Math.sin(2*Math.PI*880*i/rate)*Math.max(0,fade)*.32;
      view.setInt16(44+i*2,Math.round(sample*32767),true);
    }
    return new Blob([buffer],{type:'audio/wav'});
  }
  function probeIOSMediaFromGesture(){
    const media=iosMedia();
    if(!media)return Promise.resolve({ok:true,reason:'non-iOS'});
    let url=null;
    try{
      const wave=beepWav();url=URL.createObjectURL(wave);
      media.pause();media.onplaying=null;media.onended=null;media.onerror=null;
      media.src=url;media.currentTime=0;media.muted=false;media.volume=1;
      // .play() must be invoked directly in the click, never after awaiting an unlock/fetch.
      const started=media.play();
      return Promise.resolve(started).then(()=>{
        announcementOutput.mediaUnlocked=true;announcementOutput.lastProbe='played';
        media.onended=()=>{try{URL.revokeObjectURL(url)}catch{}};
        return {ok:true,reason:'html-audio-started'};
      }).catch(e=>{
        announcementOutput.mediaUnlocked=false;announcementOutput.lastProbe='blocked';
        try{URL.revokeObjectURL(url)}catch{}
        return {ok:false,reason:e?.name||e?.message||'audio-blocked'};
      });
    }catch(e){
      announcementOutput.mediaUnlocked=false;announcementOutput.lastProbe='error';
      if(url)try{URL.revokeObjectURL(url)}catch{}
      return Promise.resolve({ok:false,reason:e?.message||String(e)});
    }
  }
  function outputReady(){
    return !IS_IOS||announcementOutput.mediaUnlocked||!!(announcementOutput.ctx?.state==='running'&&announcementOutput.unlocked);
  }
  function updateAudioIndicator(){
    const indicator=document.getElementById('v131AudioActivate');
    if(!indicator)return;
    let driving=false;try{driving=!!state?.running||!!window.MonSAEIVDayAutopilotV144?.snapshot?.running}catch{}
    const side=document.getElementById('v15LandscapeSide'),portrait=document.querySelector('#driver .controls');
    const isLandscape=!!window.matchMedia?.('(orientation:landscape) and (max-height:650px) and (max-width:1100px)').matches;
    const target=isLandscape?side:portrait;
    if(target&&indicator.parentElement!==target){
      if(isLandscape){const marker=side.querySelector('#v315VoiceControls')||side.querySelector('.v15-next-box');
        if(marker)side.insertBefore(indicator,marker);else side.appendChild(indicator);
      }else target.appendChild(indicator);
    }
    // This control is always within the driving panel, never fixed over the map or bottom navigation.
    indicator.hidden=!driving||!target;
    if(!indicator.dataset.busy&&Number(indicator.dataset.feedbackUntil||0)<Date.now()){indicator.textContent=outputReady()?'🔊 Tester les annonces':'🔊 Activer le son';}
    indicator.setAttribute('aria-label',outputReady()?'Tester ou réactiver les annonces vocales':'Réactiver le son des annonces');
  }
  function prepareAudioFromGesture(){
    firstGestureAt=Date.now();
    const sp=synth();
    try{
      sp?.getVoices?.();
      if(sp?.paused)sp.resume();
      // Safari ne charge parfois la liste de voix qu'après un premier usage.
      // On n'insère pas de test lorsque le conducteur a déjà des annonces en cours.
      const a=getAudioState();
      if(!firstGesturePrimed&&sp&&!sp.speaking&&!sp.pending&&!a?.current&&!a?.queue?.length&&typeof SpeechSynthesisUtterance!=='undefined'){
        firstGesturePrimed=true;
        const warmup=new SpeechSynthesisUtterance('\u200b');
        warmup.lang='fr-FR';warmup.volume=0;warmup.rate=1;
        try{sp.speak(warmup)}catch{}
      }
    }catch(e){console.warn('[Mon SAEIV] préparation synthèse vocale',e?.message||e)}
    // Lance le réveil Web Audio sans attendre une requête réseau qui ferait perdre le geste iOS.
    const ready=unlockAnnouncementAudio();
    if(!cloudSessionReady&&window.MonSAEIVCloudV156?.client){
      cloudSessionReady=true;
      try{window.MonSAEIVCloudV156.client.auth.getSession().catch(()=>{cloudSessionReady=false})}
      catch{cloudSessionReady=false}
    }
    ready.then(updateAudioIndicator).catch(updateAudioIndicator);
    return ready;
  }
  async function playIOSCloudBlob(blob,cur,onStarted,onEnded,onError){
    const media=announcementOutput.htmlMedia;
    if(media&&announcementOutput.mediaUnlocked){
      let url=null;
      try{
        url=URL.createObjectURL(blob);
        media.pause();media.onplaying=null;media.onended=null;media.onerror=null;
        media.src=url;media.currentTime=0;media.volume=1;media.muted=false;
        cur.audio=media;cur.objectUrl=url;
        media.onplaying=()=>onStarted?.();media.onended=()=>onEnded?.();
        media.onerror=()=>onError?.('Lecture HTML Audio iPhone interrompue');
        await media.play();
        return media;
      }catch(e){
        console.warn('[SAEIV] iPhone HTML Audio indisponible, retour Web Audio',e?.message||e);
        try{media.pause();media.removeAttribute('src');media.load()}catch{}
        if(url)try{URL.revokeObjectURL(url)}catch{}
        cur.audio=null;cur.objectUrl=null;
        announcementOutput.mediaUnlocked=false;
      }
    }
    const ctx=announcementContext();if(!ctx)throw new Error('announcement-audio-unavailable');
    if(ctx.state!=='running'){
      try{await ctx.resume()}catch{}
      if(ctx.state!=='running'){const e=new Error('announcement-audio-locked');e.name='NotAllowedError';throw e}
    }
    const bytes=await blob.arrayBuffer();
    const decoded=await ctx.decodeAudioData(bytes.slice(0));
    if(cur.finished)throw new Error('announcement-cancelled');
    const source=ctx.createBufferSource();source.buffer=decoded;source.connect(announcementOutput.gain);
    cur.source=source;announcementOutput.currentSource=source;
    source.onended=()=>{if(announcementOutput.currentSource===source)announcementOutput.currentSource=null;onEnded?.()};
    source.start(0);onStarted?.();
    return source;
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
      if(!cur)return;cur.finished=true;clearTimeout(cur.startWatch);try{cur.abort?.abort()}catch{}
      try{cur.source?.stop?.()}catch{}try{cur.source?.disconnect?.()}catch{}
      if(announcementOutput.currentSource===cur.source)announcementOutput.currentSource=null;
      try{cur.audio?.pause()}catch{}
      try{if(cur.audio){cur.audio.onplaying=null;cur.audio.onended=null;cur.audio.onerror=null;cur.audio.src=''}}catch{}
      try{if(cur.objectUrl)URL.revokeObjectURL(cur.objectUrl)}catch{}
      if(finishDuck&&cur.ducked){cur.ducked=false;duckEnd(cur.kind)}
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
        // Sur iPhone, la voix IA utilise une sortie Web Audio SAEIV indépendante.
        // La radio n'est qu'une source média facultative que duckStart/duckEnd peut atténuer.
        if(IS_IOS&&!announcementOutput.mediaUnlocked&&!(await unlockAnnouncementAudio())&&!announcementOutput.mediaUnlocked)return launchLocal(prepared,true,0);
        const controller=new AbortController(),cur={priority:Number(item.priority??50),kind:item.kind||'general',token,item,mode:'cloud',abort:controller,audio:null,source:null,objectUrl:null,ducked:false,finished:false,started:false,startWatch:null};audio.current=cur;
        const timeout=setTimeout(()=>controller.abort('timeout'),CLOUD_TIMEOUT_MS);
        const started=()=>{
          if(cur.finished)return;cur.started=true;clearTimeout(cur.startWatch);
          if(item.key)recent.set(item.key,Date.now());
          if(!cur.ducked){cur.ducked=true;duckStart(item.kind)}
          markCloudLabel();
        };
        const done=()=>{
          if(cur.finished)return;clearTimeout(cur.startWatch);disposeCloud(cur,true);
          if(audio.current===cur)audio.current=null;setTimeout(()=>pumpSpeech(),30);
        };
        const fallbackCloud=reason=>{
          if(cur.finished)return;clearTimeout(timeout);clearTimeout(cur.startWatch);
          if(audio.current===cur)audio.current=null;disposeCloud(cur,true);
          if(item.cancelled||obsolete(item))return setTimeout(()=>pumpSpeech(),20);
          console.warn('[Mon SAEIV] sortie annonces SAEIV indisponible, secours vocal local',reason||'sans détail');
          launchLocal(prepared,true,0);
        };
        try{
          const pref=passengerVoicePreference(),blob=await getCloudBlob(prepared,pref,controller.signal);clearTimeout(timeout);
          if(cur.finished||audio.current!==cur||obsolete(item)){disposeCloud(cur,false);return setTimeout(()=>pumpSpeech(),20)}
          cur.startWatch=setTimeout(()=>{if(!cur.started&&!cur.finished)fallbackCloud('aucun démarrage audio détecté')},CLOUD_START_TIMEOUT_MS);
          if(IS_IOS){
            await playIOSCloudBlob(blob,cur,started,done,fallbackCloud);
          }else{
            cur.objectUrl=URL.createObjectURL(blob);const media=new Audio(cur.objectUrl);cur.audio=media;
            media.preload='auto';media.playsInline=true;media.volume=1;media.muted=false;
            media.onplaying=started;media.onended=done;media.onerror=()=>fallbackCloud('erreur de lecture audio');
            await media.play();
          }
        }catch(e){
          clearTimeout(timeout);clearTimeout(cur.startWatch);
          if(cur.finished)return;
          if(IS_IOS&&String(e?.name||'')==='NotAllowedError')announcementOutput.unlocked=false;
          if(audio.current===cur)audio.current=null;disposeCloud(cur,true);
          if(item.cancelled||obsolete(item))return setTimeout(()=>pumpSpeech(),20);
          const status=Number(e?.status||0);cloudBackoffUntil=Date.now()+(status===503||status===401?300000:15000);
          console.warn('[Mon SAEIV] TTS cloud indisponible, secours local',e?.message||e);launchLocal(prepared,true,0);
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

    watchdog=setInterval(()=>{const audio=getAudioState();if(!audio)return;purge(audio);const cur=audio.current;if(cur?.item&&obsolete(cur.item)){cancelCurrent('obsolete');setTimeout(()=>pumpSpeech(),CANCEL_RESTART_MS+20)}else if(!cur)try{pumpSpeech()}catch{};updateAudioIndicator()},250);
    const reviveAudio=()=>{try{if(sp.paused)sp.resume()}catch{};unlockAnnouncementAudio().catch(()=>{});setTimeout(()=>{try{pumpSpeech()}catch{}},40);updateAudioIndicator()};
    const userAudioWake=()=>{prepareAudioFromGesture();setTimeout(()=>{try{pumpSpeech()}catch{}},40)};
    if(!document.getElementById('v131AudioActivate')){
      const btn=document.createElement('button');btn.id='v131AudioActivate';btn.type='button';btn.hidden=true;
      btn.textContent='🔊 Activer le son';btn.style.cssText='position:static!important;display:block;min-height:35px;max-width:100%;width:100%;grid-column:1/-1;background:#24445b;color:#fff5dd;border:1px solid #8fa9bb;border-radius:9px;font-weight:850;font-size:.72rem;padding:7px 8px;margin:5px 0;box-shadow:none!important';
      btn.addEventListener('click',async()=>{
        // Begin audio resume synchronously in the trusted tap event: required by iOS Safari.
        const probe=probeIOSMediaFromGesture();
        const ready=prepareAudioFromGesture();btn.dataset.busy='1';btn.disabled=true;btn.textContent='⏳ Test sonore iPhone…';
        const a=getAudioState();if(a){a.passengerEnabled=true;try{localStorage.setItem('fluoPassengerAnnouncementsEnabled','on')}catch{}}
        try{
          const [webReady,probeResult]=await Promise.all([ready,probe]);
          const ok=!!webReady||!!probeResult.ok;
          if(!ok){btn.textContent='⚠ Audio iPhone refusé · réessayer';btn.title='Lecture refusée ('+probeResult.reason+'). Vérifier le volume, le mode silencieux, la sortie Bluetooth et Safari.';return}
          btn.textContent=IS_IOS?'🔊 Bip + voix en test':'🔊 Test vocal lancé';btn.title=probeResult.ok?'Un bip a été lancé par le lecteur audio iPhone. Une annonce vocale doit suivre.':'Le moteur Web Audio a été débloqué, mais le lecteur iPhone n’a pas démarré.';
          try{say('Annonces vocales actives.',{priority:92,kind:'system'})}catch(e){console.warn('[SAEIV] test sonore',e)}
          // Explicit audio action also restores the UI toggle, without changing navigation guidance.
          for(const id of ['v28PassengerToggleSide','v28PassengerToggle']){
            const toggle=document.getElementById(id);
            if(toggle){toggle.setAttribute('aria-pressed','true');toggle.classList.remove('v28-off');toggle.textContent='🔊 Arrêts / destination ON'}
          }
          const display=document.getElementById('v315PassengerToggle');
          if(display){display.classList.remove('off');display.setAttribute('aria-pressed','true');const value=display.querySelector('b');if(value)value.textContent='ON'}
        }catch(e){btn.textContent='⚠ Réessayer le son';console.warn('[SAEIV] reprise annonces',e)}
        finally{btn.disabled=false;delete btn.dataset.busy;btn.dataset.feedbackUntil=String(Date.now()+8000);setTimeout(updateAudioIndicator,8200)}
      });document.body.appendChild(btn);updateAudioIndicator();
    }
    // Override the obsolete V12 home preview: it cleared the speech queue and
    // used the old speechSynthesis path rather than the same iPhone TTS output as the bus.
    document.addEventListener('click',event=>{
      const control=event.target?.closest?.('#voiceTest');
      if(!control)return;
      event.preventDefault();event.stopImmediatePropagation();
      const text=(document.getElementById('passengerVoiceGender')?.value==='male'
        ?'Aperçu de la voix homme. Prochain arrêt, Delme République.'
        :'Aperçu de la voix femme. Prochain arrêt, Delme République.');
      control.disabled=true;control.textContent='🔊 Test de la voix en cours…';
      // Both calls start inside this user tap so iOS can unlock the output.
      const probe=probeIOSMediaFromGesture();
      prepareAudioFromGesture();
      const audio=getAudioState();
      if(audio){audio.queue=[];if(audio.current)cancelCurrent('home-preview')}
      try{say(text,{priority:150,kind:'system',ephemeral:false})}
      catch(e){console.warn('[SAEIV] aperçu vocal',e)}
      Promise.resolve(probe).then(result=>{
        if(IS_IOS&&!result?.ok)control.title='iPhone : sortie audio refusée ('+(result?.reason||'erreur')+'). Vérifier le volume et la sortie son.';
        else control.title='La voix doit maintenant prononcer un aperçu. Sur iPhone, le bip teste la sortie multimédia.';
      }).catch(e=>{control.title='Test audio impossible : '+(e?.message||e)});
      setTimeout(()=>{control.disabled=false;control.textContent='🔊 Écouter la voix'},4500);
    },true);
    document.addEventListener('pointerdown',userAudioWake,{capture:true,passive:true});
    document.addEventListener('touchstart',userAudioWake,{capture:true,passive:true});
    document.addEventListener('click',userAudioWake,{capture:true,passive:true});
    document.addEventListener('change',e=>{if(e.target?.id==='passengerVoiceGender')setTimeout(()=>{if(window.MonSAEIVCloudV156?.user)markCloudLabel()},30)},true);
    window.addEventListener('pageshow',()=>setTimeout(reviveAudio,80));
    window.addEventListener('focus',()=>setTimeout(reviveAudio,80),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(reviveAudio,80)});
    window.MonSAEIVSpeechV131={version:VERSION,safePronunciation,frenchVoice,voiceProfile,cloud:true,isIOS:IS_IOS,unlockIOSAudio:unlockAnnouncementAudio,unlockAnnouncementAudio,prepareAudioFromGesture,isOutputReady:outputReady,get firstGestureAt(){return firstGestureAt},audioEngine:'gesture-initialized-webaudio-resilient',restart:()=>{prepareAudioFromGesture();setTimeout(()=>pumpSpeech(),80)},invalidate:()=>{const audio=getAudioState();purge(audio);if(audio?.current?.item&&obsolete(audio.current.item))cancelCurrent('invalidate')}};
    window.MonSAEIVSpeechV148=window.MonSAEIVSpeechV131;setTimeout(()=>{if(window.MonSAEIVCloudV156?.user)markCloudLabel()},1800);
    console.info('[Mon SAEIV] moteur vocal SAEIV autonome + cloud OpenAI + secours local actif');return true;
  }
  function versionLabel(){document.title=`Mon SAEIV · ${VERSION}`;const b=document.getElementById('buildInfo');if(b)b.textContent=`Version ${VERSION}`}
  function boot(){versionLabel();if(!installEngine()){let tries=0;const t=setInterval(()=>{if(installEngine()||++tries>60)clearInterval(t)},125)}setTimeout(versionLabel,6000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
