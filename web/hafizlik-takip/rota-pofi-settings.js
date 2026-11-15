(() => {
  if (window.top !== window || window.__rotaPofiSettings) return;
  window.__rotaPofiSettings = true;
  function install(doc) {
    const menu = doc.getElementById('settings-menu');
    if (!menu || doc.getElementById('settings-pofi')) return;
    const button = doc.createElement('button');
    button.id = 'settings-pofi'; button.type = 'button';
    button.innerHTML = '<span>Pofi · Yürüme molaları<small>25 dk çalışma, 5 dk yürüme · süreler ve takip</small></span><span aria-hidden="true">›</span>';
    button.addEventListener('click', () => {
      window.webkit.messageHandlers.rotaPofi.postMessage({action: 'settings'});
    });
    menu.append(button);
  }
  function scan() {
    install(document);
    for (const frame of document.querySelectorAll('iframe')) {
      if (!frame.dataset.rotaPofiBound) {
        frame.dataset.rotaPofiBound = 'true';
        frame.addEventListener('load', scan);
      }
      try { if (frame.contentDocument) install(frame.contentDocument); } catch {}
    }
  }
  new MutationObserver(scan).observe(document.documentElement, {childList: true, subtree: true});
  scan();
})();
