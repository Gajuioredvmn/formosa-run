// Actual browser smoke test, including the GitHub Pages project subpath.
// Requires Playwright plus Chromium or Edge; reports stay outside the source.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createServer } = require('./serve.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root = path.resolve(process.argv[3] || path.join(__dirname, '..'));
const output = path.resolve(process.argv[2] || path.join(require('node:os').tmpdir(), 'formosa-browser-' + Date.now()));
fs.mkdirSync(output, { recursive: true });
const report = { errors: [], missing: [], assertions: [], cars: [], scenes: [], limitations: ['Desktop Edge; does not validate phone sensors or native phone frame rate.'] };
const check = (name, condition) => { assert(condition, name); report.assertions.push(name); };

(async () => {
  const server = createServer(path.dirname(root));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage(), requested = [];
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => requested.push(new URL(request.url()).pathname));
    page.on('response', response => { if (response.status() >= 400) report.missing.push({ url: response.url(), status: response.status() }); });
    await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__kr?.G.state === 'race' && window.FORMOSA_PIXEL_CAR?.state.ready, null, { timeout: 90000 });
    await page.evaluate(() => { __kr.halt(true); __kr.show('title'); });
    check('Default presentation does not load the experimental 3D engine', !requested.some(url => /\/(?:main|world|three\.module|three\.core)\.js$/.test(url)));
    await page.locator('#tap:visible').click();
    await page.locator('[data-go="select"]:visible').first().click();
    await page.locator('[data-act="pick"]:visible').click();
    await page.locator('[data-act="go"]:visible').click();
    check('Actual title → car selection → setup → start opens ignition', await page.evaluate(() => __kr.RACE.state === 'ignition' && __kr.IGN.on && __kr.IGN.t === 0));
    await page.evaluate(() => { __kr.sim(1.6); __kr.step(0); });
    check('The ignition shows the hand, turned key, lamps and starter before catching', await page.evaluate(() => __kr.IGN.hand === 1 && __kr.IGN.keyA > 1 && __kr.IGN.acc && __kr.IGN.crank && !__kr.IGN.caught));
    await page.screenshot({ path: path.join(output, 'ignition-starter.png') });
    await page.evaluate(() => { __kr.sim(.8); __kr.step(0); });
    check('The engine catches before the dash drops', await page.evaluate(() => __kr.IGN.caught && __kr.IGN.on && !__kr.IGN.crank));
    await page.evaluate(() => { __kr.sim(1); __kr.step(0); });
    check('Ignition finishes and enters the original start-light countdown', await page.evaluate(() => !__kr.IGN.on && __kr.RACE.state === 'countdown' && __kr.RACE.countdown > 3.9));
    await page.screenshot({ path: path.join(output, 'start-countdown.png') });
    await page.evaluate(() => { __kr.sim(4.3); __kr.step(0); });
    check('Countdown releases the car into the race', await page.evaluate(() => __kr.RACE.state === 'run'));

    for (let car = 0; car < 10; car++) {
      const state = await page.evaluate(car => {
        const k = __kr; k.G.mode = 'play'; k.G.noIgnite = true; k.race(car, true); k.run(); k.show(null); k.bot(false);
        k.PC.v = 45; k.PC.gear = Math.min(4, k.PC.spec.gears); k.step(0);
        return { car: k.PC.spec.id, name: k.PC.spec.name, sprite: !!k.PC.spr, ...k.state() };
      }, car);
      check('Selectable car renders: ' + state.car, state.sprite && Number.isFinite(state.x) && state.v === 162);
      report.cars.push(state);
    }
    const ids = await page.evaluate(() => __kr.ROUTE.pieces.map(p => p.id));
    for (const id of ids) {
      const data = await page.evaluate(id => {
        const k = __kr, i = k.ROUTE.pieces.findIndex(p => p.id === id), p = k.ROUTE.pieces[i];
        k.race(0, true); k.run(); k.show(null); k.bot(false); k.go(i, Math.min(620, p.L / 2), 1.8); k.PC.v = 0; k.TRAFFIC.list.length = 0; k.step(0);
        return { id, label: p.def.label, x: k.PC.x, s: k.PC.s, walls: p.walls.length, sprites: p.sprites.length, slots: k.info().slots };
      }, id);
      check('Route renders finite geometry: ' + id, Number.isFinite(data.x) && Number.isFinite(data.s) && data.slots > 0);
      report.scenes.push(data);
      if (['s1', 's4b', 's4h', 's5j', 's5n'].includes(id)) await page.screenshot({ path: path.join(output, id + '.png') });
    }
    await page.evaluate(() => { const k = __kr; k.race(0, true); k.run(); k.show(null); k.go(0, 90, 1.8); k.TRAFFIC.list.length = 0; k.step(0); });
    await page.keyboard.down('z');
    await page.evaluate(() => __kr.sim(2));
    await page.keyboard.up('z');
    check('Keyboard acceleration moves the original engine', await page.evaluate(() => __kr.PC.v > 0 && __kr.PC.s > 90));
    await page.keyboard.down('ArrowLeft');
    await page.evaluate(() => __kr.sim(.1));
    const moving = await page.evaluate(() => ({ vx: __kr.PC.vx, steer: __kr.PC.steerIn }));
    await page.keyboard.up('ArrowLeft');
    await page.evaluate(() => __kr.sim(1 / 60));
    check('Steering retains inertia while the original smoothed input returns', await page.evaluate(previous => Math.sign(__kr.PC.vx) === Math.sign(previous.vx) && Math.abs(__kr.PC.vx) > 0 && Math.abs(__kr.PC.steerIn) < Math.abs(previous.steer), moving));
    await page.evaluate(() => __kr.sim(.8));
    check('Lateral motion decays after the steering recentres', await page.evaluate(previous => Math.abs(__kr.PC.vx) < Math.abs(previous.vx), moving));
    await page.keyboard.down('z');
    check('Held accelerator is registered before focus loss', await page.evaluate(() => __kr.CTL.keys.KeyZ));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    check('Losing focus releases held controls', await page.evaluate(() => !__kr.CTL.keys.KeyZ));
    await page.keyboard.up('z');
    await page.evaluate(() => { delete __kr.G.noIgnite; __kr.race(0, true); __kr.step(0); });
    check('Restart restores the full ignition sequence', await page.evaluate(() => __kr.IGN.on && __kr.IGN.t === 0 && __kr.PC.v === 0 && __kr.RACE.elapsed === 0));
    check('No uncaught browser errors', report.errors.length === 0);
    check('No missing assets under the project subpath', report.missing.length === 0);
    report.pass = true;
    await context.close();
  } catch (error) { report.pass = false; report.failure = String(error.stack || error); process.exitCode = 1; }
  finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, assertions: report.assertions.length, cars: report.cars.length, scenes: report.scenes.length, errors: report.errors, missing: report.missing, failure: report.failure, output }, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
