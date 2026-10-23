// Classic Canvas presentation only. This shares the approved 03 contact-driven
// suspension observer, without loading Three.js or changing engine movement.
import { advanceVehicleVisualPose } from './cars.js';

const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const state = { ready:false, active:false, failed:false, source:null, pose:null, last:null };
const textures = new Map();
const image = new Image();
const loaded = new Promise(resolve => {
  image.onload=()=>{state.ready=true;state.source=image.currentSrc;resolve(true);};
  image.onerror=()=>{state.failed=true;resolve(false);};
  image.src=new URL('../assets/pixel/player-rosso-rear-v1.png',import.meta.url).href;
});

function texture(width,brake) {
  const key=width+':'+brake;if(textures.has(key))return textures.get(key);
  const height=Math.round(width*750/1455),c=document.createElement('canvas');c.width=width;c.height=height;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  // High-resolution original stays intact; nearest-neighbour sampling here
  // establishes the same logical pixel grid as the original 270-row game.
  g.drawImage(image,159,75,1455,750,0,0,width,height);
  if(brake){
    const scale=width/1455;g.fillStyle='#ffbe36';
    for(const x of [302,441,1255,1393])g.fillRect(Math.round((x-159)*scale),Math.round((477-75)*scale),Math.max(2,Math.round(46*scale)),Math.max(1,Math.round(20*scale)));
  }
  textures.set(key,c);return c;
}

function point(u,v,w,h,ppm,pose,out) {
  const direction=pose.direction,track=w*.82;
  let x=u-w*.5,y=h-v;
  const ym=y/ppm,rigid=smooth(.63,.85,ym),bow=Math.sin(Math.PI*clamp(ym/1.14,0,1));
  x+=direction*pose.bend*track*bow*(1-rigid);
  const outer=smooth(-.4,.7,-direction*x/track),sprung=smooth(0,.25,ym)*(1-smooth(.9,1.3,ym));
  y-=pose.compression*ppm*outer*sprung*(1-rigid);
  const qx=x*Math.cos(pose.yaw),pivot=-direction*track*.5*Math.cos(pose.yaw),dx=qx-pivot,c=Math.cos(pose.bank),s=Math.sin(pose.bank);
  out[0]=pivot+c*dx-s*y;
  let yy=y+(s*dx+c*y-y)*Math.max(pose.lift,smooth(0,.22,ym));
  if(outer>.5&&ym<.23)yy=Math.max(0,yy);
  out[1]=-yy;return out;
}

// Rasterise the small sprite mesh onto the original logical pixel grid. Native
// Canvas affine clips anti-alias every internal edge and leave transparent
// stripes; nearest-neighbour barycentric samples have no such seams.
const meshColumns=10,meshRows=14,vertices=[];
for(let j=0;j<=meshRows;j++)for(let i=0;i<=meshColumns;i++)vertices.push({u:i/meshColumns,v:j/meshRows,p:[0,0]});
const target=document.createElement('canvas');target.width=224;target.height=124;
const targetContext=target.getContext('2d'),targetPixels=targetContext.createImageData(224,124),sourcePixels=new WeakMap();
function rasterTriangle(a,b,c,source,w,h){
  const ax=a.p[0]+112,ay=a.p[1]+112,bx=b.p[0]+112,by=b.p[1]+112,cx=c.p[0]+112,cy=c.p[1]+112;
  const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<.00001)return;
  const inv=1/det,adx=(by-cy)*inv,bdx=(cy-ay)*inv;
  const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(223,Math.ceil(Math.max(ax,bx,cx)));
  const y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(123,Math.ceil(Math.max(ay,by,cy))),out=targetPixels.data;
  for(let y=y0;y<=y1;y++){
    let wa=((by-cy)*(x0+.5-cx)+(cx-bx)*(y+.5-cy))*inv,wb=((cy-ay)*(x0+.5-cx)+(ax-cx)*(y+.5-cy))*inv;
    for(let x=x0;x<=x1;x++,wa+=adx,wb+=bdx){const wc=1-wa-wb;
      if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
      const u=clamp(Math.floor((a.u*wa+b.u*wb+c.u*wc)*w),0,w-1),v=clamp(Math.floor((a.v*wa+b.v*wb+c.v*wc)*h),0,h-1),si=(v*w+u)*4;
      if(source[si+3]<96)continue;
      const di=(y*224+x)*4;out[di]=source[si];out[di+1]=source[si+1];out[di+2]=source[si+2];out[di+3]=255;
    }
  }
}

