// Reproducible touch input QA. Uses trusted CDP/browser input, not mocked game control values.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const os=require('node:os');
if(process.argv.includes('--help')){console.log('Usage: node tools/verify-mobile.cjs [output-directory]\nRuns trusted browser touch events in a fresh 844x390 desktop Chromium/Edge context. Not a physical phone, sensor test or 60 FPS benchmark.');process.exit(0);}
if(process.argv.length>3)throw new Error('Usage: node tools/verify-mobile.cjs [output-directory]');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const repo=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(os.tmpdir(),'formosa-mobile-'+Date.now()));fs.mkdirSync(out,{recursive:true});
const server=require(path.join(repo,'tools/serve.cjs')).createServer(path.dirname(repo));
const report={started:new Date().toISOString(),sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'index.html'))).digest('hex'),viewport:{width:844,height:390},emulation:{hasTouch:true,isMobile:true,deviceScaleFactor:1},errors:[],missing:[],checks:[],limitations:['Desktop Edge mobile emulation with trusted browser touch events; not a physical phone or performance benchmark.','No synthetic gyro/sensor data; touch steering is explicitly chosen through the setup screen.']};
const check=(name,ok,data)=>{report.checks.push({name,pass:!!ok,data});assert(ok,name)};
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 const context=await browser.newContext({...report.emulation,viewport:report.viewport});const page=await context.newPage(),cdp=await context.newCDPSession(page);let points=[];
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()})});
 await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(repo))}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.PC.piece&&window.FORMOSA_PIXEL_CAR?.state.ready,null,{timeout:90000});
 await page.evaluate(()=>{window.mobileTouchEvidence=[];for(const name of ['pointerdown','pointerup','pointercancel'])document.addEventListener(name,e=>mobileTouchEvidence.push({type:e.type,pointerType:e.pointerType,trusted:e.isTrusted,x:e.clientX,y:e.clientY,target:e.target.id||e.target.tagName}),true)});
 const read=()=>page.evaluate(()=>({race:__kr.RACE.state,v:__kr.PC.v,s:__kr.PC.s,x:__kr.PC.x,vx:__kr.PC.vx,throttle:__kr.PC.throttle,brake:__kr.PC.brake,steer:__kr.PC.steerIn,auto:__kr.PC.auto,gear:__kr.PC.gear,neutral:__kr.PC.neutral,paused:__kr.G.paused,ui:__kr.UI.scr,mode:__kr.CTL.mode,touches:[...__kr.CTL.touches.values()].map(t=>t.kind)}));
 const send=async(type,p)=>{points=p;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(q=>({...q,radiusX:2,radiusY:2,force:1}))})};
 const point=(id,x,y)=>({id,x,y});const centre=r=>({x:r.x+r.w/2,y:r.y+r.h/2});const pad=async name=>centre(await page.evaluate(name=>__kr.CTL.pads[name],name));
 const stop=()=>send('touchEnd',[]);
 await page.locator('#tap:visible').tap();await page.locator('[data-go="select"]:visible').first().tap();await page.locator('[data-act="pick"]:visible').tap();
 await page.locator('#seg-ctrl [data-v="touch"]').tap();await page.locator('[data-act="go"]:visible').tap();
 check('Fresh mobile setup starts the complete ignition',await page.evaluate(()=>__kr.IGN.on&&__kr.RACE.state==='ignition'));
 await page.waitForFunction(()=>__kr.RACE.state==='run',null,{timeout:25000});
 report.layout=await page.evaluate(()=>({w:innerWidth,h:innerHeight,maxTouchPoints:navigator.maxTouchPoints,pads:__kr.CTL.pads,portraitOverlay:getComputedStyle(document.getElementById('rot')).display}));
 check('844×390 layout uses touch steering without portrait overlay',report.layout.w===844&&report.layout.h===390&&report.layout.maxTouchPoints>0&&report.layout.portraitOverlay==='none'&&(await read()).mode==='touchforced',report.layout);
 for(const name of ['gas','brake','pause','steer']){const r=report.layout.pads[name];check(name+' touch area fits the viewport',r.x>=0&&r.y>=0&&r.x+r.w<=844.01&&r.y+r.h<=390.01,r)}
 await page.screenshot({path:path.join(out,'mobile-at-controls.png')});
 const gas=await pad('gas'),brake=await pad('brake'),steer=await pad('steer');
 const start=await read();await send('touchStart',[point(1,gas.x,gas.y)]);await page.waitForTimeout(2500);const accelerated=await read();check('Holding the real touch accelerator moves the car',accelerated.throttle===1&&accelerated.v>start.v+5&&accelerated.s>start.s,{start,accelerated});
 await stop();await page.waitForTimeout(160);const released=await read();check('Touch release clears the accelerator',released.throttle===0&&released.touches.length===0,released);
 await send('touchStart',[point(1,brake.x,brake.y)]);await page.waitForTimeout(500);const braked=await read();check('Holding the touch brake slows the car',braked.brake===1&&braked.v<released.v-2,{released,braked});await stop();await page.waitForTimeout(120);check('Brake release clears the pedal',(await read()).brake===0);
 await send('touchStart',[point(1,gas.x,gas.y)]);await page.waitForTimeout(1200);await send('touchStart',[point(1,gas.x,gas.y),point(2,steer.x,steer.y)]);await send('touchMove',[point(1,gas.x,gas.y),point(2,steer.x-75,steer.y)]);await page.waitForTimeout(400);const left=await read();check('Two-finger throttle plus left drag steers left',left.throttle===1&&left.steer<-.8&&left.vx<0,left);
 await send('touchEnd',[point(1,gas.x,gas.y)]);await page.waitForTimeout(150);await send('touchStart',[point(1,gas.x,gas.y),point(2,steer.x,steer.y)]);await send('touchMove',[point(1,gas.x,gas.y),point(2,steer.x+75,steer.y)]);await page.waitForTimeout(500);const right=await read();check('Two-finger throttle plus right drag steers right',right.throttle===1&&right.steer>.8&&right.vx>0,right);await stop();await page.waitForTimeout(200);
 const pause=await pad('pause');await page.touchscreen.tap(pause.x,pause.y);await page.waitForFunction(()=>__kr.G.paused&&__kr.UI.scr==='pause');const paused=await read();await page.waitForTimeout(350);const still=await read();check('Touch pause freezes race progress',paused.s===still.s&&paused.v===still.v,{paused,still});await page.screenshot({path:path.join(out,'mobile-pause.png')});
 await page.locator('[data-act="restart"]:visible').tap();const restarted=await read();check('Touch restart resets speed and plays full ignition',restarted.race==='ignition'&&restarted.v===0&&!restarted.paused&&restarted.s===start.s,restarted);
 await page.touchscreen.tap(pause.x,pause.y);await page.waitForFunction(()=>__kr.UI.scr==='pause');await page.locator('[data-act="quit"]:visible').tap();await page.locator('[data-go="select"]:visible').first().tap();await page.locator('[data-act="pick"]:visible').tap();await page.locator('#seg-auto [data-v="mt"]').tap();await page.locator('#seg-ctrl [data-v="touch"]').tap();await page.locator('[data-act="go"]:visible').tap();await page.waitForFunction(()=>__kr.RACE.state==='run',null,{timeout:25000});
 report.manualLayout=await page.evaluate(()=>({auto:__kr.PC.auto,seq:__kr.PC.seq,pads:__kr.CTL.pads}));check('Actual MT setup enables H-gate',!report.manualLayout.auto&&!report.manualLayout.seq,report.manualLayout);
 for(const name of ['gate','box']){const r=report.manualLayout.pads[name];check('MT '+name+' guide fits the viewport',r.x>=0&&r.y>=0&&r.x+r.w<=844.01&&r.y+r.h<=390.01,r)}
 const gate=centre(report.manualLayout.pads.gate);await send('touchStart',[point(1,gate.x,gate.y-25)]);await send('touchMove',[point(1,gate.x,gate.y+67)]);await page.waitForTimeout(250);const shifted=await read();check('Actual H-gate drag shifts from first to second',shifted.gear===2&&!shifted.neutral,shifted);await page.screenshot({path:path.join(out,'mobile-mt-hgate.png')});await stop();
 await send('touchStart',[point(1,gate.x,gate.y)]);await send('touchMove',[point(1,gate.x+3,gate.y-3)]);await stop();
 check('A small trusted thumb movement does not change the selected gear',(await read()).gear===2&&!(await read()).neutral);
 await send('touchStart',[point(1,gate.x,gate.y)]);await send('touchMove',[point(1,gate.x,gate.y-40)]);await send('touchMove',[point(1,gate.x+37,gate.y-40)]);await send('touchMove',[point(1,gate.x+37,gate.y-80)]);await stop();
 check('Trusted H cross-gate gesture shifts second to third',(await read()).gear===3&&!(await read()).neutral);
 await send('touchStart',[point(1,gate.x,gate.y)]);await send('touchMove',[point(1,gate.x,gate.y+40)]);await send('touchCancel',[]);
 check('OS cancellation during a half-shift restores third gear',(await read()).gear===3&&!(await read()).neutral);
 await send('touchStart',[point(1,gate.x,gate.y)]);await send('touchMove',[point(1,gate.x,gate.y+40)]);await page.waitForTimeout(260);await stop();
 check('Holding the neutral channel deliberately selects neutral',(await read()).neutral);
 await send('touchStart',[point(1,gate.x,gate.y)]);await send('touchMove',[point(1,gate.x,gate.y-40)]);await stop();
 check('A short positive stroke re-engages third from neutral',(await read()).gear===3&&!(await read()).neutral);

 const cancelGas=await pad('gas');await send('touchStart',[point(1,cancelGas.x,cancelGas.y)]);await page.waitForTimeout(180);
 check('Touch pedal is engaged before OS-style cancellation',(await read()).throttle===1);
 await send('touchCancel',[]);await page.waitForTimeout(150);const cancelled=await read();
 check('Trusted touchCancel clears held gas, brake and touch ownership',cancelled.throttle===0&&cancelled.brake===0&&cancelled.touches.length===0,cancelled);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 check('Portrait rotation displays the landscape guidance',await page.evaluate(()=>getComputedStyle(document.getElementById('rot')).display!=='none'));
 await page.setViewportSize({width:667,height:375});await page.waitForTimeout(150);
 const small=await page.evaluate(()=>({w:innerWidth,h:innerHeight,overlay:getComputedStyle(document.getElementById('rot')).display,pads:__kr.CTL.pads,touches:__kr.CTL.touches.size}));
 check('Rotating back to small landscape clears the guidance and held touch',small.overlay==='none'&&small.touches===0,small);
 check('All active MT controls fit a 667 by 375 landscape viewport',['gas','brake','pause','steer','gate','box'].every(name=>{const r=small.pads[name];return r.x>=0&&r.y>=0&&r.x+r.w<=667.01&&r.y+r.h<=375.01;}),small.pads);
 await page.screenshot({path:path.join(out,'mobile-small-landscape.png')});
 // This is a HUD layout fixture, not a substitute for verify-multiplayer's
 // eight genuine WebRTC contexts. It tests simultaneous touch MT controls.
 const rankLayout=await page.evaluate(()=>{const a=__kr,n=a.NET;a.halt(true);n.on=true;n.host=true;n.phase='race';n.id='layout-host';n.me.clientId='layout-host';n.racers=new Map(Array.from({length:8},(_,i)=>{const id=i?'layout-'+i:'layout-host';return[id,{id,clientId:id,name:'車手'+i,slot:i,car:i,progress:(8-i)/20,seenAt:Date.now()}];}));a.step(0);return{rank:n.hudLayout,pads:a.CTL.pads};});
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 check('Eight-player standings do not cover touch pedals or the left shift animation',rankLayout.rank.count===8&&['gas','brake','box'].every(key=>!overlap(rankLayout.rank,rankLayout.pads[key])),rankLayout);
 await page.screenshot({path:path.join(out,'mobile-mt-ranking.png')});await page.evaluate(()=>{__kr.netLeave();__kr.halt(false)});
 report.touchEvidence=await page.evaluate(()=>mobileTouchEvidence);check('Browser delivered trusted touch pointer events to the canvas',report.touchEvidence.some(e=>e.trusted&&e.pointerType==='touch'&&e.target==='gl'));
 check('No uncaught browser errors',report.errors.length===0,report.errors);check('No missing game assets',report.missing.length===0,report.missing);report.pass=true;
 await context.close();
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.map(c=>({name:c.name,pass:c.pass})),errors:report.errors,missing:report.missing,failure:report.failure,output:out},null,2))}})();
