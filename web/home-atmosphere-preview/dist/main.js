import {startAtmosphere} from './atmosphere.js';
import {createAudioController} from './audio.js';
import {createButtonSounds} from './button-sounds.js';
import {readPassword, matchesPassword, savePassword, removePassword, storage} from './local-password.js';
import {setupRecords} from './records.js';

setupRecords();

const phoneLayout = matchMedia('(max-width: 760px)');
const inIPhone = window.parent !== window && window.parent.ROTA_IOS_APP === true;
if (inIPhone) document.body.dataset.rotaIos = '';
if (inIPhone || matchMedia('(pointer: coarse) and (max-width: 900px)').matches) document.getElementById('app-exit').hidden = true;


const audioKey = 'rota-home-audio-v1';
let savedVolume = .5;
let savedButtonVolume = .35;
try { const record = JSON.parse(storage().getItem(audioKey) || '{}'); if (Number.isFinite(record.volume)) savedVolume = Math.max(0, Math.min(1,record.volume)); } catch {}
try { const record = JSON.parse(storage().getItem(audioKey) || '{}'); if (Number.isFinite(record.buttonVolume)) savedButtonVolume = Math.max(0, Math.min(1,record.buttonVolume)); } catch {}
const clickSounds = createButtonSounds({readVolume: () => savedButtonVolume});
document.getElementById('button-volume').value = String(Math.round(savedButtonVolume * 100));
document.getElementById('button-volume-value').textContent = Math.round(savedButtonVolume * 100) + '%';
function saveAudioPreferences() {
  try {
    storage().setItem(audioKey, JSON.stringify({volume:savedVolume, buttonVolume:savedButtonVolume}));
    if (window.parent !== window) window.parent.postMessage({type:'rota:preferences-saved'},'*');
  } catch { document.getElementById('music-error').textContent = 'Ses bu oturum için ayarlandı; tercih kaydedilemedi.'; }
}
function updateMusicUI({state,wanted,volume}) {
  document.getElementById('music-toggle').setAttribute('aria-checked',String(wanted));
  document.getElementById('music-state').textContent = state === 'loading' ? 'Yükleniyor…' : wanted ? 'Açık' : 'Kapalı';
  document.getElementById('music-volume').value = String(Math.round(volume * 100));
  document.getElementById('music-volume-value').textContent = Math.round(volume * 100) + '%';
  document.getElementById('music-error').textContent = state === 'error' ? 'Ses açılamadı. İnternet bağlantısını kontrol ederek yeniden deneyebilirsin.' : '';
}

const atmosphereOptions = {
  canvas: document.getElementById('atmosphere'),
  glow: document.getElementById('pointer-light'),
  halo: document.getElementById('ambient-halo'),
  grain: document.getElementById('film-grain'),
};
const beginAtmosphere = () => phoneLayout.matches ? {dispose() {}} : startAtmosphere(atmosphereOptions);
let atmosphere = beginAtmosphere();
const audio = createAudioController({
  button: document.getElementById('sound-toggle'),
  label: document.getElementById('sound-label'),
  bars: [...document.querySelectorAll('#sound-bars > span')],
  status: document.getElementById('sound-status'),
  volume: savedVolume,
  onStateChange: updateMusicUI,
});
document.getElementById('music-toggle').addEventListener('click', () => { void audio.toggle(); });
document.getElementById('music-volume').addEventListener('input', event => {
  const volume = Number(event.target.value) / 100;
  savedVolume = volume;
  audio.setVolume(volume);
  saveAudioPreferences();
});
document.getElementById('button-volume').addEventListener('input', event => {
  savedButtonVolume = Number(event.target.value) / 100;
  document.getElementById('button-volume-value').textContent = Math.round(savedButtonVolume * 100) + '%';
  saveAudioPreferences();
});
document.getElementById('button-volume').addEventListener('change', () => clickSounds.play('select'));
function leave(event) {
  // A back-forward-cache visit retains this document and its event handlers.
  if (!event.persisted) { atmosphere.dispose(); audio.dispose(); clickSounds.dispose(); }
}
window.addEventListener('pagehide', leave, {once: false});

