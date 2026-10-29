// Actual shipped renderer, with a fixed physical pose and changing wind.
// This checks rigid accessories at the exact source points reported by QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'crew-layer-report');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],cars:[],scope:'Material isolation in the real renderer; fixed physical pose. Not a phone FPS or artistic-quality certification.'};
const check=(name,ok)=>{report.checks.push({name,ok});assert(ok,name);};
(async()=>{
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:90000});
  const data=await page.evaluate(async()=>{
   const k=__kr,api=FORMOSA_PIXEL_CAR,{VEHICLE_ART}=await import('./render/vehicle-art-manifest.js'),{CREW_MASKS_A}=await import('./render/crew-masks-a.js'),{CREW_MASKS_B}=await import('./render/crew-masks-b.js'),masks={...CREW_MASKS_A,...CREW_MASKS_B};k.halt(true);
   const probes={rosso:[[.66085444,.25263154,'headrest'],[.68875331,.30225560,'rear metal edge']],bamboo:[[.72810591,.27662723,'rollbar'],[.88900204,.35355030,'mirror']],oro:[[.59574463,.33101527,'seatback'],[.87070370,.28094573,'mirror']]};
   const results=[];
   for(let i=0;i<k.CARS.length;i++){
    k.car(i);const spec=k.CARS[i],art=VEHICLE_ART[spec.id],spr=k.PC.spr,w=Math.round(spr.bw),h=api.measure(spec,w).height;
    const pc={...k.PC,spec,v:60,vx:0,wind:0,steerIn:0,yaw:0,roll:0,slip:0,drift:0,offroad:false,crash:null,airY:0,visual:{time:0,dt:1/60,lateralAccel:0,contacts:[],tyreLimit:12}};
    const cv=document.createElement('canvas');cv.width=480;cv.height=300;const g=cv.getContext('2d');
    const reference={},changes={},images=[],bodyChanged=new Set(),hairChanged=new Set();let first,rigidGeometry,rigidGeometryChanged=0;
    for(let frame=0;frame<=120;frame++){
     pc.visual.time=frame/60;g.clearRect(0,0,480,300);api.draw(g,{pc,spr,x:240,ground:260});
     if(frame<1)continue;const pixels=g.getImageData(0,0,480,300).data;
     const geometry=JSON.stringify(Object.values(api.state.materialGeometry||{}).map(vertices=>vertices.map(v=>v.p)));
     if(rigidGeometry===undefined)rigidGeometry=geometry;
     else if(geometry!==rigidGeometry)rigidGeometryChanged++;
     if(!first)first=new Uint8ClampedArray(pixels);
     // Loose ends may correctly occlude the rear deck. Below v=.65 is
     // outside every material's maximum travel, and must remain identical.
     for(let y=Math.ceil(260-h*.35);y<260;y++)for(let x=240-w/2;x<240+w/2;x++){
      const offset=(y*480+Math.floor(x))*4;if(pixels.slice(offset,offset+4).some((n,c)=>n!==first[offset+c]))bodyChanged.add(offset);
     }
     for(let y=Math.floor(260-h);y<260-h*.55;y++)for(let x=Math.floor(240-w/2)-16;x<240+w/2+16;x++){
      const offset=(y*480+x)*4;if(pixels.slice(offset,offset+4).some((n,c)=>n!==first[offset+c]))hairChanged.add(offset);
     }
     for(const [u,v,name] of probes[spec.id]||[]){
      const x=Math.floor(240+(u-.5)*w),y=Math.floor(260-(1-v)*h),offset=(y*480+x)*4,color=Array.from(pixels.slice(offset,offset+4));
      if(!reference[name])reference[name]=color;
      if(color.some((n,c)=>n!==reference[name][c]))changes[name]=(changes[name]||0)+1;
     }
     if([1,30,60,90,120].includes(frame))images.push({frame,png:cv.toDataURL()});
    }
    const attachments=[];
    // Reproduce the missing-nape failure under maximum braking and opposite
    // free-end deflections, with the car pose held fixed to isolate anatomy.
    for(const sign of [-1,1]){
     api.state.cloth.parts.forEach((p,j)=>{const material=art.cloth[j],short=(material.drag??1)<.5||(material.flex??1)<.22;p.x=sign*(short?3.9:13.8);p.y=short?-3.2:-9;p.midX=p.x*.45;p.midY=p.y*.45;});
     g.clearRect(0,0,480,300);api.draw(g,{pc,spr,x:240,ground:260});
     const pixels=g.getImageData(0,0,480,300).data;
     for(const probe of masks[spec.id].attachmentProbes||[]){
      const [u,v]=probe.point,x=Math.floor(240+(u-.5)*w),y=Math.floor(260-(1-v)*h),alpha=pixels[(y*480+x)*4+3];
      attachments.push({label:probe.label,part:probe.part,sign,alpha});
     }
     images.push({frame:sign<0?'brake-left':'brake-right',png:cv.toDataURL()});
    }
    results.push({id:spec.id,materials:api.state.last.materials,attachments,rigidGeometryChanged,rigidChanges:changes,rigidReference:reference,lowerBodyChanged:bodyChanged.size,hairChanged:hairChanged.size,images});
   }return results;
  });
  for(const car of data){
   for(const frame of car.images)fs.writeFileSync(path.join(out,`${car.id}-${frame.frame}.png`),Buffer.from(frame.png.split(',')[1],'base64'));
   delete car.images;report.cars.push(car);
   check(car.id+': cloth layers contain actual source pixels',car.materials.cloth.length>0&&car.materials.cloth.every(n=>n>0));
   check(car.id+': hair or cloth visibly moves',car.hairChanged>8);
   check(car.id+': lower vehicle pixels stay fixed',car.lowerBodyChanged===0);
   check(car.id+': actual body and foreground mesh positions stay fixed',car.rigidGeometryChanged===0);
   // A side mirror is behind the flying hair and may be correctly occluded.
   // Foreground headrests/rollbars must retain both position AND visible pixels.
   check(car.id+': foreground accessory probes stay fixed',Object.keys(car.rigidChanges).every(name=>name==='mirror'));
   check(car.id+': every material keeps its anatomical attachment',car.materials.fixed.every(n=>n>0));
   check(car.id+': braking cannot expose background at the skull or nape',car.attachments.length>0&&car.attachments.every(p=>p.alpha===255));
  }
  check('No runtime exceptions',report.errors.length===0);report.ok=true;
 }catch(e){report.ok=false;report.error=String(e.stack||e);process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,out}));}
})();
