'use strict';
/* Mon SAEIV — unified announcements V204.
   A single scheduler, one playback, cloud TTS and local fallback.
   Phonetics affect speech text only; GTFS names remain unchanged. */
(()=>{
 if(window.MonSAEIVUnifiedSpeechV204?.installed)return;
 const VERSION='1.0.120';
 const API='https://xpmrnwipnoekiycghwli.supabase.co/functions/v1/passenger-tts';
 const KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
 const IOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const q=id=>document.getElementById(id),raw=t=>String(t??'').replace(/\s+/g,' ').trim();
 const audio=()=>{try{return state?.audio||null}catch{return null}};
 const synth=()=>window.speechSynthesis||null;
 const cloud=()=>window.MonSAEIVCloudV156;
 const preference=()=>{try{return localStorage.getItem('fluoPassengerVoice')==='male'?'male':'female'}catch{return'female'}};
 const routeKey=()=>{try{return [state?.route?.id||state?.route?.short||'',state?.pattern?.id||state?.pattern?.headsign||'',q('startStop')?.value||''].join('|')}catch{return''}};
 const stopTarget=()=>{try{return Number.isInteger(state?.target)?state.target:null}catch{return null}};
 const recent=new Map(),vocabulary=new Set();
 let running=null,nextId=0,cloudBackoffUntil=0,identityRoute='',identityAnchor=null,lastStatus='Initialisation vocale',mode='idle';
 let player=null,playerReady=false,context=null,localProbe=null,previewing=false;
 const excluded=/^(?:parking|camping|shopping|meeting|timing)$/i;
 function addPlaceNames(value){
  for(const token of String(value||'').match(/\p{L}+/gu)||[])
   if(/ing$/iu.test(token)&&!excluded.test(token))vocabulary.add(token.toLocaleLowerCase('fr-FR'));
 }
 function refreshNames(){
  vocabulary.clear();
  try{
   for(const stop of state?.pattern?.stops||[])addPlaceNames(stop.name);
   addPlaceNames(state?.pattern?.headsign);
   addPlaceNames(state?.route?.headsign);
  }catch{}
 }
 function safePronunciation(value){
  let text=raw(value);if(!text)return'';
  text=text.replace(/\b(Place\s+du\s+)Marche\b/gi,'$1Marché')
    .replace(/\bArs(?=[\s-]+Laquenexy\b)/gi,'Arse')
    .replace(/\bcimeti(?:e|è|é)re\b/gi,'cimetière');
  refreshNames();
  const isPlaceAnnouncement=/(?:prochain arrêt|arrêt|à destination de|direction)\s*[,:]?\s*/iu.test(text);
  const after=text.search(/(?:prochain arrêt|arrêt|à destination de|direction)\s*[,:]?\s*/iu);
  return raw(text.replace(/\p{L}+/gu,(part,offset)=>{
   if(!/ing$/iu.test(part)||excluded.test(part))return part;
   const known=vocabulary.has(part.toLocaleLowerCase('fr-FR'));
   const inPlaceName=isPlaceAnnouncement&&after>=0&&offset>after;
   return known||inPlaceName?part.slice(0,-1):part;
  }));
 }
 function voiceProfile(){
  const all=(synth()?.getVoices?.()||[]).filter(v=>/^fr(?:[-_]|$)/i.test(v.lang||''));
  const male=preference()==='male';
  const re=male?/(thomas|daniel|nicolas|paul|henri|male|homme)/i:/(audrey|aur[eé]lie|marie|c[eé]line|hortense|female|femme)/i;
  const found=all.find(v=>re.test((v.name||'')+' '+(v.voiceURI||'')));
  return {voice:found||all[0]||null,pref:preference(),pitch:male&&!found?.75:1};
 }
 function report(s,kind='info'){
  lastStatus=s;mode=kind;
  const label=q('voiceActual');if(label)label.textContent=s;
  const btn=q('v131AudioActivate');
  if(btn){btn.title=s;btn.textContent=playerReady?'🔊 Annonces prêtes':'🔊 Activer les annonces';}
 }
 function ensurePlayer(){
  if(player)return player;
  const p=document.createElement('audio');p.id='saeivUnifiedAudio';p.setAttribute('playsinline','');p.preload='auto';
  p.style.display='none';document.body.appendChild(p);player=p;return p;
 }
 function toneBlob(){
  const r=22050,n=Math.round(r*.17),b=new ArrayBuffer(44+n*2),v=new DataView(b);
  const write=(a,s)=>{for(let i=0;i<s.length;i++)v.setUint8(a+i,s.charCodeAt(i))};
  write(0,'RIFF');v.setUint32(4,36+2*n,true);write(8,'WAVE');write(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,r,true);v.setUint32(28,r*2,true);v.setUint16(32,2,true);
  v.setUint16(34,16,true);write(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){const fade=Math.max(0,Math.min(1,i/300,(n-i)/300));v.setInt16(44+2*i,Math.round(Math.sin(i*2*Math.PI*660/r)*fade*.18*32767),true)}
  return new Blob([b],{type:'audio/wav'});
 }
 function unlock(){
  // Must be called synchronously within a user gesture on iOS.
  if(!playerReady){
   try{
    const p=ensurePlayer();
    if(!localProbe)localProbe=URL.createObjectURL(toneBlob());
    p.pause();p.src=localProbe;p.volume=1;p.muted=false;
    Promise.resolve(p.play()).then(()=>{playerReady=true;report('Annonces audio prêtes','ready')}).catch(()=>report('Audio bloqué : toucher Activer les annonces','blocked'));
   }catch(e){report('Audio refusé : '+(e.message||e),'blocked')}
  }
  try{
   const C=window.AudioContext||window.webkitAudioContext;
   if(C&&!context)context=new C();
   context?.resume?.().catch(()=>{});
  }catch{}
  return Promise.resolve(playerReady);
 }
 function stale(item){
  if(!item||item.cancelled)return true;
  if(typeof item.valid==='function'){try{if(!item.valid())return true}catch{return true}}
  if((item.role==='next-stop'||item.role==='arrival')&&Number.isInteger(item.stop)){
   try{
    if(!state?.running||item.route!==routeKey()||stopTarget()!==item.stop)return true;
    if(item.role==='next-stop'&&state?.arrivalAnnounced)return true;
   }catch{return true}
  }
  return false;
 }
 function classify(text,opts,kind){
  const role=opts.role||(kind==='stop'&&/^Prochain arrêt\b/i.test(text)?'next-stop':kind==='stop'&&/^Arrêt\b/i.test(text)?'arrival':null);
  const stop=Number.isInteger(opts.targetIndex)?opts.targetIndex:role?stopTarget():null;
  const route=routeKey();
  const key=[route,kind,role||'',stop===null?'':stop,text.toLowerCase()].join('|');
  return {role,stop,route,key};
 }
 function duck(cur,on){
  if(on&&!cur.ducked){cur.ducked=true;try{window.MonSAEIVRadio?.duckStart?.(cur.item.kind)}catch{}}
  if(!on&&cur.ducked){cur.ducked=false;try{window.MonSAEIVRadio?.duckEnd?.(cur.item.kind)}catch{}}
 }
 function cleanup(cur){
  if(!cur||cur.cleaned)return;cur.cleaned=true;
  clearTimeout(cur.startTimer);clearTimeout(cur.endTimer);try{cur.abort?.abort()}catch{}
  if(cur.element){try{cur.element.pause()}catch{}cur.element.onended=null;cur.element.onplaying=null;cur.element.onerror=null}
  if(cur.url)try{URL.revokeObjectURL(cur.url)}catch{}
  duck(cur,false);
 }
 function halt(){
  const cur=running;if(!cur)return;cur.finished=true;cur.item.cancelled=true;cleanup(cur);
  if(cur.mode==='local')try{synth()?.cancel()}catch{}
  if(running===cur)running=null;
  const a=audio();if(a?.current===cur)a.current=null;
 }
 function done(cur){
  if(!cur||cur.finished)return;cur.finished=true;cleanup(cur);
  if(running===cur)running=null;const a=audio();if(a?.current===cur)a.current=null;
  if(cur.started)recent.set(cur.item.key,Date.now());
  setTimeout(pump,35);
 }
 function local(cur,retry=0){
  if(cur.finished||stale(cur.item))return done(cur);
  const s=synth();
  if(!s||typeof SpeechSynthesisUtterance==='undefined'){report('Voix locale indisponible','error');return done(cur)}
  cur.mode='local';cur.cleaned=false;cur.started=false;
  const u=new SpeechSynthesisUtterance(cur.text),v=voiceProfile();
  u.lang='fr-FR';u.rate=cur.item.kind==='navigation'?.98:.92;u.volume=1;u.pitch=v.pitch;
  if(v.voice)u.voice=v.voice;
  cur.startTimer=setTimeout(()=>{
   if(cur.finished||cur.started)return;
   try{s.cancel()}catch{}
   if(retry<1)setTimeout(()=>local(cur,1),220);
   else{report('Synthèse locale bloquée : réactiver les annonces','error');done(cur)}
  },4200);
  u.onstart=()=>{if(cur.finished)return;if(stale(cur.item))return done(cur);
   cur.started=true;clearTimeout(cur.startTimer);duck(cur,true);
   cur.endTimer=setTimeout(()=>done(cur),Math.min(45000,Math.max(8500,cur.text.length*120+3000)));
   report('Annonce française en cours · voix du téléphone','local');
  };
  u.onend=()=>done(cur);
  u.onerror=e=>{
   if(cur.finished)return;
   const message=String(e?.error||'erreur vocale');
   if(!cur.started&&retry<1){clearTimeout(cur.startTimer);setTimeout(()=>local(cur,1),220)}
   else{report('Voix locale interrompue : '+message,'error');done(cur)}
  };
  try{s.speak(u)}catch(e){report('Voix locale indisponible : '+(e.message||e),'error');done(cur)}
 }
 async function cloudPlay(cur){
  try{
   const token=(await cloud()?.client?.auth?.getSession?.())?.data?.session?.access_token;
   if(!token)throw Error('Session vocale absente');
   const controller=new AbortController();cur.abort=controller;
   const deadline=setTimeout(()=>controller.abort(),8000);
   let response;
   try{response=await fetch(API,{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+token,apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({text:cur.text,voice:preference()})})}
   finally{clearTimeout(deadline)}
   if(!response.ok){const e=Error('TTS '+response.status);e.code=response.status;throw e}
   const blob=await response.blob();if(!blob.size)throw Error('Annonce IA vide');
   if(cur.finished||stale(cur.item))return done(cur);
   const p=ensurePlayer();cur.element=p;cur.mode='cloud';
   cur.url=URL.createObjectURL(blob);p.pause();p.src=cur.url;p.volume=1;p.muted=false;
   cur.startTimer=setTimeout(()=>{if(!cur.started&&!cur.finished){cleanup(cur);local(cur)}},4200);
   p.onplaying=()=>{if(cur.finished)return;cur.started=true;clearTimeout(cur.startTimer);duck(cur,true);report('Voix IA en lecture','cloud')};
   p.onended=()=>done(cur);
   p.onerror=()=>{if(!cur.finished){cleanup(cur);local(cur)}};
   await p.play();
  }catch(e){
   if(cur.finished)return;
   cloudBackoffUntil=Date.now()+([401,503].includes(e.code)?120000:15000);
   if(stale(cur.item))return done(cur);
   report('Voix IA indisponible · secours local','fallback');
   cleanup(cur);local(cur);
  }
 }
 function pump(){
  const a=audio();if(!a||running||previewing)return;
  a.queue=(a.queue||[]).filter(x=>!stale(x));
  if(!a.queue.length)return;
  a.queue.sort((x,y)=>y.priority-x.priority||x.seq-y.seq);
  const item=a.queue.shift();if(!item||stale(item))return setTimeout(pump,30);
  const cur={item,text:safePronunciation(item.text),started:false,finished:false,cleaned:false,ducked:false,mode:'waiting'};
  running=cur;a.current=cur;a.token=(a.token||0)+1;
  const canCloud=Date.now()>=cloudBackoffUntil&&navigator.onLine!==false&&cloud()?.client&&['departure','identity','stop','system','manual'].includes(item.kind);
  if(canCloud)cloudPlay(cur);else local(cur);
 }
 function sayOne(text,opts={}){
  const a=audio(),t=raw(text);if(!a||!t)return;
  const kind=opts.kind||'general';
  if(a.passengerEnabled===false&&['departure','identity','stop'].includes(kind))return;
  if(kind==='identity'){
   const key=routeKey();
   if(identityRoute!==key){identityRoute=key;identityAnchor=null}
   const pos=Number.isInteger(state?.current)?state.current:null;
   if(Number.isInteger(pos)&&identityAnchor!==null&&pos-identityAnchor<5)return;
   if(Number.isInteger(pos))identityAnchor=pos;
  }
  const info=classify(t,opts,kind);
  const item={text:t,priority:Number(opts.priority??50),ephemeral:!!opts.ephemeral,kind,seq:++nextId,valid:opts.valid||null,cancelled:false,...info};
  const now=Date.now();for(const[k,v]of recent)if(now-v>12000)recent.delete(k);
  if(recent.has(item.key)||running?.item.key===item.key||(a.queue||[]).some(x=>x.key===item.key))return;
  if(item.role==='arrival'&&Number.isInteger(item.stop))
   a.queue=(a.queue||[]).filter(x=>!(x.role==='next-stop'&&x.stop===item.stop));
  if(running&&(item.priority>running.item.priority||(item.role==='arrival'&&running.item.role==='next-stop'&&running.item.stop===item.stop))){
   halt();a.queue.push(item);setTimeout(pump,160);return;
  }
  if(running&&item.ephemeral&&item.priority<=running.item.priority)return;
  a.queue.push(item);pump();
 }
 function invalidate(){
  const a=audio();if(!a)return;
  a.queue=(a.queue||[]).filter(x=>!stale(x));
  if(running&&stale(running.item)){halt();setTimeout(pump,100)}
 }
 function activateUi(){
  let btn=q('v131AudioActivate');
  if(!btn){
   btn=document.createElement('button');btn.id='v131AudioActivate';btn.type='button';
   btn.style.cssText='display:block;width:100%;min-height:43px;padding:9px;border:1px solid #99b5c7;border-radius:9px;background:#23455b;color:white;font:700 13px system-ui';
   btn.addEventListener('click',e=>{e.stopPropagation();unlock().then(()=>sayOne('Annonces vocales activées.',{kind:'system',priority:130}))});
   document.body.append(btn);
  }
  const horizontal=window.matchMedia?.('(orientation:landscape) and (max-height:650px) and (max-width:1100px)')?.matches;
  const host=horizontal?q('v15LandscapeSide'):document.querySelector('#driver .controls');
  if(host&&btn.parentElement!==host)host.insertBefore(btn,host.firstChild);
  if(!lastStatus)report('Annonces prêtes à activer');
 }
 function preview(){
  const s=synth();if(!s||typeof SpeechSynthesisUtterance==='undefined')return report('Voix locale indisponible','error');
  const button=q('voiceTest');
  try{
   unlock();halt();const a=audio();if(a)a.queue=[];s.cancel();previewing=true;
   const phrase='Essai des annonces. Prochain arrêt, Réding. Direction Lixing-lès-Rouhling.';
   const u=new SpeechSynthesisUtterance(safePronunciation(phrase)),p=voiceProfile();
   u.lang='fr-FR';u.rate=.92;u.pitch=p.pitch;u.volume=1;if(p.voice)u.voice=p.voice;
   if(button){button.disabled=true;button.textContent='🔊 Test en cours…'}
   const feedback=q('v131VoicePreviewStatus')||document.createElement('small');
   if(!feedback.id){feedback.id='v131VoicePreviewStatus';feedback.setAttribute('role','status');button?.insertAdjacentElement('afterend',feedback)}
   let over=false;
   const finish=msg=>{if(over)return;over=true;previewing=false;clearTimeout(timer);if(button){button.disabled=false;button.textContent='🔊 Écouter la voix'}feedback.textContent=msg;pump()};
   const timer=setTimeout(()=>finish('Pas de lecture détectée : vérifier les réglages audio.'),11000);
   u.onstart=()=>feedback.textContent='Lecture en cours.';
   u.onend=()=>finish('Essai terminé · noms mosellans adaptés.');
   u.onerror=e=>finish('Lecture refusée : '+(e.error||'erreur'));
   s.speak(u);
  }catch(e){previewing=false;report('Test indisponible : '+(e.message||e),'error')}
 }
 const api={installed:true,version:VERSION,safePronunciation,frenchVoice:()=>voiceProfile().voice,voiceProfile,
  isIOS:IOS,cloud:true,audioEngine:'single-queue-v204',unlockAnnouncementAudio:unlock,unlockIOSAudio:unlock,
  prepareAudioFromGesture:unlock,isOutputReady:()=>playerReady,restart:()=>{unlock();pump()},
  invalidate,preview,say:sayOne,pump,get status(){return lastStatus},get mode(){return mode}};
 window.MonSAEIVUnifiedSpeechV204=api;
 window.MonSAEIVSpeechV131=api;window.MonSAEIVSpeechV148=api;
 try{say=sayOne;pumpSpeech=pump}catch(e){console.error('[SAEIV] vocal installation',e)}
 document.addEventListener('click',e=>{if(!e.target?.closest?.('#voiceTest'))return;e.preventDefault();e.stopImmediatePropagation();preview()},true);
 document.addEventListener('pointerdown',()=>{if(!playerReady)unlock()},{capture:true,passive:true});
 window.addEventListener('pageshow',()=>setTimeout(activateUi,100));
 window.addEventListener('orientationchange',()=>setTimeout(activateUi,100));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){invalidate();setTimeout(pump,80)}});
 window.addEventListener('focus',()=>{invalidate();setTimeout(pump,80)});
 const boot=()=>{activateUi();setInterval(()=>{invalidate();activateUi();if(!running)pump()},1500)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
