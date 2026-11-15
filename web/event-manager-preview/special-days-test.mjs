import assert from 'node:assert/strict';
import {getSpecialDays,specialDaysBetween,religiousCoverage,RELIGIOUS_YEARS,SOURCES} from './special-days.mjs';
const one=(year,title)=>getSpecialDays(year).filter(d=>d.title===title).map(d=>d.date);
assert.deepEqual(one(2026,'Anneler Günü'),['2026-05-10']);
assert.deepEqual(one(2027,'Anneler Günü'),['2027-05-09']);
assert.deepEqual(one(2026,'Babalar Günü'),['2026-06-21']);
assert.deepEqual(one(2027,'Babalar Günü'),['2027-06-20']);
assert.deepEqual(one(2026,'Dünya İlk Yardım Günü'),['2026-09-12']);
assert.deepEqual(one(2026,'Dünya Okul Sütü Günü'),['2026-09-30']);
assert.deepEqual(one(2027,'Dünya Okul Sütü Günü'),['2027-09-29']);
assert.deepEqual(one(2027,'Miraç Kandili'),['2027-01-04','2027-12-24']);
assert.deepEqual(one(2028,'Berat Kandili'),['2028-01-11','2028-12-30']);
assert.deepEqual(one(2026,'Ramazan Bayramı · 1. gün'),['2026-03-20']);
assert.deepEqual(one(2027,'Kurban Bayramı · 4. gün'),['2027-05-19']);
assert.deepEqual(one(2025,'Ramazan Bayramı · 3. gün'),['2025-04-01']);
assert.deepEqual(one(2026,'Regaib Kandili'),['2026-12-10']);
assert.equal(getSpecialDays(2026).filter(d=>d.date==='2026-12-10').length,3); // includes Human Rights Day
assert.ok(getSpecialDays(2027).find(d=>d.title==='Ramazan Bayramı arifesi').halfDay);
assert.ok(getSpecialDays(2026).find(d=>d.date==='2026-10-28').halfDay);
assert.deepEqual(RELIGIOUS_YEARS,[2025,2026,2027,2028,2029]);
assert.deepEqual(religiousCoverage([2026,2026,2030]),{available:[2026],missing:[2030],complete:false});
for(const year of [2024,...RELIGIOUS_YEARS,2030,2100]){
  const days=getSpecialDays(year);
  assert.equal(new Set(days.map(d=>d.id)).size,days.length);
  assert.equal(new Set(days.map(d=>d.date+' '+d.title)).size,days.length);
  assert.deepEqual(days.map(d=>d.date),days.map(d=>d.date).sort());
  for(const d of days){
    assert.ok(d.date.startsWith(year+'-'));
    const [y,m,n]=d.date.split('-').map(Number),parsed=new Date(y,m-1,n,12);
    assert.equal(parsed.getFullYear(),year);assert.equal(parsed.getMonth(),m-1);assert.equal(parsed.getDate(),n);
    assert.ok(['public','religious','observance'].includes(d.kind));
    assert.equal(d.category,undefined);assert.equal(d.start,undefined);assert.ok(d.source.startsWith('https://'));
  }
  assert.equal(days.some(d=>d.kind==='religious'),RELIGIOUS_YEARS.includes(year));
}
// Inclusive bounds, leap-day and year transition use local dates, regardless of TZ.
assert.equal(specialDaysBetween(new Date(2026,4,10,23),new Date(2026,4,10,23)).some(d=>d.title==='Anneler Günü'),true);
assert.deepEqual(specialDaysBetween(new Date(2028,1,29),new Date(2028,1,29)),[]);
assert.deepEqual(specialDaysBetween(new Date(2026,11,31),new Date(2027,0,1)).map(d=>d.title),['Yılbaşı']);
assert.deepEqual(specialDaysBetween(new Date(2027,0,2),new Date(2027,0,1)),[]);
assert.throws(()=>getSpecialDays(2026.5),RangeError);assert.throws(()=>getSpecialDays(99),RangeError);
assert.throws(()=>specialDaysBetween(new Date('invalid'),new Date()),TypeError);
const original=getSpecialDays(2026);original[0].title='mutated';assert.notEqual(getSpecialDays(2026)[0].title,'mutated');
assert.equal(SOURCES.length,12);
console.log('Özel gün testleri geçti:',RELIGIOUS_YEARS.map(y=>`${y}: ${getSpecialDays(y).length}`).join(', '));
