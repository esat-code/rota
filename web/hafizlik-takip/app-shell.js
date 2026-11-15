import homeHTML from '../home-atmosphere-preview/dist/index.html';
import {createButtonSounds} from '../home-atmosphere-preview/dist/button-sounds.js';
const plannerClicks = createButtonSounds({readVolume: () => {
  try { const value = JSON.parse(localStorage.getItem('rota-home-audio-v1') || '{}').buttonVolume; return Number.isFinite(value) ? value : .35; }
  catch { return .35; }
}});
window.addEventListener('pagehide', event => { if (!event.persisted) plannerClicks.dispose(); });
const frame = document.getElementById('rota-home');
const textRequests = new Map();
window.rotaTextOCRResult = result => {
  const pending = textRequests.get(result?.id);
  if (!pending) return;
  clearTimeout(pending.timeout);
  textRequests.delete(result.id);
  result.error ? pending.reject(Error(result.error)) : pending.resolve(result.text || '');
};
window.rotaRecognizeText = image => new Promise((resolve, reject) => {
  const handler = window.webkit?.messageHandlers?.rotaTextOCR;
  if (!handler) { reject(Error('Bu sürümde fotoğraf metnini elle ekleyebilirsin.')); return; }
  const id = crypto.randomUUID();
  const timeout = setTimeout(() => {textRequests.delete(id); reject(Error('Metin okuma zaman aşımına uğradı.'));}, 45000);
  textRequests.set(id, {resolve, reject, timeout});
  handler.postMessage({id, image});
});
import calendarHTML from './calendar/index.html';
import yksHTML from './yks/index.html';
import sportHTML from './sport/index.html';
const sport=document.getElementById('rota-sport');
const nativeSportRequests=new Map();
function sportNativeRequest(action,details={}){
  if(!window.webkit?.messageHandlers?.hafizlik)return Promise.reject(new Error('Bu işlem masaüstü Rota içinde kullanılabilir.'));
  const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{nativeSportRequests.delete(id);reject(new Error('İşlem zamanında tamamlanamadı.'));},action==='sport-export'?300000:30000);
    nativeSportRequests.set(id,{resolve,reject,timeout});window.webkit.messageHandlers.hafizlik.postMessage({action,id,...details});
  });
}
window.rotaSportNativeResult=message=>{const pending=nativeSportRequests.get(message?.id);if(!pending)return;clearTimeout(pending.timeout);nativeSportRequests.delete(message.id);if(message.error)pending.reject(new Error(message.error));else pending.resolve(message);};
window.rotaSportReadAsset=filename=>sportNativeRequest('sport-asset',{filename});
if(window.webkit?.messageHandlers?.hafizlik)window.rotaSportExport=({name,text,type})=>sportNativeRequest('sport-export',{name,data:text,format:type.startsWith('text/calendar')?'ics':'json'});
if(window.webkit?.messageHandlers?.hafizlik)window.rotaSportPlayVideo=({videoID,title})=>sportNativeRequest('sport-play-video',{videoID,title});
function hideSport(){sport.hidden=true;sport.inert=true;sport.setAttribute('aria-hidden','true');document.body.classList.remove('rota-show-sport');}
window.rotaSportChanged=()=>{window.hafizlikNativeSave?.();calendar.contentWindow?.dispatchEvent(new Event('rota:calendar-refresh'));};
function showSport(){
  window.hafizlikSaveAll?.();plan.inert=true;plan.setAttribute('aria-hidden','true');frame.inert=true;frame.setAttribute('aria-hidden','true');
  for(const section of[calendar,yks]){section.hidden=true;section.inert=true;section.setAttribute('aria-hidden','true');}
  document.body.classList.remove('rota-show-home','rota-show-calendar','rota-show-yks');document.body.classList.add('rota-show-sport');
  if(!sport.srcdoc)sport.srcdoc=sportHTML.replace('<head>','<head><base href="./sport/">');
  sport.hidden=false;sport.inert=false;sport.removeAttribute('aria-hidden');frame.contentWindow?.postMessage({type:'rota:view',view:'sport'},'*');sport.focus();
}
window.rotaShowSport=showSport;
const yks=document.getElementById('rota-yks');
let pendingYksDay;
window.rotaYksChanged=()=>{window.hafizlikNativeSave?.();calendar.contentWindow?.dispatchEvent(new Event('rota:calendar-refresh'));};
function showYks(day){
  hideSport();
  window.hafizlikSaveAll?.();plan.inert=true;plan.setAttribute('aria-hidden','true');frame.inert=true;frame.setAttribute('aria-hidden','true');
  calendar.hidden=true;calendar.inert=true;calendar.setAttribute('aria-hidden','true');
  document.body.classList.remove('rota-show-home','rota-show-calendar');document.body.classList.add('rota-show-yks');
  pendingYksDay=Number.isInteger(Number(day))&&Number(day)>0?Number(day):null;
  if(!yks.srcdoc)yks.srcdoc=yksHTML.replace('<head>','<head><base href="./yks/">');
  yks.hidden=false;yks.inert=false;yks.removeAttribute('aria-hidden');
  frame.contentWindow?.postMessage({type:'rota:view',view:'yks'},'*');
  if(pendingYksDay)yks.contentWindow?.postMessage({type:'rota:yks-day',day:pendingYksDay},'*');yks.focus();
}
yks.addEventListener('load',()=>{if(pendingYksDay)yks.contentWindow?.postMessage({type:'rota:yks-day',day:pendingYksDay},'*');});
window.rotaShowYks=showYks;
const calendar=document.getElementById('rota-calendar');
window.rotaCalendarChanged=()=>window.hafizlikNativeSave?.();
function showCalendar(date){hideSport();window.hafizlikSaveAll?.();yks.hidden=true;yks.inert=true;yks.setAttribute('aria-hidden','true');plan.inert=true;plan.setAttribute('aria-hidden','true');frame.inert=true;frame.setAttribute('aria-hidden','true');document.body.classList.remove('rota-show-home','rota-show-yks');document.body.classList.add('rota-show-calendar');if(!calendar.srcdoc)calendar.srcdoc=calendarHTML.replace('<head>','<head><base href="./calendar/">');calendar.hidden=false;calendar.inert=false;calendar.removeAttribute('aria-hidden');frame.contentWindow?.postMessage({type:'rota:view',view:'calendar'},'*');if(typeof date==='string'){calendar.dataset.focusDate=date;calendar.contentWindow?.postMessage({type:'rota:calendar-focus',date},'*');}calendar.focus();}
calendar.addEventListener('load',()=>{if(calendar.dataset.focusDate)calendar.contentWindow?.postMessage({type:'rota:calendar-focus',date:calendar.dataset.focusDate},'*');});
window.rotaShowCalendar=showCalendar;
const plan = document.getElementById('hafizlik-tik-denemesi');
const bundledHTML = homeHTML.replace('<head>', '<head><base href="./home/">')
  .replace('<script type="module" src="./main.js"></script>', '<script defer src="./app.js"></script>');
