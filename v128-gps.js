'use strict';
/* Mon SAEIV 1.0.27 — projection visuelle GPS sur tracé + interpolation continue.
   Le GPS réel reste la seule donnée métier. Cette couche crée uniquement une position d'affichage :
   elle projette le véhicule sur le shape tant que la projection est crédible, anime entre deux fixes,
   puis repasse au GPS brut dès qu'un véritable écart de parcours est détecté. */
(()=>{
  const M={
    raf:null,idleTimer:null,lastFrame:0,lastVisualAt:0,lastFixStamp:null,lastFixPerf:0,lastFixAlong:null,lastPrevFixAlong:null,
    lastPrevFixPerf:0,displayAlong:null,displayLat:null,displayLon:null,displayHeading:null,speedMps:0,mode:'route',routeLocked:false,
    routeToken:'',lastLeafletAt:0,lastCameraAt:0,lastMapLat:null,lastMapLon:null
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=v=>Number.isFinite(Number(v));
  function routeToken(){const sh=state?.fusion?.shape||[];return [state?.route?.id||state?.route?.short||'',state?.run?.trip?.id||'',sh.length,sh[0]?.join(',')||'',sh.at(-1)?.join(',')||''].join('|')}
  function reset(){M.lastFixStamp=null;M.lastFixPerf=0;M.lastFixAlong=null;M.lastPrevFixAlong=null;M.lastPrevFixPerf=0;M.displayAlong=null;M.displayLat=null;M.displayLon=null;M.displayHeading=null;M.speedMps=0;M.mode='route';M.routeLocked=false;M.lastMapLat=null;M.lastMapLon=null;M.lastVisualAt=0}
  function consumeFix(now){
    const p=state?.pos,c=p?.coords,snap=state?.fusion?.snapped;if(!p||!c)return;
    const stamp=Number(p.timestamp||0)||String(c.latitude)+','+String(c.longitude)+','+String(c.accuracy||'');if(stamp===M.lastFixStamp)return;M.lastFixStamp=stamp;
    const prevPerf=M.lastFixPerf;M.lastFixPerf=now;const deviation=window.FluoOpsV29?.isDeviationActive?.()===true;
    const acc=Math.max(3,Number(c.accuracy)||35),off=Number(snap?.off??Infinity),confidence=Number(snap?.confidence||0);
    const projected=finite(snap?.rawAlong)?Number(snap.rawAlong):finite(state?.fusion?.lastAlong)?Number(state.fusion.lastAlong):finite(snap?.along)?Number(snap.along):null;
    const engage=Math.max(48,acc*1.65),release=Math.max(90,acc*2.65);
    if(deviation||projected===null)M.routeLocked=false;
    else if(M.routeLocked){if(off>release||confidence<=0)M.routeLocked=false}
    else if(off<=engage&&confidence>=8)M.routeLocked=true;
    if(M.routeLocked&&projected!==null){
      M.mode='route';const dt=prevPerf?Math.max(.15,Math.min(5,(now-prevPerf)/1000)):null;let measured=null;
      if(dt&&finite(M.lastFixAlong)){const d=projected-Number(M.lastFixAlong);if(d>=-6&&d/dt<55)measured=Math.max(0,d/dt)}
      M.lastPrevFixAlong=M.lastFixAlong;M.lastPrevFixPerf=prevPerf;M.lastFixAlong=projected;
      const gps=finite(c.speed)&&Number(c.speed)>=0?clamp(Number(c.speed),0,45):null;
      let candidate=gps!==null&&measured!==null?gps*.62+measured*.38:gps!==null?gps:measured!==null?measured:M.speedMps;
      if(candidate<.75)candidate=0;M.speedMps=clamp(M.speedMps*.28+candidate*.72,0,45);
      if(!finite(M.displayAlong)||Math.abs(Number(M.displayAlong)-projected)>260)M.displayAlong=projected;
      const pt=pointAtRouteAlong(M.displayAlong);if(pt){M.displayLat=pt.lat;M.displayLon=pt.lon}
      if(!finite(M.displayHeading))M.displayHeading=finite(snap?.heading)?Number(snap.heading):routeHeadingAtAlong(M.displayAlong);
    }else{
      M.mode='free';M.lastFixAlong=null;const lat=Number(c.latitude),lon=Number(c.longitude);if(!finite(lat)||!finite(lon))return;
      if(!finite(M.displayLat)||!finite(M.displayLon)||dist(M.displayLat,M.displayLon,lat,lon)>280){M.displayLat=lat;M.displayLon=lon}
      if(finite(c.heading)&&Number(c.heading)>=0)M.displayHeading=smoothHeading(M.displayHeading,Number(c.heading),.42);
      M.speedMps=finite(c.speed)&&Number(c.speed)>=0?clamp(Number(c.speed),0,45):0;
    }
  }
  function predictionHorizon(age,accuracy){const cap=accuracy>100?.45:accuracy>75?.85:accuracy>55?1.25:accuracy>35?1.8:2.4;return Math.min(Math.max(0,age),cap)}
  function updateRouteDisplay(now,dt){
    if(!finite(M.lastFixAlong))return;const c=state?.pos?.coords||{},acc=Math.max(3,Number(c.accuracy)||35),age=Math.max(0,(now-M.lastFixPerf)/1000),horizon=predictionHorizon(age,acc);
    const predictM=Math.min(70,M.speedMps*horizon),total=Number(state?.fusion?.cum?.at(-1)||0),wanted=clamp(Number(M.lastFixAlong)+predictM,0,total||Number(M.lastFixAlong)+predictM);
    if(!finite(M.displayAlong))M.displayAlong=wanted;
    const error=wanted-Number(M.displayAlong),tau=M.speedMps>12?.18:M.speedMps>4?.23:.32,alpha=1-Math.exp(-dt/tau),maxRate=Math.max(8,M.speedMps*1.55+6),maxStep=maxRate*dt;
    M.displayAlong=Number(M.displayAlong)+clamp(error*alpha,-maxStep,maxStep);if(Math.abs(error)<.06)M.displayAlong=wanted;
    const p=pointAtRouteAlong(M.displayAlong);if(!p)return;M.displayLat=p.lat;M.displayLon=p.lon;
    const rh=routeHeadingAtAlong(M.displayAlong),ha=1-Math.exp(-dt/.20);M.displayHeading=smoothHeading(M.displayHeading,rh,ha)
  }
  function updateFreeDisplay(dt){const c=state?.pos?.coords;if(!c)return;const lat=Number(c.latitude),lon=Number(c.longitude);if(!finite(lat)||!finite(lon))return;if(!finite(M.displayLat)||!finite(M.displayLon)){M.displayLat=lat;M.displayLon=lon;return}const alpha=1-Math.exp(-dt/.24),d=dist(M.displayLat,M.displayLon,lat,lon);if(d>240){M.displayLat=lat;M.displayLon=lon}else{M.displayLat+=(lat-M.displayLat)*alpha;M.displayLon+=(lon-M.displayLon)*alpha}if(finite(c.heading)&&Number(c.heading)>=0)M.displayHeading=smoothHeading(M.displayHeading,Number(c.heading),1-Math.exp(-dt/.24))}
  function rotateLeafletMarker(h){const el=state?.nav?.busMarker?.getElement?.();if(!el)return;const pin=el.querySelector?.('.bus-pin');if(pin)pin.style.transform=`rotate(${Number(h||0).toFixed(1)}deg)`}
  function renderLeaflet(now){const map=state?.nav?.map,marker=state?.nav?.busMarker;if(!map||!finite(M.displayLat)||!finite(M.displayLon))return;if(now-M.lastLeafletAt<40)return;M.lastLeafletAt=now;try{if(marker)marker.setLatLng([M.displayLat,M.displayLon]);else if(typeof L!=='undefined')state.nav.busMarker=L.marker([M.displayLat,M.displayLon],{icon:busIcon(M.displayHeading||0),zIndexOffset:1000,keyboard:false}).addTo(map);rotateLeafletMarker(M.displayHeading||0);if(state.nav.follow){const z=Math.max(map.getZoom(),15);map.panTo([M.displayLat,M.displayLon],{animate:false,noMoveStart:true});if(map.getZoom()!==z)map.setZoom(z,{animate:false})}}catch{}}
  function renderMapLibre(now){const v=window.__fluoV16,m=v?.map3d;if(!m||!v?.mapLoaded||!finite(M.displayLat)||!finite(M.displayLon))return;try{v.busMarker?.setLngLat([M.displayLon,M.displayLat]);v.busMarker?.setRotation?.(M.displayHeading||0)}catch{}if(now-M.lastCameraAt<50||!state?.nav?.follow)return;M.lastCameraAt=now;try{const mode=v.mapMode||'3d',common=mode==='3d'?{center:[M.displayLon,M.displayLat],zoom:16.7,pitch:55,bearing:M.displayHeading||0,offset:[0,Math.min(115,window.innerHeight*.18)]}:{center:[M.displayLon,M.displayLat],zoom:16.1,pitch:0,bearing:mode==='heading'?(M.displayHeading||0):0,offset:[0,mode==='heading'?Math.min(75,window.innerHeight*.12):0]};m.jumpTo(common)}catch{}}
  function scheduleFrame(active){if(active){M.raf=requestAnimationFrame(frame);return}if(M.idleTimer!==null)return;M.idleTimer=setTimeout(()=>{M.idleTimer=null;M.raf=requestAnimationFrame(frame)},250)}
  function frame(ts){const active=!document.hidden&&!!state?.running&&state.mode==='gps'&&!!state.pos;if(!active){M.lastFrame=ts;M.lastVisualAt=ts;scheduleFrame(false);return}scheduleFrame(true);if(M.lastVisualAt&&ts-M.lastVisualAt<33)return;M.lastVisualAt=ts;const token=routeToken();if(token!==M.routeToken){M.routeToken=token;reset()}consumeFix(ts);const dt=M.lastFrame?clamp((ts-M.lastFrame)/1000,.001,.12):1/30;M.lastFrame=ts;if(M.mode==='route')updateRouteDisplay(ts,dt);else updateFreeDisplay(dt);renderLeaflet(ts);renderMapLibre(ts)}
  window.MonSAEIVVisualGPS={getDisplay:()=>finite(M.displayLat)&&finite(M.displayLon)?{lat:Number(M.displayLat),lon:Number(M.displayLon),heading:finite(M.displayHeading)?Number(M.displayHeading):Number(state?.nav?.lastHeading||0),along:finite(M.displayAlong)?Number(M.displayAlong):null,mode:M.mode,projected:M.routeLocked}:null,reset,diagnostics:()=>({mode:M.mode,routeLocked:M.routeLocked,speedMps:M.speedMps,displayAlong:M.displayAlong,lastFixAlong:M.lastFixAlong,lastFixAgeMs:M.lastFixPerf?performance.now()-M.lastFixPerf:null,visualFps:30,cameraFps:20})};
  scheduleFrame(false);window.addEventListener('pagehide',()=>{if(M.raf)cancelAnimationFrame(M.raf);if(M.idleTimer!==null)clearTimeout(M.idleTimer)},{once:true});
})();
