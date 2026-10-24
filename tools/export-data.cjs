/* Export the actual browser route geometry for the Godot project; no second map. */
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root = path.resolve(__dirname, '..');
(async () => {
  const server = createServer(root); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?renderer=classic`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__kr && __kr.G.state === 'race', null, { timeout: 90000 });
    const data = await page.evaluate(() => {
      const k = __kr; k.halt(true);
      const f = v => Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0;
      const pieces = k.ROUTE.pieces.map(p => {
        const points = []; for (let s = 0; s <= p.L; s += 4) { const q = p.pos(s, 0, {}); points.push({ s, x: f(q.x), y: f(q.y), z: f(q.z), h: f(p.heading(s)), hw: f(p.hw(s)), left: f(p.leftEdge(s)), right: f(p.rightEdge(s)), slope: f(p.slope(s)), secIndex: Math.max(0, p.secs.indexOf(p.sec(s))) }); }
        if (points.at(-1).s !== p.L) { const s = p.L, q = p.pos(s, 0, {}); points.push({ s, x:f(q.x), y:f(q.y), z:f(q.z), h:f(p.heading(s)), hw:f(p.hw(s)), left:f(p.leftEdge(s)), right:f(p.rightEdge(s)), slope:f(p.slope(s)), secIndex:p.secs.length-1 }); }
        const roadBoundaries=[];
        for(const sg of [-1,1])for(const q of (p.roadBoundaries||[]).filter(q=>q.sg===sg)){
          const last=roadBoundaries.at(-1);
          if(last&&last.sg===sg&&last.s1===q.s0&&['off','height','terrain','kind'].every(k=>last[k]===q[k]))last.s1=q.s1;
          else roadBoundaries.push(Object.fromEntries(['s0','s1','sg','off','height','terrain','kind'].map(k=>[k,q[k]])));
        }
        return { id:p.id, stageId:p.id, name:p.def.name, label:p.def.label, length:p.L, seed:p.seed, gS:p.gS, parent:p.parent?.id || null, children:p.children.map(c=>c.id), side:p.side || 0, startS:p.startS || 90, checkS:p.checkS || 0, goalS:p.goalS || 0, forkOff:p.forkOff || [], points,
          sections:p.secs.map((sec,i)=>({...sec, start:p.secStartS[i], end:p.secStartS[i+1]??p.L})), parades:p.parades || [], colliders:p.colliders.map(c=>({...c})), traffic:p.def.traffic, time:p.def.time, goal:p.def.goal || '', pano:p.def.pano,
          railCrossing:p.railCrossing?Object.fromEntries(['kind','s','axis','start','end','divideStart','divideEnd','height','len','speed','period'].map(k=>[k,p.railCrossing[k]])):null,
          roadBoundaries,roadCrossings:(p.roadCrossings||[]).map(q=>({s:q.s,width:q.width,kind:q.kind})) };
      });
      return { version:2, title:'衝向寶島 FORMOSA RUN', root:'s1', rules:{ initial_time:95, checkpoint_bonus:95, world_k:k.WORLD_K, stages:5, branches:30, endings:16, traffic_clearance:.24, target_mobile_fps:60 }, cars:k.CARS, crew:k.CREW, stages:k.STAGES, pieces };
    });
    if (errors.length) throw new Error(errors.join('\n'));
    if (data.pieces.length !== 31 || new Set(data.pieces.map(p=>p.id)).size !== 31 || data.pieces.filter(p=>!p.children.length).length !== 16) throw new Error('The route must be the complete five-level tree.');
    fs.mkdirSync(path.join(root, 'data'), { recursive:true });
    fs.writeFileSync(path.join(root,'data/game.json'),JSON.stringify(data));
    console.log(`Exported ${data.cars.length} cars, ${data.pieces.length} unique stages, 16 endings; world_k=${data.rules.world_k}.`);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
})().catch(e => { console.error(e); process.exitCode=1; });
