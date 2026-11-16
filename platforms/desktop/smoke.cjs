const {app,BrowserWindow,session}=require('electron');
app.whenReady().then(()=>session.defaultSession.webRequest.onErrorOccurred(details=>console.error('RESOURCE',details.url,details.error))); 
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const profile=mkdtempSync(join(tmpdir(),'rota-smoke-'));
app.setPath('userData',profile);
let timer=setTimeout(()=>{console.error('Rota smoke timeout');app.exit(1);},45000);
app.on('web-contents-created',(_,contents)=>{
 contents.once('did-finish-load',async()=>{
  if(!contents.getURL().startsWith('rota://app/'))return;
  try{
   await new Promise(resolve=>setTimeout(resolve,2500));
   const result=await contents.executeJavaScript(`(() => {
    const key='rota-smoke-test';localStorage.setItem(key,'ok');const stored=localStorage.getItem(key);localStorage.removeItem(key);
    return {title:document.title,stored,home:!!document.querySelector('#rota-home'),planner:!!document.querySelector('#hafizlik-tik-denemesi'), homeStyled:!!document.querySelector('#rota-home').contentDocument.querySelector('link[rel=stylesheet]').sheet};
   })()`);
   if(result.title!=='Rota'||result.stored!=='ok'||!result.home||!result.planner||!result.homeStyled)throw Error(JSON.stringify(result));
   console.log('PASS: packaged Rota loads and local storage works',result);
   clearTimeout(timer);app.quit();
  }catch(error){console.error(error);app.exit(1);}
 });
});
// Isolated temporary profile is left to the OS to clean after Chromium shuts down.
require('./main.cjs');
