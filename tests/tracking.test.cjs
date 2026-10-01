const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../tracking-core.js');
test('Paris service dates and times after midnight',()=>{
 assert.equal(C.at('2026-10-01','07:00:00'),Date.parse('2026-10-01T05:00:00Z'));
 assert.equal(C.at('2026-10-01','25:15:00'),Date.parse('2026-10-01T23:15:00Z'));
 assert.equal(C.at('2026-12-01','07:00:00'),Date.parse('2026-12-01T06:00:00Z'));
 assert.equal(C.at('2026-10-01','08:99'),null);
});
test('Early HLP arrival is waiting time, delay carries into passenger departure',()=>{
 assert.equal(C.prediction(1000000,-180,'hlp'),1000000);
 assert.equal(C.prediction(1000000,180,'hlp'),1180000);
 assert.equal(C.prediction(1000000,-180,'service'),820000);
 assert.equal(C.prediction(1000000,null,'service'),null);
});
test('Service calendar respects exceptions, weekdays and missing calendar',()=>{
 const s={start:'20260101',end:'20261231',days:[1,1,1,1,1,0,0],exceptions:{20261001:2,20261003:1}};
 assert.equal(C.active(s,'2026-10-01'),false);assert.equal(C.active(s,'2026-10-02'),true);assert.equal(C.active(s,'2026-10-03'),true);assert.equal(C.active(s,'2026-10-04'),false);assert.equal(C.active(null,'2026-10-01'),false);
});
test('Stale, invalid and future GPS fixes are not live',()=>{
 const now=Date.now();assert(C.fresh({observed_at:new Date(now-30000).toISOString()},now));
 for(const time of [now-61000,now+6000])assert.equal(C.fresh({observed_at:new Date(time).toISOString()},now),false);
 assert.equal(C.fresh({observed_at:null},now),false);
});
