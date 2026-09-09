'use strict';
/* Mon SAEIV 1.0.69 — mise en forme des bornes de service dans la grille Exploitation. */
(()=>{
  if(window.MonSAEIVServiceGridV168?.installed)return;
  const VERSION='1.0.69';
  function installStyle(){
    if(document.getElementById('v168Style'))return;
    const s=document.createElement('style');s.id='v168Style';s.textContent=`
      .v165-block.service-start{border-color:#4c9b68!important;background:#143923!important;color:#d9ffe5!important;font-weight:900}
      .v165-block.service-end{border-color:#8c61bc!important;background:#35204d!important;color:#f0ddff!important;font-weight:900}
    `;document.head.appendChild(s);
  }
  function decorate(){
    installStyle();
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
  const mo=new MutationObserver(()=>decorate());
  function boot(){installStyle();decorate();mo.observe(document.documentElement,{childList:true,subtree:true})}
  window.MonSAEIVServiceGridV168={installed:true,version:VERSION,decorate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();