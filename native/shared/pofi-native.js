(() => {
  if (location.protocol !== 'file:' || !location.pathname.endsWith('/pofi-web/index.html')) return;
  const key = 'pofi-local-v1';
  if (true) {
    // Alerts are controlled by Rota so the browser cannot play a second
    // sound behind the phone's own sound/vibration controls.
    try {
      const local = JSON.parse(localStorage.getItem('pofi-local-device-v1') || '{}');
      local.ses = 'kapali';
      localStorage.setItem('pofi-local-device-v1', JSON.stringify(local));
    } catch {}
  }
  // Keep Pofi's own engine, artwork, controls and phone pairing intact.
  // A fresh install uses a five-minute break after every work session.
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ayar: {hedef: 12, calis: 25, mola: 5, uzun: 5, uzunAralik: 4, otoDevam: false}}));
  }
  let options = {automatic:false,showAlert:true,showBefore:false};
  window.rotaPofiSetOptions = next => {
    options = {...options,...next};
    for (const [name,value] of Object.entries(options)) {
      const button=document.querySelector(`[data-rota-option="${name}"]`);
      if(button){button.setAttribute('aria-checked',String(value));button.classList.toggle('acik',value);}
    }
  };
  let previous = '';
  function report() {
    if (!window.ROTA_POFI_BOOTED) return;
    const raw = localStorage.getItem(key);
    if (!raw || raw === previous) return;
    try {
      const state = JSON.parse(raw);
      window.webkit.messageHandlers.pofiState.postMessage(state);
      previous = raw;
    } catch {}
  }
  window.rotaPofiBoot = state => { window.ROTA_POFI_BOOTED = true; window.rotaPofiApply?.(state); report(); };
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, value) {
    setItem.call(this, k, value);
    if (this === localStorage && k === key) report();
  };
  window.rotaPofiOpenSettings = () => document.getElementById('ayarD')?.click();
  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ayarD')?.addEventListener('click', () => window.webkit?.messageHandlers?.pofiWindow?.postMessage('settings'));
    document.getElementById('panelKapat')?.addEventListener('click', () => window.webkit?.messageHandlers?.pofiWindow?.postMessage('corner'));
  });
  window.addEventListener('DOMContentLoaded', () => {
    if (true) {
      const panel = document.getElementById('panelIc');
      const hideBrowserSound = () => {
        if (window.webkit?.messageHandlers?.pofiWindow && panel && !panel.querySelector('#rota-options')) {
          const root=document.createElement('section');root.id='rota-options';
          root.innerHTML='<h4>Rota</h4>';
          for(const [name,label] of Object.entries({automatic:'Çalışma ↔ yürüyüş otomatik',showAlert:'Uyarıda Pofi’yi göster',showBefore:'Son 30 saniyede göster'})){
            const button=document.createElement('button');button.type='button';button.className='sat anahtar';button.dataset.rotaOption=name;button.setAttribute('role','switch');button.innerHTML='<span>'+label+'</span><i></i>';
            button.onclick=event=>{event.stopPropagation();window.webkit.messageHandlers.pofiWindow.postMessage({option:name,enabled:button.getAttribute('aria-checked')!=='true'});};root.append(button);
          }
          panel.append(root);window.rotaPofiSetOptions(options);
        }
        for (const heading of panel?.querySelectorAll('h4') || []) {
          if (['Ses', 'Telefon'].includes(heading.textContent.trim())) {
            heading.hidden = true;
            if (heading.nextElementSibling?.classList.contains('secim')) heading.nextElementSibling.hidden = true;
          }
        }
      };
      if (panel) new MutationObserver(hideBrowserSound).observe(panel, {childList:true});
      hideBrowserSound();
    }
    report();
  });
  window.addEventListener('pageshow', report);
  window.addEventListener('storage', report);
  setInterval(report, 1000);
})();
