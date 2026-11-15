(() => {
  'use strict';
  const fonts=['Georgia','Arial','Verdana','Tahoma','Times New Roman','-apple-system','sans-serif','serif','-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif','Georgia, "Times New Roman", serif','Arial, sans-serif','"Trebuchet MS", sans-serif','"Courier New", monospace'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const uid=()=>crypto.randomUUID();
  const color=value=>typeof value==='string'&&(/^#[0-9a-f]{6}$/i.test(value)||value==='transparent')?value:null;
  const toHex=value=>{if(color(value))return value;const rgb=String(value).match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);return rgb?'#'+rgb.slice(1,4).map(part=>Math.min(255,Number(part)).toString(16).padStart(2,'0')).join(''):null;};
  class HafizlikDesigner {
    constructor(root,board,saved,onChange) {
      this.root=root;this.board=board;this.sheet=board.sheet;this.onChange=onChange;
      this.nodes=[];this.legacy=saved?.legacy&&typeof saved.legacy==='object'?clone(saved.legacy):{};
      this.selectedId=null;this.selectionIds=[];this.activeText=null;this.restoring=true;this.layout=clone(saved?.layout||{});this.historyPast=[];this.historyFuture=[];
      if(Array.isArray(saved?.nodes)) {
        saved.nodes.slice(0,150).forEach(node=>{
          if(node&&typeof node.id==='string'&&['note','text','checklist'].includes(node.type)&&!this.nodes.some(item=>item.id===node.id)&&!board.tables.some(item=>item.dataset.boardItem===node.id)) {
            const clean=this.cleanNode(node);this.nodes.push(clean);this.mount(clean,board.savedItems[clean.id]||node.geometry);
          }
        });
      }
      Object.entries(this.legacy).forEach(([id,data])=>{
        const el=this.element(id);if(!el)return;
        this.applyStyle(el,this.cleanStyle(data.style||{}));
        const areas=[...el.querySelectorAll('[contenteditable]')];
        Object.entries(data.textStyles||{}).forEach(([index,style])=>{if(areas[Number(index)])this.applyStyle(areas[Number(index)],this.cleanStyle(style));});
        if(Number.isFinite(data.z))el.style.zIndex=String(data.z);
      });
      this.links=new window.HafizlikCheckboxLinks(root,saved?.links||[],()=>this.changed());
      this.root.addEventListener('hafizlik:board-selection',event=>{
        this.onSelection(event.detail);
      });
      this.bindSelection();
      this.root.addEventListener('hafizlik:editing',()=>{if(!this.board.editing)this.links.setMode(false);this.panel?.refresh();});
      this.panel=new window.HafizlikDesignPanel(root,this);
      this.applyLayout();this.board.renderEditing();this.restoring=false;this.panel.refresh();
      this.root.addEventListener('hafizlik:design-commit',()=>this.recordHistory());
      this.root.addEventListener('input',event=>{if(event.target.closest('[contenteditable]'))this.scheduleHistory();});
    }
    cleanStyle(style={}) {
      const clean={};
      if(color(style.background))clean.background=style.background;
      if(color(style.color))clean.color=style.color;
      if(Number.isFinite(Number(style.fontSize)))clean.fontSize=Math.max(8,Math.min(160,Number(style.fontSize)));
      if(fonts.includes(style.fontFamily))clean.fontFamily=style.fontFamily;
      if(['normal','bold','400','500','600','700',400,500,600,700].includes(style.fontWeight))clean.fontWeight=String(style.fontWeight);
      if(['normal','italic'].includes(style.fontStyle))clean.fontStyle=style.fontStyle;
      if(['left','center','right'].includes(style.textAlign))clean.textAlign=style.textAlign;
      if(Number.isFinite(Number(style.borderRadius)))clean.borderRadius=Math.max(0,Math.min(40,Number(style.borderRadius)));
      return clean;
    }
    cleanNode(source) {
      return {id:source.id,type:source.type,variant:String(source.variant||'plain'),text:String(source.text||''),title:String(source.title||''),rows:Array.isArray(source.rows)?source.rows.slice(0,40).map(row=>({id:typeof row.id==='string'?row.id:uid(),text:String(row.text||''),checked:!!row.checked})):[],style:this.cleanStyle(source.style),z:Number.isFinite(source.z)?source.z:1};
    }
    element(id) {return this.board.tables.find(table=>table.dataset.boardItem===id)||null;}
    geometry(id) {
      const el=this.element(id);if(!el)return null;
      return this.board.geometry(id);
    }
    applyStyle(el,style) {
      Object.entries(style).forEach(([key,value])=>{el.style[key]=['fontSize','borderRadius'].includes(key)?`${value}px`:value;});
    }
    position(width=280,height=160) {
      const view=this.board.visibleWorld();
      let x=view.x+44/(this.board.zoom||1),y=view.y+60/(this.board.zoom||1);
      // Find room for a newly inserted item without changing anything already placed.
      for(let attempt=0;attempt<80;attempt++) {
        const collision=this.board.tables.find(el=>{const g=this.geometry(el.dataset.boardItem);return x<g.x+g.width+18&&x+width+18>g.x&&y<g.y+g.height+18&&y+height+18>g.y;});
        if(!collision)break;
        const g=this.geometry(collision.dataset.boardItem);y=g.y+g.height+24;
      }
      return {x,y,width,height};
    }
    addNode(type,variant='plain') {
      if(!this.board.editing)return null;
      if(this.nodes.length>=150){this.message('Bu çalışma alanında 150 öge var. Kullanmadığın bir ögeyi silebilirsin.');return null;}
      if(!['note','text','checklist'].includes(type))return null;
      const node=this.cleanNode({id:`design-${uid()}`,type,variant,title:type==='checklist'?'Kontrol listesi':'',text:type==='text'?(variant==='heading'?'Başlık':'Yazını buraya ekle'):'',rows:type==='checklist'?Array.from({length:variant==='compact'?3:5},(_,i)=>({id:uid(),text:`${i+1}. görev`,checked:false})):[],style:type==='text'?{fontSize:variant==='heading'?32:20,fontFamily:'Georgia',fontWeight:variant==='heading'?'700':'400'}:{}});
      this.nodes.push(node);
      const size=type==='text'?{width:320,height:72}:type==='checklist'?{width:340,height:280}:{width:300,height:200};
      const geometry=this.position(size.width,size.height);
      this.mount(node,geometry);this.board.renderEditing();this.links.refresh();this.select(node.id);this.changed();
      this.reveal(node.id);return node;
    }
    mount(node,geometry) {
      const el=document.createElement('div');el.className=`designer-item designer-${node.type} variant-${node.variant}`;el.dataset.designId=node.id;
      el.style.zIndex=String(node.z||1);
      if(node.type==='note') {el.setAttribute('aria-label','Not zemini');}
      if(node.type==='text') {
        const text=document.createElement('div');text.className='designer-text-content';text.dataset.designEditable='true';text.textContent=node.text;text.spellcheck=true;
        text.addEventListener('input',()=>{node.text=text.innerText??text.textContent;this.changed(false);});el.append(text);
      }
      if(node.type==='checklist') {
        const title=document.createElement('div');title.className='designer-list-title';title.dataset.designEditable='true';title.textContent=node.title;
        title.addEventListener('input',()=>{node.title=title.innerText??title.textContent;this.changed(false);});el.append(title);
        const rows=document.createElement('div');rows.className='designer-list-rows';el.append(rows);
        node.rows.forEach((row,index)=>{
          const line=document.createElement('div');line.className='designer-list-row';
          if(node.variant==='numbered'){const number=document.createElement('span');number.className='designer-row-number';number.textContent=String(index+1).padStart(2,'0');line.append(number);}
          const label=document.createElement('span');label.dataset.designEditable='true';label.className='designer-row-text';label.textContent=row.text;
          label.addEventListener('input',()=>{row.text=label.innerText??label.textContent;check.setAttribute('aria-label',row.text||`Görev ${index+1}`);this.links?.refresh();this.changed(false);});
          const check=document.createElement('input');check.type='checkbox';check.className='designer-check';check.dataset.checkId=`${node.id}:${row.id}`;check.checked=row.checked;check.setAttribute('aria-label',row.text||`Görev ${index+1}`);
          check.addEventListener('change',()=>{row.checked=check.checked;this.changed(false);});line.append(label,check);rows.append(line);
        });
      }
      this.applyStyle(el,node.style);this.sheet.append(el);
      const fallback={x:40,y:500,width:node.type==='text'?320:300,height:node.type==='text'?72:200};
      const valid=geometry&&['x','y','width','height'].every(key=>Number.isFinite(geometry[key]));
      this.board.registerItem(el,node.id,valid?geometry:fallback,{minWidth:node.type==='text'?70:140,minHeight:node.type==='text'?28:70,label:node.type==='text'?'Yazı':node.type==='note'?'Not zemini':'Tikli tablo'});
      this.board.grow();return el;
    }
    select(id) {this.selectMany(id?[id]:[]);}
    reveal(id) {
      const g=this.geometry(id);if(!g)return;
      const view=this.board.visibleWorld();
      if(g.x>=view.x&&g.y>=view.y&&g.x+g.width<=view.x+view.width&&g.y+g.height<=view.y+view.height)return;
      this.board.setCamera(g.x-40/(this.board.zoom||1),g.y-70/(this.board.zoom||1));this.board.navigation.savedSoon();
    }
    getSelected() {
      const node=this.nodes.find(item=>item.id===this.selectedId);
      if(node)return {...clone(node),geometry:this.geometry(node.id)};
      const el=this.element(this.selectedId);if(!el)return null;
      const text=this.activeText&&el.contains(this.activeText)?this.activeText:el.querySelector('[contenteditable]');
      const style=this.legacy[this.selectedId]?.style||{};
      const textIndex=text?[...el.querySelectorAll('[contenteditable]')].indexOf(text):-1;
      const stored=this.legacy[this.selectedId]?.textStyles?.[textIndex]||{};
      return {id:this.selectedId,type:'legacy',title:this.board.meta.get(this.selectedId)?.label||'Hazır plan',text:text?.innerText??text?.textContent??'',style:{...style,...(text?this.readTextStyle(text):{}),...stored},geometry:this.geometry(this.selectedId)};
    }
    readTextStyle(el) {
      const computed=getComputedStyle(el);
      return {fontSize:parseFloat(el.style.fontSize||computed.fontSize)||15,fontWeight:el.style.fontWeight||computed.fontWeight||'400',fontFamily:el.style.fontFamily||'Georgia',fontStyle:el.style.fontStyle||'normal',textAlign:el.style.textAlign||'left',color:toHex(el.style.color||computed.color)||'#142b46'};
    }
    updateSelected(patch) {
      if(!this.board.editing||this.isLocked(this.selectedId))return;
      const node=this.nodes.find(item=>item.id===this.selectedId),el=this.element(this.selectedId);if(!el)return;
      if(patch.geometry)this.board.setGeometry(this.selectedId,patch.geometry);
      if(node) {
        if(typeof patch.text==='string'&&node.type==='text'){node.text=patch.text;el.querySelector('.designer-text-content').textContent=patch.text;}
        if(typeof patch.title==='string'&&node.type==='checklist'){node.title=patch.title;el.querySelector('.designer-list-title').textContent=patch.title;}
        if(patch.style){Object.assign(node.style,this.cleanStyle(patch.style));this.applyStyle(el,node.style);}
        if(Array.isArray(patch.rows)&&node.type==='checklist') {
          const geometry=this.geometry(node.id);
          const old=node.rows;node.rows=patch.rows.slice(0,40).map((row,index)=>({id:typeof row.id==='string'?row.id:old[index]?.id||uid(),text:String(row.text||''),checked:typeof row.checked==='boolean'?row.checked:old[index]?.checked||false}));
          this.board.removeItem(node.id);this.mount(node,geometry);this.board.renderEditing();this.links.refresh();this.select(node.id);
        }
      } else {
        this.legacy[this.selectedId]||={style:{},textStyles:{}};
        const data=this.legacy[this.selectedId];
        const text=this.activeText&&el.contains(this.activeText)?this.activeText:el.querySelector('[contenteditable]');
        if(typeof patch.text==='string'&&text)text.textContent=patch.text;
        if(patch.style){
          const style=this.cleanStyle(patch.style),block={};
          ['background','borderRadius'].forEach(key=>{if(key in style){block[key]=style[key];delete style[key];}});
          Object.assign(data.style,block);this.applyStyle(el,block);
          if(text){const index=[...el.querySelectorAll('[contenteditable]')].indexOf(text);data.textStyles[index]={...data.textStyles[index],...style};this.applyStyle(text,style);}
        }
      }
      this.board.grow();this.links.refresh();this.changed();
    }
    duplicateSelected() {
      if(!this.board.editing)return;
      const source=this.nodes.filter(node=>this.selectionIds.includes(node.id)&&!this.isLocked(node.id));if(!source.length){this.message('Hazır plan korunur; eklediğin ögeleri çoğaltabilirsin.');return;}
      if(this.nodes.length+source.length>150){this.message('En fazla 150 özel öge eklenebilir.');return;}
      const groups=new Map(),ids=[];let last;
      for(const node of source){const item=clone(node);item.id='design-'+uid();item.rows=item.rows.map(row=>({...row,id:uid()}));const g=this.geometry(node.id);g.x+=32;g.y+=32;this.nodes.push(item);this.mount(item,g);const old=this.layout[node.id];if(old?.groupId){if(!groups.has(old.groupId))groups.set(old.groupId,'group-'+uid());this.layout[item.id]={groupId:groups.get(old.groupId)};}ids.push(item.id);last=item;}
      this.applyLayout();this.board.renderEditing();this.links.refresh();this.selectMany(ids);this.changed();return last;
    }
    deleteSelected() {
      if(!this.board.editing)return;const ids=this.nodes.filter(node=>this.selectionIds.includes(node.id)&&!this.isLocked(node.id)).map(node=>node.id);
      if(!ids.length){this.message('Hazır plan ve kilitli ögeler silinmez.');return;}
      this.nodes=this.nodes.filter(node=>!ids.includes(node.id));ids.forEach(id=>{delete this.layout[id];this.board.removeItem(id);});this.links.refresh();this.selectMany([]);this.changed();
    }
    arrange(direction) {
      if(!this.board.editing)return;
      const el=this.element(this.selectedId);if(!el)return;
      const layers=this.board.tables.map(item=>Number(item.style.zIndex)||1);
      const z=direction==='front'?Math.max(...layers)+1:Math.min(...layers)-1;
      el.style.zIndex=String(Math.max(0,z));
      const node=this.nodes.find(item=>item.id===this.selectedId);
      if(node)node.z=Math.max(0,z);else{this.legacy[this.selectedId]||={style:{},textStyles:{}};this.legacy[this.selectedId].z=Math.max(0,z);}
      this.changed();
    }
    bringForward(){this.arrange('front');}
    sendBackward(){this.arrange('back');}
    serialize() {return {version:1,nodes:clone(this.nodes),legacy:clone(this.legacy),layout:clone(this.layout),links:this.links?.serialize()||[],workflow:this.workflow?.serialize()};}
    changed(refresh=true) {
      if(this.restoring)return;
      this.scheduleHistory();this.onChange();
      if(refresh)this.root.dispatchEvent(new Event('hafizlik:design-change'));
    }
    onSelection(detail) {
      const id=detail.id,group=this.layout[id]?.groupId,ids=group?this.board.tables.map(el=>el.dataset.boardItem).filter(key=>this.layout[key]?.groupId===group):id?[id]:[];
      this.activeText=detail.textElement;
      if(detail.additive){const selected=new Set(this.selectionIds);const remove=ids.every(key=>selected.has(key));ids.forEach(key=>remove?selected.delete(key):selected.add(key));this.selectMany([...selected],id);}
      else if(id&&this.selectionIds.includes(id))this.selectMany(this.selectionIds,id);
      else this.selectMany(ids,id);
    }
    selectMany(ids,primary) {
      const valid=ids.filter(id=>this.element(id));this.selectionIds=[...new Set(valid)];this.selectedId=this.selectionIds.includes(primary)?primary:this.selectionIds.at(-1)||null;
      this.board.selectedId=this.selectedId;this.board.selectionIds=[...this.selectionIds];
      this.board.tables.forEach(el=>el.classList.toggle('is-selected',this.selectionIds.includes(el.dataset.boardItem)));
      this.root.dispatchEvent(new Event('hafizlik:selection'));
    }
    isLocked(id){return !!this.layout[id]?.locked;}
    applyLayout(){for(const el of this.board.tables){const id=el.dataset.boardItem;el.dataset.layoutLocked=String(this.isLocked(id));el.classList.toggle('is-layout-locked',this.isLocked(id));}}
    toggleLock(id){if(!this.board.editing||!this.element(id))return;this.layout[id]={...this.layout[id],locked:!this.isLocked(id)};this.applyLayout();this.board.renderEditing();this.changed();}
    groupSelected(){if(!this.board.editing||this.selectionIds.length<2)return;const groupId='group-'+uid();for(const id of this.selectionIds)if(!this.isLocked(id))this.layout[id]={...this.layout[id],groupId};this.changed();}
    ungroupSelected(){if(!this.board.editing)return;for(const id of this.selectionIds)if(this.layout[id])delete this.layout[id].groupId;this.changed();}
    alignSelected(mode) {
      if(!this.board.editing)return;const items=this.selectionIds.filter(id=>!this.isLocked(id)).map(id=>({id,...this.geometry(id)}));if(!items.length)return;
      const view=this.board.visibleWorld();
      const box=items.length>1?{left:Math.min(...items.map(g=>g.x)),top:Math.min(...items.map(g=>g.y)),right:Math.max(...items.map(g=>g.x+g.width)),bottom:Math.max(...items.map(g=>g.y+g.height))}:{left:view.x+24,top:view.y+24,right:view.x+view.width-24,bottom:view.y+view.height-24};
      if(mode==='distributeX'||mode==='distributeY'){if(items.length<3)return;const axis=mode==='distributeX'?'x':'y',size=axis==='x'?'width':'height';items.sort((a,b)=>a[axis]-b[axis]);const end=items.at(-1),gap=(end[axis]+end[size]-items[0][axis]-items.reduce((sum,g)=>sum+g[size],0))/(items.length-1);let pos=items[0][axis];for(const item of items){this.board.setGeometry(item.id,{[axis]:pos});pos+=item[size]+gap;}}
      else for(const g of items){const patch=mode==='left'?{x:box.left}:mode==='center'?{x:(box.left+box.right-g.width)/2}:mode==='right'?{x:box.right-g.width}:mode==='top'?{y:box.top}:mode==='middle'?{y:(box.top+box.bottom-g.height)/2}:{y:box.bottom-g.height};this.board.setGeometry(g.id,patch);}
      this.changed();
    }
    bindSelection() {
      let marquee=null;const vp=this.board.viewport;
      vp.addEventListener('pointerdown',event=>{
        if(!this.board.editing||this.board.panActive||this.links?.mode||event.button!==0||event.target.closest('[data-board-item],input,button,label,[contenteditable],.checkbox-link-layer'))return;
        const point=this.board.clientToWorld(event.clientX,event.clientY);marquee={id:event.pointerId,point,previous:[...this.selectionIds],additive:event.shiftKey};const box=document.createElement('div');box.className='designer-marquee';this.sheet.append(box);marquee.box=box;event.preventDefault();vp.setPointerCapture?.(event.pointerId);if(!event.shiftKey)this.selectMany([]);
      });
      vp.addEventListener('pointermove',event=>{if(!marquee||event.pointerId!==marquee.id)return;const point=this.board.clientToWorld(event.clientX,event.clientY),left=Math.min(point.x,marquee.point.x),top=Math.min(point.y,marquee.point.y),width=Math.abs(point.x-marquee.point.x),height=Math.abs(point.y-marquee.point.y);Object.assign(marquee.box.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});const ids=this.board.tables.filter(el=>{const g=this.geometry(el.dataset.boardItem);return g.x<left+width&&g.x+g.width>left&&g.y<top+height&&g.y+g.height>top;}).map(el=>el.dataset.boardItem);this.selectMany(marquee.additive?[...marquee.previous,...ids]:ids);});
      const finish=event=>{if(!marquee)return;if(event.type==='pointercancel')this.selectMany(marquee.previous);marquee.box.remove();marquee=null;};
      vp.addEventListener('pointerup',finish);vp.addEventListener('pointercancel',finish);
      document.addEventListener('keydown',event=>{
        if(!this.board.editing||this.root.inert||event.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
        const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
        if(mod&&key==='z'){event.preventDefault();event.shiftKey?this.redo():this.undo();return;}
        if(mod&&key==='y'){event.preventDefault();this.redo();return;}
        if(mod&&key==='d'){event.preventDefault();this.duplicateSelected();return;}
        if(mod&&key==='g'){event.preventDefault();event.shiftKey?this.ungroupSelected():this.groupSelected();return;}
        if(key==='escape'){this.selectMany([]);return;}
        if((key==='delete'||key==='backspace')&&this.selectionIds.length){event.preventDefault();this.deleteSelected();return;}
        const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta||event.target.closest('.board-drag-handle,.board-resize-handle'))return;
        if(this.selectionIds.length){event.preventDefault();const step=event.shiftKey?10:1;for(const id of this.selectionIds.filter(key=>!this.isLocked(key))){const g=this.geometry(id);this.board.setGeometry(id,{x:g.x+delta[0]*step,y:g.y+delta[1]*step});}this.changed();}
      });
    }
    snapshot() {
      return {nodes:clone(this.nodes),legacy:clone(this.legacy),layout:clone(this.layout),links:this.links.serialize(),workflow:this.workflow?.serialize(),items:clone(this.board.serialize().items),prepared:this.board.tables.filter(el=>!el.dataset.designId).map(el=>({id:el.dataset.boardItem,style:el.style.cssText,texts:[...el.querySelectorAll('[contenteditable]')].map(text=>({html:text.innerHTML,style:text.style.cssText}))}))};
    }
    signature(snapshot){const value=clone(snapshot);for(const node of value.nodes)for(const row of node.rows)delete row.checked;return JSON.stringify(value);}
    initializeHistory(){clearTimeout(this.historyTimer);this.historyLast=this.snapshot();this.historyPast=[];this.historyFuture=[];this.root.dispatchEvent(new Event('hafizlik:history'));}
    scheduleHistory(){if(this.restoring||!this.historyLast)return;clearTimeout(this.historyTimer);this.historyTimer=setTimeout(()=>this.recordHistory(),240);}
    recordHistory(){if(this.restoring||!this.historyLast)return;clearTimeout(this.historyTimer);const next=this.snapshot();if(this.signature(next)===this.signature(this.historyLast))return;this.historyPast.push(this.historyLast);if(this.historyPast.length>60)this.historyPast.shift();this.historyLast=next;this.historyFuture=[];this.root.dispatchEvent(new Event('hafizlik:history'));}
    get canUndo(){return !!this.historyPast.length;}
    get canRedo(){return !!this.historyFuture.length;}
    undo(){this.recordHistory();const previous=this.historyPast.pop();if(!previous)return;this.historyFuture.push(this.historyLast);this.restoreSnapshot(previous);this.historyLast=previous;this.root.dispatchEvent(new Event('hafizlik:history'));}
    redo(){const next=this.historyFuture.pop();if(!next)return;this.historyPast.push(this.historyLast);this.restoreSnapshot(next);this.historyLast=next;this.root.dispatchEvent(new Event('hafizlik:history'));}
    restoreSnapshot(snapshot) {
      clearTimeout(this.historyTimer);this.restoring=true;
      const progress=new Map([...this.sheet.querySelectorAll('[data-check-id]')].filter(el=>el.matches('input')).map(el=>[el.dataset.checkId,el.checked]));
      for(const node of this.nodes)this.board.removeItem(node.id);
      this.nodes=clone(snapshot.nodes);this.legacy=clone(snapshot.legacy);this.layout=clone(snapshot.layout||{});
      for(const prepared of snapshot.prepared){const el=this.element(prepared.id);if(!el)continue;el.style.cssText=prepared.style;[...el.querySelectorAll('[contenteditable]')].forEach((text,index)=>{if(prepared.texts[index]){text.innerHTML=prepared.texts[index].html;text.style.cssText=prepared.texts[index].style;}});}
      for(const node of this.nodes){for(const row of node.rows){const key=node.id+':'+row.id;if(progress.has(key))row.checked=progress.get(key);}this.mount(node,snapshot.items[node.id]);}
      for(const [id,geometry]of Object.entries(snapshot.items))if(this.element(id))this.board.setGeometry(id,geometry);
      this.links.links=clone(snapshot.links);this.links.refresh();
      if(this.workflow){this.workflow.rules=clone(snapshot.workflow?.rules||[]);this.workflow.refreshGates();this.workflow.remember();}
      this.applyLayout();this.board.renderEditing();this.selectMany([]);this.board.grow();this.restoring=false;this.onChange();this.root.dispatchEvent(new Event('hafizlik:design-change'));
    }
    message(text) {
      const toast=this.root.querySelector('#app-toast');if(!toast)return;
      toast.textContent=text;toast.hidden=false;clearTimeout(this.messageTimeout);this.messageTimeout=setTimeout(()=>{toast.hidden=true;},5000);
    }
  }
  window.HafizlikDesigner=HafizlikDesigner;
})();
