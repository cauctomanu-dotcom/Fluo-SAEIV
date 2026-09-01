'use strict';
/* Mon SAEIV 1.0.39 — données Fluo 54/67/68 préparées côté GitHub Pages.
   Safari/iOS ne télécharge et ne décompresse plus les GTFS départementaux à l'exécution. */
(()=>{
  const VERSION='1.0.39';
  const CUTOVER='2026-09-01';
  const STATIC_DEPTS=new Set(['54','67','68']);
  const cache=new Map();

  const legacy={
    core:window.fluoDeptCore || window.FluoFlatData?.core,
    routes:window.fluoRoutesData || window.FluoFlatData?.routes,
    services:window.fluoServicesData || window.FluoFlatData?.services,
    stops:window.fluoStopsData || window.FluoFlatData?.stops,
    route:window.fluoRoutePayload || window.FluoFlatData?.route,
    remoteCore:window.fluoRemoteCore,
    remoteFeed:window.fluoRemoteFeed,
  };

  function localIsoDate(d=new Date()){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function selectedIso(){
    const v=document.getElementById('serviceDate')?.value;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):localIsoDate();
  }
  function useStatic(dept,date=selectedIso()){
    const d=String(dept);
    if(d==='67'||d==='68')return true;
    return d==='54'&&String(date)>=CUTOVER;
  }
  async function json(path){
    const key=String(path);
    if(!cache.has(key))cache.set(key,(async()=>{
      const u=new URL(path,document.baseURI);
      u.searchParams.set('v',VERSION);
      const r=await fetch(u.href,{cache:'no-store'});
      if(!r.ok)throw new Error(`Données Fluo locales indisponibles (${r.status})`);
      return r.json();
    })());
    try{return await cache.get(key)}catch(e){cache.delete(key);throw e}
  }
  async function staticRoutes(dept){
    const d=String(dept),x=await json(`./data/${d}/routes.json`);
    if(!Array.isArray(x?.routes)||!x.routes.length)throw new Error(`Aucune ligne Fluo ${d} publiée dans l'application`);
    return x;
  }
  async function staticServices(dept){return json(`./data/${String(dept)}/services.json`)}
  async function staticStops(dept){return json(`./data/${String(dept)}/stops.json`)}
  async function staticRoute(dept,route){
    const d=String(dept),file=String(route?.file||'');
    if(!file)throw new Error(`Parcours Fluo ${d} sans fichier local`);
    return json(`./data/${d}/${file.replace(/^\.\//,'')}`);
  }
  async function staticCore(dept){
    const d=String(dept),[routesIndex,servicesIndex,stopsIndex]=await Promise.all([
      staticRoutes(d),staticServices(d),staticStops(d)
    ]);
    return {format:'fluo-static-gtfs-v139',department:d,routesIndex,servicesIndex,stopsIndex};
  }
  async function staticFeed(dept){
    const d=String(dept),[idx,svc]=await Promise.all([staticRoutes(d),staticServices(d)]);
    const tripsByRoute=new Map();
    for(const r of idx.routes||[]){
      const ids=Array.isArray(r.service_ids)?r.service_ids:[];
      tripsByRoute.set(String(r.id),ids.map(service_id=>({route_id:String(r.id),service_id:String(service_id)})));
    }
    return {
      dept:d,
      static_gtfs:true,
      routes:idx.routes||[],
      services:svc.services||{},
      tripsByRoute,
      sourceUrl:idx.source_url||idx.source||'',
    };
  }

  async function core(dept){return useStatic(dept)?staticCore(dept):legacy.core(dept)}
  async function routes(dept){return useStatic(dept)?staticRoutes(dept):legacy.routes(dept)}
  async function services(dept){return useStatic(dept)?staticServices(dept):legacy.services(dept)}
  async function stops(dept){return useStatic(dept)?staticStops(dept):legacy.stops(dept)}
  async function route(dept,r){return useStatic(dept)?staticRoute(dept,r):legacy.route(dept,r)}
  async function remoteCore(dept){return STATIC_DEPTS.has(String(dept))?staticCore(dept):legacy.remoteCore(dept)}
  async function remoteFeed(dept){return STATIC_DEPTS.has(String(dept))?staticFeed(dept):legacy.remoteFeed(dept)}

  // Les fonctions historiques sont des bindings globaux : les réassigner ici fait aussi
  // basculer les appels directs des anciens modules sans réécrire toute l'application.
  window.fluoDeptCore=core;
  window.fluoRoutesData=routes;
  window.fluoServicesData=services;
  window.fluoStopsData=stops;
  window.fluoRoutePayload=route;
  window.fluoRemoteCore=remoteCore;
  window.fluoRemoteFeed=remoteFeed;
  window.FluoFlatData={...(window.FluoFlatData||{}),core,routes,services,stops,route};
  window.MonSAEIVStaticFluoV139={version:VERSION,useStatic,clear:()=>cache.clear()};
  console.info('[Mon SAEIV] données Fluo statiques 1.0.39 actives');
})();
