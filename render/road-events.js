/* Anticipated roadside encounters. Distances/velocities are world metres and
 * m/s. This is fictional arcade staging, not a claim that a real farm lets its
 * livestock roam a public highway. Every new/moving body uses the shared
 * continuous free-corridor planner. */
(function(global){
 'use strict';
 const sources=[
  'https://www.zoo.gov.tw/Formosanwildboar/boar.html',
  'https://chiayi.forest.gov.tw/news/0073155',
  'https://www.beinan.gov.tw/portfolio-item/%E5%88%9D%E9%B9%BF%E7%89%A7%E5%A0%B4/'
 ];
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function configure(p){
  if(p.roadEvents)return p.roadEvents;
  const list=[];
  p.secs.forEach((sec,i)=>{const a=p.secStartS[i],b=i+1<p.secs.length?p.secStartS[i+1]:p.L,tags=sec.tags||[];
   if(sec.track||sec.bridge||sec.fork||b-a<300)return;
   // Chulu lies on the Taitung-to-Luye valley route. Only its farm access segment.
   if(p.id==='s4c'&&tags.includes('balloons'))list.push({kind:'cow',s:a+150,side:1,label:'縱谷牧場通道',done:false});
   // Low foothill tea/woodland approach, before the high Alishan cypress forest.
   if(p.id==='s3m'&&sec.L==='tea'&&sec.R==='hills')list.push({kind:'boar',s:a+(b-a)*.56,side:1,label:'嘉義淺山',done:false});
   if(tags.includes('promenade')||tags.includes('nightmarket'))list.push({kind:'escooter',s:a+(b-a)*.64,side:1,label:'沿街慢行',done:false});
   if(tags.some(t=>t.startsWith('parade_'))&&!list.some(q=>q.kind==='float'))list.push({kind:'float',s:a+(b-a)*.62,side:-1,label:'廟會電子花車',done:false});
  });
  p.roadEvents=list;return list;
 }
 function reset(api){for(const p of api.ROUTE.pieces)for(const q of configure(p))q.done=false;api.TRAFFIC.cargoNext=0;}
 function frame(api,kind,t){if(kind==='escooter')return api.SPR.event_escooter_rear?'event_escooter_rear':null;if(api.SPR['event_'+kind])return 'event_'+kind;for(let n=4;n>=1;n--)if(api.SPR['event_'+kind+'#'+(n-1)])return 'event_'+kind+'#'+(Math.floor(t*6)%n);return null;}
 function spawnGroup(api,q){
  if(!frame(api,q.kind,0))return false;
  const p=api.PC.piece,edge=api.edges(p,q.s);
  if(q.kind==='escooter'||q.kind==='float'){const float=q.kind==='float',h={eventKind:q.kind,p,s:q.s,x:float?edge[0]+1.65:edge[1]-1.1,baseX:float?edge[0]+1.65:edge[1]-1.1,v:float?1.3:6,len:float?8:1.8,wid:float?2.5:.8,massKg:float?6000:95,t:0,y:0,vy:0,vx:0,hit:0};const ok=api.spawn(h);if(ok)api.hud(float?'前方電子花車':'前方電動滑板車',float?'廟會慢行，依空隙繞過':'保持側向距離，平順超越','#ffdf79',3,false);q.spawned=ok?1:0;return !!ok;}
  const cow=q.kind==='cow',ports=q.crossings||(p.roadCrossings?[]:Array.from({length:4},(_,i)=>({s:q.s+i*14})));let added=0;
  for(let i=0;i<ports.length;i++){
   const port=ports[i],e=api.edges(p,port.s),from=q.side<0?e[0]-2.2:e[1]+2.2,to=q.side<0?e[1]+2.8:e[0]-2.8;
   const h={eventKind:q.kind,p,s:port.s,crossing:port,x:from,to,dir:-q.side,speed:cow?1.45:2.6,warning:2.7+i*1.45,t:0,y:0,vy:0,v:0,vx:0,len:cow?1.05:.65,wid:cow?1.8:1.25,massKg:cow?560:85,hit:0,contactVx:0,retreat:false};
   if(api.spawn(h))added++;
  }
  if(added)api.hud(cow?'前方牛群通行':'前方山豬群',q.label+'・減速看空隙，勿逼近動物','#ffe175',4,false);
  q.spawned=added;return added>0;
 }
 function cargoKind(v){return v.type==='pickup'?'bale':v.type==='flatbed'?'barrel':'crate';}
 function cargoBody(v,s=v.s,x=v.x){
  const kind=cargoKind(v);return{eventKind:'cargo',cargoKind:kind,spr:'event_'+kind,p:v.p,s:s-v.len/2-1.1,x,y:1.3,vy:.5,v:Math.max(0,v.v),vx:x>0?.55:-.55,len:kind==='bale'?1.3:.85,wid:kind==='bale'?1.1:.8,massKg:kind==='bale'?60:kind==='barrel'?45:25,t:0,roll:0,spin:kind==='barrel'?2.5:1.7,hit:0,bounces:0};
 }
 function forecastCargo(api,v){
  if(v.cargoWarnAt==null||v.cargoDropped)return null;
  const delay=Math.max(0,2.4-(api.G.t-v.cargoWarnAt)),speed=Math.max(0,v.v);
  const shiftTime=v.lc?Math.max(0,delay-Math.max(0,v.lc.wait-(v.sigT||0))):0;
  const rate=['semi','flatbed'].includes(v.type)?.75:2.2;
  const x=v.lc?v.x+(v.lc.x-v.x)*(1-Math.exp(-rate*shiftTime)):v.x;
  const h=cargoBody(v,v.s+speed*delay,x),halfWidth=h.wid/2+api.width()/2+.2,points=[];
  // Cover both the current tailgate and its moving release position. The
  // forecast is refreshed each frame, so braking or a cancelled lane change
  // changes the ground trace instead of leaving a stale target on the road.
  // The short approach margin is the space the player's centre must avoid,
  // including its own half-width; it remains one narrow lane, not road-wide.
  points.push({s:v.s-v.len/2-1.1-18,x:v.x});points.push({s:h.s,x:h.x});
  let impact=null;const move=(o,s,x)=>{o.s=s;o.x=x;return true;};
  for(let n=0;n<3600;n++){
   cargoStep(h,1/60,move);
   if(!impact&&h.bounces>0)impact={s:h.s,x:h.x};
   if(n%12===0||h.v===0&&h.y===0)points.push({s:h.s,x:h.x});
   if(h.v===0&&h.y===0)break;
  }
  const last=points[points.length-1];points.push({s:last.s+1.5,x:last.x});
  return{p:v.p,kind:h.cargoKind,points,s0:points[0].s,s1:points[points.length-1].s,halfWidth,impact,remaining:delay};
 }
 function warningSlice(w,s){
  if(!w||s<w.s0||s>w.s1)return null;
  const points=w.points;let low=0,high=points.length-1;
  while(high-low>1){const mid=(low+high)>>1;if(points[mid].s<=s)low=mid;else high=mid;}
  const a=points[low],b=points[high],t=clamp((s-a.s)/Math.max(.0001,b.s-a.s),0,1),x=a.x+(b.x-a.x)*t;
  return{left:x-w.halfWidth,right:x+w.halfWidth,x};
 }
 function warnings(api){
  const list=[];for(const v of api.TRAFFIC.list)if(v.p===api.PC.piece&&v.cargoWarnAt!=null&&!v.cargoDropped){const w=v.cargoForecast||forecastCargo(api,v);if(w)list.push(w);}
  // A brief handover lets the actual falling object replace its forecast
  // without the road cue blinking off at the instant of release.
  for(const h of api.HAZ.list)if(h.eventKind==='cargo'&&h.warningTrace&&h.t<1)list.push(h.warningTrace);
  return list;
 }
 function update(api,dt){
  const p=api.PC.piece;
  for(const q of configure(p)){const d=q.s-api.PC.s;if(!q.done&&d<430&&d>220&&frame(api,q.kind,0)){q.done=spawnGroup(api,q);}else if(d<=220)q.done=true;}
  const clock=api.G.t;
  for(const v of api.TRAFFIC.list){
   if(v.p!==p||v.train||v.cargoDropped)continue;
   if(v.cargoWarnAt!=null){
    v.cargoForecast=forecastCargo(api,v);
    if(clock-v.cargoWarnAt<2.4)continue;
    const kind=cargoKind(v),name='event_'+kind;if(!api.SPR[name])continue;
    const h=cargoBody(v);h.warningTrace=v.cargoForecast;
    // Never drop directly into a car that has already reached the tailgate.
    if(h.s-api.PC.s>45&&api.spawn(h))v.cargoDropped=true;
    else v.cargoDropped=true; // a rejected drop is cancelled, not spawned invisibly elsewhere
    continue;
   }
   if(clock<(api.TRAFFIC.cargoNext||0)||!['bluetruck','pickup','semi','flatbed'].includes(v.type))continue;
   const d=v.s-api.PC.s,kind=cargoKind(v);
   if(d>240&&d<410&&api.SPR['event_'+kind]){v.cargoWarnAt=clock;v.cargoForecast=forecastCargo(api,v);api.TRAFFIC.cargoNext=clock+24;}
  }
 }
 function cargoStep(h,dt,move){
  h.vy-=9.81*dt;let y=h.y+h.vy*dt;
  if(y<=0){y=0;if(h.vy<-.8){h.vy=-h.vy*.27;h.bounces++;}else h.vy=0;
   const decel=(h.cargoKind==='barrel'?1.5:4.2)*dt;h.v=Math.max(0,h.v-decel);h.vx*=Math.exp(-dt*3);h.spin*=Math.exp(-dt*1.5);
  }
  const proposedS=h.s+h.v*dt,proposedX=h.x+h.vx*dt;
  if(!move(h,proposedS,proposedX)){h.v=0;h.vx=0;}
  h.y=y;h.roll+=h.spin*dt;
  return h;
 }
 function crossMove(api,h,s,x){
  if(api.move(h,s,x))return true;
  if(!api.corridor||h.t<(h.retryAt||0))return false;
  h.retryAt=h.t+.12;
  // A retained path is conservative: a walking animal may need it to move to
  // the other side. Test the entire proposed scene before exchanging the path,
  // never omit the crossing actor from occupancy or simply force it through.
  const oldS=h.s,oldX=h.x;h.s=s;h.x=x;
  const safe=api.corridor(h.p,Math.max(0,api.PC.s-40),Math.min(h.p.L,api.PC.s+840));
  if(safe){api.refresh(h.p,true);return true;}
  h.s=oldS;h.x=oldX;return false;
 }
 function step(api,h,dt){
  if(!h.eventKind)return null;
  if(h.p!==api.PC.piece||h.s<api.PC.s-45||h.s>h.p.L-12)return false;
  if(h.eventKind==='cargo')cargoStep(h,dt,api.move);
  else if(h.eventKind==='escooter'||h.eventKind==='float'){api.move(h,h.s+h.v*dt,h.baseX+(h.eventKind==='escooter'?Math.sin(h.t*1.1)*.18:0));}
  else {
   if(h.t<h.warning)return true;
   const oldX=h.x;crossMove(api,h,h.s,h.x+h.dir*h.speed*dt);h.contactVx=dt>0?(h.x-oldX)/dt:0;
   if(h.dir>0?h.x>h.to:h.x<h.to)return false;
  }
  if(h.y<.7&&Math.abs(h.s-api.PC.s)<(api.length()+h.len)/2&&Math.abs(h.x-api.PC.x)<(api.width()+h.wid)/2){
   api.contact(h);
   if(['boar','cow'].includes(h.eventKind)&&!h.retreat){const e=api.edges(h.p,h.s),side=h.x<(e[0]+e[1])/2?-1:1;h.dir=side;h.to=side<0?e[0]-4:e[1]+4;h.speed=4;h.retreat=true;api.hud('讓動物回到路旁','收油繞開，保持距離','#ffdd85',2,false);}
  }
  if(h.hitT>0)h.hitT=Math.max(0,h.hitT-dt);
  return true;
 }
 function sprite(api,h){return h.eventKind==='cargo'?h.spr:frame(api,h.eventKind,h.t);}
 global.FormosaRoadEvents={sources,configure,reset,update,step,sprite,spawnGroup,cargoStep,cargoBody,forecastCargo,warningSlice,warnings,crossMove};
})(window);
