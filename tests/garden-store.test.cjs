const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KEY = 'quiet-lands-garden-v1';
const source = fs.readFileSync(path.join(__dirname, '..', 'garden-store.js'), 'utf8');

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); }
  };
}

function setup({ saved, clock = 100000, backend = storage(), unavailable = false } = {}) {
  const window = {};
  if (unavailable) Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
  else window.localStorage = backend;
  vm.runInNewContext(source, { window });
  if (saved !== undefined) backend.setItem(KEY, saved);
  const changes = [];
  const time = { value: clock };
  const create = () => window.createGardenStore({ now: () => time.value, onChange: next => changes.push(next) });
  return { store: create(), create, time, changes, backend };
}

function finishRest(store, time) {
  while (store.snapshot().needsRest) {
    time.value += 1000;
    store.addRest(1000);
  }
}

test('only one seed is carried at a time and planting requires a valid position', () => {
  const { store, changes } = setup();
  assert.equal(store.plant({ x: 0, z: 0 }), false);
  assert.equal(store.collectSeed(), true);
  assert.equal(store.collectSeed(), false);
  assert.equal(store.snapshot().seedCount, 1);
  for (const plot of [null, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: '1', z: 0 }, { x: 99, z: 0 }]) {
    assert.equal(store.plant(plot), false);
  }
  assert.equal(store.plant({ x: -2, z: 1 }), true);
  assert.equal(store.snapshot().stage, 'growing');
  assert.equal(store.snapshot().seedCount, 0);
  assert.equal(store.plant({ x: 1, z: 1 }), false);
  assert.equal(store.snapshot().canCollect, false);
  assert.equal(store.snapshot().needsRest, true);
  assert.equal(changes.length, 2);
});

test('growth takes 30 seconds and only witnessing a mature flower unlocks its page', () => {
  const { store, time, changes } = setup();
  store.collectSeed();
  store.plant({ x: 1, z: 1 });
  assert.equal(store.witnessBloom(), false);
  assert.equal(store.markRead(), false);
  time.value += 29999;
  assert.equal(store.tick(), false);
  assert.equal(store.snapshot().entryUnlocked, false);
  time.value += 1;
  assert.equal(store.tick(), true);
  assert.equal(store.snapshot().stage, 'bloomed');
  assert.equal(store.snapshot().entryUnlocked, false);
  for (let i = 0; i < 60; i++) assert.equal(store.tick(), false);
  assert.equal(changes.length, 3, 'unchanged animation frames must not notify or save');
  assert.equal(store.witnessBloom(), true);
  assert.equal(store.witnessBloom(), false);
  assert.equal(store.snapshot().stage, 'remembered');
  assert.equal(store.snapshot().entryUnlocked, true);
  assert.equal(store.markRead(), true);
  assert.equal(store.markRead(), false);
});

test('reload completes offline growth and preserves the unlocked, read journal', () => {
  const { store, create, time } = setup();
  store.collectSeed();
  store.plant({ x: -3, z: 2 });
  time.value += 5000;
  assert.equal(create().snapshot().stage, 'growing');
  time.value += 100000;
  const afterTrip = create();
  assert.equal(afterTrip.snapshot().stage, 'bloomed');
  assert.equal(afterTrip.snapshot().entryUnlocked, false);
  afterTrip.witnessBloom();
  afterTrip.markRead();
  const journal = create().snapshot();
  assert.equal(journal.stage, 'remembered');
  assert.equal(journal.entryRead, true);
  assert.equal(journal.plot.x, -3);
});

test('snapshots and supplied coordinates cannot mutate the internal state', () => {
  const { store, changes } = setup();
  store.collectSeed();
  const plot = { x: 1, z: 2 };
  store.plant(plot);
  plot.x = 100;
  const copy = store.snapshot();
  copy.stage = 'remembered';
  copy.plot.x = 200;
  copy.flowers[0].plot.x = 300;
  copy.flowers[0].witnessed = true;
  copy.flowers[0].entryRead = true;
  copy.entries[0].unlocked = true;
  copy.flowers.push({ id: 'flower-2' });
  changes[1].plot.z = 100;
  changes[1].flowers[0].plot.z = 200;
  assert.equal(store.snapshot().stage, 'growing');
  assert.equal(store.snapshot().plot.x, 1);
  assert.equal(store.snapshot().plot.z, 2);
  assert.equal(store.snapshot().flowers.length, 1);
  assert.equal(store.snapshot().flowers[0].witnessed, false);
  assert.equal(store.snapshot().flowers[0].entryRead, false);
  assert.equal(store.snapshot().entries[0].unlocked, false);
});

