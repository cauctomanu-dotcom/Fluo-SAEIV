'use strict';
/* Mon SAEIV 1.0.32 — synthèse vocale robuste iOS/Android + phonétique non bloquante. Déploiement final. */
(()=>{
  const VERSION='1.0.32';
  const START_RETRY_MS=2200;
  const CANCEL_RESTART_MS=140;
  let installed=false;

  function getAudioState(){
    try{return (typeof state!=='undefined' && state?.audio) ? state.audio : null}catch{return null}
  }
  function synth(){return ('speechSynthesis' in window)?window.speechSynthesis:null}
  function rawText(v){return String(v??'').replace(/\s+/g,' ').trim()}

  // Les corrections ne peuvent plus empêcher une annonce de partir.
  function safePronunciation(text){
    const raw=rawText(text);
    if(!raw)return '';
    try{
      let t=raw;
      t=t.replace(/\b(Place\s+du\s+)Marche\b/gi,(_,prefix)=>`${prefix}Marché`);
      t=t.replace(/\bArs(?=[\s-]+Laquenexy\b)/gi,'Arse');
      t=t.replace(/\bcimeti(?:e|è|é)re\b/gi,'cime-tière');
      t=rawText(t);
      return t||raw;
    }catch(err){
      console.warn('[Mon SAEIV] correction phonétique ignorée',err);
      return raw;
    }
  }

  function frenchVoice(){
    const s=synth();if(!s)return null;
    const voices=s.getVoices?.().filter(v=>/^fr([_-]|$)/i.test(v.lang||''))||[];
    if(!voices.length)return null;
    const pref=localStorage.getItem('fluoPassengerVoice')||'female';
    const female=/(audrey|aur[eé]lie|am[eé]lie|marie|virginie|hortense|c[eé]line|samantha|victoria|ava|zo[eé]|female|femme)/i;
    if(pref==='male')return voices.find(v=>!female.test(v.name||''))||voices[0];
    return voices.find(v=>female.test(v.name||''))||voices[0];
  }

  function duckStart(kind){try{window.MonSAEIVRadio?.duckStart?.(kind)}catch{}}
  function duckEnd(kind){try{window.MonSAEIVRadio?.duckEnd?.(kind)}catch{}}

  function installEngine(){
    if(installed)return true;
    const a=getAudioState(),s=synth();
    if(!a||!s||typeof SpeechSynthesisUtterance==='undefined'||typeof pumpSpeech!=='function'||typeof say!=='function')return false;
    installed=true;

    const baseCancel=s.cancel.bind(s);
    let restartNotBefore=0;
    function cancelSafely(){
      try{baseCancel()}catch{}
      restartNotBefore=Date.now()+CANCEL_RESTART_MS;
    }

    pumpSpeech=function(){
      const audio=getAudioState(),sp=synth();
      if(!audio||!sp||audio.current||!audio.queue?.length)return;
      if(sp.paused){try{sp.resume()}catch{}}
      const wait=Math.max(0,restartNotBefore-Date.now());
      if(wait>0){setTimeout(()=>{try{pumpSpeech()}catch{}},wait+10);return}

      audio.queue.sort((x,y)=>Number(y.priority||0)-Number(x.priority||0)||Number(x.seq||0)-Number(y.seq||0));
      const item=audio.queue.shift();
      const original=rawText(item?.text);
      if(!original){setTimeout(()=>{try{pumpSpeech()}catch{}},20);return}
      const prepared=safePronunciation(original);
      const token=++audio.token;

      const launch=(text,usePreferredVoice=true,retry=0)=>{
        let finished=false,started=false,startWatch=null,endWatch=null;
        const utterance=new SpeechSynthesisUtterance(rawText(text)||original);
        utterance.lang='fr-FR';
        utterance.rate=item?.kind==='navigation'?.98:.92;
        utterance.volume=1;
        if(usePreferredVoice){const voice=frenchVoice();if(voice)utterance.voice=voice}
        audio.current={priority:Number(item?.priority??50),kind:item?.kind||'general',token};

        const cleanup=()=>{clearTimeout(startWatch);clearTimeout(endWatch)};
        const complete=()=>{
          if(finished)return;finished=true;cleanup();duckEnd(item?.kind);
          if(audio.current?.token===token)audio.current=null;
          setTimeout(()=>{try{pumpSpeech()}catch{}},30);
        };
        const fallback=reason=>{
          if(finished)return;finished=true;cleanup();duckEnd(item?.kind);
          if(audio.current?.token===token)audio.current=null;
          console.warn('[Mon SAEIV] reprise synthèse vocale',reason||'sans détail');
          cancelSafely();
          if(retry<1)setTimeout(()=>launch(original,false,retry+1),CANCEL_RESTART_MS+30);
          else setTimeout(()=>{try{pumpSpeech()}catch{}},CANCEL_RESTART_MS+30);
        };

        utterance.onstart=()=>{
          started=true;clearTimeout(startWatch);duckStart(item?.kind);
          const maxMs=Math.min(45000,Math.max(9000,3500+utterance.text.length*105));
          endWatch=setTimeout(()=>{if(!finished)fallback('annonce bloquée en cours')},maxMs);
        };
        utterance.onend=complete;
        utterance.onerror=e=>{
          const code=String(e?.error||'speech-error');
          if((code==='canceled'||code==='interrupted')&&retry>=1)return complete();
          fallback(code);
        };
        startWatch=setTimeout(()=>{if(!started&&!finished)fallback('démarrage vocal sans réponse')},START_RETRY_MS);
        try{
          if(sp.paused)sp.resume();
          sp.speak(utterance);
        }catch(err){fallback(err?.message||err)}
      };
      launch(prepared,true,0);
    };

    say=function(text,opts={}){
      const audio=getAudioState(),sp=synth(),txt=rawText(text);
      if(!audio||!sp||!txt)return;
      const kind=opts.kind||'general';
      if(audio.passengerEnabled===false&&['departure','identity','stop'].includes(kind))return;
      const item={text:txt,priority:Number(opts.priority??50),kind,ephemeral:!!opts.ephemeral,seq:Date.now()+Math.random()};
      const cur=audio.current;
      let delayed=false;
      if(cur&&(kind==='stop'||item.priority>Number(cur.priority||0))){
        cancelSafely();audio.current=null;delayed=true;
        audio.queue=(audio.queue||[]).filter(x=>Number(x.priority||0)>=item.priority);
      }else if(cur&&item.ephemeral&&Number(cur.priority||0)>=item.priority){return}
      if(kind==='stop')audio.queue=(audio.queue||[]).filter(x=>Number(x.priority||0)>=item.priority);
      audio.queue.push(item);
      if(delayed)setTimeout(()=>{try{pumpSpeech()}catch{}},CANCEL_RESTART_MS+20);else pumpSpeech();
    };

    // Sur iOS, resume() dans un geste utilisateur aide à réactiver le moteur TTS
    // après une suspension ou un changement d'état audio.
    document.addEventListener('click',()=>{try{if(s.paused)s.resume()}catch{}},{capture:true,passive:true});
    window.addEventListener('pageshow',()=>{try{if(s.paused)s.resume()}catch{};setTimeout(()=>{try{pumpSpeech()}catch{}},120)});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){try{if(s.paused)s.resume()}catch{};setTimeout(()=>{try{pumpSpeech()}catch{}},120)}});

    window.MonSAEIVSpeechV131={version:VERSION,safePronunciation,restart:()=>{try{s.resume()}catch{};setTimeout(()=>{try{pumpSpeech()}catch{}},80)}};
    console.info('[Mon SAEIV] moteur vocal 1.0.32 actif');
    return true;
  }

  function versionLabel(){
    document.title=`Mon SAEIV · ${VERSION}`;
    const e=document.querySelector('.top .eyebrow');if(e)e.textContent=`MON SAEIV · ${VERSION}`;
    const b=document.getElementById('buildInfo');if(b)b.textContent=`Version ${VERSION}`;
  }
  function boot(){
    versionLabel();
    if(!installEngine()){
      let tries=0;const timer=setInterval(()=>{versionLabel();if(installEngine()||++tries>40)clearInterval(timer)},125);
    }
    setTimeout(versionLabel,6000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
