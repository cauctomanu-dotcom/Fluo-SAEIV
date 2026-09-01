'use strict';
/* Mon SAEIV 1.0.39 — données Fluo préconstruites côté GitHub, sans téléchargement GTFS côté conducteur. */
(()=>{
  const VERSION='1.0.39';
  const CUTOVER='2026-09-01';
  const originals={
    core:window.fluoDeptCore,
    routes:window.fluoRoutesData,
    services:window.fluoServicesData,
    stops:window.fluoStopsData,
    route:window.fluoRoutePayload
  };
  if(!originals.routes||!originals.services||!originals.stops||!originals.route)return;
  const coreCache=new Map();
  const routeCache=new Map();
  const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const selectedDate=()=>{const x=String(document.getElementById('serviceDate')?.value||'');return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:isoToday()};
  const usePublished=(dept,date=selectedDate())=>{
    const d=String(dept);
    if(d==='54')return String(date)>=CUTOVER;
    if(d==='67'||d==='68')return true;
    return false;
  };
  async function getJson(path){
    if(!routeCache.has(path))routeCache.set(path,jget(path).catch(e=>{routeCache.delete(path);throw e}));
    return routeCache.get(path);
  }
  async function publishedCore(dept){
    const d=String(dept);
    if(!coreCache.has(d))coreCache.set(d,Promise.all([
      getJson(`data/${d}/routes.json`),
      getJson(`data/${d}/services.json`),
      getJson(`data/${d}/stops.json`)
    ]).then(([routesIndex,servicesIndex,stopsIndex])=>({routesIndex,servicesIndex,stopsIndex,published_local:true})).catch(e=>{coreCache.delete(d);throw e}));
    return coreCache.get(d);
  }
  function displayRoute(dept,route,date=selectedDate()){
    const d=String(dept),r={...route,published_local:true};
    r.legacy_short=String(route?.legacy_short||route?.short||'');
    if(d==='54'&&String(date)>=CUTOVER){
      const m=r.legacy_short.match(/^54R(\d{3})$/i);
      if(m)r.short=m[1];
    }
    return r;
  }
  window.fluoDeptCore=async function(dept){
    return usePublished(dept)?publishedCore(dept):originals.core(dept);
  };
  window.fluoRoutesData=async function(dept){
    const d=String(dept),date=selectedDate();
    if(!usePublished(d,date))return originals.routes(d);
    const core=await publishedCore(d),idx=core.routesIndex||{};
    return {...idx,routes:(idx.routes||[]).map(r=>displayRoute(d,r,date)),numbering_era:d==='54'?'2026-published-local':idx.numbering_era,data_mode:'static-github'};
  };
  window.fluoServicesData=async function(dept){
    const d=String(dept);return usePublished(d)?(await publishedCore(d)).servicesIndex:originals.services(d);
  };
  window.fluoStopsData=async function(dept){
    const d=String(dept);return usePublished(d)?(await publishedCore(d)).stopsIndex:originals.stops(d);
  };
  window.fluoRoutePayload=async function(dept,route){
    const d=String(dept);
    if(route?.published_local||usePublished(d)){
      if(!route?.file)throw new Error(`Parcours local ${route?.short||route?.id||''} introuvable`);
      const payload=await getJson(`data/${d}/${route.file}`);
      return {...payload,route:displayRoute(d,payload.route||route)};
    }
    return originals.route(d,route);
  };
  window.FluoFlatData={core:window.fluoDeptCore,routes:window.fluoRoutesData,services:window.fluoServicesData,stops:window.fluoStopsData,route:window.fluoRoutePayload};
  window.MonSAEIVFluoPublishedData={version:VERSION,usePublished,clear:()=>{coreCache.clear();routeCache.clear()}};
  console.info('[Mon SAEIV] données Fluo statiques 1.0.39 actives');
})();
