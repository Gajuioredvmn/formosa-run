// Real browser ending coverage, all ten crews × sixteen destinations.
// Default requires every new rear sprite and both portraits; --allow-unready-art
// is only an intermediate layout diagnostic and is explicitly recorded as such.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./serve.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'formosa-endings-'+Date.now()));
fs.mkdirSync(output,{recursive:true});
const allowUnready=process.argv.includes('--allow-unready-art');
const report={finalArtRequired:!allowUnready,errors:[],missing:[],assertions:[],endings:[],phone:[],limitations:['Canvas scene composition and interaction are tested in desktop Edge, including a narrow viewport. Physical-phone performance is not measured.']};
const check=(name,pass)=>{report.assertions.push({name,pass:!!pass});assert(pass,name);};
(async()=>{const server=createServer(path.dirname(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});});
  await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(root))}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__kr?.G.state==='race'&&window.FORMOSA_PIXEL_CAR?.state.ready,null,{timeout:90000});
  await page.evaluate(async()=>{await FORMOSA_PIXEL_CAR.ready();__kr.halt(true);__kr.show(null);});
  const goals=await page.evaluate(()=>Object.keys(FormosaEndingStories.places));
  async function inspect(id,car){return page.evaluate(async({id,car})=>{
    await FormosaEndingScenes.prepare(FormosaEndingStories.places[id]);
    const k=__kr;k.RACE.elapsed=324.56;k.ending(id,1,car);k.endingFrame(6);
    const arrival={...k.END.layout};const rows=[];
    for(let line=0;line<3;line++){k.END.line=line;k.END.chars=999;k.endingFrame();rows.push({...k.END.layout,line,text:k.ENDINGS[k.CARS[car].id][id][line]});}
    k.END.line=1;k.END.chars=999;k.endingFrame();
    return {id,car:k.CARS[car].id,people:k.END.people.map(p=>({name:p.name,dog:!!p.dog})),actual:k.END.goal,arrival,rows,width:document.querySelector('#gl').width};
  },{id,car});}
  for(const id of goals)for(let car=0;car<10;car++){
    const r=await inspect(id,car);report.endings.push(r);
    check(`${id}/${r.car}: destination, two crew and full readable dialogue`,r.actual===id&&r.people.length===2&&r.rows.every(q=>q.rows>0&&q.textBottom<=270&&q.carGround<q.panelY));
    check(`${id}/${r.car}: its own detailed geographical scene loaded`,r.arrival.scene.art);
    if(!allowUnready)check(`${id}/${r.car}: new rear artwork and both detailed portraits`,r.arrival.newCar&&r.arrival.portraits.every(Boolean));
    // Exercise actual canvas click handler: finish current text, advance to the
    // third beat, finish scene, return to title; no direct endingTap calls.
    await page.locator('#gl').click({position:{x:400,y:300},force:true});
    check(`${id}/${r.car}: canvas click advances the story`,await page.evaluate(()=>__kr.END.line===2&&!__kr.END.done));
    await page.evaluate(()=>{__kr.END.chars=999;__kr.endingFrame();});
    await page.locator('#gl').click({position:{x:400,y:300},force:true});
    check(`${id}/${r.car}: third beat completes without replacing the view`,await page.evaluate(()=>__kr.END.done&&__kr.END.on));
    await page.evaluate(()=>__kr.endingFrame());
    if(car===0)await page.screenshot({path:path.join(output,`destination-${id}.png`)});
    if(id==='s5a')await page.screenshot({path:path.join(output,`crew-${r.car}.png`)});
    await page.locator('#gl').click({position:{x:400,y:300},force:true});
    check(`${id}/${r.car}: completed ending returns to title`,await page.evaluate(()=>!__kr.END.on&&__kr.UI.scr==='title'));
  }
  await page.setViewportSize({width:390,height:844});
  for(const id of goals)for(let car=0;car<10;car++){
    const r=await inspect(id,car);report.phone.push(r);
    check(`narrow ${id}/${r.car}: no text/portrait overflow`,r.rows.every(q=>q.textBottom<=270&&q.textW>200));
    if(car===2&&['s5a','s5m','s5n'].includes(id))await page.screenshot({path:path.join(output,`phone-${id}.png`)});
  }
  check('No browser script errors',report.errors.length===0);check('No missing resources',report.missing.length===0);
  console.log(JSON.stringify({assertions:report.assertions.length,endings:report.endings.length,narrow:report.phone.length,finalArtRequired:report.finalArtRequired,errors:report.errors,missing:report.missing}));
 }catch(error){report.failure=error.stack;console.error(error);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(output,'endings-report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
})();
