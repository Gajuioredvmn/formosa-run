// World-space scenery and authored event verification in the actual browser.
const fs=require('node:fs'),path=require('node:path'),{createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-world-'+Date.now()));fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],missing:[]};
(async()=>{const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});});
await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FormosaWorldLife?.state.ready,null,{timeout:90000});
const data=await page.evaluate(()=>{const k=__kr,w=FormosaWorldLife;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.show(null);k.bot(false);
const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
check('World art/geometry module boots',w.state.ready,w.state.warnings);
const pieces=k.ROUTE.pieces,meshes=pieces.flatMap(p=>(p.landmarkMeshes||[]).filter(m=>m.kind==='metroEntrance').map(m=>({p,m})));
check('Metro has real roof, stairs and pillars',meshes.length>0&&meshes.every(({m})=>m.faces.length>70&&m.lines.length>20&&new Set(m.faces.flatMap(f=>f.points.map(p=>p[2]))).size>10),meshes.map(({p,m})=>({piece:p.id,faces:m.faces.length,minOff:m.minOff,maxOff:m.maxOff})));
check('Metro stays outside roadway and light rail',meshes.every(({p,m})=>m.minOff>((p.sec(m.s).tags||[]).includes('lightrail')?15.5:3)),meshes.map(({m})=>m.minOff));
const pedestrians=pieces.flatMap(p=>p.anim.filter(a=>a.kind==='walker'));
check('Sidewalk walkers move in bounded world positions',pedestrians.length>100&&pedestrians.every(a=>{const f=w.walkerFrame(a,0),g=w.walkerFrame(a,2);return Math.abs(f.s-g.s)>.01&&f.s>=a.s0&&g.s<=a.s1;}),pedestrians.length);
check('Palm foliage responds to wind without base translation',Math.abs(w.wind({ph:1,sway:1},1)-w.wind({ph:1,sway:1},3))>.001);
check('Every branch has three authored overtaking passages',pieces.every(p=>(p.challengeZones||[]).length===3),pieces.map(p=>({id:p.id,zones:p.challengeZones?.length})));
const bears=pieces.filter(p=>p.wildlifeZones?.length);check('Bear encounters restricted to documented Alishan forest habitat',bears.length>0&&bears.every(p=>p.id==='s3m'),bears.map(p=>({id:p.id,count:p.wildlifeZones.length})));
const corridors=[];for(const [pi,p] of pieces.entries()){for(const q of p.challengeZones||[]){k.go(pi,Math.max(0,q.s-400),0);k.TRAFFIC.list=[];k.TRAFFIC.safetyPlan=null;k.HAZ.list=[];q.done=false;k.RACE.state='run';k.PC.v=0;k.sim(1/60);corridors.push({piece:p.id,s:q.s,spawned:q.spawned||0,open:k.trafficCorridorOpen(p,Math.max(0,k.PC.s-12),Math.min(p.L,k.PC.s+810))});}}
check('All authored passages retain a connected car-width corridor',corridors.every(c=>c.open),corridors);check('Every authored passage supplies actual road traffic',corridors.every(c=>c.spawned>0));
// Exercise the real encounter state machine even while optional art is absent;
// restoration below prevents the sentinel frame count entering a screenshot.
const frameCount=w.state.bearFrames;w.state.bearFrames=frameCount||1;
const forest=bears[0],zone=forest.wildlifeZones[0];k.go(pieces.indexOf(forest),zone.s-330,0);k.PC.v=0;k.TRAFFIC.list=[];k.TRAFFIC.safetyPlan=null;k.HAZ.list=[];k.HAZ.nextS=1e9;zone.done=false;k.sim(1/60);
const bear=k.HAZ.list.find(h=>h.bear),startX=bear?.x;check('Bear appears ahead with an explicit warning interval',!!bear&&bear.s-k.PC.s>300&&bear.warning>=2.4);
k.sim(1);check('Bear waits at the forest edge during the warning',bear?.x===startX);
let open=true;for(let i=0;i<100;i++){k.sim(.1);open=open&&k.trafficCorridorOpen(forest,k.PC.s-12,k.PC.s+500);}
check('Bear crossing retains a connected escape corridor',open&&Math.abs(bear.x-startX)>.25);
w.state.bearFrames=frameCount;
const {p,m}=meshes[0];k.go(pieces.indexOf(p),m.s-46,-1);k.PC.v=0;k.TRAFFIC.list=[];k.HAZ.list=[];k.step(0);return{checks,art:w.state.warnings};});report.checks=data.checks;
await page.screenshot({path:path.join(out,'metro-entrance.png')});
report.bearFrame=await page.evaluate(()=>{const a=__kr,p=a.ROUTE.pieces.find(p=>p.wildlifeZones?.length),q=p.wildlifeZones[0];a.go(a.ROUTE.pieces.indexOf(p),q.s-330,0);a.PC.v=0;a.HAZ.list=[];a.HAZ.nextS=1e9;a.TRAFFIC.list=[];a.TRAFFIC.safetyPlan=null;q.done=false;a.sim(4);a.go(a.ROUTE.pieces.indexOf(p),q.s-35,0);a.step(0);return {piece:a.PC.piece.id,s:a.PC.s,bg:a.BG.set?.key,cv:a.CV.p?.id,cvs:a.CV.s,bear:a.HAZ.list.filter(h=>h.bear).map(h=>({s:h.s,x:h.x,t:h.t,spr:!!a.SPR['world_bear#0']}))};});
await page.screenshot({path:path.join(out,'alishan-bear-encounter.png')});
report.pass=report.checks.every(c=>c.pass)&&!report.errors.length&&!report.missing.length;
}catch(e){report.pass=false;report.failure=String(e.stack||e);}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'world-life-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.map(c=>({name:c.name,pass:c.pass})),errors:report.errors,failure:report.failure,out},null,2));if(!report.pass)process.exitCode=1;}})();
