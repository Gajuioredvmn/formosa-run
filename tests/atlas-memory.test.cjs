const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=source.indexOf('function packAtlas()'),end=source.indexOf('// mip levels:',start);
function packed(queue){const writes=[],warnings=[],context={_sprQueue:queue,_sprQueueIndex:new Map(),_varCache:{old:1},ATLAS:{size:128,pad:8,pages:[]},SPR:{},SPRL:[],console:{warn:(...args)=>warnings.push(args)},canvas:(w,h)=>({width:w,height:h,getContext:()=>({putImageData:(image,x,y)=>writes.push({image,x,y})})}),ImageData:class{constructor(data,w,h){this.data=data;this.width=w;this.height=h;}},mipLevels:c=>[c]};vm.runInNewContext(source.slice(start,end)+';packAtlas();',context);return{...context,writes,warnings};}
const pix=(w,h,value=1)=>({w,h,d:new Uint8ClampedArray(w*h*4).fill(value)});
test('Aliases share one atlas rectangle while preserving independent dimensions, pivots and contacts',()=>{
 const image=pix(32,32),a={name:'a',pix:image,wh:2,o:{ax:.2,collide:.4,shadow:.7,sway:.2,meta:{identity:'a'}}},b={name:'b',pix:image,wh:5,o:{ax:.8,collide:0,shadow:0,glow:.5,meta:{identity:'b'}}},r=packed([a,b]);
 assert.equal(r.writes.length,1);assert.equal(r.SPRL.length,2);for(const key of ['pg','x','y','w','h'])assert.equal(r.SPR.a[key],r.SPR.b[key]);
 assert.equal(r.SPR.a.ww,2);assert.equal(r.SPR.b.ww,5);assert.equal(r.SPR.a.ax,.2);assert.equal(r.SPR.b.ax,.8);assert.equal(r.SPR.a.collide,.4);assert.equal(r.SPR.b.collide,0);assert.equal(r.SPR.b.shadow,0);assert.equal(r.SPR.b.meta.identity,'b');
 assert.equal(r.ATLAS.packing.sharedAliases,1);assert.equal(r.ATLAS.packing.avoidedPixelBytes,32*32*4);assert.equal(r._sprQueue.length,0);assert.equal(r._sprQueueIndex.size,0);
});
test('Packing preserves stable legacy sprite IDs across aliases, row wraps and page wraps',()=>{
 const large=pix(70,70),small=pix(30,30),medium=pix(70,40),q=[{name:'small',pix:small,wh:1,o:{}},{name:'large1',pix:large,wh:1,o:{}},{name:'medium',pix:medium,wh:1,o:{}},{name:'large2',pix:large,wh:1,o:{}},{name:'medium2',pix:medium,wh:2,o:{}}],r=packed(q);
 assert.deepEqual(Array.from(r.SPRL,s=>s.name),['large1','large2','medium','medium2','small']);assert.deepEqual(Array.from(r.SPRL,s=>s.id),[0,1,2,3,4]);assert.equal(r.writes.length,3);assert.equal(r.SPR.large1.pg,r.SPR.large2.pg);assert.equal(r.SPR.medium.pg,r.SPR.medium2.pg);assert(r.SPR.medium.pg>r.SPR.large1.pg);
});
test('Equal pixels in separate Pix instances are not accidentally merged and oversize aliases remain excluded',()=>{
 const huge=pix(150,20),r=packed([{name:'left',pix:pix(32,32),wh:1,o:{}},{name:'right',pix:pix(32,32),wh:1,o:{}},{name:'huge',pix:huge,wh:1,o:{}},{name:'huge2',pix:huge,wh:1,o:{}}]);
 assert.equal(r.writes.length,2);assert.equal(r.SPRL.length,2);assert.notEqual(r.SPR.left.x,r.SPR.right.x);assert.equal(r.warnings.length,2);assert.equal(r.ATLAS.packing.sharedAliases,0);
});
for(const [file,name,multi]of [['world-life.js','FormosaWorldLife',true],['landmark-art.js','FormosaLandmarkArt',true],['regional-art.js','FormosaRegionalArt',false],['cliff-art.js','FormosaCliffArt',false],['landscape-parallax.js','FormosaLandscape',true]])test(name+' releases only compiled source images and keeps runtime records',()=>{
 const box={window:{},Math,Map,Set};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../render',file),'utf8'),box);const api=box.window[name],state=api.state,record={id:'retained'},layer={width:42},image={naturalWidth:64,naturalHeight:32,onload(){},onerror(){},removeAttribute(name){assert.equal(name,'src');this.removed=true;}};
 state.records=[record];state.layers={forest:[layer]};state.pedestrianPeople=7;if(multi)state.images={source:name==='FormosaWorldLife'?{image,spec:{}}:image};else state.image=image;
 assert.equal(api.releaseSources(),0,'Never discard an image before compilation has finished');state.ready=true;assert.equal(api.releaseSources(),64*32*4);assert(state.sourcesReleased);assert.equal(state.releasedImageBytes,8192);assert.equal(state.records[0],record);assert.equal(state.layers.forest[0],layer);assert.equal(state.pedestrianPeople,7);assert(image.removed);assert.equal(image.onload,null);assert.equal(image.onerror,null);assert.equal(api.releaseSources(),0,'Release is idempotent');assert(multi?Object.keys(state.images).length===0:state.image===null);
});
