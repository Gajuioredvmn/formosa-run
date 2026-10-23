import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { FormosaWorld } from './world.js';
import { FormosaCars, createTraffic, createCar } from './cars.js';
import { FormosaLens } from './lens.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const path = name => new URL('../assets/' + name, import.meta.url).href;
const status = { ready: false, active: false, frames: 0, error: '', drawCalls: 0, triangles: 0, fps: 0, width: 0, height: 0 };
const hd = window.FORMOSA_HD = { status, render: () => false, hide() { this.status.active = false; } };
const disabled = new URLSearchParams(location.search).get('renderer') === 'classic';

function hudDOM() {
  const box = document.createElement('div'); box.id = 'hd-ui'; box.hidden = true;
  box.innerHTML = `<div class="hd-place"><i></i><span></span></div>
    <div class="hd-clock"><small>TIME</small><b>95</b></div>
    <div class="hd-score"><span class="hd-elapsed"></span><span class="hd-points"></span></div>
    <div class="hd-gauges"><div class="hd-gear"><small>AT</small><b>1</b></div><strong>0</strong><em>km/h</em><div class="hd-revs"></div></div>
    <div class="hd-fork"><span></span><span></span></div>
    <div class="hd-message"><b></b><span></span></div><div class="hd-ignition"><span></span></div><div class="hd-ending" hidden><small>FORMOSA RUN</small><b></b><span>旅程完成 · 點一下繼續</span></div><div class="hd-story" hidden><p></p><small>點一下繼續 ▸</small></div>`;
  document.body.appendChild(box);
  for (let i = 0; i < 18; i++) box.querySelector('.hd-revs').appendChild(document.createElement('i'));
  return box;
}

