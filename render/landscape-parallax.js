/* Detailed pixel panoramas, depth-separated clouds and world-space ground. This module observes
 * route/camera data; it never writes road coordinates, physics or player state. */
(function(global){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  const hash=(a,b)=>{let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  const mix=(a,b,t)=>{const c=[];for(const shift of [16,8,0])c.push(Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t));return 'rgb('+c.join(',')+')';};
  const PROFILES={
    plain:{art:'forest',heights:[26,18,12],land:0x8aab71,near:false},
    kaohsiung:{art:'forest',heights:[43,29,18],land:0x83998b,water:true,skyline:true},
    tainan:{art:'forest',heights:[27,18,12],land:0x8caa73,skyline:true},
    taichung:{art:'forest',heights:[48,30,19],land:0x90aa7a,skyline:true},
    coast:{art:'coast',heights:[38,40,43],land:0x78a67a,water:true,coast:true},
    southcoast:{art:'coast',heights:[57,77,99],land:0x63965e,water:true,coast:true},
    hengchun:{art:'coast',heights:[39,49,64],land:0x77a36b,water:true,coast:true},
    westcape:{art:'coast',heights:[24,33,43],land:0x86a56a,water:true,coast:true},
    eastcape:{art:'coast',heights:[26,37,48],land:0x8ba569,water:true,coast:true},
    mountain:{art:'forest',heights:[61,77,83],land:0x67835b},
    alishan:{art:'forest',heights:[74,88,96],land:0x637d61},
    foothills:{art:'forest',heights:[54,67,74],land:0x739064},
    nanzhuang:{art:'forest',heights:[56,73,88],land:0x76945e},
    nantou:{art:'forest',heights:[57,69,76],land:0x79996a,water:true,lake:true},
    cingjing:{art:'alpine',heights:[74,91,104],land:0x9da574,alpine:true},
    hualien:{art:'gorge',heights:[74,102,122],land:0x868e80,gorge:true},
    taitung:{art:'forest',heights:[63,77,78],land:0x7d9c60,valley:true},
    northcoast:{art:'coast',heights:[34,45,56],land:0x789d69,water:true,coast:true},
    yilan:{art:'coast',heights:[56,66,67],land:0x86a573,water:true,coast:true},
    taipei:{art:'forest',heights:[44,38,28],land:0x7d9b83,skyline:true},
    westernplain:{art:'forest',heights:[20,13,9],land:0x90ac73,near:false},
    gaomei:{art:'coast',heights:[14,12,8],land:0x8f9982,water:true,coast:true,skyline:true,near:false},
    nanliao:{art:'coast',heights:[19,16,12],land:0x89a077,water:true,coast:true,skyline:true,near:false},
    jiufen:{art:'coast',heights:[60,78,91],land:0x759068,water:true,coast:true},
    sanxiantai:{art:'coast',heights:[49,61,69],land:0x719869,water:true,coast:true},
    shitiping:{art:'coast',heights:[49,61,69],land:0x82967b,water:true,coast:true},
  };
  const state={images:{},loaded:{},ready:false,layers:{},warnings:[],drawn:[],clouds:[],manifest:global.FORMOSA_LANDSCAPE_ART||{}};
  function canvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
  function layerRows(image,meta){
    const full=canvas(image.naturalWidth,image.naturalHeight),fg=full.getContext('2d',{willReadFrequently:true});fg.drawImage(image,0,0);
    const W=full.width,H=full.height,pixels=fg.getImageData(0,0,W,H),data=pixels.data,rows=[];
    // The delivered PNGs have RGB gradient mattes beneath zero alpha. Never
    // interpret those RGB values as a sky; discard their low-alpha fringe.
    for(let i=3;i<data.length;i+=4)data[i]=data[i]<180?0:255;
    fg.putImageData(pixels,0,0);
    for(let row=0;row<3;row++){
      const range=meta.regions?.[row]||[0,Math.floor(row*H/3),W,Math.floor((row+1)*H/3)-Math.floor(row*H/3)];
      let y0=range[1]+range[3],y1=range[1];
      for(let y=range[1];y<range[1]+range[3];y++){let n=0;for(let x=range[0];x<range[0]+range[2];x++)if(data[(y*W+x)*4+3]>96)n++;if(n>W*.006){y0=Math.min(y0,y);y1=Math.max(y1,y);}}
      if(y1<y0){rows.push(null);continue;}
      const c=canvas(range[2],y1-y0+1),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(full,range[0],y0,range[2],y1-y0+1,0,0,c.width,c.height);
      // Feather only panorama seams, retaining crisp pixels everywhere else.
      g.globalCompositeOperation='destination-in';const fade=g.createLinearGradient(0,0,c.width,0);fade.addColorStop(0,'#0000');fade.addColorStop(.025,'#000');fade.addColorStop(.975,'#000');fade.addColorStop(1,'#0000');g.fillStyle=fade;g.fillRect(0,0,c.width,c.height);
      rows.push(c);
    }return rows;
  }
  async function loadAssets(){await Promise.all(Object.entries(state.manifest).map(async([role,meta])=>{try{const im=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=new URL(meta.url,document.baseURI).href;});state.images[role]=im;if(meta.tiles)loadGroundTiles(im);else if(meta.clouds)loadClouds(im,meta);else state.layers[role]=layerRows(im,meta);state.loaded[role]={url:meta.url,width:im.naturalWidth,height:im.naturalHeight};}catch{state.warnings.push(role+' landscape unavailable');}}));state.ready=true;}
  function releaseSources(){
    if(!state.ready||state.sourcesReleased)return 0;
    let bytes=0;for(const image of Object.values(state.images)){bytes+=(image.naturalWidth||0)*(image.naturalHeight||0)*4;image.onload=image.onerror=null;image.removeAttribute?.('src');}
    state.images={};state.sourcesReleased=true;state.releasedImageBytes=bytes;return bytes;
  }
  const OCEAN_SIDES=new Set(['shore','beach','bay','cliff','pebble','mudflat']);
  function waterSides(piece,s){const section=piece?.sec?.(s)||{};return {left:OCEAN_SIDES.has(section.L),right:OCEAN_SIDES.has(section.R)};}
  function loadClouds(image,meta){
    state.clouds=meta.cells.map(([x,y,w,h])=>{const c=canvas(w,h),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,x,y,w,h,0,0,w,h);const pixels=g.getImageData(0,0,w,h);for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]<180?0:255;g.putImageData(pixels,0,0);return c;});
  }
  function cloudStrip(seed,W,H,horizon,detail){
    if(state.clouds.length!==6)return null;
    const c=canvas(W*detail,H*detail),g=c.getContext('2d');c.logicalWidth=W;c.logicalHeight=H;g.scale(detail,detail);g.imageSmoothingEnabled=false;
    for(let i=0;i<12;i++){
      const tall=i<3,id=tall?[1,2,5][i%3]:[0,3,4][i%3],im=state.clouds[id];
      const w=(tall?88:42)+hash(seed,i*3+1)*(tall?50:58),h=w*im.height/im.width;
      // Space towers around the whole horizon; random clustering used to stack
      // seven giant white cards into a wall over the industrial bridge.
      const count=tall?3:9,order=tall?i:i-3,phase=hash(seed,99)*W;
      const x=(phase+order*W/count+hash(seed,i*3+2)*W/(count*4))%W,y=tall?horizon-h+5+hash(seed,i*3+3)*10:5+hash(seed,i*3+3)*Math.max(10,horizon-h-30);
      g.drawImage(im,x,y,w,h);if(x+w>W)g.drawImage(im,x-W,y,w,h);
    }return c;
  }
  function profile(key){return PROFILES[key]||PROFILES.plain;}
  function drawBackdrop(g,set,camAz,alpha,api){
    const p=profile(set.key),layers=state.layers[p.art];if(!layers?.every(Boolean))return false;
    const a=alpha==null?1:alpha,W=api.width,H=api.height,hy=api.horizon;
    const piece=api.piece,s=clamp(api.s||0,0,piece?.L||0);
    const bearing=piece?.heading?piece.heading(Math.min(piece.L,s+170)):camAz;
    const bend=Math.atan2(Math.sin(camAz-bearing),Math.cos(camAz-bearing));
    // The road's approach direction keeps the east-side hill / west-side sea
    // composition intelligible around arcade bends. Lateral camera travel and
    // look-ahead bearing move each depth plane by a different angular amount.
    const yaw=clamp(bend,-.8,.8),lat=api.lateral||0;
    g.save();g.globalAlpha=a;
    // A coastal route can contain inland town, refinery and bridge sections.
    // Ocean colour belongs only to an explicitly open-ocean side. Rivers,
    // lakes, harbours and bridge water are finite physical raster bands with
    // land beyond; filling their whole backdrop blue floats the distant town.
    const water=waterSides(piece,s);
    g.fillStyle=mix(p.land,api.haze||0xc8e2f4,.18);g.fillRect(0,hy,W,H-hy);
    g.fillStyle=mix(0x449fbc,api.haze||0xc8e2f4,.18);
    if(water.left)g.fillRect(0,hy,W*.5,H-hy);
    if(water.right)g.fillRect(W*.5,hy,W*.5,H-hy);
    g.save();if(p.coast&&!water.left&&!water.right){g.beginPath();g.rect(0,0,W,hy+2);g.clip();}
    state.drawn=[];
    for(let i=0;i<3;i++){
      if(p.near===false&&i===2)continue;
      const im=layers[i],height=p.heights[i]*[1.15,.86,.54][i],width=Math.max(W*(p.coast?1.3:1.5),height*im.width/im.height),bottom=hy+[5,15,27][i];
      const shift=-yaw*api.focal*[.16,.34,.62][i]-lat*[.012,.03,.08][i];
      const cx=W*(p.coast?.24:.5)+shift,x=cx-width*.5;
      if(p.coast){g.drawImage(im,x,bottom-height,width,height);}
      else{const step=width*.94;for(let dx=x-step;dx<W;dx+=step)g.drawImage(im,dx,bottom-height,width,height);}
      state.drawn.push({role:p.art,layer:i,shift,height,width,coast:!!p.coast});
    }
    g.restore();g.restore();return true;
  }
  // Ground remains on the established road-height raster. Extending a curved
  // road hundreds of metres sideways folds terrain through the camera; sampling
  // the real raster instead preserves all hill crests and occlusion exactly.
  const TILE_TYPES={highland:0,gorge:5,orchard:3,tea:4,mountain:2,hills:2,slope:2};
  function groundBand(type,index,total){return type==='gorge'?index===1:index===total-1;}
  const groundTiles=[];
  function loadGroundTiles(image){
    for(let tile=0;tile<6;tile++){
      const levels=[];
      for(let size=256;size>=1;size>>=1){
        const c=canvas(size,size),g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
        g.drawImage(image,(tile%3)*512,Math.floor(tile/3)*512,512,512,0,0,size,size);
        const bytes=g.getImageData(0,0,size,size).data;
        levels.push({size,bytes,fog:new Map()});
      }groundTiles.push(levels);
    }
  }
  function terrainTile(type,pano,offset){
    if(!(type in TILE_TYPES))return -1;
    if(pano==='cingjing')return offset>18?1:0;
    return TILE_TYPES[type];
  }
  function foggedGround(level,fog,haze){
    const q=Math.round(clamp(fog,0,1)*24),key=haze*25+q;
    let data=level.fog.get(key);if(data)return data;
    // A changing time-of-day cannot accumulate unbounded recoloured textures.
    if(level.fog.size>28)level.fog.clear();
    const a=q/24,ih=1-a,hr=(haze>>16)&255,hg=(haze>>8)&255,hb=haze&255;
    data=new Uint32Array(level.size*level.size);const b=level.bytes;
    for(let i=0;i<data.length;i++)data[i]=0xff000000|(Math.round(b[i*4]*ih+hr*a))|(Math.round(b[i*4+1]*ih+hg*a)<<8)|(Math.round(b[i*4+2]*ih+hb*a)<<16);
    level.fog.set(key,data);return data;
  }
  function paintGround(fb,row,x0,x1,edge,rk,gs,type,pano,fog,haze){
    const id=terrainTile(type,pano,24),levels=groundTiles[id];if(!levels||rk<=0)return false;
    // One 16m tile repeats in world metres. Choose the mip from projected texel
    // size, so distant grass converges into colour instead of flickering noise.
    const texels=16,lod=clamp(Math.floor(Math.log2(texels/Math.max(.01,rk))),0,8),level=levels[lod],size=level.size,scale=size/16,mask=size-1;
    const pixels=foggedGround(level,fog,haze),v=(Math.floor(gs*scale)&mask)*size,inv=scale/rk;
    for(let x=x0;x<x1;x++)fb[row+x]=pixels[v+(Math.floor((x-edge)*inv)&mask)];
    return true;
  }
  global.FormosaLandscape={loadAssets,releaseSources,drawBackdrop,paintGround,groundBand,terrainTile,cloudStrip,waterSides,profile,PROFILES,state};
})(window);
