window.createCampScene = function createCampScene(THREE, OrbitControls, { reduced, onClose } = {}) {
  const motion = reduced || matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.createElement('dialog');
  dialog.className = 'camp-scene'; dialog.setAttribute('aria-labelledby', 'campSceneTitle');
  dialog.innerHTML = `<canvas tabindex="0" aria-label="帐篷营地，拖动旋转帐篷和草地"></canvas>
    <header class="camp-header"><button class="camp-close" type="button" aria-label="返回地图" title="返回地图">←</button>
    <div><span class="camp-eyebrow">A PLACE TO RETURN</span><h2 class="camp-title" id="campSceneTitle">我的营地</h2></div></header>
    <div class="camp-caption"><p>风停在帐篷前。这里，慢慢成为你的家。</p><small>拖动看看这片草地</small></div>`;
  document.body.append(dialog);
  const canvas = dialog.querySelector('canvas'), closeButton = dialog.querySelector('.camp-close');
  let renderer, scene, camera, controls, sun, hemisphere, tent, observer;
  let frame = 0, dirty = true, lastFrame = 0, night = false, returnFocus = null, disposed = false, failed = false;
  function render() {
    if (!renderer || !dialog.open || document.hidden || disposed) return;
    dirty = false; controls.update(); renderer.render(scene, camera);
    canvas.dataset.sceneReady = 'true';
  }
  function animate(time) {
    frame = 0;
    if (!dialog.open || document.hidden || disposed || !renderer) return;
    if (time - lastFrame > 30 && dirty) { render(); lastFrame = time; }
    // OrbitControls invalidates each damping step; a resting camp draws no frames.
    if (dirty && !frame) frame = requestAnimationFrame(animate);
  }
  function invalidate() {
    dirty = true;
    if (dialog.open && !document.hidden && !frame && renderer) frame = requestAnimationFrame(animate);
  }
  function fit() {
    if (!renderer || !dialog.open) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height, span = Math.max(8.7, 11 / aspect);
    camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
    camera.top = span / 2; camera.bottom = -span / 2;
    camera.updateProjectionMatrix(); invalidate();
  }
  function setNight(value) {
    night = Boolean(value); dialog.dataset.night = String(night);
    if (!scene) return;
    const blend = night ? 1 : 0;
    sun.color.set(night ? 0xbdd9dc : 0xffedce); sun.intensity = night ? 1.2 : 2.55;
    hemisphere.color.set(night ? 0xa3bdb0 : 0xeef0dd); hemisphere.groundColor.set(night ? 0x536d57 : 0x7c9266);
    hemisphere.intensity = night ? 1.25 : 1.8;
    tent.userData.setNight(blend); renderer.toneMappingExposure = night ? .95 : 1.05;
    invalidate();
  }
  function build() {
    if (renderer || failed) return;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 60);
    camera.position.set(7, 9, 12);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(max-width:700px)').matches ? 1.5 : 1.8));
    renderer.setClearColor(0xdce5d4, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    controls = new OrbitControls(camera, canvas); controls.target.set(0, .32, 0);
    controls.enableDamping = !motion.matches; controls.dampingFactor = .075; controls.enablePan = false;
    controls.rotateSpeed = .40; controls.minPolarAngle = .48; controls.maxPolarAngle = 1.17;
    controls.minZoom = .78; controls.maxZoom = 1.65; controls.update(); controls.addEventListener('change', invalidate);
    sun = new THREE.DirectionalLight(0xffedce, 2.55); sun.position.set(-5, 12, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .1, far: 35 });
    sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; sun.shadow.radius = 4;
    hemisphere = new THREE.HemisphereLight(0xeef0dd, 0x7c9266, 1.8); scene.add(sun, hemisphere);
    const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .97 });
    const vertices = [], colors = [], indices = [], rings = 28, segments = 96;
    const groundHeight = (x, z) => .05 + .025 * Math.sin(x * 1.2 + z * .4) + .021 * Math.cos(z * 1.5);
    const bounds = a => 1 + .035 * Math.sin(a * 5) + .027 * Math.cos(a * 7);
    for (let r = 0; r <= rings; r++) for (let s = 0; s <= segments; s++) {
      const angle = s / segments * Math.PI * 2, radius = r / rings * bounds(angle);
      const x = Math.cos(angle) * radius * 4.1, z = Math.sin(angle) * radius * 3.1;
      vertices.push(x, groundHeight(x, z), z);
      const color = new THREE.Color(0x9fb784).lerp(new THREE.Color(0xb8c48f), (.5 + .5 * Math.sin(x * 1.8) * Math.cos(z * 1.4)) * .55);
      colors.push(color.r, color.g, color.b);
      if (r < rings && s < segments) { const i = r * (segments + 1) + s; indices.push(i, i + 1, i + segments + 1, i + 1, i + segments + 2, i + segments + 1); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const meadow = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xf1eedc, vertexColors: true, roughness: 1 }));
    meadow.receiveShadow = true; scene.add(meadow);
    const rimVertices = [], rimIndices = [];
    for (let s = 0; s <= segments; s++) {
      const angle = s / segments * Math.PI * 2, radius = bounds(angle), x = Math.cos(angle) * radius * 4.1, z = Math.sin(angle) * radius * 3.1;
      rimVertices.push(x, groundHeight(x, z), z, x * .99, -.16, z * .99);
      if (s < segments) { const i = s * 2; rimIndices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
    }
    const rimGeometry = new THREE.BufferGeometry(); rimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rimVertices, 3));
    rimGeometry.setIndex(rimIndices); rimGeometry.computeVertexNormals(); scene.add(new THREE.Mesh(rimGeometry, mat(0xa4af8b)));
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x687451, opacity: .12 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.18; shadow.receiveShadow = true; scene.add(shadow);
    tent = window.createQuietTent(THREE, { scale: 2.1 }); tent.position.set(-.45, groundHeight(-.45, -.5), -.5); tent.rotation.y = .22; scene.add(tent);
    // Keep the future decorating area open; a few blades simply give the grass depth.
    const grassVertices = [];
    for (let i = 0; i < 460; i++) {
      const angle = i * 2.399963, radius = Math.sqrt((i + .5) / 460) * .96;
      const x = Math.cos(angle) * radius * 4.1, z = Math.sin(angle) * radius * 3.1;
      if (Math.abs(x + .45) < 1.6 && Math.abs(z + .5) < 1.35) continue;
      const y = groundHeight(x, z), h = .065 + (i % 7) * .007;
      grassVertices.push(x - .016, y, z, x + .016, y, z, x + Math.sin(i) * .03, y + h, z + .016);
    }
    const grassGeometry = new THREE.BufferGeometry(); grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassVertices, 3)); grassGeometry.computeVertexNormals();
    scene.add(new THREE.Mesh(grassGeometry, new THREE.MeshStandardMaterial({ color: 0x839e6c, side: THREE.DoubleSide, roughness: 1 })));
    observer = new ResizeObserver(fit); observer.observe(canvas); setNight(night); fit();
  }
  function open() {
    if (disposed || dialog.open) return;
    returnFocus = document.activeElement;
    dialog.showModal();
    document.dispatchEvent(new CustomEvent('journey:camp', { detail: { open: true } }));
    try { build(); fit(); invalidate(); }
    catch (error) {
      failed = true;
      const notice = document.createElement('p'); notice.className = 'camp-error'; notice.textContent = '这片草地暂时没能展开，请回地图后刷新再试。'; dialog.append(notice);
      console.error('Unable to create camp scene:', error);
    }
    closeButton.focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open) return;
    dialog.close();
  }
  function closed() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    document.dispatchEvent(new CustomEvent('journey:camp', { detail: { open: false } }));
    onClose?.();
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
  }
  function visibility() {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else if (dialog.open) invalidate();
  }
  function motionChanged() { if (controls) controls.enableDamping = !motion.matches; invalidate(); }
  function themeChanged(event) { setNight(event.detail.night); }
  closeButton.addEventListener('click', close);
  dialog.addEventListener('close', closed);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.target === canvas && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  });
  dialog.addEventListener('keyup', event => event.stopPropagation());
  document.addEventListener('visibilitychange', visibility); document.addEventListener('journey:map-theme', themeChanged);
  motion.addEventListener('change', motionChanged);
  return {
    open, close, isOpen: () => dialog.open, setNight,
    destroy() {
      close(); disposed = true;
      if (frame) cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose();
      const geometries = new Set(), materials = new Set();
      scene?.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); renderer?.dispose(); dialog.remove();
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('journey:map-theme', themeChanged); motion.removeEventListener('change', motionChanged);
    }
  };
};