const motion = matchMedia('(prefers-reduced-motion: reduce)');
const cards = [...document.querySelectorAll('.portal')];
const tiltTargets = [...cards, document.querySelector('.entry-card-wrap')];
function resetCard(card) {
  card.removeAttribute('data-pointer-over');
  card.style.setProperty('--tilt-x', '0deg');
  card.style.setProperty('--tilt-y', '0deg');
  card.style.setProperty('--press-depth', '0px');
}
function resetPortalInteraction(clearFocus = false) {
  tiltTargets.forEach(resetCard);
  if (clearFocus && cards.includes(document.activeElement)) document.activeElement.blur();
}
for (const card of tiltTargets) {
  card.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') card.setAttribute('data-pointer-over', 'true');
  }, {passive: true});
  card.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    card.setAttribute('data-pointer-over', 'true');
    if (motion.matches) return;
    const box = card.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
    const surface = card.querySelector('.portal-surface, .entry-card');
    surface.style.setProperty('--edge-x', ((x + 1) * 50).toFixed(1) + '%');
    surface.style.setProperty('--edge-y', ((y + 1) * 50).toFixed(1) + '%');
    card.style.setProperty('--tilt-x', (-y * 4.5).toFixed(2) + 'deg');
    card.style.setProperty('--tilt-y', (x * 4.5).toFixed(2) + 'deg');
  }, {passive: true});
  for (const name of ['pointerleave', 'pointercancel', 'blur']) {
    card.addEventListener(name, () => resetCard(card));
  }
  card.addEventListener('pointerdown', event => {
    if (event.button === 0 && !motion.matches) card.style.setProperty('--press-depth', '-3px');
  });
}
window.addEventListener('pointerup', () => tiltTargets.forEach(card => card.style.setProperty('--press-depth', '0px')), {passive:true});
motion.addEventListener('change', () => tiltTargets.forEach(resetCard));
window.addEventListener('blur', () => resetPortalInteraction());
window.addEventListener('pagehide', () => resetPortalInteraction(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) resetPortalInteraction(true);
});
const entry = document.getElementById('entry-screen');
const home = document.querySelector('.portal-row');
const form = document.getElementById('entry-form');
const password = document.getElementById('entry-password');
const reveal = document.getElementById('password-toggle');
const settingsOpen = document.getElementById('settings-open');
const entryError = document.getElementById('entry-error');
const submit = document.getElementById('entry-submit');
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || entry.hidden || document.querySelector('dialog[open]')) return;
  if (!password.disabled && document.activeElement !== password) {
    event.preventDefault();
    password.focus({preventScroll:true});
  } else if (password.disabled && document.activeElement?.tagName !== 'BUTTON') {
    event.preventDefault();
    form.requestSubmit();
  }
}, true);
function syncEntryNote() {
  const configured = !!readPassword();
  document.getElementById('entry-password-row').hidden = !configured;
  password.disabled = !configured;
  password.required = configured;
  document.getElementById('entry-note').textContent = configured
    ? 'Çalışma alanına devam etmek için şifreni gir.'
    : 'Hazır olduğunda çalışma alanına geç.';
}
try { syncEntryNote(); } catch { entryError.textContent = 'Tarayıcıdaki şifre kaydına erişilemiyor.'; }
function setPasswordVisible(visible) {
  password.type = visible ? 'text' : 'password';
  reveal.setAttribute('aria-pressed', String(visible));
  reveal.setAttribute('aria-label', visible ? 'Şifreyi gizle' : 'Şifreyi göster');
}
reveal.addEventListener('pointerdown', event => event.preventDefault());
reveal.addEventListener('click', () => {
  const selection = [password.selectionStart, password.selectionEnd];
  setPasswordVisible(password.type === 'password');
  password.focus({preventScroll:true});
  try { password.setSelectionRange(...selection); } catch {}
});
async function unlockPassword(value) {
  if (submit.disabled) return {ok:false,error:'Şifre kontrol ediliyor.'};
  submit.disabled = true;
  entryError.textContent = '';
  try {
  if (!await matchesPassword(value)) {
    entryError.textContent = 'Şifre doğru değil.';
    if (!document.body.hasAttribute('data-native-password')) password.focus();
    return {ok:false,error:entryError.textContent};
  }
  password.blur();
  form.reset();
  setPasswordVisible(false);
  entry.hidden = true;
  home.hidden = false;
  settingsOpen.hidden = false;
  document.body.dataset.view = 'home';
  // Focus the group, not an arbitrary card: login must not light up Çalışma Alanı.
  resetPortalInteraction(true);
  home.tabIndex = -1;
  home.focus({preventScroll: true});
  return {ok:true};
  } catch { entryError.textContent = 'Şifre kontrol edilemedi. Tarayıcı depolamasını kontrol et.'; return {ok:false,error:entryError.textContent}; }
  finally { submit.disabled = false; }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  await unlockPassword(password.value);
});
document.getElementById('entry-submit').disabled = false;
if(!readPassword()) unlockPassword('');
if (inIPhone && window.webkit?.messageHandlers?.rotaPasswordEntry) {
  window.rotaUnlockNativePassword = unlockPassword;
  let geometryFrame = 0;
  const configure = () => {
    cancelAnimationFrame(geometryFrame);
    geometryFrame = requestAnimationFrame(() => {
      const card = document.querySelector('.entry-card').getBoundingClientRect();
      const outer = parent.document.getElementById('rota-home').getBoundingClientRect();
      window.webkit.messageHandlers.rotaPasswordEntry.postMessage({
        visible:!entry.hidden && !password.disabled,
        rect:{x:card.x+outer.x,y:card.y+outer.y,width:card.width,height:card.height},
        viewport:parent.innerWidth,note:document.getElementById('entry-note').textContent,
      });
    });
  };
  const nativeObserver = new MutationObserver(configure);
  nativeObserver.observe(entry,{attributes:true,attributeFilter:['hidden']});
  nativeObserver.observe(document.getElementById('entry-password-row'),{attributes:true,attributeFilter:['hidden']});
  const nativeResize = new ResizeObserver(configure);
  nativeResize.observe(document.querySelector('.entry-card'));
  window.addEventListener('resize',configure);
  window.addEventListener('pagehide',() => {cancelAnimationFrame(geometryFrame); nativeObserver.disconnect(); nativeResize.disconnect();}, {once:true});
  configure();
}
// Every fresh launch opens the welcome screen; its password field is opt-in.
const openPlanner = () => {
  if (window.parent !== window) window.parent.postMessage({type:'rota:open-planner'}, '*');
  else window.location.href = '/hafizlik-takip/index.html';
};
document.getElementById('open-hafizlik').addEventListener('click', openPlanner);
document.getElementById('open-hafizlik').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPlanner(); }
});
window.addEventListener('message', event => {
  if (event.source !== window.parent || window.parent === window) return;
  if (event.data?.type === 'rota:view') {
    resetPortalInteraction(true);
    atmosphere.dispose();
    if (event.data.view === 'home') atmosphere = beginAtmosphere();
  }
});

