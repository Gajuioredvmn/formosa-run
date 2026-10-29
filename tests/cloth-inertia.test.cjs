const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../render/vehicle-motion.js'),'utf8').replace(/\bexport /g,'')+';globalThis.api={clothMotion,warpCloth,materialAttachment,clothBendGeometry};',context);
const {clothMotion,warpCloth,materialAttachment,clothBendGeometry}=context.api;
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
test('skull and nape stay attached while free hair gains motion smoothly beyond the boundary',()=>{
 const core=[[[.4,.1],[.6,.1],[.6,.5],[.4,.5]]],w=136,h=80;
 const art={cloth:[{kind:'hair',region:[.2,.05,.6,.8],root:[.5,.12],tip:[.65,.75],flex:1}]},state={parts:[{x:12,y:-9}]};
 for(const [u,v] of [[.5,.3],[.5,.49],[.6,.5]]){
  const p=[u*w,v*h],pin=materialAttachment(...p,w,h,core),q=warpCloth(...p,w,h,art,state,0,pin);
  assert.equal(pin,0);assert.deepEqual(Array.from(q),p,'even hard braking cannot pull the head/neck out of its fixed region');
 }
 const samples=[0,.01,.2,1,2.5,4].map(d=>materialAttachment(.6*w+d,.4*h,w,h,core));
 assert.equal(samples[0],0);assert(samples[1]<.0001);assert.equal(samples.at(-1),1);
 for(let i=1;i<samples.length;i++)assert(samples[i]>=samples[i-1]);
 const tip=[.65*w,.75*h],moved=warpCloth(...tip,w,h,art,state,0,materialAttachment(...tip,w,h,core));
 assert(moved[0]-tip[0]>5&&moved[1]-tip[1]< -4,'free lengths retain the existing strong wind/braking response');
});

