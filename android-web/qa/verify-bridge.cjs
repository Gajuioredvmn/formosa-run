// Regression for the real device failure: ES-module locals are not WebView
// globals. Run the exact native pause expression with only window.__kr exposed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const java=fs.readFileSync(path.join(__dirname,'../src/tw/formosarun/game/MainActivity.java'),'utf8');
const declaration=java.match(/private static final String PAUSE = ([\s\S]*?);\r?\n/)[1];
const source=[...declaration.matchAll(/"(?:[^"\\]|\\.)*"/g)].map(m=>JSON.parse(m[0])).join('');
let assertions=0;
function run(mode='play',resultShown=false,audio=true){
  let resets=0,suspends=0,screen=null;
  const k={G:{mode,paused:false},UI:{resultShown},show:v=>screen=v,audioDebug:{buses:{ctx:audio?{suspend:()=>suspends++}:null}}};
  const context={window:{__kr:k,dispatchEvent:e=>{if(e.type==='blur')resets++;}},Event:class{constructor(type){this.type=type;}}};
  vm.runInNewContext(source,context);
  return {k,resets,suspends,screen};
}
const play=run();assert.equal(play.k.G.paused,true);assertions++;assert.equal(play.screen,'pause');assertions++;
assert.equal(play.resets,1);assertions++;assert.equal(play.suspends,1);assertions++;
const result=run('play',true);assert.equal(result.screen,null);assertions++;assert.equal(result.suspends,1);assertions++;
const title=run('attract');assert.equal(title.k.G.paused,false);assertions++;assert.equal(title.screen,null);assertions++;
assert.doesNotThrow(()=>run('play',false,false));assertions++;
assert.doesNotThrow(()=>vm.runInNewContext(source,{window:{dispatchEvent(){}},Event:class{}}));assertions++;
console.log(JSON.stringify({ok:true,assertions,moduleLocalsAbsent:true}));
