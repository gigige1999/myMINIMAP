// Shared canvas tent: the map marker and the camp use the same little shelter.
window.createQuietTent = function createQuietTent(THREE, { scale = 1 } = {}) {
  const group = new THREE.Group();
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .97, ...options });
  const cloth = material(0xe3dcc0, { side: THREE.DoubleSide });
  const fold = material(0xc6c5a3, { side: THREE.DoubleSide });
  const trim = material(0x82977b, { side: THREE.DoubleSide });
  const wood = material(0x8c8064);
  const rope = material(0xb6af8d);
  const glow = material(0xe9cb88, { emissive: 0xffd296, emissiveIntensity: .08 });
  function mesh(geometry, mat, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z); object.castShadow = object.receiveShadow = true;
    group.add(object); return object;
  }
  function face(vertices, mat) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals(); return mesh(geometry, mat);
  }
  function line(a, b, radius, mat) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const object = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 7), mat);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  }
  // Subdivided, slightly slack canvas has volume and catches soft light.
  for (const side of [-1, 1]) {
    const vertices = [], indices = [];
    for (let z = 0; z <= 8; z++) for (let s = 0; s <= 8; s++) {
      const v = s / 8, depth = z / 8;
      vertices.push(side * .56 * v, .9 * (1 - v) + .055 * v - Math.sin(v * Math.PI) * .036 - Math.sin(depth * Math.PI) * .018, -.48 + depth * .96);
      if (z < 8 && s < 8) { const i = z * 9 + s; indices.push(i, i + 1, i + 9, i + 1, i + 10, i + 9); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); mesh(geometry, cloth);
    face([side * .56, .10, -.48, side * .56, .025, -.48, side * .56, .025, .48,
      side * .56, .10, -.48, side * .56, .025, .48, side * .56, .10, .48], trim);
    for (const z of [-.48, .48]) {
      line([side * .47, .19, z], [side * .82, .02, z * 1.36], .007, rope);
      line([side * .82, .0, z * 1.36], [side * .82, .09, z * 1.36], .018, wood);
    }
  }
  face([-.55, .05, -.477, .55, .05, -.477, 0, .9, -.477], fold);
  // Folded entrance flaps leave a real triangular opening, with a shaded interior.
  for (const side of [-1, 1]) {
    face([0, .90, .483, side * .56, .05, .483, side * .39, .065, .565,
      0, .90, .483, side * .39, .065, .565, side * .22, .34, .53], cloth);
    line([side * .23, .33, .536], [side * .42, .29, .52], .012, trim);
  }
  const floor = mesh(new THREE.BoxGeometry(.79, .012, .81), material(0x8a9274), 0, .016, -.02);
  floor.receiveShadow = true;
  const bed = mesh(new THREE.CapsuleGeometry(.095, .37, 3, 8), material(0xaab092), -.24, .085, -.17);
  bed.rotation.x = Math.PI / 2;
  for (const z of [-.52, .52]) line([0, 0, z], [0, 1.02, z], .023, wood);
  line([0, .922, -.57], [0, .922, .59], .025, wood);
  face([0, 1.02, -.52, .23, .96, -.52, 0, .92, -.52], trim);
  line([0, .80, .56], [.18, .80, .56], .012, wood);
  line([.15, .80, .56], [.15, .68, .56], .008, rope);
  const lantern = mesh(new THREE.CylinderGeometry(.034, .034, .074, 8), glow, .15, .647, .56);
  mesh(new THREE.ConeGeometry(.056, .035, 6), wood, .15, .702, .56);
  mesh(new THREE.CylinderGeometry(.043, .043, .012, 6), wood, .15, .603, .56);
  const light = new THREE.PointLight(0xffd29a, 0, 1.5, 2);
  light.position.copy(lantern.position); light.position.z += .1; group.add(light);
  group.scale.setScalar(scale);
  group.userData.setNight = value => { glow.emissiveIntensity = .08 + value * 1.5; light.intensity = value * .38 * scale; };
  return group;
};

