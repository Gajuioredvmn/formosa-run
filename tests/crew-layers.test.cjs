// Source-pixel regressions: moving hair must never pull a seat, mirror or rail.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});
for(const file of ['render/crew-layers.js','render/crew-masks-a.js','render/crew-masks-b.js','render/vehicle-art-manifest.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replace(/\bexport /g,''),context,{filename:file});
vm.runInContext('globalThis.api={polygons,contains,separateCrew,restoreCrewBackplate,materialMesh,masks:Object.assign({},CREW_MASKS_A,CREW_MASKS_B),art:VEHICLE_ART};',context);
const {polygons,contains,separateCrew,restoreCrewBackplate,materialMesh,masks,art}=context.api;
const rect=(x0,y0,x1,y1,w=8,h=4)=>[[x0/w,y0/h],[x1/w,y0/h],[x1/w,y1/h],[x0/w,y1/h]];
const rgba=(data,w,x,y)=>Array.from(data.slice((y*w+x)*4,(y*w+x)*4+4));
test('all ten cars have two crew owners and exactly one material mask for every cloth state',()=>{
 assert.equal(Object.keys(masks).length,10);assert.deepEqual(Object.keys(masks).sort(),Object.keys(art).sort());
 for(const [id,m]of Object.entries(masks)){assert.equal(m.crew.length,2,id);assert.equal(m.cloth.length,art[id].cloth.length,id);assert.equal(m.backing.length,2,id);}
});
test('all source contours and row-dependent backing samples use finite normalized coordinates',()=>{
 for(const [id,m]of Object.entries(masks)){
  for(const shape of [...m.crew,...m.cloth,...m.foreground,...m.clear||[]])for(const poly of polygons(shape)){
   assert(poly.length>=3,id);for(const point of poly){assert.equal(point.length,2);assert(point.every(n=>Number.isFinite(n)&&n>=0&&n<=1),id+': '+point);}
  }
  for(const entry of m.backing){if(typeof entry==='number')assert(entry>=0&&entry<=1);else{let previous=-Infinity;for(const [y,x]of entry){assert(y>=previous&&y>=0&&y<=1&&x>=0&&x<=1,id);previous=y;}}}
 }
});
test('known headrests, cockpit trim, roll bar and mirrors are never assigned to a moving layer',()=>{
 const probes=[['rosso','passenger headrest',810,211],['rosso','rear cockpit metal edge',842,244],['bamboo','silver rollbar crown',850,233],['bamboo','right mirror',1008,285],['oro','visible seatback',744,279]];
 for(const [id,name,x,y]of probes){const a=art[id],[rx,ry,rw,rh]=a.rear,u=(x/1254-rx)/rw,v=(y/1254-ry)/rh,m=masks[id];
  // Exercise the actual classification at a precise texel centre. Foreground
  // takes priority over a silhouette that passes behind the rigid part.
  const w=1001,h=1001,px=Math.floor(u*w),py=Math.floor(v*h),source=new Uint8ClampedArray(w*h*4);source.set([71,93,117,255],(py*w+px)*4);
  const r=separateCrew(source,w,h,m,a.cloth),label=r.labels[py*w+px];assert(label<=0,id+' '+name+' classified as '+label);
  for(const layer of [...r.crew,...r.cloth])assert.equal(layer[(py*w+px)*4+3],0,id+' '+name);
  assert.deepEqual(rgba(r.body,w,px,py),[71,93,117,255]);
 }
});

test('isolated outer curls and veil tips follow their material instead of leaving fixed remnants',()=>{
 for(const [id,x,y]of [['blanco',976,173],['blanco',1009,214],['oro',1012,217]]){
  const [rx,ry,rw,rh]=art[id].rear,u=(x/1254-rx)/rw,v=(y/1254-ry)/rh,m=masks[id];
  assert(contains(m.cloth[0],u,v),id+' free end must belong to its material');
  assert(contains(m.crew[1],u,v),id+' free end must follow the passenger');
  assert(m.clear.some(p=>contains(p,u,v)),id+' vacated external tip must reveal sky');
  assert(!m.foreground.some(p=>contains(p,u,v)),id+' free end must not be a rigid accessory');
 }
});
test('pixel separation preserves exact RGBA, gives rigid foreground priority, and never mutates source',()=>{
 const w=8,h=4,source=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)source.set([11+x*13,23+y*17,81+x+y,255],(y*w+x)*4);
 const before=Array.from(source),m={crew:[rect(2,1,5,3),rect(5,1,7,3)],cloth:[rect(3,1,4,3),rect(6,0,7,2)],foreground:[rect(3,1,4,2)],clear:[rect(6,0,7,1)],backing:[0,[[0,7/8],[.5,1/8]]]},parts=[{role:'driver',root:[.3,.2]},{role:'passenger',root:[.7,.2]}],r=separateCrew(source,w,h,m,parts);
 assert.deepEqual(Array.from(source),before);
 assert.equal(r.labels[1*w+2],1);assert.deepEqual(rgba(r.crew[0],w,2,1),rgba(source,w,2,1));assert.deepEqual(rgba(r.body,w,2,1),rgba(source,w,0,1));
 assert.equal(r.labels[2*w+3],10);assert.deepEqual(rgba(r.cloth[0],w,3,2),rgba(source,w,3,2));assert.equal(rgba(r.crew[0],w,3,2)[3],0);assert.deepEqual(rgba(r.body,w,3,2),rgba(source,w,0,2));
 assert.equal(r.labels[1*w+3],-1);assert.deepEqual(rgba(r.foreground,w,3,1),rgba(source,w,3,1));assert.deepEqual(rgba(r.body,w,3,1),rgba(source,w,3,1));assert.equal(rgba(r.cloth[0],w,3,1)[3],0);
 assert.equal(r.labels[0*w+6],11);assert.deepEqual(rgba(r.cloth[1],w,6,0),rgba(source,w,6,0));assert.deepEqual(rgba(r.body,w,6,0),[0,0,0,0]);
 assert.deepEqual(rgba(r.body,w,6,1),rgba(source,w,7,1));assert.deepEqual(rgba(r.body,w,5,2),rgba(source,w,1,2));
 assert.deepEqual(rgba(r.body,w,1,1),rgba(source,w,1,1));assert.equal(rgba(r.foreground,w,1,1)[3],0);
 for(let i=0;i<w*h;i++){const moving=[...r.crew,...r.cloth].filter(layer=>layer[i*4+3]>0);assert(moving.length<=1,'a source pixel cannot appear in two animated materials');if(r.foreground[i*4+3])assert.equal(moving.length,0);}
});
test('fallback backing skips neighbouring people and exterior hair reveals transparent sky',()=>{
 const w=8,h=1,source=new Uint8ClampedArray(w*4);for(let x=0;x<w;x++)source.set([x*20,30,40,255],x*4);
 const m={crew:[rect(2,0,6,1,w,h)],cloth:[],foreground:[],backing:[3.5/8]},r=separateCrew(source,w,h,m,[]);
 assert.deepEqual(rgba(r.body,w,3,0),rgba(source,w,1,0),'the first available same-row sample is left of both moving pixels');
 const exterior=new Uint8ClampedArray(w*4);exterior.set([180,77,32,255],3*4);const q=separateCrew(exterior,w,h,m,[]);
 assert.deepEqual(rgba(q.crew[0],w,3,0),[180,77,32,255]);assert.deepEqual(rgba(q.body,w,3,0),[0,0,0,0]);
});

test('rigid foreground inside a broad crew silhouette still supports the cockpit backing row',()=>{
 const w=8,h=1,source=new Uint8ClampedArray(w*4);
 source.set([29,47,63,255],1*4);source.set([211,97,43,255],3*4);source.set([55,71,89,255],6*4);
 const m={crew:[rect(1,0,7,1,w,h)],cloth:[rect(3,0,4,1,w,h)],foreground:[rect(1,0,2,1,w,h),rect(6,0,7,1,w,h)],backing:[1.5/w]};
 const r=separateCrew(source,w,h,m,[{role:'driver',root:[.4,.2]}]);
 assert.equal(r.labels[1],-1);assert.equal(r.labels[6],-1);assert.equal(r.labels[3],10);
 assert.deepEqual(rgba(r.body,w,3,0),[29,47,63,255],'foreground anchors keep this interior row from being treated as exterior sky');
 assert.deepEqual(rgba(r.cloth[0],w,3,0),[211,97,43,255]);
 for(const x of [1,6]){assert.equal(rgba(r.crew[0],w,x,0)[3],0);assert.equal(rgba(r.cloth[0],w,x,0)[3],0);assert.deepEqual(rgba(r.foreground,w,x,0),rgba(source,w,x,0));}
});
test('material meshes omit fully transparent cells while retaining every visible source cell',()=>{
 const w=12,h=12,empty=new Uint8ClampedArray(w*h*4);const none=materialMesh(empty,w,h,6,6);assert.equal(none.vertices.length,0);assert.equal(none.triangles.length,0);
 const source=new Uint8ClampedArray(empty);source.set([1,2,3,255],(5*w+5)*4);const mesh=materialMesh(source,w,h,6,6);assert(mesh.triangles.length>0&&mesh.triangles.length<72);assert(mesh.vertices.every(v=>v.u>=0&&v.u<=1&&v.v>=0&&v.v<=1));
 assert(mesh.triangles.some(tri=>{const xs=tri.map(v=>v.u),ys=tri.map(v=>v.v);return Math.min(...xs)<=5.5/w&&Math.max(...xs)>=5.5/w&&Math.min(...ys)<=5.5/h&&Math.max(...ys)>=5.5/h;}));
});
test('traced backplate repairs fill only vacated material and preserve the visible car',()=>{
 const w=8,h=4,source=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)source.set([x*20,y*30,90,255],(y*w+x)*4);
 const m={crew:[rect(2,1,5,3)],cloth:[],foreground:[rect(3,1,4,2)],clear:[rect(1,0,6,4)],backing:[0],underlay:[{polygon:rect(1,0,6,4),color:[12,32,52,255]},{polygon:rect(4,2,5,3),color:[200,190,120,255]}]};
 const r=separateCrew(source,w,h,m,[]);
 assert.deepEqual(rgba(r.body,w,2,1),[12,32,52,255]);
 assert.deepEqual(rgba(r.body,w,4,2),[200,190,120,255]);
 assert.deepEqual(rgba(r.body,w,3,1),rgba(source,w,3,1),'foreground stays original');
 assert.deepEqual(rgba(r.body,w,1,1),rgba(source,w,1,1),'original visible car stays original');
 assert.deepEqual(rgba(r.crew[0],w,2,1),rgba(source,w,2,1),'moving material retains its own pixels');
});
test('hair caps and neck attachments remain in the person layer, never the free cloth layer',()=>{
 const w=8,h=4,source=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)source.set([x*20,y*30,90,255],(y*w+x)*4);
 const m={crew:[rect(2,0,7,4)],cloth:[rect(2,0,7,4)],fixed:[rect(3,0,5,3)],foreground:[],backing:[0]};
 const r=separateCrew(source,w,h,m,[{role:'driver',root:[.5,.1]}]);
 for(const [x,y] of [[3,0],[4,1],[4,2]]){
  assert.equal(r.labels[y*w+x],1);assert.deepEqual(rgba(r.crew[0],w,x,y),rgba(source,w,x,y));assert.equal(rgba(r.cloth[0],w,x,y)[3],0);
 }
 assert.equal(r.labels[2*w+6],10);assert.equal(r.counts.fixed[0],6);assert(r.counts.cloth[0]>0);
});

