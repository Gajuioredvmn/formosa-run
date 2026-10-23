// Run: node --test tests/geography.test.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/game.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
function declaration(name){const start=source.indexOf('function '+name+'(');assert(start>=0);let end=source.indexOf('}',start);while(end>=0){const candidate=source.slice(start,end+1);try{new vm.Script(candidate);return candidate;}catch(e){if(!(e instanceof SyntaxError))throw e;}end=source.indexOf('}',end+1);}throw Error(name);}
test('Five stages form 31 distinct segments and 16 complete five-stage journeys',()=>{
 const pieces=new Map(data.pieces.map(p=>[p.id,p]));assert.equal(pieces.size,31);assert.equal(data.cars.length,10);
 const seen=new Set(),levels=[0,0,0,0,0];let ends=0,edges=0;
 function walk(id,depth,parent){assert(!seen.has(id),'Reused or cyclic route '+id);seen.add(id);const p=pieces.get(id);assert(p);assert.equal(p.parent,parent);assert(depth<5);levels[depth]++;
  if(depth===4){assert.equal(p.children.length,0);assert(p.goal);ends++;}else{assert.equal(p.children.length,2);for(const child of p.children){edges++;walk(child,depth+1,id);}}}
 walk(data.root,0,null);assert.deepEqual(levels,[1,2,4,8,16]);assert.equal(ends,16);assert.equal(edges,30);
});
test('Shared Godot geometry retains the browser destination and local panorama',()=>{
 const expected={s4b:'foothills',s4f:'westernplain',s4g:'foothills',s5k:'gaomei',s5l:'nanliao',s5m:'nanzhuang',s5n:'jiufen',s5o:'sanxiantai',s5p:'shitiping',s5g:'eastcape',s5h:'eastcape'};
 for(const p of data.pieces){assert.equal(p.pano,data.stages[p.id].pano,p.id);assert.equal(p.goal,data.stages[p.id].goal||'',p.id);assert(p.points.length>2);for(const q of p.points){for(const k of ['s','x','y','z','h','hw'])assert(Number.isFinite(q[k]),p.id+':'+k);}}
 for(const [id,pano] of Object.entries(expected))assert.equal(data.stages[id].pano,pano,id);
});
test('Named landmarks and regional cultural tags remain on their assigned route',()=>{
 const allowed={tower85sign:['s1'],taipei101:['s5a'],queenhead:['s5b'],shuishe:['s5c'],wuling:['s5d'],changchun:['s5e'],lanyang:['s5f'],longpan:['s5g'],lighthouse:['s5h'],guanshan:['s5i'],sailrock:['s5j'],sanxiantai:['s5o'],shitipingrocks:['s5p'],parade_beigang:['s4f'],parade_xingang:['s3m'],parade_donggang:['s3se']};
 for(const p of data.pieces)for(const sec of data.stages[p.id].sections)for(const tag of sec.tags||[])if(allowed[tag])assert(allowed[tag].includes(p.id),tag+' incorrectly placed in '+p.id);
 for(const id of ['s4g','s5m'])assert(!data.stages[id].sections.some(s=>(s.tags||[]).includes('hakka_roundhouse')),'Houlong roundhouse in '+id);
 assert(!data.stages.s5p.sections.some(s=>(s.tags||[]).includes('marblewall')),'Shitiping is not a Taroko marble cliff');
});
test('A wrapped panorama cannot reintroduce the 85 tower through the former 400-degree workaround',()=>{
 const c={};vm.createContext(c);vm.runInContext(`const PXK=1;const azX=a=>256+a/360*512;const hash2=()=>.5;const mixHex=(a,b,t)=>a;const shadeHex=(c,k)=>c;
 function mulberry(seed){let s=seed>>>0;const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};r.int=(a,b)=>Math.floor(a+r()*(b-a+1));r.pick=a=>a[Math.floor(r()*a.length)];return r;}
 ${declaration('paintSkylineCity')}
 function draw(options){const image={width:512,height:240,data:new Uint8ClampedArray(512*240*4)};paintSkylineCity(image,220,-60,60,options);return image.data;}`,c);
 const generic=vm.runInContext('draw({seed:163})',c),offscreen=vm.runInContext('draw({seed:163,towerAz:400})',c),kaohsiung=vm.runInContext("draw({seed:163,landmark:'tower85',towerAz:0})",c);
 assert.deepEqual(Buffer.from(offscreen),Buffer.from(generic));assert.notDeepEqual(Buffer.from(kaohsiung),Buffer.from(generic));
});
