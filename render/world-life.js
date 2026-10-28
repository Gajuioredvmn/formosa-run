/* Roadside life and small landmark geometry for the original pseudo-3D renderer.
 * All positions are world metres; this module never changes the car controller.
 * Reference: KRTC Formosa Boulevard station, MOI national-park black-bear survey.
 */
(function(global){
  'use strict';
  const state={ready:false,images:{},loaded:{},warnings:[],sources:[
    'https://www.krtc.com.tw/Information/travel_more?id=1e596b7e1c214f06b5ff6a44cd5abbba',
    'https://chiayi.forest.gov.tw/multimedia/news/0078506'
  ]};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  async function loadAssets(){
    const manifest=global.FORMOSA_WORLD_ART_ASSETS||{};
    await Promise.all(Object.entries(manifest).map(async([role,spec])=>{
      if(!spec?.url)return;
      const image=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=spec.url;});
      if(image){state.images[role]={image,spec};state.loaded[role]={url:spec.url,width:image.naturalWidth,height:image.naturalHeight};}else state.warnings.push(spec.url);
    }));
  }
  function isolatedCell(api,image,r,spec,frame){
    const cv=api.canvas(r[2],r[3]),g=cv.getContext('2d'),cutoff=frame?.alphaCutoff||spec?.alphaCutoff||32;
    if(frame?.mask){g.beginPath();frame.mask.forEach(([x,y],i)=>i?g.lineTo(x-r[0],y-r[1]):g.moveTo(x-r[0],y-r[1]));g.closePath();g.clip();}
    g.drawImage(image,...r,0,0,r[2],r[3]);
    const im=g.getImageData(0,0,r[2],r[3]),d=im.data,w=r[2],h=r[3],labels=new Int32Array(w*h);let label=0,best=0,bestSize=0;
    // Foliage may contain legitimate detached leaf clusters. Its measured
    // crop is already isolated, so retain those opaque clusters, not haze.
    if((frame?.keepComponents||spec?.keepComponents)&&!frame?.componentSeeds){for(let i=3;i<d.length;i+=4)if(d[i]<cutoff)d[i]=0;g.putImageData(im,0,0);return cv;}
    for(let start=0;start<labels.length;start++){if(labels[start]||d[start*4+3]<cutoff)continue;label++;const queue=[start];labels[start]=label;
      for(let head=0;head<queue.length;head++){const at=queue[head],x=at%w,y=Math.floor(at/w);for(const next of [x?at-1:-1,x<w-1?at+1:-1,y?at-w:-1,y<h-1?at+w:-1])if(next>=0&&!labels[next]&&d[next*4+3]>=cutoff){labels[next]=label;queue.push(next);}}
      if(queue.length>bestSize){bestSize=queue.length;best=label;}
    }
    // Measured seeds retain each detached leaf/flower island belonging to this
    // plant, while rejecting the neighbouring tree inside an overlapping crop.
    const retained=frame?.componentSeeds?new Set(frame.componentSeeds.map(([x,y])=>labels[(y-r[1])*w+x-r[0]]).filter(Boolean)):new Set([best]);
    for(let i=0;i<labels.length;i++)if(!retained.has(labels[i]))d[i*4+3]=0;g.putImageData(im,0,0);return cv;
  }
  function registerSprites(api){
    const px=new api.Pix(192,36);px.rect(0,0,192,36,0x122c52);px.rect(2,2,188,2,0x91d9ef);
    px.text('美麗島站',96,5,21,0xfff8e8,{align:'center',maxW:182});api.addSprite('metro-entry-sign',px,.75,{collide:0,shadow:0});
    const lrtSign=new api.Pix(192,36);lrtSign.rect(0,0,192,36,0x155143);lrtSign.rect(2,2,188,2,0xb5e9ca);
    lrtSign.text('高雄輕軌',96,5,21,0xfff8e8,{align:'center',maxW:182});api.addSprite('light-rail-sign',lrtSign,.6,{collide:0,shadow:0});
    const people=[],paradeArtwork={};
    for(const [role,{image,spec}] of Object.entries(state.images)){
      const pedestrian=role.startsWith('pedestrians');
      const tree=role.startsWith('trees'),ground=role==='groundProps';
      if(!pedestrian&&!tree&&!ground&&!['bear','parade'].includes(role)&&!role.startsWith('traffic')&&!role.startsWith('events'))continue;
      const cells=spec.cells||[[0,0,image.naturalWidth,image.naturalHeight]];
      const imported=new Map();
      cells.forEach((r,i)=>{const frame=spec.frames?.[i]||{},pixels=frame.pixelHeight||spec.pixelHeight||64,w=Math.max(1,Math.round(pixels*r[2]/r[3])),height=frame.worldWidth?frame.worldWidth*pixels/w:(frame.worldHeight||spec.worldHeight||(role==='bear'?1.35:1.75)),cv=api.canvas(w,pixels),g=cv.getContext('2d');g.imageSmoothingEnabled=false;
        if(spec.isolate){const cell=isolatedCell(api,image,r,spec,frame);g.drawImage(cell,0,0,w,pixels);}else g.drawImage(image,...r,0,0,w,pixels);
        const p=new api.Pix(w,pixels);p.d.set(g.getImageData(0,0,w,pixels).data);
        const traffic=role.startsWith('traffic'),name=frame.name||'world_'+role+'#'+i,view=frame.view||(role==='trafficFront'?'front':'rear');
        const lights=frame.lightsNormalized?.map(q=>[q[0]*w,q[1]*pixels,q[2]*w,Math.max(1,q[3]*pixels)])||frame.lights||[];
        const collision=frame.collisionDiameter==null?(frame.collide||0):frame.collisionDiameter/(height*w/pixels);
        const opts={collide:collision,shadow:frame.shadow??.25,ax:frame.anchorX,sway:frame.sway||0,meta:traffic?{lights}:tree?{paintedTree:true,paintedVegetation:true}:ground?{paintedGround:true,paintedVegetation:true}:null};
        api.addSprite(name,p,height,opts);
        for(const alias of frame.aliases||[])api.addSprite(alias,p,height,opts);
        if(traffic&&frame.type&&api.trafficSprites){const key=frame.type+':'+view;if(!imported.has(key))imported.set(key,[]);imported.get(key).push(name);}
        if(role==='parade'&&frame.name){state.paradeFrames=(state.paradeFrames||0)+1;paradeArtwork[frame.name]=cv;}
        if(pedestrian){const person=(spec.personOffset||0)+Math.floor(i/4),step=i%4;
          api.addSprite('ped'+person+'_'+step,p,height,{collide:0,shadow:.25,ax:frame.anchorX});people.push({person,step,canvas:cv,worldHeight:height});}});
      for(const [key,names] of imported){const[type,view]=key.split(':'),set=api.trafficSprites[type]||(api.trafficSprites[type]={rear:[],front:[],turn:[]});set[view]=names;set.turn=names.map(()=>null);}
      state[role+'Frames']=cells.length;
    }
    // Replace every existing crowd/walker alias with the same carefully drawn
    // cast. Original world footprints stay fixed, so the pavement layout and
    // collisions do not change when high-detail people replace placeholders.
    if(people.length){
      const identities=[...new Set(people.map(p=>p.person))].sort((a,b)=>a-b);state.pedestrianPeople=identities.length;
      const groups=[];
      for(const family of ['crowd','walkers'])for(let variant=0;variant<(family==='crowd'?4:3);variant++){
        const n=family==='crowd'?8:3,wh=family==='crowd'?1.8:1.75,H=160,W=Math.round((family==='crowd'?196:70)/68*H),cv=api.canvas(W,H),g=cv.getContext('2d');g.imageSmoothingEnabled=false;
        const positions=Array.from({length:n},(_,i)=>({i,x:29+i*(W-58)/Math.max(1,n-1),base:H-2-((i*7+variant*3)%8)})).sort((a,b)=>a.base-b.base),members=[];
        for(const {i,x,base} of positions){const person=identities[(i+variant*2)%identities.length],step=(i+variant)%2?1:3,source=people.find(p=>p.person===person&&p.step===step)||people.find(p=>p.person===person),h=Math.min(base,Math.round(source.worldHeight/wh*H*.98)),w=h*source.canvas.width/source.canvas.height,flip=family==='crowd'&&(i+variant)%3===0;
          const centre=clamp(x,w*.5+2,W-w*.5-2);
          g.save();g.translate(centre,base);if(flip)g.scale(-1,1);g.drawImage(source.canvas,-w*.5,-h,w,h);g.restore();members.push(person);}
        const p=new api.Pix(W,H);p.d.set(g.getImageData(0,0,W,H).data);const name=family+'#'+variant;
        api.addSprite(name,p,wh,{collide:0,shadow:.25,meta:{paintedPeople:true,members}});groups.push(name);
      }
      state.paintedCrowds=groups;
    }
    const marchers=[0,1,2,3].map(i=>paradeArtwork['parade_marcher#'+i]);
    if(marchers.every(Boolean)&&paradeArtwork.parade_palanquin_raw){
      const register=(name,cv,worldH)=>{const p=new api.Pix(cv.width,cv.height);p.d.set(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data);api.addSprite(name,p,worldH,{collide:0,shadow:.25,meta:{paintedProcession:true}});};
      const person=(g,frame,cx,base,h)=>{const image=marchers[frame%4],w=h*image.width/image.height,centre=clamp(cx,w*.5+2,g.canvas.width-w*.5-2);g.drawImage(image,centre-w*.5,base-h,w,h);};
      for(let frame=0;frame<4;frame++){
        const group=api.canvas(192,160),gg=group.getContext('2d');gg.imageSmoothingEnabled=false;
        for(let i=0;i<3;i++)person(gg,frame+i*2,[43,96,149][i],157-(i%2)*4,146-(i%2)*4);
        register('marchers#'+frame,group,2.2*160/192);
        // The shrine's original horizontal poles rest at the bearers' shoulder
        // line. The four walking bearers share one gait; only their legs move.
        const carried=api.canvas(176,256),cg=carried.getContext('2d');cg.imageSmoothingEnabled=false;
        person(cg,frame+2,39,250,136);person(cg,frame,137,250,136);
        const shrine=paradeArtwork.parade_palanquin_raw,sh=shrine.height*176/shrine.width;
        cg.drawImage(shrine,0,146-sh*.65,176,sh);
        person(cg,frame,35,254,143);person(cg,frame+2,141,254,143);
        register('palanquin#'+frame,carried,3.2);if(!frame)register('palanquin',carried,3.2);
      }
      state.processionGaitFrames=4;
    }
    state.ready=true;
  }
  function releaseSources(){
    if(!state.ready||state.sourcesReleased)return 0;
    let bytes=0;for(const {image} of Object.values(state.images)){bytes+=(image.naturalWidth||0)*(image.naturalHeight||0)*4;image.onload=image.onerror=null;image.removeAttribute?.('src');}
    state.images={};state.sourcesReleased=true;state.releasedImageBytes=bytes;return bytes;
  }
  function addBox(mesh,s0,s1,o0,o1,y0,y1,col){
    const P=(s,o,y)=>[s,o,y];
    mesh.faces.push({col,points:[P(s0,o0,y1),P(s1,o0,y1),P(s1,o1,y1),P(s0,o1,y1)]});
    mesh.faces.push({col:shade(col,.72),points:[P(s0,o0,y0),P(s0,o1,y0),P(s0,o1,y1),P(s0,o0,y1)]});
    mesh.faces.push({col:shade(col,.88),points:[P(s0,o0,y0),P(s1,o0,y0),P(s1,o0,y1),P(s0,o0,y1)]});
    mesh.faces.push({col:shade(col,.60),points:[P(s1,o0,y0),P(s1,o1,y0),P(s1,o1,y1),P(s1,o0,y1)]});
  }
  function shade(c,k){return(Math.min(255,(c>>16&255)*k)<<16)|(Math.min(255,(c>>8&255)*k)<<8)|Math.min(255,(c&255)*k);}
  function metroEntrance(D,s){
    // The 14-m high billboard used to extend into the carriageway. This is a
    // 5.8-m canopy with a real 3-D footprint entirely beyond the sidewalk.
    D.gap(s-16,s+16,-1);
    const setback=(D.p.sec(s).tags||[]).includes('lightrail')?12:0;
    const m={kind:'metroEntrance',s,sg:-1,minOff:5.5+setback,maxOff:14.2+setback,faces:[],lines:[]};
    addBox(m,-10,10,5.5,14.2,0,.18,0xc6c8c4);
    addBox(m,-7.5,7.5,8.3,13.8,.18,.92,0x5c6b78);
    for(let j=0;j<10;j++)addBox(m,-3.0,3.0,5.7+j*.27,5.97+j*.27,.18,.18+(j+1)*.074,j%2?0xb5bbc2:0xd1d5d5);
    for(const ds of [-6.8,6.8])for(const off of [6.8,13.0]){
      addBox(m,ds-.17,ds+.17,off-.17,off+.17,.18,3.6,0xf1f2e8);
      D.collide(s+ds,D.lat(s+ds,-1,off+setback),.24,.24,'solid');
    }
    const roof=(ds,u)=>[ds,6.3+7.5*u,3.45+2.2*Math.sin(Math.PI*u)*(.85+.15*Math.cos(ds/8))];
    for(let j=0;j<6;j++)for(let i=0;i<8;i++){
      const ds=-8+i*2,u=j/6;
      m.faces.push({col:[0x84c6de,0xa4dbeb,0x5ea2c0][(i+j)%3],points:[roof(ds,u),roof(ds+2,u),roof(ds+2,u+1/6),roof(ds,u+1/6)]});
    }
    for(let i=0;i<=8;i++)for(let j=0;j<6;j++)m.lines.push({col:0xf3f4e8,width:.095,points:[roof(-8+i*2,j/6),roof(-8+i*2,(j+1)/6)]});
    for(let j=0;j<=6;j++)m.lines.push({col:0xdbeaf0,width:.075,points:[roof(-8,j/6),roof(8,j/6)]});
    for(const face of m.faces)for(const p of face.points)p[1]+=setback;
    for(const line of m.lines)for(const p of line.points)p[1]+=setback;
    (D.p.landmarkMeshes||(D.p.landmarkMeshes=[])).push(m);
    D.spr('metro-entry-sign',s-7.8,D.lat(s-7.8,-1,9.3+setback),{y:2.3,flip:false,collide:false,landmark:true});
    D.spr('planter',s-12,D.lat(s-12,-1,4.1),{collide:false,landmark:true});
    D.spr('planter',s+12,D.lat(s+12,-1,4.1),{collide:false,landmark:true});
    return m;
  }
  function lightRailStop(D,s){
    // A 19-m-wide front-facing billboard reached 3.1 m into the road.
    // Orient the 20-m platform along the route, between pavement and tracks.
    const m={kind:'lightRailStop',s,sg:-1,minOff:3.9,maxOff:7.3,faces:[],lines:[]};
    addBox(m,-10,10,4.0,7.3,0,.32,0xb8b4ac);
    addBox(m,-10,10,7.08,7.3,.32,.34,0xf2c21a);
    addBox(m,-9.5,9.5,3.9,7.2,3.3,3.48,0xf2f4ed);
    // Both sides of every post share their visible footprint with collision.
    for(const ds of [-7,0,7])for(const off of [4.3,6.9]){
      addBox(m,ds-.15,ds+.15,off-.15,off+.15,.32,3.3,0xd8dce0);
      D.collide(s+ds,D.lat(s+ds,-1,off),.15,.15,'solid');
    }
    for(const ds of [-4.2,4.2]){
      addBox(m,ds-1.2,ds+1.2,4.4,4.9,.32,.8,0x536e70);
      D.collide(s+ds,D.lat(s+ds,-1,4.65),.25,1.2,'solid');
    }
    for(const off of [4.0,7.25])m.lines.push({col:0xe8e6d9,width:.06,points:[[-10,off,.35],[10,off,.35]]});
    (D.p.landmarkMeshes||(D.p.landmarkMeshes=[])).push(m);
    D.spr('light-rail-sign',s-8,D.lat(s-8,-1,5.55),{y:2.25,flip:false,collide:false,landmark:true});
    return m;
  }
  function drawMesh(g,m,project,clip,width,height,haze,fog){
    const mapped=[];
    for(const f of m.faces){const points=f.points.map(project);if(points.some(p=>!p)||points.every(p=>p.y>=clip))continue;mapped.push({...f,points,z:points.reduce((n,p)=>n+p.cz,0)/points.length});}
    mapped.sort((a,b)=>b.z-a.z);g.save();g.beginPath();g.rect(0,0,width,Math.min(height,clip));g.clip();
    const colour=c=>{const q=clamp(fog,0,.65);const r=(c>>16&255)*(1-q)+(haze>>16&255)*q,gg=(c>>8&255)*(1-q)+(haze>>8&255)*q,b=(c&255)*(1-q)+(haze&255)*q;return`rgb(${r|0},${gg|0},${b|0})`;};
    for(const f of mapped){g.fillStyle=colour(f.col);g.beginPath();f.points.forEach((p,i)=>i?g.lineTo(Math.round(p.x),Math.round(p.y)):g.moveTo(Math.round(p.x),Math.round(p.y)));g.closePath();g.fill();}
    for(const line of m.lines){const p=line.points.map(project);if(p.some(q=>!q))continue;g.strokeStyle=colour(line.col);g.lineWidth=Math.max(.55,line.width*(p[0].k+p[1].k)*.5);g.beginPath();g.moveTo(p[0].x,p[0].y);g.lineTo(p[1].x,p[1].y);g.stroke();}g.restore();
  }
  function configurePiece(D){
    const p=D.p;
    p.challengeZones=[];p.wildlifeZones=[];
    // Three separated, deliberately readable overtaking passages per branch.
    for(let i=0;i<3;i++){
      const target=p.L*(.23+i*.245);let chosen=target,best=Infinity;
      for(let s=220;s<=p.L-280;s+=20){const sec=p.sec(s);if(sec.track||sec.bridge||sec.fork||sec.diverge||p.hw(s)<3.2||p.challengeZones.some(q=>Math.abs(q.s-s)<260))continue;
        const score=Math.abs(s-target)+(Math.abs(p.curv(s))<.001?30:0);if(score<best){best=score;chosen=s;}}
      if(best<Infinity)p.challengeZones.push({s:chosen,side:i%2?-1:1,done:false,kind:Math.abs(p.curv(chosen))>.002?'bend':'weave'});
    }
    let walker=0;
    p.secs.forEach((sec,j)=>{
      const a=p.secStartS[j],b=j+1<p.secs.length?p.secStartS[j+1]:p.L;
      // Furnish a temple forecourt as a place, without turning the pavement
      // into an obstacle course. The regular landmark/fork exclusions apply.
      if(!sec.bridge&&!sec.track&&(sec.tags||[]).some(t=>t==='templegate'||t.startsWith('parade_'))){
        for(const sg of [-1,1])if((sg<0?sec.L:sec.R)==='plaza')for(let s=a+24,n=0;s<b-18;s+=34,n++){
          D.spr('planter',s,D.lat(s,sg,4.8),{collide:false,flip:sg<0});
          D.spr('stall#'+(n%8),s+7,D.lat(s+7,sg,10.5),{collide:false,flip:false,scale:.9});
          D.spr('walkers',s+10,D.lat(s+10,sg,7.2),{collide:false,flip:sg<0});
          D.spr('hedge',s+15,D.lat(s+15,sg,18),{collide:false,scale:1});
          if(n%2===0)D.spr('camphor',s+19,D.lat(s+19,sg,26),{collide:false,scale:.65});
        }
      }
      for(const sg of [-1,1])if(['city','town','plaza','harbor'].includes(sg<0?sec.L:sec.R)&&!sec.bridge&&!sec.track){
        for(let s=a+44;s<b-30;s+=104){
          if((p.gaps||[]).some(g=>g[2]===sg&&s+5>=g[0]&&s-5<=g[1]))continue;
          const i=Math.round(s/2);if(p.innerFree&&sg===-p.side&&p.innerFree[i]<5)continue;
          p.anim.push({kind:'walker',s0:s-4,s1:s+4,sg,off:sg<0&&sec.parallelRail?2:2.6,phase:walker*.61,speed:.65+(walker%3)*.12,variant:walker%(state.pedestrianPeople||3)});walker++;
        }
      }
      // Forest habitat, not city roads, beaches or bare high-altitude summits.
      if(p.id==='s3m'&&(sec.tags||[]).includes('cypress')&&[sec.L,sec.R].includes('mountain')&&!sec.track){
        const s=a+(b-a)*.56;p.wildlifeZones.push({s,side:sec.L==='mountain'?-1:1,done:false});
      }
    });
  }
  function walkerFrame(an,t){const length=an.s1-an.s0,dist=(t*an.speed+an.phase)% (length*2),forward=dist<length;
    return{s:an.s0+(forward?dist:length*2-dist),dir:forward?1:-1,frame:Math.floor(t*5+an.phase)%(state.pedestriansFrames>=12?4:2)};}
  function wind(o,t){return((Math.sin(t*.9+o.ph)*.024)+(Math.sin(t*1.8+o.ph*.7)*.012))*o.sway;}
  global.FormosaWorldLife={state,loadAssets,registerSprites,releaseSources,metroEntrance,lightRailStop,drawMesh,configurePiece,walkerFrame,wind};
})(window);
