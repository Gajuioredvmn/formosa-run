// Run with: node tests/gameplay.test.cjs [path/to/index.html]
// Executes the game's actual gameplay functions in a DOM/audio-free VM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = process.argv[2] || path.resolve(__dirname, '../index.html');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
function section(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `gameplay anchors missing: ${start}`);
  return source.slice(a, b);
}
const car = section('const REDLINE = ', '// ===================== controls:');
const controls = section('const IS_TOUCH = ', '// ===================== sound:');
const hazardReset = section('const HAZ = ', '// a tram crossing:');
const race = section('const RACE = ', '// ---------- the chase camera:');
const gap = section('const GAP_CAR = ', 'function spawnVehicle(');
const uiKey = section('function onUiKey(e) {', '// ---------- car select:');
const prelude = `
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const LANE=3.7, D2R=Math.PI/180;
const G={state:'race',mode:'play',paused:false,t:0};
const BOT={on:false};
const HUD={show:true,msgs:[],fork:null};
const CAM={lat:0,init:false,shake:0};
const TRAFFIC={list:[],oncoming:[],spawnS:0};
const FX={hopV:0};
const NET={on:false,phase:'lobby'};
const GHOST={rec:[],recT:0,on:false,load(){}};
const IGN={};
const ROUTE={pieces:[],root:null};
const CARS=[{top:300,gears:6,acc:.8,grip:.8,steer:.8,engine:'v12'}];
const STAGES={s1:{time:95}};
const UI={scr:null,sel:0,unlocked:false,resultShown:false};
const messages=[];
let pauses=0,starts=0;
const hudMsg=(...args)=>messages.push(args);
const fmtTime=t=>String(t);
const sfxShift=()=>{},sfxSkid=()=>{},sfxCrash=()=>{},sfxThud=()=>{},sfxScrape=()=>{};
const sfxBeep=()=>{},sfxChime=()=>{},engineStart=()=>{},fxReset=()=>{},shake=()=>{};
const igniteStart=()=>{},igniteUpdate=()=>{};
const onPausePressed=()=>{pauses++;};
const carSprites=()=>({});
const show=name=>{UI.scr=name;};
const unlock=()=>{UI.unlocked=true;};
const openSelect=()=>{};
const startPlay=()=>{starts++; UI.scr=null;};
const piece=(id='s1',extra={})=>Object.assign({
  id,L:1000,Y:[],def:{time:95,name:id,goal:'FINISH'},children:[],forkOff:[-7,7],
  at:()=>0,curv:()=>0,hw:()=>7.4,shoulder:()=>0,
  leftEdge:()=>-7.4,rightEdge:()=>7.4,sec:()=>({L:'grass',R:'grass'}),colliders:[],
},extra);
function resetRace(extra={}) {
  pcSetup(CARS[0],true,false);
  const p=piece(); PC.piece=p; PC.s=100; PC.x=0; PC.dist=0;
  Object.assign(RACE,{state:'run',time:95,elapsed:0,score:0,countdown:0,
    route:['s1'],stageNo:1,splits:[],checked:new Set(),goal:null,crashes:0,overT:0,goalT:0},extra);
  ROUTE.pieces=[p]; ROUTE.root=p; messages.length=0; TRAFFIC.list.length=0;
  return p;
}
`;
function context() {
  const listeners = new Map();
  const add = (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); };
  const sandbox = {assert,console,Map,Set,Math,performance:{now:()=>10000},
    window:{},navigator:{maxTouchPoints:0},document:{hidden:false,addEventListener:add},
    screen:{orientation:{angle:0}},innerWidth:1280,innerHeight:720,
    addEventListener:add,glCanvas:{addEventListener:add},listeners};
  vm.createContext(sandbox);
  vm.runInContext(prelude + car + controls + hazardReset + gap + race + uiKey +
    "\naddEventListener('keydown', onUiKey);", sandbox, {filename:sourcePath});
  return sandbox;
}
const tests = [];
function test(name, body) { tests.push({name, body}); }
test('restart clears airborne, offroad, steering and drift state', `
  resetRace();
  Object.assign(PC,{airY:3.5,yaw:1.2,roll:2,offroad:1,wind:4,lastGr:.1,lockT:2,slip:1,drift:1,throttle:1});
  pcSetup(CARS[0],true,false);
  for (const k of ['airY','yaw','roll','offroad','wind','lastGr','lockT','slip','drift','throttle'])
    assert.equal(PC[k],0,k+' leaked from previous race');
  PC.piece=piece(); PC.s=100; pcStep(1/60); assert.equal(PC.airY,0);
`);
test('a held gear key changes gear once and a held pause key pauses once', `
  resetRace(); PC.auto=false;
  const emit=(code,repeat=false)=>listeners.get('keydown').forEach(fn=>fn({code,repeat,preventDefault(){}}));
  emit('KeyE'); for(let i=0;i<8;i++) emit('KeyE',true);
  assert.equal(PC.gear,2);
  emit('KeyP'); for(let i=0;i<8;i++) emit('KeyP',true);
  assert.equal(pauses,1);
`);
test('H-gate rejects thumb jitter and cancelling an incomplete stroke restores the original gear', `
 resetRace();PC.auto=false;PC.gear=2;CTL.pads={gate:{x:0,y:0,w:400,h:220}};
 touchDown(1,100,110);touchMove(1,104,107);touchUp(1);assert.equal(PC.gear,2);assert.equal(PC.neutral,false);
 touchDown(2,100,110);touchMove(2,100,70);assert.equal(PC.neutral,true);touchUp(2,true);
 assert.equal(PC.gear,2);assert.equal(PC.neutral,false);assert.equal(CTL.knob.active,false);
`);
test('A forgiving H cross-slot stroke engages once and preserves the 0.18 second gear interruption', `
 resetRace();PC.auto=false;PC.gear=2;CTL.pads={gate:{x:0,y:0,w:400,h:220}};
 touchDown(1,100,110);touchMove(1,100,70);touchMove(1,137,70);touchMove(1,137,30);
 assert.equal(PC.gear,3);assert.equal(PC.neutral,false);assert.equal(PC.shiftT,.18);
 PC.shiftT=.09;touchMove(1,140,28);touchMove(1,140,150);assert.equal(PC.gear,3);assert.equal(PC.shiftT,.09);
 touchUp(1,true);assert.equal(PC.gear,3);assert.equal(PC.neutral,false);
`);
test('Only a deliberate neutral hold remains in neutral after releasing the gate', `
 resetRace();PC.auto=false;PC.gear=2;CTL.pads={gate:{x:0,y:0,w:400,h:220}};
 touchDown(1,100,110);touchMove(1,100,70);G.t+=.05;touchUp(1);assert.equal(PC.neutral,false);
 touchDown(2,100,110);touchMove(2,100,70);G.t+=.2;touchUp(2);assert.equal(PC.neutral,true);
`);
test('Five-speed cars reject the absent sixth slot without stranding the engine in neutral', `
 resetRace();PC.auto=false;PC.gears=5;PC.gear=5;CTL.pads={gate:{x:0,y:0,w:400,h:220}};
 touchDown(1,100,80);touchMove(1,100,120);touchMove(1,100,160);touchUp(1);
 assert.equal(PC.gear,5);assert.equal(PC.neutral,false);
`);
test('A second thumb cannot steal the active H-gate and leaving its zone cancels the stroke', `
 resetRace();PC.auto=false;PC.gear=2;CTL.pads={gate:{x:0,y:0,w:400,h:220}};
 touchDown(1,100,110);touchMove(1,100,70);touchDown(2,150,120);assert.equal(CTL.touches.size,1);
 touchMove(1,600,70);assert.equal(PC.gear,2);assert.equal(PC.neutral,false);assert.equal(CTL.knob.active,false);touchUp(1);
`);
test('holding Enter cannot skip title, car selection and setup screens', `
  resetRace(); UI.scr='title';
  const emit=(repeat=false)=>listeners.get('keydown').forEach(fn=>fn({code:'Enter',repeat,preventDefault(){}}));
  emit(); for(let i=0;i<5;i++) emit(true);
  assert.equal(UI.unlocked,true); assert.equal(UI.scr,'title'); assert.equal(starts,0);
  emit(); for(let i=0;i<5;i++) emit(true);
  assert.equal(UI.scr,'select'); assert.equal(starts,0);
  emit(); for(let i=0;i<5;i++) emit(true);
  assert.equal(UI.scr,'setup'); assert.equal(starts,0);
  emit(); assert.equal(UI.scr,null); assert.equal(starts,1);
`);
test('holding Space confirms the title once and held arrows still browse cars', `
  resetRace(); UI.scr='title'; UI.unlocked=true;
  const emit=(code,repeat=false)=>listeners.get('keydown').forEach(fn=>fn({code,repeat,preventDefault(){}}));
  emit('Space'); for(let i=0;i<5;i++) emit('Space',true);
  assert.equal(UI.scr,'select'); assert.equal(starts,0);
  CARS.push({...CARS[0]},{...CARS[0]},{...CARS[0]});
  emit('ArrowRight'); emit('ArrowRight',true);
  assert.equal(UI.sel,2);
`);
test('losing focus releases keyboard and touch inputs', `
  resetRace(); CTL.keys.KeyW=true; CTL.keys.KeyD=true; CTL.steer=1;
  CTL.touches.set(7,{kind:'gas'}); CTL.steerTouch=7; CTL.knob.active=true;
  PC.throttle=1; PC.steerIn=1;
  assert.ok(listeners.has('blur'),'blur reset listener missing');
  listeners.get('blur').forEach(fn=>fn());
  readControls(1/60);
  assert.equal(PC.throttle,0); assert.equal(PC.brake,0); assert.equal(PC.steerIn,0);
  assert.equal(CTL.touches.size,0); assert.equal(CTL.steerTouch,null); assert.equal(CTL.knob.active,false);
`);
test('hiding the page releases held inputs', `
  resetRace(); CTL.keys.KeyW=true; CTL.touches.set(3,{kind:'gas'});
  document.hidden=true;
  assert.ok(listeners.has('visibilitychange'),'visibility reset listener missing');
  listeners.get('visibilitychange').forEach(fn=>fn()); readControls(1/60);
  assert.equal(PC.throttle,0); assert.equal(CTL.touches.size,0);
`);
test('restarting restores previously triggered procession and tram events', `
  resetRace(); const procession={done:true}; PC.piece.parades=[procession];
  HAZ.xings.push({t:4,hitT:1,on:true,warnOn:true,bellT:.4,x:2});
  hazardsReset();
  assert.equal(procession.done,false); assert.equal(HAZ.xings[0].bellT,0);
  assert.equal(HAZ.xings[0].t,-1); assert.equal(HAZ.xings[0].on,false);
`);
test('checkpoint reached before the deadline awards time exactly once', `
  const p=resetRace({time:.01}); p.checkS=100.6; PC.v=60;
  raceUpdate(.02);
  assert.equal(RACE.state,'run'); assert.ok(RACE.checked.has(p));
  assert.ok(Math.abs(RACE.time-94.99)<1e-8); assert.equal(RACE.stageNo,2);
  raceUpdate(.02); assert.equal(RACE.stageNo,2); assert.equal(RACE.splits.length,1);
`);
test('a checkpoint reached after the deadline cannot revive the race', `
  const p=resetRace({time:.01}); p.checkS=101.2; PC.v=60;
  raceUpdate(.02);
  assert.equal(RACE.state,'timeup'); assert.equal(RACE.checked.size,0); assert.equal(RACE.time,0);
  assert.ok(Math.abs(RACE.elapsed-.01)<1e-8,'elapsed time included expired driving');
`);
test('a finish before the deadline is counted and a late finish is rejected', `
  let p=resetRace({time:.01}); p.goalS=100.6; PC.v=60; raceUpdate(.02);
  assert.equal(RACE.state,'goal'); assert.equal(RACE.goal,p.id);
  p=resetRace({time:.01}); p.goalS=101.2; PC.v=60; raceUpdate(.02);
  assert.equal(RACE.state,'timeup'); assert.equal(RACE.goal,null);
`);
test('forks choose the driven side and preserve route/camera continuity', `
  const p=resetRace(); const left=piece('left'),right=piece('right');
  p.L=101; p.children=[left,right]; p.forkOff=[-7,7];
  PC.x=-4; CAM.lat=-4; PC.v=60; raceUpdate(.02);
  assert.equal(PC.piece,left); assert.equal(RACE.route.at(-1),'left');
  assert.ok(PC.s>=0 && PC.s<2); assert.ok(Math.abs(PC.x-3)<.01); assert.equal(CAM.lat,3);
`);
test('steering is symmetric and releasing steering settles lateral speed', `
  resetRace(); PC.v=40; PC.steerIn=1;
  for(let i=0;i<12;i++) pcStep(1/120); const right=PC.x;
  resetRace(); PC.v=40; PC.steerIn=-1;
  for(let i=0;i<12;i++) pcStep(1/120);
  assert.ok(right>0); assert.ok(Math.abs(PC.x+right)<1e-9);
  PC.steerIn=0; for(let i=0;i<120;i++) pcStep(1/120);
  assert.ok(Math.abs(PC.vx)<.00001);
`);
test('a solid head-on obstacle causes a crash and recovery returns to the road', `
  const p=resetRace(); PC.v=60;
  p.colliders.push({s0:99,s1:105,x0:-2,x1:2,kind:'solid'}); pcStep(1/60);
  assert.ok(PC.crash); assert.equal(RACE.crashes,1);
  p.colliders.length=0; for(let i=0;i<360;i++) pcStep(1/120);
  assert.equal(PC.crash,null); assert.equal(PC.airY,0); assert.equal(PC.roll,0);
  assert.ok(PC.x>-p.hw(PC.s) && PC.x<p.hw(PC.s));
`);
test('traffic spacing rejects a blocked road and retains a car-wide route', `
  const p=resetRace();
  assert.equal(gapLeft(p,100,[[-7.4,-2],[-1,3]],5.2,2.5),false);
  assert.equal(gapLeft(p,100,[[-7.4,-2]],3,1.8),true);
`);

let failures = 0;
for (const {name, body} of tests) {
  try { vm.runInContext(body, context(), {filename:name}); console.log('PASS',name); }
  catch(error) { failures++; console.error('FAIL',name,'\n ',error.message); }
}
console.log(`${tests.length-failures}/${tests.length} gameplay checks passed (${path.basename(sourcePath)})`);
process.exitCode = failures ? 1 : 0;
