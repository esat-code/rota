/** Local, side-effect-free data model for the Rota sport preview. */
export const MODEL_VERSION = 2;
export const DEFAULT_SPORT_WEEK = Object.freeze([]);
function regularWeek(){return DEFAULT_SPORT_WEEK.map(day=>({...day,id:'routine-day-'+day.weekday,type:'workout',time:'',durationMinutes:null,videoIds:[],startDate:null,endDate:null}));}

export const SOURCES = Object.freeze({
  bmi: 'https://www.who.int/data/nutrition/nlis/info/malnutrition-in-women',
  met: 'https://pacompendium.com/conditioning-exercise/',
  metLimits: 'https://pacompendium.com/corrected-mets/',
});

/** The activity values below retain their separate 2024 Compendium codes. */
export const ACTIVITY_PRESETS = Object.freeze([
  { id: 'bodyweight', code: '02056', label: 'Vücut ağırlığı · genel', met: 3.0 },
  { id: 'bodyweight-high', code: '02057', label: 'Vücut ağırlığı · yoğun', met: 6.5 },
  { id: 'resistance', code: '02054', label: 'Ağırlık · farklı hareketler', met: 3.5 },
  { id: 'calisthenics', code: '02022', label: 'Kalistenik · orta tempo', met: 3.8 },
  { id: 'calisthenics-high', code: '02020', label: 'Kalistenik · yoğun', met: 7.5 },
  { id: 'stretch', code: '02101', label: 'Hafif esneme', met: 2.3 },
  { id: 'yoga', code: '02150', label: 'Hatha yoga', met: 2.3 },
  { id: 'video-moderate', code: '02143', label: 'Kardiyo / direnç videosu · orta', met: 4.0 },
  { id: 'video-vigorous', code: '02145', label: 'Kardiyo / direnç videosu · yoğun', met: 6.0 },
].map(activity => Object.freeze({ ...activity, sourceUrl: SOURCES.met })));

const TYPE_INFO = Object.freeze({
  workout: { label: 'Antrenman', category: 'Spor', color: 'blue' },
  stretch: { label: 'Esneme', category: 'Esneme', color: 'green' },
  rest: { label: 'Dinlenme', category: 'Dinlenme', color: 'orange' },
});

const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 1000) => typeof value === 'string' ? value.slice(0, max) : '';
const list = (value, max = 5000) => Array.isArray(value) ? value.slice(0, max) : [];

/** Empty values remain missing; in particular Number('') must not become zero. */
export function numberOrNull(value, min = -Infinity, max = Infinity) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim().replace(',', '.')) : NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function safeData(value, depth = 0) {
  if (depth > 12) return null;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, 20000);
  if (Array.isArray(value)) return value.slice(0, 5000).map(item => safeData(item, depth + 1));
  if (!plainObject(value)) return null;
  return Object.fromEntries(Object.entries(value).slice(0, 200)
    .filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key))
    .map(([key, item]) => [key, safeData(item, depth + 1)]));
}

function normalizeProfile(raw) {
  const profile = plainObject(raw) ? safeData(raw) : {};
  return {
    ...profile,
    heightCm: numberOrNull(profile.heightCm, 50, 260),
    weightKg: numberOrNull(profile.weightKg, 1, 600),
    // A historical unassigned arm circumference is not a measurement of both arms.
    armCm: numberOrNull(profile.armCm, 10, 100),
    rightArmCm: numberOrNull(profile.rightArmCm, 10, 100),
    leftArmCm: numberOrNull(profile.leftArmCm, 10, 100),
    age: numberOrNull(profile.age, 0, 120),
    bodyFatPct: numberOrNull(profile.bodyFatPct, 0.1, 75),
    bodyFatMethod: text(profile.bodyFatMethod, 100) || 'measured',
    updatedAt: text(profile.updatedAt, 100) || null,
  };
}

export function defaultState() {
  return {
    version: MODEL_VERSION,
    profile: normalizeProfile({}),
    measurements: [],
    videos: [],
    sessions: [],
    plan: { weekly: regularWeek(), overrides: [] },
    settings: { theme: 'dark' },
  };
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1900 || year > 2200) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(date, count) {
  if (!validDate(date) || !Number.isInteger(count)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + count);
  return parsed.toISOString().slice(0, 10);
}

function validTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizePlanEntry(raw, index, repeating) {
  if (!plainObject(raw)) return null;
  const entry = safeData(raw);
  const type = Object.hasOwn(TYPE_INFO, entry.type) ? entry.type : 'workout';
  const normalized = {
    ...entry,
    id: text(entry.id, 200) || `${repeating ? 'weekly' : 'date'}-${index}`,
    type,
    title: text(entry.title, 300).trim(),
    time: validTime(entry.time) ? entry.time : '',
    durationMinutes: numberOrNull(entry.durationMinutes, 0.1, 1440),
    videoIds: list(entry.videoIds, 100).filter(id => typeof id === 'string').map(id => id.slice(0, 200)),
  };
  if (repeating) {
    const weekday = numberOrNull(entry.weekday, 1, 7);
    if (!Number.isInteger(weekday)) return null;
    return {
      ...normalized, weekday,
      startDate: validDate(entry.startDate) ? entry.startDate : null,
      endDate: null,
    };
  }
  if (!validDate(entry.date)) return null;
  return { ...normalized, date: entry.date, replaceWeekly: entry.replaceWeekly === true, cancelled: entry.cancelled === true };
}

export function normalizeState(raw) {
  if (!plainObject(raw)) return defaultState();
  const safe = safeData(raw);
  const plan = plainObject(safe.plan) ? safe.plan : {};
  const savedWeekly=list(plan.weekly,100).map((entry,index)=>normalizePlanEntry(entry,index,true)).filter(Boolean);
  const weekly = Number(safe.version||1)<2 ? [...savedWeekly,...regularWeek().filter(entry=>!savedWeekly.some(item=>item.weekday===entry.weekday))] : savedWeekly;
  return {
    ...defaultState(), ...safe,
    version: MODEL_VERSION,
    profile: normalizeProfile(safe.profile),
    measurements: list(safe.measurements).filter(plainObject),
    videos: list(safe.videos).filter(plainObject),
    sessions: list(safe.sessions).filter(plainObject),
    plan: {
      ...plan,
      weekly,
      overrides: list(plan.overrides).map((entry, index) => normalizePlanEntry(entry, index, false)).filter(Boolean),
    },
    settings: { theme: 'dark', ...(plainObject(safe.settings) ? safe.settings : {}) },
  };
}

export function bmi(profile = {}) {
  const { heightCm, weightKg, age } = normalizeProfile(profile);
  if (heightCm === null || weightKg === null) return {
    value: null, category: null, label: 'Boy ve kilonu ekle', adult: null,
    sourceUrl: SOURCES.bmi,
    note: 'VKİ, kilogram / metre² ile hesaplanır.',
  };
  const value = weightKg / ((heightCm / 100) ** 2);
  if (age === null || age < 18) return {
    value, category: null, label: age === null ? 'Seviye için yaşını ekle' : 'Yetişkin aralığı uygulanmaz',
    adult: age === null ? null : false, sourceUrl: SOURCES.bmi,
    note: 'Yaş bilinmeden veya 18 yaş altında yetişkin VKİ sınıflandırması yapılmaz.',
  };
  const category = value < 18.5 ? 'underweight' : value < 25 ? 'normal' : value < 30 ? 'overweight' : 'obesity';
  const label = ({ underweight: 'Düşük kilo aralığı', normal: 'Normal aralık', overweight: 'Fazla kilo aralığı', obesity: 'Obezite aralığı' })[category];
  return { value, category, label, adult: true, sourceUrl: SOURCES.bmi,
    note: 'VKİ bir tarama göstergesidir; kas ile yağ kütlesini ayırmaz ve yağ yüzdesini ölçmez.' };
}

export function bodyFat(profile = {}) {
  if(profile.bodyFatMode==='circumference')return circumferenceBodyFat(profile);
  const { bodyFatPct, bodyFatMethod } = normalizeProfile(profile);
  return bodyFatPct === null
    ? { value: null, method: null, label: 'Ölçüm ekle', estimated: false, note: 'Boy ve kilodan yağ yüzdesi üretilmez.' }
    : { value: bodyFatPct, method: bodyFatMethod, label: 'Kaydettiğin ölçüm', estimated: false,
      note: 'Sonuç kaydettiğin cihaz veya ölçüm yöntemine aittir; uygulama ölçüm yapmaz.' };
}

