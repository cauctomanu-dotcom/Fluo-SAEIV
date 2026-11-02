'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('v2/app.js','utf8');
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
  const getData=()=>JSON.parse(persisted.get('monsaeiv-v2-local-operations-1'));
  const date=date=>events.change({target:{dataset:{input:'date'},value:date}});
  return {el:element,events,submit,getData,date,persisted};
}
const h=launch();
assert.match(h.el('content').innerHTML,/href="\.\.\/secours\.html"/,'Le conducteur doit ouvrir le vrai SAEIV.');
h.el('roleOps').handlers.click();
assert.match(h.el('content').innerHTML,/Aucun conducteur|Commencer/);
h.submit('newDriverForm',{name:'Équipe <danger>',number:'C001'});
h.submit('newDriverForm',{name:'Deuxième conducteur',number:'C002'});
h.submit('newVehicleForm',{name:'Crossway 312'});
let db=h.getData();
assert.equal(db.drivers.length,2);assert.equal(db.vehicles.length,1);
assert.match(h.el('content').innerHTML,/Équipe &lt;danger&gt;/);
const activity=(driver,label,start,end,date='2026-11-02')=>({
 id:'',date,driverId:driver,type:'course',start,end,label,from:'Metz',to:'Château-Salins',
 vehicleId:db.vehicles[0].id,note:'Service réel à compléter'
});
h.date('2026-11-02');
h.submit('activityForm',activity(db.drivers[0].id,'Course 026 de nuit','23:30','01:00'));
db=h.getData();
assert.equal(db.activities.length,1);
assert.equal(db.activities[0].date,'2026-11-02');
h.date('2026-11-03');
assert.match(h.el('content').innerHTML,/Course 026 de nuit/,'Le service de nuit doit être visible le lendemain.');
h.date('2026-11-02');
h.submit('activityForm',activity(db.drivers[1].id,'Course conflictuelle','23:45','00:15'));
assert.match(h.el('content').innerHTML,/Même véhicule/,'Conflit véhicule détecté');
const newSession=launch(h.persisted);
newSession.el('roleOps').handlers.click();
assert.equal(newSession.getData().activities.length,2,'Les activités doivent survivre au rechargement');
console.log('Mon SAEIV 2.0 : conduite réelle, stockage, édition, nuit et détection véhicules OK');
