(() => {
  'use strict';
  const root = document.getElementById('hafizlik-tik-denemesi');
  const $ = selector => root.querySelector(selector);
  const timersKey = 'hafizlik-takip-timers-v1';
  const dialog = $('#timer-dialog');
  const list = $('#timer-list');
  const dock = $('#timer-dock');
  const form = $('#timer-form');
  let timers = [];
  let audio;
  let toastTimeout;
  let saveFailed = false;
  let nativeFailed = false;
  let listSignature = '';
  let dockSignature = '';
  let timerMenuState = null;
  const timerMenu = document.createElement('div');
  timerMenu.id = 'timer-context-menu';
  timerMenu.className = 'timer-context-menu';
  timerMenu.setAttribute('role', 'menu');
  timerMenu.hidden = true;
  root.append(timerMenu);

  function timerMenuItems() { return [...timerMenu.querySelectorAll('[role="menuitem"]')]; }
  function closeTimerMenu(restoreFocus = false) {
    const state = timerMenuState;
    if (!state) return;
    timerMenuState = null;
    timerMenu.hidden = true;
    state.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      const trigger = [...dock.querySelectorAll('[data-action="menu"]')].find(button => button.dataset.id === state.id);
      (trigger || $('#open-timers')).focus();
    }
  }
  function placeTimerMenu() {
    if (!timerMenuState) return;
    const rect = timerMenuState.trigger.getBoundingClientRect();
    const width = timerMenu.offsetWidth || 166;
    const height = timerMenu.offsetHeight || 90;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const preferredTop = rect.bottom + 7;
    const top = preferredTop + height <= window.innerHeight - 8 ? preferredTop : Math.max(8, rect.top - height - 7);
    timerMenu.style.left = `${left}px`;
    timerMenu.style.top = `${top}px`;
  }
  function menuItem(label, action, id, path) {
    const button = makeButton('', action, id);
    button.className = `timer-menu-item${action === 'delete' ? ' timer-menu-delete' : ''}`;
    button.setAttribute('role', 'menuitem');
    button.tabIndex = -1;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(icon.namespaceURI, 'path');
    line.setAttribute('d', path);
    icon.append(line);
    const text = document.createElement('span'); text.textContent = label;
    button.append(icon, text);
    return button;
  }
  function openTimerMenu(timer, trigger, lastItem = false) {
    if (timerMenuState?.id === timer.id) { closeTimerMenu(true); return; }
    closeTimerMenu();
    timerMenuState = { id:timer.id, trigger };
    timerMenu.setAttribute('aria-label', `${timer.title} sayacı seçenekleri`);
    timerMenu.replaceChildren(
      menuItem('Sil', 'delete', timer.id, 'M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6'),
      menuItem('Ayrıntılar', 'details', timer.id, 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4')
    );
    timerMenu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    placeTimerMenu();
    const items = timerMenuItems();
    items[lastItem ? items.length - 1 : 0].focus();
  }
  // Keep the anchor alive when a timer finishes and the dock refreshes.
  function refreshTimerMenuAnchor() {
    if (!timerMenuState) return;
    const trigger = [...dock.querySelectorAll('[data-action="menu"]')].find(button => button.dataset.id === timerMenuState.id);
    if (!trigger) { closeTimerMenu(); return; }
    timerMenuState.trigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    placeTimerMenu();
  }
  document.addEventListener('click', event => {
    if (timerMenuState && !timerMenu.contains(event.target) && !timerMenuState.trigger.contains(event.target)) closeTimerMenu();
  }, true);
  document.addEventListener('keydown', event => {
    if (timerMenuState && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeTimerMenu(true); }
  }, true);
  timerMenu.addEventListener('keydown', event => {
    const items = timerMenuItems();
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== undefined) { event.preventDefault(); items[next].focus(); }
    if (event.key === 'Tab') closeTimerMenu(true);
  });
  addEventListener('resize', () => closeTimerMenu(true));
  document.addEventListener('scroll', event => { if (!timerMenu.contains(event.target)) closeTimerMenu(true); }, true);

  function toast(message) {
    $('#app-toast').textContent = message;
    $('#app-toast').hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { $('#app-toast').hidden = true; }, 7000);
  }
  function nativeSave() {
    const state = {};
    ['hafizlik-takip-v1', 'rota-hafizlik-before-import-v1', 'hafizlik-takip-theme', timersKey, 'rota-home-local-password-v1', 'rota-home-audio-v1', 'rota-event-manager-preview-v1', 'rota-event-manager-preview-v1-theme', 'rota-event-manager-preview-v1-special-preferences', 'rota-yks-v1', 'rota-sport-preview-v1','rota-cloud-sync-v1','rota-cloud-recovery-v1'].forEach(key => {
      try { const value = localStorage.getItem(key); if (value !== null) state[key] = value; } catch (_) {}
    });
    window.webkit?.messageHandlers?.hafizlik?.postMessage({ action: 'save', state });
  }
  window.hafizlikNativeSave = nativeSave;
  function saveTimers() {
    if(window.hafizlikImportPending)return;
    try { localStorage.setItem(timersKey, JSON.stringify(timers)); saveFailed = false; }
    catch (_) { saveFailed = true; }
    renderSaveIndicator();
    nativeSave();
  }
  function renderSaveIndicator() {
    const indicator = $('#save-indicator');
    const failed = saveFailed || nativeFailed;
    indicator.hidden = !failed;
    indicator.textContent = failed ? 'Kayıt hatası' : '';
  }
  document.addEventListener('hafizlik:saved', event => { saveFailed = !event.detail; renderSaveIndicator(); });
  window.hafizlikNativeSaveResult = ok => { nativeFailed = !ok; renderSaveIndicator(); };
  window.hafizlikSaveAll = () => { window.hafizlikSavePlan?.(); saveTimers(); };

  const clockFormat = new Intl.DateTimeFormat('tr-TR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const dateFormat = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', year:'numeric', weekday:'long' });
  function drawClock() {
    const now = new Date();
    $('#live-clock').textContent = clockFormat.format(now);
    $('#live-clock').dateTime = now.toISOString();
    $('#live-date').textContent = dateFormat.format(now);
    $('#live-date').dateTime = now.toISOString();
  }

  function formatDuration(ms, countdown) {
    const total = Math.max(0, countdown ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
    return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(x => String(x).padStart(2, '0')).join(':');
  }
  function currentValue(timer, now = Date.now()) {
    if (timer.kind === 'stopwatch') return timer.elapsedMs + (timer.status === 'running' ? Math.max(0, now - timer.startedAt) : 0);
    return timer.status === 'running' ? Math.max(0, timer.deadline - now) : timer.remainingMs;
  }
  function description(timer) {
    const status = { ready:'Hazır', running:'Çalışıyor', paused:'Duraklatıldı', done:'Tamamlandı' }[timer.status];
    return `${timer.kind === 'stopwatch' ? 'Kronometre' : 'Geri sayım'} · ${status}`;
  }
  function unlockAudio() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch (_) {}
  }
  function ring() {
    if (!audio || audio.state !== 'running') return;
    try {
      for (let i = 0; i < 3; i++) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + i * 0.3;
        oscillator.frequency.value = i === 1 ? 660 : 880;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(start); oscillator.stop(start + 0.24);
      }
    } catch (_) {}
  }
  function settle(timer, now) {
    if (timer.kind !== 'countdown' || timer.status !== 'running' || timer.deadline > now) return false;
    // A single deadline keeps each independent timer accurate across restarts.
    timer.status = 'done'; timer.remainingMs = 0; timer.deadline = null;
    if (timer.sound) ring();
    toast(`${timer.title}: süre doldu.`);
    return true;
  }
  function makeButton(text, action, id, label) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = text;
    button.dataset.action = action; button.dataset.id = id;
    if (label) button.setAttribute('aria-label', label);
    return button;
  }
  function drawTimers() {
    const now = Date.now();
    const signature = JSON.stringify(timers.map(t => [t.id,t.status,t.title]));
    if (signature !== listSignature) {
      listSignature = signature;
      list.replaceChildren();
      if (!timers.length) {
        const empty = document.createElement('p'); empty.className = 'timer-empty';
        empty.textContent = 'Geri sayım veya kronometre ekle. Birden fazla sayacı aynı anda başlatabilirsin.'; list.append(empty);
      }
      timers.forEach(timer => {
        const card = document.createElement('article'); card.className = 'timer-card';
        const heading = document.createElement('div'); heading.className = 'timer-card-heading';
        const title = document.createElement('h3'); title.textContent = timer.title;
        heading.append(title, makeButton('×', 'delete', timer.id, `${timer.title} sayacını sil`));
        const details = document.createElement('div'); details.className = 'timer-description'; details.textContent = description(timer);
        const value = document.createElement('div'); value.className = 'timer-value'; value.dataset.time = timer.id;
        const actions = document.createElement('div'); actions.className = 'timer-actions';
        if (timer.status !== 'done') actions.append(makeButton(timer.status === 'running' ? 'Duraklat' : timer.status === 'ready' ? 'Başlat' : 'Sürdür', 'toggle', timer.id));
        actions.append(makeButton('Sıfırla', 'reset', timer.id));
        card.append(heading, details, value, actions); list.append(card);
      });
    }
    const visible = timers;
    dock.hidden = visible.length === 0;
    const nextDockSignature = JSON.stringify(visible.map(t => [t.id,t.status,t.title]));
    if (nextDockSignature !== dockSignature) {
      dockSignature = nextDockSignature; dock.replaceChildren();
      visible.forEach(timer => {
        const item = document.createElement('div'); item.className = 'dock-timer';
        const title = document.createElement('span'); title.className = 'dock-title'; title.textContent = timer.title; title.title = `${timer.title} · ${description(timer)}`;
        const value = document.createElement('time'); value.dataset.time = timer.id;
        const details = makeButton('⋯', 'menu', timer.id, `${timer.title} sayacı seçenekleri`);
        details.className = 'timer-menu-trigger';
        details.setAttribute('aria-haspopup', 'menu');
        details.setAttribute('aria-expanded', 'false');
        details.setAttribute('aria-controls', timerMenu.id);
        details.title = 'Sayaç seçenekleri';
        item.append(title, value);
        item.dataset.status = timer.status;
        if (timer.status !== 'done') item.append(makeButton(timer.status === 'running' ? 'Ⅱ' : '▶', 'toggle', timer.id, `${timer.title}: ${timer.status === 'running' ? 'duraklat' : timer.status === 'ready' ? 'başlat' : 'sürdür'}`));
        item.append(details); dock.append(item);
      });
      refreshTimerMenuAnchor();
    }
    root.querySelectorAll('[data-time]').forEach(element => {
      const timer = timers.find(t => t.id === element.dataset.time);
      if (timer) element.textContent = formatDuration(currentValue(timer, now), timer.kind === 'countdown');
    });
    const activeCount = timers.filter(t => t.status === 'running').length;
    $('#timer-count').hidden = activeCount === 0;
    $('#timer-count').textContent = `· ${activeCount}`;
  }
  function tick() {
    drawClock();
    let changed = false;
    timers.forEach(timer => { if (settle(timer, Date.now())) changed = true; });
    if (changed) saveTimers();
    drawTimers();
  }
  function timerAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const timer = timers.find(item => item.id === button.dataset.id);
    if (!timer) return;
    if (button.dataset.action === 'menu') { openTimerMenu(timer, button); return; }
    if (button.dataset.action === 'details') { closeTimerMenu(true); dialog.showModal(); return; }
    const restoreMenuFocus = timerMenu.contains(button);
    if (restoreMenuFocus) closeTimerMenu();
    const now = Date.now();
    settle(timer, now);
    if (button.dataset.action === 'delete') timers = timers.filter(item => item.id !== timer.id);
    if (button.dataset.action === 'reset') {
      Object.assign(timer, {status:'ready', remainingMs:timer.durationMs, elapsedMs:0, deadline:null, startedAt:null});
    }
    if (button.dataset.action === 'toggle' && timer.status !== 'done') {
      unlockAudio();
      if (timer.status === 'running') {
        if (timer.kind === 'stopwatch') timer.elapsedMs = currentValue(timer, now);
        else timer.remainingMs = currentValue(timer, now);
        timer.status = 'paused'; timer.startedAt = null; timer.deadline = null;
      } else {
        timer.status = 'running';
        if (timer.kind === 'stopwatch') timer.startedAt = now;
        else timer.deadline = now + timer.remainingMs;
      }
    }
    saveTimers(); drawTimers();
    if (restoreMenuFocus) $('#open-timers').focus();
  }
  list.addEventListener('click', timerAction);
  dock.addEventListener('click', timerAction);
  timerMenu.addEventListener('click', timerAction);
  dock.addEventListener('keydown', event => {
    const trigger = event.target.closest('[data-action="menu"]');
    if (!trigger || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const timer = timers.find(item => item.id === trigger.dataset.id);
    if (timer) { event.preventDefault(); openTimerMenu(timer, trigger, event.key === 'ArrowUp'); }
  });
  $('#open-timers').addEventListener('click', () => { drawTimers(); dialog.showModal(); });
  $('#close-timers').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  $('#timer-kind').addEventListener('change', () => {
    const stopwatch = $('#timer-kind').value === 'stopwatch';
    $('#countdown-options').hidden = stopwatch;
    $('#countdown-options').querySelectorAll('input').forEach(input => { input.disabled = stopwatch; });
  });
  root.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
    const minutes = Number(button.dataset.minutes);
    $('#timer-hours').value = Math.floor(minutes / 60);
    $('#timer-minutes').value = minutes % 60;
    $('#timer-seconds').value = 0;
  }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const countdown = $('#timer-kind').value === 'countdown';
    const durationMs = countdown ? (Number($('#timer-hours').value) * 3600 + Number($('#timer-minutes').value) * 60 + Number($('#timer-seconds').value)) * 1000 : 0;
    if (countdown && durationMs <= 0) { $('#timer-form-error').textContent = 'En az 1 saniyelik bir süre gir.'; return; }
    if (timers.length >= 20) { $('#timer-form-error').textContent = 'Yeni sayaç eklemek için kullanmadığın bir sayacı sil.'; return; }
    $('#timer-form-error').textContent = '';
    const start = event.submitter?.value === 'start';
    const now = Date.now();
    timers.push({ id:crypto.randomUUID(), title:$('#timer-label').value.trim() || (countdown ? 'Sayaç' : 'Kronometre'), kind:countdown ? 'countdown' : 'stopwatch', durationMs, remainingMs:durationMs, elapsedMs:0, startedAt:start && !countdown ? now : null, deadline:start && countdown ? now + durationMs : null, status:start ? 'running' : 'ready', sound:$('#timer-sound').checked });
    unlockAudio(); saveTimers(); drawTimers(); $('#timer-label').value = '';
    list.lastElementChild?.scrollIntoView({block:'nearest', behavior:'smooth'});
  });
  try {
    const saved = JSON.parse(localStorage.getItem(timersKey) || '[]');
    if (Array.isArray(saved)) timers = saved.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string' && ['countdown','stopwatch'].includes(t.kind) && ['ready','running','paused','done'].includes(t.status) && Number.isFinite(t.durationMs) && t.durationMs >= 0 && Number.isFinite(t.remainingMs) && t.remainingMs >= 0 && Number.isFinite(t.elapsedMs) && t.elapsedMs >= 0 && (t.status !== 'running' || Number.isFinite(t.kind === 'countdown' ? t.deadline : t.startedAt))).slice(0, 20).map(t => ({id:t.id, title:t.title, kind:t.kind, status:t.status, durationMs:t.durationMs, remainingMs:t.remainingMs, elapsedMs:t.elapsedMs, startedAt:t.startedAt, deadline:t.deadline, sound:t.sound !== false}));
  } catch (_) {}

  $('#save-and-exit').addEventListener('click', () => {
    window.hafizlikSaveAll();
    if (saveFailed || nativeFailed) { toast('Kaydedilemedi. Uygulama açık bırakıldı; yeniden dene.'); return; }
    window.rotaShowHome?.();
  });
  $('#open-calendar-from-planner').addEventListener('click', () => {
    window.hafizlikSaveAll();
    if (saveFailed || nativeFailed) { toast('Kaydedilemedi. Takvime geçmeden önce yeniden dene.'); return; }
    window.rotaShowCalendar?.();
  });
  $('#open-yks-from-planner').addEventListener('click', () => {
    window.hafizlikSaveAll();
    if (saveFailed || nativeFailed) { toast('Kaydedilemedi. YKS alanına geçmeden önce yeniden dene.'); return; }
    window.rotaShowYks?.();
  });
  addEventListener('pagehide', () => window.hafizlikSaveAll());
  document.addEventListener('visibilitychange', () => { if (document.hidden) window.hafizlikSaveAll(); else tick(); });
  addEventListener('focus', tick);
  tick(); window.hafizlikSaveAll();
  setInterval(tick, 250);
})();
