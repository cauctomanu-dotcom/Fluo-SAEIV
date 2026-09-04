'use strict';
/* Mon SAEIV 1.0.58 — données Fluo préparées côté GitHub + vraie table officielle
   + recherche rapide dans le sélecteur de ligne. */
(()=>{
  const VERSION='1.0.58';
  const CUTOVER='2026-09-01';
  const STATIC_DEPTS=new Set(['54','57','67','68']);
  const JSON_CACHE=new Map();
  let numberingPromise=null;

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
    if(d==='67'||d==='68') return true;
    return (d==='54'||d==='57') && String(date)>=CUTOVER;
  }

  async function json(path){
    const key=String(path);
    if(!JSON_CACHE.has(key)) JSON_CACHE.set(key,(async()=>{
      const u=new URL(path,document.baseURI);
      u.searchParams.set('v',VERSION);
      const r=await fetch(u.href,{cache:'no-store'});
      if(!r.ok) throw new Error(`${path} indisponible (${r.status})`);
      return r.json();
    })());
    try{return await JSON_CACHE.get(key)}catch(e){JSON_CACHE.delete(key);throw e}
  }

  function numbering(){
    if(!numberingPromise){
      numberingPromise=json('./fluo-numbering-2026.json').catch(e=>{
        numberingPromise=null;
        console.error('[Mon SAEIV] table officielle de numérotation indisponible',e);
        throw e;
      });
    }
    return numberingPromise;
  }

  function applyOfficialNumber(dept,route,map,date=selectedIso()){
    const d=String(dept), r={...(route||{})};
    const old=String(r.legacy_short||r.short||'').trim();
    r.legacy_short=old;
    if(String(date)>=CUTOVER){
      const hit=map?.departments?.[d]?.[old];
      if(hit?.new){
        r.short=String(hit.new);
        r.official_new_number=true;
        r.numbering_effective=CUTOVER;
      }
    }
    return r;
  }

  async function staticRoutes(dept){
    const d=String(dept);
    const [x,map]=await Promise.all([json(`./data/${d}/routes.json`),numbering()]);
    if(!Array.isArray(x?.routes)||!x.routes.length) throw new Error(`Aucune ligne Fluo ${d} publiée dans l'application`);
    return {...x,routes:x.routes.map(r=>applyOfficialNumber(d,r,map))};
  }
  async function staticServices(dept){return json(`./data/${String(dept)}/services.json`)}
  async function staticStops(dept){return json(`./data/${String(dept)}/stops.json`)}
  async function staticRoute(dept,route){
    const d=String(dept),file=String(route?.file||'');
    if(!file) throw new Error(`Parcours Fluo ${d} sans fichier local`);
    const [payload,map]=await Promise.all([
      json(`./data/${d}/${file.replace(/^\.\//,'')}`),
      numbering()
    ]);
    return {...payload,route:applyOfficialNumber(d,payload?.route||route,map)};
  }
  async function staticCore(dept){
    const d=String(dept),[routesIndex,servicesIndex,stopsIndex]=await Promise.all([
      staticRoutes(d),staticServices(d),staticStops(d)
    ]);
    return {format:'fluo-static-gtfs-v141',department:d,routesIndex,servicesIndex,stopsIndex};
  }
  async function staticFeed(dept){
    const d=String(dept),[idx,svc]=await Promise.all([staticRoutes(d),staticServices(d)]);
    const tripsByRoute=new Map();
    for(const r of idx.routes||[]){
      const ids=Array.isArray(r.service_ids)?r.service_ids:[];
      tripsByRoute.set(String(r.id),ids.map(service_id=>({route_id:String(r.id),service_id:String(service_id)})));
    }
    return {dept:d,static_gtfs:true,routes:idx.routes||[],services:svc.services||{},tripsByRoute,sourceUrl:idx.source_url||idx.source||''};
  }

  async function core(dept){return useStatic(dept)?staticCore(dept):legacy.core(dept)}
  async function routes(dept){return useStatic(dept)?staticRoutes(dept):legacy.routes(dept)}
  async function services(dept){return useStatic(dept)?staticServices(dept):legacy.services(dept)}
  async function stops(dept){return useStatic(dept)?staticStops(dept):legacy.stops(dept)}
  async function route(dept,r){return useStatic(dept)?staticRoute(dept,r):legacy.route(dept,r)}
  async function remoteCore(dept){return STATIC_DEPTS.has(String(dept))?staticCore(dept):legacy.remoteCore(dept)}
  async function remoteFeed(dept){return STATIC_DEPTS.has(String(dept))?staticFeed(dept):legacy.remoteFeed(dept)}

  function searchKey(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  }
  function installRouteSearch(){
    const select=document.getElementById('route');
    if(!select||document.getElementById('v158RouteSearch'))return;
    const style=document.createElement('style');
    style.id='v158RouteSearchStyle';
    style.textContent='.v158-route-search{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;margin:6px 0 7px}.v158-route-search input{min-height:42px;padding:8px 10px;border-radius:10px}.v158-route-search small{min-width:58px;text-align:right;color:#91a7b3;font-size:.58rem;font-weight:800}.v158-route-search input:disabled{opacity:.55}.v158-route-search input::-webkit-search-cancel-button{cursor:pointer}';
    document.head.appendChild(style);
    const box=document.createElement('div');
    box.className='v158-route-search';
    box.innerHTML='<input id="v158RouteSearch" type="search" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Rechercher : n° ou ville…" aria-label="Rechercher une ligne"><small id="v158RouteSearchCount"></small>';
    select.insertAdjacentElement('beforebegin',box);
    const input=document.getElementById('v158RouteSearch');
    const count=document.getElementById('v158RouteSearchCount');
    let master=[];
    let observer;

    const apply=()=>{
      const q=searchKey(input.value),compact=q.replace(/\s+/g,'');
      const before=select.value;
      const first=master[0]||{value:'',text:'Choisir une ligne…',disabled:false};
      const matches=master.slice(1).filter(o=>{
        if(!q)return true;
        const k=searchKey(o.text),kc=k.replace(/\s+/g,'');
        return k.includes(q)||kc.includes(compact)||q.split(' ').every(t=>!t||k.includes(t));
      });
      observer?.disconnect();
      select.innerHTML='';
      for(const o of [first,...matches]){
        const el=document.createElement('option');el.value=o.value;el.textContent=o.text;el.disabled=o.disabled;select.appendChild(el);
      }
      if([...select.options].some(o=>o.value===before))select.value=before;
      else select.value='';
      if(observer)observer.observe(select,{childList:true,subtree:false,attributes:true,attributeFilter:['disabled']});
      count.textContent=q?`${matches.length} résultat${matches.length>1?'s':''}`:'';
      input.disabled=select.disabled;
    };
    const capture=()=>{
      master=[...select.options].map(o=>({value:o.value,text:o.textContent||'',disabled:o.disabled}));
      input.disabled=select.disabled;
      apply();
    };
    observer=new MutationObserver(()=>capture());
    observer.observe(select,{childList:true,subtree:false,attributes:true,attributeFilter:['disabled']});
    input.addEventListener('input',apply);
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){input.value='';apply();return}
      if(e.key!=='Enter')return;
      const choices=[...select.options].filter(o=>o.value&&!o.disabled);
      if(choices.length===1){e.preventDefault();select.value=choices[0].value;select.dispatchEvent(new Event('change',{bubbles:true}))}
    });
    document.getElementById('dept')?.addEventListener('change',()=>{input.value='';setTimeout(capture,0)});
    document.getElementById('lineTypeFilter')?.addEventListener('change',()=>{input.value='';setTimeout(capture,0)});
    capture();
  }

  window.fluoDeptCore=core;
  window.fluoRoutesData=routes;
  window.fluoServicesData=services;
  window.fluoStopsData=stops;
  window.fluoRoutePayload=route;
  window.fluoRemoteCore=remoteCore;
  window.fluoRemoteFeed=remoteFeed;
  window.FluoFlatData={...(window.FluoFlatData||{}),core,routes,services,stops,route};
  window.MonSAEIVStaticFluoV141={
    version:VERSION,
    effectiveDate:CUTOVER,
    useStatic,
    numbering,
    clear:()=>{JSON_CACHE.clear();numberingPromise=null;}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installRouteSearch,{once:true});else installRouteSearch();
  console.info('[Mon SAEIV] données Fluo 54/57/67/68 à jour + recherche rapide des lignes 1.0.58 actives');
})();
