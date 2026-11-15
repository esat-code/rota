const MATH = {id:'math', name:'Temel matematik', kind:'group'};
const MAX_PDF = 30 * 1024 * 1024;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
let dbPromise, readerPromise, started = false, entries = [], groupId = MATH.id, noteId = '', page = 1;
let pdf, pdfId, pdfPending;
let problem = '';

function database() {
  return dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('rota-yks-note-library-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('entries', {keyPath:'id'});
      request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function list() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('entries').objectStore('entries').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function write(entry, file) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(file ? ['entries', 'files'] : 'entries', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore('entries').add(entry);
    if (file) transaction.objectStore('files').add(file, entry.id);
  });
}

async function readFile(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('files').objectStore('files').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function notesLibraryHTML(mathHTML) {
  const groups = [MATH, ...entries.filter(entry => entry.kind === 'group').sort((a,b) => a.created-b.created)];
  const current = groups.find(group => group.id === groupId) || MATH;
  const notes = entries.filter(entry => entry.groupId === current.id).sort((a,b) => a.created-b.created);
  const active = notes.find(note => note.id === noteId);
  return `
    <div class="heading"><div><div class="eyebrow">YKS / NOTLARIM</div><h1>Notlar.</h1><p class="subtitle">Defterlerin, yazılı notların ve PDF’lerin.</p></div></div>
    <section class="note-groups" aria-label="Not grupları">
      <div class="row note-group-tabs">${groups.map(group => `<button type="button" data-note-group="${escape(group.id)}" aria-pressed="${group.id === current.id}">${escape(group.name)}</button>`).join('')}</div>
      <form id="note-group-form" class="note-add-row">
        <label>Grup adı <input name="name" required maxlength="64" placeholder="Yeni grup adı"></label>
        <button type="submit">Grup ekle</button>
      </form>
    </section>
    <section class="note-group-panel" aria-label="${escape(current.name)}">
      <h2>${escape(current.name)}</h2>
      <div class="note-group-actions">
        <details><summary>Yazılı not ekle</summary>
          <form id="note-text-form"><label>Başlık <input name="title" required maxlength="120"></label>
            <label>Not <textarea name="text" required maxlength="30000" rows="5"></textarea></label>
            <button type="submit">Notu kaydet</button></form>
        </details>
        <details><summary>PDF ekle</summary>
          <form id="note-pdf-form"><label>PDF dosyası <input name="file" type="file" accept="application/pdf,.pdf" required></label>
            <button type="submit">PDF’yi kaydet</button><small>En fazla 30 MB. PDF bu cihazda saklanır.</small></form>
        </details>
      </div>
      <p class="note-library-status" role="status">${escape(problem)}</p>
      ${notes.length ? `<div class="row note-list">${current.id === MATH.id ? '<button type="button" data-note-file="">Matematik defteri</button>' : ''}${notes.map(note => `<button type="button" data-note-file="${escape(note.id)}" aria-pressed="${note === active}"><small>${note.kind === 'pdf' ? 'PDF' : 'NOT'}</small> ${escape(note.title)}</button>`).join('')}</div>` : ''}
      ${active?.kind === 'text' ? `<article class="note-text"><h3>${escape(active.title)}</h3><p>${escape(active.text)}</p></article>`
        : active?.kind === 'pdf' ? `<section class="note-pdf-view" data-pdf-id="${escape(active.id)}"><h3>${escape(active.title)}</h3>
          <div class="row"><button type="button" data-pdf-step="-1" disabled>‹ Önceki</button><span role="status" class="note-pdf-status">PDF açılıyor…</span><button type="button" data-pdf-step="1" disabled>Sonraki ›</button></div>
          <canvas aria-label="PDF sayfası"></canvas></section>`
        : current.id === MATH.id ? mathHTML() : '<p>Bu gruba yazılı not veya PDF ekleyebilirsin.</p>'}
    </section>`;
}

function loadReader() {
  return readerPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './assets/notes-pdf-reader.js';
    script.onload = () => window.rotaNotesPDF ? resolve(window.rotaNotesPDF) : reject(Error('PDF okuyucu açılamadı.'));
    script.onerror = () => reject(Error('PDF okuyucu yüklenemedi.'));
    document.head.append(script);
  }).catch(error => { readerPromise = undefined; throw error; });
}

