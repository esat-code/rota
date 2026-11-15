import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// DOM integration checks only: this does not claim a real-browser visual test.
const KEY = 'rota-event-manager-preview-v1';
const wait = () => new Promise(resolve => setTimeout(resolve, 60));
const instances = [];
async function launch(year = 2026, saved, specialPreferences) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost:8767', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  instances.push(dom);
  const w = dom.window;
  const NativeDate = w.Date;
  const now = +new NativeDate(year, 4, 10, 10, 0);
  w.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.confirm = () => true;
  if (saved !== undefined) w.localStorage.setItem(KEY, saved);
  if (specialPreferences !== undefined) w.localStorage.setItem(KEY+'-special-preferences', specialPreferences);
  w.eval(fs.readFileSync('dist/app.js', 'utf8'));
  await wait();
  return w;
}
async function clickText(doc, text) {
  const button = [...doc.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label')===text);
  assert(button, `Button exists: ${text}`);
  button.click();
  await wait();
}
function motherLabel(doc) {
  return [...doc.querySelectorAll('.special-day')].find(e => e.textContent.includes('Anneler Günü'));
}
function personalIds(w) {
  const raw = w.localStorage.getItem(KEY);
  return raw === null ? [] : JSON.parse(raw).map(e => e.id);
}

try {
  const w = await launch(), doc = w.document;
  assert.equal(doc.querySelectorAll('.month-cell').length, 42);
  assert(motherLabel(doc), 'Mother’s Day is annotated');
  assert.equal(motherLabel(doc).closest('.month-cell').querySelector('.day-number').textContent, '10');
  assert(!motherLabel(doc).closest('.month-cell').classList.contains('outside'));
  assert.equal(motherLabel(doc).tagName, 'SPAN', 'Special days are labels, not editable events');
  assert(!motherLabel(doc).closest('[draggable=true]'), 'Special dates cannot be dragged');
  motherLabel(doc).click();
  await wait();
  assert(!doc.querySelector('dialog').open, 'Clicking a special day does not open event editing');
  assert.equal(personalIds(w).length, 0, 'Merely viewing special dates does not save them as events');
  const importantButton=motherLabel(doc).querySelector('.special-important');
  importantButton.click();await wait();
  assert.equal(motherLabel(doc).querySelector('.special-important').getAttribute('aria-pressed'),'true');
  motherLabel(doc).querySelector('.special-hide').click();await wait();
  assert.equal(motherLabel(doc),undefined,'The unwanted built-in label can be hidden for its date');
  assert.equal(personalIds(w).length,0,'Hiding a label does not create or delete a personal event');
  const preferences=w.localStorage.getItem(KEY+'-special-preferences');
  const hidden=await launch(2026,undefined,preferences);
  assert.equal(motherLabel(hidden.document),undefined,'Hidden date labels stay hidden after reopening');
  assert(hidden.document.querySelector('.hidden-special-days'),'Hidden labels remain recoverable');
  await clickText(hidden.document,'Anneler Günü yazısını geri getir');
  assert(motherLabel(hidden.document),'The hidden label can be restored');
  assert.equal(motherLabel(hidden.document).querySelector('.special-important').getAttribute('aria-pressed'),'true','Restoring preserves the independent important preference');
  await clickText(doc,'Anneler Günü yazısını geri getir');
  assert([...doc.querySelectorAll('.filter label')].some(e=>e.textContent==='Genel'),'General is available');

  // Built-in labels are uncoloured: the same colour/tag filters apply.
  const filterPalette = doc.querySelector('.filter .color-palette');
  assert(filterPalette, 'Color filter uses a palette');
  assert.equal(filterPalette.textContent.trim(), '', 'Color names are not shown as visible text');
  assert.equal(filterPalette.querySelectorAll('button').length, 7);
  const filterSwatch = filterPalette.querySelector('button');
  assert(filterSwatch.getAttribute('aria-label'), 'Swatches keep an accessible name');
  filterSwatch.click();
  await wait();
  assert(!motherLabel(doc), 'Color filtering hides uncoloured General dates');
  filterSwatch.click();
  filterPalette.querySelector('[aria-label="Renksiz"]').click();
  await wait();
  assert(motherLabel(doc), 'Renksiz includes built-in uncoloured dates');
  await clickText(doc, 'Filtreleri temizle');

  await clickText(doc, 'Hafta');
  assert.equal(doc.querySelectorAll('.hour-slot').length, 168);
  assert(doc.querySelector('.special-days-band'), 'Week view has a separate special-day band');
  assert(motherLabel(doc));
  assert(!motherLabel(doc).closest('.time-columns'), 'Special-day annotations do not consume an hourly event slot');
  await clickText(doc, 'Gün');
  assert.equal(doc.querySelectorAll('.hour-slot').length, 24);
  assert(motherLabel(doc));
  assert(doc.querySelector('.special-days-band'));
  await clickText(doc, 'Liste');
  assert(motherLabel(doc));
  assert(motherLabel(doc).closest('.list-group').querySelector('h2').textContent.includes('10 Mayıs 2026'));

  // Creating/editing normal events still saves only normal event data.
  doc.querySelector('.event-card').click();
  await wait();
  assert(doc.querySelector('dialog').open);
  assert.equal(doc.querySelectorAll('select').length,0,'Category selection has been removed');
  assert.equal(doc.querySelectorAll('.category,.category-badge').length,0,'No category badges remain');
  assert.equal(doc.querySelectorAll('input[type="datetime-local"]').length,0,'Birleşik tarih/saat yerine ayrı alanlar var');
  assert.equal(doc.querySelectorAll('input[type="date"]').length,1,'Bitiş tarihi alanı kaldırılmış kalır');
  assert.equal(doc.querySelectorAll('input[type="time"]').length,1,'Saat seçimi korunur');
  const formPalette = doc.querySelector('dialog .color-palette');
  assert.equal(formPalette.getAttribute('role'), 'radiogroup');
  assert.equal(formPalette.textContent.trim(), '', 'Edit palette displays swatches, not color names');
  const formSwatches = [...formPalette.querySelectorAll('[role=radio]')];
  formSwatches[1].click();
  await wait();
  assert.equal(formSwatches[1].getAttribute('aria-checked'), 'true');
  assert.equal(formSwatches.filter(e => e.getAttribute('aria-checked') === 'true').length, 1);
  await clickText(doc, 'Kaydet');
  const saved = w.localStorage.getItem(KEY);
  assert.equal(JSON.parse(saved).find(e => e.id === 'sample-1').color, 'green');
  assert.deepEqual(personalIds(w).sort(), ['sample-1', 'sample-2', 'sample-3']);
  const restored = await launch(2026, saved);
  assert.deepEqual(personalIds(restored).sort(), ['sample-1', 'sample-2', 'sample-3']);
  assert(motherLabel(restored.document));

  await clickText(doc, 'Ay');
  for (let i = 0; i < 12; i++) {
    doc.querySelector('button[aria-label="Sonraki dönem"]').click();
    await wait();
  }
  assert(doc.querySelector('h1').textContent.includes('2027'));
  assert.equal(motherLabel(doc).closest('.month-cell').querySelector('.day-number').textContent, '9', 'Mother’s Day is recalculated for May 2027');
  assert(!motherLabel(doc).closest('.month-cell').classList.contains('outside'));
  await clickText(doc, 'Liste');
  assert(motherLabel(doc).closest('.list-group').querySelector('h2').textContent.includes('9 Mayıs 2027'));
  assert(!doc.querySelector('.list-view').textContent.includes('Ekip toplantısı'), 'List view does not leak personal events from other months');

  const unsupported = await launch(2100);
  assert(unsupported.document.querySelector('.special-days-notice'), 'Unsupported religious-date years are explicitly disclosed');
  assert(unsupported.document.querySelector('.special-days-notice').textContent.includes('2100'));
  assert(motherLabel(unsupported.document), 'Calculated/fixed special dates still work beyond religious-date coverage');
  console.log('Geçti: özel günlerin ay/hafta/gün/liste görünümü, hareketli tarih, Genel/Renksiz filtreleme, salt okunurluk, kişisel veriden ayrım, kategorisiz arayüz, erişilebilir renk paleti, renk kaydı ve yıl kapsamı uyarısı. (DOM testi.)');
} finally {
  for (const dom of instances) dom.window.close();
}
