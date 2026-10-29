// Classic Canvas presentation only. This shares the approved 03 contact-driven
// suspension observer, without loading Three.js or changing engine movement.
import { advanceVehicleVisualPose } from './cars.js';
import { VEHICLE_ART } from './vehicle-art-manifest.js';
import { CREW_MASKS_A } from './crew-masks-a.js';
import { CREW_MASKS_B } from './crew-masks-b.js';
import { separateCrew, restoreCrewBackplate, materialMesh, polygons } from './crew-layers.js';
import { CREW_BACKPLATES } from './crew-backplates.js';
import { vehiclePresentation, crewAction, warpCrew, drawCrewGestures, clothMotion, warpCloth, materialAttachment, clothBendGeometry } from './vehicle-motion.js';

const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const state = { ready:false, complete:false, active:false, failed:false, source:null, pose:null, last:null, assets:{} };
const textures = new Map();
const images = new Map();
const backplates = new Map();
const crewMasks={...CREW_MASKS_A,...CREW_MASKS_B},layerCache=new WeakMap();
// Two physical samples per classic logical pixel preserve camera, vehicle size
// and contacts while retaining the linework in the individual source artwork.
const detailScale=2;
const loaded = Promise.all(Object.entries(VEHICLE_ART).map(([id,art])=>new Promise(resolve=>{
  if(!art.src||!art.rear){state.assets[id]='missing';resolve(false);return;}
  const image=new Image();state.assets[id]='loading';
  image.onload=()=>{
    const finish=()=>{images.set(id,image);state.assets[id]='ready';state.ready=true;resolve(true);};
    if(!CREW_BACKPLATES[id]){finish();return;}
    const base=new Image();
    base.onload=()=>{backplates.set(id,base);finish();};
    base.onerror=()=>{state.assets[id]='failed';state.failed=true;resolve(false);};
    base.src=new URL(CREW_BACKPLATES[id].src,import.meta.url).href;
  };
  image.onerror=()=>{state.assets[id]='failed';state.failed=true;resolve(false);};
  image.src=new URL(art.src,import.meta.url).href;
}))).then(results=>{state.complete=results.length>0&&results.every(Boolean);return state.ready;});

export function has(spec) { return images.has(typeof spec==='string'?spec:spec?.id); }
function sourceRect(image,rect) { return [rect[0]*image.width,rect[1]*image.height,rect[2]*image.width,rect[3]*image.height]; }
function clipAtlasPolygon(g,polygon,image,crop,dx,dy,scale){
  if(!polygon?.length)return;g.beginPath();
  polygon.forEach(([x,y],i)=>{const px=dx+(x*image.width-crop[0])*scale,py=dy+(y*image.height-crop[1])*scale;i?g.lineTo(px,py):g.moveTo(px,py);});
  g.closePath();g.clip();
}
export function measure(spec,width) {
  if(!has(spec))return null;const crop=sourceRect(images.get(spec.id),VEHICLE_ART[spec.id].rear);
  return {width:Math.round(width),height:Math.max(1,Math.round(width*crop[3]/crop[2]))};
}

function texture(id,width,brake) {
  const key=id+':'+width+':'+brake;if(textures.has(key))return textures.get(key);
  const image=images.get(id),art=VEHICLE_ART[id],crop=sourceRect(image,art.rear);
  const height=Math.max(1,Math.round(width*crop[3]/crop[2])),c=document.createElement('canvas');c.width=width*detailScale;c.height=height*detailScale;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.scale(detailScale,detailScale);
  g.save();clipAtlasPolygon(g,art.rearMask,image,crop,0,0,width/crop[2]);g.drawImage(image,...crop,0,0,width,height);g.restore();
  if(brake){
    g.fillStyle=art.brakeColor||'#ffbe36';
    for(const [x,y,w,h] of art.lamps||[])g.fillRect(Math.round(x*width),Math.round(y*height),Math.max(1,Math.round(w*width)),Math.max(1,Math.round(h*height)));
  }
  // Match the mesh's pixel-art coverage in the still/menu path as well, so
  // entering wind animation cannot switch soft fringes on or off.
  const pixels=g.getImageData(0,0,c.width,c.height);
  for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]<96?0:255;
  g.putImageData(pixels,0,0);
  textures.set(key,c);return c;
}

