/* Real generated fence openings, actor trajectories and car containment. */
const fs=require('node:fs'),path=require('node:path'),{createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/full-qa-20261024/gameplay/crossing-passages'));fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],missing:[]};
(async()=>{const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FormosaWorldLife?.state.ready,null,{timeout:90000});
Object.assign(report,await page.evaluate(()=>{
 const k=__kr,B=FormosaRoadBoundary,E=FormosaRoadEvents,checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);
 const ports=k.ROUTE.pieces.flatMap(p=>(p.roadCrossings||[]).map(q=>({p,q}))),issues=[];
 for(const {p,q} of ports){
  if(!B.safePassage(p,q.s))issues.push({p:p.id,s:q.s,reason:'unsafe terrain'});
  for(const sg of [-1,1]){
   const walls=p.walls.filter(w=>w.sg===sg&&w.off>=0&&w.off<.5&&w.h>.6);
   if(walls.some(w=>w.s0<q.s+q.width/2-.001&&w.s1>q.s-q.width/2+.001))issues.push({p:p.id,s:q.s,sg,reason:'solid face across opening'});
   const posts=walls.filter(w=>w.h>=1&&Math.abs((w.s0+w.s1)/2-q.s)<q.width/2+.2);
   if(posts.length<2)issues.push({p:p.id,s:q.s,sg,reason:'missing end posts'});
  }
 }
 check('All authored crossing openings have dry approaches and two visible end posts on both sides',ports.length>0&&!issues.length,{count:ports.length,issues});
 const smallest=Math.min(...k.CARS.map(c=>c.W));check('A passage is narrower than every car, including when the car turns sideways',ports.every(({q})=>q.width<smallest),{opening:B.passageWidth,smallestCarWidth:smallest});
 const animal=ports.filter(o=>['cow','boar','bear'].includes(o.q.kind));check('Four cows, four boars and both forest bear encounters have separate prebuilt access lanes',animal.filter(o=>o.q.kind==='cow').length===4&&animal.filter(o=>o.q.kind==='boar').length===4&&animal.filter(o=>o.q.kind==='bear').length===2,animal.map(({p,q})=>({id:p.id,...q})));
 function reset(p,s){k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);k.go(k.ROUTE.pieces.indexOf(p),s,0);k.PC.v=0;k.TRAFFIC.list.length=0;k.TRAFFIC.safetyPlan=null;k.HAZ.list.length=0;k.HAZ.nextS=1e9;k.CTL.keys={};k.CTL.touches.clear();k.RACE.time=95;for(const pp of k.ROUTE.pieces){for(const q of pp.parades||[])q.done=true;for(const q of pp.wildlifeZones||[])q.done=true;for(const q of E.configure(pp))q.done=true;}}
 const traces=[];
 function watch(group,api,seconds,useHazards){let blocked=0,edgeSamples=0,corridor=true;const starts=group.map(h=>h.x);
  for(let n=0;n<seconds*60;n++){
   k.G.t+=1/60;if(useHazards)k.hazardsUpdate(1/60);else for(const h of [...k.HAZ.list]){h.t+=1/60;if(!E.step(api,h,1/60))k.HAZ.list.splice(k.HAZ.list.indexOf(h),1);}
   for(const h of group)for(const sg of [-1,1]){const e=(sg<0?h.p.leftEdge(h.s):h.p.rightEdge(h.s))+sg*.2;if(Math.abs(h.x-e)>(h.wid||.65)/2+.1)continue;edgeSamples++;if(!h.crossing||Math.abs(h.s-h.crossing.s)+(h.len||.7)/2>h.crossing.width/2+.001)blocked++;if(h.p.walls.some(w=>w.sg===sg&&w.off>=0&&w.off<.5&&w.h>.6&&w.s0<h.s+(h.len||.7)/2-.001&&w.s1>h.s-(h.len||.7)/2+.001))blocked++;}
   if(n%30===0)corridor&&=k.trafficCorridorOpen(k.PC.piece,k.PC.s-12,k.PC.s+800);
  }
  const cleared=group.every(h=>h.dir>0?h.x>=h.to:h.x<=h.to);return{count:group.length,edgeSamples,blocked,corridor,cleared,starts,ends:group.map(h=>h.x)};
 }
 for(const kind of ['cow','boar']){const p=k.ROUTE.pieces.find(p=>E.configure(p).some(q=>q.kind===kind)),q=E.configure(p).find(q=>q.kind===kind);reset(p,q.s-400);q.done=false;E.update(k.roadEventsApi(),1/60);const group=[...k.HAZ.list],trace=watch(group,k.roadEventsApi(),40,false);traces.push({kind,...trace});check(kind+' group crosses through its own openings, clears the road and leaves a car-wide corridor',trace.count===4&&trace.edgeSamples>0&&!trace.blocked&&trace.corridor&&trace.cleared,trace);}
 const bp=k.ROUTE.pieces.find(p=>(p.wildlifeZones||[]).some(q=>q.crossing));for(const bq of bp.wildlifeZones.filter(q=>q.crossing)){reset(bp,bq.crossing.s-320);bq.done=false;k.wildlifeUpdate();const bears=k.HAZ.list.filter(h=>h.bear),bt=watch(bears,k.roadEventsApi(),40,true);traces.push({kind:'bear',s:bq.crossing.s,...bt});check('Actual bear encounter at '+bq.crossing.s+' uses a real forest opening on entry and exit',bt.count===1&&bt.edgeSamples>0&&!bt.blocked&&bt.corridor&&bt.cleared,bt);}
 // Exercise the real random-spawn code at one pedestrian portal per route.
 const pedestrian=[];
 for(const p of k.ROUTE.pieces){const port=(p.roadCrossings||[]).find(q=>q.kind==='pedestrian'&&q.s>350);if(!port)continue;reset(p,port.s-200);k.HAZ.nextS=0;const original=Math.random;Math.random=()=>.8;try{k.hazardsUpdate(1/60);}finally{Math.random=original;}k.HAZ.nextS=1e9;const group=k.HAZ.list.filter(h=>h.crossing&&!h.bear&&!h.eventKind);if(!group.length){pedestrian.push({id:p.id,count:0});continue;}const t=watch(group,k.roadEventsApi(),40,true);pedestrian.push({id:p.id,...t});}
 check('Runtime pedestrian spawns are snapped to valid portals and do not clip the barrier',pedestrian.length>0&&pedestrian.every(t=>t.count===1&&t.edgeSamples>0&&!t.blocked&&t.corridor&&t.cleared),pedestrian);
 const scooterPiece=k.ROUTE.pieces.find(p=>(p.roadCrossings||[]).some(q=>q.kind==='pedestrian'&&q.s>350)),scooterPort=scooterPiece.roadCrossings.find(q=>q.kind==='pedestrian'&&q.s>350);reset(scooterPiece,scooterPort.s-200);k.HAZ.nextS=0;let randomCall=0;const originalRandom=Math.random;Math.random=()=>++randomCall===6?.2:.8;try{k.hazardsUpdate(1/60);}finally{Math.random=originalRandom;}k.HAZ.nextS=1e9;const scooters=k.HAZ.list.filter(h=>h.crossing&&h.scoot),scooterTrace=watch(scooters,k.roadEventsApi(),40,true);check('A sideways scooter uses its actual narrow depth and crosses through the portal',scooterTrace.count===1&&scooterTrace.edgeSamples>0&&!scooterTrace.blocked&&scooterTrace.corridor&&scooterTrace.cleared,scooterTrace);
 // Car containment at every opening, at both lips and the centre. No portal
 // exemption is installed in the player collision resolver.
 let samples=0,maxPen=0;for(const {p,q} of ports)for(const sg of [-1,1])for(const ds of [-.6,0,.6])for(const c of k.CARS){const s=q.s+ds,b=B.at(p,s,sg),half=Math.max(1.5,c.W)/2,limit=B.limit(p,s,b,half),body={s,x:limit+sg*.8,vx:sg*12,v:50};B.constrain(p,body,{s:s-.8,x:limit-sg*.1},half);maxPen=Math.max(maxPen,(body.x-limit)*sg);samples++;}
 check('All ten car footprints remain blocked at every narrow access opening at 50m/s',samples>0&&maxPen<1e-6,{samples,maxPen});
 return{checks,traces,pedestrian,ports:ports.map(({p,q})=>({id:p.id,...q}))};
}));
for(const kind of ['cow','boar','bear','pedestrian']){
 const fixture=await page.evaluate(kind=>{const k=__kr,E=FormosaRoadEvents,p=k.ROUTE.pieces.find(p=>(p.roadCrossings||[]).some(q=>q.kind===kind)),port=p?.roadCrossings.find(q=>q.kind===kind);if(!port)return null;k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);k.TRAFFIC.list.length=0;k.HAZ.list.length=0;k.HAZ.nextS=1e9;k.go(k.ROUTE.pieces.indexOf(p),port.s-400,0);k.PC.v=0;k.TRAFFIC.safetyPlan=null;const e=k.roadLimits(p,port.s);if(['cow','boar'].includes(kind)){const q=E.configure(p).find(q=>q.kind===kind);E.spawnGroup(k.roadEventsApi(),q);for(const h of k.HAZ.list)h.x=k.roadLimits(p,h.s)[1]+.2;}
 else k.HAZ.list.push({p,s:port.s,crossing:port,x:e[1]+.2,to:e[0]-2.8,dir:-1,v:1.7,bear:kind==='bear',kind:1,len:kind==='bear'?1.15:.7,wid:kind==='bear'?1.7:.65,t:4,warning:0,hit:0,y:0,vy:0,vx:0});k.go(k.ROUTE.pieces.indexOf(p),port.s-16,0);k.PC.v=0;k.step(0);return{id:p.id,s:port.s,kind};},kind);
 if(fixture){(report.screenshots||=[]).push(fixture);await page.screenshot({path:path.join(out,kind+'-passage.png')});}
}
report.pass=report.checks.every(c=>c.pass)&&!report.errors.length&&!report.missing.length;
}catch(e){report.pass=false;report.failure=String(e.stack||e);}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'crossing-passages-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.map(c=>({name:c.name,pass:c.pass,detail:c.pass?undefined:c.detail})),ports:report.ports?.length,errors:report.errors,missing:report.missing,failure:report.failure},null,2));if(!report.pass)process.exitCode=1;}})();
