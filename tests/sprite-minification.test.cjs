// Regression for foliage sparkle: minifying opaque leaves must conserve their
// coverage and colour, including fine branches surrounded by transparent pixels.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=source.indexOf('function mipLevels(c) {'),end=source.indexOf('// the haze:',start);
class Pixels{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}}
function canvas(w,h){const c={width:w,height:h,pixels:new Pixels(w,h)};c.getContext=()=>({getImageData:()=>c.pixels,putImageData:p=>{c.pixels=p;}});return c;}
const ctx={ImageData:Pixels,canvas};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
test('thin leaves preserve coverage and hue through every mip instead of acquiring black rims',()=>{
 const c=canvas(256,256),d=c.pixels.data;
 for(let y=0;y<256;y++)for(let x=0;x<256;x++)if((x>=120&&x<124)||(y%32<2&&x>48&&x<208)){
  const i=(y*256+x)*4;d.set([82,164,52,255],i);
 }
 const levels=ctx.mipLevels(c);let baseArea=0;
 for(let i=3;i<d.length;i+=4)baseArea+=d[i]/255;
 assert(levels.length>=4);
 for(let level=1;level<levels.length;level++){
  const pixels=levels[level].pixels.data;let area=0,visible=0;
  for(let i=0;i<pixels.length;i+=4){area+=pixels[i+3]/255;if(pixels[i+3]){
   visible++;assert(Math.abs(pixels[i]-82)<=1&&Math.abs(pixels[i+1]-164)<=1&&Math.abs(pixels[i+2]-52)<=1,'LOD cannot darken leaf colour');
  }}
  assert(visible>0,'Thin foliage cannot vanish at a reduction boundary');
  assert(Math.abs(area*4**level-baseArea)/baseArea<.035,'Projected foliage coverage must be conserved');
 }
});
test('transparent texel RGB never produces dark or bright halos around reduced leaves',()=>{
 const c=canvas(64,64),d=c.pixels.data;
 for(let i=0;i<d.length;i+=4)d.set([255,0,255,0],i);
 for(let y=16;y<48;y++)for(let x=17;x<46;x++)d.set([40,120,60,255],(y*64+x)*4);
 for(const level of ctx.mipLevels(c).slice(1))for(let i=0;i<level.pixels.data.length;i+=4){const p=level.pixels.data;if(p[i+3])assert.deepEqual(Array.from(p.slice(i,i+3)),[40,120,60]);}
});
