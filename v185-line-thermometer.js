'use strict';
/* Mon SAEIV 1.0.91 — vue Ligne/thermomètre conducteur.
   La carte existante reste montée ; le calcul est visuel et ne modifie ni GPS ni arrêts métier. */
(()=>{
  if(window.MonSAEIVLineViewV185?.installed)return;
  const KEY='mon-saeiv-driver-view';
  const byId=id=>document.getElementById(id);
  const finite=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
  const clamp=(min,max,v)=>Math.max(min,Math.min(max,v));
  const meters=(a,b)=>{
    const toRad=Math.PI/180,lat1=Number(a.lat)*toRad,lat2=Number(b.lat)*toRad;
    const dLat=lat2-lat1,dLon=(Number(b.lon)-Number(a.lon))*toRad;
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
  };
  let view='map',ui=null,cache={shape:null,stops:null,along:null};
  try{view=localStorage.getItem(KEY)==='line'?'line':'map'}catch{}
  function snapshot(){
    let s;try{s=typeof state!=='undefined'?state:null}catch{return null}
    if(!s?.pattern?.stops?.length)return null;
    const stops=s.pattern.stops;
    const current=clamp(0,stops.length-1,Number.isInteger(s.current)?s.current:0);
    const target=clamp(current,stops.length-1,Number.isInteger(s.target)?s.target:Math.min(current+1,stops.length-1));
    const last=stops.length-1;
    return {s,stops,current,target,last,line:String(s.route?.short||s.route?.id||'—'),
      destination:String(s.pattern.headsign||stops[last]?.name||'—')};
  }
  function alongStops(s,stops){
    const shape=s.fusion?.shape?.length>1?s.fusion.shape:s.pattern?.shape;
    if(!shape||shape.length<2)return null;
    if(cache.shape===shape&&cache.stops===stops)return cache.along;
    const points=shape.map(p=>({lat:Number(p[0]),lon:Number(p[1])}));
    const cumulative=[0];
    for(let j=1;j<points.length;j++)cumulative[j]=cumulative[j-1]+meters(points[j-1],points[j]);
    let minSegment=0;
    const along=stops.map(stop=>{
      const lat=Number(stop?.lat),lon=Number(stop?.lon);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
      const pos={lat,lon};let best=Infinity,bestAt=null,bestSeg=minSegment;
      // La recherche ne recule pas sur une route pouvant revenir sur elle-même.
      for(let j=Math.max(0,minSegment-2);j<points.length-1;j++){
        const a=points[j],b=points[j+1],scaleX=111320*Math.cos(lat*Math.PI/180),scaleY=110540;
        const ax=(a.lon-lon)*scaleX,ay=(a.lat-lat)*scaleY,bx=(b.lon-lon)*scaleX,by=(b.lat-lat)*scaleY;
        const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
        const t=den?clamp(0,1,-(ax*dx+ay*dy)/den):0;
        const dist=Math.hypot(ax+dx*t,ay+dy*t);
        if(dist<best){best=dist;bestSeg=j;bestAt=cumulative[j]+(cumulative[j+1]-cumulative[j])*t}
      }
      minSegment=bestSeg;
      return bestAt;
    });
    cache={shape,stops,along};return along;
  }
  function progress(x){
    const s=x.s,stopAlong=alongStops(s,x.stops),a=stopAlong?.[x.current],b=stopAlong?.[x.target];
    const raw=finite(s.fusion?.lastAlong)?Number(s.fusion.lastAlong):
      finite(s.fusion?.snapped?.along)?Number(s.fusion.snapped.along):null;
    if(raw!==null&&finite(a)&&finite(b)&&b>a+2)return clamp(0,1,(raw-a)/(b-a));
    const c=s.pos?.coords,next=x.stops[x.target],prev=x.stops[x.current];
    if(c&&next&&prev&&finite(next.lat)&&finite(next.lon)&&finite(prev.lat)&&finite(prev.lon)){
      const p={lat:Number(c.latitude),lon:Number(c.longitude)};
      if(finite(p.lat)&&finite(p.lon)){
        const da=meters(p,{lat:prev.lat,lon:prev.lon}),db=meters(p,{lat:next.lat,lon:next.lon});
        if(da+db>0)return clamp(0,1,da/(da+db));
      }
    }
    return 0;
  }
  function html(){
    const wrap=byId('driver')?.querySelector('.navmap-wrap');
    if(!wrap||byId('v185ViewSwitch'))return;
    const style=document.createElement('style');style.id='v185LineStyle';
    style.textContent=
      '#v185ViewSwitch{display:flex;gap:8px;margin-top:10px}'+
      '#v185ViewSwitch button{flex:1;min-height:51px;font-size:1rem;font-weight:900;background:#102c39;border:1px solid #426073;color:#dcecf5;border-radius:13px}'+
      '#v185ViewSwitch button[aria-pressed="true"]{background:#ffe071;color:#17232b;border-color:#ffe071}'+
      '#v185Line{margin-top:10px;border-radius:17px;border:1px solid #466372;background:#081a27;color:#eef8fd;overflow:hidden}'+
      '#v185LineHeader{padding:16px;background:#0d3042;display:flex;justify-content:space-between;gap:12px;align-items:center}'+
      '#v185LineHeader strong{display:block;font-size:1.4rem;line-height:1.2}'+
      '#v185LineHeader small{font-size:.78rem;color:#c4e0eb}'+
      '#v185LineClock{white-space:nowrap;font-size:1.1rem;font-weight:900}'+
      '#v185LineDelay{padding:8px 16px;font-size:.92rem;font-weight:900;border-bottom:1px solid #355163}'+
      '#v185LineRequest{background:#74351b;color:#fff3dc;padding:10px 16px;font-weight:950}'+
      '#v185LineList{list-style:none;margin:0;padding:8px 14px 18px 40px;max-height:54vh;min-height:210px;overflow:auto}'+
      '#v185LineList li{position:relative;border-left:4px solid #476a7d;padding:10px 10px 12px 26px;min-height:44px}'+
      '#v185LineList li::before{content:"";position:absolute;left:-11px;top:15px;width:16px;height:16px;border-radius:50%;background:#122633;border:3px solid #7facc3}'+
      '#v185LineList li.done{color:#8ca8b6}#v185LineList li.next{background:#173c2f;border-radius:9px;border-left-color:#6dca9c}'+
      '#v185LineList li.next::before{background:#8bf0b3;border-color:#e2fff0}'+
      '#v185LineList li.end{font-weight:900}#v185LineList li span{display:block;font-size:.7rem;color:#bed5e0}'+
      '#v185LineBus{font-size:.87rem;font-weight:950;padding:7px 9px;border-radius:10px;background:#ffdf70;color:#13252e;margin:4px 0 4px -12px;position:relative}'+
      '#v185LineBus::before{content:"";height:var(--v185-bus-position);width:4px;background:#ffdf70;position:absolute;left:-32px;top:-25px}'+
      '@media(max-width:650px){#v185LineHeader strong{font-size:1.05rem}#v185LineList{max-height:42vh}#v185ViewSwitch button{font-size:.96rem}}';
    document.head.appendChild(style);
    const switcher=document.createElement('div');switcher.id='v185ViewSwitch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Affichage de conduite');
    const mapButton=document.createElement('button');mapButton.type='button';mapButton.id='v185MapBtn';mapButton.textContent='🗺 Carte';
    const lineButton=document.createElement('button');lineButton.type='button';lineButton.id='v185LineBtn';lineButton.textContent='🚏 Ligne';
    switcher.append(mapButton,lineButton);wrap.before(switcher);
    const linePanel=document.createElement('section');linePanel.id='v185Line';linePanel.setAttribute('aria-label','Thermomètre de ligne');
    linePanel.innerHTML='<header id="v185LineHeader"><div><small id="v185LineNumber">Ligne —</small><strong id="v185LineDirection">—</strong></div><time id="v185LineClock"></time></header><div id="v185LineDelay">En attente de GPS</div><div id="v185LineRequest" hidden>🔔 ARRÊT DEMANDÉ</div><ol id="v185LineList"></ol>';
    wrap.after(linePanel);
    mapButton.addEventListener('click',()=>setView('map'));lineButton.addEventListener('click',()=>setView('line'));
    ui={wrap,linePanel,mapButton,lineButton};
    applyView();
  }
  function applyView(){
    if(!ui)return;
    ui.wrap.style.display=view==='map'?'':'none';
    ui.linePanel.style.display=view==='line'?'':'none';
    ui.mapButton.setAttribute('aria-pressed',String(view==='map'));
    ui.lineButton.setAttribute('aria-pressed',String(view==='line'));
    if(view==='map')setTimeout(()=>{
      try{state?.nav?.map?.invalidateSize?.()}catch{}
      try{window.__fluoV16?.map3d?.resize?.()}catch{}
    },90);
  }
  function setView(next){
    if(next!=='map'&&next!=='line')return;
    view=next;
    try{localStorage.setItem(KEY,view)}catch{}
    applyView();
    render();
  }
  function render(){
    if(!ui)html();
    if(!ui||view!=='line')return;
    const x=snapshot(),list=byId('v185LineList');
    if(!x){if(list)list.textContent='En attente de la course';return}
    byId('v185LineNumber').textContent='LIGNE '+x.line;
    byId('v185LineDirection').textContent=x.destination;
    byId('v185LineClock').textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const delta=Number(x.s.punctuality?.deltaSeconds);
    byId('v185LineDelay').textContent=!Number.isFinite(delta)?'Horaire non disponible':
      delta>60?'RETARD +'+Math.floor(delta/60)+' min '+String(Math.floor(delta%60)).padStart(2,'0')+' s':
      delta< -60?'AVANCE −'+Math.floor(-delta/60)+' min '+String(Math.floor(-delta%60)).padStart(2,'0')+' s':'À L’HEURE';
    const requested=byId('requestAlert');
    const hasRequest=!!(requested&&!requested.classList.contains('hidden')) ||
      !!x.s.service?.requestedStops?.has?.(x.target);
    byId('v185LineRequest').hidden=!hasRequest;
    const scroll=list.scrollTop,items=document.createDocumentFragment();
    const start=Math.max(0,x.current-1),fraction=progress(x);
    for(let i=start;i<x.stops.length;i++){
      const li=document.createElement('li'),name=document.createElement('strong'),caption=document.createElement('span');
      li.className=i<x.current?'done':i===x.target?'next':i===x.last?'end':'';
      name.textContent=String(x.stops[i]?.name||'Arrêt '+(i+1));
      caption.textContent=i===x.current?'Arrêt précédent / dernier desservi':i===x.target?'PROCHAIN ARRÊT':i===x.last?'TERMINUS':'';
      li.append(name,caption);
      if(i===x.target&&x.target>x.current){
        const bus=document.createElement('div');bus.id='v185LineBus';
        bus.textContent='🚌 Véhicule · '+Math.round(fraction*100)+' % vers cet arrêt';
        bus.style.setProperty('--v185-bus-position',Math.round(fraction*28)+'px');
        li.prepend(bus);
      }else if(i===x.current&&x.target===x.current){
        const bus=document.createElement('div');bus.id='v185LineBus';bus.textContent='🚌 Position véhicule';li.prepend(bus);
      }
      items.append(li);
    }
    list.replaceChildren(items);list.scrollTop=scroll;
  }
  function boot(){html();setInterval(render,1000);window.addEventListener('pageshow',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()})}
  window.MonSAEIVLineViewV185={installed:true,version:'1.0.91',setView,get view(){return view},snapshot,progress,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();