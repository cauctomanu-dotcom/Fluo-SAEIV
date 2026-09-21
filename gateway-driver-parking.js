'use strict';
/* Mon SAEIV 1.0.66 — stationnement bus + secours local si le cloud ne répond plus. */
(()=>{
  if(window.MonSAEIVGatewayParkingV166?.installed)return;
  const LOCAL_KEY='fluo-saeiv-bus-parking-v164';
  const SAVED='fluo-saeiv-saved-addresses-v318';
  const LOCAL_ACCOUNT_KEY='fluoSaeivAccountV13';
  const ENTRY_MODE_KEY='mon-saeiv-cloud-entry-v156';
  const q=id=>document.getElementById(id);
  function current(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch{return null}}
  function localAccount(){try{return JSON.parse(localStorage.getItem(LOCAL_ACCOUNT_KEY)||'null')}catch{return null}}
  function candidateFromSaved(){try{const xs=JSON.parse(localStorage.getItem(SAVED)||'[]');return Array.isArray(xs)?xs.find(x=>String(x?.id)==='bus-parking-v164'||String(x?.label||'').toLowerCase()==='stationnement bus'):null}catch{return null}}
  function prefill(){const input=q('driverBusParking');if(!input||input.value)return;const p=current()||candidateFromSaved();if(p?.address)input.value=p.address}
  function forceLocalIfCloudStuck(){
    const form=q('driverLoginForm');if(!form||form.dataset.timeoutFallback==='1')return;
    form.dataset.timeoutFallback='1';
    form.addEventListener('submit',()=>{
      const entered=String(q('driverMatricule')?.value||'').trim().toUpperCase();
      const local=localAccount();
      const localMatricule=String(local?.matricule||'').trim().toUpperCase();
      if(!local?.matricule||!entered||entered!==localMatricule)return;
      setTimeout(()=>{
        const status=String(q('gatewayStatus')?.textContent||'').trim();
        if(!/^Connexion conducteur/i.test(status))return;
        try{localStorage.setItem(ENTRY_MODE_KEY,'local')}catch{}
        if(q('gatewayStatus')){q('gatewayStatus').textContent='Serveur indisponible. Ouverture du profil local…';q('gatewayStatus').className='status busy'}
        setTimeout(()=>location.replace(`./app.html?entry=local&fallback=timeout&t=${Date.now()}`),200);
      },7000);
    },true);
  }
  function bind(){
    prefill();forceLocalIfCloudStuck();
    q('driverRegisterForm')?.addEventListener('submit',()=>{
      const input=q('driverBusParking'),address=String(input?.value||'').trim();if(!address)return;
      try{localStorage.setItem(LOCAL_KEY,JSON.stringify({label:'Stationnement bus',address,pending:true,updatedAt:new Date().toISOString()}))}catch{}
    },true);
    q('showDriverRegister')?.addEventListener('click',()=>setTimeout(prefill,0));
    q('linkLocal')?.addEventListener('click',()=>setTimeout(prefill,0));
  }
  window.MonSAEIVGatewayParkingV166={installed:true,prefill,forceLocalIfCloudStuck};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();