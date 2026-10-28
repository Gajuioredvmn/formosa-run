import {MUSIC_TRACKS,ROUTE_MUSIC} from './music-manifest.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cache=new WeakMap();

// Calibrate the soundtrack against the continuous engine bed without changing
// saved user faders. Short driving cues keep their existing effects-bus level.
export const MIX_CALIBRATION=Object.freeze({musicDb:3,engineBedDb:-3.7});
export function createMixBuses(context,master,{music=.6,sfx=.9}={}){
  const musicBus=context.createGain(),sfxBus=context.createGain(),musicTrim=context.createGain(),engineBed=context.createGain();
  musicBus.gain.value=clamp(music,0,1);sfxBus.gain.value=clamp(sfx,0,1);
  musicTrim.gain.value=10**(MIX_CALIBRATION.musicDb/20);engineBed.gain.value=10**(MIX_CALIBRATION.engineBedDb/20);
  musicBus.connect(musicTrim);musicTrim.connect(master);sfxBus.connect(master);engineBed.connect(sfxBus);
  return{music:musicBus,sfx:sfxBus,musicTrim,engineBed};
}

// Finite, click-free passing air; the pitched component is a quiet engine body,
// not the former bright sawtooth alert. A fixed seed makes QA reproducible.
export function createPassBuffer(context,type='sedan') {
  let bank=cache.get(context);if(!bank)cache.set(context,bank=new Map());
  const big=['bus','gravel','rebar','logs','train','bluetruck'].includes(type),small=type==='scooter',key=big?'heavy':small?'scooter':'car';
  if(bank.has(key))return bank.get(key);
  const duration=big?.68:small?.39:.49,rate=context.sampleRate,length=Math.ceil(duration*rate),buffer=context.createBuffer(1,length,rate),out=buffer.getChannelData(0);
  let seed=big?24145:small?71103:93271,fast=0,slow=0,phase=0;
  for(let i=0;i<length;i++){
    const u=i/(length-1);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;
    const cutoff=(big?2100:2700)*(1-.38*u),af=1-Math.exp(-2*Math.PI*cutoff/rate),as=1-Math.exp(-2*Math.PI*180/rate);
    fast+=af*(white-fast);slow+=as*(white-slow);
    const envelope=Math.sin(Math.PI*u)**1.6,frequency=(big?112:small?205:158)*(1-.25*u);
    phase+=2*Math.PI*frequency/rate;const motor=(Math.sin(phase)+.24*Math.sin(phase*2)+.1*Math.sin(phase*3));
    out[i]=envelope*((fast-slow)*.5+motor*.035);
  }
  bank.set(key,buffer);return buffer;
}
export function playPass(context,destination,{strength=1,pan=0,type='sedan',when=context.currentTime}={}) {
  const source=context.createBufferSource(),gain=context.createGain(),panner=context.createStereoPanner?.();source.buffer=createPassBuffer(context,type);
  gain.gain.value=clamp(strength,0,1)*.72;source.connect(gain);
  if(panner){const side=clamp(pan,-1,1);panner.pan.setValueAtTime(side*.85,when);panner.pan.linearRampToValueAtTime(side*.5,when+source.buffer.duration);gain.connect(panner);panner.connect(destination);}else gain.connect(destination);
  source.onended=()=>{source.disconnect();gain.disconnect();panner?.disconnect();};source.start(when);
  return{duration:source.buffer.duration,source,gain,panner};
}

