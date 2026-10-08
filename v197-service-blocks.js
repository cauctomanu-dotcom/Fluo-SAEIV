'use strict';
/* SAEIV 1.1.00 — provisional driver service envelope: duty start, HLP, waiting/cuts, duty end.
   Geometry/time estimates are NOT a substitute for regulation or a routed road itinerary. */
(()=>{
 if(window.MonSAEIVServiceBlocksV197?.installed)return;
 const SOURCE='saeiv_estimated_service';
 const workTypes=new Set(['regular','school','tad','annex','other']);
 const markTypes=new Set(['start','end','hlp','cut','pause']);
 const toMin=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
 const clock=m=>{const n=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
 const point=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))?{lat:Number(p.lat),lon:Number(p.lon)}:null;
 const dist=(a,b)=>{const x=point(a),y=point(b);if(!x||!y)return null;const r=v=>v*Math.PI/180,lat=r(y.lat-x.lat),lon=r(y.lon-x.lon),v=Math.sin(lat/2)**2+Math.cos(r(x.lat))*Math.cos(r(y.lat))*Math.sin(lon/2)**2;return 6371*2*Math.asin(Math.sqrt(v))};
 const estimate=(from,to)=>{const km=dist(from,to);return km===null?null:{km:Math.round(km*1.18*10)/10,minutes:km<.12?0:Math.max(1,Math.ceil(km*1.18/42*60))}};
 const label=p=>p?.address||p?.name||p?.label||'Stationnement du véhicule';
 function compose(input,parking,date){
  const all=Array.isArray(input)?input:[];
  const base=all.filter(x=>x?.source!==SOURCE);
  const manuallyDefined=base.some(x=>markTypes.has(x.type));
  const services=base.filter(x=>workTypes.has(x.type)&&toMin(x.start)!==null&&toMin(x.end)!==null).sort((a,b)=>toMin(a.start)-toMin(b.start));
  const issues=[],generated=[];
  if(manuallyDefined)return {items:base,issues:['Des éléments de service ont été saisis manuellement : conservation sans remplacement automatique. Vérifier leur cohérence.'],generated:0,complete:false};
  if(!services.length)return {items:base,issues:[],generated:0,complete:true};
  const add=(type,start,end,origin,destination,comment,extra={})=>{
   if(end<start||end>1440||start<0){issues.push('Service traversant minuit : contrôler manuellement les horaires.');return}
   generated.push({id:'service-'+date+'-'+type+'-'+generated.length,date,type,start:clock(start),end:clock(end),
    origin:origin||'',destination:destination||'',label:comment,notes:comment,source:SOURCE,
    provisional:true,calculation:'distance à vol d’oiseau × 1,18 / 42 km/h — itinéraire et RSE à confirmer',...extra});
  };
  const name=label(parking);
  const first=services[0],last=services.at(-1);
  const departure=estimate(parking,first.originCoords),returning=estimate(last.destinationCoords,parking);
  const starts=toMin(first.start),ends=toMin(last.end);
  if(departure===null){issues.push('Début de service : stationnement ou coordonnées du premier arrêt manquants, HLP non calculé.');add('start',starts-10,starts,name,first.origin,'Prise de service provisoire — stationnement à confirmer')}
  else{
   const at=starts-departure.minutes-10;
   add('start',at,at+10,name,name,'Prise de service · 10 min de préparation estimées');
   if(departure.minutes>0)add('hlp',at+10,starts,name,first.origin,'HLP aller estimé · '+departure.km+' km',{estimatedKm:departure.km,originCoords:point(parking),destinationCoords:point(first.originCoords)});
  }
  for(let i=0;i<services.length-1;i++){
   const a=services[i],b=services[i+1],t=toMin(a.end),next=toMin(b.start);
   if(next<t){issues.push('Chevauchement entre '+(a.line||'une course')+' et '+(b.line||'une course')+'.');continue}
   const gap=estimate(a.destinationCoords,b.originCoords);
   if(!gap){issues.push('HLP intermédiaire '+(a.line||'')+' → '+(b.line||'')+' : coordonnées manquantes.');continue}
   if(t+gap.minutes>next){issues.push('HLP impossible entre '+(a.line||'')+' et '+(b.line||'')+' : '+gap.minutes+' min nécessaires.');continue}
   if(gap.minutes>0)add('hlp',t,t+gap.minutes,a.destination,b.origin,'HLP entre courses estimé · '+gap.km+' km',{estimatedKm:gap.km,originCoords:point(a.destinationCoords),destinationCoords:point(b.originCoords)});
   if(next>t+gap.minutes){
    const idle=next-t-gap.minutes;
    add('cut',t+gap.minutes,next,b.origin,b.origin, (idle>=30?'Coupure':'Attente')+' estimée · '+idle+' min, qualification et rémunération à confirmer',{estimatedMinutes:idle,cutClassification:idle>=30?'provisional_cut':'waiting'});
   }
  }
  if(returning===null){issues.push('Retour dépôt : coordonnées manquantes, HLP de fin non calculé.');add('end',ends,ends+5,last.destination,name,'Fin de service provisoire — retour dépôt à vérifier')}
  else{
   if(returning.minutes>0)add('hlp',ends,ends+returning.minutes,last.destination,name,'HLP retour estimé · '+returning.km+' km',{estimatedKm:returning.km,originCoords:point(last.destinationCoords),destinationCoords:point(parking)});
   add('end',ends+returning.minutes,ends+returning.minutes+5,name,name,'Fin de service · clôture estimée de 5 min');
  }
  const ordered=[...base,...generated].sort((a,b)=>(toMin(a.start)??9999)-(toMin(b.start)??9999));
  return {items:ordered,issues,generated:generated.length,complete:issues.length===0};
 }
 window.MonSAEIVServiceBlocksV197={installed:true,SOURCE,compose,estimate,toMin,workTypes,markTypes};
})();