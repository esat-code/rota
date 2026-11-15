import {storage} from './local-password.js';
import {createRecordLibrary} from './record-library.js';

const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const text = value => typeof value === 'string' ? value : '';
const join = values => values.filter(Boolean).join(' · ');
const sportTypes = {workout:'Antrenman', stretch:'Esneme', rest:'Dinlenme'};

function examNets(nets = {}) {
  return [['TYT',['tr','tm','ts','tf']], ['AYT',['am','af','ak','ab']]].map(([name, keys]) => {
    if (!keys.some(key => nets[key])) return '';
    const total = keys.reduce((sum, key) => {
      const correct = Number(nets[key]?.correct || 0), wrong = Number(nets[key]?.wrong || 0);
      return sum + (Number.isFinite(correct) && Number.isFinite(wrong) ? correct - wrong / 4 : 0);
    }, 0);
    return name + ' ' + total.toLocaleString('tr-TR', {maximumFractionDigits:2}) + ' net';
  });
}

export function collectRecords(store, legacyChecks = []) {
  const errors = [];
  function read(key, name) {
    try { return JSON.parse(store.getItem(key) || 'null'); }
    catch { errors.push(name + ' kayıtları okunamadı.'); return null; }
  }
  const calendar = read('rota-event-manager-preview-v1', 'Takvim');
  const yks = read('rota-yks-v1', 'YKS');
  const hafizlik = read('hafizlik-takip-v1', 'Çalışma Alanı');
  const sport = read('rota-sport-preview-v1', 'Spor');
  const sections = [
    {id:'calendar', name:'Takvim', icon:'▦', rows:list(calendar).filter(e => !['rota-yks','rota-sport'].includes(e.source)).map(e => ({
      title:text(e.title), date:text(e.start), detail:join([text(e.category), text(e.description)]),
    }))},
    {id:'yks', name:'YKS Ders Takibi', icon:'↗', rows:[
      ...list(yks?.plan?.tasks).filter(t => t.done).map(t => ({
        title:text(t.title), date:text(t.completedDate),
        detail:join(['Tamamlandı',text(t.subject),t.day ? t.day + '. gün' : '',t.minutes ? t.minutes + ' dk' : '',text(t.note)]),
      })),
      ...list(yks?.attempts).map(a => ({title:text(a.title), date:text(a.date), detail:join(['Deneme', ...examNets(a.nets)])})),
    ]},
    {id:'hafizlik', name:'Çalışma Alanı', icon:'↗', rows:hafizlik ? [
      ...legacyChecks.map(row => ({title:row.title, detail:row.checked ? 'Tamamlandı' : 'Bekliyor', checked:row.checked})),
      ...list(hafizlik.design?.nodes).filter(n => n.type === 'checklist').flatMap(n => list(n.rows).map(r => ({
        title:text(r.text), detail:join([text(n.title), r.checked ? 'Tamamlandı' : 'Bekliyor']), checked:!!r.checked,
      }))),
    ] : [], note:'Güncel kontrol listelerin ve tiklerin.'},
    {id:'sport', name:'Spor', icon:'↗', rows:[
      ...list(sport?.sessions).map(s => ({title:text(s.title) || sportTypes[s.type] || 'Antrenman', date:text(s.date), detail:join([sportTypes[s.type],s.durationMinutes ? s.durationMinutes + ' dk' : '',text(s.note)])})),
      ...list(sport?.measurements).map(m => ({title:'Vücut ölçümü', date:text(m.updatedAt), detail:join([
        Number.isFinite(m.weightKg) ? m.weightKg + ' kg' : '', Number.isFinite(m.bodyFatPct) ? '%' + m.bodyFatPct + ' yağ' : '',
        Number.isFinite(m.waistCm) ? m.waistCm + ' cm bel' : '',
      ])})),
    ]},
    {id:'russian', name:'Rusça', icon:'Я', rows:[]},
  ];
  for (const section of sections) section.rows.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  return {sections, errors};
}

function legacyChecks() {
  try {
    return [...parent.document.querySelectorAll('#hafizlik-tik-denemesi .week-check, #hafizlik-tik-denemesi .daily-check')].map((input, index) => ({
      title:input.getAttribute('aria-label') || input.labels?.[0]?.textContent.trim() || input.closest('tr')?.innerText.trim() || (index + 1) + '. kontrol',
      checked:input.checked,
    }));
  } catch { return []; }
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  return Number.isFinite(+date) ? new Intl.DateTimeFormat('tr-TR', {day:'numeric',month:'long',year:'numeric'}).format(date) : '';
}

