// Real public-PeerJS/native-WebRTC integration test.
// No transport mocks, saved browser profiles or user avatars.
// Run: node tools/verify-multiplayer.cjs [output-directory]
// Eight fresh clients drive and restart. A ninth context tests capacity rejection only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const os = require('node:os');
if (process.argv.includes('--help')) {
  console.log('Usage: node tools/verify-multiplayer.cjs [output-directory]\nRequires Playwright and Chromium or Edge. Uses public PeerJS plus native WebRTC.\nTests eight-client driving/ignition/restart/rejoin, all ten car dimensions, and ninth-client capacity rejection.\nEach client uses a fresh context, a QA name and no avatar. Reports/screenshots default to a new OS temporary folder.');
  process.exit(0);
}
if (process.argv.length > 3 || (process.argv[2] || '').startsWith('--')) throw new Error('Usage: node tools/verify-multiplayer.cjs [output-directory]');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'formosa-multiplayer-' + Date.now()));
const MAX_CLIENTS = 8;
fs.mkdirSync(OUT, { recursive: true });
const server=require(path.join(ROOT,'tools/serve.cjs')).createServer(ROOT),report={started:new Date().toISOString(),signalling:'public 0.peerjs.com',nativeWebRTC:true,freshContexts:true,userDataSent:false,checks:[],errors:[],websocketErrors:[],rounds:[]};let browser,base;const pages=[];
const check=(name,value,details)=>{report.checks.push({name,pass:!!value,details});assert(value,name);console.log('PASS '+name);};
async function state(page){return page.evaluate(()=>{const a=__kr,n=a.NET;return{id:n.id,clientId:n.me.clientId,host:n.host,slot:a.netDebug.slot(),phase:n.phase,error:n.err,lost:n.lost,round:n.roundId,roundNo:n.roundNo,goAt:n.goAt,clockRtt:n.clockRtt,clockOffset:n.clockOffset,hostNow:a.netDebug.now(),grid:n.grid,layout:n.gridLayout,players:a.netDebug.players(),position:{s:a.PC.s,x:a.PC.x,v:a.PC.v},race:a.RACE.state,countdown:a.RACE.countdown,ignition:{on:a.IGN.on,t:a.IGN.t},watch:window.__qaRounds||{},peers:[...n.peers.values()].map(p=>({id:p.id,name:p.name,connection:p.pc?.connectionState,ice:p.pc?.iceConnectionState,ctl:p.ctl?.readyState,st:p.st?.readyState,lastSeq:p.lastSeq,state:p.state,vis:p.vis,ds:p.ds,dx:p.dx}))};});}
async function boot(i,halt=false){if(i>MAX_CLIENTS)throw new RangeError('At most eight racers and one rejection probe are allowed');const ctx=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1});const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push({client:i,error:e.stack||String(e)}));page.on('websocket',ws=>ws.on('socketerror',e=>report.websocketErrors.push({client:i,error:String(e)})));await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.netDebug&&__kr.G.state==='race',null,{timeout:90000});await page.evaluate(({i,halt})=>{__kr.SET.name='QA-'+i;__kr.SET.avatar='';__kr.SET.avatarKind='face';__kr.UI.sel=Math.min(i,9);__kr.UI.auto=true;__kr.UI.gearbox='at';__kr.show('online');if(halt)__kr.halt(true);window.__qaRounds={};function sample(){const n=__kr.NET,a=__kr;if(n.roundId&&n.phase==='race'){const r=window.__qaRounds[n.roundId]||(window.__qaRounds[n.roundId]={firstSeen:Date.now(),states:[],firstRun:null,early:false});if(!r.states.includes(a.RACE.state))r.states.push(a.RACE.state);if(a.RACE.state==='run'&&r.firstRun===null){r.firstRun={wall:Date.now(),hostNow:a.netDebug.now(),goAt:n.goAt,s:a.PC.s,x:a.PC.x};if(a.netDebug.now()<n.goAt-25)r.early=true;}}requestAnimationFrame(sample);}requestAnimationFrame(sample);},{i,halt});pages.push(page);return page;}
async function joined(page,code,count){await page.evaluate(code=>__kr.netJoin(code),code);await page.waitForFunction(count=>__kr.NET.grid.length===count&&[...__kr.NET.peers.values()].some(p=>p.host&&p.ctl?.readyState==='open'&&p.st?.readyState==='open'),count,{timeout:25000});await pages[0].waitForFunction(count=>__kr.NET.grid.length===count,count,{timeout:25000});}
async function roundReady(expected,skip=false){await pages[0].evaluate(()=>__kr.show('online'));await pages[0].locator('[data-net="start"]').click();await Promise.all(pages.slice(0,expected).map(p=>p.waitForFunction(()=>__kr.NET.phase==='race'&&__kr.RACE.state==='ignition',null,{timeout:10000})));const initial=await Promise.all(pages.slice(0,expected).map(state));const id=initial[0].round;check('Every client receives the same round and GO timestamp',initial.every(s=>s.round===id&&s.goAt===initial[0].goAt),initial.map(s=>({id:s.id,slot:s.slot,goAt:s.goAt,race:s.race})));check('Every round begins with ignition',initial.every(s=>s.ignition.on&&s.race==='ignition'));
 const gridPositions=await pages[0].evaluate(()=>__kr.NET.grid.map(g=>({slot:g.slot,car:g.car,position:__kr.netDebug.position(g.slot),width:__kr.CARS[g.car].W,length:__kr.CARS[g.car].L})));check('Distinct non-overlapping start rectangles',gridPositions.every((a,i)=>gridPositions.slice(i+1).every(b=>Math.abs(a.position.x-b.position.x)>=(a.width+b.width)/2+.01||Math.abs(a.position.s-b.position.s)>=(a.length+b.length)/2+.01)),gridPositions);check('Actual initial PC positions match assigned grid',initial.every(s=>{const p=gridPositions.find(q=>q.slot===s.slot).position;return Math.abs(s.position.s-p.s)<.01&&Math.abs(s.position.x-p.x)<.01&&s.position.v===0;}));
 if(skip){await pages[1].evaluate(()=>{__kr.netDebug.ignitionSkip();__kr.netDebug.ignitionSkip();});await pages[1].waitForTimeout(650);const skipped=await state(pages[1]);check('Skipping ignition does not move GO or start early',skipped.goAt===initial[1].goAt&&skipped.race!=='run'&&skipped.position.v===0,skipped);}
 await Promise.all(pages.slice(0,expected).map(p=>p.waitForFunction(()=>__kr.RACE.state==='run',null,{timeout:18000})));const ready=await Promise.all(pages.slice(0,expected).map(state));const watch=ready.map(s=>s.watch[id]);check('All clients pass ignition/countdown/run without early motion',watch.every(w=>w.states.includes('ignition')&&w.states.includes('countdown')&&w.states.includes('run')&&!w.early),watch);report.rounds.push({id,initial,ready});return{id,initial,ready};}
