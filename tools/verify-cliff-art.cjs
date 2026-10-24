// Real Taroko camera samples and deterministic geometry/collision comparison.
// This does not benchmark frame rates.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/cliff-art-qa'));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');fs.mkdirSync(out,{recursive:true});
(async()=>{const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),report={checks:[],errors:[],missing:[],samples:[]};
 try{
  const url='http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(path.basename(root))+'/';
  async function load(baseline){const page=await browser.newPage({viewport:{width:960,height:540}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});if(baseline)await page.route('**/render/cliff-art.js',r=>r.fulfill({contentType:'text/javascript',body:'window.FormosaCliffArt={loadAssets:async()=>{},registerSprites:()=>{},state:{baseline:true}};'}));await page.goto(url);await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});await page.evaluate(()=>{__kr.halt(true);__kr.G.mode='play';__kr.G.noIgnite=true;__kr.race(0,true);__kr.run();__kr.bot(false);__kr.show(null);});return page;}
  const baseline=await load(true);
  const snapshot=page=>page.evaluate(()=>({roads:__kr.ROUTE.pieces.map(p=>({id:p.id,X:Array.from(p.X),Y:Array.from(p.Y),Z:Array.from(p.Z),H:Array.from(p.H),K:Array.from(p.K),W:Array.from(p.W),SH:Array.from(p.SH),M:Array.from(p.M),colliders:p.colliders})),sprite:(()=>{const s=__kr.SPR.rail_marble;return {w:s.w,h:s.h,wh:s.wh,collide:s.collide};})(),walls:__kr.ROUTE.pieces.find(p=>p.id==='s5e').walls.filter(w=>w.tex===__kr.SPR.rail_marble.id),state:FormosaCliffArt.state.ready}));
  const B=await snapshot(baseline);await baseline.close();
  const painted=await load(false),A=await snapshot(painted);
  report.roadAndColliderHashes={painted:digest(A.roads),baseline:digest(B.roads)};
  const check=(name,pass,data)=>{report.checks.push({name,pass:!!pass,data});};
  check('All 31 routes retain exact road coordinates, curvature, widths, shoulders and colliders',digest(A.roads)===digest(B.roads));
  check('New marble texture is registered at the original fourteen metre height',A.state&&A.sprite.wh===14,{painted:A.sprite,baseline:B.sprite});
  check('Long visual cliff tiles retain the same occupied longitudinal bounds',A.walls.length<B.walls.length&&Math.min(...A.walls.map(w=>w.s0))===Math.min(...B.walls.map(w=>w.s0))&&Math.max(...A.walls.map(w=>w.s1))===Math.max(...B.walls.map(w=>w.s1)),{paintedCount:A.walls.length,baselineCount:B.walls.length,maxPaintedLength:Math.max(...A.walls.map(w=>w.s1-w.s0))});
  const samples=await painted.evaluate(()=>{const p=__kr.ROUTE.pieces.find(p=>p.id==='s5e'),out=[];for(let i=0;i<p.secs.length;i++){const sec=p.secs[i];if(!(sec.tags||[]).some(t=>['marble','swallowgrotto','tunnel','taroko','changchun'].includes(t)))continue;const a=p.secStartS[i],b=p.secStartS[i+1]??p.L;for(const fraction of [.12,.5,.86])out.push({id:p.id,s:a+(b-a)*fraction,section:i,L:sec.L,R:sec.R,tags:sec.tags});}return out;});
  for(let i=0;i<samples.length;i++){const sample=samples[i],file='sample-'+String(i).padStart(2,'0')+'.png';await painted.evaluate(s=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id==='s5e');k.go(k.ROUTE.pieces.indexOf(p),s,0);k.PC.v=0;k.RACE.time=78;k.step(0);},sample.s);await painted.screenshot({path:path.join(out,file)});report.samples.push({...sample,file});}
  const buddha=await painted.evaluate(()=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id==='s4a'),o=p.sprites.find(o=>o.id===k.SPR.bagua.id);return {s:o.s,y:o.y,x:o.x,piece:k.ROUTE.pieces.indexOf(p)};});
  check('Baguashan painted terrace sits on the ground instead of eight metres in the air',buddha.y===0,buddha);
  for(const distance of [150,85,45]){await painted.evaluate(({b,d})=>{__kr.go(b.piece,b.s-d,0);__kr.PC.v=0;__kr.step(0);},{b:buddha,d:distance});await painted.screenshot({path:path.join(out,'buddha-'+distance+'.png')});}
  const gallery=painted;await gallery.setViewportSize({width:1440,height:1000});
  for(let i=0;i<report.samples.length;i+=12){const html=report.samples.slice(i,i+12).map(s=>'<div><p>'+s.file+' '+s.s.toFixed(0)+'m '+s.tags.join(',')+'</p><img src="data:image/png;base64,'+fs.readFileSync(path.join(out,s.file)).toString('base64')+'"></div>').join('');await gallery.setContent('<style>body{margin:0;background:#12151b;color:#fff;display:grid;grid-template-columns:repeat(3,480px);font:12px sans-serif}div{height:250px}p{margin:2px;height:20px}img{width:480px;height:225px;object-fit:contain}</style>'+html);await gallery.screenshot({path:path.join(out,'sheet-'+Math.floor(i/12)+'.png')});}
  check('Real views load without missing textures or JavaScript exceptions',!report.errors.length&&!report.missing.length);
  report.pass=report.checks.every(c=>c.pass);assert(report.pass,'Cliff verification failed');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks,errors:report.errors,missing:report.missing,samples:report.samples.length,out}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