export function updateNotesLibrary(redraw) {
  if (!started) {
    started = true;
    list().then(value => { entries = value; redraw(); }).catch(() => {
      problem = 'Not grupları okunamadı. Mevcut dosyalar korunuyor.';
      redraw();
    });
  }
  const panel = document.querySelector('.note-pdf-view');
  if (panel) void renderPdf(panel);
}

async function renderPdf(panel) {
  const id = panel.dataset.pdfId;
  const status = panel.querySelector('.note-pdf-status');
  try {
    if (id !== pdfId) {
      if (pdfPending) await pdfPending;
      if (!panel.isConnected) return;
      if (id !== pdfId) {
        pdfPending = (async () => {
          const [reader, file] = await Promise.all([loadReader(), readFile(id)]);
          if (!file) throw Error('PDF bu cihazda bulunamadı.');
          const document = await reader(new Uint8Array(file));
          await pdf?.destroy();
          pdf = document;
          pdfId = id;
        })();
        try { await pdfPending; } finally { pdfPending = undefined; }
      }
    }
    if (!panel.isConnected) return;
    const number = Math.min(Math.max(1, page), pdf.numPages);
    const sheet = await pdf.getPage(number);
    if (!panel.isConnected) return;
    const canvas = panel.querySelector('canvas');
    const base = sheet.getViewport({scale:1});
    const width = Math.min(panel.clientWidth - 24, 1100);
    const viewport = sheet.getViewport({scale:Math.max(0.05, width * Math.min(devicePixelRatio, 2) / base.width)});
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await sheet.render({canvas, viewport}).promise;
    if (!panel.isConnected) return;
    status.textContent = `${number} / ${pdf.numPages}`;
    panel.querySelector('[data-pdf-step="-1"]').disabled = number === 1;
    panel.querySelector('[data-pdf-step="1"]').disabled = number === pdf.numPages;
  } catch (error) {
    if (panel.isConnected) status.textContent = error.message || 'PDF açılamadı.';
  }
}

export function libraryClick(button, redraw) {
  if (button.hasAttribute('data-note-group')) {
    groupId = button.dataset.noteGroup;
    noteId = '';
  } else if (button.hasAttribute('data-note-file')) {
    noteId = button.dataset.noteFile;
    page = 1;
  } else if (button.dataset.pdfStep) {
    page += Number(button.dataset.pdfStep);
  } else return false;
  problem = '';
  redraw();
  return true;
}

export async function saveLibraryForm(form, redraw) {
  const button = form.querySelector('button[type=submit]');
  const status = document.querySelector('.note-library-status');
  const values = new FormData(form);
  const group = groupId;
  const entry = {id:crypto.randomUUID(), created:Date.now()};
  button.disabled = true;
  if (status) status.textContent = '';
  try {
    let file;
    if (form.id === 'note-group-form') {
      entry.kind = 'group';
      entry.name = String(values.get('name') ?? '').trim();
      if (!entry.name) throw Error('Bir grup adı yaz.');
      if ([MATH, ...entries].some(item => item.kind === 'group' && item.name.toLocaleLowerCase('tr') === entry.name.toLocaleLowerCase('tr'))) throw Error('Bu grup zaten var.');
    } else if (form.id === 'note-pdf-form') {
      file = values.get('file');
      if (!(file instanceof File) || !file.size || file.size > MAX_PDF) throw Error('30 MB veya daha küçük bir PDF seç.');
      const title = file.name;
      file = await file.arrayBuffer();
      if (!new TextDecoder().decode(file.slice(0,1024)).includes('%PDF-')) throw Error('Seçtiğin dosya bir PDF değil.');
      Object.assign(entry, {groupId:group, kind:'pdf', title});
    } else {
      const title = String(values.get('title') ?? '').trim();
      const text = String(values.get('text') ?? '').trim();
      if (!title || !text) throw Error('Başlık ve not yaz.');
      Object.assign(entry, {groupId:group, kind:'text', title, text});
    }
    await write(entry, file);
    entries.push(entry);
    if (form.isConnected) {
      if (entry.kind === 'group') { groupId = entry.id; noteId = ''; }
      else { noteId = entry.id; page = 1; }
      problem = '';
      redraw();
    }
  } catch (error) {
    if (status?.isConnected) status.textContent = error.message || 'Not kaydedilemedi.';
  } finally {
    button.disabled = false;
  }
}
