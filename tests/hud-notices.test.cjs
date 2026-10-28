const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
function hud(){const a=source.indexOf('function hudNotice('),b=source.indexOf('function ',source.indexOf('function hudMsg(',a)+9),context={HUD:{msgs:[]}};vm.createContext(context);vm.runInContext(source.slice(a,b),context);return context;}
test('Driving commentary and collision subtitles do not enter the HUD queue',()=>{
 const c=hud();for(const text of ['連續彎道車流','交錯超車區','保持野生動物距離','撞到陣頭！','三寶！','哎呀！','廟會'])c.hudMsg(text,'long explanation');assert.equal(c.HUD.msgs.length,0);
});
test('Essential notices remain short and warnings take priority over checkpoint status',()=>{
 const c=hud();assert.equal(c.hudNotice('CHECKPOINT','時間延長 +30 秒　高雄').label,'時間 +30 秒');
 for(const text of ['GO!','GOAL','TIME UP','火車！','前方有臺灣黑熊','前方平交道','車隊左轉','車隊右轉']){const q=c.hudNotice(text,'irrelevant subtitles');assert(q);assert(q.label.length<=14);}
 assert(c.hudNotice('前方平交道').priority>c.hudNotice('CHECKPOINT','+30').priority);
 c.hudMsg('前方平交道','右側地下道可持續通行','#ffda72',4,false);assert.equal(c.HUD.msgs.length,1);assert.equal(c.HUD.msgs[0].dur,4);
});
