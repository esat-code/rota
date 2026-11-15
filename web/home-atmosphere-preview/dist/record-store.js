let databasePromise;

function database() {
  return databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('rota-record-library-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('entries', {keyPath:'id'});
      request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = undefined; reject(request.error); };
  });
}

export async function savedRecords() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('entries').objectStore('entries').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecords(entries, files = new Map()) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['entries','files'], 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || Error('Kayıt tamamlanamadı.'));
    for (const entry of entries) transaction.objectStore('entries').put(entry);
    for (const [id, file] of files) transaction.objectStore('files').put(file, id);
  });
}

export async function recordFile(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('files').objectStore('files').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const fold = value => String(value).toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i');
const topics = [
  ['Çarpanlara ayırma', /çarpanlara? ayır|iki kare fark|tam kare|iki küp/],
  ['Üslü sayılar', /üslü (sayı|ifade)|üs (kural|özellik)/],
  ['Köklü sayılar', /köklü (sayı|ifade)|karekök/],
  ['Mutlak değer', /mutlak değer/],
  ['Eşitsizlikler', /eşitsizlik|aralık kavram/],
  ['EBOB ve EKOK', /ebob|ekok/],
  ['Problemler', /yaş problem|yüzde problem|hareket problem|işçi problem|problem/],
  ['Fonksiyonlar', /fonksiyon/],
  ['Geometri', /geometri|üçgen|dörtgen|çember|benzerlik/],
  ['Türkçe', /paragraf|dil bilgisi|sözcükte|cümlede|yazım kural|noktalama/],
  ['Coğrafya', /coğrafya|iklim|harita bilgi|nüfus|yer şekilleri/],
  ['Tarih', /osmanlı|inkılap|kurtuluş savaş|tarih/],
  ['Fizik', /fizik|elektrik|kuvvet|newton/],
  ['Kimya', /kimya|periyodik|atom|molekül/],
  ['Biyoloji', /biyoloji|hücre|kalıtım|fotosentez/],
  ['Rusça', /rusça|[а-яё]/],
  ['Spor', /antrenman|egzersiz|kalori|fitness/],
  ['Çalışma Alanı', /çalışma alanı|cüz|sure|ezber/],
].map(([topic,pattern]) => [topic,new RegExp(fold(pattern.source))]);

export function suggestTopic(value) {
  const normalized = fold(value);
  const topic = topics.find(([,pattern]) => pattern.test(normalized))?.[0];
  const section = topic === 'Rusça' ? 'russian' : topic === 'Spor' ? 'sport' : topic === 'Çalışma Alanı' ? 'hafizlik' : topic ? 'yks' : 'other';
  return {topic:topic || 'Genel', section};
}

let readerPromise;
export function pdfReader() {
  return readerPromise ??= new Promise((resolve, reject) => {
    if (window.rotaNotesPDF) {resolve(window.rotaNotesPDF); return;}
    const script = document.createElement('script');
    script.src = new URL('../yks/assets/notes-pdf-reader.js', document.baseURI).href;
    script.onload = () => window.rotaNotesPDF ? resolve(window.rotaNotesPDF) : reject(Error('PDF okuyucu açılamadı.'));
    script.onerror = () => {readerPromise = undefined; reject(Error('PDF okuyucu yüklenemedi.'));};
    document.head.append(script);
  });
}

export async function photoText(blob) {
  const recognize = window.parent?.rotaRecognizeText;
  if (!recognize) throw Error('Fotoğrafı ekleyip metnini elle yazabilirsin.');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await recognize(canvas.toDataURL('image/jpeg', .9));
  } finally {URL.revokeObjectURL(url);}
}

export async function importRecordFile(file, onProgress = () => {}) {
  if (!file.size || file.size > 30 * 1024 * 1024) throw Error('Dosya boş veya 30 MB sınırını aşıyor.');
  const fileId = crypto.randomUUID();
  const base = {fileId, fileName:file.name, mime:file.type, created:Date.now(), type:'document'};
  const make = (title, text, extra = {}) => {
    const suggested = suggestTopic(text);
    return {...base,id:crypto.randomUUID(),title,text,...(suggested.topic === 'Genel' ? suggestTopic(file.name) : suggested),...extra};
  };
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const bytes = await file.arrayBuffer();
    if (!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-')) throw Error('Geçerli bir PDF seç.');
    const reader = await pdfReader();
    const pdf = await reader(new Uint8Array(bytes));
    try {
      if (pdf.numPages > 120) throw Error('Tek seferde en fazla 120 sayfa ekleyebilirsin. PDF’yi bölerek ekle.');
      const entries = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        onProgress(file.name + ' · ' + number + ' / ' + pdf.numPages);
        const sheet = await pdf.getPage(number);
        const content = await sheet.getTextContent();
        let text = content.items.filter(item => typeof item.str === 'string').map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').trim();
        let warning = '';
        if (!text) {
          const viewport = sheet.getViewport({scale:Math.min(2, 1800 / sheet.getViewport({scale:1}).width)});
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          await sheet.render({canvas,viewport}).promise;
          const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.9));
          try {text = await photoText(blob);} catch (error) {warning = error.message;}
        }
        entries.push(make(file.name + ' · Sayfa ' + number, text, {page:number,mime:'application/pdf',warning}));
      }
      return {entries, files:new Map([[fileId,file]])};
    } finally {await pdf.destroy();}
  }
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    let text = '', warning = '';
    try {text = await photoText(file);} catch (error) {warning = error.message;}
    return {entries:[make(file.name,text,{warning})], files:new Map([[fileId,file]])};
  }
  if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
    const text = await file.text();
    if (text.length > 500000) throw Error('Metin çok uzun. Daha küçük parçalar halinde ekle.');
    return {entries:[make(file.name,text)], files:new Map([[fileId,file]])};
  }
  throw Error('PDF, fotoğraf veya metin dosyası seç.');
}
