import {useEffect,useRef,useState} from 'react';
import {videoDropIndex} from './video-queue.js';

// Pointer capture works in the desktop WKWebView as well as with touch. Native
// HTML dragging from a nested button is unreliable there, so no DataTransfer
// state or browser drag image is needed.
export function useVideoQueueDrag({root,day,ids,onReorder,onCopy}){
 const [drag,setDrag]=useState(null),gesture=useRef(null),latest=useRef(null),blockedClick=useRef(0);
 latest.current={day,ids,onReorder,onCopy};
 useEffect(()=>{
  let animation=0;
  function hit(g){
   const element=document.elementFromPoint(g.x,g.y);
   if(!element||!root.current?.contains(element))return null;
   const dayTarget=element.closest('[data-video-drop-day]');
   if(dayTarget)return {kind:'day',day:Number(dayTarget.dataset.videoDropDay)};
   const row=element.closest('[data-video-row-id]');
   if(row){
    const target=g.ids.indexOf(row.dataset.videoRowId),from=g.ids.indexOf(g.id);
    if(target<0)return null;
    const box=row.getBoundingClientRect(),after=g.y>box.top+box.height/2;
    return {kind:'row',id:row.dataset.videoRowId,after,index:videoDropIndex(from,target,after)};
   }
   if(element.closest('[data-video-drop-end]'))return {kind:'end',index:g.ids.length-1};
   return null;
  }
  function paint(g){g.target=hit(g);setDrag({id:g.id,x:g.x,y:g.y,target:g.target});}
  function scroll(){
   const g=gesture.current;if(!g?.active)return;
   const edge=64,height=document.documentElement.clientHeight;
   const delta=g.y<edge?-Math.ceil((edge-g.y)/5):g.y>height-edge?Math.ceil((g.y-height+edge)/5):0;
   if(delta){window.scrollBy(0,Math.max(-18,Math.min(18,delta)));paint(g);}
   animation=requestAnimationFrame(scroll);
  }
  function finish(commit=false){
   const g=gesture.current;if(!g)return;
   gesture.current=null;cancelAnimationFrame(animation);
   document.documentElement.classList.remove('video-queue-is-dragging');
   if(g.element.hasPointerCapture?.(g.pointerId))g.element.releasePointerCapture(g.pointerId);
   if(g.active){
    blockedClick.current=Date.now()+400;setDrag(null);
    if(commit&&g.target?.kind==='day')latest.current.onCopy(g.id,g.target.day);
    else if(commit&&g.target&&(g.target.kind==='row'||g.target.kind==='end'))latest.current.onReorder(g.day,g.id,g.target.index);
   }
  }
  function move(event){
   const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;
   g.x=event.clientX;g.y=event.clientY;
   if(!g.active&&Math.hypot(g.x-g.startX,g.y-g.startY)<6)return;
   if(event.cancelable)event.preventDefault();
   if(!g.active){g.active=true;document.documentElement.classList.add('video-queue-is-dragging');animation=requestAnimationFrame(scroll);}
   paint(g);
  }
  function up(event){
   const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;
   if(g.active){g.x=event.clientX;g.y=event.clientY;g.target=hit(g);if(event.cancelable)event.preventDefault();}
   finish(true);
  }
  function cancel(){finish();}
  function key(event){if(event.key==='Escape'&&gesture.current){event.preventDefault();cancel();}}
  function click(event){if(Date.now()<blockedClick.current){blockedClick.current=0;event.preventDefault();event.stopImmediatePropagation();}}
  function down(){blockedClick.current=0;}
  function visibility(){if(document.hidden)cancel();}
  window.addEventListener('pointerdown',down,true);
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up);
  window.addEventListener('pointercancel',cancel);
  window.addEventListener('blur',cancel);
  window.addEventListener('keydown',key);
  window.addEventListener('click',click,true);
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   // Unmounting/navigation must never leave a grab cursor or a click blocker.
   cancel();blockedClick.current=0;
   window.removeEventListener('pointerdown',down,true);
   window.removeEventListener('pointermove',move);
   window.removeEventListener('pointerup',up);
   window.removeEventListener('pointercancel',cancel);
   window.removeEventListener('blur',cancel);
   window.removeEventListener('keydown',key);
   window.removeEventListener('click',click,true);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[root]);
 function begin(event,id){
  if(event.button!==0||event.isPrimary===false||gesture.current)return;
  const element=event.target.closest('[data-video-drag-source]');if(!element)return;
  // The explicit play icon and all other controls remain ordinary buttons.
  if(event.target.closest('[data-video-no-drag]'))return;
  gesture.current={id,day:latest.current.day,ids:[...latest.current.ids],element,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,target:null};
  element.setPointerCapture?.(event.pointerId);
 }
 return {drag,begin};
}
