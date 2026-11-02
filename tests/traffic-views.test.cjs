const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ctx={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../render/traffic-views.js'),'utf8'),ctx);const api=ctx.FormosaTrafficViews;
test('Rear, quarter, side and oncoming bearings select distinct complete car views',()=>{assert.equal(api.choose(0).view,'rear');assert.equal(api.choose(.65).view,'rearQuarter');assert.equal(api.choose(Math.PI/2).view,'side');assert.equal(api.choose(Math.PI-.65).view,'frontQuarter');assert.equal(api.choose(Math.PI).view,'front');});
test('Opposite side mirrors directional art, while straight front/rear keep their authored orientation',()=>{assert(api.choose(-.65).flip);assert(api.choose(-Math.PI/2).flip);assert(!api.choose(-Math.PI).flip);assert(!api.choose(0).flip);assert.equal(api.choose(Math.PI*3).view,'front');});
test('Small camera jitter across a view boundary cannot alternate artwork every frame',()=>{for(const a of [.195,.205,.198,.202])assert.equal(api.choose(a,0).view,'rear');assert.equal(api.choose(.25,0).view,'rearQuarter');});

function supportSprite(flip=false){return{w:200,h:100,wh:2,worldWidth:4,flip,supports:[{u:.05,v:.84,s:-.34,l:-.42},{u:.58,v:1,s:-.34,l:.42},{u:.94,v:.7,s:.34,l:.42}],meta:{directional:{view:'rearQuarter'}}};}
test('Tyre support follows a sloped road without stretching the tyres or moving the car horizontally',()=>{
 const s=supportSprite(),project=(along,lateral,x)=>({x:x??300,y:180-along*32+lateral*2,k:24}),r=api.groundRig(s,24,project);
 assert(r);for(const p of r.contacts){const q=api.groundPoint(s,r,p.u,p.v);assert(Math.abs(q.y-(180-p.s*32+p.l*2))<1e-8);assert(Math.abs(q.x-(300+(p.u-.5)*96))<1e-8);}
 for(const b of r.strips){assert.equal(b.sy,.48);assert(Math.abs(b.xx-.48)<1e-10);}
});
test('Mirrored turns keep both axles on their own road contacts',()=>{
 const s=supportSprite(true),r=api.groundRig(s,20,(along,lateral,x)=>({x:x??300,y:200-along*18+lateral*3}));assert(r);
 for(const p of r.contacts){const q=api.groundPoint(s,r,p.u,p.v);assert(Math.abs(q.x-(300-(p.u-.5)*80))<1e-8);assert(Math.abs(q.y-(200-p.s*18-p.l*3))<1e-8);}
 assert(r.strips.every(q=>q.xx<0&&q.sy===.4));
});
test('A straight motorcycle is anchored to one tyre, not stretched across two imaginary wheels',()=>{
 const s={...supportSprite(),supports:[{u:.5,v:1,s:-.34,l:0}],meta:{directional:{view:'rear'}}},r=api.groundRig(s,20,()=>({x:100,y:210}));
 assert(r);assert.equal(r.contacts.length,1);const bottom=api.groundPoint(s,r,.5,1);assert.equal(bottom.x,100);assert.equal(bottom.y,210);assert.equal(r.strips[0].xx,r.strips[0].sy);
});
test('Traffic behind the camera cannot produce a malformed support transform',()=>assert.equal(api.groundRig(supportSprite(),20,()=>null),null));
