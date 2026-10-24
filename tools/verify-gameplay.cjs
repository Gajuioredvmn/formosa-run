// Extended gameplay QA against the real browser runtime. No mocked physics.
// Usage: node tools/verify-gameplay.cjs [output-directory]
// Boundary probes deliberately place a car immediately before a fork/finish;
// journeys drive continuously with the existing bot and the real time limit.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./serve.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(require('node:os').tmpdir(), 'formosa-gameplay-' + Date.now()));
fs.mkdirSync(output, { recursive: true });
const report = { started: new Date().toISOString(), assertions: [], errors: [], missing: [], cars: [], forks: [], goals: [], endings: [], journeys: [],
  limitations: ['Desktop Edge automation, not physical phone or a human playability review.', 'Fork/finish tests place the real car near boundaries; continuous journeys are separately labelled.', 'The original driving bot is a test driver; its time-outs are recorded, not represented as completed player journeys.'] };
const check = (name, value, details) => { report.assertions.push({ name, pass: !!value, ...(details === undefined ? {} : { details }) }); assert(value, name); };
const write = () => fs.writeFileSync(path.join(output, 'gameplay-report.json'), JSON.stringify(report, null, 2));
(async () => {
  const server = createServer(path.dirname(root)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', r => { if (r.status() >= 400) report.missing.push({ url: r.url(), status: r.status() }); });
    await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__kr?.G.state === 'race' && window.FORMOSA_PIXEL_CAR?.state.ready, null, { timeout: 90000 });
    await page.evaluate(() => { __kr.halt(true); __kr.show(null); });
    for (let car = 0; car < 10; car++) {
      const result = await page.evaluate(car => {
        const k = __kr;
        const fresh = (auto = true) => { k.G.mode = 'play'; k.G.paused = false; k.G.noIgnite = true; k.race(car, auto); k.run(); k.bot(false); k.show(null); k.UI.resultShown = false; };
        const snap = () => ({ ...k.state(), vMps: k.PC.v, vx: k.PC.vx, steer: k.PC.steerIn, crash: !!k.PC.crash, airY: k.PC.airY, roll: k.PC.roll, rpm: k.PC.rpm });
        fresh(); const start = snap(); k.CTL.keys.KeyZ = true; k.sim(5); const gas = snap();
        k.CTL.keys.KeyZ = false; k.CTL.keys.KeyX = true; k.sim(1); const brake = snap(); k.CTL.keys.KeyX = false;
        fresh(); k.PC.v = 35; k.PC.gear = 3; k.CTL.keys.ArrowLeft = true; k.sim(.15); const left = snap();
        k.CTL.keys.ArrowLeft = false; k.sim(1 / 60); const release = snap(); k.sim(.8); const settled = snap();
        fresh(); k.PC.v = 35; k.PC.gear = 3; k.CTL.keys.ArrowRight = true; k.sim(.15); const right = snap();
        fresh(false); k.CTL.keys.KeyZ = true; k.sim(2); const manual1 = snap();
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); k.sim(.3); const manual2 = snap();
        fresh(); k.TRAFFIC.list.length = 0; k.PC.v = 60; k.PC.gear = Math.min(4, k.PC.gears);
        const p = k.PC.piece, sedan = { p, s: k.PC.s + (k.playerLength() + 4.5) / 2 - .1, x: k.PC.x, v: 0, v0: 0, len: 4.5, wid: 1.8, type: 'sedan', hitT: 0, push: 0 };
        const contact = k.trafficPlayerContact(sedan), impact = snap();
        k.sim(3); const recovered = snap();
        delete k.G.noIgnite; k.race(car, true); const ignition = { on: k.IGN.on, t: k.IGN.t, state: k.RACE.state, v: k.PC.v };
        k.sim(7.7); const afterIgnition = snap();
        k.step(0);
        return { id: k.CARS[car].id, name: k.CARS[car].name, start, gas, brake, left, right, release, settled, manual1, manual2, contact, impact, recovered, ignition, afterIgnition };
      }, car);
      report.cars.push(result);
      check(result.id + ': accelerator drives forward with finite speed/RPM', result.gas.s > result.start.s + 20 && result.gas.vMps > 10 && Number.isFinite(result.gas.rpm));
      check(result.id + ': brake removes speed', result.brake.vMps < result.gas.vMps);
      check(result.id + ': both steering directions respond', result.left.vx < 0 && result.right.vx > 0);
      check(result.id + ': release preserves then settles lateral inertia', result.release.vx < 0 && Math.abs(result.release.steer) < Math.abs(result.left.steer) && Math.abs(result.settled.vx) < Math.abs(result.left.vx));
      check(result.id + ': manual gearbox responds once to an upshift', result.manual1.gear === 1 && result.manual2.gear === 2);
      check(result.id + ': centred NPC collision dissipates speed without a vertical launch', result.contact && result.impact.crash && result.impact.vMps < 60 && result.impact.airY === 0 && result.impact.roll === 0);
      check(result.id + ': collision recovery returns control with finite state', !result.recovered.crash && result.recovered.airY === 0 && result.recovered.roll === 0 && Number.isFinite(result.recovered.s) && Number.isFinite(result.recovered.x));
      check(result.id + ': restart includes ignition then the start countdown', result.ignition.on && result.ignition.t === 0 && result.ignition.state === 'ignition' && result.ignition.v === 0 && result.afterIgnition.st === 'run');
      console.log('CAR', result.id, '8 checks passed'); write();
    }
    const graph = await page.evaluate(() => __kr.ROUTE.pieces.map(p => ({ id: p.id, children: p.children.map(c => c.id), goal: p.goalS, label: p.def.label })));
    for (const parent of graph.filter(p => p.children.length)) for (let side = 0; side < 2; side++) {
      const result = await page.evaluate(({ id, side }) => {
        const k = __kr; k.G.mode = 'play'; k.G.noIgnite = true; k.race(0, true); k.run(); k.bot(false); k.show(null);
        const i = k.ROUTE.pieces.findIndex(p => p.id === id), p = k.ROUTE.pieces[i], x = p.forkOff[side] + 1.8;
        k.go(i, p.L - .2, x); k.PC.v = 25; k.PC.gear = 3; k.RACE.route = [p.id]; k.RACE.time = 100;
        k.TRAFFIC.list.length = 0; k.sim(.1); k.step(0);
        return { parent: id, side, expected: p.children[side].id, actual: k.PC.piece.id, xBefore: x, offset: p.forkOff[side], xAfter: k.PC.x, s: k.PC.s, route: [...k.RACE.route], slots: k.info().slots };
      }, { id: parent.id, side });
      report.forks.push(result);
      check('Fork ' + parent.id + ' → ' + result.expected + ': correct branch and continuous road coordinates', result.actual === result.expected && Math.abs(result.xAfter - (result.xBefore - result.offset)) < 1 && result.s > 0 && result.s < 5 && result.slots > 0);
    }
    for (const leaf of graph.filter(p => !p.children.length)) {
      const result = await page.evaluate(id => {
        const k = __kr; k.G.mode = 'play'; k.G.noIgnite = true; k.race(0, true); k.run(); k.bot(false); k.show(null);
        const i = k.ROUTE.pieces.findIndex(p => p.id === id), p = k.ROUTE.pieces[i]; k.go(i, p.goalS - .2, 1.8); k.PC.v = 25; k.PC.gear = 3; k.RACE.time = 10; k.TRAFFIC.list.length = 0;
        k.sim(.1); const result = { id, state: k.RACE.state, goal: k.RACE.goal, splits: [...k.RACE.splits] }; k.showResult();
        result.resultText = document.querySelector('#result').textContent; return result;
      }, leaf.id);
      report.goals.push(result);
      check('Goal ' + leaf.id + ': finish and result screen identify this destination', result.state === 'goal' && result.goal === leaf.id && result.splits.some(s => s.id === leaf.id) && !/undefined|NaN/.test(result.resultText));
      for (let car = 0; car < 10; car++) {
        const ending = await page.evaluate(({ id, car }) => {
          const k = __kr; k.RACE.carIdx = car; k.RACE.goal = id; k.startEnding(); k.ending(id, 2, car);
          const lines = k.ENDINGS[k.CARS[car].id][id];
          return { id, car: k.CARS[car].id, actual: k.END.goal, people: k.END.people.length, lines: [...lines], spriteWidth: k.END.spr.bw };
        }, { id: leaf.id, car });
        report.endings.push(ending);
        check('Ending ' + leaf.id + '/' + ending.car + ': correct destination, two crew and complete dialogue render', ending.actual === leaf.id && ending.people === 2 && ending.spriteWidth > 0 && ending.lines.length > 0 && ending.lines.every(l => l && !/undefined|NaN/.test(l)));
        if (car === 0) await page.screenshot({ path: path.join(output, 'ending-' + leaf.id + '.png') });
      }
      write();
    }
    // The real bot keeps traffic/hazards/time limits; this is a soak test rather
    // than a claim that every destination is easy for a human to complete.
    for (let n = 0; n < 16; n++) {
      const forks = n.toString(2).padStart(4, '0').split('').map(x => x === '0' ? 'L' : 'R'), car = n % 10;
      await page.evaluate(({ car, forks, seed }) => {
        let state = seed; Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
        const k = __kr; k.G.mode = 'play'; k.G.noIgnite = true; k.race(car, true); k.run(); k.show(null); k.UI.resultShown = false; k.bot(true, forks, 1);
        k.BOT._lastPiece = null; k.BOT.lane = 0; k.BOT.laneT = 0;
      }, { car, forks, seed: 29100 + n });
      const samples = []; let result;
      for (let elapsed = 0; elapsed < 900; elapsed += 10) {
        result = await page.evaluate(() => {
          const k = __kr; k.sim(10); return { ...k.state(), finite: ['s', 'x', 'v', 'vx', 'rpm', 'yaw', 'roll'].every(key => Number.isFinite(k.PC[key])), traffic: k.TRAFFIC.list.length, hazards: k.HAZ.list.length };
        });
        samples.push(result);
        if (!result.finite || ['goal', 'timeup'].includes(result.st)) break;
      }
      const journey = { car, forks: forks.join(''), result, samples }; report.journeys.push(journey);
      check('Journey ' + forks.join('') + ': no invalid physics or unbounded active objects', samples.every(s => s.finite && s.traffic < 150 && s.hazards < 150));
      console.log('JOURNEY', forks.join(''), result.st, result.route, result.el + 's', result.crashes + ' crashes'); write();
    }
    check('No uncaught browser errors across gameplay and endings', report.errors.length === 0);
    check('No missing assets across gameplay and endings', report.missing.length === 0);
    report.pass = true; await context.close();
  } catch (error) { report.pass = false; report.failure = String(error.stack || error); process.exitCode = 1; }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); report.finished = new Date().toISOString(); write(); console.log(JSON.stringify({ pass: report.pass, assertions: report.assertions.length, cars: report.cars.length, forks: report.forks.length, goals: report.goals.length, endings: report.endings.length, journeys: report.journeys.length, finishedJourneys: report.journeys.filter(j => j.result.st === 'goal').length, errors: report.errors, failure: report.failure, output }, null, 2)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
