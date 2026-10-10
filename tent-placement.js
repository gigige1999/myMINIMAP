/* Tent placement is independent of Three.js so terrain, saves and routes can be verified together. */
window.createTentPlacement = function createTentPlacement(options) {
  const { heightAt, inside, riverX, navigation, getTraveler, getFlowers, onCommit } = options;
  const obstacles = options.obstacles.map(item => ({ ...item }));
  const home = { x: 1, z: 1.2 };
  const canyon = navigation.nearest(-3.8, -.6);
  const bridge = { x: riverX(.1), z: .1, rotation: -.15, length: 1.9, width: .44, ...(options.bridge || {}) };
  const radius = .58, extent = .77;
  const key = 'quiet-lands-tent-v1';
  let position = { ...options.initial }, storage;
  try { storage = options.storage === undefined ? window.localStorage : options.storage; } catch {}
  const finite = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const blocked = reason => ({ valid: false, reason });
  const withTent = point => [...obstacles, { ...point, radius }];

  function preview(point) {
    if (!finite(point)) return blocked('把帐篷放在岛上的草地上吧。');
    if (!inside(point.x, point.z, .94) || Math.abs(point.x - riverX(point.z)) < .48) return blocked('帐篷需要一整块干燥的草地。');
    const dx = point.x - bridge.x, dz = point.z - bridge.z;
    const along = Math.cos(bridge.rotation) * dx - Math.sin(bridge.rotation) * dz;
    const across = Math.sin(bridge.rotation) * dx + Math.cos(bridge.rotation) * dz;
    if (Math.abs(along) < bridge.length / 2 + .6 + extent && Math.abs(across) < bridge.width / 2 + extent) {
      return blocked('为小桥留出一条回家的路吧。');
    }
    if (distance(point, home) < 1.65 || (canyon && distance(point, canyon) < 1.03)) {
      return blocked('给篝火、花圃和拾种的小路留些空间吧。');
    }
    if (obstacles.some(item => distance(point, item) < extent + Math.max(0, item.radius || 0))) {
      return blocked('这里有树木或遗迹，换一块草地吧。');
    }
    const traveler = getTraveler();
    if (traveler?.position && distance(point, traveler.position) < extent + .22) return blocked('小人还在这里，挪开一点点吧。');
    if (traveler?.campPosition && distance(point, traveler.campPosition) < extent + .45) return blocked('帐篷离火太近了，再远一点吧。');
    if ((getFlowers() || []).some(flower => finite(flower.plot) && distance(point, flower.plot) < extent + .22)) {
      return blocked('这里有小花，让它继续晒太阳吧。');
    }
    let low = heightAt(point.x, point.z), high = low;
    for (let index = 0; index <= 16; index++) {
      const angle = index / 16 * Math.PI * 2;
      const x = point.x + Math.cos(angle) * extent, z = point.z + Math.sin(angle) * extent;
      if (!inside(x, z, .94) || Math.abs(x - riverX(z)) < .48) return blocked('帐篷需要一整块干燥的草地。');
      const y = heightAt(x, z);
      if (!Number.isFinite(y)) return blocked('这里暂时不能安家。');
      low = Math.min(low, y); high = Math.max(high, y);
    }
    if (!Number.isFinite(low) || high - low > .40) return blocked('山坡有些陡，找一块平缓的草地吧。');
    return { valid: true, point: { x: point.x, z: point.z }, reason: '松开，把帐篷安放在这里。' };
  }

  function place(point, persist = true) {
    const result = preview(point);
    if (!result.valid) return result;
    // Rebuild graph nodes and edges, then check both the seed trip and the real
    // campfire clearing. Merely moving a collider would leave stale A* routes.
    navigation.setObstacles(withTent(point));
    const traveler = getTraveler();
    const fireFits = [0, .65, -.65, 1.3, -1.3, Math.PI].some(angle => {
      const x = home.x + Math.sin(.45 + angle) * .68, z = home.z + Math.cos(.45 + angle) * .68;
      return navigation.canCamp(x, z) && Math.abs(heightAt(home.x, home.z) - heightAt(x, z)) < .20;
    });
    const connected = navigation.canCamp(home.x, home.z) && fireFits && canyon &&
      navigation.isWalkable(canyon.x, canyon.z) && navigation.findPath(home, canyon) &&
      (!traveler?.position || (navigation.isWalkable(traveler.position.x, traveler.position.z) && navigation.findPath(traveler.position, home)));
    if (!connected) {
      navigation.setObstacles(withTent(position));
      return blocked('这会挡住散步的小路，换一个位置吧。');
    }
    position = { x: point.x, z: point.z };
    onCommit({ ...position });
    if (persist) try { storage?.setItem(key, JSON.stringify({ version: 1, position })); } catch {}
    return { valid: true, point: { ...position }, reason: '帐篷搬好了。篝火旁的小花还在原处等你。' };
  }

  function restore() {
    let saved;
    try { saved = JSON.parse(storage?.getItem(key) || 'null'); } catch { return false; }
    if (saved?.version !== 1 || !finite(saved.position)) return false;
    return place(saved.position, false).valid;
  }

  function hints(limit = 6) {
    const result = [];
    const clearings = [
      { x: -5, z: -.6 }, { x: -.4, z: -.9 }, { x: 4, z: .5 },
      { x: 3.2, z: .7 }, { x: 1.3, z: 3.1 }, { x: .15, z: -3.9 },
      { x: -4.9, z: -.3 }, { x: 1.7, z: 2.9 }, { x: 4.5, z: .5 }
    ];
    for (const point of clearings) {
      if (distance(point, position) < .45 || result.some(other => distance(point, other) < .65) || !preview(point).valid) continue;
      result.push({ ...point });
      if (result.length >= Math.max(1, Math.min(6, limit))) break;
    }
    return result;
  }

  function snap(point, clearings, reach = .35) {
    if (!finite(point)) return null;
    let nearest = point, nearestDistance = reach;
    for (const candidate of clearings || []) {
      if (!finite(candidate)) continue;
      const currentDistance = distance(point, candidate);
      if (currentDistance <= nearestDistance && preview(candidate).valid) {
        nearest = candidate; nearestDistance = currentDistance;
      }
    }
    return { x: nearest.x, z: nearest.z };
  }

  return { preview, place, restore, hints, snap, get position() { return { ...position }; } };
};