/** Historical Hodgdon–Beckett circumference equation, not a current Navy assessment. */
export function circumferenceBodyFat(profile={}) {
  const height=numberOrNull(profile.heightCm,50,260),neck=numberOrNull(profile.neckCm,10,100),waist=numberOrNull(profile.waistCm,20,300),hip=numberOrNull(profile.hipCm,20,300);
  const sourceUrl='https://pmc.ncbi.nlm.nih.gov/articles/PMC10282178/';
  const base={method:'Hodgdon–Beckett çevre formülü',estimated:true,sourceUrl,note:'Yetişkinler için çevre ölçümlerine dayalı yaklaşık sonuçtur; doğrudan yağ ölçümü veya tanı değildir. Erkek formülünde karın çevresi göbek deliği hizasından alınır. Kol çevresi bu formüle girmez.'};
  if(numberOrNull(profile.age,0,120)!==null&&Number(profile.age)<18)return{...base,value:null,label:'Yetişkin formülü uygulanmaz'};
  if(!['male','female'].includes(profile.circumferenceFormula))return{...base,value:null,label:'Çevre formülünü seç'};
  if(height===null||neck===null||waist===null||waist<=neck)return{...base,value:null,label:'Boy, boyun ve bel ölçülerini kontrol et'};
  if(profile.circumferenceFormula==='female'&&(hip===null||waist+hip<=neck))return{...base,value:null,label:'Kalça çevresini de ekle'};
  const value=profile.circumferenceFormula==='male'
    ?86.010*Math.log10((waist-neck)/2.54)-70.041*Math.log10(height/2.54)+36.76
    :163.205*Math.log10((waist+hip-neck)/2.54)-97.684*Math.log10(height/2.54)-78.387;
  if(!Number.isFinite(value)||value<2||value>70)return{...base,value:null,label:'Ölçümler bu formülün uygun aralığında değil'};
  return{...base,value,label:'Tahmini yağ oranı'};
}

/** Repetition comparisons describe quantity only; they do not change kcal estimates. */
export function compareReps(own, reference) {
  if (plainObject(own)) {
    reference = own.referenceReps;
    own = own.reps;
  }
  const actual = numberOrNull(own, 0, 100000);
  const target = numberOrNull(reference, 0, 100000);
  if (actual === null || target === null) return {
    own: actual, reference: target, delta: null, ratio: null, percent: null, status: 'missing',
    label: actual === null ? 'Tekrarını kaydet' : 'Referans tekrarı ekle',
  };
  const delta = actual - target;
  return {
    own: actual, reference: target, delta,
    ratio: target > 0 ? actual / target : null,
    percent: target > 0 ? (actual / target) * 100 : null,
    status: delta > 0 ? 'more' : delta < 0 ? 'less' : 'same',
    label: delta === 0 ? 'Aynı tekrar' : `${Math.abs(delta)} tekrar ${delta > 0 ? 'fazla' : 'eksik'}`,
  };
}

/**
 * kcal ≈ MET × kg × hours. Gross includes standard resting metabolism;
 * net is the part above 1 MET. Explicit rests are reported separately.
 * Missing durations/METs remain unestimated rather than silently assuming zero.
 */
export function estimateCalories(profile = {}, segments = []) {
  const { weightKg } = normalizeProfile(profile);
  const details = list(segments, 1000).map((raw, index) => {
    const segment = plainObject(raw) ? raw : {};
    const preset = ACTIVITY_PRESETS.find(activity => activity.id === segment.activityId || activity.code === segment.activityId);
    const met = numberOrNull(segment.met, 0.1, 30) ?? preset?.met ?? null;
    const durationMinutes = numberOrNull(segment.durationMinutes, 0.01, 1440);
    const rest = segment.rest === true || segment.type === 'rest';
    const estimated = weightKg !== null && met !== null && durationMinutes !== null;
    return {
      id: text(segment.id, 200) || `segment-${index}`,
      label: text(segment.label, 300) || preset?.label || (rest ? 'Dinlenme' : 'Hareket'),
      activityId: preset?.id ?? text(segment.activityId, 200),
      code: preset?.code ?? null,
      met, durationMinutes, rest, estimated,
      grossKcal: estimated ? met * weightKg * (durationMinutes / 60) : null,
      netKcal: estimated ? Math.max(0, met - 1) * weightKg * (durationMinutes / 60) : null,
      comparison: compareReps(segment),
      sourceUrl: preset ? SOURCES.met : null,
    };
  });
  const total = (items, key) => items.reduce((sum, item) => sum + (item[key] ?? 0), 0);
  const active = details.filter(segment => !segment.rest);
  const rests = details.filter(segment => segment.rest);
  const estimated = details.filter(segment => segment.estimated);
  const unestimatedSegments = details.filter(segment => !segment.estimated).map(segment => segment.id);
  const hasEstimate = estimated.length > 0;
  return {
    grossKcal: hasEstimate ? total(estimated, 'grossKcal') : null,
    netKcal: hasEstimate ? total(estimated, 'netKcal') : null,
    activeGrossKcal: active.some(segment => segment.estimated) ? total(active, 'grossKcal') : null,
    activeNetKcal: active.some(segment => segment.estimated) ? total(active, 'netKcal') : null,
    restGrossKcal: rests.some(segment => segment.estimated) ? total(rests, 'grossKcal') : null,
    restNetKcal: rests.some(segment => segment.estimated) ? total(rests, 'netKcal') : null,
    activeMinutes: total(active, 'durationMinutes'),
    restMinutes: total(rests, 'durationMinutes'),
    totalMinutes: total(details, 'durationMinutes'),
    missingWeight: weightKg === null,
    partial: hasEstimate && unestimatedSegments.length > 0,
    unestimatedSegments,
    segments: details,
    label: weightKg === null ? 'Kalori tahmini için kilonu ekle' : !hasEstimate ? 'Süre ve hareket türünü ekle'
      : unestimatedSegments.length ? 'Kısmi, yaklaşık enerji tahmini' : 'Yaklaşık enerji tahmini',
    note: 'Standart MET hesabı kişisel ölçüm değildir. Tempo, teknik ve dinlenme sonucu değiştirir; tekrar farkı tek başına kaloriye çevrilmez.',
    method: 'MET × kg × dakika / 60; net için MET − 1',
    sourceUrl: SOURCES.met,
    limitationsUrl: SOURCES.metLimits,
  };
}

