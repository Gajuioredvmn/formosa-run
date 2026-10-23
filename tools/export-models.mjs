#!/usr/bin/env node
/** Export the exact web vehicle designs as portable glTF 2.0 binary assets.
 * Usage: node tools/export-models.mjs [--browser /path/to/chrome] [--out assets/models]
 * Requires Playwright and an installed Chromium/Edge browser. All requests remain
 * on the temporary loopback server; no rendering service or external API is used.
 */
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
if (args.includes('--help')) {
  console.log('node tools/export-models.mjs [--browser ChromiumExecutable] [--out assets/models]');
  process.exit(0);
}
const output = path.resolve(root, option('--out') || 'assets/models');
const browserPath = option('--browser') || process.env.FORMOSA_BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => existsSync(p));
let playwright;
for (const location of [process.env.FORMOSA_PLAYWRIGHT, 'playwright',
  path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]) {
  if (!location) continue;
  try { playwright = require(location); break; } catch { /* Try normal and bundled dependencies. */ }
}
if (!playwright) throw new Error('Playwright is required. Install it in the project or set FORMOSA_PLAYWRIGHT to its package directory.');
for (const file of ['vendor/three.module.js', 'vendor/GLTFExporter.js', 'render/cars.js']) {
  if (!existsSync(path.join(root, file))) throw new Error(`Missing ${file}; use the matching official Three.js 0.186.1 exporter.`);
}
const source = readFileSync(path.join(root, 'index.html'), 'utf8');
const from = source.indexOf('function keyed(keys)'), to = source.indexOf('// ===================== the cars, pixel');
if (from < 0 || to <= from) throw new Error('Cannot locate the original CARS/CREW specification block.');
const specifications = source.slice(from, to);
const html = `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script></head><body><script type="module">
import * as T from '/vendor/three.module.js';
import { GLTFExporter } from '/vendor/GLTFExporter.js';
import { createCar, createTraffic } from '/render/cars.js';
const lerp=(a,b,t)=>a+(b-a)*t;
${specifications}
const traffic=['sedan','taxi','pickup','bluetruck','bus','gravel','scooter','suv','wagon','rebar','logs','train'];
// Re-index merged geometry without welding hard normals or UV seams. This saves
// download size and GPU memory, while retaining the web model's exact surfaces.
function reindex(g){
  if(g.index)return;
  const entries=Object.entries(g.attributes), count=g.attributes.position.count;
  const values=entries.map(()=>[]), indices=[], known=new Map();
  for(let i=0;i<count;i++){
    const components=entries.flatMap(([,a])=>Array.from({length:a.itemSize},(_,j)=>a.array[i*a.itemSize+j]));
    const key=components.map(v=>Math.round(v*1e6)).join(',');let target=known.get(key);
    if(target===undefined){target=known.size;known.set(key,target);entries.forEach(([,a],n)=>{for(let j=0;j<a.itemSize;j++)values[n].push(a.array[i*a.itemSize+j]);});}
    indices.push(target);
  }
  entries.forEach(([name,a],n)=>g.setAttribute(name,new T.Float32BufferAttribute(values[n],a.itemSize)));
  g.setIndex(indices);g.computeBoundingSphere();
}
function cleanAndCount(model){
  let triangles=0,meshes=0;const nodes=[];
  model.traverse(node=>{
    if(node.name)nodes.push(node.name);
    const metadata={};for(const key of ['index','front','radius','type','side','wheelZ','wheelY','handSpan','shoulder','target']){
      const value=node.userData[key];if(['string','number','boolean'].includes(typeof value)||(Array.isArray(value)&&value.every(Number.isFinite)))metadata[key]=value;
    }
    node.userData=metadata;
    if(node.isMesh){reindex(node.geometry);triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;meshes++;}
  });return {triangles,meshes,nodes};
}
function base64(buffer){const a=new Uint8Array(buffer);let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);}
function dispose(model){const geometries=new Set(),materials=new Set(),textures=new Set();model.traverse(n=>{if(!n.isMesh)return;geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){materials.add(m);if(m.map)textures.add(m.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
window.exportModels=async()=>{
  const exporter=new GLTFExporter(),files=[];
  const jobs=[...CARS.map(spec=>({id:spec.id,category:'player',spec})),...traffic.map(id=>({id,category:'traffic'}))];
  for(const job of jobs){
    const model=job.category==='player'?createCar(T,job.spec,CREW[job.id]):createTraffic(T,job.id,0,{detail:'low'});
    const width=model.userData.width,length=model.userData.length;
    const details=cleanAndCount(model);model.name=job.category+'_'+job.id;
    const buffer=await exporter.parseAsync(model,{binary:true,onlyVisible:true,trs:true,maxTextureSize:512});
    if(!(buffer instanceof ArrayBuffer))throw Error('Exporter did not produce binary glTF.');
    const entry={id:job.id,category:job.category,lod:job.category==='player'?'hero':'mobile',file:(job.category==='player'?'car-':'traffic-')+job.id+'.glb',width,length,...details};
    await window.saveModel(entry,base64(buffer));files.push(entry);dispose(model);
  }
  return files;
};window.exportReady=true;
</script></body></html>`;

await fs.mkdir(output, { recursive: true });
const manifest = { format: 'glTF 2.0', generator: 'FORMOSA RUN / Three.js 0.186.1',
  coordinates: { unit: 'metre', up: '+Y', forward: '-Z', wheelContactY: 0 },
  rig: 'Procedural named nodes; wheel *_steer / *_spin, driver_head, passenger_head, steering_wheel, brake_lights.',
  files: [] };
const mime = { '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  if (request.url === '/__model_export.html') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return; }
  let target;
  try { target = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); }
  catch { response.writeHead(400).end(); return; }
  if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(target).then(data => { response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); response.end(data); })
    .catch(() => response.writeHead(404).end());
});
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await playwright.chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}), args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', error => console.error(error));
  await page.exposeFunction('saveModel', async (entry, encoded) => {
    if (!/^(car|traffic)-[a-z0-9-]+\.glb$/.test(entry.file)) throw new Error('Unsafe export filename.');
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw new Error(`Invalid GLB: ${entry.file}`);
    await fs.writeFile(path.join(output, entry.file), buffer);
    const saved = { ...entry, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
    manifest.files.push(saved); console.log(`${entry.file}: ${(buffer.length / 1024).toFixed(0)} KiB, ${entry.triangles} triangles`);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/__model_export.html`);
  await page.waitForFunction(() => window.exportReady, { timeout: 30000 });
  await page.evaluate(() => window.exportModels());
  if (manifest.files.length !== 22) throw new Error(`Expected 22 models, received ${manifest.files.length}.`);
  manifest.totalBytes = manifest.files.reduce((sum, entry) => sum + entry.bytes, 0);
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Exported ${manifest.files.length} shared models (${(manifest.totalBytes / 1048576).toFixed(2)} MiB) to ${output}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
