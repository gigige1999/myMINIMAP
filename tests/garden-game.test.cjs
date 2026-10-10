const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class ElementStub {
  constructor() {
    this.listeners = new Map();
    this.children = new Map();
    this.dataset = {};
    this.attributes = {};
    this.textContent = '';
    this.hidden = false;
    this.open = false;
    this.disabled = false;
    this.isConnected = true;
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name)
    };
  }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
  }
  dispatchEvent(event) {
    for (const fn of this.listeners.get(event.type) || []) fn(event);
  }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click', target: this }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new ElementStub());
    return this.children.get(selector);
  }
  querySelectorAll(selector) {
    if (selector === 'span') return [0, 1, 2, 3].map(index => this.querySelector(`span-${index}`));
    if (selector === '.garden-flower-stamps > span') return [0, 1, 2].map(index => this.querySelector(`flower-stamp-${index}`));
    if (selector === '.garden-entry-link') return [0, 1, 2].map(index => this.querySelector(`entry-link-${index}`));
    return [];
  }
  append(element) { this.appended = element; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
  focus() {}
  scrollIntoView() {}
}

function setup({ saved, clock = 100000, backend, reduced = false } = {}) {
  const elements = new Map();
  const document = new ElementStub();
  document.body = new ElementStub();
  document.activeElement = new ElementStub();
  document.hidden = false;
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new ElementStub());
    return elements.get(id);
  };
  document.createElement = () => new ElementStub();
  const data = backend || new Map([['quiet-lands-night', 'true']]);
  if (saved) data.set('quiet-lands-garden-v1', JSON.stringify(saved));
  const window = new ElementStub();
  window.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)
  };
  const time = { value: clock };
  const intervals = new Set();
  const microtasks = [];
  const renderStates = [];
  const context = vm.createContext({
    window, document,
    Date: { now: () => time.value },
    performance: { now: () => time.value },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setInterval(fn) { intervals.add(fn); return fn; },
    clearInterval(fn) { intervals.delete(fn); },
    queueMicrotask: fn => microtasks.push(fn)
  });
  window.createGardenScene = () => ({ update(state) { renderStates.push(state.stage); } });
  for (const name of ['garden-store.js', 'garden-journal.js', 'garden-game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context, { filename: name });
  }
  const traveler = { state: 'idle', position: { x: 1, z: 1.2 }, remaining: 0, campVisible: false, campPosition: null };
  let destination = null;
  let campCalls = 0;
  const notices = [];
  const explorer = {
    navigation: { nearest: (x, z) => ({ x, z }), canCamp: () => true },
    snapshot: () => ({ ...traveler, position: { ...traveler.position }, campPosition: traveler.campPosition && { ...traveler.campPosition } }),
    moveTo(point) { destination = { ...point }; traveler.remaining = 1; traveler.state = 'walking'; return true; },
    makeCamp() {
      campCalls++;
      traveler.state = 'lighting'; traveler.campVisible = true;
      traveler.campPosition = { x: traveler.position.x, z: traveler.position.z + .68 };
      return true;
    },
    say: message => notices.push(message),
    resetPose() { traveler.remaining = 0; traveler.state = 'idle'; traveler.campVisible = false; traveler.campPosition = null; }
  };
  const section = new ElementStub();
  const game = window.createGardenGame({}, { root: {}, heightAt: () => 0, explorer, reduced: { matches: reduced }, section, invalidate() {} });
  const modalEvents = [];
  const restorationEvents = [];
  // The scene pauses the game when it receives the journal's actual modal event.
  document.addEventListener('journey:journal', event => { modalEvents.push(event.detail.open); game.setActive(!event.detail.open); });
  document.addEventListener('journey:restored', event => restorationEvents.push(event.detail));
  game.setActive(true);
  let frame = 1;
  const update = () => game.update(.04, frame++, 0);
  const click = id => document.getElementById(id).click();
  const arrive = () => { assert(destination, 'a navigation target should be set'); traveler.position = { ...destination }; traveler.remaining = 0; traveler.state = 'idle'; };
  const at = (x, z, state = 'idle') => { traveler.position = { x, z }; traveler.remaining = 0; traveler.state = state; };
  const advance = milliseconds => { time.value += milliseconds; for (const fn of intervals) fn(); };
  const rest = milliseconds => {
    for (let remaining = milliseconds; remaining > 0; remaining -= 500) {
      advance(Math.min(500, remaining));
      update();
    }
  };
  const flush = () => {
    let count = 0;
    while (microtasks.length) { assert(++count < 20, 'journal read/render must not recurse'); microtasks.shift()(); }
  };
  const getSeed = () => { click('gardenAction'); arrive(); update(); assert.equal(game.snapshot().stage, 'seed'); };
  const plantHeldSeed = () => {
    const before = game.snapshot().plantedCount;
    assert.equal(game.snapshot().seedCount, 1);
    click('gardenAction'); arrive(); update();
    traveler.state = 'sitting'; update(); click('gardenAction');
    assert.equal(game.snapshot().plantedCount, before + 1);
    assert.equal(game.snapshot().seedCount, 0);
  };
  const plant = () => { getSeed(); plantHeldSeed(); };
  return { game, traveler, window, document, elements, section, modalEvents, restorationEvents, data, notices, renderStates, time, update, click, arrive, at, advance, rest, flush, getSeed, plant, plantHeldSeed,
    get campCalls() { return campCalls; },
    get destination() { return destination; },
    get dialog() { return document.body.appended; }
  };
}

