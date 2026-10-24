const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx={window:{},Math};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../render/road-events.js'),'utf8'),ctx);const E=ctx.window.FormosaRoadEvents;
let passed=0;function test(name,fn){fn();console.log('PASS '+name);passed++;}
const piece=(id,secs)=>({id,L:3000,secs,secStartS:secs.map((_,i)=>i*600)});
function api(p){return{PC:{piece:p,s:0},ROUTE:{pieces:[p]},TRAFFIC:{list:[]},HAZ:{list:[]},G:{t:0},SPR:{'event_boar#0':{},'event_cow#0':{},event_crate:{},event_barrel:{},event_bale:{},event_escooter:{},event_float:{}},edges:()=>[-7.4,7.4],width:()=>2,length:()=>4.5,hud(){},spawn(h){this.HAZ.list.push(h);return true;},move(h,s,x){h.s=s;h.x=x;return true;},contact(){}};}
test('Boars stay in the low tea foothills and cattle only in the Taitung-to-Luye farm segment',()=>{
 assert.equal(E.configure(piece('s3m',[{L:'tea',R:'hills',tags:[]}]))[0].kind,'boar');assert.equal(E.configure(piece('s4c',[{L:'paddy',R:'hills',tags:['balloons']}]))[0].kind,'cow');
 for(const id of ['s1','s5a','s5d','s5e'])assert.equal(E.configure(piece(id,[{L:'mountain',R:'cliff',tags:['cypress','balloons']}])).length,0);
});
test('Group members wait after a visible warning and cross at staggered times through shared movement guards',()=>{
 const p=piece('s3m',[{L:'tea',R:'hills',tags:[]}]),a=api(p),q={kind:'boar',s:400,side:1,label:'test'};assert(E.spawnGroup(a,q));assert.equal(a.HAZ.list.length,4);const first=a.HAZ.list[0],last=a.HAZ.list.at(-1);assert(first.warning>=2.4&&last.warning>first.warning+4);assert(last.s-first.s>=40);
 first.t=first.warning-.1;const x=first.x;E.step(a,first,.1);assert.equal(first.x,x);first.t=first.warning+.1;E.step(a,first,.1);assert(first.x<x);
 a.move=()=>false;const held=first.x;E.step(a,first,.1);assert.equal(first.x,held);
});
test('Cargo initially inherits truck velocity, gravity falls downward, restitution dissipates and rolling stops',()=>{
 const h={s:0,x:0,y:1.3,vy:.5,v:18,vx:.6,roll:0,spin:2,bounces:0,cargoKind:'crate'};const move=(o,s,x)=>{o.s=s;o.x=x;return true;};let bounceEnergy=Infinity;
 for(let i=0;i<1200;i++){const before=h.bounces;E.cargoStep(h,1/60,move);assert(h.y>=0&&h.v>=0);if(h.bounces>before){assert(h.vy*h.vy<bounceEnergy);bounceEnergy=h.vy*h.vy;}}
 assert.equal(h.v,0);assert.equal(h.y,0);assert(Math.abs(h.vx)<.001);assert(h.s>18&&h.s<80);assert(h.bounces>0&&h.bounces<6);
});
test('Unsafe cargo movement stops at the retained position rather than teleporting through the last gap',()=>{
 const h={s:100,x:0,y:0,vy:0,v:18,vx:1,roll:0,spin:2,bounces:0,cargoKind:'barrel'};E.cargoStep(h,.1,()=>false);assert.equal(h.s,100);assert.equal(h.x,0);assert.equal(h.v,0);assert.equal(h.vx,0);
});
test('A loose-load warning precedes one real drop and does not recur every frame',()=>{
 const p=piece('s1',[{L:'industrial',R:'industrial',tags:[]}]),a=api(p),v={p,s:300,x:2,len:12,v:16,type:'flatbed'};let textWarnings=0;a.hud=()=>textWarnings++;a.TRAFFIC.list=[v];E.update(a,.016);assert.equal(v.cargoWarnAt,0);assert.equal(a.HAZ.list.length,0);assert.equal(textWarnings,0,'Cargo warning uses its carrier icon and road trace instead of central text');assert(E.warnings(a).length===1);
 a.G.t=2.3;E.update(a,.016);assert.equal(a.HAZ.list.length,0);a.G.t=2.5;E.update(a,.016);assert.equal(a.HAZ.list.length,1);assert.equal(a.HAZ.list[0].v,16);assert.equal(a.HAZ.list[0].s,292.9);E.update(a,.016);assert.equal(a.HAZ.list.length,1);
});

test('The narrow ground forecast follows the carrier and contains the real landing and full rolling footprint',()=>{
 for(const type of ['pickup','bluetruck','flatbed','semi'])for(const speed of [0,12,26]){
  const p=piece('s1',[{L:'industrial',R:'industrial',tags:[]}]),a=api(p),v={p,s:500,x:2,len:12,v:speed,type,cargoWarnAt:0};a.G.t=2.4;
  const w=E.forecastCargo(a,v),h=E.cargoBody(v),move=(o,s,x)=>{o.s=s;o.x=x;return true;};let firstImpact=null;
  for(let i=0;i<2400;i++){
   E.cargoStep(h,1/60,move);if(!firstImpact&&h.bounces)firstImpact={s:h.s,x:h.x};
   const span=E.warningSlice(w,h.s);assert(span&&h.x-h.wid/2>=span.left-.001&&h.x+h.wid/2<=span.right+.001,'Every landed or rolling cargo footprint stays in the warned strip');
   if(h.y===0&&h.v===0)break;
  }
  assert(firstImpact);assert(Math.abs(w.impact.s-firstImpact.s)<1e-8&&Math.abs(w.impact.x-firstImpact.x)<1e-8);assert(w.halfWidth*2<=3.5,'The trace includes this car clearance while staying under one lane, not the whole road');
  a.G.t=1;v.lc={x:-2,wait:.3};v.sigT=1;const changing=E.forecastCargo(a,v);assert(changing.points[1].x<v.x,'A real signalled lane change moves the predicted release laterally');
  const oldS=changing.s0;v.s+=12;v.x=-1;const next=E.forecastCargo(a,v);assert.equal(next.s0-oldS,12);assert.equal(next.points[0].x,-1);
 }
});
test('Missing artwork defers new event spawns, and restart clears all encounter flags',()=>{
 const p=piece('s3m',[{L:'tea',R:'hills',tags:[]}]),a=api(p);a.SPR={};a.PC.s=0;E.update(a,.1);assert.equal(a.HAZ.list.length,0);const q=E.configure(p)[0];q.done=true;E.reset(a);assert.equal(q.done,false);
});
test('A rider keeps the same vehicle and person, and unrelated cargo is not dropped by gravel/logs/tankers',()=>{
 const p=piece('s1',[{L:'industrial',R:'industrial',tags:[]}]),a=api(p);a.SPR.event_escooter_rear={};
 const h={eventKind:'escooter',t:0};assert.equal(E.sprite(a,h),'event_escooter_rear');h.t=123;assert.equal(E.sprite(a,h),'event_escooter_rear');
 for(const type of ['gravel','logs','rebar','tanker']){a.TRAFFIC.list=[{p,s:300,x:2,len:12,v:16,type}];E.update(a,.016);assert.equal(a.TRAFFIC.list[0].cargoWarnAt,undefined);}
});
console.log(passed+'/'+passed+' road-event checks passed');
