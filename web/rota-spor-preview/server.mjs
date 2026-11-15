import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.task':'application/octet-stream','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}await stat(file);const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404).end('Bulunamadı');}}).listen(8777,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8777/'));
