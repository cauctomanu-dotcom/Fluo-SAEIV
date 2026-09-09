'use strict';
/* Mon SAEIV 1.0.63 — données Fluo préparées côté GitHub + recherche non destructive
   + corrections locales de noms d'arrêts confirmées conducteur. */
(()=>{
  const VERSION='1.0.63';
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

  function stopNameKey(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  }
  const STOP_NAME_FIXES={
    '54':new Map([
      ['CHAMPENOUX ST BATHELEMY','CHAMPENOUX - Saint-Barthélémy'],
    ]),
  };
  const STOP_CODE_FIXES={
    '54':new Map([
      ['4778854','LEYR - À la Vignolle'],
    ]),
  };
  function fixedStopName(dept,stop){
    const d=String(dept), name=String(stop?.name||'');
    const byCode=STOP_CODE_FIXES[d]?.get(String(stop?.code||''));
    if(byCode)return byCode;
    return STOP_NAME_FIXES[d]?.get(stopNameKey(name)) || name;
  }
  function fixedStops(dept,stops){
    return (Array.isArray(stops)?stops:[]).map(s=>{
      const name=fixedStopName(dept,s);
      return name===s?.name?s:{...(s||{}),name};
    });
  }
  function fixedRoutePayload(dept,payload){
    if(!payload||!Array.isArray(payload.patterns))return payload;
    return {...payload,patterns:payload.patterns.map(p=>({...p,stops:fixedStops(dept,p?.stops)}))};
  }

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
  async function staticStops(dept){
    const d=String(dept),x=await json(`./data/${d}/stops.json`);
    return Array.isArray(x?.stops)?{...x,stops:fixedStops(d,x.stops)}:x;
  }
  async function staticRoute(dept,route){
    const d=String(dept),file=String(route?.file||'');
    if(!file) throw new Error(`Parcours Fluo ${d} sans fichier local`);
    const [raw,map]=await Promise.all([
      json(`./data/${d}/${file.replace(/^\.\//,'')}`),
      numbering()
    ]);
    const payload=fixedRoutePayload(d,raw);
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
    if(!select||document.getElementById('v159RouteSearch'))return;

    const style=document.createElement('style');
    style.id='v159RouteSearchStyle';
    style.textContent=`
      .v159-route-search{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;margin:6px 0 7px;position:relative}
      .v159-route-search input{min-height:42px;padding:8px 10px;border-radius:10px}
      .v159-route-search small{min-width:58px;text-align:right;color:#91a7b3;font-size:.58rem;font-weight:800}
      .v159-route-search input:disabled{opacity:.55}
      .v159-route-results{grid-column:1/-1;display:grid;gap:5px;padding:6px;border:1px solid #3d5b6b;border-radius:12px;background:#0b202b;box-shadow:0 10px 24px rgba(0,0,0,.28);max-height:290px;overflow:auto;-webkit-overflow-scrolling:touch;z-index:30}
      .v159-route-results[hidden]{display:none!important}
      .v159-route-result{display:block;width:100%;min-height:44px;padding:9px 11px;border:1px solid #315363;border-radius:10px;background:#102c39;color:inherit;text-align:left;font:inherit;line-height:1.25;cursor:pointer}
      .v159-route-result:active,.v159-route-result.v159-active{background:#174256;border-color:#6e98aa}
      .v159-route-more{padding:5px 8px;color:#91a7b3;font-size:.62rem;font-weight:700;text-align:center}
    `;
    document.head.appendChild(style);

    const box=document.createElement('div');
    box.className='v159-route-search';
    box.innerHTML='<input id="v159RouteSearch" type="search" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Rechercher : n° ou ville…" aria-label="Rechercher une ligne" aria-controls="v159RouteSearchResults" aria-expanded="false"><small id="v159RouteSearchCount"></small><div id="v159RouteSearchResults" class="v159-route-results" role="listbox" hidden></div>';
    select.insertAdjacentElement('beforebegin',box);

    const input=document.getElementById('v159RouteSearch');
    const count=document.getElementById('v159RouteSearchCount');
    const results=document.getElementById('v159RouteSearchResults');
    let choices=[],visible=[],active=-1;
    const MAX_VISIBLE=10;

    const matching=()=>{
      const q=searchKey(input.value),compact=q.replace(/\s+/g,'');
      if(!q)return [];
      const tokens=q.split(' ').filter(Boolean);
      return choices.map((c,index)=>{
        const k=searchKey(c.text),kc=k.replace(/\s+/g,'');
        let score=99;
        if(kc===compact)score=0;
        else if(kc.startsWith(compact))score=1;
        else if(k.startsWith(q))score=2;
        else if(k.includes(q)||kc.includes(compact))score=3;
        else if(tokens.every(t=>k.includes(t)))score=4;
        return {...c,index,score};
      }).filter(c=>c.score<99).sort((a,b)=>a.score-b.score||a.index-b.index);
    };

    const hideResults=()=>{
      results.hidden=true;
      results.innerHTML='';
      visible=[];
      active=-1;
      input.setAttribute('aria-expanded','false');
      input.removeAttribute('aria-activedescendant');
    };

    const setActive=index=>{
      if(!visible.length){active=-1;return}
      active=Math.max(0,Math.min(index,visible.length-1));
      [...results.querySelectorAll('.v159-route-result')].forEach((b,i)=>b.classList.toggle('v159-active',i===active));
      const btn=results.querySelector(`.v159-route-result[data-index="${active}"]`);
      if(btn){
        input.setAttribute('aria-activedescendant',btn.id);
        btn.scrollIntoView?.({block:'nearest'});
      }
    };

    const choose=candidate=>{
      if(!candidate)return false;
      select.value=candidate.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      input.value=candidate.text;
      count.textContent='';
      hideResults();
      return true;
    };

    const renderResults=()=>{
      const q=searchKey(input.value);
      const all=matching();
      count.textContent=q?`${all.length} résultat${all.length>1?'s':''}`:'';
      results.innerHTML='';
      active=-1;
      if(!q||!all.length){
        hideResults();
        return all;
      }
      visible=all.slice(0,MAX_VISIBLE);
      visible.forEach((c,i)=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='v159-route-result';
        b.id=`v159RouteResult${i}`;
        b.dataset.index=String(i);
        b.setAttribute('role','option');
        b.textContent=c.text;
        b.addEventListener('pointerdown',e=>{e.preventDefault();choose(c)});
        b.addEventListener('click',e=>{e.preventDefault();choose(c)});
        results.appendChild(b);
      });
      if(all.length>MAX_VISIBLE){
        const more=document.createElement('div');
        more.className='v159-route-more';
        more.textContent=`+ ${all.length-MAX_VISIBLE} autre${all.length-MAX_VISIBLE>1?'s':''} résultat${all.length-MAX_VISIBLE>1?'s':''} — continue à taper`;
        results.appendChild(more);
      }
      results.hidden=false;
      input.setAttribute('aria-expanded','true');
      return all;
    };

    const refresh=()=>{
      choices=[...select.options]
        .filter(o=>o.value&&!o.disabled)
        .map(o=>({value:o.value,text:(o.textContent||'').trim()}));
      input.disabled=select.disabled;
      if(input.value)renderResults();else hideResults();
    };

    input.addEventListener('input',renderResults);
    input.addEventListener('focus',()=>{if(input.value.trim())renderResults()});
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        e.preventDefault();
        input.value='';
        count.textContent='';
        hideResults();
        return;
      }
      if(e.key==='ArrowDown'){
        if(results.hidden)renderResults();
        if(visible.length){e.preventDefault();setActive(active<0?0:active+1)}
        return;
      }
      if(e.key==='ArrowUp'){
        if(visible.length){e.preventDefault();setActive(active<0?visible.length-1:active-1)}
        return;
      }
      if(e.key!=='Enter')return;
      const all=matching();
      const candidate=active>=0?visible[active]:(all.length?all[0]:null);
      if(candidate){e.preventDefault();choose(candidate)}
    });

    const observer=new MutationObserver(()=>refresh());
    observer.observe(select,{childList:true,subtree:false,attributes:true,attributeFilter:['disabled']});
    document.getElementById('dept')?.addEventListener('change',()=>{input.value='';count.textContent='';hideResults();setTimeout(refresh,0)});
    document.getElementById('lineTypeFilter')?.addEventListener('change',()=>{input.value='';count.textContent='';hideResults();setTimeout(refresh,0)});
    document.addEventListener('pointerdown',e=>{if(!box.contains(e.target))hideResults()},{passive:true});
    refresh();
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
  console.info('[Mon SAEIV] données Fluo 54/57/67/68 à jour + recherche de ligne à suggestions tactiles 1.0.63 active');
})();