async function stats(page){return page.evaluate(async()=>Promise.all([...__kr.NET.peers.values()].filter(p=>p.pc).map(async p=>{const s=await p.pc.getStats();return{id:p.id,connection:p.pc.connectionState,candidates:[...s.values()].filter(x=>x.type==='candidate-pair'&&x.state==='succeeded'&&x.nominated).map(x=>({bytesSent:x.bytesSent,bytesReceived:x.bytesReceived,currentRoundTripTime:x.currentRoundTripTime})),channels:[...s.values()].filter(x=>x.type==='data-channel').map(x=>({label:x.label,state:x.state,messagesSent:x.messagesSent,messagesReceived:x.messagesReceived,bytesSent:x.bytesSent,bytesReceived:x.bytesReceived}))};})));}
(async()=>{try{
 report.sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'index.html'))).digest('hex');await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{}),args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 await boot(0);await boot(1);await pages[0].evaluate(()=>__kr.netHost());await pages[0].waitForFunction(()=>__kr.NET.grid.length===1&&!__kr.NET.status&&!__kr.NET.err,null,{timeout:25000});const code=await pages[0].evaluate(()=>__kr.NET.code);report.roomCode=code;await joined(pages[1],code,2);await pages[1].waitForFunction(()=>Number.isFinite(__kr.NET.clockRtt),null,{timeout:5000});let ss=await Promise.all(pages.map(state));check('Public host/join have unique client identities and slots0/1',new Set(ss.map(s=>s.clientId)).size===2&&ss[0].slot===0&&ss[1].slot===1,ss.map(s=>({clientId:s.clientId,slot:s.slot,clockRtt:s.clockRtt})));
 const first=await roundReady(2,true);await pages[0].screenshot({path:path.join(OUT,'host-first-go.png')});await pages[1].screenshot({path:path.join(OUT,'guest-first-go.png')});await Promise.all(pages.map(p=>p.keyboard.down('ArrowUp')));await pages[1].keyboard.down('ArrowRight');await pages[0].waitForTimeout(1500);await pages[1].keyboard.up('ArrowRight');await Promise.all(pages.map(p=>p.keyboard.up('ArrowUp')));ss=await Promise.all(pages.map(state));check('Both real clients move and exchange increasing position packets',ss.every(s=>s.position.v>0&&s.peers.some(p=>p.state&&p.lastSeq>2&&p.vis)),ss);
 await boot(2);await joined(pages[2],code,3);await pages[2].waitForFunction(()=>__kr.NET.roundId&&__kr.RACE.state==='run',null,{timeout:12000});let late=await state(pages[2]);check('Late join receives current round and a unique third grid slot',late.round===first.id&&late.slot===2,late);await pages[2].keyboard.down('ArrowUp');await pages[2].keyboard.down('ArrowLeft');await pages[0].waitForTimeout(1500);await pages[2].keyboard.up('ArrowLeft');await pages[2].keyboard.up('ArrowUp');ss=await Promise.all(pages.map(state));const third=ss[2].id;check('Host relays the third client movement to the other guest',ss[0].peers.some(p=>p.id===third&&p.lastSeq>2&&p.state.v>0)&&ss[1].peers.some(p=>p.id===third&&p.lastSeq>2&&p.state.v>0),ss);
 const before=await state(pages[1]);await pages[1].evaluate(()=>__kr.netLeave());await pages[0].waitForFunction(id=>!__kr.NET.grid.some(q=>q.id===id),before.id,{timeout:15000});await joined(pages[1],code,3);await pages[1].waitForFunction(()=>__kr.RACE.state==='run',null,{timeout:12000});const rejoined=await state(pages[1]);check('Leaving and reconnecting preserves client identity and vacant grid slot',rejoined.id!==before.id&&rejoined.clientId===before.clientId&&rejoined.slot===before.slot,{before,after:rejoined});
 const second=await roundReady(3,false);check('Again starts a new shared round',second.id!==first.id&&second.ready.every(s=>s.roundNo===2));report.transportStats=await Promise.all(pages.map(stats));check('Native data channels have real state traffic',report.transportStats.every(list=>list.some(p=>p.channels.some(c=>c.label==='st'&&c.messagesSent>0&&c.messagesReceived>0))),report.transportStats);await pages[0].screenshot({path:path.join(OUT,'three-client-round2.png')});
 await Promise.all(pages.map(p=>p.evaluate(()=>__kr.halt(true))));for(let i=3;i<MAX_CLIENTS;i++){const page=await boot(i,true);await joined(page,code,i+1);}await Promise.all(pages.map(p=>p.waitForFunction(()=>__kr.NET.grid.length===8,null,{timeout:10000})));ss=await Promise.all(pages.map(state));report.eightClientLobby=ss;check('Eight independent contexts receive eight unique stable grid assignments',new Set(ss.map(s=>s.slot)).size===8&&new Set(ss.map(s=>s.clientId)).size===8&&ss.every(s=>s.grid.length===8&&JSON.stringify(s.grid)===JSON.stringify(ss[0].grid)),ss.map(s=>({slot:s.slot,id:s.id,clientId:s.clientId,grid:s.grid})));const positions=await pages[0].evaluate(()=>__kr.NET.grid.map(g=>({slot:g.slot,...__kr.netDebug.position(g.slot),W:__kr.CARS[g.car].W,L:__kr.CARS[g.car].L})));check('Eight assigned start rectangles do not overlap',positions.every((a,i)=>positions.slice(i+1).every(b=>Math.abs(a.x-b.x)>=(a.W+b.W)/2+.01||Math.abs(a.s-b.s)>=(a.L+b.L)/2+.01)),positions);
 // Continue beyond lobby-only coverage: all eight clients render, ignite and drive.
 await Promise.all(pages.map(p=>p.evaluate(()=>__kr.halt(false))));
 const thirdRound=await roundReady(8,false);
 const starts=thirdRound.ready.map(s=>s.position.s);
 await Promise.all(pages.map(p=>p.keyboard.down('ArrowUp')));
 await pages[0].waitForTimeout(3200);
 await Promise.all(pages.map(p=>p.keyboard.up('ArrowUp')));
 ss=await Promise.all(pages.map(state));
 check('All eight real racers accelerate and advance from their own grid',ss.every((s,i)=>s.position.v>2&&s.position.s>starts[i]+2),ss.map((s,i)=>({slot:s.slot,startS:starts[i],...s.position})));
 check('Every racer receives live movement for all seven rivals',ss.every(s=>s.peers.filter(p=>p.state&&p.state.round===s.round&&p.lastSeq>4&&p.vis).length===7),ss.map(s=>({slot:s.slot,peers:s.peers.map(p=>({id:p.id,lastSeq:p.lastSeq,vis:p.vis,s:p.state?.s,v:p.state?.v}))})));
 report.eightClientDriving=ss;
 const liveRank=await Promise.all(pages.map(p=>p.evaluate(()=>({list:__kr.netDebug.standings(),layout:__kr.NET.hudLayout}))));
 check('Eight clients display live normalized standings for all eight racers',liveRank.every(r=>r.list.length===8&&r.list.every(q=>Number.isFinite(q.progress)&&q.progress>=0&&q.progress<=1)&&r.layout?.count===8),liveRank);
 await pages[0].setViewportSize({width:667,height:375});await pages[0].waitForTimeout(350);
 const mobileRank=await pages[0].evaluate(()=>({layout:__kr.NET.hudLayout,w:innerWidth,h:innerHeight}));
 check('Eight-player ranking panel fits small landscape screens',mobileRank.layout.x>=0&&mobileRank.layout.x+mobileRank.layout.w<=mobileRank.w&&mobileRank.layout.y+mobileRank.layout.h<mobileRank.h,mobileRank);
 await pages[0].screenshot({path:path.join(OUT,'eight-player-mobile-ranking.png')});await pages[0].setViewportSize({width:960,height:540});
 report.eightClientTransport=await Promise.all(pages.map(stats));
 check('Eight-client race has native WebRTC traffic in both directions',report.eightClientTransport.every(list=>list.some(p=>p.channels.some(c=>c.label==='st'&&c.messagesSent>5&&c.messagesReceived>5))),report.eightClientTransport);
 await pages[0].screenshot({path:path.join(OUT,'eight-client-race.png')});
 const dimensionCheck=await pages[0].evaluate(()=>{
   const a=__kr,positions=a.NET.grid.map(g=>a.netDebug.position(g.slot)),cars=a.CARS;
   const violations=[];
   for(let i=0;i<positions.length;i++)for(const car of cars){const p=positions[i];if(Math.abs(p.x)+car.W/2+.2>a.NET.gridLayout.halfWidth)violations.push({slot:i,car:car.id,why:'outside asphalt'});
     for(let j=i+1;j<positions.length;j++)for(const other of cars){const q=positions[j];if(Math.abs(p.x-q.x)<(car.W+other.W)/2+.01&&Math.abs(p.s-q.s)<(car.L+other.L)/2+.01)violations.push({slots:[i,j],cars:[car.id,other.id],why:'overlap'});}}
   return {cars:cars.map(c=>({id:c.id,W:c.W,L:c.L})),placements:80,pairCombinations:2800,violations};
 });
 check('All ten car dimensions fit every starting slot and all 2800 car-pair combinations',dimensionCheck.cars.length===10&&dimensionCheck.violations.length===0,dimensionCheck);
 // Fork tests use real road geometry and native state/control channels. The
 // approach is teleported only to isolate protocol ordering from a full run.
 const approachFork=async(page,piece,side,remain=240,speed=0)=>page.evaluate(({piece,side,remain,speed})=>{const a=__kr,p=a.ROUTE.pieces[piece];a.go(piece,p.L-remain,p.forkOff[side]);a.PC.v=speed;a.PC.vx=0;a.PC.crash=null;a.RACE.state='run';a.RACE.time=300;a.TRAFFIC.list=[];a.HAZ.list=[];return{index:piece,children:p.children.map(q=>a.ROUTE.pieces.indexOf(q))};},{piece,side,remain,speed});
 const firstFork=await approachFork(pages[1],0,1);
 await Promise.all(pages.map(p=>p.waitForFunction(()=>__kr.NET.forkLocks[0]?.side===1,null,{timeout:8000})));
 const chosen1=await Promise.all(pages.map(p=>p.evaluate(()=>__kr.NET.forkLocks[0])));
 check('First guest to reach fork locks right for all eight clients',chosen1.every(q=>q.side===1&&q.by===ss[1].clientId),chosen1);
 await approachFork(pages[0],0,0,35,30);
 await pages[0].evaluate(()=>{const a=__kr;window.__qaForkBoundary={samples:0,violations:[]};let until=performance.now()+6000;function sample(){const r=window.__qaForkBoundary,p=a.PC.piece;for(const sg of [-1,1]){const q=FormosaRoadBoundary.at(p,a.PC.s,sg);if(!q)continue;const limit=FormosaRoadBoundary.limit(p,a.PC.s,q,a.playerWidth()/2);r.samples++;if((a.PC.x-limit)*sg>.02)r.violations.push({p:p.id,s:a.PC.s,x:a.PC.x,sg,limit});}if(performance.now()<until)requestAnimationFrame(sample);}requestAnimationFrame(sample);});
 await pages[0].keyboard.down('ArrowLeft');await pages[0].keyboard.down('ArrowUp');
 await pages[0].waitForTimeout(1800);await pages[0].keyboard.up('ArrowLeft');
 await pages[0].waitForFunction(pi=>__kr.ROUTE.pieces.indexOf(__kr.PC.piece)===pi,firstFork.children[1],{timeout:10000});await pages[0].keyboard.up('ArrowUp');
 check('Later host initially driving left follows the locked right branch without route desync',await pages[0].evaluate(pi=>__kr.ROUTE.pieces.indexOf(__kr.PC.piece)===pi&&__kr.RACE.route.at(-1)===__kr.ROUTE.pieces[pi].id,firstFork.children[1]));
 const guidedBoundary=await pages[0].evaluate(()=>window.__qaForkBoundary);check('Network fork guidance remains inside the visible physical road boundaries',guidedBoundary.samples>10&&guidedBoundary.violations.length===0,guidedBoundary);
 await approachFork(pages[2],firstFork.children[1],0);
 await Promise.all(pages.map(p=>p.waitForFunction(()=>__kr.NET.forkLocks[1]?.side===0,null,{timeout:8000})));
 const chosen2=await Promise.all(pages.map(p=>p.evaluate(()=>__kr.NET.forkLocks[1])));
 check('Next stage has a new first arrival and independently locks left for everyone',chosen2.every(q=>q.side===0&&q.by===ss[2].clientId),chosen2);
 report.forkLocks=await pages[0].evaluate(()=>__kr.NET.forkLocks);
 await Promise.all(pages.map(p=>p.evaluate(()=>__kr.halt(true))));
 const ninth=await boot(8,true);
 await ninth.evaluate(code=>__kr.netJoin(code),code);
 await ninth.waitForFunction(()=>__kr.NET.err.includes('房間已滿'),null,{timeout:25000});
 await ninth.waitForTimeout(500);
 const rejected=await state(ninth);
 check('Ninth independent client is rejected with a persistent room-full explanation',rejected.phase==='idle'&&rejected.error.includes('房間已滿')&&rejected.slot===-1,rejected);
 await pages[0].waitForFunction(()=>__kr.NET.grid.length===8&&[...__kr.NET.peers.values()].filter(p=>p.name&&!p.rejected).length===7,null,{timeout:5000});
 check('Capacity rejection leaves the existing eight grid assignments unchanged',JSON.stringify((await state(pages[0])).grid)===JSON.stringify(ss[0].grid));
 await ninth.context().close();pages.pop();
 // A different new identity must take the vacated slot without moving the seven others.
 const oldLast=await state(pages[7]);
 await pages[7].evaluate(()=>__kr.netLeave());
 await pages[0].waitForFunction(id=>!__kr.NET.grid.some(q=>q.id===id),oldLast.id,{timeout:15000});
 const disconnectRank=await pages[0].evaluate(id=>__kr.netDebug.standings().find(q=>q.id===id),oldLast.id);
 check('A disconnected racer remains marked at the last known race progress',disconnectRank?.disconnected===true,disconnectRank);
 await pages[7].context().close();pages.pop();
 const replacementPage=await boot(7,true);await joined(replacementPage,code,8);
 const replacementState=await state(replacementPage),replacementRoster=await state(pages[0]);
 check('Rejoining client receives the same locked route decisions',JSON.stringify(await replacementPage.evaluate(()=>__kr.NET.forkLocks))===JSON.stringify(report.forkLocks));
 check('A new player takes only the vacated eighth grid slot',replacementState.clientId!==oldLast.clientId&&replacementState.slot===oldLast.slot&&ss[0].grid.filter(g=>g.id!==oldLast.id).every(g=>replacementRoster.grid.some(q=>q.id===g.id&&q.slot===g.slot)),{old:oldLast.clientId,new:replacementState.clientId,slot:replacementState.slot,grid:replacementRoster.grid});
 // Use the real lobby car picker to cover cars nine and ten in a live restart.
 for(const [client,car] of [[6,8],[7,9]]){
   const p=pages[client];await p.evaluate(()=>__kr.show('online'));await p.locator('[data-net="car"]').click();
   for(let n=client;n<car;n++)await p.locator('[data-act="next"]').click();
   await p.locator('[data-act="pick"]').click();
 }
 await pages[0].waitForFunction(()=>__kr.NET.grid.filter(g=>g.car===8||g.car===9).length===2,null,{timeout:8000});
 await Promise.all(pages.map(p=>p.evaluate(()=>__kr.halt(false))));
 const fourthRound=await roundReady(8,false);
 check('New online round clears all previous fork choices',(await Promise.all(pages.map(p=>p.evaluate(()=>__kr.NET.forkLocks.length)))).every(n=>n===0));
 check('Eight-client restart keeps all grid slots and includes cars nine and ten',fourthRound.id!==thirdRound.id&&fourthRound.ready.every(s=>s.roundNo===4)&&fourthRound.ready[0].grid.some(g=>g.car===8)&&fourthRound.ready[0].grid.some(g=>g.car===9),fourthRound.ready.map(s=>({slot:s.slot,round:s.round,grid:s.grid})));
 await Promise.all(pages.map(p=>p.keyboard.down('ArrowUp')));await pages[0].waitForTimeout(1800);await Promise.all(pages.map(p=>p.keyboard.up('ArrowUp')));
 ss=await Promise.all(pages.map(state));check('All eight racers move after the restart with the final two car models',ss.every(s=>s.position.v>1&&s.position.s>s.layout.baseS-Math.floor(s.slot/2)*s.layout.rowGap-(s.slot%2)*s.layout.stagger),ss.map(s=>({slot:s.slot,...s.position})));
 report.eightClientScope='Eight independent fresh desktop browser contexts completed live ignition, driving, seven-rival state exchange and a restart using all ten car models across rounds. Ninth context tested capacity rejection. This is one desktop/network, not eight physical phones or a mobile FPS/NAT benchmark.';

 // Protocol timing is isolated from a six-minute full run: place two guests at
 // real destination geometry, then let native state/finish channels report it.
 // Establish all four host-authoritative choices before accepting destination
 // states; a client cannot skip into an unselected parallel branch.
 let finishPiece=0;
 for(let stage=0;stage<4;stage++){const q=await approachFork(pages[1],finishPiece,0);await pages[0].waitForFunction(stage=>__kr.NET.forkLocks[stage]?.side===0,stage,{timeout:8000});finishPiece=q.children[0];}
 await Promise.all(pages.map(p=>p.waitForFunction(()=>__kr.NET.forkLocks.filter(Boolean).length===4,null,{timeout:8000})));
 const finishGuest=async(page)=>page.evaluate(()=>{const a=__kr,p=a.ROUTE.pieces.find(p=>p.goalS&&p.id==='s5a');a.go(a.ROUTE.pieces.indexOf(p),p.goalS+1,0);a.PC.v=0;a.RACE.state='goal';a.RACE.elapsed=.001;a.NET.finishSent=false;});
 await finishGuest(pages[1]);await pages[0].waitForFunction(()=>__kr.netDebug.standings().some(q=>q.slot===1&&q.fin?.time!=null),null,{timeout:8000});
 await pages[0].waitForTimeout(400);await finishGuest(pages[2]);await pages[0].waitForFunction(()=>__kr.netDebug.standings().filter(q=>q.fin?.time!=null).length===2,null,{timeout:8000});
 await Promise.all(pages.map(p=>p.waitForFunction(()=>__kr.netDebug.standings().filter(q=>q.fin?.time!=null).length===2,null,{timeout:8000})));
 const finishRanks=await Promise.all(pages.map(p=>p.evaluate(()=>__kr.netDebug.standings().slice(0,2).map(q=>({slot:q.slot,time:q.fin.time})))));
 check('All eight clients agree on host-timed finish order and ignore client elapsed claims',finishRanks.every(list=>list[0].slot===1&&list[1].slot===2&&list[0].time>1&&list[1].time>list[0].time)&&finishRanks.every(list=>JSON.stringify(list)===JSON.stringify(finishRanks[0])),finishRanks);

 await pages[0].evaluate(()=>__kr.netLeave());await Promise.all(pages.slice(1).map(p=>p.waitForFunction(()=>__kr.NET.lost||__kr.NET.err.includes('房主'),null,{timeout:15000})));check('Every guest reports host departure',true,await Promise.all(pages.slice(1).map(state)));check('No page script errors',report.errors.length===0,report.errors);report.status='PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack || String(error);
  report.failureStates = await Promise.all(pages.map(page => state(page).catch(error => ({ error: String(error) }))));
  process.exitCode = 1;
} finally {
  // Include partially booted contexts too. Cleanup runs on both success and error.
  report.cleanupErrors = [];
  if (browser) {
    const contexts = browser.contexts();
    for (const context of contexts) for (const page of context.pages()) {
      try { await page.evaluate(() => window.__kr?.netLeave()); }
      catch { /* A closed page already released its transports. */ }
    }
    for (const context of contexts) {
      try { await context.close(); }
      catch (error) { report.cleanupErrors.push(String(error)); }
    }
    try { await browser.close(); }
    catch (error) { report.cleanupErrors.push(String(error)); }
  }
  if (server.listening) await new Promise(resolve => server.close(resolve));
  if (report.cleanupErrors.length) { report.status = 'FAIL'; process.exitCode = 1; }
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.map(c => ({ name: c.name, pass: c.pass })), failure: report.failure, errors: report.errors, cleanupErrors: report.cleanupErrors, report: path.join(OUT, 'live-report.json') }, null, 2));
}
})().catch(error => { console.error(error); process.exitCode = 1; });
