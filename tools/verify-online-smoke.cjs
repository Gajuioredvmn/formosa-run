'use strict';

// Two actual game pages, public PeerJS signalling and native WebRTC channels.
// No transport mocks. This is deliberately separate from the eight-player test.
// Run only when the machine is available for this one browser session.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

if (process.argv.includes('--help')) {
  console.log('Usage: node tools/verify-online-smoke.cjs [output-directory]\n'
    + 'At most TWO complete game pages in ONE fresh browser. Public PeerJS/native WebRTC.\n'
    + 'Covers staggered starts, ignition/countdown, bidirectional driving, standings,\n'
    + 'first-arrival fork locking, native channel disconnection/rejoin, and restart.\n'
    + 'Single computer/network only; not eight-player, phone FPS, internet-NAT or soak coverage.\n'
    + 'The existing verify-multiplayer.cjs eight-client suite remains independent.');
  process.exit(0);
}
if (process.argv.length > 3 || (process.argv[2] || '').startsWith('--')) {
  throw new Error('Usage: node tools/verify-online-smoke.cjs [output-directory]');
}
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'formosa-online-smoke-' + Date.now()));
const server = require('./serve.cjs').createServer(ROOT);
const pages = [];
const report = {
  started: new Date().toISOString(), status: 'RUNNING',
  scope: 'Two full game pages on one computer and one network. Public PeerJS signalling and native WebRTC. No transport mocks, saved profiles or user avatars.',
  limitations: [
    'This is not an eight-player capacity or performance test. The prior eight-client suite is separate.',
    'This does not establish mobile 60 FPS, different physical devices, cross-network NAT/TURN reliability or long-session stability.',
    'Ranking and fork protocol checks move cars to real road coordinates to isolate ordering; they are not a complete five-stage playthrough.',
    'Disconnect is a real native reliable-channel close, not simulated packet delivery, but is not a physical network cable or radio interruption.',
  ],
  maxGamePages: 2, peakGamePages: 0, nativeWebRTC: true,
  checks: [], errors: [], websocketErrors: [], rounds: [], cleanupErrors: [],
};
let browser, base;
fs.mkdirSync(OUT, { recursive: true });

