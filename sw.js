const C='mon-saeiv-v1-0-56-clean-runtime-1';
const CORE=['./','index.html','manifest.webmanifest','fluo_build.json','fluo-numbering-2026.json','v128-gps.js','v128-offline.js','v130-session-orientation.js','v131-speech.js','v132-journals.js','v133-profile-journals.js','v134-journal-front.js','v135-journal-router.js','v136-driver-operations.js','v137-driver-hub.js','v141-static-fluo.js','v144-day-hlp-driver.js','v145-planning-tad.js','v146-planning-tad-bridge.js','v147-flow-journals-fix.js','v148-continuous-day.js','v150-journal-regulation.js','v154-planning-service-times.js','v155-planning-cut-percent.js','v156-supabase-sync.js','v157-exploitation.js','v158-role-login.js','data/54/routes.json','data/54/services.json','data/54/stops.json','data/67/routes.json','data/67/services.json','data/67/stops.json','data/68/routes.json','data/68/services.json','data/68/stops.json'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(C);
    await Promise.allSettled(CORE.map(url=>cache.add(url)));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('mon-saeiv-v1-')&&key!==C).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirstNavigation(request){
  const cache=await caches.open(C);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){
      const copy=response.clone();
      cache.put('index.html',copy).catch(()=>{});
    }
    return response;
  }catch(error){
    return (await cache.match(request,{ignoreSearch:true})) ||
      (await cache.match('index.html')) ||
      (await cache.match('./')) ||
      new Response('Mon SAEIV indisponible hors connexion.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }
}

async function networkFirstAsset(request){
  const cache=await caches.open(C);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(error){
    return (await cache.match(request,{ignoreSearch:true})) || Response.error();
  }
}

async function cachedExternal(request){
  const cache=await caches.open(C+'-external');
  const hit=await cache.match(request);
  try{
    const response=await fetch(request);
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(error){
    return hit || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  if(request.mode==='navigate'){
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(networkFirstAsset(request));
    return;
  }

  if(url.hostname==='tile.openstreetmap.org'||url.hostname==='unpkg.com'){
    event.respondWith(cachedExternal(request));
  }
});
