/** YKS plan data helpers. No storage, DOM, network or existing Rota state access. */
const LIMITS = Object.freeze({ tasks: 12000, books: 250, ranges: 2000, postponements: 1000, day: 73000, pages: 1000000 });
const BOOK_KINDS = new Set(['VDK', 'Soru bankası', 'Diğer']);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID_RE = /[^a-zA-Z0-9_:-]/g;

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function text(value, max = 160) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function integer(value, min, max) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}
function list(value, max) { return Array.isArray(value) ? value.slice(0, max) : []; }
function id(value, fallback) { return text(value, 100).replace(ID_RE, '-') || fallback; }
function uniqueId(value, fallback, used) {
  const base = id(value, fallback);
  let result = base, suffix = 2;
  while (used.has(result)) result = `${base}-${suffix++}`;
  used.add(result);
  return result;
}
function ids(value, max = 64) { return [...new Set(list(value, max).map(item => id(item, '')).filter(Boolean))]; }
function safeData(value, depth = 0) {
  if (depth > 4) return null;
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => safeData(item, depth + 1));
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).slice(0, 30)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      result[key.slice(0, 100)] = safeData(value[key], depth + 1);
    }
    return result;
  }
  return null;
}

// Work at local noon: date-only arithmetic must not shift dates through UTC or DST.
function parseDate(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
function dateString(date) {
  if (!date || !Number.isFinite(date.getTime()) || date.getFullYear() < 1 || date.getFullYear() > 9999) return '';
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function validDate(value) { return parseDate(value) ? value : ''; }

export function defaultState() {
  return { schema: 1, settings: { startDate: '', examDate: '', name: 'YKS kampım' }, books: [], tasks: [], postponements: [] };
}

/** Returns a date-only local-calendar string, or '' for invalid/out-of-range input. */
export function addDays(value, count) {
  const date = parseDate(value);
  if (!date || !Number.isSafeInteger(count) || Math.abs(count) > LIMITS.day * 2) return '';
  date.setDate(date.getDate() + count);
  return dateString(date);
}

/** Field errors are Turkish UI-ready strings; optional fields stay genuinely optional. */
export function validateTask(value) {
  const task = object(value), errors = [];
  if (!text(task.title)) errors.push('Görev başlığı gerekli.');
  if (integer(task.day, 1, LIMITS.day) === null) errors.push('Kamp günü 1 ile 73000 arasında tam sayı olmalı.');
  const hasFrom = task.pageFrom !== undefined && task.pageFrom !== null && task.pageFrom !== '';
  const hasTo = task.pageTo !== undefined && task.pageTo !== null && task.pageTo !== '';
  if (hasFrom || hasTo) {
    const from = integer(task.pageFrom, 1, LIMITS.pages), to = integer(task.pageTo, 1, LIMITS.pages);
    if (from === null || to === null || to < from) errors.push('Sayfa aralığı pozitif ve küçükten büyüğe olmalı.');
  }
  if (task.minutes !== undefined && task.minutes !== null && task.minutes !== '' && integer(task.minutes, 1, 1440) === null) errors.push('Süre 1 ile 1440 dakika arasında tam sayı olmalı.');
  if (task.completedDate && !validDate(task.completedDate)) errors.push('Tamamlanma tarihi geçerli olmalı.');
  return { valid: errors.length === 0, ok: errors.length === 0, errors };
}

export function validateBook(value) {
  const book = object(value), errors = [];
  if (!text(book.title)) errors.push('Kitap adı gerekli.');
  if (book.kind !== undefined && !BOOK_KINDS.has(book.kind)) errors.push('Kitap türü VDK, Soru bankası veya Diğer olmalı.');
  const hasTotal = book.totalPages !== undefined && book.totalPages !== null && book.totalPages !== '';
  const total = integer(book.totalPages, 1, LIMITS.pages);
  if (hasTotal && total === null) errors.push('Toplam sayfa pozitif tam sayı olmalı.');
  for (const value of list(book.ranges, LIMITS.ranges)) {
    const range = object(value), from = integer(range.from, 1, LIMITS.pages), to = integer(range.to, 1, LIMITS.pages);
    if (from === null || to === null || to < from || (total !== null && to > total)) {
      errors.push('Kitap sayfa aralıkları geçerli olmalı ve toplam sayfayı aşmamalı.');
      break;
    }
  }
  return { valid: errors.length === 0, ok: errors.length === 0, errors };
}

/** Imported data is copied through an explicit bounded schema, never merged into prototypes. */
export function normalizeState(value) {
  const raw = object(value), settings = object(raw.settings), result = defaultState();
  result.settings = {
    startDate: validDate(settings.startDate),
    examDate: validDate(settings.examDate),
    name: text(settings.name) || 'YKS kampım',
  };
  if (text(settings.campId, 100)) result.settings.campId = text(settings.campId, 100);
  if (integer(settings.plannedDurationDays, 1, LIMITS.day) !== null) result.settings.plannedDurationDays = integer(settings.plannedDurationDays, 1, LIMITS.day);
  const bookIds = new Set();
  for (const [index, item] of list(raw.books, LIMITS.books).entries()) {
    const book = object(item);
    if (!text(book.title)) continue;
    const totalPages = integer(book.totalPages, 1, LIMITS.pages), rangeIds = new Set(), ranges = [];
    for (const [rangeIndex, itemRange] of list(book.ranges, LIMITS.ranges).entries()) {
      const range = object(itemRange), from = integer(range.from, 1, LIMITS.pages), to = integer(range.to, 1, LIMITS.pages);
      if (from === null || to === null || to < from || (totalPages !== null && to > totalPages)) continue;
      ranges.push({ id: uniqueId(range.id, `range-${rangeIndex + 1}`, rangeIds), from, to, done: range.done === true, ...(text(range.note, 2000) ? { note: text(range.note, 2000) } : {}) });
    }
    result.books.push({ id: uniqueId(book.id, `book-${index + 1}`, bookIds), title: text(book.title), kind: BOOK_KINDS.has(book.kind) ? book.kind : 'Diğer', subject: text(book.subject, 100), ...(totalPages !== null ? { totalPages } : {}), ...(text(book.edition, 160) ? { edition: text(book.edition, 160) } : {}), ...(text(book.note, 4000) ? { note: text(book.note, 4000) } : {}), ranges });
  }
  const taskIds = new Set();
  for (const [index, item] of list(raw.tasks, LIMITS.tasks).entries()) {
    const task = object(item);
    if (!validateTask(task).valid) continue;
    const normalized = {
      id: uniqueId(task.id, `task-${index + 1}`, taskIds), day: integer(task.day, 1, LIMITS.day), subject: text(task.subject, 100), title: text(task.title), kind: text(task.kind, 80) || 'Çalışma', done: task.done === true,
    };
    const bookId = id(task.bookId, '');
    if (bookId && bookIds.has(bookId)) normalized.bookId = bookId;
    if (integer(task.pageFrom, 1, LIMITS.pages) !== null) {
      normalized.pageFrom = integer(task.pageFrom, 1, LIMITS.pages);
      normalized.pageTo = integer(task.pageTo, 1, LIMITS.pages);
    }
    if (integer(task.minutes, 1, 1440) !== null) normalized.minutes = integer(task.minutes, 1, 1440);
    if (text(task.note, 4000)) normalized.note = text(task.note, 4000);
    if (typeof task.sourceUrl === 'string') {
      try { const url = new URL(task.sourceUrl); if (url.protocol === 'https:' || url.protocol === 'http:') normalized.sourceUrl = url.href.slice(0, 2000); } catch {}
    }
    if (Array.isArray(task.requires)) normalized.requires = ids(task.requires);
    if (task.done === true && validDate(task.completedDate)) normalized.completedDate = task.completedDate;
    result.tasks.push(normalized);
  }
  // One combined postponement per camp day avoids duplicate shift identifiers.
  const shifts = new Map();
  let remainingShiftBudget = LIMITS.day;
  for (const item of list(raw.postponements, LIMITS.postponements)) {
    const shift = object(item), day = integer(shift.day, 1, LIMITS.day), days = integer(shift.days, 1, LIMITS.day);
    if (day === null || days === null || remainingShiftBudget <= 0) continue;
    const accepted = Math.min(days, remainingShiftBudget);
    shifts.set(day, (shifts.get(day) || 0) + accepted);
    remainingShiftBudget -= accepted;
  }
  result.postponements = [...shifts].sort((a, b) => a[0] - b[0]).map(([day, days]) => ({ day, days }));
  if (Array.isArray(raw.milestones)) result.milestones = list(raw.milestones, 500).filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(item => safeData(item));
  return result;
}

/** X = startDate. Day N = X + N - 1 + all postponements starting on/before N. */
export function dateForDay(value, day) {
  const number = integer(day, 1, LIMITS.day), raw = object(value), settings = object(raw.settings);
  if (number === null || !validDate(settings.startDate)) return '';
  let shiftDays = 0;
  for (const item of list(raw.postponements, LIMITS.postponements)) {
    const shift = object(item), from = integer(shift.day, 1, LIMITS.day), days = integer(shift.days, 1, LIMITS.day);
    if (from !== null && days !== null && from <= number) shiftDays = Math.min(LIMITS.day, shiftDays + days);
  }
  return addDays(settings.startDate, number - 1 + shiftDays);
}

export function planSummary(value) {
  const state = normalizeState(value), taskCount = state.tasks.length, completedTasks = state.tasks.filter(task => task.done).length;
  const campDays = state.tasks.reduce((maximum, task) => Math.max(maximum, task.day), state.settings.plannedDurationDays || 0);
  const postponedDays = state.postponements.reduce((sum, shift) => sum + (shift.day <= campDays ? shift.days : 0), 0);
  const grouped = new Map();
  for (const task of state.tasks) {
    const values = grouped.get(task.day) || [];
    values.push(task.done);
    grouped.set(task.day, values);
  }
  return {
    taskCount, completedTasks, remainingTasks: taskCount - completedTasks,
    campDays, postponedDays, totalDays: campDays ? campDays + postponedDays : 0,
    startDate: state.settings.startDate, endDate: campDays ? dateForDay(state, campDays) : '',
    completedDays: [...grouped.values()].filter(values => values.every(Boolean)).length,
    progress: taskCount ? Math.round(completedTasks / taskCount * 100) : 0,
  };
}

/** Union of completed inclusive ranges: overlapping pages are counted only once. */
export function bookProgress(value) {
  const book = object(value), totalPages = integer(book.totalPages, 1, LIMITS.pages);
  const ranges = list(book.ranges, LIMITS.ranges).filter(range => object(range).done === true).map(range => {
    const from = integer(range.from, 1, LIMITS.pages), to = integer(range.to, 1, LIMITS.pages);
    if (from === null || to === null || to < from) return null;
    const end = totalPages === null ? to : Math.min(to, totalPages);
    return from <= end ? [from, end] : null;
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  const completedPages = merged.reduce((sum, [from, to]) => sum + to - from + 1, 0);
  return { totalPages, completedPages, remainingPages: totalPages === null ? null : Math.max(0, totalPages - completedPages), percent: totalPages === null ? null : Math.round(completedPages / totalPages * 100), completedRanges: merged.map(([from, to]) => ({ from, to })) };
}

/** Stable ids support replacing only YKS-owned events on subsequent calendar syncs. */
export function calendarEvents(value) {
  const state = normalizeState(value);
  if (!state.settings.startDate) return [];
  const books = new Map(state.books.map(book => [book.id, book]));
  return [...state.tasks].sort((a, b) => a.day - b.day).flatMap(task => {
    const date = task.done && validDate(task.completedDate) ? task.completedDate : dateForDay(state, task.day), next = addDays(date, 1);
    if (!date || !next) return [];
    const book = books.get(task.bookId);
    const description = [`YKS kampı · ${task.day}. gün`, task.kind, book ? `Kitap: ${book.title}` : '', task.pageFrom ? `Sayfa: ${task.pageFrom}–${task.pageTo}` : '', task.minutes ? `Planlanan süre: ${task.minutes} dk` : '', task.done ? 'Durum: Tamamlandı' : 'Durum: Planlandı', task.note || ''].filter(Boolean).join('\n');
    return [{ id: `rota-yks-task-${task.id}`, title: [task.subject, task.title].filter(Boolean).join(' · '), description, start: `${date}T00:00:00`, end: `${next}T00:00:00`, allDay: true, category: 'Ders', tags: ['YKS'], color: 'blue', source: 'rota-yks', sourceTaskId: task.id, campDay: task.day, completed: task.done }];
  });
}

export function makeId(prefix = 'yks') {
  const safePrefix = id(prefix, 'yks');
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `${safePrefix}-${suffix}`;
}
