// Numerical regression against the preserved Kenting engine. Contact changes
// are intentionally excluded; all ten current specifications drive identical
// controls through empty-road acceleration, steering, braking and slope cases.
// node tools/verify-driving-contract.cjs original-index.html [report.json]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const original = process.argv[2], output = process.argv[3];
if (!original) { console.error('Usage: node tools/verify-driving-contract.cjs original-index.html [report.json]'); process.exit(2); }
const root = path.resolve(__dirname, '..'), latest = path.join(root, 'index.html');
const testPath = path.join(root, 'tests/physics.test.cjs'), fixture = fs.readFileSync(testPath, 'utf8');
const boot = fixture.slice(0, fixture.indexOf('const tests=[];'));
function make(file) { const c = { require, console, __dirname: path.dirname(testPath), process: { argv: ['node', testPath, file] } }; vm.createContext(c); vm.runInContext(boot, c); return vm.runInContext('context()', c); }
const src = fs.readFileSync(latest, 'utf8'), a = src.indexOf('const CARS = ['), b = src.indexOf('for (const c of CARS)', a);
if (a < 0 || b < a) throw Error('CARS source anchors missing');
const cars = vm.runInNewContext('const KY=x=>x;' + src.slice(a, b) + ';CARS');
const scenarios = [
  ['AT acceleration', 'reset(0);PC.auto=true;PC.throttle=1;', 'if(i===200)PC.steerIn=.2;if(i===250)PC.steerIn=0;'],
  ['steering and release', 'reset(40);PC.throttle=.35;PC.steerIn=1;', 'if(i===120)PC.steerIn=0;if(i===300)PC.steerIn=-1;if(i===420)PC.steerIn=0;'],
  ['braking', 'reset(50);PC.brake=1;', ''],
  ['manual gears', 'reset(15);PC.throttle=1;', 'if(i===100)pcShift(2);if(i===200)pcShift(3);if(i===400)pcShift(2);'],
  ['uphill', 'reset(45);PC.throttle=.8;PC.piece.at=(a,s)=>s*.08;', ''],
  ['downhill', 'reset(30);PC.throttle=.2;PC.piece.at=(a,s)=>-s*.08;', ''],
  ['curve below and above tyre limit', 'reset(40);PC.throttle=.35;PC.piece.curv=()=>.005;PC.piece.leftEdge=()=>-500;PC.piece.rightEdge=()=>500;PC.piece.hw=()=>500;', 'PC.steerIn=i<200?.4:i<400?-.2:0;'],
  ['offroad drag', 'reset(50);PC.x=25;PC.throttle=1;', ''],
];
const fields = ['s','x','v','vx','rpm','gear','shiftT','neutral','drift','driftDir','slip','offroad','surface','yaw','roll','pitch','bump','dist','wind','windT','lockT','limitK','lastGr'];
const results = [];
for (const car of cars) for (const [name, setup, actions] of scenarios) {
  const series = [];
  for (const file of [original, latest]) {
    const c = make(file); c.actualCar = JSON.parse(JSON.stringify(car));
    // Reset the fixture's base car specification before pcSetup calculates its
    // gear ratios and force coefficients; three/four-gear cars remain valid.
    vm.runInContext('Object.assign(baseSpec,actualCar);' + setup + 'PC.gear=Math.min(PC.gear,PC.gears);PC.lastGr=0;PC.lockT=0;PC.wind=0;PC.windT=0;const trace=[];for(let i=0;i<600;i++){' + actions + 'pcStep(1/120);trace.push(' + JSON.stringify(fields) + '.map(k=>PC[k]));}globalThis.result=trace;', c);
    series.push(c.result);
  }
  let maxDelta = 0, mismatch = null;
  for (let i = 0; i < 600; i++) for (let j = 0; j < fields.length; j++) {
    const a = series[0][i][j], b = series[1][i][j];
    if (typeof a === 'number' && typeof b === 'number') { const d = Math.abs(a - b); maxDelta = Math.max(maxDelta, d); if ((!Number.isFinite(a) || !Number.isFinite(b) || d > 1e-10) && !mismatch) mismatch = { step: i, field: fields[j], old: a, new: b }; }
    else if (a !== b && !mismatch) mismatch = { step: i, field: fields[j], old: a, new: b };
  }
  results.push({ car: car.id, name, steps: 600, pass: !mismatch, maxDelta, mismatch });
}
const report = { original: path.resolve(original), current: latest, dt: 1/120, scenarios: results, fields, scope: 'All ten actual car specifications; normal driving on empty-road fixtures. Requested collision/fairness changes intentionally excluded.' };
report.pass = results.every(r => r.pass); if (output) { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ pass: report.pass, cars: cars.length, scenarios: results.length, comparedValues: results.length * 600 * fields.length, maxDelta: Math.max(...results.map(r => r.maxDelta)), failures: results.filter(r => !r.pass), output }, null, 2));
if (!report.pass) process.exitCode = 1;
