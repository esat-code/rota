import React,{useEffect,useRef,useState} from 'react';
import {Plus,Play,Video,Trash2,Link,Upload,Check,LoaderCircle,RotateCw,ChevronUp,ChevronDown,GripVertical,ArrowLeft,ArrowRight,Copy,X,Pencil} from 'lucide-react';
import {videoInfo,nativeVideoAvailable,playNativeVideo,offlineVideo} from './video-player.js';
import {VIDEO_DAYS,videoDays,orderedVideos,moveVideo,linkVideoDay,copyVideoDays} from './video-queue.js';
import {useVideoQueueDrag} from './use-video-queue-drag.js';

function currentDay(){const weekday=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T12:00:00').getDay()||7;return weekday===5?'all':weekday;}
export default function VideoLibrary({state,change,selectedId,setSelectedId,setModal,setToast,readFile,writeFile,day,onDayChange}){
 const[filter,setFilter]=useState(day??currentDay()),[source,setSource]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[removeId,setRemoveId]=useState(null),[editId,setEditId]=useState(null),[retry,setRetry]=useState(0),[copyId,setCopyId]=useState(null);
 const[expanded,setExpanded]=useState(false);const playerRoot=useRef(null);
 useEffect(()=>{const close=e=>{if(e.key==='Escape')setExpanded(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[]);
 async function toggleFullscreen(){if(expanded){if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});setExpanded(false);return;}setExpanded(true);try{await playerRoot.current?.requestFullscreen?.();}catch{} }
 useEffect(()=>{const sync=()=>{if(!document.fullscreenElement)setExpanded(false);};document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync);},[]);
 const queueRoot=useRef(null);
 const filtered=orderedVideos(state,filter),selected=filtered.find(video=>video.id===selectedId)||filtered[0],ownedURL=useRef('');
 function copyToDays(id,days){
  const added=VIDEO_DAYS.filter(d=>days.includes(d.id)&&!videoDays(state,id).some(link=>link.id===d.id));
  change(s=>copyVideoDays(s,id,days));
  setToast(added.length?added.map(d=>d.day).join(', ')+' listesine eklendi. Kaynak günündeki video korundu.':'Video zaten bu günün listesinde.');
 }
 const {drag,begin}=useVideoQueueDrag({root:queueRoot,day:filter,ids:filtered.map(video=>video.id),onReorder:(day,id,index)=>change(s=>moveVideo(s,day,id,index)),onCopy:(id,day)=>copyToDays(id,[day])});
 useEffect(()=>{if(day!==undefined&&day!==null)setFilter(day);},[day]);
 useEffect(()=>{
  let cancelled=false;
  if(ownedURL.current)URL.revokeObjectURL(ownedURL.current);
  ownedURL.current='';setSource('');setError('');setLoading(!!selected?.local);
  if(selected?.local)readFile(selected.id).then(file=>{
   if(cancelled)return;
   if(!file){setError('Dosyayı bu cihazda bulamadım. Aşağıdan yeniden seçerek aynı kayda bağlayabilirsin.');return;}
   const url=URL.createObjectURL(file);ownedURL.current=url;setSource({id:selected.id,url});
  }).catch(()=>{if(!cancelled)setError('Dosya açılamadı. Aşağıdan yeniden seçebilirsin.');}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;if(ownedURL.current)URL.revokeObjectURL(ownedURL.current);ownedURL.current='';};
 },[selected?.id,selected?.fileName,retry]);
 useEffect(()=>{if(selectedId&&!filtered.some(video=>video.id===selectedId)){setFilter('all');onDayChange?.('all');}},[selectedId]);
 const chooseDay=value=>{setFilter(value);onDayChange?.(value);setSelectedId(null);};
 const addVideo=()=>setModal({type:'video',initial:{weekday:filter==='all'?undefined:filter}});
 async function open(video){setSelectedId(video.id);setError('');try{await playNativeVideo(video);}catch(e){setError(e.message||'Oynatıcı açılamadı. Tekrar dene.');}}
 async function reconnect(e){
  const file=e.target.files?.[0];e.target.value='';if(!file||!selected)return;
  try{await writeFile(selected.id,file);change(s=>({...s,videos:s.videos.map(video=>video.id===selected.id?{...video,local:true,fileName:file.name,url:''}:video)}));setRetry(v=>v+1);setToast('Video dosyası yeniden bağlandı.');}catch(e){setError(e.message||'Dosya kaydedilemedi.');}
 }
 function toggleDay(weekday){
  const has=videoDays(state,selected.id).some(day=>day.id===weekday);
  change(s=>linkVideoDay(s,selected.id,weekday,!has));
 }
 async function remove(id){
  change(s=>({...s,videos:s.videos.filter(video=>video.id!==id),plan:{...s.plan,videoOrder:Object.fromEntries(Object.entries(s.plan.videoOrder||{}).map(([day,ids])=>[day,Array.isArray(ids)?ids.filter(value=>value!==id):ids])),weekly:s.plan.weekly.map(rule=>({...rule,videoIds:rule.videoIds.filter(i=>i!==id)})),overrides:s.plan.overrides.map(rule=>({...rule,videoIds:rule.videoIds.filter(i=>i!==id)}))}}));
  await writeFile(id,null).catch(()=>{});if(selectedId===id)setSelectedId(null);setRemoveId(null);setToast('Video kütüphaneden kaldırıldı.');
 }
 function rename(id,title){change(s=>({...s,videos:s.videos.map(video=>video.id===id?{...video,title}:video)}));setEditId(null);setToast('Video adı güncellendi.');}
 const reorder=(id,index)=>change(s=>moveVideo(s,filter,id,index));
 const offline=offlineVideo(selected),playbackSource=selected?.local?(source?.id===selected.id?source.url:''):offline?.src;
 const info=videoInfo(selected?.url),native=!selected?.local&&!offline&&info?.kind==='youtube'&&nativeVideoAvailable(),selectedIndex=filtered.findIndex(video=>video.id===selected?.id);
 const activeDay=VIDEO_DAYS.find(day=>day.id===filter);
 return <>
  <section className="page-heading"><div><p className="eyebrow">GÜNÜN GELDİĞİNDE, AÇ VE ÇALIŞ</p><h1>Videolarım</h1><p>Isınma, hareket veya esneme: hepsi aynı günün listesinde, senin sıranla.</p></div><button className="primary" onClick={addVideo}><Plus size={17}/>Video ekle</button></section>
  <div ref={queueRoot} className="video-queue-workspace">
  <nav className="video-day-tabs" aria-label="Videoları güne göre göster">
   <button aria-pressed={filter==='all'} onClick={()=>chooseDay('all')}>Tümü<span>{state.videos.length}</span></button>
   {VIDEO_DAYS.map(day=><button key={day.id} data-video-drop-day={day.id} className={drag?.target?.kind==='day'&&drag.target.day===day.id?'video-day-drop-target':''} aria-pressed={filter===day.id} onClick={()=>chooseDay(day.id)}><strong>{day.day}</strong><small>{day.group}</small><span>{drag?.target?.kind==='day'&&drag.target.day===day.id?(videoDays(state,drag.id).some(d=>d.id===day.id)?'Zaten ekli':'Bırak: güne kopyala'):orderedVideos(state,day.id).length+' video'}</span></button>)}
  </nav>
  <section className="video-day-list">
   <div className="section-title"><div><h2>{activeDay?activeDay.day+' · '+activeDay.group:'Tüm videoların'}</h2><p className="small muted">{filtered.length?filtered.length+' video · sırala veya yukarıdaki bir güne sürükleyip kopyala.':'İstediğin kadar video ekleyebilirsin.'}</p></div></div>
   {!filtered.length?<div className="empty"><span className="empty-icon"><Video size={26}/></span><h3>{filter==='all'?'Henüz video eklemedin.':activeDay.day+' için video ekleyebilirsin.'}</h3><p>Tür seçmene gerek yok. Eklediğin her video bu listede sıraya girer.</p></div>:
   <ol className="video-queue" aria-label={activeDay?activeDay.day+' video sırası':'Tüm video sırası'}>
    {filtered.map((video,index)=><li key={video.id} data-video-row-id={video.id} className={(selected?.id===video.id?'selected ':'')+(drag?.id===video.id?'dragging ':'')+(drag?.target?.kind==='row'&&drag.target.id===video.id?'video-drop-'+(drag.target.after?'after':'before'):'')} onPointerDown={e=>begin(e,video.id)} onDragStart={e=>e.preventDefault()}>
      <button className="video-drag-handle" data-video-drag-source draggable={false} aria-label={video.title+' videosunu sürükle'} title="Sıraya veya başka güne sürükle"><GripVertical size={17}/></button>
      <button className="video-queue-play" data-video-drag-source draggable={false} aria-pressed={selected?.id===video.id} onClick={()=>open(video)}><span className="video-order-number">{index+1}</span><span className="video-queue-title"><strong>{video.title}</strong><small>{filter==='all'?(videoDays(state,video.id).map(day=>day.day).join(' · ')||'Kütüphane'):'Her hafta '+activeDay.day.toLocaleLowerCase('tr-TR')}</small></span><Play size={17} data-video-no-drag/></button>
      <span className="video-row-actions"><button className="icon-button video-edit-button" aria-label={video.title+' videosunu düzenle'} title="Video adını düzenle" onClick={()=>setEditId(video.id)}><Pencil size={16}/></button><button className="icon-button video-copy-button" aria-label={video.title+' videosunu başka güne kopyala'} title="Başka güne kopyala" onClick={()=>setCopyId(video.id)}><Copy size={16}/></button><button className="icon-button video-delete-button" aria-label={video.title+' videosunu sil'} title="Videoyu sil" onClick={()=>setRemoveId(video.id)}><Trash2 size={16}/></button></span>
      <span className="video-order-buttons"><button className="icon-button" disabled={index===0} aria-label={video.title+' videosunu yukarı taşı'} onClick={()=>reorder(video.id,index-1)}><ChevronUp size={15}/></button><button className="icon-button" disabled={index===filtered.length-1} aria-label={video.title+' videosunu aşağı taşı'} onClick={()=>reorder(video.id,index+1)}><ChevronDown size={15}/></button></span>
    </li>)}
   </ol>}
   <button className={'add-to-video-day '+(drag?.target?.kind==='end'?'video-drop-end':'')} data-video-drop-end onClick={addVideo}><Plus size={17}/>{activeDay?activeDay.day+' listesine video ekle':'Video ekle'}</button>
  </section>
  </div>
  {drag&&<div className="video-drag-preview" aria-hidden="true" style={{left:Math.min(drag.x+14,Math.max(8,document.documentElement.clientWidth-238)),top:Math.min(drag.y+16,document.documentElement.clientHeight-65)}}><GripVertical size={15}/><span>{state.videos.find(video=>video.id===drag.id)?.title}<small>{drag.target?.kind==='day'?'Güne kopyala · kaynakta kalır':'Sıraya bırak · Esc ile vazgeç'}</small></span></div>}
  <span className="sr-only" role="status" aria-live="polite">{drag?(drag.target?.kind==='day'?VIDEO_DAYS.find(day=>day.id===drag.target.day)?.day+' gününe kopyalanacak.':'Video sürükleniyor. Sıraya veya bir güne bırakabilirsin.') :''}</span>
  {copyId&&state.videos.some(video=>video.id===copyId)&&<CopyVideoDialog video={state.videos.find(video=>video.id===copyId)} linkedDays={videoDays(state,copyId).map(day=>day.id)} onClose={()=>setCopyId(null)} onCopy={days=>{copyToDays(copyId,days);setCopyId(null);}}/>}
  {editId&&state.videos.some(video=>video.id===editId)&&<EditVideoDialog key={editId} video={state.videos.find(video=>video.id===editId)} onClose={()=>setEditId(null)} onSave={title=>rename(editId,title)}/>}
  {removeId&&state.videos.some(video=>video.id===removeId)&&<DeleteVideoDialog video={state.videos.find(video=>video.id===removeId)} onClose={()=>setRemoveId(null)} onDelete={()=>remove(removeId)}/>}
  {selected&&<section className="saved-video-detail">
   <div className="section-title"><div><h2>{selected.title}</h2><span className="badge">{selectedIndex+1} / {filtered.length}</span></div><div className="row"><button onClick={()=>setEditId(selected.id)}><Pencil size={16}/>Düzenle</button><button className="icon-button" aria-label="Videoyu kütüphaneden kaldır" title="Videoyu sil" onClick={()=>setRemoveId(selected.id)}><Trash2 size={17}/></button></div></div>
   <section ref={playerRoot} className={"video-panel saved-video-player"+(expanded?" video-expanded":"")}>
    <div className="video-panel-head"><strong>VİDEON</strong><button type="button" onClick={toggleFullscreen} aria-label={expanded?"Tam ekrandan çık":"Videoyu tam ekran izle"}>{expanded?"Küçült ✕":"Tam ekran ⛶"}</button><span>{selected.local||offline?'İndirildi · Çevrimdışı':info?.kind==='youtube'?'YouTube':info?.kind==='embed'?'Vimeo':'Video bağlantısı'}</span></div>
    <div className="video-frame">
     {selected.local&&loading?<div className="empty"><LoaderCircle size={26} className="spin"/><p>Video açılıyor…</p></div>:playbackSource?<video key={selected.id+'-'+playbackSource+'-'+retry} src={playbackSource} controls playsInline preload="metadata" onError={()=>setError(offline?'Çevrimdışı video dosyası açılamadı. Yeniden yüklemeyi dene; internet bağlantısına geçilmedi.':'Bu dosyanın biçimi oynatılamıyor. MP4 biçimindeki bir kopyasını seçebilirsin.')}/>:
      native?<div className="native-video-launch"><span className="native-play-icon"><Play size={35}/></span><h3>{selected.title}</h3><p>Rota içindeki video penceresinde izle.</p><button className="primary" onClick={()=>open(selected)}><Play size={17}/>Uygulamada oynat</button></div>:
      !selected.local&&(info?.kind==='youtube'||info?.kind==='embed')?<iframe key={info.src+'-'+retry} src={info.src} title={selected.title} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen/>:
      info?.kind==='file'?<video key={info.src} src={info.src} controls playsInline onError={()=>setError('Bağlantıdaki video açılamadı. Adresi kontrol et veya cihazından dosya ekle.')}/>:
      <div className="empty"><Video size={28}/><h3>{selected.local?'Video dosyanı yeniden bağla.':'Bu bağlantı yerleşik oynatıcı sunmuyor.'}</h3><p>{selected.local?'Dosyanın yerini aşağıdan seçebilirsin.':'YouTube, Vimeo veya doğrudan MP4/WebM bağlantısı kullanabilirsin.'}</p></div>}
    </div>
   </section>
   {error&&<p className="error-text" role="alert">{error}</p>}
   <div className="video-footer-actions">
    <div className="video-sequence-navigation"><button disabled={selectedIndex<1} onClick={()=>open(filtered[selectedIndex-1])}><ArrowLeft size={15}/>Önceki</button><button disabled={selectedIndex===filtered.length-1} onClick={()=>open(filtered[selectedIndex+1])}>Sıradaki<ArrowRight size={15}/></button></div>
    {selected.local&&<label className="attach-file"><Upload size={16}/>Video dosyasını yeniden seç<input type="file" accept="video/*" onChange={reconnect}/></label>}
    {!selected.local&&!native&&<button onClick={()=>{setError('');setRetry(v=>v+1);}}><RotateCw size={15}/>Yeniden yükle</button>}
    {info&&<a href={info.original||info.src} target="_blank" rel="noopener" className="quiet small"><Link size={15}/>Orijinal bağlantı</a>}
    <button className="primary" onClick={()=>setModal({type:'session',initial:{title:selected.title,type:selected.type||'workout',videoId:selected.id,durationMinutes:null}})}><Check size={16}/>Çalıştım</button>
   </div>
   <details className="panel video-weekly-binding"><summary>Başka günlerde de göster</summary><p className="small muted">İstersen aynı videoyu birden fazla günün listesine ekleyebilirsin.</p><div className="video-day-choices">{VIDEO_DAYS.map(day=><button key={day.id} aria-pressed={videoDays(state,selected.id).some(value=>value.id===day.id)} onClick={()=>toggleDay(day.id)}>{videoDays(state,selected.id).some(value=>value.id===day.id)&&<Check size={14}/ >}{day.day}</button>)}</div></details>
  </section>}
 </>;
}

function EditVideoDialog({video,onClose,onSave}){
 const ref=useRef(null),[title,setTitle]=useState(video.title);
 useEffect(()=>{const dialog=ref.current;dialog.showModal();dialog.querySelector('input')?.select();return()=>dialog.close();},[]);
 return <dialog ref={ref} className="modal video-action-dialog" aria-labelledby="video-edit-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
  <form onSubmit={e=>{e.preventDefault();if(title.trim())onSave(title.trim());}}>
   <div className="modal-head"><h2 id="video-edit-title">Video adını düzenle</h2><button type="button" className="icon-button" aria-label="Düzenlemeyi kapat" onClick={onClose}><X size={20}/></button></div>
   <label>Video adı<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} required/></label>
   <p className="small muted">Video dosyası, bağlantısı, sırası ve eklendiği günler aynı kalır.</p>
   <div className="modal-actions"><button type="button" onClick={onClose}>Vazgeç</button><button type="submit" className="primary" disabled={!title.trim()}><Check size={16}/>Kaydet</button></div>
  </form>
 </dialog>;
}
function DeleteVideoDialog({video,onClose,onDelete}){
 const ref=useRef(null),[busy,setBusy]=useState(false);
 useEffect(()=>{const dialog=ref.current;dialog.showModal();dialog.querySelector('.cancel-delete')?.focus();return()=>dialog.close();},[]);
 return <dialog ref={ref} className="modal video-action-dialog" aria-labelledby="video-delete-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target===ref.current&&!busy)onClose();}}>
  <div className="modal-head"><h2 id="video-delete-title">Video silinsin mi?</h2><button className="icon-button" aria-label="Silmeyi kapat" disabled={busy} onClick={onClose}><X size={20}/></button></div>
  <p className="video-delete-name">{video.title}</p><p className="small muted">Kütüphanenden ve eklendiği tüm günlerden kaldırılacak. Diğer videoların değişmez.</p>
  <div className="modal-actions"><button className="cancel-delete" disabled={busy} onClick={onClose}>Vazgeç</button><button className="danger" disabled={busy} onClick={()=>{setBusy(true);onDelete();}}><Trash2 size={16}/>Videoyu sil</button></div>
 </dialog>;
}
function CopyVideoDialog({video,linkedDays,onClose,onCopy}){
 const ref=useRef(null),[days,setDays]=useState([]),today=currentDay();
 useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
 return <dialog ref={ref} className="modal video-copy-dialog" aria-labelledby="video-copy-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
  <div className="modal-head"><div><h2 id="video-copy-title">Başka güne kopyala</h2><p>{video.title}</p></div><button className="icon-button" aria-label="Kopyalamayı kapat" onClick={onClose}><X size={20}/></button></div>
  <p className="small muted">Kaynak gününde kalır. Seçtiğin günlerin haftalık listesine eklenir; videoyu yeniden yüklemene gerek yok.</p>
  <fieldset className="video-copy-days"><legend>Hangi günlerde de olsun?</legend>{VIDEO_DAYS.map(day=>{const exists=linkedDays.includes(day.id);return <label key={day.id} className={exists?'already-linked':''}><input type="checkbox" aria-label={day.day} checked={exists||days.includes(day.id)} disabled={exists} onChange={e=>setDays(previous=>e.target.checked?[...previous,day.id]:previous.filter(id=>id!==day.id))}/><span>{day.day}{today===day.id&&<small>Bugün</small>}</span>{exists&&<small>Zaten ekli</small>}</label>;})}</fieldset>
  <div className="modal-actions"><button onClick={onClose}>Vazgeç</button><button className="primary" disabled={!days.length} onClick={()=>onCopy(days)}><Copy size={16}/>{days.length?days.length+' güne kopyala':'Gün seç'}</button></div>
 </dialog>;
}

