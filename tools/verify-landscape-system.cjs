// Actual assets + actual route renderer; desktop timings are not phone FPS claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/landscape-system-qa'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={errors:[],missing:[],checks:[],limitations:['Desktop Edge headless; render timings are not physical-phone 60 FPS certification.']};
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(path.basename(root))+'/');
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FormosaLandscape?.state.clouds.length===6,null,{timeout:120000});
  const result=await page.evaluate(()=>{
   const k=__kr,L=FormosaLandscape,checks=[],check=(name,pass,data)=>checks.push({name,pass:!!pass,data});
   k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);
   check('Four natural biomes loaded, each with three alpha-separated depth layers',['alpine','forest','coast','gorge'].every(a=>L.state.layers[a]?.length===3));
   check('Six drawn cloud identities loaded with transparent outside pixels',L.state.clouds.every(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let zero=0,full=0,mid=0;for(let i=3;i<a.length;i+=4){zero+=a[i]===0;full+=a[i]===255;mid+=a[i]>0&&a[i]<255;}return zero>0&&full>0&&mid===0;}));
   check('Every actual route has an explicit regional panorama profile',k.ROUTE.pieces.every(p=>L.PROFILES[p.def.pano]),k.ROUTE.pieces.map(p=>({id:p.id,pano:p.def.pano,art:L.profile(p.def.pano).art})));
   const plant=/^(pixel_palm|palm|royal|betel|banana|banyan|mango|casuarina|terminalia|pandanus|cypress|hemlock|camphor|sakura|tung|world_alpine_shrub)(#|$)/,wetRoots=[],bridgeRoots=[],alpineTall=[];let treeCount=0;
   for(const p of k.ROUTE.pieces)for(const o of p.sprites){const S=k.SPRL[o.id];if(!plant.test(S.name)||o.lm||o.y)continue;treeCount++;const sec=p.sec(o.s),sg=o.x<0?-1:1,edge=sg<0?p.outerL(Math.round(o.s/k.DS)):p.outerR(Math.round(o.s/k.DS)),off=sg*(o.x-edge),type=sg<0?sec.L:sec.R,bands=k.sideBands(type),root=Math.max(.22,Math.min(1.1,S.ww*o.sc*(o.sx||1)*(S.collide||.08)*.5)),wet=[off-root+1e-6,off,off+root-1e-6].some(q=>{const band=bands.find(b=>q<=b.w);return band?.k===1||band?.k===2;});if(p.id==='s5d'&&o.s>p.L*.36&&S.wh*o.sc>8)alpineTall.push({s:o.s,name:S.name,height:S.wh*o.sc});if(wet)wetRoots.push({piece:p.id,s:o.s,name:S.name,type,off});if(sec.bridge)bridgeRoots.push({piece:p.id,s:o.s,name:S.name});}
   check('Every generated ordinary tree in all 31 routes has a dry root after crown setback',!wetRoots.length,{treeCount,wetRoots});
   check('Bridge decks contain no ground-planted ordinary trees',!bridgeRoots.length,bridgeRoots);
   check('The upper Hehuan section contains alpine scrub rather than a tall forest avenue',!alpineTall.length,alpineTall);
   const roadSnapshot=()=>JSON.stringify(k.ROUTE.pieces.map(p=>({id:p.id,X:Array.from(p.X),Y:Array.from(p.Y),Z:Array.from(p.Z),H:Array.from(p.H),W:Array.from(p.W)})));
   const before=roadSnapshot(),c=document.createElement('canvas');c.width=480;c.height=270;const g=c.getContext('2d'),piece=k.ROUTE.pieces.find(p=>p.id==='s5d');
   const pcBefore=JSON.stringify(Object.fromEntries(Object.entries(k.PC).filter(([,v])=>typeof v!=='object'&&typeof v!=='function')));
   const args={width:480,height:270,focal:296,horizon:112,piece,s:piece.L*.5,lateral:0,haze:0xc8e2f4};
   L.drawBackdrop(g,{key:'cingjing'},piece.heading(args.s+170),1,args);const shift0=L.state.drawn.map(x=>x.shift);
   L.drawBackdrop(g,{key:'cingjing'},piece.heading(args.s+170)+.2,1,args);const shift1=L.state.drawn.map(x=>x.shift);
   check('Near, middle and distant ridges have distinct parallax',shift1[2]-shift0[2]<shift1[1]-shift0[1]&&shift1[1]-shift0[1]<shift1[0]-shift0[0],{shift0,shift1});
   check('Background observer does not mutate any player scalar',pcBefore===JSON.stringify(Object.fromEntries(Object.entries(k.PC).filter(([,v])=>typeof v!=='object'&&typeof v!=='function'))));
   const fb=new Uint32Array(64),copy=new Uint32Array(64),next=new Uint32Array(64);
   for(const type of ['highland','mountain','orchard','tea','gorge']){
    fb.fill(0);L.paintGround(fb,0,4,60,0,7,100,type,'plain',0,0xc8e2f4);
    check(type+' ground samples real opaque artwork without writing outside its span',fb[0]===0&&fb[63]===0&&fb.slice(4,60).every(p=>(p>>>24)===255)&&new Set(fb.slice(4,60)).size>3);
   }
   L.paintGround(fb,0,4,60,0,7,100,'highland','cingjing',0,0xc8e2f4);L.paintGround(copy,0,4,60,0,7,100,'highland','cingjing',0,0xc8e2f4);L.paintGround(next,0,4,60,0,7,101,'highland','cingjing',0,0xc8e2f4);
   check('Ground pattern is repeatable and attached to travelled metres',fb.every((v,i)=>v===copy[i])&&fb.some((v,i)=>v!==next[i]));
   check('City pavement and water retain their original bands',L.paintGround(copy,0,4,60,0,7,100,'city','plain',0,0xc8e2f4)===false&&L.paintGround(copy,0,4,60,0,7,100,'water','plain',0,0xc8e2f4)===false);
   check('Marble scree keeps the gorge river band and crop fields keep their regional colours',L.groundBand('gorge',1,3)&&!L.groundBand('gorge',2,3)&&L.terrainTile('daylily','taitung',24)===-1&&L.terrainTile('cabbage','cingjing',24)===-1);
   const fake=(L,R)=>({sec:()=>({L,R})});
   check('Ocean backdrop belongs only to the declared sea side',JSON.stringify(L.waterSides(fake('orchard','shore'),0))==='{"left":false,"right":true}');
   check('Inland towns, bridge water and lakes retain land beyond their finite banks',[['town','town'],['water','water'],['lake','mountain'],['industrial','industrial']].every(([a,b])=>Object.values(L.waterSides(fake(a,b),0)).every(v=>!v)));
   check('Detailed cloud panorama retains logical size and doubles source detail',(()=>{const c=L.cloudStrip(17,1800,240,160,2);return c.width===3600&&c.height===480&&c.logicalWidth===1800&&c.logicalHeight===240;})());
   const sampleIds=['s5d','s4h','s2s','s4b','s5e'],timings=[];
   for(const id of sampleIds){const i=k.ROUTE.pieces.findIndex(p=>p.id===id);k.go(i,k.ROUTE.pieces[i].L*.5,0);k.PC.v=0;for(let n=0;n<8;n++)k.step(0);const values=[];for(let n=0;n<40;n++){const t=performance.now();k.step(0);values.push(performance.now()-t);}values.sort((a,b)=>a-b);timings.push({id,medianMs:values[20],p95Ms:values[38]});}
   check('All road coordinates, elevations, headings and widths survive renders unchanged',roadSnapshot()===before);
   check('No landscape asset warnings',!L.state.warnings.length,L.state.warnings);
   return {checks,timings};
  });
  report.checks=result.checks;report.timings=result.timings;
  for(const id of ['s5d','s4h','s2s']){await page.evaluate(id=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id===id);k.go(k.ROUTE.pieces.indexOf(p),p.L*.5,0);k.PC.v=0;k.step(0);},id);await page.screenshot({path:path.join(out,id+'.png')});}
  report.pass=report.checks.every(c=>c.pass)&&!report.errors.length&&!report.missing.length;
  assert(report.pass,'Landscape verification failed');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failures:report.checks.filter(c=>!c.pass),errors:report.errors,missing:report.missing,timings:report.timings,out}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
