import {readFile,writeFile,mkdir} from 'node:fs/promises';
const files=['styles/planner.css','styles/design-studio.css','styles/editor-workspace.css'];
const css=(await Promise.all(files.map(path=>readFile(path,'utf8')))).join('\n');
await mkdir('dist',{recursive:true});
await writeFile('dist/board-export-styles.js','window.hafizlikExportCSS='+JSON.stringify(css)+';\n');
