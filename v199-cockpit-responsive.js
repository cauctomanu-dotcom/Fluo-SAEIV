'use strict';
/* SAEIV 1.0.118: map-first readable driving cockpit on smartphone in landscape.
   Keep the underlying map, route tracking and line thermometer mounted. */
(()=>{
 if(window.MonSAEIVCockpitResponsiveV199?.installed)return;
 const id='v199ResponsiveCockpitStyle';
 function install(){
  if(document.getElementById(id))return;
  const style=document.createElement('style');style.id=id;
  style.textContent=`
   @media (orientation:landscape) and (max-height:650px) and (max-width:1100px){
     html.v130-driving,html.v130-driving body{overflow:hidden!important}
     html.v130-driving .app{height:100dvh!important;overflow:hidden!important;box-sizing:border-box!important}
     #driver:not(.hidden){box-sizing:border-box!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;
       height:calc(100dvh - max(6px,env(safe-area-inset-top)) - max(6px,env(safe-area-inset-bottom)))!important;
       grid-template-columns:minmax(0,1fr) clamp(208px,30vw,304px)!important;
       grid-template-rows:minmax(0,1fr) 52px!important;gap:5px!important;padding:3px!important}
     #driver:not(.hidden)>.navmap-wrap{grid-column:1!important;grid-row:1!important;width:100%!important;
       min-width:0!important;min-height:0!important;height:100%!important;overflow:hidden!important}
     #driver:not(.hidden) .navmap,#driver:not(.hidden) .v16-map3d{height:100%!important;min-height:0!important;width:100%!important}
     #driver>#v31LandscapeBottom{
       box-sizing:border-box!important;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;align-items:center!important;
       grid-column:1/3!important;grid-row:2!important;
       width:100%!important;min-width:0!important;max-width:100%!important;height:52px!important;
       overflow-x:hidden!important;overflow-y:hidden!important;
       gap:7px!important;padding:4px 6px!important
     }
     #driver>#v31LandscapeBottom button{
       box-sizing:border-box!important;flex:none!important;min-width:0!important;max-width:100%!important;
       width:100%!important;min-height:42px!important;height:42px!important;padding:7px 9px!important;
       white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
       font-size:clamp(12px,1.55vw,15px)!important;line-height:1.16!important
     }
     #driver #v15LandscapeSide{
       box-sizing:border-box!important;min-height:0!important;max-height:100%!important;
       overflow-y:auto!important;overflow-x:hidden!important;padding:7px!important;gap:7px!important;
       overscroll-behavior-y:contain;scrollbar-width:thin!important;-webkit-overflow-scrolling:touch
     }
     #v15LandscapeSide #v185LandscapeSwitch{flex:0 0 auto!important;order:0!important}
     #v15LandscapeSide #v131AudioActivate{
       display:block!important;flex:0 0 auto!important;order:0!important;
       font-size:13px!important;min-height:40px!important;margin:3px 0!important
     }
     #v15LandscapeSide .v15-next-box{flex:0 0 auto!important}
     #v15LandscapeSide #v315VoiceControls{flex:0 0 auto!important}
     #v15LandscapeSide #v281LandscapeDock{flex:0 0 auto!important}
     #driver:not(.hidden) #v314TopInfo .v15-punctuality span{font-size:11px!important;letter-spacing:0!important}
     #driver:not(.hidden) #v314TopInfo .v15-punctuality strong{font-size:20px!important}
     #driver:not(.hidden) #v314TopInfo #v15Line{font-size:22px!important}
     #driver:not(.hidden) #v314TopInfo .v314-line-destination{font-size:12px!important;line-height:1.17!important;overflow-wrap:anywhere!important}
     #driver:not(.hidden) #v15LandscapeSide .v15-next-box{padding:9px!important}
     #driver:not(.hidden) #v15LandscapeSide .v15-next-box>span:first-child{font-size:11px!important;letter-spacing:.045em!important}
     #driver:not(.hidden) #v15LandscapeSide strong#v15NextStop{font-size:clamp(16px,2.2vw,21px)!important;line-height:1.2!important;
       max-height:none!important;overflow:visible!important;white-space:normal!important;overflow-wrap:break-word!important}
     #driver:not(.hidden) #v15LandscapeSide b#v15NextDistance{font-size:clamp(18px,2.4vw,25px)!important;line-height:1.15!important}
     #driver:not(.hidden) #v15LandscapeSide .v29-side-eta{font-size:12px!important}
     #driver:not(.hidden) #v15LandscapeSide #v185LandscapeSwitch button{min-height:41px!important;font-size:13px!important}
     #driver:not(.hidden) #v15LandscapeSide #v315VoiceControls button{min-height:39px!important;font-size:12px!important}
     #driver:not(.hidden) #v15LandscapeSide #v31SideExtra button{min-height:38px!important;font-size:12px!important}
     #driver:not(.hidden) #v15MapGuidance{max-width:min(70%,420px)!important;min-width:0!important}
     #driver:not(.hidden) #v15MapGuidance .v15-turn-copy strong{font-size:13px!important}
     #driver:not(.hidden) #v15MapGuidance .v15-turn-copy span{font-size:16px!important}
     #driver:not(.hidden) .maphud #followMap{min-height:35px!important;font-size:12px!important}
     #driver:not(.hidden) .maphud #routeState{min-height:35px!important;max-width:58%!important;
       font-size:12px!important;white-space:normal!important;overflow-wrap:anywhere!important}
     #driver.v185-view-line #v185Line{min-height:0!important;overflow:hidden!important}
   }
   @media (orientation:landscape) and (max-height:650px) and (max-width:800px){
     #driver:not(.hidden){grid-template-columns:minmax(0,1fr) clamp(190px,32vw,236px)!important}
     #driver>#v31LandscapeBottom{gap:6px!important}
     #driver>#v31LandscapeBottom button{min-height:40px!important;font-size:12px!important}
     #driver #v15LandscapeSide{gap:5px!important;padding:5px!important}
   }
   @media (orientation:landscape) and (max-height:650px) and (max-width:1000px){
     #driver>#v31LandscapeBottom{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;overflow:hidden!important;gap:4px!important}
     #driver>#v31LandscapeBottom button{font-size:clamp(12px,1.55vw,15px)!important}
   }
   #v199ActionsSheet{position:fixed;inset:0;z-index:2147483420;display:grid;place-items:center;
     padding:12px;background:#102c3eb8;font:400 15px/1.4 system-ui}
   #v199ActionsSheet[hidden]{display:none!important}
   #v199ActionsSheet .v199-sheet{width:min(420px,100%);max-height:90dvh;overflow:auto;box-sizing:border-box;
     background:#fff;color:#244458;padding:17px;border-radius:14px;box-shadow:0 16px 50px #04162577}
   #v199ActionsSheet h2{font-size:20px;margin:0 0 7px}
   #v199ActionsSheet p{font-size:14px;margin:0 0 13px}
   #v199MoreActions{display:grid;gap:9px}
   #v199ActionsSheet button{width:100%;min-height:47px;padding:10px 13px;font:700 15px system-ui;
     border-radius:9px;border:1px solid #c5d5df;background:#edf3f6;color:#24455a}
   #v199MoreClose{margin-top:12px}
   @media (orientation:portrait) and (max-width:800px){
     html,body{overflow-x:hidden!important;width:100%!important;max-width:100%!important}
     .app{width:100%!important;min-width:0!important;max-width:100%!important;
       padding-left:max(8px,env(safe-area-inset-left))!important;
       padding-right:max(8px,env(safe-area-inset-right))!important}
     #setup.panel,#driver.panel{width:100%!important;max-width:100%!important;min-width:0!important}
     #setup .grid,#setup .grid.two,#setup .grid.three,#setup .sim-config{
       grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))!important}
     #setup input,#setup select,#setup button,#driver input,#driver select,#driver button{
       max-width:100%!important;min-width:0!important}
     #setup #voiceTest{min-height:46px!important;width:100%!important;white-space:normal!important}
     #driver .controls,#driver .sim-controls{
       display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
     #driver .controls button,#driver .sim-controls button{
       min-width:0!important;white-space:normal!important;overflow-wrap:anywhere!important;
       min-height:43px!important;font-size:clamp(.71rem,2.8vw,.88rem)!important}
     #driver .navmap-wrap{width:100%!important;max-width:100%!important;min-height:220px!important;height:clamp(240px,42dvh,450px)!important}
     #driver .v15-landscape-side{max-width:100%!important;min-width:0!important}
     #driver #v131AudioActivate{position:static!important;width:100%!important;max-width:100%!important;grid-column:1/-1}
   }
   @media (orientation:portrait) and (max-width:390px){
     #driver .controls,#driver .sim-controls{gap:5px!important}
     #driver .controls button,#driver .sim-controls button{font-size:.7rem!important;padding:8px 5px!important}
     #setup .service-choice-buttons{grid-template-columns:1fr!important}
   }
   @media (orientation:portrait) and (min-width:801px) and (max-width:1200px){
     .app{width:100%!important;max-width:100%!important}
     #setup .grid.three{grid-template-columns:repeat(2,minmax(0,1fr))!important}
   }
  `;
  document.head.appendChild(style);
  function compact(tries=0){
    const bar=document.getElementById('v31LandscapeBottom');
    if(!bar){if(tries<16)setTimeout(()=>compact(tries+1),450);return}
    if(bar.dataset.v199Compact==='yes')return;
    const finish=bar.querySelector('.v315-finish');
    const extra=['v315-deviation','v315-incident','v315-recenter'].map(x=>bar.querySelector('.'+x));
    if(!finish||extra.some(x=>!x)){if(tries<16)setTimeout(()=>compact(tries+1),450);return}
    const sheet=document.createElement('div');sheet.id='v199ActionsSheet';sheet.hidden=true;
    sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label','Options du conducteur');
    sheet.innerHTML='<div class="v199-sheet"><h2>Autres commandes</h2><p>Utiliser uniquement à l’arrêt.</p><div id="v199MoreActions"></div><button type="button" id="v199MoreClose">Fermer</button></div>';
    document.body.appendChild(sheet);
    const host=document.getElementById('v199MoreActions');extra.forEach(x=>host.appendChild(x));
    const more=document.createElement('button');more.id='v199DriverMore';more.type='button';
    more.textContent='⋯ Options';more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-expanded','false');
    bar.insertBefore(more,finish);
    const close=()=>{sheet.hidden=true;more.setAttribute('aria-expanded','false');more.focus({preventScroll:true})};
    more.addEventListener('click',()=>{sheet.hidden=false;more.setAttribute('aria-expanded','true');document.getElementById('v199MoreClose').focus()});
    document.getElementById('v199MoreClose').addEventListener('click',close);
    sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.closest?.('#v199MoreActions button'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden)close()});
    window.addEventListener('orientationchange',()=>{if(!sheet.hidden)close()});
    bar.dataset.v199Compact='yes';
  }
  compact();
  const syncMap=()=>{
    const driver=document.getElementById('driver');
    if(!driver||driver.classList.contains('hidden'))return;
    setTimeout(()=>{
      try{if(typeof state!=='undefined')state?.nav?.map?.invalidateSize?.()}catch{}
      try{window.__fluoV16?.map3d?.resize?.()}catch{}
    },160);
  };
  window.addEventListener('orientationchange',syncMap);
  window.addEventListener('resize',syncMap,{passive:true});
 }
 window.MonSAEIVCockpitResponsiveV199={installed:true,version:'1.0.119',install};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();