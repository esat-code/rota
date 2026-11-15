import {copyFile} from 'node:fs/promises';
import {build} from 'esbuild';

// Only the home layout and the shell containing its HTML need rebuilding.
for (const file of ['index.html', 'styles.css']) {
  await copyFile('../home-atmosphere-preview/dist/' + file, 'home/' + file);
}
await build({entryPoints:['app-shell.js'],outfile:'dist/app-shell.js',bundle:true,minify:true,format:'iife',target:'safari16',loader:{'.html':'text'}});
await build({entryPoints:['../home-atmosphere-preview/dist/main.js'],outfile:'home/app.js',bundle:true,minify:true,format:'iife',target:'safari16'});