function point(u,v,w,h,ppm,pose,out) {
  const direction=pose.direction,track=w*.82;
  let x=u-w*.5,y=h-v;
  const ym=y/ppm,rigid=smooth(.63,.85,ym),bow=Math.sin(Math.PI*clamp(ym/1.14,0,1));
  x+=direction*pose.bend*track*bow*(1-rigid);
  // Rear-quarter shear follows measured yaw; the tyre contact stays anchored
  // and no whole-car scaling is used when the body rotates into a slide.
  x+=Math.sin(pose.yaw)*w*.45*clamp(y/h,0,1);
  const outer=smooth(-.4,.7,-direction*x/track),sprung=smooth(0,.25,ym)*(1-smooth(.9,1.3,ym));
  y-=pose.compression*ppm*outer*sprung*(1-rigid);
  const qx=x*Math.cos(pose.yaw),pivot=-direction*track*.5*Math.cos(pose.yaw),dx=qx-pivot,c=Math.cos(pose.bank),s=Math.sin(pose.bank);
  out[0]=pivot+c*dx-s*y;
  let yy=y+(s*dx+c*y-y)*Math.max(pose.lift,smooth(0,.22,ym));
  if(outer>.5&&ym<.23)yy=Math.max(0,yy);
  out[1]=-yy;return out;
}

// Rasterise the small sprite mesh at two samples per logical pixel. Native
// Canvas affine clips anti-alias every internal edge and leave transparent
// stripes; nearest-neighbour barycentric samples have no such seams.
function materialLayers(img,art,id){
 if(layerCache.has(img))return layerCache.get(img);
 const source=img.getContext('2d').getImageData(0,0,img.width,img.height).data;
 const masks=crewMasks[id];
 if(!masks)throw new Error('Missing crew material masks: '+id);
 const layers=separateCrew(source,img.width,img.height,masks,art.cloth);
 const backplate=backplates.get(id),repair=CREW_BACKPLATES[id];
 if(backplate&&repair){
   const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
   const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(backplate,...sourceRect(backplate,repair.crop||[0,0,1,1]),0,0,img.width,img.height);
   restoreCrewBackplate(layers,g.getImageData(0,0,img.width,img.height).data,img.width,img.height,repair.patches,art.cloth);
 }
 const body=materialMesh(layers.body,img.width,img.height,24,24);
 const crew=layers.crew.map(p=>materialMesh(p,img.width,img.height,48,40));
 const cloth=layers.cloth.map(p=>materialMesh(p,img.width,img.height,64,48));
 const fixed=(masks.fixed||[]).map(polygons),w=img.width/detailScale,h=img.height/detailScale;
 // Attachment distances are source geometry: compute once, not per frame.
 cloth.forEach((layer,i)=>{layer.bend=clothBendGeometry(art.cloth[i],w,h,fixed[i]||[]);for(const v of layer.vertices)v.attachment=materialAttachment(v.u*w,v.v*h,w,h,fixed[i]||[]);});
 const foreground=materialMesh(layers.foreground,img.width,img.height,24,24);
 const result={body,crew,cloth,foreground,counts:layers.counts,labels:layers.labels};
 layerCache.set(img,result);return result;
}
// A larger transparent workspace prevents tall crew and the lifted inner wheel
// from clipping at full bank. It does not change sprite width or camera scale.
const targetW=320*detailScale,targetH=224*detailScale,anchorX=160*detailScale,anchorY=200*detailScale;
const target=document.createElement('canvas');target.width=targetW;target.height=targetH;
const targetContext=target.getContext('2d'),targetPixels=targetContext.createImageData(targetW,targetH);
function rasterTriangle(a,b,c,source,w,h){
  const ax=a.p[0]*detailScale+anchorX,ay=a.p[1]*detailScale+anchorY,bx=b.p[0]*detailScale+anchorX,by=b.p[1]*detailScale+anchorY,cx=c.p[0]*detailScale+anchorX,cy=c.p[1]*detailScale+anchorY;
  const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<.00001)return;
  const inv=1/det,adx=(by-cy)*inv,bdx=(cy-ay)*inv;
  const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(targetW-1,Math.ceil(Math.max(ax,bx,cx)));
  const y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(targetH-1,Math.ceil(Math.max(ay,by,cy))),out=targetPixels.data;
  for(let y=y0;y<=y1;y++){
    let wa=((by-cy)*(x0+.5-cx)+(cx-bx)*(y+.5-cy))*inv,wb=((cy-ay)*(x0+.5-cx)+(ax-cx)*(y+.5-cy))*inv;
    for(let x=x0;x<=x1;x++,wa+=adx,wb+=bdx){const wc=1-wa-wb;
      if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
      const u=clamp(Math.floor((a.u*wa+b.u*wb+c.u*wc)*w),0,w-1),v=clamp(Math.floor((a.v*wa+b.v*wb+c.v*wc)*h),0,h-1),si=(v*w+u)*4;
      if(source[si+3]<96)continue;
      const di=(y*targetW+x)*4;out[di]=source[si];out[di+1]=source[si+1];out[di+2]=source[si+2];out[di+3]=255;
    }
  }
}

