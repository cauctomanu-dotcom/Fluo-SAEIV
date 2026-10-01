'use strict';
(()=>{
 const C=window.SAEIVTracking,q=id=>document.getElementById(id);
 const API='https://xpmrnwipnoekiycghwli.supabase.co/rest/v1/saeiv_live_courses';
 const KEY='sb_publishable_CK-3LTMSP2aIdbFSFSQk1A_f5DRBlj4';
 const FIELDS='public_id,service_date,department,route_id,trip_id,line,destination,stage,latitude,longitude,accuracy_m,observed_at,delay_seconds,stop_index,start_index,served_stop_indices';
 let routes=[],services={},patterns=[],runs=[],selected=null,generation=0,poll=0,map=null,path=null,stopMarker=null,markers=[],loading=false;
 const text=(id,value)=>q(id).textContent=value;
 const clock=ms=>new Date(ms).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'});
 async function json(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Chargement indisponible. Réessayez dans un instant.');return r.json()}
 function options(id,rows,placeholder){const e=q(id);e.replaceChildren();if(placeholder)e.add(new Option(placeholder,''));for(const [value,label] of rows)e.add(new Option(label,value));e.disabled=!rows.length}
 function reset(){selected=null;poll++;clearMarkers();text('summary','Sélectionnez votre horaire puis « Suivre ce bus ».');q('vehicles').replaceChildren();q('track').disabled=true}
 function clearMarkers(){for(const marker of markers)marker.remove();markers=[]}
 async function loadDepartment(){
   reset();const token=++generation;for(const id of ['line','direction','stop','departure'])options(id,[],'Chargement…');text('formStatus','Chargement des horaires…');
   try{const dept=q('department').value;const [r,s]=await Promise.all([json(`./data/${dept}/routes.json`),json(`./data/${dept}/services.json`)]);if(token!==generation)return;
     routes=r.routes||[];services=s.services||{};
     try{const numbering=await json('./fluo-numbering-2026.json');if(token!==generation)return;routes=routes.map(r=>({...r,short:numbering.departments?.[dept]?.[r.short]?.new||r.short}))}catch{}
     routes.sort((a,b)=>a.short.localeCompare(b.short,'fr',{numeric:true}));options('line',routes.map(r=>[r.id,`${r.short} · ${r.long||''}`]),'Choisissez votre ligne');text('formStatus','');
   }catch(e){if(token===generation)text('formStatus',e.message)}
 }
 async function loadLine(){reset();const token=++generation;for(const id of ['direction','stop','departure'])options(id,[],'Choisissez votre ligne');const route=routes.find(r=>r.id===q('line').value);if(!route)return;
   try{const data=await json(`./data/${q('department').value}/${route.file}`);if(token!==generation)return;patterns=data.patterns||[];options('direction',patterns.map((p,i)=>[i,`${p.headsign||p.stops.at(-1)?.name} · depuis ${p.stops[0]?.name} (${p.stops.length} arrêts)`]),'Choisissez la direction');text('formStatus','')}catch(e){if(token===generation)text('formStatus',e.message)}
 }
 function loadStops(){reset();const pattern=patterns[q('direction').value];options('stop',(pattern?.stops||[]).map((s,i)=>[i,`${s.name}${i===pattern.stops.length-1?' · terminus':''}`]),'Choisissez votre arrêt');options('departure',[],'Choisissez votre arrêt')}
 function loadTimes(){reset();const p=patterns[q('direction').value],i=Number(q('stop').value),date=q('date').value;if(!p||q('stop').value===''||!date)return;
   runs=(p.trips||[]).filter(t=>C.active(services[t.service],date)&&String(t.demand?.[i]?.pickup_type||'0')!=='1').map(trip=>({trip,at:C.at(date,trip.times?.[i]?.[1]||trip.times?.[i]?.[0])})).filter(x=>x.at!==null).sort((a,b)=>a.at-b.at);
   options('departure',runs.map((r,i)=>[i,clock(r.at)+(C.parisDate(r.at)!==date?' · lendemain':'')]),runs.length?'Choisissez votre horaire':'Aucun passage à cette date');text('formStatus',runs.length?'':'Aucun horaire disponible pour cet arrêt à cette date.');
 }
 function draw(){if(!window.L){text('summary','Carte indisponible ; les informations de passage restent consultables.');return}if(!map){q('map').replaceChildren();map=L.map('map').setView([49,6.3],9);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map)}path?.remove();stopMarker?.remove();const p=selected.pattern,s=p.stops[selected.stop];if(p.shape?.length)path=L.polyline(p.shape,{color:'#19808a',weight:4,opacity:.5}).addTo(map);stopMarker=L.circleMarker([s.lat,s.lon],{color:'#102a38',fillColor:'#ffd94a',fillOpacity:1,radius:8}).addTo(map);stopMarker.bindTooltip(document.createTextNode('Votre arrêt : '+s.name));if(path)map.fitBounds(path.getBounds(),{padding:[30,30]});else map.setView([s.lat,s.lon],14)}
 function render(rows){
   clearMarkers();q('vehicles').replaceChildren();const a=selected;if(!a)return;
   const valid=rows.filter(r=>a.stop>=r.start_index&&(!Array.isArray(r.served_stop_indices)||r.served_stop_indices.includes(a.stop)));
   text('summary',valid.length?'Suivi actualisé toutes les 10 secondes.':`Passage prévu à ${clock(a.at)} · suivi en direct indisponible. Cela ne signifie pas que le bus est supprimé.`);
   for(const row of valid){const fresh=C.fresh(row),passed=row.stage==='service'&&row.stop_index>a.stop;
     const article=document.createElement('article');article.className='vehicle';const badge=document.createElement('span');badge.className='badge'+(!fresh?' stale':row.delay_seconds>60?' warn':'');badge.textContent=!fresh?'Position ancienne':row.stage==='hlp'?'Bus en mise en place':row.stage==='waiting'?'Bus au départ':'Bus en circulation';article.appendChild(badge);
     const title=document.createElement('strong'),detail=document.createElement('p'),stamp=document.createElement('small');
     const estimate=C.prediction(a.at,row.delay_seconds,row.stage);
     title.textContent=!fresh?'Suivi momentanément indisponible':passed?'Arrêt déjà dépassé':estimate===null?'Passage estimé indisponible':`Passage estimé à ${clock(estimate)}`;
     detail.textContent=`Horaire prévu : ${clock(a.at)}`+(fresh&&!passed&&estimate!==null?` · ${C.deltaLabel((estimate-a.at)/1000)}`:'');
     stamp.textContent=`Dernière position reçue à ${new Date(row.observed_at).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris'})}`;article.append(title,detail,stamp);q('vehicles').appendChild(article);
     if(map&&fresh){const marker=L.marker([row.latitude,row.longitude]).addTo(map);marker.bindTooltip(document.createTextNode(`${row.line} · ${row.stage==='hlp'?'Mise en place':row.destination}`));markers.push(marker)}
   }
 }
 async function refresh(){if(!selected||loading)return;loading=true;const token=poll,a=selected;try{
   const params=new URLSearchParams({select:FIELDS,department:`eq.${a.department}`,service_date:`eq.${a.date}`,route_id:`eq.${a.route.id}`,trip_id:`eq.${a.trip.id}`,limit:'20'});
   const response=await fetch(`${API}?${params}`,{headers:{apikey:KEY},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const rows=await response.json();if(token===poll)render(rows);
 }catch{if(token===poll){clearMarkers();q('vehicles').replaceChildren();text('summary',`Passage prévu à ${clock(a.at)} · suivi indisponible pour le moment.`)}}finally{loading=false}}
 q('department').onchange=loadDepartment;q('line').onchange=loadLine;q('direction').onchange=loadStops;q('stop').onchange=loadTimes;q('date').onchange=loadTimes;
 q('departure').onchange=()=>{reset();q('track').disabled=q('departure').value===''};
 q('journey').onsubmit=e=>{e.preventDefault();const r=runs[q('departure').value],route=routes.find(r=>r.id===q('line').value),pattern=patterns[q('direction').value];if(!r||!route||!pattern)return;poll++;selected={...r,route,pattern,department:q('department').value,date:q('date').value,stop:Number(q('stop').value)};text('tripTitle',`${route.short} → ${pattern.headsign||pattern.stops.at(-1).name}`);text('summary','Recherche du véhicule…');draw();refresh()};
 q('date').value=C.parisDate();loadDepartment();setInterval(refresh,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