class Renderer {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.id = 'hd'; this.canvas.setAttribute('aria-label', '衝向寶島 3D 賽車畫面');
    document.body.insertBefore(this.canvas, document.getElementById('hud'));
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.mobile = matchMedia('(pointer:coarse)').matches;
    this.dpr = Math.min(devicePixelRatio || 1, this.mobile ? 1.2 : 1.65);
    this.renderer.setPixelRatio(this.dpr); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .94;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x3ca4ed);
    this.scene.fog = new THREE.FogExp2(0xc0deeb, .00058);
    this.camera = new THREE.PerspectiveCamera(53, 1, .12, 3600);
    this.lens = new FormosaLens(THREE, this.renderer, this.camera, { mobile: this.mobile });
    this.chase = { back: 5.55, height: 1.43, ahead: 20, lookHeight: 1.1 };
    const hemi = new THREE.HemisphereLight(0x9bc8ff, 0x595669, .48); this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffdfa3, 4.5); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -92, right: 92, top: 92, bottom: -92, near: 2, far: 390 });
    this.sun.shadow.bias = -.00010; this.sun.shadow.normalBias = .018; this.sun.shadow.radius = 1.4;
    this.scene.add(this.sun, this.sun.target);
    const pm = new THREE.PMREMGenerator(this.renderer), room = new RoomEnvironment();
    this.env = pm.fromScene(room, .04); this.scene.environment = this.env.texture; this.scene.environmentIntensity = .16;
    room.dispose(); pm.dispose();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2900, 48, 24), new THREE.MeshBasicMaterial({ color: 0x98d9ff, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -100; this.scene.add(this.sky);
    new THREE.TextureLoader().load(path('sky-clouds.png'), t => { t.colorSpace = THREE.SRGBColorSpace; this.scene.background = t; this.sky.visible = false; });
    this.ui = hudDOM(); this.last = performance.now(); this.lastPiece = null; this.lastS = -999; this.lagX = 0; this.fpsTime = 0; this.fpsFrames = 0;
    this.hazards = new Map(); this.trams = new Map(); this.rivals = new Map(); this.showroom = null;
    this.point = { x: 0, y: 0, z: 0 }; this.eye = new THREE.Vector3(); this.aim = new THREE.Vector3();
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); status.error = 'WebGL context lost'; status.ready = false; this.hide(); });
    addEventListener('resize', () => this.resize()); this.resize();
    Object.assign(hd, { renderer: this.renderer, canvas: this.canvas, camera: this.camera, scene: this.scene, instance: this });
    hd.render = (s, t) => this.render(s, t); hd.renderEnding = (s, dt) => this.renderEnding(s, dt); hd.hide = () => this.hide();
    status.ready = true;
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false); this.camera.aspect = innerWidth / Math.max(1, innerHeight); this.camera.updateProjectionMatrix();
    if (this.lens) this.lens.resize(innerWidth, innerHeight);
    status.width = this.canvas.width; status.height = this.canvas.height;
  }
  init(s) {
    this.world = new FormosaWorld(THREE, this.scene, {
      asphalt: path('asphalt-painted-v2.png'), forest: path('forest.png'), rock: path('rock.png'), sand: path('sand.png'), palmTree: path('palm-tree.png'), broadleafTree: path('broadleaf-tree.png'),
      skylinePainted: path('kaohsiung-skyline-photo.png'), facadesPainted: path('kaohsiung-facades-painted.png'),
      portPainted: path('kaohsiung-port-painted.png'),
    }, this.mobile || s.SET.quality === 'low' ? 'low' : 'high');
    this.world.distance = this.mobile ? 680 : 1120;
    this.cars = new FormosaCars(THREE, this.scene, { CARS: s.CARS, CREW: s.CREW, shadows: true });
    hd.world = this.world; hd.cars = this.cars;
    this.shadow = this.contactShadow(); this.scene.add(this.shadow);
  }
  contactShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 3, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.62)'); r.addColorStop(.6, 'rgba(0,0,0,.28)'); r.addColorStop(1, 'transparent'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 5.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.x = -Math.PI / 2; return m;
  }
  hide() { this.canvas.hidden = true; this.ui.hidden = true; status.active = false; }
  render(s, tod) {
    if (!status.ready || !s?.PC?.piece || s.G.mode === 'ending') { this.hide(); return false; }
    try {
      if (!this.world) this.init(s);
      const now = performance.now(), dt = s.G.paused ? 0 : clamp((now - this.last) / 1000, 0, .05); this.last = now;
      this.canvas.hidden = false; status.active = true; document.body.classList.add('hd-ready');
      this.world.update(s, dt); this.cars.update(s, dt); this.updateHazards(s, dt); this.updateRivals(s, dt);
      const pc = s.PC, p = pc.piece, pos = p.pos(pc.s, pc.x, this.point);
      const jump = this.lastPiece !== p || Math.abs(pc.s - this.lastS) > 100;
      this.lagX = jump ? pc.x : THREE.MathUtils.lerp(this.lagX, pc.x, 1 - Math.exp(-dt * 10));
      const cameraPos = p.pos(Math.max(0, pc.s - this.chase.back), this.lagX, {}), target = p.pos(Math.min(p.L, pc.s + this.chase.ahead), pc.x * .72, {});
      this.eye.set(cameraPos.x, cameraPos.y + this.chase.height, cameraPos.z); this.aim.set(target.x, target.y + this.chase.lookHeight, target.z);
      if (s.RACE.state === 'ignition') {
        const h = p.heading(pc.s), t = clamp((s.IGN.t - 2.5) / .8, 0, 1);
        const cockpit = new THREE.Vector3(pos.x - Math.cos(h) * .43, pos.y + 1.12, pos.z - Math.sin(h) * .43);
        this.eye.lerpVectors(cockpit, this.eye, t * t * (3 - 2 * t)); this.cars.player.visible = t > .42;
      }
      // Follow forward travel at the fixed chase distance. Smoothing absolute
      // world position lets speed add several metres of lag and shrinks the car.
      // The existing road-relative lagX still smooths lateral steering.
      this.camera.position.copy(this.eye); this.started = true;
      this.camera.lookAt(this.aim); this.camera.rotation.z += clamp(-(pc.roll || 0) * .14, -.015, .015);
      this.sky.position.copy(this.camera.position);
      // Move the shadow volume with the car, keeping sunlight fixed in world
      // direction so a bend does not make shadows rotate with the steering.
      this.sun.position.set(pos.x - 88, pos.y + 94, pos.z + 66); this.sun.target.position.set(pos.x, pos.y, pos.z - 38);
      this.shadow.position.set(pos.x, pos.y + .035, pos.z); this.shadow.rotation.z = -p.heading(pc.s); this.shadow.material.opacity = 1 / (1 + (pc.airY || 0));
      this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, innerWidth, innerHeight);
      this.lens.render(this.scene, this.camera, { speed: pc.v, enabled: true, quality: s.SET.quality }); this.updateShowroom(s, now / 1000); this.updateHUD(s);
      this.lastPiece = p; this.lastS = pc.s; status.frames++; status.drawCalls = this.renderer.info.render.calls; status.triangles = this.renderer.info.render.triangles;
      this.fpsTime += dt; this.fpsFrames++; if (this.fpsTime >= .6) { status.fps = Math.round(this.fpsFrames / this.fpsTime); this.fpsFrames = 0; this.fpsTime = 0; }
      return true;
    } catch (e) { status.error = String(e.stack || e); status.ready = false; console.error('Formosa 3D renderer:', e); this.hide(); return false; }
  }
  updateShowroom(s, time) {
    // The selection screen uses the same full-detail models as the road.
    if (s.UI.scr !== 'select') { if (this.showroom) this.showroom.visible = false; return; }
    const turn = document.getElementById('turn'); if (!turn) return;
    turn.style.opacity = '0';
    if (!this.showScene) {
      this.showScene = new THREE.Scene(); this.showScene.background = new THREE.Color(0x10283c); this.showScene.environment = this.scene.environment;
      this.showScene.environmentIntensity = .65;
      this.showCamera = new THREE.PerspectiveCamera(35, 1, .1, 40); this.showCamera.position.set(4.6, 2.5, 6.7); this.showCamera.lookAt(0, .7, 0);
      this.showScene.add(new THREE.HemisphereLight(0xd9efff, 0x4d575b, 2.1)); const light = new THREE.DirectionalLight(0xffefcf, 3); light.position.set(-4, 8, 4); this.showScene.add(light);
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.6, .1, 64), new THREE.MeshStandardMaterial({ color: 0x344954, metalness: .42, roughness: .29 })); floor.position.y = -.1; this.showScene.add(floor);
    }
    if (!this.showroom || this.showroom.userData.spec !== s.CARS[s.UI.sel].id) {
      if (this.showroom) this.showScene.remove(this.showroom);
      this.showroom = createCar(THREE, s.CARS[s.UI.sel], s.CREW[s.CARS[s.UI.sel].id], { shadows: true }); this.showroom.userData.spec = s.CARS[s.UI.sel].id; this.showScene.add(this.showroom);
    }
    this.showroom.visible = true; this.showroom.rotation.y = time * .3;
    const r = turn.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    this.showCamera.aspect = r.width / r.height; this.showCamera.updateProjectionMatrix();
    this.renderer.setScissorTest(true); this.renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height); this.renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height);
    this.renderer.clearDepth(); this.renderer.render(this.showScene, this.showCamera);
    this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, innerWidth, innerHeight);
  }
  renderEnding(s, dt) {
    if (!status.ready || !this.world) return false;
    const pc = s.PC, p = pc.piece, q = p.pos(pc.s, pc.x, {}), h = p.heading(pc.s);
    this.canvas.hidden = false; status.active = true; this.ui.hidden = false;
    this.endingTime = (this.endingTime || 0) + dt;
    this.world.update(s, 0); this.cars.update(s, 0); this.cars.player.visible = true;
    const a = h + .32 + Math.sin(this.endingTime * .13) * .28;
    this.camera.position.set(q.x - Math.sin(a) * 5.8, q.y + 2.45, q.z + Math.cos(a) * 5.8); this.camera.lookAt(q.x, q.y + .7, q.z);
    this.ui.querySelectorAll(':scope > div').forEach(d => { d.hidden = !d.classList.contains('hd-ending') && !d.classList.contains('hd-story'); });
    const end = s.END, lines = s.ENDINGS[end.car.id][end.goal];
    this.ui.querySelector('.hd-ending b').textContent = end.done ? 'THE END' : s.STAGES[end.goal].goal;
    this.ui.querySelector('.hd-ending span').textContent = end.done ? end.car.name + ' · 旅程完成' : '旅程完成 · 點一下繼續';
    const story = this.ui.querySelector('.hd-story'); story.hidden = end.t <= 2.2;
    story.querySelector('p').textContent = lines.slice(0, end.line + 1).map((line, i) => i < end.line ? line : [...line].slice(0, Math.floor(end.chars)).join('')).join('\n');
    this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, innerWidth, innerHeight); this.renderer.render(this.scene, this.camera); status.frames++;
    return true;
  }
  updateHazards(s, dt) {
    const active = new Set(), pc = s.PC;
    for (const h of s.HAZ.list) {
      if (h.p !== pc.piece || h.s < pc.s - 30 || h.s > pc.s + 430 || h.smoke) continue;
      active.add(h); let model = this.hazards.get(h);
      if (!model) {
        model = h.scoot || h.rider ? createTraffic(THREE, 'scooter', h.kind || 0) : this.person(h.parade ? 0xf4cc4b : [0xeee9de, 0x487cba, 0xd15d47][h.kind % 3]);
        if (h.parade && /kingboat|palanquin|drumcart/.test(h.spr || '')) model = this.procession(h.spr);
        this.scene.add(model); this.hazards.set(h, model);
      }
      const q = h.p.pos(h.s, h.x, {}); model.position.set(q.x, q.y + (h.y || 0), q.z); model.rotation.y = -h.p.heading(h.s) + (h.dir ? Math.PI / 2 * h.dir : 0); model.visible = true;
      if (h.hit) model.rotation.z = h.hit * 4;
    }
    for (const [h, m] of this.hazards) if (!active.has(h)) { this.scene.remove(m); this.hazards.delete(h); }
    for (const x of s.HAZ.xings || []) {
      if (x.p !== pc.piece || x.s < pc.s - 90 || x.s > pc.s + 650) continue;
      let group = this.trams.get(x);
      if (!group) {
        group = new THREE.Group(); group.name = '高架輕軌';
        const concrete = new THREE.MeshStandardMaterial({ color: 0xb2b5ae, roughness: .88 });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(54, .52, 4.3), concrete); deck.position.y = 4.8; deck.receiveShadow = true; group.add(deck);
        for (const side of [-1, 1]) { const col = new THREE.Mesh(new THREE.BoxGeometry(.8, 5, 1.15), concrete); col.position.set(side * 15, 2.3, 0); group.add(col); }
        const tram = createTraffic(THREE, 'bus', 0); tram.rotation.y = Math.PI / 2; tram.position.y = 5.12; group.add(tram); group.userData.tram = tram;
        const q = x.p.pos(x.s, 0, {}); group.position.set(q.x, q.y, q.z); group.rotation.y = -x.p.heading(x.s); this.scene.add(group); this.trams.set(x, group);
      }
      group.userData.tram.position.x = Number.isFinite(x.x) && x.x > -200 ? x.x : -18; group.userData.tram.visible = !!x.on;
    }
    for (const [x, m] of this.trams) if (x.p !== pc.piece || x.s < pc.s - 90 || x.s > pc.s + 650) { this.scene.remove(m); this.trams.delete(x); }
  }
  person(color) {
    const g = new THREE.Group(), cloth = new THREE.MeshStandardMaterial({ color, roughness: .9 }), skin = new THREE.MeshStandardMaterial({ color: 0xc99572, roughness: .8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .43, 4, 8), cloth); body.position.y = .96; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), skin); head.scale.y = 1.24; head.position.y = 1.51; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.134, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x251e1a })); hair.position.y = 1.57; g.add(hair);
    for (const side of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.067, .51, 3, 6), new THREE.MeshStandardMaterial({ color: 0x25354a })); leg.position.set(side * .09, .34, 0); g.add(leg); }
    return g;
  }
  procession(kind) {
    const g = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: 0x9f201a, metalness: .15, roughness: .58 }), gold = new THREE.MeshStandardMaterial({ color: 0xd4a32b, metalness: .65, roughness: .4 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.45, 2.8), red); b.position.y = 1.35; g.add(b);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, .9, 4), gold); roof.rotation.y = Math.PI / 4; roof.position.y = 2.55; g.add(roof);
    for (const z of [-1.4, 1.4]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 3.5, 6), gold); pole.rotation.z = Math.PI / 2; pole.position.set(0, .8, z); g.add(pole); }
    return g;
  }
  updateRivals(s, dt) {
    const active = new Set(), entries = [];
    if (s.GHOST?.on && s.GHOST.p) entries.push({ key: s.GHOST, p: s.GHOST.p, at: s.GHOST.s, x: s.GHOST.x, spec: s.GHOST.car, ghost: true });
    for (const q of s.NET?.peers?.values?.() || []) if (q.vis && q.dp) entries.push({ key: q, p: q.dp, at: q.ds, x: q.dx, spec: s.CARS[q.car] || s.CARS[0], ghost: false });
    for (const q of entries) {
      if (q.p !== s.PC.piece || Math.abs(q.at - s.PC.s) > 550) continue;
      active.add(q.key); let model = this.rivals.get(q.key);
      if (!model) { model = createCar(THREE, q.spec || s.CARS[0], s.CREW[q.spec?.id || 'rosso']); this.scene.add(model); this.rivals.set(q.key, model); if (q.ghost) model.traverse(m => { if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; mat.opacity = .42; mat.depthWrite = false; } }); }
      const p = q.p.pos(q.at, q.x, {}); model.position.set(p.x, p.y, p.z); model.rotation.y = -q.p.heading(q.at);
    }
    for (const [key, m] of this.rivals) if (!active.has(key)) { this.scene.remove(m); this.rivals.delete(key); }
  }
  updateHUD(s) {
    this.endingTime = 0;
    this.ui.querySelectorAll(':scope > div').forEach(d => { d.hidden = false; });
    this.ui.querySelector('.hd-ending').hidden = true;
    this.ui.querySelector('.hd-story').hidden = true;
    const show = s.HUD.show && !s.UI.scr && s.G.mode === 'play'; this.ui.hidden = !show;
    if (!show) return;
    const pc = s.PC, r = s.RACE, $ = q => this.ui.querySelector(q);
    $('.hd-place span').textContent = pc.piece.def.label;
    $('.hd-clock b').textContent = String(Math.ceil(Math.max(0, r.time))); $('.hd-clock').classList.toggle('urgent', r.time < 10);
    const minutes = Math.floor(r.elapsed / 60), seconds = (r.elapsed % 60).toFixed(2).padStart(5, '0'); $('.hd-elapsed').textContent = `${minutes}′${seconds}″`; $('.hd-points').textContent = `${Math.floor(r.score).toLocaleString()} PTS`;
    $('.hd-gauges strong').textContent = Math.round(pc.v * 3.6); $('.hd-gear b').textContent = pc.neutral ? 'N' : pc.gear; $('.hd-gear small').textContent = pc.auto ? 'AT' : 'MT';
    const rpm = pc.rpm / pc.redline; $('.hd-revs').childNodes.forEach((n, i) => n.classList.toggle('lit', i / 18 < rpm));
    const gauges = $('.hd-gauges'), pads = s.CTL.pads;
    if (pads.gas) { gauges.style.bottom = `${innerHeight - Math.min(pads.gas.y, pads.brake.y) + 12}px`; gauges.style.right = `${!pc.auto && !pc.seq ? innerWidth - pads.box.x + 12 : 22}px`; }
    else { gauges.style.bottom = '5.2%'; gauges.style.right = '3.2%'; }
    const fork = s.HUD.fork; $('.hd-fork').hidden = !fork; if (fork) { $('.hd-fork span:first-child').textContent = '◀ ' + fork.L; $('.hd-fork span:last-child').textContent = fork.R + ' ▶'; }
    const msg = s.HUD.msgs.find(m => m.t > .06 && m.t < m.dur - .15); $('.hd-message').hidden = !msg; if (msg) { $('.hd-message b').textContent = msg.text; $('.hd-message span').textContent = msg.sub || ''; }
    const ignition = r.state === 'ignition'; $('.hd-ignition').hidden = !ignition; if (ignition) $('.hd-ignition span').textContent = s.IGN.caught ? '引擎就緒 · 準備出發' : '轉動鑰匙 · 啟動引擎';
    if (r.state === 'countdown') { $('.hd-message').hidden = false; $('.hd-message b').textContent = r.countdown > .1 ? String(Math.ceil(r.countdown)) : 'GO!'; $('.hd-message span').textContent = '準備出發'; }
  }
}

if (!disabled) {
  try { new Renderer(); }
  catch (e) { status.error = String(e.message || e); status.ready = false; console.warn('3D unavailable, using the classic renderer:', e.message); }
}
