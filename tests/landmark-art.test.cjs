const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const art=require('../render/landmark-art.js');
test('Artwork fitting preserves the exact original world width and height without stretching the subject',()=>{
 for(const [w,h]of [[112,52],[96,48],[160,120],[480,220],[520,180]])for(const rect of [[0,0,300,150],[0,0,175,300],[0,0,420,310]]){
  const f=art.fit({pix:{w,h},wh:13},rect);assert.equal(f.w/f.h,w/h);assert.ok(f.x>=0&&f.y>=0);assert.equal(f.y+f.dh,f.h);assert.ok(f.x+f.dw<=f.w);assert.ok(Math.abs(f.dw/f.dh-rect[2]/rect[3])<.03);
 }
});
test('All landmark names are unique and named regions retain distinct illustrated identities',()=>{
 const box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../render/landmark-art-manifest.js'),'utf8'),box);
 const list=box.window.FORMOSA_LANDMARK_ART,frames=list.flatMap(s=>s.frames),aliases=frames.flatMap(f=>f.aliases);
 assert.equal(new Set(aliases).size,aliases.length);assert.equal(aliases.length,76);
 const identity=n=>frames.find(f=>f.aliases.includes(n))?.identity;
 assert.equal(identity('jijistation'),'jiji-station');assert.equal(identity('fenqihu'),'fenqihu-timber-depot');
 assert.equal(identity('dam'),'mudan-rockfill-dam');
 assert.notEqual(identity('bagua'),identity('buddha'));assert.notEqual(identity('cijinlight'),identity('fuguijiao'));assert.notEqual(identity('lukangtemple'),identity('zhenlan'));
 for(const s of list){const png=fs.readFileSync(path.join(__dirname,'..',s.url)),width=png.readUInt32BE(16),height=png.readUInt32BE(20);for(const f of s.frames){assert.equal(f.rect.length,4);assert.ok(f.rect[0]>=0&&f.rect[1]>=0&&f.rect[0]+f.rect[2]<=width&&f.rect[1]+f.rect[3]<=height,f.identity);}}
});
