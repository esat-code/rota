import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Deliberately build only the calendar, leaving the other working modules intact.
const project=fileURLToPath(new URL('..',import.meta.url));
const source=path.resolve(project,'../event-manager-preview');
const destination=path.join(project,'calendar');
await mkdir(destination,{recursive:true});
await build({entryPoints:[path.join(source,'app.tsx')],outfile:path.join(destination,'app.js'),bundle:true,minify:true,format:'iife',target:'safari16',define:{'process.env.NODE_ENV':'"production"'}});
for(const file of ['styles.css','color-palette.css','special-days.css'])await copyFile(path.join(source,file),path.join(destination,file));
const html=(await readFile(path.join(source,'index.html'),'utf8')).replace('<head>','<head><script>window.ROTA_CALENDAR_EMBEDDED=true;</script>').replace('<script type="module" src="dist/app.js"></script>','<script defer src="./app.js"></script>');
await writeFile(path.join(destination,'index.html'),html);
console.log('Built only the embedded calendar: '+destination);
