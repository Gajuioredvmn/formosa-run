// Actual inline online/start/ignition functions in deterministic isolated peers.
// Real WebRTC transport is separately exercised by the two-browser smoke test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace(/\r\n/g,'\n');
const slice=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return source.slice(i,j);};
const online=slice('const NET_CFG = ','// a rival on screen:');
const ignition=slice('const IGN = ','function ease(');
const cars=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/game.json'),'utf8')).cars;
function context(){
 const c={assert,console,Math:Object.create(Math),Map,Set,Infinity,__now:100000,Date:{now:()=>c.__now},CARS:cars.map(x=>({...x})),window:{},navigator:{},document:{addEventListener(){}},__timers:[],__sockets:[],__starts:0};
 c.setTimeout=(fn,ms)=>{const t={fn,ms,active:true};c.__timers.push(t);return t;};c.clearTimeout=t=>{if(t)t.active=false;};c.setInterval=c.setTimeout;c.clearInterval=c.clearTimeout;
 c.WebSocket=class{constructor(url){this.url=url;this.readyState=1;c.__sockets.push(this);}send(){}close(){this.readyState=3;if(this.onclose)this.onclose();}};
 c.RTCPeerConnection=class{constructor(){this.connectionState='new';this.closed=0;}close(){this.closed++;this.connectionState='closed';if(this.onconnectionstatechange)this.onconnectionstatechange();}};
 vm.createContext(c);vm.runInContext(`
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=x=>x;
const SET={name:'tester'},UI={sel:0},G={mode:'play',state:'race',t:0},LANE=3.7,WORLD_K=1.5,STAGES={s1:{time:95}};
const PC={piece:null,rpm:0,redline:7500,throttle:0},ROUTE={root:{id:'s1',L:4000,startS:90,hw:()=>7.4},pieces:[]};ROUTE.pieces=[ROUTE.root];
const CAM={init:false},HUD={show:true,msgs:[]},GHOST={rec:[],recT:0,load(){},on:false},FX={roll:0};
const carSprites=()=>({}),pcSetup=(spec)=>Object.assign(PC,{spec,v:0,vx:0}),controlsReset=()=>{},layoutPads=()=>{},engineStart=()=>{},trafficReset=()=>{},fxReset=()=>{},hazardsReset=()=>{};
const sfxKey=()=>{},sfxDing=()=>{},sfxStarter=()=>{},sfxCatch=()=>{},sfxBeep=()=>{},hudMsg=()=>{},badgeSurprise=()=>{},sfxPass=()=>{};
const avatarDecode=(s,cb)=>cb(null),startPlay=()=>{__starts++;G.mode='play';raceStart(NET.me.car,true,false);};
`,c);
 // Only the countdown prefix is needed; no gameplay force is stubbed or changed.
 const raceStart=slice('const RACE = ','function onCrash()');
 const countdown=slice('function raceUpdate(dt) {','  // Resolve the road travelled');
 vm.runInContext(raceStart+ignition+'\n'+countdown+'}\n'+online,c);
 return c;
}
// Expose lexical state only inside this isolated test VM.
const run=(c,code)=>vm.runInContext(code,c);
function host(){const c=context();run(c,"netHost();NET.ws.onmessage({data:JSON.stringify({type:'OPEN'})});");return c;}
function add(c,id,clientId=id,car=0){return run(c,`(()=>{const p=netPeer(${JSON.stringify(id)});p.sent=[];p.ctl={readyState:'open',send:s=>p.sent.push(JSON.parse(s))};netOnMsg(p,{t:'hello',clientId:${JSON.stringify(clientId)},name:${JSON.stringify(id)},car:${car}});return p})()`);}
const tests=[];const test=(name,fn)=>tests.push({name,fn});
test('Host-assigned slots differ, never depend on me-first ordering, and eight mixed cars do not overlap',()=>{
 const c=host();for(let i=1;i<8;i++)add(c,'p'+i,'client'+i,i);
 run(c,`NET.gridLayout=netBuildGridLayout(ROUTE.root);assert.equal(netSlot(),0);assert.equal(NET.grid.length,8);const all=NET.grid.map(q=>({...netGridPosition(q.slot),spec:CARS[q.car],slot:q.slot}));
 for(let i=0;i<all.length;i++){const a=all[i];assert(Math.abs(a.x)+a.spec.W/2<ROUTE.root.hw(a.s));for(let j=i+1;j<all.length;j++){const b=all[j];assert(Math.abs(a.x-b.x)>=(a.spec.W+b.spec.W)/2+.1||Math.abs(a.s-b.s)>=(a.spec.L+b.spec.L)/2+1);}}
 assert.equal(new Set(all.map(a=>a.slot)).size,8);`);
 const packet=run(c,'JSON.parse(JSON.stringify({grid:NET.grid,players:netPlayers()}))'),client=context();
 client.packet=packet;run(client,"NET.on=true;NET.id='p5';NET.me.clientId='client5';const h=netPeer('host');h.host=true;netOnMsg(h,{t:'lobby',...packet});assert.equal(netSlot(),5);");
});
test('Disconnect, reconnect identity and late joins preserve all occupied slots; empty slots are reused',()=>{
 const c=host();add(c,'one','same-person');add(c,'two');const original=run(c,'NET.grid.find(q=>q.id===\'two\').slot');
 run(c,"netDrop('one');");add(c,'reconnected','same-person');assert.equal(run(c,"NET.grid.find(q=>q.id==='reconnected').slot"),1);assert.equal(run(c,"NET.grid.find(q=>q.id==='two').slot"),original);
 run(c,"netDrop('reconnected');");add(c,'new-person');assert.equal(run(c,"NET.grid.find(q=>q.id==='new-person').slot"),1);add(c,'again','same-person');assert.equal(run(c,"NET.grid.find(q=>q.id==='again').slot"),3);assert.equal(run(c,"NET.grid.find(q=>q.id==='two').slot"),original);
});
test('Ninth player receives explicit room-full before deferred close; client error survives close',()=>{
 const c=host();for(let i=1;i<8;i++)add(c,'p'+i);const extra=add(c,'ninth');assert(extra.sent.some(x=>x.t==='room-full'));assert.equal(run(c,'NET.grid.length'),8);assert(run(c,"NET.peers.has('ninth')"));
 const close=c.__timers.find(t=>t.active&&t.ms===250);close.fn();assert(!run(c,"NET.peers.has('ninth')"));
 const client=context();run(client,"NET.on=true;NET.id='guest';NET.phase='lobby';const h=netPeer('host');h.host=true;const pc=new RTCPeerConnection();netWire(h,pc,'test');netOnMsg(h,{t:'room-full'});pc.connectionState='closed';pc.onconnectionstatechange();assert.equal(NET.phase,'idle');assert(NET.err.includes('已滿'));assert.equal(NET.lost,false);");
});
test('Every online round ignites, shared goAt survives animation skip and clock skew',()=>{
 const h=host();add(h,'guest');run(h,"G.noIgnite=true;netStartRace(2);assert.equal(RACE.state,'ignition');assert.equal(IGN.on,true);assert.equal(NET.goAt-Date.now(),10100);");
 const packet=run(h,'JSON.parse(JSON.stringify(netStartPacket(false)))'),c=context();c.__now=200000;c.packet=packet;
 run(c,"NET.on=true;NET.id='guest';NET.me.clientId='guest';const p=netPeer(packet.grid[0].id);p.host=true;p.ctl={readyState:'open',send(){}};netOnMsg(p,{t:'clock-pong',clientAt:199980,hostAt:99990});assert.equal(NET.clockOffset,-100000);netOnMsg(p,packet);assert.equal(RACE.state,'ignition');assert.equal(netSlot(),1);igniteSkip();igniteUpdate(2);assert.equal(RACE.state,'countdown');assert(RACE.countdown>10);raceUpdate(99);assert.equal(RACE.state,'countdown');assert.equal(PC.v,0);");
 c.__now=210099;run(c,"raceUpdate(1);assert.equal(RACE.state,'countdown');");c.__now=210100;run(c,"raceUpdate(.001);assert.equal(RACE.state,'run');");
 run(h,"NET.phase='lobby';netHostStart();assert.equal(RACE.state,'ignition');assert.equal(IGN.t,0);assert.equal(NET.roundNo,2);");
});
test('Single-player keeps full key/starter/catch sequence and original dt countdown',()=>{
 const c=context();run(c,"NET.on=false;delete G.noIgnite;raceStart(0,true,false);assert.equal(RACE.state,'ignition');igniteUpdate(1);assert.equal(IGN.acc,true);assert.equal(IGN.caught,false);igniteUpdate(1.3);assert.equal(IGN.caught,true);igniteUpdate(1.1);assert.equal(IGN.on,false);assert.equal(RACE.state,'countdown');assert.equal(RACE.countdown,4.2);raceUpdate(.2);assert.equal(RACE.countdown,4);");
});
test('Old round and out-of-order position packets cannot rewind a rival',()=>{
 const c=host(),p=add(c,'guest');run(c,"netStartRace();");c.p=p;
 run(c,"netOnMsg(p,{t:'st',round:NET.roundId,q:4,p:0,s:100,x:1,v:20});assert.equal(p.state.s,100);netOnMsg(p,{t:'st',round:NET.roundId,q:3,p:0,s:50});assert.equal(p.state.s,100);const old=NET.roundId;NET.phase='lobby';netHostStart();netOnMsg(p,{t:'st',round:old,q:100,p:0,s:10});assert.equal(p.state,null);netOnMsg(p,{t:'st',round:NET.roundId,q:0,p:0,s:90,x:1,v:0});assert.equal(p.state.s,90);");
});
test('Late join gets existing round schedule without moving the existing grid',()=>{
 const c=host();add(c,'first');run(c,"netStartRace();");const before=run(c,'JSON.stringify(NET.grid)'),at=run(c,'NET.goAt');const late=add(c,'late','late',9);assert.equal(run(c,'NET.goAt'),at);const packet=late.sent.find(x=>x.t==='start');assert(packet&&packet.late);assert.equal(packet.goAt,at);const existing=JSON.parse(before);for(const q of existing)assert.equal(run(c,`NET.grid.find(x=>x.id===${JSON.stringify(q.id)}).slot`),q.slot);
});
test('Old signalling and channel callbacks cannot contaminate a newer session; close is nonrecursive',()=>{
 const c=host(),old=c.__sockets[0];c.old=old;run(c,"netHost();NET.ws.onmessage({data:JSON.stringify({type:'OPEN'})});NET.err='new-session';");old.onerror();old.onclose();old.onmessage({data:JSON.stringify({type:'ID-TAKEN'})});assert.equal(run(c,'NET.err'),'new-session');assert.equal(c.__sockets.length,2);
 run(c,"const p=netPeer('gone'),pc=new RTCPeerConnection();netWire(p,pc,'old');const ch={label:'ctl',readyState:'open',send(){}};netChannel(p,ch);const stale=ch.onmessage;netDrop(p.id,p);assert.equal(pc.closed,1);const replacement=netPeer('gone');replacement.name='new';stale({data:JSON.stringify({t:'hello',name:'old'})});assert.equal(replacement.name,'new');assert.equal(NET.peers.get('gone'),replacement);");
});
test('ICE candidates wait for the matching remote description and are not applied to a replacement connection',()=>{
 const c=host();run(c,"const p=netPeer('ice'),a=new RTCPeerConnection();a.added=[];a.addIceCandidate=x=>{a.added.push(x);return Promise.resolve();};netWire(p,a,'first');netIce(p,{candidate:'early'});assert.equal(a.added.length,0);assert.equal(p.ice.length,1);a.remoteDescription={type:'offer'};netFlushIce(p,a);assert.equal(a.added.length,1);const b=new RTCPeerConnection();b.addIceCandidate=()=>{throw Error('Old candidate applied to new connection');};netWire(p,b,'second');netFlushIce(p,a);assert.equal(p.ice.length,0);");
});
test('Reliable channel closure immediately frees a grid slot and cannot drop its replacement',()=>{
 const h=host();add(h,'guest','same-client');
 run(h,"const p=NET.peers.get('guest'),pc=new RTCPeerConnection();netWire(p,pc,'first');const ch={label:'ctl',readyState:'open',send(){}};netChannel(p,ch);pc.connectionState='disconnected';pc.onconnectionstatechange();assert(NET.peers.has('guest'));const closed=ch.onclose;closed();assert(!NET.peers.has('guest'));assert(!NET.grid.some(q=>q.id==='guest'));globalThis.oldClose=closed;");
 add(h,'guest','same-client');run(h,"oldClose();assert(NET.peers.has('guest'));assert.equal(NET.grid.find(q=>q.id==='guest').slot,1);");
 const c=context();run(c,"NET.on=true;NET.id='client';NET.phase='race';const h=netPeer('host');h.host=true;h.opened=true;netWire(h,new RTCPeerConnection(),'host');const ch={label:'ctl',readyState:'open',send(){}};netChannel(h,ch);ch.onclose();assert.equal(NET.lost,true);assert(NET.err.includes('房主'));assert(!NET.peers.has('host'));");
});

