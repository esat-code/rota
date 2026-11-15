import {defaultState,normalizeState,addDays,dateForDay,planSummary,bookProgress,calendarEvents,makeId,validateTask,validateBook} from './model.js';
import {CAMP_META,CAMP_BOOKS,CAMP_TASKS,CAMP_MILESTONES} from './camp.js';
import programsData from './data/programs.json';
import distributionData from './data/score-distributions.json';
import scoreModels from './data/score-models.json';
import topicData from './data/topics.json';
import {MERT70} from './mert70.js';
import {correctProblemCampDays} from './camp-corrections.js';
import {notesHTML,renderNotesMath,handleNoteClick,selectNote} from './notes.js';
import {notesLibraryHTML,updateNotesLibrary,libraryClick,saveLibraryForm} from './note-library.js';

const KEY='rota-yks-v1',CALENDAR_KEY='rota-event-manager-preview-v1';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={home:'M3 10 12 3l9 7v10H3Z M9 20v-7h6v7',grid:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',calendar:'M4 5h16v16H4ZM4 10h16M8 3v4M16 3v4',book:'M12 6Q6 2 3 5v15q5-3 9 0 4-3 9 0V5q-5-3-9 1Zm0 0v14',check:'m5 12 4 4 10-10',target:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4v2',chart:'M4 3v18h17M8 15l4-5 4 2 4-6',clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4v6l4 3',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Zm3 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',plus:'M12 5v14M5 12h14',search:'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM16 16l5 5',external:'M14 3h7v7M21 3l-9 9M10 5H4v15h15v-6',arrow:'m9 5 7 7-7 7',edit:'m4 16 1 4 4-1L20 8l-5-5Zm11-13 5 5',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',moon:'M20 14a8 8 0 0 1-10-10 9 9 0 1 0 10 10',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',info:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 11v6M12 7h.01',lock:'M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3',star:'m12 3 3 6 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1Z',play:'m8 4 12 8-12 8Z'};
const icon=(name)=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[name]||paths.grid)+'"/></svg>';
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>dateKey(new Date());
const fmtDate=(v,options={day:'numeric',month:'long',year:'numeric'})=>v?new Intl.DateTimeFormat('tr-TR',options).format(new Date(v+'T12:00:00')):'X gününü seç';
const fmtNum=(v,d=0)=>Number.isFinite(Number(v))?Number(v).toLocaleString('tr-TR',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const safeURL=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const link=(url,title,cls='')=>safeURL(url)?'<a class="'+cls+'" href="'+esc(safeURL(url))+'" target="_blank" rel="noopener noreferrer">'+esc(title)+' ↗</a>':'';
let storage=localStorage;try{if(parent!==window&&parent.rotaYksChanged)storage=parent.localStorage;}catch{}
let loadError='',saveError='',toastTimer,view='today',selectedDay=1,bookQuery='',topicQuery='',topicExam='TYT',programQuery='',programYear='2026',programType='',programOnlyFav=false,programPage=1,calcComparisonYear='2025',dialogKind='',dialogId='',campCorrection;
const subjects=[['tr','Türkçe',40,'TYT'],['tm','Matematik',40,'TYT'],['ts','Sosyal',20,'TYT'],['tf','Fen',20,'TYT'],['am','Matematik',40,'AYT'],['af','Fizik',14,'AYT'],['ak','Kimya',13,'AYT'],['ab','Biyoloji',13,'AYT']];
function initial(){
  try{
    const raw=storage.getItem(KEY);
    if(raw===null)return {version:1,plan:defaultState(),attempts:[],topicChecks:{},favorites:[],calculator:{diploma:80,obp:true,reduced:false,nets:{}},theme:'dark'};
    const x=JSON.parse(raw);if(!x||x.version!==1||!x.plan||!Array.isArray(x.plan.tasks)||!Array.isArray(x.plan.books))throw Error();
    campCorrection=correctProblemCampDays(normalizeState(x.plan));x.plan=campCorrection.plan;
    return {version:1,plan:normalizeState(x.plan),attempts:Array.isArray(x.attempts)?x.attempts.filter(a=>a&&typeof a.id==='string'&&typeof a.title==='string'&&typeof a.date==='string'&&a.nets&&typeof a.nets==='object').slice(0,500):[],topicChecks:x.topicChecks&&typeof x.topicChecks==='object'&&!Array.isArray(x.topicChecks)?x.topicChecks:{},favorites:Array.isArray(x.favorites)?x.favorites.filter(v=>typeof v==='string').slice(0,500):[],calculator:x.calculator&&typeof x.calculator==='object'?x.calculator:{diploma:80,obp:true,nets:{}},theme:x.theme==='light'?'light':'dark'};
  }catch{loadError='YKS kaydı okunamadı. Mevcut kaydın üzerine yazılmadı. Uygulamayı yeniden aç; sorun sürerse kaydı inceleyelim.';return {version:1,plan:defaultState(),attempts:[],topicChecks:{},favorites:[],calculator:{diploma:80,obp:true,nets:{}},theme:'dark'};}
}
let store=initial();
function notify(){try{parent.rotaYksChanged?.();}catch{}}
function toast(text){$('#yks-toast').textContent=text;$('#yks-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#yks-toast').hidden=true,5000);}
function validCalendar(events){return Array.isArray(events)&&events.every(e=>e&&typeof e.id==='string'&&typeof e.title==='string'&&typeof e.description==='string'&&typeof e.category==='string'&&typeof e.color==='string'&&Array.isArray(e.tags)&&e.tags.every(t=>typeof t==='string')&&Number.isFinite(+new Date(e.start))&&Number.isFinite(+new Date(e.end))&&+new Date(e.end)>+new Date(e.start));}
function syncCalendar(){
  if(!store.plan.settings.startDate)return true;
  try{
    const raw=storage.getItem(CALENDAR_KEY),events=raw===null?[]:JSON.parse(raw);
    if(!validCalendar(events))throw Error('Takvim kaydı okunamadı; eski kayıt korunuyor.');
    const own=calendarEvents(store.plan);
    storage.setItem(CALENDAR_KEY,JSON.stringify([...events.filter(e=>e.source!=='rota-yks'),...own]));notify();return true;
  }catch(e){saveError='Plan kaydedildi, fakat takvim eşitlenemedi. '+(e.message||'Depolamayı kontrol et.');toast(saveError);return false;}
}
function commit(next,options={calendar:true}){
  if(loadError){toast(loadError);return false;}
  try{next.plan=normalizeState(next.plan);storage.setItem(KEY,JSON.stringify(next));store=next;saveError='';notify();if(options.calendar!==false)syncCalendar();return true;}
  catch{saveError='Değişiklik kaydedilemedi. Önceki kayıt korunuyor; depolama dolu veya kapalı olabilir.';toast(saveError);return false;}
}
const clone=()=>structuredClone(store);
const bookById=id=>store.plan.books.find(b=>b.id===id);
const taskById=id=>store.plan.tasks.find(t=>t.id===id);
const unmet=task=>(task.requires||[]).filter(id=>!taskById(id)?.done);
const dateForTask=t=>t.done&&t.completedDate?t.completedDate:dateForDay(store.plan,t.day);
function setView(next){view=next;render();window.scrollTo(0,0);}
function currentCampDay(){
  if(!store.plan.settings.startDate)return 1;
  const max=planSummary(store.plan).campDays;
  for(let day=1;day<=Math.max(1,max);day++)if(dateForDay(store.plan,day)>=today())return day;
  return Math.max(1,max);
}
selectedDay=currentCampDay();
const navItems=[['today','Bugün','grid'],['plan','Kamp programı','calendar'],['books','Kitaplarım','book'],['topics','Konular & sorular','book'],['sources','Videolar & kaynaklar','play'],['tools','Araçlar','grid'],['settings','Plan ayarları','settings'],['notes','Notlar','book']];
const toolItems=[['exams','Denemeler & puan','chart'],['targets','Üniversite hedefleri','target']];
function navigationHTML(){
  const active=toolItems.some(t=>t[0]===view)?'tools':view;
  return navItems.map(([id,title,ico])=>'<button data-nav="'+id+'" class="'+(active===id?'active':'')+'" '+(active===id?'aria-current="page"':'')+'>'+icon(ico)+esc(title)+'</button>').join('');
}
function render(){
  document.body.dataset.theme=store.theme;
  const label=[...navItems,...toolItems].find(x=>x[0]===view)?.[1]||'YKS';
  $('#yks-root').innerHTML='<div class="app"><aside class="sidebar"><div class="brand"><img src="../branding/rota-mark.svg" alt="">Rota</div><p class="sidebar-label">YKS ÇALIŞMA ALANI</p><nav class="nav" aria-label="YKS bölümleri">'+navigationHTML()+'</nav><div class="sidebar-bottom"><div class="profile"><span>S</span><div><strong>Sayısal hazırlık</strong><small>Mezun düzeni · TYT + AYT SAY</small></div></div></div></aside><div class="main"><header class="topbar"><div class="breadcrumb"><span>Çalışma alanı</span><span>/</span><span>'+esc(label)+'</span></div><div class="row"><button class="icon ghost" data-action="theme" aria-label="'+(store.theme==='dark'?'Açık tema':'Koyu tema')+'">'+icon(store.theme==='dark'?'sun':'moon')+'</button><button class="ghost" data-action="calendar">'+icon('calendar')+'<span>Takvim</span></button><button class="ghost" data-action="planner">'+icon('book')+'<span>Çalışma Alanı</span></button><button class="ghost" data-action="home">'+icon('home')+'<span class="home-text">Ana sayfaya dön</span></button></div></header>'+(loadError?'<div class="sticky-error" role="alert">'+esc(loadError)+'</div>':'')+'<main class="page" id="page">'+pageHTML()+'</main></div></div>';
  if(view==='exams')updateResults();
  if(view==='notes'){renderNotesMath();updateNotesLibrary(()=>{if(view==='notes')render();});}
}
function pageHTML(){
  const back=toolItems.some(t=>t[0]===view)?'<div class="row" style="margin-bottom:20px"><button class="ghost" data-nav="tools">‹ Araçlara dön</button></div>':'';
  const review=view==='plan'&&campCorrection?.reviewTaskIds.length?'<div class="notice">Son problemler bölümündeki 48–50. günler düzeltildi. Daha önce tamamladığın veya elle düzenlediğin '+campCorrection.reviewTaskIds.length+' çalışma değiştirilmedi; son üç günü kontrol edebilirsin. <button data-day="92">Günleri incele</button></div>':'';
  return back+review+({today:todayHTML,plan:planHTML,books:booksHTML,topics:topicsHTML,exams:examsHTML,targets:targetsHTML,tools:toolsHTML,sources:sourcesHTML,settings:settingsHTML,notes:()=>notesLibraryHTML(notesHTML)}[view]||todayHTML)()+(view==='plan'?continuationHTML():'');
}
function continuationHTML(){
  const milestone=(store.plan.milestones||[]).find(m=>m.id==='camp-ready-problem-continuation');
  if(!milestone)return '';
  const ready=milestone.prerequisiteTaskIds.length>0&&milestone.prerequisiteTaskIds.every(id=>taskById(id)?.done);
  const earlier=store.plan.tasks.filter(t=>t.id.startsWith('camp-mat-fasikul-1-'));
  const firstDone=earlier.length===11&&earlier.every(t=>t.done);
  const titles=['Mikro Orijinal · 2. seviye','Acil Matematik · 3. seviye','Orijinal · 4. seviye','Rutin Olmayan Problemler · 5. seviye'];
  return '<section class="panel" data-camp-continuation style="margin-top:24px"><div class="panel-head"><div><h2>Kampın devamı</h2><p>“Yukarıdakiler bittikten sonra” · 94 günlük tarihli bölümle kampın tamamı bitmiş olmaz.</p></div><span class="tag">'+(ready?'Başlamaya hazır':'Önce yukarıdaki çalışmalar')+'</span></div><div class="panel-body"><div class="two-column"><div><h3>Seviyeli fasiküller</h3><p style="margin-top:12px"><s>Hiç Problem Değil · 1. seviye</s><br>'+(firstDone?'Önceki aşamada tamamlandı.':'Önceki aşamada bitmiş olması gerekiyor; burada tekrar başlanmaz.')+'</p>'+titles.map(t=>'<div class="range-row"><span>'+esc(t)+'</span></div>').join('')+'</div><div><h3>Birlikte devam edecek kaynaklar</h3><div class="note-box" style="margin-top:14px"><strong>Bilgi Sarmal · Problemler Soru Bankası</strong><p>Fasiküllerle paralel. Önceki genel TYT soru bankasından ayrı kaynak.</p></div><div class="note-box"><strong>Yıldızlar · Problemler Denemesi</strong><p>Rutin gibi devam.</p></div><p>Bu aşamanın gün, test ve sayfa miktarı belirtilmedikçe ek çalışma veya bitiş tarihi uydurulmaz.</p></div></div></div></section>';
}
function toolsHTML(){
  return heading('Araçlar.','Çalışma programından ayrı, ihtiyaç duyduğunda açabileceğin yardımcılar.')+'<div class="two-column">'+toolItems.map(([id,title,ico])=>'<section class="panel"><div class="panel-head">'+icon(ico)+'<h2>'+esc(title)+'</h2></div><div class="panel-body"><p>'+(id==='exams'?'Deneme kayıtları, net takibi ve geçmiş yıllara göre puan tahmini.':'Üniversite programları, taban puanlar ve kaydettiğin hedefler.')+'</p><button style="margin-top:20px" data-nav="'+id+'">Aç '+icon('arrow')+'</button></div></section>').join('')+'</div>';
}
function heading(title,subtitle,actions=''){return '<div class="heading"><div><div class="eyebrow">YKS / '+esc(store.plan.settings.name)+'</div><h1>'+title+'</h1><p class="subtitle">'+subtitle+'</p></div><div class="row">'+actions+'</div></div>';}
function progress(value){return '<div class="progress-track" aria-hidden="true"><i style="width:'+Math.max(0,Math.min(100,value))+'%"></i></div>';}
function dayControl(){return '<div class="day-control"><button data-day-step="-1" aria-label="Önceki kamp günü">‹</button><label><span class="sr-only">Kamp günü</span><input id="selected-day" type="number" min="1" max="73000" value="'+selectedDay+'"></label><button data-day-step="1" aria-label="Sonraki kamp günü">›</button></div>';}
function taskHTML(task){
  const blocked=unmet(task),book=bookById(task.bookId),source=task.sourceUrl||task.url;
  return '<article class="task '+(task.done?'done':'')+'"><input type="checkbox" data-task-check="'+esc(task.id)+'" aria-label="'+esc(task.title)+' tamamlandı" '+(task.done?'checked ':'')+(!task.done&&blocked.length?'disabled ':'')+'><div class="task-content"><span class="task-title">'+esc(task.title)+'</span><div class="task-meta"><span class="tag subject">'+esc(task.subject||'Çalışma')+'</span><span class="tag">'+esc(task.kind)+'</span>'+(book?'<span class="tag">'+esc(book.title)+'</span>':'')+(task.pageFrom?'<span class="tag">s. '+task.pageFrom+'–'+task.pageTo+'</span>':'')+(task.minutes?'<span class="tag">'+task.minutes+' dk</span>':'')+'</div>'+(task.note?'<p class="task-note">'+esc(task.note)+'</p>':'')+(source?link(source,'Videoyu aç','source-link'):'')+(blocked.length&&!task.done?'<p class="task-lock">'+icon('lock')+' Önce '+blocked.length+' çalışma: '+blocked.slice(0,2).map(id=>esc(taskById(id)?.title||'Silinmiş önkoşul')).join(', ')+(blocked.length>2?'…':'')+'</p>':'')+'</div><div class="task-actions"><button data-edit-task="'+esc(task.id)+'" aria-label="Görevi düzenle">'+icon('edit')+'</button></div></article>';
}
function dayList(day){const tasks=store.plan.tasks.filter(t=>t.day===day);return tasks.length?'<div class="task-list">'+tasks.map(taskHTML).join('')+'</div>':'<div class="empty">'+icon('calendar')+'<h3>Bu gün için eklenmiş görev yok.</h3><p>Kaynakta boş bırakılan günleri kendiliğimden doldurmuyorum.</p><div class="row"><button data-action="new-task">'+icon('plus')+'Görev ekle</button></div></div>';}
function readinessHTML(limit=99){
  const milestones=store.plan.milestones||[];
  return milestones.length?milestones.slice(0,limit).map(m=>{
    const ids=Array.isArray(m.prerequisiteTaskIds)?m.prerequisiteTaskIds:[],done=ids.filter(id=>taskById(id)?.done).length,ready=ids.length>0&&done===ids.length;
    return '<div class="milestone"><div class="row" style="justify-content:space-between"><strong>'+esc(m.title)+'</strong><span class="tag '+(ready?'ready':'')+'">'+(ready?'Hazır':done+'/'+ids.length)+'</span></div><p>'+esc(m.note||m.description||'')+'</p>'+progress(ids.length?done/ids.length*100:0)+(Array.isArray(m.unlockSuggestions)?'<p>' + m.unlockSuggestions.map(v=>esc(typeof v==='string'?v:v.title||v.name||'')).filter(Boolean).join(' · ')+'</p>':'')+'</div>';
  }).join(''):'<p>Önkoşullarını görev düzenleme ekranında seçebilirsin.</p>';
}
function countdown(){
  const date=store.plan.settings.examDate;
  if(!date)return {value:'Tarih seç',label:'YKS hedef tarihi henüz girilmedi.'};
  const diff=new Date(date+'T10:15:00')-new Date(),days=Math.ceil(diff/86400000);
  return {value:days>0?days+' gün':days===0?'Bugün':'Tarih geçti',label:fmtDate(date)+' · kişisel hedef'};
}
function todayHTML(){
  const s=planSummary(store.plan),dayTasks=store.plan.tasks.filter(t=>t.day===selectedDay),done=dayTasks.filter(t=>t.done).length,c=countdown();
  return heading('Bugünün rotası.',fmtDate(today(),{weekday:'long',day:'numeric',month:'long'})+' · Kendi programın, kendi tempon.','<button class="primary" data-action="new-task">'+icon('plus')+'Görev ekle</button>')+
    '<div class="stats"><div class="stat">'+icon('calendar')+'<small>Kamp günü</small><strong>'+selectedDay+'<span style="font-size:13px;color:var(--muted)"> / '+s.campDays+'</span></strong><p>'+esc(fmtDate(dateForDay(store.plan,selectedDay)))+'</p></div><div class="stat">'+icon('check')+'<small>Bugünkü çalışmalar</small><strong>'+done+'<span style="font-size:13px;color:var(--muted)"> / '+dayTasks.length+'</span></strong><p>Yalnızca kamp kapsamındaki görevler</p></div><div class="stat date-stat">'+icon('target')+'<small>Tarihli aşama bitişi</small><strong>'+esc(s.endDate?fmtDate(s.endDate,{day:'numeric',month:'short'}):'X gününü seç')+'</strong><p>'+s.totalDays+' takvim günü'+(s.postponedDays?' · '+s.postponedDays+' gün ötelendi':'')+'</p></div><div class="stat">'+icon('clock')+'<small>YKS geri sayımı</small><strong id="countdown">'+esc(c.value)+'</strong><p>'+esc(c.label)+'</p></div></div>'+
    '<div class="dashboard"><section class="panel"><div class="panel-head"><div><h2>Günün çalışma listesi</h2><p>'+selectedDay+'. gün · '+esc(dateForDay(store.plan,selectedDay)?fmtDate(dateForDay(store.plan,selectedDay)):'Başlangıç tarihi bekleniyor')+'</p></div>'+dayControl()+'</div>'+(!store.plan.settings.startDate?'<div class="panel-body"><div class="note-box" style="margin:0"><strong>X gününü belirle.</strong><p>Canva’daki plan burada. Başlangıcı seçtiğinde tarihleri ve bitişi hesaplanıp takvimine işlenecek.</p><button data-nav="settings">Başlangıç tarihini ayarla ↗</button></div></div>':'')+dayList(selectedDay)+'</section><aside><section class="panel" style="margin-bottom:22px"><div class="panel-head"><h2>Kamp ilerlemesi</h2><span class="tag">'+s.progress+'%</span></div><div class="panel-body"><strong style="font-size:26px;font-weight:500">'+s.completedTasks+' <small>/ '+s.taskCount+' çalışma</small></strong>'+progress(s.progress)+'<p style="margin-top:13px">Kampın tamamlanması, bu kitapların bütün sayfalarının bitmesi anlamına gelmez.</p><button class="ghost" style="margin-top:17px" data-nav="plan">Programın tamamı '+icon('arrow')+'</button></div></section><section class="panel"><div class="panel-head"><h2>Sonraki aşamaya hazırlık</h2></div><div class="panel-body" style="padding-top:3px">'+readinessHTML(3)+'<button class="ghost" style="margin-top:17px" data-nav="plan">Tüm aşamaları gör</button></div></section></aside></div>';
}
function planHTML(){
  const summary=planSummary(store.plan),start=Math.max(1,selectedDay-((selectedDay-1)%7));
  return heading('Kamp programı.', 'X günü → '+(summary.endDate?esc(fmtDate(summary.endDate)):'başlangıç tarihi bekleniyor')+' · '+summary.totalDays+' takvim günü · tarihli bölüm.','<button data-action="postpone">'+icon('calendar')+'Gün ötele</button><button class="primary" data-action="new-task">'+icon('plus')+'Görev ekle</button>')+
    '<div class="week-strip">'+Array.from({length:7},(_,i)=>start+i).map(day=>{const tasks=store.plan.tasks.filter(t=>t.day===day),count=tasks.filter(t=>t.done).length;return '<button class="week-day" data-day="'+day+'" aria-current="'+(day===selectedDay)+'"><small>'+day+'. GÜN</small><strong>'+esc(dateForDay(store.plan,day)?fmtDate(dateForDay(store.plan,day),{day:'numeric',month:'short'}):'X'+(day===1?'':'+'+(day-1)))+'</strong><small>'+count+'/'+tasks.length+' çalışma</small></button>';}).join('')+'</div>'+
    '<div class="dashboard"><section class="panel"><div class="panel-head"><div><h2>'+selectedDay+'. gün</h2><p>'+esc(fmtDate(dateForDay(store.plan,selectedDay)))+'</p></div>'+dayControl()+'</div>'+dayList(selectedDay)+'</section><aside><section class="panel"><div class="panel-head"><h2>Çalışma sırası ve hazırlık</h2></div><div class="panel-body" style="padding-top:4px">'+readinessHTML()+'</div></section><section class="panel" style="margin-top:20px"><div class="panel-head"><h2>Kampın kuralları</h2></div><div class="panel-body"><p>Önce konu, ardından ilgili konunun soru bankaları. Kitabın konu sırası değil, senin belirlediğin sıra esas. Eksik kitap sayfaları kendiliğinden ödev yapılmaz.</p><details style="margin-top:15px"><summary style="cursor:pointer;font-size:11px">Netleştirilecek kaynak ayrıntıları</summary><ul class="timeline-notes">'+(CAMP_META.unresolved||[]).map(x=>'<li>'+esc(typeof x==='string'?x.note||x:'Ayrıntı kontrol edilecek')+'</li>').join('')+'</ul></details></div></section></aside></div>';
}
function booksHTML(){return heading('Kitaplarım.','Kitabın tamamını değil, çalıştığın bölüm ve sayfaları takip et.','<button class="primary" data-action="new-book">'+icon('plus')+'Kitap ekle</button>')+'<div class="filters"><label class="search">'+icon('search')+'<input id="book-query" placeholder="Kitap, ders veya kaynak ara…" value="'+esc(bookQuery)+'" aria-label="Kitap ara"></label></div><div class="book-grid" id="book-grid">'+bookCards()+'</div>';}
function bookCards(){const books=store.plan.books.filter(b=>(b.title+' '+b.subject).toLocaleLowerCase('tr').includes(bookQuery.toLocaleLowerCase('tr')));return books.map(b=>{const p=bookProgress(b),tasks=store.plan.tasks.filter(t=>t.bookId===b.id),done=tasks.filter(t=>t.done).length;return '<article class="book-card"><div class="book-cover">'+icon('book')+'<strong>'+esc(b.subject||'Kaynak')+'<br><small>'+esc(b.kind)+'</small></strong></div><h3>'+esc(b.title)+'</h3><p>'+esc(b.edition||'Baskı / yıl bilgisi eklenmedi')+'</p>'+progress(p.percent??0)+'<p>'+p.completedPages+' sayfa işlendi'+(p.totalPages?' / '+p.totalPages:' · toplam sayfa bilinmiyor')+'</p><p>'+done+'/'+tasks.length+' kamp görevi tamamlandı.</p><div class="row"><button data-book="'+esc(b.id)+'">Bölümler & sayfalar</button><button class="icon ghost" data-edit-book="'+esc(b.id)+'" aria-label="Kitabı düzenle">'+icon('edit')+'</button></div></article>';}).join('')||'<div class="empty"><h3>Bu aramaya uyan kitap yok.</h3></div>';}
function topicsHTML(){
  return heading('Konular & çıkmış sorular.','TYT’nin tamamı, AYT’de yalnızca sayısal. Soru metinleri kopyalanmaz; resmî kitapçık açılır.')+'<div class="filters"><div class="pill-group"><button data-exam-filter="TYT" class="'+(topicExam==='TYT'?'active':'')+'">TYT</button><button data-exam-filter="AYT" class="'+(topicExam==='AYT'?'active':'')+'">AYT Sayısal</button></div><label class="search">'+icon('search')+'<input id="topic-query" placeholder="Ders veya konu ara…" value="'+esc(topicQuery)+'" aria-label="Konu ara"></label><button data-action="booklets">'+icon('external')+'ÖSYM kitapçıkları</button></div><div class="topics" id="topic-list">'+topicGroups()+'</div><p class="legend">'+esc(topicData.notice||'Konu sınıflandırmaları kaynaklara göre değişebilir; bulunmayan dağılımlar sıfır gösterilmez.')+' '+link(topicData.sourceUrl||'https://yksprogram.com.tr/','Dağılım kaynağı')+'</p>';
}
function topicGroups(){
  return (topicData.groups||[]).filter(g=>g.exam===topicExam).map(g=>{
    const topics=(g.topics||[]).filter(t=>(g.subject+' '+t.title).toLocaleLowerCase('tr').includes(topicQuery.toLocaleLowerCase('tr')));
    if(!topics.length)return '';
    return '<details '+(topicQuery?'open':'')+'><summary><span>'+esc(g.subject)+'</span><small>'+esc(g.questionLabel||((g.questionCount??'—')+' soru'))+' · '+topics.filter(t=>store.topicChecks[t.id]).length+'/'+topics.length+' konu</small></summary><div class="topic-info">Toplam sayı ders / test içindir. Ortalamalar 2018–2024 üçüncü taraf konu sınıflamasıdır; belirli yılın kesin soru adedi değildir.</div>'+topics.map(t=>'<div class="topic-row"><label><input type="checkbox" data-topic="'+esc(t.id)+'" '+(store.topicChecks[t.id]?'checked':'')+'>'+esc(t.title)+'</label><small>'+Object.entries(t.counts||{}).slice(-3).map(([year,n])=>esc(year)+': '+esc(n)).join(' · ')+'</small><button data-topic-add="'+esc(t.id)+'">'+icon('plus')+'Plana ekle</button></div>').join('')+'</details>';
  }).join('')||'<div class="empty"><h3>Aramana uyan konu yok.</h3></div>';
}
function sourcesHTML(){
  const urls=CAMP_META.socialVideoLinks||CAMP_META.videoLinks||CAMP_META.sourceLinks||[];
  return heading('Videolar & kaynaklar.','Senin eklediğin bağlantılar korunur. Yeni bir adres ekleyebilir veya ilgili göreve bağlayabilirsin.','<button data-action="new-task" class="primary">'+icon('plus')+'Bağlantılı görev ekle</button>')+'<section class="panel" style="margin-bottom:20px"><div class="panel-head"><div><h2>Mert Hoca · 70 günlük kamp</h2><p>Yalnızca senin kampında kullanılan günler; kalan kitap ödev yapılmaz.</p></div><button data-action="mert-reference">Konu & sayfa eşleştirmesi</button></div></section><section class="panel"><div class="panel-head"><div><h2>NE NE ZAMAN video bağlantıları</h2><p>Günü doğrulanmamış bağlantı rastgele bir göreve atanmaz.</p></div><span class="tag">'+urls.length+' bağlantı</span></div><div class="panel-body source-list">'+urls.map((item,i)=>{const url=typeof item==='string'?item:item.url||item.href;return '<div>'+link(url,(i+1)+'. '+(typeof item==='object'&&item.title?item.title:'Kaynak videosu'))+'<p>'+esc(url)+'</p></div>';}).join('')+'</div></section><section class="panel" style="margin-top:22px"><div class="panel-head"><h2>Kullandığım veriler</h2></div><div class="panel-body source-list">'+(programsData.meta?.sources||[]).map(s=>'<div>'+link(s.url,s.title||s.id)+'<p>'+esc(s.year)+' · Resmî genel kontenjan taban puanları</p></div>').join('')+'<div>'+link('https://yksprogram.com.tr/','YKSProgram — araç ve konu dağılımı referansı')+'</div><div>'+link('https://www.osym.gov.tr/Sayfa/SinavTakvimi','ÖSYM sınav takvimi')+'<p>2027 tarihini doğrulanmış resmî tarih diye varsaymıyorum. Ayarlarda kişisel hedef tarihi girebilirsin.</p></div><div>'+link(CAMP_META.sourceUrl||'https://www.canva.com/','Kendi Canva planın — güncel ikinci sayfa')+'</div></div></section>';
}
function settingsHTML(){
  const s=planSummary(store.plan);
  return heading('Plan ayarları.','Günlerin ve bitişin, belirlediğin X başlangıcına göre hesaplanır.')+'<div class="settings-grid"><section class="panel"><div class="panel-head"><h2>Başlangıç & tarih</h2></div><form id="settings-form" class="panel-body"><label>Plan adı<input name="name" required maxlength="160" value="'+esc(store.plan.settings.name)+'"></label><label>X başlangıç günü<input name="startDate" type="date" value="'+esc(store.plan.settings.startDate)+'" required></label><label>YKS hedef tarihi — kişisel<input name="examDate" type="date" value="'+esc(store.plan.settings.examDate)+'"></label><p>2027 resmî sınav tarihi henüz doğrulanmadı. Seçtiğin tarih kişisel hedef olarak etiketlenir.</p><div class="note-box" style="margin:0"><strong>Tarihli aşama bitişi: '+esc(s.endDate?fmtDate(s.endDate):'X günü bekleniyor')+'</strong><p>'+s.campDays+' kamp günü + '+s.postponedDays+' gün öteleme. Kaynaktaki 94 gün, X ile X+93 arasını kapsar.</p></div><p id="settings-error" class="error" role="alert"></p><button class="primary" type="submit">Kaydet & takvimle eşitle</button></form></section><section class="panel"><div class="panel-head"><h2>Gün öteleme</h2><button data-action="postpone">'+icon('plus')+'Ötele</button></div><div class="panel-body">'+(store.plan.postponements.length?store.plan.postponements.map((p,i)=>'<div class="range-row"><span>'+p.day+'. günden itibaren '+p.days+' gün ileri</span><button class="ghost danger" data-remove-shift="'+i+'" aria-label="Ötelemeyi kaldır">'+icon('trash')+'</button></div>').join(''):'<p>Henüz öteleme yok. Bir günü kaçırdığında, seçtiğin günden sonraki planı ileri taşıyabilirsin.</p>')+'<p style="margin-top:18px">Tamamlanan görevlerin tarihleri korunur. Kendi takvim etkinliklerin ve Çalışma Alanı kayıtların değiştirilmez.</p></div></section></div><div class="note-box" style="margin-top:22px"><strong>Kitabı bitirme hedefi eklenmez.</strong><p>Plan, senin belirlediğin çalışmalarla sınırlıdır. Hazırlık kapıları yalnızca kaynakta yazan bir sonraki aşamayı gösterir; otomatik yeni ödev eklemez.</p></div>';
}
function netRows(nets={},mode='all',prefix='calc'){
  return '<div class="net-grid head"><span>Ders</span><span>Doğru</span><span>Yanlış</span><span>Net</span></div>'+subjects.filter(s=>mode==='all'||s[3]===mode).map(([key,label,count,exam])=>'<div class="net-grid net-row"><span>'+exam+' '+label+'<small style="display:block">'+count+' soru</small></span><input type="number" min="0" max="'+count+'" step="1" data-net="'+key+'" data-side="correct" aria-label="'+exam+' '+label+' doğru" value="'+esc(nets[key]?.correct??0)+'"><input type="number" min="0" max="'+count+'" step="1" data-net="'+key+'" data-side="wrong" aria-label="'+exam+' '+label+' yanlış" value="'+esc(nets[key]?.wrong??0)+'"><strong id="'+prefix+'-net-'+key+'">'+fmtNum(Number(nets[key]?.correct||0)-Number(nets[key]?.wrong||0)/4,2)+'</strong></div>').join('');
}
function readNets(container){
  const nets={};container.querySelectorAll('[data-net]').forEach(el=>{nets[el.dataset.net]||={correct:0,wrong:0};nets[el.dataset.net][el.dataset.side]=Number(el.value);});return nets;
}
function netAnalysis(nets){
  let tyt=0,ayt=0,errors=[];
  const values={};
  for(const [key,label,max,exam]of subjects){
    const c=Number(nets[key]?.correct??0),w=Number(nets[key]?.wrong??0);
    if(!Number.isInteger(c)||!Number.isInteger(w)||c<0||w<0||c+w>max)errors.push(exam+' '+label+': doğru + yanlış en fazla '+max+' olmalı.');
    values[key]=c-w/4;if(exam==='TYT')tyt+=values[key];else ayt+=values[key];
  }
  return {tyt,ayt,values,errors};
}
function obpContribution(c=store.calculator){
  const diploma=Number(c.diploma);
  if(c.obp===false)return 0;
  return diploma>=50&&diploma<=100?diploma*5*(c.reduced?.06:.12):null;
}
function estimatedScore(year,type,nets,c=store.calculator){
  const model=scoreModels.years?.[year]?.[type];
  const analysis=netAnalysis(nets),obp=obpContribution(c);
  if(!model||analysis.errors.length||obp===null)return null;
  if(analysis.values.tr<.5&&analysis.values.tm<.5)return null;
  if(type==='SAY'&&analysis.values.am<.5&&analysis.values.af+analysis.values.ak+analysis.values.ab<.5)return null;
  const map={tr:'tr',so:'ts',ma:'tm',fe:'tf',ayt_ma:'am',fi:'af',ki:'ak',bi:'ab'};
  let score=Number(model.intercept);if(!Number.isFinite(score))return null;
  for(const [key,coefficient]of Object.entries(model.coefficients||{})){
    if(!map[key]||!Number.isFinite(Number(coefficient)))return null;
    score+=analysis.values[map[key]]*Number(coefficient);
  }
  return {raw:score,placement:score+obp};
}
function rankBand(year,type,points,placement=true){
  const entry=distributionData.years?.[year];
  const values=entry?.[placement?'placement':'raw']?.[type];
  if(!Array.isArray(values)||!values.length||!Number.isFinite(points))return null;
  const sorted=values.filter(v=>Array.isArray(v)&&Number.isFinite(v[0])&&Number.isFinite(v[1])).sort((a,b)=>b[0]-a[0]);
  let higher=0;
  for(const [threshold,count]of sorted){
    if(points>=threshold)return {low:Math.min(higher+1,Math.max(1,count)),high:Math.max(1,count),official:entry.official===true,sourceUrl:entry.sourceUrl};
    higher=count;
  }
  return null;
}
function examsHTML(){
  const c=store.calculator,analysis=netAnalysis(c.nets||{});
  const attempts=store.attempts.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const graph=attempts.slice(0,14).reverse(),height=140,width=600;
  const points=graph.map((a,i)=>{const n=netAnalysis(a.nets);return [20+(graph.length>1?i/(graph.length-1):.5)*(width-40),height-15-Math.max(0,n.tyt)/120*(height-35)];});
  return heading('Denemeler & puan.','Denemelerini kaydet, netlerini karşılaştır ve geçmiş yıl senaryosu oluştur.','<button class="primary" data-action="new-attempt">'+icon('plus')+'Deneme ekle</button>')+
    '<div class="two-column"><section class="panel"><div class="panel-head"><h2>Netlerini gir</h2><span class="tag">TYT + AYT SAY</span></div><div class="panel-body" id="calc-nets">'+netRows(c.nets)+'<div class="net-total"><span>TYT toplam <strong id="calc-total-tyt">'+fmtNum(analysis.tyt,2)+'</strong></span><span>AYT toplam <strong id="calc-total-ayt">'+fmtNum(analysis.ayt,2)+'</strong></span></div><p id="net-error" class="error" role="alert"></p></div></section><section class="panel"><div class="panel-head"><h2>Yıl, OBP & sonuç</h2></div><div class="panel-body"><div class="score-settings"><label>Hesaplama yılı<select id="calc-year">'+[2026,2025,2024,2023,2022].map(y=>'<option '+(String(y)===calcComparisonYear?'selected':'')+'>'+y+'</option>').join('')+'</select></label><label>Diploma notu (50–100)<input id="calc-diploma" type="number" min="50" max="100" step=".01" value="'+esc(c.diploma??80)+'"></label><label class="check"><input id="calc-obp" type="checkbox" '+(c.obp!==false?'checked':'')+'>OBP dahil</label><label class="check"><input id="calc-reduced" type="checkbox" '+(c.reduced?'checked':'')+'>Önceki yıl yerleştim</label></div><p style="margin-top:15px">OBP = diploma notu × 5. Katkı normalde × 0,12; önceki yıl yerleşme durumunda × 0,06. Mezuna kalmak tek başına OBP’yi düşürmez.</p><div id="score-results" class="score-results"></div><div class="notice" style="margin:20px 0 0">Netten puan dönüşümü üçüncü tarafın geçmiş yıl istatistiksel modelidir; resmî sonuç veya yerleşme garantisi değildir. 2026 için doğrulanmış net→puan modeli yoksa sonuç üretilmez.</div><div class="row" style="margin-top:17px">'+link(scoreModels.sourceUrl||'https://yksprogram.com.tr/yks-siralama-hesaplama','Tahmin modelinin kaynağı','source-link')+'<button data-action="use-score">Üniversitelerle karşılaştır</button></div></div></section></div>'+
    '<section class="panel" style="margin-top:23px"><div class="panel-head"><h2>Deneme geçmişin</h2><span class="tag">'+attempts.length+' kayıt</span></div><div class="panel-body">'+(graph.length?'<p>Son '+graph.length+' kayıtta TYT neti</p><svg class="chart" viewBox="0 0 600 160" role="img" aria-label="Deneme kayıtlarında TYT net değişimi"><path d="M20 15v125h560" fill="none" stroke="var(--line)"/><text x="0" y="20">120</text><text x="0" y="143">0</text><polyline points="'+points.map(p=>p.join(',')).join(' ')+'"/>'+points.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3" fill="var(--accent)"><title>'+esc(graph[i].title)+': '+fmtNum(netAnalysis(graph[i].nets).tyt,2)+'</title></circle>').join('')+'</svg>'+attempts.map(a=>{const n=netAnalysis(a.nets);return '<div class="exam-record"><div><strong>'+esc(a.title)+'</strong><small>'+esc(fmtDate(a.date))+' · '+esc(a.kind||'Deneme')+'</small></div><div class="row"><span class="tag">TYT '+fmtNum(n.tyt,2)+'</span><span class="tag">AYT '+fmtNum(n.ayt,2)+'</span><button class="icon ghost" data-load-attempt="'+esc(a.id)+'" aria-label="Bu netleri hesaplayıcıya getir">'+icon('arrow')+'</button><button class="icon ghost danger" data-remove-attempt="'+esc(a.id)+'" aria-label="Deneme kaydını sil">'+icon('trash')+'</button></div></div>';}).join(''):'<div class="empty">'+icon('chart')+'<h3>Henüz deneme kaydı yok.</h3><p>Örnek sonuç eklemedim. İlk denemeni girdiğinde karşılaştırma başlayacak.</p></div>')+'</div></section>';
}
function updateResults(){
  if(!$('#score-results'))return;
  const nets=store.calculator.nets||{},n=netAnalysis(nets),obp=obpContribution();
  for(const [key]of subjects){const target=$('#calc-net-'+key);if(target)target.textContent=fmtNum(n.values[key],2);}
  $('#calc-total-tyt').textContent=fmtNum(n.tyt,2);$('#calc-total-ayt').textContent=fmtNum(n.ayt,2);
  $('#net-error').textContent=n.errors.join(' ');
  if(n.errors.length||obp===null){$('#score-results').innerHTML='<p class="error">'+esc(n.errors[0]||'Diploma notu 50–100 arasında olmalı.')+'</p>';return;}
  const hasAny=Object.values(n.values).some(v=>v!==0);
  if(!hasAny){$('#score-results').innerHTML='<div class="result-box"><strong>Netlerini gir.</strong><p>Henüz puan veya sıralama oluşturulmadı.</p></div>';return;}
  const results=['TYT','SAY'].map(type=>{
    const result=estimatedScore(calcComparisonYear,type,nets),band=result?rankBand(calcComparisonYear,type,store.calculator.obp!==false?result.placement:result.raw,store.calculator.obp!==false):null;
    return '<div class="result-box"><span>'+esc(calcComparisonYear)+' '+type+' '+(store.calculator.obp!==false?'yerleştirme':'ham')+' puan tahmini</span><strong>'+esc(result?fmtNum(store.calculator.obp!==false?result.placement:result.raw,2):'Model verisi yok')+'</strong><p>'+ (band?'Sıra aralığı: '+fmtNum(band.low)+'–'+fmtNum(band.high)+' · '+(band.official?'resmî yığınsal eşiklere göre':'üçüncü taraf dağılım tahmini'):'Doğrulanmış sıralama dağılımı yok; sıra uydurulmadı.')+'</p></div>';
  }).join('');
  $('#score-results').innerHTML=results+'<p>OBP katkısı: '+fmtNum(obp,2)+' puan</p><h3 style="margin-top:22px">Aynı netler, farklı yıllar</h3><div class="table-wrap"><table><thead><tr><th>Yıl</th><th>TYT puan tahmini</th><th>SAY puan tahmini</th></tr></thead><tbody>'+[2026,2025,2024,2023,2022].map(year=>'<tr><td>'+year+'</td>'+['TYT','SAY'].map(type=>{const r=estimatedScore(String(year),type,nets);return '<td>'+esc(r?fmtNum(store.calculator.obp!==false?r.placement:r.raw,2):'Model yok')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div>';
}
let targetPoints='',targetCity='',targetScholarship='';
function targetsHTML(){
  return heading('Üniversite hedefleri.','Resmî taban puanlarını geçmiş yıllarla birlikte incele; ilgini çekenleri kaydet.')+
    '<div class="notice">Taban puanı başarı sırası değildir. Kaynak dosyada sıra bulunmayan programa sayı yazılmadı. Puanın bir geçmiş tabanı geçmesi, o programa yerleşeceğin anlamına gelmez.</div>'+
    '<div class="filters"><label class="search">'+icon('search')+'<input id="program-query" aria-label="Üniversite veya bölüm ara" placeholder="Üniversite veya bölüm ara…" value="'+esc(programQuery)+'"></label><select id="program-year" aria-label="Veri yılı">'+[2026,2025].map(y=>'<option '+(String(y)===programYear?'selected':'')+'>'+y+'</option>').join('')+'</select><select id="program-type" aria-label="Üniversite türü"><option value="">Tüm üniversiteler</option><option value="DEVLET" '+(programType==='DEVLET'?'selected':'')+'>Devlet</option><option value="VAKIF" '+(programType==='VAKIF'?'selected':'')+'>Vakıf</option></select><label class="check"><input id="program-favorites" type="checkbox" '+(programOnlyFav?'checked':'')+'>Hedeflerim</label></div>'+
    '<div class="filters"><label>Şehir<input id="program-city" placeholder="Örn. Ankara" value="'+esc(targetCity)+'"></label><label>Burs<select id="program-scholarship"><option value="">Tümü</option>'+['Burslu','%50 İndirimli','Ücretli'].map(v=>'<option '+(v===targetScholarship?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label>İsteğe bağlı '+esc(programYear)+' Y-SAY puanın<input id="target-points" type="number" min="0" max="600" step=".01" placeholder="Gerçek / tahmini yerleştirme puanı" value="'+esc(targetPoints)+'"></label></div><p class="legend">Şehir, burs ve dil yalnızca kaynakta açıkça yazılıysa filtrelenebilir. '+link('https://yokatlas.yok.gov.tr/tercih-sihirbazi-t4.php','YÖK Atlas tercih sihirbazı')+'</p><div id="program-results" style="margin-top:20px">'+programCards()+'</div>';
}
function programCards(){
  const query=programQuery.toLocaleLowerCase('tr').trim(),point=targetPoints!==''?Number(targetPoints):null;
  const list=programsData.programs.filter(p=>{
    const year=p.history.find(h=>String(h.year)===programYear);
    return year&&(!query||(p.university+' '+p.program+' '+(p.city||'')).toLocaleLowerCase('tr').includes(query))&&(!programType||p.universityType===programType)&&(!targetCity||(p.city||'').toLocaleLowerCase('tr').includes(targetCity.toLocaleLowerCase('tr')))&&(!targetScholarship||p.scholarship===targetScholarship)&&(!programOnlyFav||store.favorites.includes(p.code));
  }).sort((a,b)=>Number(b.history.find(h=>String(h.year)===programYear).minScore||0)-Number(a.history.find(h=>String(h.year)===programYear).minScore||0));
  const pages=Math.ceil(list.length/30);programPage=Math.max(1,Math.min(programPage,pages||1));
  const band=point!==null?rankBand(programYear,'SAY',point,true):null;
  return (band?'<div class="notice">'+(band.official?'Resmî puan eşikleriyle':'Üçüncü taraf dağılımıyla')+' yaklaşık sıra bandı: '+fmtNum(band.low)+'–'+fmtNum(band.high)+'. Bu bir yerleşme garantisi veya güven aralığı değildir. '+link(band.sourceUrl,'Dağılım kaynağı')+'</div>':'')+'<div class="split-title"><p>'+fmtNum(list.length)+' program · SAY · '+programYear+'</p><small>'+programPage+' / '+(pages||1)+' sayfa</small></div><div class="program-list">'+list.slice((programPage-1)*30,programPage*30).map(p=>{
    const current=p.history.find(h=>String(h.year)===programYear),fav=store.favorites.includes(p.code);
    const comparison=point!==null&&Number.isFinite(current.minScore)&&Number.isFinite(point)?'<span class="tag">'+(point>=current.minScore?'Puanın geçmiş tabana eşit / üstünde':'Geçmiş taban puanın üstünde')+'</span>':'';
    return '<article class="program-card"><div><h3>'+esc(p.program)+'</h3><p>'+esc(p.university)+'</p><div class="task-meta"><span class="tag">'+esc(p.universityType)+'</span><span class="tag">SAY</span>'+(p.language?'<span class="tag">'+esc(p.language)+'</span>':'')+comparison+'</div></div><div class="program-actions"><button data-favorite="'+esc(p.code)+'" aria-label="'+(fav?'Hedeflerden çıkar':'Hedeflere ekle')+'" aria-pressed="'+fav+'" style="'+(fav?'color:var(--accent)':'')+'">'+icon('star')+'</button></div><div class="program-history">'+p.history.slice().sort((a,b)=>b.year-a.year).map(h=>'<div class="program-year"><small>'+h.year+' taban puan</small><strong>'+esc(Number.isFinite(h.minScore)?fmtNum(h.minScore,5):'Veri yok')+'</strong><small>Genel kont. '+esc(h.quota??'—')+' · Yerleşen '+esc(h.placed??'—')+'</small><small>Başarı sırası: '+esc(h.minRank??'doğrulanmadı')+'</small></div>').join('')+'<div style="margin-left:auto">'+link(p.yokUrl,'YÖK Atlas’ta kontrol et','source-link')+'<p style="font-size:9px">Program kodu: '+esc(p.code)+'</p></div></div></article>';
  }).join('')+'</div>'+(list.length?'<div class="row" style="justify-content:center;margin:24px 0"><button data-program-page="-1" '+(programPage===1?'disabled':'')+'>← Önceki</button><span style="font-size:11px">'+programPage+' / '+pages+'</span><button data-program-page="1" '+(programPage>=pages?'disabled':'')+'>Sonraki →</button></div>':'<div class="empty"><h3>Bu filtrelerde program yok.</h3></div>');
}
function modal(title,body){$('#yks-dialog').innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button class="icon ghost" data-action="close-dialog" aria-label="Kapat">×</button></div><div class="dialog-body">'+body+'</div>';$('#yks-dialog').showModal();}
function actions(extra=''){return '<p class="error full" id="dialog-error" role="alert"></p><div class="dialog-actions full">'+extra+'<button type="button" data-action="close-dialog">Vazgeç</button><button class="primary" type="submit">Kaydet</button></div>';}
function taskDialog(task=null,preset={}){
  dialogKind='task';dialogId=task?.id||'';
  const t=task||{day:selectedDay,title:'',subject:'TYT Matematik',kind:'Çalışma',note:'',requires:[],...preset};
  modal(task?'Görevi düzenle':'Görev ekle','<form id="task-form" class="form-grid"><label class="full">Çalışma<input name="title" required maxlength="160" value="'+esc(t.title)+'"></label><label>Kamp günü<input name="day" type="number" required min="1" max="73000" value="'+t.day+'"></label><label>Ders<input name="subject" maxlength="100" value="'+esc(t.subject)+'"></label><label>Çalışma türü<input name="kind" maxlength="80" value="'+esc(t.kind)+'"></label><label>Kitap<select name="bookId"><option value="">Kitap seçilmedi</option>'+store.plan.books.map(b=>'<option value="'+esc(b.id)+'" '+(b.id===t.bookId?'selected':'')+'>'+esc(b.title)+'</option>').join('')+'</select></label><label>İlk sayfa — varsa<input name="pageFrom" type="number" min="1" value="'+esc(t.pageFrom||'')+'"></label><label>Son sayfa — varsa<input name="pageTo" type="number" min="1" value="'+esc(t.pageTo||'')+'"></label><label>Planlanan süre (dk) — isteğe bağlı<input name="minutes" type="number" min="1" max="1440" value="'+esc(t.minutes||'')+'"></label><label>Video / kaynak bağlantısı<input name="sourceUrl" type="url" placeholder="https://…" value="'+esc(t.sourceUrl||'')+'"></label><label class="full">Not<textarea name="note" maxlength="4000">'+esc(t.note)+'</textarea></label><div class="full"><label>Bu görevden önce tamamlanması gerekenler</label><p style="font-size:10px;margin:7px 0">Seçilenler bitmeden bu görevin tiki açılamaz. En fazla 64 önkoşul.</p><div class="dependency-list">'+store.plan.tasks.filter(x=>x.id!==t.id).map(x=>'<label><input type="checkbox" name="requires" value="'+esc(x.id)+'" '+((t.requires||[]).includes(x.id)?'checked':'')+'>'+x.day+'. gün · '+esc(x.title)+'</label>').join('')+'</div></div>'+actions(task?'<button type="button" class="danger" data-delete-task="'+esc(task.id)+'">Görevi sil</button>':'')+'</form>');
}
function bookDialog(book=null){
  dialogKind='book';dialogId=book?.id||'';
  const b=book||{title:'',subject:'',kind:'Soru bankası',edition:'',note:''};
  modal(book?'Kitabı düzenle':'Kitap ekle','<form id="book-form" class="form-grid"><label class="full">Kitap adı<input name="title" required maxlength="160" value="'+esc(b.title)+'"></label><label>Ders<input name="subject" maxlength="100" value="'+esc(b.subject)+'"></label><label>Tür<select name="kind">'+['VDK','Soru bankası','Diğer'].map(k=>'<option '+(k===b.kind?'selected':'')+'>'+k+'</option>').join('')+'</select></label><label>Yıl / baskı<input name="edition" maxlength="160" value="'+esc(b.edition||'')+'"></label><label>Toplam sayfa — biliyorsan<input name="totalPages" type="number" min="1" max="1000000" value="'+esc(b.totalPages||'')+'"></label><label class="full">Not<textarea name="note" maxlength="4000">'+esc(b.note||'')+'</textarea></label>'+actions()+'</form>');
}
function rangesDialog(id){
  dialogKind='ranges';dialogId=id;const b=bookById(id);if(!b)return;
  const p=bookProgress(b);
  modal('Bölümler & sayfalar','<h3>'+esc(b.title)+'</h3><p style="margin:10px 0 18px">'+p.completedPages+' sayfa tamamlandı. '+(p.totalPages?'Toplam '+p.totalPages+' sayfa.':'Toplam sayfa belirtilmedi.')+' Kampın bitişi bu kitabın tamamının bittiği anlamına gelmez.</p><div id="ranges-list">'+rangeRows(b)+'</div><form id="range-form" class="form-grid" style="margin-top:20px"><label>İlk sayfa<input name="from" type="number" min="1" required></label><label>Son sayfa<input name="to" type="number" min="1" required></label><label class="full">Bölüm / test notu<input name="note" maxlength="2000" placeholder="Örn. Sayı kümeleri, Temel Tanım Testi 1–2"></label><label class="check full"><input name="done" type="checkbox">Bu aralık çözüldü</label>'+actions()+'</form>');
}
function rangeRows(b){return b.ranges.length?b.ranges.map(r=>'<div class="range-row"><input type="checkbox" data-range="'+esc(r.id)+'" '+(r.done?'checked':'')+' aria-label="'+r.from+'–'+r.to+' sayfaları çözüldü"><span>s. '+r.from+'–'+r.to+(r.note?'<small style="display:block">'+esc(r.note)+'</small>':'')+'</span><button type="button" class="danger ghost" data-remove-range="'+esc(r.id)+'" aria-label="Sayfa aralığını sil">'+icon('trash')+'</button></div>').join(''):'<p>Henüz sayfa aralığı eklenmedi. Bir sayfayı iki kez saymamak için örtüşen çözümler birleştirilerek hesaplanır.</p>';}
function postponeDialog(){dialogKind='postpone';modal('Gün ötele','<p class="dialog-warning">Seçtiğin kamp gününden itibaren tamamlanmamış çalışmalar ileri taşınır. Tamamlanan görevlerin kayıtlı tarihi ve sana ait takvim etkinlikleri korunur.</p><form id="postpone-form" class="form-grid"><label>Hangi kamp gününden itibaren?<input name="day" required type="number" min="1" max="73000" value="'+selectedDay+'"></label><label>Kaç gün ileri?<input name="days" required type="number" min="1" max="365" value="1"></label>'+actions()+'</form>');}
function attemptDialog(){
  dialogKind='attempt';modal('Deneme ekle','<form id="attempt-form"><div class="form-grid"><label>Deneme adı<input name="title" required maxlength="160" placeholder="Yayın / deneme numarası"></label><label>Tarih<input name="date" required type="date" value="'+today()+'"></label></div><p style="margin-top:15px">Sadece girdiğin testleri doldur. Kaydetmek, puanı veya sıralamayı resmî sonuca dönüştürmez.</p>'+netRows({},'all','attempt')+actions()+'</form>');
}
function bookletsDialog(){dialogKind='booklets';modal('Resmî çıkmış soru kitapçıkları','<p style="margin-bottom:18px">Soruların metnini veya görüntüsünü uygulamaya kopyalamıyorum; bağlantı ÖSYM’nin yayımladığı dosyayı açar.</p><div class="source-list">'+(topicData.booklets||[]).map(b=>'<div>'+link(b.url,b.year+' '+b.exam+' kitapçığı')+'</div>').join('')+'</div><p style="margin-top:20px">'+link('https://www.osym.gov.tr/SinavGrubu/Index/2','ÖSYM YKS duyuruları')+'</p>');}
function mertReference(){
  dialogKind='mert-reference';
  modal('Mert Hoca · kaynak eşleştirmesi','<p style="margin-bottom:16px">'+esc(MERT70.scope)+'</p><div class="table-wrap"><table><thead><tr><th>Kamp günü</th><th>Çalışma</th><th>VDK</th><th>Soru bankası</th></tr></thead><tbody>'+MERT70.days.map(d=>'<tr><td>'+d.day+'</td><td>'+esc(d.topic)+'</td><td>'+d.vdkFrom+'–'+d.vdkTo+'</td><td>'+d.sbFrom+'–'+d.sbTo+'</td></tr>').join('')+'</tbody></table></div><details style="margin-top:20px"><summary>Gönderdiğin orijinal fotoğraflar</summary><div style="overflow:auto;max-height:65vh"><div style="position:relative;width:2048px;height:1152px"><img src="assets/mert70-program.png" alt="Gönderdiğin kamp–ödev çizelgesi; yatay görüntüleme" style="position:absolute;width:1152px;height:2048px;max-width:none;left:448px;top:-448px;transform:rotate(-90deg)"></div><img src="assets/mert70-contents.png" alt="Gönderdiğin soru bankası içindekiler" style="width:1152px;max-width:none"></div></details>');
}
function dependencyCycle(tasks){const map=new Map(tasks.map(t=>[t.id,t.requires||[]])),done=new Set(),active=new Set();function visit(id){if(active.has(id))return true;if(done.has(id))return false;active.add(id);for(const next of map.get(id)||[])if(visit(next))return true;active.delete(id);done.add(id);return false;}return tasks.some(t=>visit(t.id));}
function toggleTask(id,done){
  const next=clone(),task=next.plan.tasks.find(t=>t.id===id);if(!task)return;
  if(done&&unmet(task).length){toast('Önkoşullar tamamlanmadan bu görev işaretlenemez.');render();return;}
  const affected=new Set([id]);
  if(!done){let count=-1;while(count!==affected.size){count=affected.size;next.plan.tasks.forEach(t=>{if((t.requires||[]).some(r=>affected.has(r)))affected.add(t.id);});}
    const checked=next.plan.tasks.filter(t=>t.id!==id&&t.done&&affected.has(t.id));if(checked.length&&!confirm('Bu çalışmaya bağlı '+checked.length+' tamamlanma işareti de kaldırılacak. Devam edilsin mi?')){render();return;}}
  for(const t of next.plan.tasks){if(t.id===id||(!done&&affected.has(t.id))){t.done=done;if(done)t.completedDate=dateForDay(next.plan,t.day)||today();else delete t.completedDate;const b=next.plan.books.find(b=>b.id===t.bookId);if(b&&t.pageFrom&&t.pageTo){b.ranges=b.ranges.filter(r=>r.id!=='task-'+t.id);if(done)b.ranges.push({id:'task-'+t.id,from:t.pageFrom,to:t.pageTo,done:true,note:'Kamp görevi: '+t.title});}}}
  if(commit(next))render();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(libraryClick(b,render)||handleNoteClick(b,render))return;
  if(b.dataset.nav){setView(b.dataset.nav);return;}
  if(b.dataset.action==='close-dialog'){$('#yks-dialog').close();return;}
  if(b.dataset.action==='home'){if(parent!==window)parent.rotaShowHome?.();return;}
  if(b.dataset.action==='calendar'){if(parent!==window)parent.rotaShowCalendar?.(dateForDay(store.plan,selectedDay));else toast('Takvim Rota uygulaması içinde açılır.');return;}
  if(b.dataset.action==='planner'){if(parent!==window)parent.rotaShowPlanner?.();else toast('Çalışma Alanı alanı Rota uygulaması içinde açılır.');return;}
  if(b.dataset.action==='theme'){const next=clone();next.theme=next.theme==='dark'?'light':'dark';if(commit(next,{calendar:false}))render();return;}
  if(b.dataset.action==='new-task'){taskDialog();return;}
  if(b.dataset.editTask){taskDialog(taskById(b.dataset.editTask));return;}
  if(b.dataset.action==='new-book'){bookDialog();return;}
  if(b.dataset.editBook){bookDialog(bookById(b.dataset.editBook));return;}
  if(b.dataset.book){rangesDialog(b.dataset.book);return;}
  if(b.dataset.action==='postpone'){postponeDialog();return;}
  if(b.dataset.day){selectedDay=Number(b.dataset.day);render();return;}
  if(b.dataset.dayStep){selectedDay=Math.max(1,Math.min(73000,selectedDay+Number(b.dataset.dayStep)));render();return;}
  if(b.dataset.examFilter){topicExam=b.dataset.examFilter;render();return;}
  if(b.dataset.topicAdd){const group=topicData.groups.find(g=>g.topics.some(t=>t.id===b.dataset.topicAdd)),topic=group?.topics.find(t=>t.id===b.dataset.topicAdd);if(topic)taskDialog(null,{title:topic.title,subject:group.exam+' '+group.subject,kind:'Konu çalışması'});return;}
  if(b.dataset.action==='booklets'){bookletsDialog();return;}
  if(b.dataset.action==='mert-reference'){mertReference();return;}
  if(b.dataset.action==='new-attempt'){attemptDialog();return;}
  if(b.dataset.loadAttempt){const a=store.attempts.find(a=>a.id===b.dataset.loadAttempt),next=clone();next.calculator.nets=structuredClone(a.nets);if(commit(next,{calendar:false})){render();toast('Deneme netleri hesaplayıcıya getirildi.');}return;}
  if(b.dataset.removeAttempt){if(!confirm('Bu deneme kaydı silinsin mi?'))return;const next=clone();next.attempts=next.attempts.filter(a=>a.id!==b.dataset.removeAttempt);if(commit(next,{calendar:false}))render();return;}
  if(b.dataset.favorite){const next=clone(),id=b.dataset.favorite;next.favorites=next.favorites.includes(id)?next.favorites.filter(v=>v!==id):[...next.favorites,id];if(commit(next,{calendar:false}))$('#program-results').innerHTML=programCards();return;}
  if(b.dataset.programPage){programPage+=Number(b.dataset.programPage);$('#program-results').innerHTML=programCards();return;}
    if(b.dataset.action==='use-score'){if(store.calculator.obp===false){toast('Taban puanlarıyla karşılaştırmak için OBP dahil yerleştirme puanı gerekir.');return;}const result=estimatedScore(calcComparisonYear,'SAY',store.calculator.nets||{});if(!result){toast('Bu yıl için puan modeli yok. Üniversite ekranına kendi yerleştirme puanını girebilirsin.');return;}if(!['2025','2026'].includes(calcComparisonYear)){toast('Bu yılın program tablosu henüz yok; farklı yılın puanıyla kıyaslamıyorum.');return;}programYear=calcComparisonYear;targetPoints=String(result.placement.toFixed(2));setView('targets');return;}
  if(b.dataset.deleteTask){
    if(!confirm('Bu görev silinsin mi? Ona bağlı görevlerin önkoşulu otomatik kaldırılmaz.'))return;
    const next=clone();next.plan.tasks=next.plan.tasks.filter(t=>t.id!==b.dataset.deleteTask);if(commit(next)){$('#yks-dialog').close();render();}return;
  }
  if(b.hasAttribute('data-remove-shift')){
    if(!confirm('Bu öteleme kaldırılsın mı? Plan tarihleri yeniden hesaplanacak.'))return;
    const next=clone();next.plan.postponements.splice(Number(b.dataset.removeShift),1);if(commit(next))render();return;
  }
  if(b.dataset.removeRange){const next=clone(),book=next.plan.books.find(b=>b.id===dialogId);if(!book)return;book.ranges=book.ranges.filter(r=>r.id!==b.dataset.removeRange);if(commit(next,{calendar:false})){$('#yks-dialog').close();render();rangesDialog(book.id);}return;}
});
document.addEventListener('change',e=>{
  if(e.target.id==='notes-page'){selectNote(e.target.value,render);return;}
  const el=e.target;
  if(el.dataset.taskCheck){toggleTask(el.dataset.taskCheck,el.checked);return;}
  if(el.id==='selected-day'){selectedDay=Math.max(1,Math.min(73000,parseInt(el.value,10)||1));render();return;}
  if(el.dataset.topic){const next=clone();next.topicChecks[el.dataset.topic]=el.checked;commit(next,{calendar:false});return;}
  if(el.dataset.range){const next=clone(),book=next.plan.books.find(b=>b.id===dialogId),range=book?.ranges.find(r=>r.id===el.dataset.range);if(range){range.done=el.checked;if(commit(next,{calendar:false})){render();}}return;}
  if(['program-year','program-type','program-favorites','program-scholarship'].includes(el.id)){
    if(el.id==='program-year')programYear=el.value;if(el.id==='program-type')programType=el.value;if(el.id==='program-favorites')programOnlyFav=el.checked;if(el.id==='program-scholarship')targetScholarship=el.value;
    programPage=1;$('#program-results').innerHTML=programCards();return;
  }
  if(['calc-year','calc-diploma','calc-obp','calc-reduced'].includes(el.id)||el.closest('#calc-nets')){
    if(el.id==='calc-year')calcComparisonYear=el.value;
    const next=clone();next.calculator={...next.calculator,diploma:Number($('#calc-diploma').value),obp:$('#calc-obp').checked,reduced:$('#calc-reduced').checked,nets:readNets($('#calc-nets'))};commit(next,{calendar:false});updateResults();
  }
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.id==='book-query'){bookQuery=el.value;$('#book-grid').innerHTML=bookCards();}
  if(el.id==='topic-query'){topicQuery=el.value;$('#topic-list').innerHTML=topicGroups();}
  if(['program-query','program-city','target-points'].includes(el.id)){
    if(el.id==='program-query')programQuery=el.value;if(el.id==='program-city')targetCity=el.value;if(el.id==='target-points')targetPoints=el.value;programPage=1;$('#program-results').innerHTML=programCards();
  }
});
document.addEventListener('submit',e=>{
  if(['note-group-form','note-text-form','note-pdf-form'].includes(e.target.id)){e.preventDefault();void saveLibraryForm(e.target,render);return;}
  e.preventDefault();const form=e.target,f=new FormData(form),v=Object.fromEntries(f),next=clone(),error=$('#dialog-error');
  try{
    if(form.id==='settings-form'){
      next.plan.settings={...next.plan.settings,name:v.name.trim(),startDate:v.startDate,examDate:v.examDate||''};
      if(!next.plan.settings.name||!addDays(v.startDate,0))throw Error('Geçerli başlangıç tarihi ve plan adı gir.');
      if(commit(next)){selectedDay=currentCampDay();render();toast(saveError||'X günü ve plan kaydedildi; takvim eşitlendi.');}return;
    }
    if(form.id==='task-form'){
      const old=taskById(dialogId),task={...(old||{}),id:dialogId||makeId('task'),day:Number(v.day),title:v.title.trim(),subject:v.subject.trim(),kind:v.kind.trim()||'Çalışma',bookId:v.bookId,note:v.note,requires:f.getAll('requires'),done:old?.done||false};
      if(v.pageFrom||v.pageTo){task.pageFrom=Number(v.pageFrom);task.pageTo=Number(v.pageTo);}else{delete task.pageFrom;delete task.pageTo;}
      if(v.minutes)task.minutes=Number(v.minutes);else delete task.minutes;
      if(v.sourceUrl&&!safeURL(v.sourceUrl))throw Error('Bağlantı http veya https ile başlamalı.');task.sourceUrl=v.sourceUrl||'';
      const checked=validateTask(task);if(!checked.valid)throw Error(checked.errors.join(' '));
      const book=bookById(task.bookId);if(task.pageFrom&&(!book||book.totalPages&&task.pageTo>book.totalPages))throw Error('Sayfaları bağlamak için bir kitap seç; aralık toplam sayfayı aşmasın.');
      if(task.requires.length>64)throw Error('En fazla 64 önkoşul seçebilirsin.');
      next.plan.tasks=dialogId?next.plan.tasks.map(t=>t.id===dialogId?task:t):[...next.plan.tasks,task];if(dependencyCycle(next.plan.tasks))throw Error('Bu bağlantılar döngü oluşturuyor. Bir görev kendisinin önkoşulu olamaz.');
      if(task.done&&task.requires.some(id=>!next.plan.tasks.find(t=>t.id===id)?.done)){task.done=false;delete task.completedDate;}
    }else if(form.id==='book-form'){
      const old=bookById(dialogId),book={...(old||{ranges:[]}),id:dialogId||makeId('book'),title:v.title.trim(),subject:v.subject,kind:v.kind,edition:v.edition,note:v.note};if(v.totalPages)book.totalPages=Number(v.totalPages);else delete book.totalPages;
      const checked=validateBook(book);if(!checked.valid)throw Error(checked.errors.join(' '));next.plan.books=dialogId?next.plan.books.map(b=>b.id===dialogId?book:b):[...next.plan.books,book];
    }else if(form.id==='range-form'){
      const book=next.plan.books.find(b=>b.id===dialogId);book.ranges.push({id:makeId('range'),from:Number(v.from),to:Number(v.to),done:f.has('done'),note:v.note});const checked=validateBook(book);if(!checked.valid)throw Error(checked.errors.join(' '));
    }else if(form.id==='postpone-form'){
      const day=Number(v.day),days=Number(v.days);if(!Number.isInteger(day)||day<1||!Number.isInteger(days)||days<1||days>365)throw Error('Geçerli gün ve 1–365 arası öteleme gir.');
      next.plan.postponements.push({day,days});
    }else if(form.id==='attempt-form'){
      const nets=readNets(form),n=netAnalysis(nets);if(n.errors.length)throw Error(n.errors.join(' '));if(!v.title.trim()||!addDays(v.date,0))throw Error('Deneme adı ve tarih gir.');
      next.attempts.push({id:makeId('exam'),title:v.title.trim(),date:v.date,kind:'TYT / AYT SAY',nets});next.calculator.nets=nets;
    }else return;
    if(commit(next,{calendar:['task-form','postpone-form'].includes(form.id)})){$('#yks-dialog').close();render();toast('Kaydedildi.');}
  }catch(err){if(error)error.textContent=err.message;else if($('#settings-error'))$('#settings-error').textContent=err.message;}
});
$('#yks-dialog').addEventListener('click',e=>{if(e.target!==$('#yks-dialog'))return;const b=$('#yks-dialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('#yks-dialog').close();});
window.rotaYks={getState:()=>structuredClone(store),showDay:day=>{selectedDay=Math.max(1,Math.min(73000,Number(day)||1));view='plan';render();},sync:syncCalendar,rankBand,estimatedScore,netAnalysis};
window.addEventListener('message',e=>{if(e.source!==parent)return;if(e.data?.type==='rota:yks-day')window.rotaYks.showDay(e.data.day);});
render();
if(campCorrection?.updatedTaskIds.length&&!loadError){
  if(commit(store))toast('Son problemler bölümü 29–50. gün olarak düzeltildi. Kayıtlı ilerlemen korundu.');
}
