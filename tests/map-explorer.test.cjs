const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// Rendering is deliberately stubbed; navigation and state changes use the app's scripts.
class Vector {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  multiplyScalar(s) { return this.set(this.x * s, this.y * s, this.z * s); }
  normalize() { return this.multiplyScalar(1 / (Math.hypot(this.x, this.y, this.z) || 1)); }
  addScaledVector(v, s) { return this.set(this.x + v.x * s, this.y + v.y * s, this.z + v.z * s); }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
}

class ElementStub {
  constructor() { this.listeners = {}; this.dataset = {}; this.textContent = ''; this.label = {}; }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  emit(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
  querySelector() { return this.label; }
  setAttribute() {}
  closest() { return null; }
  focus() {}
}

function setup({ obstacles = [], bridge = undefined, reduced = false } = {}) {
  const elements = new Map(), window = new ElementStub(), document = new ElementStub();
  document.hidden = false;
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new ElementStub());
    return elements.get(id);
  };
  const THREE = {
    Vector3: Vector,
    MathUtils: {
      lerp: (a, b, t) => a + (b - a) * t,
      smoothstep: (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    }
  };
  const sceneSource = source('map-scene.js');
  const terrainStart = sceneSource.indexOf('const hill =');
  const terrainEnd = sceneSource.indexOf('const vertices=');
  assert(terrainStart >= 0 && terrainEnd > terrainStart, 'map terrain definitions must be available');
  const terrain = new Function('THREE', `${sceneSource.slice(terrainStart, terrainEnd)} return { heightAt, inside, riverX };`)(THREE);
  for (const name of ['map-navigation.js', 'map-explorer.js']) {
    new Function('window', 'document', 'Element', source(name))(window, document, ElementStub);
  }
  window.createMapTraveler = () => ({
    camp: { visible: false },
    setPosition() {}, setHeading() {}, showTarget() {}, hideTarget() {},
    setCamp() { this.placed = true; },
    clearCamp() { this.placed = false; this.camp.visible = false; },
    update(dt, time, state) { this.camp.visible = !!this.placed && ['lighting', 'sitting', 'standing'].includes(state); }
  });
  let requested = true, time = 0;
  const explorer = window.createMapExplorer(THREE, {
    ...terrain, obstacles,
    bridge: bridge === undefined ? { x: terrain.riverX(.1), z: .1, rotation: -.15, height: .633 } : bridge,
    root: {}, camera: { getWorldDirection(v) { v.set(0, 0, -1); } },
    canvas: new ElementStub(), section: new ElementStub(),
    reduced: { matches: reduced }, mobile: { matches: false },
    invalidate() { requested = true; }
  });
  explorer.setActive(true);
  return {
    explorer, terrain,
    clickCamp() { elements.get('travelerCamp').emit('click'); },
    key(type, code) { document.emit(type, { code, target: new ElementStub(), preventDefault() {} }); },
    tick(count = 1) {
      for (let i = 0; i < count; i++) {
        time += .04;
        // Match the scene's reduced-motion render gate, including invalidation.
        if (!reduced || requested || explorer.needsAnimation) {
          explorer.update(.04, time, 0);
          requested = false;
        }
      }
    }
  };
}

function checkPath(navigation, route, visit = () => {}) {
  assert(route && route.length > 1, 'a reachable destination must have a route');
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .02);
    for (let sample = 0; sample <= count; sample++) {
      const t = sample / count, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      assert(navigation.isWalkable(x, z), 'smoothed segments must not cut through water or obstacles');
      assert(Number.isFinite(navigation.heightAt(x, z)));
      visit(x, z);
    }
  }
}

test('routes cross the real bridge and avoid obstacles, river and island edges', () => {
  const { explorer, terrain } = setup({ obstacles: [{ x: 2, z: 1.2, radius: .24 }] });
  const navigation = explorer.navigation;
  assert.equal(navigation.isWalkable(2, 1.2), false);
  assert.equal(navigation.isWalkable(100, 100), false);
  assert.equal(navigation.isWalkable(terrain.riverX(2), 2), false);
  const detour = navigation.findPath({ x: 1, z: 1.2 }, { x: 3, z: 1.2 });
  checkPath(navigation, detour);
  assert(detour.length > 2, 'the tree must require a detour');
  let crossingSamples = 0;
  checkPath(navigation, navigation.findPath({ x: 1, z: 1.2 }, { x: -4, z: 1.8 }), (x, z) => {
    if (Math.abs(x - terrain.riverX(z)) < .5) {
      crossingSamples++;
      assert(Math.abs(navigation.heightAt(x, z) - .633) < .002, 'river crossing uses the bridge deck');
    }
  });
  assert(crossingSamples > 0);
  const noBridge = setup({ bridge: false }).explorer.navigation;
  assert.equal(noBridge.findPath({ x: 1, z: 1.2 }, { x: -4, z: 1.8 }), null);
});

