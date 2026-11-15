import renderMathInElement from 'katex/contrib/auto-render';
import {pages01} from './notes-pages-01.js';
import {pages15} from './notes-pages-15.js';
import {pages29} from './notes-pages-29.js';
import {pages44} from './notes-pages-44.js';

// Upload order is authoritative, including repeated photographs and unfinished work.
export const mathNotes=[...pages01,...pages15,...pages29,...pages44];
let selected=0,zoom=100;
const rotations=new Map();
let sizeObserver;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function notesHTML(){
  if(!mathNotes.length)return "<p>Henüz not eklenmedi. Not kütüphanesinden kendi dosyalarını ekleyebilirsin.</p>";
  const p=mathNotes[selected];
  const angle=rotations.get(p.number)||0;
  return '<section class="notes-library" aria-label="Temel matematik defterim"><div class="notes-toolbar"><label class="notes-page-label">Sayfa<select id="notes-page" aria-label="Not sayfası">'+mathNotes.map((n,i)=>'<option value="'+i+'" '+(i===selected?'selected':'')+'>'+n.number+'. '+escapeHTML(n.title)+'</option>').join('')+'</select></label><div class="row"><button data-note-step="-1" '+(selected===0?'disabled':'')+' aria-label="Önceki not sayfası">‹</button><span class="notes-position" aria-live="polite">'+(selected+1)+' / '+mathNotes.length+'</span><button data-note-step="1" '+(selected===mathNotes.length-1?'disabled':'')+' aria-label="Sonraki not sayfası">›</button></div><div class="row notes-zoom"><button data-note-zoom="-10" aria-label="Notu küçült" '+(zoom<=70?'disabled':'')+'>−</button><button data-note-zoom="reset" aria-label="Not boyutunu sıfırla">%'+zoom+'</button><button data-note-zoom="10" aria-label="Notu büyüt" '+(zoom>=160?'disabled':'')+'>+</button></div></div>'+
    '<div class="notes-rotation row" role="group" aria-label="Sayfa yönü"><span>Sayfa yönü</span><button data-note-rotate="-90" title="Sola 90° döndür" aria-label="Sayfayı sola döndür">↶</button><button data-note-rotate="180" title="180° ters çevir" aria-label="Sayfayı ters çevir">180°</button><button data-note-rotate="90" title="Sağa 90° döndür" aria-label="Sayfayı sağa döndür">↷</button><button data-note-rotate="reset" title="Düz konuma getir" aria-label="Sayfayı düz konuma getir" '+(angle===0?'disabled':'')+'>Düz</button><span class="notes-angle" aria-live="polite">'+angle+'°</span></div>'+
    '<div class="note-scroll" tabindex="0" role="region" aria-label="Dijital defter sayfası"><div class="note-rotation-stage" data-note-angle="'+angle+'"><article class="note-paper" style="--note-zoom:'+zoom/100+';--note-angle:'+angle+'deg" data-note-number="'+p.number+'"><header class="note-paper-head"><h2>'+escapeHTML(p.title)+'</h2><span>'+p.number+'</span></header>'+p.html+'</article></div></div>'+
    '<details class="notes-original"><summary>El yazısı aslını karşılaştır</summary><img loading="lazy" src="./assets/math-notes/'+(p.originalFile||String(p.number).padStart(2,'0')+'.jpg')+'" alt="'+p.number+'. gönderilen defter fotoğrafı: '+escapeHTML(p.title)+'"></details></section>';
}
export function renderNotesMath(){
  sizeObserver?.disconnect();
  const paper=document.querySelector('.note-paper');
  if(!paper)return;
  renderMathInElement(paper,{delimiters:[{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,strict:'ignore',trust:false});
  // Transforms do not affect layout. Reserve the rotated footprint so no edge
  // disappears outside the scrollable area, including after fonts finish loading.
  const fit=()=>{
    if(!paper.isConnected)return;
    const stage=paper.parentElement,sideways=Number(stage.dataset.noteAngle)%180!==0;
    stage.style.width=(sideways?paper.offsetHeight:paper.offsetWidth)+'px';
    stage.style.height=(sideways?paper.offsetWidth:paper.offsetHeight)+'px';
  };
  fit();
  sizeObserver=new ResizeObserver(fit);
  sizeObserver.observe(paper);
}
export function handleNoteClick(button,redraw){
  if(button.dataset.noteRotate){
    const page=mathNotes[selected]?.number,turn=Number(button.dataset.noteRotate);
    if(button.dataset.noteRotate==='reset')rotations.delete(page);
    else if([-90,90,180].includes(turn))rotations.set(page,((rotations.get(page)||0)+turn+360)%360);
    redraw();return true;
  }
  if(button.dataset.noteStep){selected=Math.max(0,Math.min(mathNotes.length-1,selected+Number(button.dataset.noteStep)));redraw();return true;}
  if(button.dataset.noteZoom){zoom=button.dataset.noteZoom==='reset'?100:Math.max(70,Math.min(160,zoom+Number(button.dataset.noteZoom)));redraw();return true;}
  return false;
}
export function selectNote(value,redraw){
  const index=Number(value);
  if(Number.isInteger(index)&&index>=0&&index<mathNotes.length){selected=index;redraw();}
}
