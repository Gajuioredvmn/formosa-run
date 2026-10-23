/* FORMOSA RUN — metre-scale, original car designs. Forward is local -Z.
 * Geometry follows the original car specification curves; this module never
 * changes vehicle physics, traffic positions, or collision clearances.
 */
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const fallbackCrew = [
  { hair: 0x211713, shirt: 0xf4f0df, style: 'short', glasses: true },
  { hair: 0x402818, shirt: 0xd2262c, style: 'long', skin: 0xdca67f },
];
const VEHICLES = {
  sedan: { L: 4.5, W: 1.8, H: 1.43, color: 0xdce3e7 },
  taxi: { L: 4.6, W: 1.8, H: 1.47, color: 0xf8bd0b },
  pickup: { L: 5, W: 1.9, H: 1.8, color: 0xa9b6b7 },
  bluetruck: { L: 4.8, W: 1.7, H: 1.95, color: 0x1763a6 },
  bus: { L: 11.5, W: 2.5, H: 3.35, color: 0xe9eee9 },
  gravel: { L: 8, W: 2.5, H: 3.3, color: 0xcdbb9c },
  suv: { L: 4.8, W: 1.9, H: 1.9, color: 0x3a535e },
  wagon: { L: 4.7, W: 1.8, H: 1.55, color: 0x8d262c },
  rebar: { L: 17, W: 2.5, H: 3.25, color: 0x2f675f },
  logs: { L: 16, W: 2.5, H: 3.2, color: 0xa4a28a },
  scooter: { L: 1.9, W: 0.8, H: 1.25, color: 0xd8e4e7 },
  train: { L: 23, W: 3.1, H: 3.8, color: 0xe38a3b },
};

function paint(T, color, options = {}) {
  return new T.MeshPhysicalMaterial({ color, metalness: 0.48, roughness: 0.23,
    clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.25, ...options });
}
function matte(T, color, roughness = 0.7, options = {}) {
  return new T.MeshStandardMaterial({ color, roughness, ...options });
}
function mesh(T, parent, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new T.Mesh(geometry, material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function box(T, parent, mat, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  return mesh(T, parent, new T.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
}
function ellipsoid(T, parent, mat, x, y, z, sx, sy, sz, detail = 16) {
  const m = mesh(T, parent, new T.SphereGeometry(1, detail, Math.max(8, detail >> 1)), mat, x, y, z);
  m.scale.set(sx, sy, sz); return m;
}
function tubeBetween(T, parent, mat, a, b, radius, segments = 10) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b), delta = B.clone().sub(A);
  const m = mesh(T, parent, new T.CylinderGeometry(radius, radius, delta.length(), segments), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return m;
}
function strip(T, parent, mat, points) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
  return mesh(T, parent, geo, mat);
}

// A few merged meshes keep detailed trim economical. Animated wheel/head groups
// remain separate. All inputs are local to the passed group.
function mergeStatic(T, group) {
  const buckets = new Map();
  for (const m of [...group.children]) {
    if (!m.isMesh || Array.isArray(m.material) || m.userData.keepSeparate) continue;
    m.updateMatrix();
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    let b = buckets.get(m.material); if (!b) buckets.set(m.material, b = []);
    b.push(g); group.remove(m); m.geometry.dispose();
  }
  let materialIndex = 0;
  for (const [material, geometries] of buckets) {
    const names = ['position', 'normal', 'uv']; const merged = new T.BufferGeometry();
    for (const name of names) {
      const first = geometries.find(g => g.getAttribute(name))?.getAttribute(name);
      if (!first) continue;
      const count = geometries.reduce((n, g) => n + g.getAttribute('position').count, 0);
      const data = new Float32Array(count * first.itemSize); let offset = 0;
      for (const g of geometries) {
        const a = g.getAttribute(name);
        if (a) data.set(a.array, offset);
        offset += g.getAttribute('position').count * first.itemSize;
      }
      merged.setAttribute(name, new T.BufferAttribute(data, first.itemSize));
    }
    geometries.forEach(g => g.dispose());
    merged.computeBoundingSphere();
    const combined = mesh(T, group, merged, material);
    combined.name = material.name || `surface_${materialIndex}`;
    materialIndex++;
  }
}

function label(T, text, bg = '#0a1218', fg = '#edf5ee', width = 256, height = 64) {
  if (typeof document === 'undefined') return matte(T, bg);
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, width - 6, height - 6);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${height * 0.61}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
  ctx.fillText(text, width / 2, height * 0.54, width - 20);
  const texture = new T.CanvasTexture(c); texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return new T.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.12 });
}

function wheel(T, parent, x, y, z, radius, width, rimStyle, materials, detailed = true, front = false) {
  const steer = new T.Group(), spin = new T.Group(); steer.position.set(x, y, z);
  steer.add(spin); parent.add(steer);
  // Cylinder axes are X; spin rotates around the axle, steering around Y.
  const { rubber, metal, rim, darkMetal, caliper } = materials;
  const tire = mesh(T, spin, new T.CylinderGeometry(radius, radius, width, detailed ? 32 : 12, 1), rubber, 0, 0, 0, 0, 0, Math.PI / 2);
  if (detailed) {
    for (const side of [-1, 1]) {
      const face = side * (width / 2 + 0.006);
      mesh(T, spin, new T.TorusGeometry(radius * 0.77, radius * 0.16, 8, 32), rubber, face, 0, 0, 0, Math.PI / 2, 0);
      mesh(T, spin, new T.CylinderGeometry(radius * 0.69, radius * 0.69, 0.018, 28), darkMetal, face * 0.92, 0, 0, 0, 0, Math.PI / 2);
      mesh(T, spin, new T.TorusGeometry(radius * 0.7, 0.018, 5, 28), metal, face, 0, 0, 0, Math.PI / 2, 0);
      const n = rimStyle === 'wire' ? 22 : rimStyle === 'mesh' ? 10 : 5;
      if (rimStyle === 'disc') {
        mesh(T, spin, new T.CylinderGeometry(radius * 0.64, radius * 0.64, 0.023, 28), rim, face, 0, 0, 0, 0, Math.PI / 2);
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * TAU;
          mesh(T, spin, new T.CylinderGeometry(0.033, 0.033, 0.029, 8), darkMetal, face + side * 0.02, Math.cos(a) * radius * 0.43, Math.sin(a) * radius * 0.43, 0, 0, Math.PI / 2);
        }
      } else {
        for (let k = 0; k < n; k++) {
          const a = k / n * TAU;
          tubeBetween(T, spin, rim, [face, Math.cos(a) * radius * 0.13, Math.sin(a) * radius * 0.13],
            [face, Math.cos(a + (rimStyle === 'wire' ? 0.42 : 0.1)) * radius * 0.66, Math.sin(a + (rimStyle === 'wire' ? 0.42 : 0.1)) * radius * 0.66], rimStyle === 'wire' ? 0.006 : 0.025, 5);
        }
      }
      mesh(T, spin, new T.CylinderGeometry(radius * 0.16, radius * 0.16, 0.034, 14), metal, face + side * 0.01, 0, 0, 0, 0, Math.PI / 2);
      // Letter-free sidewall embossing and tread grooves catch sunlight.
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * TAU;
        box(T, spin, darkMetal, width * 0.8, 0.008, 0.012, 0, Math.cos(a) * (radius + 0.001), Math.sin(a) * radius, a, 0, 0);
      }
    }
    box(T, steer, caliper, 0.08, radius * 0.65, 0.12, x > 0 ? -0.04 : 0.04, 0.01, -radius * 0.42);
  } else {
    for (const side of [-1, 1]) mesh(T, spin, new T.CylinderGeometry(radius * 0.6, radius * 0.6, 0.018, 10), rim, side * (width / 2 + 0.005), 0, 0, 0, 0, Math.PI / 2);
  }
  mergeStatic(T, spin); steer.userData.spin = spin; steer.userData.front = front; steer.userData.radius = radius;
  return steer;
}

