const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function world(){const sandbox={window:{},Math,Map};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../render/world-life.js'),'utf8'),sandbox);return sandbox.window.FormosaWorldLife;}
function fixtureCanvas(width,height){const canvas={width,height},g={canvas,save(){},restore(){},translate(){},scale(){},drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(width*height*4)})};canvas.getContext=()=>g;return canvas;}
test('The metro canopy, posts and stair footprint all move beyond the rail corridor',()=>{
 const w=world(),colliders=[],D={p:{sec:()=>({tags:['lightrail']})},gap(){},spr(){},lat:(_,sg,off)=>sg*(8+off),collide:(s,x)=>colliders.push({s,x})};
 const m=w.metroEntrance(D,100);assert.equal(m.minOff,17.5);assert.equal(colliders.length,4);
 assert(m.faces.every(f=>f.points.every(p=>p[1]>=m.minOff&&p[1]<=m.maxOff)));
 assert(colliders.every(c=>c.x<-8-15.5));
 assert(new Set(m.faces.flatMap(f=>f.points.map(p=>p[2]))).size>10,'Stairs need distinct elevations');
});
test('Light-rail platform runs along the road with every roof corner and collider clear of cars and rails',()=>{
 const w=world(),colliders=[],sprites=[],D={p:{},lat:(_,sg,off)=>sg*(8+off),spr:(name,s,x,o)=>sprites.push({name,s,x,o}),collide:(s,x,hx,hs)=>colliders.push({s,x,hx,hs})};
 const m=w.lightRailStop(D,100),points=m.faces.flatMap(f=>f.points);
 assert.equal(m.kind,'lightRailStop');assert.equal(m.maxOff,7.3);
 assert(points.every(p=>p[1]>=3.9&&p[1]<7.5),'Full platform and roof stay between the pavement and the 7.5-m rail strip');
 assert.equal(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),20,'Platform length follows the route, not the screen width');
 assert.equal(colliders.length,8);
 for(const c of colliders){assert(c.x+c.hx<=-8-3.9);assert(c.x-c.hx>=-8-7.3);assert(c.s-c.hs>=90&&c.s+c.hs<=110);}
 const sign=sprites[0];assert.equal(sign.name,'light-rail-sign');assert(sign.x+1.6<-8-3.9&&sign.x-1.6>-8-7.3,'Entire sign remains inside the platform width');
});
test('Pedestrians follow bounded continuous world paths through each turnaround',()=>{
 const w=world(),a={s0:10,s1:18,speed:.75,phase:.5};let prev=w.walkerFrame(a,0);
 for(let n=1;n<2000;n++){const cur=w.walkerFrame(a,n/60);assert(cur.s>=10&&cur.s<=18);assert(Math.abs(cur.s-prev.s)<=.75/60+1e-8);assert([0,1].includes(cur.frame));prev=cur;}
});
test('Imported front/rear traffic replaces old angle drawings and preserves brake lights',()=>{
 const w=world(),added=[],pix=class{constructor(width,height){this.d=new Uint8ClampedArray(width*height*4);}rect(){}text(){}};
 const api={Pix:pix,canvas:fixtureCanvas,addSprite:(...a)=>added.push(a),trafficSprites:{taxi:{rear:['oldRear'],front:['oldFront'],turn:[{'0.7':'oldLowPoly'}]}}};
 w.state.images.traffic={image:{naturalWidth:200,naturalHeight:100},spec:{cells:[[0,0,100,100],[100,0,100,100]],frames:[{type:'taxi',view:'rear',worldHeight:1.5,lightsNormalized:[[.2,.7,.15,.06],[.65,.7,.15,.06]]},{type:'taxi',view:'front',worldHeight:1.5}]}};
 w.registerSprites(api);assert.equal(api.trafficSprites.taxi.rear[0],'world_traffic#0');assert.equal(api.trafficSprites.taxi.front[0],'world_traffic#1');assert.equal(api.trafficSprites.taxi.turn[0],null);
 const lights=added.find(a=>a[0]==='world_traffic#0')[3].meta.lights;assert.equal(lights.length,2);assert.equal(lights[0][0],12.8);assert.equal(lights[0][1],44.8);assert.equal(added.find(a=>a[0]==='world_traffic#1')[3].meta.lights.length,0,'Headlights do not inherit rear brake lamps');
});
test('Imported pedestrian cells replace every existing crossing-person pose',()=>{
 const w=world(),names=[],pix=class{constructor(width,height){this.d=new Uint8ClampedArray(width*height*4);}rect(){}text(){}};
 w.state.images.pedestrians={image:{},spec:{cells:Array.from({length:12},()=>[0,0,30,60])}};
 w.state.images.pedestriansMore={image:{},spec:{personOffset:3,cells:Array.from({length:16},()=>[0,0,30,60])}};
 w.registerSprites({Pix:pix,canvas:fixtureCanvas,addSprite:name=>names.push(name)});
 for(let type=0;type<7;type++)for(let frame=0;frame<4;frame++)assert(names.includes('ped'+type+'_'+frame));
 assert.equal(w.state.pedestriansFrames,12);assert.equal(w.state.pedestriansMoreFrames,16);assert.equal(w.state.pedestrianPeople,7);assert.equal(w.state.paintedCrowds.length,7);
});