test('invalid saves recover without granting a flower or journal', () => {
  for (const saved of ['broken {', 'null', '{}', JSON.stringify({ version: 1, stage: 'cheated', entryUnlocked: true }), JSON.stringify({ version: 2, stage: 'remembered' })]) {
    const { store } = setup({ saved });
    assert.equal(store.snapshot().stage, 'new');
    assert.equal(store.snapshot().entryUnlocked, false);
    assert.equal(store.snapshot().storageAvailable, true);
  }
  const { store } = setup({ saved: JSON.stringify({ version: 1, stage: 'remembered', plantedAt: 0, plot: { x: 100, z: 0 }, entryRead: true }) });
  assert.equal(store.snapshot().stage, 'seed');
  assert.equal(store.snapshot().entryUnlocked, false);
});

test('future or invalid timestamps restart growth without trusting saved unlock flags', () => {
  for (const plantedAt of [999999, null, 'NaN', '100', -100]) {
    const { store, time } = setup({ saved: JSON.stringify({ version: 1, stage: 'remembered', plantedAt, bloomAt: 1, plot: { x: 1, z: 1 }, entryUnlocked: true, entryRead: true }) });
    assert.equal(store.snapshot().stage, 'growing');
    assert.equal(store.snapshot().plantedAt, time.value);
    assert.equal(store.snapshot().bloomAt, time.value + 30000);
    assert.equal(store.snapshot().entryUnlocked, false);
    assert.equal(store.snapshot().entryRead, false);
  }
  const { store } = setup({ saved: JSON.stringify({ version: 1, stage: 'remembered', plantedAt: 90000, bloomAt: 1, plot: { x: 1, z: 1 } }) });
  assert.equal(store.snapshot().stage, 'growing', 'saved bloomAt cannot shorten the growth interval');
});

test('denied storage access or writes still allow the full journey in memory', () => {
  const blockedWrites = storage();
  blockedWrites.setItem = () => { throw new Error('quota exceeded'); };
  const blockedRead = storage();
  blockedRead.getItem = () => { throw new Error('denied'); };
  for (const fixture of [setup({ unavailable: true }), setup({ backend: blockedWrites }), setup({ backend: blockedRead })]) {
    const { store, time } = fixture;
    assert.equal(store.collectSeed(), true);
    assert.equal(store.snapshot().storageAvailable, false);
    store.plant({ x: 1, z: 1 });
    time.value += 30000;
    store.tick();
    store.witnessBloom();
    assert.equal(store.snapshot().entryUnlocked, true);
  }
});

test('reset removes only this game save and reports only a state change', () => {
  const backend = storage({ 'quiet-lands-night': 'true', 'quiet-lands-explored': '["canyon"]' });
  const { store, changes, create } = setup({ backend });
  assert.equal(store.reset(), false);
  store.collectSeed();
  assert.equal(store.reset(), true);
  assert.equal(store.snapshot().stage, 'new');
  assert.equal(backend.getItem(KEY), null);
  assert.equal(backend.getItem('quiet-lands-night'), 'true');
  assert.equal(backend.getItem('quiet-lands-explored'), '["canyon"]');
  assert.equal(create().snapshot().stage, 'new');
  assert.equal(changes.length, 2);
  assert.equal(store.reset(), false);
});