export function setupRecords() {
  const trigger = document.getElementById('future-placeholder');
  const dialog = element('dialog', 'records-dialog');
  dialog.id = 'records-dialog';
  dialog.setAttribute('aria-labelledby', 'records-title');
  document.body.append(dialog);
  let active = 'all', query = '', data, limits;
  const body = element('div', 'records-content');
  const filters = element('div', 'records-filters');
  const libraryHost = element('section', 'record-library records-panel');
  const library = createRecordLibrary(libraryHost, () => {if (dialog.open) render();});

  function render() {
    library.render(active, query);
    filters.replaceChildren();
    for (const section of [{id:'all',name:'Tümü'}, ...data.sections]) {
      const button = element('button', '', section.name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(active === section.id));
      button.onclick = () => {active = section.id; render(); filters.querySelector('[aria-pressed="true"]').focus();};
      filters.append(button);
    }
    body.replaceChildren();
    if (data.errors.length) body.append(element('p', 'records-error', data.errors.join(' ')));
    for (const section of data.sections.filter(s => active === 'all' || s.id === active)) {
      const rows = section.rows.filter(r => join([r.title,r.detail,dateLabel(r.date)]).toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
      const panel = element('section', 'records-panel');
      panel.dataset.section = section.id;
      const heading = element('div', 'records-panel-heading');
      heading.append(element('h2', '', section.name), element('span', '', rows.length + ' kayıt'));
      panel.append(heading);
      if (section.note) panel.append(element('p', 'records-note', section.note));
      if (!rows.length) panel.append(element('p', 'records-empty', query ? 'Aramana uygun kayıt yok.' : 'Henüz kayıt yok.'));
      const ul = element('ul', 'records-list');
      for (const row of rows.slice(0, limits[section.id] || 40)) {
        const li = element('li');
        const title = element('strong', '', (typeof row.checked === 'boolean' ? (row.checked ? '✓ ' : '○ ') : '') + row.title);
        li.append(title);
        if (row.date && dateLabel(row.date)) li.append(element('time', '', dateLabel(row.date)));
        if (row.detail) li.append(element('p', '', row.detail));
        ul.append(li);
      }
      panel.append(ul);
      if (rows.length > (limits[section.id] || 40)) {
        const more = element('button', 'records-more', 'Daha fazla göster');
        more.type = 'button';
        more.onclick = () => {limits[section.id] = (limits[section.id] || 40) + 40; render();};
        panel.append(more);
      }
      if (section.id !== 'russian') {
        const open = element('button', 'records-open-section', section.name + ' bölümünü aç ↗');
        open.type = 'button';
        open.onclick = () => {
          dialog.close();
          parent.postMessage({type:'rota:open-' + (section.id === 'hafizlik' ? 'planner' : section.id)}, '*');
        };
        panel.append(open);
      }
      body.append(panel);
    }
  }

  function refresh() {
    data = collectRecords(storage(), legacyChecks());
    render();
  }
  trigger.classList.add('portal-link');
  trigger.tabIndex = 0;
  trigger.setAttribute('role','button');
  trigger.setAttribute('aria-label','Kayıtlar bölümünü aç');
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); trigger.click();}
  });
  trigger.addEventListener('click', () => {
    parent.hafizlikSaveAll?.();
    active = 'all'; query = ''; limits = {};
    dialog.replaceChildren();
    const header = element('header', 'records-header');
    const title = element('h1', '', 'Kayıtlar');
    title.id = 'records-title';
    const close = element('button', '', '← Ana sayfa');
    close.type = 'button';
    close.onclick = () => dialog.close();
    header.append(title, close);
    const search = element('input', 'records-search');
    search.type = 'search';
    search.placeholder = 'Kayıtlarda ara';
    search.setAttribute('aria-label','Kayıtlarda ara');
    search.oninput = () => {query = search.value; render();};
    const toolbar = element('div', 'records-toolbar');
    const reload = element('button', '', 'Yenile');
    reload.type = 'button';
    reload.onclick = refresh;
    toolbar.append(search, reload);
    dialog.append(header, toolbar, filters, libraryHost, body);
    refresh();
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  window.addEventListener('storage', () => {if (dialog.open) refresh();});
}
