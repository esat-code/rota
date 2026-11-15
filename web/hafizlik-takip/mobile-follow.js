(() => {
 if(!window.ROTA_MOBILE_FOLLOW)return;
 const root=document.getElementById('hafizlik-tik-denemesi');root.dataset.mobileFollow='true';
 root.querySelector('.workspace-viewport')?.addEventListener('wheel',e=>e.stopImmediatePropagation(),{capture:true,passive:true});
 window.hafizlikBoard.editing=false;window.hafizlikBoard.renderEditing();
 for(const el of root.querySelectorAll('[contenteditable]'))el.contentEditable='false';
 const header=document.createElement('div');header.className='mobile-follow-header';
 const back=document.createElement('button');back.textContent='‹ Ana sayfa';back.onclick=()=>window.rotaShowHome?.();
 const title=document.createElement('strong');title.textContent='Çalışma Alanı';
 const save=document.createElement('button');save.textContent='Kaydet';save.onclick=()=>{window.rotaMobileCanSaveUntil=Date.now()+1000;window.hafizlikSaveAll?.();save.textContent='Kaydedildi';setTimeout(()=>save.textContent='Kaydet',1500);};
 header.append(back,title,save);root.prepend(header);
 for(const event of ['click','change','input'])root.addEventListener(event,()=>{window.rotaMobileCanSaveUntil=Date.now()+1000},true);
 window.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&['e','z'].includes(event.key.toLowerCase()))event.stopImmediatePropagation()},true);
for(const frame of document.querySelectorAll('#rota-calendar,#rota-yks,#rota-sport'))frame.addEventListener('load',()=>{
  const doc=frame.contentDocument;if(!doc)return;
  const style=doc.createElement('style');style.textContent='@media(max-width:760px){button:not(.icon-button){min-height:42px}input:not([type=checkbox]),select,textarea{font-size:16px!important}dialog{max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 30px)!important}.modal-actions,.dialog-actions{position:sticky;bottom:0;padding:12px 0;background:var(--panel,#16212a);display:flex;gap:8px}.page{padding-bottom:calc(90px + env(safe-area-inset-bottom))!important}.section-links>button:not(.calendar-home):not(.icon-button){display:none}.task-title{font-size:14px!important}.task input[type=checkbox]{width:24px;height:24px}.task-actions [data-edit-task]{display:none}.page:has(.dashboard){display:flex;flex-direction:column}.page:has(.dashboard)>.heading{order:0}.page:has(.dashboard)>.dashboard{order:1}.page:has(.dashboard)>.stats{order:2;margin-top:24px}}';doc.head.append(style);
 });
})();
