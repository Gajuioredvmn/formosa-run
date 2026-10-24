const test=require('node:test'),assert=require('node:assert/strict'),salt=require('../render/salt-fields.js');
test('Ponds have rectangular dry dykes along both physical axes',()=>{
 assert.equal(salt.sample(salt.serviceWidth+.1,12),1);
 assert.equal(salt.sample(salt.serviceWidth+8,24.1),1);
 assert.ok([0,2].includes(salt.sample(3,12)));
 assert.ok([3,4,5].includes(salt.sample(salt.serviceWidth+salt.cellWidth+8,12)));
});
test('Crystallisation pans occupy a minority; water dominates instead of snow',()=>{
 let pale=0,water=0,dyke=0,total=0;
 for(let x=0;x<160;x+=.5)for(let y=0;y<240;y+=.5){const i=salt.sample(x+salt.serviceWidth,y);total++;if(i===7)pale++;if(i>=3&&i<=5)water++;if(i<=2)dyke++;}
 assert.ok(pale/total<.04);assert.ok(water/total>.7);assert.ok(dyke/total>.08);
});
test('Raster writes only its requested span, remains stable in world coordinates',()=>{
 const fb=new Uint32Array(400).fill(0x12345678);salt.paint(fb,100,20,80,0,1,12,0,0);
 assert.ok(fb.slice(0,120).every(v=>v===0x12345678));assert.ok(fb.slice(180).every(v=>v===0x12345678));
 const second=new Uint32Array(400);salt.paint(second,100,20,80,0,1,12,0,0);assert.deepEqual(fb.slice(120,180),second.slice(120,180));
});
test('Distant salt cells settle to the water tone and fog correctly',()=>{
 const fb=new Uint32Array(40);salt.paint(fb,0,5,40,0,.04,12,1,0x345678);
 assert.ok(fb.slice(5).every(v=>v===0xff785634));
});
