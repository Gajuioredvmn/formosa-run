/* Inspect actual seeded road signs and labels against regional destination rules. */
const fs=require('node:fs'),path=require('node:path'),{createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/full-qa-20261024/gameplay/geography'));
fs.mkdirSync(out,{recursive:true});const report={checks:[],errors:[],missing:[]};
const allowed={
 s1:'tower85 kpmc pier2 harborbridge lrt dome underpass weiwuying pagodas',
 s2n:'okgoat sugarfactory tomato pineapples xigang chikan confucius',
 s2s:'cijin tunnel cijinlight rainbow ferry windmills cijinmazu',
 s3w:'saltmountain crystalchurch beehive budai lukang',
 s3m:'fountain chickenrice xingang teafarm ontracks fenqihu sakura alitrain cypress',
 s3sm:'dawu buddha ferris gaoping wanluan sandimen glassbridge shouka',
 s3se:'donglong donggang dapeng liuqiu linbian hakka fangliao mango fuan sichongxi',
 s4a:'bagua gaomei dajia zhenlan tung sanyi',s4b:'jiji jiji_parallel greentunnel plum snakekiln checheng teafarm',
 s4c:'duoliang jinlun daylilies sugarapple tiehua balloons brownave chishang',s4d:'mudan shimencommunity shimen xuhai gangzai gangzaivillage teafarm manzhou',
 s4e:'haikou aquarium hengchun hengchunstreet chuhuo longluan kenting kentingpark nanwan',s4f:'beigang beigangstreet xiluo',
 s4g:'tung teafarm sanyi longteng',s4h:'mango',
 s5a:'danshui fortsandomingo loversbridge guandu taipeimrt ximending taipei101',s5b:'kites fuguijiao jinshan yehliu queenhead',
 s5c:'ropeway wenwu teafarm itashao xiangshan shuishe',s5d:'cabbages cingjing sheep hehuan wuling',
 s5e:'qixingtan truku tarokogate swallowgrotto changchun',s5f:'qingshui nanfangao coldspring scallions jiaoxi turtleisland lanyang',
 s5g:'teafarm ropebridge jialeshui fengchuisha grassland longpan',s5h:'sheding shadao eluanbicoast southpoint eluanbi',
 s5i:'houwan wanlitong baisha maobitou hongchaikeng guanshan',s5j:'nanwan nuke xiaowan bananabay sailrock',
 s5k:'gaomei dajia zhenlan',s5l:'nanliaoharbor nanliaokites coastwind',s5m:'tung teafarm kangji',
 s5n:'shuinandong jiufenstreet',s5o:'chenggong pisiliang amis sanxiantai',s5p:'amis shitiharbor shitipingvillage shitiping'
};
const baseline=JSON.parse(fs.readFileSync(path.join(root,'data/game.json'),'utf8')).stages;
(async()=>{const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FormosaWorldLife?.state.ready,null,{timeout:90000});
const result=await page.evaluate(({allowed,baseline})=>{const k=__kr;k.halt(true);const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
const pieces=k.ROUTE.pieces,signs=pieces.map(p=>({id:p.id,label:p.def.label,signs:p.sprites.filter(o=>/^sight_/.test(k.SPRL[o.id].name)).map(o=>({name:k.SPRL[o.id].name.replace(/^sight_|_[lr]$/g,''),s:o.s}))}));
check('All 31 route pieces are inspected in the real generated scenery',signs.length===31&&Object.keys(allowed).length===31);
for(const p of signs){const wrong=p.signs.filter(s=>!allowed[p.id].split(' ').includes(s.name));check(p.id+' named sights belong to its documented region',!wrong.length,{label:p.label,names:[...new Set(p.signs.map(s=>s.name))],wrong});}
const expected={s4f:['beigangstreet'],s5n:['jiufenstreet','shuinandong'],s5l:['nanliaoharbor','nanliaokites','coastwind'],s4d:['shimencommunity','gangzaivillage'],s5o:['pisiliang','sanxiantai','chenggong'],s5p:['shitiharbor','shitipingvillage'],s5m:['kangji'],s5h:['shadao','eluanbicoast'],s5i:['houwan','wanlitong'],s4a:['gaomei','bagua','sanyi']};
for(const[id,names]of Object.entries(expected))check(id+' retains appropriate local culture after removing borrowed placenames',names.every(n=>signs.find(p=>p.id===id).signs.some(s=>s.name===n)),names);
const labelCases=[['s2n','okgoat','高雄'],['s2n','sugarfactory','高雄'],['s2n','pineapples','台南'],['s2n','chikan','台南'],['s4a','bagua','彰化'],['s4a','gaomei','台中'],['s4a','zhenlan','台中'],['s4a','sanyi','苗栗'],['s3sm','buddha','高雄'],['s3sm','gaoping','高屏溪'],['s3sm','wanluan','屏東']];
const labels=labelCases.map(([id,tag,county])=>{const p=pieces.find(p=>p.id===id),i=p.secs.findIndex(s=>s.tags?.includes(tag)),s=(p.secStartS[i]+p.secStartS[i+1])*.5;return{id,tag,county,label:window.FormosaLandmarkArt.regionalLabel(p,s),s};});
check('Cross-county routes change HUD region at the actual section boundary',labels.every(l=>l.label?.startsWith(l.county)),labels);
check('The single Sanxiantai eight-arch landmark appears only once, on the Taitung destination',pieces.filter(p=>p.sprites.some(o=>k.SPRL[o.id].name==='sanxiantai')).every(p=>p.id==='s5o')&&pieces.find(p=>p.id==='s5o').sprites.filter(o=>k.SPRL[o.id].name==='sanxiantai').length===1);
check('Gaomei windmills and Nanliao kites are actual placed art, not inactive tag names',['s5k','s5l'].every(id=>pieces.find(p=>p.id===id).sprites.some(o=>/^windmill(#|$)/.test(k.SPRL[o.id].name)))&&pieces.find(p=>p.id==='s5l').sprites.some(o=>/^kite(#|$)/.test(k.SPRL[o.id].name)));
const shape=stage=>JSON.stringify({time:stage.time,children:stage.children,sections:stage.sections.map(s=>Object.fromEntries(['len','k','dy','roll','lanes','sh','shl','bridge','track','parallelRail','train'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]])))});
const changes=Object.keys(k.STAGES).filter(id=>shape(k.STAGES[id])!==shape(baseline[id]));
check('Geography repairs leave road length, bends, hills, lane sizes, branches and timers unchanged',!changes.length,changes);
return{checks,signs,labels};},{allowed,baseline});Object.assign(report,result);
for(const[id,name]of [['s4f','beigangstreet'],['s5n','jiufenstreet'],['s5l','nanliaoharbor'],['s5m','kangji'],['s5o','pisiliang'],['s4a','bagua']]){
 const fixture=await page.evaluate(({id,name})=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id===id),o=p.sprites.find(o=>k.SPRL[o.id].name==='sight_'+name+'_l'||k.SPRL[o.id].name==='sight_'+name+'_r');if(!o)return null;k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.bot(false);k.show(null);k.TRAFFIC.list=[];k.HAZ.list=[];k.go(k.ROUTE.pieces.indexOf(p),Math.max(0,o.s-35),0);k.PC.v=0;k.step(0);return{piece:id,sign:name,s:o.s};},{id,name});
 if(fixture){(report.screenshots||=[]).push(fixture);await page.screenshot({path:path.join(out,id+'-'+name+'.png')});}
}
report.pass=report.checks.every(c=>c.pass)&&!report.errors.length&&!report.missing.length;
}catch(e){report.pass=false;report.failure=String(e.stack||e);}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'geography-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass),errors:report.errors,missing:report.missing,failure:report.failure},null,2));if(!report.pass)process.exitCode=1;}})();
