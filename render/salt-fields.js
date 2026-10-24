/* Native world-metre salt ponds: water/evaporation cells, dry earthen dykes,
 * and a minority of tiled crystallisation pans. Never a white snow sheet.
 */
(function(global){
  'use strict';
  const serviceWidth=4.8,cellWidth=16,cellLength=24,dykeWidth=1.15;
  const colors=[0x857c68,0x6b6557,0x9b8e73,0x648b89,0x729a98,0x87a8a2,0xb1ac95,0xd6d3bf,0x8c806d];
  const mod=(x,n)=>((x%n)+n)%n;
  function sample(off,gs){
    if(off<serviceWidth)return Math.floor(off*5+gs*3)%13===0?2:0;
    const u=off-serviceWidth,cx=Math.floor(u/cellWidth),cy=Math.floor(gs/cellLength),x=mod(u,cellWidth),y=mod(gs,cellLength);
    if(x<dykeWidth||y<dykeWidth)return x<.23||y<.23?1:2;
    const hash=mod(cx*7+cy*13,10);
    // Sparse pale crystals leave the earthen/tile pan visible. Most cells are
    // shallow water; water is opaque ground colour, not a bright white sheen.
    if(hash===0){if(mod(x,1.8)<.13||mod(y,1.8)<.13)return 8;return mod(Math.floor(x*2)+Math.floor(y*2)*3,9)<2?7:6;}
    return 3+hash%3;
  }
  let cacheKey='',packed=[];
  function paint(fb,row,x0,x1,edge,rk,gs,fog,haze){
    if(rk<=0)return false;
    const q=Math.round(Math.max(0,Math.min(1,fog))*48),key=q+':'+haze;
    if(key!==cacheKey){const a=q/48;packed=colors.map(c=>0xff000000|Math.round(((c>>16)&255)*(1-a)+((haze>>16)&255)*a)|(Math.round(((c>>8)&255)*(1-a)+((haze>>8)&255)*a)<<8)|(Math.round((c&255)*(1-a)+(haze&255)*a)<<16));cacheKey=key;}
    for(let x=x0;x<x1;x++){
      const off=Math.abs((x-edge)/rk);
      // Far cells converge to the water palette instead of aliasing into a
      // solid bright horizon; the nearer lattice retains physical dimensions.
      const id=rk<.09&&off>serviceWidth?4:sample(off,gs);
      fb[row+x]=packed[id];
    }return true;
  }
  global.FormosaSaltFields={paint,sample,colors,serviceWidth,cellWidth,cellLength,dykeWidth};
  if(typeof module!=='undefined'&&module.exports)module.exports=global.FormosaSaltFields;
})(typeof window==='undefined'?globalThis:window);