test('Live standings normalize different branch lengths and resolve ties by grid slot',()=>{
 const c=host();add(c,'one');add(c,'two');run(c,`netStartRace();const a={id:'a',L:2000,parent:ROUTE.root},b={id:'b',L:5000,parent:ROUTE.root};ROUTE.pieces.push(a,b);
 assert.equal(netCourseProgress({p:1,s:1000}),netCourseProgress({p:2,s:2500}));
 netObserve(NET.peers.get('one'),{p:1,s:1000});netObserve(NET.peers.get('two'),{p:2,s:2500});
 const list=netStandings();assert.equal(list[0].id,'one');assert.equal(list[1].id,'two');assert.equal(list[0].progress,.3);`);
});
test('Host timing ignores claimed finish time and requires actual goal progress',()=>{
 const c=host();const p=add(c,'guest');c.p=p;run(c,`netStartRace();netOnMsg(p,{t:'fin',round:NET.roundId,status:'goal',time:.001});assert.equal(p.fin,null);
 let previous=ROUTE.root;for(let i=0;i<4;i++){const next={id:'stage'+i,L:2000,parent:previous};ROUTE.pieces.push(next);previous=next;}previous.goalS=1800;`);
 c.__now=run(c,'NET.goAt')+420000;
 run(c,`netOnMsg(p,{t:'st',round:NET.roundId,q:1,p:4,s:1801,x:0,v:0});assert.equal(p.fin.time,420);assert.equal(p.fin.hostAt,Date.now());
 netOnMsg(p,{t:'fin',round:NET.roundId,status:'goal',time:0});assert.equal(p.fin.time,420);assert.equal(netStandings()[0].id,'guest');`);
});
test('Disconnected racers remain visible at their last progress until the next round',()=>{
 const c=host();add(c,'guest');run(c,`netStartRace();netObserve(NET.peers.get('guest'),{p:0,s:1000});netDrop('guest');const lost=netStandings().find(q=>q.id==='guest');assert(lost);assert.equal(lost.disconnected,true);assert.equal(lost.progress,.05);NET.phase='lobby';netHostStart();assert(!netStandings().some(q=>q.id==='guest'));`);
});
test('Clients accept ranking only from the host and only for the active round',()=>{
 const c=context();run(c,`NET.on=true;NET.id='client';NET.roundId='current';const h=netPeer('host');h.host=true;const other=netPeer('other');
 const players=[{id:'client',clientId:NET.me.clientId,slot:1,name:'me',progress:.4,fin:{time:410}}];
 netOnMsg(other,{t:'rank',round:'current',players});assert.equal(NET.ranking.length,0);netOnMsg(h,{t:'rank',round:'old',players});assert.equal(NET.ranking.length,0);
 netOnMsg(h,{t:'rank',round:'current',players});assert.equal(NET.ranking.length,1);assert.equal(NET.myFin.time,410);assert.equal(netStandings()[0].me,true);`);
});
test('First host-observed racer locks each fork; later racers and replayed choices cannot change it',()=>{
 const c=host();add(c,'early');add(c,'late');run(c,`netStartRace();ROUTE.root.children=[{id:'left',L:3000,parent:ROUTE.root},{id:'right',L:3500,parent:ROUTE.root}];ROUTE.root.forkDiv=0;ROUTE.pieces.push(...ROUTE.root.children);`);c.__now=run(c,'NET.goAt')+100;
 run(c,`const early=NET.peers.get('early'),late=NET.peers.get('late');
 netOnMsg(late,{t:'st',round:NET.roundId,q:0,p:0,s:3600,x:-4,v:20});assert.equal(NET.forkLocks.length,0);
 netOnMsg(early,{t:'st',round:NET.roundId,q:0,p:0,s:3760,x:4,v:20});assert.equal(NET.forkLocks[0].side,1);assert.equal(NET.forkLocks[0].by,early.clientId);
 netOnMsg(late,{t:'st',round:NET.roundId,q:1,p:0,s:3780,x:-4,v:20});assert.equal(NET.forkLocks[0].side,1);assert.equal(netForkChoice(ROUTE.root),1);
 netOnMsg(early,{t:'st',round:NET.roundId,q:0,p:0,s:3800,x:-4,v:20});assert.equal(NET.forkLocks[0].side,1);
 netOnMsg(late,{t:'fork-lock',round:NET.roundId,lock:{stage:0,p:0,side:0}});assert.equal(NET.forkLocks[0].side,1);
 netOnMsg(late,{t:'st',round:NET.roundId,q:2,p:1,s:100,x:0,v:20});assert.equal(late.state.p,0);
 const right=ROUTE.pieces[2];right.children=[{id:'RL',L:2400,parent:right},{id:'RR',L:2200,parent:right}];ROUTE.pieces.push(...right.children);
 netOnMsg(late,{t:'st',round:NET.roundId,q:3,p:2,s:3260,x:-3,v:20});assert.equal(NET.forkLocks[1].by,late.clientId);assert.equal(NET.forkLocks[1].side,0);
 netOnMsg(early,{t:'st',round:NET.roundId,q:4,p:2,s:3290,x:3,v:20});assert.equal(NET.forkLocks[1].side,0);
 assert.equal(netStartPacket(true).forks.length,2);const oldRound=NET.roundId;NET.phase='lobby';netHostStart();assert.equal(NET.forkLocks.length,0);
 netOnMsg(early,{t:'st',round:oldRound,q:99,p:0,s:3900,x:4,v:20});assert.equal(NET.forkLocks.length,0);`);
});
test('Fork snapshots are ordered by ancestry and accepted only from the current host and round',()=>{
 const c=context();run(c,`NET.on=true;NET.phase='race';NET.id='guest';NET.roundId='round';ROUTE.root.children=[{id:'L',L:1000,parent:ROUTE.root},{id:'R',L:1000,parent:ROUTE.root}];ROUTE.pieces.push(...ROUTE.root.children);const h=netPeer('host');h.host=true;const other=netPeer('other');
 const lock={stage:0,p:0,side:1,by:'first',at:Date.now()};netOnMsg(other,{t:'fork-lock',round:'round',lock});assert.equal(NET.forkLocks.length,0);netOnMsg(h,{t:'fork-lock',round:'stale',lock});assert.equal(NET.forkLocks.length,0);
 netOnMsg(h,{t:'fork-lock',round:'round',lock});assert.equal(netForkChoice(ROUTE.root),1);netOnMsg(h,{t:'fork-lock',round:'round',lock:{...lock,side:0}});assert.equal(netForkChoice(ROUTE.root),1);
 assert(!netAcceptFork({stage:3,p:0,side:0}));assert(!netAcceptFork({stage:0,p:0,side:99}));`);
});
let failed=0;for(const t of tests){try{t.fn();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(`${tests.length-failed}/${tests.length} multiplayer checks passed`);process.exitCode=failed?1:0;
