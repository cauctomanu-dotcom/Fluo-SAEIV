'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');
const board=read('v165-exploitation-board.js');
const weekly=read('v190-weekly-planning.js');
const planner=read('v187-collaborative-planning.js');
const visual=read('v202-antoni-pilot.js');
for(const f of ['v165-exploitation-board.js','v190-weekly-planning.js','v187-collaborative-planning.js','v202-antoni-pilot.js'])
  new vm.Script(read(f),{filename:f});
const numbers=JSON.parse(read('fluo-numbering-2026.json')).departments['54'];
for(const [oldCode,newCode] of Object.entries({'54R330':'460','54R340':'461','54R350':'465','54R360':'466','54R370':'468','54R380':'469'})){
  assert.equal(numbers[oldCode].new,newCode,oldCode+' current Fluo number');
  assert(board.includes("'"+oldCode.slice(-3)+"':'"+newCode+"'"),'board legacy map '+oldCode);
  assert(planner.includes("'"+oldCode.slice(-3)+"':'"+newCode+"'"),'planning legacy map '+oldCode);
}
assert(board.includes("for(const serviceMode of (antoniPilot()?['regular','tad']:['regular']))"),'ANTONI TAD must be included');
assert(board.includes("type=antoniPilot()&&serviceMode==='tad'?'regular'"),'TAD should be planned like regular');
assert(board.includes("if(found.has(id)){"),'avoid duplicate trips');
assert(board.includes('if(antoniPilot())B.segments=[]'), 'dates must not carry segments between days');
assert(board.includes("if(!active.some(l=>String(l.department)===String(dept)))continue"),'restrict GTFS to company');
assert(weekly.includes("if(!antoniPilot()&&q('v165Date'))q('v165Date').value=from()"),'selected GTFS date must not jump to range start');
assert(visual.includes("const isPilot=()=>String(cloud()?.profile?.organization_id||'')===ANTONI"),'isolated enterprise');
assert(visual.includes("...(b.draftItems||[])"),'driver detail must show drafts');
assert(visual.includes("data-antoni-open-day"),'driver detail button');
console.log('ANTONI 1.0.113: current Fluo numbering, isolated TAD, day-by-day segments, draft detail and UI contracts OK');
