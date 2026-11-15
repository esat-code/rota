import {build} from 'esbuild';
import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['app.jsx'],outfile:'dist/app.js',bundle:true,format:'iife',target:'safari16',minify:true,nodePaths:['../hafizlik-takip/node_modules'],loader:{'.obj':'text','.target':'text'},define:{'process.env.NODE_ENV':'"production"'}});
for(const file of ['index.html','style.css','body-avatar.css','video-library.css']) await copyFile(file,'dist/'+file);
await cp('assets','dist/assets',{recursive:true});
console.log('Spor önizlemesi hazır.');