test('remote clicks only start walking; the seed is awarded once after arrival', () => {
  const app = setup();
  app.click('gardenAction');
  app.update();
  assert.equal(app.game.snapshot().stage, 'new');
  assert.equal(app.game.snapshot().seedCount, 0);
  app.traveler.position = { ...app.destination };
  app.update();
  assert.equal(app.game.snapshot().stage, 'new', 'a passing traveler still following a route must not collect');
  app.arrive();
  app.update();
  assert.equal(app.game.snapshot().seedCount, 1);
  for (let i = 0; i < 10; i++) app.update();
  assert.equal(app.notices.filter(message => message.includes('拾到')).length, 1);
});

test('a seed can only be planted at home after the campfire is lit and the traveler sits', () => {
  const app = setup();
  app.getSeed();
  app.traveler.state = 'sitting'; app.traveler.campVisible = true;
  app.traveler.campPosition = { x: -3.8, z: 0 };
  app.click('gardenAction');
  assert.equal(app.game.snapshot().stage, 'seed', 'an offsite camp cannot consume the seed');
  app.arrive(); app.update();
  assert.equal(app.campCalls, 1);
  assert.equal(app.traveler.state, 'lighting');
  app.click('gardenAction');
  assert.equal(app.game.snapshot().stage, 'seed');
  app.traveler.state = 'sitting'; app.update(); app.click('gardenAction');
  assert.equal(app.game.snapshot().stage, 'growing');
  assert.equal(app.game.snapshot().seedCount, 0);
});

test('the first flower opens during rest and its journal does not block the next planting', () => {
  const app = setup();
  app.plant();
  assert.equal(app.game.snapshot().needsRest, true);
  app.advance(29999); app.update();
  assert.equal(app.game.snapshot().bloomCount, 0);
  app.advance(1); app.update();
  assert.equal(app.game.snapshot().bloomCount, 1);
  assert.equal(app.game.snapshot().entryUnlocked, true);
  for (let i = 0; i < 10; i++) app.update();
  assert.equal(app.notices.filter(message => message.includes('第一朵花开了')).length, 1);
  app.click('journalOpen'); app.flush();
  assert.equal(app.game.snapshot().entryRead, true);
  assert.equal(app.dialog.open, true);
  assert.equal(app.dialog.querySelector('.garden-memory-entry').hidden, false);
  assert.equal(app.dialog.querySelector('.garden-seed-count').textContent, '× 0');
  app.game.closeJournal();
  // The growth boundary above credited a 1 ms interval; complete on the next 500 ms refresh.
  app.rest(Math.ceil(app.game.snapshot().restRemainingMs / 500) * 500);
  assert.equal(app.game.snapshot().canCollect, true);
  app.getSeed(); app.plantHeldSeed();
  assert.equal(app.game.snapshot().plantedCount, 2);
  assert.equal(app.game.snapshot().entryRead, true);
  assert.equal(app.game.snapshot().canCollect, false, 'the second planting starts a fresh rest');
  assert.equal(app.game.snapshot().restRemainingMs, 60000);
});

