// Presentation only: profiles consume the original car's acceleration, slip and
// approved contact observer. They never write PC or invent lift on level road.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};

function gustNoise(time,seed){
 const cell=Math.floor(time),u=time-cell,t=u*u*(3-2*u),hash=n=>{let k=Math.imul(n+seed,1597334677);k=Math.imul(k^(k>>>16),2246822507);return((k^(k>>>13))>>>0)/2147483648-1;};
 return hash(cell)*(1-t)+hash(cell+1)*t;
}
// Separate damped material states: fixed roots, freely moving tips. Inputs are
// measured acceleration, sideways velocity and airspeed; no physics write-back
// or continuously running sinusoid is used to pretend the hair has inertia.
export function clothMotion(spec,pc,art,previous={}){
 const time=pc.visual?.time||0,parts=art.cloth||[];
 let q=previous;if(q.id!==spec.id||q.source!==pc.visual||time<q.time)q={id:spec.id,source:pc.visual,time,lastV:pc.v||0,gust:0,parts:parts.map(()=>({x:0,y:0,vx:0,vy:0}))};
 const dt=clamp(time-q.time,0,.1);q.time=time;if(!dt)return q;
 const speed=Math.max(0,pc.v||0),flow=clamp(speed/55,0,1.6),accel=clamp((speed-q.lastV)/dt,-25,25),lat=clamp(pc.visual?.lateralAccel||0,-30,30);q.lastV=speed;
 const input=gustNoise(time*1.7,37)*.7+gustNoise(time*3.1,83)*.3;q.gust+=(input-q.gust)*(1-Math.exp(-dt*7));
 for(let i=0;i<parts.length;i++){
  const p=parts[i],s=q.parts[i],flex=p.flex??1,omega=p.kind==='veil'?7:p.kind==='scarf'?9:p.kind==='ear'?18:12,damping=p.kind==='veil'?.88:.82;
  const targetX=clamp((-lat*.11-(pc.vx||0)*.18+(pc.wind||0)*.15+q.gust*.55*flow)*flex,-4,4),targetY=clamp((flow*2.4+accel*.06+q.gust*.38*flow)*flex,-2,4.5);
  const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  for(let n=0;n<steps;n++){s.vx+=(omega*omega*(targetX-s.x)-2*damping*omega*s.vx)*h;s.vy+=(omega*omega*(targetY-s.y)-2*damping*omega*s.vy)*h;s.x+=s.vx*h;s.y+=s.vy*h;}
  s.x=clamp(s.x,-4.4,4.4);s.y=clamp(s.y,-2.4,4.9);
 }
 return q;
}
export function warpCloth(u,v,w,h,art,state){
 let x=u,y=v;
 for(let i=0;i<(art.cloth||[]).length;i++){
  const p=art.cloth[i],s=state?.parts?.[i];if(!s)continue;
  const [rx,ry,rw,rh]=p.region,nx=(u/w-rx)/rw,ny=(v/h-ry)/rh;if(nx<=0||nx>=1||ny<=0||ny>=1)continue;
  const ax=p.root[0]*w,ay=p.root[1]*h,dx=(p.tip[0]-p.root[0])*w,dy=(p.tip[1]-p.root[1])*h;
  const along=((u-ax)*dx+(v-ay)*dy)/(dx*dx+dy*dy||1),edge=smooth(0,.12,nx)*(1-smooth(.88,1,nx))*smooth(0,.12,ny)*(1-smooth(.88,1,ny));
  const weight=smooth(0,1,along)*edge,scale=w/136;x+=s.x*weight*scale;y+=s.y*weight*scale;
 }
 return[x,y];
}
export const MOTION_PROFILES={
 rosso:{name:'低伏橫滑',bank:.86,bend:1.17,yaw:1.08,hz:9,damp:.86,compression:1.02},
 vespa:{name:'短促甩尾',bank:1.03,bend:1.32,yaw:1.3,hz:13,damp:.69,compression:.91},
 argento:{name:'柔軟巡航',bank:1.18,bend:.68,yaw:.79,hz:5.2,damp:.94,compression:1.2},
 ballena:{name:'重車後蹲',bank:.79,bend:1.05,yaw:.91,hz:6.3,damp:.81,compression:1.4},
 bamboo:{name:'輕巧跳轉',bank:1.17,bend:.91,yaw:1.17,hz:14,damp:.73,compression:.82},
 blanco:{name:'俐落回正',bank:.96,bend:.88,yaw:1.06,hz:11.7,damp:1.02,compression:.95},
 adler:{name:'後置擺尾',bank:1.01,bend:1.08,yaw:1.43,hz:6.9,damp:.59,compression:1.08},
 raiden:{name:'貼地掠行',bank:.56,bend:1.48,yaw:1.18,hz:15.3,damp:.98,compression:.55},
 arancia:{name:'圓弧搖擺',bank:1.22,bend:.84,yaw:1.04,hz:8.2,damp:.64,compression:.99},
 oro:{name:'長車緩傾',bank:1.16,bend:.62,yaw:.72,hz:4.3,damp:.95,compression:1.35},
};
export const CELEBRATIONS={
 rosso:{driver:'thumb',passenger:'wave',driverReach:.74,passengerReach:.98,pulses:2,phase:0},
 vespa:{driver:'low-fist',passenger:'victory',driverReach:.7,passengerReach:1.08,pulses:3,phase:.3},
 argento:{driver:'nod',passenger:'gentle-wave',driverReach:0,passengerReach:.73,pulses:1,phase:.6},
 ballena:{driver:'thumb',passenger:'pump',driverReach:.92,passengerReach:1.03,pulses:2,phase:.9},
 bamboo:{driver:'nod',passenger:'double-victory',driverReach:0,passengerReach:.92,pulses:2,phase:1.2},
 blanco:{driver:'thumb',passenger:'high-wave',driverReach:.61,passengerReach:1.13,pulses:3,phase:1.5},
 adler:{driver:'salute',passenger:'low-fist',driverReach:.62,passengerReach:.79,pulses:1,phase:1.8},
 raiden:{driver:'victory',passenger:'robot',driverReach:.69,passengerReach:.94,pulses:2,phase:2.1},
 arancia:{driver:'wave',passenger:'dog-perk',driverReach:.73,passengerReach:0,pulses:3,phase:2.4},
 oro:{driver:'thumb',passenger:'bridal-wave',driverReach:.65,passengerReach:.88,pulses:1,phase:2.7},
};
export function vehiclePresentation(spec,pc,physical,previous={}){
 const profile=MOTION_PROFILES[spec.id]||MOTION_PROFILES.rosso,time=pc.visual?.time||0;
 let q=previous;if(q.id!==spec.id||q.source!==pc.visual||time<q.time)q={id:spec.id,source:pc.visual,time,yaw:physical.yaw||0,yawVelocity:0,bank:physical.bank||0,bend:physical.bend||0};
 const dt=clamp(time-q.time,0,.1);q.time=time;
 if(dt){
  const target=clamp((physical.yaw||0)*profile.yaw,-.15,.15),steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps,omega=profile.hz;
  for(let i=0;i<steps;i++){q.yawVelocity+=(omega*omega*(target-q.yaw)-2*profile.damp*omega*q.yawVelocity)*h;q.yaw+=q.yawVelocity*h;}
  q.bank+=(clamp((physical.bank||0)*profile.bank,-.45,.45)-q.bank)*(1-Math.exp(-dt*profile.hz*1.5));
  q.bend+=(clamp((physical.bend||0)*profile.bend,0,.14)-q.bend)*(1-Math.exp(-dt*profile.hz*1.7));
 }
 return{state:q,pose:{...physical,bank:q.bank,bend:q.bend,yaw:q.yaw,compression:(physical.compression||0)*profile.compression,lift:physical.lift||0,profile:profile.name}};
}
export function crewAction(spec,pc,cheer,inertia={}){
 const profile=CELEBRATIONS[spec.id]||CELEBRATIONS.rosso;
 const safe=cheer&&!pc.crash&&!pc.drift&&!pc.offroad&&Math.abs(pc.steerIn||0)<.5;
 const u=safe?clamp(cheer.t/Math.max(.1,cheer.dur),0,1):0,envelope=safe?Math.sin(Math.PI*u)**.8:0;
 return{profile,active:!!safe,u,envelope,time:pc.visual?.time||0,
  headX:clamp(inertia.x||0,-8,8)*.15,headY:clamp(inertia.y||0,-3,3)*.35,
  driver:envelope*Math.max(0,1-u*1.8),passenger:envelope,
 };
}
export function warpCrew(u,v,w,h,action,art){
 const regions=art.crewRegions||[[.29,.02,.16,.29],[.57,.02,.2,.32]],anchors=art.crewAnchors||[[.37,.14,.37,.28],[.67,.15,.67,.3]];
 let x=u,y=v;
 for(let i=0;i<2;i++){
  const [rx,ry,rw,rh]=regions[i],nx=(u/w-(rx+rw*.5))/(rw*.5),ny=(v/h-(ry+rh*.5))/(rh*.5),weight=Math.max(0,1-nx*nx)*Math.max(0,1-ny*ny);
  if(!weight)continue;const strength=i?action.passenger:action.driver,p=action.profile;
  const nod=(i===0&&p.driver==='nod'?Math.sin(action.u*Math.PI*4)*1.3:0),dog=i===1&&p.passenger==='dog-perk';
  x+=(action.headX+(dog?Math.sin(action.u*Math.PI*6)*strength:Math.sin(action.u*Math.PI*3+p.phase)*strength*.45))*weight;
  y+=(action.headY+nod*strength-(dog?Math.sin(action.u*Math.PI*3)**2*strength*2:strength*.65))*weight;
 }
 return[x,y,anchors];
}

