import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await mkdir('dist',{recursive:true});
await build({entryPoints:['app.tsx'],outfile:'dist/app.js',bundle:true,minify:true,target:'safari16',tsconfig:'tsconfig.json',define:{'process.env.NODE_ENV':'"production"'}});
execFileSync(process.execPath,['node_modules/@tailwindcss/cli/dist/index.mjs','-i','styles/globals.css','-o','dist/styles.css','--minify'],{stdio:'inherit'});
await copyFile('index.html','dist/index.html');
await copyFile('node_modules/world-atlas/countries-110m.json','dist/countries-110m.json');
