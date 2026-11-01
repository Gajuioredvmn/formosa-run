const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(process.argv[3]||path.join(__dirname,'..')),out=path.resolve(process.argv[2]||'../formosa-work/traffic-views');fs.mkdirSync(out,{recursive:true});
(async()=>{const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),report={checks:[],errors:[],missing:[],scope:'Directional pseudo-3D artwork and physical footprint projection; not a native polygon renderer or phone FPS test.'};
try{const page=await browser.newPage({viewport:{width:960,height:540}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});
const data=await page.evaluate(()=>{const k=__kr;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);
 const types=Object.keys(k.VTYPES),angles=[0,.65,Math.PI/2,Math.PI-.65,Math.PI],c=document.createElement('canvas');c.width=1600;c.height=types.length*190;const g=c.getContext('2d');g.fillStyle='#202b36';g.fillRect(0,0,c.width,c.height);g.imageSmoothingEnabled=false;const rows=[];
 for(let row=0;row<types.length;row++){const type=types[row],hashes=[];for(let col=0;col<angles.length;col++){
  const s=FormosaTrafficViews.frame(type,angles[col]);if(!s)throw Error('Missing directional art: '+type);const image=s.page.lv[0],d=image.getContext('2d').getImageData(0,0,s.w,s.h).data;let n=0,hash=0;
  for(let i=0;i<d.length;i+=4)if(d[i+3]){n++;hash=(Math.imul(hash,31)+d[i]+d[i+1]*7+d[i+2]*13)|0;}hashes.push(hash);
  const h=Math.min(150,295*s.wh/s.worldWidth),w=h*s.worldWidth/s.wh;g.drawImage(image,col*320+(320-w)/2,row*190+28,w,h);g.fillStyle='white';g.font='14px sans-serif';g.fillText(type+' / '+s.meta.directional.view,col*320+8,row*190+18);
  const other=FormosaTrafficViews.frame(type,-angles[col]);rows.push({type,angle:angles[col],view:s.meta.directional,opaque:n,height:s.wh,worldWidth:s.worldWidth,mirror:other.flip===([1,2,3].includes(col)),mirrorWidthSame:Math.abs(s.worldWidth-other.worldWidth)<1e-9});
 }if(new Set(hashes).size!==5)throw Error(type+' missing distinct end/quarter/side art');}
 const continuous=[];for(const type of types)for(const a of [.2,1.12,2.02,Math.PI-.2]){const before=FormosaTrafficViews.frame(type,a-1e-6),after=FormosaTrafficViews.frame(type,a+1e-6);continuous.push({type,angle:a,widthDelta:Math.abs(before.worldWidth-after.worldWidth),heightDelta:Math.abs(before.wh-after.wh)});}
 return{rows,continuous,sheet:c.toDataURL(),warnings:FormosaWorldLife.state?.warnings||[]};
});report.rows=data.rows;report.continuous=data.continuous;fs.writeFileSync(path.join(out,'all-traffic-views.png'),Buffer.from(data.sheet.split(',')[1],'base64'));
for(const r of data.rows){assert(r.opaque>200&&r.view.complete,r.type+' complete five-view set');assert(r.mirror&&r.mirrorWidthSame,r.type+' opposite view and footprint');report.checks.push(r.type+' / '+r.view.view);}
assert(data.continuous.every(r=>r.heightDelta<.0001),'No height/scale pop at directional thresholds');report.checks.push('Continuous ground anchor and height through all 60 directional boundaries');
await page.evaluate(()=>{const k=__kr;k.go(0,450,0);k.PC.v=0;k.TRAFFIC.list=[];k.HAZ.list=[];for(const q of [['sedan',8,-3.7],['bus',35,2],['tanker',65,-2]])k.spawn(q[0],q[1],q[2],0);k.step(0);});await page.screenshot({path:path.join(out,'traffic-in-game.png')});
await page.evaluate(()=>{const k=__kr;k.TRAFFIC.list=[];k.spawn('taxi',14,-3,0);k.TRAFFIC.list.at(-1).oncoming=true;k.step(0);});await page.screenshot({path:path.join(out,'front-diagnostic.png')});
assert(!report.errors.length&&!report.missing.length,'runtime resources');report.pass=true;
}catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,errors:report.errors,failure:report.failure,out}));}})();
