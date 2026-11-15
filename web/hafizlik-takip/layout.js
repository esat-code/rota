(() => {
  'use strict';
  const keys = ['weeks','surahs','juz-tur','time-limit','note','routine'];
  const minWidths = [360,360,160,160,140,320];
  const labels = ['Haftalık cüzler','Sureler','Cüz ve tur','Süre notu','Not','Günlük tekrarlar'];
  class HafizlikBoard {
    constructor(root, tables, saved, onChange) {
      this.root = root;
      this.sheet = root.querySelector('.sheet');
      this.viewport = root.querySelector('.workspace-viewport');
      this.tables = [];
      this.meta = new Map();
      this.savedItems = saved?.items || {};
      this.selectedId = null;
      this.selectionIds = []; this.zoom = 1; this.savedView = saved?.view || {}; this.panActive = false;
      this.onChange = onChange;
      this.editableAreas = [...root.querySelectorAll('[contenteditable="true"]')];
      this.editing = saved?.editing !== false;
      const hasBoard = [1,2].includes(saved?.version) && saved.items && typeof saved.items === 'object';
      // Use one wide reference for legacy relative offsets; never recalculate it on window resize.
      this.width = hasBoard && Number.isFinite(saved.width) ? Math.max(1720,saved.width) : Math.max(1720,Math.min(4096,screen.availWidth || 0));
      this.sheet.style.width = `${this.width}px`;
      const base = this.sheet.getBoundingClientRect();
      const measured = tables.map(table => {
        const rect = table.getBoundingClientRect();
        return {x:rect.left-base.left-this.sheet.clientLeft,y:rect.top-base.top-this.sheet.clientTop,width:rect.width,height:rect.height};
      });
      // An oversized legacy right-hand box must start after its neighbours once on migration.
      // There are no collision restrictions while dragging: the workspace remains free-form.
      if (!hasBoard && measured[2]) {
        for (const index of [0,1,5]) {
          const other = measured[index]; const right = measured[2];
          if (other && right.y < other.y+other.height && right.y+right.height > other.y && right.x < other.x+other.width && right.x+right.width > other.x) right.x = other.x+other.width+24;
        }
      }
      this.sheet.classList.add('free-layout');
      tables.forEach((table,index) => {
        const item = hasBoard ? saved.items[keys[index]] : null;
        const valid = item && ['x','y','width','height'].every(key=>Number.isFinite(item[key]));
        const geometry = valid ? item : measured[index];
        this.registerItem(table,keys[index],geometry,{minWidth:minWidths[index],label:labels[index]});
      });
      const toolbar = root.querySelector('.app-toolbar');
      const toolbarSize = () => {
        root.style.setProperty('--toolbar-height',`${toolbar.getBoundingClientRect().height}px`);
      };
      toolbarSize();
      new ResizeObserver(toolbarSize).observe(toolbar);
      this.sizeObserver = new ResizeObserver(() => this.grow());
      this.tables.forEach(table=>this.sizeObserver.observe(table));
      addEventListener('resize',() => { toolbarSize(); this.grow(); });
      const editButton = root.querySelector('#edit-mode-toggle');
      editButton.addEventListener('click', () => this.setEditing(!this.editing));
      this.renderEditing();
      this.initViewport(); this.grow();
    }
    renderEditing() {
      this.root.classList.toggle('editing-mode',this.editing);
      this.editableAreas.forEach(area => { area.contentEditable = this.editing ? 'true' : 'false'; });
      this.root.querySelectorAll('.board-drag-handle,.board-resize-handle').forEach(handle => { const locked=handle.closest('[data-board-item]')?.dataset.layoutLocked==='true'; handle.hidden = !this.editing || locked; handle.disabled = !this.editing || locked; });
      const button = this.root.querySelector('#edit-mode-toggle');
      button.setAttribute('aria-checked',String(this.editing));
      button.title = this.editing ? 'Düzenleme açık · kapat' : 'Düzenleme kapalı · aç';
      this.root.dispatchEvent(new CustomEvent('hafizlik:editing',{detail:this.editing}));
    }
    setEditing(editing) {
      if (!editing && this.editableAreas.some(area=>area.contains(document.activeElement))) document.activeElement.blur();
      this.editing = editing;
      this.renderEditing();
      this.onChange();
    }
    place(table,x,y) {
      table.style.left = `${Number.isFinite(x)?x:0}px`;
      table.style.top = `${Number.isFinite(y)?y:0}px`;
    }
    registerItem(table,id,geometry,options={}) {
      if (!this.tables.includes(table)) this.tables.push(table);
      this.meta.set(id,{minWidth:options.minWidth||120,minHeight:options.minHeight||54,label:options.label||'Öge'});
      table.dataset.boardItem = id;
      table.style.transform = ''; delete table.dataset.offset;
      table.style.height = 'auto';
      table.style.width = `${Math.max(this.meta.get(id).minWidth,geometry.width||240)}px`;
      table.style.minHeight = `${Math.max(this.meta.get(id).minHeight,geometry.height||100)}px`;
      this.place(table,geometry.x??14,geometry.y??24);
      this.addHandles(table,id); this.bind(table,id);
      this.sizeObserver?.observe(table);
      table.querySelectorAll('[data-design-editable]').forEach(area=>{if(!this.editableAreas.includes(area))this.editableAreas.push(area);});
      return table;
    }
    removeItem(id) {
      const table = this.tables.find(item=>item.dataset.boardItem===id); if(!table)return;
      this.sizeObserver?.unobserve?.(table);
      this.editableAreas = this.editableAreas.filter(area=>!table.contains(area));
      this.tables = this.tables.filter(item=>item!==table); this.meta.delete(id); table.remove();
      if(this.selectedId===id)this.selectItem(null);
      this.grow();
    }
    selectItem(id,textElement=null,options={}) {
      this.selectedId = id;
      if(!options.preserve)this.selectionIds=id?[id]:[];
      this.tables.forEach(table=>table.classList.toggle('is-selected',this.selectionIds.includes(table.dataset.boardItem)));
      this.root.dispatchEvent(new CustomEvent('hafizlik:board-selection',{detail:{id,textElement,...options}}));
    }
    geometry(id) {
      const el=this.tables.find(item=>item.dataset.boardItem===id);if(!el)return null;
      const rect=el.getBoundingClientRect(),z=this.zoom||1;
      return {x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0,width:el.offsetWidth||rect.width/z||parseFloat(el.style.width)||0,height:el.offsetHeight||rect.height/z||parseFloat(el.style.minHeight)||0};
    }
    clientToWorld(x,y) {const r=this.viewport.getBoundingClientRect(),z=this.zoom||1;return {x:(this.camera?.x||0)+(x-r.left)/z,y:(this.camera?.y||0)+(y-r.top)/z};}
    worldToClient(x,y) {const r=this.viewport.getBoundingClientRect(),z=this.zoom||1;return {x:r.left+(x-this.camera.x)*z,y:r.top+(y-this.camera.y)*z};}
    visibleWorld() {const z=this.zoom||1;return {x:this.camera.x,y:this.camera.y,width:(this.viewport.clientWidth||innerWidth)/z,height:(this.viewport.clientHeight||innerHeight)/z};}
    setCamera(x,y) {if(Number.isFinite(x))this.camera.x=x;if(Number.isFinite(y))this.camera.y=y;this.applyZoom();}
    initViewport() {
      this.surface=document.createElement('div');this.surface.className='board-zoom-surface';
      this.sheet.before(this.surface);this.surface.append(this.sheet);
      this.zoom=Math.max(.01,Math.min(4,Number(this.savedView.zoom)||1));
      const v=this.savedView;
      // Old scroll positions become the same view in world coordinates. Items never move.
      this.camera={x:Number.isFinite(v.cameraX)?v.cameraX:(Number(v.scrollX)||0)/this.zoom,y:Number.isFinite(v.cameraY)?v.cameraY:(Number(v.scrollY)||0)/this.zoom};
      this.root.classList.add('infinite-board');this.viewport.setAttribute('aria-label','Sınırsız çalışma tahtası');
      this.applyZoom();this.navigation=new HafizlikWorkspaceNavigation(this);
    }
    applyZoom() {
      const camera=this.camera||{x:0,y:0},z=this.zoom;
      this.sheet.style.transform='translate('+(-camera.x*z)+'px,'+(-camera.y*z)+'px) scale('+z+')';this.sheet.style.transformOrigin='0 0';this.root.style.setProperty('--board-zoom',z);
      this.viewport.style.backgroundSize=(52*z)+'px '+(34*z)+'px';
      this.viewport.style.backgroundPosition=(-camera.x*z%(52*z))+'px '+(-camera.y*z%(34*z))+'px';
      this.root.dispatchEvent(new Event('hafizlik:view-change'));this.navigation?.refresh();
    }
    setGeometry(id,patch) {
      const table=this.tables.find(item=>item.dataset.boardItem===id);if(!table)return;
      const meta=this.meta.get(id);
      this.place(table,Number.isFinite(patch.x)?patch.x:parseFloat(table.style.left),Number.isFinite(patch.y)?patch.y:parseFloat(table.style.top));
      if(Number.isFinite(patch.width))table.style.width=`${Math.max(meta.minWidth,patch.width)}px`;
      if(Number.isFinite(patch.height))table.style.minHeight=`${Math.max(meta.minHeight,patch.height)}px`;
      this.grow();
    }
    addHandles(table,id) {
      table.querySelectorAll(':scope > .board-drag-handle,:scope > .board-resize-handle').forEach(handle=>handle.remove());
      const label=this.meta.get(id).label;
      for (const [className,text,title,direction] of [['board-drag-handle','⠿',`${label}: taşı`,''],...['se','e','s','n','w','ne','nw','sw'].map(dir=>['board-resize-handle','',`${label}: boyutlandır (${dir})`,dir])]) {
        const handle = document.createElement('button');
        handle.type = 'button'; handle.className = className; handle.textContent = text;
        handle.title = title; handle.setAttribute('aria-label',title);
        if(direction)handle.dataset.resize=direction;
        handle.hidden=!this.editing;handle.disabled=!this.editing;
        table.append(handle);
      }
    }
    bind(table,id) {
      let gesture = null;
      table.addEventListener('pointerdown',event => {
        if (!this.editing || this.panActive || event.button !== 0) return;
        if(event.target.closest('[data-link-port],.check-link-port'))return;
        this.selectItem(id,event.target.closest('[contenteditable]'),{additive:event.shiftKey,preserve:true});
        if(table.dataset.layoutLocked==='true')return;
        const resize = event.target.closest('.board-resize-handle');
        const drag = event.target.closest('.board-drag-handle');
        if (!resize && !drag && event.target.closest('input,button,label,[contenteditable="true"]')) return;
        if(event.shiftKey&&!resize)return;
        if(document.activeElement?.closest?.('input,textarea,[contenteditable="true"]'))document.activeElement.blur();
        const rect = this.geometry(id),ids=this.selectionIds.includes(id)?this.selectionIds:[id];
        gesture = {id:event.pointerId,resize:resize?.dataset.resize||'',x:event.clientX,y:event.clientY,world:this.clientToWorld(event.clientX,event.clientY),left:rect.x,top:rect.y,width:rect.width,height:rect.height,origins:ids.filter(key=>this.tables.find(t=>t.dataset.boardItem===key)?.dataset.layoutLocked!=='true').map(key=>({id:key,...this.geometry(key)}))};
        table.classList.add('is-moving');
        table.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      table.addEventListener('pointermove',event => {
        if (!this.editing || !gesture || event.pointerId !== gesture.id) return;
        const point=this.clientToWorld(event.clientX,event.clientY);
        let dx=point.x-gesture.world.x,dy=point.y-gesture.world.y;
        if (gesture.resize) {
          const min=this.meta.get(id),dir=gesture.resize;
          let left=gesture.left,top=gesture.top,width=gesture.width,height=gesture.height;
          if(dir.includes('e'))width=Math.max(min.minWidth,gesture.width+dx);
          if(dir.includes('s'))height=Math.max(min.minHeight,gesture.height+dy);
          if(dir.includes('w')){width=Math.max(min.minWidth,gesture.width-dx);left=gesture.left+gesture.width-width;}
          if(dir.includes('n')){height=Math.max(min.minHeight,gesture.height-dy);top=gesture.top+gesture.height-height;}
          if(event.shiftKey&&dir.length===2){const ratio=gesture.width/gesture.height;if(Math.abs(dx)>Math.abs(dy)*ratio)height=Math.max(min.minHeight,width/ratio);else width=Math.max(min.minWidth,height*ratio);if(dir.includes('w'))left=gesture.left+gesture.width-width;if(dir.includes('n'))top=gesture.top+gesture.height-height;}
          this.place(table,left,top);table.style.width=`${width}px`;table.style.minHeight=`${height}px`;this.navigation?.measure(width,height,event.clientX,event.clientY);
        } else {for(const origin of gesture.origins){const target=this.tables.find(t=>t.dataset.boardItem===origin.id);if(target)this.place(target,origin.x+dx,origin.y+dy);}}
        this.grow();
      });
      const stop = (event) => {
        if (!gesture) return;
        if(event?.type==='pointercancel'){for(const origin of gesture.origins)this.setGeometry(origin.id,origin);}
        gesture = null; table.classList.remove('is-moving'); this.navigation?.measure(); this.grow(); this.onChange();this.root.dispatchEvent(new Event('hafizlik:design-commit'));
      };
      table.addEventListener('pointerup',stop);
      table.addEventListener('pointercancel',stop);
      table.addEventListener('lostpointercapture',stop);
      table.querySelectorAll('.board-drag-handle,.board-resize-handle').forEach(handle => handle.addEventListener('keydown',event => {
        if (!this.editing || table.dataset.layoutLocked==='true') return;
        const deltas = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
        const delta = deltas[event.key]; if (!delta) return;
        event.preventDefault(); const step = event.shiftKey ? 10 : 1;
        if (handle.classList.contains('board-resize-handle')) {
          const rect = this.geometry(id);
          table.style.width = `${Math.max(this.meta.get(id).minWidth,rect.width+delta[0]*step)}px`;
          table.style.minHeight = `${Math.max(this.meta.get(id).minHeight,rect.height+delta[1]*step)}px`;
        } else this.place(table,parseFloat(table.style.left)+delta[0]*step,parseFloat(table.style.top)+delta[1]*step);
        this.grow(); this.onChange();
      }));
    }
    grow() {
      this.width = Math.max(this.width,...this.tables.map(table=>parseFloat(table.style.left)+this.geometry(table.dataset.boardItem).width+32));
      // A one-pixel origin carries world objects; no enormous DOM page or page edge.
      this.sheet.style.width = '1px';this.sheet.style.minHeight = '1px';
      this.applyZoom();this.root.dispatchEvent(new CustomEvent('hafizlik:board-change'));
    }
    serialize() {
      return {version:2,width:this.width,editing:this.editing,view:{zoom:this.zoom,cameraX:this.camera.x,cameraY:this.camera.y},items:Object.fromEntries(this.tables.map(table=>[table.dataset.boardItem,this.geometry(table.dataset.boardItem)]))};
    }
  }
  window.HafizlikBoard = HafizlikBoard;
})();
