// Visual audit: three actual rendered positions in every route section.
const fs=require('node:fs'),path=require('node:path'),{createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/landscape-audit'));
const allSections=process.argv.includes('--sections');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={errors:[],missing:[],routes:[]};
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(path.basename(root))+'/');
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});
  await page.evaluate(()=>{__kr.halt(true);__kr.G.mode='play';__kr.G.noIgnite=true;__kr.race(0,true);__kr.run();__kr.bot(false);__kr.show(null);});
  const routes=await page.evaluate(()=>__kr.ROUTE.pieces.map(p=>({id:p.id,label:p.def.label,length:p.L,sections:p.secs.map((s,i)=>({s0:p.secStartS[i],length:s.len,L:s.L,R:s.R,sky:s.sky,tags:s.tags}))})));
  for(const route of routes){
   route.samples=[];
   const samples=allSections?route.sections.map((sec,i)=>({s:Math.round(sec.s0+sec.length*.5),key:'section-'+String(i+1).padStart(2,'0'),tags:sec.tags})): [.12,.5,.84].map(f=>({s:Math.round(route.length*f),key:String(Math.round(f*100))}));
   for(const sample of samples){
    const s=sample.s,name=route.id+'-'+sample.key+'.png';
    const snapshot=await page.evaluate(({id,s})=>{const k=__kr;k.race(0,true);k.run();k.bot(false);k.show(null);k.go(k.ROUTE.pieces.findIndex(p=>p.id===id),s,0);k.PC.v=0;k.RACE.checked=new Set(k.ROUTE.pieces);k.RACE.time=95;k.step(0);return {state:k.G.state,piece:k.PC.piece.id,s:k.PC.s,boundaries:k.PC.piece.roadBoundaries?.length||0};},{id:route.id,s});
    await page.screenshot({path:path.join(out,name)});route.samples.push({...sample,s,file:name,...snapshot});
   }
   report.routes.push(route);
  }
  // Browser-rendered contact sheets preserve the original screenshots.
  const gallery=await browser.newPage({viewport:{width:1440,height:960}});
  if(allSections){
   const frames=routes.flatMap(r=>r.samples.map(s=>({...s,label:r.id+' '+r.label+' '+s.key+' · '+s.s+'m'})));
   for(let i=0;i<frames.length;i+=12){
    const cells=frames.slice(i,i+12).map(s=>'<section><b>'+s.label+'</b><img src="data:image/png;base64,'+fs.readFileSync(path.join(out,s.file)).toString('base64')+'"></section>').join('');
    await gallery.setContent('<style>body{margin:0;background:#111;color:white;font:12px sans-serif;display:grid;grid-template-columns:repeat(3,480px)}section{height:240px}b{display:block;height:24px;font-size:13px}img{width:480px;height:216px;object-fit:contain}</style>'+cells);
    await gallery.screenshot({path:path.join(out,'sections-'+String(Math.floor(i/12)).padStart(2,'0')+'.png')});
   }
  }else for(let i=0;i<routes.length;i+=4){
   const rows=routes.slice(i,i+4).map(r=>'<section><h2>'+r.id+' '+r.label+'</h2><div>'+r.samples.map(s=>'<img src="data:image/png;base64,'+fs.readFileSync(path.join(out,s.file)).toString('base64')+'">').join('')+'</div></section>').join('');
   await gallery.setContent('<style>body{margin:0;background:#111;color:white;font:12px sans-serif}section{height:240px}h2{margin:0;height:24px;font-size:15px}div{display:flex}img{width:480px;height:216px;object-fit:contain}</style>'+rows);
   await gallery.screenshot({path:path.join(out,'sheet-'+Math.floor(i/4)+'.png')});
  }
  report.pass=!report.errors.length&&!report.missing.length&&report.routes.length===31;
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'landscape-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,routes:report.routes.length,screens:report.routes.reduce((n,r)=>n+r.samples.length,0),errors:report.errors,missing:report.missing,out}));if(!report.pass)process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
