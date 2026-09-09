'use strict';

const CACHE='mon-saeiv-clean-1.0.70';
const CORE=[
  './',
  './index.html',
  './login-gateway.js',
  './app.html',
  './manifest.webmanifest',
  './fluo_build.json',
  './fluo-numbering-2026.json',
  './runtime/runtime-manifest.json',
  './v128-gps.js',
  './v128-offline.js',
  './v130-session-orientation.js',
  './v131-speech.js',
  './v132-journals.js',
  './v133-profile-journals.js',
  './v134-journal-front.js',
  './v135-journal-router.js',
  './v136-driver-operations.js',
  './v137-driver-hub.js',
  './v141-static-fluo.js',
  './v144-day-hlp-driver.js',
  './v145-planning-tad.js',
  './v146-planning-tad-bridge.js',
  './v147-flow-journals-fix.js',
  './v148-continuous-day.js',
  './v150-journal-regulation.js',
  './v154-planning-service-times.js',
  './v155-planning-cut-percent.js',
  './v156-supabase-sync.js',
  './v157-exploitation.js',
  './v159-clean-runtime.js',
  './v160-entry-bridge.js',
  './v161-admin-accounts.js',
  './v162-full-account-sync.js',
  './v163-exploitation-planner.js',
  './v164-driver-settings.js',
  './v165-exploitation-board.js',
  './v167-generation-engine.js',
  './v168-service-grid.js',
  './v167-exploitation-performance.js',
  './data/54/routes.json','./data/54/services.json','./data/54/stops.json',
  './data/57/routes.json','./data/57/services.json','./data/57/stops.json',
  './data/67/routes.json','./data/67/services.json','./data/67/stops.json',
  './data/68/routes.json','./data/68/services.json','./data/68/stops.json'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async url=>{
      try{
        const response=await fetch(url,{cache:'no-store'});
        if(response&&response.ok)await cache.put(url,response.clone());
      }catch{}
    }));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.allSettled(keys.filter(k=>k!==CACHE&&(/mon-saeiv|fluo-saeiv/i.test(k))).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

async function networkFirst(request,fallbackUrl=null){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch{
    return (await cache.match(request,{ignoreSearch:true})) ||
      (fallbackUrl?await cache.match(fallbackUrl,{ignoreSearch:true}):null) ||
      new Response('Mon SAEIV indisponible hors connexion.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }
}

async function externalNetworkFirst(request){
  const name=`${CACHE}-external`;
  const cache=await caches.open(name);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch{
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  if(request.mode==='navigate'){
    const fallback=url.pathname.endsWith('/app.html')?'./app.html':'./index.html';
    event.respondWith(networkFirst(request,fallback));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(networkFirst(request));
    return;
  }

  if(['unpkg.com','cdn.jsdelivr.net','tile.openstreetmap.org'].includes(url.hostname)){
    event.respondWith(externalNetworkFirst(request));
  }
});
