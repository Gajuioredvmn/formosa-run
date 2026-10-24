// One page, sequential pre/post renderer comparison. No world changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/hakka-foundations'));
fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
(async()=>{
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={checks:[],errors:[],missing:[],frames:[]};
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}}),url='http://127.0.0.1:'+server.address().port+'/';
  const source=fs.readFileSync(path.join(root,'index.html'),'utf8'),before=source.replace('|hakkahouse|hakkahouse_generic|tank','|tank');
  if(before===source)throw Error('Renderer baseline override missing');
  let baseline=true;
  const traceSource=s=>s.replace('function drawSpr(S, x, yb, hpx, sx, flip, clip, fog, skew) {','function drawSpr(S, x, yb, hpx, sx, flip, clip, fog, skew) { if(window.__hakkaTrace&&/^hakkahouse/.test(S.name))window.__hakkaTrace.push({name:S.name,x,yb,hpx,clip});');
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:traceSource(baseline?before:source)}));
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  async function load(){await page.goto(url);await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});await page.evaluate(()=>{const k=__kr;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);k.RACE.checked=new Set(k.ROUTE.pieces);});}
  const world=()=>page.evaluate(()=>__kr.ROUTE.pieces.map(p=>({id:p.id,X:Array.from(p.X),Y:Array.from(p.Y),Z:Array.from(p.Z),H:Array.from(p.H),K:Array.from(p.K),W:Array.from(p.W),SH:Array.from(p.SH),M:Array.from(p.M),colliders:p.colliders.map(c=>({s0:c.s0,s1:c.s1,x0:c.x0,x1:c.x1,kind:c.kind}))})));
  const samples=[{key:'s5m-12',fraction:.12},{key:'hakka-1080',s:1080},{key:'hakka-2110',s:2110}];
  async function capture(prefix){for(const sample of samples){const data=await page.evaluate(q=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id==='s5m'),s=q.s??Math.round(p.L*q.fraction);k.go(k.ROUTE.pieces.indexOf(p),s,0);k.PC.v=0;k.RACE.time=95;window.__hakkaTrace=[];k.step(0);return{s,draws:window.__hakkaTrace};},sample);const file=prefix+'-'+sample.key+'.png';await page.screenshot({path:path.join(out,file)});report.frames.push({file,...data});}}
  await load();const old=await world();await capture('before');baseline=false;await load();const current=await world();await capture('after');
  report.checks.push({name:'All 31 road geometry and collider arrays remain identical',pass:hash(old)===hash(current),before:hash(old),after:hash(current)});
  const initial=report.frames.find(f=>f.file==='before-s5m-12.png'),final=report.frames.find(f=>f.file==='after-s5m-12.png');
  report.checks.push({name:'Unsupported distant courtyard draws are culled in the reported view',pass:initial.draws.length>final.draws.length,before:initial.draws.length,after:final.draws.length});
  report.checks.push({name:'Targeted three views render without script or resource errors',pass:!report.errors.length&&!report.missing.length});
  report.pass=report.checks.every(q=>q.pass);
 }catch(e){report.pass=false;report.failure=String(e.stack||e);}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
