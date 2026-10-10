'use strict';
/* Unified dispatch workspace for every company. One planner and shared UI;
   organization_id is the only company boundary. */
(()=>{
 if(window.MonSAEIVAntoniPilotV202?.installed)return;
 const q=id=>document.getElementById(id);
 const cloud=()=>window.MonSAEIVCloudV156;
 const isDispatcher=()=>['dispatcher','admin'].includes(String(cloud()?.profile?.role||''));
 const rules=[
 'body.saeiv-shared-ops #v165Board{--sa-bg:#f5f7f9;--sa-card:#fff;--sa-border:#d9e2e8;--sa-ink:#263b4a;--sa-muted:#536c7c;--sa-accent:#356a87;font:400 15px/1.55 system-ui,-apple-system,sans-serif;background:var(--sa-bg);color:var(--sa-ink);border-radius:14px;padding:clamp(10px,1.6vw,20px);max-width:100%}',
 'body.saeiv-shared-ops #v165Board .v165-toolbar,body.saeiv-shared-ops #v165Board .v165-toolbox,body.saeiv-shared-ops #v165Board .v165-advice,body.saeiv-shared-ops #v165Board .v165-grid-wrap,body.saeiv-shared-ops #v165Board .v165-metric,body.saeiv-shared-ops #v165Board #v198Controls{background:#fff;color:var(--sa-ink);border:1px solid var(--sa-border);border-radius:12px;box-shadow:none}',
 'body.saeiv-shared-ops #v165Board .v165-toolbar{display:flex;align-items:end;gap:10px;position:relative;z-index:12;padding:15px;overflow:visible}',
 'body.saeiv-shared-ops #v165Board .v165-toolbar label{font-size:14px;font-weight:700;color:var(--sa-ink);display:flex;flex-direction:column;gap:5px}',
 'body.saeiv-shared-ops #v165Board #v165Date,body.saeiv-shared-ops #v165Board #v190End{display:block!important;pointer-events:auto!important;position:relative!important;z-index:13;box-sizing:border-box;appearance:auto;-webkit-appearance:auto;width:170px;max-width:100%;min-height:46px;padding:8px;background:white;color:#243f50;border:1px solid #a8bfcc;border-radius:9px;font:600 16px system-ui;color-scheme:light;cursor:pointer}',
 'body.saeiv-shared-ops #v165Board button{font:650 14px/1.35 system-ui;min-height:42px;padding:9px 12px;border-radius:9px;white-space:normal}',
 'body.saeiv-shared-ops #v165Board .v165-toolbar button{color:#294e64;background:#edf2f5;border:1px solid #cad9e2}',
 'body.saeiv-shared-ops #v165Board #v165Generate{background:#356a87;color:white;border:1px solid #356a87}',
 'body.saeiv-shared-ops #v165Board #v165BulkRemove{background:#f8eceb;color:#903b39;border:1px solid #dec5c3}',
 'body.saeiv-shared-ops #v165Board .v165-depts label{display:inline-flex;flex-direction:row;gap:7px;background:#f2f6f8;color:#3c5464;border:1px solid var(--sa-border);padding:8px 10px;font-size:13px}',
 'body.saeiv-shared-ops #v165Board .v165-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}body.saeiv-shared-ops #v165Board .v165-metric{padding:13px}body.saeiv-shared-ops #v165Board .v165-metric b{font-size:23px;color:#284458}body.saeiv-shared-ops #v165Board .v165-metric span{font-size:13px;color:#536b7b}',
 'body.saeiv-shared-ops #v165Board .v165-alert{background:#f0f5f7;color:#446170;border:1px solid #d4e1e8;font-size:13px;font-weight:500}',
 'body.saeiv-shared-ops #v165Board .v165-work{display:grid;grid-template-columns:minmax(280px,320px) minmax(0,1fr);gap:12px;align-items:start;min-width:0}',
 'body.saeiv-shared-ops #v165Board .v165-toolbox{position:sticky;top:10px;max-height:74vh;overflow:auto;padding:13px}body.saeiv-shared-ops #v165Board .v165-toolbox-head{background:white;color:#274353;border-color:#dce5ea}',
 'body.saeiv-shared-ops #v165Board .v165-toolbox h3,body.saeiv-shared-ops #v165Board .v165-advice h3{font-size:17px;color:#263d4c}',
 'body.saeiv-shared-ops #v165Board .v165-toolbox input,body.saeiv-shared-ops #v165Board .v165-toolbox select{min-width:0;background:white;color:#294151;border:1px solid #bdd0da;min-height:42px;font-size:14px;border-radius:8px}',
 'body.saeiv-shared-ops #v165Board .v165-seg{padding:12px;background:#f8fafb;color:#263d4b;border-color:#d8e3e8;border-radius:9px}body.saeiv-shared-ops #v165Board .v165-seg.assigned{background:#eff6f2;border-color:#c3dbce}body.saeiv-shared-ops #v165Board .v165-seg.selected{outline:2px solid #5b819a}',
 'body.saeiv-shared-ops #v165Board .v165-seg b{font-size:15px;color:#263d4b}body.saeiv-shared-ops #v165Board .v165-seg span{font-size:13px;color:#435d6b}body.saeiv-shared-ops #v165Board .v165-seg small{font-size:12px;color:#627787;line-height:1.5}',
 'body.saeiv-shared-ops #v165Board .v165-auto-note{background:#f0f4f6;color:#526a78;border-color:#d7e2e8;font-size:13px;line-height:1.5}body.saeiv-shared-ops #v165Board .v165-advice-list{font-size:13px;line-height:1.6;color:#506878}',
 'body.saeiv-shared-ops #v165Board .v165-grid-wrap{position:relative;max-height:74vh;overflow:auto}',
 'body.saeiv-shared-ops #v165Board .v165-timehead,body.saeiv-shared-ops #v165Board .v165-driver-row{grid-template-columns:210px minmax(1440px,1fr)}',
 'body.saeiv-shared-ops #v165Board .v165-timehead{background:#eaf1f5;color:#294558;z-index:7}body.saeiv-shared-ops #v165Board .v165-time-label{position:sticky;left:0;z-index:8;background:#eaf1f5;font-size:13px}body.saeiv-shared-ops #v165Board .v165-hour{font-size:12px;color:#536f7f;border-color:#c7d5de}',
 'body.saeiv-shared-ops #v165Board .v165-driver-row{background:#fff;min-height:100px;border-color:#e2e9ed}body.saeiv-shared-ops #v165Board .v165-driver-meta{position:sticky;left:0;z-index:4;background:#fff;padding:10px;min-height:100px;border-color:#dce5ea}',
 'body.saeiv-shared-ops #v165Board .v198-driver-name{font-size:15px;font-weight:800;color:#275977;text-align:left;text-decoration:none}body.saeiv-shared-ops #v165Board .v165-driver-meta span,body.saeiv-shared-ops #v165Board .v165-driver-meta small{font-size:12px;color:#566e7c;line-height:1.4}',
 'body.saeiv-shared-ops #v165Board .v165-lane{min-height:100px;background:repeating-linear-gradient(90deg,#fff 0,#fff 79px,#edf2f5 80px)}',
 'body.saeiv-shared-ops #v165Board .v165-block{height:32px;min-width:12px;font-size:12px;font-weight:700;color:#244255;background:#dcebf2;border:1px solid #a7c1d1;border-radius:6px;padding:7px;white-space:nowrap;overflow:hidden;text-overflow:clip}body.saeiv-shared-ops #v165Board .v165-block:nth-child(even){top:49px}',
 'body.saeiv-shared-ops #v165Board .v165-block.hlp{background:#e8edef;color:#334b57;border-color:#aebdc6}body.saeiv-shared-ops #v165Board .v165-block.cut,body.saeiv-shared-ops #v165Board .v165-block.pause{background:#f0ede4;color:#594f38;border-color:#c8c0a8}body.saeiv-shared-ops #v165Board .v165-block.draft{background:#d8e9f2;color:#244356;border-color:#9bbdcc}body.saeiv-shared-ops #v165Board .v165-block.start,body.saeiv-shared-ops #v165Board .v165-block.end{background:#e3efe8;color:#30624e;border-color:#a8cbbc}',
 'body.saeiv-shared-ops #v165Board .v194DriverActions{display:flex;flex-wrap:wrap;gap:5px}body.saeiv-shared-ops #v165Board .v194DriverActions button{min-height:34px;font-size:12px;padding:6px 8px;background:#f0f4f6;color:#315269;border:1px solid #d2e0e7}',
 'body.saeiv-shared-ops #v165Board #v198Controls{padding:15px}body.saeiv-shared-ops #v165Board #v198Controls small{color:#56707e;font-size:13px}body.saeiv-shared-ops #v165Board #v198DayDetail{background:white;color:#29495d;border-color:#d5e1e8}',
 'body.saeiv-shared-ops #v165Board #v198DayActivities .v198-detail-time,body.saeiv-shared-ops #v165Board #v198DayDetail h3{color:#254d65}body.saeiv-shared-ops #v165Board #v198DayActivities .v198-detail-item{font-size:14px;color:#2c4453}body.saeiv-shared-ops #v165Board #v198DayActivities .v198-detail-content small{font-size:12px;color:#5b7382}',
 '#saeivWorkHeader{margin:0 0 12px;padding:15px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;border:1px solid #d9e3e9;border-radius:12px;background:#fff;color:#294352}#saeivWorkHeader h2{margin:0;font-size:20px;color:#24465a}#saeivWorkHeader p{margin:4px 0 0;font-size:13px;color:#5d7380}',
 '#saeivWorkToggle{background:#edf2f5;color:#2b526a;border:1px solid #cbdce5;border-radius:9px;min-height:44px;padding:9px 13px;font-size:14px;font-weight:700}',
 'body.saeiv-shared-ops.saeiv-hide-toolbox #v165Board .v165-work{grid-template-columns:minmax(0,1fr)}body.saeiv-shared-ops.saeiv-hide-toolbox #v165Board .v165-toolbox{display:none}',
 '@media(max-width:1080px){body.saeiv-shared-ops #v165Board .v165-work{grid-template-columns:1fr}body.saeiv-shared-ops #v165Board .v165-toolbox{position:static;max-height:46vh}}',
 '@media(max-width:650px){body.saeiv-shared-ops #v165Board .v165-toolbar{padding:10px;gap:10px}body.saeiv-shared-ops #v165Board .v165-toolbar>label{flex:1 1 42%;min-width:0}body.saeiv-shared-ops #v165Board #v165Date,body.saeiv-shared-ops #v165Board #v190End{width:100%;font-size:16px}body.saeiv-shared-ops #v165Board .v165-toolbar>button{flex:1 1 42%}body.saeiv-shared-ops #v165Board .v165-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}body.saeiv-shared-ops #v165Board .v165-timehead,body.saeiv-shared-ops #v165Board .v165-driver-row{grid-template-columns:170px minmax(1440px,1fr)}body.saeiv-shared-ops #v165Board .v165-driver-meta{width:170px}}'
 ];
 function style(){
  if(q('saeivSharedDispatchStyle'))return;
  const s=document.createElement('style');s.id='saeivSharedDispatchStyle';s.textContent=rules.join('\n');document.head.append(s);
 }
 function sync(){
  if(!document.body)return;
  const role=isDispatcher();
  document.body.classList.toggle('saeiv-shared-ops',role);
  if(!role){document.body.classList.remove('saeiv-hide-toolbox');return}
  style();
  const root=q('v165Board');if(!root)return;
  // Remove obsolete operator-specific structure. No alternate UI or planner.
  q('antoniPilotVisuals')?.remove();q('antoniPilotNav')?.remove();q('antoniPilotHead')?.remove();q('antoniLinesPanel')?.remove();q('antoniPilotModal')?.remove();
  document.body.classList.remove('saeiv-antoni-pilot');delete document.body.dataset.antoniView;
  if(!q('saeivWorkHeader')){
   const h=document.createElement('section');h.id='saeivWorkHeader';
   h.innerHTML='<div><h2>Exploitation · Mon SAEIV</h2><p>Interface commune · lignes, conducteurs et services de votre entreprise uniquement.</p></div><button id="saeivWorkToggle" type="button" aria-expanded="true">Masquer les courses</button>';
   root.prepend(h);
   q('saeivWorkToggle').addEventListener('click',()=>{
    const hidden=document.body.classList.toggle('saeiv-hide-toolbox');
    q('saeivWorkToggle').textContent=hidden?'Afficher les courses':'Masquer les courses';
    q('saeivWorkToggle').setAttribute('aria-expanded',String(!hidden));
   });
  }
  for(const id of ['v165Date','v190End']){
   const picker=q(id);if(!picker||picker.dataset.saeivPickerReady)return;
   picker.dataset.saeivPickerReady='1';
   picker.addEventListener('click',()=>{try{picker.showPicker?.()}catch{}});
  }
 }
 const openDriverDay=id=>window.MonSAEIVPlanningUXV198?.choose?.(String(id));
 const init=()=>{sync();setInterval(sync,1500)};
 window.MonSAEIVAntoniPilotV202={installed:true,version:'1.0.116',sync,openDriverDay};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
