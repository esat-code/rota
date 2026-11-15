(() => {
  'use strict';
  const typing = target => target?.closest?.('input,textarea,select,[contenteditable="true"],dialog');
  class HafizlikWorkspaceNavigation {
    constructor(board) {
      this.board=board;this.root=board.root;this.viewport=board.viewport;this.hand=false;this.space=false;this.drag=null;
      this.bar=document.createElement('div');this.bar.className='workspace-navigation';this.bar.setAttribute('aria-label','Çalışma alanı görünümü');
      this.bar.innerHTML='<button type="button" data-view="hand" title="El aracı · Boşluk + sürükle" aria-label="El aracı" aria-pressed="false"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2Z"/></svg></button><i></i><button type="button" data-view="out" aria-label="Uzaklaştır">−</button><button type="button" data-view="reset" aria-label="Yüzde yüz görünüm" class="view-percent">100%</button><button type="button" data-view="in" aria-label="Yakınlaştır">+</button><i></i><button type="button" data-view="fit" title="Bütün ögeleri bul ve ekrana sığdır">Sığdır</button>';
      this.root.append(this.bar);
      const hint=document.createElement('div');hint.className='workspace-hint';hint.textContent='Sınırsız tahta · Kaydırarak gezin · ⌘ + kaydır: yakınlaştır';this.root.append(hint);
      this.tooltip=document.createElement('div');this.tooltip.className='workspace-measure';this.tooltip.hidden=true;this.root.append(this.tooltip);
      this.bar.addEventListener('click',ev=>{const key=ev.target.closest('[data-view]')?.dataset.view;if(key==='hand')this.setHand(!this.hand);else if(key==='fit')this.fit();else if(key==='reset')this.animateZoom(1);else if(key)this.animateZoom((this.zoomTarget||board.zoom)*(key==='in'?1.2:1/1.2));});
      this.viewport.addEventListener('wheel',ev=>{
        // Editable text may scroll itself. The empty board has no page boundaries.
        const edit=ev.target.closest('textarea,[contenteditable="true"]');
        if(edit&&(edit===document.activeElement||edit.contains(document.activeElement))&&!(ev.ctrlKey||ev.metaKey))return;
        ev.preventDefault();
        if(ev.ctrlKey||ev.metaKey){if(this.gestureActive)return;const unit=ev.deltaMode===1?16:ev.deltaMode===2?this.viewport.clientHeight:1;const delta=Math.max(-60,Math.min(60,ev.deltaY*unit));this.animateZoom((this.zoomTarget||board.zoom)*Math.exp(-delta*.002),ev.clientX,ev.clientY);}
        else{const unit=ev.deltaMode===1?16:ev.deltaMode===2?this.viewport.clientHeight:1;this.panBy(ev.shiftKey&&!ev.deltaX?ev.deltaY*unit:ev.deltaX*unit,ev.shiftKey&&!ev.deltaX?0:ev.deltaY*unit);}
      },{passive:false});
      this.viewport.addEventListener('gesturestart',ev=>{ev.preventDefault();this.stopZoom();this.gestureActive=true;this.gestureZoom=board.zoom;},{passive:false});
      this.viewport.addEventListener('gesturechange',ev=>{ev.preventDefault();if(touchView?.pinch)return;this.animateZoom((this.gestureZoom||board.zoom)*(ev.scale||1),ev.clientX,ev.clientY);},{passive:false});
      this.viewport.addEventListener('gestureend',()=>{this.gestureActive=false;this.gestureZoom=null;});
      document.addEventListener('keydown',ev=>{if(ev.code!=='Space'||typing(ev.target)||this.root.inert||!this.root.offsetParent&&getComputedStyle(this.root).display==='none')return;ev.preventDefault();this.space=true;this.updateHand();});
      document.addEventListener('keyup',ev=>{if(ev.code==='Space'){this.space=false;this.updateHand();}});
      addEventListener('blur',()=>{this.space=false;this.drag=null;this.updateHand();});
      this.viewport.addEventListener('pointerdown',ev=>{if(ev.button!==1&&!board.panActive)return;ev.preventDefault();ev.stopImmediatePropagation();this.drag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,left:board.camera.x,top:board.camera.y};this.viewport.setPointerCapture?.(ev.pointerId);this.viewport.classList.add('is-hand-moving');},true);
      this.viewport.addEventListener('pointermove',ev=>{if(!this.drag||this.drag.id!==ev.pointerId)return;ev.preventDefault();ev.stopPropagation();board.setCamera(this.drag.left+(this.drag.x-ev.clientX)/board.zoom,this.drag.top+(this.drag.y-ev.clientY)/board.zoom);});
      const stop=()=>{if(!this.drag)return;this.drag=null;this.viewport.classList.remove('is-hand-moving');this.lastPan=Date.now();this.savedSoon();};
      this.viewport.addEventListener('pointerup',stop);this.viewport.addEventListener('pointercancel',stop);
      this.viewport.addEventListener('click',ev=>{if(board.panActive||Date.now()-(this.lastPan||0)<120){ev.preventDefault();ev.stopImmediatePropagation();}},true);
      
      // Native touch navigation: a free background drag pans; two fingers pinch.
      let touchView = null;
      const center = touches => ({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2});
      const distance = touches => Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
      this.viewport.addEventListener('touchstart',ev=>{
        if(ev.touches.length===2){
          ev.preventDefault();this.stopZoom();const c=center(ev.touches);
          touchView={pinch:true,distance:distance(ev.touches),zoom:board.zoom,world:board.clientToWorld(c.x,c.y)};
          this.gestureActive=true;
        }else if(ev.touches.length===1 && !ev.target.closest('[data-board-item],input,textarea,button,select,[contenteditable="true"]')){
          const t=ev.touches[0];touchView={pinch:false,x:t.clientX,y:t.clientY,left:board.camera.x,top:board.camera.y};
        }
      },{passive:false});
      this.viewport.addEventListener('touchmove',ev=>{
        if(!touchView)return;ev.preventDefault();
        if(touchView.pinch && ev.touches.length===2){
          const c=center(ev.touches),r=this.viewport.getBoundingClientRect();
          board.zoom=Math.max(.01,Math.min(4,touchView.zoom*distance(ev.touches)/Math.max(1,touchView.distance)));
          board.setCamera(touchView.world.x-(c.x-r.left)/board.zoom,touchView.world.y-(c.y-r.top)/board.zoom);
        }else if(!touchView.pinch && ev.touches.length===1){
          const t=ev.touches[0];board.setCamera(touchView.left+(touchView.x-t.clientX)/board.zoom,touchView.top+(touchView.y-t.clientY)/board.zoom);
        }
        this.lastPan=Date.now();
      },{passive:false});
      const endTouch=()=>{if(touchView){touchView=null;this.gestureActive=false;this.savedSoon();}};
      this.viewport.addEventListener('touchend',endTouch);this.viewport.addEventListener('touchcancel',endTouch);
      this.root.addEventListener('hafizlik:editing',()=>{if(!board.editing)this.setHand(false);this.refresh();});
      this.refresh();
    }
    setHand(value){this.hand=!!value;this.updateHand();}
    updateHand(){this.board.panActive=this.hand||this.space;this.viewport.classList.toggle('is-hand-tool',this.board.panActive);this.bar.querySelector('[data-view=hand]').setAttribute('aria-pressed',String(this.hand));}
    savedSoon(){clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.board.onChange(),180);}
    panBy(dx,dy){const b=this.board;b.setCamera(b.camera.x+dx/b.zoom,b.camera.y+dy/b.zoom);this.savedSoon();}
    stopZoom(){if(this.zoomFrame)cancelAnimationFrame(this.zoomFrame);this.zoomFrame=null;this.zoomTarget=null;}
    animateZoom(value,clientX,clientY){
      if(!Number.isFinite(value))return;
      this.zoomTarget=Math.max(.01,Math.min(4,value));this.zoomAnchor={x:clientX,y:clientY};
      if(this.zoomFrame)return;
      let previous=performance.now();
      const step=now=>{
        const elapsed=Math.max(1,Math.min(50,now-previous));previous=now;
        const target=this.zoomTarget,current=this.board.zoom;
        const next=current+(target-current)*(1-Math.exp(-elapsed/65));
        const done=Math.abs(Math.log(target/next))<.0001;
        this.zoomTo(done?target:next,this.zoomAnchor.x,this.zoomAnchor.y);
        if(done){this.zoomFrame=null;this.zoomTarget=null;}else this.zoomFrame=requestAnimationFrame(step);
      };
      this.zoomFrame=requestAnimationFrame(step);
    }
    zoomTo(value,clientX,clientY){
      if(!Number.isFinite(value))return;
      const b=this.board,r=this.viewport.getBoundingClientRect(),old=b.zoom||1,z=Math.max(.01,Math.min(4,value));
      if(z===old)return;
      const x=Number.isFinite(clientX)?clientX-r.left:this.viewport.clientWidth/2,y=Number.isFinite(clientY)?clientY-r.top:this.viewport.clientHeight/2;
      const wx=b.camera.x+x/old,wy=b.camera.y+y/old;b.zoom=z;b.setCamera(wx-x/z,wy-y/z);this.savedSoon();
    }
    fit(){this.stopZoom();const b=this.board,items=b.tables.map(el=>b.geometry(el.dataset.boardItem));if(!items.length)return;const left=Math.min(...items.map(g=>g.x))-24,top=Math.min(...items.map(g=>g.y))-24,right=Math.max(...items.map(g=>g.x+g.width))+24,bottom=Math.max(...items.map(g=>g.y+g.height))+24;const w=this.viewport.clientWidth||innerWidth,h=this.viewport.clientHeight||innerHeight;this.zoomTo(Math.min(1.5,w/(right-left),h/(bottom-top)));b.setCamera((left+right-w/b.zoom)/2,(top+bottom-h/b.zoom)/2);this.savedSoon();}
    measure(width,height,x,y){if(!Number.isFinite(width)){this.tooltip.hidden=true;return;}this.tooltip.hidden=false;this.tooltip.textContent=Math.round(width)+' × '+Math.round(height)+' px';this.tooltip.style.left=Math.min(innerWidth-140,x+16)+'px';this.tooltip.style.top=Math.min(innerHeight-35,y+16)+'px';}
    refresh(){this.bar.querySelector('.view-percent').textContent=Math.round((this.board.zoom||1)*100)+'%';}
  }
  window.HafizlikWorkspaceNavigation=HafizlikWorkspaceNavigation;
})();