test('discovering a flower on the way home preserves the second seed’s automatic campfire arrival', () => {
  const app = setup({ saved: {
    version: 2, seedCount: 1,
    flowers: [{ plot: { x: 1.66, z: 1.88 }, plantedAt: 100000 }]
  } });
  app.at(-3.8, -.6); app.update();
  app.advance(30000); app.update();
  assert.equal(app.game.snapshot().entryUnlocked, false);
  app.click('gardenAction');
  const campCallsBeforeReturn = app.campCalls;
  const flower = app.game.snapshot().flowers[0];
  // Walk past the flower while the home route still has distance remaining.
  app.traveler.position = { ...flower.plot };
  assert(Math.hypot(app.traveler.position.x - app.destination.x, app.traveler.position.z - app.destination.z) > .12,
    'the flower is discovered before the home arrival trigger');
  assert.equal(app.traveler.state, 'walking');
  assert(app.traveler.remaining > 0);
  app.update();
  assert.equal(app.game.snapshot().entryUnlocked, true);
  assert.equal(app.game.snapshot().seedCount, 1);
  assert.equal(app.campCalls, campCallsBeforeReturn, 'a passing discovery does not light a fire early');
  assert.equal(app.elements.get('gardenAction').disabled, true, 'the guided return continues after the page unlocks');
  app.arrive(); app.update();
  assert.equal(app.campCalls, campCallsBeforeReturn + 1, 'arriving must still light the campfire without another click');
  assert.equal(app.traveler.state, 'lighting');
  app.traveler.state = 'sitting'; app.update(); app.click('gardenAction');
  assert.equal(app.game.snapshot().plantedCount, 2);
  assert.equal(app.game.snapshot().seedCount, 0);
});

test('the journal pauses location rewards while wall-clock growth continues', () => {
  const app = setup();
  app.plant();
  app.click('journalOpen');
  assert.equal(app.modalEvents.at(-1), true);
  app.advance(30000); app.update(); app.flush();
  assert.equal(app.game.snapshot().stage, 'bloomed');
  assert.equal(app.game.snapshot().entryUnlocked, false);
  app.game.closeJournal();
  assert.equal(app.modalEvents.at(-1), false);
  app.update();
  assert.equal(app.game.snapshot().stage, 'remembered');
  assert.equal(app.game.snapshot().entryRead, false, 'a closed notebook must retain the unread page');
});

test('leaving guidance prevents automatic fire-lighting after manual walking', () => {
  const app = setup();
  app.getSeed();
  app.click('gardenAction');
  app.game.clearGuidance();
  app.at(1, 1.2); app.update();
  assert.equal(app.campCalls, 0);
  app.click('gardenAction');
  assert.equal(app.campCalls, 1, 'the player can still explicitly light a fire');
});

test('restored offline growth waits for a visit before showing the illustration', () => {
  const app = setup({ saved: { version: 1, stage: 'growing', plantedAt: 0, bloomAt: 30000, plot: { x: 1.66, z: 1.88 } } });
  assert.equal(app.game.snapshot().stage, 'bloomed');
  assert.equal(app.game.snapshot().entryUnlocked, false);
  app.at(-3.8, -.6); app.update();
  assert.equal(app.game.snapshot().entryUnlocked, false);
  app.click('gardenAction'); app.arrive(); app.update();
  assert.equal(app.game.snapshot().entryUnlocked, true);
});

