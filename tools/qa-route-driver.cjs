// A test driver, never loaded by the game. It observes the shipped road and
// traffic, then sends ordinary throttle/brake keys and analogue touch steering.
// It never writes car position, velocity, gear, collision state or the timer.
module.exports=function installRouteDriver(){
 const k=window.__kr,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const D=window.__qaRouteDriver={plan:[],nextPlan:0,piece:null,failPlans:0,inputs:0};
 function plan(){
  const p=k.PC.piece,s=k.PC.s,to=Math.min(p.L,s+330),rows=[s,to];
  for(let x=s+12;x<to;x+=12)rows.push(x);
  const mark=(s,len)=>{for(const x of [s-len/2-k.playerLength()/2-.1,s,s+len/2+k.playerLength()/2+.1])if(x>k.PC.s&&x<to)rows.push(x);};
  for(const o of k.TRAFFIC.list)if(o.p===p)mark(o.s,o.len||4.5);
  for(const o of k.HAZ.list)if(o.p===p&&!o.smoke&&!o.hit)mark(o.s,o.len||(o.rider||o.scoot?1.9:.7));
  for(const o of p.colliders||[])if(o.s1>s&&o.s0<to){const mid=(o.s0+o.s1)/2,edge=k.roadLimits(p,mid);if(o.x1+.7>=edge[0]&&o.x0-.7<=edge[1])mark(mid,o.s1-o.s0);}
  rows.sort((a,b)=>a-b);
  let reach=k.trafficFree(p,s),hist=[];
  if(!reach.length)return null;
  // Begin in the actual reachable gap, rather than selecting an unrelated
  // opening on the far side of a lorry. A contact can leave a tiny overlap.
  reach.sort((a,b)=>Math.abs(clamp(k.PC.x,a[0],a[1])-k.PC.x)-Math.abs(clamp(k.PC.x,b[0],b[1])-k.PC.x));
  const first=reach[0],initial=clamp(k.PC.x,first[0],first[1]);reach=[[initial,initial]];
  hist.push({s,free:reach});
  for(let i=1;i<rows.length;i++){
   const ds=rows[i]-hist[hist.length-1].s;if(ds<.02)continue;
   const next=[];
   for(const a of reach)for(const b of k.trafficFree(p,rows[i])){const lo=Math.max(a[0]-ds*.12,b[0]),hi=Math.min(a[1]+ds*.12,b[1]);if(hi>=lo)next.push([lo,hi]);}
   if(!next.length)break;
   next.sort((a,b)=>a[0]-b[0]);reach=[];for(const a of next){const z=reach[reach.length-1];if(z&&a[0]<=z[1])z[1]=Math.max(z[1],a[1]);else reach.push(a);}
   hist.push({s:rows[i],free:reach});
  }
  if(hist.length<2)return null;
  let desired=clamp(k.PC.x,-p.hw(to)+1.6,p.hw(to)-1.6);
  if(p.children.length&&p.L-s<600){const side=D.forks[k.RACE.route.length-1]==='L'?0:1;desired=p.forkOff[side]+1.85;}
  let nx=desired,ns=hist[hist.length-1].s,out=[];
  for(let i=hist.length-1;i>=0;i--){const row=hist[i],dx=i===hist.length-1?Infinity:(ns-row.s)*.12;let best=null,cost=Infinity;
   for(const a of row.free){const lo=Math.max(a[0],nx-dx),hi=Math.min(a[1],nx+dx);if(hi<lo)continue;const pad=Math.min(.18,(hi-lo)/4),x=clamp(nx,lo+pad,hi-pad),c=Math.abs(x-nx);if(c<cost){best=x;cost=c;}}
   if(best==null)return null;out.push({s:row.s,x:best});nx=best;ns=row.s;
  }
  return out.reverse();
 }
 function target(s){const p=D.plan;for(let i=1;i<p.length;i++)if(p[i].s>=s){const a=p[i-1],b=p[i],t=clamp((s-a.s)/(b.s-a.s),0,1);return a.x+(b.x-a.x)*t;}return p.length?p[p.length-1].x:0;}
 D.step=function(simulate=true){
  const pc=k.PC,p=pc.piece,s=pc.s,v=pc.v,sp=pc.spec;
  if(D.piece!==p||k.G.t>=D.nextPlan){const next=plan();if(next){D.plan=next;D.piece=p;}else D.failPlans++;D.nextPlan=k.G.t+.2;}
  let safe=sp.top/3.6;
  for(let d=0;d<Math.max(140,v*3);d+=8){const curve=Math.abs(p.curv(Math.min(p.L,s+d))),hold=curve>1e-6?Math.sqrt((11+5*sp.grip)/curve)*.92:999;safe=Math.min(safe,Math.sqrt(hold*hold+2*21*Math.max(0,d-16)/k.WORLD_K));}
  const ahead=clamp(v*.45,5,28),xt=target(s+ahead),delta=xt-pc.x;
  // Slow enough to execute the planned lateral displacement with the same
  // tyre authority as a human. At a tight stationary gap, creep and steer.
  for(let d=12;d<Math.max(80,v*1.5);d+=12){const a=target(s+d-12),b=target(s+d),slope=Math.abs(b-a)/12;if(slope>.035){const limit=6.8/(slope*k.WORLD_K);safe=Math.min(safe,Math.sqrt(limit*limit+2*18*Math.max(0,d-24)/k.WORLD_K));}}
  const nearest=D.plan[D.plan.length-1];if(nearest&&nearest.s<s+45&&nearest.s<p.L-1)safe=Math.min(safe,Math.sqrt(2*14*Math.max(1,nearest.s-s-5)/k.WORLD_K));
  const cc=.34-.12*sp.grip,cent=p.curv(s)*v*v*cc,lim=(11+5*sp.grip)*cc,fade=.35+.65*Math.sqrt(clamp(1-Math.abs(cent)/lim,0,1));
  const auth=(6.6+4.2*sp.steer)*1.05*clamp(v/20,0,1),desiredV=clamp(delta*3.4-pc.vx*.15,-8,8);
  let force=desiredV+cent-(pc.wind||0);if(force*cent>0)force/=fade;
  const steer=clamp(force/Math.max(.15,auth),-1,1);
  k.CTL.touches.set(-99,{kind:'steer',ox:0,x:steer*Math.max(44,innerWidth*.07)});
  k.CTL.keys.KeyZ=v<safe-.3;k.CTL.keys.KeyX=v>safe+1.3;
  if(v<2){k.CTL.keys.KeyZ=true;k.CTL.keys.KeyX=false;}
  D.last={safe,xt,steer,planLength:D.plan.length,planEnd:nearest?.s,failPlans:D.failPlans};D.inputs++;
  if(simulate)k.sim(1/60,1/60);
 };
 D.drive=function(sec){for(let i=0;i<sec*60;i++){D.step();if(k.RACE.state==='goal'||k.RACE.state==='timeup')break;}return {...k.state(),route:[...k.RACE.route],driver:D.last,finite:['s','x','v','vx','rpm','yaw','roll'].every(f=>Number.isFinite(k.PC[f]))};};
 return true;
};
