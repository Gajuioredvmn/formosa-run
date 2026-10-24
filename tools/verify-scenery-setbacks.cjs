// Inspect actual seeded scenery, not a simplified placement fixture.
const fs=require('node:fs'),path=require('node:path'),{createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const out=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-setbacks-'+Date.now()));fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]};
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FormosaWorldLife?.state.ready,null,{timeout:90000});
 report.checks=await page.evaluate(()=>{const k=__kr;k.halt(true);k.G.mode='play';k.G.noIgnite=true;k.race(0,true);k.run();k.show(null);k.bot(false);const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
 const tree=/^(pixel_palm|palm|royal|betel|banana|banyan|mango|casuarina|terminalia|pandanus|cypress|hemlock|camphor|sakura|tung|world_alpine_shrub)(#|$)/,fail=[],summary=[];
 for(const p of k.ROUTE.pieces){let count=0,min=Infinity;for(const o of p.sprites){const S=k.SPRL[o.id];if(!tree.test(S.name)||o.lm)continue;count++;const i=Math.round(o.s/k.DS),sg=o.x<0?-1:1,edge=sg<0?p.outerL(i):p.outerR(i),distance=sg*(o.x-edge),palm=/^pixel_palm#/.test(S.name),inward=S.ww*o.sc*o.sx*(palm?S.ax:Math.max(S.ax,1-S.ax)),margin=distance-inward;min=Math.min(min,margin);if(margin<.89||palm&&o.flip!==(sg<0))fail.push({piece:p.id,s:o.s,name:S.name,margin,flip:o.flip});}summary.push({piece:p.id,trees:count,minCrownMargin:min});}
 check('All 31 branches keep roadside tree crowns and roots outside the pavement',summary.length===31&&fail.length===0,{summary,fail:fail.slice(0,12)});
 const palms=['pixel_palm#0','pixel_palm#1'].map(n=>k.SPR[n]);check('Painted palm anchors follow the off-centre trunk root',palms.every(S=>S.ax>.25&&S.ax<.32),palms.map(S=>({name:S.name,anchor:S.ax})));
 const overlaps=[];let hidden=0,shown=0;for(const p of k.ROUTE.pieces){const lots=p.pixelHouseLots||[];for(let i=0;i<lots.length;i++)for(let j=i+1;j<lots.length;j++){const a=lots[i],b=lots[j];if(a.sg===b.sg&&a.s0<b.s1&&a.s1>b.s0&&a.front<b.back&&a.back>b.front)overlaps.push({piece:p.id,a,b});}for(const w of p.walls)if(k.SPRL[w.tex]?.name.startsWith('pixel_house_upper#')){if(w.capStart===false)hidden++;else shown++;}}
 check('Repeated frontage tags produce no overlapping shop volumes',overlaps.length===0,{overlaps:overlaps.slice(0,5)});check('Joined shop rows hide internal end caps while real alleys retain side walls',hidden>shown&&shown>0,{hidden,shown});
 const alpine=k.ROUTE.pieces.find(p=>p.id==='s5d');check('Hehuan high country contains no coast/wave ground or tropical palms',alpine.secs.every(s=>!['cliff','bay','beach','water','shore'].includes(s.L)&&!['cliff','bay','beach','water','shore'].includes(s.R))&&alpine.sprites.every(o=>!/^(pixel_palm|palm|royal|betel|mango|banyan|casuarina)(#|$)/.test(k.SPRL[o.id].name)));
 const temple=k.ROUTE.pieces.find(p=>p.id==='s4f'),court=temple.secs.find(s=>s.R==='plaza'),a=temple.secStartS[temple.secs.indexOf(court)],b=temple.secStartS[temple.secs.indexOf(court)+1],props=temple.sprites.filter(o=>o.s>a&&o.s<b&&o.x>0&&/^(planter|stall|walkers|hedge|camphor)(#|$)/.test(k.SPRL[o.id].name));check('Beigang temple forecourt has stalls, planting and people beyond the walkway',props.length>=12,{props:props.length});
 check('Sidewalk walkers include all seven illustrated identities',new Set(k.ROUTE.pieces.flatMap(p=>p.anim.filter(a=>a.kind==='walker').map(a=>a.variant))).size===7);
 const selections=[];
 for(let variant=0;variant<7;variant++)for(let frame=0;frame<4;frame++){
  const piece=k.ROUTE.pieces.find(p=>p.anim.some(a=>a.kind==='walker'&&a.variant===variant)),an=piece.anim.find(a=>a.kind==='walker'&&a.variant===variant),oldT=k.G.t;
  k.G.t=(frame+.01-an.phase)/5;while(k.G.t<0)k.G.t+=.8;
  const expected=window.FormosaWorldLife.walkerFrame(an,k.G.t);k.go(k.ROUTE.pieces.indexOf(piece),Math.max(0,expected.s-15),0);k.PC.v=0;k.TRAFFIC.list=[];k.HAZ.list=[];k.step(0);
  selections.push({variant,frame,name:k.SPRL[an._sprite?.id]?.name,expected:'ped'+variant+'_'+frame});k.G.t=oldT;
 }
 check('Actual render queues use all seven people and four distinct gait frames',selections.every(s=>s.name===s.expected),selections);
 k.go(k.ROUTE.pieces.indexOf(alpine),2200,0);k.PC.v=0;k.TRAFFIC.list=[];k.HAZ.list=[];k.step(0);
 const groundPixels=k.RV.fb.reduce((n,p)=>n+!!(p>>>24),0);
 check('The real Hehuan renderer removes trees whose roots extend beyond visible hill terrain',k.RV.groundCulled>0&&groundPixels>1000,{culled:k.RV.groundCulled,groundPixels});
 return checks;});
 for(const [id,s,label]of [['s3w',2800,'lukang-trees'],['s3w','lukang','lukang-arcades'],['s4f','parade_beigang','beigang-forecourt'],['s5d',2200,'hehuan-highland'],['s1',320,'harbor-root-anchors']]){await page.evaluate(({id,s})=>{const k=__kr,p=k.ROUTE.pieces.find(p=>p.id===id);if(typeof s==='string'){const j=p.secs.findIndex(sec=>sec.tags?.includes(s));s=p.secStartS[j]+55;}k.go(k.ROUTE.pieces.indexOf(p),s,0);k.PC.v=0;k.TRAFFIC.list=[];k.HAZ.list=[];k.HAZ.nextS=1e9;k.step(0);},{id,s});await page.screenshot({path:path.join(out,label+'.png')});}
 report.pass=report.checks.every(c=>c.pass)&&!report.errors.length;
}catch(e){report.pass=false;report.failure=String(e.stack||e);}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'scenery-setbacks-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.map(c=>({name:c.name,pass:c.pass})),errors:report.errors,failure:report.failure,out},null,2));if(!report.pass)process.exitCode=1;}})();
