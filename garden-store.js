(function (global) {
  'use strict';

  const STORAGE_KEY = 'quiet-lands-garden-v1';
  const GROWTH_TIME = 30000;
  const REST_TIME = 60000;
  const MAX_FLOWERS = 3;
  const STAGES = new Set(['new', 'seed', 'growing', 'bloomed', 'remembered']);

  global.createGardenStore = function createGardenStore(options = {}) {
    const clock = typeof options.now === 'function' ? options.now : Date.now;
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    let storage;
    let storageAvailable = true;
    try {
      storage = options.storage === undefined ? global.localStorage : options.storage;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
        storageAvailable = false;
      }
    } catch (_) {
      storageAvailable = false;
    }

    const timestamp = () => {
      const value = clock();
      return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER - GROWTH_TIME
        ? value : Date.now();
    };
    const validPlot = plot => !!plot && typeof plot === 'object'
      && Number.isFinite(plot.x) && Number.isFinite(plot.z)
      && Math.abs(plot.x) <= 8 && Math.abs(plot.z) <= 6;
    const fresh = () => ({
      version: 3, seedCount: 0, flowers: [], restElapsedMs: 0, canyonRestored: false
    });

    // Growth is reconstructed from planting time, never from saved reward flags.
    function restoreFlower(saved, index, time) {
      if (!saved || !validPlot(saved.plot)) return null;
      const plantedAt = Number.isFinite(saved.plantedAt) && saved.plantedAt >= 0 && saved.plantedAt <= time
        ? saved.plantedAt : time;
      const bloomAt = plantedAt + GROWTH_TIME;
      const bloomed = time >= bloomAt;
      return {
        id: `flower-${index + 1}`,
        plot: { x: saved.plot.x, z: saved.plot.z },
        plantedAt, bloomAt, bloomed,
        witnessed: bloomed && saved.witnessed === true,
        entryRead: bloomed && saved.witnessed === true && saved.entryRead === true
      };
    }

    function restore(saved, time) {
      const result = fresh();
      if (!saved || typeof saved !== 'object') return result;
      if (saved.version === 1 && STAGES.has(saved.stage)) {
        if (saved.stage === 'new') return result;
        if (saved.stage === 'seed' || !validPlot(saved.plot)) {
          result.seedCount = 1;
          return result;
        }
        result.flowers.push(restoreFlower({ ...saved, witnessed: saved.stage === 'remembered' }, 0, time));
        return result;
      }
      if (![2, 3].includes(saved.version) || !Array.isArray(saved.flowers)) return result;
      for (const flower of saved.flowers.slice(0, MAX_FLOWERS)) {
        // Older versions had one shared page. Its read flag belongs only to the first flower.
        const candidate = saved.version === 2 && flower && typeof flower === 'object'
          ? { ...flower, entryRead: result.flowers.length === 0 && saved.entryRead === true }
          : flower;
        const restored = restoreFlower(candidate, result.flowers.length, time);
        if (restored) result.flowers.push(restored);
      }
      result.seedCount = result.flowers.length < MAX_FLOWERS && saved.seedCount === 1 ? 1 : 0;
      if (saved.version === 3 && Number.isFinite(saved.restElapsedMs) && saved.restElapsedMs >= 0) {
        result.restElapsedMs = Math.min(REST_TIME, saved.restElapsedMs);
      }
      result.canyonRestored = result.flowers.length === MAX_FLOWERS && saved.canyonRestored === true;
      return result;
    }

    let state = fresh();
    let hadSave = false;
    if (storageAvailable) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        hadSave = raw !== null;
        if (hadSave) {
          let saved;
          try { saved = JSON.parse(raw); } catch (_) { saved = null; }
          state = restore(saved, timestamp());
        }
      } catch (_) {
        storageAvailable = false;
      }
    }

    function snapshot() {
      const unvisited = state.flowers.find(flower => flower.bloomed && !flower.witnessed);
      const growing = state.flowers.find(flower => !flower.bloomed);
      const focus = unvisited || growing || state.flowers[state.flowers.length - 1];
      const plantedCount = state.flowers.length;
      const restEligible = plantedCount > 0 && plantedCount < MAX_FLOWERS && state.seedCount === 0;
      const restRemainingMs = restEligible ? Math.max(0, REST_TIME - state.restElapsedMs) : 0;
      const entries = Array.from({ length: MAX_FLOWERS }, (_, index) => ({
        id: `flower-${index + 1}`,
        unlocked: !!state.flowers[index]?.witnessed,
        read: !!state.flowers[index]?.entryRead
      }));
      const entryCount = entries.filter(entry => entry.unlocked).length;
      const unreadCount = entries.filter(entry => entry.unlocked && !entry.read).length;
      return {
        ...state,
        flowers: state.flowers.map(flower => ({ ...flower, plot: { ...flower.plot } })),
        stage: state.seedCount ? 'seed' : unvisited ? 'bloomed' : growing ? 'growing'
          : plantedCount ? 'remembered' : 'new',
        plot: focus ? { ...focus.plot } : null,
        plantedAt: focus ? focus.plantedAt : null,
        bloomAt: focus ? focus.bloomAt : null,
        plantedCount,
        bloomCount: state.flowers.filter(flower => flower.bloomed).length,
        restRequiredMs: REST_TIME,
        restRemainingMs,
        needsRest: restRemainingMs > 0,
        canCollect: state.seedCount === 0 && plantedCount < MAX_FLOWERS && restRemainingMs === 0,
        canRestore: plantedCount === MAX_FLOWERS && !state.canyonRestored,
        entries, entryCount, unreadCount,
        entryUnlocked: entryCount > 0,
        entryRead: entryCount > 0 && unreadCount === 0,
        storageAvailable
      };
    }
    function save() {
      if (!storageAvailable) return;
      try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch (_) { storageAvailable = false; }
    }
    function commit() {
      save();
      onChange(snapshot());
      return true;
    }

    // Persist offline growth and repair invalid saves once, without render-loop writes.
    if (hadSave) save();

    return {
      snapshot,
      collectSeed() {
        if (!snapshot().canCollect) return false;
        state.seedCount = 1;
        return commit();
      },
      plant(plot) {
        if (!state.seedCount || state.flowers.length >= MAX_FLOWERS || !validPlot(plot)) return false;
        state.seedCount = 0;
        state.restElapsedMs = 0;
        const plantedAt = timestamp();
        state.flowers.push({
          id: `flower-${state.flowers.length + 1}`,
          plot: { x: plot.x, z: plot.z },
          plantedAt, bloomAt: plantedAt + GROWTH_TIME,
          bloomed: false, witnessed: false, entryRead: false
        });
        return commit();
      },
      // Only the active map controller can attest that the traveler is seated by a lit fire.
      // Cap each credited interval so a suspended tab cannot turn offline time into rest.
      addRest(milliseconds) {
        if (!snapshot().needsRest || !Number.isFinite(milliseconds) || milliseconds <= 0) return false;
        state.restElapsedMs = Math.min(REST_TIME, state.restElapsedMs + Math.min(1000, milliseconds));
        return commit();
      },
      tick() {
        const time = timestamp();
        let changed = false;
        for (const flower of state.flowers) {
          if (!flower.bloomed && time >= flower.bloomAt) {
            flower.bloomed = true;
            changed = true;
          }
        }
        if (!changed) return false;
        return commit();
      },
      witnessBloom(flowerId) {
        const flower = flowerId === undefined
          ? state.flowers.find(item => item.bloomed && !item.witnessed)
          : state.flowers.find(item => item.id === flowerId);
        if (!flower || !flower.bloomed || flower.witnessed) return false;
        flower.witnessed = true;
        return commit();
      },
      markRead(flowerId = 'flower-1') {
        const flower = state.flowers.find(item => item.id === flowerId);
        if (!flower?.witnessed || flower.entryRead) return false;
        flower.entryRead = true;
        return commit();
      },
      restoreCanyon() {
        if (state.flowers.length < MAX_FLOWERS || state.canyonRestored) return false;
        state.canyonRestored = true;
        return commit();
      },
      reset() {
        const before = JSON.stringify(snapshot());
        state = fresh();
        if (storageAvailable) {
          try { storage.removeItem(STORAGE_KEY); }
          catch (_) { storageAvailable = false; }
        }
        if (before === JSON.stringify(snapshot())) return false;
        onChange(snapshot());
        return true;
      }
    };
  };
})(window);
