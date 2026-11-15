(() => {
  'use strict';

  const icons = {
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    note: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    list: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h6M7 15h6m3-6 1 1 2-2m-3 7 1 1 2-2"/>',
    type: '<path d="M4 5h16M12 5v15M8 20h8M4 5v3m16-3v3"/>',
    link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>',
    arrow: '<path d="m14 6-6 6 6 6M8 12h12"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V4H4v11h4"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    front: '<rect x="8" y="3" width="13" height="13" rx="2"/><path d="M16 16v5H3V8h5"/>',
    back: '<rect x="3" y="8" width="13" height="13" rx="2"/><path d="M8 8V3h13v13h-5"/>',
    left: '<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>',
    center: '<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>',
    right: '<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    move: '<path d="M12 3v18M3 12h18m-3-3 3 3-3 3M6 9l-3 3 3 3m3-9 3-3 3 3m-6 12 3 3 3-3"/>',
    settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.layers}</svg>`;
  const fontChoices = [
    ['-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', 'Sade'],
    ['Georgia, "Times New Roman", serif', 'Klasik'],
    ['Arial, sans-serif', 'Arial'],
    ['"Trebuchet MS", sans-serif', 'Yuvarlak'],
    ['"Courier New", monospace', 'Daktilo']
  ];
  const variants = {
    note: { title:'Not kartları', subtitle:'Bir kart seç, yazısını Yazı aracından düzenle.', items:[
      {key:'plain', label:'Sade kart', description:'Temiz ve açık', preview:'note-plain'},
      {key:'beige', label:'Bej kart', description:'Sıcak ve sakin', preview:'note-beige'},
      {key:'navy', label:'Lacivert kart', description:'Koyu ve belirgin', preview:'note-navy'}
    ]},
    checklist: { title:'Tikli tablolar', subtitle:'Satırlarını düzenleyebileceğin hazır tablolar.', items:[
      {key:'simple', label:'Satırlı tablo', description:'Her satırda bir tik', preview:'list-simple'},
      {key:'numbered', label:'Numaralı tablo', description:'Sırası belli adımlar', preview:'list-numbered'},
      {key:'compact', label:'Kompakt tablo', description:'Daha az yer kaplar', preview:'list-compact'}
    ]},
    text: { title:'Yazı stilleri', subtitle:'Yazılar kartlardan bağımsız da kullanılabilir.', items:[
      {key:'heading', label:'Başlık', description:'Büyük ve güçlü', preview:'text-heading'},
      {key:'body', label:'Normal yazı', description:'Açıklama ve notlar', preview:'text-body'}
    ]}
  };

  class HafizlikDesignPanel {
    constructor(root, studio) {
      this.root = root;
      this.studio = studio;
      this.tab = 'elements';
      this.category = null;
      this.lastSelectedId = null;
      this.rowsSignature = null;
      this.linksSignature = null;
      this.endpointsSignature = null;
      this.draft = {text:'',fontSize:20,fontFamily:fontChoices[0][0],color:'#24394c',background:'transparent',fontWeight:'400',fontStyle:'normal',textAlign:'left'};
      this.panel = document.createElement('aside');
      this.panel.className = 'design-panel';
      this.panel.setAttribute('aria-label', 'Tasarım araçları');
      this.panel.innerHTML = this.template();
      root.append(this.panel);
      this.bind();
      this.refresh();
    }

    template() {
      return `
        <div class="design-panel-heading"><span class="design-brand-icon">${svg('layers')}</span><div><h2>Tasarım alanı</h2><p>Planına kendi dokunuşunu ekle.</p></div><span class="design-live-dot" title="Düzenleme açık"></span></div>
        <div class="design-tabs" role="tablist" aria-label="Tasarım araçları">
          <button type="button" role="tab" id="design-tab-elements" aria-controls="design-elements" data-tab="elements" aria-selected="true">${svg('layers')}<span>Ögeler</span></button>
          <button type="button" role="tab" id="design-tab-text" aria-controls="design-text" data-tab="text" aria-selected="false">${svg('type')}<span>Yazı</span></button>
          <button type="button" role="tab" id="design-tab-links" aria-controls="design-links" data-tab="links" aria-selected="false">${svg('link')}<span>Bağla</span></button>
        </div>
        <div class="design-panel-scroll">
          <section class="design-tab-panel" id="design-elements" role="tabpanel" aria-labelledby="design-tab-elements">
            <div class="design-category-home">
              <p class="design-section-label">NE EKLEMEK İSTERSİN?</p>
              <button type="button" class="design-category-card" data-category="note"><span class="design-category-art design-art-note"><i></i><i></i><i></i></span><span><strong>Not kartları</strong><small>Düşüncelerine bir alan</small></span>${svg('chevron')}</button>
              <button type="button" class="design-category-card" data-category="checklist"><span class="design-category-art design-art-list"><i></i><i></i><i></i></span><span><strong>Tikli tablolar</strong><small>Kendi takip listeni oluştur</small></span>${svg('chevron')}</button>
              <button type="button" class="design-category-card" data-category="text"><span class="design-category-art design-art-text">Aa</span><span><strong>Serbest yazı</strong><small>Başlık, açıklama, hatırlatma</small></span>${svg('chevron')}</button>
              <p class="design-help">Ögeleri ekledikten sonra tutamacından taşıyabilir, kenarlarından boyutlandırabilirsin.</p>
            </div>
            <div class="design-category-details" hidden><button type="button" class="design-back" data-command="categories">${svg('arrow')}<span>Tüm kategoriler</span></button><h3 class="design-category-title"></h3><p class="design-category-description"></p><div class="design-variant-list"></div></div>
          </section>
          <section class="design-tab-panel" id="design-text" role="tabpanel" aria-labelledby="design-tab-text" hidden>
            <div class="design-section-top"><span class="design-section-label">YAZI ARACI</span><button type="button" class="design-small-link" data-command="new-text">Yeni yazı</button></div>
            <p class="design-text-context design-help"></p>
            <label class="design-field"><span>Yazın</span><textarea id="design-text-content" rows="4" placeholder="Yazını buraya yaz…" spellcheck="false"></textarea></label>
            <div class="design-type-controls">
              <label class="design-field design-font-field"><span>Yazı tarzı</span><select id="design-font-family"></select></label>
              <label class="design-field design-size-field"><span>Boyut</span><input id="design-font-size" type="number" min="8" max="120" step="1" inputmode="numeric"></label>
            </div>
            <div class="design-format-toolbar" aria-label="Yazı biçimi">
              <button type="button" class="design-format-button" data-format="bold" aria-label="Kalın" title="Kalın" aria-pressed="false"><b>B</b></button>
              <button type="button" class="design-format-button" data-format="italic" aria-label="İtalik" title="İtalik" aria-pressed="false"><i>İ</i></button>
              <span class="design-format-divider"></span>
              <button type="button" class="design-format-button" data-align="left" aria-label="Sola hizala" title="Sola hizala" aria-pressed="true">${svg('left')}</button>
              <button type="button" class="design-format-button" data-align="center" aria-label="Ortala" title="Ortala" aria-pressed="false">${svg('center')}</button>
              <button type="button" class="design-format-button" data-align="right" aria-label="Sağa hizala" title="Sağa hizala" aria-pressed="false">${svg('right')}</button>
              <label class="design-inline-color" title="Yazı rengi"><input id="design-text-color" type="color" value="#24394c" aria-label="Yazı rengi"><span>A</span></label>
            </div>
            <button type="button" class="design-primary" data-command="add-text">${svg('plus')}<span>Yazıyı ekle</span></button>
            <div class="design-tip">${svg('move')}<span>Yazını çalışma alanında istediğin yere taşı.</span></div>
          </section>
          <section class="design-tab-panel" id="design-links" role="tabpanel" aria-labelledby="design-tab-links" hidden>
            <div class="design-section-top"><span class="design-section-label">TİKLERİ BİRBİRİNE BAĞLA</span></div>
            <div class="design-cable-preview" aria-hidden="true"><span>✓</span><svg viewBox="0 0 120 30"><path d="M3 15 C45 15 65 15 117 15"/><circle cx="3" cy="15" r="3"/><circle cx="117" cy="15" r="3"/></svg><span>✓</span></div>
            <p class="design-help">Bağlama açıkken bir tikin yanındaki noktadan diğerine kablo sürükle.</p>
            <button type="button" class="design-link-toggle" data-command="toggle-links" role="switch" aria-checked="false"><span>${svg('link')}<strong>Kabloyla bağla</strong></span><i><b></b></i></button>
            <label class="design-field"><span>İlk tik değişince diğerinde ne olsun?</span><select id="design-link-action"><option value="check">İşaretlenince o da işaretlensin</option><option value="uncheck">İşaretlenince diğerinin işareti kalksın</option><option value="mirror">Diğeri aynı durumu izlesin</option><option value="requiresAll">Hedefin ön koşulu olsun</option></select></label>
            <details class="design-link-fallback"><summary>Sürüklemeden bağla</summary><label class="design-field"><span>Başlatan tik</span><select id="design-link-source"><option value="">Tik seç…</option></select></label><label class="design-field"><span>Etkilenen tik</span><select id="design-link-target"><option value="">Tik seç…</option></select></label><button type="button" class="design-secondary" data-command="connect">${svg('plus')}Bağlantıyı ekle</button></details>
            <div class="design-section-top design-link-list-heading"><span class="design-section-label">BAĞLANTILAR</span><span class="design-count" id="design-link-count">0</span></div>
            <div class="design-links-list"></div>
          </section>
          <section class="design-inspector" aria-label="Seçili öge ayarları" hidden>
            <div class="design-selection-heading"><span class="design-selection-icon">${svg('settings')}</span><div><p class="design-section-label">SEÇİLİ ÖGE</p><h3 class="design-selection-name"></h3></div></div>
            <div class="design-arrange-toolbar"><button type="button" data-command="duplicate" title="Çoğalt">${svg('copy')}<span>Çoğalt</span></button><button type="button" data-command="forward" title="Öne getir">${svg('front')}<span>Öne</span></button><button type="button" data-command="backward" title="Arkaya gönder">${svg('back')}<span>Arkaya</span></button><button type="button" data-command="delete" class="design-delete" title="Ögeyi sil">${svg('trash')}<span>Sil</span></button></div>
            <div class="design-selected-copy"><button type="button" class="design-secondary" data-command="edit-text">${svg('type')}Yazısını düzenle</button></div>
            <div class="design-checklist-editor" hidden><label class="design-field"><span>Tablo başlığı</span><input id="design-checklist-title" type="text" placeholder="Başlık"></label><div class="design-section-top"><span class="design-section-label">SATIRLAR</span><button type="button" class="design-small-link" data-command="add-row">+ Satır</button></div><div class="design-row-list"></div></div>
            <div class="design-section-top"><span class="design-section-label">KONUM VE BOYUT</span><span class="design-unit">px</span></div>
            <div class="design-geometry-grid"><label><span>X</span><input data-geometry="x" type="number" step="1" aria-label="Yatay konum"></label><label><span>Y</span><input data-geometry="y" type="number" step="1" aria-label="Dikey konum"></label><label><span>G</span><input data-geometry="width" type="number" min="80" step="1" aria-label="Genişlik"></label><label><span>Y</span><input data-geometry="height" type="number" min="36" step="1" aria-label="Yükseklik"></label></div>
            <div class="design-section-top"><span class="design-section-label">RENK UYUMU</span></div>
            <div class="design-color-fields"><label class="design-color-field"><input type="color" id="design-object-color" value="#24394c"><span>Yazı</span></label><label class="design-color-field"><input type="color" id="design-object-background" value="#ffffff"><span>Zemin</span></label><button type="button" class="design-transparent" data-command="transparent" title="Şeffaf arka plan">Şeffaf</button></div>
            <div class="design-swatches" aria-label="Uyumlu zemin renkleri"></div>
          </section>
          <div class="design-panel-footnote"><span></span>Değişikliklerin otomatik kaydedilir.</div>
        </div>
        <div class="design-panel-message" role="status" hidden></div>`;
    }

    bind() {
      const fontSelect = this.$('#design-font-family');
      fontChoices.forEach(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; fontSelect.append(option);
      });
      [['#ffffff','Beyaz'],['#e6d6b8','Bej'],['#d3d7d6','Gri'],['#263e55','Lacivert'],['#2b3036','Kömür'],['#f1ece2','Kırık beyaz']].forEach(([color,label]) => {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.swatch = color; button.style.setProperty('--swatch',color); button.title = label; button.setAttribute('aria-label', `${label} zemin`);
        this.$('.design-swatches').append(button);
      });
      this.panel.addEventListener('click', event => this.onClick(event));
      this.panel.addEventListener('change', event => this.onChange(event));
      this.$('#design-text-content').addEventListener('input', event => {
        const node = this.textTarget();
        if (node) this.apply({text:event.target.value});
        else this.draft.text = event.target.value;
      });
      this.$('#design-checklist-title').addEventListener('input', event => this.apply({title:event.target.value}));
      this.panel.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.studio.links?.mode) { this.studio.links.setMode(false); this.refresh(); event.stopPropagation(); }
        if (event.target.matches('[role="tab"]') && ['ArrowLeft','ArrowRight'].includes(event.key)) {
          const tabs = [...this.panel.querySelectorAll('[role="tab"]')];
          const index = tabs.indexOf(event.target), delta = event.key === 'ArrowRight' ? 1 : -1;
          const next = tabs[(index + delta + tabs.length) % tabs.length];
          this.setTab(next.dataset.tab); next.focus(); event.preventDefault();
        }
      });
      ['hafizlik:selection','hafizlik:design-change','hafizlik:editing'].forEach(name => this.root.addEventListener(name, () => this.refresh()));
    }

    $(selector) { return this.panel.querySelector(selector); }
    selected() { return this.studio.getSelected?.() || null; }
    textTarget() {
      if (this.newTextDraft) return null;
      const node = this.selected();
      return node && ['text','legacy'].includes(node.type) ? node : null;
    }
    apply(patch) {
      if (this.selected()) this.studio.updateSelected(patch);
      this.refresh();
    }
    setValue(selector, value) {
      const field = this.$(selector);
      if (field && document.activeElement !== field) field.value = value == null ? '' : String(value);
    }
    setTab(tab) {
      this.tab = tab;this.panel.classList.toggle('is-link-tab',tab==='links');
      this.panel.querySelectorAll('[role="tab"]').forEach(button => {
        const selected = button.dataset.tab === tab;
        button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      });
      ['elements','text','links'].forEach(name => this.$(`#design-${name}`).hidden = name !== tab);
      this.refresh();
    }

    showCategory(name) {
      if (!variants[name]) return;
      this.category = name;
      this.setTab('elements');
      this.$('.design-category-home').hidden = true;
      this.$('.design-category-details').hidden = false;
      const category = variants[name];
      this.$('.design-category-title').textContent = category.title;
      this.$('.design-category-description').textContent = category.subtitle;
      const list = this.$('.design-variant-list'); list.replaceChildren();
      category.items.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'design-variant-card'; button.dataset.addType = name; button.dataset.variant = item.key;
        const preview = document.createElement('span'); preview.className = `design-mini-preview ${item.preview}`; preview.setAttribute('aria-hidden','true');
        if (name === 'text') { preview.textContent = item.key === 'heading' ? 'Başlığın' : 'Kendi kelimelerinle…'; }
        else {
          for (let i = 0; i < 3; i++) {
            const line = document.createElement('i');
            if (name === 'checklist') { const check = document.createElement('b'); line.append(check); }
            preview.append(line);
          }
        }
        const info = document.createElement('span'); info.className = 'design-variant-info';
        const title = document.createElement('strong'); title.textContent = item.label;
        const subtitle = document.createElement('small'); subtitle.textContent = item.description;
        info.append(title,subtitle); button.append(preview,info);
        const plus = document.createElement('span'); plus.className = 'design-add-indicator'; plus.innerHTML = svg('plus'); button.append(plus);
        list.append(button);
      });
    }

    onClick(event) {
      const button = event.target.closest('button');
      if (!button || !this.panel.contains(button)) return;
      if (button.dataset.tab) return this.setTab(button.dataset.tab);
      if (button.dataset.category) return this.showCategory(button.dataset.category);
      if (button.dataset.addType) {
        this.newTextDraft = false;
        this.studio.addNode(button.dataset.addType,button.dataset.variant);
        if (button.dataset.addType === 'text') this.setTab('text');
        return this.refresh();
      }
      if (button.dataset.swatch) return this.apply({style:{background:button.dataset.swatch}});
      if (button.dataset.format) {
        const style = this.textTarget()?.style || this.draft;
        const patch = button.dataset.format === 'bold'
          ? {fontWeight:Number(style.fontWeight) >= 600 || style.fontWeight === 'bold' ? '400' : '700'}
          : {fontStyle:style.fontStyle === 'italic' ? 'normal' : 'italic'};
        return this.applyTextStyle(patch);
      }
      if (button.dataset.align) return this.applyTextStyle({textAlign:button.dataset.align});
      if (button.dataset.removeLink) { this.studio.links?.remove(button.dataset.removeLink); return this.refresh(); }
      if (button.dataset.removeRow) {
        const node = this.selected();
        if (node?.rows?.length > 1) this.apply({rows:node.rows.filter(row => row.id !== button.dataset.removeRow)});
        return;
      }
      switch (button.dataset.command) {
        case 'categories': this.category = null; this.$('.design-category-home').hidden = false; this.$('.design-category-details').hidden = true; break;
        case 'new-text':
          this.newTextDraft = true; this.draft.text = ''; this.setTab('text'); this.$('#design-text-content').focus(); break;
        case 'add-text': {
          const target = this.textTarget();
          if (target) { this.flash('Yazın kaydedildi.'); break; }
          const text = this.$('#design-text-content').value.trim();
          if (!text) { this.flash('Önce yazını ekle.'); this.$('#design-text-content').focus(); break; }
          const frame = !this.newTextDraft && this.selected()?.type === 'note' ? this.selected() : null;
          const previousId = this.selected()?.id;
          this.newTextDraft = false;
          this.studio.addNode('text','body');
          if (this.selected()?.type !== 'text' || this.selected()?.id === previousId) { this.newTextDraft = true; this.flash('Yeni yazı eklenemedi. Kullanmadığın bir ögeyi silerek yer açabilirsin.'); break; }
          const {text:unused, ...style} = this.draft;
          const patch = {text,style};
          if (frame?.geometry) patch.geometry = {x:frame.geometry.x + 18,y:frame.geometry.y + 18,width:Math.max(80,frame.geometry.width - 36),height:Math.max(36,frame.geometry.height - 36)};
          this.apply(patch);
          this.studio.reveal?.(this.studio.selectedId);
          this.flash(frame ? 'Yazın not kartının üstüne eklendi.' : 'Yazın çalışma alanına eklendi.'); break;
        }
        case 'edit-text': this.newTextDraft = false; this.setTab('text'); this.$('#design-text-content').focus(); break;
        case 'duplicate': this.studio.duplicateSelected(); break;
        case 'delete': this.studio.deleteSelected(); break;
        case 'forward': this.studio.bringForward(); break;
        case 'backward': this.studio.sendBackward(); break;
        case 'transparent': this.apply({style:{background:'transparent'}}); break;
        case 'add-row': {
          const node = this.selected();
          if (node?.type === 'checklist') {
            const row = {id:`row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,text:'Yeni satır',checked:false};
            this.apply({rows:[...(node.rows || []),row]});
          }
          break;
        }
        case 'toggle-links':
          this.studio.links?.setMode(!this.studio.links.mode); break;
        case 'connect': {
          const source = this.$('#design-link-source').value, target = this.$('#design-link-target').value;
          if (!source || !target) { this.flash('Bağlamak istediğin iki tiki seç.'); break; }
          if (source === target) { this.flash('Birbirinden farklı iki tik seç.'); break; }
          try {
            this.studio.links?.connect(source,target,this.$('#design-link-action').value);
            this.flash('Tikler birbirine bağlandı.');
          } catch (error) { this.flash(error.message || 'Bu tikler birbirine bağlanamadı.'); }
          break;
        }
      }
      this.refresh();
    }

    applyTextStyle(style) {
      if (this.textTarget()) this.apply({style});
      else { Object.assign(this.draft,style); this.refreshText(); }
    }

    onChange(event) {
      const input = event.target;
      if (input.dataset.geometry) {
        const number = Number(input.value);
        if (Number.isFinite(number)) this.apply({geometry:{[input.dataset.geometry]:Math.max(input.dataset.geometry === 'width' ? 80 : input.dataset.geometry === 'height' ? 36 : 0,number)}});
        return;
      }
      if (input.dataset.rowId) {
        const node = this.selected();
        if (node?.rows) this.apply({rows:node.rows.map(row => row.id === input.dataset.rowId ? {...row,text:input.value} : row)});
        return;
      }
      switch (input.id) {
        case 'design-font-family': this.applyTextStyle({fontFamily:input.value}); break;
        case 'design-font-size': this.applyTextStyle({fontSize:Math.min(120,Math.max(8,Number(input.value) || 20))}); break;
        case 'design-text-color': this.applyTextStyle({color:input.value}); break;
        case 'design-object-color': this.apply({style:{color:input.value}}); break;
        case 'design-object-background': this.apply({style:{background:input.value}}); break;
        case 'design-link-action': this.studio.links?.setAction(input.value); this.refreshLinks(); break;
      }
    }

    refresh() {
      const editing = this.root.classList.contains('editing-mode');
      this.panel.hidden = !editing;
      const node = this.selected();
      if ((node?.id || null) !== this.lastSelectedId) {
        this.lastSelectedId = node?.id || null;
        this.newTextDraft = false;
        this.rowsSignature = null;
      }
      this.refreshText();
      this.refreshInspector(node);
      this.refreshLinks();
    }

    refreshText() {
      const node = this.textTarget();
      const style = node?.style || this.draft;
      const frame = !this.newTextDraft && this.selected()?.type === 'note';
      this.$('.design-text-context').textContent = node ? 'Seçili ögenin yazısını ve görünümünü buradan düzenle.' : frame ? 'Not kartının üzerine ayrı bir yazı ekle. Yazıyı sonra özgürce taşıyabilirsin.' : 'Bağımsız bir yazı ekle; sonra istediğin yere taşı.';
      this.setValue('#design-text-content',node ? node.text || '' : this.draft.text);
      this.setValue('#design-font-size',Math.round(Number(style.fontSize) || 20));
      const family = fontChoices.some(([font]) => font === style.fontFamily) ? style.fontFamily : fontChoices[0][0];
      this.setValue('#design-font-family',family);
      this.setValue('#design-text-color',this.asHex(style.color,'#24394c'));
      this.$('[data-format="bold"]').setAttribute('aria-pressed',String(Number(style.fontWeight) >= 600 || style.fontWeight === 'bold'));
      this.$('[data-format="italic"]').setAttribute('aria-pressed',String(style.fontStyle === 'italic'));
      this.panel.querySelectorAll('[data-align]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.align === (style.textAlign || 'left'))));
      this.$('[data-command="add-text"] span').textContent = node ? 'Yazı otomatik kaydediliyor' : frame ? 'Karta yazı ekle' : 'Yazıyı ekle';
      this.$('[data-command="add-text"]').classList.toggle('is-saved',Boolean(node));
    }

    refreshInspector(node) {
      this.$('.design-inspector').hidden = !node;
      if (!node) return;
      const labels = {note:'Not kartı',checklist:'Tikli tablo',text:'Serbest yazı',legacy:'Plan ögesi'};
      this.$('.design-selection-name').textContent = node.title || labels[node.type] || 'Seçili öge';
      const isChecklist = node.type === 'checklist';
      this.$('.design-checklist-editor').hidden = !isChecklist;
      this.$('.design-selected-copy').hidden = isChecklist;
      this.$('[data-command="edit-text"]').lastChild.textContent = node.type === 'note' ? 'Üstüne yazı ekle' : 'Yazısını düzenle';
      this.setValue('#design-checklist-title',node.title || '');
      ['x','y','width','height'].forEach(name => this.setValue(`[data-geometry="${name}"]`,Math.round(Number(node.geometry?.[name]) || 0)));
      this.setValue('#design-object-color',this.asHex(node.style?.color,'#24394c'));
      this.setValue('#design-object-background',this.asHex(node.style?.background,'#ffffff'));
      this.$('[data-command="transparent"]').classList.toggle('is-active',node.style?.background === 'transparent');
      this.panel.querySelectorAll('[data-swatch]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.swatch.toLowerCase() === String(node.style?.background || '').toLowerCase())));
      if (isChecklist) this.refreshRows(node.rows || []);
    }

    refreshRows(rows) {
      const signature = JSON.stringify(rows.map(row => [row.id,row.text]));
      if (signature === this.rowsSignature) return;
      const focused = document.activeElement;
      if (this.$('.design-row-list').contains(focused) && focused.matches('input[data-row-id]')) return;
      this.rowsSignature = signature;
      const list = this.$('.design-row-list'); list.replaceChildren();
      rows.forEach((row,index) => {
        const line = document.createElement('div'); line.className = 'design-row-editor';
        const number = document.createElement('span'); number.textContent = String(index + 1);
        const input = document.createElement('input'); input.type = 'text'; input.dataset.rowId = row.id; input.value = row.text; input.setAttribute('aria-label', `${index + 1}. satır`);
        const button = document.createElement('button'); button.type = 'button'; button.dataset.removeRow = row.id; button.innerHTML = svg('close'); button.title = 'Satırı sil'; button.setAttribute('aria-label',`${index + 1}. satırı sil`); button.disabled = rows.length < 2;
        line.append(number,input,button); list.append(line);
      });
    }

    refreshLinks() {
      const links = this.studio.links;
      const supported = Boolean(links);
      this.$('[data-command="toggle-links"]').disabled = !supported;
      this.$('[data-command="toggle-links"]').setAttribute('aria-checked',String(Boolean(links?.mode)));
      this.setValue('#design-link-action',links?.action || 'check');
      const list = links?.list?.() || [];
      this.$('#design-link-count').textContent = String(list.length);
      const signature = JSON.stringify(list);
      if (signature !== this.linksSignature) {
        this.linksSignature = signature;
        const container = this.$('.design-links-list'); container.replaceChildren();
        if (!list.length) {
          const empty = document.createElement('p'); empty.className = 'design-empty'; empty.textContent = 'Henüz bir bağlantı yok. İlk kablonu çekerek başlayabilirsin.'; container.append(empty);
        }
        list.forEach(link => {
          const row = document.createElement('div'); row.className = 'design-link-row';
          const copy = document.createElement('div');
          const source = document.createElement('strong'); source.textContent = link.sourceLabel || 'Başlatan tik';
          const target = document.createElement('span'); target.textContent = `→ ${link.targetLabel || 'Diğer tik'}`;
          const action = document.createElement('small'); action.textContent = {check:'İşaretlensin',uncheck:'İşareti kalksın',mirror:'Aynı durumu izlesin'}[link.action] || 'İşaretlensin';
          copy.append(source,target,action);
          const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.removeLink = link.id; remove.innerHTML = svg('close'); remove.title = 'Bağlantıyı sil'; remove.setAttribute('aria-label','Bağlantıyı sil');
          const edit=document.createElement('button');edit.type='button';edit.textContent='Düzenle';edit.dataset.editLink=link.id;row.append(copy,edit,remove); container.append(row);
        });
      }
      const endpoints = links?.endpoints?.();
      this.$('.design-link-fallback').hidden = !Array.isArray(endpoints);
      if (!Array.isArray(endpoints)) return;
      const options = endpoints.map(point => typeof point === 'string' ? {id:point,label:point} : {id:point.id || point.value,label:point.label || point.text || point.id});
      const endpointSignature = JSON.stringify(options);
      if (endpointSignature === this.endpointsSignature) return;
      this.endpointsSignature = endpointSignature;
      ['source','target'].forEach(kind => {
        const select = this.$(`#design-link-${kind}`), previous = select.value;
        select.replaceChildren();
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Tik seç…'; select.append(placeholder);
        options.forEach(point => { const option = document.createElement('option'); option.value = point.id; option.textContent = point.label; select.append(option); });
        select.value = options.some(point => point.id === previous) ? previous : '';
      });
    }

    asHex(value,fallback) {
      if (/^#[0-9a-f]{6}$/i.test(value || '')) return value;
      if (/^#[0-9a-f]{3}$/i.test(value || '')) return `#${value.slice(1).split('').map(x => x + x).join('')}`;
      const match = String(value || '').match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/);
      return match ? `#${match.slice(1).map(n => Math.min(255,Number(n)).toString(16).padStart(2,'0')).join('')}` : fallback;
    }
    flash(message) {
      const status = this.$('.design-panel-message'); status.textContent = message; status.hidden = false;
      clearTimeout(this.messageTimeout); this.messageTimeout = setTimeout(() => { status.hidden = true; },2800);
    }
  }
  window.HafizlikDesignPanel = HafizlikDesignPanel;
})();