frame.srcdoc = bundledHTML;
function showHome() {
  hideSport();
  yks.hidden=true;yks.inert=true;yks.setAttribute('aria-hidden','true');document.body.classList.remove('rota-show-yks');
  calendar.hidden=true;calendar.inert=true;calendar.setAttribute('aria-hidden','true');document.body.classList.remove('rota-show-calendar');
  plan.inert = true;
  plan.setAttribute('aria-hidden', 'true');
  document.body.classList.add('rota-show-home');
  frame.inert = false;
  frame.removeAttribute('aria-hidden');
  frame.contentWindow?.postMessage({type:'rota:view',view:'home'}, '*');
  frame.focus();
}
function showPlanner() {
  hideSport();
  yks.hidden=true;yks.inert=true;yks.setAttribute('aria-hidden','true');calendar.hidden=true;calendar.inert=true;calendar.setAttribute('aria-hidden','true');document.body.classList.remove('rota-show-yks','rota-show-calendar');
  window.hafizlikSaveAll?.();
  plan.inert = false;
  plan.removeAttribute('aria-hidden');
  document.body.classList.remove('rota-show-home');
  frame.inert = true;
  frame.setAttribute('aria-hidden','true');
  frame.contentWindow?.postMessage({type:'rota:view',view:'planner'}, '*');
  window.dispatchEvent(new Event('resize'));
  if (window.ROTA_IOS_APP || matchMedia('(pointer: coarse) and (max-width: 760px)').matches) {
    requestAnimationFrame(() => {
      const board=window.hafizlikBoard;
      const first=board?.tables.find(el=>el.dataset.boardItem==='weeks') || board?.tables[0];
      if(board && first && !window.__rotaPhoneBoardOpened){
        const g=board.geometry(first.dataset.boardItem);
        board.zoom=Math.min(1, Math.max(.35,(board.viewport.clientWidth-24)/g.width));
        board.setCamera(g.x-12/board.zoom,g.y-12/board.zoom);
        window.__rotaPhoneBoardOpened=true;
      }
    });
  }
  (window.ROTA_MOBILE_FOLLOW?document.querySelector('.mobile-follow-header button'):document.getElementById('save-and-exit'))?.focus();
}
window.rotaShowHome = showHome;
window.rotaShowPlanner = showPlanner;
window.rotaQuitFailed = () => frame.contentWindow?.postMessage({type:'rota:quit-failed'}, '*');
window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow) return;
  if (event.data?.type === 'rota:open-calendar') showCalendar();
  if (event.data?.type === 'rota:open-yks') showYks();
  if (event.data?.type === 'rota:open-sport') showSport();
  if (event.data?.type === 'rota:open-planner') showPlanner();
  if (event.data?.type === 'rota:password-saved') window.hafizlikNativeSave?.();
  if (event.data?.type === 'rota:preferences-saved') window.hafizlikNativeSave?.();
  if (event.data?.type === 'rota:ready') {
    frame.contentWindow?.focus();
    window.webkit?.messageHandlers?.hafizlik?.postMessage({action:'ready'});
  }
  if (event.data?.type === 'rota:quit') {
    if (window.ROTA_IOS_APP) return;
    if (window.webkit?.messageHandlers?.hafizlik) window.webkit.messageHandlers.hafizlik.postMessage({action:'quit'});
    else {
      window.hafizlikSaveAll?.();
      frame.contentWindow?.postMessage({type:'rota:quit-failed',message:'Kaydedildi. Tarayıcı önizlemesini sekmeyi kapatarak sonlandırabilirsin.'},'*');
    }
  }
});
showHome();

window.rotaPhoneInstallRequest=()=>sportNativeRequest('phone-install');
