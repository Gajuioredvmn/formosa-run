// Continuously drive all 16 five-stage paths with real traffic and collision.
// --driver --regular-clock uses normal player controls and the shipped timer;
// the optional enlarged clock remains explicitly labelled as a QA fixture.
const fs=require('node:fs'),path=require('node:path');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-route-soak-'+Date.now()));
const qaDriver=process.argv.includes('--driver'),regularClock=process.argv.includes('--regular-clock');
const selected=(process.argv.find(a=>a.startsWith('--routes='))||'').slice(9).split(',').filter(Boolean).map(Number);
fs.mkdirSync(out,{recursive:true});
const report={started:new Date().toISOString(),scope:'Real five-stage paths, real traffic/physics, fixed 1/60s steps. No teleporting or forced branch transition after starting.',driver:qaDriver?'test-only road/traffic planner through normal touch steering and throttle/brake keys':'shipped attract-mode bot',clock:regularClock?'original game timer':'QA-only 10,000s clock',collisionClock:'performance.now follows simulation time so accelerated QA retains real-time collision cooldown durations',journeys:[],errors:[],missing:[]};
const save=()=>fs.writeFileSync(path.join(out,'route-soak-report.json'),JSON.stringify(report,null,2));
(async()=>{const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
try{const ctx=await browser.newContext({viewport:{width:1280,height:720}}),page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});});
await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.ready,null,{timeout:90000});
await page.evaluate(()=>{__kr.halt(true);__kr.show(null);Object.defineProperty(performance,'now',{value:()=>100000+__kr.G.t*1000,configurable:true});});
if(qaDriver)await page.evaluate(require('./qa-route-driver.cjs'));
for(let n=0;n<16;n++){
 if(selected.length&&!selected.includes(n))continue;
 const forks=n.toString(2).padStart(4,'0').split('').map(c=>c==='0'?'L':'R'),car=n%10;
 const expected=await page.evaluate(({forks,car,n,qaDriver,regularClock})=>{let seed=19100+n;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);const k=__kr;k.G.mode='play';k.G.noIgnite=true;k.UI.sel=car;k.UI.resultShown=false;k.race(car,true);k.run();k.show(null);k.bot(!qaDriver,forks,1);k.BOT._lastPiece=null;k.BOT.lane=0;k.BOT.laneT=0;if(!regularClock)k.RACE.time=10000;if(qaDriver)Object.assign(__qaRouteDriver,{forks,plan:[],piece:null,nextPlan:0,failPlans:0,inputs:0});const expected=[k.ROUTE.root.id];let p=k.ROUTE.root;for(const f of forks){p=p.children[f==='L'?0:1];expected.push(p.id);}return expected;},{forks,car,n,qaDriver,regularClock});
 const samples=[];let last,stall=0,previousPiece='',previousS=0;
 for(let sec=0;sec<1800;sec+=10){last=await page.evaluate(qaDriver=>{const k=__kr;if(qaDriver)__qaRouteDriver.drive(10);else k.sim(10);const state=k.state();return{...state,route:[...k.RACE.route],finite:['s','x','v','vx','rpm','yaw','roll'].every(f=>Number.isFinite(k.PC[f])),hazards:k.HAZ.list.length,crash:!!k.PC.crash,bot:qaDriver?__qaRouteDriver.last:{forkI:k.BOT.forkI,lane:k.BOT.lane,steer:k.CTL.steer,gas:k.CTL.gas,brake:k.CTL.brake},corridor:k.trafficCorridorOpen(k.PC.piece,Math.max(0,k.PC.s-12),Math.min(k.PC.piece.L,k.PC.s+500))};},qaDriver);samples.push(last);
  stall=last.piece===previousPiece&&Math.abs(last.s-previousS)<2?stall+10:0;previousPiece=last.piece;previousS=last.s;
  if(!last.finite||last.st==='goal'||last.st==='timeup'||stall>=120)break;
 }
 const journey={forks:forks.join(''),car,expected,final:last,samples,pass:last.finite&&last.st==='goal'&&JSON.stringify(last.route)===JSON.stringify(expected)&&samples.every(s=>s.corridor),stallSeconds:stall};report.journeys.push(journey);
 await page.evaluate(()=>__kr.step(0));await page.screenshot({path:path.join(out,'route-'+forks.join('')+'.png')});
 console.log(JSON.stringify({forks:journey.forks,car,pass:journey.pass,state:last.st,elapsed:last.el,route:last.route,crashes:last.crashes,s:last.s,stall,closedCorridorSamples:samples.filter(s=>!s.corridor).length}));save();
}
report.pass=report.journeys.every(j=>j.pass)&&!report.errors.length&&!report.missing.length;await ctx.close();
}catch(error){report.pass=false;report.failure=String(error.stack||error);}finally{await browser.close();await new Promise(r=>server.close(r));report.finished=new Date().toISOString();save();console.log(JSON.stringify({pass:report.pass,journeys:report.journeys.length,completed:report.journeys.filter(j=>j.pass).length,errors:report.errors,failure:report.failure,out},null,2));if(!report.pass)process.exitCode=1;}})().catch(e=>{console.error(e);process.exitCode=1;});
