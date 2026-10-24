/* Fine marble strata on the existing roadside wall projection. */
(function(global){
  'use strict';
  const state={image:null,loaded:{},ready:false,warnings:[]};
  async function loadAssets(){
    state.image=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{state.warnings.push('taroko-cliff-v1.png');resolve(null);};im.src='./assets/pixel/taroko-cliff-v1.png';});
    if(state.image)state.loaded.cliff={width:state.image.naturalWidth,height:state.image.naturalHeight};
  }
  function registerSprites(api){
    if(!state.image)return;
    const w=1008,h=672,c=api.canvas(w,h),g=c.getContext('2d');g.imageSmoothingEnabled=false;
    g.drawImage(state.image,0,0,w,h);
    const d=g.getImageData(0,0,w,h).data;
    // Discard only the low-alpha export fringe above the natural crest.
    for(let i=3;i<d.length;i+=4)d[i]=d[i]<180?0:255;
    const p=new api.Pix(w,h);p.d.set(d);
    api.addSprite('rail_marble',p,14,{collide:0,shadow:0,meta:{paintedCliff:true}});
    // A broad geological formation, not a 4 m stripe repeated up a 14 m wall.
    // Solid collision placement is independently sampled at the original 4 m.
    api.railTypes.marble.L=28;
    state.ready=true;
  }
  function releaseSources(){
    if(!state.ready||state.sourcesReleased)return 0;
    const image=state.image,bytes=image?(image.naturalWidth||0)*(image.naturalHeight||0)*4:0;
    if(image){image.onload=image.onerror=null;image.removeAttribute?.('src');}state.image=null;state.sourcesReleased=true;state.releasedImageBytes=bytes;return bytes;
  }
  global.FormosaCliffArt={loadAssets,registerSprites,releaseSources,state};
})(window);
