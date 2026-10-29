// Real shipped Canvas renderer, one browser/page. No hand-entered tyre polygons:
// masks, source crops and targets always come from render/wheel-art.js.
// Run only after wheel artwork is frozen: node tools/verify-wheel-art.cjs OUTPUT
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-wheel-'+Date.now()));
const report={checks:[],errors:[],missing:[],cars:[],scope:'Actual local Canvas artwork and straight-pose regression; 60 m/s, zero steering, lateral acceleration, yaw and roll.',
 limitations:['Fixed-input renderer test, not a road-physics or Android performance test.','Pixel isolation and temporal stability do not approve tyre perspective; inspect the ten-car contact sheet and patch comparisons.','The lower .65–1.0 source-height band excludes legitimate hair over the deck; complete configured wheel-patch regions are checked separately.']};
fs.mkdirSync(out,{recursive:true});
const check=(name,ok)=>{report.checks.push({name,ok:!!ok});};
(async()=>{
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';let browser;
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
  const page=await browser.newPage({viewport:{width:960,height:540}}),requested=new Set();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('request',r=>requested.add(new URL(r.url()).pathname));
  page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.complete,null,{timeout:90000});
  // Capture requests before our independent source-image comparison loads.
  const startupRequests=[...requested];
  const data=await page.evaluate(async()=>{
   const k=__kr,api=FORMOSA_PIXEL_CAR,{VEHICLE_ART}=await import('./render/vehicle-art-manifest.js'),{WHEEL_ART,drawWheelPatches}=await import('./render/wheel-art.js');
   const priorState={mode:k.G.mode,race:k.RACE.state,ignition:k.IGN.on};
   k.halt(true);k.bot(false);k.G.mode='play';k.G.noIgnite=false;k.race(0,true);k.show(null);k.step(0);
   // Start in the real ignition state, then exercise isolated neutral car
   // inputs. The halted main loop cannot race these explicit render frames.
   const initialization={priorState,halted:k.G.halt,race:k.RACE.state,ignition:k.IGN.on,ignitionTime:k.IGN.t,selectedCar:k.PC.spec.id,layoutCar:k.IGN.layout?.carId};
   const wheelModule=new URL('./render/wheel-art.js',location.href),vehicleModule=new URL('./render/vehicle-art-manifest.js',location.href);
   const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Image failed: '+src));image.src=src;});
   const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
   const opaque=c=>{const g=c.getContext('2d'),p=g.getImageData(0,0,c.width,c.height);for(let i=3;i<p.data.length;i+=4)p.data[i]=p.data[i]<96?0:255;g.putImageData(p,0,0);};
   const polygon=(g,points,w,h)=>{g.beginPath();points.forEach(([u,v],i)=>i?g.lineTo(u*w,v*h):g.moveTo(u*w,v*h));g.closePath();};
   const inPolygon=(u,v,points)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
   const changed=(a,b,i)=>a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3];
   const compare=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(changed(a,b,i))n++;return n;};
   const sourceCanvas=(image,art,w,h)=>{
    const c=canvas(w*2,h*2),g=c.getContext('2d'),[sx,sy,sw,sh]=art.rear.map((v,i)=>v*(i%2?image.height:image.width));
    g.imageSmoothingEnabled=false;g.scale(2,2);g.save();
    if(art.rearMask?.length){g.beginPath();art.rearMask.forEach(([u,v],i)=>{const x=(u*image.width-sx)*w/sw,y=(v*image.height-sy)*w/sw;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.clip();}
    g.drawImage(image,sx,sy,sw,sh,0,0,w,h);g.restore();return c;
   };
   const output={initialization,configured:Object.keys(WHEEL_ART),expectedAssets:Object.entries(WHEEL_ART).map(([id,a])=>({id,path:new URL(a.src,wheelModule).pathname,patches:a.patches?.length||0})),cars:[]};
   const sheet=canvas(1280,1100),sg=sheet.getContext('2d');sg.fillStyle='#222a35';sg.fillRect(0,0,sheet.width,sheet.height);sg.imageSmoothingEnabled=false;
   for(let index=0;index<k.CARS.length;index++){
    k.car(index);const spec=k.CARS[index],art=VEHICLE_ART[spec.id],repair=WHEEL_ART[spec.id],spr=k.PC.spr,w=Math.round(spr.bw),h=api.measure(spec,w).height;
    const image=await load(new URL(art.src,vehicleModule).href),raw=sourceCanvas(image,art,w,h),corrected=sourceCanvas(image,art,w,h),coverage=canvas(w*2,h*2),cg=coverage.getContext('2d');
    cg.scale(2,2);cg.fillStyle='white';
    let repairsValid=true,replacement=null;
    const silhouettePatches=(repair?.patches||[]).filter(p=>p.silhouetteReplacement===true);
    const silhouetteRegistrationValid=silhouettePatches.every(p=>!p.sourcePolygon&&Array.isArray(p.source)&&p.source.length===4&&p.source.every(Number.isFinite)&&p.source[2]>0&&p.source[3]>0&&JSON.stringify(p.target)===JSON.stringify([0,0,1,1]));
    if(repair){
     replacement=await load(new URL(repair.src,wheelModule).href);const g=corrected.getContext('2d');
     drawWheelPatches(g,replacement,w,h,repair);
     for(const patch of repair.patches||[]){
      repairsValid&&=Array.isArray(patch.polygon)&&patch.polygon.length>=3&&patch.polygon.every(p=>p.length===2&&p.every(Number.isFinite));
      polygon(cg,patch.polygon,w,h);cg.fill();
     }
    }
    opaque(raw);opaque(corrected);
    const wheelTransparency=[];
    const original=raw.getContext('2d').getImageData(0,0,w*2,h*2).data,expected=corrected.getContext('2d').getImageData(0,0,w*2,h*2).data,mask=coverage.getContext('2d').getImageData(0,0,w*2,h*2).data;
    const crewBottom=Math.max(0,...(art.crewRegions||[]).map(r=>r[1]+r[3]));
    let insideChanged=0,outsideChanged=0,changedCrewBand=0;
    for(let i=0;i<original.length;i+=4)if(changed(original,expected,i)){
     if(mask[i+3])insideChanged++;else outsideChanged++;
     if(Math.floor(i/4/(w*2))<h*2*crewBottom)changedCrewBand++;
    }
    const compareSheet=canvas(Math.max(960,w*8+64),h*4+48),pg=compareSheet.getContext('2d');pg.fillStyle='#222a35';pg.fillRect(0,0,compareSheet.width,compareSheet.height);pg.imageSmoothingEnabled=false;
    pg.fillStyle='white';pg.font='16px sans-serif';pg.fillText(spec.id+' — original',12,22);pg.fillText('configured tyre patches',compareSheet.width/2+12,22);
    pg.drawImage(raw,16,40,w*4,h*4);pg.drawImage(corrected,compareSheet.width/2+16,40,w*4,h*4);
    const pc={...k.PC,spec,v:60,vx:0,wind:0,steerIn:0,yaw:0,roll:0,pitch:0,slip:0,drift:0,offroad:false,crash:null,airY:0,scrape:0,visual:{time:0,dt:1/60,lateralAccel:0,contacts:[],tyreLimit:12}};
    const cv=canvas(640,448),g=cv.getContext('2d',{willReadFrequently:true});g.scale(2,2);g.imageSmoothingEnabled=false;
    const x=160,ground=200,left=(x-w/2)*2,top=(ground-h)*2;
    let first,firstCrop,lastCrop,lowerChanged=0,patchChanged=0,maxPose=0,maxRigidGeometryError=0,widthChanged=0,startMismatch=0,latest,finitePose=true;
    const snapshots=[],poses=[],lowerSet=new Set(),patchSet=new Set(),startMismatchExamples=[];
    for(let frame=0;frame<=120;frame++){
     pc.visual.time=frame/60;g.clearRect(0,0,320,224);api.draw(g,{pc,spr,x,ground,crew:[],crewInertia:{x:0,y:0},cheer:null});
     latest=api.state.last;
     finitePose&&=['bank','bend','yaw','compression','wheelLift'].every(key=>Number.isFinite(latest[key]));
     maxPose=Math.max(maxPose,...['bank','bend','yaw','compression','wheelLift'].map(key=>Math.abs(latest[key]||0)));
     if(latest.width!==w||latest.zoom!==1)widthChanged++;
     for(const vertices of Object.values(api.state.materialGeometry||{}))for(const vertex of vertices)maxRigidGeometryError=Math.max(maxRigidGeometryError,Math.abs(vertex.p[0]-(vertex.u*w-w/2)),Math.abs(vertex.p[1]-(vertex.v*h-h)));
     const pixels=g.getImageData(0,0,640,448).data,crop=g.getImageData(left,top,w*2,h*2).data;
     if(!first){first=new Uint8ClampedArray(pixels);firstCrop=new Uint8ClampedArray(crop);startMismatch=compare(firstCrop,expected);
      for(let i=0;i<crop.length&&startMismatchExamples.length<12;i+=4)if(changed(crop,expected,i))startMismatchExamples.push({x:(i/4)%(w*2),y:Math.floor(i/4/(w*2)),actual:[...crop.slice(i,i+4)],expected:[...expected.slice(i,i+4)]});
     }
     for(let py=Math.ceil(top+h*2*.65);py<top+h*2;py++)for(let px=left;px<left+w*2;px++){
      const i=(py*640+px)*4;if(changed(first,pixels,i))lowerSet.add(i/4);
     }
     if(repair)for(let i=0;i<crop.length;i+=4)if(mask[i+3]&&changed(firstCrop,crop,i))patchSet.add(i/4);
     if([0,1,60,120].includes(frame)){
      snapshots.push({frame,png:cv.toDataURL()});poses.push({frame,...Object.fromEntries(['bank','bend','yaw','compression','wheelLift','width','zoom'].map(key=>[key,latest[key]]))});
     }
     if(frame===120)lastCrop=new Uint8ClampedArray(crop);
    }
    lowerChanged=lowerSet.size;patchChanged=patchSet.size;
    // Run alternate-size source draws only after capturing the real texture
    // and all 121 frames. This keeps their decoded-image/cache activity out
    // of the strict reference-vs-renderer comparison above.
    // Preserve old opaque coverage for ordinary tyre paint corrections.
    // An explicitly flagged structural silhouette replacement uses an
    // independent registered-source alpha oracle, and accounts for every
    // old opaque pixel intentionally removed instead of ignoring it.
    if(repair)for(const testWidth of [80,96,128,160,192,256,400]){
     const testHeight=api.measure(spec,testWidth).height,pw=testWidth*2,ph=testHeight*2;
     const before=sourceCanvas(image,art,testWidth,testHeight),after=sourceCanvas(image,art,testWidth,testHeight);
     drawWheelPatches(after.getContext('2d'),replacement,testWidth,testHeight,repair);opaque(before);opaque(after);
     const a=before.getContext('2d').getImageData(0,0,pw,ph).data,b=after.getContext('2d').getImageData(0,0,pw,ph).data;
     const contains=(u,v)=>(repair.patches||[]).some(p=>inPolygon(u,v,p.polygon));
     const oracles=new Map();
     if(silhouetteRegistrationValid)for(const p of silhouettePatches){
      // Direct source registration only: do not call drawWheelPatches here.
      // Pixel-centre membership in the target polygon is checked separately.
      const oracle=canvas(pw,ph),og=oracle.getContext('2d');og.imageSmoothingEnabled=false;og.scale(2,2);
      const [sx,sy,sw,sh]=p.source,[dx,dy,dw,dh]=p.target;
      og.drawImage(replacement,sx*replacement.width,sy*replacement.height,sw*replacement.width,sh*replacement.height,dx*testWidth,dy*testHeight,dw*testWidth,dh*testHeight);
      opaque(oracle);oracles.set(p,og.getImageData(0,0,pw,ph).data);
     }
     const patches=repair.patches||[],lastPatch=(u,v)=>{for(let j=patches.length-1;j>=0;j--)if(inPolygon(u,v,patches[j].polygon))return patches[j];return null;};
     let eligibleOpaque=0,transparentHoles=0,interiorHoles=0,expectedSilhouetteRemoval=0,intendedSilhouetteRemoved=0,unremovedSilhouette=0;const examples=[];
     for(let py=0;py<ph;py++)for(let px=0;px<pw;px++){
      const i=(py*pw+px)*4,u=(px+.5)/pw,v=(py+.5)/ph,p=lastPatch(u,v);if(!p)continue;
      const oracle=oracles.get(p),referenceAlpha=oracle?oracle[i+3]:a[i+3];
      if(oracle&&a[i+3]>=96&&referenceAlpha<96){expectedSilhouetteRemoval++;if(b[i+3]<96)intendedSilhouetteRemoved++;else unremovedSilhouette++;}
      if(referenceAlpha<96)continue;
      eligibleOpaque++;if(b[i+3]>=96)continue;
      transparentHoles++;
      const interior=contains(u-1/pw,v)&&contains(u+1/pw,v)&&contains(u,v-1/ph)&&contains(u,v+1/ph);
      if(interior)interiorHoles++;
      if(examples.length<12)examples.push({x:px,y:py,u,v,beforeAlpha:a[i+3],referenceAlpha,afterAlpha:b[i+3],oracle:!!oracle,interior});
     }
     let contacts=null;
     if(silhouettePatches.length){
      const bottomStart=Math.ceil(ph*.9),bottom=[-1,-1];
      for(let py=bottomStart;py<ph;py++)for(let px=0;px<pw;px++)if(b[(py*pw+px)*4+3]>=96&&contains((px+.5)/pw,(py+.5)/ph))bottom[px<pw/2?0:1]=py;
      // The deepest two physical rows identify road-contact patches. Using
      // the entire lower tenth would accidentally include the connecting axle.
      const contactBandTop=Math.max(bottomStart,Math.max(...bottom)-1),occupied=new Uint8Array(pw),groups=[];
      for(let py=contactBandTop;py<ph;py++)for(let px=0;px<pw;px++)if(b[(py*pw+px)*4+3]>=96&&contains((px+.5)/pw,(py+.5)/ph))occupied[px]=1;
      let start=-1;for(let px=0;px<=pw;px++){if(px<pw&&occupied[px]&&start<0)start=px;if((px===pw||!occupied[px])&&start>=0){groups.push({start,end:px,width:px-start});start=-1;}}
      const minContactWidth=Math.max(2,Math.round(pw*.02));
      const twoRearContacts=bottom.every(y=>y>=bottomStart)&&groups.length===2&&groups[0].end<=pw/2&&groups[1].start>=pw/2&&groups.every(g=>g.width>=minContactWidth);
      contacts={bottomStart,contactBandTop,leftBottom:bottom[0],rightBottom:bottom[1],minContactWidth,groups,twoRearContacts};
     }
     wheelTransparency.push({width:testWidth,height:testHeight,reference:oracles.size?'registered-replacement-alpha':'original-opaque',eligibleOpaque,transparentHoles,interiorHoles,expectedSilhouetteRemoval,intendedSilhouetteRemoved,unremovedSilhouette,contacts,examples});
    }
    const tileX=(index%2)*640,tileY=Math.floor(index/2)*220;sg.fillStyle='white';sg.font='16px sans-serif';sg.fillText(spec.name+' — 60 m/s / frame 120',tileX+12,tileY+22);
    const tileScale=Math.min(1.6,175/(h*2+16));sg.drawImage(cv,left-8,top-8,w*2+16,h*2+16,tileX+70,tileY+35,(w*2+16)*tileScale,(h*2+16)*tileScale);
    output.cars.push({id:spec.id,patchCount:repair?.patches?.length||0,assetReady:api.state.assets[spec.id],width:w,height:h,repairsValid,insideChanged,outsideChanged,changedCrewBand,wheelTransparency,silhouettePatchCount:silhouettePatches.length,silhouetteRegistrationValid,
     startMismatch,startMismatchExamples,lowerChanged,patchChanged,maxPose,finitePose,maxRigidGeometryError,widthChanged,allChangedAt120:compare(firstCrop,lastCrop),poses,snapshots,comparison:repair?compareSheet.toDataURL():null});
   }
   output.contactSheet=sheet.toDataURL();return output;
  });
  report.configured=data.configured;report.expectedAssets=data.expectedAssets;report.initialization=data.initialization;
  check('Real ignition initializes before isolated wheel frames, with the main loop halted',data.initialization.halted&&data.initialization.race==='ignition'&&data.initialization.ignition&&data.initialization.ignitionTime===0&&data.initialization.layoutCar===data.initialization.selectedCar);
  check('All six requested wheel repairs are present',JSON.stringify([...data.configured].sort())===JSON.stringify(['adler','arancia','argento','bamboo','blanco','raiden']));
  check('Each configured wheel asset was requested by the actual renderer at startup',data.expectedAssets.every(a=>startupRequests.includes(a.path)));
  check('All ten selected cars were tested',data.cars.length===10&&new Set(data.cars.map(c=>c.id)).size===10);
  fs.writeFileSync(path.join(out,'all-ten-straight.png'),Buffer.from(data.contactSheet.split(',')[1],'base64'));
  for(const car of data.cars){
   for(const shot of car.snapshots)fs.writeFileSync(path.join(out,car.id+'-straight-'+shot.frame+'.png'),Buffer.from(shot.png.split(',')[1],'base64'));
   if(car.comparison)fs.writeFileSync(path.join(out,car.id+'-patch-comparison.png'),Buffer.from(car.comparison.split(',')[1],'base64'));
   delete car.snapshots;delete car.comparison;report.cars.push(car);
   check(car.id+': original and supplemental art load completely',car.assetReady==='ready');
   check(car.id+': actual start texture matches the configured source and wheel repair',car.startMismatch===0);
   check(car.id+': straight inputs retain zero bank, bend, yaw, compression and lift',car.finitePose&&car.maxPose<1e-8);
   check(car.id+': rigid lower geometry stays identical while crew material animates',car.maxRigidGeometryError<1e-8);
   check(car.id+': lower wheel/body pixels stay fixed from frame 0 through 120',car.lowerChanged===0);
   check(car.id+': camera scale and sprite width stay unchanged',car.widthChanged===0);
   if(car.patchCount){
    check(car.id+': opaque tyre coverage is checked at all seven cache widths',car.wheelTransparency.length===7&&car.wheelTransparency.every(s=>s.eligibleOpaque>0));
    check(car.id+': silhouette replacement flags require independent full-source registration',car.silhouetteRegistrationValid);
    for(const sample of car.wheelTransparency){
     check(car.id+': '+sample.width+'px tyre repair preserves required '+sample.reference+' coverage',sample.transparentHoles===0);
     if(car.silhouettePatchCount){
      check(car.id+': '+sample.width+'px all intended old-silhouette removals are accounted for',sample.expectedSilhouetteRemoval===sample.intendedSilhouetteRemoved&&sample.unremovedSilhouette===0);
      check(car.id+': '+sample.width+'px has exactly one left and one right rear contact group in the bottom tenth',sample.contacts?.twoRearContacts===true);
     }
    }
    check(car.id+': configured wheel patches contain real changed pixels',car.repairsValid&&car.insideChanged>0);
    check(car.id+': pixels outside the configured tyre polygons are untouched',car.outsideChanged===0);
    check(car.id+': upper body and seated crew are untouched by tyre repair',car.changedCrewBand===0);
    check(car.id+': complete patched wheel regions remain stable while driving straight',car.patchChanged===0);
   }
  }
  check('No browser runtime errors or missing resources',report.errors.length===0&&report.missing.length===0);
  report.failedChecks=report.checks.filter(c=>!c.ok).map(c=>c.name);
  assert(report.failedChecks.length===0,report.failedChecks.join('\n'));report.ok=true;
 }catch(e){report.ok=false;report.error=String(e.stack||e);process.exitCode=1;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,out},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
