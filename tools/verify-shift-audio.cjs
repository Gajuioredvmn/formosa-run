const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const{createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-shift-audio-'+Date.now()));fs.mkdirSync(output,{recursive:true});
const report={assertions:[],errors:[],limitations:['Rendered mechanical sound design and true input/event checks; final speaker loudness and individual hearing preference need listening on target devices.']},check=(name,pass)=>{assert(pass,name);report.assertions.push(name);};
function wav(a,rate){const b=Buffer.alloc(44+a.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);a.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));return b;}
(async()=>{
 const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>__kr?.audioDebug.adapter,null,{timeout:90000});
  const waves=await page.evaluate(async()=>{
   const m=__kr.audioDebug.adapter,ctx=new OfflineAudioContext(1,96000,48000),samples=[];
   for(const [i,mode]of['at','mt','seq'].entries()){
    const b=m.createShiftBuffer(ctx,{mode,to:2,from:1}),a=b.getChannelData(0);let energy=0,peak=0;for(const v of a){energy+=v*v;peak=Math.max(peak,Math.abs(v));}
    samples.push({mode,duration:b.duration,first:a[0],last:a.at(-1),finite:[...a].every(Number.isFinite),rms:Math.sqrt(energy/a.length),peak});m.playShift(ctx,ctx.destination,{mode,to:2,from:1,when:.1+i*.6});
   }
   const rendered=await ctx.startRendering();const muted=new OfflineAudioContext(1,24000,48000),g=muted.createGain();g.gain.value=0;g.connect(muted.destination);m.playShift(muted,g,{mode:'mt'});const silent=await muted.startRendering();
   return{samples,wave:Array.from(rendered.getChannelData(0)),silent:[...silent.getChannelData(0)].every(v=>v===0)};
  });report.waveforms=waves.samples;fs.writeFileSync(path.join(output,'shift-sound-preview.wav'),wav(waves.wave,48000));
  check('AT, MT and sequential each have a distinct damped mechanical envelope',new Set(waves.samples.map(s=>s.rms.toFixed(5))).size===3&&waves.samples.every(s=>s.duration<.35&&s.rms>.005&&s.peak<.5&&s.finite));
  check('All shift envelopes start and finish at zero',waves.samples.every(s=>Math.abs(s.first)<1e-8&&Math.abs(s.last)<1e-8));check('Effects mute also silences shift sounds',waves.silent);
  await page.evaluate(()=>{__kr.halt(true);__kr.show('title');});await page.locator('#tap:visible').click();
  const reset=async(index,auto,seq)=>page.evaluate(({index,auto,seq})=>{const k=__kr;k.G.mode='play';k.G.noIgnite=true;k.race(index,auto);k.PC.seq=seq;k.UI.gearbox=auto?'at':seq?'seq':'mt';k.run();k.show(null);k.bot(false);k.TRAFFIC.list.length=0;k.TRAFFIC.density=0;k.PC.crash=null;k.CTL.keys={};return k.audioDebug.adapter.diagnostics.shiftEvents().length;},{index,auto,seq});
  const snapshot=()=>page.evaluate(()=>({gear:__kr.PC.gear,neutral:__kr.PC.neutral,shiftT:__kr.PC.shiftT,events:__kr.audioDebug.adapter.diagnostics.shiftEvents()}));
  let before=await reset(0,true,false);await page.evaluate(()=>{const k=__kr;k.PC.v=k.PC.vmax[1]*.96;k.PC.shiftT=0;k.CTL.keys.ArrowUp=true;k.step(1/60);});let after=await snapshot();report.at=after;
  check('Actual automatic upshift produces exactly one AT engagement',after.gear===2&&after.events.length===before+1&&after.events.at(-1).mode==='at');
  await page.evaluate(()=>__kr.step(.05));let held=await snapshot();check('Automatic shift cut does not retrigger sound on following frames',held.events.length===after.events.length&&held.shiftT>0);
  before=await reset(2,false,false);await page.keyboard.press('Digit3');after=await snapshot();report.mt=after;
  check('A valid manual H-pattern keyboard selection produces one mechanical shift',after.gear===3&&after.events.length===before+1&&after.events.at(-1).mode==='mt'&&after.shiftT===.18);
  await page.keyboard.press('Digit3');await page.keyboard.press('Digit6');held=await snapshot();check('Same gear and an unavailable gear are silent',held.events.length===after.events.length&&held.gear===3);
  before=await reset(0,false,true);await page.keyboard.press('KeyE');after=await snapshot();report.seq=after;
  check('Actual sequential up input produces exactly one SQ engagement',after.gear===2&&after.events.length===before+1&&after.events.at(-1).mode==='seq');
  await page.evaluate(()=>{__kr.PC.gear=__kr.PC.gears;});before=(await snapshot()).events.length;await page.keyboard.press('KeyE');after=await snapshot();check('Sequential up at the top gear is silent',after.events.length===before);
  const neutral=await page.evaluate(()=>{const k=__kr,first=k.audioDebug.shift(0),n=k.audioDebug.adapter.diagnostics.shiftEvents().length,second=k.audioDebug.shift(0);return{first,second,n,after:k.audioDebug.adapter.diagnostics.shiftEvents().length,neutral:k.PC.neutral};});
  check('Entering neutral sounds once; repeated neutral is a no-op',neutral.first&&!neutral.second&&neutral.n===neutral.after&&neutral.neutral);
  const tyre=await page.evaluate(()=>{const k=__kr,d=k.audioDebug.adapter.diagnostics,n=d.tyreBites();k.PC.slip=0;k.PC.drift=0;k.audioDebug.tyre();const clean=d.tyreBites();k.PC.slip=.7;k.audioDebug.tyre();const slipping=d.tyreBites();k.PC.crash={};k.audioDebug.tyre();return{n,clean,slipping,crash:d.tyreBites()};});
  check('Clean shifts have no cartoon tyre chirp; actual slip gets one short scrub',tyre.clean===tyre.n&&tyre.slipping===tyre.n+1&&tyre.crash===tyre.slipping);
  const paused=await page.evaluate(async()=>{const k=__kr;await k.audioDebug.buses.ctx.suspend();const n=k.audioDebug.adapter.diagnostics.shiftEvents().length;k.audioDebug.shift(1);return k.audioDebug.adapter.diagnostics.shiftEvents().length===n;});check('Suspended audio never queues a stale shift sound for resume',paused);
  check('No browser/audio exceptions',report.errors.length===0);report.pass=true;
 }catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,assertions:report.assertions.length,failure:report.failure,output},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
