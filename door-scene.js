/* The entrance is built in world units with the threshold at ground level. */
window.createDoorScene = function createDoorScene(THREE, canvas) {
  if (!canvas) return;
  const landing = document.getElementById('landing');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = matchMedia('(max-width: 700px)');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 50);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setClearColor(0xdce5d4, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let seed = 1406;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const range = (a, b) => a + random() * (b - a);
  const pick = list => list[Math.floor(random() * list.length)];
  const model = new THREE.Group();
  scene.add(model);
  scene.add(new THREE.HemisphereLight(0xf0f1db, 0x7a8d6c, 2.0));
  const sun = new THREE.DirectionalLight(0xffebc9, 3.05);
  sun.position.set(-3.5, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 6, bottom: -4, near: .1, far: 20 });
  sun.shadow.bias = -.00025;
  sun.shadow.normalBias = .025;
  sun.shadow.radius = 4;
  sun.target.position.set(0, 1.4, 0);
  scene.add(sun, sun.target);
  const skyFill = new THREE.DirectionalLight(0xd9e8e6, .8);
  skyFill.position.set(5, 3, -4);
  scene.add(skyFill);

  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 128;
  const grain = grainCanvas.getContext('2d');
  grain.fillStyle = '#b8b6ab';
  grain.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4000; i++) {
    const shade = Math.floor(range(145, 216));
    grain.fillStyle = `rgba(${shade},${shade},${shade - 6},.28)`;
    grain.fillRect(random() * 128, random() * 128, range(.4, 1.6), range(.3, 1.3));
  }
  const grainMap = new THREE.CanvasTexture(grainCanvas);
  grainMap.wrapS = grainMap.wrapT = THREE.RepeatWrapping;
  grainMap.repeat.set(1.3, 1.3);
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .97, ...options });
  const stones = [0x8d997a, 0x9aa383, 0xa6ae8d, 0x879575, 0xb0b494].map(color => material(color, { bumpMap: grainMap, bumpScale: .012 }));
  const trim = material(0xb1b799, { bumpMap: grainMap, bumpScale: .008 });
  const plantMaterial = material(0x6f874e);
  const mossColors = [0x819955, 0x93a866, 0x72894d, 0xa0ad70];
  const mossPatches = [];

  function polygon(points, depth, mat, bevel = .025) {
    const outline = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 1, steps: 1, curveSegments: 8
    }), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    model.add(mesh);
    return mesh;
  }

  function stone(x, y, width, height, depth = .58, mat = pick(stones), moss = false) {
    const c = Math.min(width, height) * range(.065, .14);
    const w = width / 2;
    const h = height / 2;
    const points = [[-w + c, -h], [w - c * .8, -h + .004], [w, -h + c],
      [w - .012, h - c], [w - c, h], [-w + c * 1.4, h + .008], [-w, h - c], [-w, -h + c]];
    const mesh = polygon(points, depth, mat, .018);
    mesh.position.set(x, y, -.29 + range(-.025, .025));
    mesh.rotation.z = range(-.013, .013);
    if (moss) {
      for (let j = 0; j < 4; j++) {
        mossPatches.push({ x: x + range(-w * .85, w * .85), y: y + h + .016,
          z: range(-.18, .28), sx: range(.09, .17), sy: .025, sz: range(.06, .12) });
      }
    }
    return mesh;
  }

  // Curved inner and outer edges give each arch stone a real wedge profile.
  const archPoint = (t, outer = false, side = -1) => {
    const w = outer ? 1.255 : .805;
    const shoulder = outer ? 1.30 : .84;
    const controlY = outer ? 2.68 : 2.52;
    const crown = outer ? 3.62 : 3.17;
    return new THREE.Vector2(side * ((1 - t) ** 2 * w + 2 * (1 - t) * t * shoulder),
      (1 - t) ** 2 * 1.78 + 2 * (1 - t) * t * controlY + t * t * crown);
  };

  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      stone(side * 1.04, .18 + row * .352, .455, .322, .66, pick(stones), row === 0 || row === 4);
    }
    stone(side * 1.045, .065, .65, .13, .79, trim, true);
    stone(side * 1.045, 1.77, .58, .11, .73, trim, false);
    for (let i = 0; i < 8; i++) {
      const t0 = i / 8 + .006;
      const t1 = (i + 1) / 8 - .006;
      const points = [];
      for (let step = 0; step <= 4; step++) points.push(archPoint(t0 + (t1 - t0) * step / 4, false, side).toArray());
      for (let step = 4; step >= 0; step--) points.push(archPoint(t0 + (t1 - t0) * step / 4, true, side).toArray());
      const wedge = polygon(points, .68, pick(stones), .015);
      wedge.position.z = -.30;
      if (i > 4 || (side === -1 && i < 2)) {
        const p = archPoint((t0 + t1) / 2, true, side);
        mossPatches.push({ x: p.x, y: p.y + .015, z: .12, sx: .16, sy: .026, sz: .18 });
      }
    }
    const moldingPoints = [new THREE.Vector3(side * .784, .14, .43), new THREE.Vector3(side * .784, 1.77, .43)];
    for (let i = 1; i <= 25; i++) {
      const p = archPoint(i / 25, false, side);
      moldingPoints.push(new THREE.Vector3(p.x * .975, p.y, .43));
    }
    const molding = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(moldingPoints), 70, .029, 6, false), trim);
    molding.castShadow = true;
    model.add(molding);
  }

  const extents = [[1.76, 1.82, 1.71, 1.77, 1.69, 1.64, 1.55, 1.28, .83],
    [1.85, 1.87, 1.80, 1.83, 1.75, 1.74, 1.66, 1.49, 1.05]];
  function outerX(y) {
    if (y <= 1.78) return 1.255;
    let low = 0, high = 1;
    for (let i = 0; i < 16; i++) {
      const middle = (low + high) / 2;
      if (archPoint(middle, true, 1).y < y) low = middle;
      else high = middle;
    }
    return archPoint((low + high) / 2, true, 1).x;
  }
  for (const [s, side] of [-1, 1].entries()) {
    for (let row = 0; row < 9; row++) {
      const y = .19 + row * .385;
      const start = outerX(y - .19) + .035;
      const width = extents[s][row] - start;
      if (width < .10) continue;
      const count = Math.max(1, Math.ceil(width / .56));
      for (let j = 0; j < count; j++) {
        stone(side * (start + width * (j + .5) / count), y, width / count - .035, .342,
          range(.48, .57), pick(stones), random() > .52 || row > 6);
      }
    }
  }
  stone(.53, 3.58, .61, .28, .53, stones[1], true);
  stone(.64, 3.81, .35, .18, .46, stones[3], true);

  const patchGeometry = new THREE.IcosahedronGeometry(1, 1);
  const dummy = new THREE.Object3D();
  const moss = new THREE.InstancedMesh(patchGeometry, plantMaterial, mossPatches.length);
  mossPatches.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(range(-.1, .1), random() * 6, 0);
    dummy.scale.set(p.sx, p.sy, p.sz);
    dummy.updateMatrix(); moss.setMatrixAt(i, dummy.matrix);
    moss.setColorAt(i, new THREE.Color(pick(mossColors)));
  });
  moss.castShadow = true;
  model.add(moss);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(-.7, .30, -.48, .73);
  leafShape.quadraticCurveTo(-.17, .81, 0, 1.2);
  leafShape.quadraticCurveTo(.65, .68, .5, .34); leafShape.quadraticCurveTo(.25, .1, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 4);
  const leafMaterial = material(0x70834f, { side: THREE.DoubleSide });
  const leaves = [];
  const vinePaths = [
    [[-1.51, .18, .36], [-1.56, .91, .36], [-1.47, 1.65, .38], [-1.50, 2.39, .38], [-1.16, 2.78, .42], [-.62, 3.20, .46]],
    [[1.66, .08, .37], [1.61, .70, .36], [1.71, 1.29, .34], [1.62, 1.83, .37], [1.46, 2.30, .39]],
    [[.80, 3.43, .39], [.80, 3.10, .42], [1.04, 2.91, .42], [1.02, 2.62, .45]]
  ];
  for (const path of vinePaths) {
    const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p)));
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 25, .012, 4, false), material(0x667746));
    model.add(stem);
    for (let i = 0; i < 27; i++) {
      const p = curve.getPoint(i / 27);
      leaves.push({ position: p, angle: (i % 2 ? -1 : 1) * range(.65, 1.85), scale: range(.08, .15) });
    }
  }
  const ivy = new THREE.InstancedMesh(leafGeometry, leafMaterial, leaves.length);
  leaves.forEach((leaf, i) => {
    dummy.position.copy(leaf.position);
    dummy.position.z += .03;
    dummy.rotation.set(range(-.4, .4), range(-.25, .25), leaf.angle);
    dummy.scale.setScalar(leaf.scale); dummy.updateMatrix(); ivy.setMatrixAt(i, dummy.matrix);
    ivy.setColorAt(i, new THREE.Color(pick([0x8ca760, 0xc0c991, 0x839c5c])));
  });
  ivy.castShadow = true;
  model.add(ivy);

  // A transparent outer ring lets the grass dissolve into the page background.
  const positions = [], colors = [], indices = [];
  const rings = 12, segments = 64;
  const groundColors = [new THREE.Color(0x98ac7b), new THREE.Color(0xb9c99d)];
  for (let r = 0; r <= rings; r++) {
    const f = r / rings;
    for (let s = 0; s <= segments; s++) {
      const a = s / segments * Math.PI * 2;
      const edge = 1 + .09 * Math.sin(a * 3) + .05 * Math.cos(a * 7);
      const x = Math.cos(a) * f * 2.85 * edge;
      const z = Math.sin(a) * f * 1.53 * edge;
      positions.push(x, -.04 + .065 * (1 - f * f), z);
      const c = groundColors[0].clone().lerp(groundColors[1], f * .85 + random() * .08);
      colors.push(c.r, c.g, c.b, 1 - THREE.MathUtils.smoothstep(f, .67, 1));
      if (r < rings && s < segments) {
        const v = r * (segments + 1) + s;
        indices.push(v, v + segments + 1, v + 1, v + 1, v + segments + 1, v + segments + 2);
      }
    }
  }
  const groundGeometry = new THREE.BufferGeometry();
  groundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  groundGeometry.setIndex(indices); groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, material(0xf0f0e7, { vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  ground.receiveShadow = true;
  model.add(ground);
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.ShadowMaterial({ color: 0x556644, opacity: .15 }));
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -.06;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  for (let i = 0; i < 17; i++) {
    const side = i % 2 ? 1 : -1;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), pick(stones));
    rock.scale.set(range(.12, .27), range(.08, .18), range(.11, .23));
    rock.position.set(side * range(1.38, 2.34), rock.scale.y * .55, range(-.3, .88));
    rock.rotation.set(range(-.2, .2), range(0, 6), range(-.3, .3));
    rock.castShadow = rock.receiveShadow = true;
    model.add(rock);
  }
  for (let i = 0; i < 4; i++) {
    const slab = stone(range(-.09, .1), .055, .85 - i * .1, .075, .36, stones[2]);
    slab.position.z = .38 + i * .43;
    slab.rotation.y = range(-.13, .13);
  }

  const blades = [];
  for (let i = 0; i < 210; i++) {
    const x = range(-2.30, 2.30), z = range(-.65, 1.15);
    if (Math.abs(x) < .62 || (x / 2.45) ** 2 + (z / 1.4) ** 2 > .92) continue;
    const h = range(.08, .23), w = .018;
    blades.push(x - w, .025, z, x + w, .025, z, x + range(-.06, .06), h, z + .025);
  }
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
  grassGeometry.computeVertexNormals();
  model.add(new THREE.Mesh(grassGeometry, material(0x869a60, { side: THREE.DoubleSide })));
  for (let i = 0; i < 17; i++) {
    const x = (i % 2 ? -1 : 1) * range(1.15, 2.22), z = range(.25, 1.0);
    const height = range(.10, .24);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, height, 3), plantMaterial);
    stem.position.set(x, height / 2, z); model.add(stem);
    const blossom = new THREE.Mesh(new THREE.IcosahedronGeometry(.026, 1), material(i % 4 === 0 ? 0xc2b6ac : 0xead8a3));
    blossom.position.set(x, height, z); model.add(blossom);
  }

  const opening = new THREE.Shape();
  opening.moveTo(-.79, .08); opening.lineTo(.79, .08); opening.lineTo(.79, 1.78);
  opening.quadraticCurveTo(.84, 2.52, 0, 3.17);
  opening.quadraticCurveTo(-.84, 2.52, -.79, 1.78); opening.closePath();
  const lightVeil = new THREE.Mesh(new THREE.ShapeGeometry(opening, 36), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { warmth: { value: 1 } },
    vertexShader: 'varying vec2 place; void main(){place=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float warmth; varying vec2 place; void main(){float edge=1.0-smoothstep(0.08,0.82,abs(place.x));float alpha=(0.20+edge*0.27)*(1.0-smoothstep(1.8,3.2,place.y));gl_FragColor=vec4(1.0,0.88,0.57,min(0.86,alpha*warmth));}'
  }));
  lightVeil.position.z = -.31; model.add(lightVeil);
  const doorLight = new THREE.PointLight(0xffda83, 1.0, 3.6, 2);
  doorLight.position.set(0, 1.3, .3); model.add(doorLight);

  const traveler = new THREE.Group();
  traveler.position.set(.07, .115, .48);
  traveler.rotation.y = .20;
  model.add(traveler);
  const cloth = material(0xf1efe1, { emissive: 0xe2d9ae, emissiveIntensity: .27, roughness: .88 });
  const clothPoints = [[.23, .035], [.255, .06], [.23, .16], [.17, .34], [.137, .49], [.10, .55]];
  const cloakGeometry = new THREE.LatheGeometry(clothPoints.map(p => new THREE.Vector2(...p)), 28);
  const cloakPositions = cloakGeometry.attributes.position;
  for (let i = 0; i < cloakPositions.count; i++) {
    const angle = Math.atan2(cloakPositions.getX(i), cloakPositions.getZ(i));
    const fold = 1 + .055 * Math.sin(angle * 7) * (1 - cloakPositions.getY(i));
    cloakPositions.setX(i, cloakPositions.getX(i) * fold);
    cloakPositions.setZ(i, cloakPositions.getZ(i) * fold * .78);
  }
  cloakGeometry.computeVertexNormals();
  const cloak = new THREE.Mesh(cloakGeometry, cloth);
  cloak.castShadow = true; traveler.add(cloak);
  const head = new THREE.Group();
  head.position.y = .55;
  traveler.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(.158, 20, 14), cloth);
  hood.scale.set(1, 1.07, .94); hood.position.y = .01;
  hood.castShadow = true; head.add(hood);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.102, 16, 10), material(0x7b8b75));
  face.scale.set(.85, .8, .20); face.position.set(0, .003, .146); head.add(face);
  const feet = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(.065, .19, 4), cloth);
    ear.position.set(side * .115, .165, -.002); ear.rotation.z = side * -.19;
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.009, 6, 4), new THREE.MeshBasicMaterial({ color: 0xf0ead2 }));
    eye.position.set(side * .031, .01, .167); head.add(eye);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.041, 8, 6), material(0x8c8973));
    foot.position.set(side * .083, .021, .065); foot.scale.set(.75, .4, 1.25); traveler.add(foot);
    feet.push(foot);
  }
  const clasp = new THREE.Mesh(new THREE.IcosahedronGeometry(.029, 1), material(0xcab378, { metalness: .3, roughness: .5 }));
  clasp.position.set(0, .424, .119); traveler.add(clasp);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowGradient.addColorStop(0, 'rgba(255,235,179,.45)');
  glowGradient.addColorStop(.4, 'rgba(255,231,155,.12)');
  glowGradient.addColorStop(1, 'rgba(255,226,140,0)');
  glowContext.fillStyle = glowGradient; glowContext.fillRect(0, 0, 64, 64);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), depthWrite: false, transparent: true }));
  glow.scale.set(1.2, 1.5, 1); glow.position.set(.07, .66, .43); model.add(glow);

  const sparks = new THREE.Group();
  model.add(sparks);
  for (let i = 0; i < 7; i++) {
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow.material.map, transparent: true, depthWrite: false, opacity: 0
    }));
    spark.scale.setScalar(.105);
    spark.userData.phase = i / 7 * Math.PI * 2;
    sparks.add(spark);
  }

  const pointer = new THREE.Vector2();
  const target = new THREE.Vector3(0, 1.74, .12);
  const cameraHome = new THREE.Vector3(4.4, 3.6, 12);
  const travelerHome = traveler.position.clone();
  const projectedBox = new THREE.Box3();
  const projectedCorner = new THREE.Vector3();
  const entranceButton = document.getElementById('enterBtn');
  let active = landing.classList.contains('active');
  let needsFrame = true;
  let frame = 0;
  let previousTime = 0;
  let transitionStart = null;
  let completed = false;
  let canvasHover = false;
  let buttonHover = false;
  let hoverAmount = 0;
  let travelerBounds = null;
  const duration = 1650;
  const smooth = value => {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  };
  function requestFrame() {
    needsFrame = true;
    if (active && !document.hidden && !frame) frame = requestAnimationFrame(tick);
  }
  const inspectPixels = new URLSearchParams(location.search).has('inspectDoor');
  let lastPixelCheck = 0;
  function checkPixels(time) {
    if (!inspectPixels || time - lastPixelCheck < 900) return;
    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let painted = 0, checksum = 0, left = width, right = 0, top = height, bottom = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        if (pixels[i + 3] < 220) continue;
        painted++;
        checksum = (checksum + pixels[i] * 3 + pixels[i + 1] * 5 + pixels[i + 2] * 7) >>> 0;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, height - y); bottom = Math.max(bottom, height - y);
      }
    }
    canvas.dataset.pixelCheck = JSON.stringify({ width, height, painted, checksum, bounds: [left, top, right, bottom] });
    lastPixelCheck = time;
  }
  function fit() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const span = Math.max(10.1, 6.15 / aspect, height / 88);
    camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
    camera.top = span / 2; camera.bottom = -span / 2;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const step = new THREE.Vector3(0, 0, 1.9).project(camera);
    const labelY = Math.min(height - 60, (1 - step.y) * height / 2 + 32);
    landing.style.setProperty('--door-cta-y', `${labelY}px`);
    requestFrame();
  }
  new ResizeObserver(fit).observe(canvas);
  camera.position.copy(cameraHome); camera.lookAt(target);
  fit();
  function updateTravelerBounds() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    projectedBox.setFromObject(traveler);
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < 8; i++) {
      projectedCorner.set(i & 1 ? projectedBox.max.x : projectedBox.min.x,
        i & 2 ? projectedBox.max.y : projectedBox.min.y,
        i & 4 ? projectedBox.max.z : projectedBox.min.z).project(camera);
      const x = rect.left + (projectedCorner.x + 1) * rect.width / 2;
      const y = rect.top + (1 - projectedCorner.y) * rect.height / 2;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const width = Math.max(44, right - left + 16);
    const height = Math.max(44, bottom - top + 12);
    travelerBounds = { x: (left + right - width) / 2, y: (top + bottom - height) / 2, width, height };
    canvas.dataset.travelerBounds = JSON.stringify(travelerBounds);
  }
  function overTraveler(event) {
    if (!travelerBounds) updateTravelerBounds();
    const b = travelerBounds;
    return b && event.clientX >= b.x && event.clientX <= b.x + b.width &&
      event.clientY >= b.y && event.clientY <= b.y + b.height;
  }
  function finishEntrance() {
    if (completed || transitionStart === null || !active) return;
    completed = true;
    transitionStart = null;
    canvas.dataset.transitionState = 'entered';
    document.dispatchEvent(new CustomEvent('journey:entered'));
  }
  function resetEntrance() {
    transitionStart = null;
    completed = false;
    canvasHover = false;
    buttonHover = false;
    hoverAmount = 0;
    pointer.set(0, 0);
    traveler.position.copy(travelerHome);
    traveler.rotation.set(0, .20, 0);
    traveler.scale.setScalar(1);
    cloak.rotation.set(0, 0, 0);
    cloak.scale.setScalar(1);
    head.rotation.set(0, 0, 0);
    feet.forEach(foot => { foot.position.y = .021; foot.position.z = .065; });
    glow.scale.set(1.2, 1.5, 1);
    glow.position.set(.07, .66, .43);
    glow.material.opacity = .7;
    cloth.emissiveIntensity = .27;
    doorLight.intensity = 1;
    lightVeil.material.uniforms.warmth.value = 1;
    camera.position.copy(cameraHome);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    canvas.style.cursor = 'default';
    canvas.dataset.transitionState = 'idle';
    landing.removeAttribute('aria-busy');
    if (entranceButton) entranceButton.disabled = false;
    sparks.children.forEach(spark => { spark.material.opacity = 0; });
    needsFrame = true;
  }
  window.enterJourney = function enterJourney() {
    if (!active || completed || transitionStart !== null) return;
    transitionStart = performance.now();
    canvasHover = false;
    buttonHover = false;
    canvas.style.cursor = 'default';
    canvas.dataset.transitionState = 'entering';
    landing.setAttribute('aria-busy', 'true');
    if (entranceButton) entranceButton.disabled = true;
    needsFrame = true;
    if (reducedMotion.matches) finishEntrance();
    else if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  };
  function animateEntrance(time) {
    const p = THREE.MathUtils.clamp((time - transitionStart) / duration, 0, 1);
    const crouch = Math.sin(Math.PI * THREE.MathUtils.clamp(p / .2, 0, 1));
    const leap = Math.sin(Math.PI * THREE.MathUtils.clamp((p - .13) / .35, 0, 1));
    const walk = smooth((p - .41) / .56);
    const stride = Math.sin(walk * Math.PI * 5);
    traveler.position.set(travelerHome.x * (1 - walk),
      travelerHome.y + leap * .23 + Math.abs(stride) * .031,
      travelerHome.z - walk * 1.48);
    traveler.scale.set(1 + crouch * .065, 1 - crouch * .09, 1 + crouch * .04);
    traveler.rotation.y = .20 + Math.PI * smooth((p - .2) / .35);
    traveler.rotation.z = stride * .027;
    cloak.rotation.x = -leap * .10 + Math.sin(walk * 20) * .045;
    cloak.rotation.z = stride * .045;
    head.rotation.x = -leap * .1;
    head.rotation.z = -Math.sin(p * Math.PI) * .08;
    feet.forEach((foot, i) => {
      foot.position.y = .021 + Math.max(0, stride * (i ? 1 : -1)) * .035;
      foot.position.z = .065 + stride * (i ? 1 : -1) * .06;
    });
    const bloom = smooth((p - .40) / .60);
    glow.position.set(traveler.position.x, .66 + bloom * .48, .38 - walk * .25);
    glow.scale.set(1.2 + bloom * 2.2, 1.5 + bloom * 2.6, 1);
    glow.material.opacity = .78 + bloom * .22;
    cloth.emissiveIntensity = .30 + bloom * .50;
    doorLight.intensity = 1 + bloom * 2.4;
    lightVeil.material.uniforms.warmth.value = 1 + bloom * 1.15;
    camera.zoom = 1 + smooth(p) * .14;
    camera.updateProjectionMatrix();
    const cameraPush = smooth(p) * .35;
    camera.position.set(cameraHome.x - cameraPush * .30, cameraHome.y - cameraPush * .14, cameraHome.z - cameraPush);
    camera.lookAt(target);
    sparks.visible = !smallScreen.matches;
    sparks.children.forEach((spark, i) => {
      const phase = spark.userData.phase;
      spark.position.set(Math.sin(phase + p * 3) * (.27 + bloom * .4),
        .5 + (p * 1.4 + i / 7) % 1.4, .4 + Math.cos(phase + p * 2) * .2);
      spark.material.opacity = Math.sin(p * Math.PI) * .6;
    });
    return p >= 1;
  }
  canvas.addEventListener('pointermove', event => {
    if (!active || transitionStart !== null || completed) return;
    if (!reducedMotion.matches && !smallScreen.matches && event.pointerType === 'mouse') {
      pointer.set(event.clientX / innerWidth - .5, event.clientY / innerHeight - .5);
    }
    canvasHover = Boolean(overTraveler(event));
    canvas.style.cursor = canvasHover ? 'pointer' : 'default';
    requestFrame();
  });
  canvas.addEventListener('pointerleave', () => {
    canvasHover = false;
    pointer.set(0, 0);
    requestFrame();
  });
  canvas.addEventListener('click', event => {
    if (active && overTraveler(event)) window.enterJourney();
  });
  for (const eventName of ['pointerenter', 'focus']) {
    entranceButton?.addEventListener(eventName, () => { buttonHover = true; requestFrame(); });
  }
  for (const eventName of ['pointerleave', 'blur']) {
    entranceButton?.addEventListener(eventName, () => { buttonHover = false; requestFrame(); });
  }
  function tick(time) {
    frame = 0;
    if (!active || document.hidden) return;
    if (time - previousTime > 30 && (!reducedMotion.matches || needsFrame)) {
      const t = reducedMotion.matches ? 0 : time / 1000;
      let done = false;
      if (transitionStart !== null) {
        done = animateEntrance(time);
      } else {
        const parallax = reducedMotion.matches || smallScreen.matches ? 0 : 1;
        camera.position.x += (cameraHome.x + pointer.x * .62 * parallax - camera.position.x) * .065;
        camera.position.y += (cameraHome.y - pointer.y * .32 * parallax - camera.position.y) * .065;
        camera.lookAt(target);
        const hover = canvasHover || buttonHover ? 1 : 0;
        hoverAmount = reducedMotion.matches ? hover : hoverAmount + (hover - hoverAmount) * .13;
        const breathing = Math.sin(t * 1.65);
        traveler.scale.y = 1 + breathing * .011;
        cloak.scale.set(1 + breathing * .014, 1, 1);
        cloak.rotation.z = reducedMotion.matches ? 0 : Math.sin(t * 1.5) * (.012 + hoverAmount * .032);
        head.rotation.z = reducedMotion.matches ? 0 : -hoverAmount * .15 + Math.sin(t * .8) * .015;
        head.rotation.x = -hoverAmount * .065;
        glow.material.opacity = .70 + breathing * .06 + hoverAmount * .17;
        cloth.emissiveIntensity = .27 + hoverAmount * .18;
        doorLight.intensity = 1 + hoverAmount * .22;
        sparks.visible = false;
      }
      renderer.render(scene, camera);
      if (transitionStart === null) updateTravelerBounds();
      checkPixels(time);
      previousTime = time; needsFrame = false;
      canvas.dataset.sceneReady = 'true';
      if (done) finishEntrance();
    }
    if (active && !document.hidden && (!reducedMotion.matches || needsFrame)) frame = requestAnimationFrame(tick);
  }
  function resume() {
    const nextActive = landing.classList.contains('active');
    if (nextActive !== active) resetEntrance();
    active = nextActive;
    needsFrame = true;
    if (active && reducedMotion.matches && transitionStart !== null) finishEntrance();
    if (active && !document.hidden && !frame) frame = requestAnimationFrame(tick);
    else if ((!active || document.hidden) && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  new MutationObserver(resume).observe(landing, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', resume);
  reducedMotion.addEventListener('change', resume);
  smallScreen.addEventListener('change', resume);
  resetEntrance();
  resume();
};
