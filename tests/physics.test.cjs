// Run: node tests/physics.test.cjs [index.html]
// Real player/traffic functions execute in a deterministic, DOM-free VM.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const sourcePath=process.argv[2]||path.resolve(__dirname,'../index.html');
const source=fs.readFileSync(sourcePath,'utf8').replace(/\r\n/g,'\n');
function section(a,b){const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert(x>=0&&y>x,a);return source.slice(x,y);}
const player=section('const REDLINE = ','// ===================== controls:');
const traffic=section('const TRAFFIC = ','// a vehicle on screen:');
function context(){const sandbox={assert,console,Math:Object.create(Math),performance:{now:()=>10000},Map,Set};vm.createContext(sandbox);vm.runInContext(`
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,DS=2,LANE=3.7,TAU=Math.PI*2;
const G={t:0},RACE={state:'run',stageNo:1,score:0,crashes:0},FX={hopV:0},HAZ={list:[],xings:[]};
const SPR={},TRAFFIC_SPR={},trainsUpdate=()=>{},onCrash=()=>RACE.crashes++;
const sfxShift=()=>{},sfxSkid=()=>{},sfxCrash=()=>{},sfxThud=()=>{},sfxScrape=()=>{},sfxClang=()=>{},sfxHorn=()=>{},sfxPass=()=>{},sfxTrainHorn=()=>{},hudMsg=()=>{},shake=()=>{},fxHit=()=>{};
const baseSpec={W:1.9,L:4.4,mass:.7,top:300,acc:.8,grip:.8,steer:.8,gears:6,engine:'v12'};
function piece(){return{id:'test',L:10000,def:{traffic:{per100:0,mix:{sedan:1}}},colliders:[],parades:[],Y:[],at:()=>0,curv:()=>0,hw:()=>20,shoulder:()=>0,leftEdge:()=>-20,rightEdge:()=>20,sec:()=>({L:'grass',R:'grass',track:false})};}
function reset(speed=0){pcSetup({...baseSpec},true,false);PC.piece=piece();PC.s=100;PC.x=0;PC.v=speed;PC.auto=false;PC.gear=speed>30?4:1;PC.lastHit=0;RACE.crashes=0;G.t=0;TRAFFIC.list=[];TRAFFIC.edgeS=99999;TRAFFIC.safetyPlan=null;HAZ.list=[];HAZ.xings=[];}
function vehicle(speed=4,x=0,type='sedan'){const q={p:PC.piece,s:103.5,x,v:speed,v0:speed,len:4.5,wid:1.8,type,hitT:0,push:0,lc:null,lcT:999,sigT:0,brake:0,wob:0,manners:{every:99,signal:1,ahead:99,weave:0,cut:0}};TRAFFIC.list=[q];return q;}
function momentum(a,b){return{v:a.massKg*a.v+b.massKg*b.v,vx:a.massKg*a.vx+b.massKg*b.vx};}
function energy(a,b){return .5*a.massKg*(a.v*a.v+a.vx*a.vx)+.5*b.massKg*(b.v*b.v+b.vx*b.vx);}
function near(a,b,tol=1e-7){assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);}
`,sandbox);vm.runInContext(player+traffic,sandbox,{filename:sourcePath});return sandbox;}
const tests=[];function test(name,body){tests.push({name,body});}
test('Ignition and countdown hold the grid against a real approaching train; run still collides',`
for(const phase of ['ignition','countdown','run']){
 reset(0);RACE.state=phase;const train=vehicle(-15,0);train.train=true;
 // Distant trains keep the countdown spawn branch out of this DOM-free fixture.
 TRAFFIC.list.push({...train,s:500},{...train,s:1000});
 const before={s:PC.s,x:PC.x,v:PC.v,vx:PC.vx};trafficUpdate(0);
 if(phase==='run'){assert(Math.abs(PC.v)>.1);assert.notEqual(PC.s,before.s);}
 else {assert.deepEqual({s:PC.s,x:PC.x,v:PC.v,vx:PC.vx},before);assert.equal(PC.crash,null);}
}
`);
test('Low-speed car and near-stationary train contacts stay on the ground',`
reset(5);vehicle(4);trafficUpdate(0);assert.equal(PC.crash,null);assert.equal(PC.airY,0);assert.equal(PC.roll,0);
reset(0);const train=vehicle(-.1);train.train=true;trafficUpdate(0);assert.equal(PC.crash,null);
for(let i=0;i<24;i++)pcStep(1/120);assert.equal(PC.airY,0);assert.equal(PC.roll,0);
`);
test('Kilogram mapping makes a bus affect a car more without changing UI mass',`
function impact(type){reset(35);const other=vehicle(20,0,type);const rating=PC.spec.mass;trafficUpdate(0);assert.equal(PC.spec.mass,rating);return PC.v;}
assert(impact('bus')<impact('sedan'));assert.equal(playerMassKg({mass:.5}),1300);assert.equal(trafficMassKg({train:true}),38000);
`);
test('Centred frontal contacts have deterministic zero spin and no vertical launch',`
function impact(rnd){reset(70);Math.random=()=>rnd;vehicle(15);trafficUpdate(0);assert(PC.crash);const spin=PC.crash.spin;
for(let i=0;i<24;i++)pcStep(1/120);assert.equal(PC.airY,0);assert.equal(PC.roll,0);assert.equal(PC.yaw,0);return spin;}
assert.equal(impact(.1),0);assert.equal(impact(.9),0);
`);
test('Same-speed side contact and its cooldown cannot repeatedly remove speed',`
reset(40);const other=vehicle(40*WORLD_K,1.5);
for(let i=0;i<60;i++){other.s=PC.s+2;other.x=PC.x+1.5;other.v=other.v0=PC.v*WORLD_K;trafficUpdate(0);}
assert.equal(PC.v,40);assert.equal(PC.crash,null);assert(PC.x<other.x);
reset(30);const moving=vehicle(30*WORLD_K,1.5);PC.vx=4;trafficUpdate(0);const firstV=PC.v,firstVx=PC.vx;
// Cooldown is active even if a test keeps placing the same bodies in contact.
moving.s=PC.s+2;moving.x=PC.x+1.5;trafficUpdate(0);assert.equal(PC.v,firstV);assert.equal(PC.vx,firstVx);
`);
test('Two-body impulses conserve momentum, never add energy and retain glancing tangent',`
for(let i=0;i<180;i++){
 const a={v:(i%19)*5-20,vx:(i%11)-5,massKg:700+(i%7)*250},b={v:15-(i%13)*3,vx:3-(i%5),massKg:180+(i%9)*2000};
 const angle=i*.37,n={s:Math.cos(angle),x:Math.sin(angle)},before=momentum(a,b),ke=energy(a,b);
 const q=solveVehicleImpulse(a,b,n,(i%11)/10,.08),aa={...q.a,massKg:a.massKg},bb={...q.b,massKg:b.massKg},after=momentum(aa,bb);
 near(before.v,after.v);near(before.vx,after.vx);assert(energy(aa,bb)<=ke+1e-7*Math.max(1,ke));
}
const a={v:50,vx:4,massKg:1400},b={v:20,vx:0,massKg:1800},n={s:.6,x:.8},q=solveVehicleImpulse(a,b,n,.2,0),t={s:-.8,x:.6};
near(a.v*t.s+a.vx*t.x,q.a.v*t.s+q.a.vx*t.x);near(b.v*t.s+b.vx*t.x,q.b.v*t.s+q.b.vx*t.x);
const direct=solveVehicleImpulse(a,b,{s:1,x:0}),side=solveVehicleImpulse(a,b,{s:0,x:1});assert(a.v-side.a.v<a.v-direct.a.v);
assert.equal(solveVehicleImpulse(a,b,{s:1,x:0},5).restitution,1);
`);
test('Actual trafficUpdate commits equal-opposite world momentum and bounded separation',`
reset(35);const other=vehicle(20,0,'bus'),ma=playerMassKg(),mb=trafficMassKg(other);
const before=momentum({v:PC.v*WORLD_K,vx:PC.vx,massKg:ma},{v:other.v,vx:0,massKg:mb});const oldS=PC.s,oldOtherS=other.s;
trafficUpdate(0);const after=momentum({v:PC.v*WORLD_K,vx:PC.vx,massKg:ma},{v:other.v,vx:other.push,massKg:mb});
near(before.v,after.v);near(before.vx,after.vx);assert(PC.s<other.s);assert(Math.abs(PC.s-oldS)<=.18);assert(Math.abs(other.s-oldOtherS)<=.18);
`);
test('Existing steering release inertia and stationary full-lock behavior are retained',`
reset(40);PC.steerIn=1;for(let i=0;i<12;i++)pcStep(1/120);const previous=PC.vx;PC.steerIn=0;pcStep(1/120);assert(PC.vx>0&&PC.vx<previous);
for(let i=0;i<120;i++)pcStep(1/120);assert(Math.abs(PC.vx)<.00001);
reset(0);PC.steerIn=1;for(let i=0;i<120;i++)pcStep(1/120);assert.equal(PC.vx,0);assert.equal(PC.airY,0);assert.equal(PC.roll,0);
`);
let failed=0;for(const t of tests){try{vm.runInContext(t.body,context(),{filename:t.name,timeout:5000});console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}
console.log((tests.length-failed)+'/'+tests.length+' physics checks passed');process.exitCode=failed?1:0;
