// Real browser checks for the visual-only suspension and seated-crew adapter.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-motion-'+Date.now()));
const report={assertions:[],errors:[],limitations:['Automated presentation checks cannot approve the artistic quality of each illustration or replace phone performance testing.']};
fs.mkdirSync(output,{recursive:true});const check=(name,value)=>{assert(value,name);report.assertions.push(name);};
(async()=>{
 const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.ready,null,{timeout:90000});
  const data=await page.evaluate(async()=>{
   const m=await import('./render/vehicle-motion.js'),k=__kr;k.halt(true);
   const cars=[];let pure=true,noFlatLift=true,bounded=true,noTimeAdvance=true;
   for(const spec of k.CARS){
    const pc={spec,visual:{time:0},steerIn:1,v:40,vx:3,yaw:.09,x:2,s:100,crash:null,drift:0,offroad:false},physical={bank:.052,bend:.08,yaw:.08,compression:.02,lift:0,direction:1};let q;
    for(let frame=0;frame<90;frame++){
     pc.visual.time=frame/60;const before=JSON.stringify(pc),p=JSON.stringify(physical),r=m.vehiclePresentation(spec,pc,physical,q);q=r.state;
     pure&&=before===JSON.stringify(pc)&&p===JSON.stringify(physical);noFlatLift&&=r.pose.lift===0;bounded&&=Math.abs(r.pose.bank)<=.45&&r.pose.bend<=.14&&Math.abs(r.pose.yaw)<=.16;
    }
    const settled=m.vehiclePresentation(spec,pc,physical,q),before=JSON.stringify(q);m.vehiclePresentation(spec,pc,physical,q);noTimeAdvance&&=before===JSON.stringify(q);
    const contact=m.vehiclePresentation(spec,pc,{...physical,lift:.6},q).pose;
    const action=m.crewAction(spec,{...pc,steerIn:0},{t:.3,dur:1},{x:2,y:-1});
    const cv=document.createElement('canvas');cv.width=320;cv.height=200;const g=cv.getContext('2d');g.translate(90,80);
    const gestures=m.drawCrewGestures(g,{spec,crew:k.CREW[spec.id],art:{},w:136,h:70,action,project:(x,y)=>[x,y]});
    cars.push({id:spec.id,profile:settled.pose.profile,bank:settled.pose.bank,bend:settled.pose.bend,yaw:settled.pose.yaw,contactLift:contact.lift,gestures,combo:action.profile.driver+'|'+action.profile.passenger});
   }
   const spec=k.CARS[0],pc={spec,visual:{time:1},steerIn:0,v:40},cheer={t:.3,dur:1};
   const safeChecks={absent:!m.crewAction(spec,pc,null).active,crash:!m.crewAction(spec,{...pc,crash:{}},cheer).active,drift:!m.crewAction(spec,{...pc,drift:.3},cheer).active,offroad:!m.crewAction(spec,{...pc,offroad:true},cheer).active,steer:!m.crewAction(spec,{...pc,steerIn:.6},cheer).active};
   const regionArt={crewRegions:[[.25,.01,.2,.3],[.55,.01,.2,.3]]},action=m.crewAction(spec,pc,cheer,{x:4,y:1});
   const untouched=m.warpCrew(40,60,136,70,action,regionArt),animated=m.warpCrew(47.6,11.2,136,70,action,regionArt);
   return{cars,pure,noFlatLift,bounded,noTimeAdvance,safeChecks,untouched,animated};
  });report.motion=data;
  check('All ten cars have unique physical-response and crew-action profiles',data.cars.length===10&&new Set(data.cars.map(c=>c.profile)).size===10&&new Set(data.cars.map(c=>c.combo)).size===10);
  check('Identical measured loads produce ten distinct bounded poses',new Set(data.cars.map(c=>[c.bank,c.bend,c.yaw].map(n=>n.toFixed(4)).join('|'))).size===10&&data.bounded);
  check('Presentation never writes physics state or observer inputs',data.pure);
  check('Flat-road turning cannot create wheel lift',data.noFlatLift);
  check('Only original observer contact lift is carried through',data.cars.every(c=>c.contactLift===.6));
  check('Repeated render at the same physics time cannot advance animation',data.noTimeAdvance);
  check('Celebrations stop on crashes, drift, offroad and steering; no trigger is invented',Object.values(data.safeChecks).every(Boolean));
  check('Driver gestures never add more than one arm',data.cars.every(c=>c.gestures.filter(g=>g.who===0).length<=1));
  check('The original dog passenger never receives a human hand',data.cars.find(c=>c.id==='arancia').gestures.every(g=>g.who!==1));
  check('Head animation warps existing pixels and leaves the lower body fixed',data.untouched[0]===40&&data.untouched[1]===60&&Math.abs(data.animated[0]-47.6)>.1);
  const cloth=await page.evaluate(async()=>{
   const m=await import('./render/vehicle-motion.js'),{VEHICLE_ART}=await import('./render/vehicle-art-manifest.js'),spec=__kr.CARS[9],art=VEHICLE_ART.oro;
   function run(hz,wind=false){const pc={spec,visual:{time:0,lateralAccel:0},v:0,vx:0,wind:0},history=[];let state,pure=true;
    for(let f=0;f<=hz*6;f++){const time=f/hz;pc.visual.time=time;pc.visual.lateralAccel=time>=.5&&time<1.5?10:0;pc.v=wind&&time<3?50:0;const before=JSON.stringify(pc);state=m.clothMotion(spec,pc,art,state);pure&&=before===JSON.stringify(pc);history.push({time,x:state.parts[0].x,y:state.parts[0].y});}
    return{history,pure};}
   const a=run(30),b=run(60),w=run(60,true),state={parts:[{x:3,y:4}]},root=art.cloth[0].root,tip=art.cloth[0].tip;
   const rootP=m.warpCloth(root[0]*136,root[1]*80,136,80,art,state),tipP=m.warpCloth(tip[0]*136,tip[1]*80,136,80,art,state);
   return{a,b,w,rootError:Math.hypot(rootP[0]-root[0]*136,rootP[1]-root[1]*80),tipMotion:Math.hypot(tipP[0]-tip[0]*136,tipP[1]-tip[1]*80)};
  });report.cloth=cloth;
  check('Hair, scarf and veil simulation never mutates the car state',cloth.a.pure&&cloth.b.pure&&cloth.w.pure);
  check('A lateral impulse produces opposite delayed material deflection',cloth.b.history[30].x<0&&Math.abs(cloth.b.history[30].x)<Math.abs(cloth.b.history[60].x)*.1);
  check('Material motion damps to rest when acceleration and wind stop',Math.abs(cloth.b.history.at(-1).x)<.001&&Math.abs(cloth.w.history.at(-1).y)<.001);
  check('Stationary cloth has no artificial idle sine-wave animation',cloth.b.history.slice(0,30).every(p=>p.x===0&&p.y===0));
  check('Air speed blows the free end back before it settles after stopping',cloth.w.history[150].y>1&&Math.abs(cloth.w.history.at(-1).y)<.001);
  check('30 and 60 FPS material responses stay within 0.15 logical pixels',cloth.a.history.every((p,i)=>Math.abs(p.x-cloth.b.history[i*2].x)<.15&&Math.abs(p.y-cloth.b.history[i*2].y)<.15));
  check('The material root is pinned while the free tip can bend',cloth.rootError<1e-8&&cloth.tipMotion>1);
  const render=await page.evaluate(()=>{
   const k=__kr,m=FORMOSA_PIXEL_CAR;k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.show(null);k.bot(false);k.PC.v=40;k.PC.gear=3;k.step(0);
   k.PC.steerIn=0;k.PC.drift=0;k.PC.offroad=false;k.FX.cheer={t:.3,dur:1,kind:'wave',who:1};k.step(0);
   const actual={...m.state.last},cv=document.createElement('canvas');cv.width=360;cv.height=240;const g=cv.getContext('2d'),o={pc:k.PC,spr:k.PC.spr,x:180,ground:200,crew:k.CREW[k.PC.spec.id],cheer:k.FX.cheer};
   const samples=[];for(let frame=0;frame<60;frame++){
    const pc={...k.PC,visual:{...k.PC.visual,time:frame/60},crash:null};m.draw(g,{...o,pc});samples.push({width:m.state.last.width,zoom:m.state.last.zoom});
   }
   m.draw(g,{...o,pc:{...k.PC,crash:{t:.1}},spinning:false});const crash={...m.state.last};m.draw(g,{...o,spinning:true,spinAngle:1});const spin={...m.state.last};
   return{actual,samples,crash,spin};
  });report.renderer=render;
  check('The actual player draw path receives its original cheer and cast',render.actual.celebrating&&render.actual.gestures.length>0);
  check('Celebrating never rescales the car or camera',render.samples.every(s=>s.width===render.actual.width&&s.zoom===1));
  check('Crashing and spinning suppress added gesture arms',!render.crash.celebrating&&render.crash.gestures.length===0&&!render.spin.celebrating&&render.spin.gestures.length===0);
  await page.screenshot({path:path.join(output,'actual-cheer.png')});
  report.actualCars=[];
  for(let i=0;i<10;i++){
   const rendered=await page.evaluate(i=>{const k=__kr;k.G.mode='play';k.G.noIgnite=true;k.race(i,true);k.run();k.show(null);k.bot(false);k.PC.v=40;k.PC.gear=3;k.PC.steerIn=0;k.PC.drift=0;k.PC.offroad=false;k.FX.cheer={t:.3,dur:1,kind:'wave',who:1};k.step(0);return{...FORMOSA_PIXEL_CAR.state.last};},i);
   report.actualCars.push(rendered);check(rendered.id+': actual car and its cast celebrate from the calibrated atlas',rendered.celebrating&&rendered.source.includes('vehicle-'+rendered.id)&&rendered.zoom===1);
   await page.screenshot({path:path.join(output,'cheer-'+rendered.id+'.png')});
  }
  check('No browser exceptions during motion and gesture checks',report.errors.length===0);report.pass=true;
 }catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,assertions:report.assertions.length,failure:report.failure,output},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
