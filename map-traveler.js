window.createMapTraveler = function createMapTraveler(THREE, root, { heightAt, reduced, mobile }) {
  const matches = preference => typeof preference === 'boolean' ? preference : !!preference?.matches;
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .88, ...extra });
  const cloth = material(0xeeeada, { emissive: 0xd7cda0, emissiveIntensity: .12 });
  const lining = material(0xc4c4aa);
  const boots = material(0x807b64);
  const gold = material(0xbba065, { metalness: .24, roughness: .55 });
  const faceMaterial = material(0x657967, { emissive: 0x43503c, emissiveIntensity: .12 });
  const eyeMaterial = material(0xf2e6ba, { emissive: 0xf0d995, emissiveIntensity: .6 });
  const group = new THREE.Group();
  group.name = 'map-traveler';
  root.add(group);
  const mesh = (geometry, mat, parent, x, y, z) => {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const body = new THREE.Group();
  body.position.y = .38;
  group.add(body);
  const profile = [[.18, -.31], [.215, -.29], [.20, -.20], [.145, -.015], [.105, .10], [.075, .135]];
  const cloakGeometry = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 24);
  const cloakPositions = cloakGeometry.attributes.position;
  for (let i = 0; i < cloakPositions.count; i++) {
    const angle = Math.atan2(cloakPositions.getX(i), cloakPositions.getZ(i));
    const fold = 1 + .05 * Math.sin(angle * 7) * (.6 - cloakPositions.getY(i));
    cloakPositions.setX(i, cloakPositions.getX(i) * fold);
    cloakPositions.setZ(i, cloakPositions.getZ(i) * fold * .82);
  }
  cloakGeometry.computeVertexNormals();
  const cloak = mesh(cloakGeometry, cloth, body, 0, 0, 0);
  cloak.castShadow = true;
  cloak.receiveShadow = true;
  const head = new THREE.Group();
  head.position.y = .177;
  body.add(head);
  const hood = mesh(new THREE.SphereGeometry(.14, 18, 12), cloth, head, 0, .004, 0);
  hood.scale.set(1, 1.08, .95);
  hood.castShadow = true;
  const face = mesh(new THREE.SphereGeometry(.10, 16, 10), faceMaterial, head, 0, -.012, .115);
  face.scale.set(.84, .83, .32);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(.053, .17, 4), cloth, head, side * .102, .15, -.012);
    ear.rotation.z = -side * .2;
    mesh(new THREE.SphereGeometry(.009, 6, 4), eyeMaterial, head, side * .032, -.008, .147);
  }
  mesh(new THREE.IcosahedronGeometry(.024, 1), gold, body, 0, .052, .115);
  const arms = [-1, 1].map(side => {
    const arm = new THREE.Group();
    arm.position.set(side * .123, .005, .015);
    body.add(arm);
    const sleeve = mesh(new THREE.CylinderGeometry(.039, .059, .14, 8), cloth, arm, 0, -.055, 0);
    sleeve.rotation.z = side * .12;
    mesh(new THREE.SphereGeometry(.027, 8, 6), lining, arm, 0, -.13, .003);
    return arm;
  });
  const feet = [-1, 1].map(side => {
    const foot = mesh(new THREE.SphereGeometry(.052, 10, 8), boots, group, side * .073, .028, .058);
    foot.scale.set(.75, .55, 1.4);
    return foot;
  });
  const groundShadow = mesh(new THREE.CircleGeometry(.225, 28), new THREE.MeshBasicMaterial({
    color: 0x465346, opacity: .14, transparent: true, depthWrite: false
  }), group, 0, .01, 0);
  groundShadow.rotation.x = -Math.PI / 2;

  const camp = new THREE.Group();
  camp.name = 'traveler-campfire';
  camp.visible = false;
  root.add(camp);
  const hearth = mesh(new THREE.CircleGeometry(.34, 24), material(0x797d61), camp, 0, .012, 0);
  hearth.rotation.x = -Math.PI / 2;
  const stoneGeometry = new THREE.IcosahedronGeometry(1, 1);
  const stoneMaterial = material(0xa9ad92, { flatShading: true });
  const stoneRing = [];
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9;
    const stone = mesh(stoneGeometry, stoneMaterial, camp, Math.cos(a) * .285, .049, Math.sin(a) * .285);
    stone.scale.set(.07 + (i % 3) * .008, .045 + (i % 2) * .013, .061);
    stone.rotation.set(i * .27, a, i * .18);
    stoneRing.push(stone);
  }
  const wood = material(0x685846);
  const ember = material(0xa16039, { emissive: 0xf59e43, emissiveIntensity: 0 });
  for (let i = 0; i < 3; i++) {
    const log = mesh(new THREE.CylinderGeometry(.035, .046, .42, 7), wood, camp, 0, .052 + i * .016, 0);
    log.rotation.set(Math.PI / 2, 0, i * Math.PI / 3 + .2);
    const coal = mesh(stoneGeometry, ember, camp, Math.sin(i * 2.1) * .105, .1, Math.cos(i * 2.1) * .10);
    coal.scale.set(.065, .025, .05);
  }
  const flameGroup = new THREE.Group();
  flameGroup.position.y = .08;
  camp.add(flameGroup);
  const flameMaterial = material(0xf2b465, { emissive: 0xff872d, emissiveIntensity: 1.5, roughness: .5 });
  const heartMaterial = material(0xf4ddb0, { emissive: 0xffd185, emissiveIntensity: 1.5 });
  const flameProfile = [[.065, 0], [.105, .09], [.08, .18], [.037, .29], [0, .40]];
  const flameGeometry = new THREE.LatheGeometry(flameProfile.map(p => new THREE.Vector2(...p)), 10);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const flame = mesh(flameGeometry, i === 2 ? heartMaterial : flameMaterial, flameGroup,
      Math.sin(i * 2.4) * .06, i === 2 ? .008 : 0, Math.cos(i * 2.4) * .038);
    flame.scale.set(i === 2 ? .57 : .8, i === 0 ? 1 : .74, i === 2 ? .57 : .8);
    flames.push(flame);
  }
  const fireLight = new THREE.PointLight(0xffbd6c, 0, 2.5, 2);
  fireLight.position.y = .38;
  camp.add(fireLight);
  const sparks = [];
  if (!matches(mobile)) {
    const sparkGeometry = new THREE.SphereGeometry(.01, 4, 3);
    for (let i = 0; i < 6; i++) {
      const spark = mesh(sparkGeometry, new THREE.MeshBasicMaterial({ color: 0xeac17a, transparent: true, opacity: 0 }), camp, 0, 0, 0);
      spark.visible = false;
      sparks.push(spark);
    }
  }
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xf1dda6, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide });
  const marker = mesh(new THREE.RingGeometry(.12, .15, 36), markerMaterial, root, 0, 0, 0);
  marker.name = 'traveler-destination';
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  let heading = 0, walking = 0, seated = 0, leaning = 0, fireAmount = 0;
  let campPlaced = false, lastState = 'idle', stateTime = 0, walkTime = 0;
  const approach = (from, to, speed, dt) => THREE.MathUtils.lerp(from, to, 1 - Math.exp(-speed * dt));

  function update(dt, time, state, nightBlend = 0) {
    dt = Math.max(0, Math.min(dt || 0, .1));
    if (state !== lastState) { stateTime = 0; lastState = state; }
    stateTime += dt;
    const calm = matches(reduced);
    const onFoot = state === 'walking';
    walking = approach(walking, onFoot ? 1 : 0, 9, dt);
    seated = approach(seated, state === 'sitting' ? 1 : 0, 6, dt);
    leaning = approach(leaning, state === 'lighting' ? 1 : 0, 7, dt);
    walkTime += dt * walking * 9;
    const step = calm ? 0 : Math.sin(walkTime) * walking;
    const breath = calm ? 0 : Math.sin(time * 1.9) * .007 * (1 - walking);
    const turn = Math.atan2(Math.sin(heading - group.rotation.y), Math.cos(heading - group.rotation.y));
    group.rotation.y += turn * (1 - Math.exp(-10 * dt));
    body.position.y = .38 - seated * .17 - leaning * .06 + Math.abs(step) * .014 + breath;
    body.position.z = seated * .01;
    body.rotation.x = leaning * .38 + seated * .08 + walking * .035;
    body.rotation.z = step * .03;
    cloak.scale.y = 1 - seated * .17;
    cloak.scale.x = 1 + seated * .12;
    cloak.rotation.x = calm ? 0 : Math.sin(time * 2.4) * .025 * (1 - seated) + step * .025;
    head.rotation.x = leaning * .17 + seated * .07;
    head.rotation.y = calm ? 0 : Math.sin(time * .55) * .06 * (1 - walking) * (1 - leaning);
    for (let i = 0; i < feet.length; i++) {
      const stride = step * (i ? -1 : 1);
      feet[i].position.set((i ? 1 : -1) * (.073 + seated * .04), .028 + Math.max(0, stride) * .035, .058 + stride * .063 + seated * .17);
      feet[i].rotation.x = seated * -.23;
      arms[i].rotation.x = -seated * .7 - leaning * (i ? 1.15 : .65) - stride * .28;
      arms[i].rotation.z = (i ? -1 : 1) * (.08 + seated * .2);
    }
    cloth.emissiveIntensity = .12 + nightBlend * .20;
    eyeMaterial.emissiveIntensity = .6 + nightBlend * .5;
    groundShadow.material.opacity = .14 - nightBlend * .05;
    markerMaterial.opacity = .65 + nightBlend * .2;

    const atCamp = campPlaced && (state === 'lighting' || state === 'sitting' || state === 'standing');
    camp.visible = atCamp;
    const ignition = state === 'lighting' ? THREE.MathUtils.smoothstep(stateTime, .25, 1.15) : 1;
    fireAmount = approach(fireAmount, atCamp ? ignition : 0, 6, dt);
    const flicker = calm ? 1 : 1 + Math.sin(time * 8) * .065 + Math.sin(time * 12.7) * .035;
    flameGroup.scale.setScalar(Math.max(.001, fireAmount));
    fireLight.intensity = fireAmount * (1.1 + nightBlend * 1.3) * flicker;
    ember.emissiveIntensity = fireAmount * (.8 + nightBlend * .5);
    flames.forEach((flame, i) => {
      const pulse = calm ? 0 : Math.sin(time * (6 + i) + i * 2.1);
      flame.scale.y = (i === 0 ? 1 : .74) * (1 + pulse * .10);
      flame.rotation.z = calm ? 0 : Math.sin(time * 3.7 + i * 2.4) * .10;
    });
    sparks.forEach((spark, i) => {
      spark.visible = atCamp && !calm && !matches(mobile) && fireAmount > .1;
      if (!spark.visible) return;
      const life = (time * .36 + i / sparks.length) % 1;
      spark.position.set(Math.sin(i * 2.4 + life * 3) * (.04 + life * .10), .2 + life * .66, Math.cos(i * 1.7 + life * 3) * (.03 + life * .08));
      spark.material.opacity = Math.sin(life * Math.PI) * .68 * fireAmount;
      spark.scale.setScalar(1 - life * .6);
    });
  }

  return {
    group, camp, marker, update,
    setPosition(x, y, z) { group.position.set(x, y, z); },
    setHeading(angle) { if (Number.isFinite(angle)) heading = angle; },
    setCamp(x, y, z, angle = 0) {
      camp.position.set(x, y, z);
      camp.rotation.y = angle;
      // The stone ring follows a gentle slope without tilting the flames.
      if (heightAt) stoneRing.forEach((stone, i) => {
        const sx = x + stone.position.x * Math.cos(angle) + stone.position.z * Math.sin(angle);
        const sz = z - stone.position.x * Math.sin(angle) + stone.position.z * Math.cos(angle);
        stone.position.y = .049 + THREE.MathUtils.clamp(heightAt(sx, sz) - y, -.07, .07);
      });
      campPlaced = true;
      fireAmount = 0;
      stateTime = 0;
    },
    clearCamp() { campPlaced = false; camp.visible = false; fireAmount = 0; fireLight.intensity = 0; },
    showTarget(x, y, z) { marker.position.set(x, y + .025, z); marker.visible = true; },
    hideTarget() { marker.visible = false; }
  };
};
