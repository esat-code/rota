(() => {
'use strict';
const KEYS=['hafizlik-takip-v1','rota-hafizlik-before-import-v1','hafizlik-takip-theme','hafizlik-takip-timers-v1','rota-home-audio-v1','rota-event-manager-preview-v1','rota-event-manager-preview-v1-theme','rota-event-manager-preview-v1-special-preferences','rota-yks-v1','rota-sport-preview-v1'];
const META='rota-cloud-sync-v1', RECOVERY='rota-cloud-recovery-v1';
const native=!!window.webkit?.messageHandlers?.rotaCloud;
const empty=()=>Object.fromEntries(KEYS.map(k=>[k,null]));
const read=()=>Object.fromEntries(KEYS.map(k=>[k,localStorage.getItem(k)]));
const same=(a,b)=>KEYS.every(k=>(a?.[k]??null)===(b?.[k]??null));
function metadata(){try{return JSON.parse(localStorage.getItem(META))}catch{return null}}
function remember(revision,data){localStorage.setItem(META,JSON.stringify({revision,base:data}));}
function install(data,revision){
 const old=read(),oldMeta=localStorage.getItem(META);
 // Prevent the old planner's pagehide/visibility hooks from overwriting incoming data.
 window.hafizlikImportPending=true;
 try{for(const k of KEYS){data[k]===null?localStorage.removeItem(k):localStorage.setItem(k,data[k]);}remember(revision,data);}
 catch(error){for(const k of KEYS){old[k]===null?localStorage.removeItem(k):localStorage.setItem(k,old[k]);}if(oldMeta)localStorage.setItem(META,oldMeta);window.hafizlikImportPending=false;throw error;}
 window.hafizlikNativeSave?.();
}
function merge(base,local,remote){const data={},conflicts=[];for(const k of KEYS){
 const b=base?.[k]??null,l=local[k]??null,r=remote[k]??null;
 if(l===b)data[k]=r;else if(r===b||l===r)data[k]=l;else{data[k]=l;conflicts.push(k);}
}return {data,conflicts};}
const pending=new Map();
window.rotaCloudResult=(result)=>{const p=pending.get(result.id);if(!p)return;clearTimeout(p.timer);pending.delete(result.id);result.error?p.reject(Error(result.error)):p.resolve(result);};
async function request(method='GET',body,revision){
 if(native){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Bağlantı bekleniyor.'))},25000);pending.set(id,{resolve,reject,timer});window.webkit.messageHandlers.rotaCloud.postMessage({id,method,...(body?{body}:{}),...(Number.isInteger(revision)?{revision}:{})});});}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch('/api/state'+(revision!==undefined?'?since='+revision:''),{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});
 const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))throw Error('Oturumunu yenilemek için sayfayı tekrar aç.');
 return {status:response.status,value:await response.json()};}finally{clearTimeout(timer)}
}
function unpack(result){if(result.status!==200)throw Error(result.value?.error||'Eşitleme tamamlanamadı.');return result.value;}
const isStart=document.currentScript?.dataset.start!==undefined;
const go=()=>location.replace('hafizlik-tik-denemesi.html');
function bootBlocked(status,message){
 status.textContent=message;
 window.webkit?.messageHandlers?.rotaBootBlocked?.postMessage(message);
 window.webkit?.messageHandlers?.hafizlik?.postMessage({action:'boot-blocked'});
}
async function bootstrap(){
 const status=document.getElementById('boot-status');status.textContent='Kayıtların hazırlanıyor…';
 try{
 const remote=unpack(await request()),local=read(),meta=metadata();
 if(!remote.revision){
  if(native&&local['hafizlik-takip-v1']){const result=unpack(await request('PUT',{base:0,data:local,operation:crypto.randomUUID()}));remember(result.revision,result.data);go();}
  else{bootBlocked(status,'İlk eşitleme için bilgisayarındaki Rota’yı aç. Kayıtların buraya gelecek.');setTimeout(bootstrap,5000);}return;
 }
 if(meta&&!same(local,meta.base)){go();return;}
 if(!meta&&native&&local['hafizlik-takip-v1']&&!same(local,remote.data)){remember(0,empty());go();return;}
 install(remote.data,remote.revision);go();
 }catch(error){if(native&&read()['hafizlik-takip-v1']||metadata()){go();return;}bootBlocked(status,'Bağlantı kurulamadı. '+error.message);document.getElementById('retry').hidden=false;}
}
if(isStart){document.getElementById('retry').onclick=bootstrap;bootstrap();return;}
let busy=false,lastRemote=0,conflict=null,remotePending=null,lastEdit=0;
const pill=document.createElement('button');pill.id='rota-sync-status';pill.type='button';pill.textContent='Bağlanıyor…';pill.setAttribute('aria-live','polite');pill.title='Cihazlar arası eşitleme';pill.hidden=true;
const style=document.createElement('style');style.textContent=`#rota-sync-status{position:fixed;right:12px;bottom:max(9px,env(safe-area-inset-bottom));z-index:2147483000;background:#17242b;color:#d5f6e6;border:1px solid #426454;border-radius:18px;padding:7px 11px;font:11px system-ui;box-shadow:0 2px 10px #0004;cursor:pointer}#rota-sync-dialog{background:#152027;color:#f2f5f3;border:1px solid #527269;border-radius:20px;padding:24px;max-width:440px;width:calc(100% - 48px);font:15px/1.6 system-ui;box-sizing:border-box}#rota-sync-dialog::backdrop{background:#0009}#rota-sync-dialog button,#rota-sync-dialog a{display:block;width:100%;box-sizing:border-box;text-align:center;padding:11px;margin-top:10px;border:1px solid #628075;border-radius:10px;background:#263b32;color:#fff;font:inherit;text-decoration:none}#rota-sync-dialog p{margin:0 0 14px}#rota-sync-dialog small{display:block;color:#a9bbb5}`;
document.head.append(style);document.body.append(pill);
const dialog=document.createElement('dialog');dialog.id='rota-sync-dialog';document.body.append(dialog);
function status(text){pill.textContent=text;pill.hidden=!conflict;}
function editing(doc=document){
 if(doc.querySelector('dialog[open]:not(#rota-sync-dialog)'))return true;
 const a=doc.activeElement;if(a?.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]),textarea,select,[contenteditable="true"]'))return true;
 if(a?.tagName==='IFRAME'){try{return editing(a.contentDocument)}catch{}}
 return Date.now()-lastEdit<2500;
}
function bindEdits(doc){doc.addEventListener('input',()=>lastEdit=Date.now(),true);}
bindEdits(document);for(const f of document.querySelectorAll('iframe'))f.addEventListener('load',()=>{try{bindEdits(f.contentDocument)}catch{}});
function reloadWith(data,revision){
 const view=['calendar','yks','sport','home'].find(v=>document.body.classList.contains('rota-show-'+v))||'planner';
 rememberView(view);install(data,revision);status('Güncelleniyor…');location.reload();
}
function rememberView(view){
 sessionStorage.setItem('rota-cloud-view',view);
 try{if(document.getElementById('rota-home').contentDocument.body.dataset.view==='home')sessionStorage.setItem('rota-cloud-unlocked','yes');}catch{}
}
window.addEventListener('load',()=>{
 const view=sessionStorage.getItem('rota-cloud-view'),unlocked=sessionStorage.getItem('rota-cloud-unlocked')==='yes';
 sessionStorage.removeItem('rota-cloud-view');sessionStorage.removeItem('rota-cloud-unlocked');
 if(unlocked){
  const doc=document.getElementById('rota-home').contentDocument;
  doc.getElementById('entry-screen').hidden=true;doc.querySelector('.portal-row').hidden=false;doc.getElementById('settings-open').hidden=false;doc.body.dataset.view='home';
  if(view&&view!=='home')setTimeout(()=>window['rotaShow'+view[0].toUpperCase()+view.slice(1)]?.(),100);
 }
});
async function recordConflict(remote,local,merged){
 const id=crypto.randomUUID();
 // Save the local side before offering either choice; the other side stays in D1 history.
 localStorage.setItem(RECOVERY,JSON.stringify({id,remoteRevision:remote.revision,data:local,at:new Date().toISOString()}));
 const response=await request('POST',{id,revision:remote.revision,data:local});unpack(response);
 conflict={remote,local,merged};status('İki değişiklik var · seç');
}
async function tick(){
 if(busy||conflict)return;busy=true;
 try{
 let meta=metadata()||{revision:0,base:empty()},local=read();
 const dirty=!same(local,meta.base);
 if(!dirty && Date.now()-lastRemote<4500)return;
 const remote=unpack(await request('GET',undefined,meta.revision));lastRemote=Date.now();local=read();
 if(!remote.revision){status('İlk eşitleme bekleniyor');return;}
 if(remote.revision!==meta.revision){
  const merged=merge(meta.base,local,remote.data);
  if(merged.conflicts.length){await recordConflict(remote,local,merged);return;}
  if(!same(merged.data,local)){
   remotePending={data:merged.data,revision:remote.revision,base:remote.data};
   if(editing()){status('Yeni kayıt var · düzenlemeyi bitir');return;}
   if(!same(merged.data,remote.data)){
    // Retain locally changed independent sections against the new server baseline.
    install(merged.data,remote.revision);remember(remote.revision,remote.data);
   }else install(merged.data,remote.revision);
   remotePending=null;reloadWithPending();return;
  }
  remember(remote.revision,remote.data);meta=metadata();
 }
 local=read();
 if(!same(local,meta.base)){
  status('Eşitleniyor…');
  const sent=local,result=await request('PUT',{base:meta.revision,data:sent,operation:crypto.randomUUID()});
  if(result.status===409){lastRemote=0;status('Yeni değişiklik kontrol ediliyor…');return;}
  const saved=unpack(result);remember(saved.revision,sent);
  status(same(read(),sent)?'✓ Eşitlendi':'Değişiklik gönderilecek');
 }else status('✓ Eşitlendi');
 }catch(error){status('Çevrimdışı · kayıtlar bu cihazda');pill.title=error.message;}
 finally{busy=false;}
}
function reloadWithPending(){const view=['calendar','yks','sport','home'].find(v=>document.body.classList.contains('rota-show-'+v))||'planner';rememberView(view);window.hafizlikNativeSave?.();status('Güncelleniyor…');location.reload();}
pill.onclick=()=>{
 dialog.replaceChildren();
 const p=document.createElement('p');p.textContent=conflict?'Aynı bölüm iki cihazda değişmiş. Hangi sürümle devam edelim? Her iki sürüm de yedeklendi.':remotePending?'Düzenlediğin alanı kaydet veya kapat. Diğer cihazdaki kayıt sonra uygulanacak.':'Takvim, çalışma planı, YKS ve spor kayıtları iki cihaz arasında eşitlenir. İnternet kesilince değişiklikler bu cihazda bekler.';dialog.append(p);
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;dialog.append(b);};
 if(conflict){
 button('Bu cihazdaki değişikliği kullan',async()=>{const current=read();if(!same(current,conflict.local)){conflict=null;dialog.close();lastRemote=0;tick();return;}const c=conflict;try{const r=await request('PUT',{base:c.remote.revision,data:c.merged.data,operation:crypto.randomUUID()});if(r.status===409){conflict=null;lastRemote=0;dialog.close();tick();return;}const saved=unpack(r);reloadWith(saved.data,saved.revision);}catch(e){p.textContent='Bağlantı kurulamadı; iki sürüm de korunuyor.';}});
 button('Diğer cihazdaki değişikliği kullan',()=>{if(!same(read(),conflict.local)){conflict=null;dialog.close();lastRemote=0;tick();return;}const c=conflict;const combined={...c.merged.data};for(const key of c.merged.conflicts)combined[key]=c.remote.data[key];install(combined,c.remote.revision);remember(c.remote.revision,c.remote.data);reloadWithPending();});
 }
 const note=document.createElement('small');note.textContent='Cihazdan seçtiğin kişisel video dosyaları ve uygulama kilidi bu cihaza aittir. İnternet varken kayıtlar birkaç saniyede eşitlenir.';dialog.append(note);

 button('Kapat',()=>dialog.close());dialog.showModal();
};
window.addEventListener('online',()=>{lastRemote=0;tick();});
window.addEventListener('visibilitychange',()=>{if(!document.hidden){lastRemote=0;tick();}else tick();});
window.rotaOpenSyncSettings=()=>pill.click();
window.rotaCloudFlush=()=>Promise.race([
 (async()=>{while(busy)await new Promise(r=>setTimeout(r,100));await tick();window.hafizlikNativeSave?.();})(),
 new Promise(r=>setTimeout(r,6000))
]);
setInterval(tick,1500);tick();
})();
