import assert from 'node:assert/strict';
import {eventSchedule,moveEvent,intersects,dateKey,addDays,validEvent} from './engine.mjs';

const timed={id:'synthetic',title:'Test birthday',description:'Synthetic only',category:'Legacy',tags:['Birthday'],color:'none',start:'2026-05-31T13:45',end:'2026-05-31T16:15',extra:{preserve:true}};
assert.deepEqual(eventSchedule(timed,'2026-05-31','13:45',true),{start:'2026-05-31T00:00',end:'2026-06-01T00:00',allDay:true});
const birthday={...timed,...eventSchedule(timed,'2026-05-31','13:45',true)};
assert(validEvent(birthday));
assert(intersects(birthday,new Date('2026-05-31T12:00')));
assert(!intersects(birthday,new Date('2026-06-01T12:00')),'Exclusive midnight does not create a next-day occurrence');
assert(!intersects(birthday,new Date('2026-05-30T12:00')));
assert.deepEqual(eventSchedule(timed,'2026-06-01','14:10',false),{start:'2026-06-01T14:10',end:'2026-06-01T16:40',allDay:false},'A changed time preserves the existing 150-minute span');
assert.deepEqual(eventSchedule(birthday,'2026-06-01','14:10',false),{start:'2026-06-01T14:10',end:'2026-06-01T15:10',allDay:false},'An all-day event converted to a timed one defaults to an hour');
assert.equal(eventSchedule(timed,'2026-02-30','09:00',true).start,'');
assert.equal(eventSchedule(timed,'','09:00',true).start,'');
assert.equal(eventSchedule(timed,'2026-05-31','',false).start,'');
assert.equal(eventSchedule(timed,'2026-05-31','24:10',false).start,'');
assert.equal(eventSchedule(timed,'2026-05-31','',true).start,'2026-05-31T00:00','An all-day event does not require a time');

const moved=moveEvent(birthday,new Date('2026-12-31T12:00'),15);
assert.equal(moved.start,'2026-12-31T00:00');assert.equal(moved.end,'2027-01-01T00:00');
assert.deepEqual(moved.extra,{preserve:true});assert.deepEqual(moved.tags,['Birthday']);assert.equal(moved.color,'none');
const multi={...birthday,start:'2026-05-10T00:00',end:'2026-05-12T00:00'};
const multiMoved=moveEvent(multi,new Date('2026-12-31T12:00'),18);
assert.equal(multiMoved.start,'2026-12-31T00:00');assert.equal(multiMoved.end,'2027-01-02T00:00','A legacy two-day span is preserved');
const shortMonth=moveEvent({...timed,start:'2026-01-31T13:45',end:'2026-01-31T16:15'},new Date('2026-02-01T12:00'));
assert.equal(shortMonth.start,'2026-02-01T13:45');assert.equal(shortMonth.end,'2026-02-01T16:15','Moving from the 31st into a shorter month does not overflow');

const originalTZ=process.env.TZ;
try{
 process.env.TZ='Europe/Berlin';
 for(const value of ['2026-03-29','2026-10-25']){
  const day=new Date(value+'T12:00');
  const dst=moveEvent(birthday,day,9);
  assert.equal(dst.start,value+'T00:00');
  assert.equal(dst.end,dateKey(addDays(day,1))+'T00:00');
  assert(!intersects(dst,addDays(day,1)),'A DST shift must not produce a phantom second day');
  const twoDays=moveEvent(multi,day,14);
  assert.equal(twoDays.end,dateKey(addDays(day,2))+'T00:00');
 }
 assert.equal(eventSchedule(timed,'2026-03-29','02:30',false).start,'','A nonexistent local time is rejected rather than silently shifted');
 process.env.TZ='America/Los_Angeles';
 const west=eventSchedule(timed,'2026-05-31','12:00',true);
 assert.equal(west.start,'2026-05-31T00:00');assert.equal(west.end,'2026-06-01T00:00','Date-only input is parsed as local time, not UTC');
}finally{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;}
console.log('PASS all-day engine: local date, exclusive midnight, hour-independent drag, month/year boundaries, legacy multi-day spans, invalid dates, DST and negative UTC offset.');