export async function ready() { return loaded; }
// Remote cars share the artwork and the original road projection, but never
// advance the local player's suspension observer or overwrite its diagnostics.
export function drawProjectedRear(g,{spec,spr,x,ground,scale=1,clip=Infinity,braking=false,roll=0}) {
  if(!state.ready||spec?.id!=='rosso'||!(scale>0)||!(spr?.bw>0))return false;
  const img=texture(Math.round(spr.bw),braking),w=spr.bw*scale,h=img.height*w/img.width;
  g.save();g.imageSmoothingEnabled=false;
  if(Number.isFinite(clip)){g.beginPath();g.rect(0,0,g.canvas.width,Math.max(0,clip));g.clip();}
  g.translate(x,ground);if(roll)g.rotate(roll);
  g.drawImage(img,-w/2,-h,w,h);g.restore();
  return true;
}
export function draw(g,options) {
  const {pc,spr,x,ground,lift=0,spinning=false,braking=false}=options;
  state.active=false;
  if(!state.ready||pc.spec?.id!=='rosso'){state.last={fallback:true,reason:'original-car',id:pc.spec?.id};return false;}
  const pose=state.pose=advanceVehicleVisualPose(pc.spec,pc,state.pose||{});
  // Consume/settle genuine contact impulses while an original crash/spin frame
  // is visible too, so recovery cannot replay an old collision as a new lift.
  if(pc.crash||spinning){state.last={fallback:true,reason:pc.crash?'crash':'hazard-spin',bank:pose.bank,wheelLift:pose.lift,acceptedContacts:pose.acceptedContacts,physicsTime:pc.visual?.time};return false;}
  const w=Math.round(spr.bw),img=texture(w,braking),h=img.height,ppm=w/pc.spec.W;
  g.save();g.imageSmoothingEnabled=false;g.translate(x,ground-lift);
  if(Math.abs(pose.bank)<.0001&&pose.bend<.0001&&Math.abs(pose.yaw)<.0001){g.drawImage(img,-w/2,-h);}
  else {
    let source=sourcePixels.get(img);if(!source){source=img.getContext('2d').getImageData(0,0,w,h).data;sourcePixels.set(img,source);}
    targetPixels.data.fill(0);
    for(const v of vertices)point(v.u*w,v.v*h,w,h,ppm,pose,v.p);
    for(let j=0;j<meshRows;j++)for(let i=0;i<meshColumns;i++){
      const a=vertices[j*(meshColumns+1)+i],b=vertices[j*(meshColumns+1)+i+1],c=vertices[(j+1)*(meshColumns+1)+i],d=vertices[(j+1)*(meshColumns+1)+i+1];
      rasterTriangle(a,b,c,source,w,h);rasterTriangle(b,d,c,source,w,h);
    }
    targetContext.putImageData(targetPixels,0,0);g.drawImage(target,-112,-112);
  }
  g.restore();
  state.active=true;
  state.last={x,ground,lift,width:w,height:h,pixelGrid:1,source:state.source,bank:pose.bank,bend:pose.bend,wheelLift:pose.lift,acceptedContacts:pose.acceptedContacts,physicsTime:pc.visual?.time,zoom:1};
  return true;
}
window.FORMOSA_PIXEL_CAR={state,ready,draw,drawProjectedRear};
