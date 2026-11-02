/* Service worker du seul espace /v2 — indépendant du SAEIV 1.x */
'use strict';
const CACHE='mon-saeiv-preview-20261102-v1';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith('mon-saeiv-preview-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const u=new URL(request.url);
  if(u.origin!==self.location.origin || !u.pathname.includes('/v2/'))return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok){const saved=response.clone();caches.open(CACHE).then(c=>c.put(request,saved)).catch(()=>{});}
    return response;
  }).catch(async()=>await caches.match(request)||await caches.match('./index.html')));
});