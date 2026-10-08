'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const core=fs.readFileSync('v165-exploitation-board.js','utf8');
const feedback=fs.readFileSync('v196-generation-feedback.js','utf8');
const week=fs.readFileSync('v190-weekly-planning.js','utf8');
for(const [name,src]of Object.entries({core,feedback,week}))new vm.Script(src,{filename:name});
for(const needle of [
 "c.from('saeiv_planning_days').select('driver_user_id,items,status')",
 'B.draftDriverIds=new Set',
 'B.draftItems=visibleDrafts.flatMap',
 'return B.draftItems.find(matches)||B.items.find(matches)||null',
 "...B.draftItems].filter(",
 "old?.source==='draft'",
 "old.source==='draft'",
 "B.draftDriverIds.has(String(driverId))"
])assert(core.includes(needle),'missing protective draft feature: '+needle);
assert(feedback.includes("unchanged:true"),'pre-existing draft must be classified prepared');
assert(week.includes('already.length'), 'original generator should distinguish already prepared dates');
const logs=[];
const nodes=new Map(['v196Progress','v196Title','v196Bar','v196Details','v196Cancel','v196Log','v190Status','v187Date','v187Driver'].map(id=>[id,{id,style:{},value:'',textContent:'',disabled:false,prepend(x){logs.push(x.textContent)}}]));
const days=new Map();const dt=x=>{const d=new Date('2026-10-08T12:00:00Z');d.setUTCDate(d.getUTCDate()+x);return d.toISOString().slice(0,10)};
for(let i=0;i<7;i++)days.set(dt(i),[{driver_user_id:'test-driver',revision:1,items:[{id:'gtfs-'+i,segment_id:'SEG'+i,type:'regular',start:'08:00',end:'09:00'}]}]);
const current={date:null},board={
 get segments(){return [{id:'SEG'+Math.round((Date.parse(current.date+'T12:00:00Z')-Date.parse(dt(0)+'T12:00:00Z'))/86400000),type:'regular'}]},
 items:[],
 async setDate(d){current.date=d},async loadSegments(){}
};
const planner={state:{date:null,lock:null},async takeLock(){this.state.lock={date:this.state.date}},async releaseLock(){this.state.lock=null},async generateDraft(){return {assigned:0,unplaced:0,topReasons:[]}}};
const client={from(){return {select(){return this},eq(){return this},then(resolve,reject){return Promise.resolve({data:days.get(current.date)||[],error:null}).then(resolve,reject)}}}};
const window={MonSAEIVOperationsBoardV165:board,MonSAEIVPlanningV187:planner,MonSAEIVCloudV156:{client,profile:{organization_id:'demo-company'}}};
const document={getElementById:id=>nodes.get(id)||null,createElement:()=>({textContent:''})};
vm.runInNewContext(feedback,{window,document,setInterval:()=>0,setTimeout,Date,Promise,console},{timeout:1500});
(async()=>{
 const r=await window.MonSAEIVGenerationFeedbackV196.run(dt(0),dt(6));
 assert.equal(r.length,7);
 assert(r.every(x=>x.ok&&x.unchanged&&x.covered===1&&x.remaining===0),'all seven already-drafted days should be visible, not failed');
 assert.match(nodes.get('v196Title').textContent,/7 déjà planifiée/);
 assert.match(nodes.get('v196Title').textContent,/REPOS À CORRIGER/);
 assert(logs.some(x=>x.includes('plus de 6 journées de travail consécutives')));
 console.log('SAEIV 1.0.99: displayed existing drafts; 7 no-op days are prepared; RSE streak warning triggered');
})().catch(e=>{console.error(e);process.exit(1)});
