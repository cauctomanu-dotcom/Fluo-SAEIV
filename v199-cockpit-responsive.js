'use strict';
/* SAEIV 1.0.103: compact landscape cockpit; no clipped audio/voice actions or hidden bottom buttons.
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
     #driver{min-width:0!important;max-width:100vw!important;overflow:hidden!important}
     #driver>#v31LandscapeBottom{
       box-sizing:border-box!important;display:grid!important;grid-column:1/3!important;grid-row:2!important;
       grid-template-columns:repeat(8,minmax(0,1fr))!important;width:100%!important;
       min-width:0!important;max-width:100%!important;overflow-x:hidden!important;overflow-y:hidden!important;
       gap:4px!important;padding:4px!important;scrollbar-width:none!important
     }
     #driver>#v31LandscapeBottom button{
       box-sizing:border-box!important;flex:none!important;min-width:0!important;max-width:100%!important;
       width:100%!important;min-height:38px!important;padding:5px 3px!important;
       white-space:normal!important;overflow-wrap:anywhere!important;
       font-size:clamp(.5rem,.9vw,.63rem)!important;line-height:1.08!important
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
     #driver>#v31LandscapeBottom{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:3px!important}
     #driver>#v31LandscapeBottom button{min-height:30px!important;padding:4px 3px!important;font-size:.53rem!important}
     #driver #v15LandscapeSide{gap:3px!important;padding:3px!important}
     #v15LandscapeSide #v131AudioActivate{min-height:30px!important;font-size:.58rem!important}
   }
   @media (orientation:portrait){
     #driver #v131AudioActivate{position:static!important;width:100%!important;max-width:100%!important}
   }
  `;
  document.head.appendChild(style);
 }
 window.MonSAEIVCockpitResponsiveV199={installed:true,install};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();