const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../render/vehicle-motion.js'),'utf8').replace(/\bexport /g,'')+';globalThis.api={clothMotion,warpCloth};',context);
const {clothMotion,warpCloth}=context.api;
function run(kind,drive,hz=60){
 const spec={id:'test'},art={cloth:[{kind,region:[.1,.1,.8,.8],root:[.5,.15],tip:[.6,.8],flex:1}]},pc={spec,v:0,vx:0,wind:0,visual:{time:0,lateralAccel:0}},samples=[];let q;
 for(let f=0;f<=hz*7;f++){const t=f/hz;pc.visual.time=t;drive(pc,t);const before=JSON.stringify(pc);q=clothMotion(spec,pc,art,q);assert.equal(JSON.stringify(pc),before);samples.push({t,...q.parts[0]});}
 return{samples,art,q,pc};
}
test('left/right load is mirrored, delayed, and rebounds after release',()=>{
 const a=run('hair',(p,t)=>p.visual.lateralAccel=t>=1&&t<2?10:0),b=run('hair',(p,t)=>p.visual.lateralAccel=t>=1&&t<2?-10:0);
 a.samples.forEach((p,i)=>assert(Math.abs(p.x+b.samples[i].x)<1e-10));
 assert(Math.abs(a.samples[60].x)<.1,'The free tip cannot jump to full deflection in one frame');
 assert(a.samples[90].x<-3,'Sustained lateral load creates visible displacement at logical resolution');
 assert(a.samples.slice(120,240).some(p=>p.x>.05),'Releasing steering permits a damped return past rest');
 assert(Math.abs(a.samples.at(-1).x)<.001);
});
test('acceleration trails cloth backwards; braking pulls it forwards before settling',()=>{
 const a=run('scarf',(p,t)=>{p.v=t<1?0:t<2?20*(t-1):t<3?20:t<4?20*(4-t):0;});
 assert(a.samples[108].y>4);
 assert(a.samples[228].y< -2);
 assert(Math.hypot(a.samples.at(-1).x,a.samples.at(-1).y)<.001);
});
test('long cloth bends in two delayed sections while the attachment remains fixed',()=>{
 const a=run('veil',(p,t)=>p.visual.lateralAccel=t>=1&&t<2?10:0),p=a.samples[69];
 assert(Math.abs(p.midX)>.01&&Math.abs(p.midX-p.x*.45)>.01);
 const [x,y]=warpCloth(50,15,100,100,a.art,{parts:[p]});assert.equal(x,50);assert.equal(y,15);
 const tip=warpCloth(60,80,100,100,a.art,{parts:[p]});assert(tip[0]<60);
});
test('zero wind at rest has no fake animation and repeated draws do not advance time',()=>{
 const a=run('hair',()=>{});assert(a.samples.every(p=>p.x===0&&p.y===0));
 const before=JSON.stringify(a.q);clothMotion(a.pc.spec,a.pc,a.art,a.q);assert.equal(JSON.stringify(a.q),before);
});
test('overlapping real hair and scarves cannot drag any attachment point',()=>{
 const artContext=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../render/vehicle-art-manifest.js'),'utf8').replace(/\bexport /g,'')+';globalThis.art=VEHICLE_ART;',artContext);
 for(const [id,art] of Object.entries(artContext.art)){
  const state={parts:art.cloth.map(()=>({x:4,y:3,midX:1,midY:1}))};
  for(const p of art.cloth){const x=p.root[0]*136,y=p.root[1]*80,actual=warpCloth(x,y,136,80,art,state);assert(Math.hypot(actual[0]-x,actual[1]-y)<1e-8,id+': '+p.kind+' root');}
 }
});
test('high-speed wake has substantially more free-end travel than low-speed wind',()=>{
 const range=speed=>{const p=run('hair',p=>{p.v=speed;}).samples.filter(p=>p.t>=3);return Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x));};
 const stopped=range(0),slow=range(80/3.6),fast=range(220/3.6);
 assert.equal(stopped,0);assert(fast>10,'High-speed hair needs visible travel at normal sprite size');assert(fast>slow*3);
});
