// Checks the actual sprite adapter and selector in Edge/Chromium, without
// replacing the classic engine's dimensions, physics, or collision outcomes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-vehicle-art-'+Date.now()));
const partial=process.argv.includes('--allow-partial'),report={assertions:[],cars:[],errors:[],missing:[],limitations:['Browser rendering check; it cannot substitute for visual art review or real phone performance measurements.']};
fs.mkdirSync(output,{recursive:true});
const check=(name,value)=>{assert(value,name);report.assertions.push(name);};
(async()=>{
  const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});});
    await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.ready,null,{timeout:90000});
    await page.evaluate(()=>{__kr.halt(true);__kr.show('title');});
    const assetState=await page.evaluate(()=>({...FORMOSA_PIXEL_CAR.state.assets}));report.assets=assetState;
    check('All listed vehicle atlases loaded successfully',Object.values(assetState).every(s=>s==='ready'));
    if(!partial)check('All ten original car identities have an individual atlas',Object.keys(assetState).length===10);
    const fineDetail=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=260;const g=c.getContext('2d');g.scale(2,2);FORMOSA_PIXEL_CAR.drawShowcase(g,{spec:__kr.CARS[0],x:100,ground:115,width:160});const d=g.getImageData(0,0,400,260).data;let fine=0;for(let y=0;y<260;y++)for(let x=0;x<398;x+=2){const i=(y*400+x)*4;if(d[i+3]&&d[i+7]&&Math.abs(d[i]-d[i+4])+Math.abs(d[i+1]-d[i+5])+Math.abs(d[i+2]-d[i+6])>12)fine++;}return fine;});
    check('A doubled output contains genuinely finer car detail instead of repeating coarse pixels',fineDetail>200);
    for(let i=0;i<10;i++){
      const data=await page.evaluate(i=>{
        const k=__kr,m=FORMOSA_PIXEL_CAR;k.G.mode='play';k.G.noIgnite=true;k.race(i,true);k.run();k.show(null);k.bot(false);k.PC.v=40;k.PC.gear=3;k.step(0);
        const spec=k.PC.spec,spr=k.PC.spr;if(!m.has(spec))return{id:spec.id,missing:true};
        const normal={...m.state.last},cv=document.createElement('canvas');cv.width=320;cv.height=240;const g=cv.getContext('2d');
        const physics=()=>JSON.stringify([k.PC.s,k.PC.x,k.PC.v,k.PC.vx,k.PC.yaw,k.PC.roll,spec.W,spec.L,spec.acc,spec.grip,spec.steer]);const before=physics();
        const o={pc:k.PC,spr,x:160,ground:200};m.draw(g,o);const pure=before===physics();
        m.draw(g,{...o,pc:{...k.PC,crash:{t:.4},roll:.2}});const crash={...m.state.last};
        m.draw(g,{...o,spinning:true,spinAngle:1.2});const spin={...m.state.last};
        const local=JSON.stringify(m.state.last),pose=m.state.pose;m.drawProjectedRear(g,{spec,spr,x:160,ground:200,scale:.625,clip:180,braking:true,roll:.2});const stateless=JSON.stringify(m.state.last)===local&&m.state.pose===pose;
        g.clearRect(0,0,320,240);m.drawProjectedRear(g,{spec,spr,x:160,ground:200,scale:.625,clip:180,roll:.2});
        const below=g.getImageData(0,180,320,60).data;let leaked=0;for(let a=3;a<below.length;a+=4)if(below[a])leaked++;
        const portraits=[0,1].map(index=>{g.clearRect(0,0,320,240);const ok=m.drawPortrait(g,{spec,index,x:0,y:0,width:96,height:104}),p=g.getImageData(0,0,320,240).data;let ink=0,outside=0;for(let y=0;y<240;y++)for(let x=0;x<320;x++)if(p[(y*320+x)*4+3]){ink++;if(x>=96||y>=104)outside++;}return{ok,ink,outside};});
        return{id:spec.id,normal,crash,spin,pure,stateless,leaked,portraits,originalWidth:Math.round(spr.bw),crew:k.CREW[spec.id].map(p=>p.name)};
      },i);
      report.cars.push(data);if(data.missing&&partial)continue;
      check(data.id+': selected car uses its own new rear artwork',!data.missing&&data.normal.id===data.id&&(partial||data.normal.source.includes('vehicle-'+data.id)));
      check(data.id+': exact classic width and zoom are preserved',data.normal.width===data.originalWidth&&data.normal.zoom===1);
      check(data.id+': drawing does not alter physics or car specs',data.pure);
      check(data.id+': crash and spin keep the same artwork and width',data.crash.crash&&data.spin.spinning&&data.crash.source===data.normal.source&&data.spin.source===data.normal.source&&data.crash.width===data.normal.width&&data.spin.width===data.normal.width);
      check(data.id+': remote rendering does not advance the local pose',data.stateless);
      check(data.id+': hills clip remote cars without leaking pixels',data.leaked===0);
      if(!partial)check(data.id+': both independent cast portraits render inside their boxes',data.portraits.every(p=>p.ok&&p.ink>100&&p.outside===0));
      await page.evaluate(i=>{__kr.UI.sel=i;__kr.show('select');},i);
      await page.locator('#c-name').waitFor({state:'visible'});
      const selected=await page.evaluate(()=>({name:document.querySelector('#c-name').textContent,portraits:[...document.querySelectorAll('#c-portraits .crew-card')].map(n=>n.dataset.crew),thumbs:[...document.querySelectorAll('#thumbs canvas')].filter(n=>n.dataset.done?.startsWith('pixel:')).length}));
      if(!partial)check(data.id+': selector displays the matching driver and passenger',selected.portraits.join('|')===data.crew.join('|')&&selected.thumbs===10);
      await page.screenshot({path:path.join(output,'select-'+data.id+'.png')});
    }
    report.mobile=[];
    for(const size of[{width:844,height:390},{width:390,height:844}]){
      await page.setViewportSize(size);await page.evaluate(()=>{__kr.UI.sel=9;__kr.show('select');});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const layout=await page.evaluate(()=>{const info=document.querySelector('.sel .info'),strip=document.querySelector('#thumbs'),selected=strip.querySelector('[aria-current="true"]'),sr=strip.getBoundingClientRect(),br=selected.getBoundingClientRect(),pick=document.querySelector('[data-act="pick"]').getBoundingClientRect();return{infoOverflow:info.scrollWidth-info.clientWidth,selectedVisible:br.left>=sr.left-2&&br.right<=sr.right+2,pickVisible:pick.top>=0&&pick.bottom<=innerHeight,portraits:[...document.querySelectorAll('#c-portraits .crew-card')].every(el=>el.scrollWidth<=el.clientWidth)};});
      report.mobile.push({size,...layout});check(`${size.width}x${size.height}: car portraits, selected thumbnail and pick control fit`,layout.infoOverflow<=1&&layout.portraits&&layout.selectedVisible&&layout.pickVisible);
      await page.screenshot({path:path.join(output,`select-mobile-${size.width}.png`)});
    }
    check('No uncaught browser exceptions',report.errors.length===0);check('No missing vehicle assets',report.missing.length===0);
    report.pass=true;await context.close();
  }catch(e){report.pass=false;report.failure=String(e.stack||e);process.exitCode=1;}
  finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,assertions:report.assertions.length,cars:report.cars.length,failure:report.failure,output},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