const realContext=vm.createContext({});
for(const name of ['vehicle-art-manifest','crew-masks-a','crew-masks-b','crew-layers'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../render/'+name+'.js'),'utf8').replace(/\bexport /g,''),realContext);
vm.runInContext('globalThis.real={art:VEHICLE_ART,masks:{...CREW_MASKS_A,...CREW_MASKS_B},contains,polygons,materialMesh};',realContext);
const real=realContext.real;
function clothCases(w=136){
 return Object.entries(real.art).flatMap(([id,art])=>art.cloth.flatMap((p,part)=>{
  if(!['scarf','veil'].includes(p.kind))return[];
  const png=fs.readFileSync(path.join(__dirname,'../render',art.src)),h=Math.round(w*png.readUInt32BE(20)*art.rear[3]/(png.readUInt32BE(16)*art.rear[2]));
  const fixed=real.polygons(real.masks[id].fixed[part]),geometry=clothBendGeometry(p,w,h,fixed);
  return[{id,art,p,part,w,h,fixed,geometry}];
 }));
}
test('real scarf and veil meshes retain orientation throughout extreme reverse loads',()=>{
 const summary=[];
 for(const {id,art,p,part,w,h,fixed,geometry} of [96,136,176].flatMap(clothCases)){
  const W=w*2,H=h*2,source=new Uint8ClampedArray(W*H*4),mask=real.masks[id].cloth[part];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(real.contains(mask,(x+.5)/W,(y+.5)/H)&&!real.contains(real.masks[id].fixed[part],(x+.5)/W,(y+.5)/H))source[(y*W+x)*4+3]=255;
  const mesh=real.materialMesh(source,W,H,64,48),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const loads=[];
  for(const x of [-13.8,0,13.8])for(const y of [-9,0,11.5])for(const lag of [-.45,0,.45])loads.push({x,y,midX:x*lag,midY:y*lag});
  for(let n=0;n<=120;n++)loads.push({x:13.8*Math.sin(n*.117),y:1.25+10.25*Math.cos(n*.083),midX:6.21*Math.sin(n*.117-.8),midY:4.6*Math.cos(n*.083-.7)});
  let minimum=Infinity;
  for(const load of loads){
   const state={parts:art.cloth.map((_,i)=>i===part?load:{x:0,y:0})};
   const moved=new Map(mesh.vertices.map(v=>[v,warpCloth(v.u*w,v.v*h,w,h,art,state,part,materialAttachment(v.u*w,v.v*h,w,h,fixed),geometry)]));
   for(const triangle of mesh.triangles){
    const original=triangle.map(v=>[v.u*w,v.v*h]),deformed=triangle.map(v=>moved.get(v)),ratio=cross(...deformed)/cross(...original);
    minimum=Math.min(minimum,ratio);
    assert(ratio>.2,`${id} ${p.kind} must not collapse/flip: area ratio ${ratio}, load ${JSON.stringify(load)}`);
   }
   const root=[p.root[0]*w,p.root[1]*h],tip=[p.tip[0]*w,p.tip[1]*h],warpedTip=warpCloth(...tip,w,h,art,state,part,1,geometry);
   assert(Math.abs(Math.hypot(warpedTip[0]-root[0],warpedTip[1]-root[1])-geometry.length)<1e-8,id+' keeps free-end reach');
  }
  summary.push({id,width:w,triangles:mesh.triangles.length,states:loads.length,minAreaRatio:+minimum.toFixed(4)});
 }
 console.log('Cloth mesh orientation:',JSON.stringify(summary));
});
test('cached curved cloth keeps fixed contours and disconnected neck loops still',()=>{
 for(const {id,art,p,part,w,h,fixed,geometry} of clothCases()){
  const state={parts:art.cloth.map(()=>({x:-13.8,y:-9,midX:6,midY:4}))};
  const points=[[...p.root],...fixed.flatMap(poly=>poly.flatMap((a,i)=>[a,[(a[0]+poly[(i+1)%poly.length][0])/2,(a[1]+poly[(i+1)%poly.length][1])/2]]))];
  for(const [u,v] of points){const original=[u*w,v*h],moved=warpCloth(...original,w,h,art,state,part,0,geometry);assert(Math.hypot(moved[0]-original[0],moved[1]-original[1])<1e-8,id+' fixed knot/loop');}
  const tip=[p.tip[0]*w,p.tip[1]*h],moved=warpCloth(...tip,w,h,art,state,part,1,geometry);
  assert(Math.hypot(moved[0]-tip[0],moved[1]-tip[1])>3,id+' free end remains visibly flexible');
 }
});
test('actual Oro geometry bends under transverse force but never stretches under radial force',()=>{
 const {art,part,w,h,p,geometry}=clothCases().find(c=>c.id==='oro'),root=[p.root[0]*w,p.root[1]*h],tip=[p.tip[0]*w,p.tip[1]*h];
 const force=(normal,sign)=>({x:(normal?-geometry.dy:geometry.dx)/geometry.length*5*sign,y:(normal?geometry.dx:geometry.dy)/geometry.length*5*sign});
 const turns=[];
 for(const normal of [false,true])for(const sign of [-1,1]){
  const state={parts:art.cloth.map((_,i)=>i===part?force(normal,sign):{x:0,y:0})},q=warpCloth(...tip,w,h,art,state,part,1,geometry),motion=Math.hypot(q[0]-tip[0],q[1]-tip[1]);
  assert(Math.abs(Math.hypot(q[0]-root[0],q[1]-root[1])-geometry.length)<1e-8);
  if(normal){assert(motion>3,'5px transverse spring load must retain visible bending');turns.push(geometry.dx*(q[1]-root[1])-geometry.dy*(q[0]-root[0]));}
  else assert(motion<1e-8,'radial force cannot squeeze or extend the material');
 }
 assert(turns[0]*turns[1]<0,'opposite loads must bend opposite ways');
});
test('steady high speed gives long hair, scarves and veil irregular two-way independent flutter',()=>{
 const details=[];
 for(const [id,art] of Object.entries(real.art)){
  const spec={id},pc={v:220/3.6,vx:0,wind:0,visual:{time:0,lateralAccel:0}},histories=art.cloth.map(()=>[]);let state;
  for(let frame=0;frame<=60*16;frame++){pc.visual.time=frame/60;state=clothMotion(spec,pc,art,state);if(frame>=180)state.parts.forEach((p,i)=>histories[i].push(p.x));}
  art.cloth.forEach((p,i)=>{
   if(!['scarf','veil','hair'].includes(p.kind)||(p.flex??1)<.22||(p.drag??1)<.5)return;
   const xs=histories[i],min=Math.min(...xs),max=Math.max(...xs);assert(min< -2&&max>2,`${id} ${i} needs both flutter directions: ${min}, ${max}`);
   details.push({id,part:i,kind:p.kind,range:+(max-min).toFixed(2)});
   for(let j=0;j<i;j++)assert(xs.some((x,n)=>Math.abs(x-histories[j][n])>.25),id+' parts cannot move in exact sync');
  });
 }
 console.log('High-speed irregular flutter:',JSON.stringify(details));
});
