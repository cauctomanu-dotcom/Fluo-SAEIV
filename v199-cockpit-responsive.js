'use strict';
/* SAEIV 1.0.105: compact landscape cockpit; no clipped audio/voice actions or hidden bottom buttons.
   Keep the underlying map, route tracking and line thermometer mounted. */
(()=>{
 if(window.MonSAEIVCockpitResponsiveV199?.installed)return;
 const id='v199ResponsiveCockpitStyle';
 function install(){
  if(document.getElementById(id))return;
  const style=document.createElement('style');style.id=id;
  style.textContent=`
   @media (orientation:landscape) and (max-height:650px) and (max-width:1100px){
     html,body{overflow-x:hidden!important}
     body{overflow-y:auto!important}
     #driver{min-width:0!important;max-width:100vw!important;overflow:hidden!important}
     #driver>#v31LandscapeBottom{
       box-sizing:border-box!important;display:flex!important;flex-wrap:nowrap!important;grid-column:1/3!important;grid-row:2!important;
       width:100%!important;min-width:0!important;max-width:100%!important;
       overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain!important;
       touch-action:pan-x!important;-webkit-overflow-scrolling:touch!important;
       gap:5px!important;padding:4px!important;scrollbar-width:thin!important
     }
     #driver>#v31LandscapeBottom button{
       box-sizing:border-box!important;flex:0 0 clamp(84px,12vw,138px)!important;min-width:84px!important;max-width:none!important;
       width:auto!important;min-height:42px!important;padding:5px 7px!important;
       white-space:normal!important;overflow-wrap:anywhere!important;
       font-size:clamp(.64rem,1.4vw,.78rem)!important;line-height:1.14!important
     }
     #driver #v15LandscapeSide{
       box-sizing:border-box!important;min-height:0!important;max-height:100%!important;
       overflow-y:auto!important;overflow-x:hidden!important;
       overscroll-behavior-y:contain;scrollbar-width:thin!important;-webkit-overflow-scrolling:touch
     }
     #v15LandscapeSide #v185LandscapeSwitch{flex:0 0 auto!important;order:0!important}
     #v15LandscapeSide #v131AudioActivate{
       display:block!important;flex:0 0 auto!important;order:0!important;
       font-size:.67rem!important;min-height:34px!important;margin:3px 0!important
     }
     #v15LandscapeSide .v15-next-box{flex:0 0 auto!important}
     #v15LandscapeSide #v315VoiceControls{flex:0 0 auto!important}
     #v15LandscapeSide #v281LandscapeDock{flex:0 0 auto!important}
     #driver.v185-view-line #v185Line{min-height:0!important;overflow:hidden!important}
   }
   @media (orientation:landscape) and (max-height:650px) and (max-width:800px){
     #driver>#v31LandscapeBottom{gap:4px!important}
     #driver>#v31LandscapeBottom button{min-height:42px!important;padding:5px 6px!important;font-size:.65rem!important}
     #driver #v15LandscapeSide{gap:3px!important;padding:3px!important}
     #v15LandscapeSide #v131AudioActivate{min-height:30px!important;font-size:.58rem!important}
   }
   @media (orientation:landscape) and (max-height:650px) and (max-width:1000px){
     #driver>#v31LandscapeBottom{gap:4px!important}
     #driver>#v31LandscapeBottom button{min-height:42px!important;padding:5px 6px!important;font-size:clamp(.65rem,1.3vw,.78rem)!important}
   }
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
 }
 window.MonSAEIVCockpitResponsiveV199={installed:true,install};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();