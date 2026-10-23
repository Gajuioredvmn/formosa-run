'use strict';

// Run with `node --test tests/scenery.test.cjs`. Only built-in Node modules are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const sourcePath = path.resolve(__dirname, '..', 'index.html');
const source = fs.readFileSync(sourcePath, 'utf8');

function uniqueMatch(pattern, label) {
  const matches = [...source.matchAll(pattern)];
  assert.equal(matches.length, 1, `Expected one ${label} in index.html`);
  return matches[0];
}

// Ask V8 for the first complete declaration, so nested braces, comments and
// strings are handled by JavaScript's parser rather than a test-only lexer.
function extractBlock(pattern, label, prefix = '') {
  const match = uniqueMatch(pattern, label);
  const start = match.index;
  let end = source.indexOf('}', source.indexOf('{', start));
  while (end !== -1) {
    const candidate = prefix + source.slice(start, end + 1).trimStart();
    try {
      new vm.Script(candidate);
      return candidate;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    end = source.indexOf('}', end + 1);
  }
  throw new Error(`Cannot extract ${label} from index.html`);
}

function declaration(name, kind = 'function') {
  return extractBlock(new RegExp(`^${kind}\\s+${name}\\b`, 'gm'), name);
}

function constLine(name) {
  return uniqueMatch(new RegExp(`^const ${name} = [^\\r\\n]+`, 'gm'), name)[0];
}

// Art generation and the browser are outside these tests. Supply only sprite
// metadata; all placement, random selection, gap and collision logic is real.
const spriteWidths = {
  'townhouse#test': 6, 'scooterstore#test': 6, store: 8,
  'vsign#test': 1, 'scooters#test': 3, planter: 1,
  'walkers#test': 3, 'crowd#test': 4, 'umbrella#test': 3,
  'palm#test': 7, lampC: 1, rail_balustrade: 2.4,
};
const sprites = Object.fromEntries(Object.entries(spriteWidths).map(([name, width]) => [
  name, { id: name, ww: width, collide: 0, sway: 0, glow: 0 },
]));
const context = vm.createContext({ SPR: sprites, window: {} });
const milkfishGround = uniqueMatch(/^  milkfish: \[[^\r\n]+/gm, 'milkfish ground bands')[0];
const milkfishLife = uniqueMatch(/^  milkfish: \{[^\r\n]+/gm, 'milkfish vegetation')[0];
const sceneryScript = new vm.Script([
  constLine('TAU'), constLine('clamp'), constLine('DS'), constLine('_varCache'),
  constLine('C_GRASS'), constLine('BAND'), constLine('VERGE'),
  extractBlock(/^const RAIL_TEX = \{/gm, 'RAIL_TEX'),
  ...['hexToRgb', 'shadeHex', 'mulberry', 'variants', 'pickVar', 'every', 'dressHarborWalk', 'houseRow'].map(name => declaration(name)),
  declaration('Deco', 'class'),
  extractBlock(/^  boulevard\(/gm, 'boulevard', 'function '),
  `globalThis.api = { Deco, dressHarborWalk, houseRow, boulevard, DS,
    milkfishGround: ({${milkfishGround}}).milkfish,
    milkfishLife: ({${milkfishLife}}).milkfish };`,
].join('\n'), { filename: 'index.html:scenery' });
sceneryScript.runInContext(context);
const api = context.api;

function scenery(section = {}, overrides = {}, activeApi = api) {
  const piece = {
    seed: 1234, L: 120, side: 0, gaps: [],
    sprites: [], colliders: [], walls: [], rails: [], wires: [],
    outerL: () => -10, outerR: () => 10,
    sec: () => section,
    ...overrides,
  };
  const decorator = new activeApi.Deco(piece);
  decorator.sec = section;
  return { piece, decorator };
}

function frontages(piece) {
  return [...new Set(piece.colliders.map(c => Math.sign(c.x0 + c.x1)))].sort().join(',');
}

function overlaps(a, b, c, d) {
  return a < d && b > c;
}

// Load the shipped module, but supply only image-independent sprite metadata.
// Its real houseRow and the real index.html Deco methods create every record.
function classicScenery(section = {}, overrides = {}, loadedParts = true) {
  const definitions = { ...sprites };
  const dimensions = {
    upper: [6, 6.8], shop: [5.3, 3], column: [.34, 2.45], base: [.38, .64],
    stone: [.48, .18], cornice: [6, .24], canopy: [5.8, .42], side: [5.4, 6.8], sign: [5.3, .54],
  };
  const parts = Array.from({ length: 4 }, (_, panel) => Object.fromEntries(
    Object.entries(dimensions).map(([part, [ww, wh]]) => {
      const name = `pixel_house_${part}#${panel}`;
      definitions[name] = { id: name, name, ww, wh, collide: 0, sway: 0, glow: 0 };
      return [part, name];
    }),
  ));
  const environment = vm.createContext({ SPR: definitions, window: {} });
  sceneryScript.runInContext(environment);
  const modulePath = path.resolve(__dirname, '..', 'render', 'classic-street-art.js');
  new vm.Script(fs.readFileSync(modulePath, 'utf8'), { filename: modulePath }).runInContext(environment);
  const art = environment.window.FormosaClassicStreetArt;
  if (loadedParts) art.state.parts.push(...parts);
  const result = scenery(section, overrides, environment.api);
  const wallCalls = [], wall = result.decorator.wall;
  result.decorator.wall = function (...args) {
    wallCalls.push({ s0: args[0], s1: args[1], sg: args[2], off: args[3], depth: args[4], height: args[5], texture: args[6], options: args[7] || {} });
    return wall.apply(this, args);
  };
  return { ...result, api: environment.api, art, wallCalls };
}

test('all inline game scripts parse without executing browser code', () => {
  let count = 0;
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\btype\s*=\s*["'](?:importmap|application\/json)["']/i.test(match[1])) { JSON.parse(match[2]); continue; }
    if (/\bsrc\s*=/i.test(match[1])) continue;
    new vm.Script(match[2], { filename: `${sourcePath}:inline-${++count}` });
  }
  assert(count > 0, 'Expected an inline game script');
});

test('boulevard furnishes both dry street sides and leaves water sides open', () => {
  for (const [L, R, expected] of [
    ['city', 'city', '-1,1'], ['city', 'harbor', '-1'],
    ['town', 'plaza', '-1,1'], ['harbor', 'river', ''],
  ]) {
    const { piece, decorator } = scenery({ L, R });
    api.boulevard(decorator, 0, piece.L);
    assert.equal(frontages(piece), expected, `${L}/${R} shop frontages`);
    assert(piece.sprites.every(s => expected.split(',').includes(String(Math.sign(s.x)))));
  }
});

test('missing harbour promenade receives furnishings on the existing dry quay', () => {
  for (const side of [-1, 1]) {
    const { piece, decorator } = scenery();
    api.dressHarborWalk(decorator, 0, piece.L, side, { tags: [] });
    assert(piece.sprites.length > 0 && piece.walls.length > 0);
    assert(piece.sprites.some(s => s.id.startsWith('walkers')));
    assert(piece.sprites.every(s => Math.sign(s.x) === side));
    assert(piece.sprites.every(s => Math.abs(s.x) - 10 > 0 && Math.abs(s.x) - 10 < 8));
    assert(piece.walls.every(w => w.sg === side && w.off < 9.5 && w.tex === 'rail_balustrade'));
    assert.equal(piece.colliders.length, 0, 'Visual harbour fallback must not change driving collisions');
  }
});

test('existing promenades, frontages and lamps are not duplicated', () => {
  for (const [side, tags] of [
    [1, ['promenade']], [-1, ['seafood']], [-1, ['citytower']],
    [-1, ['beachshops']], [-1, ['nightmarket']], [1, ['nightmarket']],
  ]) {
    const { piece, decorator } = scenery();
    api.dressHarborWalk(decorator, 0, piece.L, side, { tags });
    assert.equal(piece.sprites.length + piece.walls.length, 0, `${side}: ${tags}`);
  }
  const { piece, decorator } = scenery();
  api.dressHarborWalk(decorator, 0, piece.L, 1, { tags: ['lamps'] });
  assert(piece.sprites.length > 0);
  assert(piece.sprites.every(s => s.id !== 'lampC'));
});

test('harbour fallback respects landmark gaps including its railing', () => {
  const { piece, decorator } = scenery({}, { gaps: [[40, 80, 1]] });
  api.dressHarborWalk(decorator, 0, piece.L, 1, { tags: [] });
  assert(piece.walls.some(w => w.s1 <= 40) && piece.walls.some(w => w.s0 >= 80));
  assert(piece.walls.every(w => !overlaps(w.s0, w.s1, 40, 80)));
  assert(piece.sprites.every(s => s.s < 40 || s.s > 80));

  const otherSide = scenery({}, { gaps: [[0, 120, -1]] });
  api.dressHarborWalk(otherSide.decorator, 0, 120, 1, { tags: [] });
  assert(otherSide.piece.sprites.length > 0, 'A landmark only clears its own side');
});

test('bridges and fork mouths stay clear; a widening inner gap is furnished only after it fits', () => {
  for (const section of [{ bridge: 'cable' }, { fork: true }, { diverge: true }]) {
    const { piece, decorator } = scenery();
    api.dressHarborWalk(decorator, 0, piece.L, 1, section);
    assert.equal(piece.sprites.length + piece.walls.length, 0);
  }
  const samples = Math.ceil(120 / api.DS) + 1;
  const narrow = scenery({}, { side: -1, innerFree: Array(samples).fill(5) });
  api.dressHarborWalk(narrow.decorator, 0, 120, 1, {});
  assert.equal(narrow.piece.sprites.length + narrow.piece.walls.length, 0);

  const growing = scenery({}, {
    side: -1, innerFree: Array.from({ length: samples }, (_, i) => i * api.DS < 40 ? 5 : 20),
  });
  api.dressHarborWalk(growing.decorator, 0, 120, 1, {});
  assert(growing.piece.walls.length > 0);
  assert(growing.piece.walls.every(w => w.s0 >= 40));
  assert(growing.piece.sprites.every(s => s.s >= 40));
});

test('rejected houses leave no invisible collision walls', () => {
  for (const overrides of [
    { gaps: [[0, 120, 1]] },
    { side: -1, innerFree: Array(61).fill(2) },
  ]) {
    const { piece, decorator } = scenery({}, overrides);
    api.houseRow(decorator, 0, piece.L, 1, 3.8, {});
    assert.equal(piece.sprites.length, 0);
    assert.equal(piece.colliders.length, 0);
  }
  const { piece, decorator } = scenery();
  api.houseRow(decorator, 0, piece.L, 1, 3.8, {});
  assert(piece.sprites.some(s => s.id.startsWith('townhouse')));
  assert(piece.colliders.length > 0, 'Accepted buildings remain solid');
});

test('a rejected house cannot leave its narrow hanging sign floating in a fork gap', () => {
  // This space admits a small sign but cannot admit the wider shop behind it.
  const { piece, decorator } = scenery({}, { side: -1, innerFree: Array(61).fill(5.5) });
  api.houseRow(decorator, 0, piece.L, 1, 3.8, { vsigns: true });
  assert(piece.sprites.every(s => !/^(townhouse|scooterstore|store)/.test(s.id)));
  assert(piece.sprites.every(s => !s.id.startsWith('vsign')), 'A hanging sign requires its shop facade');
  const accepted = scenery();
  api.houseRow(accepted.decorator, 0, accepted.piece.L, 1, 3.8, { vsigns: true });
  assert(accepted.piece.sprites.some(s => s.id.startsWith('vsign')), 'Accepted shop facades retain their signs');
});

test('milkfish far trees root on a dry dyke between pond bands', () => {
  const offsets = api.milkfishLife.far[2];
  for (const offset of offsets) {
    const index = api.milkfishGround.findIndex(band => offset <= band.w);
    assert(index > 0 && index < api.milkfishGround.length - 1);
    assert.notEqual(api.milkfishGround[index].k, 1, 'Tree roots must be on land');
    assert.equal(api.milkfishGround[index - 1].k, 1);
    assert.equal(api.milkfishGround[index + 1].k, 1);
  }
});

test('classic street art uses noncolliding overhead layers, solid inner shops and at least two metres of arcade', () => {
  for (const side of [-1, 1]) {
    const scene = classicScenery();
    scene.api.houseRow(scene.decorator, 0, 120, side, 3.8, { vsigns: true });
    const upper = scene.wallCalls.filter(w => w.texture.startsWith('pixel_house_upper#'));
    const shop = scene.wallCalls.filter(w => w.texture.startsWith('pixel_house_shop#'));
    const canopy = scene.wallCalls.filter(w => w.texture.startsWith('pixel_house_canopy#'));
    assert(upper.length > 0 && canopy.length > 0, 'The shipped module must actually place its layered pixel shops');
    assert.equal(shop.length, upper.length);
    assert(upper.every(w => w.options.collide === false && w.options.y >= 3));
    assert(canopy.every(w => w.options.collide === false && w.options.y > 2.5));
    assert(scene.wallCalls.filter(w => !shop.includes(w)).every(w => w.options.collide === false));
    assert(shop.every(w => w.options.collide === true && !w.options.y));
    for (const facade of upper) {
      const inner = shop.find(w => w.s0 === facade.s0 && w.s1 === facade.s1);
      assert(inner && inner.off - facade.off >= 2, 'The ground-floor shop must sit behind a real arcade recess');
      const s = (facade.s0 + facade.s1) / 2, x = scene.decorator.lat(s, side, facade.off + 1);
      assert(!scene.piece.colliders.some(c => s > c.s0 && s < c.s1 && x > c.x0 && x < c.x1), 'The passage under the overhead facade must stay physically open');
    }
    const walls = scene.piece.colliders.filter(c => c.kind === 'wall');
    assert.equal(walls.length, shop.reduce((sum, w) => sum + Math.ceil((w.s1 - w.s0) / 6), 0), 'Only the visible inner shop faces create wall colliders');
    assert.equal(scene.piece.colliders.filter(c => c.kind === 'solid').length, upper.length * 2, 'Each visible pair of outer columns remains solid');
    assert(scene.piece.sprites.some(s => s.id.startsWith('vsign')), 'Accepted shops keep their attached signs');
  }
});

test('classic street art rejects complete shops, columns and props in a same-side landmark gap or narrow fork', () => {
  for (const overrides of [
    { gaps: [[0, 120, 1]] },
    { side: -1, innerFree: Array(61).fill(2) },
    { side: -1, innerFree: Array(61).fill(5.5) },
  ]) {
    const scene = classicScenery({}, overrides);
    scene.api.houseRow(scene.decorator, 0, 120, 1, 3.8, { vsigns: true });
    assert.equal(scene.wallCalls.length, 0, 'A rejected building leaves no overhead or ground-floor wall');
    assert.equal(scene.piece.colliders.length, 0, 'A rejected building leaves no invisible shop/column collider');
    assert.equal(scene.piece.sprites.length, 0, 'A rejected building leaves no floating sign or scooter');
  }
  const opposite = classicScenery({}, { gaps: [[0, 120, -1]] });
  opposite.api.houseRow(opposite.decorator, 0, 120, 1, 3.8, { vsigns: true });
  assert(opposite.piece.walls.length > 0, 'A landmark gap only clears its own side');
});

test('classic street art samples a widening fork over the complete building footprint', () => {
  const scene = classicScenery({}, {
    side: -1, innerFree: Array.from({ length: 61 }, (_, i) => i * 2 < 40 ? 5.5 : 20),
  });
  scene.api.houseRow(scene.decorator, 0, 120, 1, 3.8, { vsigns: true });
  assert(scene.piece.walls.length > 0, 'Buildings resume once the inner fork has enough room');
  assert(scene.piece.walls.every(w => w.s0 >= 40));
  assert(scene.piece.sprites.every(s => s.s >= 40));
  const pinched = classicScenery({}, {
    L: 7, side: -1, innerFree: [20, 20, 2, 20, 20, 20, 20, 20],
  });
  pinched.api.houseRow(pinched.decorator, 0, 7, 1, 3.8, { vsigns: true });
  assert.equal(pinched.piece.walls.length + pinched.piece.colliders.length + pinched.piece.sprites.length, 0, 'Clear endpoints cannot hide a pinched sample through the middle of a shop');
});

test('classic street art with unavailable images preserves the original shop fallback', () => {
  const scene = classicScenery({}, {}, false);
  scene.api.houseRow(scene.decorator, 0, 120, 1, 3.8, { vsigns: true });
  assert(scene.piece.sprites.some(s => s.id.startsWith('townhouse')));
  assert(scene.piece.colliders.length > 0);
  assert.equal(scene.piece.walls.length, 0, 'No incomplete pixel facade is placed without its imported parts');
});

test('a late landmark forecourt removes actual classic shop parts without removing the opposite frontage or road guard', () => {
  const scene = classicScenery();
  for (const side of [-1, 1]) scene.api.houseRow(scene.decorator, 0, 120, side, 3.8, { vsigns: true });
  scene.decorator.wall(0, 120, 1, 0, 0, .8, 'rail_balustrade', { collide: false });
  const oppositeCount = scene.piece.walls.filter(w => w.sg === -1).length;
  assert(scene.piece.walls.some(w => w.sg === 1 && w.depth > 0 && overlaps(w.s0, w.s1, 40, 80)));
  scene.decorator.gap(40, 80, 1);
  assert(scene.piece.walls.every(w => !(w.sg === 1 && w.off >= 2.5 && w.depth > 0 && overlaps(w.s0, w.s1, 40, 80))), 'A cleared forecourt must not leave rendered shop walls behind');
  assert(scene.piece.colliders.every(c => !((c.x0 + c.x1) > 0 && overlaps(c.s0, c.s1, 40, 80))));
  assert(scene.piece.sprites.every(s => !(s.x > 0 && s.s >= 40 && s.s <= 80)));
  assert.equal(scene.piece.walls.filter(w => w.sg === -1).length, oppositeCount);
  assert(scene.piece.walls.some(w => w.sg === 1 && w.off === 0 && w.depth === 0), 'The existing safety guard is part of the road');
});
