const {app,BrowserWindow,protocol,net,shell}=require('electron');
const {resolve,sep}=require('node:path');
const {pathToFileURL}=require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'rota',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
const root=resolve(__dirname,'../../app-dist');
function external(url){try{if(['https:','http:','mailto:'].includes(new URL(url).protocol))shell.openExternal(url);}catch{}}
function createWindow(){
 const window=new BrowserWindow({width:1400,height:940,minWidth:360,minHeight:600,backgroundColor:'#08090b',icon:resolve(root,'branding/rota-app-icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('rota://app/')){event.preventDefault();external(url);}});
 window.loadURL('rota://app/index.html');
}
app.whenReady().then(()=>{
 protocol.handle('rota',request=>{
  const url=new URL(request.url);
  const file=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(url.hostname!=='app'||!file.startsWith(root+sep))return new Response('Not found',{status:404});
  return net.fetch(pathToFileURL(file).href);
 });
 createWindow();
 app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
