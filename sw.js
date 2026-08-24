const C='fluo-saeiv-v18-lignes-bus-ajuste';
const CORE=['./','index.html','styles.css','app.js','manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(C))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin){ e.respondWith(fetch(e.request)); return; }
  if(u.pathname.includes('/data/')){
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});return r;}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});return r;}).catch(()=>caches.match(e.request)));
});
