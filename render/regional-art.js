/* Locally named landmarks missing from the original pseudo-3D tag renderer.
 * Buildings are cutouts with drawn side volume; the existing perspective street
 * walls remain the nearby architecture. These are scenery, never new driveways.
 */
(function(global){
  'use strict';
  const state={ready:false,image:null,loaded:{},records:[],warnings:[]};
  async function loadAssets(){
    const spec=global.FORMOSA_REGIONAL_ART;if(!spec)return;
    state.image=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{state.warnings.push(spec.url);resolve(null);};im.src=spec.url;});
    if(state.image)state.loaded[spec.url]={width:state.image.naturalWidth,height:state.image.naturalHeight};
  }
  function registerSprites(api){
    const spec=global.FORMOSA_REGIONAL_ART;if(!state.image||!spec)return;
    for(const frame of spec.frames){
      const [x,y,w,h]=frame.rect,source=api.canvas(w,h),g=source.getContext('2d');g.drawImage(state.image,x,y,w,h,0,0,w,h);
      const d=g.getImageData(0,0,w,h),a=d.data;let l=w,t=h,r=-1,b=-1,ink=0;
      // Keep every opaque island: the ruin's separate brick piers and the
      // steel bridge's separated feet are all part of the actual silhouette.
      for(let i=0;i<w*h;i++){const keep=a[i*4+3]>=spec.alphaCutoff;a[i*4+3]=keep?255:0;if(keep){const px=i%w,py=Math.floor(i/w);l=Math.min(l,px);t=Math.min(t,py);r=Math.max(r,px);b=Math.max(b,py);ink++;}}
      if(r<l){state.warnings.push('empty regional frame '+frame.id);continue;}
      g.putImageData(d,0,0);const tw=r-l+1,th=b-t+1,cv=api.canvas(tw,th),cg=cv.getContext('2d');cg.drawImage(source,l,t,tw,th,0,0,tw,th);
      const pix=new api.Pix(tw,th);pix.d.set(cg.getImageData(0,0,tw,th).data);
      api.addSprite('regional_'+frame.id,pix,frame.height,{ax:.5,collide:0,shadow:0,meta:{paintedRegional:true,identity:frame.id,region:frame.region}});
      state.records.push({id:frame.id,width:tw,height:th,worldHeight:frame.height,worldWidth:frame.height*tw/th,ink});
    }
    state.ready=state.records.length===spec.frames.length;
  }
  function releaseSources(){
    if(!state.ready||state.sourcesReleased)return 0;
    const image=state.image,bytes=image?(image.naturalWidth||0)*(image.naturalHeight||0)*4:0;
    if(image){image.onload=image.onerror=null;image.removeAttribute?.('src');}state.image=null;state.sourcesReleased=true;state.releasedImageBytes=bytes;return bytes;
  }
  function site(D,id,s,side,scale=1,sx=1){
    const record=state.records.find(r=>r.id===id);if(!record)return false;
    const half=record.worldWidth*scale*sx*.5,off=half+(id==='xiluo'?12:6);
    // Clear the roadside view before adding the landmark, keeping the low
    // parapet. The universal road boundary is configured after all tags.
    D.gap(s-(id==='longteng'?105:44),s+28,side);
    const y=id==='shitiping'?-2.1:id==='xiluo'?-.7:0;
    const placed=D.spr('regional_'+id,s,D.lat(s,side,off),{scale,sx,y,flip:false,landmark:true,collide:false});
    if(!placed)return false;
    if(id==='jiufen'){
      for(let j=0;j<3;j++){const q=s-14-j*10;D.spr('planter',q,D.lat(q,side,3.4+j%2*.8),{landmark:true,flip:false,collide:false});}
      D.spr('walkers',s-19,D.lat(s-19,side,6),{landmark:true,flip:false,collide:false});
    }
    (D.p.regionalSites||(D.p.regionalSites=[])).push({id,s,side,off,scale,sx,clearance:off-half});return true;
  }
  function place(D,tag,s0,s1,sec){
    if(!state.ready||sec?.diverge)return null;
    const s=s0+(s1-s0)*.56;
    if(tag==='redbridge'){
      const id={s4f:'xiluo',s4g:'longteng'}[D.p.id];if(!id)return null;
      const side=id==='xiluo'?1:-1;return site(D,id,s,side)?{id,s,side}:null;
    }
    if(D.p.id==='s5n'&&(tag==='jiufen'||tag==='redlanterns')){
      // One principal stair-lane teahouse, with smaller lantern-lit shops in
      // the other town approaches; never put the shops on the sea/cliff side.
      if(tag==='jiufen'&&D.p._jiufenMain)return null;
      const main=tag==='jiufen',ok=site(D,'jiufen',s,-1,main?1:.72);
      if(ok&&main)D.p._jiufenMain=true;
      return ok?{id:'jiufenstreet',s,side:-1}:null;
    }
    if(D.p.id==='s5p'&&tag==='shitipingrocks')return site(D,'shitiping',s,1,1,1.8)?{id:'shitiping',s,side:1}:null;
    return null;
  }
  global.FormosaRegionalArt={state,loadAssets,registerSprites,releaseSources,place};
  if(typeof module!=='undefined'&&module.exports)module.exports=global.FormosaRegionalArt;
})(typeof window==='undefined'?globalThis:window);
