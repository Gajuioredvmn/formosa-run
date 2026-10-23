/*
 * Formosa Run scenery. The original Piece centreline is the authority: one unit
 * is one metre, Y is up, heading zero travels down -Z, and positive lateral X
 * is the driver's right. No separate track or gameplay approximation is used.
 */
const CHUNK = 240;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SEA = new Set(['harbor', 'beach', 'bay', 'shore', 'cliff', 'pebble', 'mudflat']);
const WATER = new Set([...SEA, 'water', 'lake', 'river', 'fishpond', 'milkfish']);
const URBAN = new Set(['city', 'town', 'plaza']);
const HILL = new Set(['hills', 'mountain', 'slope', 'highland', 'tea', 'daylily', 'cabbage']);
const CROPS = new Set(['paddy', 'farm', 'tea', 'cabbage', 'pineapple', 'daylily', 'cane', 'salt']);
// These are fictional shop labels, local to each stage, not real businesses.
// A shared harbour/tea biome must never carry another county's place names.
const REGIONAL_SHOPS = {
  s1: ['高雄港', '港都海產', '鹽埕小吃', '寶島旅宿', '便利商店'],
  s2n: ['台南小吃', '府城茶行', '牛肉湯', '府城旅宿', '便利商店'],
  s2s: ['旗津海產', '海景咖啡', '旗津冰品', '海風旅宿', '便利商店'],
  s3w: ['鹿港茶行', '海線小吃', '海味料理', '老街旅宿', '便利商店'],
  s3m: ['嘉義雞肉飯', '阿里山茶', '山城咖啡', '山居旅宿', '便利商店'],
  s3sm: ['屏東鮮果', '沿山小吃', '山城咖啡', '山居旅宿', '便利商店'],
  s3se: ['東港海產', '屏東鮮果', '海線小吃', '港邊旅宿', '便利商店'],
  s4a: ['台中茶行', '大甲小吃', '在地鮮果', '寶島旅宿', '便利商店'],
  s4b: ['集集茶行', '南投鮮果', '山城咖啡', '山居旅宿', '便利商店'],
  s4c: ['台東鮮果', '縱谷小吃', '在地茶行', '縱谷旅宿', '便利商店'],
  s4d: ['牡丹小吃', '旭海鮮果', '山城咖啡', '海風旅宿', '便利商店'],
  s4e: ['恆春小吃', '墾丁冰品', '海景咖啡', '南國旅宿', '便利商店'],
  s4f: ['北港小吃', '北港茶行', '老街糕餅', '在地旅宿', '便利商店'],
  s4g: ['三義茶行', '客庄小吃', '客庄咖啡', '山城旅宿', '便利商店'],
  s4h: ['枋山芒果', '海景咖啡', '枋山鮮果', '海風旅宿', '便利商店'],
  s5a: ['台北茶行', '淡水魚丸', '河岸咖啡', '台北旅宿', '便利商店'],
  s5b: ['北海岸海產', '金山小吃', '海景咖啡', '海風旅宿', '便利商店'],
  s5c: ['湖畔咖啡', '日月潭紅茶', '湖邊小吃', '湖畔旅宿', '便利商店'],
  s5d: ['高山鮮蔬', '山城咖啡', '高山茶行', '山居旅宿', '便利商店'],
  s5e: ['花蓮小吃', '峽谷咖啡', '在地茶行', '山居旅宿', '便利商店'],
  s5f: ['宜蘭小吃', '南方澳海產', '海景咖啡', '蘭陽旅宿', '便利商店'],
  s5g: ['滿州茶行', '海景咖啡', '在地小吃', '海風旅宿', '便利商店'],
  s5h: ['墾丁冰品', '海景咖啡', '南國小吃', '海風旅宿', '便利商店'],
  s5i: ['白沙冰品', '恆春小吃', '海景咖啡', '海風旅宿', '便利商店'],
  s5j: ['南灣冰品', '海景咖啡', '墾丁小吃', '南灣旅宿', '便利商店'],
  s5k: ['高美小吃', '海景咖啡', '台中茶行', '海風旅宿', '便利商店'],
  s5l: ['南寮海產', '新竹米粉', '海景咖啡', '竹塹旅宿', '便利商店'],
  s5m: ['客庄小吃', '南庄茶行', '桂花茶飲', '客庄旅宿', '便利商店'],
  s5n: ['九份茶館', '山城小吃', '老街茶飲', '山城旅宿', '便利商店'],
  s5o: ['成功海產', '台東鮮果', '海景咖啡', '東海岸旅宿', '便利商店'],
  s5p: ['石梯港海產', '花蓮小吃', '海景咖啡', '東海岸旅宿', '便利商店'],
};
const BASE = {
  city: 0xa8a59b, town: 0xb9ad94, plaza: 0xd5cbb7, industrial: 0xb0aba1,
  grass: 0x688843, orchard: 0x647c38, farm: 0x9aa963, paddy: 0x8aab4c,
  hills: 0x55723d, mountain: 0x42613b, slope: 0x476b36, highland: 0x8f9557,
  tea: 0x4e793a, cabbage: 0x91aa67, daylily: 0xa19a42, pineapple: 0x8e9956,
  cane: 0x7f9c43, salt: 0xe4dddb, riverbed: 0xb2aca0, gorge: 0x9d9d96,
  cut: 0x96958d, fishpond: 0x79896b, milkfish: 0x79896b,
};
function random(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function noise(x, z) { return Math.sin(x * .073 + Math.sin(z * .041) * 2) * .5 + Math.sin(z * .097 + x * .027) * .3 + Math.sin(x * .23 + z * .137) * .2; }

class Instances {
  constructor(world, group) { this.w = world; this.group = group; this.items = new Map(); }
  add(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0, color = null, q = null) {
    const T = this.w.T, key = geo.uuid + mat.uuid;
    let b = this.items.get(key); if (!b) { b = { geo, mat, matrices: [], colors: [] }; this.items.set(key, b); }
    const rot = q || new T.Quaternion().setFromAxisAngle(this.w.up, yaw);
    b.matrices.push(new T.Matrix4().compose(new T.Vector3(x, y, z), rot, new T.Vector3(sx, sy, sz)));
    b.colors.push(color);
  }
  finish() {
    const T = this.w.T;
    for (const b of this.items.values()) {
      const m = new T.InstancedMesh(b.geo, b.mat, b.matrices.length);
      let colored = false;
      for (let i = 0; i < b.matrices.length; i++) { m.setMatrixAt(i, b.matrices[i]); if (b.colors[i] != null) colored = true; }
      if (colored) for (let i = 0; i < b.matrices.length; i++) m.setColorAt(i, new T.Color(b.colors[i] == null ? 0xffffff : b.colors[i]));
      m.castShadow = b.mat.userData.casts !== false; m.receiveShadow = true;
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere(); this.group.add(m);
    }
    this.items.clear();
  }
}

export class FormosaWorld {
  constructor(THREE, scene, assets = {}, quality = 'high') {
    this.T = THREE; this.scene = scene; this.assets = assets;
    this.mobile = quality === 'low' || quality === 'mobile';
    this.distance = this.mobile ? 920 : 1450;
    this.group = new THREE.Group(); this.group.name = 'Formosa island'; scene.add(this.group);
    this.up = new THREE.Vector3(0, 1, 0); this.chunks = new Map(); this.pieceIds = new WeakMap(); this.uid = 0;
    this.sharedGeometry = new Set(); this.sharedMaterials = new Set(); this.textures = new Set(); this.time = 0;
    this.stats = { chunks: 0, triangles: 0 }; this._makeResources();
    this.colliderChunks = new Map(); this.buildColliders = null;
  }

  _texture(canvas, repeat = false) {
    const T = this.T, t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = this.mobile ? 2 : 8; this.textures.add(t); return t;
  }
  _canvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c;
  }
  _asset(name, fallback, repeat = false) {
    const T = this.T, source = this.assets[name]; let t;
    if (source && source.isTexture) t = source;
    else if (typeof source === 'string') t = new T.TextureLoader().load(source, loaded => {
      if (name === 'facadesPainted' && this.paintedFacades) for (const material of this.paintedFacades) { material.map.image = loaded.image; material.map.needsUpdate = true; }
    });
    else t = fallback();
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = this.mobile ? 2 : 8;
    this.textures.add(t); return t;
  }
  _mat(props) {
    const m = new this.T.MeshStandardMaterial(props); this.sharedMaterials.add(m); return m;
  }
  // Approved lighting B: paintings keep an emissive detail floor while the
  // roadside planes receive actual directional light and cast alpha shadows.
  _illustratedMaterial(map, { foliage = false, alphaTest = 0, side = this.T.FrontSide } = {}) {
    const T = this.T, material = new T.MeshLambertMaterial({ map, color: new T.Color(0xffffff).multiplyScalar(.62),
      emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .24, alphaTest, side, toneMapped: true });
    if (foliage) {
      material.onBeforeCompile = shader => { shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>',
        '#include <defaultnormal_vertex>\ntransformedNormal = normalize(transformedNormal * 0.46 + mat3(viewMatrix) * vec3(0.0, 0.68, 0.0));'); };
      material.customProgramCacheKey = () => 'formosa-approved-foliage-light-b';
    }
    this.sharedMaterials.add(material); return material;
  }
  _geometry(g) { this.sharedGeometry.add(g); return g; }

  _makeResources() {
    const T = this.T, r = random(7283);
    this.geo = {
      box: this._geometry(new T.BoxGeometry(1, 1, 1)),
      pole: this._geometry(new T.CylinderGeometry(1, 1, 1, 10)),
      trunk: this._geometry(new T.CylinderGeometry(.22, .32, 1, 12, 14)),
      ball: this._geometry(new T.SphereGeometry(1, 10, 7)),
      stone: this._geometry(new T.IcosahedronGeometry(1, 1)),
      cone: this._geometry(new T.ConeGeometry(1, 1, 10)),
      photo: this._geometry(new T.PlaneGeometry(1, 1)),
      hill: this._geometry(new T.SphereGeometry(1, 28, 16)),
    };
    const asphalt = this._asset('asphalt', () => this._texture(this._canvas(512, 512, (g, w, h) => {
      g.fillStyle = '#575c5c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 65000; i++) { const v = 55 + (r() * 73 | 0); g.fillStyle = `rgba(${v},${v + 3},${v + 4},${.12 + r() * .3})`; g.fillRect(r() * w, r() * h, r() * 1.8 + .4, r() * 1.8 + .4); }
      g.strokeStyle = 'rgba(22,26,26,.12)'; g.lineWidth = .65;
      for (let i = 0; i < 30; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) g.lineTo(x + j * 4 + r() * 9, y + j * 5 + r() * 5); g.stroke(); }
    }), true), true);
    const ground = this._texture(this._canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#d9d8cd'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 22000; i++) { const v = 85 + r() * 120 | 0; g.fillStyle = `rgba(${v},${v},${v - 12},.2)`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 4); }
    }), true);
    const wall = this._texture(this._canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#cecec5'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 31) for (let x = -(y % 62 ? 0 : 40); x < w; x += 80) {
        g.fillStyle = `rgb(${177 + r() * 55 | 0},${177 + r() * 52 | 0},${166 + r() * 49 | 0})`; g.fillRect(x + 1, y + 1, 77, 28);
        g.fillStyle = 'rgba(255,255,240,.2)'; g.fillRect(x + 2, y + 1, 75, 1);
      }
    }), true);
    const plaster = this._texture(this._canvas(512, 512, (g, w, h) => {
      g.fillStyle = '#deddd3'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 42000; i++) { const v = 100 + r() * 130 | 0; g.fillStyle = `rgba(${v},${v},${v - 8},.09)`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
      for (let i = 0; i < 95; i++) {
        const x = r() * w, y = r() * h, length = 10 + r() * 160, streak = g.createLinearGradient(x, y, x, Math.min(h, y + length));
        streak.addColorStop(0, 'rgba(75,83,73,.055)'); streak.addColorStop(1, 'rgba(75,83,73,0)'); g.fillStyle = streak; g.fillRect(x, y, 1 + r() * 8, length);
      }
      g.strokeStyle = 'rgba(75,77,68,.055)'; g.lineWidth = 1;
      for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    }), true);
    this.mat = {
      road: this._mat({ map: asphalt, color: 0xb3bbc0, roughness: .98, metalness: 0 }),
      shoulder: this._mat({ map: asphalt, color: 0xa3a49d, roughness: .96 }),
      ground: this._mat({ map: ground, vertexColors: true, roughness: .99 }),
      concrete: this._mat({ map: wall, color: 0xd6d0be, roughness: .9 }),
      white: this._mat({ color: 0xf3f0dc, roughness: .82 }),
      marking: this._mat({ color: 0xeae8d8, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }),
      yellow: this._mat({ color: 0xf2bd32, roughness: .66 }),
      red: this._mat({ color: 0xbb3b31, roughness: .75 }),
      silver: this._mat({ color: 0xa3adb0, metalness: .72, roughness: .37 }),
      dark: this._mat({ color: 0x233237, metalness: .27, roughness: .5 }),
      glass: this._mat({ color: 0x5a808b, metalness: .52, roughness: .18, envMapIntensity: 1.3, emissive: 0x19353b, emissiveIntensity: .17 }),
      sand: this._mat({ map: ground, color: 0xf0e0b6, roughness: 1 }),
      bark: this._mat({ color: 0x817561, roughness: .98 }),
      foliage: this._mat({ color: 0xffffff, roughness: .98 }),
      crops: this._mat({ color: 0xffffff, roughness: .98 }),
      water: this._mat({ color: 0xffffff, vertexColors: true, metalness: .12, roughness: .28, transparent: false }),
      foam: this._mat({ color: 0xcdf8f0, roughness: .32, transparent: true, opacity: .62, depthWrite: false }),
      awning: this._mat({ color: 0xffffff, roughness: .84, side: T.DoubleSide }),
    };
    this.mat.foam.userData.casts = false; this.mat.water.userData.casts = false;
    for (const name of ['forest', 'rock', 'sand']) if (this.assets[name]) {
      const map = this._asset(name, () => ground, true);
      map.repeat.set(name === 'forest' ? 1 / 14 : name === 'rock' ? 1 / 3 : 1 / 4, name === 'forest' ? 1 / 10 : name === 'rock' ? 1 / 2 : 1 / 3);
      this.mat[name + 'Terrain'] = this._mat({ map, bumpMap: map, bumpScale: name === 'rock' ? .38 : .12, roughness: .96, vertexColors: true });
    }
    if (this.mat.forestTerrain) {
      const canopy = this.mat.forestTerrain.map.clone(); canopy.repeat.set(1, 1); canopy.needsUpdate = true; this.textures.add(canopy);
      this.mat.foliage.map = canopy;
      this.mat.hills = this._mat({ map: canopy, color: 0x8b9d72, roughness: .99 });
    } else this.mat.hills = this._mat({ color: 0x41653d, roughness: .99 });
    this.mat.road.bumpMap = asphalt; this.mat.road.bumpScale = .009;
    this.waterUniforms = { time: { value: 0 } };
    this.mat.water.onBeforeCompile = shader => {
      shader.uniforms.formosaTime = this.waterUniforms.time;
      shader.vertexShader = 'varying vec3 vFormosaWater;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFormosaWater = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = 'uniform float formosaTime;\nvarying vec3 vFormosaWater;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nvec2 wave = vec2(sin(vFormosaWater.x * .12 + vFormosaWater.z * .07 + formosaTime * .8), cos(vFormosaWater.z * .15 - vFormosaWater.x * .08 + formosaTime * .6));\nnormal = normalize(normal + vec3(wave.x * .035, wave.y * .025, 0.0));');
    };
    this.facades = [0xe8ddc5, 0xdedbc8, 0xd8c4a9, 0xc4c8c0, 0xefdfcc, 0xc8d0cb].map(color => this._mat({ color, map: plaster, bumpMap: plaster, bumpScale: .018, roughness: .88 }));
    if (this.assets.facadesPainted) {
      const atlas = this._asset('facadesPainted', () => ground);
      this.paintedFacades = [0, 1, 2, 3].map(panel => {
        const map = atlas.clone(); map.repeat.set(.25, 1); map.offset.set(panel * .25, 0); if (map.image) map.needsUpdate = true; this.textures.add(map);
        return this._illustratedMaterial(map);
      });
    }
    if (this.assets.skylinePainted) {
      const map = this._asset('skylinePainted', () => ground);
      const material = new T.MeshBasicMaterial({ map, transparent: true, alphaTest: .08, depthWrite: false, fog: false, toneMapped: false }); this.sharedMaterials.add(material);
      this.skyline = new T.Mesh(this.geo.photo, material); this.skyline.name = 'Kaohsiung distant illustrated skyline'; this.skyline.visible = false;
      this.skyline.frustumCulled = false; this.skyline.castShadow = false; this.skyline.receiveShadow = false; this.group.add(this.skyline);
    }
    if (this.assets.portPainted) {
      const map = this._asset('portPainted', () => ground);
      this.mat.portPainted = new T.MeshBasicMaterial({ map, alphaTest: .32, side: T.DoubleSide, toneMapped: false });
      this.mat.portPainted.userData.casts = false; this.sharedMaterials.add(this.mat.portPainted);
    }
    if (this.paintedFacades) this.paintedFacadeShade = this.paintedFacades.map(original => {
      // A small neutral skylight difference only for recessed storefronts.
      const material = original.clone(); material.color.setHex(0xecf0f2).multiplyScalar(.62); this.sharedMaterials.add(material); return material;
    });
    const leaf = this._asset('palmLeaf', () => this._texture(this._canvas(256, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let side of [-1, 1]) for (let k = 0; k < 45; k++) {
        const t = k / 45, y = h * t, span = Math.sin(Math.PI * t) * w * .46;
        const grad = g.createLinearGradient(w / 2, y, w / 2 + side * span, y + h * .06); grad.addColorStop(0, '#668344'); grad.addColorStop(.5, '#345d29'); grad.addColorStop(1, '#7f9b48');
        g.fillStyle = grad; g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + side * span * .68, y + 9, w / 2 + side * span, y + 34); g.quadraticCurveTo(w / 2 + side * span * .65, y + 7, w / 2, y + 8); g.fill();
      }
      g.strokeStyle = '#a2a366'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    })));
    this.mat.palm = this._mat({ map: leaf, alphaTest: .33, side: T.DoubleSide, roughness: .94, color: 0xf5fff0 });
    if (this.assets.palmTree) {
      const map = this._asset('palmTree', () => leaf);
      this.mat.palmTree = this._illustratedMaterial(map, { foliage: true, alphaTest: .35, side: T.DoubleSide });
    }
    if (this.assets.broadleafTree) {
      const map = this._asset('broadleafTree', () => leaf);
      this.mat.broadleafTree = this._illustratedMaterial(map, { foliage: true, alphaTest: .35, side: T.DoubleSide });
    }
    this.geo.palm = this._geometry(this._palmGeometry());
    this.geo.tree = this._geometry(this._treeGeometry());
    this.geo.roof = this._geometry(this._roofGeometry());
    const kite = new T.BufferGeometry(); kite.setAttribute('position', new T.Float32BufferAttribute([0, 1.4, 0, -.9, 0, 0, 0, -1.1, 0, .9, 0, 0], 3)); kite.setIndex([0, 1, 3, 1, 2, 3]); kite.computeVertexNormals(); this.geo.kite = this._geometry(kite);
    const tiles = this._texture(this._canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#a36a48'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = -8; x < w; x += 16) {
        const shift = y % 32 ? 8 : 0; g.fillStyle = '#9a5a3a'; g.fillRect(x + shift, y + 1, 15, 14);
        g.strokeStyle = '#c79567'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + shift + 1, y); g.quadraticCurveTo(x + shift + 8, y + 9, x + shift + 15, y); g.stroke();
        g.strokeStyle = '#713d2b'; g.lineWidth = 1; g.strokeRect(x + shift, y, 16, 16);
      }
    }), true); tiles.repeat.set(3, 4);
    this.mat.roof = this._mat({ map: tiles, roughness: .94, side: T.DoubleSide });
    this.geo.umbrella = this._geometry(new T.ConeGeometry(1, .35, 12, 1, true));
    this.mat.umbrella = this._mat({ color: 0xffffff, roughness: .8, side: T.DoubleSide });
  }

  _palmGeometry() {
    const T = this.T, positions = [], uv = [], idx = [], count = this.mobile ? 8 : 11, steps = 18;
    for (let f = 0; f < count; f++) {
      const a = f * Math.PI * 2 / count + (f % 2) * .17, len = 4.4 + (f % 3) * .38, start = positions.length / 3;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps, radial = t * len, y = Math.sin(Math.PI * t) * 1.25 - t * (1.05 + f % 3 * .26), width = Math.sin(Math.PI * t) * .85 + .035;
        for (let sg of [-1, 1]) { positions.push(Math.sin(a) * radial + Math.cos(a) * width * sg, y - width * .16, Math.cos(a) * radial - Math.sin(a) * width * sg); uv.push(sg < 0 ? 0 : 1, t); }
        if (j < steps) { const k = start + j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  _treeGeometry() {
    const g = new this.T.IcosahedronGeometry(1, 2), p = g.attributes.position, colors = [], c = new this.T.Color();
    const normals = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + noise(x * 18, z * 17 + y * 13) * .07; p.setXYZ(i, x * d, y * d, z * d); normals.push(x, y, z); c.setHSL(.28 + noise(x * 20, z * 30) * .015, .45, .15 + (y + 1) * .025); colors.push(c.r, c.g, c.b); }
    g.setAttribute('color', new this.T.Float32BufferAttribute(colors, 3)); g.setAttribute('normal', new this.T.Float32BufferAttribute(normals, 3)); this.mat.foliage.vertexColors = true; return g;
  }
  _roofGeometry() {
    const T = this.T, positions = [], uv = [], idx = [], n = 16;
    for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
      const xx = x / n * 2 - 1, zz = z / n * 2 - 1, end = clamp((Math.abs(zz) - .63) / .37, 0, 1);
      const y = (1 - Math.abs(xx)) * (1 - end) * .9 + .08 + Math.pow(Math.abs(xx * zz), 4) * .27;
      positions.push(xx, y, zz); uv.push(x / n, z / n);
      if (x < n && z < n) { const a = z * (n + 1) + x; idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  _position(p, s, lat, height = 0) { const v = p.pos(s, lat); return { x: v.x, y: v.y + height, z: v.z, yaw: -p.heading(s) }; }
  _shopMaterial(text) {
    this.regionalSigns ||= new Map();
    if (this.regionalSigns.has(text)) return this.regionalSigns.get(text);
    const style = [...text].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 5;
    const map = this._texture(this._canvas(512, 128, (g, w, h) => {
      g.fillStyle = ['#17536c', '#ad3d30', '#ded5b7', '#276e69', '#2f4b61'][style]; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ead3a2'; g.lineWidth = 4; g.strokeRect(7, 7, w - 14, h - 14);
      g.fillStyle = style === 2 ? '#7e3526' : '#f6eed7'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${text.length > 5 ? 57 : 68}px "Microsoft JhengHei",sans-serif`; g.fillText(text, w / 2, h / 2 + 2, w - 28);
    }));
    const material = new this.T.MeshBasicMaterial({ map, toneMapped: false }); this.sharedMaterials.add(material); this.regionalSigns.set(text, material); return material;
  }
  _shopPool(p) { return (REGIONAL_SHOPS[p.id] || ['在地小吃', '寶島旅宿', '便利商店', '在地茶行']).map(text => this._shopMaterial(text)); }
  _verticalSign(text) {
    this.verticalSigns ||= new Map();
    if (this.verticalSigns.has(text)) return this.verticalSigns.get(text);
    const map = this._texture(this._canvas(144, 512, (g, w, h) => {
      g.fillStyle = '#a93e32'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ead4a2'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#f9edd3'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const letters = [...text], size = Math.min(81, 440 / letters.length); g.font = `bold ${size}px "Microsoft JhengHei",sans-serif`;
      for (let i = 0; i < letters.length; i++) g.fillText(letters[i], w / 2, 42 + (i + .5) * 428 / letters.length);
    }));
    const material = new this.T.MeshBasicMaterial({ map, toneMapped: false, side: this.T.DoubleSide }); this.sharedMaterials.add(material); this.verticalSigns.set(text, material); return material;
  }
  _put(b, geo, mat, p, s, lat, height, sx, sy, sz, color, yaw = 0) {
    const a = this._position(p, s, lat, height); b.add(geo, mat, a.x, a.y, a.z, sx, sy, sz, a.yaw + yaw, color);
  }
  _edge(p, s, sg, off = 0) { return sg > 0 ? p.rightEdge(s) + off : p.leftEdge(s) - off; }
  _seaLevel(p) {
    if (p._hdSeaLevel != null) return p._hdSeaLevel;
    let low = Infinity;
    for (let i = 0; i < p.N; i += 4) { const sec = p.secs[p.SEC[i]]; if (sec && (SEA.has(sec.L) || SEA.has(sec.R))) low = Math.min(low, p.Y[i]); }
    return p._hdSeaLevel = Number.isFinite(low) ? low - 3 : 0;
  }
  _shoreStart(type) { return type === 'harbor' ? 10.25 : type === 'bay' ? 70 : type === 'beach' ? 55 : type === 'lake' ? 5 : type === 'river' ? 6 : 18; }
  _coastalHills(b, p, s, sg) {
    const q = p.pos(s, 0), h = p.heading(s), sea = this._seaLevel(p);
    for (let k = 0; k < 4; k++) {
      const forward = 680 + k * 115, lateral = sg * (170 + k * 95), sx = 95 + k * 21, sy = 45 + k * 15;
      b.add(this.geo.hill, this.mat.hills, q.x + Math.sin(h) * forward + Math.cos(h) * lateral, sea + sy * .28, q.z - Math.cos(h) * forward + Math.sin(h) * lateral, sx, sy, 105 + k * 32, -h);
    }
  }
  _solid(p, s, lateral, halfX, halfS, kind = 'solid') {
    if (!this.buildColliders || s < 0 || s > p.L || Math.abs(lateral) - Math.max(-p.leftEdge(s), p.rightEdge(s)) > 34) return;
    this.buildColliders.push({ s0: s - halfS, s1: s + halfS, x0: lateral - halfX, x1: lateral + halfX, kind });
  }
  _refreshColliders(p) {
    const chunks = this.colliderChunks.get(p); p.hdColliders = chunks ? [...chunks.values()].flat().sort((a, b) => a.s0 - b.s0) : [];
  }
  _room(p, s, sg) {
    let room = p.innerFree && sg === -p.side ? p.at(p.innerFree, s) : 1e6;
    // Offset curves become singular inside a tight bend. End the visible terrain
    // before the bend's centre instead of folding a hillside across the road.
    const k = p.curv(s);
    if (k * sg > .0003) room = Math.min(room, .78 / Math.abs(k));
    return room;
  }
  _beam(b, mat, a, c, width = .13, depth = width) {
    const T = this.T, va = new T.Vector3(a.x, a.y, a.z), vb = new T.Vector3(c.x, c.y, c.z), d = vb.clone().sub(va), mid = va.add(vb).multiplyScalar(.5);
    b.add(this.geo.box, mat, mid.x, mid.y, mid.z, width, d.length(), depth, 0, null, new T.Quaternion().setFromUnitVectors(this.up, d.normalize()));
  }

  _surface(group, p, a, z, offsets, heights, mat, color = null, step = 8, tiled = false) {
    if (z <= a) return;
    const T = this.T, pos = [], uv = [], cols = [], idx = [], sample = Math.max(1, Math.ceil((z - a) / step)), n = offsets.length;
    for (let j = 0; j <= sample; j++) {
      const s = a + (z - a) * j / sample;
      for (let k = 0; k < n; k++) {
        const x = offsets[k](s), v = p.pos(s, x), dh = heights[k](s, x); pos.push(v.x, v.y + dh, v.z);
        uv.push(tiled ? x / 5 : k / (n - 1), s / (tiled ? 7 : 12));
        if (color != null) { const c = new T.Color(typeof color === 'function' ? color(s, x, k) : color); c.multiplyScalar(.93 + noise(v.x, v.z) * .1); cols.push(c.r, c.g, c.b); }
        if (j < sample && k < n - 1) { const v0 = j * n + k; idx.push(v0, v0 + 1, v0 + n, v0 + 1, v0 + n + 1, v0 + n); }
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); if (cols.length) g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, mat); m.receiveShadow = true; m.userData.ownedGeometry = true; group.add(m);
  }

  _road(group, b, p, a, z) {
    const zero = () => .015;
    this._surface(group, p, a, z, [s => p.leftEdge(s), s => p.rightEdge(s)], [zero, zero], this.mat.shoulder, null, 4, true);
    this._surface(group, p, a, z, [s => -p.hw(s), s => p.hw(s)], [() => .025, () => .025], this.mat.road, null, 4, true);
    for (let sg of [-1, 1]) this._surface(group, p, a, z, [s => sg * p.hw(s) - .075, s => sg * p.hw(s) + .075], [() => .04, () => .04], sg < 0 && !URBAN.has(p.sec((a + z) / 2).L) ? this.mat.yellow : this.mat.marking, null, 4);
    for (let s = Math.ceil(a / 12) * 12; s < z; s += 12) {
      const lanes = Math.round(p.hw(s) * 2 / 3.5);
      for (let n = 1; n < lanes; n++) {
        const lat = t => -p.hw(t) + p.hw(t) * 2 * n / lanes;
        this._surface(group, p, s, Math.min(z, s + 4), [t => lat(t) - .065, t => lat(t) + .065], [() => .045, () => .045], this.mat.marking, null, 4);
      }
    }
    // Continuous shoulders, drainage and kerbstones keep the paved edge anchored.
    for (let s = a + 2; s < z; s += 4) {
      const sec = p.sec(s);
      for (let sg of [-1, 1]) {
        const type = sg < 0 ? sec.L : sec.R, room = this._room(p, s, sg);
        if (room < .4) continue;
        if (URBAN.has(type) || type === 'harbor') this._put(b, this.geo.box, Math.floor(s / 4) % 3 === 0 ? this.mat.red : this.mat.white, p, s, this._edge(p, s, sg, .1), .1, .25, .2, 3.98);
      }
    }
  }

  _groundHeight(type, off, s, p = null) {
    // The ocean stays at sea level while the road climbs above it. Inland
    // reservoirs keep their own basin elevation, rather than following hills.
    if (SEA.has(type) && p) {
      const edge = type === 'harbor' ? 8.3 : 2, end = this._shoreStart(type);
      const t = clamp((off - edge) / (end - edge), 0, 1);
      return (this._seaLevel(p) - p.yAt(s)) * (t * t * (3 - 2 * t));
    }
    if (type === 'slope') return off < 2 ? 0 : Math.min(130, Math.pow(off - 2, .83) * 2.7) + noise(s * .3, off) * Math.min(off * .1, 8);
    if (type === 'mountain') return off < 5 ? 0 : Math.min(185, Math.pow(off - 5, .89) * 2) + noise(s * .4, off) * Math.min(off * .08, 9);
    if (type === 'hills') return off < 7 ? 0 : Math.max(0, off - 7) * .3 + Math.sin(off * .018) * 14 + noise(s * .3, off) * Math.min(off * .045, 7);
    if (type === 'gorge') return off < 2 ? .2 : Math.min(165, (off - 2) * (off < 12 ? 5.5 : 3.7)) + noise(s * .5, off) * Math.min(off * .2, 9);
    if (type === 'cut') return off < .7 ? 0 : Math.min(8, (off - .7) * 4);
    if (type === 'highland') return off < 3 ? 0 : Math.sin(off * .012) * 19 + noise(s * .3, off) * Math.min(off * .05, 10);
    if (type === 'tea' || type === 'daylily' || type === 'cabbage') return off < 4 ? 0 : Math.floor((off - 4) / 4) * 1.35 + noise(s * .2, off * .1) * Math.min(off * .02, 2);
    if (type === 'cliff') return off < 2 ? 0 : -Math.min(24, (off - 2) * 1.8);
    if (WATER.has(type)) return off < 3 ? -.05 : -Math.min(type === 'harbor' ? 2.7 : 5, off * .13);
    return off < 5 ? -.03 : noise(s * .25, off * .4) * Math.min(off * .008, .6);
  }

  _side(group, b, p, a, z, sec, sg, r) {
    const type = sg > 0 ? sec.R : sec.L, room = Math.min(this._room(p, a + 2, sg), this._room(p, (a + z) / 2, sg));
    if (room < .4) return;
    const widths = WATER.has(type) ? (type === 'harbor' ? [0, .3, 8.3, 10, 10.3] : type === 'bay' || type === 'beach' ? [0, 2, 12, 30, this._shoreStart(type)] : [0, 2, 9, 18]) : [0, 1.1, 4, 12, 30, 65, 110, 165, 240];
    const max = Math.min(room, widths[widths.length - 1]);
    const off = widths.filter(x => x < max); off.push(max);
    const height = (s, x) => this._groundHeight(type, Math.abs(x - (sg > 0 ? p.rightEdge(s) : p.leftEdge(s))), s, p);
    const terrainMat = HILL.has(type) && !CROPS.has(type) && type !== 'highland' ? this.mat.forestTerrain || this.mat.ground : ['gorge', 'cut', 'riverbed', 'pebble', 'shore', 'cliff'].includes(type) ? this.mat.rockTerrain || this.mat.ground : ['bay', 'beach'].includes(type) ? this.mat.sandTerrain || this.mat.ground : this.mat.ground;
    const color = (s, x) => {
      const distance = Math.abs(x - (sg > 0 ? p.rightEdge(s) : p.leftEdge(s)));
      if (terrainMat !== this.mat.ground) return distance < 1.2 ? 0xc4c2b2 : 0xe3e5d1;
      if (type === 'harbor') return distance < 8.4 ? 0xd0c9b7 : 0x898d86;
      if (SEA.has(type)) return type === 'cliff' || type === 'pebble' || type === 'shore' ? (distance > 4 ? 0x918b7c : 0x758646) : (distance > 2 ? 0xe8d9af : 0x83954d);
      if (type === 'cut' || type === 'gorge') return distance > 4 ? 0x92968f : 0xb3b3a5;
      return distance < 1.2 ? (URBAN.has(type) ? 0xc7c0ad : 0x919179) : BASE[type] || 0x768b51;
    };
    // Reversing lateral vertex order preserves upward normals on both shoulders.
    const ordered = sg > 0 ? off : [...off].reverse();
    this._surface(group, p, a, z, ordered.map(o => s => this._edge(p, s, sg, Math.min(o, this._room(p, s, sg)))), ordered.map(() => height), terrainMat, color, HILL.has(type) || type === 'gorge' ? 8 : 12, true);
    if (WATER.has(type) && room > 15) {
      const start = this._shoreStart(type);
      const far = Math.min(room, type === 'harbor' ? 320 : type === 'river' ? 160 : 850);
      const oo = sg > 0 ? [start, start + 28, Math.min(far, start + 120), far] : [far, Math.min(far, start + 120), start + 28, start];
      const basin = SEA.has(type) ? this._seaLevel(p) : Math.min(...p.Y) - 4.5;
      const waterH = s => (SEA.has(type) || type === 'lake') ? basin - p.yAt(s) : -4.5;
      const nearColor = new this.T.Color(type === 'harbor' ? 0x23748e : type === 'lake' ? 0x3b8e83 : 0x43bdb7), farColor = new this.T.Color(type === 'harbor' ? 0x1b5b7e : type === 'lake' ? 0x2f6975 : 0x086a9c);
      this._surface(group, p, a, z, oo.map(o => s => this._edge(p, s, sg, Math.min(o, this._room(p, s, sg)))), oo.map(() => waterH), this.mat.water, (ss, x) => nearColor.clone().lerp(farColor, clamp((Math.abs(x - this._edge(p, ss, sg)) - start) / 150, 0, 1)).getHex(), 18, true);
      if (type === 'harbor' && room > 195) {
        const quay = sg > 0 ? [132, 194] : [194, 132];
        this._surface(group, p, a, z, quay.map(o => s => this._edge(p, s, sg, o)), quay.map(() => s => basin + 1.7 - p.yAt(s)), this.mat.ground, 0xb7b2a2, 12, true);
      }
      if (SEA.has(type) && type !== 'harbor') {
        const foamOff = start + .5;
        const ff = sg > 0 ? [foamOff, foamOff + 1.6] : [foamOff + 1.6, foamOff];
        this._surface(group, p, a, z, ff.map(o => s => this._edge(p, s, sg, o)), [s => waterH(s) + .06, s => waterH(s) + .06], this.mat.foam, null, 8);
      }
    }
    if (type === 'city' || type === 'town') this._streets(b, p, a, z, sg, type, sec, r);
    else if (type === 'industrial') this._industry(b, p, a, z, sg, r);
    else if (type === 'harbor') this._harbor(b, p, a, z, sg, r, sec);
    else if (type === 'plaza') this._plaza(b, p, a, z, sg, r);
    else if (type === 'cut') this._cut(b, p, a, z, sg, sec);
    else this._nature(b, p, a, z, sg, type, r);
    if (['bay', 'beach', 'shore', 'cliff', 'pebble'].includes(type) && Math.floor(a / CHUNK) % 3 === 0) this._coastalHills(b, p, (a + z) / 2, sg);
    if (CROPS.has(type) || type === 'fishpond' || type === 'milkfish') this._fields(b, p, a, z, sg, type, r);
    if (SEA.has(type) || ['lake', 'river', 'mountain', 'gorge'].includes(type) || sec.bridge || (sec.tags || []).includes(sg > 0 ? 'guardR' : 'guardL')) this._guard(b, p, a, z, sg, type === 'harbor' ? 8 : .5, type === 'harbor' || type === 'bay');
    if (sec.bridge || URBAN.has(type) || type === 'harbor' || type === 'industrial') for (let s = Math.ceil(a / 42) * 42; s < z; s += 42) if (this._room(p, s, sg) > 2) this._lamp(b, p, s, sg, type === 'harbor' ? .9 : .6);
    if (Math.abs(sec.k || 0) > .0035) for (let s = Math.ceil(a / 28) * 28; s < z; s += 28) if (sg === (sec.k > 0 ? -1 : 1) && this._room(p, s, sg) > 2) this._chevron(b, p, s, sg, sec.k > 0);
  }

  _palm(b, p, s, lat, size = 1, r = () => .5, base = 0) {
    const height = (8.3 + r() * 3.5) * size, a = this._position(p, s, lat, base);
    if (base < .6) this._solid(p, s, lat, .3 * size, .33 * size);
    if (this.mat.palmTree) {
      const fullHeight = height * 1.28;
      b.add(this.geo.photo, this.mat.palmTree, a.x, a.y + fullHeight / 2 - .05, a.z, fullHeight * 2 / 3, fullHeight, 1, a.yaw);
      return;
    }
    b.add(this.geo.trunk, this.mat.bark, a.x, a.y + height * .5, a.z, size, height, size, a.yaw);
    // Narrow raised trunk rings catch sunlight like mature royal palms.
    if (!this.mobile) for (let h = 1.4; h < height - 1; h += .8) b.add(this.geo.pole, this.mat.bark, a.x, a.y + h, a.z, .27 * size, .045, .27 * size, a.yaw, 0xc5bba3);
    b.add(this.geo.palm, this.mat.palm, a.x, a.y + height, a.z, size, size, size, r() * Math.PI * 2);
    for (let i = 0; i < 3; i++) b.add(this.geo.ball, this.mat.bark, a.x + (i - 1) * .19 * size, a.y + height - .15, a.z, .19 * size, .24 * size, .19 * size, 0, 0x655934);
  }
  _tree(b, p, s, lat, size = 1, base = 0, pine = false, tint = 0xffffff) {
    const a = this._position(p, s, lat, base), h = (pine ? 9 : 5) * size;
    if (base < .8) this._solid(p, s, lat, .22 * size, .22 * size);
    if (this.mat.broadleafTree && !pine) {
      const full = 8.2 * size; b.add(this.geo.photo, this.mat.broadleafTree, a.x, a.y + full * .5 - .04, a.z, full * 2 / 3, full, 1, a.yaw); return;
    }
    b.add(this.geo.pole, this.mat.bark, a.x, a.y + h * .4, a.z, .2 * size, h * .8, .2 * size);
    if (pine) for (let j = 0; j < 4; j++) b.add(this.geo.cone, this.mat.foliage, a.x, a.y + h * (.42 + j * .15), a.z, (2.6 - j * .42) * size, 3.3 * size, (2.6 - j * .42) * size, a.yaw, 0x44683c);
    else for (let j = 0; j < (this.mobile ? 2 : 4); j++) b.add(this.geo.tree, this.mat.foliage, a.x + Math.sin(j * 2.4) * size, a.y + h * (.9 + j % 2 * .11), a.z + Math.cos(j * 2.4) * size, (2.3 + j * .18) * size, (1.9 + j % 2 * .6) * size, (2.1 + j % 3 * .2) * size, j * 1.7, tint);
  }
  _bush(b, p, s, lat, size = 1, base = 0, color = 0x849666) {
    this._put(b, this.geo.tree, this.mat.foliage, p, s, lat, base + .48 * size, .85 * size, .5 * size, .9 * size, color);
  }
  _rock(b, p, s, lat, size = 1, base = 0, color = 0xa69f8c) {
    if (base < .7 && base > -1.5) this._solid(p, s, lat, size * .82, size * .7);
    this._put(b, this.geo.stone, this.mat.concrete, p, s, lat, base + size * .45, size, size * .75, size * .8, color, s * 1.3);
  }

  _building(b, p, s, sg, off, width, depth, height, r, beach = false, painted = false) {
    if (this._room(p, s, sg) < off + depth + 1) return;
    const lat = this._edge(p, s, sg, off + depth / 2), facade = this.facades[Math.floor(r() * this.facades.length)];
    this._solid(p, s, lat, depth / 2, width / 2, 'wall');
    this._put(b, this.geo.box, facade, p, s, lat, height / 2 + .15, depth, height, width);
    this._put(b, this.geo.box, this.mat.concrete, p, s, lat, height + .2, depth + .35, .3, width + .35);
    const front = this._edge(p, s, sg, off - .06), floors = Math.floor((height - 3) / 2.9), cols = Math.max(1, Math.floor(width / 2.8));
    const shopPool = this._shopPool(p);
    // Recessed glass, projecting sill, balcony floor and iron handrail.
    if (!painted) for (let f = 0; f < floors; f++) for (let j = 0; j < cols; j++) {
      const ss = s - width * .5 + (j + .5) * width / cols, yy = 4.7 + f * 2.9;
      this._put(b, this.geo.box, this.mat.dark, p, ss, front, yy, .18, 1.82, width / cols * .7);
      this._put(b, this.geo.box, this.mat.glass, p, ss, front - sg * .11, yy + .035, .07, 1.62, width / cols * .62);
      this._put(b, this.geo.box, this.mat.white, p, ss, front - sg * .2, yy - .92, .45, .13, width / cols * .78);
      if (f % 2 === 0 && j % 2 === 0) {
        this._put(b, this.geo.box, this.mat.concrete, p, ss, front - sg * .47, yy - .98, 1.2, .15, width / cols * .9);
        for (const dh of [-.17, -.65]) this._put(b, this.geo.box, this.mat.dark, p, ss, front - sg * 1.02, yy + dh, .045, .045, width / cols * .8);
        for (let post = 0; post < (this.mobile ? 3 : 6); post++) this._put(b, this.geo.box, this.mat.dark, p, ss - width / cols * .4 + width / cols * .8 * post / (this.mobile ? 2 : 5), front - sg * 1.02, yy - .55, .035, .8, .035);
      }
      if (!this.mobile && j % 2 === 0) this._put(b, this.geo.box, this.mat.white, p, ss + .6, front - sg * .35, yy - .4, .55, .52, .72, 0xd8d6c8);
    }
    if (painted) {
      const variation = typeof painted === 'object' ? painted : {}, panel = variation.panel ?? Math.floor(r() * 4);
      const materials = off > 6 ? this.paintedFacadeShade : this.paintedFacades;
      this._put(b, this.geo.photo, materials[panel], p, s, front - sg * .1, height / 2 + .15, width, height, 1, null, sg < 0 ? Math.PI / 2 : -Math.PI / 2);
      if (r() < .42) this._put(b, this.geo.photo, shopPool[Math.floor(r() * shopPool.length)], p, s - width * .12, front - sg * .17, 3.21, width * .6, .57, 1, null, sg < 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      this._put(b, this.geo.box, shopPool[Math.floor(r() * shopPool.length)], p, s, front - sg * .12, 3.1, .16, .85, width * .88);
      this._put(b, this.geo.box, this.mat.glass, p, s, front - sg * .03, 1.42, .11, 2.5, width * .9);
      for (let frame = 0; frame < 4; frame++) this._put(b, this.geo.box, this.mat.silver, p, s - width * .4 + frame * width * .8 / 3, front - sg * .11, 1.42, .12, 2.5, .055);
    }
    // Three-dimensional arcade columns, roof and awnings remain in front of
    // the detailed facade, so the street still has depth as the car passes.
    for (let j = 0; j < 3; j++) { const ss = s - width / 2 + .25 + j * (width - .5) / 2; this._put(b, this.geo.box, facade, p, ss, front - sg * 1.2, 1.5, .35, 3, .35); this._solid(p, ss, front - sg * 1.2, .175, .175); }
    this._put(b, this.geo.box, this.mat.concrete, p, s, front - sg * .65, 3, 1.7, .23, width + .2);
    if (beach || r() < (painted ? .25 : .55)) {
      const colors = [0xb84c35, 0x4b8c78, 0xdba24a, 0x366f98];
      for (let j = 0; j < Math.ceil(width); j++) this._put(b, this.geo.box, this.mat.awning, p, s - width / 2 + j + .5, front - sg * 1.48, 2.8, 1.35, .14, .98, j % 2 ? 0xe8e1c6 : colors[Math.floor(s) % colors.length]);
    }
    if (painted && r() < .26) {
      const names = REGIONAL_SHOPS[p.id] || ['在地小吃'], label = names[Math.floor(r() * names.length)];
      this._put(b, this.geo.box, this.mat.dark, p, s + width * .34, front - sg * .9, 5.5, 1.02, 3.35, .12);
      this._put(b, this.geo.photo, this._verticalSign(label), p, s + width * .34 - .075, front - sg * .9, 5.5, .96, 3.28, 1);
    } else if (!painted && r() < .55) this._put(b, this.geo.box, shopPool[Math.floor(r() * shopPool.length)], p, s + width * .35, front - sg * .9, 5.8, .19, 3, 1.05);
    if (r() < .7) { this._put(b, this.geo.pole, this.mat.silver, p, s + width * .28, lat, height + 1, .7, 1.65, .7); this._put(b, this.geo.box, this.mat.dark, p, s - width * .2, lat, height + .5, depth * .35, .6, width * .3); }
  }

  _streets(b, p, a, z, sg, type, sec, r) {
    const beach = (sec.tags || []).some(t => ['beachshops', 'nightmarket', 'seafood'].includes(t));
    const port = p.id === 's1' && (sec.L === 'harbor' || sec.R === 'harbor'), painted = !!this.paintedFacades && port;
    if (painted) {
      const pitch = 6.7;
      for (let cell = Math.floor(a / pitch); cell * pitch + pitch / 2 < z; cell++) {
        const v = random((cell * 92821 + (sg + 2) * 68917) >>> 0), s = cell * pitch + pitch / 2 + (v() - .5) * .35;
        if (s <= a || s >= z || this._room(p, s, sg) <= 14) continue;
        const width = 5.65 + v() * .9, height = 9.7 + v() * 2.6, off = 5.6 + v() * .75;
        this._building(b, p, s, sg, off, width, 8 + v() * 3, height, r, false, { panel: Math.floor(v() * 4) });
      }
    } else for (let s = Math.floor(a / 14) * 14 + 7; s < z; s += 14) if (s > a && this._room(p, s, sg) > 14) this._building(b, p, s, sg, 5.8, 12.5, 8 + r() * 5, beach ? 7.2 + r() * 6 : type === 'city' ? 10 + r() * 9 : 7 + r() * 7, r, beach);
    for (let s = Math.ceil(a / 19) * 19; s < z; s += 19) if (this._room(p, s, sg) > 5) {
      this._palm(b, p, s, this._edge(p, s, sg, 3.3), .9 + r() * .17, r);
      this._put(b, this.geo.box, this.mat.concrete, p, s, this._edge(p, s, sg, 3.3), .28, 1.5, .55, 1.5);
      this._bush(b, p, s, this._edge(p, s, sg, 3.3), .8, .5);
      if (s % 3 < 1.5) this._person(b, p, s + 5, this._edge(p, s, sg, 2), r);
    }
    // A second urban layer gives streets depth beyond the first row of shops.
    if (!(port && this.skyline)) for (let s = Math.ceil(a / 39) * 39; s < z; s += 39) {
      const off = 27 + r() * 24, h = type === 'city' ? 22 + r() * 47 : 10 + r() * 14;
      if (this._room(p, s, sg) > off + 15) {
        const lat = this._edge(p, s, sg, off);
        this._put(b, this.geo.box, this.facades[Math.floor(r() * 6)], p, s, lat, h * .5, 14, h, 19);
        for (let f = 4; f < h; f += 3.2) this._put(b, this.geo.box, this.mat.glass, p, s, lat - sg * 7.06, f, .05, 1.4, 16);
      }
    }
  }

  _guard(b, p, a, z, sg, off, white = false) {
    const mat = white ? this.mat.white : this.mat.silver, step = white ? 3.5 : 4;
    for (let s = Math.ceil(a / step) * step; s < z; s += step) {
      if (this._room(p, s, sg) < off + .7) continue;
      const lat = this._edge(p, s, sg, off);
      this._solid(p, s, lat, white ? .14 : .17, Math.min(step * .5, s - a + step * .5, z - s + step * .5), 'wall');
      this._put(b, this.geo.box, mat, p, s, lat, .53, .13, 1.06, .13);
      if (white) this._put(b, this.geo.ball, this.mat.yellow, p, s, lat, 1.1, .105, .105, .105);
      for (let h of white ? [.45, .92] : [.74]) this._beam(b, mat, this._position(p, Math.max(a, s - step * .5), this._edge(p, Math.max(a, s - step * .5), sg, off), h), this._position(p, Math.min(z, s + step * .5), this._edge(p, Math.min(z, s + step * .5), sg, off), h), white ? .1 : .18, .075);
      if (!white && Math.floor(s / step) % 3 === 0) this._put(b, this.geo.box, this.mat.yellow, p, s, lat - sg * .1, .82, .035, .11, .14);
    }
  }
  _lamp(b, p, s, sg, off) {
    const lat = this._edge(p, s, sg, off), a = this._position(p, s, lat, 0), top = this._position(p, s, lat, 9.5), inner = this._position(p, s, lat - sg * 2.5, 10.15);
    this._solid(p, s, lat, .1, .1);
    this._beam(b, this.mat.silver, a, top, .14); this._beam(b, this.mat.silver, top, inner, .11);
    this._put(b, this.geo.box, this.mat.silver, p, s, lat - sg * 2.7, 10.1, .9, .16, .35);
    this._put(b, this.geo.box, this.mat.white, p, s, lat - sg * 2.7, 9.99, .65, .035, .25);
  }
  _person(b, p, s, lat, r, base = 0) {
    const skin = [0xc29874, 0xb58764, 0xd6af89][Math.floor(r() * 3)], shirt = [0xf4eee2, 0x36597d, 0xa44936, 0x6c8780][Math.floor(r() * 4)];
    this._put(b, this.geo.ball, this.mat.white, p, s, lat, base + 1.52, .13, .18, .13, skin);
    this._put(b, this.geo.box, this.mat.white, p, s, lat, base + 1.04, .35, .6, .22, shirt);
    for (let q of [-1, 1]) this._put(b, this.geo.box, this.mat.dark, p, s + q * .11, lat, base + .36, .13, .74, .13);
  }
  _chevron(b, p, s, sg, right) {
    const lat = this._edge(p, s, sg, 1.15); this._put(b, this.geo.pole, this.mat.silver, p, s, lat, .8, .05, 1.6, .05);
    this._put(b, this.geo.box, this.mat.yellow, p, s, lat, 1.75, .08, .85, .75, null, Math.PI / 2);
    const a = this._position(p, s - .15, lat - .08 * sg, 1.96), c = this._position(p, s + .15, lat - .08 * sg, 1.75), d = this._position(p, s - .15, lat - .08 * sg, 1.54);
    if (!right) { a.z += .3; d.z += .3; c.z -= .3; }
    this._beam(b, this.mat.dark, a, c, .11); this._beam(b, this.mat.dark, c, d, .11);
  }

  _nature(b, p, a, z, sg, type, r) {
    const mountain = HILL.has(type), pine = type === 'highland' || p.def.pano === 'cingjing';
    for (let s = a + 3; s < z; s += this.mobile ? 11 : 7) {
      const room = this._room(p, s, sg); if (room < 3) continue;
      if (SEA.has(type)) {
        if (type !== 'cliff' && type !== 'pebble' && r() < .4) this._palm(b, p, s, this._edge(p, s, sg, 2.1), .78 + r() * .3, r);
        if (type === 'bay' || type === 'beach') {
          if (room > 25 && r() < .43) { const off = 10 + r() * 13; this._umbrella(b, p, s, this._edge(p, s, sg, off), r, this._groundHeight(type, off, s, p)); }
          if (room > 17 && r() < .5) { const off = 7 + r() * 9; this._person(b, p, s + 1, this._edge(p, s, sg, off), r, this._groundHeight(type, off, s, p)); }
        } else if (room > 20 && r() < .7) { const off = 6 + r() * 12; this._rock(b, p, s, this._edge(p, s, sg, off), .8 + r() * 2, this._groundHeight(type, off, s, p)); }
        this._bush(b, p, s, this._edge(p, s, sg, 1.3), .5 + r() * .6, 0);
      } else if (type === 'gorge') {
        if (room > 9) this._rock(b, p, s, this._edge(p, s, sg, 7), 4 + r() * 6, 20, 0xbec4bd);
      } else if (!WATER.has(type) && type !== 'riverbed' && type !== 'salt') {
        if (type === 'grass' || type === 'orchard' || type === 'hills') {
          if (r() < .45) this._palm(b, p, s, this._edge(p, s, sg, 2.8), .8 + r() * .3, r);
          else this._tree(b, p, s, this._edge(p, s, sg, 4.5), .65 + r() * .55, this._groundHeight(type, 4.5, s), pine);
        }
        this._bush(b, p, s, this._edge(p, s, sg, 1.5), .8 + r() * .4);
      }
      if (mountain || type === 'orchard' || type === 'grass') for (let j = 0; j < (this.mobile ? 3 : 5); j++) {
        const off = 9 + j * 15 + r() * 13;
        if (room < off + 4) continue;
        const ss = s + r() * 6;
        this._tree(b, p, ss, this._edge(p, ss, sg, off), (mountain ? 1.1 : .9) + r() * .6, this._groundHeight(type, off, ss), pine, [0xe5e8c7, 0xd6dfbb, 0xffffff][Math.floor(r() * 3)]);
      }
    }
    // Rock-faced roadside retaining walls tie steep hills into the road.
    if (type === 'slope' || type === 'mountain') for (let s = a + 3; s < z; s += 6) if (this._room(p, s, sg) > 3) {
      this._put(b, this.geo.box, this.mat.concrete, p, s, this._edge(p, s, sg, 1.9), 1.1, .6, 2.2, 6, 0xa5a894);
      this._solid(p, s, this._edge(p, s, sg, 1.9), .3, 3, 'wall');
      if (Math.floor(s / 6) % 3 === 0) this._bush(b, p, s, this._edge(p, s, sg, 2.1), 1.25, 2.1, 0xa7a294);
    }
  }
  _umbrella(b, p, s, lat, r, base = -1.5) {
    this._put(b, this.geo.pole, this.mat.white, p, s, lat, base + 1.15, .035, 2.3, .035);
    this._put(b, this.geo.umbrella, this.mat.umbrella, p, s, lat, base + 2.4, 1.5, 1.5, 1.5, [0xdb684b, 0x4e9cc8, 0xe8cb5b, 0xdcd7bf][Math.floor(r() * 4)]);
    this._put(b, this.geo.box, this.mat.white, p, s + .7, lat, base + .15, 1.6, .1, .6, 0xe6d0a3);
  }
  _fields(b, p, a, z, sg, type, r) {
    for (let s = Math.ceil(a / 18) * 18; s < z; s += 18) for (let off = 8; off < 88 && off + 2 < this._room(p, s, sg); off += 9) {
      const h = this._groundHeight(type, off, s);
      if (type === 'fishpond' || type === 'milkfish' || type === 'salt') {
        this._put(b, this.geo.box, type === 'salt' ? this.mat.white : this.mat.water, p, s, this._edge(p, s, sg, off + 3), -.02, 7.8, .035, 15, type === 'salt' ? 0xe9d4d5 : 0x82a58c);
      } else {
        const col = type === 'daylily' ? 0xe4ac38 : type === 'cabbage' ? 0xbbd49c : type === 'tea' ? 0x699957 : type === 'paddy' ? 0x9abb5f : 0x87a457;
        this._put(b, this.geo.box, this.mat.crops, p, s, this._edge(p, s, sg, off), h + .16, type === 'tea' ? 2.4 : 1.3, type === 'cane' ? 1.8 : .35, 15.5, col);
      }
    }
    if (Math.floor(a / CHUNK) % 2 === 0 && this._room(p, (a + z) / 2, sg) > 40) this._building(b, p, (a + z) / 2, sg, 25, 10, 8, 5.8, r);
  }

  _harbor(b, p, a, z, sg, r, sec) {
    for (let s = Math.ceil(a / 22) * 22; s < z; s += 22) if (this._room(p, s, sg) > 9) {
      this._palm(b, p, s, this._edge(p, s, sg, 6.2), .95, r);
      this._put(b, this.geo.box, this.mat.concrete, p, s + 6, this._edge(p, s, sg, 3.3), .4, 1.2, .8, 1.7);
      this._bush(b, p, s + 6, this._edge(p, s, sg, 3.3), 1.1, .8);
      if (r() < .5) this._person(b, p, s + 9, this._edge(p, s, sg, 4), r);
    }
    const containerPort = p.id === 's1' || (sec.tags || []).some(t => ['cranes', 'ships', 'containers'].includes(t));
    if (!containerPort) return;
    if (p.id === 's1' && this.mat.portPainted) {
      // Static sea-side landmarks retain real position/parallax. Wide spacing
      // prevents a row of repeated ships; the original box port is retired.
      for (let s = Math.floor(a / 760) * 760 + 500; s < z; s += 760) if (s >= a && this._room(p, s, sg) > 250) {
        const lat = this._edge(p, s, sg, 240), height = 85, width = 170;
        this._put(b, this.geo.photo, this.mat.portPainted, p, s, lat, this._seaLevel(p) - p.yAt(s) + height * .47, width, height, 1, null, -sg * .25);
      }
      return;
    }
    for (let s = Math.ceil(a / 150) * 150 + 45; s < z; s += 150) if (s > a && this._room(p, s, sg) > 185) {
      const lat = this._edge(p, s, sg, 147), base = this._seaLevel(p) + 1.7 - p.yAt(s), top = 42 + base;
      for (let ds of [-11, 11]) for (let dx of [-9, 9]) {
        const foot = this._position(p, s + ds, lat + dx, base), head = this._position(p, s + ds, lat + dx * .55, top - 6); this._beam(b, this.mat.red, foot, head, .9);
      }
      this._beam(b, this.mat.red, this._position(p, s, lat + sg * 18, top), this._position(p, s, lat - sg * 49, top + 6), .9, 1.1);
      this._beam(b, this.mat.red, this._position(p, s, lat, top - 6), this._position(p, s, lat, top + 14), 1.1, 1.1);
      this._beam(b, this.mat.silver, this._position(p, s, lat, top + 14), this._position(p, s, lat - sg * 49, top + 6), .1);
      this._beam(b, this.mat.silver, this._position(p, s, lat, top + 14), this._position(p, s, lat + sg * 18, top), .1);
      if (!this.mobile) for (let h = 7; h < 32; h += 8) {
        this._beam(b, this.mat.red, this._position(p, s - 11, lat - 7, base + h), this._position(p, s + 11, lat - 6, base + h + 8), .28);
        this._beam(b, this.mat.red, this._position(p, s + 11, lat - 7, base + h), this._position(p, s - 11, lat - 6, base + h + 8), .28);
      }
      for (let ds of [-11, 11]) this._beam(b, this.mat.red, this._position(p, s + ds, lat - 8, top - 6), this._position(p, s + ds, lat + 8, top - 6), 1);
      this._put(b, this.geo.box, this.mat.white, p, s, lat, top - 6, 5, 3.5, 5);
      this._beam(b, this.mat.dark, this._position(p, s, lat - sg * 35, top + 4), this._position(p, s, lat - sg * 35, base + 5), .07);
      for (let k = 0; k < 4; k++) this._put(b, this.geo.box, this.mat.white, p, s + (k - 1.5) * 15, this._edge(p, s, sg, 180), base + 2.8, 6, 5.6, 12, [0xab5143, 0xa69d76, 0x5b7d83, 0x8c988c][k]);
      this._ship(b, p, s + 31, this._edge(p, s, sg, 93), r, sg);
    }
  }
  _ship(b, p, s, lat, r, sg) {
    const base = this._seaLevel(p) - p.yAt(s);
    this._put(b, this.geo.box, this.mat.dark, p, s, lat, base + 1.1, 17, 5, 83, 0x273947);
    this._put(b, this.geo.box, this.mat.red, p, s, lat, base - .7, 17.1, 1.2, 83, 0x983c32);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) this._put(b, this.geo.box, this.mat.white, p, s - 30 + k * 10, lat + (row - 1) * 4.2, base + 5.4 + (k % 2) * 2.3, 3.9, 4.4, 9.5, [0xb8503f, 0xb6a675, 0x3d6e7f, 0xadb4a6][Math.floor(r() * 4)]);
    this._put(b, this.geo.box, this.mat.white, p, s + 33, lat, base + 8.4, 11, 13, 10);
    this._put(b, this.geo.box, this.mat.glass, p, s + 33, lat - sg * 5.6, base + 12.4, .12, 1.6, 9);
  }
  _industry(b, p, a, z, sg, r) {
    for (let s = Math.ceil(a / 30) * 30 + 12; s < z; s += 30) if (s > a && this._room(p, s, sg) > 35) {
      this._put(b, this.geo.box, this.mat.concrete, p, s, this._edge(p, s, sg, 23), 4, 24, 8, 25, 0xc3c2ae);
      for (let k = 0; k < 3; k++) this._put(b, this.geo.box, this.mat.white, p, s + (k - 1) * 7.2, this._edge(p, s, sg, 8), 1.4, 2.4, 2.8, 6.2, [0xb34c3e, 0x718d91, 0xbfa774][k]);
      if (r() < .25) { this._put(b, this.geo.pole, this.mat.concrete, p, s, this._edge(p, s, sg, 31), 17, 1.25, 34, 1.25, 0xb7b7a9); this._put(b, this.geo.pole, this.mat.red, p, s, this._edge(p, s, sg, 31), 28, 1.27, 3, 1.27); }
    }
  }
  _plaza(b, p, a, z, sg, r) {
    for (let s = Math.ceil(a / 18) * 18; s < z; s += 18) if (this._room(p, s, sg) > 12) {
      this._palm(b, p, s, this._edge(p, s, sg, 8), 1.1, r);
      this._put(b, this.geo.box, this.mat.concrete, p, s + 5, this._edge(p, s, sg, 5), .35, .75, .7, 2.5);
      this._person(b, p, s + 9, this._edge(p, s, sg, 7), r);
    }
  }
  _cut(b, p, a, z, sg, sec) {
    for (let s = a + 3; s < z; s += 6) {
      const lat = this._edge(p, s, sg, .7);
      this._put(b, this.geo.box, this.mat.concrete, p, s, lat, 3.2, .8, 6.4, 6.05, 0xa7a99e);
      this._solid(p, s, lat, .4, 3.025, 'wall');
      if ((sec.tags || []).includes('tunnel') || (sec.tags || []).includes('deck')) this._put(b, this.geo.box, this.mat.concrete, p, s, 0, 6.7, p.rightEdge(s) - p.leftEdge(s) + 1.7, .7, 6.05, 0x858e89);
      if (Math.floor(s / 6) % 3 === 0) this._put(b, this.geo.box, this.mat.white, p, s, lat - sg * .48, 4.2, .12, .2, 1.1, 0xffedb3);
    }
  }

  _landmarks(group, b, p, a, z, r) {
    for (let j = 0; j < p.secs.length; j++) {
      const sec = p.secs[j], start = p.secStartS[j], end = j + 1 < p.secStartS.length ? p.secStartS[j + 1] : p.L, tags = sec.tags || [], s = start + Math.min(100, (end - start) * .45);
      if (s < a || s >= z) continue;
      if (tags.includes('start') || tags.includes('checkpoint') || tags.includes('goal')) this._arch(b, p, start + (tags.includes('start') ? 48 : tags.includes('goal') ? Math.min(140, (end - start) * .5) : 60), tags.includes('goal') ? 'FINISH' : tags.includes('start') ? 'FORMOSA RUN' : 'CHECKPOINT');
      if (sec.diverge) continue;
      if (tags.includes('forksign') && p.def.sign) this._forkSign(b, p, start + 65, p.def.sign);
      if (tags.includes('lightrail') || tags.includes('tram')) this._elevatedRail(b, p, (start + end) / 2);
      if (p.id === 's1' && tags.includes('tower85sign') && !this.skyline) this._tower(b, p, Math.min(p.L, s + 650), -150, '85');
      if (p.id === 's5a' && tags.includes('taipei101')) this._tower(b, p, s + 100, -110, '101');
      if ((p.id === 's5h' && tags.includes('lighthouse')) || (p.id === 's5b' && tags.includes('fuguijiao'))) this._lighthouse(b, p, s, 45, tags.includes('fuguijiao'));
      if (tags.includes('sailrock') || tags.includes('frogrock') || tags.includes('catrock') || tags.includes('queenhead')) {
        const lat = this._edge(p, s + 30, 1, 55); this._rock(b, p, s + 30, lat, tags.includes('sailrock') ? 14 : 7, -4, 0xd0c9af);
        if (tags.includes('sailrock')) this._put(b, this.geo.stone, this.mat.concrete, p, s + 30, lat, 13, 7, 20, 8, 0xc8c5ae, .3);
      }
      if (tags.some(t => ['temple', 'templegate', 'bigtemple', 'wenwu', 'fuan', 'zhenlan', 'changchun', 'pagodas', 'parade_beigang'].includes(t))) this._temple(b, p, s, -36, r);
      if (tags.some(t => ['mangostall', 'mango', 'fruit', 'betelstand', 'coffee'].includes(t))) this._stall(b, p, s + 12, -1, r, tags.includes('betelstand') ? 'betel' : tags.some(t => ['mangostall', 'mango', 'fruit'].includes(t)) ? 'fruit' : 'coffee');
      if (tags.includes('windmills') || tags.includes('windmill')) for (let k = 0; k < 3; k++) this._windmill(b, p, s + k * 44, this._edge(p, s, 1, 75 + k * 25));
      if (sec.bridge) this._bridge(b, p, start, end, sec.bridge);
      this._culture(b, p, s, tags, r);
    }
  }
  _arch(b, p, s, text) {
    if (s < 0 || s > p.L) return;
    const left = p.leftEdge(s) - .2, right = p.rightEdge(s) + .2, span = right - left;
    for (const lat of [left, right]) { this._put(b, this.geo.box, this.mat.white, p, s, lat, 3.6, .28, 7.2, .28); this._solid(p, s, lat, .14, .14); }
    this._put(b, this.geo.box, this.mat.dark, p, s, (left + right) / 2, 7.15, span + .8, 1.35, .3);
    let material = this._archMaterials?.[text];
    if (!material) {
      this._archMaterials ||= {}; material = this._mat({ map: this._texture(this._canvas(1024, 128, (g, w, h) => { g.fillStyle = '#103346'; g.fillRect(0, 0, w, h); g.fillStyle = '#f5ebc5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold italic 72px Arial'; g.fillText(text, w / 2, h / 2 + 4, w - 50); g.fillStyle = '#e1b649'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7); })), roughness: .65 }); this._archMaterials[text] = material;
    }
    this._put(b, this.geo.box, material, p, s + .18, (left + right) / 2, 7.15, span, 1.1, .025);
  }
  _forkSign(b, p, s, directions) {
    const half = Math.max(9, p.hw(s) + 1.5);
    for (const sg of [-1, 1]) this._put(b, this.geo.pole, this.mat.silver, p, s, sg * half, 4.2, .14, 8.4, .14);
    this._put(b, this.geo.box, this.mat.silver, p, s, 0, 8.1, half * 2, .22, .22);
    for (const sg of [-1, 1]) {
      const lines = directions[sg < 0 ? 'L' : 'R'], key = p.id + ':' + sg;
      this._routeSignMaterials ||= {};
      let mat = this._routeSignMaterials[key];
      if (!mat) {
        mat = this._mat({ map: this._texture(this._canvas(768, 256, (g, w, h) => {
          g.fillStyle = '#185a51'; g.fillRect(0, 0, w, h); g.strokeStyle = '#edf0d9'; g.lineWidth = 5; g.strokeRect(9, 9, w - 18, h - 18);
          g.fillStyle = '#f8f4de'; g.textAlign = 'center'; g.font = 'bold 61px "Microsoft JhengHei", sans-serif'; g.fillText(lines[0], w / 2, 86, w - 50);
          g.font = '35px "Microsoft JhengHei", sans-serif'; g.fillText(lines[1] + '  ' + lines[2], w / 2, 145, w - 45);
          g.strokeStyle = '#f6f1d8'; g.lineWidth = 10; g.beginPath(); g.moveTo(w / 2, 230); g.lineTo(w / 2 + sg * 45, 183); g.moveTo(w / 2 + sg * 45, 183); g.lineTo(w / 2 + sg * 15, 185); g.moveTo(w / 2 + sg * 45, 183); g.lineTo(w / 2 + sg * 43, 213); g.stroke();
        })), roughness: .62 }); this._routeSignMaterials[key] = mat;
      }
      this._put(b, this.geo.box, mat, p, s, sg * half * .49, 7.1, half * .92, 2.3, .14);
    }
  }
  _tower(b, p, s, lat, kind) {
    if (kind === '85') {
      for (let sign of [-1, 1]) this._put(b, this.geo.box, this.mat.glass, p, s, lat + sign * 21, 79.5, 30.8, 159, 39.2, 0x6d9996);
      this._put(b, this.geo.box, this.mat.glass, p, s, lat, 168, 28, 159, 33.6, 0x72a5a0);
      this._put(b, this.geo.box, this.mat.glass, p, s, lat, 256.5, 18.2, 27, 23.8, 0x8eada1);
      for (let h = 4; h < 170; h += 3.6) {
        if (h < 59) for (const sign of [-1, 1]) this._put(b, this.geo.box, this.mat.silver, p, s + 19.75, lat + sign * 21, h * 1.5, 30.9, .3, .14, 0xadc0b3);
        else this._put(b, this.geo.box, this.mat.silver, p, s + (h < 105 ? 19.75 : 16.9), lat, h * 1.5, h < 105 ? 71.4 : 28.3, .3, .14, 0xadc0b3);
      }
      this._put(b, this.geo.pole, this.mat.silver, p, s, lat, 280.5, .42, 24, .42);
    } else {
      this._put(b, this.geo.box, this.mat.concrete, p, s, lat, 10, 40, 20, 40);
      for (let k = 0; k < 8; k++) {
        this._put(b, this.geo.box, this.mat.glass, p, s, lat, 29 + k * 18, 25 - k * .6, 17, 25 - k * .6, 0x709a8f);
        this._put(b, this.geo.box, this.mat.silver, p, s, lat, 37 + k * 18, 27 - k * .6, 1, 27 - k * .6);
      }
      this._put(b, this.geo.pole, this.mat.silver, p, s, lat, 187, .55, 35, .55);
    }
  }
  _lighthouse(b, p, s, lat, striped) {
    this._put(b, this.geo.pole, this.mat.white, p, s, lat, 8.5, 3.3, 17, 3.3);
    if (striped) for (let h = 3; h < 15; h += 4) this._put(b, this.geo.pole, this.mat.dark, p, s, lat, h, 3.32, 2, 3.32);
    this._put(b, this.geo.pole, this.mat.dark, p, s, lat, 17.8, 3.7, .5, 3.7);
    this._put(b, this.geo.pole, this.mat.glass, p, s, lat, 19.1, 2.1, 2.4, 2.1);
    this._put(b, this.geo.cone, this.mat.dark, p, s, lat, 21.1, 3, 1.9, 3);
  }
  _temple(b, p, s, lat, r) {
    this._put(b, this.geo.box, this.mat.red, p, s, lat, 3.2, 20, 6.4, 24);
    this._put(b, this.geo.box, this.mat.red, p, s, lat, 8.7, 14, 3.2, 16);
    for (let j = 0; j < 2; j++) {
      this._put(b, this.geo.roof, this.mat.roof, p, s, lat, 6.6 + j * 3.8, 12.5 - j * 3, 3.4, 14.5 - j * 3);
    }
    for (let ds of [-9, -3, 3, 9]) { this._put(b, this.geo.pole, this.mat.red, p, s + ds, lat + 10.5, 2.9, .35, 5.8, .35); this._put(b, this.geo.ball, this.mat.red, p, s + ds, lat + 11, 4.8, .55, .7, .55, 0xdb572c); }
    if (p.id === 's4f') this._put(b, this.geo.box, this._shopMaterial('北港朝天宮'), p, s, lat + 10.04, 5.3, .12, 1.1, 7.2);
  }
  _stall(b, p, s, sg, r, sign) {
    const lat = this._edge(p, s, sg, 4.6); if (this._room(p, s, sg) < 7) return;
    this._solid(p, s, lat, 1.5, 2.5, 'wall');
    this._put(b, this.geo.box, this.mat.white, p, s, lat, .8, 3, 1.6, 5, 0xd5caa6);
    this._put(b, this.geo.box, this.mat.yellow, p, s, lat, 2.8, 4.6, .2, 6, 0xdcb943);
    const text = sign === 'betel' ? '檳榔攤' : sign === 'fruit' ? (p.id === 's4h' ? '枋山芒果' : (REGIONAL_SHOPS[p.id] || []).find(t => t.includes('鮮果')) || '在地鮮果') : p.id === 's5c' ? '湖畔咖啡' : p.id === 's5n' ? '九份茶館' : ['s3m', 's3sm', 's4b', 's4g', 's5d', 's5m'].includes(p.id) ? '山城咖啡' : '海景咖啡';
    this._put(b, this.geo.box, this._shopMaterial(text), p, s, lat - sg * 1.5, 3.4, .1, .8, 5.5);
    for (let ds of [-2.5, 2.5]) this._put(b, this.geo.pole, this.mat.white, p, s + ds, lat, 1.6, .06, 3.2, .06);
    for (let j = 0; j < 8; j++) this._put(b, this.geo.ball, this.mat.yellow, p, s - 1.8 + j * .5, lat - sg * 1.5, 1.72, .2, .15, .2, 0xdaa44d);
  }
  _windmill(b, p, s, lat) {
    this._put(b, this.geo.pole, this.mat.white, p, s, lat, 22, .65, 44, .65);
    this._put(b, this.geo.box, this.mat.white, p, s, lat, 44.5, 2.2, 2.3, 3.5);
    const center = this._position(p, s + 2, lat, 44.5);
    for (let k = 0; k < 3; k++) { const an = k * Math.PI * 2 / 3 + .2, end = this._position(p, s + 2, lat + Math.sin(an) * 17, 44.5 + Math.cos(an) * 17); this._beam(b, this.mat.white, center, end, .7, .18); }
  }
  _bridge(b, p, a, z, kind) {
    const s = (a + z) / 2, half = p.hw(s) + 3;
    for (let sg of [-1, 1]) {
      for (let ss = a + 8; ss < z; ss += 12) this._put(b, this.geo.box, this.mat.concrete, p, ss, sg * half, -.5, .5, 1, 12.1);
      if (kind !== 'girder') {
        this._put(b, this.geo.box, this.mat.white, p, s, sg * half, 19, 1, 38, 1);
        for (let ds = -80; ds <= 80; ds += 16) this._beam(b, this.mat.silver, this._position(p, s, sg * half, 37), this._position(p, s + ds, sg * half, 1.2), .08);
      }
    }
    if (kind !== 'girder') this._beam(b, this.mat.white, this._position(p, s, -half, 32), this._position(p, s, half, 32), .7);
  }
  _elevatedRail(b, p, s) {
    const half = Math.max(-p.leftEdge(s), p.rightEdge(s)) + 3.6;
    this._put(b, this.geo.box, this.mat.concrete, p, s, 0, 5.08, 96, .48, 4.8);
    for (const ds of [-2.18, 2.18]) this._put(b, this.geo.box, this.mat.concrete, p, s + ds, 0, 5.72, 96, .8, .17);
    for (const ds of [-.72, .72]) this._put(b, this.geo.box, this.mat.silver, p, s + ds, 0, 5.39, 96, .1, .07);
    for (const lat of [-half, half]) {
      this._put(b, this.geo.pole, this.mat.concrete, p, s, lat, 2.5, .5, 5, .5);
      this._put(b, this.geo.box, this.mat.concrete, p, s, lat, 4.7, 2.4, .6, 4.3);
      this._solid(p, s, lat, .5, .5, 'wall');
    }
  }
  _culture(b, p, s, tags, r) {
    if (['s4a', 's5k'].includes(p.id) && tags.includes('boardwalk')) this._boardwalk(b, p, s);
    if (p.id === 's5o' && tags.includes('sanxiantai')) this._eightArchBridge(b, p, s);
    if (['s4f', 's4g'].includes(p.id) && tags.includes('redbridge')) this._redBridge(b, p, s, p.id === 's4g');
    // Shitiping's pale tuff is a low coastal terrace with eroded tide pools,
    // rather than a Taroko marble cliff. Each shelf uses the local sea datum.
    if (p.id === 's5p' && tags.includes('shitipingrocks')) {
      for (let k = 0; k < 5; k++) {
        const ss = s + (k % 2) * 8, lat = this._edge(p, ss, 1, 19 + k * 5), top = this._seaLevel(p) + .8 + (4 - k) * .35;
        this._put(b, this.geo.box, this.mat.rockTerrain || this.mat.concrete, p, ss, lat, top - p.yAt(ss) - .35, 8, .7, 25, 0xc4c6bd, k * .06);
        for (let hole = 0; hole < 2; hole++) this._put(b, this.geo.ball, this.mat.water, p, ss + hole * 7 - 3, lat + (hole ? 1.3 : -1.4), top - p.yAt(ss) + .018, 2.3, .035, 3.3, 0x5a9993);
      }
    }
    if (tags.includes('kite') || tags.includes('kites')) for (let k = 0; k < 4; k++) {
      const ss = s + k * 29, lat = this._edge(p, ss, 1, 20 + k * 9), h = 25 + k * 7;
      this._put(b, this.geo.kite, this.mat.awning, p, ss, lat, h, 1.8, 1.8, 1, [0xd36749, 0xe4bf54, 0x5c9fc2, 0xe5d4a7][k]);
      this._beam(b, this.mat.dark, this._position(p, ss, lat, h - 2), this._position(p, ss - 12, this._edge(p, ss - 12, 1, 6), 1), .015);
    }
    if (tags.some(t => ['hakka', 'hakkavillage'].includes(t))) {
      const lat = this._edge(p, s, -1, 32), brick = 0xa86b50;
      this._put(b, this.geo.box, this.mat.white, p, s, lat - 5, 3, 8, 6, 28, brick);
      this._put(b, this.geo.roof, this.mat.roof, p, s, lat - 5, 6, 4.8, 2.8, 14.8);
      for (const ds of [-11, 11]) {
        this._put(b, this.geo.box, this.mat.white, p, s + ds, lat + 4, 2.5, 17, 5, 5.5, brick);
        this._put(b, this.geo.roof, this.mat.roof, p, s + ds, lat + 4, 5, 9, 1.8, 3.2);
        for (const dd of [-3, 3]) this._put(b, this.geo.box, this.mat.dark, p, s + ds - Math.sign(ds) * 2.8, lat + dd, 2.5, 1.5, 2, .1);
      }
    }
    if (p.id === 's5a' && tags.includes('fortsandomingo')) {
      const lat = this._edge(p, s, -1, 37);
      this._put(b, this.geo.box, this.mat.white, p, s, lat, 5.5, 19, 11, 28, 0xae6045);
      for (const ds of [-11, -5.5, 0, 5.5, 11]) {
        this._put(b, this.geo.box, this.mat.white, p, s + ds, lat + 9.6, 11.6, 1.3, 1.6, 2.2, 0xa85a40);
        this._put(b, this.geo.box, this.mat.dark, p, s + ds, lat + 9.6, 5.4, .08, 2.6, 1.15);
      }
      this._put(b, this.geo.pole, this.mat.silver, p, s, lat, 16, .06, 10, .06);
      this._put(b, this.geo.box, this.mat.red, p, s + 1.7, lat, 19, .04, 1.6, 3.2);
    }
    if (tags.includes('oysters')) for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const ss = s + (col - 1.5) * 5, lat = this._edge(p, s, 1, 27 + row * 5), base = this._seaLevel(p) - p.yAt(ss);
      this._put(b, this.geo.pole, this.mat.bark, p, ss, lat, base + 1.1, .07, 2.2, .07);
      this._put(b, this.geo.box, this.mat.bark, p, ss, lat + 2.4, base + 2, 5, .1, .1);
    }
    if (tags.some(t => ['tribalgate', 'totem'].includes(t))) {
      const lat = this._edge(p, s, -1, 7);
      for (const ds of [-4, 4]) {
        this._put(b, this.geo.pole, this.mat.bark, p, s + ds, lat, 3.1, .48, 6.2, .48);
        for (let band = 0; band < 6; band++) this._put(b, this.geo.pole, this.mat.white, p, s + ds, lat, .8 + band * .8, .5, .25, .5, band % 2 ? 0xd9c7a5 : 0xa74835);
      }
      this._put(b, this.geo.box, this.mat.bark, p, s, lat, 6.1, .8, .7, 10);
    }
    if (tags.some(t => ['pingxi', 'skylantern'].includes(t))) for (let k = 0; k < 9; k++) {
      const ss = s + (r() - .5) * 140, lat = (r() - .5) * 170, h = 20 + r() * 45;
      this._put(b, this.geo.ball, this.mat.white, p, ss, lat, h, 1.2, 1.55, 1.2, [0xd3b672, 0xbd7052, 0xd8ceb1][k % 3]);
      this._put(b, this.geo.box, this.mat.dark, p, ss, lat, h - 1.25, .65, .1, .65);
    }
    if (tags.some(t => ['jiufen', 'redlanterns', 'lanterns'].includes(t))) {
      const lat = this._edge(p, s, -1, 6);
      for (let k = 0; k < 12; k++) {
        this._put(b, this.geo.ball, this.mat.red, p, s - 27 + k * 5, lat, 4.3, .48, .62, .48, 0xffe8bd);
        this._put(b, this.geo.box, this.mat.yellow, p, s - 27 + k * 5, lat, 3.6, .05, .3, .05);
      }
    }
    if (tags.some(t => ['fishvillage', 'fishboats', 'nanfangao', 'chenggong'].includes(t))) for (let k = 0; k < 3; k++) {
      const ss = s + k * 23, lat = this._edge(p, s, 1, 40 + k * 9), base = this._seaLevel(p) - p.yAt(ss);
      this._put(b, this.geo.box, this.mat.white, p, ss, lat, base + .6, 5.5, 2.3, 17, 0x588a9d);
      this._put(b, this.geo.box, this.mat.white, p, ss - 3, lat, base + 2.4, 3.8, 2.8, 5);
      this._put(b, this.geo.pole, this.mat.bark, p, ss + 2, lat, base + 5, .08, 10, .08);
    }
    if (tags.some(t => ['railway', 'jiji', 'sugarfactory'].includes(t))) {
      const lat = this._edge(p, s, -1, 22);
      this._put(b, this.geo.box, this.mat.white, p, s, lat, 2.2, 8, 4.4, 19, 0xa08b6c);
      this._put(b, this.geo.roof, this.mat.roof, p, s, lat, 4.4, 5.2, 2.2, 11.5);
      this._put(b, this.geo.box, this.mat.dark, p, s, lat + 4.1, 2.1, .08, 2.8, 10);
    }
  }
  _boardwalk(b, p, s) {
    const edge = p.rightEdge(s), base = this._seaLevel(p) + 1.25 - p.yAt(s);
    this._put(b, this.geo.box, this.mat.bark, p, s, edge + 47, base, 85, .22, 3.2, 0xb7a484);
    for (let off = 6; off < 90; off += 4) {
      this._put(b, this.geo.box, this.mat.bark, p, s, edge + off, base + .13, .11, .04, 3.2, 0xc7b58e);
      for (const ds of [-1.4, 1.4]) {
        this._put(b, this.geo.pole, this.mat.bark, p, s + ds, edge + off, base, .07, 2.5, .07);
        this._put(b, this.geo.box, this.mat.bark, p, s + ds, edge + off, base + 1, 4.1, .09, .09);
      }
    }
  }
  _eightArchBridge(b, p, s) {
    const edge = p.rightEdge(s), sea = this._seaLevel(p) - p.yAt(s);
    for (let arch = 0; arch < 8; arch++) for (let j = 0; j < 12; j++) {
      const t0 = j / 12, t1 = (j + 1) / 12, x0 = edge + 43 + arch * 20 + t0 * 20, x1 = edge + 43 + arch * 20 + t1 * 20;
      const h0 = sea + 2.6 + Math.sin(t0 * Math.PI) * 4.3, h1 = sea + 2.6 + Math.sin(t1 * Math.PI) * 4.3;
      this._beam(b, this.mat.white, this._position(p, s, x0, h0), this._position(p, s, x1, h1), .5, 3.1);
      for (const ds of [-1.3, 1.3]) this._beam(b, this.mat.white, this._position(p, s + ds, x0, h0 + 1), this._position(p, s + ds, x1, h1 + 1), .08);
    }
    for (let k = 0; k < 4; k++) this._rock(b, p, s + (k - 1.5) * 13, edge + 229 + k * 4, 12 + k * 2, sea - 2, 0xa4a38c);
  }
  _redBridge(b, p, s, ruin = false) {
    const lat = this._edge(p, s, 1, 43), spans = ruin ? 3 : 5, width = ruin ? 24 : 22, material = ruin ? this.facades[2] : this.mat.red;
    for (let k = 0; k <= spans; k++) this._put(b, this.geo.box, material, p, s + k * width, lat, 3, 4, 15, 3, ruin ? 0xb88361 : null);
    for (let k = 0; k < spans; k++) {
      if (ruin && k === 1) continue;
      if (!ruin) this._put(b, this.geo.box, this.mat.concrete, p, s + (k + .5) * width, lat, 5.1, 4.6, .5, width + .1);
      for (let j = 0; j < 10; j++) {
        const t0 = j / 10, t1 = (j + 1) / 10, ss0 = s + (k + t0) * width, ss1 = s + (k + t1) * width;
        this._beam(b, material, this._position(p, ss0, lat, (ruin ? -3 : 5.5) + Math.sin(t0 * Math.PI) * 10), this._position(p, ss1, lat, (ruin ? -3 : 5.5) + Math.sin(t1 * Math.PI) * 10), ruin ? 1.3 : .4, ruin ? 3.5 : .4);
      }
    }
  }

  _build(p, chunk) {
    const T = this.T, a = chunk * CHUNK, z = Math.min(p.L, a + CHUNK), group = new T.Group(), b = new Instances(this, group), r = random(p.seed ^ (chunk * 97483));
    this.buildColliders = [];
    group.name = `${p.id} ${a}–${z}`; this._road(group, b, p, a, z);
    for (let j = 0; j < p.secs.length; j++) {
      const s0 = Math.max(a, p.secStartS[j]), s1 = Math.min(z, j + 1 < p.secs.length ? p.secStartS[j + 1] : p.L); if (s1 <= s0) continue;
      if (p.secs[j].track) {
        for (const sg of [-1, 1]) for (const rail of [-.55, .55]) this._surface(group, p, s0, s1, [ss => sg * p.hw(ss) * .5 + rail - .04, ss => sg * p.hw(ss) * .5 + rail + .04], [() => .1, () => .1], this.mat.silver, null, 4);
        for (let ss = s0 + 1.2; ss < s1; ss += 2.4) for (const sg of [-1, 1]) this._put(b, this.geo.box, this.mat.bark, p, ss, sg * p.hw(ss) * .5, .048, 2.1, .04, .2);
      }
      this._side(group, b, p, s0, s1, p.secs[j], -1, r); this._side(group, b, p, s0, s1, p.secs[j], 1, r);
    }
    this._landmarks(group, b, p, a, z, r); this._mergeSurfaces(group); b.finish();
    const center = p.pos((a + z) / 2, 0); group.userData.center = center; group.userData.piece = p; group.userData.a = a; group.userData.z = z;
    group.userData.chunk = chunk;
    if (!this.colliderChunks.has(p)) this.colliderChunks.set(p, new Map());
    this.colliderChunks.get(p).set(chunk, this.buildColliders); this.buildColliders = null; this._refreshColliders(p);
    this.group.add(group); return group;
  }

  _id(p) { if (!this.pieceIds.has(p)) this.pieceIds.set(p, ++this.uid); return this.pieceIds.get(p); }
  _mergeSurfaces(group) {
    const T = this.T, sets = new Map();
    for (const child of [...group.children]) if (child.userData.ownedGeometry) {
      const key = child.material.uuid, arr = sets.get(key) || []; arr.push(child); sets.set(key, arr);
    }
    for (const meshes of sets.values()) {
      if (meshes.length < 2) continue;
      const pos = [], norm = [], uv = [], col = [], ix = []; let offset = 0;
      for (const mesh of meshes) {
        const g = mesh.geometry;
        pos.push(...g.attributes.position.array); norm.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
        if (g.attributes.color) col.push(...g.attributes.color.array);
        for (const i of g.index.array) ix.push(i + offset);
        offset += g.attributes.position.count; group.remove(mesh); g.dispose();
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(norm, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      if (col.length) g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(ix); g.computeBoundingSphere();
      const mesh = new T.Mesh(g, meshes[0].material); mesh.userData.ownedGeometry = true; mesh.receiveShadow = true; group.add(mesh);
    }
  }
  update(state, dt = 0) {
    const pc = state.PC; if (!pc || !pc.piece) return;
    if (state.ROUTE) for (const piece of state.ROUTE.pieces) if (!piece.hdColliders) piece.hdColliders = [];
    this.time += dt; this.waterUniforms.time.value = this.time; const p = pc.piece, s = pc.s, wanted = new Map();
    if (this.skyline) {
      const sec = p.sec(s), visible = p.id === 's1' && (sec.L === 'harbor' || sec.R === 'harbor'); this.skyline.visible = visible;
      if (visible) {
        const q = p.pos(s, 0), origin = p.pos(0, 0), heading = p.heading(0) + (p.heading(s) - p.heading(0)) * .72, distance = 2400, height = 1300, width = 2600;
        this.skyline.position.set(q.x * .8 + origin.x * .2 + Math.sin(heading) * distance + Math.cos(heading) * 35, this._seaLevel(p) + height * .33, q.z * .8 + origin.z * .2 - Math.cos(heading) * distance + Math.sin(heading) * 35);
        this.skyline.rotation.y = -heading; this.skyline.scale.set(width, height, 1);
      }
    }
    const addRange = (piece, lo, hi) => {
      if (!piece || hi < 0 || lo > piece.L) return;
      const from = Math.max(0, Math.floor(lo / CHUNK)), end = Math.min(Math.ceil(piece.L / CHUNK) - 1, Math.floor(hi / CHUNK));
      for (let c = from; c <= end; c++) wanted.set(`${this._id(piece)}:${c}`, { p: piece, c });
    };
    addRange(p, s - 300, s + this.distance);
    if (s < 500 && p.parent) addRange(p.parent, p.parent.L + s - 350, p.parent.L);
    if (p.parent && p.side && s < 600) { const sib = p.parent.children[p.side < 0 ? 1 : 0]; addRange(sib, 0, Math.min(700, s + 450)); }
    const remain = p.L - s;
    if (remain < this.distance) {
      if (p.next) addRange(p.next, 0, this.distance - remain);
      for (const child of p.children || []) addRange(child, 0, this.distance - remain);
    }
    // Build nearby chunks first; the entire selected view is available on frame one.
    const ordered = [...wanted.entries()].sort(([, a], [, b]) => Math.abs(a.p.gS + a.c * CHUNK - (p.gS + s)) - Math.abs(b.p.gS + b.c * CHUNK - (p.gS + s)));
    for (const [key, q] of ordered) {
      let g = this.chunks.get(key); if (!g) { g = this._build(q.p, q.c); this.chunks.set(key, g); } g.visible = true; g.userData.lastSeen = this.time;
    }
    for (const [key, g] of this.chunks) if (!wanted.has(key)) {
      g.visible = false;
      if (this.chunks.size > (this.mobile ? 17 : 25) || this.time - g.userData.lastSeen > 25) { this._disposeChunk(g); this.chunks.delete(key); }
    }
    this.stats.chunks = wanted.size;
  }
  _disposeChunk(group) {
    group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.userData.ownedGeometry && o.geometry) o.geometry.dispose(); });
    this.group.remove(group);
    const p = group.userData.piece, chunks = this.colliderChunks.get(p);
    if (chunks) { chunks.delete(group.userData.chunk); if (!chunks.size) this.colliderChunks.delete(p); this._refreshColliders(p); }
  }
  dispose() {
    for (const group of this.chunks.values()) this._disposeChunk(group);
    this.chunks.clear(); for (const g of this.sharedGeometry) g.dispose(); for (const m of this.sharedMaterials) m.dispose(); for (const t of this.textures) t.dispose();
    this.scene.remove(this.group);
  }
}
