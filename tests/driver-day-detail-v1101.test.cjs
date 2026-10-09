'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('v198-planning-ux.js','utf8');
new vm.Script(src,{filename:'v198-planning-ux.js'});
const nodes=new Map();
for(const id of ['v198Controls','v198Selected','v198DateSummary','v198SelectedTitle','v198SelectedHelp','v198Build','v198Validate','v198Publish','v198EditPublished','v198DayDetail','v198DayTitle','v198DayMetrics','v198DayActivities','v198DayNote']){
 nodes.set(id,{id,hidden:id==='v198DayDetail',textContent:'',innerHTML:'',style:{},setAttribute(){},querySelectorAll(){return[]},scrollIntoView(){this.scrolled=true}});
}
const q=id=>nodes.get(id)||null,org='org',driver='driver-a',other='driver-b',day='2026-10-09';
const item=(type,from,to,props={})=>({driver_user_id:driver,service_date:day,type,start_time:from,end_time:to,...props});
const trip=item('regular','07:15','08:30',{line:'57R020',origin:'Château-Salins',destination:'Metz',label:'<script>alert(1)</script>'});
const board={date:day,drivers:[{user_id:driver,display_name:'Conducteur test',matricule:'TEST100'},{user_id:other,display_name:'Autre'}],
 draftDriverIds:[driver],officialDriverIds:[],
 draftItems:[
  item('start','06:55','07:05',{notes:'Prise de service au dépôt',provisional:true}),
  item('hlp','07:05','07:15',{notes:'HLP aller',estimatedKm:4.5,provisional:true}),
  trip,
  item('cut','08:30','10:00',{notes:'Coupure',provisional:true}),
  item('school','10:00','11:10',{line:'S001',origin:'Metz',destination:'Rémilly'}),
  item('hlp','11:10','11:25',{notes:'HLP retour',estimatedKm:7.5,provisional:true}),
  item('end','11:25','11:30',{notes:'Fin de service',provisional:true}),
  {...trip,driver_user_id:other,line:'57R999'}
 ],items:[],
 get segments(){return[]}};
const listeners={};
const document={getElementById:q,querySelectorAll:()=>[],addEventListener:()=>{}};
const window={MonSAEIVOperationsBoardV165:board,MonSAEIVCloudV156:{profile:{organization_id:org}},addEventListener(n,f){listeners[n]=f},MonSAEIVPlanningV187:null};
vm.runInNewContext(src,{document,window,console,setInterval:()=>0,Date,confirm:()=>false},{timeout:1000});
const api=window.MonSAEIVPlanningUXV198;
assert(api?.renderDriverDay&&api?.choose);
api.choose(driver);
assert(!q('v198DayDetail').hidden);
assert(q('v198DayDetail').scrolled,'must scroll directly to selected day');
assert(q('v198DayTitle').textContent.includes('Conducteur test'));
assert.match(q('v198DayMetrics').innerHTML,/4 h 35/);
for(const t of ['Prise de service','HLP · trajet à vide','Course régulière','Course scolaire','Coupure','Fin de service'])
 assert(q('v198DayActivities').innerHTML.includes(t),'missing '+t);
assert(q('v198DayActivities').innerHTML.indexOf('07:15')<q('v198DayActivities').innerHTML.indexOf('10:00'),'chronological order');
assert(!q('v198DayActivities').innerHTML.includes('57R999'),'only selected conductor');
assert(!q('v198DayActivities').innerHTML.includes('<script>'),'content escaped');
assert(q('v198DayActivities').innerHTML.includes('&lt;script&gt;'),'escaped trip label shown');
assert.match(q('v198DayNote').textContent,/provisoires/i);
assert(q('v198SelectedTitle').textContent.includes('brouillon'));
board.date='2026-10-10';api.renderDriverDay(driver,board.date);
assert.match(q('v198DayActivities').innerHTML,/Aucune activité enregistrée/);
assert(!q('v198DayMetrics').innerHTML,'old amplitude must not persist after date change');
console.log('SAEIV 1.0.101: clicking a driver shows correctly sorted duty details, HLP, breaks, amplitude, no cross-driver leakage and safe date changes.');