function check(name, pass, details) {
  report.checks.push({ name, pass: !!pass, details });
  assert(pass, name);
  console.log('PASS ' + name);
}
async function states() { return Promise.all(pages.map(state)); }
async function state(page) {
  return page.evaluate(() => {
    const a = __kr, n = a.NET;
    return {
      id: n.id, clientId: n.me.clientId, slot: a.netDebug.slot(), host: n.host,
      phase: n.phase, error: n.err, lost: n.lost, round: n.roundId, roundNo: n.roundNo,
      goAt: n.goAt, clockRtt: n.clockRtt, grid: n.grid, layout: n.gridLayout,
      position: { piece: a.ROUTE.pieces.indexOf(a.PC.piece), s: a.PC.s, x: a.PC.x, v: a.PC.v },
      race: a.RACE.state, ignition: { on: a.IGN.on, t: a.IGN.t },
      forks: n.forkLocks, ranking: a.netDebug.standings(), hud: n.hudLayout,
      watch: window.__onlineSmokeRounds,
      peers: [...n.peers.values()].map(p => ({
        id: p.id, clientId: p.clientId, connection: p.pc?.connectionState,
        ctl: p.ctl?.readyState, st: p.st?.readyState, lastSeq: p.lastSeq,
        state: p.state, visible: p.vis,
      })),
    };
  });
}
async function boot(i) {
  if (pages.length >= 2 || browser.contexts().reduce((n, c) => n + c.pages().length, 0) >= 2) {
    throw new RangeError('Two-page game limit reached');
  }
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  pages.push(page); // Include partially loaded pages in cleanup/failure reporting.
  report.peakGamePages = Math.max(report.peakGamePages, pages.length);
  page.on('pageerror', e => report.errors.push({ client: i, message: e.stack || String(e) }));
  page.on('websocket', ws => ws.on('socketerror', e => report.websocketErrors.push({ client: i, message: String(e) })));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__kr?.netDebug && __kr.G.state === 'race', null, { timeout: 120000 });
  await page.evaluate(i => {
    const a = __kr;
    a.SET.name = 'SMOKE-' + i; a.SET.avatar = ''; a.SET.avatarKind = 'face';
    a.UI.sel = i === 0 ? 0 : 9; a.UI.auto = true; a.UI.gearbox = 'at';
    a.show('online');
    window.__onlineSmokeRounds = {};
    function observe() {
      const n = a.NET;
      if (n.roundId && n.phase === 'race') {
        const r = window.__onlineSmokeRounds[n.roundId] || (window.__onlineSmokeRounds[n.roundId] = { states: [], early: false, firstRun: null });
        if (!r.states.includes(a.RACE.state)) r.states.push(a.RACE.state);
        if (a.RACE.state === 'run' && !r.firstRun) {
          r.firstRun = { hostNow: a.netDebug.now(), goAt: n.goAt, s: a.PC.s, x: a.PC.x };
          r.early = r.firstRun.hostNow < n.goAt - 25;
        }
      }
      requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  }, i);
  return page;
}
async function waitConnected() {
  await Promise.all(pages.map(page => page.waitForFunction(() => {
    const n = __kr.NET;
    return n.grid.length === 2 && [...n.peers.values()].some(p => p.pc?.connectionState === 'connected' && p.ctl?.readyState === 'open' && p.st?.readyState === 'open');
  }, null, { timeout: 30000 })));
}
async function startRound(skipGuest) {
  await pages[0].evaluate(() => __kr.show('online'));
  await pages[0].locator('[data-net="start"]').click();
  await Promise.all(pages.map(p => p.waitForFunction(() => __kr.NET.phase === 'race' && __kr.RACE.state === 'ignition', null, { timeout: 10000 })));
  const initial = await states(), id = initial[0].round;
  check('Both clients receive the same new round and GO time', initial.every(s => s.round === id && s.goAt === initial[0].goAt), initial.map(s => ({ slot: s.slot, round: s.round, goAt: s.goAt })));
  check('Both clients start with the ignition animation', initial.every(s => s.ignition.on && s.race === 'ignition'));
  const grid = await pages[0].evaluate(() => __kr.NET.grid.map(g => ({ slot: g.slot, position: __kr.netDebug.position(g.slot), width: __kr.CARS[g.car].W, length: __kr.CARS[g.car].L })));
  const [a, b] = grid;
  check('Two assigned start rectangles are staggered and do not overlap', grid.length === 2 && a.position.s !== b.position.s && (Math.abs(a.position.x - b.position.x) >= (a.width + b.width) / 2 + .01 || Math.abs(a.position.s - b.position.s) >= (a.length + b.length) / 2 + .01), grid);
  check('Actual cars occupy their assigned stationary grid slots', initial.every(s => { const p = grid.find(g => g.slot === s.slot).position; return Math.abs(s.position.s - p.s) < .01 && Math.abs(s.position.x - p.x) < .01 && s.position.v === 0; }));
  if (skipGuest) {
    await pages[1].evaluate(() => { __kr.netDebug.ignitionSkip(); __kr.netDebug.ignitionSkip(); });
    await pages[1].waitForTimeout(500);
    const skipped = await state(pages[1]);
    check('Skipping ignition cannot move the shared GO timestamp or launch early', skipped.goAt === initial[1].goAt && skipped.race !== 'run' && skipped.position.v === 0);
  }
  await Promise.all(pages.map(p => p.waitForFunction(() => __kr.RACE.state === 'run', null, { timeout: 22000 })));
  const ready = await states(), observations = ready.map(s => s.watch[id]);
  check('Both clients pass ignition, countdown and run without an early start', observations.every(w => w.states.includes('ignition') && w.states.includes('countdown') && w.states.includes('run') && !w.early), observations);
  report.rounds.push({ id, initial, ready });
  return { id, initial, ready };
}
async function drive(seconds, label) {
  const before = await states();
  await Promise.all(pages.map(p => p.keyboard.down('ArrowUp')));
  try { await pages[0].waitForTimeout(seconds * 1000); }
  finally { await Promise.all(pages.map(p => p.keyboard.up('ArrowUp'))); }
  const after = await states();
  check(label + ': both cars move from their own positions', after.every((s, i) => s.position.v > 1 && s.position.s > before[i].position.s + 1), after.map(s => ({ slot: s.slot, position: s.position })));
  check(label + ': both receive fresh rival state over native channels', after.every((s, i) => s.peers.some(p => p.state?.round === s.round && p.visible && p.state.v > 0 && p.lastSeq > (before[i].peers.find(q => q.id === p.id)?.lastSeq ?? -1))), after.map(s => ({ slot: s.slot, peers: s.peers })));
  return after;
}
async function transportStats(page) {
  return page.evaluate(async () => Promise.all([...__kr.NET.peers.values()].filter(p => p.pc).map(async p => {
    const stats = [...(await p.pc.getStats()).values()];
    return {
      id: p.id, connection: p.pc.connectionState,
      candidates: stats.filter(s => s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded').map(s => ({ bytesSent: s.bytesSent, bytesReceived: s.bytesReceived, currentRoundTripTime: s.currentRoundTripTime })),
      channels: stats.filter(s => s.type === 'data-channel').map(s => ({ label: s.label, state: s.state, messagesSent: s.messagesSent, messagesReceived: s.messagesReceived })),
    };
  })));
}
async function approachFork(page, piece, side, remain = 240, speed = 0) {
  return page.evaluate(({ piece, side, remain, speed }) => {
    const a = __kr, p = a.ROUTE.pieces[piece];
    a.go(piece, p.L - remain, p.forkOff[side]); a.PC.v = speed; a.PC.vx = 0; a.PC.crash = null;
    a.RACE.state = 'run'; a.RACE.time = 300; a.TRAFFIC.list = []; a.HAZ.list = [];
    return { children: p.children.map(q => a.ROUTE.pieces.indexOf(q)) };
  }, { piece, side, remain, speed });
}

(async () => {
  try {
    report.sourceSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'index.html'))).digest('hex');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port + '/';
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}), args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
    await boot(0); await boot(1);
    await pages[0].evaluate(() => __kr.netHost());
    await pages[0].waitForFunction(() => __kr.NET.grid.length === 1 && !__kr.NET.status && !__kr.NET.err, null, { timeout: 30000 });
    const code = await pages[0].evaluate(() => __kr.NET.code);
    report.signalling = 'public 0.peerjs.com';
    await pages[1].evaluate(code => __kr.netJoin(code), code);
    await waitConnected();
    await pages[1].waitForFunction(() => Number.isFinite(__kr.NET.clockRtt), null, { timeout: 5000 });
    let ss = await states();
    check('Fresh host and guest have distinct identities and slots 0/1', new Set(ss.map(s => s.clientId)).size === 2 && ss[0].slot === 0 && ss[1].slot === 1, ss.map(s => ({ clientId: s.clientId, slot: s.slot, clockRtt: s.clockRtt })));
    const first = await startRound(true);
    await pages[0].screenshot({ path: path.join(OUT, 'host-first-go.png') });
    await pages[1].screenshot({ path: path.join(OUT, 'guest-first-go.png') });
    await drive(2.2, 'First round');
    await pages[1].keyboard.down('ArrowRight');
    try { await pages[1].waitForTimeout(400); }
    finally { await pages[1].keyboard.up('ArrowRight'); }
    ss = await states();
    check('Rival packets contain finite position, speed and steering-frame data', ss.every(s => s.peers.some(p => p.state && [p.state.s, p.state.x, p.state.v, p.state.si].every(Number.isFinite))));
    // Known real road positions make the leaderboard order deterministic.
    for (let i = 0; i < 2; i++) await pages[i].evaluate(i => { __kr.go(0, i ? 420 : 230, 0); __kr.PC.v = 0; __kr.PC.vx = 0; __kr.PC.crash = null; }, i);
    await Promise.all(pages.map(p => p.waitForFunction(() => { const r = __kr.netDebug.standings(); return r.length === 2 && r[0].slot === 1 && r.every(q => Number.isFinite(q.progress) && q.progress >= 0 && q.progress <= 1); }, null, { timeout: 8000 })));
    ss = await states();
    check('Both clients show the same two-player ranking order and valid progress', ss.every(s => s.ranking[0].slot === 1 && s.ranking[1].slot === 0 && s.hud?.count === 2), ss.map(s => ({ ranking: s.ranking, hud: s.hud })));
    const fork = await approachFork(pages[1], 0, 1);
    await Promise.all(pages.map(p => p.waitForFunction(() => __kr.NET.forkLocks[0]?.side === 1, null, { timeout: 8000 })));
    const locks = await states();
    check('The first guest reaching a fork locks the right route for both clients', locks.every(s => s.forks[0].side === 1 && s.forks[0].by === ss[1].clientId), locks.map(s => s.forks));
    await approachFork(pages[0], 0, 0, 35, 30);
    await pages[0].keyboard.down('ArrowLeft'); await pages[0].keyboard.down('ArrowUp');
    try {
      await pages[0].waitForTimeout(1200); await pages[0].keyboard.up('ArrowLeft');
      await pages[0].waitForFunction(pi => __kr.ROUTE.pieces.indexOf(__kr.PC.piece) === pi && __kr.RACE.route.at(-1) === __kr.ROUTE.pieces[pi].id, fork.children[1], { timeout: 12000 });
    } finally { await pages[0].keyboard.up('ArrowLeft'); await pages[0].keyboard.up('ArrowUp'); }
    check('Later host attempting the other lane follows the locked branch', true, (await state(pages[0])).position);
    await pages[0].screenshot({ path: path.join(OUT, 'host-locked-branch.png') });
    report.transportBeforeDisconnect = await Promise.all(pages.map(transportStats));
    check('Both native ctl and st channels exchanged real messages in both directions', report.transportBeforeDisconnect.every(list => list.some(p => ['ctl', 'st'].every(label => p.channels.some(c => c.label === label && c.messagesSent > 0 && c.messagesReceived > 0)))), report.transportBeforeDisconnect);

    const before = await state(pages[1]);
    // Actual native channel closure: callbacks, lost UI and cleanup run normally.
    await pages[0].evaluate(id => { const p = __kr.NET.peers.get(id); if (!p?.ctl) throw new Error('Guest reliable channel missing'); p.ctl.close(); }, before.id);
    await pages[1].waitForFunction(() => __kr.NET.lost && !!__kr.NET.err, null, { timeout: 15000 });
    await pages[0].waitForFunction(id => !__kr.NET.grid.some(g => g.id === id), before.id, { timeout: 15000 });
    const dropped = await state(pages[0]);
    check('Native guest disconnection releases its grid slot and marks its last ranking', dropped.grid.length === 1 && dropped.ranking.some(q => q.clientId === before.clientId && q.disconnected), dropped.ranking);
    await pages[1].evaluate(() => __kr.show('online'));
    await pages[1].locator('[data-net="rejoin"]').click();
    await waitConnected();
    await pages[1].waitForFunction(() => __kr.NET.phase === 'race' && __kr.RACE.state === 'run', null, { timeout: 15000 });
    const rejoined = await state(pages[1]);
    check('Rejoin UI restores stable identity and the same vacated slot with a new peer ID', rejoined.clientId === before.clientId && rejoined.slot === before.slot && rejoined.id !== before.id, { before: { id: before.id, clientId: before.clientId, slot: before.slot }, after: { id: rejoined.id, clientId: rejoined.clientId, slot: rejoined.slot } });
    check('Rejoining guest receives the current round and locked route decisions', rejoined.round === first.id && JSON.stringify(rejoined.forks) === JSON.stringify(before.forks), rejoined.forks);
    await pages[0].waitForFunction(() => [...__kr.NET.peers.values()].some(p => p.state?.round === __kr.NET.roundId && p.lastSeq > 1), null, { timeout: 8000 });
    check('Rejoined guest resumes native state transmission', true);

    const second = await startRound(false);
    check('Restart creates a distinct shared second round', second.id !== first.id && second.ready.every(s => s.roundNo === 2));
    check('Restart clears all prior fork choices for both clients', second.ready.every(s => s.forks.length === 0));
    check('Restart preserves both assigned grid slots', second.initial.every((s, i) => s.slot === first.initial[i].slot));
    await drive(1.8, 'Restart');
    await pages[0].screenshot({ path: path.join(OUT, 'host-second-round.png') });
    report.transportAfterReconnect = await Promise.all(pages.map(transportStats));
    check('Reconnected native state channels have traffic in both directions', report.transportAfterReconnect.every(list => list.some(p => p.channels.some(c => c.label === 'st' && c.messagesSent > 2 && c.messagesReceived > 2))));
    await pages[0].evaluate(() => __kr.netLeave());
    await pages[1].waitForFunction(() => __kr.NET.lost || __kr.NET.err.includes('房主'), null, { timeout: 15000 });
    check('Guest reports host departure', true, await state(pages[1]));
    check('At most two complete game pages were opened', report.peakGamePages === 2);
    check('No page script exceptions occurred', report.errors.length === 0, report.errors);
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL'; report.failure = error.stack || String(error); process.exitCode = 1;
    report.failureStates = await Promise.all(pages.map(p => state(p).catch(e => ({ error: String(e) }))));
  } finally {
    if (browser) {
      for (const context of browser.contexts()) {
        for (const page of context.pages()) {
          try { await page.evaluate(() => { window.__kr?.halt(true); window.__kr?.netLeave(); }); } catch {}
        }
        try { await context.close(); } catch (e) { report.cleanupErrors.push(String(e)); }
      }
      try { await browser.close(); } catch (e) { report.cleanupErrors.push(String(e)); }
    }
    if (server.listening) await new Promise(resolve => server.close(resolve));
    if (report.cleanupErrors.length) { report.status = 'FAIL'; process.exitCode = 1; }
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failed: report.checks.filter(c => !c.pass), failure: report.failure, errors: report.errors, cleanupErrors: report.cleanupErrors, report: path.join(OUT, 'live-report.json') }, null, 2));
  }
})();
