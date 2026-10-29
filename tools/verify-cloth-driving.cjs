// Controlled real-game inputs; records the shipped player renderer at normal
// size. Traffic is cleared to isolate acceleration/braking/steering responses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const output=path.resolve(process.argv[2]||'cloth-driving'),root=path.resolve(__dirname,'..');
const carIndices=process.argv[3]?process.argv[3].split(',').map(Number):[0,4,9];
if(!carIndices.length||carIndices.some(i=>!Number.isInteger(i)||i<0||i>9))throw Error('Car indices must be a comma-separated subset of 0..9');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const report={errors:[],cars:[],scope:'Shipped controls, physics and player rendering. Traffic cleared for this controlled motion recording; 60 Hz simulation, 15 FPS recording.'};
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:90000});
  for(const car of carIndices){
   const id=await page.evaluate(car=>{const k=__kr;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(car,true);k.run();k.show(null);k.bot(false);k.go(0,100,0);k.PC.v=k.PC.spec.top/3.6*.85;k.PC.gear=k.PC.spec.gears;k.CTL.keys={};k.CTL.touches.clear();k.CTL.mode='keys';k.TRAFFIC.list.length=0;k.step(0);return k.PC.spec.id;},car);
   const folder=path.join(output,id);fs.mkdirSync(folder,{recursive:true});let samples=[];
   for(let batch=0;batch<8;batch++){
    const data=await page.evaluate(batch=>{
     const k=__kr,out=[],samples=[],cv=document.createElement('canvas');cv.width=960;cv.height=540;const g=cv.getContext('2d');
     for(let n=0;n<60;n++){
      const f=batch*60+n,t=f/60;
      k.CTL.keys={ArrowUp:t<4.2,ArrowRight:t>=1.5&&t<1.9,ArrowLeft:t>=2.8&&t<3.2,ArrowDown:t>=4.2&&t<6.8};k.TRAFFIC.list.length=0;k.step(1/60);
      const c=FORMOSA_PIXEL_CAR.state.cloth,last=FORMOSA_PIXEL_CAR.state.last;
      samples.push({t,v:k.PC.v,x:k.PC.x,steer:k.PC.steerIn,brake:k.PC.brake,accel:c.acceleration,lat:c.lateralAcceleration,width:last.width,crash:!!k.PC.crash,parts:c.parts.map(p=>({x:p.x,y:p.y,midX:p.midX,midY:p.midY}))});
      if(f%4===0){g.clearRect(0,0,960,540);g.drawImage(document.getElementById('gl'),0,0,960,540);g.drawImage(document.getElementById('hud'),0,0,960,540);out.push({f,data:cv.toDataURL()});}
     }return{out,samples};
    },batch);
    samples.push(...data.samples);for(const frame of data.out)fs.writeFileSync(path.join(folder,String(frame.f/4).padStart(4,'0')+'.png'),Buffer.from(frame.data.split(',')[1],'base64'));
   }
   report.cars.push({id,samples});
   assert(samples.every(s=>!s.crash),'Controlled run must not contain a collision');
   assert(new Set(samples.map(s=>s.width)).size===1,'Hair cannot resize the car');
   assert(samples.some(s=>s.lat>3)&&samples.some(s=>s.lat< -3),'Actual inputs must produce both lateral acceleration signs');
   assert(samples.some(s=>s.accel>.05)&&samples.some(s=>s.accel< -3),'Actual inputs must accelerate and brake');
   assert(samples.every(s=>s.parts.every(p=>Object.values(p).every(Number.isFinite))),'Material state remains finite');
   console.log(id+': actual driving recorded');
  }
  assert.equal(report.errors.length,0);report.pass=true;
 }catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,failure:report.failure,output}));}
})();