test('three flowers require a rest between trips and restore the canyon only once', () => {
  const { store, create, time } = setup();
  assert.equal(store.snapshot().version, 3);
  assert.equal(store.snapshot().canCollect, true);
  assert.equal(store.snapshot().canRestore, false);
  assert.equal(store.restoreCanyon(), false);
  for (let i = 0; i < 3; i++) {
    assert.equal(store.collectSeed(), true);
    assert.equal(store.snapshot().canCollect, false);
    assert.equal(store.collectSeed(), false, 'carried seed cannot be duplicated');
    assert.equal(store.plant({ x: 1 + i * .2, z: 1 }), true);
    assert.equal(store.snapshot().plantedCount, i + 1);
    assert.equal(store.snapshot().bloomCount, 0);
    assert.equal(store.snapshot().canCollect, false);
    assert.equal(store.snapshot().needsRest, i < 2);
    assert.equal(store.snapshot().canRestore, i === 2);
    if (i < 2) {
      assert.equal(store.restoreCanyon(), false);
      assert.equal(store.collectSeed(), false, 'planting does not immediately permit another trip');
      finishRest(store, time);
      assert.equal(store.snapshot().canCollect, true);
    }
  }
  assert.equal(store.collectSeed(), false, 'three-flower MVP cannot award a fourth seed');
  assert.equal(store.plant({ x: 2, z: 2 }), false);
  assert.equal(store.restoreCanyon(), true, 'restoration counts planted flowers, not elapsed growth');
  assert.equal(store.restoreCanyon(), false);
  assert.equal(store.snapshot().canRestore, false);
  assert.equal(store.snapshot().flowers.length, 3, 'restoration does not consume flowers');
  assert.equal(create().snapshot().canyonRestored, true);
  assert.equal(create().snapshot().plantedCount, 3);
});

test('each migrated flower grows independently offline while an existing seed remains usable', () => {
  const { store, create, time } = setup({ saved: JSON.stringify({
    version: 2, seedCount: 1,
    flowers: [
      { plot: { x: 1, z: 1 }, plantedAt: 90000 },
      { plot: { x: 1.3, z: 1 }, plantedAt: 100000 }
    ]
  }) });
  assert.equal(store.snapshot().needsRest, false, 'migration never revokes a carried seed');
  time.value += 20000;
  assert.equal(store.tick(), true);
  const firstBloom = store.snapshot();
  assert.equal(firstBloom.stage, 'seed', 'carried seed takes priority in the legacy stage');
  assert.equal(firstBloom.bloomCount, 1);
  assert.equal(firstBloom.flowers[0].bloomed, true);
  assert.equal(firstBloom.flowers[1].bloomed, false);
  assert.equal(firstBloom.plot.x, 1, 'focus is the oldest unseen bloom');
  const restored = create();
  assert.equal(restored.snapshot().seedCount, 1);
  assert.equal(restored.snapshot().bloomCount, 1);
  restored.plant({ x: 1.6, z: 1 });
  time.value += 30000;
  const afterTrip = create();
  assert.equal(afterTrip.snapshot().bloomCount, 3);
  assert.equal(afterTrip.snapshot().stage, 'bloomed');
  assert.equal(afterTrip.snapshot().entryUnlocked, false, 'offline growth does not witness flowers');
  assert.equal(afterTrip.tick(), false);
});

test('each flower unlocks its own illustration and reading one never marks the others read', () => {
  const { store, time, create } = setup();
  for (let i = 0; i < 3; i++) {
    store.collectSeed();
    store.plant({ x: 1 + i * .2, z: 1 });
    if (i < 2) finishRest(store, time);
  }
  assert.equal(store.witnessBloom('flower-1'), false);
  time.value += 30000;
  store.tick();
  assert.equal(store.witnessBloom('absent-flower'), false);
  assert.equal(store.witnessBloom('flower-2'), true);
  assert.equal(store.witnessBloom('flower-2'), false);
  assert.equal(store.snapshot().entryUnlocked, true);
  assert.equal(store.snapshot().entryCount, 1);
  assert.equal(store.snapshot().unreadCount, 1);
  assert.equal(store.snapshot().entries[0].unlocked, false);
  assert.equal(store.snapshot().entries[1].unlocked, true);
  assert.equal(store.markRead(), false, 'default first page remains locked');
  assert.equal(store.markRead('flower-3'), false, 'unseen pages cannot be read');
  assert.equal(store.markRead('absent-flower'), false);
  assert.equal(store.markRead('flower-2'), true);
  assert.equal(store.snapshot().entryRead, true, 'all currently unlocked pages have been read');
  assert.equal(store.witnessBloom(), true, 'omitting the id witnesses the first unseen bloom');
  assert.equal(store.snapshot().flowers[0].witnessed, true);
  assert.equal(store.snapshot().entryUnlocked, true);
  assert.equal(store.snapshot().entryRead, false, 'the new unread page clears the legacy all-read flag');
  assert.equal(store.markRead(), true);
  assert.equal(store.witnessBloom(), true);
  assert.equal(store.witnessBloom(), false);
  assert.equal(store.snapshot().entryCount, 3);
  assert.equal(store.snapshot().unreadCount, 1);
  assert.equal(store.markRead('flower-3'), true);
  assert.equal(store.markRead('flower-3'), false);
  assert.equal(store.snapshot().entryRead, true);
  assert.equal(store.snapshot().stage, 'remembered');
  assert.equal(store.snapshot().plot.x, 1.4, 'focus falls back to the last flower after witnessing');
  assert.equal(create().snapshot().entryCount, 3);
  assert.equal(create().snapshot().unreadCount, 0);
});