function endDateTime(date, time, minutes) {
  const [hours, minute] = time.split(':').map(Number);
  const endMinutes = Math.round(hours * 60 + minute + minutes);
  const dayOffset = Math.floor(endMinutes / 1440);
  const remainder = endMinutes % 1440;
  return `${addDays(date, dayOffset)}T${String(Math.floor(remainder / 60)).padStart(2, '0')}:${String(remainder % 60).padStart(2, '0')}:00`;
}

/** Inclusive date window, Monday=1...Sunday=7. Only explicit overrides replace a week. */
export function calendarEvents(plan = {}, from, to) {
  if (!validDate(from) || !validDate(to) || from > to) return [];
  const span = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
  if (span > 3660) throw new RangeError('Takvim aralığı en fazla 10 yıl olabilir.');
  const weekly = list(plan.weekly, 100).map((entry, index) => normalizePlanEntry(entry, index, true)).filter(Boolean);
  const overrides = list(plan.overrides).map((entry, index) => normalizePlanEntry(entry, index, false)).filter(Boolean);
  const events = [];
  for (let offset = 0; offset <= span; offset++) {
    const date = addDays(from, offset);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    // Friday is deliberately outside this user's Saturday–Thursday sport week.
    // Keep old entries in storage; do not generate exercise appointments for it.
    if (weekday === 5) {
      events.push({id:`rota-sport:friday-off:${date}`,source:'rota-sport',sourceId:'friday-off',
        date,type:'rest',title:'Spor yok',description:'Cuma günü spor haftasının dışında, sabit dinlenme günü.',
        start:`${date}T00:00:00`,end:`${addDays(date,1)}T00:00:00`,allDay:true,time:'',durationMinutes:null,
        category:'Spor',tags:['Spor','Dinlenme'],color:'orange',videoIds:[]});
      continue;
    }
    const dayOverrides = overrides.filter(entry => entry.date === date);
    const replaceWeekly = dayOverrides.some(entry => entry.replaceWeekly);
    const scheduled = replaceWeekly ? [] : weekly.filter(entry => entry.weekday === weekday &&
      (!entry.startDate || entry.startDate <= date) && (!entry.endDate || entry.endDate >= date));
    for (const entry of [...scheduled, ...dayOverrides.filter(entry => !entry.cancelled)]) {
      const info = TYPE_INFO[entry.type];
      const timed = validTime(entry.time) && entry.durationMinutes !== null;
      events.push({
        id: `rota-sport:${entry.id}:${date}`,
        source: 'rota-sport', sourceId: entry.id,
        date, type: entry.type,
        title: entry.title || info.label,
        description: text(entry.description, 2000),
        start: timed ? `${date}T${entry.time}:00` : `${date}T00:00:00`,
        end: timed ? endDateTime(date, entry.time, entry.durationMinutes) : `${addDays(date, 1)}T00:00:00`,
        time: entry.time,
        durationMinutes: entry.durationMinutes,
        allDay: !timed,
        category: info.category,
        tags: entry.type === 'workout' ? ['Spor'] : ['Spor', info.label],
        color: info.color,
        videoIds: [...entry.videoIds],
      });
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
