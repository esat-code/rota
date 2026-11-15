import {useLayoutEffect,useRef,useState} from 'react';

/** One stable portal target: moving it never remounts the WebGL canvas. */
export function useAvatarOverlay({expanded,onClose,slotRef,figureRef}){
 const [host]=useState(()=>{const element=document.createElement('div');element.className='body-avatar-host';return element;});
 const opener=useRef(null);
 const rememberOpener=()=>{const element=document.activeElement;opener.current={element,label:element?.getAttribute('aria-label')};};
 useLayoutEffect(()=>{
  slotRef.current?.appendChild(host);
  return()=>host.remove();
 },[host,slotRef]);
 useLayoutEffect(()=>{
  if(!expanded)return;
  // A fixed descendant of WebKit's sticky, scrolling sidebar can be clipped or
  // have incorrect hit testing. Put the stable host directly under body instead.
  host.classList.add('is-overlay');document.body.appendChild(host);
  const oldOverflow=document.body.style.overflow;
  const roots=[...document.body.children].filter(element=>element!==host&&element instanceof HTMLElement&&!['SCRIPT','STYLE','LINK'].includes(element.tagName));
  const previous=roots.map(element=>({element,inert:element.inert,hidden:element.getAttribute('aria-hidden')}));
  for(const element of roots){element.inert=true;element.setAttribute('aria-hidden','true');}
  document.body.style.overflow='hidden';
  const closeButton=()=>figureRef.current?.querySelector('[data-avatar-close]');
  closeButton()?.focus({preventScroll:true});
  const keys=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
   if(event.key!=='Tab')return;
   const nodes=[...host.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length&&!element.closest('[hidden]'));
   const first=nodes[0],last=nodes.at(-1),active=document.activeElement;
   if(!host.contains(active)||(event.shiftKey&&active===first)||(!event.shiftKey&&active===last)){
    event.preventDefault();(event.shiftKey?last:first)?.focus({preventScroll:true});
   }
  };
  document.addEventListener('keydown',keys,true);
  return()=>{
   document.removeEventListener('keydown',keys,true);
   for(const {element,inert,hidden}of previous){element.inert=inert;if(hidden===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',hidden);}
   document.body.style.overflow=oldOverflow;
   host.classList.remove('is-overlay');
   if(slotRef.current?.isConnected)slotRef.current.appendChild(host);else host.remove();
   const {element:target,label}=opener.current||{};
   queueMicrotask(()=>{
    if(target?.isConnected&&!target.closest('[inert]'))target.focus({preventScroll:true});
    else {
     const equivalent=[...slotRef.current?.querySelectorAll('button')||[]].find(button=>button.getAttribute('aria-label')===label);
     (equivalent||slotRef.current?.querySelector('button[aria-label="Vücut görünümünü büyüt"]'))?.focus({preventScroll:true});
    }
   });
  };
 },[expanded,host,onClose,slotRef,figureRef]);
 return {host,rememberOpener};
}
