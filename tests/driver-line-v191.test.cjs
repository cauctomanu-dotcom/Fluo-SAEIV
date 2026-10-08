'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../v185-line-thermometer.js'),'utf8');
const store=new Map();
const context={
  window:{},
  document:{readyState:'loading',addEventListener(){}},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  state:{
    running:true,
    route:{short:'54'},
    pattern:{headsign:'Terminus B',stops:[
      {name:'Départ A',lat:48,lon:6},
      {name:'Milieu',lat:48.005,lon:6},
      {name:'Terminus B',lat:48.01,lon:6}
    ],shape:[[48,6],[48.005,6],[48.01,6]]},
    fusion:{lastAlong:280},current:0,target:1,
    pos:{coords:{latitude:48.0025,longitude:6}}
  },
  setInterval(){},
  Date,Math,Number,String,console
};
vm.runInNewContext(code,context,{timeout:1000});
const api=context.window.MonSAEIVLineViewV185;
assert.equal(api.installed,true);
const x=api.snapshot();
assert.equal(x.line,'54');
assert.equal(x.destination,'Terminus B');
assert.equal(x.current,0);
assert.equal(x.target,1);
const f=api.progress(x);
assert.ok(f>.3&&f<.7,'GPS geometry interpolates between stops: '+f);
context.state.fusion.lastAlong=0;
assert.equal(api.progress(api.snapshot()),0);
context.state.current=1;context.state.target=2;
context.state.fusion.lastAlong=835;
assert.ok(api.progress(api.snapshot())>.3);
context.state.pattern.stops=[];
assert.equal(api.snapshot(),null);
console.log('Thermomètre: index, progression GPS, repli et fin de course OK');