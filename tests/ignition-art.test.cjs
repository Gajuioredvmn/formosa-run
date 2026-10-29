'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const art=require('../render/ignition-art.js');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('Portrait cards and instrument panel fit landscape logical viewports and leave the real car clear',()=>{
 for(const width of [320,400,480,574,640,720]){
  const q=art.layout(width,270),heroLeft=width/2-70,heroRight=width/2+70;
  assert(q.left>=0&&q.left+q.cardW<heroLeft);
  assert(q.right>heroRight&&q.right+q.cardW<=width);
  assert(q.cardY>=0&&q.cardY+q.cardH<=270);
  assert(q.instrument.x>=0&&q.instrument.x+q.instrument.w<=width);
 }
});
test('Instrument phases follow actual ignition state instead of inventing a second timer',()=>{
 assert.equal(art.phase({}).id,'key');assert.equal(art.phase({acc:true}).id,'power');
 assert.equal(art.phase({acc:true,crank:true}).id,'crank');assert.equal(art.phase({acc:true,caught:true}).id,'ready');
});
test('Cranking vibration is bounded, deterministic and cannot mutate physics or ignition state',()=>{
 for(let i=0;i<=330;i++){
  const t=i/100,q={on:true,t,crank:t>=1.3&&t<2.2,caught:t>=2.2,drop:Math.max(0,(t-2.8)/.5)},before=JSON.stringify(q);
  const v=art.vibration(q);assert(Math.abs(v.x)<=.35&&Math.abs(v.y)<=.65);assert.deepEqual(v,art.vibration(q));assert.equal(JSON.stringify(q),before);
 }
 assert.deepEqual(art.vibration({on:true,crank:true,t:1.6},true),{x:0,y:0});
 assert.deepEqual(art.vibration({on:false,crank:true,t:1.6}),{x:0,y:0});
});
test('All selected car identifiers and original cast portraits are passed through without substitutions',()=>{
 const ids=['rosso','vespa','argento','ballena','bamboo','blanco','raptor','adler','arancia','oro'];
 for(const id of ids){
  const seen=[],g={globalAlpha:1,save(){},restore(){},fillRect(){},beginPath(){},rect(){},clip(){},translate(){},rotate(){}};
  const crew=[{name:id+' driver'},{name:id+' passenger',dog:id==='arancia'}];
  const r=art.draw(g,{width:480,height:270,ign:{on:true,t:1.6,acc:true,crank:true,hand:1,keyA:2},spec:{id,name:id},crew,
   art:{drawPortrait(ctx,q){seen.push([q.spec.id,q.index]);return true;}},label(){}});
  assert.deepEqual(seen,[[id,0],[id,1]]);assert.equal(r.carId,id);assert(r.portraits.every(p=>p.ready));
  assert.equal(r.portraits[1].role,id==='arancia'?'旅伴':'副駕駛');assert.equal(r.frameCopies,0);
 }
});
test('Fading presentation cannot change selected-car scale or sample the current game framebuffer',()=>{
 const start=source.indexOf('function drawIgnition()'),end=source.indexOf("addEventListener('pointerdown', () => igniteSkip()",start),draw=source.slice(start,end);
 assert(!draw.includes('VG.canvas'));assert(!draw.includes('gaugeDraw'));assert(!draw.includes('PC.spr ='));
 assert(draw.includes('art:PIXEL_PLAYER'));assert(source.includes('drawPlayerCarBody(spr)'));
 assert(!source.includes('VG.drawImage(VG.canvas, 0, top + dy'));
});
