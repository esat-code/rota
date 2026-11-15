// Türkiye için yerleşik, salt okunur takvim açıklamaları. Kullanıcı etkinliği değildir.
// Dinî tarihler tahmini Hicri dönüşümle değil Diyanet'in yayımladığı listelerden alınır.
export const SOURCES = Object.freeze([
  {title:'MEB · Belirli Gün ve Haftalar',url:'https://www.meb.gov.tr/belirli-gun-ve-haftalar-cizelgesi/duyuru/11814?engelli=true'},
  {title:'Diyanet · Resmî tatiller',url:'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=158'},
  {title:'Birleşmiş Milletler · Uluslararası günler',url:'https://www.un.org/en/observances/list-days-weeks'},
  {title:'Kültür ve Turizm Bakanlığı · Hıdrellez',url:'https://yakegm.ktb.gov.tr/TR-12336/hidrellez-kutlamalari.html'},
  {title:'MEB · Tıp Bayramı',url:'https://orgm.meb.gov.tr/www/hastane-siniflarinda-14-mart-tip-bayrami-ogrencilerin-anlamli-surprizleriyle-anildi/icerik/3559/tr'},
  {title:'MEB · Sevgililer Günü',url:'https://megep.meb.gov.tr/mte_program_modul/moduller_pdf/Mek%C3%A2n%20S%C3%BCsleme-2.pdf'},
  {title:'Diyanet · 2025 dinî günler',url:'https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2025'},
  {title:'Diyanet · 2026 dinî günler',url:'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=153'},
  {title:'Diyanet · 2027 dinî günler',url:'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154'},
  {title:'Diyanet · 2028 dinî günler',url:'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=185'},
  {title:'Diyanet · 2029 dinî günler',url:'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=186'},
  {title:'FAO · Dünya Okul Sütü Günü',url:'https://www.fao.org/fileadmin/templates/est/COMM_MARKETS_MONITORING/Dairy/Documents/World_School_Milk_Day_2017.pdf'},
]);
const MEB=SOURCES[0].url, PUBLIC=SOURCES[1].url, UN=SOURCES[2].url;
// [ay-gün, başlık, tür, kaynak, yarım gün]. Haftalar tek bir gün gibi gösterilmez.
const FIXED = [
  ['01-01','Yılbaşı','public',PUBLIC],
  ['01-24','Uluslararası Eğitim Günü','observance',UN],
  ['02-04','Dünya Kanser Günü','observance',UN],
  ['02-14','Sevgililer Günü','observance',SOURCES[5].url],
  ['02-21','Uluslararası Ana Dil Günü','observance',UN],
  ['03-03','Dünya Yaban Hayatı Günü','observance',UN],
  ['03-08','Dünya Kadınlar Günü','observance',MEB],
  ['03-12','İstiklâl Marşı’nın Kabulü ve Mehmet Akif Ersoy’u Anma Günü','observance',MEB],
  ['03-14','Tıp Bayramı','observance',SOURCES[4].url],
  ['03-18','Çanakkale Zaferi ve Şehitleri Anma Günü','observance',MEB],
  ['03-20','Dünya Mutluluk Günü','observance',UN],
  ['03-21','Nevruz','observance',UN],
  ['03-21','Dünya Ormancılık Günü','observance',UN],
  ['03-21','Dünya Down Sendromu Günü','observance',UN],
  ['03-21','Dünya Şiir Günü','observance',UN],
  ['03-22','Dünya Su Günü','observance',MEB],
  ['03-27','Dünya Tiyatrolar Günü','observance',MEB],
  ['03-30','Uluslararası Sıfır Atık Günü','observance',UN],
  ['04-02','Dünya Otizm Farkındalık Günü','observance',MEB],
  ['04-07','Dünya Sağlık Günü','observance',MEB],
  ['04-07','Kişisel Verileri Koruma Günü','observance',MEB],
  ['04-22','Dünya Günü','observance',UN],
  ['04-23','Ulusal Egemenlik ve Çocuk Bayramı','public',PUBLIC],
  ['04-23','Dünya Kitap ve Telif Hakkı Günü','observance',UN],
  ['04-26','Dünya Fikrî Mülkiyet Günü','observance',MEB],
  ['05-01','Emek ve Dayanışma Günü','public',PUBLIC],
  ['05-03','Dünya Basın Özgürlüğü Günü','observance',UN],
  ['05-06','Hıdırellez','observance',SOURCES[3].url],
  ['05-15','Uluslararası Aile Günü','observance',UN],
  ['05-19','Atatürk’ü Anma, Gençlik ve Spor Bayramı','public',PUBLIC],
  ['05-20','Dünya Arı Günü','observance',UN],
  ['05-22','Uluslararası Biyolojik Çeşitlilik Günü','observance',UN],
  ['05-25','Etik Günü','observance',MEB],
  ['05-29','İstanbul’un Fethi','observance',MEB],
  ['05-31','Dünya Tütünsüz Günü','observance',UN],
  ['06-03','Dünya Bisiklet Günü','observance',UN],
  ['06-05','Dünya Çevre Günü','observance',UN],
  ['06-08','Dünya Okyanuslar Günü','observance',UN],
  ['06-12','Dünya Çocuk İşçiliği ile Mücadele Günü','observance',UN],
  ['06-14','Dünya Kan Bağışçıları Günü','observance',UN],
  ['06-17','Dünya Çölleşme ve Kuraklıkla Mücadele Günü','observance',UN],
  ['06-20','Dünya Mülteciler Günü','observance',UN],
  ['07-11','Dünya Nüfus Günü','observance',UN],
  ['07-15','Demokrasi ve Millî Birlik Günü','public',PUBLIC],
  ['07-20','Dünya Satranç Günü','observance',UN],
  ['07-30','Uluslararası Dostluk Günü','observance',UN],
  ['08-12','Uluslararası Gençlik Günü','observance',UN],
  ['08-19','Dünya İnsani Yardım Günü','observance',UN],
  ['08-30','Zafer Bayramı','public',PUBLIC],
  ['09-07','Uluslararası Temiz Hava Günü','observance',MEB],
  ['09-08','Dünya Okuryazarlık Günü','observance',UN],
  ['09-16','Dünya Ozon Tabakasını Koruma Günü','observance',UN],
  ['09-19','Gaziler Günü','observance',MEB],
  ['09-21','Dünya Barış Günü','observance',UN],
  ['09-27','Dünya Turizm Günü','observance',UN],
  ['10-01','Dünya Yaşlılar Günü','observance',UN],
  ['10-04','Hayvanları Koruma Günü','observance',MEB],
  ['10-05','Dünya Öğretmenler Günü','observance',UN],
  ['10-10','Dünya Ruh Sağlığı Günü','observance',UN],
  ['10-11','Dünya Kız Çocukları Günü','observance',UN],
  ['10-13','Dünya Afet Azaltma Günü','observance',MEB],
  ['10-16','Dünya Gıda Günü','observance',UN],
  ['10-24','Birleşmiş Milletler Günü','observance',MEB],
  ['10-28','Cumhuriyet Bayramı arifesi','public',PUBLIC,true],
  ['10-29','Cumhuriyet Bayramı','public',PUBLIC],
  ['11-10','Atatürk’ü Anma Günü','observance',MEB],
  ['11-12','Afet Eğitimi Hazırlık Günü','observance',MEB],
  ['11-14','Dünya Diyabet Günü','observance',MEB],
  ['11-20','Dünya Çocuk Hakları Günü','observance',MEB],
  ['11-24','Öğretmenler Günü','observance',MEB],
  ['12-01','Dünya AIDS Günü','observance',UN],
  ['12-03','Dünya Engelliler Günü','observance',MEB],
  ['12-04','Dünya Madenciler Günü','observance',MEB],
  ['12-05','Türk Kadınına Seçme ve Seçilme Hakkının Verilişi','observance',MEB],
  ['12-05','Dünya Gönüllüler Günü','observance',UN],
  ['12-05','Dünya Toprak Günü','observance',UN],
  ['12-10','İnsan Hakları Günü','observance',UN],
];
// Gece iki tarih olarak yayımlanmışsa (örn. 11/12 Ocak) başladığı akşam gösterilir.
// Aynı Gregoryen yılda tekrarlayan kandiller/üç aylar ayrı satırlar olarak korunur.
const RELIGIOUS = {
  2025:[['01-01','Üç ayların başlangıcı'],['01-02','Regaib Kandili'],['01-26','Miraç Kandili'],['02-13','Berat Kandili'],['03-01','Ramazan başlangıcı'],['03-26','Kadir Gecesi'],['03-29','Ramazan Bayramı arifesi',true],['03-30','Ramazan Bayramı · 1. gün'],['03-31','Ramazan Bayramı · 2. gün'],['04-01','Ramazan Bayramı · 3. gün'],['06-05','Kurban Bayramı arifesi',true],['06-06','Kurban Bayramı · 1. gün'],['06-07','Kurban Bayramı · 2. gün'],['06-08','Kurban Bayramı · 3. gün'],['06-09','Kurban Bayramı · 4. gün'],['06-26','Hicri yılbaşı'],['07-05','Aşure Günü'],['09-03','Mevlid Kandili'],['12-21','Üç ayların başlangıcı'],['12-25','Regaib Kandili']],
  2026:[['01-15','Miraç Kandili'],['02-02','Berat Kandili'],['02-19','Ramazan başlangıcı'],['03-16','Kadir Gecesi'],['03-19','Ramazan Bayramı arifesi',true],['03-20','Ramazan Bayramı · 1. gün'],['03-21','Ramazan Bayramı · 2. gün'],['03-22','Ramazan Bayramı · 3. gün'],['05-26','Kurban Bayramı arifesi',true],['05-27','Kurban Bayramı · 1. gün'],['05-28','Kurban Bayramı · 2. gün'],['05-29','Kurban Bayramı · 3. gün'],['05-30','Kurban Bayramı · 4. gün'],['06-16','Hicri yılbaşı'],['06-25','Aşure Günü'],['08-24','Mevlid Kandili'],['12-10','Üç ayların başlangıcı'],['12-10','Regaib Kandili']],
  2027:[['01-04','Miraç Kandili'],['01-22','Berat Kandili'],['02-08','Ramazan başlangıcı'],['03-05','Kadir Gecesi'],['03-08','Ramazan Bayramı arifesi',true],['03-09','Ramazan Bayramı · 1. gün'],['03-10','Ramazan Bayramı · 2. gün'],['03-11','Ramazan Bayramı · 3. gün'],['05-15','Kurban Bayramı arifesi',true],['05-16','Kurban Bayramı · 1. gün'],['05-17','Kurban Bayramı · 2. gün'],['05-18','Kurban Bayramı · 3. gün'],['05-19','Kurban Bayramı · 4. gün'],['06-06','Hicri yılbaşı'],['06-15','Aşure Günü'],['08-13','Mevlid Kandili'],['11-29','Üç ayların başlangıcı'],['12-02','Regaib Kandili'],['12-24','Miraç Kandili']],
  2028:[['01-11','Berat Kandili'],['01-28','Ramazan başlangıcı'],['02-22','Kadir Gecesi'],['02-25','Ramazan Bayramı arifesi',true],['02-26','Ramazan Bayramı · 1. gün'],['02-27','Ramazan Bayramı · 2. gün'],['02-28','Ramazan Bayramı · 3. gün'],['05-04','Kurban Bayramı arifesi',true],['05-05','Kurban Bayramı · 1. gün'],['05-06','Kurban Bayramı · 2. gün'],['05-07','Kurban Bayramı · 3. gün'],['05-08','Kurban Bayramı · 4. gün'],['05-25','Hicri yılbaşı'],['06-03','Aşure Günü'],['08-02','Mevlid Kandili'],['11-18','Üç ayların başlangıcı'],['11-23','Regaib Kandili'],['12-13','Miraç Kandili'],['12-30','Berat Kandili']],
  2029:[['01-16','Ramazan başlangıcı'],['02-10','Kadir Gecesi'],['02-13','Ramazan Bayramı arifesi',true],['02-14','Ramazan Bayramı · 1. gün'],['02-15','Ramazan Bayramı · 2. gün'],['02-16','Ramazan Bayramı · 3. gün'],['04-23','Kurban Bayramı arifesi',true],['04-24','Kurban Bayramı · 1. gün'],['04-25','Kurban Bayramı · 2. gün'],['04-26','Kurban Bayramı · 3. gün'],['04-27','Kurban Bayramı · 4. gün'],['05-14','Hicri yılbaşı'],['05-23','Aşure Günü'],['07-23','Mevlid Kandili'],['11-07','Üç ayların başlangıcı'],['11-08','Regaib Kandili'],['12-02','Miraç Kandili'],['12-20','Berat Kandili']],
};
export const RELIGIOUS_YEARS=Object.freeze(Object.keys(RELIGIOUS).map(Number));
const RELIGIOUS_SOURCES=Object.fromEntries(RELIGIOUS_YEARS.map((y,i)=>[y,SOURCES[6+i].url]));
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${String(d.getFullYear()).padStart(4,'0')}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function validYear(year){if(!Number.isInteger(year)||year<100||year>9999)throw new RangeError('Yıl 100–9999 arasında bir tam sayı olmalıdır.');}
function nthWeekday(year,month,weekday,nth){const first=new Date(year,month-1,1);return `${pad(month)}-${pad(1+(weekday-first.getDay()+7)%7+(nth-1)*7)}`;}
function lastWeekday(year,month,weekday){const last=new Date(year,month,0);return `${pad(month)}-${pad(last.getDate()-(last.getDay()-weekday+7)%7)}`;}
function annotation(year,row,index){const [md,title,kind,source,halfDay]=row;return {id:`special-${year}-${md}-${index}`,date:`${String(year).padStart(4,'0')}-${md}`,title,kind,source,...(halfDay?{halfDay:true}:{})};}
/** Fresh, sorted annotations, with no category or editable event state. */
export function getSpecialDays(year){
  validYear(year);
  const rows=[...FIXED,
    [nthWeekday(year,5,0,2),'Anneler Günü','observance',MEB],
    [nthWeekday(year,6,0,3),'Babalar Günü','observance',MEB],
    [nthWeekday(year,9,6,2),'Dünya İlk Yardım Günü','observance',MEB],
    [lastWeekday(year,9,3),'Dünya Okul Sütü Günü','observance',SOURCES[11].url],
    ...(RELIGIOUS[year]||[]).map(([date,title,halfDay])=>[date,title,'religious',RELIGIOUS_SOURCES[year],halfDay]),
  ];
  return rows.map((row,i)=>annotation(year,row,i)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
/** Inclusive civil-day bounds; no UTC parsing that can shift a calendar day. */
export function specialDaysBetween(from,to){
  if(!(from instanceof Date)||!(to instanceof Date)||!Number.isFinite(+from)||!Number.isFinite(+to))throw new TypeError('Geçerli başlangıç ve bitiş tarihleri gerekli.');
  const start=dateKey(from),end=dateKey(to);
  if(start>end)return [];
  const result=[];
  for(let y=from.getFullYear();y<=to.getFullYear();y++)result.push(...getSpecialDays(y).filter(d=>d.date>=start&&d.date<=end));
  return result;
}
/** UI can explain unsupported years without silently inventing lunar dates. */
export function religiousCoverage(years){const requested=[...new Set(years)];return {available:requested.filter(y=>RELIGIOUS_YEARS.includes(y)),missing:requested.filter(y=>!RELIGIOUS_YEARS.includes(y)),complete:requested.every(y=>RELIGIOUS_YEARS.includes(y))};}
