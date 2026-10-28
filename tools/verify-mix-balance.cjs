// Real MP3 excerpts and the engine functions extracted from the game, rendered
// through OfflineAudioContext. This measures the mix, not phone loudspeakers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(root,'test-results/mix-balance'));
fs.mkdirSync(output,{recursive:true});const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),engineSource=html.slice(html.indexOf('function noiseSrc('),html.indexOf('// ---------- one-shots ----------'));
const report={assertions:[],errors:[],limitations:['Offline RMS/peak measurements do not certify phone speaker loudness or subjective balance.']};
const check=(name,value)=>{assert(value,name);report.assertions.push(name);};
(async()=>{const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.route('**/__mix-harness__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Audio mix regression</title>'}));await page.goto(`http://127.0.0.1:${server.address().port}/__mix-harness__`);
 report.mix=await page.evaluate(async engineSource=>{
  const audio=await import('./render/audio.js'),{MUSIC_TRACKS}=await import('./render/music-manifest.js'),rate=24000,seconds=6,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),results=[];
  const stats=buffer=>{let energy=0,peak=0,count=0,finite=true;for(let c=0;c<buffer.numberOfChannels;c++)for(const v of buffer.getChannelData(c).subarray(rate)){energy+=v*v;peak=Math.max(peak,Math.abs(v));finite&&=Number.isFinite(v);count++;}return{rmsDb:20*Math.log10(Math.max(1e-12,Math.sqrt(energy/count))),peak,finite};};
  for(const index of [0,6,13]){
   const track=MUSIC_TRACKS[index],decoder=new OfflineAudioContext(2,1,rate),raw=await decoder.decodeAudioData(await(await fetch(new URL(track.src,new URL('./render/audio.js',location.href)))).arrayBuffer());
   const excerpt=decoder.createBuffer(2,rate*seconds,rate);for(let c=0;c<2;c++)excerpt.copyToChannel(raw.getChannelData(c).subarray(rate*30,rate*(30+seconds)),c);
   async function render(mode,calibrated,music=.6,sfx=.9,kind='v12'){
    const ctx=new OfflineAudioContext(2,rate*seconds,rate),master=ctx.createGain();master.gain.value=.9;
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.2;master.connect(comp);comp.connect(ctx.destination);
    const buses=audio.createMixBuses(ctx,master,{music,sfx});if(!calibrated){buses.musicTrim.gain.value=1;buses.engineBed.gain.value=1;}
    if(mode!=='engine'){const radio=new audio.SeamlessRadio(ctx,buses.music,{tracks:[{...track,cueIn:0,cueOut:seconds}]});radio.transition(track.id,excerpt,0,.1);}
    if(mode!=='music'){
     const noise=ctx.createBuffer(1,rate*2,rate),d=noise.getChannelData(0);let seed=15213;for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=seed/2147483648-1;}
     const AU={ctx,...buses,noise,eng:null},engine=new Function('AU','clamp','sfxPop',engineSource+';return {engineStart,engineUpdate};')(AU,clamp,()=>{});
     engine.engineStart(kind);engine.engineUpdate(6800,7000,1,65,0,0,false,0);
    }
    return stats(await ctx.startRendering());
   }
   const beforeMusic=await render('music',false),afterMusic=await render('music',true),beforeEngine=await render('engine',false),afterEngine=await render('engine',true),mix=await render('both',true),max=await render('both',true,1,1,'turbo'),muted=await render('both',true,0,0);
   results.push({id:track.id,beforeMusic,afterMusic,beforeEngine,afterEngine,mix,max,muted,relativeImprovementDb:(afterMusic.rmsDb-afterEngine.rmsDb)-(beforeMusic.rmsDb-beforeEngine.rmsDb)});
  }
  const ctx=new OfflineAudioContext(2,1,rate),b=audio.createMixBuses(ctx,ctx.destination,{music:.25,sfx:.37});
  return{results,calibration:audio.MIX_CALIBRATION,savedFaders:{music:b.music.gain.value,sfx:b.sfx.gain.value}};
 },engineSource);
 for(const m of report.mix.results){check(m.id+': music is at least 2.5 dB louder',m.afterMusic.rmsDb-m.beforeMusic.rmsDb>2.5);check(m.id+': continuous engine bed is at least 2.5 dB quieter',m.beforeEngine.rmsDb-m.afterEngine.rmsDb>2.5);check(m.id+': soundtrack-to-engine balance improves by at least 5 dB',m.relativeImprovementDb>5);check(m.id+': default and maximum-volume mixes retain finite unclipped output',m.mix.finite&&m.max.finite&&m.mix.peak<.99&&m.max.peak<.99);check(m.id+': both user faders at zero remain completely silent',m.muted.peak===0);}
 check('Saved music and effects settings remain their original independent values',Math.abs(report.mix.savedFaders.music-.25)<1e-6&&Math.abs(report.mix.savedFaders.sfx-.37)<1e-6);
 check('Driving cues retain the original effects bus',/E\.sqg\.connect\(AU\.sfx\)/.test(engineSource)&&/E\.skG\.connect\(AU\.sfx\)/.test(engineSource)&&/GAME_AUDIO\.playShift\(AU.ctx,AU.sfx/.test(html));
 check('No browser exceptions',report.errors.length===0);report.pass=true;
}catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,assertions:report.assertions.length,failure:report.failure,output}));}})().catch(e=>{console.error(e);process.exitCode=1;});
