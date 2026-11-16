import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve, extname, basename} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const source=resolve(root,'web/hafizlik-takip');
const output=resolve(root,'app-dist');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
const excluded=new Set(['node_modules','tests','scripts','.git','exports']);
await cp(source,output,{recursive:true,filter:path=>{
 if(excluded.has(basename(path)))return false;
 return !['.swift','.map','.icns','.zip','.pdf'].includes(extname(path));
}});
// Packaged apps store data on this device until a real sync service is configured.
const sync=resolve(output,'rota-sync.js');
await writeFile(sync,"window.rotaOpenSyncSettings=()=>alert('Bu sürümde kayıtlar bu cihazda saklanır. Cihazlar arası eşitleme henüz hazır değil.');\n");
const html=await readFile(resolve(output,'index.html'),'utf8');
if(!html.includes('dist/app-shell.js'))throw Error('Rota entry point missing');
console.log('Ortak uygulama dosyaları app-dist içine hazırlandı.');
