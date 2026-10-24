// One-page visual and physical-contract regression for the Mudan dam replacement.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/mudan-art-qa'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 if(os.freemem()<3*1024**3)throw new Error('Not enough free RAM for single-page QA');
 const report={checks:[],errors:[],missing:[],samples:[]},server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FormosaLandmarkArt?.state.ready,null,{timeout:120000});
  const result=await page.evaluate(()=>{
   const k=__kr,a=FormosaLandmarkArt,s=k.SPR.dam,r=a.state.records.find(r=>r.name==='dam'),checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
   k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);
   check('Mudan rockfill dam replaces the legacy sprite within its unchanged physical box',s.meta?.landmarkIdentity==='mudan-rockfill-dam'&&s.wh===42&&Math.abs(s.ww-117.6)<1e-9&&s.ax===1&&s.collide===0&&s.shadow===0,{sprite:s,record:r});
   const places=k.ROUTE.pieces.flatMap(p=>p.sprites.filter(o=>o.id===s.id).map(o=>({piece:p.id,s:o.s,x:o.x,y:o.y})));
   check('The named reservoir exists only in the Mudan/Xuhai route',places.length===1&&places[0].piece==='s4d',places);
   check('New source pixels are released after registration with the other landmark sources',a.state.sourcesReleased&&Object.keys(a.state.images).length===0&&a.state.loaded['./assets/pixel/landmarks-mudan-v1.png']&&a.state.records.length===76&&!a.state.warnings.length,a.state.warnings);
   const cv=k.ATLAS.pages[s.pg].lv[0],px=cv.getContext('2d').getImageData(s.x,s.y,s.w,s.h).data;let clear=0,opaque=0,base=0;const colours=new Set();
   for(let i=0;i<px.length;i+=4){if(px[i+3]){opaque++;colours.add(px[i]<<16|px[i+1]<<8|px[i+2]);if(i>=px.length-s.w*4*3)base++;}else clear++;}
   check('The imported silhouette has detailed colour, transparent surroundings and a grounded base',clear>1000&&opaque>1000&&base>50&&colours.size>150,{clear,opaque,base,colours:colours.size});
   const p=k.ROUTE.pieces.find(p=>p.id==='s4d'),mid=p.secStartS[2]+p.secs[2].len*.5,placement=places[0];
   const shot=document.createElement('canvas');shot.width=s.w;shot.height=s.h;shot.getContext('2d').drawImage(cv,s.x,s.y,s.w,s.h,0,0,s.w,s.h);
   return {checks,places,atlas:shot.toDataURL('image/png'),samples:[{s:mid,key:'s4d-section-03'},...[200,120,65].map(d=>({s:placement.s-d,key:'dam-distance-'+d}))]};
  });
  report.checks=result.checks;report.places=result.places;fs.writeFileSync(path.join(out,'dam-packed.png'),Buffer.from(result.atlas.split(',')[1],'base64'));
  for(const sample of result.samples){await page.evaluate(s=>{const k=__kr;k.go(k.ROUTE.pieces.findIndex(p=>p.id==='s4d'),s,0);k.PC.v=0;k.RACE.time=95;k.TRAFFIC.list=[];k.HAZ.list=[];k.HAZ.nextS=1e9;k.step(0);},sample.s);await page.screenshot({path:path.join(out,sample.key+'.png')});report.samples.push(sample);}
  report.checks.push({name:'All real viewpoints render without JavaScript errors or missing resources',pass:!report.errors.length&&!report.missing.length});report.pass=report.checks.every(c=>c.pass);
 }catch(e){report.pass=false;report.failure=String(e.stack||e);}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'mudan-art-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.map(c=>({name:c.name,pass:c.pass})),errors:report.errors,missing:report.missing,failure:report.failure,out},null,2));if(!report.pass)process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
