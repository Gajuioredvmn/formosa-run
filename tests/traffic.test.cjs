// Run: node tests/traffic.test.cjs [index.html] [external-report.json]
// Executes the game's real traffic/hazard code with deterministic randomness.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(process.argv[2]||path.resolve(__dirname,'../index.html'),'utf8').replace(/\r\n/g,'\n');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert(start>=0&&end>start,a);return source.slice(start,end);}
const pieceClass=section('class Piece {','// ===================== what lies beside the road:');
const traffic=section('const TRAFFIC = ','// a vehicle on screen:');
const tram=section('function tramXUpdate(dt) {','function paintPedSide(');
const hazards=section('const HAZ_SIDES = ','// the tram going across,');
const parade=section('const PARADE = ','function drawParadeOne(');
const trains=section('function trainsUpdate(dt) {','// the horn, two tones, long');
const contacts=section('function findCollider(p, s, x, hl, hw, kind) {','// ===================== controls:');
const sandbox={console,assert,Math:Object.create(Math),performance:require('node:perf_hooks').performance,Map,Set,window:{FORMOSA_HD:{status:{active:false}}}};vm.createContext(sandbox);
vm.runInContext(`
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const LANE=3.7,DS=2,TAU=Math.PI*2,WORLD_K=1.5;
const RACE={stageNo:4,state:'run',score:0},G={t:0};
const PC={s:0,x:999,v:35,spec:{W:2,L:5.15},crash:null,steerIn:0};
const HAZ={list:[],xings:[],nextS:100,spinT:0};
const TRAINS={nextT:0,kinds:{ali:{name:'alitrainx'}}};
const SPR={},TRAFFIC_SPR={};
for(const type of ['sedan','taxi','pickup','bluetruck','bus','gravel','scooter','suv','wagon','rebar','logs','alitrainx']) {SPR[type]={name:type};TRAFFIC_SPR[type]={rear:[type],front:[type],turn:[null]};}
const sfxTrainHorn=()=>{},hudMsg=()=>{},pcCrash=()=>{},fxHit=()=>{},sfxClang=()=>{},sfxHorn=()=>{},sfxScrape=()=>{},shake=()=>{},sfxPass=()=>{},sfxBell=()=>{},sfxThud=()=>{},sfxDrums=()=>{};
function piece(width=3.7){const secs=[{start:0,end:10000,L:'city',R:'city',track:false}];return {id:'test',L:10000,def:{traffic:{per100:1.4,mix:{sedan:2,bus:1,scooter:2,bluetruck:1}}},secs,secStartS:[0],parades:[],colliders:[],
  hw:()=>width,shoulder:()=>2.6,leftEdge:()=>-width-1.2,rightEdge:()=>width+2.6,
  sec:s=>secs[0],outerL:()=>-width-1.2,outerR:()=>width+2.6};}
`,sandbox);
vm.runInContext(pieceClass+traffic+tram+hazards+parade+trains+contacts,sandbox);
const tests=[];function test(name,fn){try{vm.runInContext('(()=>{'+fn+'})()',sandbox,{timeout:180000});tests.push({name,pass:true});console.log('PASS '+name);}catch(e){tests.push({name,pass:false,error:String(e.stack||e)});console.log('FAIL '+name+' '+e.message);}}
test('Selected car dimensions drive gap and collision geometry',`assert.equal(playerWidth(),2);assert.equal(playerLength(),5.15);PC.spec={W:1.7,L:4};assert.equal(playerWidth(),1.7);PC.spec={W:2,L:5.15};`);
test('Long guardrails stay solid and HD collider selection avoids legacy invisible objects',`
const p=piece();const wall={s0:0,s1:800,x0:4,x1:5,kind:'wall'};p.colliders=[wall];
assert.equal(findCollider(p,350,3.5,2.5,1,'wall'),wall);assert.equal(nearIntervals(p,350,5,null,0).length,1);
p.hdColliders=[];assert.equal(findCollider(p,350,3.5,2.5,1,'wall'),wall,'Inactive HD geometry cannot hide visible classic obstacles');
window.FORMOSA_HD.status.active=true;
assert.equal(findCollider(p,350,3.5,2.5,1,'wall'),null);assert.equal(nearIntervals(p,350,5,null,0).length,0);
p.hdColliders=[wall];assert.equal(findCollider(p,700,3.5,2.5,1,'wall'),wall);assert.equal(nearIntervals(p,700,5,null,0).length,1);
window.FORMOSA_HD.status.active=false;
p.hdColliders=[{s0:0,s1:800,x0:-5,x1:-4,kind:'wall'}];
assert.equal(findCollider(p,350,-4.5,2.5,1,'wall'),null,'Classic fallback cannot retain invisible HD walls');
assert.equal(findCollider(p,350,3.5,2.5,1,'wall'),wall);
`);
test('Cars + procession + near-road static count in the same occupancy',`
PC.piece=piece();const p=PC.piece;TRAFFIC.list=[{p,s:100,x:-2,len:4,wid:2}];HAZ.list=[{p,s:100,x:1,len:3,wid:2.5,parade:true}];p.colliders=[{s0:95,s1:105,x0:4,x1:6,kind:'solid'}];
assert.equal(nearIntervals(p,100,5,null,0).length,3);assert.equal(trafficFree(p,100).length,0);
`);
test('An in-progress lane change yields before closing the last gap',`
PC.piece=piece(3.7);const p=PC.piece;HAZ.list=[];TRAFFIC.list=[{p,s:100,x:-2,len:4,wid:2},{p,s:100,x:3.8,len:4,wid:2}];
const moving=TRAFFIC.list[1],before=moving.x;assert(trafficCorridorOpen(p,80,120));assert.equal(trafficTryMove(moving,100,2.8),false);assert.equal(moving.x,before);assert(trafficCorridorOpen(p,80,120));
`);
test('A small collision rollback cannot reopen an unprotected approach behind the safety plan',`
PC.piece=piece(3.7);const p=PC.piece;p.leftEdge=()=>-3.7;p.rightEdge=()=>3.7;
PC.s=100;G.t=0;HAZ.list=[];HAZ.xings=[];TRAFFIC.safetyPlan=null;
const left={p,s:81,x:-1.85,len:10,wid:2.5},right={p,s:108,x:1.85,len:10,wid:2.5};
TRAFFIC.list=[left,right];assert(trafficCorridorOpen(p,60,200));trafficEnsurePlan(p,true);
// The player's front gains a metre; collision separation then takes it back.
PC.s=101;G.t=1;trafficEnsurePlan(p,true);
assert.equal(trafficTryMove(right,95,right.x),false,'The lorry must not seal the recently traversed approach');
PC.s=100;assert(trafficCorridorOpen(p,PC.s-12,200),'The escape path must survive a small backwards correction');
`);
test('Alternating disconnected openings are rejected despite each row having a gap',`
PC.piece=piece(3.7);const p=PC.piece;p.leftEdge=()=>-3.7;p.rightEdge=()=>3.7;HAZ.list=[];
TRAFFIC.list=[{p,s:100,x:-1.65,len:4,wid:3.9},{p,s:109,x:1.65,len:4,wid:3.9}];
assert(trafficFree(p,98).length);assert(trafficFree(p,111).length);assert.equal(trafficCorridorOpen(p,92,117),false);
`);
test('Elevated tram is visibly assigned height and excluded from ground blockage',`
PC.piece=piece();const p=PC.piece;TRAFFIC.list=[];HAZ.list=[];HAZ.xings=[{p,s:100,x:-10,len:22,on:true,elevated:true,height:5.4}];
assert(trafficCorridorOpen(p,80,120));HAZ.xings[0].elevated=false;assert.equal(trafficCorridorOpen(p,80,120),false);HAZ.xings=[];
`);
test('A second train may not seal the opposing escape track',`
PC.piece=piece(3.7);const p=PC.piece;p.leftEdge=()=>-3.7;p.rightEdge=()=>3.7;HAZ.list=[];TRAFFIC.list=[{p,s:100,x:-1.85,len:12,wid:2.8,train:true}];
assert(trafficCorridorOpen(p,75,125));const other={p,s:140,x:1.85,len:12,wid:2.8,train:true};TRAFFIC.list.push(other);
assert.equal(trafficTryMove(other,110,other.x),false);assert.equal(other.s,140);
`);
test('3 seeded joint traffic + rider + parade simulations retain a continuous passage',`
let checked=0,edgeCount=0;
for(let seed=1;seed<=3;seed++){
 let r=seed;Math.random=()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296;};
 PC.piece=piece(3.7);const p=PC.piece;p.parades=[{s:800,kind:seed%2?'wangye':'mazu',done:false},{s:2400,kind:'mazu',done:false}];
 p.colliders=[{s0:1200,s1:1250,x0:4.8,x1:6.3,kind:'solid'},{s0:2900,s1:2920,x0:-5,x1:-4.4,kind:'wall'}];
 PC.s=0;PC.v=35;PC.crash=null;PC.x=999;G.t=0;HAZ.list=[];HAZ.xings=[];HAZ.nextS=200;trafficReset();
 for(let i=0;i<900;i++){const dt=.05;G.t+=dt;PC.s+=32*dt;hazardsUpdate(dt);trafficUpdate(dt);
  if(i%20===0){assert(trafficCorridorOpen(p,PC.s,Math.min(p.L,PC.s+450)),'seed '+seed+' s '+PC.s);checked++;}
  edgeCount+=TRAFFIC.list.some(v=>v.edgeUser)?1:0;
 }
}
assert(checked===135);assert(edgeCount>100);globalThis.simulation={seeds:3,seconds:135,invariantChecks:checked,edgeFrames:edgeCount};
`);
test('Ten thousand roadside colliders leave the same passage without quadratic planning',`
const p=Object.assign(Object.create(Piece.prototype),piece());p.L=10000;p.N=5001;
p.W=new Float32Array(p.N).fill(3.7);p.M=new Float32Array(p.N).fill(1.2);p.SH=new Float32Array(p.N).fill(2.6);
for(const k of ['hw','shoulder','leftEdge','rightEdge'])delete p[k];
PC.piece=p;PC.s=80;TRAFFIC.list=[];HAZ.list=[];HAZ.xings=[];
const expected=[];assert(trafficCorridorOpen(p,80,920,expected));
p.hdColliders=Array.from({length:10000},(_,i)=>({s0:i-1,s1:i+1,x0:i%2?-32:30,x1:i%2?-30:32,kind:'solid'}));
window.FORMOSA_HD.status.active=true;
const start=performance.now();const actual=[];assert(trafficCorridorOpen(p,80,920,actual));
assert.deepEqual(actual,expected,'Off-road objects must not create artificial extra path events');
for(let i=0;i<80;i++)assert(trafficCorridorOpen(p,80,920));
const ms=performance.now()-start;assert(ms<1500,'81 plans with 10,000 roadside colliders took '+ms+'ms');
assert.equal(findCollider(p,500,31,2.5,1),p.hdColliders[498],'Physical roadside collision remains active');
globalThis.largeScenery={colliders:10000,plans:81,ms,msPerPlan:ms/81};
window.FORMOSA_HD.status.active=false;
`);
test('A long wall is retained when road widening reaches it between its endpoints',`
const p=Object.assign(Object.create(Piece.prototype),piece());p.L=400;p.N=201;
p.W=new Float32Array(p.N).fill(3.7);p.M=new Float32Array(p.N);p.SH=new Float32Array(p.N);
for(let i=60;i<=90;i++)p.W[i]=3.7+8.3*(1-Math.abs(i-75)/15);
for(const k of ['hw','shoulder','leftEdge','rightEdge'])delete p[k];
PC.piece=p;TRAFFIC.list=[];HAZ.list=[];HAZ.xings=[];
p.hdColliders=[{s0:100,s1:200,x0:8.4,x1:9.2,kind:'wall'}];
window.FORMOSA_HD.status.active=true;
assert(p.rightEdge(100)<8.4&&p.rightEdge(200)<8.4&&p.rightEdge(150)>9.2);
assert.equal(trafficFree(p,150).some(q=>q[0]<=8.8&&q[1]>=8.8),false);
const plan=[];assert(trafficCorridorOpen(p,80,220,plan));assert(plan.some(q=>q.s===150));
assert.equal(findCollider(p,150,8.8,2.5,1),p.hdColliders[0]);
window.FORMOSA_HD.status.active=false;
`);
test('Freight types have distinct full-body dimensions and stay out of narrow sightseeing streets',`
assert(VTYPES.semi.len>17&&VTYPES.semi.massKg>30000);assert(VTYPES.flatbed.len>11&&VTYPES.tanker.massKg>24000);assert(VTYPES.motorbike.len>VTYPES.scooter.len);
const p=piece(7.4);p.secs[0].L='industrial';p.secs[0].R='harbor';p.secs[0].tags=['refinery'];const m=trafficMix(p,500);assert(m.semi>0&&m.tanker>m.flatbed);
p.secs[0].L='town';p.secs[0].R='town';p.secs[0].tags=['lukang'];assert(!trafficMix(p,500).semi&&!trafficMix(p,500).tanker);p.hw=()=>3.7;assert(!trafficMix(p,500).gravel);
`);
test('Following uses bumper distance and a loaded tanker brakes earlier than a sedan',`
const p=piece(7.4);PC.piece=p;HAZ.list=[];const lead={p,s:150,x:0,len:12,wid:2.5,v:14};const truck={p,s:100,x:0,len:12,wid:2.5,v:20,v0:20,type:'tanker'},car={...truck,type:'sedan',len:4.5,wid:1.8};TRAFFIC.list=[lead,truck];const heavyTarget=trafficFollowTarget(truck);TRAFFIC.list=[lead,car];assert(heavyTarget<trafficFollowTarget(car));
lead.s=109;assert.equal(trafficFollowTarget(car),0);
`);
test('A long trailer waits for fast approaching traffic throughout its signalled lane change',`
const p=piece(7.4);PC.piece=p;PC.s=0;PC.x=999;PC.v=0;const truck={p,s:100,x:-2,len:17.5,wid:2.5,v:16,type:'semi'},fast={p,s:55,x:2,len:4.5,wid:1.8,v:30};TRAFFIC.list=[truck,fast];assert.equal(trafficLaneSafe(truck,2,1.6),false);
fast.s=-150;assert.equal(trafficLaneSafe(truck,2,1.6),true);fast.s=300;fast.lc={x:-2};assert.equal(trafficLaneSafe(truck,2,1.6),true);
`);
const result={passed:tests.every(t=>t.pass),tests,simulation:sandbox.simulation,largeScenery:sandbox.largeScenery};if(process.argv[3]){const reportPath=path.resolve(process.argv[3]);fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(result,null,2));}console.log(JSON.stringify(result,null,2));process.exitCode=result.passed?0:1;
