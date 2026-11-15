(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ACTIONS = new Set(['check', 'uncheck', 'mirror','requiresAll']);
  const ACTION_LABELS = {check:'İşaretle',uncheck:'İşareti kaldır',mirror:'Aynı durumu uygula',requiresAll:'Ön koşul olsun'};

  class HafizlikCheckboxLinks {
    constructor(root, savedLinks = [], onChange = () => {}) {
      this.root = root;
      this.sheet = root.querySelector('.sheet');
      this.viewport = root.querySelector('.workspace-viewport');
      this.onChange = onChange;
      this.mode = false;
      this.action = 'check';
      this.links = [];
      this.nodes = new Map();
      this.ports = new Map();
      this.known = new Map();
      this.counter = 0;
      this.selected = null;
      this.gesture = null;
      this.processing = false;
      this.frame = null;
      this.refreshFrame = null;
      this.controller = new AbortController();
      this.overlay = document.createElement('div');
      this.overlay.className = 'checkbox-link-layer';
      this.overlay.hidden = true;
      this.svg = document.createElementNS(NS, 'svg');
      this.svg.classList.add('checkbox-link-cables');
      this.svg.setAttribute('aria-hidden', 'true');
      this.portLayer = document.createElement('div');
      this.portLayer.className = 'checkbox-link-ports';
      this.live = document.createElement('span');
      this.live.className = 'sr-only';
      this.live.setAttribute('role', 'status');
      this.live.setAttribute('aria-live', 'polite');
      this.overlay.append(this.svg, this.portLayer, this.live);
      this.sheet.append(this.overlay);
      this.refresh();
      if (Array.isArray(savedLinks)) {
        savedLinks.forEach(link => {
          try {
            this.validate(link?.source, link?.target, link?.action);
            if (this.links.some(item => item.source === link.source && item.target === link.target)) return;
            this.links.push({id:typeof link.id === 'string' && !this.links.some(item => item.id === link.id) ? link.id : this.newId(),source:link.source,target:link.target,action:link.action});
          } catch (_) { /* Invalid old links cannot affect the planner. */ }
        });
      }
      const options = {signal:this.controller.signal};
      root.addEventListener('change', event => {
        const input = event.target;
        if (this.processing || !input?.dataset?.checkId || this.nodes.get(input.dataset.checkId) !== input) return;
        if (this.known.get(input.dataset.checkId) === input.checked) return;
        this.propagate([input.dataset.checkId]);
      }, options);
      root.addEventListener('pointerdown', event => this.pointerDown(event), {...options,capture:true});
      document.addEventListener('pointermove', event => this.pointerMove(event), {...options,capture:true});
      document.addEventListener('pointerup', event => this.pointerUp(event), {...options,capture:true});
      document.addEventListener('pointercancel', () => this.cancelGesture(), options);
      root.addEventListener('click', event => {
        const port = event.target.closest?.('.checkbox-link-port');
        if (!port || !this.visible()) return;
        event.preventDefault(); event.stopPropagation();
        // Keyboard/screen-reader click; physical clicks are handled at pointerup.
        if (event.detail === 0) this.choosePort(port.dataset.linkPort);
      }, {...options,capture:true});
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') this.cancelGesture();
      }, options);
      document.addEventListener('hafizlik:checks-updated', () => this.sync(), options);
      root.addEventListener('hafizlik:board-change', () => this.draw(), options);
      root.addEventListener('hafizlik:view-change', () => this.draw(), options);
      root.addEventListener('hafizlik:design-change', () => this.draw(), options);
      this.editObserver = new MutationObserver(() => this.updateVisibility());
      this.editObserver.observe(root, {attributes:true,attributeFilter:['class']});
      this.nodeObserver = new MutationObserver(records => {
        if (!records.some(record => !this.overlay.contains(record.target) && [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && (node.matches?.('input[type=checkbox]') || node.querySelector?.('input[type=checkbox]'))))) return;
        if (this.refreshFrame !== null) return;
        this.refreshFrame = requestAnimationFrame(() => { this.refreshFrame = null; this.refresh(); });
      });
      this.nodeObserver.observe(this.sheet, {childList:true,subtree:true});
      this.updateVisibility();
    }

    newId() { return `link-${Date.now().toString(36)}-${++this.counter}`; }
    visible() { return this.mode && this.root.classList.contains('editing-mode'); }
    setMode(value) { this.mode = !!value; this.updateVisibility(); }
    setAction(action) {
      if (!ACTIONS.has(action)) throw new Error('Geçerli bir bağlantı işlemi seç.');
      this.action = action;
      this.draw();
    }
    updateVisibility() {
      const visible = this.visible();
      this.overlay.hidden = !visible;
      this.root.classList.toggle('checkbox-link-mode', visible);
      if (!visible) {
        this.cancelGesture();
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        return;
      }
      this.draw();
      // A port follows its checkbox throughout free-form moves and live resizing.
      if (this.frame === null) {
        const tick = () => {
          if (!this.visible()) { this.frame = null; return; }
          this.draw(); this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
      }
    }
    refresh() {
      this.sheet.querySelectorAll('input.week-check[type=checkbox]').forEach((input,index) => {
        if (!input.dataset.checkId) input.dataset.checkId = `week-${index}`;
      });
      this.sheet.querySelectorAll('input.daily-check[type=checkbox]').forEach((input,index) => {
        if (!input.dataset.checkId) input.dataset.checkId = `daily-${index}`;
      });
      for (const id of ['bir-gun','diger-gun']) {
        const input = this.sheet.querySelector(`#${id}`);
        if (input) input.dataset.checkId = id;
      }
      const next = new Map();
      this.sheet.querySelectorAll('input[type=checkbox][data-check-id]').forEach(input => {
        if (input.dataset.checkId && !next.has(input.dataset.checkId)) next.set(input.dataset.checkId,input);
      });
      this.nodes = next;
      for (const [id,port] of this.ports) {
        if (!next.has(id)) { port.remove(); this.ports.delete(id); this.known.delete(id); }
      }
      for (const [id,input] of next) {
        if (!this.known.has(id)) this.known.set(id,input.checked);
        if (this.ports.has(id)) continue;
        const port = document.createElement('button');
        port.type = 'button'; port.className = 'checkbox-link-port';
        port.dataset.linkPort = id;
        this.portLayer.append(port); this.ports.set(id,port);
      }
      const length = this.links.length;
      this.links = this.links.filter(link => next.has(link.source) && next.has(link.target));
      if (this.selected && !next.has(this.selected)) this.cancelGesture();
      this.draw();
      if (length !== this.links.length) this.changed();
    }
    label(id) {
      const input = this.nodes.get(id);
      if (!input) return id;
      const label = input.closest('label');
      const row = input.closest('.studio-checklist-row,.studio-check-row,[data-studio-row],.checklist-row');
      const text = input.getAttribute('aria-label') || input.dataset.checkLabel || row?.textContent || label?.textContent || label?.previousElementSibling?.textContent || input.previousElementSibling?.textContent || `Tik ${[...this.nodes.keys()].indexOf(id) + 1}`;
      return text.replace(/\s+/g,' ').trim().slice(0,100) || id;
    }
    endpoints() { return [...this.nodes.keys()].map(id => ({id,label:this.label(id)})); }
    list() { return this.links.map(link => ({...link,sourceLabel:this.label(link.source),targetLabel:this.label(link.target)})); }
    serialize() { return this.links.map(link => ({...link})); }
    validate(source,target,action) {
      if (!this.nodes.has(source) || !this.nodes.has(target)) throw new Error('Bağlanacak iki tik seç.');
      if (source === target) throw new Error('Bir tiki kendisine bağlayamazsın.');
      if (!ACTIONS.has(action)) throw new Error('Geçerli bir bağlantı işlemi seç.');
      const visited = new Set(); const queue = [target];
      while (queue.length) {
        const current = queue.shift();
        if (current === source) throw new Error('Bu bağlantı bir döngü oluşturuyor. Ters yöndeki bağlantıyı önce kaldır.');
        if (visited.has(current)) continue;
        visited.add(current);
        this.links.filter(link => link.source === current).forEach(link => queue.push(link.target));
      }
    }
    connect(source,target,action = this.action) {
      if(this.editingId){const id=this.editingId,previous=this.links;this.editingId=null;this.links=this.links.filter(link=>link.id!==id);try{const updated=this.connect(source,target,action);this.changed();return updated;}catch(error){this.links=previous;this.editingId=id;throw error;}}
      if(action==='requiresAll'){if(!this.workflow)throw Error('Kural sistemi hazırlanıyor.');return this.workflow.addGate(source,target);}
      this.validate(source,target,action);
      const existing = this.links.find(link => link.source === source && link.target === target);
      if (existing) {
        if (existing.action !== action) { existing.action = action; this.changed(); this.draw(); }
        return {...existing};
      }
      const link = {id:this.newId(),source,target,action};
      this.links.push(link);try{this.workflow?.validateGraph();}catch(error){this.links.pop();throw error;} this.changed(); this.draw();
      this.announce(`${this.label(source)} → ${this.label(target)}: ${ACTION_LABELS[action]}`);
      return {...link};
    }
    remove(id) {
      const length = this.links.length;
      this.links = this.links.filter(link => link.id !== id);
      if (length !== this.links.length) { this.changed(); this.draw(); return true; }
      return false;
    }
    changed() {
      this.onChange();
      this.root.dispatchEvent(new CustomEvent('hafizlik:design-change',{bubbles:true,detail:{kind:'checkbox-links'}}));
    }
    sync() {
      if (this.processing) return;
      const changes = [...this.nodes].filter(([id,input]) => this.known.get(id) !== input.checked).map(([id]) => id);
      if (changes.length) this.propagate(changes);
    }
    propagate(initial) {
      if (this.processing) return;
      this.processing = true;
      const visited = new Set(); const queue = [...initial];
      try {
        while (queue.length) {
          const source = queue.shift(); const input = this.nodes.get(source);
          if (!input || visited.has(source)) continue;
          visited.add(source); this.known.set(source,input.checked);
          for (const link of this.links.filter(link => link.source === source)) {
            const target = this.nodes.get(link.target);
            if (!target || target.disabled || visited.has(link.target)) continue;
            if (link.action !== 'mirror' && !input.checked) continue;
            const checked = link.action === 'mirror' ? input.checked : link.action === 'check';
            if (checked&&this.workflow&&!this.workflow.allowed(link.target)) continue;
            if (target.checked === checked) continue;
            target.checked = checked;
            target.dispatchEvent(new Event('input',{bubbles:true}));
            target.dispatchEvent(new Event('change',{bubbles:true}));
            // Existing daily/prerequisite rules may change additional checkboxes.
            queue.push(link.target);
          }
          for (const [id,node] of this.nodes) {
            if (!visited.has(id) && this.known.get(id) !== node.checked && !queue.includes(id)) queue.push(id);
          }
        }
      } finally {
        this.nodes.forEach((input,id) => this.known.set(id,input.checked));
        this.processing = false;
      }
      this.onChange();
    }
    point(id) {
      const input = this.nodes.get(id);
      if (!input?.isConnected) return null;
      const rect = input.getBoundingClientRect(); const sheet = this.sheet.getBoundingClientRect();
      const z=window.hafizlikBoard?.zoom||1;return {x:(rect.right-sheet.left)/z-this.sheet.clientLeft+10,y:(rect.top+rect.height/2-sheet.top)/z-this.sheet.clientTop};
    }
    curve(from,to) {
      const bend = Math.max(42,Math.min(180,Math.abs(to.x-from.x)*.45+Math.abs(to.y-from.y)*.15));
      return `M ${from.x} ${from.y} C ${from.x+bend} ${from.y}, ${to.x+bend} ${to.y}, ${to.x} ${to.y}`;
    }
    draw() {
      if (!this.visible()) return;
      const points = new Map();
      for (const [id,port] of this.ports) {
        const point = this.point(id); if (!point) continue;
        points.set(id,point);
        port.style.transform = `translate(${point.x}px,${point.y}px)`;
        port.classList.toggle('is-selected',this.selected === id || this.gesture?.source === id);
        port.classList.toggle('is-linked',this.links.some(link => link.source === id || link.target === id));
        port.setAttribute('aria-label',`${this.label(id)}: bağlantı noktası`);
        port.title = `${this.label(id)} · bağlantı için sürükle veya iki noktayı seç`;
        port.setAttribute('aria-pressed',String(this.selected === id));
      }
      const width = this.root.classList.contains('infinite-board')?1:(this.sheet.scrollWidth || this.sheet.clientWidth || 1800);
      const height = this.root.classList.contains('infinite-board')?1:(this.sheet.scrollHeight || this.sheet.clientHeight || 1800);
      this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      this.svg.setAttribute('width',String(width)); this.svg.setAttribute('height',String(height));
      const fragment = document.createDocumentFragment();
      for (const link of [...this.links,...(this.workflow?.selectedRule?this.workflow.edges(this.workflow.selectedRule).map(edge=>({...edge,id:this.workflow.selectedRule,workflow:true})):[])]) {
        const from = points.get(link.source); const to = points.get(link.target);
        if (!from || !to) continue;
        const path = document.createElementNS(NS,'path');
        path.setAttribute('d',this.curve(from,to));
        path.setAttribute('class',`checkbox-link-cable link-action-${link.action}`);
        path.dataset.linkId = link.id;if(link.workflow)path.dataset.ruleId=link.id;
        const title = document.createElementNS(NS,'title');
        title.textContent = `${this.label(link.source)} → ${this.label(link.target)} · ${ACTION_LABELS[link.action]}`;
        path.append(title); fragment.append(path);
        const end = document.createElementNS(NS,'circle');
        end.setAttribute('cx',String(to.x)); end.setAttribute('cy',String(to.y)); end.setAttribute('r','3');
        end.setAttribute('class',`checkbox-link-end link-action-${link.action}`); fragment.append(end);
      }
      if(this.workflow?.selectedRule){const ids=new Set(this.workflow.edges(this.workflow.selectedRule).flatMap(edge=>[edge.source,edge.target]));for(const [id,port]of this.ports)port.classList.toggle('is-rule-highlight',ids.has(id));}else for(const port of this.ports.values())port.classList.remove('is-rule-highlight');
      const source = this.gesture?.source || this.selected;
      if (source && points.has(source)) {
        const from = points.get(source);
        const path = document.createElementNS(NS,'path');
        path.setAttribute('d',this.curve(from,this.gesture?.point || {x:from.x+42,y:from.y}));
        path.setAttribute('class',`checkbox-link-cable is-preview link-action-${this.action}`); fragment.append(path);
      }
      this.svg.replaceChildren(fragment);
    }
    pointerDown(event) {
      const port = event.target.closest?.('.checkbox-link-port');
      if (!port || !this.visible() || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      this.editingId=null;this.gesture = {source:port.dataset.linkPort,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,point:this.point(port.dataset.linkPort)};
      this.draw();
    }
    pointerMove(event) {
      if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const sheet = this.sheet.getBoundingClientRect();
      this.gesture.point = {x:(event.clientX-sheet.left)/(window.hafizlikBoard?.zoom||1)-this.sheet.clientLeft,y:(event.clientY-sheet.top)/(window.hafizlikBoard?.zoom||1)-this.sheet.clientTop};
      this.gesture.moved ||= Math.hypot(event.clientX-this.gesture.startX,event.clientY-this.gesture.startY) > 4;
      this.draw();
    }
    pointerUp(event) {
      if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const gesture = this.gesture;
      const target = document.elementFromPoint?.(event.clientX,event.clientY)?.closest('.checkbox-link-port') || event.target.closest?.('.checkbox-link-port');
      this.gesture = null;
      if (target && target.dataset.linkPort !== gesture.source) this.attempt(gesture.source,target.dataset.linkPort);
      else if (!gesture.moved) this.choosePort(gesture.source);
      else this.selected = null;
      this.draw();
    }
    choosePort(id) {
      if (this.selected && this.selected !== id) this.attempt(this.selected,id);
      else { this.selected = this.selected === id ? null : id; this.announce(this.selected ? 'Şimdi hedef tiki seç veya bağlantı noktasına sürükle.' : 'Bağlantı seçimi iptal edildi.'); }
      this.draw();
    }
    attempt(source,target) {
      try { this.connect(source,target,this.action); this.selected = null; }
      catch (error) {
        this.announce(error.message);
        this.root.dispatchEvent(new CustomEvent('hafizlik:links-error',{bubbles:true,detail:{message:error.message}}));
      }
    }
    announce(message) { this.live.textContent = message; }
    cancelGesture() { this.gesture = null; this.selected = null; this.draw(); }
    destroy() {
      this.controller.abort(); this.editObserver.disconnect(); this.nodeObserver.disconnect();
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      if (this.refreshFrame !== null) cancelAnimationFrame(this.refreshFrame);
      this.overlay.remove(); this.root.classList.remove('checkbox-link-mode');
    }
  }
  window.HafizlikCheckboxLinks = HafizlikCheckboxLinks;
})();
