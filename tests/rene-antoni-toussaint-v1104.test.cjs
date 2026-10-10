'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
for(const file of ['v165-exploitation-board.js','v187-collaborative-planning.js','v200-home-voice-test.js','v201-holiday-crew-ui.js'])new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
const sql=fs.readFileSync('supabase/migrations/20261009120000_rene_antoni_toussaint_v1104.sql','utf8');
for(const department of ['54','57']){const routes=JSON.parse(fs.readFileSync('fluo'+department+'_core.json','utf8')).routesIndex.routes;const codes=department==='54'?['54R330','54R340','54R350','54R360','54R370','54R380']:['57R026','57R027','57R028','57R033','57R041','57R166'];for(const code of codes){const route=routes.find(x=>x.short===code);assert(route,code);assert(sql.includes(route.id),code+' id')}}
const planner=fs.readFileSync('v187-collaborative-planning.js','utf8');
const board=fs.readFileSync('v165-exploitation-board.js','utf8');
const dispatch=fs.readFileSync('v157-exploitation.js','utf8');
// v1.0.111: René Antoni has its own organization and exactly 27 current test drivers.
// No hard-coded global cap: authorization derives from the logged-in company.
assert(planner.includes(".eq('organization_id',org()).eq('role','driver').eq('active',true)"));
assert(planner.includes("const eligible=drivers.filter(d=>!publishedIds.has(d.user_id)&&(!driverId||d.user_id===driverId))"));
assert(board.includes('B.drivers=B.allDrivers.slice()'));
assert(board.includes("const {data:companyLines,error:companyError}=await c.from('saeiv_company_lines')"));
assert(board.includes("if(!active.some(l=>String(l.department)===String(dept)))continue"));
assert(board.includes("&&lineKey(l.line_code,dept)===lineKey(route.short,dept)))continue"));
assert(board.includes("B.segments=[...found.values()].filter(seg=>active.some(l=>sameCompanyLine(l,seg)))"));
assert(board.includes('B.segments=[...found.values()].filter(seg=>active.some(l=>sameCompanyLine(l,seg)))'));
assert(dispatch.includes(".eq('organization_id',orgId).eq('role','driver').eq('active',true)"));
const home=fs.readFileSync('v200-home-voice-test.js','utf8');
assert(home.includes("kind:'system'"));
console.log('Holiday GTFS, organization-isolated company planning and home voice tests passed');