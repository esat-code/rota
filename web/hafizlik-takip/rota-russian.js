(() => {
  'use strict';

  const home = document.getElementById('rota-home');
  if (!home || document.getElementById('rota-russian')) return;
  const key = 'rota-russian-v1';

  const vocabulary = {};
  const seed = { words: [], notes: [] };
  for (const [topic, rows] of Object.entries(vocabulary)) {
    for (const [index, row] of rows.trim().split('\n').entries()) {
      const [russian, turkish] = row.split('|');
      seed.words.push({ id: `word:${topic}:${index}`, topic, russian, turkish });
    }
  }
  grammar.forEach(([title, text], index) => seed.notes.push({ id: `note:${index}`, title, text }));

  const host = document.createElement('div');
  host.id = 'rota-russian';
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `
    <style>
      dialog{box-sizing:border-box;margin:0;width:100%;height:100%;height:100dvh;max-width:none;max-height:none;border:0;padding:0;background:#101419;color:#f2f5fa;color-scheme:dark;font:16px/1.5 system-ui,sans-serif;overscroll-behavior:contain}
      dialog::backdrop{background:#101419}
      *{box-sizing:border-box}
      .shell{max-width:1120px;margin:auto;padding:clamp(16px,4vw,48px);padding-top:max(18px,env(safe-area-inset-top));padding-bottom:max(28px,env(safe-area-inset-bottom))}
      .top{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .brand{font-size:12px;letter-spacing:.12em;color:#a8bbd1}
      h1,h2,h3,p{margin:0}
      h1{font-size:clamp(38px,7vw,68px);letter-spacing:-.05em;line-height:1.08;margin:20px 0 8px}
      h2{font-size:19px;margin:0 0 10px}
      h3{font-size:17px}
      .sub{color:#adbac9}
      .tabs,.tools,.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .tabs{margin:24px 0 14px;border-bottom:1px solid #303943;padding-bottom:12px}
      button,input,textarea,select{font:inherit;color:inherit}
      button,input,textarea,select{border:1px solid #3d4a58;border-radius:10px;background:#1a222b;padding:10px 13px}
      button{cursor:pointer;min-height:44px}
      button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #85b9ff;outline-offset:2px}
      button[aria-pressed="true"]{background:#233e61;border-color:#88b8fb}
      .primary{background:#a9cdff;color:#0c1e34;border-color:#a9cdff;font-weight:650}
      .tools input{flex:2 1 200px;min-width:0}
      .tools select{flex:1 1 140px;min-width:0}
      .tools button{flex:0 1 auto}
      .speech{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:12px;color:#c1cbd9}
      .speech label{display:flex;align-items:center;gap:8px}
      .speech input{padding:0;accent-color:#a9cdff}
      #speed{width:115px}
      .speech output{min-width:3ch;font-variant-numeric:tabular-nums}
      article .pronounce{display:flex;align-items:center;text-align:left;gap:8px;border:0;padding:0;color:#c6dfff;font-size:inherit;font-weight:inherit;overflow-wrap:anywhere}
      .pronounce:hover{text-decoration:underline}
      .syllables{font-size:14px;color:#a9cdff;display:block}
      .count{margin:14px 0;color:#a8bbd1;font-size:14px}
      .group{margin:0 0 20px}
      .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      article{min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;background:#171d25;border:1px solid #303943;border-radius:13px;padding:12px 14px;overflow-wrap:anywhere}
      article p{color:#c1cbd9;font-size:15px;white-space:pre-wrap}
      article button{font-size:13px;padding:6px 9px;background:transparent}
      .notes{display:grid;gap:10px;margin-top:16px}
      .notes p{margin-top:7px}
      form{display:grid;gap:12px;background:#171d25;border:1px solid #303943;border-radius:13px;padding:16px;margin:14px 0}
      [hidden]{display:none!important}
      label{display:grid;gap:4px}
      textarea{resize:vertical;min-height:120px}
      .status{color:#ffd090;margin:8px 0}
      .status:empty{display:none}
      @media(max-width:620px){.cards{grid-template-columns:1fr}.tools button{flex:1 1 100%}.tools input,.tools select{width:100%;flex:1 1 100%}.notes article{flex-wrap:wrap}}
    </style>
    <dialog aria-labelledby="russian-title">
      <main class="shell">
        <header>
          <div class="top"><button type="button" id="back">‹ Ana sayfa</button><span class="brand">ROTA · РУССКИЙ</span></div>
          <h1 id="russian-title">Rusça</h1>
          <p class="sub">Kelimeler, ifadeler ve dilbilgisi notların.</p>
        </header>
        <nav class="tabs" aria-label="Rusça bölümleri">
          <button type="button" id="words" aria-pressed="true">Sözlük</button>
          <button type="button" id="notes" aria-pressed="false">Dilbilgisi</button>
        </nav>
        <div class="tools">
          <input type="search" id="query" aria-label="Sözlükte ara" placeholder="Rusça veya Türkçe ara">
          <select id="topic" aria-label="Konu"></select>
          <button type="button" class="primary" id="add">+ Kelime ekle</button>
        </div>
        <div class="speech">
          <label>Hız <input id="speed" type="range" min="0.6" max="1.2" step="0.1" value="1"><output for="speed"></output></label>
          <label><input id="syllabify" type="checkbox"> Hece hece oku</label>
          <button type="button" id="stop">Sesi durdur</button>
        </div>
        <p class="status" role="status"></p>
        <form hidden></form>
        <div id="results"></div>
      </main>
    </dialog>`;
  document.body.append(host);

  const $ = selector => shadow.querySelector(selector);
  const dialog = $('dialog');
  const form = $('form');
  const query = $('#query');
  const topic = $('#topic');
  const results = $('#results');
  const changes = loadChanges();
  let tab = 'words';
  let editing = null;
  let opener;

  function loadChanges() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && Array.isArray(saved.words) && Array.isArray(saved.notes)) return saved;
    } catch {}
    return {words:[], notes:[]};
  }

  function records(section) {
    return [...new Map([...seed[section], ...changes[section]].map(item => [item.id,item])).values()];
  }

  const searchText = value => value.normalize('NFC').toLowerCase().replace(/[ıİ]/g,'i').replace(/ё/g,'е');
  const node = (tag, value) => {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = value;
    return element;
  };


  const speed = $('#speed');
  const syllabify = $('#syllabify');
  const speechKey = 'rota-russian-speech-v1';
  let speechRequest = 0;
  try {
    const settings = JSON.parse(localStorage.getItem(speechKey));
    if (settings) {
      speed.value = settings.speed;
      syllabify.checked = settings.syllabify === true;
    }
  } catch {}

  function updateSpeed() {
    const label = Number(speed.value).toLocaleString('tr-TR') + '×';
    $('output').textContent = label;
    speed.setAttribute('aria-valuetext', label);
  }
  function saveSpeechSettings() {
    try {
      localStorage.setItem(speechKey,JSON.stringify({speed:speed.value,syllabify:syllabify.checked}));
    } catch {}
  }

  const vowel = /[аеёиоуыэюя]/i;
  // Use a vowel nucleus, retaining й and a sonorant before a noisier consonant.
  function splitWord(word) {
    const letters = Array.from(word.normalize('NFC').match(/.\p{Mark}*/gu) ?? []);
    const syllables = [];
    let start = 0;
    let previousVowel = -1;
    for (let index = 0; index < letters.length; index++) {
      if (!vowel.test(letters[index])) continue;
      if (previousVowel >= 0) {
        let boundary = previousVowel + 1;
        for (let cursor = boundary; cursor < index; cursor++) {
          const current = letters[cursor];
          const next = /^[ьъ]$/i.test(letters[cursor + 1]) ? cursor + 2 : cursor + 1;
          if (/^й$/i.test(current) || (/^[рлмн]$/i.test(current) && next < index && !/^[рлмнй]$/i.test(letters[next]))) {
            boundary = next;
          }
        }
        syllables.push(letters.slice(start,boundary).join(''));
        start = boundary;
      }
      previousVowel = index;
    }
    syllables.push(letters.slice(start).join(''));
    return syllables;
  }

  const russianWords = /[а-яё][а-яё\p{Mark}]*/giu;
  function speechParts(text) {
    const parts = [];
    let prefix = '';
    for (const word of text.match(russianWords) ?? []) {
      if (!vowel.test(word)) {
        prefix += word + ' ';
        continue;
      }
      for (const part of splitWord(word)) {
        parts.push(prefix + part);
        prefix = '';
      }
    }
    if (prefix.trim()) parts.push(prefix.trim());
    return parts.length ? parts : [text];
  }

  async function speak(text) {
    const request = ++speechRequest;
    const status = $('.status');
    status.textContent = '';
    try {
      const voice = window.webkit?.messageHandlers?.rotaRussianSpeech;
      if (!voice) throw Error('Rusça seslendirme için güncel Rota uygulamasını aç.');
      await voice.postMessage({parts:syllabify.checked ? speechParts(text) : [text],speed:Number(speed.value)});
    } catch (error) {
      if (request === speechRequest) status.textContent = error.message || 'Seslendirme başlatılamadı.';
    }
  }
  function stopSpeech() {
    speechRequest++;
    window.webkit?.messageHandlers?.rotaRussianSpeech?.postMessage({action:'stop'})?.catch(() => {});
  }

  updateSpeed();
  speed.addEventListener('input',updateSpeed);
  speed.addEventListener('change',saveSpeechSettings);
  syllabify.addEventListener('change',() => {saveSpeechSettings();render();});
  $('#stop').addEventListener('click',stopSpeech);

  function card(record) {
    const article = node('article');
    const copy = node('div');
    const title = node('h3', record.russian ?? record.title);
    if (record.russian) {
      title.lang = 'ru';
      const play = node('button',record.russian);
      play.type = 'button';
      play.className = 'pronounce';
      play.setAttribute('aria-label', `${record.russian} — dinle`);
      const speaker = node('span','🔊');
      speaker.setAttribute('aria-hidden','true');
      play.append(speaker);
      play.addEventListener('click',() => speak(record.russian));
      title.replaceChildren(play);
    }
    copy.append(title);
    if (record.russian && syllabify.checked) {
      const syllables = node('span',record.russian.replace(russianWords,word => splitWord(word).join('·')));
      syllables.className = 'syllables';
      syllables.lang = 'ru';
      copy.append(syllables);
    }
    copy.append(node('p',record.turkish ?? record.text));
    const edit = node('button','Düzenle');
    edit.type = 'button';
    edit.setAttribute('aria-label', `${record.russian ?? record.title} kaydını düzenle`);
    edit.addEventListener('click', () => showEditor(record));
    article.append(copy,edit);
    return article;
  }

  function render() {
    const isDictionary = tab === 'words';
    query.hidden = topic.hidden = $('.speech').hidden = !isDictionary;
    $('#add').textContent = isDictionary ? '+ Kelime ekle' : '+ Ders notu ekle';
    $('#words').setAttribute('aria-pressed', String(isDictionary));
    $('#notes').setAttribute('aria-pressed', String(!isDictionary));
    results.replaceChildren();
    if (!isDictionary) {
      const notes = node('div');
      notes.className = 'notes';
      notes.append(...records(tab).map(card));
      results.append(notes);
      return;
    }
    const words = records(tab);
    const topics = [...new Set(words.map(word => word.topic))];
    const selected = topic.value;
    topic.replaceChildren(new Option('Bütün konular',''), ...topics.map(name => new Option(name,name)));
    topic.value = topics.includes(selected) ? selected : '';
    const needle = searchText(query.value.trim());
    const found = words.filter(word => (!topic.value || word.topic === topic.value) &&
      searchText(`${word.russian} ${word.turkish} ${word.topic}`).includes(needle));
    const count = node('p',found.length ? `${found.length} kelime ve ifade` : 'Aramana uyan kayıt bulunamadı.');
    count.className = 'count';
    results.append(count);
    for (const name of topics) {
      const group = found.filter(word => word.topic === name);
      if (!group.length) continue;
      const section = node('section');
      section.className = 'group';
      const cards = node('div');
      cards.className = 'cards';
      cards.append(...group.map(card));
      section.append(node('h2',name),cards);
      results.append(section);
    }
  }

  function showEditor(record) {
    editing = record ?? null;
    const isDictionary = tab === 'words';
    form.innerHTML = isDictionary ? `
      <h2></h2>
      <label>Rusça<input name="russian" lang="ru" required maxlength="240"></label>
      <label>Türkçe karşılığı<input name="turkish" required maxlength="400"></label>
      <label>Konu<input name="topic" list="russian-topics" required maxlength="80" placeholder="Konu seç veya yeni konu yaz"></label>
      <datalist id="russian-topics"></datalist>` : `
      <h2></h2>
      <label>Başlık<input name="title" required maxlength="120"></label>
      <label>Ders notu<textarea name="text" rows="6" required maxlength="20000" placeholder="Kuralı ve örneklerini yaz"></textarea></label>`;
    form.insertAdjacentHTML('beforeend','<div class="actions"><button class="primary" type="submit">Kaydet</button><button type="button" id="cancel-edit">Vazgeç</button></div>');
    form.querySelector('h2').textContent = record ? 'Kaydı düzenle' : isDictionary ? 'Kelime veya ifade ekle' : 'Ders notu ekle';
    if (isDictionary) {
      const names = [...new Set(records('words').map(word => word.topic))];
      for (const name of names) form.querySelector('datalist').append(new Option(name,name));
      form.elements.topic.value = record?.topic ?? topic.value;
    }
    if (record) {
      for (const field of form.querySelectorAll('[name]')) field.value = record[field.name];
    }
    $('.status').textContent = '';
    form.hidden = false;
    $('#cancel-edit').addEventListener('click', () => {form.hidden = true; $('#add').focus();});
    form.scrollIntoView({block:'nearest'});
    form.querySelector('input').focus();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const fields = Object.fromEntries([...new FormData(form)].map(([name,value]) => [name,value.trim()]));
    if (Object.values(fields).some(value => !value)) {
      $('.status').textContent = 'Bütün alanları doldur.';
      return;
    }
    const id = editing?.id ?? `user:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const next = [...changes[tab].filter(item => item.id !== id), {id,...fields}];
    try {
      localStorage.setItem(key,JSON.stringify({...changes,[tab]:next}));
    } catch {
      $('.status').textContent = 'Kayıt yapılamadı. Yazdıkların formda duruyor.';
      return;
    }
    changes[tab] = next;
    if (tab === 'words') {
      query.value = '';
      render();
      topic.value = fields.topic;
    }
    form.hidden = true;
    render();
    $('.status').textContent = 'Kaydedildi.';
    $('#add').focus();
  });

  for (const section of ['words','notes']) {
    $(`#${section}`).addEventListener('click', () => {
      if (section === 'notes') stopSpeech();
      tab = section;
      form.hidden = true;
      $('.status').textContent = '';
      render();
    });
  }
  $('#add').addEventListener('click', () => showEditor());
  query.addEventListener('input', render);
  topic.addEventListener('change', render);
  $('#back').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {stopSpeech();opener?.focus();});

  function connectPortal() {
    const portal = home.contentDocument?.getElementById('russian-placeholder');
    if (!portal || portal.dataset.russianReady) return;
    portal.dataset.russianReady = 'true';
    portal.classList.add('portal-link');
    portal.setAttribute('role','button');
    portal.setAttribute('aria-label','Rusça bölümünü aç');
    portal.tabIndex = 0;
    portal.addEventListener('click', () => {
      if (dialog.open) return;
      opener = portal;
      render();
      dialog.showModal();
      $('#back').focus();
    });
    portal.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      portal.click();
    });
  }
  home.addEventListener('load', connectPortal);
  connectPortal();
})();