const shiftCache=new WeakMap(),shiftLog=[];let tyreBites=0;
// A short lever detent and a damped drivetrain take-up. Resonances last only a
// few milliseconds; the existing engine voice supplies the actual RPM change.
export function createShiftBuffer(context,{mode='mt',to=2,from=1}={}){
  let bank=shiftCache.get(context);if(!bank)shiftCache.set(context,bank=new Map());
  const neutral=to===0,down=to<from,key=mode+':'+(neutral?'neutral':down?'down':'up');if(bank.has(key))return bank.get(key);
  const rate=context.sampleRate,duration=neutral?.14:mode==='seq'?.24:.33,length=Math.ceil(duration*rate),buffer=context.createBuffer(1,length,rate),out=buffer.getChannelData(0);
  let seed=mode==='at'?15231:mode==='seq'?34729:61711,low=0,air=0;
  const pulse=(t,start,decay)=>t>=start?(1-Math.exp(-(t-start)*2000))*Math.exp(-(t-start)*decay):0;
  for(let i=0;i<length;i++){
    const t=i/rate,u=i/(length-1);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
    low+=(1-Math.exp(-2*Math.PI*520/rate))*(noise-low);air+=(1-Math.exp(-2*Math.PI*2800/rate))*(noise-air);
    const lever=(mode==='at'?.16:mode==='seq'?.68:1)*(pulse(t,.004,145)+.7*pulse(t,mode==='seq'?.035:.062,100));
    const rub=mode==='mt'?pulse(t,.012,32)*.045:0,engage=neutral?0:pulse(t,mode==='seq'?.075:mode==='at'?.065:.125,mode==='at'?22:32);
    const clack=(air-low)*.36+(Math.sin(t*2*Math.PI*680)+.45*Math.sin(t*2*Math.PI*1100))*.035;
    const body=low*.22+Math.sin(t*2*Math.PI*(down?92:76))*.075+Math.sin(t*2*Math.PI*168)*.018;
    out[i]=(clack*lever+(air-low)*rub+body*engage)*Math.min(1,u*100)*Math.min(1,(1-u)*30);
  }
  bank.set(key,buffer);return buffer;
}
export function playShift(context,destination,{mode='mt',to=2,from=1,load=.5,when=context.currentTime}={}){
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=createShiftBuffer(context,{mode,to,from});
  gain.gain.value=(mode==='at'?.56:.76)*(.75+.25*clamp(load,0,1));source.connect(gain);gain.connect(destination);
  source.onended=()=>{source.disconnect();gain.disconnect();};source.start(when);
  shiftLog.push({mode,to,from,time:when});if(shiftLog.length>64)shiftLog.shift();
  return{source,gain,duration:source.buffer.duration};
}
export function playTyreBite(context,destination,{strength=.5,when=context.currentTime}={}){
  let bank=shiftCache.get(context);if(!bank)shiftCache.set(context,bank=new Map());let buffer=bank.get('tyre-friction');
  if(!buffer){const rate=context.sampleRate,length=Math.round(rate*.13);buffer=context.createBuffer(1,length,rate);const out=buffer.getChannelData(0);let seed=84213,lo=0,hi=0;
    for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,t=i/rate,u=i/(length-1);lo+=(1-Math.exp(-2*Math.PI*250/rate))*(noise-lo);hi+=(1-Math.exp(-2*Math.PI*1300/rate))*(noise-hi);out[i]=(hi-lo)*(1-Math.exp(-t*600))*Math.exp(-t*26)*Math.min(1,(1-u)*15);}
    bank.set('tyre-friction',buffer);
  }
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=clamp(strength,0,1)*.28;source.connect(gain);gain.connect(destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start(when);tyreBites++;return{source,gain,duration:buffer.duration};
}

// One event per genuine forward crossing. Wide hysteresis, elapsed time and
// position continuity reject standing jitter, reverse driving and teleports.
export class PassTracker {
  constructor(){this.items=new WeakMap();this.events=0;}
  reset(){this.items=new WeakMap();this.events=0;}
  observe(owner,{distance,lateral,relativeSpeed,speed,time,piece,eligible=true,maxLateral=12}) {
    if(!owner||![distance,lateral,relativeSpeed,speed,time].every(Number.isFinite))return null;
    let p=this.items.get(owner),dt=p?time-p.time:0;
    const continuous=p&&p.piece===piece&&dt>=0&&dt<1.5&&Math.abs(distance-p.distance)<Math.max(10,Math.abs(relativeSpeed)*1.5*dt+8);
    if(!continuous)p={armed:false,lastEvent:-Infinity,piece};
    if(!eligible||speed<2){p.armed=false;}
    else if(distance>8&&time-p.lastEvent>2)p.armed=true;
    let event=null;
    if(continuous&&p.armed&&eligible&&speed>5&&relativeSpeed>1&&distance<-2&&p.distance>=-2){
      p.armed=false;p.lastEvent=time;
      if(Math.abs(lateral)<maxLateral){this.events++;event={strength:clamp(relativeSpeed/25,.18,.8)*clamp(1-Math.abs(lateral)/18,.25,1),pan:clamp(lateral/5,-1,1)};}
    }
    p.distance=distance;p.time=time;p.piece=piece;this.items.set(owner,p);return event;
  }
}
export const passes=new PassTracker();

function curve(param,start,end,when,duration) {
  const values=new Float32Array(65);for(let i=0;i<65;i++){const t=i/64;values[i]=Math.sqrt((start*Math.cos(t*Math.PI/2))**2+(end*Math.sin(t*Math.PI/2))**2);}
  param.cancelScheduledValues(when);param.setValueCurveAtTime(values,when,duration);
}
export function equalPowerFade(outGain,inGain,when,duration,outLevel=1,inLevel=1){curve(outGain,outLevel,0,when,duration);curve(inGain,0,inLevel,when,duration);}