test('journal reset consumes no new reward and preserves unrelated local settings', async () => {
  const app = setup();
  app.plant(); app.advance(30000); app.update();
  app.click('journalOpen'); app.flush();
  app.dialog.querySelector('.garden-reset-open').click();
  app.dialog.querySelector('.garden-reset-yes').click();
  await Promise.resolve();
  assert.equal(app.game.snapshot().stage, 'new');
  assert.equal(app.game.snapshot().seedCount, 0);
  assert.equal(app.game.snapshot().entryUnlocked, false);
  assert.equal(app.data.has('quiet-lands-garden-v1'), false);
  assert.equal(app.data.get('quiet-lands-night'), 'true');
  assert.equal(app.traveler.campVisible, false);
  assert.equal(app.dialog.querySelector('.garden-memory-entry').hidden, true);
});

test('returning to a flower planted at the edge of camp must reach its discovery radius', () => {
  const app = setup();
  app.getSeed();
  app.at(1.29, 1.49);
  app.click('gardenAction');
  app.traveler.state = 'sitting'; app.update(); app.click('gardenAction');
  assert.equal(app.game.snapshot().stage, 'growing');
  app.game.clearGuidance(); app.at(-2, -1); app.update();
  app.advance(30000);
  app.click('gardenAction'); app.arrive(); app.update();
  assert.equal(app.game.snapshot().stage, 'remembered', 'the return-to-flower action must bring every valid plot within discovery range');
});

test('restoring a cached page resumes growth updates', () => {
  const app = setup();
  app.plant();
  app.at(-3.8, -.6);
  app.window.dispatchEvent({ type: 'pagehide', persisted: true });
  app.advance(15000);
  app.window.dispatchEvent({ type: 'pageshow', persisted: true });
  app.advance(15000);
  assert.equal(app.game.snapshot().stage, 'bloomed');
  assert.equal(app.game.snapshot().entryUnlocked, false);
});

test('three actual round trips plant distinct flowers and enable exactly one canyon repair', () => {
  const app = setup();
  assert.equal(app.elements.get('canyonRestore').hidden, true);
  app.click('canyonRestore');
  assert.equal(app.game.snapshot().canyonRestored, false, 'even a synthetic early click is rejected');
  for (let index = 0; index < 3; index++) {
    app.click('gardenAction'); app.update();
    assert.equal(app.game.snapshot().seedCount, 0, 'walking to the canyon is not itself a reward');
    app.arrive(); app.update();
    assert.equal(app.game.snapshot().seedCount, 1);
    app.plantHeldSeed();
    assert.equal(app.game.snapshot().plantedCount, index + 1);
    assert.equal(app.game.snapshot().bloomCount, index);
    assert.equal(app.elements.get('gardenFlowerCount').textContent, `${index + 1} / 3`);
    if (index < 2) {
      app.click('canyonRestore');
      assert.equal(app.game.snapshot().canyonRestored, false);
      assert.equal(app.restorationEvents.length, 0);
      app.rest(60000);
      assert.equal(app.game.snapshot().canCollect, true);
    }
  }
  const planted = app.game.snapshot().flowers;
  for (let a = 0; a < planted.length; a++) for (let b = a + 1; b < planted.length; b++) {
    assert.ok(Math.hypot(planted[a].plot.x - planted[b].plot.x, planted[a].plot.z - planted[b].plot.z) >= .36,
      'flower positions must stay separate around the fire');
  }
  assert.equal(app.game.snapshot().canCollect, false);
  assert.equal(app.elements.get('canyonRestore').hidden, false);
  assert.equal(app.elements.get('gardenActionText').textContent, '修复微风峡谷');
  app.click('gardenToggle');
  assert.equal(app.elements.get('gardenDetails').hidden, false);
  app.click('canyonRestore');
  assert.equal(app.game.snapshot().canyonRestored, true);
  assert.equal(app.game.snapshot().plantedCount, 3);
  assert.equal(app.game.snapshot().bloomCount, 2, 'the third flower need not bloom before repairing');
  assert.equal(app.elements.get('gardenDetails').hidden, true, 'finishing repair returns to a compact map');
  assert.equal(app.elements.get('canyonRestore').hidden, true);
  assert.equal(app.section.dataset.canyonRestored, 'true');
  assert.equal(app.restorationEvents.length, 1);
  assert.equal(app.restorationEvents[0].region, 'canyon');
  assert.equal(app.restorationEvents[0].stage, 1);
  app.click('canyonRestore');
  assert.equal(app.restorationEvents.length, 1, 'repeated repair cannot duplicate its reward event');
  const restored = setup({ backend: app.data });
  assert.equal(restored.game.snapshot().canyonRestored, true);
  assert.equal(restored.game.snapshot().flowers.length, 3);
});

