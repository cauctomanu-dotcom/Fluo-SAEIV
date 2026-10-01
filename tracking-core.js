'use strict';
// Shared, deterministic calculations used by the driver and passenger page.
(function(root){
  function seconds(value){const m=String(value||'').match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);return m&&+m[2]<60&&+(m[3]||0)<60?+m[1]*3600 + +m[2]*60 + +(m[3]||0):null}
  function parisDate(ms=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(ms)}
  function at(date,time){
    const sec=seconds(time);if(sec===null||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;
    const wall=Date.parse(date+'T00:00:00Z')+sec*1000;
    let result=wall;
    for(let i=0;i<3;i++){
      const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(result).map(x=>[x.type,x.value]));
      const displayed=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
      if(displayed===wall)break;result+=wall-displayed;
    }
    return Number.isFinite(result)?result:null;
  }
  function active(service,date){if(!service)return false;const key=date.replaceAll('-',''),exception=service.exceptions?.[key];if(exception===1)return true;if(exception===2)return false;if(service.start&&key<service.start||service.end&&key>service.end)return false;return !!service.days?.[(new Date(date+'T12:00:00Z').getUTCDay()+6)%7]}
  function prediction(planned,delta,stage){if(!Number.isFinite(planned)||!Number.isFinite(delta))return null;return planned+((stage==='hlp'||stage==='waiting')?Math.max(0,delta):delta)*1000}
  function fresh(row,now=Date.now()){const t=Date.parse(row?.observed_at);return Number.isFinite(t)&&now-t>=-5000&&now-t<=60000}
  function deltaLabel(delta){if(!Number.isFinite(delta))return 'Estimation indisponible';if(Math.abs(delta)<=60)return 'À l’heure';return delta>0?`Retard estimé : ${Math.ceil(delta/60)} min`:`Avance estimée : ${Math.ceil(-delta/60)} min`}
  const api={seconds,at,parisDate,active,prediction,fresh,deltaLabel};root.SAEIVTracking=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