function torsoGeometry(T) {
  const rings = [[-.39, .115, .075], [-.26, .135, .08], [-.1, .16, .095], [.005, .183, .081], [.055, .075, .06]];
  const positions = [], indices = [], n = 12;
  rings.forEach(([y, rx, rz], i) => {
    for (let j = 0; j < n; j++) { const a = j / n * TAU; positions.push(Math.sin(a) * rx, y, Math.cos(a) * rz); }
    if (i) for (let j = 0; j < n; j++) {
      const a = (i - 1) * n + j, b = (i - 1) * n + (j + 1) % n;
      indices.push(a, b, a + n, b, b + n, a + n);
    }
  });
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function hairGeometry(T, style) {
  const shape = style === 'long' ? [[.09, .045, .10], [-.015, .10, .09], [-.14, .11, .09], [-.27, .085, .08]]
    : [[.10, .075, .085], [.02, .102, .085], [-.09, .10, .07], [-.125, .085, .065]];
  const positions = [], indices = [], n = 16;
  shape.forEach(([y, width, centerZ], i) => {
    for (let j = 0; j < n; j++) { const a = j / n * TAU; positions.push(Math.sin(a) * width, y, centerZ + Math.cos(a) * .041); }
    if (i) for (let j = 0; j < n; j++) {
      const a = (i - 1) * n + j, b = (i - 1) * n + (j + 1) % n;
      indices.push(a, a + n, b, b, a + n, b + n);
    }
  });
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function limb(T, group, mat, radius) {
  const m = mesh(T, group, new T.CylinderGeometry(radius * .85, radius, 1, 10), mat);
  return m;
}
function positionLimb(T, m, a, b) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A);
  m.position.copy(A).add(B).multiplyScalar(.5); m.scale.y = d.length();
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
}
function passenger(T, parent, look, x, y, z, index, materials, pose = {}) {
  const person = new T.Group(); parent.add(person); person.position.set(x, y, z);
  const role = index === 0 ? 'driver' : 'passenger'; person.name = role;
  const head = new T.Group(); person.add(head); head.position.y = .22; head.name = `${role}_head`;
  const skin = matte(T, look.skin || 0xd3a07c, .73);
  const hair = matte(T, look.hair == null ? 0x261b14 : look.hair, .92);
  const shirt = matte(T, look.shirt == null ? 0xf2e8d4 : look.shirt, .94);
  const arms = [], old = look.style === 'old' || /阿嬤|伯伯/.test(look.name || '');
  if (look.dog) {
    const fur = matte(T, 0xc39a68, .96), chest = matte(T, 0xe3c49b, .96);
    ellipsoid(T, person, fur, 0, -.16, .02, .13, .23, .20, 20);
    ellipsoid(T, person, chest, 0, -.12, -.12, .105, .14, .055, 16);
    ellipsoid(T, head, fur, 0, -.04, -.025, .105, .11, .13, 20);
    ellipsoid(T, head, chest, 0, -.075, -.13, .075, .052, .095, 16);
    ellipsoid(T, head, materials.black, 0, -.055, -.22, .025, .018, .017, 12);
    for (const sg of [-1, 1]) {
      ellipsoid(T, head, hair, sg * .095, -.06, .015, .045, .135, .056, 16);
      ellipsoid(T, head, materials.black, sg * .051, -.011, -.124, .011, .013, .007, 12);
      ellipsoid(T, person, fur, sg * .075, -.31, -.13, .038, .07, .09, 12);
    }
    tubeBetween(T, person, matte(T, 0x993d30), [-.105, -.03, -.04], [.105, -.03, -.04], .018);
  } else {
    mesh(T, person, torsoGeometry(T), shirt);
    mesh(T, person, new T.CylinderGeometry(.039, .046, .09, 14), skin, 0, .085, .005);
    const headGeo = new T.SphereGeometry(1, 24, 18), hp = headGeo.getAttribute('position');
    for (let i = 0; i < hp.count; i++) {
      const hy = hp.getY(i), hx = hp.getX(i), hz = hp.getZ(i);
      const jaw = hy < -.15 ? mix(.77, 1, (hy + 1) / .85) : 1;
      hp.setXYZ(i, hx * .083 * jaw, hy * .116, Math.max(-.081, hz * .088));
    }
    headGeo.computeVertexNormals(); mesh(T, head, headGeo, skin);
    ellipsoid(T, head, skin, 0, -.005, -.086, .017, .024, .024, 12); // nose bridge
    ellipsoid(T, head, skin, 0, -.064, -.052, .045, .026, .036, 16); // chin / jaw
    const eyeWhite = matte(T, 0xd8d2c3, .88), eyeDark = matte(T, 0x252722, .58);
    for (const sg of [-1, 1]) {
      ellipsoid(T, head, skin, sg * .084, -.003, .002, .016, .029, .019, 14);
      ellipsoid(T, head, matte(T, 0xa56e53, .8), sg * .089, -.006, -.011, .005, .015, .005, 10);
      ellipsoid(T, head, eyeWhite, sg * .034, .022, -.079, .017, .007, .006, 12);
      ellipsoid(T, head, eyeDark, sg * .034, .022, -.085, .006, .006, .003, 10);
      tubeBetween(T, head, hair, [sg * .021, .043, -.078], [sg * .049, .041, -.071], .0035, 5);
      if (old) {
        tubeBetween(T, head, matte(T, 0xab8066), [sg * .047, .012, -.078], [sg * .064, .004, -.064], .0015, 4);
        tubeBetween(T, head, matte(T, 0xab8066), [sg * .018, -.035, -.081], [sg * .032, -.052, -.069], .0015, 4);
      }
    }
    tubeBetween(T, head, matte(T, 0x9d6656, .9), [-.022, -.045, -.078], [.022, -.045, -.078], .0028, 7);
    const scalp = mesh(T, head, new T.SphereGeometry(1, 24, 14, 0, TAU, 0, old ? 1.65 : 2.02), hair, 0, .012, .011);
    scalp.scale.set(.087, .113, .094);
    if (look.style === 'long' || look.style === 'bob') mesh(T, head, hairGeometry(T, look.style), hair);
    if (look.style === 'pony') {
      const points = [new T.Vector3(0, .036, .094), new T.Vector3(.015, -.04, .145), new T.Vector3(.024, -.17, .16), new T.Vector3(.015, -.25, .19)];
      mesh(T, head, new T.TubeGeometry(new T.CatmullRomCurve3(points), 14, .032, 8, false), hair);
      mesh(T, head, new T.TorusGeometry(.034, .008, 5, 12), matte(T, 0x9c333b), 0, -.005, .12, Math.PI / 2);
    }
    if (look.style === 'long' || look.style === 'bob' || look.style === 'pony') {
      const shine = matte(T, new T.Color(look.hair || 0x261b14).lerp(new T.Color(0x6c5338), .19), .9);
      for (let k = 0; k < 9; k++) {
        const sx = (k - 4) * .017;
        tubeBetween(T, head, shine, [sx * .7, .074, .089], [sx, -.08, .129], .0016, 4);
      }
    }
    if (look.style === 'cap') {
      const cap = matte(T, look.capCol || 0x134b8c, .92);
      const c = mesh(T, head, new T.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2), cap, 0, .055, .005);
      c.scale.set(.092, .076, .096);
      ellipsoid(T, head, cap, 0, .062, -.095, .085, .009, .061, 16);
    }
    if (look.glasses) {
      const lens = matte(T, 0x17252a, .18, { metalness: .48 });
      for (const sg of [-1, 1]) {
        ellipsoid(T, head, lens, sg * .036, .023, -.086, .027, .016, .009, 16);
        tubeBetween(T, head, materials.darkMetal, [sg * .062, .03, -.08], [sg * .086, .027, .015], .0034, 5);
      }
      tubeBetween(T, head, materials.darkMetal, [-.012, .025, -.09], [.012, .025, -.09], .0025, 5);
    }
    const pants = matte(T, look.veil ? 0xf6efe3 : 0x263039, .96);
    for (const sg of [-1, 1]) tubeBetween(T, person, pants, [sg * .08, -.35, .02], [sg * .085, -.44, -.25], .075, 12);
    for (const sg of [-1, 1]) {
      const armGroup = new T.Group(); armGroup.name = `${role}_arm_${sg < 0 ? 'left' : 'right'}`; person.add(armGroup);
      const shoulder = [sg * .163, -.012, .002];
      const target = index === 0 && pose.wheelZ != null ? [sg * (pose.handSpan || .13), pose.wheelY + .015, pose.wheelZ]
        : [sg * .12, -.34, -.19];
      const elbow = [sg * .205, -.185, mix(0, target[2], .48)];
      const upper = limb(T, armGroup, shirt, .047), lower = limb(T, armGroup, skin, .031);
      upper.name = `${role}_upperarm_${sg < 0 ? 'left' : 'right'}`;
      lower.name = `${role}_forearm_${sg < 0 ? 'left' : 'right'}`;
      positionLimb(T, upper, shoulder, elbow); positionLimb(T, lower, elbow, target);
      const hand = new T.Group(); armGroup.add(hand); hand.position.set(...target);
      hand.name = `${role}_hand_${sg < 0 ? 'left' : 'right'}`;
      ellipsoid(T, hand, skin, 0, 0, 0, .026, .035, .019, 14);
      for (let k = 0; k < 4; k++) {
        tubeBetween(T, hand, skin, [(k - 1.5) * .01, -.008, -.005], [(k - 1.5) * .009, -.031, -.024], .0047, 5);
      }
      ellipsoid(T, hand, skin, sg * .022, -.003, -.01, .01, .019, .012, 10);
      mergeStatic(T, hand);
      armGroup.userData = { side: sg, shoulder, target, wheelZ: pose.wheelZ, wheelY: pose.wheelY, handSpan: pose.handSpan || .13 };
      arms.push({ group: armGroup, upper, lower, hand, shoulder, target, side: sg, wheelZ: pose.wheelZ, wheelY: pose.wheelY, handSpan: pose.handSpan || .13 });
    }
    if (look.scarf) {
      const scarf = matte(T, look.scarf, .95);
      mesh(T, person, new T.TorusGeometry(.056, .016, 6, 16), scarf, 0, .055, 0, Math.PI / 2);
      strip(T, person, scarf, [[.04, .035, .03], [.09, .03, .04], [.13, -.07, .28], [.06, -.09, .31]]);
      scarf.side = T.DoubleSide;
    }
    if (look.veil) {
      const veil = matte(T, 0xfff9ee, 1, { transparent: true, opacity: .48, side: T.DoubleSide, depthWrite: false });
      strip(T, head, veil, [[-.08, .105, .02], [.08, .105, .02], [.18, -.42, .24], [-.18, -.42, .24]]);
      const flowers = matte(T, 0xf6e6d3, .94);
      for (let k = 0; k < 7; k++) ellipsoid(T, head, flowers, (k - 3) * .026, .108 - Math.abs(k - 3) * .006, -.015, .017, .012, .016, 8);
      // The bride's white bodice and skirt distinguish her even from the rear.
      ellipsoid(T, person, shirt, 0, -.37, .04, .2, .13, .2, 16);
    }
  }
  mergeStatic(T, head); mergeStatic(T, person);
  person.userData = { index, head, arms, homeY: y, wheelZ: pose.wheelZ, wheelY: pose.wheelY, dog: !!look.dog };
  return person;
}

