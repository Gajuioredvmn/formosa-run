// Real renderer regression: foreground walkers must occlude the car, while
// objects farther down the road are painted before it. Instrumentation is
// injected only into the test response, never into the shipped game.
const fs=require('node:fs'),path=require('node:path');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/depth-order'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const report={checks:[],errors:[],missing:[]},server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}}),url=`http://127.0.0.1:${server.address().port}/`;
  const source=fs.readFileSync(path.join(root,'index.html'),'utf8')
   .replace('function drawPlayerCar(spr) {','function drawPlayerCar(spr) { if(window.__depthTrace)window.__depthTrace.push({kind:"player"});')
   .replace('function drawHazard(h, x, y, k, clip, fog) {','function drawHazard(h, x, y, k, clip, fog) { if(window.__depthTrace)window.__depthTrace.push({kind:"hazard",name:h.qaName,delta:h.s-PC.s});');
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:source}));
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto(url);await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});
  const result=await page.evaluate(()=>{
   const k=__kr,checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
   k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);k.RACE.checked=new Set(k.ROUTE.pieces);
   const failed=[];
   for(let p=0;p<k.ROUTE.pieces.length;p++)for(let car=0;car<k.CARS.length;car++){
    k.car(car);k.go(p,k.ROUTE.pieces[p].L*.5,0);k.PC.v=0;k.TRAFFIC.list=[];k.HAZ.list=[];k.HAZ.nextS=1e9;window.__depthTrace=[];k.step(0);
    const count=window.__depthTrace.filter(x=>x.kind==='player').length;
    if(count!==1)failed.push({piece:k.PC.piece.id,car,count});
   }
   check('All 10 cars render exactly once on all 31 routes',!failed.length,{samples:310,failed});
   k.car(0);k.go(k.ROUTE.pieces.findIndex(p=>p.id==='s4f'),1560,0);k.PC.v=0;k.PC.crash=null;k.HAZ.spinT=0;k.HAZ.list=[];k.TRAFFIC.list=[];
   const person=(name,ds,x)=>({qaName:name,p:k.PC.piece,s:k.PC.s+ds,x,to:0,dir:0,v:0,parade:true,spr:'marchers',smoke:false,kind:0,t:0,hit:0,vy:0,y:0,vx:0,len:2.5,wid:2.2});
   k.HAZ.list=[person('far',8,-1),person('near',-3,1)];window.__depthTrace=[];k.step(0);
   const trace=window.__depthTrace,far=trace.findIndex(x=>x.name==='far'),car=trace.findIndex(x=>x.kind==='player'),near=trace.findIndex(x=>x.name==='near');
   check('Near procession is drawn after player and distant procession before player',far>=0&&far<car&&car<near,trace);
   const visible=k.HUD.carVisible;k.HUD.carVisible=false;window.__depthTrace=[];k.step(0);check('Hidden player remains hidden',!window.__depthTrace.some(x=>x.kind==='player'));k.HUD.carVisible=visible;k.step(0);
   return {checks};
  });report.checks=result.checks;
  await page.screenshot({path:path.join(out,'foreground-procession.png')});
  await page.evaluate(()=>{const k=__kr;k.go(0,220,0);k.HAZ.list=[];k.TRAFFIC.list=[];k.step(0);});
  await page.screenshot({path:path.join(out,'harbor-normal.png')});
  report.checks.push({name:'No runtime errors or missing resources',pass:!report.errors.length&&!report.missing.length});report.pass=report.checks.every(c=>c.pass);
 }catch(e){report.pass=false;report.failure=String(e.stack||e);}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'depth-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
