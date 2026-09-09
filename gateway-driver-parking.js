'use strict';
/* Mon SAEIV 1.0.66 — stationnement bus demandé à la création/liaison conducteur. */
(()=>{
  if(window.MonSAEIVGatewayParkingV166?.installed)return;
  const LOCAL_KEY='fluo-saeiv-bus-parking-v164';
  const SAVED='fluo-saeiv-saved-addresses-v318';
  const q=id=>document.getElementById(id);
  function current(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch{return null}}
  function candidateFromSaved(){try{const xs=JSON.parse(localStorage.getItem(SAVED)||'[]');return Array.isArray(xs)?xs.find(x=>String(x?.id)==='bus-parking-v164'||String(x?.label||'').toLowerCase()==='stationnement bus'):null}catch{return null}}
  function prefill(){const input=q('driverBusParking');if(!input||input.value)return;const p=current()||candidateFromSaved();if(p?.address)input.value=p.address}
  function bind(){
    prefill();
    q('driverRegisterForm')?.addEventListener('submit',()=>{
      const input=q('driverBusParking'),address=String(input?.value||'').trim();if(!address)return;
      try{localStorage.setItem(LOCAL_KEY,JSON.stringify({label:'Stationnement bus',address,pending:true,updatedAt:new Date().toISOString()}))}catch{}
    },true);
    q('showDriverRegister')?.addEventListener('click',()=>setTimeout(prefill,0));
    q('linkLocal')?.addEventListener('click',()=>setTimeout(prefill,0));
  }
  window.MonSAEIVGatewayParkingV166={installed:true,prefill};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();