test('version 1 saves migrate to the same storage key and keep the first flower and read page', () => {
  const { store, backend, time } = setup({ saved: JSON.stringify({
    version: 1, stage: 'remembered', seedCount: 0,
    plantedAt: 1000, bloomAt: 31000, plot: { x: 1.8, z: .6 },
    entryUnlocked: true, entryRead: true
  }) });
  const next = store.snapshot();
  assert.equal(next.version, 3);
  assert.equal(next.plantedCount, 1);
  assert.equal(next.flowers[0].id, 'flower-1');
  assert.equal(next.flowers[0].plot.x, 1.8);
  assert.equal(next.flowers[0].plantedAt, 1000);
  assert.equal(next.flowers[0].witnessed, true);
  assert.equal(next.entryRead, true);
  assert.equal(next.canCollect, false);
  assert.equal(next.needsRest, true);
  assert.equal(next.restRemainingMs, 60000);
  assert.equal(next.canyonRestored, false);
  assert.equal(JSON.parse(backend.getItem(KEY)).version, 3);
  assert.equal(backend.data.size, 1);
  assert.equal(store.collectSeed(), false);
  finishRest(store, time);
  assert.equal(store.collectSeed(), true);
  assert.equal(store.plant({ x: 2, z: .6 }), true);
  assert.equal(store.snapshot().entryRead, true);

  const seedSave = setup({ saved: JSON.stringify({ version: 1, stage: 'seed' }) }).store.snapshot();
  assert.equal(seedSave.seedCount, 1);
  assert.equal(seedSave.plantedCount, 0);
  assert.equal(seedSave.stage, 'seed');
});

test('version 2 save validation caps capacity and reconstructs times and restoration eligibility', () => {
  const flower = (plot, plantedAt = 90000) => ({
    id: 'duplicate', plot, plantedAt, bloomAt: 1, bloomed: true, witnessed: true
  });
  const { store } = setup({ saved: JSON.stringify({
    version: 2, seedCount: 5, entryRead: true, canyonRestored: true,
    flowers: [flower({ x: 1, z: 1 }), flower({ x: 99, z: 0 }), flower({ x: 2, z: 1 }, 999999)]
  }) });
  const repaired = store.snapshot();
  assert.equal(repaired.plantedCount, 2);
  assert.equal(repaired.bloomCount, 0);
  assert.equal(repaired.entryRead, false);
  assert.equal(repaired.canyonRestored, false);
  assert.equal(repaired.seedCount, 0);
  assert.equal(repaired.flowers[0].bloomAt, 120000);
  assert.equal(repaired.flowers[1].plantedAt, 100000);
  assert.equal(repaired.flowers[1].id, 'flower-2');

  const capped = setup({ saved: JSON.stringify({
    version: 2, seedCount: 1, entryRead: true, canyonRestored: true,
    flowers: Array.from({ length: 5 }, (_, i) => flower({ x: i, z: 1 }, 1000))
  }) }).store.snapshot();
  assert.equal(capped.plantedCount, 3);
  assert.equal(capped.seedCount, 0);
  assert.equal(capped.entryRead, false, 'old one-page read status cannot read the newly introduced pages');
  assert.equal(capped.entries[0].read, true);
  assert.equal(capped.entryCount, 3);
  assert.equal(capped.unreadCount, 2);
  assert.equal(capped.canyonRestored, true);
});

