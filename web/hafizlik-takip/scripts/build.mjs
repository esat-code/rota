import { build } from "esbuild"
import { mkdir, copyFile, cp } from "node:fs/promises"
import { execFileSync } from "node:child_process"
execFileSync(process.execPath, ["scripts/build-export-styles.mjs"], {stdio:"inherit"})
await mkdir("dist", { recursive: true })
await build({entryPoints:["theme-entry.tsx"], outfile:"dist/theme-toggle.js", bundle:true, minify:true, platform:"browser", target:"safari16", define:{"process.env.NODE_ENV":'"production"'}, tsconfig:"tsconfig.json"})
execFileSync(process.execPath, ["../../node_modules/@tailwindcss/cli/dist/index.mjs", "-i", "styles/globals.css", "-o", "dist/theme-toggle.css", "--minify"], {stdio:"inherit"})
await mkdir("home", {recursive:true})
for (const file of ["styles.css", "index.html"]) await copyFile("../home-atmosphere-preview/dist/" + file, "home/" + file)
await build({entryPoints:["../home-atmosphere-preview/dist/main.js"],outfile:"home/app.js",bundle:true,minify:true,format:"iife",target:"safari16"})
await build({entryPoints:["../contact-globe-preview/entry-globe.tsx"],outfile:"home/entry-globe.js",bundle:true,minify:true,format:"iife",target:"safari16",tsconfig:"../contact-globe-preview/tsconfig.json",define:{"process.env.NODE_ENV":'"production"'}})
await copyFile("home/entry-globe.js","../home-atmosphere-preview/dist/entry-globe.js")
await mkdir("calendar",{recursive:true})
await build({entryPoints:["../event-manager-preview/app.tsx"],outfile:"calendar/app.js",bundle:true,minify:true,format:"iife",target:"safari16",define:{"process.env.NODE_ENV":'"production"'}})
for(const file of ["styles.css","color-palette.css","special-days.css"]) await copyFile("../event-manager-preview/"+file,"calendar/"+file)
const {readFile,writeFile}=await import("node:fs/promises");
let calendarHTML=await readFile("../event-manager-preview/index.html","utf8");
calendarHTML=calendarHTML.replace("<head>","<head><script>window.ROTA_CALENDAR_EMBEDDED=true;</script>").replace('<script type="module" src="dist/app.js"></script>','<script defer src="./app.js"></script>');
await writeFile("calendar/index.html",calendarHTML);
execFileSync(process.execPath,["build.mjs"],{cwd:"../rota-spor-preview",stdio:"inherit"});
await cp("../rota-spor-preview/dist","sport",{recursive:true});
await build({entryPoints:["app-shell.js"],outfile:"dist/app-shell.js",bundle:true,minify:true,format:"iife",target:"safari16",loader:{".html":"text"}})
await build({entryPoints:["yks/main.js"],outfile:"yks/app.js",bundle:true,minify:true,format:"iife",target:"safari16"})
