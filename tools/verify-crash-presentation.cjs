// Real collision callbacks + ten-car software sprite mesh, in one browser.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-crash-'+Date.now()));
const report={assertions:[],errors:[],limitations:['Existing rear artwork supports contact-driven side tipping and sliding, not a fully illustrated 360-degree barrel roll.']};
fs.mkdirSync(output,{recursive:true});const check=(name,value)=>{assert(value,name);report.assertions.push(name);};
(async()=>{
 const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/formosa-run/',route=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('window.__kr = {','window.__kr = { crashDebug:{pcCrash,pcStep,fxUpdate},');return route.fulfill({status:200,contentType:'text/html',body:html});});
  await page.goto(`http://127.0.0.1:${server.address().port}/formosa-run/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:90000});
  await page.evaluate(()=>{__kr.halt(true);});
  report.collisions=[];
  for(const mode of ['front','left','right','glance']){
   const start=await page.evaluate(mode=>{
    const k=__kr;k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.show(null);k.bot(false);k.PC.s=100;k.PC.x=0;k.PC.v=55;k.PC.vx=0;k.PC.steerIn=0;k.PC.throttle=0;k.PC.brake=0;k.PC.yaw=0;k.PC.gear=4;k.TRAFFIC.list=[];k.step(0);
    const side=mode==='left'?-1:1;k.spawn('bus',mode==='front'?3:1.5,mode==='front'?0:side*1.55,mode==='front'?0:55*k.WORLD_K);
    const other=k.TRAFFIC.list.at(-1);other.x=k.PC.x+(mode==='front'?0:side*1.55);other.s=k.PC.s+(mode==='front'?3:1.5);other.contactVx=mode==='glance'||mode==='front'?0:-side*12;k.PC.vx=mode==='front'?0:side*(mode==='glance'?3:28);
    k.trafficPlayerContact(other);return{mode,crash:k.PC.crash&&{...k.PC.crash},v:k.PC.v,vx:k.PC.vx};
   },mode);const frames=[];
   for(let frame=0;frame<=150;frame++){
    const sample=await page.evaluate(({frame})=>{const k=__kr;const png=k.step(frame?1/60:0),last=FORMOSA_PIXEL_CAR.state.last;return{time:frame/60,x:k.PC.x,v:k.PC.v,airY:k.PC.airY,crash:!!k.PC.crash,bank:last.bank,width:last.width,zoom:last.zoom,yaw:last.yaw,compression:last.compression,style:last.crashStyle,png:[0,5,14,24,46,58,85,110,150].includes(frame)?png:null};},{frame});
    if(sample.png){fs.writeFileSync(path.join(output,mode+'-'+String(frame).padStart(3,'0')+'.png'),Buffer.from(sample.png.split(',')[1],'base64'));delete sample.png;}frames.push(sample);
   }
   report.collisions.push({...start,frames});
  }
  const [front,left,right,glance]=report.collisions;
  check('Actual central bus impact has compression without bank, random spin or invented flight',front.crash&&front.crash.spin===0&&front.frames.every(p=>p.airY===0&&Math.abs(p.bank)<.001)&&front.frames.some(p=>p.compression>.02));
  check('Actual opposing side contacts yield opposite nonzero bounded tip amplitudes',left.crash?.rollK>.2&&right.crash?.rollK<-.2&&Math.abs(left.crash.rollK+right.crash.rollK)<1e-6);
  check('Low closing-speed glancing collision does not enter a crash or launch',!glance.crash&&glance.frames.every(p=>p.airY===0));
  check('Both side impacts retain sideways motion and recover on the road',left.frames.some(p=>Math.abs(p.x-left.frames[0].x)>.1)&&right.frames.some(p=>Math.abs(p.x-right.frames[0].x)>.1)&&!left.frames.at(-1).crash&&!right.frames.at(-1).crash);
  check('Crash presentation preserves the original vehicle scale',report.collisions.every(c=>c.frames.every(p=>p.width===c.frames[0].width&&p.zoom===1)));
  const cars=await page.evaluate(async()=>{
   const k=__kr,api=FORMOSA_PIXEL_CAR,m=await import('./render/vehicle-motion.js'),sheet=document.createElement('canvas');sheet.width=1200;sheet.height=1800;const sg=sheet.getContext('2d');sg.fillStyle='#253146';sg.fillRect(0,0,sheet.width,sheet.height);sg.font='18px sans-serif';sg.fillStyle='white';
   const output=[];for(let ci=0;ci<10;ci++){
    k.car(ci);const spec=k.PC.spec,spr=k.PC.spr,samples=[];for(let n=0;n<6;n++){
     const t=[0,.09,.25,.39,.78,1.3][n],pc={...k.PC,spec,v:35,vx:0,yaw:.12,airY:0,visual:{time:t,dt:1/60,contacts:[],lateralAccel:0,tyreLimit:12},crash:{t,severity:1,rollK:.82,spin:1.3,style:'side-tip'}};
     const cv=document.createElement('canvas');cv.width=400;cv.height=280;const g=cv.getContext('2d');api.draw(g,{pc,spr,x:200,ground:260,crew:k.CREW[spec.id]});
     const data=g.getImageData(0,0,400,280).data;let count=0,x0=400,y0=280,x1=0,y1=0;for(let p=3;p<data.length;p+=4)if(data[p]>128){const x=((p-3)/4)%400,y=Math.floor((p-3)/4/400);count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
     samples.push({t,width:api.state.last.width,zoom:api.state.last.zoom,bank:api.state.last.bank,count,box:[x0,y0,x1,y1]});
     if([0,3,5].includes(n)){const col=n===0?0:n===3?1:2;sg.drawImage(cv,col*400,ci*180,400,180);sg.fillStyle='white';sg.fillText(spec.id+' / '+t+' s',col*400+10,ci*180+20);}
     const fields=()=>JSON.stringify({v:pc.v,vx:pc.vx,yaw:pc.yaw,airY:pc.airY,visual:pc.visual,crash:pc.crash}),snapshot=fields();m.crashPresentation(spec,pc,{});if(fields()!==snapshot)throw Error('Presentation mutated physics');
    }output.push({id:spec.id,samples});
   }return{cars:output,png:sheet.toDataURL('image/png')};
  });report.cars=cars.cars;fs.writeFileSync(path.join(output,'ten-car-contact-sheet.png'),Buffer.from(cars.png.split(',')[1],'base64'));
  check('All ten rear sprites preserve scale and remain inside the crash render workspace',cars.cars.length===10&&cars.cars.every(c=>c.samples.every(s=>s.width===c.samples[0].width&&s.zoom===1&&s.box[0]>0&&s.box[1]>0&&s.box[2]<399&&s.box[3]<279)));
  check('Tipping retains at least 70 percent of each visible sprite area',cars.cars.every(c=>c.samples.every(s=>s.count>=c.samples[0].count*.7)));
  check('No JavaScript exceptions during actual collision and all-car rendering',report.errors.length===0);
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();server.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({assertions:report.assertions.length,errors:report.errors,failure:report.failure,output}));}
})();
