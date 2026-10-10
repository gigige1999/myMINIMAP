const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
class Vector {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  setScalar(s) { return this.set(s, s, s); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector(this.x, this.y, this.z); }
  add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  multiplyScalar(s) { return this.set(this.x * s, this.y * s, this.z * s); }
  normalize() { return this.multiplyScalar(1 / (this.length() || 1)); }
}
class RenderStub {
  constructor() { this.position = new Vector(); this.scale = new Vector(1, 1, 1); this.rotation = new Vector(); this.quaternion = { setFromUnitVectors() {} }; }
  add() {}
  updateMatrix() {}
  setMatrixAt() {}
}
function setup({ obstacles = [], flowers = [], saved = null, landmarks = false } = {}) {
  const THREE = { MathUtils: {
    lerp: (a, b, t) => a + (b - a) * t,
    smoothstep(x, a, b) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  }};
  const scene = source('map-scene.js');
  const terrain = new Function('THREE', `${scene.slice(scene.indexOf('const hill ='), scene.indexOf('const vertices='))} return { heightAt, inside, riverX };`)(THREE);
  const window = {};
  for (const file of ['map-navigation.js', 'tent-placement.js']) new Function('window', source(file))(window);
  if (landmarks) {
    const rendering = { ...THREE, Vector2: Vector, Vector3: Vector };
    for (const name of ['BoxGeometry', 'ConeGeometry', 'CylinderGeometry', 'ExtrudeGeometry', 'Group', 'IcosahedronGeometry', 'InstancedMesh', 'Mesh', 'MeshStandardMaterial', 'Object3D', 'Shape', 'TorusGeometry']) rendering[name] = RenderStub;
    new Function('window', source('map-landmarks.js'))(window);
    obstacles = [...obstacles, ...window.buildMapLandmarks(rendering, new RenderStub(), terrain.heightAt, () => .5).obstacles,
      { x: -5.18, z: -2.45, radius: .64 }];
  }
  let raw = saved, writes = 0, committed = null;
  const initial = { x: 1.7, z: -.3 };
  const navigation = window.createMapNavigation({ ...terrain, obstacles: [...obstacles, { ...initial, radius: .58 }], bridge: { height: .633 } });
  const traveler = { position: { x: 1, z: 1.2 }, campPosition: null };
  const placement = window.createTentPlacement({ ...terrain, navigation, initial, obstacles,
    storage: { getItem() { return raw; }, setItem(key, value) { assert.equal(key, 'quiet-lands-tent-v1'); raw = value; writes++; } },
    getTraveler: () => traveler, getFlowers: () => flowers,
    onCommit(point) { committed = point; }
  });
  return { navigation, placement, traveler, terrain, flowers, get writes() { return writes; }, get committed() { return committed; }, get raw() { return raw; } };
}
function validGrass(app) {
  for (let z = -3.8; z <= 3.8; z += .4) for (let x = -5.8; x <= 5.8; x += .4) {
    const point = { x, z };
    if (app.placement.preview(point).valid && app.placement.place(point).valid) return point;
  }
  assert.fail('the real island must contain a safe movable tent clearing');
}
test('navigation rebuild removes the old tent collider and reroutes around its new position', () => {
  const app = setup(), nav = app.navigation, original = app.placement.position;
  const point = validGrass(app);
  assert.notDeepEqual(point, original);
  assert.equal(nav.isWalkable(original.x, original.z), true);
  assert.equal(nav.isWalkable(point.x, point.z), false);
  assert.deepEqual(app.committed, point);
  assert(app.writes > 0);
  assert.deepEqual(JSON.parse(app.raw).position, point);
  const route = nav.findPath({ x: 1, z: 1.2 }, nav.nearest(-3.8, -.6));
  assert(route?.length > 1);
  for (let index = 1; index < route.length; index++) {
    const from = route[index - 1], to = route[index], length = Math.hypot(to.x - from.x, to.z - from.z);
    const samples = Math.ceil(length / .03);
    for (let sample = 0; sample <= samples; sample++) {
      const t = sample / samples;
      assert(nav.isWalkable(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t));
    }
  }
  assert(nav.canCamp(1, 1.2), 'moving the shelter preserves the home campfire');
});
test('placement refuses water, bridge, steep slopes, landmarks, flowers and the traveler', () => {
  const app = setup({ obstacles: [{ x: 4, z: 1.3, radius: .3 }], flowers: [{ plot: { x: 0, z: 3 } }] });
  const invalid = [{ x: 100, z: 100 }, { x: app.terrain.riverX(-1), z: -1 },
    { x: app.terrain.riverX(.1), z: .1 }, { x: 2.9, z: -1.3 }, { x: 4, z: 1.3 },
    { x: 0, z: 3 }, { x: 1, z: 1.2 }, { x: -3.8, z: -.6 }];
  const original = app.placement.position;
  for (const point of invalid) {
    assert.equal(app.placement.place(point).valid, false, JSON.stringify(point));
    assert.deepEqual(app.placement.position, original);
  }
  assert.equal(app.writes, 0);
  assert.equal(app.navigation.isWalkable(original.x, original.z), false);
  const field = validGrass(setup());
  app.traveler.position = field;
  assert.equal(app.placement.preview(field).valid, false);
  app.traveler.position = { x: 1, z: 1.2 }; app.traveler.campPosition = field;
  assert.equal(app.placement.preview(field).valid, false);
});
test('a saved location is revalidated and restored without writing any unrelated storage', () => {
  const first = setup(), point = validGrass(first);
  const restored = setup({ saved: first.raw });
  assert.equal(restored.placement.restore(), true);
  assert.deepEqual(restored.placement.position, point);
  assert.equal(restored.writes, 0);
  const occupied = setup({ saved: first.raw, flowers: [{ plot: point }] });
  assert.equal(occupied.placement.restore(), false);
  assert.deepEqual(occupied.placement.position, { x: 1.7, z: -.3 });
  const corrupt = setup({ saved: '{broken' });
  assert.equal(corrupt.placement.restore(), false);
});
test('the complete landmark layout has safe relocation clearings on both sides of the river', () => {
  for (const side of [-1, 1]) {
    const app = setup({ landmarks: true });
    let found = null;
    for (let z = -3.8; z <= 3.8 && !found; z += .2) for (let x = -5.8; x <= 5.8 && !found; x += .2) {
      if (Math.sign(x - app.terrain.riverX(z)) !== side) continue;
      const point = { x, z };
      if (app.placement.preview(point).valid && app.placement.place(point).valid) found = point;
    }
    assert(found, `the ${side < 0 ? 'canyon' : 'sanctuary'} bank must contain a clear, reachable tent location`);
    assert(app.navigation.findPath({ x: 1, z: 1.2 }, app.navigation.nearest(-3.8, -.6)));
  }
});
test('clearing hints stay valid, limited and separated, and nearby snapping preserves free placement', () => {
  const app = setup({ landmarks: true });
  const hints = app.placement.hints();
  assert(hints.length >= 4 && hints.length <= 6);
  assert(app.placement.hints(5).length <= 5);
  assert(hints.some(point => point.x < app.terrain.riverX(point.z)), 'offer a canyon clearing');
  assert(hints.some(point => point.x > app.terrain.riverX(point.z)), 'offer an eastern clearing');
  for (const point of hints) assert(app.placement.preview(point).valid);
  const hint = hints[0];
  assert.deepEqual(app.placement.snap({ x: hint.x + .2, z: hint.z }, hints), hint);
  const free = { x: 7, z: 4 };
  assert.deepEqual(app.placement.snap(free, hints), free, 'distant dragging remains free');
  app.flowers.push({ plot: hint });
  assert(!app.placement.hints().some(point => point.x === hint.x && point.z === hint.z), 'a newly planted flower removes its clearing hint');
  const near = { x: hint.x + .2, z: hint.z };
  assert.deepEqual(app.placement.snap(near, hints), near, 'previous hints are revalidated before snapping');
  assert.equal(app.writes, 0, 'hints and snapping never move or save the tent');
});