test('rest requires 60 seconds of explicit activity, retains interrupted progress, and never grows offline', () => {
  const { store, time, create } = setup();
  assert.equal(store.snapshot().restRequiredMs, 60000);
  assert.equal(store.snapshot().restRemainingMs, 0);
  assert.equal(store.addRest(1000), false, 'rest before the first planting cannot be banked');
  store.collectSeed();
  store.plant({ x: 1, z: 1 });
  for (let i = 0; i < 20; i++) {
    time.value += 1000;
    assert.equal(store.addRest(1000), true);
  }
  assert.equal(store.snapshot().restElapsedMs, 20000);
  assert.equal(store.snapshot().restRemainingMs, 40000);
  time.value += 600000;
  store.tick();
  assert.equal(store.snapshot().restRemainingMs, 40000, 'growth ticks cannot earn rest');
  const returned = create();
  assert.equal(returned.snapshot().restElapsedMs, 20000);
  assert.equal(returned.snapshot().bloomCount, 1, 'flowers keep growing offline');
  assert.equal(returned.collectSeed(), false);
  for (let i = 0; i < 39; i++) returned.addRest(1000);
  assert.equal(returned.snapshot().restRemainingMs, 1000);
  assert.equal(returned.collectSeed(), false, '59 seconds is not enough');
  returned.addRest(999);
  assert.equal(returned.collectSeed(), false);
  returned.addRest(1);
  assert.equal(returned.snapshot().needsRest, false);
  assert.equal(returned.snapshot().canCollect, true);
  assert.equal(returned.addRest(1000), false, 'finished rest cannot be banked for the next trip');
  assert.equal(returned.collectSeed(), true);
  assert.equal(returned.plant({ x: 1.4, z: 1 }), true);
  assert.equal(returned.snapshot().restElapsedMs, 0);
  assert.equal(returned.snapshot().restRemainingMs, 60000);
  assert.equal(create().snapshot().restRemainingMs, 60000);
});

test('invalid rest intervals are ignored and a suspended-frame interval is capped to one second', () => {
  const { store, changes, time } = setup();
  store.collectSeed();
  store.plant({ x: 1, z: 1 });
  for (const value of [undefined, null, NaN, Infinity, -Infinity, -1000, 0, '1000']) {
    assert.equal(store.addRest(value), false);
  }
  assert.equal(changes.length, 2);
  assert.equal(store.addRest(600000), true);
  assert.equal(store.snapshot().restElapsedMs, 1000);
  finishRest(store, time);
  const completedChanges = changes.length;
  assert.equal(store.addRest(1000), false);
  assert.equal(changes.length, completedChanges);
});

test('version 2 migration requires new rest without invalidating a seed already in the bag', () => {
  const flower = { plot: { x: 1, z: 1 }, plantedAt: 0, witnessed: true };
  const unprepared = setup({ saved: JSON.stringify({ version: 2, flowers: [flower], seedCount: 0, restElapsedMs: 60000 }) }).store;
  assert.equal(unprepared.snapshot().restElapsedMs, 0, 'old versions cannot grant rest they never tracked');
  assert.equal(unprepared.snapshot().needsRest, true);
  assert.equal(unprepared.collectSeed(), false);
  const prepared = setup({ saved: JSON.stringify({ version: 2, flowers: [flower], seedCount: 1 }) }).store;
  assert.equal(prepared.snapshot().seedCount, 1);
  assert.equal(prepared.snapshot().needsRest, false);
  assert.equal(prepared.plant({ x: 1.3, z: 1 }), true);
  assert.equal(prepared.snapshot().needsRest, true);
});

test('version 3 validates individual page and rest data instead of trusting derived flags', () => {
  const saved = {
    version: 3, restElapsedMs: 12500, seedCount: 0, entryRead: true, entryUnlocked: true,
    flowers: [{ plot: { x: 1, z: 1 }, plantedAt: 95000, witnessed: true, entryRead: true }]
  };
  const restored = setup({ saved: JSON.stringify(saved) }).store.snapshot();
  assert.equal(restored.entryUnlocked, false, 'future bloom cannot be witnessed or read');
  assert.equal(restored.entryRead, false);
  assert.equal(restored.entries[0].read, false);
  assert.equal(restored.restElapsedMs, 12500);
  assert.equal(restored.restRemainingMs, 47500);
  for (const invalid of [null, '60000', -1]) {
    const value = setup({ saved: JSON.stringify({ ...saved, restElapsedMs: invalid }) }).store.snapshot();
    assert.equal(value.restElapsedMs, 0);
    assert.equal(value.needsRest, true);
  }
  const capped = setup({ saved: JSON.stringify({ ...saved, restElapsedMs: 60001 }) }).store.snapshot();
  assert.equal(capped.restElapsedMs, 60000);
  assert.equal(capped.restRemainingMs, 0);
});