test('painted anatomy restores only its wearer under loose material without replacing visible car or hair',()=>{
 const w=8,h=4,source=new Uint8ClampedArray(w*h*4),base=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<source.length;i+=4){source.set([30,50,70,255],i);base.set([235,210,180,255],i);}
 const parts=[{role:'passenger',root:[.7,.1]}];
 const m={crew:[[],rect(3,0,7,4)],cloth:[rect(3,0,7,4)],fixed:[rect(3,0,5,2)],foreground:[rect(5,2,6,3)],backing:[0,0]};
 const r=separateCrew(source,w,h,m,parts),originalBody=new Uint8ClampedArray(r.body),originalHair=new Uint8ClampedArray(r.cloth[0]);
 assert(restoreCrewBackplate(r,base,w,h,[{owner:1,polygon:rect(4,1,7,4)}],parts)>0);
 assert.deepEqual(rgba(r.crew[1],w,6,2),[235,210,180,255]);
 assert.deepEqual(rgba(r.crew[1],w,4,1),[30,50,70,255],'visible fixed head stays original');
 assert.equal(rgba(r.crew[1],w,5,2)[3],0,'headrest remains foreground');
 assert.deepEqual(Array.from(r.body),Array.from(originalBody));assert.deepEqual(Array.from(r.cloth[0]),Array.from(originalHair));
 assert.equal(rgba(r.crew[0],w,6,2)[3],0,'never paint the other person');
});