test('the quest starts compact and its accessible toggle preference survives reopening', () => {
  const app = setup();
  const toggle = app.elements.get('gardenToggle');
  assert.equal(toggle.attributes['aria-expanded'], 'false');
  assert.equal(toggle.attributes['aria-label'], '展开种花任务，已种 0 朵，共 3 朵');
  assert.equal(app.elements.get('gardenDetails').hidden, true);
  assert.equal(app.elements.get('gardenQuest').classList.contains('is-collapsed'), true);
  app.click('gardenToggle');
  assert.equal(toggle.attributes['aria-expanded'], 'true');
  assert.equal(app.elements.get('gardenDetails').hidden, false);
  assert.equal(app.data.get('quiet-lands-quest-collapsed'), 'false');
  app.plant();
  assert.equal(toggle.attributes['aria-label'], '收起种花任务，已种 1 朵，共 3 朵');
  const reopened = setup({ backend: app.data });
  assert.equal(reopened.elements.get('gardenToggle').attributes['aria-expanded'], 'true');
  assert.equal(reopened.elements.get('gardenDetails').hidden, false);
  reopened.click('gardenToggle');
  assert.equal(reopened.data.get('quiet-lands-quest-collapsed'), 'true');
  assert.equal(reopened.elements.get('gardenToggle').attributes['aria-label'], '展开种花任务，已种 1 朵，共 3 朵');
});

test('only a full minute sitting beside a visible campfire permits another canyon seed', () => {
  const app = setup();
  app.plant();
  assert.equal(app.game.snapshot().restRemainingMs, 60000);
  app.rest(59500);
  assert.equal(app.game.snapshot().restElapsedMs, 59500);
  assert.equal(app.game.snapshot().restRemainingMs, 500);
  assert.equal(app.game.snapshot().canCollect, false);
  app.rest(500);
  assert.equal(app.game.snapshot().needsRest, false);
  assert.equal(app.game.snapshot().canCollect, true);
  app.getSeed();
  assert.equal(app.game.snapshot().seedCount, 1);
  app.plantHeldSeed();
  assert.equal(app.game.snapshot().restRemainingMs, 60000, 'each planting requires a new rest');
});

test('standing up, an unlit fire, hidden pages, chapters, and the journal pause earned rest', () => {
  const app = setup();
  app.plant();
  app.rest(20000);
  assert.equal(app.game.snapshot().restElapsedMs, 20000);
  app.traveler.state = 'standing'; app.rest(10000);
  assert.equal(app.game.snapshot().restElapsedMs, 20000);
  app.traveler.state = 'sitting'; app.traveler.campVisible = false; app.rest(10000);
  assert.equal(app.game.snapshot().restElapsedMs, 20000);
  app.traveler.campVisible = true;
  const fire = app.traveler.campPosition;
  app.traveler.campPosition = null; app.rest(10000);
  assert.equal(app.game.snapshot().restElapsedMs, 20000);
  app.traveler.campPosition = fire;
  app.document.hidden = true;
  app.document.dispatchEvent({ type: 'visibilitychange' });
  app.rest(10000);
  assert.equal(app.game.snapshot().restElapsedMs, 20000);
  app.document.hidden = false;
  app.document.dispatchEvent({ type: 'visibilitychange' });
  app.game.setActive(false); app.rest(10000);
  assert.equal(app.game.snapshot().restElapsedMs, 20000, 'visiting another chapter cannot earn rest');
  app.game.setActive(true);
  app.click('journalOpen'); app.rest(10000); app.flush();
  assert.equal(app.game.snapshot().restElapsedMs, 20000, 'the modal pauses the map and its rest clock');
  app.game.closeJournal(); app.rest(39500);
  assert.equal(app.game.snapshot().restRemainingMs, 500, 'interrupted rest retains previously earned time');
  app.rest(500);
  assert.equal(app.game.snapshot().canCollect, true);
});

