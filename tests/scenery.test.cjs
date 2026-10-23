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
const context = vm.createContext({ SPR: sprites });
const milkfishGround = uniqueMatch(/^  milkfish: \[[^\r\n]+/gm, 'milkfish ground bands')[0];
const milkfishLife = uniqueMatch(/^  milkfish: \{[^\r\n]+/gm, 'milkfish vegetation')[0];
new vm.Script([
  constLine('TAU'), constLine('clamp'), constLine('DS'), constLine('_varCache'),
  constLine('C_GRASS'), constLine('BAND'), constLine('VERGE'),
  extractBlock(/^const RAIL_TEX = \{/gm, 'RAIL_TEX'),
  ...['mulberry', 'variants', 'pickVar', 'every', 'dressHarborWalk', 'houseRow'].map(name => declaration(name)),
  declaration('Deco', 'class'),
  extractBlock(/^  boulevard\(/gm, 'boulevard', 'function '),
  `globalThis.api = { Deco, dressHarborWalk, houseRow, boulevard, DS,
    milkfishGround: ({${milkfishGround}}).milkfish,
    milkfishLife: ({${milkfishLife}}).milkfish };`,
].join('\n'), { filename: 'index.html:scenery' }).runInContext(context);
const api = context.api;

function scenery(section = {}, overrides = {}) {
  const piece = {
    seed: 1234, L: 120, side: 0, gaps: [],
    sprites: [], colliders: [], walls: [], rails: [], wires: [],
    outerL: () => -10, outerR: () => 10,
    sec: () => section,
    ...overrides,
  };
  const decorator = new api.Deco(piece);
  decorator.sec = section;
  return { piece, decorator };
}

function frontages(piece) {
  return [...new Set(piece.colliders.map(c => Math.sign(c.x0 + c.x1)))].sort().join(',');
}

function overlaps(a, b, c, d) {
  return a < d && b > c;
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