const dialog = document.getElementById('settings-dialog');
const settingsForm = document.getElementById('settings-form');
const message = document.getElementById('settings-message');
const current = document.getElementById('current-password');
const next = document.getElementById('new-password');
const confirm = document.getElementById('confirm-password');
const save = document.getElementById('settings-save');
const remove = document.getElementById('password-remove');
const settingsMenu = document.getElementById('settings-menu');
const securityPanel = document.getElementById('security-panel');
const applicationPanel = document.getElementById('application-panel');
const soundPanel = document.getElementById('sound-panel');
function showSettingsPage(page) {
  settingsMenu.hidden = page !== 'menu';
  document.getElementById('phone-panel').hidden=page!=='phone';
  securityPanel.hidden = page !== 'security';
  applicationPanel.hidden = page !== 'application';
  soundPanel.hidden = page !== 'sound';
  settingsForm.reset();
  message.textContent = '';
}
document.getElementById('settings-security').addEventListener('click', () => { showSettingsPage('security'); syncSettings(); });
document.getElementById('settings-application').addEventListener('click', () => showSettingsPage('application'));
document.getElementById('settings-sound').addEventListener('click', () => showSettingsPage('sound'));
document.querySelectorAll('.settings-menu-back').forEach(button => button.addEventListener('click', () => showSettingsPage('menu')));
function syncSettings() {
  const configured = !!readPassword();
  document.getElementById('current-password-row').hidden = !configured;
  remove.hidden = !configured;
}
settingsOpen.addEventListener('click', () => {
  settingsForm.reset();
  message.textContent = '';
  showSettingsPage('menu');
  try { syncSettings(); } catch { message.textContent = 'Şifre kaydı okunamadı.'; }
  dialog.showModal();
});
document.getElementById('settings-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { settingsForm.reset(); message.textContent = ''; });
async function updatePassword(deleting) {
  if (save.disabled) return;
  message.textContent = '';
  save.disabled = remove.disabled = true;
  try {
    if (!await matchesPassword(current.value)) { message.textContent = 'Mevcut şifre doğru değil.'; return; }
    if (deleting) removePassword();
    else {
      if (next.value.length < 4) { message.textContent = 'Şifre en az 4 karakter olmalı.'; return; }
      if (next.value !== confirm.value) { message.textContent = 'Yeni şifreler eşleşmiyor.'; return; }
      await savePassword(next.value);
    }
    settingsForm.reset();
    syncSettings();
    syncEntryNote();
    message.textContent = deleting ? 'Giriş şifresi kaldırıldı.' : 'Şifren kaydedildi.';
  } catch { message.textContent = 'Kaydedilemedi. Tarayıcı depolamasına erişilemiyor.'; }
  finally { save.disabled = remove.disabled = false; }
}
settingsForm.addEventListener('submit', event => { event.preventDefault(); updatePassword(false); });
remove.addEventListener('click', () => updatePassword(true));

document.getElementById('app-exit').addEventListener('click', () => {
  if (window.parent !== window) window.parent.postMessage({type:'rota:quit'}, '*');
  else document.getElementById('sound-status').textContent = 'Bu tarayıcı önizlemesini sekmeyi kapatarak sonlandırabilirsin.';
});
window.addEventListener('message', event => {
  if (event.source !== window.parent) return;
  if (event.data?.type === 'rota:quit-failed') {
    document.getElementById('sound-status').textContent = event.data.message || 'Kayıt tamamlanamadı. Uygulama açık bırakıldı.';
  }
});
window.addEventListener('load', () => {
  // A hidden native window may suspend animation frames, so readiness must
  // never depend on requestAnimationFrame to make that window visible.
  if (window.parent !== window) window.parent.postMessage({type:'rota:ready'}, '*');
});

const calendarPortal=document.getElementById('open-calendar');
calendarPortal?.addEventListener('click',()=>{if(window.parent!==window)window.parent.postMessage({type:'rota:open-calendar'},'*')});
calendarPortal?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();calendarPortal.click()}});
const yksPortal=document.getElementById('open-yks');
yksPortal?.addEventListener('click',()=>{if(window.parent!==window)window.parent.postMessage({type:'rota:open-yks'},'*');});
yksPortal?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();yksPortal.click();}});
const sportPortal=document.getElementById('open-sport');
sportPortal?.addEventListener('click',()=>{if(window.parent!==window)window.parent.postMessage({type:'rota:open-sport'},'*');});
sportPortal?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sportPortal.click();}});

document.getElementById('settings-sync').addEventListener('click',async()=>{
 showSettingsPage('phone');
 try {const install=await window.parent.rotaPhoneInstallRequest?.();
  if(install?.ready&&install.qr){const qr=document.getElementById('phone-install-qr');qr.src=install.qr;qr.hidden=false;document.getElementById('phone-install-status').textContent='iPhone kameranla QR kodu okut.';document.getElementById('phone-install-note').textContent='Açılan TestFlight ekranında Rota’yı yükle. Sonraki kullanımlarda Rota simgesinden aç.';}
 } catch {}
});
document.getElementById('phone-sync-details').addEventListener('click',()=>{dialog.close();window.parent.rotaOpenSyncSettings?.();});
