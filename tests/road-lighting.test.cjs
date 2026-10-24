const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../render/classic-street-art.js'),'utf8'),ctx);
const art=ctx.window.FormosaClassicStreetArt;
function piece(){return{id:'s5m',L:160,sprites:[],walls:[],outerL:()=>-7,outerR:()=>7};}
const sprites=[{name:'hemlock#0',wh:10,ww:6},{name:'pixel_palm#0',wh:10,ww:6}];
test('A real mountain tree casts bounded road shade while the opposite bank and distant trees do not',()=>{
  const p=piece();p.sprites=[{id:0,s:60,x:-12,sc:1,sx:1}];
  const before=JSON.stringify(p.sprites);art.prepareShadows(p,sprites,2);
  assert(p.pixelShadeRows.size>0);assert.equal(JSON.stringify(p.sprites),before);
  for(const [row,spans] of p.pixelShadeRows){assert(row>=0&&row<=320);for(const [l,r] of spans)assert(l>=-7&&r<=7&&r>l);}
  p.sprites=[{id:0,s:60,x:12,sc:1},{id:0,s:80,x:-90,sc:1}];art.prepareShadows(p,sprites,2);assert.equal(p.pixelShadeRows.size,0);
});
test('Only real sun-facing upper buildings project across the road and repeated objects do not darken twice',()=>{
  const p=piece(),wall={sg:-1,s0:40,s1:60,off:3,h:7,y:3};p.walls=[wall];
  art.prepareShadows(p,sprites,2);const expected=JSON.stringify([...p.pixelShadeRows]);assert(p.pixelShadeRows.size>0);
  p.walls=[wall,wall];art.prepareShadows(p,sprites,2);assert.equal(JSON.stringify([...p.pixelShadeRows]),expected);
  p.walls=[{...wall,sg:1},{...wall,h:1,y:0}];art.prepareShadows(p,sprites,2);assert.equal(p.pixelShadeRows.size,0);
});
