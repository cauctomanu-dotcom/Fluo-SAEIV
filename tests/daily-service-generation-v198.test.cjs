'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const read=f=>fs.readFileSync(f,'utf8');
const engine=read('v167-generation-engine.js'),planner=read('v187-collaborative-planning.js'),
 board=read('v165-exploitation-board.js'),feedback=read('v196-generation-feedback.js');
for(const [name,src] of Object.entries({engine,planner,board,feedback}))new vm.Script(src,{filename:name});
assert(engine.includes('d?.is_test_driver===true'),'driver test status must be explicit');
assert(planner.includes('weekly_contract_minutes,is_test_driver'),'planners must fetch test status');
assert(planner.includes('historicalDrafts')&&planner.includes('draftKeys'),'earlier generated days must feed weekly rest history');
assert(planner.includes('onProgress?.({phase:\'assign\'')&&planner.includes('topReasons'),'show rejected candidates and per-date progress');
assert(board.includes('B.segments=[]'),'clear stale segments on date change');
assert(board.includes('run.serviceDate')&&board.includes(".join('-')!==date"),'reject trips for another service date');
assert(feedback.includes('segments ACTIFS ce jour')&&feedback.includes('stats?.topReasons'),'report actual daily traffic and real rejection reasons');
for(const dept of ['54','57']){
 const data=JSON.parse(read('fluo'+dept+'_core.json')),services=Object.values(data.servicesIndex.services);
 const count=iso=>{const d=new Date(iso+'T12:00:00Z'),wd=(d.getUTCDay()+6)%7,k=iso.replace(/-/g,'');
  return services.filter(x=>x.exceptions?.[k]===1||(x.exceptions?.[k]!==2&&k>=x.start&&k<=x.end&&x.days?.[wd])).length;
 };
 assert(count('2026-10-12')>count('2026-10-11'),'GTFS calendar varies by date in '+dept);
 console.log(dept+': Sunday '+count('2026-10-11')+' active service IDs, Monday '+count('2026-10-12'));
}
console.log('SAEIV 1.0.98: per-day GTFS schedule, test drivers and weekly rest draft continuity contracts OK');