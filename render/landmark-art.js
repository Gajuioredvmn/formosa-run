/* Painted regional buildings for the original pseudo-3D sprite renderer.
 * The old metre dimensions, anchors, collision and shadow metadata are the
 * contract: artwork fits INSIDE that box; rendering never moves the road.
 */
(function(global){
  'use strict';
  const state={ready:false,images:{},loaded:{},warnings:[],records:[]};
  async function loadAssets(){
    const list=global.FORMOSA_LANDMARK_ART||[];
    await Promise.all([...new Map(list.map(s=>[s.url,s])).values()].map(async spec=>{
      const image=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=spec.url;});
      if(image){state.images[spec.url]=image;state.loaded[spec.url]={width:image.naturalWidth,height:image.naturalHeight};}else state.warnings.push(spec.url);
    }));
  }
  // Adjacent artwork can overlap a rectangular crop while its alpha islands
  // remain separate. Keep the measured building's main connected silhouette,
  // including its opaque roof finials, instead of another cell's stray roof.
  function isolate(api,image,rect,mask){
    const [x,y,w,h]=rect,cv=api.canvas(w,h),g=cv.getContext('2d');
    if(mask){g.beginPath();mask.forEach(([px,py],i)=>i?g.lineTo(px-x,py-y):g.moveTo(px-x,py-y));g.closePath();g.clip();}
    g.drawImage(image,x,y,w,h,0,0,w,h);
    const data=g.getImageData(0,0,w,h),d=data.data,labels=new Int32Array(w*h),queue=new Int32Array(w*h);let label=0,best=0,bestSize=0;
    for(let at=0;at<labels.length;at++){
      if(labels[at]||d[at*4+3]<180)continue;
      label++;let head=0,tail=1;queue[0]=at;labels[at]=label;
      while(head<tail){const p=queue[head++],px=p%w,py=Math.floor(p/w);for(const n of [px?p-1:-1,px<w-1?p+1:-1,py?p-w:-1,py<h-1?p+w:-1])if(n>=0&&!labels[n]&&d[n*4+3]>=180){labels[n]=label;queue[tail++]=n;}}
      if(tail>bestSize){bestSize=tail;best=label;}
    }
    let left=w,right=-1,top=h,bottom=-1;
    for(let i=0;i<labels.length;i++){const keep=labels[i]===best;d[i*4+3]=keep?255:0;if(keep){const px=i%w,py=Math.floor(i/w);left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}}
    g.putImageData(data,0,0);
    if(right<left)return cv;
    const tight=api.canvas(right-left+1,bottom-top+1);tight.getContext('2d').drawImage(cv,left,top,tight.width,tight.height,0,0,tight.width,tight.height);return tight;
  }
  function fit(old,rect){
    // An integer multiple preserves w/h exactly (and therefore world width).
    const factor=Math.max(1,Math.min(4,Math.floor(Math.min(384/old.pix.h,1000/old.pix.w)))),w=old.pix.w*factor,h=old.pix.h*factor;
    const scale=Math.min(w/rect[2],h/rect[3]),dw=Math.max(1,Math.floor(rect[2]*scale)),dh=Math.max(1,Math.floor(rect[3]*scale));
    return{w,h,dw,dh,x:Math.floor((w-dw)/2),y:h-dh};
  }
  function registerSprites(api){
    const originals=new Map(api.originals.map(q=>[q.name,q]));
    for(const spec of global.FORMOSA_LANDMARK_ART||[]){
      const image=state.images[spec.url];if(!image)continue;
      for(const frame of spec.frames){
        let source;
        for(const name of frame.aliases){
          const old=originals.get(name);if(!old){state.warnings.push('missing legacy sprite: '+name);continue;}
          source ||= isolate(api,image,frame.rect,frame.mask);
          const f=fit(old,[0,0,source.width,source.height]),cv=api.canvas(f.w,f.h),g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(source,f.x,f.y,f.dw,f.dh);
          const p=new api.Pix(f.w,f.h);p.d.set(g.getImageData(0,0,f.w,f.h).data);
          const meta=Object.assign({},old.o.meta,{paintedLandmark:true,landmarkFamily:spec.family,landmarkIdentity:frame.identity});
          api.addSprite(name,p,old.wh,Object.assign({},old.o,{meta}));
          state.records.push({name,identity:frame.identity,family:spec.family,oldWidth:old.wh*old.pix.w/old.pix.h,oldHeight:old.wh,oldAnchor:old.o.ax??.5,oldCollide:old.o.collide??.25,box:f});
        }
      }
    }
    state.ready=true;
  }
  function releaseSources(){
    if(!state.ready||state.sourcesReleased)return 0;
    let bytes=0;for(const image of Object.values(state.images)){bytes+=(image.naturalWidth||0)*(image.naturalHeight||0)*4;image.onload=image.onerror=null;image.removeAttribute?.('src');}
    state.images={};state.sourcesReleased=true;state.releasedImageBytes=bytes;return bytes;
  }
  function regionalLabel(piece,s){
    if(piece?.id==='s4c'){
      const section=piece.sec(s),current=piece.secs.indexOf(section),valley=piece.secs.findIndex(sec=>(sec.tags||[]).includes('daylilies'));
      if((section.tags||[]).includes('duoliang'))return '台東・多良海岸';
      if((section.tags||[]).includes('jinlun'))return '台東・金崙';
      return current<valley?'台東・南迴海岸':'台東・花東縱谷';
    }
    if(piece?.id==='s3w'){
      const tags=piece.sec(s).tags||[];
      if(tags.includes('saltmountain')||piece.sec(s).L==='salt'||piece.sec(s).R==='salt')return '台南・七股鹽田';
      if(tags.includes('crystalchurch'))return '台南・北門鹽鄉';
      if(tags.includes('beehive'))return '台南・鹽水';
      if(tags.includes('budai'))return '嘉義・布袋';
      if(tags.includes('lukang'))return '彰化・鹿港';
    }
    if(piece?.id==='s4f')return piece.sec(s).tags?.includes('redbridge')?'雲林・西螺大橋':'雲林・北港香路';
    if(piece?.id==='s2n'){
      const current=piece.secs.indexOf(piece.sec(s)),tainan=piece.secs.findIndex(sec=>sec.tags?.includes('pineapples'));
      return current<tainan?'高雄・岡山橋頭路竹':'台南・府城風景線';
    }
    if(piece?.id==='s4a'){
      const current=piece.secs.indexOf(piece.sec(s)),taichung=piece.secs.findIndex(sec=>sec.tags?.includes('qilou')),miaoli=piece.secs.findIndex(sec=>sec.tags?.includes('sanyi'));
      return current<taichung?'彰化・八卦山':current<miaoli?'台中・高美大甲':'苗栗・三義客庄';
    }
    if(piece?.id!=='s3sm')return null;
    const section=piece.sec(s),bridge=piece.secs.findIndex(sec=>sec.tags?.includes('gaoping')),current=piece.secs.indexOf(section);
    if(current===bridge)return '高屏溪・斜張橋';
    return current<bridge?'高雄・大樹山麓':'屏東・沿山公路';
  }
  const api={state,loadAssets,registerSprites,releaseSources,fit,regionalLabel};global.FormosaLandmarkArt=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