test('The shipped walker renderer selects all seven people through every gait frame',()=>{
 const w=world(),SPR={},p={L:100,gS:0,outerL:()=>-8,outerR:()=>8};w.state.pedestriansFrames=12;w.state.pedestrianPeople=7;
 for(let person=0;person<7;person++)for(let frame=0;frame<4;frame++){const name='ped'+person+'_'+frame;SPR[name]={id:name};}
 const sandbox={window:{FormosaWorldLife:w},SPR,RV:{t:0},DS:2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),item:(kind,o)=>({kind,o})};vm.createContext(sandbox);
 const source=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),start=source.indexOf('function animItems('),end=source.indexOf('// ---------- the haze over',start);vm.runInContext(source.slice(start,end),sandbox);
 for(let person=0;person<7;person++)for(let frame=0;frame<4;frame++){
  sandbox.RV.t=(frame+.01)/5;const items=[],an={kind:'walker',s0:0,s1:70,speed:1,phase:0,variant:person,sg:1,off:3};sandbox.animItems(an,p,0,100,items);
  assert.equal(items.length,1);assert.equal(items[0].o.id,'ped'+person+'_'+frame,'Runtime selection must not wrap extra people into the first twelve atlas cells');
 }
 delete SPR.ped6_3;sandbox.RV.t=3.01/5;const items=[];sandbox.animItems({kind:'walker',s0:0,s1:70,speed:1,phase:0,variant:6,sg:1,off:3},p,0,100,items);assert.equal(items[0].o.id,'ped0_3','Missing optional art retains the legacy person fallback');
});

test('Detailed vegetation replaces every legacy alias without changing collision diameter, height or wind',()=>{
 const w=world(),added=[],pix=class{constructor(width,height){this.d=new Uint8ClampedArray(width*height*4);}rect(){}text(){}};
 w.state.images.treesMore={image:{},spec:{pixelHeight:512,cells:[[0,0,456,506]],frames:[{name:'world_mango',aliases:['mango#0','mango#1','mango#2'],worldHeight:7,anchorX:.45943,collisionDiameter:.672,sway:.15,shadow:.6}]}};
 w.state.images.groundProps={image:{},spec:{pixelHeight:256,cells:[[0,0,352,256]],frames:[{name:'world_rock',aliases:['rock#0','rock#1','rock#2'],worldHeight:1.3,anchorX:.559659,collisionDiameter:1.365,sway:0,shadow:.5}]}};
 const P=class extends pix{constructor(width,height){super(width,height);this.w=width;this.h=height;}};
 w.registerSprites({Pix:P,canvas:fixtureCanvas,addSprite:(...a)=>added.push(a)});
 for(const family of ['mango','rock'])for(let i=0;i<3;i++){const v=added.find(a=>a[0]===family+'#'+i);assert(v);const [name,p,height,opts]=v,tree=family==='mango';assert.equal(height,tree?7:1.3);assert.equal(opts.sway,tree?.15:0);assert.equal(opts.ax,tree?.45943:.559659);assert(opts.meta.paintedVegetation);assert.equal(!!opts.meta.paintedTree,tree);assert(Math.abs(height*p.w/p.h*opts.collide-(tree?.672:1.365))<1e-12);}
});
