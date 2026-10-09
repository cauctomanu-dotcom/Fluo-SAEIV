'use strict';
/* SAEIV 1.0.104: independent, audible home-screen voice diagnostics on iPhone. */
(()=>{
 if(window.MonSAEIVHomeVoiceV200?.installed)return;
 let sound=null;
 const wav=()=>{
  const rate=22050, n=Math.ceil(rate*.19), buffer=new ArrayBuffer(44+n*2),v=new DataView(buffer);
  const txt=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j))};
  txt(0,'RIFF');v.setUint32(4,36+n*2,true);txt(8,'WAVE');txt(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);
  v.setUint16(34,16,true);txt(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){const amp=Math.min(1,i/320,(n-i)/320);v.setInt16(44+i*2,Math.round(Math.sin(i*2*Math.PI*660/rate)*.27*Math.max(0,amp)*32767),true)}
  return new Blob([buffer],{type:'audio/wav'});
 };
 function playProbe(){
  if(!sound){
   sound=document.createElement('audio');sound.id='v200VoiceTestAudio';
   sound.setAttribute('playsinline','');sound.setAttribute('webkit-playsinline','');sound.preload='auto';
   sound.style.display='none';document.body.appendChild(sound);
  }
  if(sound.dataset.url)URL.revokeObjectURL(sound.dataset.url);
  const url=URL.createObjectURL(wav());sound.dataset.url=url;sound.pause();sound.src=url;
  sound.currentTime=0;sound.volume=1;sound.muted=false;
  return sound.play();
 }
 function test(e){
  if(!e.target?.closest?.('#voiceTest'))return;
  // The old button emitted a 'stop' event which was ignored whenever automatic
  // passenger announcements were OFF. Home voice tests are independent.
  e.preventDefault();e.stopImmediatePropagation();
  const label=document.getElementById('voiceActual');
  const male=document.getElementById('passengerVoiceGender')?.value==='male';
  const phrase=male?'Aperçu de la voix homme. Prochain arrêt, Delme République.':'Aperçu de la voix femme. Prochain arrêt, Delme République.';
  try{window.MonSAEIVSpeechV131?.prepareAudioFromGesture?.()}catch(err){console.warn('[SAEIV] gesture audio',err)}
  let tone;
  try{tone=playProbe()}catch(err){tone=Promise.reject(err)}
  if(label)label.textContent='Test du haut-parleur iPhone et de la voix française en cours…';
  Promise.resolve(tone).then(()=>{
   if(label)label.textContent='Bip de test lancé. Si tu l’as entendu, écoute maintenant la phrase française.';
  }).catch(err=>{
   if(label)label.textContent='Bip bloqué par iOS ('+(err?.name||'lecture refusée')+'). Vérifier le volume et la sortie audio.';
  });
  setTimeout(()=>{
   try{
    if(typeof state!=='undefined'&&state?.audio){state.audio.queue=[];state.audio.current=null}
    window.speechSynthesis?.cancel();
    // 'system' is allowed even if passenger stop announcements are disabled.
    if(typeof say==='function')say(phrase,{kind:'system',priority:160});
    else if(label)label.textContent+=' Synthèse vocale principale indisponible.';
   }catch(err){if(label)label.textContent+=' Synthèse vocale en erreur : '+(err?.message||err)}
  },310);
 }
 document.addEventListener('click',test,true);
 window.MonSAEIVHomeVoiceV200={installed:true,test};
})();