window.createMapExplorer = function createMapExplorer(THREE, options) {
  const { root, camera, canvas, section, heightAt, inside, riverX, obstacles, bridge, reduced, mobile, invalidate } = options;
  const navigation = window.createMapNavigation({ heightAt, inside, riverX, obstacles, bridge });
  const traveler = window.createMapTraveler(THREE, root, { heightAt, reduced, mobile });
  const campButton = document.getElementById('travelerCamp');
  const stateLabel = document.getElementById('travelerState');
  const notice = document.getElementById('travelerNotice');
  const locateButton = document.getElementById('travelerLocate');
  const position = navigation.nearest(1, 1.2);
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const keys = new Set();
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
  let active = false, state = 'idle', stateTime = 0, heading = .45, route = [], noticeTime = 0, settleTime = 0, locateTime = 0, campPosition = null;
  const names = { idle: '听风', walking: '漫步中', lighting: '生火中', sitting: '围炉小憩', standing: '收拾行囊' };

  function setState(next) {
    if (state === next) return;
    state = next; stateTime = 0; settleTime = 1.4;
    section.dataset.travelerState = state;
    stateLabel.textContent = names[state];
    const resting = ['lighting', 'sitting', 'standing'].includes(state);
    campButton.querySelector('span').textContent = resting ? '起身启程' : '生火休息';
    campButton.setAttribute('aria-pressed', String(resting));
    campButton.disabled = state === 'standing';
    section.dataset.resting = String(resting);
    invalidate();
  }
  function say(message) {
    notice.textContent = message; noticeTime = 3.5; invalidate();
  }
  function place() {
    traveler.setPosition(position.x, navigation.heightAt(position.x, position.z) + .018, position.z);
    traveler.setHeading(heading);
    canvas.dataset.travelerPosition = JSON.stringify({ x: +position.x.toFixed(3), z: +position.z.toFixed(3) });
  }
  function wake() {
    if (state === 'sitting' || state === 'lighting') setState('standing');
  }
  function moveTo(target) {
    const path = navigation.findPath(position, target);
    if (!path) { say('那边暂时过不去，换一条小路吧。'); return false; }
    route = path;
    while (route.length && Math.hypot(route[0].x - position.x, route[0].z - position.z) < .04) route.shift();
    if (!route.length) { traveler.hideTarget(); return true; }
    const end = route[route.length - 1];
    traveler.showTarget(end.x, navigation.heightAt(end.x, end.z), end.z);
    wake();
    if (state !== 'standing') setState('walking');
    invalidate();
    return true;
  }
  function stop() {
    route = []; traveler.hideTarget();
    if (state === 'walking') setState('idle');
  }
  function makeCamp() {
    if (state === 'standing') return false;
    if (state === 'sitting' || state === 'lighting') { route = []; wake(); return false; }
    stop(); keys.clear();
    let fire = null;
    // Try a clear patch in front, then either side, without moving or snapping the traveler.
    for (const turn of [0, .65, -.65, 1.3, -1.3, Math.PI]) {
      const angle = heading + turn;
      const x = position.x + Math.sin(angle) * .68, z = position.z + Math.cos(angle) * .68;
      if (navigation.canCamp(position.x, position.z) && navigation.canCamp(x, z) &&
          Math.abs(heightAt(position.x, position.z) - heightAt(x, z)) < .20) {
        fire = { x, z, angle }; break;
      }
    }
    if (!fire) { say('找一片平坦的草地，再生火歇歇。'); return false; }
    heading = fire.angle;
    traveler.setHeading(heading);
    traveler.setCamp(fire.x, heightAt(fire.x, fire.z) + .012, fire.z, heading);
    campPosition = { x: fire.x, z: fire.z };
    setState('lighting');
    return true;
  }
  campButton.addEventListener('click', makeCamp);
  locateButton.addEventListener('click', () => {
    traveler.showTarget(position.x, navigation.heightAt(position.x, position.z), position.z);
    locateTime = 2.4;
    canvas.focus({ preventScroll: true });
    say('白斗篷小人就在光圈上。');
  });
  function onKeyDown(event) {
    if (!active || document.hidden || !movementKeys.has(event.code) || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    keys.add(event.code); route = []; traveler.hideTarget(); locateTime = 0;
    wake(); invalidate();
  }
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', event => {
    if (keys.delete(event.code)) invalidate();
  });
  window.addEventListener('blur', () => { keys.clear(); if (!route.length && state === 'walking') setState('idle'); });
  function moveBy(dx, dz) {
    const x = position.x + dx, z = position.z + dz;
    if (!navigation.isWalkable(x, z)) return false;
    const rise = Math.abs(navigation.heightAt(x, z) - navigation.heightAt(position.x, position.z));
    if (rise > Math.hypot(dx, dz) * 2.6 + .025) return false;
    heading = Math.atan2(dx, dz); position.x = x; position.z = z;
    return true;
  }
  function update(dt, time, nightBlend) {
    if (!active) return;
    stateTime += dt; settleTime = Math.max(0, settleTime - dt);
    if (noticeTime > 0) { noticeTime -= dt; if (noticeTime <= 0) notice.textContent = ''; }
    if (locateTime > 0) { locateTime -= dt; if (locateTime <= 0 && !route.length) traveler.hideTarget(); }
    if (state === 'lighting' && stateTime >= 1.35) setState('sitting');
    if (state === 'standing' && stateTime >= .8) {
      traveler.clearCamp(); campPosition = null; setState(route.length || keys.size ? 'walking' : 'idle');
    }
    if (!['sitting', 'lighting', 'standing'].includes(state)) {
      const vertical = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const horizontal = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const step = dt * 1.1;
      if (vertical || horizontal) {
        camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
        right.crossVectors(forward, up).normalize();
        direction.copy(forward).multiplyScalar(vertical).addScaledVector(right, horizontal).normalize().multiplyScalar(step);
        const moved = moveBy(direction.x, direction.z) || moveBy(direction.x, 0) || moveBy(0, direction.z);
        setState(moved ? 'walking' : 'idle');
      } else if (route.length) {
        const target = route[0], dx = target.x - position.x, dz = target.z - position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < .012) route.shift();
        else {
          // The route was checked by the navigator; following its bridge connector
          // also preserves the carefully aligned entry onto the narrow deck.
          const fraction = Math.min(1, step / distance);
          position.x += dx * fraction; position.z += dz * fraction; heading = Math.atan2(dx, dz);
          if (fraction === 1) route.shift();
        }
        setState(route.length ? 'walking' : 'idle');
        if (!route.length) traveler.hideTarget();
      } else setState('idle');
    }
    place(); traveler.update(dt, time, state, nightBlend);
    canvas.dataset.campVisible = String(traveler.camp.visible);
  }
  section.dataset.travelerState = state;
  place(); traveler.update(.04, 0, state, 0);
  return {
    moveTo, update, navigation, makeCamp, stop, say,
    clearRoute() { stop(); keys.clear(); },
    resetPose() { stop(); keys.clear(); traveler.clearCamp(); campPosition = null; setState('idle'); },
    setActive(value) {
      active = value; keys.clear();
      if (!active && !route.length && state === 'walking') setState('idle');
    },
    get needsAnimation() { return keys.size > 0 || route.length > 0 || ['lighting', 'standing'].includes(state) || settleTime > 0 || noticeTime > 0 || locateTime > 0; },
    snapshot() { return { state, position: { ...position }, remaining: route.length, campVisible: traveler.camp.visible, campPosition: campPosition && { ...campPosition } }; }
  };
};