function shade(hex,factor){const n=typeof hex==='number'?hex:parseInt(String(hex).replace('#',''),16);return'#'+[16,8,0].map(s=>Math.round(clamp(((n>>s)&255)*factor,0,255)).toString(16).padStart(2,'0')).join('');}
function polygon(g,points,color){g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.closePath();g.fill();}
function segment(g,a,b,r,color){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
 const quad=width=>[[a[0]+nx*width,a[1]+ny*width],[b[0]+nx*width,b[1]+ny*width],[b[0]-nx*width,b[1]-ny*width],[a[0]-nx*width,a[1]-ny*width]];
 polygon(g,quad(r+1),'#171327');polygon(g,quad(r),shade(color,.72));polygon(g,[[a[0]-nx*r,a[1]-ny*r],[b[0]-nx*r,b[1]-ny*r],[b[0],b[1]],[a[0],a[1]]],shade(color,1));
}
export function drawCrewGestures(g,{spec,crew,art,w,h,action,project}){
 if(!action.active||action.envelope<.03)return[];
 const anchors=art.crewAnchors||[[.37,.14,.37,.28],[.67,.15,.67,.3]],drawn=[];
 const hand=(person,side,kind,strength,reach)=>{
  if(!strength||kind==='nod'||kind==='dog-perk'||person.dog)return;
  const index=person===crew[0]?0:1,a=anchors[index],pair=art.crewShoulders?.[index],head=[a[0]*w,a[1]*h],shoulder=pair?[(side<0?pair[0]:pair[2])*w,(side<0?pair[1]:pair[3])*h]:[a[2]*w+side*w*.035,a[3]*h],size=w/136;
  const wave=/wave/.test(kind)?Math.sin(action.u*Math.PI*2*action.profile.pulses)*2.1*size*strength:0;
  const pump=kind==='pump'?Math.sin(action.u*Math.PI*4)*2*size:0;
  let elbow=[shoulder[0]+side*8*size*strength,shoulder[1]-5*size*strength],tip=[head[0]+side*(9*size+wave)*strength,shoulder[1]-19*size*strength*reach+pump];
  if(kind==='low-fist'){elbow[1]+=3*size;tip[1]+=7*size;}
  if(kind==='salute'){tip=[head[0]+side*5*size,head[1]+2*size];}
  if(kind==='robot'){elbow=[shoulder[0]+side*9*size*strength,shoulder[1]];tip=[elbow[0],elbow[1]-13*size*strength];}
  const s=project(...shoulder),e=project(...elbow),t=project(...tip),skin=person.skin||0xf2c8a0,shirt=person.shirt||0xffffff;
  segment(g,s,e,2.2*size,shirt);segment(g,e,t,1.6*size,skin);
  const r=Math.max(2,Math.round(size*2));g.fillStyle='#171327';g.fillRect(Math.round(t[0]-r-1),Math.round(t[1]-r-1),r*2+2,r*2+2);g.fillStyle=shade(skin,.85);g.fillRect(Math.round(t[0]-r),Math.round(t[1]-r),r*2,r*2);g.fillStyle=shade(skin,1.1);g.fillRect(Math.round(t[0]-r),Math.round(t[1]-r),r*2,Math.max(1,r));
  if(kind==='thumb'){segment(g,[t[0]-side*r*.4,t[1]],[t[0]-side*r*.4,t[1]-4*size],Math.max(.7,size*.7),skin);}
  else if(kind.includes('victory')){for(const sign of[-1,1])segment(g,[t[0]+sign*size,t[1]-size],[t[0]+sign*2*size,t[1]-5*size],Math.max(.6,size*.6),skin);}
  else if(/wave/.test(kind)){for(let f=-1;f<=1;f++)segment(g,[t[0]+f*1.4*size,t[1]],[t[0]+f*1.8*size+wave*.25,t[1]-(4-Math.abs(f))*size],Math.max(.5,size*.5),skin);}
  drawn.push({who:index,kind});
 };
 for(let i=0;i<crew.length&&i<2;i++){
  const p=action.profile,kind=i?p.passenger:p.driver,strength=i?action.passenger:action.driver;
  hand(crew[i],i?1:-1,kind,strength,i?p.passengerReach:p.driverReach);
  if(i===1&&kind==='double-victory')hand(crew[i],-1,'victory',strength,p.passengerReach*.9);
 }
 return drawn;
}
