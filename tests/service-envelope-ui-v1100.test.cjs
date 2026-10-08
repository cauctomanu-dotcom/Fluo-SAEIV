'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('v197-service-blocks.js'),board=read('v165-exploitation-board.js'),
 planning=read('v187-collaborative-planning.js'),ux=read('v198-planning-ux.js'),week=read('v190-weekly-planning.js'),
 published=read('v195-intuitive-segment-change.js');
for(const [name,js] of Object.entries({service:source,board,planning,ux,week,published}))new vm.Script(js,{filename:name});
const window={};vm.runInNewContext(source,{window,console},{timeout:1000});
const api=window.MonSAEIVServiceBlocksV197;assert(api?.compose);
const p={lat:48.8176733,lon:6.5123002,address:'Dépôt'};
const c=[
 {id:'a',type:'regular',source:'auto_service',date:'2026-10-12',start:'07:00',end:'09:00',line:'57A',origin:'Départ A',destination:'Arrivée A',originCoords:{lat:48.821,lon:6.505},destinationCoords:{lat:48.91,lon:6.59}},
 {id:'b',type:'school',source:'auto_service',date:'2026-10-12',start:'12:00',end:'14:00',line:'57B',origin:'Départ B',destination:'Arrivée B',originCoords:{lat:48.92,lon:6.62},destinationCoords:{lat:48.815,lon:6.514}}
];
const result=api.compose(c,p,'2026-10-12');
assert.equal(result.complete,true,JSON.stringify(result.issues));
for(const t of ['start','hlp','cut','end','regular','school'])assert(result.items.some(x=>x.type===t),'missing service activity '+t);
assert.equal(result.items.filter(x=>['regular','school'].includes(x.type)).length,2);
assert(result.items.filter(x=>x.source===api.SOURCE).every(x=>x.provisional),'no estimated element can claim certified status');
assert(result.items.find(x=>x.type==='start').start<'07:00');
assert(result.items.find(x=>x.type==='end').end>'14:00');
const again=api.compose(result.items,p,'2026-10-12');
assert.equal(again.items.length,result.items.length,'repeated saves must not duplicate start/HLP/cut/end');
const broken=api.compose([{...c[0],originCoords:null}],p,'2026-10-12');
assert.equal(broken.complete,false);assert(broken.issues.some(s=>s.includes('HLP')));
const manual=api.compose([...c,{id:'manual',type:'start',start:'06:00',end:'06:10'}],p,'2026-10-12');
assert(manual.items.some(x=>x.id==='manual'));assert.equal(manual.generated,0,'must not override manually defined service markers');
assert(board.includes("const envelope=(driver,items)=>window.MonSAEIVServiceBlocksV197?.compose"),'draft/official timeline must render service envelopes');
assert(board.includes("['hlp','cut','start','end','pause'].includes(x.type)"),'all service elements visible in timetable');
assert(planning.includes('engine.compose(P.items')&&planning.includes('blockEngine.compose(items'),'manual and automatic draft saves must reconstruct service');
assert(week.includes('data-v198-remove-course')&&week.includes('planner().removeActivity'),'build workflow supports safely removing draft course');
for(const id of ['v198Selected','v198Validate','v198Publish','v198EditPublished','v198ValidateDay','v198PublishDay'])assert(ux.includes(id),'main board should own action '+id);
assert(ux.includes("if(streak===7)throw Error"),'block 7 consecutive planned workdays');
assert(ux.includes("eligible.some(x=>x.status==='draft')"),'never publish a full day with unvalidated drafts');
assert(ux.includes("await p.saveDraft();")&&ux.includes("await p.validate();"),'reconstruct draft service before validation');
assert(ux.includes("MonSAEIVSegmentChangeV195.open"),'published edits must use the segment chooser');
assert(published.includes('v196ReasonType')&&published.includes('saeiv_propose_service_change'),'published change requires selected old/new courses and recalculated service envelope');
const sql=read('supabase/migrations/20261009100000_intuitive_service_envelope_v1100.sql');
for(const name of ['saeiv_propose_segment_change','saeiv_propose_service_change','before_core is distinct from after_core','revoke all','grant execute'])assert(sql.includes(name));
const restSql=read('supabase/migrations/20261009101000_week_rest_publish_guard_v1100.sql');
assert(restSql.includes('saeiv_preflight_week_rest')&&restSql.includes('saeiv_publish_first_day')&&restSql.includes('saeiv_validate_day'));
console.log('SAEIV 1.0.100: draft and published preview include start/HLP/cuts/end; no duplicate envelope; driver actions and consent protected');
