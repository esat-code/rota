import React,{useEffect,useState}from'react';
/** The supplied scramble/reveal idea, bounded to headings and reduced-motion safe. */
export function SpecialText({children}){
 const text=String(children),[display,set]=useState(text);
 useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches){set(text);return;}
 const chars='_!X0-+*',start=performance.now(),duration=600;let frame;
 const animate=now=>{const progress=Math.min(1,(now-start)/duration),revealed=Math.floor(progress*text.length);
 set([...text].map((c,i)=>c===' '||i<revealed?c:chars[(i+Math.floor(now/55))%chars.length]).join(''));
 if(progress<1)frame=requestAnimationFrame(animate);else set(text);};frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame);
 },[text]);
 return<span className="special-text"><span className="sr-only">{text}</span><span className="text-size-reserve" aria-hidden="true">{text}</span><span className="text-reveal" aria-hidden="true">{display}</span></span>;
}