// Two audible decks, at most two decoded songs. Loaded audio continues looping
// until the next file has decoded; an unavailable file never cuts the old song.
export class SeamlessRadio {
  constructor(context,destination,{tracks=MUSIC_TRACKS,routes=ROUTE_MUSIC,fetcher=(...args)=>globalThis.fetch(...args),onActive=()=>{}}={}) {
    this.context=context;this.destination=destination;this.tracks=new Map(tracks.map(t=>[t.id,t]));this.routes=routes;this.fetcher=fetcher;this.onActive=onActive;
    this.buffers=new Map();this.loading=new Map();this.failures=new Map();this.active=null;this.outgoing=null;this.wanted=null;this.transitionEnd=0;this.generation=0;
    this.status={active:null,pending:null,available:tracks.filter(t=>this.available(t)).length,transitions:0,errors:[],decoded:0};
  }
  available(track){return !!(track?.src&&track.status==='ready'&&track.commercialUseVerified===true);}
  requestContext(piece,mode='play'){const id=this.routes[mode==='ending'?'ending':mode==='play'?piece:'menu'];return this.request(id);}
  request(id){const track=this.tracks.get(id);if(!this.available(track))return false;this.wanted=id;this.status.pending=id;if(!this.outgoing&&!this.loading.size&&!this.buffers.has(id)&&!this.failures.has(id))this.preload(id);return true;}
  async preload(id){
    const track=this.tracks.get(id);if(!this.available(track))return null;if(this.buffers.has(id))return this.buffers.get(id);if(this.loading.has(id))return this.loading.get(id);
    const generation=this.generation,task=(async()=>{try{
      const url=new URL(track.src,import.meta.url),response=await this.fetcher(url);if(!response.ok)throw Error('HTTP '+response.status);
      const bytes=await response.arrayBuffer(),buffer=await this.context.decodeAudioData(bytes);if(generation!==this.generation)return null;
      if(buffer.duration<2||!Number.isFinite(buffer.duration))throw Error('Track too short');
      if(this.wanted&&id!==this.wanted&&id!==this.active?.id)return null;
      this.installBuffer(id,buffer);return buffer;
    }catch(e){this.failures.set(id,String(e));this.status.errors.push({id,error:String(e)});return null;}finally{this.loading.delete(id);}})();
    this.loading.set(id,task);return task;
  }
  installBuffer(id,buffer){this.buffers.set(id,buffer);this.prune();return buffer;}
  prune(){for(const id of this.buffers.keys())if(this.buffers.size>2&&id!==this.active?.id&&id!==this.wanted)this.buffers.delete(id);this.status.decoded=this.buffers.size;}
  deck(id,buffer,when){
    const track=this.tracks.get(id)||{},source=this.context.createBufferSource(),gain=this.context.createGain();
    const cue=clamp(track.cueIn||0,0,Math.max(0,buffer.duration-1)),end=clamp(track.cueOut||buffer.duration,cue+1,buffer.duration);
    source.buffer=buffer;source.loop=true;source.loopStart=cue;source.loopEnd=end;gain.gain.value=0;source.connect(gain);gain.connect(this.destination);source.start(when,cue);
    const level=Math.min(.9,10**((track.gainDb??-3)/20));return{id,source,gain,level,started:when,end:when+end-cue,buffer};
  }
  transition(id,buffer,when=this.context.currentTime+.05,duration=4){
    if(this.outgoing&&when<this.transitionEnd)return false;
    const next=this.deck(id,buffer,when),old=this.active;duration=clamp(duration,.05,Math.max(.05,Math.min(8,buffer.duration*.3)));
    if(old){equalPowerFade(old.gain.gain,next.gain.gain,when,duration,old.level,next.level);old.source.stop(when+duration+.02);old.source.onended=()=>{old.source.disconnect();old.gain.disconnect();};this.outgoing=old;}
    else{curve(next.gain.gain,0,next.level,when,Math.min(1,duration));this.onActive(true,when,Math.min(1,duration));}
    this.active=next;this.transitionEnd=when+duration;this.status.active=id;this.status.pending=null;this.status.transitions++;this.prune();return true;
  }
  tick(){
    const now=this.context.currentTime;if(this.context.state==='suspended')return;
    if(this.outgoing&&now>=this.transitionEnd)this.outgoing=null;
    if(now<this.transitionEnd)return;
    if(this.wanted&&!this.buffers.has(this.wanted)&&!this.loading.size&&!this.failures.has(this.wanted))this.preload(this.wanted);
    const id=this.wanted,buffer=this.buffers.get(id);if(!this.active){if(buffer)this.transition(id,buffer);return;}
    const track=this.tracks.get(this.active.id)||{},fade=track.fadeSeconds||4;
    if(buffer&&id!==this.active.id){
      // A prompt's requested BPM is not a verified beat grid. Only quantize a
      // measured grid; otherwise overlap promptly, before the old deck's tail.
      let when=now+.1;
      if(track.tempoVerified&&track.bpm>0){const bar=240/track.bpm;when=this.active.started+Math.ceil((when-this.active.started)/bar)*bar;}
      when=Math.max(now+.05,Math.min(when,this.active.end-fade));
      this.transition(id,buffer,when,fade);
    }
    else if(now>=this.active.end-fade-.2){this.transition(this.active.id,this.active.buffer,Math.max(now+.05,this.active.end-fade),fade);}
  }
  stop(){this.generation++;for(const deck of [this.active,this.outgoing])if(deck){try{deck.source.stop();}catch{}deck.source.disconnect();deck.gain.disconnect();}this.active=null;this.outgoing=null;this.wanted=null;this.transitionEnd=0;this.buffers.clear();this.status.active=null;this.status.pending=null;this.status.decoded=0;this.onActive(false,this.context.currentTime,.25);}
}
export const diagnostics={passEvents:()=>passes.events,shiftEvents:()=>shiftLog.slice(),tyreBites:()=>tyreBites,tracks:MUSIC_TRACKS.map(({id,title,status,src,commercialUseVerified})=>({id,title,status,src,commercialUseVerified}))};
