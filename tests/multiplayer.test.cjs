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

let failed=0;for(const t of tests){try{t.fn();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(`${tests.length-failed}/${tests.length} multiplayer checks passed`);process.exitCode=failed?1:0;