function carMaterials(T, spec) {
  const materials = {
    body: paint(T, spec.color || 0xd8141c),
    metal: paint(T, spec.chrome ? 0xe5e6e5 : 0xb0b8c2, { metalness: 0.96, roughness: 0.17 }),
    rim: paint(T, spec.rimCol || 0xc1c7cc, { metalness: 0.9, roughness: 0.25 }),
    darkMetal: matte(T, 0x14191c, 0.43, { metalness: 0.66 }),
    rubber: matte(T, 0x131619, 0.91),
    leather: matte(T, spec.interior || 0xc1ad8d, 0.75),
    black: matte(T, 0x151a1c, 0.85),
    glass: new T.MeshPhysicalMaterial({ color: 0xa8cbd6, metalness: 0.02, roughness: 0.06,
      transparent: true, opacity: 0.28, clearcoat: 1, side: T.DoubleSide, depthWrite: false, envMapIntensity: 1.6 }),
    tail: matte(T, 0xb30913, 0.25, { metalness: 0.2, emissive: 0xff1020, emissiveIntensity: 0.38 }),
    amber: matte(T, 0xf59c20, 0.27, { emissive: 0xff9c1a, emissiveIntensity: 0.2 }),
    white: matte(T, 0xe9edf1, 0.19, { emissive: 0xe0eafa, emissiveIntensity: 0.18 }),
    caliper: matte(T, 0xbb2119, 0.48, { metalness: 0.3 }),
  };
  for (const [key, material] of Object.entries(materials)) material.name = key === 'tail' ? 'brake_lights' : key === 'amber' ? 'signal_lights' : `vehicle_${key}`;
  return materials;
}

