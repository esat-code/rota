import {build} from 'esbuild';
await build({entryPoints:['app.tsx'],bundle:true,format:'esm',outfile:'dist/app.js',jsx:'automatic',minify:true});
