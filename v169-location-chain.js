'use strict';
/* Mon SAEIV 1.0.71 — continuité physique des HLP dans la grille Exploitation.
   Un HLP part toujours du lieu exact où se termine l'activité précédente.
   Sa destination est le départ de l'activité suivante, ou le stationnement bus en fin de service. */
(()=>{
  if(window.MonSAEIVLocationChainV169?.installed)return;
  const VERSION='1.0.71';
  const board=()=>window.MonSAEIVOperationsBoardV165;
  const validPoint=p=>!!p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));
  const pointName=(p,fallback='')=>String(p?.name||fallback||'').trim();
  const short=s=>String(s||'').replace(/\s+/g,' ').trim();
  const metres=(a,b)=>{
    if(!validPoint(a)||!validPoint(b))return null;
    const R=6371000,r=x=>x*Math.PI/180,dLat=r(Number(b.lat)-Number(a.lat)),dLon=r(Number(b.lon)-Number(a.lon));
    const q=Math.sin(dLat/2)**2+Math.cos(r(Number(a.lat)))*Math.cos(r(Number(b.lat)))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(q));
  };
  function addStyle(){
    if(document.getElementById('v169Style'))return;
    const s=document.createElement('style');s.id='v169Style';s.textContent=`
      .v165-block.hlp.chain-ok{box-shadow:inset 0 0 0 1px rgba(255,233,161,.22)}
      .v165-block.hlp.chain-bad{border-color:#df5c60!important;background:#5a2024!important;color:#ffd7d4!important;box-shadow:0 0 0 2px rgba(223,92,96,.18)}
      .v169-chain-note{margin-top:5px;color:#8fa6b1;font-size:.52rem;line-height:1.35}
      .v169-chain-note.bad{color:#ffaaa5;font-weight:800}
    `;document.head.appendChild(s);
  }
  function orderedItems(driverId){
    const b=board();if(!b)return[];
    return (b.items||[]).filter(x=>String(x.driver_user_id)===String(driverId)&&x.start_time&&x.end_time);
  }
  function decorateLane(lane){
    const driverId=lane?.dataset?.driverLane;if(!driverId)return;
    const items=orderedItems(driverId),blocks=[...lane.querySelectorAll(':scope > .v165-block')];
    let problems=0;
    for(let i=0;i<Math.min(items.length,blocks.length);i++){
      const item=items[i],el=blocks[i];
      const o=pointName(item.origin_coords,item.origin),d=pointName(item.destination_coords,item.destination);
      if(item.source==='auto_hlp'){
        el.classList.add('hlp');
        el.textContent=`HLP · ${short(o)} → ${short(d)}`;
        const prev=i>0?items[i-1]:null,prevEnd=prev?(prev.destination_coords||prev.origin_coords):null;
        const delta=prevEnd&&item.origin_coords?metres(prevEnd,item.origin_coords):null;
        const ok=delta===null||delta<120;
        el.classList.toggle('chain-ok',ok);el.classList.toggle('chain-bad',!ok);
        if(!ok)problems++;
        const prevLabel=prev?`${prev.line||prev.label||prev.type||'activité'} · ${pointName(prev.destination_coords,prev.destination)}`:'début de service';
        el.title=ok
          ?`HLP continu : départ repris du lieu exact précédent (${prevLabel}) → ${d}.`
          :`ATTENTION : le départ de ce HLP ne correspond pas au lieu de fin de l'activité précédente (${prevLabel}).`;
      }else if(['regular','school','tad'].includes(item.type)){
        el.title=`${item.line||'Course'} · ${o} → ${d} · ${String(item.start_time).slice(0,5)}-${String(item.end_time).slice(0,5)}`;
      }else if(item.source==='auto_cut'){
        el.title=`Coupure sur place · ${o||d} · ${String(item.start_time).slice(0,5)}-${String(item.end_time).slice(0,5)}`;
      }
    }
    const meta=lane.previousElementSibling;
    if(meta){
      let note=meta.querySelector('.v169-chain-note');if(!note){note=document.createElement('div');note.className='v169-chain-note';meta.appendChild(note)}
      if(problems){note.className='v169-chain-note bad';note.textContent=`⚠ ${problems} rupture${problems>1?'s':''} de continuité HLP détectée${problems>1?'s':''}.`}
      else{note.className='v169-chain-note';note.textContent='HLP : continuité des lieux vérifiée.'}
    }
  }
  function decorate(){addStyle();document.querySelectorAll('[data-driver-lane]').forEach(decorateLane)}
  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate()})}
  function boot(){addStyle();decorate();const mo=new MutationObserver(schedule);mo.observe(document.documentElement,{childList:true,subtree:true})}
  window.MonSAEIVLocationChainV169={installed:true,version:VERSION,decorate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();