'use strict';
(()=>{
  const core=window.SAEIVTracking,q=id=>document.getElementById(id);
  if(!core||window.MonSAEIVLiveV182)return;
  let busy=false,published=false,identity='',publicId=null,lookupKey='',lookup=null;
  const cloud=()=>window.MonSAEIVCloudV156;
  const st=()=>typeof state==='undefined'?window.state:state;
  function status(text){let e=q('v182LiveStatus');const anchor=q('v13Userbar');if(!e&&anchor){e=document.createElement('span');e.id='v182LiveStatus';e.style.cssText='font-size:12px;padding:6px;';anchor.appendChild(e)}if(e)e.textContent=text}
  function currentCourse(){const s=st();if(!s?.run?.trip||!s.pattern)return null;return{dept:String(s.dept),route:s.route,pattern:s.pattern,trip:s.run.trip,date:core.parisDate(s.run.serviceDate),start:Number(q('startStop')?.value||0)}}
  async function linkedCourse(item){
    const l=item?.linked;if(!l)return null;const key=[item.date,l.dept,l.routeId,l.tripId,l.startStopIndex].join('|');
    if(key===lookupKey&&lookup)return lookup;
    const routes=await window.FluoFlatData.routes(l.dept),route=routes.routes.find(r=>String(r.id)===String(l.routeId));if(!route)return null;
    const payload=await window.FluoFlatData.route(l.dept,route);
    for(const pattern of payload.patterns||[]){const trip=pattern.trips?.find(t=>String(t.id)===String(l.tripId));if(trip){lookupKey=key;lookup={dept:String(l.dept),route,pattern,trip,date:item.date,start:Number(l.startStopIndex||0)};return lookup}}
    return null;
  }
  async function snapshot(){
    const s=st(),h=window.MonSAEIVDayAutopilotV144?.snapshot;
    if(h){if(!h.running||!h.next?.linked)return null;const course=await linkedCourse(h.next);if(!course)return null;const planned=core.at(course.date,course.trip.times?.[course.start]?.[1]||course.trip.times?.[course.start]?.[0]);return{course,stage:'hlp',position:h.position,observed:h.positionAt,delta:Number.isFinite(h.eta)&&planned!==null?(h.eta-planned)/1000:null,current:course.start,served:h.next.linked.serviceMode==='tad'?(h.next.linked.tadStops||[]):null}}
    if(!s?.running||s.mode!=='gps'||!['regular','tad'].includes(s.service?.mode))return null;
    const course=currentCourse();if(!course)return null;
    const c=s.pos?.coords,stage=s.departed?'service':'waiting';
    const dep=core.at(course.date,course.trip.times?.[course.start]?.[1]||course.trip.times?.[course.start]?.[0]);
    const delta=stage==='waiting'?(dep===null?null:Math.max(0,(Date.now()-dep)/1000)):s.punctuality?.deltaSeconds;
    return{course,stage,position:c?{lat:c.latitude,lon:c.longitude,accuracy:c.accuracy}:null,observed:s.pos?.timestamp,delta,current:s.current,served:s.service.mode==='tad'?[...s.service.tadStops]:null};
  }
  let journalBusy=false;
  const journalKey='mon-saeiv-hlp-journal-v182';
  function pendingJournal(){try{return JSON.parse(localStorage.getItem(journalKey)||'[]')}catch{return[]}}
  window.addEventListener('mon-saeiv-hlp-journal',e=>{try{const events=pendingJournal();events.push(e.detail);localStorage.setItem(journalKey,JSON.stringify(events))}catch(err){console.warn('[Journal HLP]',err)}});
  async function flushJournal(){
    const journal=window.FluoJournalCore,course=currentCourse();if(journalBusy||!st()?.running||!journal?.activeSessionId||!course)return;
    const key=[course.dept,course.date,course.trip.id].join('|'),events=pendingJournal().filter(e=>e.key===key).slice(0,100);if(!events.length)return;journalBusy=true;
    try{for(const event of events){if(!await journal.log(event.type,event.payload))break;const pending=pendingJournal(),i=pending.findIndex(e=>e.key===event.key&&e.type===event.type&&e.payload.ts===event.payload.ts);if(i>=0)pending.splice(i,1);localStorage.setItem(journalKey,JSON.stringify(pending))}}finally{journalBusy=false}
  }
  async function tick(){
    flushJournal().catch(console.warn);
    if(busy)return;const c=cloud();if(!c?.client||!c.user||!c.profile){status('Suivi voyageurs : connexion conducteur nécessaire');return}busy=true;
    try{
      const x=await snapshot();
      if(!x){if(published){const{error}=await c.client.from('saeiv_live_courses').delete().eq('owner_id',c.user.id);if(error)throw error;published=false;identity=''}status('Suivi voyageurs : hors course');return}
      if(!x.position||Date.now()-x.observed>30000||!Number.isFinite(x.position.lat)||!Number.isFinite(x.position.lon)||x.position.accuracy>100){status('Suivi voyageurs : attente du GPS');return}
      const a=x.course,key=[a.dept,a.date,a.trip.id].join('|');if(key!==identity){identity=key;publicId=crypto.randomUUID()}
      const row={owner_id:c.user.id,organization_id:c.profile.organization_id,public_id:publicId,service_date:a.date,department:a.dept,route_id:String(a.route.id),trip_id:String(a.trip.id),line:String(a.route.short||''),destination:String(a.pattern.headsign||a.pattern.stops.at(-1)?.name||''),stage:x.stage,latitude:x.position.lat,longitude:x.position.lon,accuracy_m:x.position.accuracy||0,observed_at:new Date(x.observed).toISOString(),delay_seconds:Number.isFinite(x.delta)?Math.round(x.delta):null,stop_index:Number(x.current),start_index:a.start,served_stop_indices:x.served};
      const{error}=await c.client.from('saeiv_live_courses').upsert(row,{onConflict:'owner_id'});if(error)throw error;published=true;status('● Position partagée avec les voyageurs');
    }catch(e){status('Suivi voyageurs indisponible');console.warn('[Suivi voyageurs]',e?.message||e)}finally{busy=false}
  }
  // Launch a mise en place even when a driver selects a course outside Ma journée.
  if(typeof startGps==='function'){
    const base=startGps;let preparing=false;
    startGps=async function(){
      if(preparing||window.MonSAEIVDayAutopilotV144?.snapshot)return;const s=st(),course=currentCourse();
      if(!course||!['regular','tad'].includes(s.service?.mode))return base.apply(this,arguments);
      preparing=true;
      try{
        const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
        if(String(currentCourse()?.trip.id)!==String(course.trip.id)||st()?.running)return;if(pos.coords.accuracy>100)throw new Error('Position GPS trop imprécise : réessayez lorsque le signal est meilleur.');s.pos=pos;const stop=course.pattern.stops[course.start];
        if(pos.coords.accuracy<=100&&stop&&dist(pos.coords.latitude,pos.coords.longitude,Number(stop.lat),Number(stop.lon))>150){
          const raw=course.trip.times?.[course.start]?.[1]||course.trip.times?.[course.start]?.[0];
          const next={date:course.date,start:raw?.slice(0,5),line:course.route.short,origin:stop.name,linked:{dept:course.dept,routeId:course.route.id,tripId:course.trip.id,startStopIndex:course.start}};
          await window.MonSAEIVDayAutopilotV144.startHlp({id:crypto.randomUUID(),synthetic:true,date:course.date,origin:'Position actuelle',destination:stop.name,destinationCoords:{lat:stop.lat,lon:stop.lon}},{manual:true,nextCourse:next,onComplete:()=>base()});
          return;
        }
        return base.apply(this,arguments);
      }catch(e){console.warn('[HLP] GPS initial indisponible',e);if(q('status'))q('status').textContent=`Mise en place : ${e.message||'GPS indisponible'}. Réessayez la prise de service.`;return}finally{preparing=false}
    };
  }
  const link=document.createElement('a');link.href='./voyageurs.html';link.target='_blank';link.rel='noopener';link.textContent='Suivre un bus · Espace voyageurs';link.style.cssText='display:block;padding:14px;color:#ffd000';document.body.appendChild(link);
  window.MonSAEIVLiveV182={tick,snapshot};setInterval(tick,5000);tick();
})();
