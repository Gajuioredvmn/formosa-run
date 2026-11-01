const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'../formosa-work/cijin-road');fs.mkdirSync(out,{recursive:true});
(async()=>{const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),report={errors:[],modes:[]};
try{for(const mode of ['legacy','fixed']){
 const page=await browser.newPage({viewport:{width:960,height:540}}),url='http://127.0.0.1:'+server.address().port+'/?road='+mode;
 const original=mode==='legacy'?require('child_process').execFileSync('git',['show','a6128b5:index.html'],{cwd:root,encoding:'utf8',maxBuffer:3e6}):fs.readFileSync(path.join(root,'index.html'),'utf8');
 const source=original.replace('window.__kr = {','window.__roadProject=(p,s,x)=>{const w={},q={};p.pos(s,x,w);return projW(w.x,w.y,w.z,q)?q:null;};window.__kr = {');
 await page.route(url,r=>r.fulfill({contentType:'text/html',body:source}));page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url);await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});
 const data=await page.evaluate(()=>{const k=__kr;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);k.TRAFFIC.list=[];k.HAZ.list=[];k.RACE.checked=new Set(k.ROUTE.pieces);
  const p=k.ROUTE.pieces.find(p=>p.id==='s2s'),pi=k.ROUTE.pieces.indexOf(p),bad=[],samples=[];
  for(let s=10;s<=1300;s+=20){k.go(pi,s,1.85);k.PC.v=0;k.step(0,false);let water=0,sky=0,total=0;
   for(const ds of [3,6,10,15,22,32,48,70])for(const x of [-2,0,2]){const q=__roadProject(p,s+ds,x);if(!q)continue;const px=Math.round(q.x*2),py=Math.round(q.y*2);if(px<0||py<0||px>=k.RV.gcv.width||py>=k.RV.gcv.height)continue;const material=k.RV.support[py*k.RV.gcv.width+px];total++;if(material===2){water++;bad.push({s,ds,x,px,py,material});}if(material===0)sky++;}samples.push({s,water,sky,total});}
  return{bad,samples};
 });
 const dynamic=[];
 for(const viewport of [{width:960,height:540},{width:1200,height:540}]){
  await page.setViewportSize(viewport);
  dynamic.push(await page.evaluate(()=>{const k=__kr;k.race(0,true);k.run();k.show(null);k.bot(true,['R','R','R','R'],1);k.go(0,k.ROUTE.root.L-180,k.ROUTE.root.forkOff[1]+1);k.PC.v=45;k.TRAFFIC.list=[];k.HAZ.list=[];k.step(0,false);const bad=[];let frames=0,entered=false;
   for(let i=0;i<650;i++){k.TRAFFIC.list=[];k.HAZ.list=[];k.HAZ.nextS=1e9;k.step(1/30,false);const p=k.PC.piece;if(p.id!=='s2s')continue;entered=true;frames++;
    for(const ds of [-1,2,5,10,20,35])for(const dx of [-.6,.6]){const x=k.PC.x+dx;if(x<p.leftEdge(k.PC.s+ds)+.3||x>p.rightEdge(k.PC.s+ds)-.3)continue;const q=__roadProject(p,k.PC.s+ds,x);if(!q)continue;const px=Math.round(q.x*2),py=Math.round(q.y*2);if(px<0||py<0||px>=k.RV.gcv.width||py>=k.RV.gcv.height)continue;const material=k.RV.support[py*k.RV.gcv.width+px];if(material===2)bad.push({s:k.PC.s,ds,x,material});}
    if(k.PC.s>1350)break;
   }return{entered,frames,bad,final:k.state()};}));
 }
 data.dynamic=dynamic;
 for(const s of [10,90,150,230,310,450,590,750,950,1150]){await page.evaluate(s=>{const k=__kr;k.bot(false);k.go(k.ROUTE.pieces.findIndex(p=>p.id==='s2s'),s,1.85);k.PC.v=0;k.step(0,false);},s);await page.screenshot({path:path.join(out,mode+'-'+s+'.png')});}
 report.modes.push({mode,...data});console.log(JSON.stringify({mode,waterSamples:data.bad.length,frames:data.samples.length}));await page.close();}
 const fixed=report.modes.find(m=>m.mode==='fixed');assert(fixed.bad.length===0,'Cijin road centre/lanes must never be rastered as water in the first 1.3 km');assert(fixed.dynamic.every(d=>d.entered&&d.frames>100&&!d.bad.length),'Normal continuous fork entry must keep road material under the player at desktop and phone aspect ratios');assert(!report.errors.length,'no runtime errors');report.pass=true;
}catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,failure:report.failure,out}));}})();
