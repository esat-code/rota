(() => {
  'use strict';
  const KEY='hafizlik-takip-v1',FORMAT='rota-hafizlik',MAX_BYTES=12*1024*1024;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const nameOf=value=>String(value||'Rota - Çalışma Alanı').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').trim().slice(0,90)||'Rota - Çalışma Alanı';
  class HafizlikExporter {
    constructor(root){
      this.root=root;this.pending=new Map();this.format='pdf';
      const trigger=node('button','toolbar-button export-button');trigger.id='open-board-export';trigger.type='button';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-label','İndir veya paylaş');trigger.title='İndir / Paylaş';
      trigger.innerHTML='<span class="toolbar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg></span><span class="export-button-label">İndir / Paylaş</span>';
      root.querySelector('#save-and-exit').before(trigger);trigger.addEventListener('click',()=>this.open());
      this.dialog=node('dialog','export-dialog');this.dialog.setAttribute('aria-labelledby','board-export-title');
      this.dialog.innerHTML=`<div class="export-heading"><div><span class="export-eyebrow">ROTA · ÇALIŞMA ALANIN</span><h2 id="board-export-title">İndir / Paylaş</h2></div><button type="button" data-export="close" aria-label="İndirme penceresini kapat">×</button></div>
        <p class="export-intro">Planını yanında götür.</p><div class="export-formats" role="group" aria-label="Dosya türü">
        <button type="button" data-export-format="pdf" aria-pressed="true"><b>PDF</b><span>Yazdır ve gönder</span></button><button type="button" data-export-format="png" aria-pressed="false"><b>PNG</b><span>Görsel olarak indir</span></button><button type="button" data-export-format="rota" aria-pressed="false"><b>Rota dosyası</b><span>Tikler ve kurallar dâhil</span></button></div>
        <label class="export-field"><span>Dosya adı</span><input id="board-export-name" maxlength="90" value="Rota - Çalışma Alanı"></label>
        <div class="export-options"><label class="export-field"><span>Aktarılacak alan</span><select id="board-export-scope"><option value="all">Tüm tahta</option><option value="selected">Seçili ögeler</option><option value="visible">Görünen alan</option></select></label><label class="export-field"><span>Görünüm</span><select id="board-export-theme"><option value="light">Açık görünüm</option><option value="current">Şu anki görünüm</option></select></label></div>
        <label class="export-grid-option"><input id="board-export-grid" type="checkbox"> Kareli zemini de ekle</label><p class="export-detail"></p><p class="export-status" role="status" aria-live="polite"></p>
        <div class="export-actions"><button type="button" data-export="send" class="export-send">Gönder…</button><button type="button" data-export="download" class="export-download">İndir</button></div>
        <div class="export-import"><button type="button" data-export="import">Rota dosyası aç</button><button type="button" data-export="restore" hidden>Önceki plana dön</button><small>Yalnızca Çalışma Alanı planı aktarılır; şifre, takvim ve sayaçlar aktarılmaz.</small></div><input type="file" accept=".json,application/json" id="board-import-file" hidden>`;
      root.append(this.dialog);this.$=s=>this.dialog.querySelector(s);
      this.dialog.addEventListener('click',e=>{if(e.target===this.dialog){if(!this.busy)this.dialog.close();return;}const format=e.target.closest('[data-export-format]')?.dataset.exportFormat;if(format){this.format=format;this.refresh();return;}const action=e.target.closest('[data-export]')?.dataset.export;if(action==='close')this.dialog.close();if(action==='download'||action==='send')this.run(action);if(action==='import')this.$('#board-import-file').click();if(action==='restore'){try{this.prepareImport(JSON.stringify({format:FORMAT,version:1,plan:JSON.parse(localStorage.getItem('rota-hafizlik-before-import-v1'))}));}catch(error){this.status(error.message,true);}}});
      this.dialog.addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});this.dialog.addEventListener('close',()=>trigger.focus());
      this.$('#board-import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>MAX_BYTES)throw Error('Dosya çok büyük. En fazla 12 MB olabilir.');this.prepareImport(await file.text());}catch(error){this.status(error.message,true);}finally{e.target.value='';}});
      window.hafizlikExportResult=result=>{const entry=this.pending.get(result.id);if(!entry)return;clearTimeout(entry.timeout);this.pending.delete(result.id);result.error?entry.reject(Error(result.error)):entry.resolve(result);};
    }
    native(){return !!window.webkit?.messageHandlers?.hafizlik;}
    open(){this.format='pdf';this.status('');this.refresh();this.dialog.showModal();}
    status(message,error=false){const box=this.$('.export-status');box.textContent=message;box.classList.toggle('is-error',error);}
    refresh(){
      this.dialog.querySelectorAll('[data-export-format]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.exportFormat===this.format)));
      const archive=this.format==='rota',selection=window.hafizlikDesigner.selectionIds.length;
      if(archive)this.$('#board-export-scope').value='all';
      this.$('[data-export="restore"]').hidden=!localStorage.getItem('rota-hafizlik-before-import-v1');
      this.$('#board-export-scope option[value="selected"]').disabled=!selection;if(!selection&&this.$('#board-export-scope').value==='selected')this.$('#board-export-scope').value='all';
      this.dialog.querySelectorAll('.export-options select,#board-export-grid').forEach(e=>e.disabled=archive);
      this.$('.export-detail').textContent=archive?'Düzenlenebilir dosya, tüm tahtayı ve tik kurallarını korur. Başka bir Rota’ya aktarabilirsin.':'Yalnızca plan görünür; araçlar, tutamaçlar ve bağlantı kabloları dosyaya eklenmez.';
      this.$('[data-export="send"]').disabled=!this.native()&&!navigator.canShare;
      this.$('[data-export="send"]').title=this.native()?'Mac paylaşım seçeneklerini aç':navigator.canShare?'Cihazın paylaşım seçeneklerini aç':'Bu tarayıcıda paylaşım desteklenmiyor. Dosyayı indirip gönderebilirsin.';
    }
    setBusy(value){this.busy=value;this.dialog.setAttribute('aria-busy',String(value));this.dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);if(!value)this.refresh();}
    archive(){
      window.hafizlikSavePlan();const state=JSON.parse(localStorage.getItem(KEY));
      // Deliberately exclude every other app storage key, including authentication.
      const plan={};for(const key of ['active','completionAvailable','workflowRuntime','board','design','checks','texts'])if(state[key]!==undefined)plan[key]=clone(state[key]);
      return {format:FORMAT,version:1,createdAt:new Date().toISOString(),plan};
    }
    bounds(scope){
      const b=window.hafizlikBoard,s=window.hafizlikDesigner;
      const items=(scope==='selected'?b.tables.filter(e=>s.selectionIds.includes(e.dataset.boardItem)):b.tables).map(e=>({element:e,...b.geometry(e.dataset.boardItem)}));
      if(!items.length)throw Error('Önce aktarmak istediğin ögeleri seç.');
      if(scope==='visible'){const v=b.visibleWorld();return {x:v.x,y:v.y,width:v.width,height:v.height,items};}
      const pad=24,x=Math.min(...items.map(g=>g.x))-pad,y=Math.min(...items.map(g=>g.y))-pad;
      return {x,y,width:Math.max(...items.map(g=>g.x+g.width))-x+pad,height:Math.max(...items.map(g=>g.y+g.height))-y+pad,items};
    }
    document(scope='all',theme='light',grid=false){
      const rect=this.bounds(scope),width=Math.ceil(rect.width),height=Math.ceil(rect.height);
      if(![width,height].every(Number.isFinite)||width>12000||height>12000||width*height>24000000)throw Error('Bu alan görsel için çok büyük. Seçili ögeler veya Görünen alan seçeneğini kullan; tüm plan için Rota dosyasını indirebilirsin.');
      const sheet=node('div','sheet free-layout'),host=node('section','export-mode'+(theme==='current'&&this.root.classList.contains('night-mode')?' night-mode':''));host.id=this.root.id;
      for(const g of rect.items){
        if(g.x+g.width<rect.x||g.y+g.height<rect.y||g.x>rect.x+width||g.y>rect.y+height)continue;
        const copy=g.element.cloneNode(true);copy.classList.remove('is-selected','is-moving','is-layout-locked');copy.removeAttribute('data-layout-locked');
        copy.querySelectorAll('.board-drag-handle,.board-resize-handle,script,iframe,object,embed,link,style,img,video,audio').forEach(e=>e.remove());
        for(const e of [copy,...copy.querySelectorAll('*')])for(const a of [...e.attributes])if(a.name.startsWith('on')||['src','href','srcdoc','autofocus','contenteditable','tabindex'].includes(a.name))e.removeAttribute(a.name);
        const originals=[...g.element.querySelectorAll('input[type="checkbox"]')];copy.querySelectorAll('input[type="checkbox"]').forEach((e,i)=>{e.toggleAttribute('checked',!!originals[i]?.checked);e.checked=!!originals[i]?.checked;});
        Object.assign(copy.style,{left:(g.x-rect.x)+'px',top:(g.y-rect.y)+'px',width:g.width+'px',minHeight:g.height+'px',transform:'none',outline:'none'});sheet.append(copy);
      }
      host.append(sheet);
      const css=(this.root.querySelector('style')?.textContent||'')+'\n'+(window.hafizlikExportCSS||'');
      const overrides=`html,body{margin:0!important;padding:0!important;background:#fff!important;width:${width}px!important;height:${height}px!important;min-height:0!important;overflow:hidden!important;color-scheme:light!important}#hafizlik-tik-denemesi.export-mode{visibility:visible!important;display:block!important;position:relative!important;width:${width}px!important;height:${height}px!important;min-height:0!important;overflow:hidden!important;background:var(--paper)!important}#hafizlik-tik-denemesi.export-mode .sheet{position:relative!important;left:0!important;top:0!important;width:${width}px!important;height:${height}px!important;min-width:0!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;transform:none!important;overflow:hidden!important;background-color:var(--paper)!important;${grid?'':'background-image:none!important;'}}#hafizlik-tik-denemesi.export-mode .sheet::before{display:none!important}#hafizlik-tik-denemesi.export-mode [data-board-item]{outline:none!important;pointer-events:none!important}#hafizlik-tik-denemesi.export-mode input[type=checkbox]{appearance:none!important;-webkit-appearance:none!important;display:inline-block!important;width:17px!important;height:17px!important;border:1.5px solid #76828c!important;border-radius:4px!important;background:#fff!important;background-size:100% 100%!important;box-shadow:none!important}#hafizlik-tik-denemesi.export-mode input[type=checkbox]:checked{border-color:#243d55!important;background-color:#243d55!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.6 8.1l2.9 3L12.4 5' fill='none' stroke='%23ffffff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important}#hafizlik-tik-denemesi.export-mode.night-mode input[type=checkbox]:checked{background-color:#d8c6a2!important;border-color:#d8c6a2!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.6 8.1l2.9 3L12.4 5' fill='none' stroke='%23243d55' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;animation:none!important;transition:none!important}@page{size:${width}px ${height}px;margin:0}`;
      return {width,height,html:'<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; base-uri \'none\'; form-action \'none\'"><title>'+escape(nameOf(this.$('#board-export-name').value))+'</title><style>'+css.replace(/<\/style/gi,'<\\/style')+'\n'+overrides+'</style></head><body>'+host.outerHTML+'</body></html>'};
    }
    nativeRequest(payload){return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timeout=setTimeout(()=>{this.pending.delete(id);reject(Error('İşlem tamamlanamadı. Yeniden deneyebilirsin.'));},180000);this.pending.set(id,{resolve,reject,timeout});window.webkit.messageHandlers.hafizlik.postMessage({action:'export',id,...payload});});}
    async png(doc){
      const xml=new XMLSerializer().serializeToString(new DOMParser().parseFromString(doc.html,'text/html').documentElement),svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+doc.width+'" height="'+doc.height+'"><foreignObject width="100%" height="100%">'+xml+'</foreignObject></svg>';
      const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('Görsel hazırlanamadı. PDF veya Rota dosyasını deneyebilirsin.'));});
      const canvas=document.createElement('canvas');canvas.width=doc.width;canvas.height=doc.height;canvas.getContext('2d').drawImage(img,0,0);
      return new Promise((ok,no)=>canvas.toBlob(blob=>blob?ok(blob):no(Error('Görsel hazırlanamadı.')),'image/png'));
    }
    download(blob,filename){const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    async run(operation){
      if(this.busy)return;let printWindow;if(!this.native()&&this.format==='pdf'&&operation==='download'){printWindow=window.open('','_blank');if(!printWindow){this.status('PDF için açılır pencereye izin ver veya Rota dosyasını indir.',true);return;}}
      this.setBusy(true);this.status('Dosyan hazırlanıyor…');
      try{
        const name=nameOf(this.$('#board-export-name').value),format=this.format,extension=format==='rota'?'rota.json':format;
        const payload=format==='rota'?{format:'json',data:JSON.stringify(this.archive(),null,2)}:{format,...this.document(this.$('#board-export-scope').value,this.$('#board-export-theme').value,this.$('#board-export-grid').checked)};
        if(this.native()){
          const result=await this.nativeRequest({...payload,operation,name:name+'.'+extension});this.status(result.cancelled?'İşlem iptal edildi.':operation==='send'?'Paylaşım seçenekleri açıldı.':'Dosyan kaydedildi.');
        }else if(format==='pdf'){
          if(operation==='send')throw Error('Bu tarayıcıda PDF için önce dosyayı indir.');
          printWindow.document.write(payload.html);printWindow.document.close();await new Promise(r=>setTimeout(r,300));printWindow.focus();printWindow.print();this.status('Yazdırma penceresinde “PDF olarak kaydet” seçeneğini kullan.');
        }else{
          const blob=format==='rota'?new Blob([payload.data],{type:'application/json'}):await this.png(payload),file=new File([blob],name+'.'+extension,{type:blob.type});
          if(operation==='send'){if(!navigator.canShare?.({files:[file]}))throw Error('Bu dosya tarayıcıdan paylaşılamıyor. İndirip gönderebilirsin.');await navigator.share({files:[file],title:name});this.status('Paylaşım tamamlandı.');}
          else{this.download(blob,file.name);this.status('İndirme başlatıldı.');}
        }
      }catch(error){printWindow?.close();this.status(error.name==='AbortError'?'İşlem iptal edildi.':error.message,true);}finally{this.setBusy(false);}
    }
    sanitizeHTML(value){
      const doc=new DOMParser().parseFromString(String(value),'text/html'),allow=new Set(['B','STRONG','I','EM','U','S','BR','SPAN','DIV','P','UL','OL','LI','SUB','SUP']);
      for(const e of [...doc.body.querySelectorAll('*')]){if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','IMG','SVG','MATH','VIDEO','AUDIO'].includes(e.tagName)){e.remove();continue;}if(!allow.has(e.tagName)){e.replaceWith(...e.childNodes);continue;}const safeStyle=[];for(const property of ['color','background-color','font-size','font-weight','font-style','text-align','text-decoration']){const v=e.style.getPropertyValue(property);if(v&&!/url|expression|var\(/i.test(v))safeStyle.push(property+':'+v);}for(const a of [...e.attributes])e.removeAttribute(a.name);if(safeStyle.length)e.setAttribute('style',safeStyle.join(';'));}return doc.body.innerHTML;
    }
    validateArchive(text){
      if(typeof text!=='string'||new Blob([text]).size>MAX_BYTES)throw Error('Geçerli ve en fazla 12 MB olan bir Rota dosyası seç.');
      let data;try{data=JSON.parse(text);}catch{throw Error('Dosya okunamadı. Bir Rota dosyası seç.');}
      if(data?.format!==FORMAT||data.version!==1||!data.plan||typeof data.plan!=='object')throw Error('Bu dosya bir Rota Çalışma Alanı dosyası değil.');
      const p=data.plan,b=p.board,design=p.design;
      if(!Array.isArray(p.checks)||p.checks.length!==26||p.checks.some(v=>typeof v!=='boolean')||!Array.isArray(p.texts)||p.texts.length!==33||p.texts.some(v=>typeof v!=='string'))throw Error('Dosyadaki plan bilgileri eksik veya geçersiz.');
      const prepared=['weeks','surahs','juz-tur','time-limit','note','routine'];
      if(!b||![1,2].includes(b.version)||!b.items||prepared.some(id=>!b.items[id])||!design||!Array.isArray(design.nodes)||design.nodes.length>150)throw Error('Tahta bilgileri geçersiz.');
      for(const g of Object.values(b.items))if(!g||!['x','y','width','height'].every(k=>Number.isFinite(g[k]))||Math.abs(g.x)>10000000||Math.abs(g.y)>10000000||g.width<1||g.height<1||g.width>100000||g.height>100000)throw Error('Öge konumları veya boyutları geçersiz.');
      const ids=new Set(prepared);for(const n of design.nodes){if(!n||typeof n.id!=='string'||!n.id.startsWith('design-')||ids.has(n.id)||!['note','text','checklist'].includes(n.type)||!Array.isArray(n.rows)||n.rows.length>40)throw Error('Dosyadaki ögeler geçersiz.');ids.add(n.id);}
      if(design.links&&(!Array.isArray(design.links)||design.links.length>500)||design.workflow&&(!Array.isArray(design.workflow.rules)||design.workflow.rules.length>100))throw Error('Bağlantı bilgileri geçersiz.');
      const endpoints=new Set([...window.hafizlikDesigner.links.nodes].filter(([,e])=>prepared.includes(e.closest('[data-board-item]')?.dataset.boardItem)).map(([id])=>id)),edges=[];
      for(const n of design.nodes)for(const row of n.rows){if(!row||typeof row.id!=='string'||!row.id||typeof row.text!=='string'||typeof row.checked!=='boolean'||endpoints.has(n.id+':'+row.id))throw Error('Tik satırları geçersiz.');endpoints.add(n.id+':'+row.id);}
      for(const link of design.links||[]){if(!link||!['check','uncheck','mirror'].includes(link.action)||!endpoints.has(link.source)||!endpoints.has(link.target)||link.source===link.target)throw Error('Tik bağlantıları geçersiz.');edges.push([link.source,link.target]);}
      const list=(v,min=1)=>Array.isArray(v)&&v.length>=min&&v.every(id=>typeof id==='string'&&endpoints.has(id));
      const ruleIds=new Set();
      for(const r of design.workflow?.rules||[]){
        if(!r||typeof r.id!=='string'||ruleIds.has(r.id)||!['requiresAll','exclusiveReset','advanceSequence','resetSequence'].includes(r.type))throw Error('Tik kuralları geçersiz.');ruleIds.add(r.id);
        if(r.type==='requiresAll'){
          if(!endpoints.has(r.target)||!Array.isArray(r.sources)||!r.sources.length||r.sources.some(id=>typeof id!=='string'||id===r.target))throw Error('Ön koşul kuralı geçersiz.');
          // A deleted prerequisite remains a blocking condition, never an unlocked gate.
          if(r.enabled!==false)r.sources.forEach(id=>edges.push([id,r.target]));
        }else if(r.type==='exclusiveReset'){if(!list(r.sources,2)||!list(r.targets,0)||r.targets.some(id=>r.sources.includes(id)))throw Error('Gün değişimi kuralı geçersiz.');}
        else{if(!endpoints.has(r.source)||!list(r.targets))throw Error('İlerleme kuralı geçersiz.');if(r.type==='advanceSequence'){if(r.targets.includes(r.source)||!list(r.resetOn||[],0))throw Error('İlerleme sırası geçersiz.');if(r.enabled!==false)r.targets.forEach(id=>edges.push([r.source,id]));}}
      }
      const visiting=new Set(),done=new Set(),walk=id=>{if(visiting.has(id))throw Error('Dosyadaki tik bağlantılarında bir döngü var.');if(done.has(id))return;visiting.add(id);edges.filter(e=>e[0]===id).forEach(e=>walk(e[1]));visiting.delete(id);done.add(id);};for(const [id]of edges)walk(id);
      const out={active:p.active==='diger'?'diger':'bir',completionAvailable:p.completionAvailable!==false,checks:clone(p.checks),texts:p.texts.map(v=>this.sanitizeHTML(v)),board:clone(b),design:clone(design),workflowRuntime:clone(p.workflowRuntime||{}),tables:[]};
      // Strip prototype keys before handing JSON to the existing data-driven editor.
      return JSON.parse(JSON.stringify(out),(k,v)=>['__proto__','prototype','constructor'].includes(k)?undefined:v);
    }
    prepareImport(text){
      const plan=this.validateArchive(text);this.importPlan=plan;
      if(!this.importDialog){this.importDialog=node('dialog','export-dialog export-confirm');this.importDialog.setAttribute('aria-label','Plan dosyasını aç');this.importDialog.innerHTML='<h2>Bu planı aç?</h2><p>Mevcut Çalışma Alanı tahtası, tikleri ve kuralları dosyadaki planla değiştirilecek. Takvimin, sayaçların ve şifren değişmez.</p><p>Mevcut planın ayrıca bu cihazda geri dönüş kopyası tutulur.</p><div class="export-actions"><button type="button" data-import="cancel">Vazgeç</button><button type="button" data-import="confirm" class="export-download">Planı aç</button></div>';this.root.append(this.importDialog);this.importDialog.addEventListener('click',e=>{if(e.target.closest('[data-import="cancel"]'))this.importDialog.close();if(e.target.closest('[data-import="confirm"]')){try{window.hafizlikSavePlan();const current=localStorage.getItem(KEY);if(current)localStorage.setItem('rota-hafizlik-before-import-v1',current);localStorage.setItem(KEY,JSON.stringify(this.importPlan));window.hafizlikImportPending=true;window.hafizlikNativeSave?.();location.reload();}catch{window.hafizlikImportPending=false;this.status('Plan açılamadı. Mevcut planın korundu; cihazda yeterli boş alan olduğundan emin ol.',true);this.importDialog.close();}}});}
      this.importDialog.showModal();
    }
  }
  window.HafizlikExporter=HafizlikExporter;
  window.hafizlikExporter=new HafizlikExporter(document.getElementById('hafizlik-tik-denemesi'));
})();
