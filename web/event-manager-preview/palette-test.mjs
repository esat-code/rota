import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const {outputFiles} = await build({
  stdin: {contents: `import React,{useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {ColorPalette,colorValue} from './components/ui/color-palette';
    function Demo(){const [single,setSingle]=useState('blue'),[multi,setMulti]=useState([]);
      return <form onSubmit={e=>{e.preventDefault();window.submitted=true;}}>
        <ColorPalette value={single} onChange={setSingle} label="Etkinlik rengi"/>
        <ColorPalette multiple values={multi} onChange={id=>setMulti(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])} label="Renge göre filtrele"/>
        <output>{single}:{multi.join(',')}:{colorValue(single)}</output>
      </form>;}
    createRoot(document.getElementById('root')).render(<Demo/>);`, loader: 'tsx', resolveDir: process.cwd()},
  write: false, bundle: true, format: 'iife', jsx: 'automatic'
});
const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true});
const {window:w} = dom;
const wait = () => new Promise(resolve=>setTimeout(resolve,30));
w.eval(outputFiles[0].text);
await wait();
const doc = w.document;
const single = doc.querySelector('[role=radiogroup]');
const multi = doc.querySelector('[role=group]');
assert.equal(single.querySelectorAll('button').length,7);
assert.equal(single.textContent,'');
assert.equal(multi.textContent,'');
assert.equal(single.querySelectorAll('[tabindex="0"]').length,1);
assert.equal(single.querySelector('[aria-checked=true]').getAttribute('aria-label'),'Mavi');
single.querySelector('[aria-label="Mor"]').click(); await wait();
assert.equal(single.querySelector('[aria-checked=true]').getAttribute('aria-label'),'Mor');
assert.equal(doc.querySelector('output').textContent,'purple::#aa8ddd');
const purple = single.querySelector('[aria-label="Mor"]');
purple.focus();
purple.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await wait();
assert.equal(doc.activeElement.getAttribute('aria-label'),'Turuncu');
assert.equal(single.querySelector('[aria-checked=true]').getAttribute('aria-label'),'Turuncu');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));await wait();
assert.equal(single.querySelector('[aria-checked=true]').getAttribute('aria-label'),'Renksiz');
assert.equal(doc.querySelector('output').textContent,'none::transparent');
doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await wait();
assert.equal(single.querySelector('[aria-checked=true]').getAttribute('aria-label'),'Mavi');
for (const name of ['Mavi','Yeşil']) {multi.querySelector(`[aria-label="${name}"]`).click();await wait();}
assert.equal(multi.querySelectorAll('[aria-pressed=true]').length,2);
multi.querySelector('[aria-label="Mavi"]').click();await wait();
assert.equal(multi.querySelectorAll('[aria-pressed=true]').length,1);
assert.equal(multi.querySelector('[aria-pressed=true]').getAttribute('aria-label'),'Yeşil');
multi.querySelector('[aria-label="Renksiz"]').click();await wait();
assert.equal(multi.querySelector('[aria-label="Renksiz"]').getAttribute('aria-pressed'),'true');
assert.equal(multi.querySelectorAll('[aria-pressed=true]').length,2);
single.querySelector('[aria-label="Renksiz"]').click();await wait();
assert.equal(doc.querySelector('output').textContent,'none:green,none:transparent');
assert.equal(single.querySelectorAll('[tabindex="0"]').length,1);
assert.equal(w.submitted,undefined);
dom.window.close();
console.log('Palette passed: seven swatches including Renksiz, accessible names, single/multiple selection, keyboard wrap, stable IDs/colors, no form submission.');
