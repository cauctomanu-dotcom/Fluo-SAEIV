'use strict';
/* Mon SAEIV 1.0.48 — synthèse vocale à priorité stable, sans répétition ni annonce d'arrêt obsolète. */
(()=>{
  const VERSION='1.0.48';
  const START_RETRY_MS=2200;
  const CANCEL_RESTART_MS=140;
  const RECENT_MS=12000;
  let installed=false, watchdog=null;
  const recent=new Map();

  function getAudioState(){try{return (typeof state!=='undefined'&&state?.audio)?state.audio:null}catch{return null}}
  function synth(){return ('speechSynthesis'in window)?window.speechSynthesis:null}
  function rawText(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function safePronunciation(text){const raw=rawText(text);if(!raw)return'';try{let t=raw;t=t.replace(/\b(Place\s+du\s+)Marche\b/gi,(_,p)=>`${p}Marché`);t=t.replace(/\bArs(?=[\s-]+Laquenexy\b)/gi,'Arse');t=t.replace(/\bcimeti(?:e|è|é)re\b/gi,'cime-tière');return rawText(t)||raw}catch{return raw}}
  function frenchVoice(){const s=synth();if(!s)return null;const vs=s.getVoices?.().filter(v=>/^fr([_-]|$)/i.test(v.lang||''))||[];if(!vs.length)return null;const pref=localStorage.getItem('fluoPassengerVoice')||'female',female=/(audrey|aur[eé]lie|am[eé]lie|marie|virginie|hortense|c[eé]line|samantha|victoria|ava|zo[eé]|female|femme)/i;return pref==='male'?(vs.find(v=>!female.test(v.name||''))||vs[0]):(vs.find(v=>female.test(v.name||''))||vs[0])}
  function duckStart(kind){try{window.MonSAEIVRadio?.duckStart?.(kind)}catch{}}
  function duckEnd(kind){try{window.MonSAEIVRadio?.duckEnd?.(kind)}catch{}}
  function stateTarget(){try{return Number.isInteger(state?.target)?state.target:null}catch{return null}}

  function semantic(text,opts,kind){
    const t=rawText(text),target=Number.isInteger(opts?.targetIndex)?opts.targetIndex:(kind==='stop'?stateTarget():null);
    let role=opts?.role||null;
    if(!role&&kind==='stop'&&/^Prochain arrêt\b/i.test(t))role='next-stop';
    if(!role&&kind==='stop'&&/^Arrêt\b/i.test(t))role='arrival';
    let key=opts?.key||null;
    if(!key&&role&&Number.isInteger(target))key=`${role}:${target}`;
    return{role,target,key};
  }
  function obsolete(item){
    if(!item||item.cancelled)return true;
    if(typeof item.valid==='function'){try{if(!item.valid())return true}catch{return true}}
    if((item.role==='next-stop'||item.role==='arrival')&&Number.isInteger(item.target)){
      let running=false,target=null,arrival=false;
      try{running=!!state?.running;target=state?.target;arrival=!!state?.arrivalAnnounced}catch{}
      if(!running||target!==item.target)return true;
      if(item.role==='next-stop'&&arrival)return true;
    }
    return false;
  }
  function cleanRecent(){const now=Date.now();for(const[k,v]of recent)if(now-v>RECENT_MS)recent.delete(k)}
  function duplicate(audio,item){cleanRecent();if(!item.key)return false;if(recent.has(item.key))return true;if(audio?.current?.item?.key===item.key&&!audio.current.item.cancelled)return true;return (audio?.queue||[]).some(x=>x?.key===item.key&&!x.cancelled)}
  function purge(audio){if(!audio)return;audio.queue=(audio.queue||[]).filter(x=>!obsolete(x));}

  function installEngine(){
    if(installed)return true;
    const a=getAudioState(),sp=synth();
    if(!a||!sp||typeof SpeechSynthesisUtterance==='undefined'||typeof pumpSpeech!=='function'||typeof say!=='function')return false;
    installed=true;
    const baseCancel=sp.cancel.bind(sp);let restartNotBefore=0;
    function cancelSafely(){try{baseCancel()}catch{}restartNotBefore=Date.now()+CANCEL_RESTART_MS}
    function cancelCurrent(reason='superseded'){
      const audio=getAudioState(),cur=audio?.current;if(!cur)return;
      if(cur.item)cur.item.cancelled=true;cur.cancelReason=reason;cancelSafely();if(audio.current===cur)audio.current=null;
    }

    pumpSpeech=function(){
      const audio=getAudioState(),s=synth();if(!audio||!s||audio.current)return;purge(audio);if(!audio.queue?.length)return;
      if(s.paused){try{s.resume()}catch{}}
      const wait=Math.max(0,restartNotBefore-Date.now());if(wait>0){setTimeout(()=>{try{pumpSpeech()}catch{}},wait+10);return}
      audio.queue.sort((x,y)=>Number(y.priority||0)-Number(x.priority||0)||Number(x.seq||0)-Number(y.seq||0));
      let item=audio.queue.shift();while(item&&obsolete(item)){item=audio.queue.shift()}if(!item)return;
      const original=rawText(item.text);if(!original)return setTimeout(()=>pumpSpeech(),20);
      const prepared=safePronunciation(original),token=++audio.token;
      const launch=(text,usePreferred=true,retry=0)=>{
        if(obsolete(item))return setTimeout(()=>pumpSpeech(),20);
        let finished=false,started=false,startWatch=null,endWatch=null;
        const u=new SpeechSynthesisUtterance(rawText(text)||original);u.lang='fr-FR';u.rate=item.kind==='navigation'?.98:.92;u.volume=1;if(usePreferred){const v=frenchVoice();if(v)u.voice=v}
        audio.current={priority:Number(item.priority??50),kind:item.kind||'general',token,item};
        const cleanup=()=>{clearTimeout(startWatch);clearTimeout(endWatch)};
        const complete=()=>{if(finished)return;finished=true;cleanup();duckEnd(item.kind);if(audio.current?.token===token)audio.current=null;setTimeout(()=>pumpSpeech(),30)};
        const fallback=reason=>{if(finished)return;finished=true;cleanup();duckEnd(item.kind);if(audio.current?.token===token)audio.current=null;if(item.cancelled||obsolete(item))return setTimeout(()=>pumpSpeech(),30);console.warn('[Mon SAEIV] reprise synthèse vocale',reason||'sans détail');cancelSafely();if(retry<1)setTimeout(()=>launch(original,false,retry+1),CANCEL_RESTART_MS+30);else setTimeout(()=>pumpSpeech(),CANCEL_RESTART_MS+30)};
        u.onstart=()=>{if(obsolete(item)){item.cancelled=true;cancelSafely();return complete()}started=true;clearTimeout(startWatch);if(item.key)recent.set(item.key,Date.now());duckStart(item.kind);const maxMs=Math.min(45000,Math.max(9000,3500+u.text.length*105));endWatch=setTimeout(()=>{if(!finished)fallback('annonce bloquée en cours')},maxMs)};
        u.onend=complete;u.onerror=e=>{const code=String(e?.error||'speech-error');if(item.cancelled||obsolete(item)||code==='canceled'||code==='interrupted')return complete();fallback(code)};
        startWatch=setTimeout(()=>{if(!started&&!finished)fallback('démarrage vocal sans réponse')},START_RETRY_MS);
        try{if(s.paused)s.resume();s.speak(u)}catch(e){fallback(e?.message||e)}
      };
      launch(prepared,true,0);
    };

    say=function(text,opts={}){
      const audio=getAudioState(),s=synth(),txt=rawText(text);if(!audio||!s||!txt)return;
      const kind=opts.kind||'general';if(audio.passengerEnabled===false&&['departure','identity','stop'].includes(kind))return;
      const meta=semantic(txt,opts,kind),item={text:txt,priority:Number(opts.priority??50),kind,ephemeral:!!opts.ephemeral,seq:Date.now()+Math.random(),role:meta.role,target:meta.target,key:meta.key,valid:opts.valid||null,cancelled:false};
      purge(audio);if(duplicate(audio,item))return;
      if(item.role==='arrival'&&Number.isInteger(item.target))audio.queue=(audio.queue||[]).filter(x=>!(x.role==='next-stop'&&x.target===item.target));
      const cur=audio.current,curP=Number(cur?.priority||0),mustPreempt=!!cur&&(item.priority>curP||(item.role==='arrival'&&cur?.item?.role==='next-stop'&&cur.item.target===item.target));
      if(cur&&item.ephemeral&&curP>=item.priority)return;
      if(mustPreempt){cancelCurrent('higher-priority');setTimeout(()=>{audio.queue.push(item);pumpSpeech()},CANCEL_RESTART_MS+20);return}
      audio.queue.push(item);pumpSpeech();
    };

    watchdog=setInterval(()=>{const audio=getAudioState();if(!audio)return;purge(audio);const cur=audio.current;if(cur?.item&&obsolete(cur.item)){cancelCurrent('obsolete');setTimeout(()=>pumpSpeech(),CANCEL_RESTART_MS+20)}else if(!cur)try{pumpSpeech()}catch{}},180);
    document.addEventListener('click',()=>{try{if(sp.paused)sp.resume()}catch{}},{capture:true,passive:true});
    window.addEventListener('pageshow',()=>{try{if(sp.paused)sp.resume()}catch{};setTimeout(()=>pumpSpeech(),120)});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){try{if(sp.paused)sp.resume()}catch{};setTimeout(()=>pumpSpeech(),120)}});
    window.MonSAEIVSpeechV131={version:VERSION,safePronunciation,restart:()=>{try{sp.resume()}catch{};setTimeout(()=>pumpSpeech(),80)},invalidate:()=>{const audio=getAudioState();purge(audio);if(audio?.current?.item&&obsolete(audio.current.item))cancelCurrent('invalidate')}};
    window.MonSAEIVSpeechV148=window.MonSAEIVSpeechV131;
    console.info('[Mon SAEIV] moteur vocal 1.0.48 priorités + déduplication actif');return true;
  }
  function versionLabel(){document.title=`Mon SAEIV · ${VERSION}`;const b=document.getElementById('buildInfo');if(b)b.textContent=`Version ${VERSION}`}
  function boot(){versionLabel();if(!installEngine()){let tries=0;const t=setInterval(()=>{if(installEngine()||++tries>60)clearInterval(t)},125)}setTimeout(versionLabel,6000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
