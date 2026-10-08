'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const sql=read('supabase/migrations/20261008160000_enterprise_planning_v192.sql');
const code={
 admin:read('v186-enterprise-admin.js'),
 dispatch:read('v187-collaborative-planning.js'),
 driver:read('v188-driver-inbox.js'),
 generation:read('v167-generation-engine.js'),
 sync:read('v156-supabase-sync.js')
};
for(const x of ['saeiv_planning_days','saeiv_published_days','saeiv_change_requests','saeiv_planning_locks','saeiv_planning_audit','saeiv_notifications','saeiv_vehicle_rules','saeiv_matricule_sequences'])
 assert.ok(sql.includes('create table if not exists public.'+x),'missing '+x);
assert.ok(sql.includes('enable row level security'));
assert.ok(!sql.includes('create policy saeiv_changes_dispatch_update'),'dispatch cannot spoof consent');
assert.ok(!sql.includes('create policy saeiv_changes_dispatch_insert'),'proposal is RPC only');
assert.ok(sql.includes('x.status<>\'accepted\''),'explicit consent required to finalize');
assert.ok(sql.includes("status='published'"),'publication has explicit state');
assert.ok(sql.includes('revision<>x.base_revision'),'optimistic concurrency on publication required');
assert.ok(code.dispatch.includes('saeiv_acquire_lock')&&code.dispatch.includes('saeiv_heartbeat_lock'));
assert.ok(code.dispatch.includes('saeiv_validate_day')&&code.dispatch.includes('saeiv_publish_first_day'));
assert.ok(code.dispatch.includes('saeiv_propose_change')&&code.dispatch.includes('saeiv_finalize_change'));
assert.ok(code.dispatch.includes('generateDraft'),'generation must be drafts');
assert.ok(code.generation.includes('MonSAEIVPlanningV187?.generateDraft'),'legacy automatic write redirected');
assert.ok(code.driver.includes('saeiv_respond_change')&&code.driver.includes('accepted')&&code.driver.includes('refused'));
assert.ok(code.sync.includes("saeiv_published_days"),'driver sync must read publication records');
assert.ok(code.sync.includes("publishedDates.has(x.service_date)"),'legacy entries superseded on published days');
for(const [name,source]of Object.entries(code)){
 const doc={getElementById(){return null},addEventListener(){},readyState:'loading'};
 const ctx={window:{addEventListener(){},removeEventListener(){}},document:doc,localStorage:{getItem(){return null},setItem(){}},setInterval(){return 0},clearInterval(){},
   setTimeout(){return 0},Date,console,Math,Number,String,Map,Set,Array,Promise,navigator:{},structuredClone};
 vm.runInNewContext(source,ctx,{timeout:1000,filename:name});
 assert.ok(Object.keys(ctx.window).some(x=>x.startsWith('MonSAEIV')&&name!=='sync'||x.startsWith('MonSAEIV')&&name==='sync'));
}
console.log('SAEIV 1.0.92 security / workflow / PWA runtime contracts OK');
