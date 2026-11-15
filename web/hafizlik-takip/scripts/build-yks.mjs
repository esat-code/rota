import {build} from 'esbuild';
import {cp,mkdir} from 'node:fs/promises';
await mkdir('yks/assets/katex',{recursive:true});
await cp('node_modules/katex/dist/katex.min.css','yks/assets/katex/katex.min.css');
await cp('node_modules/katex/dist/fonts','yks/assets/katex/fonts',{recursive:true});
await cp('node_modules/katex/LICENSE','yks/assets/katex/LICENSE');
await build({entryPoints:['yks/main.js'],outfile:'yks/app.js',bundle:true,minify:true,format:'iife',target:'safari16'});
await build({entryPoints:['app-shell.js'],outfile:'dist/app-shell.js',bundle:true,minify:true,format:'iife',target:'safari16',loader:{'.html':'text'}});
console.log('YKS and embedded shell built; other workspaces unchanged.');
