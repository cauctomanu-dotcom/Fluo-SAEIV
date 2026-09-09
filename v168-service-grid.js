'use strict';
/* Mon SAEIV 1.0.70 — bornes de service + continuité physique des HLP dans la grille Exploitation. */
(()=>{
  if(window.MonSAEIVServiceGridV168?.installed)return;
  const VERSION='1.0.70';
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const validPoint=p=>!!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const pointName=(p,fallback='')=>String(p?.name||fallback||'').replace(/\s+/g,' ').trim();
  const metres=(a,b)=>{
    if(!validPoint(a)||!validPoint(b))return null;
    const R=6371000,r=x=>x*Math.PI/180,dLat=r(Number(b.lat)-Number(a.lat)),dLon=r(Number(b.lon)-Number(a.lon));
    const q=Math.sin(dLat/2)**2+Math.cos(r(Number(a.lat)))*Math.cos(r(Number(b.lat)))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(q));
  };
  function installStyle(){
    if(document.getElementById('v168Style'))return;
    const s=document.createElement('style');s.id='v168Style';s.textContent=`
      .v165-block.service-start{border-color:#4c9b68!important;background:#143923!important;color:#d9ffe5!important;font-weight:900}
      .v165-block.service-end{border-color:#8c61bc!important;background:#35204d!important;color:#f0ddff!important;font-weight:900}
      .v165-block.hlp.chain-ok{box-shadow:inset 0 0 0 1px rgba(255,233,161,.22)}
      .v165-block.hlp.chain-bad{border-color:#df5c60!important;background:#5a2024!important;color:#ffd7d4!important;box-shadow:0 0 0 2px rgba(223,92,96,.18)}
      .v168-chain-note{margin-top:5px;color:#8fa6b1;font-size:.52rem;line-height:1.35}
      .v168-chain-note.bad{color:#ffaaa5;font-weight:800}
    `;document.head.appendChild(s);
  }
  function itemsFor(driverId){
    const b=board();if(!b)return[];
    return (b.items||[]).filter(x=>String(x.driver_user_id)===String(driverId)&&x.start_time&&x.end_time);
  }
  function decorateServiceBlocks(){
    document.querySelectorAll('.v165-block').forEach(el=>{
      const t=String(el.textContent||'').trim();
      if(t.startsWith('Prise de service')){
        el.classList.add('service-start');el.classList.remove('manual');
        el.textContent='Prise de service · 10 min';
        el.title='Prise de service · 10 minutes avant le premier HLP';
      }else if(t.startsWith('Fin de service')){
        el.classList.add('service-end');el.classList.remove('manual');
        el.textContent='Fin de service · 5 min';
        el.title='Fin de service · 5 minutes après le dernier HLP';
      }
    });
  }
  function decorateLane(lane){
    const driverId=lane?.dataset?.driverLane;if(!driverId)return;
    const items=itemsFor(driverId),blocks=[...lane.querySelectorAll(':scope > .v165-block')];
    let problems=0;
    for(let i=0;i<Math.min(items.length,blocks.length);i++){
      const item=items[i],el=blocks[i];
      const from=pointName(item.origin_coords,item.origin),to=pointName(item.destination_coords,item.destination);
      if(item.source==='auto_hlp'){
        el.classList.add('hlp');
        el.textContent=`HLP · ${from} → ${to}`;
        const prev=i>0?items[i-1]:null;
        const prevPoint=prev?(prev.destination_coords||prev.origin_coords):null;
        const delta=prevPoint&&item.origin_coords?metres(prevPoint,item.origin_coords):null;
        const ok=delta===null||delta<120;
        el.classList.toggle('chain-ok',ok);el.classList.toggle('chain-bad',!ok);
        if(!ok)problems++;
        const previousPlace=prev?pointName(prev.destination_coords,prev.destination):'début de service';
        el.title=ok
          ?`HLP continu : départ = lieu précédent « ${previousPlace} » ; destination = « ${to} ».`
          :`RUPTURE DE CONTINUITÉ : le HLP part de « ${from} » alors que l’activité précédente se termine à « ${previousPlace} ».`;
      }else if(['regular','school','tad'].includes(item.type)){
        el.title=`${item.line||'Course'} · ${from} → ${to} · ${String(item.start_time).slice(0,5)}-${String(item.end_time).slice(0,5)}`;
      }else if(item.source==='auto_cut'){
        el.title=`Coupure sur place · ${from||to} · ${String(item.start_time).slice(0,5)}-${String(item.end_time).slice(0,5)}`;
      }
    }
    const meta=lane.previousElementSibling;
    if(meta){
      let note=meta.querySelector('.v168-chain-note');
      if(!note){note=document.createElement('div');note.className='v168-chain-note';meta.appendChild(note)}
      if(problems){note.className='v168-chain-note bad';note.textContent=`⚠ ${problems} rupture${problems>1?'s':''} de continuité HLP détectée${problems>1?'s':''}.`}
      else{note.className='v168-chain-note';note.textContent='HLP : départ repris du lieu exact précédent.'}
    }
  }
  function decorate(){
    installStyle();decorateServiceBlocks();
    document.querySelectorAll('[data-driver-lane]').forEach(decorateLane);
  }
  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate()})}
  const mo=new MutationObserver(schedule);
  function boot(){installStyle();decorate();mo.observe(document.documentElement,{childList:true,subtree:true})}
  window.MonSAEIVServiceGridV168={installed:true,version:VERSION,decorate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();