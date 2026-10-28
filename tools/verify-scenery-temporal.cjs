// One real browser at a time; records stable world-object identities across
// consecutive rendered frames. Baseline uses the published commit's scripts.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'current',out=path.resolve(process.argv[3]||path.join(root,'../formosa-work/fix-20261028/scenery-'+mode));
fs.mkdirSync(out,{recursive:true});
const baselineRef='8a671b9', cache=new Map();
function source(file){if(mode!=='baseline')return fs.readFileSync(path.join(root,file),'utf8');if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',baselineRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}));return cache.get(file);}
function instrument(html){
 const start=html.indexOf('function drawSpr('),begin=html.indexOf('{',start);let end=begin+1,depth=1;for(;depth&&end<html.length;end++){if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}
 if(start<0||depth)throw Error('drawSpr function not found');
 let fn=html.slice(start,end).replaceAll('VG.drawImage(','window.__temporalImage(');
 html=html.slice(0,start)+fn+html.slice(end);
 const hook=`
window.__temporal={frame:0,records:[],current:null};
const temporalTree=/^(pixel_palm|palm|royal|betel|banana|banyan|mango|casuarina|terminalia|pandanus|cypress|hemlock|camphor|sakura|tung|world_alpine_shrub)(#|$)/;
const temporalGround=sceneryGrounded;
sceneryGrounded=function(S,o,ip,x,y,p,s,waterClip){
 const accepted=temporalGround.apply(this,arguments),q=window.__temporal;
 q.current=null;
 if(temporalTree.test(S.name)){
  const h=S.wh*o.sc*ip.k,w=h*S.w/S.h*o.sx;
  const rec={key:p.id+':'+o.s+':'+o.x+':'+o.id,name:S.name,s:o.s,x:o.x,frame:q.frame,accepted:!!accepted,h,xs:x,ys:y,z:ip.cz,visible:x+w*.5>=0&&x-w*.5<RW&&y>0&&y-h<RH,flip:null,mips:[],alpha:[],opacity:0};
  if(window.__temporalFocus&&window.__temporalFocus.includes(rec.key)){
   const px=Math.floor(x*DETAIL),py=Math.floor(y*DETAIL),W=RW*DETAIL,H=RH*DETAIL,grid=[];
   for(let dy=-4;dy<=6;dy++){const row=[];for(let dx=-4;dx<=4;dx++){const xx=px+dx,yy=py+dy;row.push(xx>=0&&xx<W&&yy>=0&&yy<H?RV.support?.[yy*W+xx]??-1:-2);}grid.push(row);}
   const world={},screen={};p.pos(s,o.x,world);projW(world.x,world.y,world.z,screen);
   rec.supportProbe={hy:_hy,reach:y<_hy-1?HILL_REACH:GROUND_REACH,offset:o.x<ip.oL?ip.oL-o.x:o.x>ip.oR?o.x-ip.oR:0,oL:ip.oL,oR:ip.oR,waterClip,grid,exact:screen};
  }
  q.records.push(rec);q.current=rec;
 }
 return accepted;
};
const temporalSpr=drawSpr;
drawSpr=function(S,x,y,h,sx,flip,clip,fog,skew){const q=window.__temporal.current;if(q&&q.name===S.name){q.flip=!!flip;q.skew=skew||0;q.clip=clip;q.opacity=arguments[9]??1;}try{return temporalSpr.apply(this,arguments);}finally{window.__temporal.current=null;}};
const temporalLevels=new WeakMap();
window.__temporalImage=function(image,...args){
 const q=window.__temporal.current;
 if(q){let l=temporalLevels.get(image);if(l==null){for(const p of ATLAS.pages){const i=p.lv.indexOf(image);if(i>=0){l=i;temporalLevels.set(image,i);break;}}}if(l!=null){q.mips.push(l);q.alpha.push(VG.globalAlpha);}}
 return VG.drawImage(image,...args);
};
window.__temporalFrame=function(id,s,t,frame){
 const k=window.__kr,p=ROUTE.pieces.find(q=>q.id===id);G.t=t;G.fx=false;
 PC.piece=p;PC.s=s;PC.x=0;PC.v=50;PC.vx=0;PC.roll=0;PC.visual.time=t;PC.crash=null;CAM.init=false;CAM.shake=0;
 TRAFFIC.list.length=0;HAZ.list.length=0;GHOST.p=null;updateCamera(0);updateBackdrop(true);
 window.__temporal.frame=frame;window.__temporal.records=[];window.__temporal.current=null;render();drawHud(0);
 return window.__temporal.records;
};
window.__temporalMipProbe=function(name,h){
 window.__temporal.current=null;const S=SPR[name],w=h*S.w/S.h;
 VG.setTransform(1,0,0,1,0,0);VG.globalAlpha=1;VG.fillStyle='#808080';VG.fillRect(0,0,RW,RH);
 drawSpr(S,RW/2,150,h,1,false,RH,0,0);
 const c=canvas(128,128),g=c.getContext('2d');g.imageSmoothingEnabled=true;g.drawImage(view,(RW/2-S.ax*w)*DETAIL,(150-h)*DETAIL,w*DETAIL,h*DETAIL,0,0,128,128);
 return Array.from(g.getImageData(0,0,128,128).data);
};
`;
 return html.replace('boot();\n',hook+'\nboot();\n').replace('boot();\r\n',hook+'\r\nboot();\r\n');
}
(async()=>{
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={mode,baselineRef,cases:[],checks:[],errors:[],missing:[]};
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.route('**/*',async r=>{const u=new URL(r.request().url()),file=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';if(file==='index.html')return r.fulfill({contentType:'text/html; charset=utf-8',body:instrument(source(file))});if(mode==='baseline'&&file.endsWith('.js')&&!file.startsWith('vendor/'))return r.fulfill({contentType:'text/javascript',body:source(file)});return r.continue();});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete&&window.__temporalFrame,null,{timeout:180000});
  await page.evaluate(()=>{__kr.halt(true);__kr.G.mode='play';__kr.G.noIgnite=true;__kr.race(0,true);__kr.run();__kr.bot(false);__kr.show(null);});
  const samples=await page.evaluate(()=>['s1','s2n','s2s','s3m','s4b','s5d'].map(id=>{const p=__kr.ROUTE.pieces.find(p=>p.id===id);if(!p)throw Error('Missing route '+id);return{id,start:id==='s1'?100:p.L*.28};}));
  const focus=process.argv.includes('--focus');
  if(focus)await page.evaluate(()=>window.__temporalFocus=['s1:652:16.19999990463257:8','s2n:2200:13.852074880318133:51','s3m:2418:44.62167735770345:41']);
  for(const sample of process.argv.includes('--probe-only')?[]:focus?samples.filter(s=>['s1','s2n','s3m'].includes(s.id)):samples){
   const previous=new Map(),histories=new Map(),events=[],trace=[];let flips=0,mips=0,toggles=0,drawn=0,supported=0;
   for(let frame=focus?145:0;frame<180;frame++){
    const rows=await page.evaluate(({sample,frame})=>__temporalFrame(sample.id,sample.start+frame*50/30,frame/30,frame),{sample,frame});
    for(const q of rows){if(!q.visible)continue;trace.push(q);supported+=q.accepted?1:0;drawn+=q.mips.length>0?1:0;const prev=previous.get(q.key);if(prev&&prev.frame===frame-1){if(q.accepted&&prev.accepted&&q.flip!==null&&prev.flip!==null&&q.flip!==prev.flip){flips++;events.push({kind:'flip',before:prev,after:q});}if(q.accepted&&prev.accepted&&q.mips.join(',')!==prev.mips.join(','))mips++;if(q.accepted!==prev.accepted){toggles++;const a=histories.get(q.key)||[];a.push(frame);histories.set(q.key,a);events.push({kind:'presence',before:prev,after:q});}}previous.set(q.key,q);}
    if(frame===0||frame===90||(sample.id==='s1'&&frame>=2&&frame<=5)||events.some(e=>e.after.frame===frame&&e.kind==='flip')&&frame%2===0)await page.screenshot({path:path.join(out,sample.id+'-'+String(frame).padStart(3,'0')+'.png')});
   }
   const reversals=[...histories.entries()].filter(([,v])=>v.some((f,i)=>i>0&&f-v[i-1]<=6)).map(([key,frames])=>({key,frames}));
   const rapidFrames=new Map(reversals.map(r=>[r.key,r.frames])),rapidEvents=events.filter(e=>e.kind==='presence'&&rapidFrames.get(e.after.key)?.some(f=>f!==e.after.frame&&Math.abs(f-e.after.frame)<=6));
   const largeRapidReversals=[...new Set(rapidEvents.filter(e=>e.before.h>20&&e.after.h>20).map(e=>e.after.key))];
   const opaqueRapidReversals=[...new Set(rapidEvents.filter(e=>Math.max(e.before.opacity,e.after.opacity)>.25).map(e=>e.after.key))];
   report.cases.push({...sample,frames:focus?35:180,drawn,supported,flips,mipSwitches:mips,presenceToggles:toggles,rapidReversals:reversals,largeRapidReversals,opaqueRapidReversals,events});
   fs.writeFileSync(path.join(out,sample.id+'-trace.json'),JSON.stringify(trace));
   console.log(JSON.stringify({case:sample.id,drawn,flips,mipSwitches:mips,presenceToggles:toggles,rapidReversals:reversals.length}));
  }
  report.mipProbes=[];
  for(const name of ['pixel_palm#2','mango#0','hemlock#0'])for(const divisor of [4,8,16]){
   const h=await page.evaluate(({name,divisor})=>__kr.SPR[name].h/divisor/2,{name,divisor});
   const a=await page.evaluate(({name,h})=>__temporalMipProbe(name,h-.01),{name,h}),b=await page.evaluate(({name,h})=>__temporalMipProbe(name,h+.01),{name,h});
   let sum=0,changed=0;for(let i=0;i<a.length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(a[i+c]-b[i+c]);sum+=d;if(d>90)changed++;}
   report.mipProbes.push({name,height:h,meanChannelDelta:sum/(128*128*3),largeChangeFraction:changed/(128*128)});
  }
  report.checks.push({name:'No JavaScript exceptions or missing assets',pass:!report.errors.length&&!report.missing.length});
  if(mode!=='baseline')report.checks.push({name:'No object reverses its sprite mirror while approaching',pass:report.cases.every(c=>!c.flips)});
  if(mode!=='baseline')report.checks.push({name:'No tree larger than 20 logical pixels rapidly disappears and reappears',pass:report.cases.every(c=>!c.largeRapidReversals.length)});
  if(mode!=='baseline')report.checks.push({name:'No tree rendered above 25% opacity rapidly disappears and reappears',pass:report.cases.every(c=>!c.opaqueRapidReversals.length)});
  report.pass=report.checks.every(c=>c.pass);
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
