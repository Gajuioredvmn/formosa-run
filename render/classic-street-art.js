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
  // screen filter. All new close scenery uses the original 24 pixels/metre.
  function imagePix(api, image, rect, worldW, worldH, ppm=24) {
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
          const pix=imagePix(api, image, rect, ww, wh);
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
        api.addSprite(nm,imagePix(api,image,r,width,height,role==='port'?8:24),height,{collide:role==='palm'?.18:0,shadow:role==='palm'?.24:0});});
    }
    return state.parts.length > 0;
  }
  function canDress(D) { return state.parts.length > 0; }
  function houseRow(api, D, s0, s1, sg, off, options) {
    if (!canDress(D) || off > 15) return false;
    const r = D.rnd, opts = options || {};
    let s = s0 + r.range(.2, 2.6), ordinal = 0;
    while (s < s1 - 4) {
      const panel = (Math.floor(r() * state.parts.length) + ordinal) % state.parts.length, art = state.parts[panel];
      const width = r.range(5.4, 6.3), end = Math.min(s1, s + width); if (end - s < 4) break;
      const front = off + r.range(0, .28), recess = r.range(2.05, 2.35), door = front + recess, height = r.range(6.5, 7.0);
      const piece=D.p, reach=front+Math.max(7.1,recess+4.8)+.2;
      let blocked=(piece.gaps||[]).some(g=>g[2]===sg&&end>g[0]&&s<g[1]);
      if(!blocked&&piece.innerFree&&sg===-piece.side) {
        const spacing=piece.L/Math.max(1,piece.innerFree.length-1);
        const a=Math.max(0,Math.floor(s/spacing)),b=Math.min(piece.innerFree.length-1,Math.ceil(end/spacing));
        for(let i=a;i<=b;i++)if(piece.innerFree[i]<reach){blocked=true;break;}
      }
      if(blocked){s=end+.35;ordinal++;continue;}
      // The overhead facade is non-colliding. At ground level only the inner
      // shop wall and the visible outer columns are solid.
      D.wall(s, end, sg, front, 7.1, height, art.upper, { y: 3.2, side: art.side, collide: false, layer: 1 });
      D.wall(s, end, sg, door, 4.8, 3.12, art.shop, { side: art.shop, collide: true, layer: 0 });
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
      s = end + ((ordinal++ % 7 === 5) ? r.range(2.0, 3.1) : r.range(.12, .45));
    }
    return true;
  }
  function spriteName(D, name, s) {
    if (state.images.palm && /^(palm|royal)(#|$)/.test(name)) return 'pixel_palm#'+(Math.abs(Math.floor(s/11))%2);
    return name;
  }
  function port(D, s0, s1) {
    if (D.p.id !== 's1' || !state.images.port) return false;
    for (let s = Math.floor(s0 / 650) * 650 + 310; s < s1; s += 650) if (s >= s0) D.spr('pixel_port', s, D.lat(s, 1, 137), { collide: false, flip: false, landmark: true, y: -1.2 });
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
    if (piece.id !== 's1') return;
    const rows = new Map();
    function stamp(s, x, radiusS, radiusX) {
      const first = Math.floor((s-radiusS)*2), last = Math.ceil((s+radiusS)*2);
      for (let i=first;i<=last;i++) {
        const d=(i*.5-s)/radiusS;if(Math.abs(d)>1)continue;
        const half=radiusX*Math.sqrt(1-d*d), spans=rows.get(i)||[];
        spans.push([x-half,x+half]);rows.set(i,spans);
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
      if(!sprite||!/^pixel_palm#/.test(sprite.name)||object.x>=0)continue;
      const edge=piece.outerL(Math.round(object.s/(sampleSpacing||2))), offset=edge-object.x;
      if(offset<.5||offset>5)continue;
      const height=sprite.wh*object.sc,cx=object.x+height*1.1,cs=object.s+2.8;
      branch(object.s,object.x,cs,cx,.13);
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
    // Merge overlaps before rendering so several leaves never multiply the
    // shade to black. Half-metre samples also stay stable while the car moves.
    for(const [key,spans] of rows) {
      spans.sort((a,b)=>a[0]-b[0]);const merged=[];
      for(const span of spans) {const last=merged[merged.length-1];if(last&&span[0]<=last[1]+.05)last[1]=Math.max(last[1],span[1]);else merged.push(span.slice());}
      rows.set(key,merged);
    }
    piece.pixelShadeRows=rows;
  }
  global.FormosaClassicStreetArt = { loadAssets, registerSprites, houseRow, spriteName, port, backdrop, prepareShadows, state };
})(window);
