(() => {
  if (window.top !== window || window.__rotaShoppingSettings) return;
  window.__rotaShoppingSettings = true;
  function install(doc) {
    const menu = doc.getElementById('settings-menu');
    if (!menu || doc.getElementById('settings-shopping')) return;
    const button = doc.createElement('button');
    button.id = 'settings-shopping';
    button.type = 'button';
    button.innerHTML = '<span>Alışveriş planı<small>Ürünler, hediyeler ve aylık taksitler</small></span><span aria-hidden="true">›</span>';
    button.addEventListener('click', () => window.webkit?.messageHandlers?.rotaShoppingOpen?.postMessage('open'));
    menu.append(button);
  }
  function scan() {
    install(document);
    const home = document.getElementById('rota-home');
    if (!home) return;
    if (!home.dataset.rotaShoppingBound) {
      home.dataset.rotaShoppingBound = 'true';
      home.addEventListener('load', scan);
    }
    try { if (home.contentDocument) install(home.contentDocument); } catch {}
  }
  new MutationObserver(scan).observe(document.documentElement, {childList:true,subtree:true});
  scan();
})();
