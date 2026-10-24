// OfflineAudioContext renders the real audio graph. Generated QA tones are test
// fixtures only; they are not Suno tracks and are never packaged with the game.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const{createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-audio-'+Date.now()));fs.mkdirSync(output,{recursive:true});
const report={assertions:[],errors:[],limitations:['This regression suite uses synthetic crossfade fixtures. Actual shipped MP3 decoding, calibrated loop points and route crossfades are covered separately by verify-music-masters.cjs. Speaker listening and device audio latency are not certified by offline tests.']};const check=(name,pass)=>{assert(pass,name);report.assertions.push(name);};
function wav(channels,rate){const n=channels[0].length,b=Buffer.alloc(44+n*channels.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels.length,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*channels.length*2,28);b.writeUInt16LE(channels.length*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);for(let i=0;i<n;i++)for(let c=0;c<channels.length;c++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*channels.length+c)*2);return b;}
(async()=>{
 const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.G.state==='race'&&__kr.audioDebug.adapter,null,{timeout:90000});
  const result=await page.evaluate(async()=>{
   const m=__kr.audioDebug.adapter,assertions=[],check=(name,pass)=>{if(!pass)throw Error(name);assertions.push(name);},rms=(d,a=0,b=d.length)=>{let e=0;for(let i=a;i<b;i++)e+=d[i]*d[i];return Math.sqrt(e/(b-a));};
   const ctx=new OfflineAudioContext(2,48000*2.4,48000),direct=m.createPassBuffer(ctx,'sedan').getChannelData(0);
   check('Pass envelope begins and ends at zero',Math.abs(direct[0])<1e-6&&Math.abs(direct.at(-1))<1e-6);
   check('Pass waveform is finite and has safe headroom',[...direct].every(Number.isFinite)&&Math.max(...direct.map(Math.abs))<.55&&rms(direct)>.01);
   check('The rush is brief, with no long alarm tail',direct.length/48000<.7&&rms(direct,0,480)<rms(direct,9000,11000)*.1);
   m.playPass(ctx,ctx.destination,{pan:-1,type:'sedan',when:.1});m.playPass(ctx,ctx.destination,{pan:1,type:'bus',when:.85});m.playPass(ctx,ctx.destination,{pan:0,type:'scooter',when:1.65});const rendered=await ctx.startRendering(),left=rendered.getChannelData(0),right=rendered.getChannelData(1);
   check('Left pass is spatialized toward its actual side',rms(left,4800,28000)>rms(right,4800,28000)*1.5);
   check('Heavy right pass is spatialized toward its actual side',rms(right,40800,73000)>rms(left,40800,73000)*1.5);
   check('All pass sources finish without a persistent hiss',rms(left,112000,left.length)<1e-7&&rms(right,112000,right.length)<1e-7);
   const muted=new OfflineAudioContext(2,48000,48000),gain=muted.createGain();gain.gain.value=0;gain.connect(muted.destination);m.playPass(muted,gain);const muteBuffer=await muted.startRendering();check('A zero master/effects bus produces silence',rms(muteBuffer.getChannelData(0))===0&&rms(muteBuffer.getChannelData(1))===0);
   const tracker=new m.PassTracker(),observe=(obj,ds,time,extra={})=>tracker.observe(obj,{distance:ds,lateral:3,relativeSpeed:20,speed:40,time,piece:'s1',...extra});
   const one={},two={};observe(one,15,0);observe(two,15,0);observe(one,4,.4);observe(two,4,.4);check('Two cars passed together each produce their own event',!!observe(one,-3,.7)&&!!observe(two,-3,.7));
   check('Repeated state packets cannot replay a passing sound',!observe(one,-3,.7)&&!observe(one,-4,.8));
   check('Small position jitter cannot rearm a pass',!observe(one,1,.9)&&!observe(one,-3,1));
   const backwards={};observe(backwards,15,0);observe(backwards,4,.4);check('Reversing or a stopped player does not trigger an overtake',!observe(backwards,-3,.7,{speed:0}));
   const teleport={};observe(teleport,50,0);check('Teleport or route jumps do not count as overtaking',!observe(teleport,-20,.01));
   const distant={};observe(distant,15,0,{lateral:20});observe(distant,4,.4,{lateral:20});check('A distant different carriageway does not produce a loud pass',!observe(distant,-3,.7,{lateral:20}));
   observe(one,15,4);observe(one,4,4.4);check('A fresh forward repass after real separation is audible',!!observe(one,-3,4.7));
   const tracks=[{id:'testA',src:'qa-a.wav',status:'ready',commercialUseVerified:true,bpm:120,gainDb:0},{id:'testB',src:'qa-b.wav',status:'ready',commercialUseVerified:true,bpm:120,gainDb:0}];
   const cross=new OfflineAudioContext(2,48000*6,48000),radio=new m.SeamlessRadio(cross,cross.destination,{tracks,fetcher:()=>Promise.reject(Error('QA unavailable asset'))});
   const a=cross.createBuffer(2,48000*8,48000),b=cross.createBuffer(2,48000*8,48000);for(let i=0;i<a.length;i++){a.getChannelData(0)[i]=Math.sin(i*2*Math.PI*220/48000)*.2;b.getChannelData(1)[i]=Math.sin(i*2*Math.PI*330/48000)*.2;}
   radio.installBuffer('testA',a);radio.installBuffer('testB',b);radio.transition('testA',a,0,.1);radio.transition('testB',b,2,2);
   const mixed=await cross.startRendering(),l=mixed.getChannelData(0),r=mixed.getChannelData(1),windows=[];
   for(let t=2;t<4;t+=.05){const st=Math.round(t*48000),en=st+2400;windows.push(Math.hypot(rms(l,st,en),rms(r,st,en)));}
   check('Two-deck crossfade has no silent transition window',Math.min(...windows)>.11);
   check('Equal-power overlap has no large loudness spike',Math.max(...windows)<.15);
   check('Outgoing deck fades out while incoming deck remains',rms(l,240000,280000)<1e-7&&rms(r,240000,280000)>.1);
   const pending=m.diagnostics.tracks;check('All 20 music slots honestly distinguish ready licensed files from pending assets',pending.length===20&&pending.every(t=>t.status==='pending'?t.src===null:t.status==='ready'&&typeof t.src==='string'&&t.commercialUseVerified===true));
   const failed=new m.SeamlessRadio(new OfflineAudioContext(2,48000,48000),cross.destination,{tracks,fetcher:()=>Promise.reject(Error('missing'))});failed.active={id:'testA'};failed.request('testB');await failed.loading.get('testB');check('Failed next-track load does not clear the currently playing track',failed.active.id==='testA'&&failed.failures.has('testB'));
   return{assertions,wave:[Array.from(left),Array.from(right)],rate:48000,crossfade:{min:Math.min(...windows),max:Math.max(...windows)},pendingTracks:pending.filter(t=>t.status==='pending').length,readyTracks:pending.filter(t=>t.status==='ready').length};
  });
  report.assertions.push(...result.assertions);report.crossfade=result.crossfade;report.pendingTracks=result.pendingTracks;report.readyTracks=result.readyTracks;fs.writeFileSync(path.join(output,'pass-sound-preview.wav'),wav(result.wave,result.rate));
  const realPass=await page.evaluate(()=>{
    const k=__kr;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.show(null);k.bot(false);k.go(0,200,0);k.GHOST.on=false;
    k.TRAFFIC.list.length=0;k.TRAFFIC.density=0;k.TRAFFIC.edgeS=1e9;k.PC.v=40;k.PC.gear=4;
    k.spawn('sedan',20,-3.7,12);k.spawn('taxi',22,3.7,12);for(const v of k.TRAFFIC.list)v.lcT=1e9;
    const spawned=k.TRAFFIC.list.length;k.sim(.85);const once=k.audioDebug.adapter.passes.events;k.sim(.25);
    return{spawned,once,after:k.audioDebug.adapter.passes.events,crash:!!k.PC.crash};
  });
  check('Actual gameplay independently detects both nearby NPC overtakes',realPass.spawned===2&&realPass.once===2&&!realPass.crash);
  check('Following gameplay frames do not replay those pass sounds',realPass.after===2);report.actualTrafficPass=realPass;
  await page.evaluate(()=>{__kr.halt(true);__kr.show('title');});await page.locator('#tap:visible').click();
  check('User gesture starts the actual browser audio context',await page.evaluate(()=>__kr.audioDebug.buses.ctx.state==='running'));
  await page.evaluate(()=>{__kr.G.mode='play';__kr.UI.resultShown=false;});await page.keyboard.press('p');await page.waitForFunction(()=>__kr.audioDebug.buses.ctx.state==='suspended');
  check('Pause suspends music and effects together',await page.evaluate(()=>__kr.G.paused&&__kr.audioDebug.buses.ctx.state==='suspended'));
  await page.keyboard.press('p');await page.waitForFunction(()=>__kr.audioDebug.buses.ctx.state==='running');check('Resume restores the same audio context',await page.evaluate(()=>!__kr.G.paused));
  await page.evaluate(()=>{__kr.show('settings');for(const key of ['music','sfx']){const el=document.querySelector('[data-set="'+key+'"]');el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));}});
  check('Existing volume settings control both external music and effects buses',await page.evaluate(()=>__kr.audioDebug.buses.music.gain.value===0&&__kr.audioDebug.buses.sfx.gain.value===0));
  check('No audio/browser exceptions',report.errors.length===0);report.pass=true;await context.close();
 }catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,assertions:report.assertions.length,failure:report.failure,output},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