window.createMapRestoration = function createMapRestoration(THREE, { root, heightAt, reduced, riverX }) {
  const tentPoint = { x: 1.7, z: -.3 };
  const tent = window.createQuietTent(THREE, { scale: .82 });
  tent.position.set(tentPoint.x, heightAt(tentPoint.x, tentPoint.z), tentPoint.z);
  tent.rotation.y = .30; tent.name = '旅人的帐篷'; root.add(tent);
  function alignTent(point) {
    const span=.25;
    const dx=(heightAt(point.x+span,point.z)-heightAt(point.x-span,point.z))/(span*2);
    const dz=(heightAt(point.x,point.z+span)-heightAt(point.x,point.z-span))/(span*2);
    tent.position.set(point.x,heightAt(point.x,point.z),point.z);
    tent.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-dx,1,-dz).normalize());
    tent.rotateY(.30);
  }
  alignTent(tentPoint);
  const renewed = new THREE.Group(); renewed.visible = false; root.add(renewed);
  const materials = [];
  function material(color, opacity = 1, basic = false) {
    const mat = basic ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }) :
      new THREE.MeshStandardMaterial({ color, roughness: .95, transparent: true, opacity, flatShading: true });
    materials.push({ mat, opacity }); return mat;
  }
  const mountainPoint = { x: -5.18, z: -2.45 };
  const mountain = new THREE.Group();
  mountain.position.set(mountainPoint.x, heightAt(mountainPoint.x, mountainPoint.z) - .03, mountainPoint.z);
  renewed.add(mountain);
  const limestone = [0xbbbba0, 0xd2c9ac, 0xafb398, 0xc3c1a5].map(color => material(color));
  const moss = material(0x97ad79), flowers = material(0xe9dfb7);
  for (let layer = 0; layer < 5; layer++) {
    const radius = .63 - layer * .073;
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(radius * .87, radius, .23, 7), limestone[layer % 4]);
    rock.position.set(-layer * .035, layer * .205 + .115, 0);
    rock.rotation.y = .31 + layer * .12; rock.scale.z = .83;
    rock.castShadow = rock.receiveShadow = true; mountain.add(rock);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 7), moss);
  crown.position.set(-.13, 1.055, 0); crown.scale.set(1, .23, .84); crown.castShadow = true; mountain.add(crown);
  for (let i = 0; i < 9; i++) {
    const blossom = new THREE.Mesh(new THREE.IcosahedronGeometry(.026, 0), flowers);
    const angle = i * 2.4, radius = .11 + (i % 3) * .055;
    blossom.position.set(-.13 + Math.cos(angle) * radius, 1.12 + (i % 2) * .014, Math.sin(angle) * radius * .8);
    mountain.add(blossom);
  }
  // The arch crosses the stream's local normal, with its ends resting on the
  // two grassy banks. Its height follows the banks instead of floating above a cliff.
  const rainbowZ = -1.05, rainbowX = riverX(rainbowZ);
  const riverSlope = (riverX(rainbowZ + .05) - riverX(rainbowZ - .05)) / .1;
  const rainbowAngle = Math.atan(riverSlope);
  const rainbow = new THREE.Group(); rainbow.position.set(rainbowX, 0, rainbowZ); rainbow.rotation.y = rainbowAngle;
  renewed.add(rainbow);
  const rainbowColors = [0xdcb4a1, 0xe2c6a1, 0xe1d5aa, 0xbcccac, 0xa7c7c0, 0xb7bbd0];
  rainbowColors.forEach((color, index) => {
    const radius = .87 + (5 - index) * .034, points = [];
    const nx = Math.cos(rainbowAngle), nz = -Math.sin(rainbowAngle);
    const rightY = heightAt(rainbowX + nx * radius, rainbowZ + nz * radius) + .08;
    const leftY = heightAt(rainbowX - nx * radius, rainbowZ - nz * radius) + .08;
    for (let i = 0; i <= 48; i++) {
      const angle = i / 48 * Math.PI;
      const fraction = (1 - Math.cos(angle)) / 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, rightY + (leftY - rightY) * fraction + Math.sin(angle) * radius, 0));
    }
    const arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, .023, 6, false), material(color, .68, true));
    rainbow.add(arc);
  });
  let blend = 0, previousTime = null, initialized = false;
  return {
    tent, tentPoint, previewTent: alignTent,
    footprint: { ...tentPoint, radius: .58 },
    restorationFootprint: { ...mountainPoint, radius: .64 },
    moveTent(point) {
      tentPoint.x = point.x; tentPoint.z = point.z;
      alignTent(point);
      this.footprint.x = point.x; this.footprint.z = point.z;
    },
    update(time, night, restored) {
      tent.userData.setNight(night);
      const delta = previousTime === null ? 0 : Math.min(.1, Math.max(0, time - previousTime)); previousTime = time;
      const target = restored ? 1 : 0;
      if (!initialized || reduced.matches) { blend = target; initialized = true; }
      else blend = THREE.MathUtils.clamp(blend + Math.sign(target - blend) * delta / 1.15, 0, 1);
      renewed.visible = blend > 0;
      if (!renewed.visible) return;
      const eased = 1 - Math.pow(1 - blend, 3);
      renewed.position.y = -.18 * (1 - eased);
      materials.forEach(({ mat, opacity }) => { mat.opacity = opacity * eased; });
      rainbow.scale.setScalar(.92 + eased * .08);
    }
  };
};