test('a suspended frame or offline reload grows the flower but cannot complete rest', () => {
  const app = setup();
  app.plant(); app.rest(10000);
  app.advance(600000); app.update();
  assert.equal(app.game.snapshot().bloomCount, 1);
  assert.equal(app.game.snapshot().restElapsedMs, 10000, 'a long active-tab timer gap is discarded');
  const reopened = setup({ backend: app.data, clock: app.time.value + 600000 });
  assert.equal(reopened.game.snapshot().bloomCount, 1);
  assert.equal(reopened.game.snapshot().restElapsedMs, 10000);
  assert.equal(reopened.game.snapshot().restRemainingMs, 50000);
  assert.equal(reopened.game.snapshot().canCollect, false);
  reopened.at(-3.8, -.6); reopened.update(); reopened.rest(60000);
  assert.equal(reopened.game.snapshot().seedCount, 0, 'manual arrival at the seed cannot bypass rest');
  assert.equal(reopened.game.snapshot().restElapsedMs, 10000, 'walking or waiting in the canyon does not count');
});

test('reduced motion earns seated rest through the refresh timer without animation frames', () => {
  const app = setup({ reduced: true });
  app.plant();
  for (let index = 0; index < 120; index++) app.advance(500);
  assert.equal(app.game.snapshot().restElapsedMs, 60000);
  assert.equal(app.game.snapshot().canCollect, true);
  assert.equal(app.game.snapshot().bloomCount, 1);
});

test('rest survives a browser cache restore without counting time spent away', () => {
  const app = setup();
  app.plant(); app.rest(15000);
  app.window.dispatchEvent({ type: 'pagehide', persisted: true });
  app.advance(300000);
  assert.equal(app.game.snapshot().restElapsedMs, 15000);
  app.window.dispatchEvent({ type: 'pageshow', persisted: true });
  assert.equal(app.game.snapshot().restElapsedMs, 15000);
  assert.equal(app.game.snapshot().bloomCount, 1);
  app.rest(45000);
  assert.equal(app.game.snapshot().canCollect, true);
});

test('every witnessed flower brings a different illustration and only the displayed page is read', () => {
  const app = setup();
  const images = [];
  for (let index = 0; index < 3; index++) {
    app.plant();
    app.advance(30000); app.update();
    assert.equal(app.game.snapshot().entryCount, index + 1);
    assert.equal(app.game.snapshot().unreadCount, 1);
    assert.equal(app.elements.get('journalCount').textContent, String(index + 1));
    app.click('journalOpen');
    assert.equal(app.dialog.querySelector('.garden-page-position').textContent, `0${index + 1} / 03`);
    app.flush();
    const snapshot = app.game.snapshot();
    assert.equal(snapshot.entries[index].read, true);
    assert.equal(snapshot.unreadCount, 0);
    assert.equal(snapshot.entryRead, true);
    images.push(app.dialog.querySelector('.garden-memory-art').src);
    if (index < 2) {
      app.dialog.querySelector('.garden-page-next').click(); app.flush();
      assert.equal(app.dialog.querySelector('.garden-memory-entry').hidden, true);
      assert.equal(app.game.snapshot().entries[index + 1].read, false, 'locked-page browsing never reads it');
    }
    app.game.closeJournal();
    if (index < 2) app.rest(app.game.snapshot().restRemainingMs);
  }
  assert.equal(new Set(images).size, 3, 'each flower uses a distinct real illustration');
  assert.equal(app.game.snapshot().needsRest, false, 'there is no fourth trip to lock after the third flower');
  const reopened = setup({ backend: app.data, clock: app.time.value });
  assert.equal(reopened.game.snapshot().entryCount, 3);
  assert.equal(reopened.game.snapshot().unreadCount, 0);
});
