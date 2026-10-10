/* Terrain navigation for the map traveller; no rendering or browser dependencies. */
window.createMapNavigation = function createMapNavigation(options) {
  const groundHeight = options.heightAt;
  const inside = options.inside;
  const riverX = options.riverX;
  let obstacles = (options.obstacles || []).filter(item => Number.isFinite(item.x) && Number.isFinite(item.z)).map(item => ({ ...item }));
  const radius = .16, step = .20, maxSlope = 1.65;
  const bounds = { minX: -7.7, maxX: 7.7, minZ: -5.8, maxZ: 5.8 };
  const bridge = options.bridge === false ? null : {
    x: riverX(.10), z: .10, rotation: -.15, length: 1.9, width: .44, height: .62,
    ...(options.bridge || {})
  };
  const bridgeCos = Math.cos(bridge ? bridge.rotation : 0);
  const bridgeSin = Math.sin(bridge ? bridge.rotation : 0);
  const rampLength = .55;
  const nodes = [], cells = new Map();
  const columns = Math.round((bounds.maxX - bounds.minX) / step) + 1;
  const rows = Math.round((bounds.maxZ - bounds.minZ) / step) + 1;
  const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
  const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  const distance = (a, b) => Math.sqrt(squaredDistance(a, b));
  const smooth = t => t * t * (3 - 2 * t);

  function bridgeCoordinates(x, z) {
    if (!bridge) return null;
    const dx = x - bridge.x, dz = z - bridge.z;
    return { along: bridgeCos * dx - bridgeSin * dz, across: bridgeSin * dx + bridgeCos * dz };
  }

  function bridgePoint(along) {
    return { x: bridge.x + bridgeCos * along, z: bridge.z - bridgeSin * along };
  }

  function onBridge(x, z) {
    const local = bridgeCoordinates(x, z);
    return local && Math.abs(local.along) <= bridge.length / 2 + rampLength &&
      Math.abs(local.across) <= Math.max(.045, bridge.width / 2 - radius);
  }

  function heightAt(x, z) {
    const ground = groundHeight(x, z);
    if (!Number.isFinite(ground)) return 0;
    if (!onBridge(x, z)) return ground;
    const along = Math.abs(bridgeCoordinates(x, z).along);
    if (along <= bridge.length / 2) return bridge.height;
    const blend = smooth(Math.min(1, (along - bridge.length / 2) / rampLength));
    return bridge.height + (ground - bridge.height) * blend;
  }

  function clearOfObstacles(x, z, clearance = radius) {
    return obstacles.every(item => Math.hypot(x - item.x, z - item.z) >
      Math.max(0, item.radius || 0) + clearance + .012);
  }

  function isWalkable(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !inside(x, z, .94)) return false;
    // Keep the traveller's feet on the island, even around concave shorelines.
    if (!inside(x - radius, z, .94) || !inside(x + radius, z, .94) ||
        !inside(x, z - radius, .94) || !inside(x, z + radius, .94)) return false;
    if (!clearOfObstacles(x, z) || !Number.isFinite(groundHeight(x, z))) return false;
    if (onBridge(x, z)) return true;
    if (Math.abs(x - riverX(z)) < .50) return false;
    const sample = .08;
    const dx = (groundHeight(x + sample, z) - groundHeight(x - sample, z)) / (sample * 2);
    const dz = (groundHeight(x, z + sample) - groundHeight(x, z - sample)) / (sample * 2);
    return Number.isFinite(dx) && Number.isFinite(dz) && Math.hypot(dx, dz) <= maxSlope;
  }

  function segmentClear(a, b) {
    const length = distance(a, b);
    const count = Math.max(1, Math.ceil(length / .045));
    let previousHeight = heightAt(a.x, a.z);
    if (!isWalkable(a.x, a.z)) return false;
    for (let i = 1; i <= count; i++) {
      const t = i / count, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      if (!isWalkable(x, z)) return false;
      const nextHeight = heightAt(x, z);
      if (Math.abs(nextHeight - previousHeight) > length / count * maxSlope + .012) return false;
      previousHeight = nextHeight;
    }
    return true;
  }

  function addNode(point) {
    const node = { x: point.x, z: point.z, id: nodes.length, edges: [] };
    nodes.push(node);
    return node;
  }

  function connect(a, b) {
    if (!a || !b || a === b || !segmentClear(a, b)) return;
    const cost = Math.hypot(a.x - b.x, a.z - b.z, heightAt(a.x, a.z) - heightAt(b.x, b.z));
    a.edges.push({ node: b.id, cost });
    b.edges.push({ node: a.id, cost });
  }

  function rebuild() {
    nodes.length = 0; cells.clear();
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = bounds.minX + column * step, z = bounds.minZ + row * step;
      if (isWalkable(x, z)) cells.set(row * columns + column, addNode({ x, z }));
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const current = cells.get(row * columns + column);
      if (!current) continue;
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const nextColumn = column + dc, nextRow = row + dr;
        if (nextColumn < 0 || nextColumn >= columns || nextRow >= rows) continue;
        if (dc && dr && (!cells.has(row * columns + nextColumn) || !cells.has(nextRow * columns + column))) continue;
        connect(current, cells.get(nextRow * columns + nextColumn));
      }
    }
    // The bridge is narrower than a grid cell after allowing room for the body.
    // Explicit centre-line samples keep this crossing connected at every rotation.
    if (bridge) {
      const extent = bridge.length / 2 + rampLength + .12;
      const count = Math.ceil(extent * 2 / .14);
      let previous = null;
      for (let index = 0; index <= count; index++) {
        const point = bridgePoint(-extent + index / count * extent * 2);
        if (!isWalkable(point.x, point.z)) { previous = null; continue; }
        const current = addNode(point);
        connect(previous, current);
        const column = Math.round((point.x - bounds.minX) / step);
        const row = Math.round((point.z - bounds.minZ) / step);
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const targetColumn = column + dc, targetRow = row + dr;
          if (targetColumn < 0 || targetColumn >= columns || targetRow < 0 || targetRow >= rows) continue;
          const neighbour = cells.get(targetRow * columns + targetColumn);
          if (neighbour && squaredDistance(current, neighbour) <= .42 ** 2) connect(current, neighbour);
        }
        previous = current;
      }
    }
  }
  rebuild();

  function setObstacles(next) {
    obstacles = (next || []).filter(item => Number.isFinite(item.x) && Number.isFinite(item.z)).map(item => ({ ...item }));
    rebuild();
  }

  function nearest(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    if (isWalkable(x, z)) return { x, z };
    let closest = null, closestDistance = Infinity;
    for (const node of nodes) {
      const candidateDistance = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (candidateDistance < closestDistance) { closest = node; closestDistance = candidateDistance; }
    }
    return closest ? { x: closest.x, z: closest.z } : null;
  }

  function endpointLinks(point) {
    const links = [];
    for (const node of nodes) {
      const cost = distance(point, node);
      if (cost <= .46 && segmentClear(point, node)) links.push({ node: node.id, cost });
    }
    return links;
  }

  function findPath(from, to) {
    if (!finitePoint(from) || !finitePoint(to)) return null;
    const start = nearest(from.x, from.z), end = nearest(to.x, to.z);
    if (!start || !end) return null;
    if (distance(start, end) < .015) return [start];
    if (segmentClear(start, end)) return [start, end];
    const starts = endpointLinks(start), ends = endpointLinks(end);
    if (!starts.length || !ends.length) return null;
    const ending = new Map(ends.map(link => [link.node, link.cost]));
    const costs = new Float64Array(nodes.length); costs.fill(Infinity);
    const parents = new Int32Array(nodes.length); parents.fill(-1);
    const closed = new Uint8Array(nodes.length);
    const heap = [];
    function push(id, priority) {
      const item = { id, priority }; let index = heap.length;
      heap.push(item);
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent].priority <= priority) break;
        heap[index] = heap[parent]; index = parent;
      }
      heap[index] = item;
    }
    function pop() {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        let index = 0;
        while (index * 2 + 1 < heap.length) {
          let child = index * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].priority < heap[child].priority) child++;
          if (heap[child].priority >= last.priority) break;
          heap[index] = heap[child]; index = child;
        }
        heap[index] = last;
      }
      return first.id;
    }
    for (const link of starts) {
      costs[link.node] = link.cost;
      push(link.node, link.cost + distance(nodes[link.node], end));
    }
    let goal = -1;
    while (heap.length) {
      const id = pop();
      if (closed[id]) continue;
      closed[id] = 1;
      if (ending.has(id)) { goal = id; break; }
      for (const edge of nodes[id].edges) {
        if (closed[edge.node]) continue;
        const nextCost = costs[id] + edge.cost;
        if (nextCost >= costs[edge.node]) continue;
        costs[edge.node] = nextCost; parents[edge.node] = id;
        push(edge.node, nextCost + distance(nodes[edge.node], end));
      }
    }
    if (goal < 0) return null;
    const route = [end];
    for (let id = goal; id >= 0; id = parents[id]) route.push({ x: nodes[id].x, z: nodes[id].z });
    route.push(start); route.reverse();
    const simplified = [route[0]];
    let anchor = 0;
    while (anchor < route.length - 1) {
      let next = route.length - 1;
      while (next > anchor + 1 && !segmentClear(route[anchor], route[next])) next--;
      simplified.push(route[next]); anchor = next;
    }
    return simplified;
  }

  function canCamp(x, z) {
    if (!isWalkable(x, z) || onBridge(x, z) || Math.abs(x - riverX(z)) < .95 || !clearOfObstacles(x, z, .62)) return false;
    let lowest = groundHeight(x, z), highest = lowest;
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      const px = x + Math.cos(angle) * .52, pz = z + Math.sin(angle) * .52;
      if (!isWalkable(px, pz) || onBridge(px, pz)) return false;
      const y = groundHeight(px, pz); lowest = Math.min(lowest, y); highest = Math.max(highest, y);
    }
    return highest - lowest <= .25;
  }

  return { isWalkable, heightAt, findPath, nearest, canCamp, setObstacles };
};
