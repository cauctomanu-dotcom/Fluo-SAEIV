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
assert(board.includes("for(const serviceMode of (antoniPilot()?['tad']:['regular']))"),'ANTONI GTFS pilot must load one complete service-day catalogue');
assert(board.includes('type=routeFamily(route,dept)'),'TAD pass must preserve each route regular or school classification');
assert(board.includes("reservationRequired:antoniPilot()&&reservation"),'real reservation flag must be trip-level');
assert(board.includes('if(found.has(id))continue;'),'avoid duplicate trips');
assert(board.includes('multiSelected.clear();B.segments=[];'), 'date changes must clear all company segments');
assert(board.includes("if(!active.some(l=>String(l.department)===String(dept)))continue"),'restrict GTFS to company');
assert(weekly.includes("if(!antoniPilot()&&q('v165Date'))q('v165Date').value=from()"),'selected GTFS date must not jump to range start');
assert(visual.includes('saeiv-shared-ops'),'one common company dispatcher layout');
assert(visual.includes("const isDispatcher=()=>"),'common role-based interface, no hard-coded company');
assert(visual.includes("MonSAEIVPlanningUXV198?.choose?."),'reuses actual common driver day-detail engine');
console.log('ANTONI 1.0.113: current Fluo numbering, isolated TAD, day-by-day segments, draft detail and UI contracts OK');
