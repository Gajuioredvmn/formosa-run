// One browser / one game page. Validate the actual selected-car ignition at
// desktop and phone aspect ratios; keep evidence outside the published bundle.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-ignition-'+Date.now()));
fs.mkdirSync(out,{recursive:true});
const report={checks:[],cars:[],errors:[],missing:[],limitations:['Actual desktop Chromium rendering and mobile viewport; updated Android APK is not measured by this tool.','The recorded ignition is a presentation sample, not an FPS benchmark.']};
function check(name,pass,data){report.checks.push({name,pass,...(data?{data}:{})});assert(pass,name);}
(async()=>{
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:90000});
  await page.evaluate(()=>{
   __kr.halt(true);__kr.G.mode='play';__kr.show(null);delete __kr.G.noIgnite;
   window.__ignitionFrameCopies=0;
   const original=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='gl'&&image===this.canvas)__ignitionFrameCopies++;return original.call(this,image,...args);};
  });
  for(const viewport of [{width:1280,height:720},{width:874,height:411}]){
   await page.setViewportSize(viewport);
   for(let car=0;car<10;car++){
    const result=await page.evaluate(car=>{
     const k=__kr;k.G.mode='play';delete k.G.noIgnite;k.race(car,true);k.show(null);k.step(0);
     const samples=[];
     for(const at of [.4,1.05,1.65,2.35,3.08]){
      k.sim(Math.max(0,at-k.IGN.t));k.step(0);
      samples.push({at:k.IGN.t,layout:JSON.parse(JSON.stringify(k.IGN.layout)),car:FORMOSA_PIXEL_CAR.state.last.id,width:FORMOSA_PIXEL_CAR.state.last.width,v:k.PC.v,s:k.PC.s,race:k.RACE.state,crank:k.IGN.crank,caught:k.IGN.caught});
     }
     const expected=k.CREW[k.PC.spec.id].map(c=>c.name),id=k.PC.spec.id;
     k.sim(.3);k.step(0);const countdown={on:k.IGN.on,state:k.RACE.state,time:k.RACE.countdown,width:FORMOSA_PIXEL_CAR.state.last.width};
     // Return to the genuine starter phase for the screenshot, without a new
     // substitute art path or advancing race motion.
     k.race(car,true);k.show(null);k.sim(1.65);k.step(0);
     return{id,expected,samples,countdown,copies:__ignitionFrameCopies,logical:{width:k.IGN.layout.logicalWidth,height:k.IGN.layout.logicalHeight}};
    },car);
    const name=viewport.width+'-'+result.id;
    check(name+': selected car and both existing crew portraits render in every ignition phase',result.samples.every(s=>s.car===result.id&&s.layout.carId===result.id&&s.layout.portraits.length===2&&s.layout.portraits.every((p,i)=>p.ready&&p.name===result.expected[i])));
    check(name+': car stays stationary, keeps its width and enters the original countdown',result.samples.every(s=>s.v===0&&s.width===result.countdown.width&&s.s===result.samples[0].s)&&!result.countdown.on&&result.countdown.state==='countdown'&&result.countdown.time>4);
    check(name+': cards stay inside the phone/desktop logical viewport',result.samples.every(s=>s.layout.portraits.every(p=>p.x>=0&&p.x+p.w<=result.logical.width&&p.y>=0&&p.y+p.h<=270)));
    check(name+': no live-canvas self copy during crank or transition',result.copies===0);
    await page.screenshot({path:path.join(out,name+'.png')});report.cars.push({viewport,...result});
   }
  }
  await page.setViewportSize({width:960,height:540});
  const video=await page.evaluate(async()=>{
   const k=__kr;k.G.mode='play';delete k.G.noIgnite;k.race(0,true);k.show(null);k.step(0);
   const chunks=[],stream=document.getElementById('gl').captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(r=>recorder.onstop=r);
   recorder.start();k.halt(false);await new Promise(r=>setTimeout(r,4050));k.halt(true);recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
   const blob=new Blob(chunks,{type:'video/webm'}),bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
   return{base64:btoa(binary),endState:k.RACE.state,ignitionTime:k.IGN.t,elapsed:k.RACE.elapsed};
  });
  fs.writeFileSync(path.join(out,'ignition-selected-car.webm'),Buffer.from(video.base64,'base64'));delete video.base64;report.video=video;
  check('Real-time ignition video reaches countdown without driving the car',video.endState==='countdown'&&video.elapsed===0);
  check('No JavaScript errors or missing game assets',!report.errors.length&&!report.missing.length);
  report.pass=true;
 }catch(e){report.pass=false;report.error=String(e.stack||e);}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error,out}));if(!report.pass)process.exitCode=1;}
})();
