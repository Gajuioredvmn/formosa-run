// One browser, one page at a time. This audits art/root contracts, not FPS.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/upright-palms-qa'));
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');fs.mkdirSync(out,{recursive:true});
(async()=>{const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),report={checks:[],errors:[],missing:[]};
 try{
  const url='http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(path.basename(root))+'/';
  const check=(name,pass,data)=>report.checks.push({name,pass:!!pass,data});
  async function load(baseline){const p=await browser.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
   if(baseline)await p.route('**/render/classic-street-art.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'render/classic-street-art.js'),'utf8').replace('function registerUprightPalms(api){','function registerUprightPalms(api){return false;')}));
   await p.goto(url);await p.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});await p.evaluate(()=>{__kr.halt(true);__kr.G.mode='play';__kr.G.noIgnite=true;__kr.race(0,true);__kr.run();__kr.bot(false);__kr.show(null);});return p;
  }
  const snapshot=p=>p.evaluate(()=>({
   roads:__kr.ROUTE.pieces.map(p=>({id:p.id,X:Array.from(p.X),Y:Array.from(p.Y),Z:Array.from(p.Z),H:Array.from(p.H),W:Array.from(p.W),K:Array.from(p.K),SH:Array.from(p.SH),M:Array.from(p.M),colliders:p.colliders})),
   palms:__kr.ROUTE.pieces.map(p=>({id:p.id,roots:p.sprites.filter(o=>__kr.SPRL[o.id].name.startsWith('pixel_palm#')).map(({id,...o})=>o)})),
  }));
  const baseline=await load(true),B=await snapshot(baseline);await baseline.close();const p=await load(false),A=await snapshot(p);
  check('All 31 road geometries and collision records are unchanged',hash(A.roads)===hash(B.roads));
  check('Every palm retains its exact root, scale, flip and wind phase',hash(A.palms)===hash(B.palms));
  report.hashes={roads:hash(A.roads),baselineRoads:hash(B.roads),roots:hash(A.palms),baselineRoots:hash(B.palms)};
  const data=await p.evaluate(()=>{
   const k=__kr,metadata=[0,1].map(i=>{const a=k.SPR['pixel_palm#'+i],b=k.SPR['pixel_palm#'+(i+2)];return{same:a.ww===b.ww&&a.wh===b.wh&&a.collide===b.collide,width:b.ww,height:b.wh,collide:b.collide,anchor:b.ax,placementAnchor:b.meta.placementAx};});
   const counts={streetBent:0,streetUpright:0,coastBent:0,coastUpright:0,alpinePalm:0};
   for(const piece of k.ROUTE.pieces)for(const o of piece.sprites){const name=k.SPRL[o.id].name;if(!name.startsWith('pixel_palm#'))continue;const sec=piece.sec(o.s),coast=[sec.L,sec.R].some(t=>/^(shore|beach|bay|cliff|pebble|mudflat)$/.test(t)),bent=Number(name.split('#')[1])<2;counts[(coast?'coast':'street')+(bent?'Bent':'Upright')]++;if(piece.id==='s5d'&&o.s>piece.L*.36)counts.alpinePalm++;}
   return{metadata,counts,ready:FormosaClassicStreetArt.state.uprightPalms,warnings:FormosaClassicStreetArt.state.warnings};
  });
  check('Upright drawings retain both original metre boxes and collision widths',data.ready&&data.metadata.every(x=>x.same&&x.anchor===.5),data.metadata);
  check('Formal avenues contain no identically leaning coconut rows',data.counts.streetBent===0&&data.counts.streetUpright>100,data.counts);
  check('Coastal natural bends remain a minority, with no palms above the alpine transition',data.counts.coastBent>0&&data.counts.coastBent<data.counts.coastUpright*.4&&data.counts.alpinePalm===0);
  for(const sample of [{id:'s1',fraction:.16},{id:'s4h',fraction:.5},{id:'s5d',fraction:.65}]){await p.evaluate(s=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id===s.id);k.go(k.ROUTE.pieces.indexOf(p),p.L*s.fraction,0);k.PC.v=0;k.step(0);},sample);await p.screenshot({path:path.join(out,sample.id+'.png')});}
  check('Actual game views load with no texture warnings, missing files or exceptions',!data.warnings.length&&!report.errors.length&&!report.missing.length);
  report.pass=report.checks.every(c=>c.pass);assert(report.pass,'Palm verification failed');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
