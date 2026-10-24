// Destination/cast regressions: real story module, real crew and rendered scene calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8'),data=JSON.parse(fs.readFileSync(path.join(root,'data/game.json'),'utf8'));
const c={};vm.createContext(c);
vm.runInContext('const SKIN=[0,0,0,0];'+source.match(/const CREW = \{[\s\S]*?\n\};/)[0]+';globalThis.crew=CREW;',c);
for(const file of ['ending-stories.js','ending-scenes.js'])vm.runInContext(fs.readFileSync(path.join(root,'render',file),'utf8'),c);
const {places,order,stories,build}=c.FormosaEndingStories,endings=build(c.crew);
test('Every car has sixteen individually written, complete three-beat endings using the original cast',()=>{
  assert.equal(Object.keys(endings).length,10);assert.equal(order.length,16);
  const pairs=new Set();
  for(const [car,goals]of Object.entries(endings)){
    assert.equal(Object.keys(goals).length,16,car);assert.equal(c.crew[car].length,2);
    for(const [goal,lines]of Object.entries(goals)){
      assert.equal(lines.length,3,car+'/'+goal);assert.equal(lines[0],places[goal].intro);
      for(const line of lines)assert(line.length>5&&!/undefined|NaN|\{[ab]\}/.test(line),car+'/'+goal+': '+line);
      const pair=lines.slice(1).join('|');assert(!pairs.has(pair),'A repeated generic ending: '+car+'/'+goal);pairs.add(pair);
    }
  }
  assert.equal(pairs.size,160);assert.equal(Object.values(c.crew).flat().filter(x=>!x.dog).length,19);
  assert.equal(Object.values(c.crew).flat().filter(x=>x.dog).length,1);
  assert.equal(c.crew.arancia[1].name,'豆豆');
  for(const lines of Object.values(endings.arancia))assert(lines.join('').includes('豆豆'),'Dog identity was lost');
});
test('Ending locations match all sixteen gameplay destinations and their regional panoramas',()=>{
  const counties=['臺北市','新北市','南投縣','南投縣','花蓮縣','宜蘭縣','屏東縣','屏東縣','屏東縣','屏東縣','臺中市','新竹市','苗栗縣','新北市','臺東縣','花蓮縣'];
  const goals=data.pieces.filter(p=>!p.children.length).map(p=>p.id).sort();assert.deepEqual([...order].sort(),goals);
  for(let i=0;i<order.length;i++){const id=order[i],p=places[id];assert.equal(p.county,counties[i],id);assert.equal(p.pano,data.stages[id].pano,id);assert(p.source.startsWith('https://'));assert(p.title&&p.intro);}
  assert.equal(new Set(Object.values(places).map(p=>p.mood)).size,16,'Each destination needs its own scenery composition');
});
test('Every ending draws finite geometry, a proper arrival bay and only its own named landmark',()=>{
  const allowed={s5a:['taipei101'],s5b:['queenhead'],s5c:['shuishe'],s5d:['wuling'],s5e:['changchun'],s5f:['lanyang'],s5g:[],s5h:['lighthouse'],s5i:['flyrock'],s5j:['sailrock','palm#0','palm#2'],s5k:[],s5l:[],s5m:[],s5n:[],s5o:[],s5p:[]};
  for(const [id,p]of Object.entries(places)){
    const sprites=[],labels=[],rects=[];let depth=0;
    const numeric=(...args)=>{for(const v of args)if(typeof v==='number')assert(Number.isFinite(v),id);};
    const g=new Proxy({save(){depth++;},restore(){depth--;},fillRect(...args){numeric(...args);rects.push(args);},fillText(t){labels.push(t);}}, {get:(o,k)=>o[k]||numeric,set:(o,k,v)=>(o[k]=v,true)});
    c.FormosaEndingScenes.draw(g,360,270,p,6,(name,...args)=>{numeric(...args);sprites.push(name);});
    assert.deepEqual(sprites,allowed[id],id+' imported another city landmark');assert.equal(depth,0);
    assert(rects.some(r=>r[1]===158&&r[2]===480&&r[3]===48),id+' must keep the car off the protected landscape');
    assert(labels.includes(p.county+' · '+p.name));
  }
});
test('The eight Sanxiantai pedestrian arches are not represented as a drivable bridge',()=>{
  let curves=0;const labels=[];
  const g=new Proxy({quadraticCurveTo(){curves++;},fillText(t){labels.push(t);}}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  c.FormosaEndingScenes.draw(g,480,270,places.s5o,0,()=>{});
  assert.equal(curves,16,'Eight arches plus eight matching rail curves');
  assert(labels.includes('P'),'The arrival bay is on land');
});
test('Broken or incomplete crew/story data fails early instead of publishing an empty ending',()=>{
  assert.throws(()=>build({}),/mismatch/);const crew={...c.crew,arancia:[c.crew.arancia[0]]};assert.throws(()=>build(crew),/arancia/);
  const old=stories.rosso[0];stories.rosso[0]='missing second beat';assert.throws(()=>build(c.crew),/beats missing/);stories.rosso[0]=old;
});
test('The four shipped illustration sheets map each named destination to one exclusive quadrant',()=>{
  const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/endings/art-metadata.json'),'utf8')),used=new Set();
  for(const sheet of meta.files){
    const png=fs.readFileSync(path.join(root,'assets/endings',sheet.file));assert.equal(png.subarray(1,4).toString(),'PNG');
    assert(png.readUInt32BE(16)>=1600&&png.readUInt32BE(20)>=800,'Background detail needs sufficient source resolution');
    for(let i=0;i<sheet.quadrants.length;i++){
      const id=sheet.quadrants[i],map=c.FormosaEndingScenes.panels[places[id].mood];
      assert(!used.has(id),id+' was assigned twice');used.add(id);
      assert.equal(sheet.file,'destinations-'+map[0]+'-v1.png',id);assert.equal(map[1],i%2,id);assert.equal(map[2],Math.floor(i/2),id);
    }
  }
  assert.deepEqual([...used].sort(),[...order].sort());
});
