import {savedRecords, saveRecords, recordFile, importRecordFile, pdfReader} from './record-store.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sections = {other:'Genel',yks:'YKS Ders Takibi',russian:'Rusça',hafizlik:'Çalışma Alanı',sport:'Spor',calendar:'Takvim'};
const types = {note:'Not',question:'Soru',document:'Belge',other:'Diğer'};
const options = (values, selected) => Object.entries(values).map(([value,label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');

export function createRecordLibrary(container, redraw) {
  let entries = [], loading, problem = '', currentSection = 'all', currentQuery = '';
  let drafts = [], files = new Map(), busy = false, previewGeneration = 0;
  const previewURLs = new Set();
  const editor = document.createElement('dialog');
  editor.className = 'record-editor';
  editor.setAttribute('aria-label','Kayıt ekle veya düzenle');
  document.body.append(editor);

  async function load() {
    try {entries = await savedRecords(); problem = '';}
    catch {problem = 'Eklediğin içerikler okunamadı. Yenile ile tekrar deneyebilirsin.';}
    redraw();
  }

  function render(section, query) {
    currentSection = section; currentQuery = query;
    if (!loading) loading = load();
    const matching = entries.filter(entry => (section === 'all' || entry.section === section) &&
      [entry.title,entry.topic,entry.text,sections[entry.section]].join(' ').toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
    const topics = [...new Set(matching.map(entry => entry.topic || 'Genel'))].sort((a,b) => a.localeCompare(b,'tr'));
    container.innerHTML = `<div class="records-panel-heading"><h2>Kaydettiğim içerikler</h2><span>${matching.length} kayıt</span></div>
      <div class="record-add-actions"><button type="button" data-library="note">+ Not ekle</button>
        <label class="record-file-button" tabindex="0">Dosya ekle<input class="sr-only" data-library-files type="file" accept="application/pdf,image/*,text/plain,.md,.heic,.heif" multiple></label>
        <label class="record-file-button record-camera" tabindex="0">Fotoğraf çek<input class="sr-only" data-library-camera type="file" accept="image/*" capture="environment"></label></div>
      <p class="records-note">Not, soru, fotoğraf ve PDF. Toplu eklemeler konularına göre hazırlanır. Dosyalar bu cihazda saklanır.</p>
      ${problem ? `<p class="records-error" role="status">${escape(problem)}</p><button type="button" data-library="reload">Yenile</button>` : ''}
      ${topics.map(topic => {
        const items = matching.filter(entry => (entry.topic || 'Genel') === topic).sort((a,b) => b.created-a.created || (a.page || 0)-(b.page || 0));
        return `<details class="record-topic" open><summary>${escape(topic)} <span>${items.length}</span></summary>
          <div class="record-cards">${items.map(entry => `<button type="button" class="record-item" data-library-id="${escape(entry.id)}"><small>${escape(types[entry.type] || 'Diğer')} · ${escape(sections[entry.section] || 'Genel')}</small><strong>${escape(entry.title)}</strong>${entry.text ? `<span>${escape(entry.text.slice(0,140))}</span>` : ''}</button>`).join('')}</div></details>`;
      }).join('') || '<p class="records-empty">Buraya kendi notlarını, sorularını veya dosyalarını ekleyebilirsin.</p>'}`;
  }

  function close() {
    previewGeneration++;
    for (const url of previewURLs) URL.revokeObjectURL(url);
    previewURLs.clear();
  }
  editor.addEventListener('close', close);
  editor.addEventListener('cancel', event => {if (busy) event.preventDefault();});

  function showDrafts(message = '') {
    editor.innerHTML = `<header class="records-header"><h2>${drafts.length === 1 ? 'Kaydı düzenle' : 'Toplu ekleme'}</h2><button type="button" data-editor="close">Vazgeç</button></header>
      <p class="records-note">Metni ve konu önerisini kontrol et. El yazısı ve matematik sembolleri düzeltme gerektirebilir.</p>
      <p class="record-import-status" role="status">${escape(message)}</p>
      <div class="record-drafts">${drafts.map((entry,index) => `<details class="record-draft" ${drafts.length === 1 ? 'open' : ''}><summary>${escape(entry.title || 'Yeni not')} <span>${escape(entry.topic || 'Genel')}</span></summary>
        <form data-draft="${index}"><label>Başlık<input name="title" required maxlength="200" value="${escape(entry.title)}"></label>
          <div class="record-form-row"><label>Bölüm<select name="section">${options(sections,entry.section)}</select></label><label>Tür<select name="type">${options(types,entry.type)}</select></label></div>
          <label>Konu<input name="topic" required maxlength="120" value="${escape(entry.topic || 'Genel')}"></label>
          <label>Dijital metin<textarea name="text" rows="8" maxlength="500000">${escape(entry.text)}</textarea></label>
          ${entry.warning ? `<p class="records-error">${escape(entry.warning)}</p>` : ''}
          ${entry.fileId ? `<button type="button" data-preview-draft="${index}">Orijinali göster</button><div class="record-original" data-draft-preview="${index}"></div>` : ''}
        </form></details>`).join('')}</div>
      <p class="record-save-status" role="status"></p>
      <button type="button" class="record-save" data-editor="save">${drafts.length > 1 ? drafts.length + ' kaydı' : 'Kaydı'} kaydet</button>`;
  }

  function openNote() {
    drafts = [{id:crypto.randomUUID(),title:'',topic:'Genel',section:currentSection === 'all' ? 'other' : currentSection,type:'note',text:'',created:Date.now()}];
    files = new Map();
    showDrafts(); editor.showModal();
  }

  async function importFiles(selected) {
    if (!selected.length) return;
    drafts = []; files = new Map(); busy = true;
    editor.innerHTML = '<h2>İçerikler hazırlanıyor</h2><p class="record-import-status" role="status"></p>';
    editor.showModal();
    const errors = [];
    try {
      for (const file of selected) {
        const status = editor.querySelector('.record-import-status');
        status.textContent = file.name + ' okunuyor…';
        try {
          const imported = await importRecordFile(file, text => {status.textContent = text;});
          drafts.push(...imported.entries);
          for (const [id,blob] of imported.files) files.set(id,blob);
        } catch (error) {errors.push(file.name + ' · ' + error.message);}
      }
      showDrafts(errors.join('\n') || (drafts.length + ' kayıt hazır. Konuları ve metinleri kontrol ederek kaydet.'));
      if (!drafts.length) editor.querySelector('[data-editor="save"]').disabled = true;
    } finally {busy = false;}
  }

  async function showOriginal(entry, target) {
    const generation = ++previewGeneration;
    target.textContent = 'Açılıyor…';
    try {
      const file = files.get(entry.fileId) || await recordFile(entry.fileId);
      if (!file) throw Error('Orijinal dosya bulunamadı.');
      if (generation !== previewGeneration || !target.isConnected) return;
      target.replaceChildren();
      if (entry.mime === 'application/pdf') {
        const reader = await pdfReader();
        const pdf = await reader(new Uint8Array(await file.arrayBuffer()));
        try {
          const sheet = await pdf.getPage(entry.page || 1);
          const base = sheet.getViewport({scale:1});
          const viewport = sheet.getViewport({scale:Math.min(2, (target.clientWidth || 600) / base.width)});
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          target.append(canvas);
          await sheet.render({canvas,viewport}).promise;
        } finally {await pdf.destroy();}
      } else if (entry.mime?.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(entry.fileName)) {
        const url = URL.createObjectURL(file);
        previewURLs.add(url);
        const image = document.createElement('img'); image.src = url; image.alt = entry.title;
        target.append(image);
      } else {target.textContent = entry.text || 'Dosya kaydedildi.';}
    } catch (error) {if (target.isConnected) target.textContent = error.message || 'Dosya açılamadı.';}
  }

  container.addEventListener('keydown', event => {
    const label = event.target.closest('.record-file-button');
    if (label && ['Enter',' '].includes(event.key)) {event.preventDefault(); label.querySelector('input').click();}
  });
  container.addEventListener('change', event => {
    if (!event.target.matches('[data-library-files],[data-library-camera]')) return;
    const selected = [...event.target.files]; event.target.value = '';
    void importFiles(selected);
  });
  container.addEventListener('click', event => {
    const action = event.target.closest('[data-library]')?.dataset.library;
    if (action === 'note') openNote();
    if (action === 'reload') void load();
    const id = event.target.closest('[data-library-id]')?.dataset.libraryId;
    if (id) {
      drafts = [structuredClone(entries.find(entry => entry.id === id))]; files = new Map();
      showDrafts(); editor.showModal();
    }
  });
  editor.addEventListener('submit', event => event.preventDefault());
  editor.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || busy) return;
    if (button.dataset.editor === 'close') {editor.close(); return;}
    if (button.hasAttribute('data-preview-draft')) {
      const index = Number(button.dataset.previewDraft);
      await showOriginal(drafts[index],editor.querySelector(`[data-draft-preview="${index}"]`));
      return;
    }
    if (button.dataset.editor !== 'save') return;
    const forms = [...editor.querySelectorAll('form[data-draft]')];
    for (const form of forms) {
      const details = form.closest('details');
      details.open = true;
      for (const name of ['title','topic']) {
        const input = form.elements.namedItem(name);
        input.setCustomValidity(input.value.trim() ? '' : 'Bu alanı doldur.');
        input.oninput = () => input.setCustomValidity('');
      }
      if (!form.reportValidity()) return;
    }
    const next = forms.map((form,index) => {
      const values = new FormData(form);
      const entry = {...drafts[index],updated:Date.now()};
      for (const key of ['title','topic','section','type','text']) entry[key] = String(values.get(key) || '').trim();
      delete entry.warning;
      return entry;
    });
    busy = true; button.disabled = true;
    try {
      await saveRecords(next,files);
      entries = await savedRecords();
      editor.close();
      render(currentSection,currentQuery);
    } catch {
      editor.querySelector('.record-save-status').textContent = 'Kaydedilemedi. İçerikler burada duruyor, tekrar deneyebilirsin.';
    } finally {busy = false; button.disabled = false;}
  });
  return {render};
}
