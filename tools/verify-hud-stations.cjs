// Actual-canvas regressions: driving notices stay at the edge and both station
// structures retain their complete metre footprint outside the carriageway.
const fs=require('node:fs'),path=require('node:path'),{createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-hud-stations-'+Date.now()));fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],missing:[]};
(async()=>{const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});});
await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FormosaWorldLife?.state.ready,null,{timeout:90000});
const stations=await page.evaluate(()=>{const k=__kr;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.show(null);k.bot(false);k.TRAFFIC.list=[];k.HAZ.list=[];k.HAZ.nextS=1e9;k.HUD.msgs=[];return(k.ROUTE.root.landmarkMeshes||[]).map(m=>({kind:m.kind,s:m.s,minOff:m.minOff,maxOff:m.maxOff}));});
const geometry=await page.evaluate(()=>{const k=__kr,p=k.ROUTE.root,check=[];const push=(name,pass,detail)=>check.push({name,pass:!!pass,detail});
const meshes=p.landmarkMeshes||[],metro=meshes.filter(m=>m.kind==='metroEntrance'),lrt=meshes.filter(m=>m.kind==='lightRailStop');
push('One metro entrance and two light-rail platforms are actually placed',metro.length===1&&lrt.length===2,meshes.map(m=>({kind:m.kind,s:m.s})));
push('No broad front-facing light-rail station cards remain',!p.sprites.some(o=>/^lrtstop#/.test(k.SPRL[o.id].name)));
push('Every metro roof/platform corner remains beyond the entire rail corridor',metro.every(m=>m.faces.flatMap(f=>f.points).every(v=>v[1]>=17.5&&v[1]<=26.2)));
for(const m of metro){const posts=[];for(const ds of [-6.8,6.8])for(const off of [18.8,25]){const s=m.s+ds,x=p.outerL(Math.round(s/k.DS))-off;posts.push(p.colliders.some(c=>Math.abs(c.s0-(s-.24))<1e-7&&Math.abs(c.s1-(s+.24))<1e-7&&Math.abs(c.x0-(x-.24))<1e-7&&Math.abs(c.x1-(x+.24))<1e-7));}push('All four metro corner posts keep their collision outside the rail corridor',posts.every(Boolean),posts);}
push('Every light-rail roof/platform corner remains beyond the road and before the tracks',lrt.every(m=>m.faces.flatMap(f=>f.points).every(v=>v[1]>=3.9&&v[1]<=7.3)));
for(const m of lrt){const posts=[];for(const ds of [-7,0,7])for(const off of [4.3,6.9]){const s=m.s+ds,x=p.outerL(Math.round(s/k.DS))-off;posts.push(p.colliders.some(c=>Math.abs(c.s0-(s-.15))<1e-7&&Math.abs(c.s1-(s+.15))<1e-7&&Math.abs(c.x0-(x-.15))<1e-7&&Math.abs(c.x1-(x+.15))<1e-7));}push('All six light-rail posts match visible corner extents at '+m.s,posts.every(Boolean),posts);}
return check;});report.checks.push(...geometry);
for(const station of [stations.find(m=>m.kind==='lightRailStop'),stations.find(m=>m.kind==='metroEntrance')])for(const d of [100,46,20,0])for(const x of [-4,0,4]){
 await page.evaluate(({s,x})=>{const k=__kr;k.go(0,s,x);k.PC.v=0;k.HUD.msgs=[];k.step(0);},{s:station.s-d,x});
 await page.screenshot({path:path.join(out,station.kind+'-d'+d+'-x'+x+'.png')});
}
for(const fork of [false,true]){
 const results=await page.evaluate(fork=>{const k=__kr;k.go(0,fork?k.ROUTE.root.L-350:850,0);k.PC.v=0;k.HUD.msgs=[];k.step(0);k.step(0);
 const cv=document.getElementById('gl'),g=cv.getContext('2d'),base=g.getImageData(0,0,cv.width,cv.height).data.slice(),checks=[];
 const compare=(label,msgs,shouldChange)=>{k.HUD.msgs=msgs;k.step(0);const a=g.getImageData(0,0,cv.width,cv.height).data;let count=0,maxY=-1,minY=cv.height;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const i=(y*cv.width+x)*4;if(a[i]!==base[i]||a[i+1]!==base[i+1]||a[i+2]!==base[i+2]){count++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
 checks.push({name:label+(fork?' with fork':' without fork'),pass:shouldChange?count>0&&maxY<cv.height*65/270:count===0,detail:{count,minY,maxY,width:cv.width,height:cv.height,fork:k.HUD.fork}});};
 compare('Commentary does not draw any pixels',[{text:'交錯超車區',sub:'提前選線，保留出彎空間',col:'#ffd23a',dur:4,t:1}],false);
 compare('Safety and checkpoint notices affect only the upper edge',[{text:'CHECKPOINT',sub:'時間延長 +30 秒　高雄',col:'#ffd23a',dur:4,t:1},{text:'前方平交道',sub:'右側地下道可持續通行',col:'#ffda72',dur:4,t:1}],true);
 return checks;},fork);report.checks.push(...results);await page.screenshot({path:path.join(out,fork?'hud-with-fork.png':'hud-notice.png')});
}
for(const viewport of [{width:1280,height:720},{width:800,height:360}]){await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const q=await page.evaluate(()=>{const k=__kr;k.NET.on=true;k.NET.phase='race';k.NET.ranking=[{id:k.NET.id,name:'車手一',slot:0,progress:.18},{id:'hud-fixture',name:'車手二',slot:1,progress:.17,seenAt:Date.now()}];k.go(0,k.ROUTE.root.L-350,0);k.PC.v=0;k.step(0);const scale=Math.min(innerWidth/k.info().RW,innerHeight/270),bottom=(innerHeight-270*scale)/2+47*scale;return{layout:k.NET.hudLayout,bottom};});report.checks.push({name:'Multiplayer standings clear the right fork sign at '+viewport.width+'x'+viewport.height,pass:q.layout.y>=q.bottom,detail:q});await page.screenshot({path:path.join(out,'hud-multiplayer-'+viewport.width+'.png')});await page.evaluate(()=>{__kr.NET.on=false;__kr.NET.phase='idle';__kr.NET.ranking=[];});}
await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
await page.evaluate(()=>{const k=__kr,E=FormosaRoadEvents;k.go(0,1750,0);k.PC.v=0;k.HUD.msgs=[];k.TRAFFIC.list=[];k.HAZ.list=[];k.G.t=100;k.TRAFFIC.cargoNext=0;const v={p:k.PC.piece,s:2050,x:2,len:11.8,wid:2.5,massKg:18000,v:17,v0:17,type:'flatbed',spr:k.SPR.world_flatbed_rear,lcT:999,brake:0,wob:0,push:0,hitT:0,manners:{every:10,signal:2,weave:0}};k.TRAFFIC.list.push(v);E.update(k.roadEventsApi(),.016);k.go(0,1965,-1);k.step(0);});
const cargo=await page.evaluate(()=>{const k=__kr;return{warnings:FormosaRoadEvents.warnings(k.roadEventsApi()).length,msgs:k.HUD.msgs.length};});report.checks.push({name:'Cargo keeps its separate road warning without subtitle messages',pass:cargo.warnings>0&&cargo.msgs===0,detail:cargo});await page.screenshot({path:path.join(out,'cargo-warning.png')});
report.pass=report.checks.every(c=>c.pass)&&!report.errors.length&&!report.missing.length;
}catch(e){report.pass=false;report.failure=String(e.stack||e);}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}})();