export async function ready() { return loaded; }
// Remote cars share the artwork and the original road projection, but never
// advance the local player's suspension observer or overwrite its diagnostics.
export function drawProjectedRear(g,{spec,spr,x,ground,scale=1,clip=Infinity,braking=false,roll=0,crash=false,time=0}) {
  if(!has(spec)||!(scale>0)||!(spr?.bw>0))return false;
  const img=texture(spec.id,Math.round(spr.bw),braking),w=spr.bw*scale,h=img.height*w/img.width;
  g.save();g.imageSmoothingEnabled=false;
  if(Number.isFinite(clip)){g.beginPath();g.rect(0,0,g.canvas.width,Math.max(0,clip));g.clip();}
  g.translate(x,ground);
  if(crash&&roll){const bank=clamp(roll,-.94,.94),pivot=-Math.sign(bank)*w*.41;g.translate(pivot,0);g.rotate(-bank);g.translate(-pivot,0);}
  else if(!crash&&roll)g.rotate(roll);
  g.drawImage(img,-w/2,-h,w,h);g.restore();
  return true;
}

// The same vehicle and seated cast are shown in selection and thumbnail views.
// A rear atlas cannot honestly provide a rotating 360-degree turntable.
export function drawShowcase(g,{spec,x,ground,width,maxHeight=Infinity,braking=false,reflection=false}) {
  if(!has(spec))return false;
  const art=VEHICLE_ART[spec.id],image=images.get(spec.id),crop=sourceRect(image,art.rear);
  const w=Math.max(1,Math.floor(Math.min(width,maxHeight*crop[2]/crop[3]))),img=texture(spec.id,w,braking),h=img.height/detailScale;
  g.save();g.imageSmoothingEnabled=false;
  if(reflection){g.save();g.beginPath();g.rect(0,ground,g.canvas.width,g.canvas.height-ground);g.clip();g.globalAlpha*=.16;g.translate(x,ground*2+3);g.scale(1,-1);g.drawImage(img,-w/2,ground-h,w,h);g.restore();}
  g.drawImage(img,Math.round(x-w/2),Math.round(ground-h),w,h);g.restore();return true;
}
export function drawPortrait(g,{spec,index,x=0,y=0,width=g.canvas.width,height=g.canvas.height}) {
  const rect=VEHICLE_ART[spec?.id]?.portraits?.[index];if(!has(spec)||!rect)return false;
  const image=images.get(spec.id),crop=sourceRect(image,rect),scale=Math.min(width/crop[2],height/crop[3]),w=crop[2]*scale,h=crop[3]*scale;
  const dx=Math.round(x+(width-w)/2),dy=Math.round(y+height-h);
  g.save();g.imageSmoothingEnabled=false;clipAtlasPolygon(g,VEHICLE_ART[spec.id].portraitMasks?.[index],image,crop,dx,dy,scale);g.drawImage(image,...crop,dx,dy,Math.round(w),Math.round(h));g.restore();return true;
}
export function draw(g,options) {
  const {pc,spr,x,ground,lift=0,spinning=false,spinAngle=0,braking=false,cheer=null,crew=[],crewInertia={}}=options;
  state.active=false;
  state.materialGeometry=null;
  if(!has(pc.spec)){state.last={fallback:true,reason:'original-car',id:pc.spec?.id};return false;}
  // Switching cars is presentation state only; the original physics spec and
  // race position remain owned by the classic engine.
  if(state.poseCar!==pc.spec.id){state.pose=null;state.presentation=null;state.cloth=null;state.poseCar=pc.spec.id;}
  const physical=state.pose=advanceVehicleVisualPose(pc.spec,pc,state.pose||{});
  const presentation=vehiclePresentation(pc.spec,pc,physical,state.presentation||{}),pose=presentation.pose;
  state.presentation=presentation.state;
  const w=Math.round(spr.bw),img=texture(pc.spec.id,w,braking),h=img.height/detailScale,ppm=w/pc.spec.W;
  const art=VEHICLE_ART[pc.spec.id],action=crewAction(pc.spec,pc,spinning?null:cheer,crewInertia);
  state.cloth=clothMotion(pc.spec,pc,art,state.cloth||{});
  const crewMoves=action.active||Math.abs(action.headX)+Math.abs(action.headY)>.02||state.cloth.parts.some(p=>Math.abs(p.x)+Math.abs(p.y)>.02);
  const project=(u,v)=>{const p=warpCrew(u,v,w,h,action,art);return point(p[0],p[1],w,h,ppm,pose,[0,0]);};
  let gestures=[];
  g.save();g.imageSmoothingEnabled=false;g.translate(x,ground-lift);
  if(spinning&&!pc.crash){g.translate(0,-24);g.rotate(spinAngle);g.drawImage(img,-w/2,-h+24,w,h);}
  else if(!crewMoves&&Math.abs(pose.bank)<.0001&&pose.bend<.0001&&Math.abs(pose.yaw)<.0001&&Math.abs(pose.compression)<.0001){g.drawImage(img,-w/2,-h,w,h);}
  else {
    const layers=materialLayers(img,art,pc.spec.id);
    state.materialGeometry={body:layers.body.vertices,foreground:layers.foreground.vertices};
    targetPixels.data.fill(0);
    const paint=(layer,person=false,part=-1)=>{
      for(const v of layer.vertices){
        let p=[v.u*w,v.v*h];
        if(part>=0)p=warpCloth(p[0],p[1],w,h,art,state.cloth,part,v.attachment,layer.bend);
        if(person){const head=warpCrew(v.u*w,v.v*h,w,h,action,art);p[0]+=head[0]-v.u*w;p[1]+=head[1]-v.v*h;}
        point(p[0],p[1],w,h,ppm,pose,v.p);
      }
      for(const [a,b,c] of layer.triangles)rasterTriangle(a,b,c,layer.source,img.width,img.height);
    };
    // Only the material's source pixels enter its moving mesh. The rigid
    // vehicle never receives head or cloth deformation, even at mask edges.
    paint(layers.body);
    for(const layer of layers.crew)paint(layer,true);
    layers.cloth.forEach((layer,i)=>paint(layer,true,i));
    paint(layers.foreground);
    targetContext.putImageData(targetPixels,0,0);g.drawImage(target,-anchorX/detailScale,-anchorY/detailScale,targetW/detailScale,targetH/detailScale);
  }
  if(!pc.crash&&!spinning)gestures=drawCrewGestures(g,{spec:pc.spec,crew,art,w,h,action,project});
  g.restore();
  state.active=true;
  state.source=images.get(pc.spec.id).currentSrc;
  state.last={id:pc.spec.id,x,ground,lift,width:w,height:h,pixelGrid:1/detailScale,rasterScale:detailScale,textureWidth:img.width,source:state.source,bank:pose.bank,bend:pose.bend,yaw:pose.yaw,wheelLift:pose.lift,acceptedContacts:pose.acceptedContacts,physicsTime:pc.visual?.time,zoom:1,crash:!!pc.crash,crashStyle:pose.crashStyle,crashSeverity:pose.crashSeverity,compression:pose.compression,spinning,motionProfile:pose.profile,celebrating:action.active,celebrationProfile:action.profile,gestures,cloth:state.cloth.parts.map(p=>({x:p.x,y:p.y})),materials:layerCache.get(img)?.counts||null};
  return true;
}
window.FORMOSA_PIXEL_CAR={state,ready,has,measure,draw,drawProjectedRear,drawShowcase,drawPortrait};
