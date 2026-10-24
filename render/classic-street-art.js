/* Pixel scenery for the existing Canvas road renderer. It supplies art and
 * Deco records only: player physics, road stepping and projection stay owned
 * by index.html. Images are registered before its original atlas is packed. */
(function (global) {
  'use strict';
  const state = { images: {}, manifest: {}, registered: false, pending: null, warnings: [], parts: [] };
  const defaults = {
    facades: { url: 'assets/taiwan-shophouses-pixel.png', panels: 4 },
    palm: {url:'assets/pixel/taiwan-palms-v1.png',worldHeight:11,cells:[[23,40,735,962],[815,17,710,988]]},
    skyline: {url:'assets/pixel/kaohsiung-skyline-v1.png',rect:[22,110,1733,703]},
    port: {url:'assets/pixel/kaohsiung-port-v1.png',worldHeight:50,rect:[0,84,1774,720]},
  };
  const regions = {
    upper: [0, 0, 1, 499/887], shop: [.10, 635/887, .80, 231/887],
    column: [.014, .32, .073, .24], base: [.014, .90, .073, .076],
    stone: [0, 866/887, .087, 21/887], cornice: [.12, 480/887, .76, 19/887],
    canopy: [.02, 503/887, .96, 72/887], side: [.10, .08, .80, .45],
    sign: [.085, 584/887, .83, 48/887],
  };
  function loadImage(url) {
    return new Promise(resolve => {
      const image = new Image(); image.onload = () => resolve(image);
      image.onerror = () => { state.warnings.push('Unavailable pixel scenery: ' + url); resolve(null); };
      image.src = url;
    });
  }
  async function loadAssets(extra) {
    if (state.pending) return state.pending;
    state.manifest = Object.assign({}, defaults, global.FORMOSA_CLASSIC_ART_ASSETS || {}, extra || {});
    state.pending = Promise.all(Object.entries(state.manifest).map(async ([name, config]) => {
      if (!config) return;
      const spec = typeof config === 'string' ? { url: config } : config;
      if (!spec.url) return;
      const image = await loadImage(spec.url); if (image) state.images[name] = image;
    })).then(() => state.images);
    return state.pending;
  }
  // Cropping and nearest sampling are part of the native sprite import, not a
  // screen filter. Close scenery retains 48 source pixels/metre for the
  // doubled drawing surface, while world dimensions stay unchanged.
  function imagePix(api, image, rect, worldW, worldH, ppm=48) {
    const width = Math.max(2, Math.round(worldW * ppm)), height = Math.max(2, Math.round(worldH * ppm));
    const c = api.canvas(width, height), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(image, Math.round(rect[0]), Math.round(rect[1]), Math.max(1, Math.round(rect[2])), Math.max(1, Math.round(rect[3])), 0, 0, width, height);
    const pix = new api.Pix(width, height); pix.d.set(g.getImageData(0, 0, width, height).data);
    for(let i=3;i<pix.d.length;i+=4)pix.d[i]=pix.d[i]<96?0:255;
    return pix;
  }
  function registerSprites(api) {
    if (state.registered) return state.parts.length > 0;
    state.registered = true;
    // Native brick elevations for the harbour warehouses. Recessed doors,
    // clerestory glazing and mortar lines continue around the building sides.
    for(const side of [false,true]){
      const p=new api.Pix(side?600:1280,288);p.rect(0,0,p.w,p.h,0x9c5e4d);
      for(let y=0;y<p.h;y+=6)for(let x=-((y/6)%2)*7;x<p.w;x+=14){p.rect(x+1,y+1,12,4,((x+y)%5)?0xb1765e:0xa36b55);p.rect(x+1,y+1,12,1,0xc88d6c);}
      p.rect(0,0,p.w,10,0x524f4c);p.rect(0,10,p.w,4,0xc0b29b);
      for(let x=26;x<p.w-18;x+=side?84:108){p.rect(x,34,62,47,0x51483e);p.rect(x+4,38,54,37,0x759392);p.rect(x+30,38,3,37,0xb3b7a4);p.rect(x+4,56,54,3,0xb3b7a4);p.rect(x-3,79,68,5,0xd1b18a);}
      if(!side)for(const x of [80,530,980]){p.rect(x-4,122,168,166,0x654a3b);p.rect(x,127,160,161,0x3d555a);for(let y=130;y<284;y+=8)p.rect(x,y,160,2,0x6c8585);p.rect(x+4,128,152,3,0x90aaa5);}
      p.rect(0,p.h-12,p.w,12,0x6a665b);p.rect(p.w-14,15,5,p.h-18,0x5b5d54);p.rect(p.w-12,15,2,p.h-18,0xa1a38b);
      if(!side){p.rect(588,92,104,23,0x213b43);p.text('駁二・倉庫',640,94,17,0xf5dbaf,{align:'center',maxW:100});}
      api.addSprite(side?'pixel_warehouse_side':'pixel_warehouse_front',p,5.8,{collide:0,shadow:0});
    }
    const image = state.images.facades;
    if (image) {
      const config = state.manifest.facades || defaults.facades, count = config.panels || 4;
      const cellW = image.naturalWidth / count, cellH = image.naturalHeight;
      const crop = Object.assign({}, regions, config.regions || {});
      const dimensions = { upper: [6, 6.8], shop: [5.3, 3.0], column: [.34, 2.45], base: [.38, .64], stone: [.48, .18], cornice: [6, .24], canopy: [5.8, .42], side: [5.4, 6.8], sign:[5.3,.54] };
      for (let panel = 0; panel < count; panel++) {
        const names = {};
        for (const [part, r] of Object.entries(crop)) {
          const [ww, wh] = dimensions[part], name = 'pixel_house_' + part + '#' + panel;
          const rect = [(panel + r[0]) * cellW, r[1] * cellH, r[2] * cellW, r[3] * cellH];
          let pix=imagePix(api, image, rect, ww, wh);
          // A party wall is plaster and brick, not a stretched shop frontage.
          // These native pixel materials keep side elevations legible in depth.
          if(part==='side'){
            const colors=[0xc4b49a,0xc0b8a7,0xb9ad96,0xc5bba7],base=colors[panel%4];
            pix=new api.Pix(Math.round(ww*48),Math.round(wh*48));pix.rect(0,0,pix.w,pix.h,base);
            for(let y=0;y<pix.h;y+=8)for(let x=0;x<pix.w;x+=12){const hash=(x*13+y*7+panel*17)%23;if(hash<4)pix.rect(x,y,2+hash,1,0xab9e87);}
            for(const f of [.32,.66]){const y=Math.floor(pix.h*f);pix.rect(0,y,pix.w,3,0x938976);pix.rect(0,y+3,pix.w,1,0xd7ccb5);}
            for(const f of [.15,.49]){const y=Math.floor(pix.h*f);pix.rect(pix.w*.68,y,pix.w*.15,pix.h*.12,0x756e61);pix.rect(pix.w*.69,y+3,pix.w*.13,pix.h*.1,0x56656b);}
            pix.rect(0,0,3,pix.h,0x827b6c);pix.rect(pix.w-3,0,3,pix.h,0x9e927d);
          }
          if(part==='sign')pix.text(['水果行','寶島雜貨','在地小吃','寶島冰品'][panel%4],pix.w/2,1,11,0xfff4d0,{align:'center',maxW:pix.w-8});
          api.addSprite(name, pix, wh, { collide: 0, shadow: 0 }); names[part] = name;
        }
        state.parts.push(names);
      }
    }
    for (const [role, name, defaultHeight] of [['palm', 'pixel_palm', 11], ['port', 'pixel_port', 50]]) {
      const image = state.images[role]; if (!image) continue;
      const config = state.manifest[role], height = config.worldHeight || defaultHeight;
      const cells=config.cells||[config.rect||[0,0,image.naturalWidth,image.naturalHeight]];
      cells.forEach((r,index)=>{const width=height*r[2]/r[3],nm=cells.length>1?name+'#'+index:name;
        // The trunks sit left of the broad crowns. Anchor at the bottom alpha
        // footprint, so flipping a tree never moves its root or its collider.
        const ax=role==='palm'?(index===0?198/735:209/710):.5;
        api.addSprite(nm,imagePix(api,image,r,width,height,role==='port'?16:48),height,{ax,collide:role==='palm'?.18:0,shadow:role==='palm'?.24:0,sway:role==='palm'?.7:0});});
    }
    return state.parts.length > 0;
  }
  function canDress(D) { return state.parts.length > 0; }
  function registerUprightPalms(api){
    // Reuse the already isolated royal-palm drawing. The avenue variants keep
    // each coconut's original metre box and collider, while the imported root
    // is centred precisely on the same world point. No whole-tree rotation.
    const originals=new Map(api.originals.map(q=>[q.name,q])),royal=originals.get('royal#0');
    if(!royal?.o.meta?.paintedTree)return false;
    const src=api.canvas(royal.pix.w,royal.pix.h),sg=src.getContext('2d');
    const data=sg.createImageData(royal.pix.w,royal.pix.h);data.data.set(royal.pix.d);sg.putImageData(data,0,0);
    for(let i=0;i<2;i++){
      const old=originals.get('pixel_palm#'+i);if(!old)continue;
      const w=old.pix.w,h=old.pix.h,cv=api.canvas(w,h),g=cv.getContext('2d');g.imageSmoothingEnabled=false;
      const dw=h*royal.pix.w/royal.pix.h,root=w*.5,x=root-dw*(royal.o.ax??.5);
      g.drawImage(src,x,0,dw,h);
      const p=new api.Pix(w,h);p.d.set(g.getImageData(0,0,w,h).data);
      api.addSprite('pixel_palm#'+(i+2),p,old.wh,{...old.o,ax:.5,meta:{...old.o.meta,paintedTree:true,uprightPalm:true,placementAx:old.o.ax}});
    }
    state.uprightPalms=true;return true;
  }
  function houseRow(api, D, s0, s1, sg, off, options) {
    if (!canDress(D) || off > 15) return false;
    const r = D.rnd, opts = options || {};
    let s = s0 + r.range(.2, 2.6), ordinal = 0, exposed=true;
    const lots=D.p.pixelHouseLots||(D.p.pixelHouseLots=[]);
    while (s < s1 - 4) {
      const panel = (Math.floor(r() * state.parts.length) + ordinal) % state.parts.length, art = state.parts[panel];
      const width = r.range(5.4, 6.3), end = Math.min(s1, s + width); if (end - s < 4) break;
      const front = off + r.range(0, .28), recess = r.range(2.05, 2.35), door = front + recess, height = r.range(6.5, 7.0);
      const piece=D.p, reach=front+Math.max(7.1,recess+4.8)+.2;
      let blocked=(piece.gaps||[]).some(g=>g[2]===sg&&end>g[0]&&s<g[1]);
      blocked||=lots.some(q=>q.sg===sg&&end>q.s0&&s<q.s1&&front<q.back&&door+4.8>q.front);
      if(!blocked&&piece.innerFree&&sg===-piece.side) {
        const spacing=piece.L/Math.max(1,piece.innerFree.length-1);
        const a=Math.max(0,Math.floor(s/spacing)),b=Math.min(piece.innerFree.length-1,Math.ceil(end/spacing));
        for(let i=a;i<=b;i++)if(piece.innerFree[i]<reach){blocked=true;break;}
      }
      if(blocked){s=end+.35;ordinal++;exposed=true;continue;}
      lots.push({s0:s,s1:end,sg,front,back:door+4.8});
      // The overhead facade is non-colliding. At ground level only the inner
      // shop wall and the visible outer columns are solid.
      D.wall(s, end, sg, front, 7.1, height, art.upper, { y: 3.2, side: art.side, capStart:exposed, collide: false, layer: 1 });
      D.wall(s, end, sg, door, 4.8, 3.12, art.shop, { side: art.side, capStart:exposed, collide: true, layer: 0 });
      D.wall(s, end, sg, front - .05, .35, .24, art.cornice, { y: 3.06, side: art.stone, collide: false, layer: 3 });
      D.wall(s+.10, end-.10, sg, front+.12, .16, .54, art.sign, { y: 2.54, side: art.stone, collide: false, layer: 2 });
      D.wall(s, end, sg, front - .10, recess + .20, .045, art.stone, { side: art.stone, collide: false, layer: 0 });
      for (const cs of [s + .20, end - .20]) {
        D.wall(cs - .18, cs + .18, sg, front - .04, .36, .64, art.base, { side: art.base, collide: false, layer: 4 });
        D.wall(cs - .16, cs + .16, sg, front, .32, 2.43, art.column, { y: .64, side: art.column, collide: false, layer: 4 });
        D.wall(cs - .23, cs + .23, sg, front - .08, .46, .15, art.stone, { y: 2.94, side: art.stone, collide: false, layer: 5 });
        D.collide(cs, D.lat(cs, sg, front + .14), .22, .22, 'solid');
      }
      if ((ordinal + panel) % 3 !== 1) D.wall(s + .08, end - .08, sg, front - .96, 1.02, .42, art.canopy, { y: 2.71, side: art.canopy, collide: false, layer: 6 });
      if (opts.vsigns && r() < .58) D.spr(api.pickVar('vsign', r), s + .7, D.lat(s + .7, sg, front - .25), { y: 3.35, scale: .8, flip: sg > 0, collide: false });
      if (r() < .32) D.spr('scooters', s + width * .65, D.lat(s, sg, Math.max(1.3, front - 1.5)), { collide: false, scale: .78 });
      const alley=ordinal++%7===5;s=end+(alley?r.range(2.0,3.1):r.range(.12,.45));exposed=alley;
    }
    return true;
  }
  function spriteName(D, name, s) {
    // Hehuan high country has conifers and alpine scrub, never tropical palms.
    if(D.p.id==='s5d'&&s>D.p.L*.36&&trees.test(name))return 'world_alpine_shrub';
    if(D.p.id==='s5d'&&/^(palm|royal|betel|mango|banyan|casuarina)(#|$)/.test(name)){
      const sec=D.p.sec(s);if(sec.L==='highland'&&sec.R==='highland'&&!(sec.tags||[]).includes('hemlock'))return 'world_alpine_shrub';
      return 'hemlock#'+(Math.abs(Math.floor(s/17))%2);
    }
    if (state.images.palm && /^palm(#|$)/.test(name)) {
      const variant=Math.abs(Math.floor(s/11))%2,sec=D.p.sec?.(s),coast=/^(shore|beach|bay|cliff|pebble|mudflat)$/;
      // Formal streets are upright. A few coastal coconuts keep their natural
      // bend; the choice is spatially stable and consumes no procedural RNG.
      const bent=sec&&(coast.test(sec.L)||coast.test(sec.R))&&Math.abs(Math.floor(s/29))%5===0;
      return 'pixel_palm#'+(variant+(state.uprightPalms&&!bent?2:0));
    }
    return name;
  }
  const trees=/^(pixel_palm|palm|royal|betel|banana|banyan|mango|casuarina|terminalia|pandanus|cypress|hemlock|camphor|sakura|tung|world_alpine_shrub)(#|$)/;
  // Mangroves and reeds still need a bank or a tidal flat beneath their roots.
  // The water bands model open/deep water, not an implicit submerged sandbar.
  const landShrubs=/^(bush|bougain|hibiscus|hedge|flowers|tuft|mangrove|reeds)(#|$)/;
  function dryGroundRanges(bands){
    const ranges=[];let last=0;
    for(const b of bands||[]){const end=Math.min(340,b.w);if(b.k!==1&&b.k!==2&&end>last){const prev=ranges[ranges.length-1];if(prev&&Math.abs(prev[1]-last)<.001)prev[1]=end;else ranges.push([last,end]);}last=end;if(last>=340)break;}
    return ranges;
  }
  function placement(D,S,s,x,o,sideBands){
    const shrub=landShrubs.test(S.name);
    if((!trees.test(S.name)&&!shrub)||o.landmark)return{x,o};
    // Salt-pan water and crystallisation beds cannot support tall tree roots.
    // Low native verge plants are separately confined to the dry service dyke.
    const saltSection=D.p.sec?.(s);if(!shrub&&(x<0?saltSection?.L:saltSection?.R)==='salt')return{x,o,reject:true};
    const sg=x<0?-1:1,edge=D.lat(s,sg,0),scale=o.scale||1,width=S.ww*scale*(o.sx||1),height=S.wh*scale;
    const palm=/^pixel_palm#/.test(S.name),flip=palm?sg<0:o.flip;
    const inward=width*(palm?(S.meta?.placementAx??S.ax):Math.max(S.ax,1-S.ax));
    const minOffset=shrub?0:Math.max(1.8,inward+.9,height*.34+.6),oldOffset=sg*(x-edge);
    let offset=Math.max(oldOffset,minOffset);const options=palm?{...o,flip}:o;
    // Crown clearance is not permission to move a trunk into a pond. Query
    // the same physical bands as the raster, including narrow dry pond dykes.
    if(sideBands&&D.p.sec){
      const sec=D.p.sec(s);if(sec.bridge)return{x,o:options,reject:true};
      const type=sg<0?sec.L:sec.R,ranges=dryGroundRanges(sideBands(type));
      const root=shrub?Math.max(.06,Math.min(.25,width*.12)):Math.max(.22,Math.min(1.1,width*(S.collide||.08)*.5));
      let best=null,distance=Infinity;
      for(const [a,b] of ranges){const lo=Math.max(a+root,minOffset),hi=b-root;if(hi<lo)continue;const candidate=Math.max(lo,Math.min(hi,offset)),d=Math.abs(candidate-offset);if(d<distance){distance=d;best=candidate;}}
      // Do not teleport a near roadside tree hundreds of metres across water.
      if(best==null||distance>32)return{x,o:options,reject:true};
      offset=best;
    }
    return{x:edge+sg*offset,o:options};
  }
  function buildingSite(D,S,s,sg,preferred,o,sideBands){
    if(!S)return null;
    const sec=D.p.sec(s);if(sec.bridge)return null;
    const width=S.ww*(o?.scale||1)*(o?.sx||1),anchor=o?.flip?1-(S.ax??.5):(S.ax??.5);
    const inward=width*(sg>0?anchor:1-anchor),outward=width-inward;
    const ranges=dryGroundRanges(sideBands(sg<0?sec.L:sec.R));
    let offset=null,distance=Infinity;
    for(const [a,b] of ranges){
      const lo=a+inward+.75,hi=b-outward-.75;if(hi<lo)continue;
      const candidate=Math.max(lo,Math.min(hi,preferred)),d=Math.abs(candidate-preferred);
      if(d<distance){offset=candidate;distance=d;}
    }
    // A house needs its complete foundation on nearby dry land, not a root
    // point on a narrow bank or a teleport to the other side of a whole lake.
    if(offset==null||distance>40)return null;
    return{x:D.lat(s,sg,offset),offset,inward,outward};
  }
  function port(D, s0, s1) {
    if (D.p.id !== 's1' || !state.images.port) return false;
    for (let s = Math.floor(s0 / 650) * 650 + 310; s < s1; s += 650) if (s >= s0) D.spr('pixel_port', s, D.lat(s, 1, 137), { collide: false, flip: false, landmark: true, y: -1.2 });
    return true;
  }
  function warehouses(D,s0,s1){
    for(let s=s0+36;s<s1-38;s+=44){
      if(s>s0+220&&s<s0+420)continue;
      const end=s+27;if((D.p.gaps||[]).some(g=>g[2]===1&&end>g[0]&&s<g[1]))continue;
      D.wall(s,end,1,13.5,12,5.8,'pixel_warehouse_front',{side:'pixel_warehouse_side',collide:true});
      D.wall(s-.35,end+.35,1,13.1,12.8,.28,null,{y:5.8,col:0x606b70,sideCol:0x46545b,collide:false});
      D.spr('walkers',s+9,D.lat(s+9,1,8.6),{collide:false,flip:false});
      D.spr('planter',s+24,D.lat(s+24,1,9.8),{collide:false});
    }
    return true;
  }
  function backdrop(g,set,camAz,alpha,api){
    if(set.key!=='kaohsiung'||!state.images.skyline)return;
    const image=state.images.skyline,r=state.manifest.skyline.rect,hh=112,ww=Math.round(hh*r[2]/r[3]);
    const angle=Math.atan2(Math.sin(.11-camAz),Math.cos(.11-camAz));if(Math.abs(angle)>1.45)return;
    const cx=api.centre+api.focal*Math.tan(angle),bottom=api.horizon+6;
    g.globalAlpha=alpha==null?1:alpha;g.drawImage(image,...r,Math.round(cx-ww*.5),Math.round(bottom-hh),ww,hh);g.globalAlpha=1;
  }
  function prepareShadows(piece, sprites, sampleSpacing) {
    const rows = new Map();
    const spacing=sampleSpacing||2;
    // The illustrated sun comes from the upper left. Only actual objects on
    // that side can throw a shadow across this road; water and empty lots do
    // not acquire a decorative dark strip. All lengths below are in metres.
    function span(i,left,right){
      if(i<0||i>piece.L*2)return;
      const at=Math.max(0,Math.min(Math.round(i*.5/spacing),Math.round(piece.L/spacing)));
      const lo=piece.outerL(at),hi=piece.outerR(at);
      left=Math.max(lo,left);right=Math.min(hi,right);
      if(right-left<.035)return;
      const list=rows.get(i)||[];list.push([left,right]);rows.set(i,list);
    }
    function stamp(s, x, radiusS, radiusX) {
      const first = Math.floor((s-radiusS)*2), last = Math.ceil((s+radiusS)*2);
      for (let i=first;i<=last;i++) {
        const d=(i*.5-s)/radiusS;if(Math.abs(d)>1)continue;
        const half=radiusX*Math.sqrt(1-d*d);
        span(i,x-half,x+half);
      }
    }
    function branch(s0,x0,s1,x1,width) {
      for(let j=0;j<=20;j++) {
        const t=j/20,w=width*(.35+.65*Math.sin(Math.PI*t));
        stamp(s0+(s1-s0)*t,x0+(x1-x0)*t,.20+w,w);
      }
    }
    for(const object of piece.sprites) {
      const sprite=sprites[object.id];
      if(!sprite||!trees.test(sprite.name)||object.x>=0)continue;
      const height=sprite.wh*(object.sc||1),width=sprite.ww*(object.sc||1)*(object.sx||1);
      if(height<2.2)continue;
      const edge=piece.outerL(Math.round(object.s/spacing)),offset=edge-object.x;
      if(offset<.5||offset>height*1.1+width*.5)continue;
      const cx=object.x+height*1.1,cs=object.s+height*.28;
      branch(object.s,object.x,cs,cx,.13);
      if(!/^(pixel_palm|palm|royal|betel|banana)(#|$)/.test(sprite.name)){
        // Broken leaf masses leave sunlight between them. Conifers have a
        // narrower taper; a broadleaf crown covers the width actually drawn.
        const conifer=/^(cypress|hemlock|casuarina)(#|$)/.test(sprite.name);
        const radius=Math.max(.65,Math.min(width*.34,height*(conifer?.22:.38)));
        for(let l=0;l<7;l++){
          const a=l*Math.PI*2/7,rr=radius*(l%2?.62:.42);
          stamp(cs+Math.sin(a)*radius*.7,cx+Math.cos(a)*radius*.75,rr*.8,rr);
        }
        continue;
      }
      // Crisp palm-frond silhouettes, fixed in road coordinates. Their gaps
      // preserve the bright pavement instead of applying one broad dark band.
      for(let i=0;i<9;i++) {
        const a=i*Math.PI*2/9, len=height*(.28+(i%3)*.025);
        const ss=cs+Math.sin(a)*len*.77,xx=cx+Math.cos(a)*len;
        branch(cs,cx,ss,xx,.23);
        for(let j=1;j<5;j++) {
          const t=j/5,bs=cs+(ss-cs)*t,bx=cx+(xx-cx)*t,spread=.42*(1-t)+.12;
          branch(bs,bx,bs+Math.cos(a)*spread,bx-Math.sin(a)*spread,.11);
          branch(bs,bx,bs-Math.cos(a)*spread,bx+Math.sin(a)*spread,.11);
        }
      }
    }
    // Upper floors cast from their roof line, including the arcade recess.
    // Ignore columns, awnings and low retaining walls to avoid double shade.
    for(const wall of piece.walls||[]){
      if(wall.sg!==-1||wall.h<4.5||wall.off>18)continue;
      const sprite=sprites[wall.tex];
      if(sprite?.meta?.paintedCliff)continue;
      const h=wall.h+(wall.y||0),reach=h*1.1,along=h*.28;
      for(let i=Math.floor(wall.s0*2);i<=Math.ceil((wall.s1+along)*2);i++){
        const s=i*.5,edge=piece.outerL(Math.round(Math.max(0,Math.min(piece.L,s))/spacing)),base=edge-wall.off;
        const t0=Math.max(0,(s-wall.s1)/along),t1=Math.min(1,(s-wall.s0)/along);
        if(t1>t0)span(i,base+reach*t0,base+reach*t1);
      }
    }
    // Merge overlaps before rendering so several leaves never multiply the
    // shade to black. Half-metre samples also stay stable while the car moves.
    for(const [key,spans] of rows) {
      spans.sort((a,b)=>a[0]-b[0]);const merged=[];
      for(const span of spans) {const last=merged[merged.length-1];if(last&&span[0]<=last[1]+.05)last[1]=Math.max(last[1],span[1]);else merged.push(span.slice());}
      rows.set(key,merged);
    }
    piece.pixelShadeRows=rows;
  }
  global.FormosaClassicStreetArt = { loadAssets, registerSprites, registerUprightPalms, houseRow, spriteName, placement, buildingSite, dryGroundRanges, port, warehouses, backdrop, prepareShadows, state };
})(window);