test('camping at the initial clearing moves from lighting to sitting, then stands to walk', () => {
  const app = setup(), explorer = app.explorer;
  const start = explorer.snapshot().position;
  assert(explorer.navigation.canCamp(start.x, start.z), 'the initial location must allow immediate camping');
  app.clickCamp();
  assert.equal(explorer.snapshot().state, 'lighting');
  app.tick(40);
  assert.equal(explorer.snapshot().state, 'sitting');
  assert.equal(explorer.snapshot().campVisible, true);
  explorer.moveTo({ x: -4, z: 1.8 });
  assert.equal(explorer.snapshot().state, 'standing');
  app.tick(300);
  assert.equal(explorer.snapshot().state, 'idle');
  assert.equal(explorer.snapshot().campVisible, false);
  assert(Math.hypot(explorer.snapshot().position.x + 4, explorer.snapshot().position.z - 1.8) < .02);
});

test('the current tent layout leaves the seed round trip and home campfire usable', () => {
  const restorationSource = source('map-restoration.js');
  const tentDefinition = restorationSource.match(/const\s+tentPoint\s*=\s*(\{[^}]+\})\s*;/);
  const footprintDefinition = restorationSource.match(/footprint\s*:\s*\{\s*\.\.\.tentPoint\s*,\s*radius\s*:\s*([\d.]+)\s*\}/);
  assert(tentDefinition && footprintDefinition, 'derive the obstacle from the production tent layout');
  const tentPoint = new Function(`return (${tentDefinition[1]});`)();
  const obstacle = { ...tentPoint, radius: Number(footprintDefinition[1]) };
  const gameSource = source('garden-game.js');
  const homeDefinition = gameSource.match(/const\s+home\s*=\s*(\{[^}]+\})\s*;/);
  const seedDefinition = gameSource.match(/const\s+canyon\s*=\s*explorer\.navigation\.nearest\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  assert(homeDefinition && seedDefinition, 'the route uses the game’s actual home and seed destinations');
  const home = new Function(`return (${homeDefinition[1]});`)();
  const app = setup({ obstacles: [obstacle] });
  const explorer = app.explorer, navigation = explorer.navigation;
  assert.equal(navigation.isWalkable(tentPoint.x, tentPoint.z), false, 'the tent remains a solid obstacle');
  assert.equal(navigation.canCamp(home.x, home.z), true, 'the tent must not consume the home fire clearing');
  const seed = navigation.nearest(Number(seedDefinition[1]), Number(seedDefinition[2]));
  assert(seed, 'the canyon seed has a reachable landing');
  for (const [from, to] of [[home, seed], [seed, home]]) {
    let bridgeSamples = 0;
    checkPath(navigation, navigation.findPath(from, to), (x, z) => {
      if (Math.abs(x - app.terrain.riverX(z)) < .5) {
        bridgeSamples++;
        assert(Math.abs(navigation.heightAt(x, z) - .633) < .002, 'the seed trip crosses over the bridge deck');
      }
    });
    assert(bridgeSamples > 0, 'both legs must cross the river on the bridge');
    assert.equal(explorer.moveTo(to), true);
    app.tick(500);
    const arrival = explorer.snapshot();
    assert.equal(arrival.state, 'idle');
    assert.equal(arrival.remaining, 0);
    assert(Math.hypot(arrival.position.x - to.x, arrival.position.z - to.z) < .02);
  }
  assert.equal(explorer.makeCamp(), true, 'bringing a seed home must allow lighting the real campfire');
  app.tick(40);
  assert.equal(explorer.snapshot().state, 'sitting');
  assert.equal(explorer.snapshot().campVisible, true);
  const fire = explorer.snapshot().campPosition;
  assert(fire && navigation.canCamp(fire.x, fire.z), 'the fire itself also fits clear of the tent');
});

test('leaving the map pauses the journey and returning resumes it', () => {
  const app = setup(), explorer = app.explorer;
  explorer.moveTo({ x: -4, z: 1.8 });
  app.tick(10);
  explorer.setActive(false);
  const paused = JSON.stringify(explorer.snapshot());
  app.tick(80);
  assert.equal(JSON.stringify(explorer.snapshot()), paused);
  explorer.setActive(true);
  app.tick(300);
  assert.equal(explorer.snapshot().remaining, 0);
  assert.equal(explorer.snapshot().state, 'idle');
});

test('keyboard movement stops at water and reduced-motion key release returns to idle', () => {
  const app = setup({ reduced: true }), explorer = app.explorer;
  app.key('keydown', 'KeyA');
  app.tick(100);
  const bank = explorer.snapshot().position;
  assert(explorer.navigation.isWalkable(bank.x, bank.z));
  assert(bank.x > app.terrain.riverX(bank.z) + .49, 'keyboard input must not cross water');
  app.key('keyup', 'KeyA');
  app.tick(40);
  explorer.moveTo({ x: 1, z: 1.2 });
  app.tick(100);
  app.key('keydown', 'KeyD');
  app.tick(40); // Longer than the settling animation, so only key state keeps rendering alive.
  assert.equal(explorer.snapshot().state, 'walking');
  app.key('keyup', 'KeyD');
  app.tick();
  assert.equal(explorer.snapshot().state, 'idle');
  app.tick(50);
  assert.equal(explorer.needsAnimation, false);
});