function bodyGeometry(T, spec, rearWheel, frontWheel) {
  const n = 100, across = 12, positions = [], indices = [];
  const L = spec.L || 4.5, W = spec.W || 1.98;
  const fn = (key, t, fallback) => typeof spec[key] === 'function' ? spec[key](t) : fallback;
  const radius = Math.min(0.355, L * 0.078), tyreY = radius;
  for (let i = 0; i <= n; i++) {
    const t = i / n, z = (t - 0.5) * L, hw = fn('a', t, 0.92) * W / 2;
    let top = fn('yF', t, 0.88) * 0.99;
    let bottom = (spec.clear || 0.17) + 0.045;
    for (const wz of [rearWheel, frontWheel]) {
      const dz = z - wz, ar = radius + 0.055;
      if (Math.abs(dz) < ar) {
        const arch = tyreY + Math.sqrt(ar * ar - dz * dz);
        bottom = Math.max(bottom, arch); top = Math.max(top, arch + 0.085);
      }
    }
    const r = Math.min(spec.rs || 0.08, 0.17), center = fn('yC', t, top) * 0.99;
    const inner = Math.min(hw * 0.71, Math.max(0.38, W * 0.31));
    // Clockwise rounded shoulder, recessed open cockpit, flanks and underside.
    const lowerSide = Math.min(top - r - .006, bottom + .065);
    const ring = [[-hw * .86, bottom], [-hw * .97, lowerSide], [-hw, top - r], [-hw + r * 0.45, top - r * 0.18],
      [-inner, top], [-inner * 0.93, center], [inner * 0.93, center], [inner, top],
      [hw - r * 0.45, top - r * 0.18], [hw, top - r], [hw * .97, lowerSide], [hw * .86, bottom]];
    for (const [x, y] of ring) positions.push(x, y, z);
    if (i < n) for (let j = 0; j < across; j++) {
      const a = i * across + j, b = i * across + (j + 1) % across, c = a + across, d = b + across;
      indices.push(a, c, b, b, c, d);
    }
  }
  // End caps are separate flat surfaces for crisp bumpers.
  for (const i of [0, n]) {
    const off = i * across;
    for (let j = 1; j < across - 1; j++) {
      if (i === 0) indices.push(off, off + j, off + j + 1);
      else indices.push(off, off + j + 1, off + j);
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

/** Build an original selectable car. The returned Group has wheel contact Y=0. */
export function createCar(T, spec = {}, crew = fallbackCrew, options = {}) {
  const car = new T.Group(); car.name = `car-${spec.id || 'rosso'}`;
  const body = new T.Group(); car.add(body); body.name = 'body';
  const M = carMaterials(T, spec), L = spec.L || 4.5, W = spec.W || 1.98;
  const pos = t => (t - 0.5) * L;
  const frontWheel = pos((spec.wheels || [0.18, 0.79])[0]), rearWheel = pos((spec.wheels || [0.18, 0.79])[1]);
  const radius = Math.min(0.355, L * 0.078), cabin = spec.cockpit || [0.43, 0.68];
  const cfront = pos(cabin[0]), cback = pos(cabin[1]), cz = mix(cfront, cback, 0.66);
  const fn = (key, t, fallback) => typeof spec[key] === 'function' ? spec[key](t) : fallback;
  const tailY = fn('yF', 0.98, 0.9) * 0.99, noseY = fn('yF', 0.03, 0.65) * 0.99;
  const detailed = options.detail !== 'low';
  mesh(T, body, bodyGeometry(T, spec, rearWheel, frontWheel), M.body);
  // Tub, console, padded seats, stitches and headrests are visible from chase view.
  box(T, body, M.black, W * 0.66, 0.12, (cback - cfront) * 0.96, 0, 0.43, (cfront + cback) / 2);
  box(T, body, M.leather, W * 0.08, 0.17, cback - cfront, 0, 0.56, (cfront + cback) / 2);
  const heads = [];
  for (const side of [-1, 1]) {
    const sx = side * W * 0.235;
    box(T, body, M.leather, W * 0.26, 0.16, 0.42, sx, 0.53, cz - 0.05, -0.03);
    // Upholstery faces forward; dark curved shells read as proper bucket seats
    // from the chase camera, instead of two pale rectangular seat backs.
    ellipsoid(T, body, M.darkMetal, sx, 0.84, cz + 0.18, W * 0.145, 0.28, 0.105, 20);
    box(T, body, M.leather, W * 0.225, 0.39, 0.065, sx, 0.83, cz + 0.075, 0.16);
    ellipsoid(T, body, M.darkMetal, sx, 1.08, cz + 0.18, W * 0.12, 0.105, 0.08);
    ellipsoid(T, body, M.leather, sx, 1.08, cz + 0.12, W * 0.105, 0.085, 0.035);
    if (detailed) for (let k = 0; k < 5; k++) box(T, body, M.black, 0.007, 0.3, 0.008, sx + (k - 2) * 0.066, 0.82, cz + 0.082, 0.16);
    const look = crew[side < 0 ? 0 : 1] || fallbackCrew[side < 0 ? 0 : 1];
    if (options.crew !== false) heads.push(passenger(T, body, look, sx, 1.06, cz - 0.02, side < 0 ? 0 : 1, M,
      { wheelZ: cfront + .26 - (cz - .02), wheelY: .91 - 1.06 }));
  }
  box(T, body, M.black, W * 0.64, 0.13, 0.2, 0, 0.83, cfront + 0.055);
  // Original left-hand-drive cockpit, wheel rim and instrument binnacle.
  const steeringWheel = new T.Group(); steeringWheel.name = 'steering_wheel';
  steeringWheel.position.set(-W * .235, .91, cfront + .26); steeringWheel.rotation.x = -.3; body.add(steeringWheel);
  mesh(T, steeringWheel, new T.TorusGeometry(.15, .018, 7, 24), M.black);
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6])
    tubeBetween(T, steeringWheel, M.darkMetal, [0, 0, 0], [Math.cos(a) * .135, Math.sin(a) * .135, 0], .011, 6);
  mergeStatic(T, steeringWheel);
  tubeBetween(T, body, M.darkMetal, [-W * 0.235, 0.91, cfront + 0.26], [-W * 0.235, 0.76, cfront + 0.08], 0.035);
  box(T, body, M.darkMetal, 0.07, 0.1, 0.07, 0, 0.72, cz - 0.24);
  ellipsoid(T, body, M.black, 0, 0.8, cz - 0.24, 0.042, 0.042, 0.042, 10);
  const glassW = W * 0.34, glassHeight = spec.screen || 0.42;
  if (spec.id !== 'raiden') {
    const lowerZ = cfront + 0.018, upperZ = cfront + 0.19;
    const lowerY = fn('yF', cabin[0], 0.87) * 0.99, upperY = lowerY + glassHeight;
    strip(T, body, M.glass, [[-glassW, lowerY, lowerZ], [glassW, lowerY, lowerZ], [glassW * 0.9, upperY, upperZ], [-glassW * 0.9, upperY, upperZ]]);
    for (const sg of [-1, 1]) tubeBetween(T, body, spec.chrome ? M.metal : M.darkMetal,
      [sg * glassW, lowerY, lowerZ], [sg * glassW * 0.9, upperY, upperZ], 0.022);
    tubeBetween(T, body, spec.chrome ? M.metal : M.darkMetal, [-glassW * 0.9, upperY, upperZ], [glassW * 0.9, upperY, upperZ], 0.025);
    tubeBetween(T, body, M.black, [-0.27, lowerY + 0.015, lowerZ - 0.006], [0.12, lowerY + 0.11, lowerZ + 0.065], 0.009, 6);
  }
  // Mirrors, door seams, side intakes and rocker panels.
  for (const sg of [-1, 1]) {
    tubeBetween(T, body, M.darkMetal, [sg * W * 0.43, 0.86, cfront + 0.1], [sg * W * 0.54, 0.9, cfront + 0.1], 0.024);
    ellipsoid(T, body, M.body, sg * W * 0.54, 0.91, cfront + 0.12, 0.115, 0.065, 0.09);
    box(T, body, M.metal, 0.15, 0.075, 0.009, sg * W * 0.54, 0.91, cfront + 0.19);
    box(T, body, spec.sideLine ? matte(T, spec.sideLine, 0.4) : M.darkMetal, 0.014, 0.018, L * 0.59, sg * W * 0.466, 0.51, 0);
    box(T, body, M.darkMetal, 0.016, 0.19, 0.009, sg * W * 0.461, 0.64, cback - 0.01);
    box(T, body, spec.chrome ? M.metal : M.darkMetal, 0.018, 0.025, 0.11, sg * W * 0.465, 0.79, cback - 0.13);
    if (spec.intakes) {
      box(T, body, M.black, 0.021, 0.22, 0.5, sg * W * 0.477, 0.57, rearWheel - 0.47);
      for (let k = 0; k < 5; k++) box(T, body, M.body, 0.026, 0.015, 0.49, sg * W * 0.489, 0.485 + k * 0.04, rearWheel - 0.47);
    }
  }
  const rearZ = L / 2 + 0.008, frontZ = -L / 2 - 0.008;
  box(T, body, M.darkMetal, W * 0.84, 0.23, 0.035, 0, tailY - 0.22, rearZ);
  box(T, body, M.black, W * 0.61, 0.16, 0.035, 0, noseY - 0.22, frontZ);
  box(T, body, spec.chrome ? M.metal : M.darkMetal, W * 0.87, 0.065, 0.1, 0, 0.33, rearZ - 0.015);
  box(T, body, spec.chrome ? M.metal : M.body, W * 0.85, 0.065, 0.07, 0, 0.27, frontZ + 0.015);
  const round = ['round', 'roundsmall', 'quad'].includes(spec.tails);
  for (const sg of [-1, 1]) {
    if (round) {
      for (let k = 0; k < (spec.tails === 'quad' ? 2 : 1); k++) {
        const x = sg * (W * 0.33 + k * 0.13), r = spec.tails === 'roundsmall' ? 0.07 : 0.09;
        mesh(T, body, new T.CylinderGeometry(r + 0.014, r + 0.014, 0.024, 24), M.metal, x, tailY - 0.16, rearZ + 0.025, Math.PI / 2);
        mesh(T, body, new T.CylinderGeometry(r, r, 0.028, 24), M.tail, x, tailY - 0.16, rearZ + 0.042, Math.PI / 2);
      }
    } else {
      const count = spec.tails === 'triple' ? 3 : 1;
      for (let k = 0; k < count; k++) {
        const tw = count === 3 ? 0.11 : W * 0.24;
        box(T, body, M.tail, tw, spec.tails === 'strip' || spec.tails === 'neon' ? 0.06 : 0.145, 0.037,
          sg * (W * 0.34 + (k - (count - 1) / 2) * 0.135), tailY - 0.155, rearZ + 0.025);
      }
      box(T, body, M.amber, 0.065, 0.065, 0.04, sg * W * 0.44, tailY - 0.13, rearZ + 0.027);
      box(T, body, M.white, 0.075, 0.045, 0.04, sg * W * 0.23, tailY - 0.19, rearZ + 0.027);
    }
    // Warm headlamp lenses, original hidden-lamp panels, and twin exhausts.
    if (spec.pop) box(T, body, M.darkMetal, W * 0.17, 0.008, 0.19, sg * W * 0.29, noseY + 0.016, frontZ + 0.2, -0.045);
    box(T, body, M.white, W * 0.15, 0.055, 0.023, sg * W * 0.31, noseY - 0.13, frontZ - 0.012);
    for (let k = 0; k < (spec.id === 'rosso' || spec.id === 'vespa' ? 2 : 1); k++) {
      const ex = sg * (W * 0.32 + k * 0.13);
      mesh(T, body, new T.CylinderGeometry(0.06, 0.054, 0.17, 16), M.metal, ex, 0.26, rearZ + 0.045, Math.PI / 2);
      mesh(T, body, new T.CylinderGeometry(0.043, 0.043, 0.009, 14), M.black, ex, 0.26, rearZ + 0.134, Math.PI / 2);
    }
  }
  if (spec.tails === 'strip' || spec.tails === 'neon') box(T, body, M.tail, W * 0.54, 0.045, 0.038, 0, tailY - 0.15, rearZ + 0.026);
  // The first red wedge's louvred engine cover and rear grille echo the brief.
  if (spec.tails === 'grille' || spec.louvres || spec.id === 'adler') {
    const grilleZ = mix(cback, L / 2, 0.65);
    for (let k = 0; k < 11; k++) box(T, body, M.darkMetal, W * 0.55, 0.014, 0.025, 0,
      fn('yF', (grilleZ / L) + 0.5, tailY) * 0.99 + 0.015, grilleZ + (k - 5) * 0.035);
    for (let k = 0; k < 5; k++) box(T, body, M.darkMetal, W * 0.91, 0.011, 0.014, 0, tailY - 0.075 - k * 0.039, rearZ + 0.055);
  }
  const plate = label(T, 'FORMOSA · 93', '#11171c', '#d9e0d7');
  box(T, body, plate, 0.4, 0.12, 0.012, 0, 0.36, rearZ + 0.058);
  box(T, body, M.metal, 0.052, 0.028, 0.013, 0, tailY - 0.04, rearZ + 0.054);
  // Model-specific silhouettes are preserved, rather than a recolored base car.
  if (spec.wing || spec.spoiler || spec.duck) {
    const h = spec.wing ? 0.26 : spec.spoiler ? 0.15 : 0.075;
    for (const sg of [-1, 1]) box(T, body, M.darkMetal, 0.05, h, 0.16, sg * W * 0.31, tailY + h / 2, L * 0.39);
    box(T, body, M.body, W * (spec.wing ? 1.03 : 0.88), 0.055, spec.spoiler ? 0.4 : 0.26, 0, tailY + h, L * 0.4, -0.1);
    if (spec.wing) for (const sg of [-1, 1]) box(T, body, M.body, 0.035, 0.19, 0.32, sg * W * 0.515, tailY + h + 0.06, L * 0.4);
  }
  if (spec.hoop || spec.fairing) {
    for (const sg of [-1, 1]) {
      const x = sg * W * 0.235;
      if (spec.hoop) {
        mesh(T, body, new T.TorusGeometry(0.2, 0.025, 7, 24, Math.PI), M.metal, x, 1.03, cback + 0.06);
      } else ellipsoid(T, body, M.body, x, 0.91, cback + 0.24, 0.24, 0.18, 0.43);
    }
  }
  if (spec.scoop) {
    box(T, body, M.body, 0.49, 0.11, 0.63, 0, noseY + 0.16, frontWheel, -0.09);
    box(T, body, M.black, 0.42, 0.06, 0.015, 0, noseY + 0.17, frontWheel - 0.32);
  }
  if (spec.fins) for (const sg of [-1, 1]) {
    box(T, body, M.body, 0.06, 0.33, 0.85, sg * W * 0.41, tailY + 0.05, L * 0.32, -0.14);
    box(T, body, matte(T, 0x38dcea, 0.3, { emissive: 0x16c4e0, emissiveIntensity: 1 }), 0.014, 0.018, L * 0.62, sg * W * 0.47, 0.27, 0.15);
  }
  if (spec.tails === 'fin') for (const sg of [-1, 1]) box(T, body, M.body, 0.09, 0.18, 0.7, sg * W * 0.45, tailY + 0.04, L * 0.38, -0.08);
  if (spec.stripe) {
    const mat = paint(T, spec.stripe, { metalness: 0.25, roughness: 0.32 });
    const width = W * (spec.stripeW || 0.08);
    for (const sg of [-1, 1]) for (const [start, end] of [[0.03, cabin[0] - 0.015], [cabin[1] + 0.018, 0.97]]) {
      for (let j = 0; j < 12; j++) {
        const a = mix(start, end, j / 12), b = mix(start, end, (j + 1) / 12), x = sg * W * 0.12;
        strip(T, body, mat, [[x - width / 2, fn('yC', a, .9) * .99 + .014, pos(a)],
          [x - width / 2, fn('yC', b, .9) * .99 + .014, pos(b)],
          [x + width / 2, fn('yC', b, .9) * .99 + .014, pos(b)],
          [x + width / 2, fn('yC', a, .9) * .99 + .014, pos(a)]]);
      }
    }
  }
  if (spec.roundel) {
    const roundel = mesh(T, body, new T.CircleGeometry(0.25, 32), label(T, '7', '#f5f0df', '#121c22', 128, 128), 0, noseY + 0.085, pos(0.24), -Math.PI / 2);
    roundel.renderOrder = 1;
  }
  const wheels = [];
  for (const z of [frontWheel, rearWheel]) for (const side of [-1, 1]) {
    const wheelT = z / L + 0.5, widthAtWheel = fn('a', wheelT, 0.94) * W / 2;
    const w = wheel(T, body, side * (widthAtWheel - 0.105), radius, z, radius, spec.id === 'vespa' || spec.id === 'rosso' ? .28 : .23,
      spec.rim || 'star', M, detailed, z === frontWheel);
    const wheelName = `wheel_${z === frontWheel ? 'front' : 'rear'}_${side < 0 ? 'left' : 'right'}`;
    w.name = `${wheelName}_steer`; w.userData.spin.name = `${wheelName}_spin`; wheels.push(w);
  }
  mergeStatic(T, body);
  car.userData = { spec, body, wheels, heads, steeringWheel, tailMaterials: [M.tail], signalMaterials: [M.amber], length: L, width: W, front: -L / 2, rear: L / 2 };
  if (options.shadows === false) car.traverse(m => { m.castShadow = false; m.receiveShadow = false; });
  return car;
}

// Painted chase-view art is a camera-facing cutout. It changes the presentation
// only; tyre contact, road coordinates, traffic and collision geometry stay 3D.
function attachPaintedRosso(T, model, assets) {
  if (typeof document === 'undefined' || assets.paintedPlayer === false || model.userData.spec?.id !== 'rosso') return;
  const spec = model.userData.spec, pixelMetres = (spec.W || 1.98) / 1486;
  const uniforms = { formosaBank: { value: 0 }, formosaLift: { value: 0 }, formosaBend: { value: 0 },
    formosaCompression: { value: 0 }, formosaDirection: { value: 1 }, formosaYaw: { value: 0 },
    formosaTrack: { value: 1210 * pixelMetres }, formosaPixelMetres: { value: pixelMetres } };
  const material = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: .012,
    depthWrite: true, depthTest: true, toneMapped: false, fog: false, side: T.DoubleSide });
  material.name = 'approved03_single_rear_chase';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform float formosaBank, formosaLift, formosaBend, formosaCompression, formosaDirection, formosaYaw, formosaTrack, formosaPixelMetres;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed=vec3((uv.x*1536.0-755.0)*formosaPixelMetres,(918.0-(1.0-uv.y)*1024.0)*formosaPixelMetres,0.0);
      float rigid=smoothstep(.63,.85,transformed.y);
      float bow=sin(3.14159265*clamp(transformed.y/1.14,0.0,1.0));
      transformed.x+=formosaDirection*formosaBend*formosaTrack*bow*(1.0-rigid);
      float outer=smoothstep(-.4,.7,-formosaDirection*transformed.x/formosaTrack);
      float sprung=smoothstep(0.0,.25,transformed.y)*(1.0-smoothstep(.9,1.3,transformed.y));
      transformed.y-=formosaCompression*outer*sprung*(1.0-rigid);
      vec2 q=vec2(transformed.x*cos(formosaYaw),transformed.y);
      vec2 pivot=vec2(-formosaDirection*formosaTrack*.5*cos(formosaYaw),0.0);
      vec2 d=q-pivot;float c=cos(formosaBank),s=sin(formosaBank);
      vec2 rolled=pivot+vec2(c*d.x-s*d.y,s*d.x+c*d.y);
      float upper=smoothstep(0.0,.22,transformed.y);
      q=vec2(rolled.x,mix(q.y,rolled.y,max(formosaLift,upper)));
      if(outer>.5&&transformed.y<.23)q.y=max(0.0,q.y);
      transformed=vec3(q,0.0);`);
    // Billboard in the current render camera, with a constant world scale.
    // The scene/depth pass sees exactly this mesh; no screen-space overlay or zoom.
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      'vec4 mvPosition=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);mvPosition.xy+=transformed.xy;gl_Position=projectionMatrix*mvPosition;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',
      'diffuseColor.a = smoothstep(0.06, 0.25, diffuseColor.a);\n#include <alphatest_fragment>');
  };
  material.customProgramCacheKey = () => 'formosa-approved03-single-rear-v1';
  const sprite = new T.Mesh(new T.PlaneGeometry(1, 1, 88, 56), material); sprite.name = 'approved03_single_rear_chase';
  sprite.position.set(0, .026, (spec.L || 4.5) * .44 + .13);
  sprite.frustumCulled = false;
  sprite.visible = false; sprite.renderOrder = 2; model.add(sprite);
  const proxyMaterial = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const proxy = mesh(T, model, new T.SphereGeometry(1, 20, 10), proxyMaterial, 0, .36, 0);
  proxy.scale.set((spec.W || 1.98) * .44, .32, (spec.L || 4.5) * .39);
  proxy.name = 'painted_car_shadow_proxy'; proxy.visible = false; proxy.castShadow = assets.shadows !== false;
  const shadowMaterial = new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: 'varying vec2 shadowUv; void main(){shadowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 shadowUv; void main(){vec2 p=(shadowUv-.5)*2.0;float a=(1.0-smoothstep(.22,1.0,dot(p,p)))*.25;gl_FragColor=vec4(.006,.012,.018,a);}' });
  const contactShadow = mesh(T, model, new T.PlaneGeometry((spec.W || 1.98) * 1.12, (spec.L || 4.5) * .74), shadowMaterial, 0, .017, .2, -Math.PI / 2);
  contactShadow.name = 'painted_car_contact_shadow'; contactShadow.castShadow = false; contactShadow.receiveShadow = false; contactShadow.visible = false;
  const painted = { sprite, material, uniforms, proxy, contactShadow,
    rearOffset: (spec.L || 4.5) * .44 + .13, ready: false, failed: false };
  model.userData.painted = painted;
  const url = assets.paintedRossoUrl || new URL('../assets/player-rosso-painted.png', import.meta.url).href;
  new T.TextureLoader().load(url, texture => {
    texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    material.map = texture; material.needsUpdate = true; painted.ready = true;
  }, undefined, () => { painted.failed = true; });
}

function updatePaintedPlayer(model, pc, enabled, pose) {
  const painted = model.userData.painted; if (!painted) return;
  // An authored rear-view drawing is never stretched into an invented side view.
  // A horizontal crash spin also needs the retained 3D car: a single rear
  // drawing cannot show that rotation, even when the car stays on the ground.
  const needs3DCrash = !!pc.crash && (Math.abs(pc.crash.spin || 0) > .001 ||
    Math.abs(pc.roll || 0) > .65 || (pc.airY || 0) > .6);
  const active = painted.ready && enabled && !needs3DCrash;
  painted.sprite.visible = active; painted.proxy.visible = active; painted.contactShadow.visible = active;
  model.userData.body.visible = !active;
  if (active && pose) {
    // The chase drawing has one fixed rear-axle anchor on the road. Body yaw
    // must not swing that anchor farther from the camera and shrink the car.
    const a=Math.atan(pc.piece?.slope?.(pc.s)||0),c=Math.cos(a),s=Math.sin(a),yaw=pc.yaw||0;
    const y=c*.026-s*painted.rearOffset,z=s*.026+c*painted.rearOffset,zz=Math.cos(yaw)*z;
    painted.sprite.position.set(Math.sin(yaw)*z,c*y+s*zz,-s*y+c*zz);
    const u=painted.uniforms;
    u.formosaBank.value=pose.bank;u.formosaLift.value=pose.lift;u.formosaBend.value=pose.bend;
    u.formosaCompression.value=pose.compression;u.formosaDirection.value=pose.direction;u.formosaYaw.value=pose.yaw;
    painted.contactShadow.position.x=-pose.direction*u.formosaTrack.value*.5*pose.lift;
    painted.contactShadow.scale.x=1-pose.lift*.45;
  }
  model.userData.paintedActive = active;
}

function attachPaintedSedan(T, model, texture) {
  if (model.userData.painted || model.userData.type !== 'sedan') return;
  const width = model.userData.width * 1536 / 1453;
  const material = new T.SpriteMaterial({ map: texture, color: 0xffffff, transparent: true,
    alphaTest: .012, depthWrite: true, depthTest: true, toneMapped: false });
  material.name = 'painted_sedan_rear';
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',
      'diffuseColor.a = smoothstep(0.06, 0.25, diffuseColor.a);\n#include <alphatest_fragment>');
  };
  material.customProgramCacheKey = () => 'formosa-painted-alpha-v1';
  const sprite = new T.Sprite(material); sprite.name = 'painted_sedan_rear';
  sprite.center.set(.5, (1024 - 965) / 1024);
  sprite.scale.set(width, width * 1024 / 1536, 1);
  sprite.position.set(0, .025, model.userData.length * .44);
  sprite.visible = false; model.add(sprite);
  const shadowMaterial = new T.ShaderMaterial({ transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: 'varying vec2 shadowUv; void main(){shadowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 shadowUv; void main(){vec2 p=(shadowUv-.5)*2.0;float a=(1.0-smoothstep(.22,1.0,dot(p,p)))*.3;gl_FragColor=vec4(.006,.012,.018,a);}' });
  const contactShadow = mesh(T, model, new T.PlaneGeometry(model.userData.width * 1.1,
    model.userData.length * .8), shadowMaterial, 0, .018, .1, -Math.PI / 2);
  contactShadow.name = 'painted_sedan_contact_shadow'; contactShadow.visible = false;
  contactShadow.castShadow = false; contactShadow.receiveShadow = false;
  model.userData.painted = { sprite, material, contactShadow, ready: true };
}

function updatePaintedSedan(model, enabled, near) {
  const painted = model.userData.painted; if (!painted) return;
  painted.sprite.visible = enabled; painted.contactShadow.visible = enabled;
  model.userData.body.visible = !enabled && near;
  if (model.userData.lowBody) model.userData.lowBody.visible = !enabled && !near;
  model.userData.paintedActive = enabled;
}

function trafficLowDetail(T, source, color, type) {
  const low = new T.Group(); low.name = 'traffic_lod';
  const palette = {
    body: paint(T, color, { roughness: .32 }),
    dark: matte(T, 0x192026, .84),
    glass: matte(T, 0x284956, .24, { metalness: .3 }),
    metal: matte(T, 0xa3b2b8, .4, { metalness: .65 }),
    tail: matte(T, 0xb11018, .3, { emissive: 0xff1620, emissiveIntensity: .38 }),
    skin: matte(T, 0xc59a78, .9),
    accent: matte(T, type === 'logs' || type === 'gravel' ? 0x746149 : 0x397e83, .85),
  };
  Object.entries(palette).forEach(([key, material]) => material.name = key === 'tail' ? 'brake_lights' : `lod_${key}`);
  source.updateMatrixWorld(true);
  const inverse = source.matrixWorld.clone().invert();
  source.traverse(m => {
    if (!m.isMesh) return;
    const material = m.material, name = material.name || '';
    let target = palette.dark;
    if (name === 'vehicle_body') target = palette.body;
    else if (name === 'vehicle_glass') target = palette.glass;
    else if (name === 'brake_lights' || name === 'signal_lights') target = palette.tail;
    else if (name === 'vehicle_white' || name === 'vehicle_metal' || name === 'vehicle_rim') target = palette.metal;
    else if (!name && material.color) {
      const c = material.color;
      if (c.r > .35 && c.g > .18 && c.b < c.r * .9) target = palette.skin;
      else if (c.r + c.g + c.b > .2 && !material.map) target = palette.accent;
    }
    const geometry = m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    const baked = mesh(T, low, geometry, target); baked.castShadow = false;
  });
  mergeStatic(T, low);
  low.traverse(m => { m.castShadow = false; });
  low.userData.tailMaterial = palette.tail;
  return low;
}

export function createTraffic(T, type, variant = 0, options = {}) {
  const def = VEHICLES[type] || VEHICLES.sedan;
  const group = new T.Group(), body = new T.Group(); body.name = 'body'; group.add(body);
  const colors = [def.color, 0x195f99, 0xc3c9ca, 0xa12624, 0xe9e5d7];
  const color = ['taxi', 'bus', 'bluetruck', 'train'].includes(type) ? def.color : colors[variant % colors.length];
  const M = carMaterials(T, { color, interior: 0x394049 }), { L, W, H } = def;
  const commercial = ['bluetruck', 'gravel', 'rebar', 'logs', 'bus', 'train'].includes(type);
  const wheels = [], heads = [];
  if (type === 'scooter') {
    box(T, body, M.body, .36, .32, 1.1, 0, .46, .15);
    ellipsoid(T, body, M.body, 0, .82, -.48, .21, .38, .13);
    box(T, body, M.black, .37, .09, .6, 0, .8, .12);
    box(T, body, M.tail, .25, .09, .025, 0, .66, .73);
    box(T, body, M.white, .24, .14, .025, 0, 1.01, -.63);
    tubeBetween(T, body, M.metal, [-.3, 1.0, -.43], [.3, 1.0, -.43], .021);
    const rider = passenger(T, body, { hair: 0x22272a, shirt: variant % 2 ? 0x597973 : 0x8d4439 }, 0, 1.11, .05, 0, M,
      { wheelZ: -.48, wheelY: -.11, handSpan: .26 });
    ellipsoid(T, rider, M.body, 0, .24, .01, .145, .15, .155); heads.push(rider);
    for (const z of [-.6, .62]) wheels.push(wheel(T, body, 0, .25, z, .25, .12, 'disc', M, false, z < 0));
  } else if (type === 'bus' || type === 'train') {
    box(T, body, M.body, W, H - .55, L, 0, H / 2 + .22, 0);
    box(T, body, M.darkMetal, W + .015, .99, L * .91, 0, H * .68, 0);
    box(T, body, M.glass, W + .024, .9, L * .89, 0, H * .68, 0);
    box(T, body, M.body, W + .032, .19, L, 0, .95, 0);
    box(T, body, matte(T, type === 'train' ? 0xf3e6c9 : 0x268b9b, .6), W + .033, .21, L, 0, .72, 0);
    for (let z = -L / 2 + 1.0; z < L / 2; z += 1.05) for (const sg of [-1, 1]) box(T, body, M.body, .028, 1.07, .075, sg * W * .505, H * .68, z);
    box(T, body, M.darkMetal, W * .88, 1.1, .025, 0, H * .72, -L / 2 - .024);
    box(T, body, M.glass, W * .86, 1.06, .03, 0, H * .72, -L / 2 - .04);
    box(T, body, label(T, type === 'train' ? '台灣環島線' : '高雄　墾丁快線', '#111d20', '#e5bd58'), W * .82, .3, .025, 0, H - .26, -L / 2 - .025);
    box(T, body, M.darkMetal, W * .69, .8, .025, 0, H * .7, L / 2 + .023);
    if (type === 'bus') for (const sg of [-1, 1]) {
      box(T, body, M.tail, .2, .36, .026, sg * W * .38, .98, L / 2 + .03);
      box(T, body, M.white, .28, .14, .03, sg * W * .35, .84, -L / 2 - .03);
    }
    box(T, body, M.white, W * .6, .13, .035, 0, .64, L / 2 + .03);
    for (const z of [-L * .31, L * .32]) for (const sg of [-1, 1]) wheels.push(wheel(T, body, sg * (W * .5 - .1), .48, z, .48, .3, 'disc', M, false, z < 0));
  } else if (commercial || type === 'pickup') {
    const cabL = type === 'pickup' ? L * .48 : 2.0, front = -L / 2;
    const cabX = type === 'pickup' ? W : W * .98;
    box(T, body, M.body, cabX, H * .72, cabL, 0, H * .5, front + cabL / 2);
    box(T, body, M.darkMetal, W * .87, H * .3, .022, 0, H * .67, front - .015);
    box(T, body, M.glass, W * .84, H * .28, .026, 0, H * .67, front - .032);
    for (const sg of [-1, 1]) {
      box(T, body, M.darkMetal, .024, H * .3, cabL * .62, sg * W * .501, H * .67, front + cabL * .56);
      box(T, body, M.white, .26, .14, .035, sg * W * .34, H * .31, front - .032);
      tubeBetween(T, body, M.darkMetal, [sg * W * .49, H * .65, front + .3], [sg * W * .61, H * .65, front + .3], .03);
      box(T, body, M.darkMetal, .08, .2, .16, sg * W * .61, H * .65, front + .3);
    }
    const bedL = L - cabL - .18, bedZ = front + cabL + .15 + bedL / 2;
    box(T, body, M.darkMetal, W * .88, .22, L * .92, 0, .51, 0);
    box(T, body, M.body, W, .22, bedL, 0, .83, bedZ);
    const sideH = type === 'gravel' ? 1.65 : type === 'pickup' || type === 'bluetruck' ? .6 : .22;
    for (const sg of [-1, 1]) {
      box(T, body, M.body, .07, sideH, bedL, sg * W * .48, .96 + sideH / 2, bedZ);
      for (let z = bedZ - bedL / 2 + .35; z < bedZ + bedL / 2; z += .65) box(T, body, M.metal, .025, sideH * .85, .035, sg * W * .518, .96 + sideH / 2, z);
      box(T, body, M.tail, .18, .1, .025, sg * W * .37, .72, L / 2 + .03);
    }
    box(T, body, M.body, W, sideH, .07, 0, .96 + sideH / 2, L / 2);
    if (type === 'gravel') {
      const gravel = matte(T, 0x8d8777);
      for (let k = 0; k < 22; k++) ellipsoid(T, body, gravel, Math.sin(k * 4.93) * W * .34, 1.85 + .2 * Math.sin(k), bedZ + Math.cos(k * 2.4) * bedL * .4, .47, .5, .55, 8);
    }
    if (type === 'logs' || type === 'rebar') {
      const cargo = matte(T, type === 'logs' ? 0x69482c : 0x51585b, .9, { metalness: type === 'logs' ? 0 : .6 });
      for (let k = 0; k < (type === 'logs' ? 13 : 24); k++) {
        const x = (k % (type === 'logs' ? 5 : 8) - (type === 'logs' ? 2 : 3.5)) * (type === 'logs' ? .37 : .23);
        const y = 1.2 + Math.floor(k / (type === 'logs' ? 5 : 8)) * (type === 'logs' ? .34 : .17);
        mesh(T, body, new T.CylinderGeometry(type === 'logs' ? .19 : .07, type === 'logs' ? .21 : .07, bedL * .98, type === 'logs' ? 10 : 7), cargo, x, y, bedZ, Math.PI / 2);
      }
      for (const z of [bedZ - bedL * .3, bedZ + bedL * .3]) for (const sg of [-1, 1]) box(T, body, M.darkMetal, .07, 1.5, .09, sg * W * .46, 1.5, z);
    }
    const axles = L > 7 ? [-L * .38, L * .27, L * .37] : [-L * .32, L * .34];
    for (const z of axles) for (const sg of [-1, 1]) wheels.push(wheel(T, body, sg * (W / 2 - .09), .4, z, .4, .26, 'disc', M, false, z < 0));
  } else {
    const wheelY = .33, cabinL = type === 'wagon' ? L * .61 : L * .49, cabinZ = type === 'wagon' ? .1 : -.12;
    box(T, body, M.body, W * .95, H * .43, L, 0, H * .4, 0);
    box(T, body, M.darkMetal, W * .85, H * .31, cabinL, 0, H * .72, cabinZ);
    box(T, body, M.glass, W * .855, H * .295, cabinL + .01, 0, H * .73, cabinZ);
    box(T, body, M.body, W * .88, .08, cabinL * .94, 0, H * .91, cabinZ);
    for (const sg of [-1, 1]) {
      for (const z of [-cabinL / 2 + cabinZ, cabinZ, cabinL / 2 + cabinZ]) box(T, body, M.body, .035, H * .36, .065, sg * W * .436, H * .72, z);
      box(T, body, M.tail, .34, .14, .035, sg * W * .34, H * .51, L / 2 + .025);
      box(T, body, M.white, .35, .12, .035, sg * W * .32, H * .5, -L / 2 - .025);
      box(T, body, M.body, .14, .085, .17, sg * W * .52, H * .63, -cabinL * .38);
      for (const z of [-L * .31, L * .32]) wheels.push(wheel(T, body, sg * (W / 2 - .09), wheelY, z, wheelY, .21, 'star', M, false, z < 0));
    }
    box(T, body, M.darkMetal, W * .87, .075, .08, 0, .36, L / 2);
    box(T, body, M.darkMetal, W * .55, .1, .03, 0, .42, -L / 2 - .03);
    if (type === 'taxi') box(T, body, label(T, 'TAXI', '#f8db6f', '#15282a', 128, 64), .38, .15, .17, 0, H + .035, -.1);
  }
  if (type !== 'scooter') box(T, body, label(T, type === 'taxi' ? 'TAXI 1993' : 'FORMOSA', '#e0e4db', '#28302d'), .34, .11, .016, 0, .55, L / 2 + .05);
  mergeStatic(T, body);
  for (let i = 0; i < wheels.length; i++) {
    const w = wheels[i], base = `wheel_${w.userData.front ? 'front' : 'rear'}_${w.position.x < -.01 ? 'left' : w.position.x > .01 ? 'right' : 'center'}_${i}`;
    w.name = `${base}_steer`; w.userData.spin.name = `${base}_spin`;
  }
  group.name = `traffic-${type}`;
  group.userData = { body, wheels, heads, tailMaterials: [M.tail], signalMaterials: [M.amber], length: L, width: W, type };
  const lowBody = trafficLowDetail(T, body, color, type);
  if (options.detail === 'low') {
    group.remove(body); disposeModel(body); group.add(lowBody); lowBody.name = 'body';
    group.userData = { body: lowBody, wheels: [], heads: [], tailMaterials: [lowBody.userData.tailMaterial], signalMaterials: [], length: L, width: W, type, lowDetail: true };
  } else {
    group.add(lowBody); lowBody.visible = false;
    group.userData.lowBody = lowBody;
    group.userData.tailMaterials.push(lowBody.userData.tailMaterial);
  }
  return group;
}

function animate(T, model, data, dt, time, detailed = true) {
  const ud = model.userData, speed = Number(data.v == null ? data.speed || 0 : data.v);
  const braking = clamp(data.brake || 0, 0, 1), steering = clamp(data.steerIn == null ? data.steer || 0 : data.steerIn, -1, 1);
  for (const w of ud.wheels) {
    w.rotation.y = w.userData.front ? -steering * .43 : 0;
    w.userData.spin.rotation.x -= speed * dt / w.userData.radius;
  }
  for (const mat of ud.tailMaterials) mat.emissiveIntensity = .36 + braking * 3.4;
  for (const mat of ud.signalMaterials) mat.emissiveIntensity = data.sig && Math.floor(time * 3.2) % 2 ? 2.3 : .1;
  if (ud.steeringWheel) ud.steeringWheel.rotation.z = -steering * .85;
  for (const h of detailed ? ud.heads : []) {
    const head = h.userData.head || h;
    head.rotation.z = Math.sin(time * 2.7 + h.userData.index) * .011 * clamp(speed / 30, 0, 1) + steering * .024;
    head.rotation.x = Math.sin(time * 3.8 + h.userData.index * 2) * .008 * clamp(speed / 40, 0, 1) + braking * .025;
    head.rotation.y = h.userData.index === 1 ? Math.sin(time * .38) * .07 : -steering * .035;
    for (const arm of h.userData.arms || []) {
      if (h.userData.index !== 0 || arm.wheelZ == null) continue;
      const rotation = -steering * .85;
      const target = [arm.side * arm.handSpan * Math.cos(rotation), arm.wheelY + .015 + arm.side * arm.handSpan * Math.sin(rotation), arm.wheelZ];
      const elbow = [arm.side * .205, -.185, mix(0, target[2], .48)];
      positionLimb(T, arm.upper, arm.shoulder, elbow);
      positionLimb(T, arm.lower, elbow, target);
      arm.hand.position.set(...target);
    }
  }
}

const VISUAL_G = 9.81;
const VISUAL_CG = { rosso:.47, vespa:.45, argento:.44, ballena:.52, bamboo:.40, blanco:.41, adler:.46, raiden:.40, arancia:.39, oro:.54 };
const poseSmooth = x => {const t=clamp(x,0,1);return t*t*(3-2*t);};

/** Presentation-only suspension observer. Contacts come from the real solver;
 * there is no synthetic curb timer, countersteer or write-back into PC. */
export function advanceVehicleVisualPose(spec, pc, previous = {}) {
  const observation=pc.visual;
  if(!observation)return {bank:0,lift:0,bend:0,yaw:0,compression:0,direction:1,...previous};
  const reset=previous.source!==observation;
  const q=reset?{source:observation,lastTime:observation.time,lastContact:0,phi:0,omega:0,lateral:0,
    bank:0,lift:0,bend:0,yaw:0,compression:0,direction:1,acceptedContacts:0,contacts:new Map(),eligible:false}:previous;
  const dt=clamp(observation.time-q.lastTime,0,.1);q.lastTime=observation.time;
  const track=(spec.W||1.98)*.82,h=VISUAL_CG[spec.id]||.47,half=track*.5,mass=clamp(spec.mass??.6,.2,1.2);
  const critical=VISUAL_G*half/h,inertia=h*h+half*half+(.30+mass*.12)**2;
  const tyre=Math.max(.1,observation.tyreLimit||11+5*(spec.grip||.72));
  const lateral=pc.crash?0:clamp(observation.lateralAccel||0,-tyre,tyre);
  if(dt>0)q.lateral=mix(q.lateral,lateral,1-Math.exp(-dt*14));
  for(const [id,touch]of q.contacts)if(pc.piece?.id!==touch.piece||Math.abs((pc.x||0)-touch.x)>.65)q.contacts.delete(id);
  for(const contact of observation.contacts||[]){
    if(contact.seq<=q.lastContact)continue;q.lastContact=contact.seq;
    const delta=contact.deltaVx,normal=contact.normalX;
    const peak=Math.abs(q.lateral+delta/Math.max(.008,Math.min(.05,contact.duration||0)));
    const sameStaticFace=(contact.kind==='wall'||contact.kind==='solid')&&[...q.contacts.values()].some(t=>
      t.piece===contact.piece&&t.kind===contact.kind&&t.normal===Math.sign(normal)&&Math.abs(t.x-contact.x)<.65);
    if(!Number.isFinite(delta)||Math.abs(normal)<.45||delta*normal<=0||Math.abs(delta)<.6||contact.closing<1.8||
      contact.speedMps<18||!(contact.dissipatedPerKg>.08)||peak<critical||q.contacts.has(contact.object)||sameStaticFace)continue;
    const arm=Math.max(0,h-(contact.height??.22));
    const available=contact.dissipatedPerKg*.08;
    const kick=Math.sign(delta)*Math.min(Math.abs(delta)*arm/inertia,Math.sqrt(2*available/inertia));
    if(Math.abs(kick)<.01)continue;
    const bound=Math.sqrt(q.omega*q.omega+2*available/inertia);
    q.omega=clamp(q.omega+kick,-bound,bound);q.eligible=true;q.acceptedContacts++;
    q.contacts.set(contact.object,{piece:contact.piece,x:contact.x,kind:contact.kind,normal:Math.sign(normal)});
    q.lastAccepted={seq:contact.seq,kind:contact.kind,deltaVx:delta,normalX:normal,closing:contact.closing,
      peakTransfer:peak/critical,angularKick:kick,availableRollEnergyPerKg:available,time:contact.time};
  }
  if(dt>0){
    // Damped suspension/tyre compliance removes the external roll energy.
    // It never changes throttle/steering to manufacture a recovery.
    const natural=7.4-mass*.8,damping=.62+.10*(spec.grip||.72),steps=Math.max(1,Math.ceil(dt*120)),sub=dt/steps;
    for(let i=0;i<steps;i++){q.omega+=(-natural*natural*q.phi-2*damping*natural*q.omega)*sub;q.phi+=q.omega*sub;}
    if(Math.abs(q.phi)<.001&&Math.abs(q.omega)<.01){q.phi=0;q.omega=0;q.eligible=false;}
    const physicalSuspension=Math.atan(q.lateral/VISUAL_G*(.045+mass*.008));
    const extra=Math.sign(q.phi)*Math.min(Math.PI/12,Math.abs(q.phi)*2.2);
    const bank=clamp(physicalSuspension+q.phi+extra,-25.5*Math.PI/180,25.5*Math.PI/180);
    q.bank=mix(q.bank,bank,1-Math.exp(-dt*25));
    q.lift=q.eligible?poseSmooth(Math.abs(q.phi)/.07):0;
    const lock=poseSmooth((Math.abs(pc.steerIn||0)-.8)/.2),load=poseSmooth(Math.abs(q.lateral)/(tyre*.65));
    const maxBend=clamp(.08+(1-(spec.grip||.72))*.055,.08,.10);
    q.bend=mix(q.bend,maxBend*Math.max(lock*load,q.lift),1-Math.exp(-dt*14));
    q.yaw=mix(q.yaw,clamp(pc.yaw||0,-5.5*Math.PI/180,5.5*Math.PI/180),1-Math.exp(-dt*12));
    q.compression=Math.min(.1,Math.abs(q.lateral)/critical*(.045+mass*.025)+q.lift*.03);
    if(Math.abs(q.phi)>.003)q.direction=Math.sign(q.phi);else if(Math.abs(q.lateral)>.05)q.direction=Math.sign(q.lateral);
  }
  Object.assign(q,{criticalAccel:critical,tyreAccel:tyre,physicalTransient:q.phi,innerWheelLift:Math.abs(Math.sin(q.phi))*track,
    staticInnerLoadFraction:Math.max(0,(1-Math.abs(q.lateral)/critical)*.5),cameraZoom:1,singleRearSource:true});
  return q;
}

/** Original engine state adapter. update accepts window.__kr directly. */
export class FormosaCars {
  constructor(T, scene, assets = {}) {
    this.T = T; this.scene = scene; this.assets = assets;
    this.root = new T.Group(); this.root.name = 'formosa-vehicles'; scene.add(this.root);
    this.players = new Map(); this.vehicleModels = new Map(); this.pool = new Map();
    this.player = null; this.time = 0; this.point = { x: 0, y: 0, z: 0 };
    this.origin = assets.origin || { x: 0, y: 0, z: 0 };
    this.paintedSedanTexture = null;
    if (typeof document !== 'undefined' && assets.paintedTraffic !== false) {
      const url = assets.paintedSedanUrl || new URL('../assets/traffic-sedan-painted.png', import.meta.url).href;
      new T.TextureLoader().load(url, texture => {
        texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
        texture.userData.formosaShared = true; this.paintedSedanTexture = texture;
      });
    }
  }
  getPlayer(spec, crew) {
    if (!spec) spec = this.assets.CARS?.[0] || { id: 'rosso' };
    const id = spec.id || 'rosso'; let model = this.players.get(id);
    if (!model) {
      model = createCar(this.T, spec, crew || this.assets.CREW?.[id] || fallbackCrew, { shadows: this.assets.shadows !== false });
      attachPaintedRosso(this.T, model, this.assets);
      this.players.set(id, model); this.root.add(model);
    }
    if (this.player && this.player !== model) this.player.visible = false;
    this.player = model; model.visible = true; return model;
  }
  update(state, dt = 1 / 60) {
    dt = Math.min(.1, Math.max(0, dt)); this.time += dt;
    const pc = state.PC || state.pc || state;
    const piece = pc.piece || pc.p; if (!piece?.pos) return;
    const spec = pc.spec || state.carSpec || this.assets.CARS?.[state.RACE?.carIdx || 0];
    const crew = (state.CREW || this.assets.CREW)?.[spec?.id];
    const model = this.getPlayer(spec, crew), s = pc.s || 0;
    const pose=model.userData.visualPose=advanceVehicleVisualPose(spec,pc,model.userData.visualPose);
    this.place(model, piece, s, pc.x || 0, pc.yaw || 0, pc.airY || 0);
    const body = model.userData.body;
    body.rotation.z = pc.crash ? pc.roll || 0 : (pc.roll || 0) + (state.FX?.roll || 0) * .2;
    body.rotation.x = -(pc.pitch || 0) + (pc.bump || 0);
    body.position.y = (pc.bump || 0) + Math.max(0, -(state.FX?.hopY || 0) * .007);
    if(!pc.crash&&pose?.bank!=null){body.rotation.z=pose.bank;body.position.y+=pose.lift*Math.abs(Math.sin(pose.bank))*(spec.W||1.98)*.25;}
    if (state.HAZ?.spinT > 0) model.rotation.y += state.HAZ.spinDir * TAU * clamp(state.HAZ.spinT / state.HAZ.spinDur, 0, 1);
    animate(this.T, model, pc, dt, this.time);
    updatePaintedPlayer(model, pc, this.assets.paintedPlayer !== false && state.paintedPlayer !== false && state.G?.mode !== 'ending',pose);
    const traffic = state.TRAFFIC || state.traffic || [];
    const list = Array.isArray(traffic) ? traffic : traffic.list || [];
    const oncoming = Array.isArray(traffic.oncoming) ? traffic.oncoming : [];
    const active = new Set();
    for (const v of [...list, ...oncoming]) {
      const p = v.p || v.piece; if (!p?.pos) continue;
      const forward = p === piece ? v.s - s : 120;
      if (forward < -70 || forward > 640) continue;
      active.add(v); let m = this.vehicleModels.get(v);
      const type = v.train ? 'train' : v.type || 'sedan';
      if (m && m.userData.type !== type) { this.release(v, m); m = null; }
      if (!m) {
        const bucket = this.pool.get(type); m = bucket?.pop() || createTraffic(this.T, type, Math.floor((v.s || 0) / 17) % 5);
        this.root.add(m); this.vehicleModels.set(v, m);
      }
      this.place(m, p, v.s, v.x, 0, 0);
      if (v.oncoming || v.v < 0) { m.rotation.y += Math.PI; m.rotation.x *= -1; }
      const body = m.userData.body;
      body.rotation.z = v.wob > 0 ? Math.sin(this.time * 18) * v.wob * .05 : 0;
      body.rotation.y = v.lc ? -Math.sign(v.lc.to == null ? 1 : v.lc.to - v.x) * .035 : 0;
      const near = forward < 100 && forward > -25;
      if (m.userData.lowBody) { body.visible = near; m.userData.lowBody.visible = !near; }
      if (type === 'sedan' && this.paintedSedanTexture) {
        attachPaintedSedan(this.T, m, this.paintedSedanTexture);
        // A rear-view drawing is used only for same-direction traffic ahead.
        // Other vehicle classes and opposing traffic retain their own models.
        updatePaintedSedan(m, !v.oncoming && !(v.v < 0) && forward > 0, near);
      }
      m.visible = true; animate(this.T, m, v, near ? dt : 0, this.time, near);
    }
    for (const [v, m] of this.vehicleModels) if (!active.has(v)) this.release(v, m);
  }
  place(model, piece, s, x, yaw = 0, air = 0) {
    piece.pos(s, x || 0, this.point);
    const o = this.origin;
    model.position.set(this.point.x - o.x, this.point.y - o.y + air + .018, this.point.z - o.z);
    model.rotation.set(0, -(piece.heading?.(s) || 0) - yaw, 0, 'YXZ');
    // Local -Z pitches up for positive road slope.
    model.rotation.x = Math.atan(piece.slope?.(s) || 0);
  }
  release(v, model) {
    this.vehicleModels.delete(v); model.visible = false;
    let bucket = this.pool.get(model.userData.type); if (!bucket) this.pool.set(model.userData.type, bucket = []);
    if (bucket.length < 10) bucket.push(model); else { this.root.remove(model); disposeModel(model); }
  }
  dispose() {
    this.scene.remove(this.root); disposeModel(this.root);
    this.paintedSedanTexture?.dispose();
    this.players.clear(); this.vehicleModels.clear(); this.pool.clear(); this.player = null;
  }
}

function disposeModel(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(m => {
    if (!m.isMesh && !m.isSprite) return;
    if (m.geometry) geometries.add(m.geometry);
    for (const material of Array.isArray(m.material) ? m.material : [m.material]) {
      materials.add(material);
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (material[k]) textures.add(material[k]);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  textures.forEach(t => { if (!t.userData.formosaShared) t.dispose(); });
}
