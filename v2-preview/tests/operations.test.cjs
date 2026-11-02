'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('v2-preview/app.js','utf8');
let serial=0;
function launch(persisted=new Map()){
  const elements=new Map(),events={};
  function element(id){
    if(!elements.has(id)) elements.set(id,{
      id,innerHTML:'',value:'',textContent:'',hidden:false,disabled:false,dataset:{},
      handlers:{},classList:{toggle(){}},setAttribute(){},
      addEventListener(name,fn){this.handlers[name]=fn;},
      reset(){},showModal(){this.open=true;},close(){this.open=false;}
    });
    return elements.get(id);
  }
  const doc={
    getElementById:element,addEventListener:(name,fn)=>events[name]=fn,
    createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}
  };
  class FakeFormData{constructor(form){this.form=form;}get(name){return this.form.values[name];}}
  const ctx={
    document:doc,localStorage:{getItem:key=>persisted.get(key)||null,setItem:(key,value)=>persisted.set(key,value)},
    window:{addEventListener(){},print(){}},navigator:{},crypto:{randomUUID(){return 'id-'+(++serial);}},
    FormData:FakeFormData,Blob:class{},URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
    alert(){},confirm(){return true;},prompt(){return null;},setTimeout(){},
    console
  };
  vm.runInNewContext(source,ctx,{timeout:3000});
  function submit(id,values){
    const f=element(id);f.values=values;
    if(id==='activityForm')f.handlers.submit({target:f,preventDefault(){}});
    else events.submit({target:f,preventDefault(){}});
  }
  const getData=()=>JSON.parse(persisted.get('monsaeiv-v2-preview-operations-1'));
  const date=date=>events.change({target:{dataset:{input:'date'},value:date}});
  return {el:element,events,submit,getData,date,persisted};
}
const h=launch();
function view(page){
  h.events.click({target:{closest:selector=>selector==='[data-view]'?{dataset:{view:page}}:null}});
}
function action(type,attrs={}){
  h.events.click({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:type,...attrs},disabled:false}:null}});
}
assert.match(h.el('content').innerHTML,/Journée globale/,'L’exploitation doit ouvrir sur la frise de tous les conducteurs.');
h.el('roleDriver').handlers.click();
assert.match(h.el('content').innerHTML,/href="\.\.\/secours\.html"/,'Le conducteur doit accéder au moteur Fluo réel.');
h.el('roleOps').handlers.click();
view('drivers');
h.submit('newDriverForm',{name:'Équipe <danger>',number:'C001',depot:'Château-Salins'});
h.submit('newDriverForm',{name:'Deuxième conducteur',number:'C002',depot:'Metz'});
assert.match(h.el('content').innerHTML,/Équipe &lt;danger&gt;/,'Le HTML des noms doit être échappé.');
view('vehicles');h.submit('newVehicleForm',{name:'Crossway 312'});
let db=h.getData();
assert.equal(db.drivers.length,2);assert.equal(db.vehicles.length,1);
assert.equal(db.drivers[0].depot,'Château-Salins');
const activity=(driver,label,start,end,date='2026-11-02',type='course')=>({
 id:'',date,driverId:driver,type,start,end,label,from:'Metz',to:'Château-Salins',
 vehicleId:db.vehicles[0].id,note:'Service réel à compléter'
});
view('planning');h.date('2026-11-02');
h.submit('activityForm',activity(db.drivers[0].id,'Course 026 de nuit','23:30','01:00'));
h.submit('activityForm',activity(db.drivers[0].id,'Coupure longue','10:30','11:00','2026-11-02','pause'));
db=h.getData();
assert.equal(db.activities.length,2);
assert.match(h.el('content').innerHTML,/planner-grid/,'La frise 24 h doit s’afficher.');
assert.match(h.el('content').innerHTML,/Course 026 de nuit/,'La course doit apparaître dans la frise.');
action('listMode');
assert.match(h.el('content').innerHTML,/day-segments/,'La liste multi-segments est disponible.');
action('timelineMode');
view('week');
assert.match(h.el('content').innerHTML,/Semainier équipe/);
assert.match(h.el('content').innerHTML,/weekly-grid/);
action('openDriverDay',{driver:db.drivers[0].id,date:'2026-11-02'});
assert.match(h.el('content').innerHTML,/JOURNÉE CONDUCTEUR/);
assert.match(h.el('content').innerHTML,/Course 026 de nuit/);
view('planning');
h.date('2026-11-03');
assert.match(h.el('content').innerHTML,/Course 026 de nuit/,'Le service de nuit doit apparaître le lendemain.');
h.date('2026-11-02');
h.submit('activityForm',activity(db.drivers[1].id,'Course conflictuelle','23:45','00:15'));
assert.match(h.el('content').innerHTML,/Même véhicule/,'Un véhicule ne peut être attribué à deux conducteurs simultanément sans avertissement.');
view('home');assert.match(h.el('content').innerHTML,/Les espaces de Mon SAEIV/);
view('organization');assert.match(h.el('content').innerHTML,/Personnaliser Mon SAEIV/);
const newSession=launch(h.persisted);
assert.equal(newSession.getData().activities.length,3,'Les activités doivent survivre au rechargement.');
console.log('SAEIV 2.0 : accueil entreprise, cockpit Fluo, 24 h, multi-segments, semainier, nuits, conflits et stockage OK');
