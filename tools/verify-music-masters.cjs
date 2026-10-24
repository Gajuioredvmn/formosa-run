// Actual shipped MP3s, actual browser decoder and the production two-deck graph.
// Synthetic tone regression tests remain separately in verify-audio.cjs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-music-'+Date.now()));
fs.mkdirSync(output,{recursive:true});
const report={assertions:[],errors:[],tracks:[],transitions:[],limitations:['RMS/peak and waveform continuity are measured, not LUFS, measured tempo, beat-grid or musical harmony certification.','Offline decoded-master tests and desktop Edge lifecycle checks do not certify mobile audio latency, phone performance or subjective speaker/headphone mix quality.']};
const check=(name,pass)=>{assert(pass,name);report.assertions.push(name);};
function wav(channels,rate){const n=channels[0].length,b=Buffer.alloc(44+n*channels.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels.length,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*channels.length*2,28);b.writeUInt16LE(channels.length*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);for(let i=0;i<n;i++)for(let c=0;c<channels.length;c++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*channels.length+c)*2);return b;}
(async()=>{
 const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';const browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 try{
  const context=await browser.newContext({viewport:{width:960,height:540}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`;
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.audioDebug.adapter,null,{timeout:120000});
  await page.evaluate(async()=>{
   __kr.halt(true);const manifest=await import('./render/music-manifest.js');
   window.musicQA={manifest,audio:__kr.audioDebug.adapter,edges:new Map(),decoded:[],rate:24000};
  });
  const ids=await page.evaluate(()=>musicQA.manifest.MUSIC_TRACKS.map(t=>t.id));
  check('Exactly 20 real music files are marked ready',ids.length===20);
  for(const id of ids){
   const track=await page.evaluate(async id=>{
    const q=musicQA,track=q.manifest.MUSIC_TRACKS.find(t=>t.id===id),ctx=new OfflineAudioContext(2,1,q.rate),fetched=[];
    // Exercise the production import.meta-relative resolver, not document-relative fetch.
    const radio=new q.audio.SeamlessRadio(ctx,ctx.destination,{tracks:[track],fetcher:async url=>{const res=await fetch(url);fetched.push({url:String(url),status:res.status});return res;}});
    radio.wanted=id;const buffer=await radio.preload(id);if(!buffer)throw Error(id+' failed to decode '+JSON.stringify(radio.status.errors));
    const rate=buffer.sampleRate,excerpt=(start,seconds)=>{const b=ctx.createBuffer(2,Math.round(seconds*rate),rate);for(let ch=0;ch<2;ch++)b.copyToChannel(buffer.getChannelData(Math.min(ch,buffer.numberOfChannels-1)).subarray(Math.round(start*rate),Math.round(start*rate)+b.length),ch);return b;};
    const head=excerpt(track.cueIn,8),tail=excerpt(track.cueOut-8,8);q.edges.set(id,{head,tail,track});
    let finite=true,peak=0,energy=0,count=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<d.length;i++){finite&&=Number.isFinite(d[i]);peak=Math.max(peak,Math.abs(d[i]));energy+=d[i]*d[i];count++;}}
    const deck=radio.deck(id,buffer,0),cueCorrect=Math.abs(deck.source.loopStart-track.cueIn)<1e-5&&Math.abs(deck.source.loopEnd-track.cueOut)<1e-5;deck.source.stop();deck.source.disconnect();deck.gain.disconnect();radio.stop();
    return{id,duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:rate,finite,peak,rms:Math.sqrt(energy/count),cueCorrect,fetch:fetched[0],expectedDuration:track.durationSeconds,cueIn:track.cueIn,cueOut:track.cueOut,gainDb:track.gainDb,requestedBpm:track.requestedBpm,tempoVerified:track.tempoVerified};
   },id);
   check(`${id}: real MP3 resolves beneath the project subpath and decodes completely`,track.fetch.status===200&&track.fetch.url.includes('/'+encodeURIComponent(path.basename(root))+'/assets/music/')&&track.finite&&track.duration>150&&Math.abs(track.duration-track.expectedDuration)<.1);
   check(`${id}: calibrated cue range, stereo and non-silent samples`,track.cueCorrect&&track.channels===2&&track.rms>.01&&track.cueOut<track.duration+.01&&track.cueOut>track.cueIn+60);
   report.tracks.push(track);console.log('decoded '+id+' '+track.duration.toFixed(2)+'s');
  }
  const pairs=await page.evaluate(()=>{
   const q=musicQA,routes=q.manifest.ROUTE_MUSIC,pairs=[];
   for(const id of Object.keys(__kr.STAGES)){const stage=__kr.STAGES[id];for(const child of stage.children||[])pairs.push({kind:'route',from:routes[id],to:routes[child],label:id+' → '+child});if(!stage.children?.length)pairs.push({kind:'ending',from:routes[id],to:routes.ending,label:id+' → ending'});}
   pairs.push({kind:'start',from:routes.menu,to:routes.s1,label:'menu → s1'},{kind:'menu',from:routes.ending,to:routes.menu,label:'ending → menu'});
   for(const track of q.manifest.MUSIC_TRACKS)pairs.push({kind:'loop',from:track.id,to:track.id,label:track.id+' loop'});
   return pairs;
  });
  for(let i=0;i<pairs.length;i++){
   const pair=pairs[i];
   const result=await page.evaluate(async({pair,save})=>{
    const q=musicQA,rate=q.rate,ctx=new OfflineAudioContext(2,rate*8,rate),a=q.edges.get(pair.from),b=q.edges.get(pair.to);
    // Both excerpts are copied verbatim from the real decode: last 8 seconds
    // before outgoing cueOut and first 8 after incoming cueIn. No test tones.
    const tracks=[{...a.track,id:'from',cueIn:0,cueOut:8},{...b.track,id:'to',cueIn:0,cueOut:8}],radio=new q.audio.SeamlessRadio(ctx,ctx.destination,{tracks});
    radio.transition('from',a.tail,0,.1);radio.transition('to',b.head,2,4);const mixed=await ctx.startRendering();
    const data=[mixed.getChannelData(0),mixed.getChannelData(1)];let peak=0,finite=true;for(const d of data)for(const v of d){peak=Math.max(peak,Math.abs(v));finite&&=Number.isFinite(v);}
    const rms=[];for(let t=1.5;t<7.5;t+=.05){let energy=0;const start=Math.round(t*rate),end=start+Math.round(.05*rate);for(const d of data)for(let j=start;j<end;j++)energy+=d[j]*d[j];rms.push(Math.sqrt(energy/(2*(end-start))));}
    const db=v=>20*Math.log10(Math.max(v,1e-12));let blank=0,longestBlank=0;for(const v of rms){blank=v<10**(-55/20)?blank+.05:0;longestBlank=Math.max(longestBlank,blank);}
    return{...pair,finite,peak,minWindowDbfs:db(Math.min(...rms)),maxWindowDbfs:db(Math.max(...rms)),longestBelow55DbSeconds:longestBlank,transitions:radio.status.transitions,wave:save?data.map(d=>Array.from(d)):undefined};
   },{pair,save:[0,2,pairs.length-1].includes(i)});
   check(`${pair.label}: real-source crossfade has no 100 ms audio dropout or clipping`,result.finite&&result.longestBelow55DbSeconds<.1&&result.peak<.95&&result.transitions===2);
   if(result.wave){fs.writeFileSync(path.join(output,`transition-${i}-${pair.from}-${pair.to}.wav`),wav(result.wave,24000));delete result.wave;}
   report.transitions.push(result);
  }
  // Production playback through the user-gesture AudioContext: no preload fixture.
  await page.evaluate(()=>{__kr.show('title');});await page.locator('#tap:visible').click();
  await page.waitForFunction(()=>__kr.audioDebug.radio?.active&&__kr.audioDebug.buses.ctx.state==='running',null,{timeout:45000}).catch(async error=>{report.playbackFailure=await page.evaluate(()=>({mode:__kr.G.mode,state:__kr.G.state,paused:__kr.G.paused,audio:__kr.audioDebug.buses.ctx?.state,radio:__kr.audioDebug.radio?.status,wanted:__kr.audioDebug.radio?.wanted,synthOn:__kr.audioDebug.synth.on,ui:__kr.UI.unlocked}));throw error;});
  await page.waitForTimeout(1300);
  const before=await page.evaluate(()=>({active:__kr.audioDebug.radio.status.active,synth:__kr.audioDebug.synth.bus.gain.value,errors:__kr.audioDebug.radio.status.errors}));
  check('Real downloaded music takes over after the user gesture and mutes the synth fallback',!!before.active&&before.synth<.001&&!before.errors.length);
  await page.evaluate(()=>__kr.show('setup'));
  check('Radio selector offers automatic scene music and all 20 real tracks',await page.locator('#music-station option').count()===21);
  await page.selectOption('#music-station','harbor-day');
  await page.waitForFunction(()=>__kr.audioDebug.radio.active?.id==='harbor-day',null,{timeout:20000});
  check('Manual station selection really changes the audible external track',await page.evaluate(()=>__kr.UI.musicTrack==='harbor-day'&&__kr.audioDebug.radio.active.id==='harbor-day'));
  await page.selectOption('#music-station','auto');
  await page.waitForFunction(()=>__kr.audioDebug.radio.active?.id==='island-menu',null,{timeout:20000});
  check('Returning to automatic radio restores the current scene soundtrack',await page.evaluate(()=>__kr.UI.musicTrack==='auto'&&__kr.audioDebug.radio.active.id==='island-menu'));
  check('Production playback retains at most two decoded full songs',await page.evaluate(()=>__kr.audioDebug.radio.buffers.size<=2&&__kr.audioDebug.radio.status.decoded<=2));
  await page.evaluate(()=>{__kr.G.mode='play';__kr.UI.resultShown=false;});await page.keyboard.press('p');await page.waitForFunction(()=>__kr.audioDebug.buses.ctx.state==='suspended');
  const paused=await page.evaluate(()=>({time:__kr.audioDebug.buses.ctx.currentTime,id:__kr.audioDebug.radio.active.id}));await page.waitForTimeout(150);const pausedAfter=await page.evaluate(()=>__kr.audioDebug.buses.ctx.currentTime);
  check('Pause freezes the real master playback position',Math.abs(pausedAfter-paused.time)<.01);
  await page.keyboard.press('p');await page.waitForFunction(()=>__kr.audioDebug.buses.ctx.state==='running');
  check('Resume retains the current real track',await page.evaluate(id=>__kr.audioDebug.radio.active.id===id,paused.id));
  await page.evaluate(()=>{__kr.show('settings');const el=document.querySelector('[data-set="music"]');el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  check('Master music slider mutes the real-song bus',await page.evaluate(()=>__kr.audioDebug.buses.music.gain.value===0));
  const failedContext=await browser.newContext({viewport:{width:960,height:540}}),failedPage=await failedContext.newPage();
  await failedPage.route('**/assets/music/island-menu.mp3',route=>route.fulfill({status:404,body:'QA deliberately missing music'}));
  await failedPage.goto(base,{waitUntil:'domcontentloaded'});await failedPage.waitForFunction(()=>window.__kr?.audioDebug.adapter,null,{timeout:120000});await failedPage.locator('#tap:visible').click();
  await failedPage.waitForFunction(()=>__kr.audioDebug.radio?.failures.has('island-menu'),null,{timeout:10000});
  check('An actual failed first download preserves the audible original synth fallback',await failedPage.evaluate(()=>!__kr.audioDebug.radio.active&&__kr.audioDebug.synth.on&&__kr.audioDebug.synth.bus.gain.value>.5&&__kr.audioDebug.buses.ctx.state==='running'));
  await failedContext.close();
  check('No browser or decoder errors',report.errors.length===0);
  report.totalBytes=JSON.parse(fs.readFileSync(path.join(root,'assets/music/audio-analysis.json'),'utf8')).totalBytes;
  report.routeTransitions=pairs.filter(p=>p.kind==='route').length;report.endingTransitions=pairs.filter(p=>p.kind==='ending').length;report.loopTransitions=pairs.filter(p=>p.kind==='loop').length;report.pass=true;await context.close();
 }catch(error){report.pass=false;report.failure=String(error.stack||error);process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,assertions:report.assertions.length,tracks:report.tracks.length,transitions:report.transitions.length,failure:report.failure,output},null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
