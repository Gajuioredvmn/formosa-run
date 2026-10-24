// Targeted regression for four scene-review findings. One page at a time.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createServer}=require('./serve.cjs');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../formosa-work/final-scene-fixes'));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');fs.mkdirSync(out,{recursive:true});
const oldCoffee="  coffee(D, s0, s1) { const s = (s0 + s1) / 2; D.spr('coffee', s, D.lat(s, 1, 2), { flip: false }); D.spr('stonehouse', s + 12, D.lat(s, 1, 9)); },";
const oldHakka="  hakkavillage(D, s0, s1) { rowOf(D, s0, s1, 110, 30, D.rnd() < 0.5 ? -1 : 1, D.p.id === 's3se' ? 'hakkahouse' : 'hakkahouse_generic', 8, 20, { flip: false }); },";
(async()=>{const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),report={checks:[],errors:[],missing:[]};
 try{
  const check=(name,pass,data)=>report.checks.push({name,pass:!!pass,data});
  const current=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const before=current.replace(/^  coffee\(D, s0, s1\) \{[\s\S]*?^  \},/m,oldCoffee).replace(/^  hakkavillage\(D, s0, s1\) \{[\s\S]*?^  \},/m,oldHakka);
  assert(before!==current,'Baseline tag override was not applied');
  async function load(baseline){const p=await browser.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
   if(baseline)await p.route('**/',r=>r.fulfill({contentType:'text/html',body:before}));
   await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:120000});await p.evaluate(()=>{__kr.halt(true);__kr.G.mode='play';__kr.G.noIgnite=true;__kr.race(0,true);__kr.run();__kr.bot(false);__kr.show(null);});return p;
  }
  const roads=p=>p.evaluate(()=>__kr.ROUTE.pieces.map(p=>({id:p.id,X:Array.from(p.X),Y:Array.from(p.Y),Z:Array.from(p.Z),H:Array.from(p.H),K:Array.from(p.K),W:Array.from(p.W),SH:Array.from(p.SH),M:Array.from(p.M)})));
  const baseline=await load(true),oldRoads=await roads(baseline);await baseline.close();const page=await load(false),newRoads=await roads(page);
  check('All 31 road positions, elevations, curvatures, lane widths and shoulders are unchanged',digest(oldRoads)===digest(newRoads),{before:digest(oldRoads),after:digest(newRoads)});
  const audit=await page.evaluate(()=>{
   const k=__kr,art=FormosaClassicStreetArt,edge=(p,s,sg)=>sg<0?p.outerL(Math.round(s/k.DS)):p.outerR(Math.round(s/k.DS));
   const dry=(p,s,x,inward,outward)=>{const sg=x<0?-1:1,sec=p.sec(s),offset=sg*(x-edge(p,s,sg));return art.dryGroundRanges(k.sideBands(sg<0?sec.L:sec.R)).some(([a,b])=>offset-inward>=a-.001&&offset+outward<=b+.001);};
   const buildings=[],shrubs=[];
   for(const p of k.ROUTE.pieces)for(const o of p.sprites){const S=k.SPRL[o.id],sec=p.sec(o.s),sg=o.x<0?-1:1;
    if(/^hakkahouse/.test(S.name)&&(sec.tags||[]).includes('hakkavillage')){const w=S.ww*o.sc*o.sx,ax=o.flip?1-S.ax:S.ax,inward=w*(sg>0?ax:1-ax),outward=w-inward,offset=sg*(o.x-edge(p,o.s,sg));buildings.push({piece:p.id,s:o.s,name:S.name,offset,inward,outward,clearance:offset-inward,dry:dry(p,o.s,o.x,inward,outward),collide:S.collide,mirrored:o.flip});}
    if(/^(bush|bougain|hibiscus|hedge|flowers|tuft|mangrove|reeds)(#|$)/.test(S.name)&&!o.lm&&!o.y){const radius=Math.max(.06,Math.min(.25,S.ww*o.sc*o.sx*.12));if(!dry(p,o.s,o.x,radius,radius))shrubs.push({piece:p.id,s:o.s,name:S.name,x:o.x,L:sec.L,R:sec.R});}
   }
   const p=k.ROUTE.pieces.find(p=>p.id==='s5c'),a=p.secStartS[5],b=p.secStartS[6],middle=(a+b)/2;
   const coffee=p.sprites.filter(o=>o.s>=middle-.01&&o.s<=middle+12.01&&(/^(coffee|stonehouse)(#|$)/.test(k.SPRL[o.id].name))).map(o=>{const S=k.SPRL[o.id],w=S.ww*o.sc*o.sx,ax=o.flip?1-S.ax:S.ax,sg=o.x<0?-1:1,inward=w*(sg>0?ax:1-ax),outward=w-inward;return{name:S.name,s:o.s,x:o.x,dry:dry(p,o.s,o.x,inward,outward),colliderMatches:p.colliders.some(c=>Math.abs((c.x0+c.x1)/2-o.x)<.001&&Math.abs((c.s0+c.s1)/2-o.s)<.001),colliderIntrudes:p.colliders.some(c=>Math.abs((c.x0+c.x1)/2-o.x)<.001&&Math.abs((c.s0+c.s1)/2-o.s)<.001&&c.x1>edge(p,o.s,-1)&&c.x0<edge(p,o.s,1))};});
   const valley=k.ROUTE.pieces.find(p=>p.id==='s4c'),labels=valley.secs.map((sec,i)=>({i,label:FormosaLandmarkArt.regionalLabel(valley,valley.secStartS[i]+sec.len/2)}));
   return{buildings,wetShrubs:shrubs,coffee,labels};
  });
  check('Every Hakka village foundation clears the asphalt and lies entirely on dry land',audit.buildings.length>0&&audit.buildings.every(b=>b.clearance>=.74&&b.dry&&!b.mirrored),audit.buildings);
  check('Hakka artwork retains its original noncolliding-landmark contract',audit.buildings.every(b=>b.collide===0));
  check('The complete Sun Moon Lake coffee set stands on the dry left bank',audit.coffee.length===2&&audit.coffee.every(o=>o.x<0&&o.dry),audit.coffee);
  check('Coffee sign/house colliders follow their visible foundations and clear the road',audit.coffee.every(o=>o.colliderMatches&&!o.colliderIntrudes));
  check('All ordinary land shrubs have dry root intervals',audit.wetShrubs.length===0,audit.wetShrubs.slice(0,20));
  check('The Taitung HUD names the coastal approach before the inland valley',audit.labels[0].label==='台東・南迴海岸'&&audit.labels[2].label==='台東・多良海岸'&&audit.labels[3].label==='台東・金崙'&&audit.labels[4].label==='台東・花東縱谷',audit.labels);
  for(const s of [{id:'s5m',s:1080,key:'hakka-1080'},{id:'s5m',s:2110,key:'hakka-2110'},{id:'s5c',s:2640,key:'lake-coffee'},{id:'s2s',s:3710,key:'coast-shrubs'},{id:'s4c',s:230,key:'coastal-label'},{id:'s4c',s:2580,key:'valley-label'}]){await page.evaluate(s=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id===s.id);k.go(k.ROUTE.pieces.indexOf(p),s.s,0);k.PC.v=0;k.step(0);},s);await page.screenshot({path:path.join(out,s.key+'.png')});}
  check('Six targeted real views render without script exceptions or missing assets',!report.errors.length&&!report.missing.length);
  report.pass=report.checks.every(c=>c.pass);assert(report.pass,'Scene regression failed');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failures:report.checks.filter(c=>!c.pass),errors:report.errors,missing:report.missing,out}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
