(() => {
  // Coordinates follow the original paintings, so effects stay attached while panning.
  const scenes = {
    'gate-breeze': {
      patches: [
        { box: [0, 59, 14, 24], amount: [5, 2], period: 6.8, phase: 0.4 },
        { box: [90, 37, 10, 38], amount: [-5, 2], period: 7.6, phase: 2 },
        { box: [46.7, 65.3, 11.5, 5.4], amount: [3, 1.5], period: 5.6, phase: 1.1 }
      ],
      light: {
        box: [13, 24, 75, 54], origin: [49, 25], period: 11,
        polygon: [[38, 35], [40, 29], [48, 25], [57, 26], [62, 33], [64, 52], [86, 77], [15, 77], [36, 53]],
        strength: 0.18
      }
    },
    'tower-flight': {
      patches: [
        { box: [36.6, 31.8, 7.2, 5.5], amount: [2.2, 3.7], period: 4.3, phase: 0.8 },
        { box: [59, 39.5, 6.4, 4.3], amount: [-2, 3.2], period: 5.1, phase: 2.1 }
      ],
      light: {
        box: [15, 3, 80, 65], origin: [60, 8], period: 13,
        polygon: [[59, 3], [66, 6], [68, 13], [95, 59], [76, 68], [15, 52], [51, 15], [52, 8]],
        strength: 0.23
      },
      bird: true
    },
    'quiet-pages': {
      patches: [
        { box: [28.5, 21, 13.3, 5.6], amount: [2.1, 1.2], period: 6.2, phase: 0.2 },
        { box: [35.8, 20.8, 5, 2.5], amount: [0.5, 1.4], period: 4.8, phase: 1.5 },
        { box: [82.6, 0, 6.4, 9], amount: [2.7, 0.7], period: 7.5, phase: 2.4 },
        { box: [43.8, 31, 7.8, 5.4], amount: [-2.2, 2.8], period: 5.2, phase: 0.6 }
      ],
      light: {
        box: [0, 0, 61, 34], origin: [12, 0], period: 12,
        polygon: [[0, 0], [29, 0], [61, 31], [28, 34], [0, 19]],
        strength: 0.16
      }
    }
  };

  function canvas(width, height) {
    const element = document.createElement('canvas');
    element.width = Math.max(1, Math.round(width));
    element.height = Math.max(1, Math.round(height));
    return element;
  }

  function place(element, box) {
    const [x, y, width, height] = box;
    Object.assign(element.style, { left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` });
  }

  // A fixed mesh boundary keeps the stonework continuous with the untouched image.
  function makePatch(image, spec, compact) {
    const [x, y, width, height] = spec.box;
    const sourceWidth = image.naturalWidth * width / 100;
    const sourceHeight = image.naturalHeight * height / 100;
    const scale = Math.min(1, (compact ? 300 : 520) / Math.max(sourceWidth, sourceHeight));
    const source = canvas(sourceWidth * scale, sourceHeight * scale);
    const context = source.getContext('2d');
    context.drawImage(image, image.naturalWidth * x / 100, image.naturalHeight * y / 100,
      sourceWidth, sourceHeight, 0, 0, source.width, source.height);
    const element = canvas(source.width, source.height);
    place(element, spec.box);
    const target = element.getContext('2d');
    const columns = 6, rows = 8, vertices = [];
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        vertices.push({ x: column / columns * source.width, y: row / rows * source.height,
          u: column / columns, v: row / rows });
      }
    }
    return { element, target, source, spec, vertices, columns, rows, scale };
  }

  function triangle(context, source, a, b, c, p, q, r) {
    const denominator = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    const xx = ((q.x - p.x) * (c.y - a.y) - (r.x - p.x) * (b.y - a.y)) / denominator;
    const xy = ((r.x - p.x) * (b.x - a.x) - (q.x - p.x) * (c.x - a.x)) / denominator;
    const yx = ((q.y - p.y) * (c.y - a.y) - (r.y - p.y) * (b.y - a.y)) / denominator;
    const yy = ((r.y - p.y) * (b.x - a.x) - (q.y - p.y) * (c.x - a.x)) / denominator;
    context.save();
    context.beginPath();
    // Slight overlap removes hairline antialiasing gaps between triangles.
    const cx = (p.x + q.x + r.x) / 3, cy = (p.y + q.y + r.y) / 3;
    [p, q, r].forEach((point, index) => {
      const dx = point.x - cx, dy = point.y - cy, length = Math.hypot(dx, dy) || 1;
      const x = point.x + dx / length * 0.45, y = point.y + dy / length * 0.45;
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.closePath();
    context.clip();
    context.setTransform(xx, yx, xy, yy, p.x - xx * a.x - xy * a.y, p.y - yx * a.x - yy * a.y);
    context.drawImage(source, 0, 0);
    context.restore();
  }

  function drawPatch(patch, time) {
    const { target, source, spec, vertices, columns, rows, scale } = patch;
    const phase = time * Math.PI * 2 / spec.period + spec.phase;
    const moved = vertices.map(point => {
      const edge = Math.sin(Math.PI * point.u) * Math.sin(Math.PI * point.v);
      const wave = Math.sin(phase + point.v * 1.8);
      return { x: point.x + edge * wave * spec.amount[0] * scale,
        y: point.y + edge * Math.sin(phase * 0.86 + point.u) * spec.amount[1] * scale };
    });
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(source, 0, 0);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
        triangle(target, source, vertices[a], vertices[b], vertices[d], moved[a], moved[b], moved[d]);
        triangle(target, source, vertices[a], vertices[d], vertices[c], moved[a], moved[d], moved[c]);
      }
    }
  }

  function makeLight(spec, image) {
    const aspect = image.naturalWidth * spec.box[2] / (image.naturalHeight * spec.box[3]);
    const element = canvas(420, 420 / aspect);
    element.className = 'living-light';
    place(element, spec.box);
    const texture = canvas(element.width, element.height);
    const context = texture.getContext('2d');
    const data = context.createImageData(texture.width, texture.height);
    let seed = 8137;
    for (let i = 0; i < data.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      data.data[i] = 242; data.data[i + 1] = 233; data.data[i + 2] = 182;
      data.data[i + 3] = 150 + seed % 95;
    }
    context.putImageData(data, 0, 0);
    const mask = canvas(element.width, element.height);
    const maskContext = mask.getContext('2d');
    const [left, top, width, height] = spec.box;
    maskContext.filter = 'blur(14px)';
    maskContext.fillStyle = '#fff';
    maskContext.beginPath();
    spec.polygon.forEach((point, index) => {
      const x = (point[0] - left) / width * element.width;
      const y = (point[1] - top) / height * element.height;
      index ? maskContext.lineTo(x, y) : maskContext.moveTo(x, y);
    });
    maskContext.closePath(); maskContext.fill();
    return { element, context: element.getContext('2d'), texture, mask, spec };
  }

  function drawLight(light, time) {
    const { element, context, spec, texture, mask } = light;
    const [left, top, width, height] = spec.box;
    const x = value => (value - left) / width * element.width;
    const y = value => (value - top) / height * element.height;
    context.clearRect(0, 0, element.width, element.height);
    context.save();
    const phase = time * Math.PI * 2 / spec.period;
    const originX = x(spec.origin[0]), originY = y(spec.origin[1]);
    context.translate(originX, originY);
    context.rotate((Math.sin(phase) * 3 - 8) * Math.PI / 180);
    for (let i = 0; i < 3; i++) {
      const drift = Math.sin(phase + i) * element.width * 0.018;
      const reach = element.height * 1.3;
      const beamX = (i - 1) * element.width * 0.24 + drift;
      const beamWidth = element.width * (0.11 + i * 0.015);
      const fade = context.createLinearGradient(beamX - beamWidth, 0, beamX + beamWidth, 0);
      fade.addColorStop(0, 'rgba(241,232,181,0)');
      fade.addColorStop(0.45, `rgba(241,232,181,${spec.strength * (0.7 + Math.sin(phase + i) * 0.25)})`);
      fade.addColorStop(1, 'rgba(241,232,181,0)');
      context.fillStyle = fade;
      context.beginPath();
      context.moveTo(-12, -10); context.lineTo(12, -10);
      context.lineTo(beamX + beamWidth, reach); context.lineTo(beamX - beamWidth, reach);
      context.closePath(); context.fill();
    }
    context.restore();
    context.save();
    context.globalCompositeOperation = 'source-atop';
    context.globalAlpha = 0.14;
    context.drawImage(texture, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0);
    context.restore();
  }

  window.createLivingArtwork = ({ host }) => {
    if (!host) return { setArtwork() {}, setPaused() {}, setEnabled() {}, close() {} };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const compact = matchMedia('(max-width: 700px), (pointer: coarse)');
    const inspect = new URLSearchParams(location.search).has('inspectArt');
    let patches = [], light = null, bird = null, enabled = true, paused = true;
    let frame = 0, previous = 0, elapsed = 0, sequence = 0, currentScene = null;
    let lastInspection = -1;
    let resizeObserver = null;
    const shouldRun = () => currentScene && enabled && !paused && !reduced.matches && !document.hidden;

    function render() {
      patches.forEach(patch => drawPatch(patch, elapsed));
      if (light) drawLight(light, elapsed);
      if (bird) {
        const phase = elapsed * Math.PI * 2 / 7.5;
        const width = host.clientWidth;
        bird.style.transform = `translate(${Math.sin(phase) * width * 0.012}px,${Math.sin(phase * 1.5) * width * 0.009}px) rotate(${Math.sin(phase + 0.8) * 9}deg) scaleY(${1 + Math.sin(elapsed * 3.3) * 0.12})`;
      }
      host.dataset.motionTime = elapsed.toFixed(3);
      if (inspect && elapsed - lastInspection >= 1) {
        host.dataset.pixelCheck = JSON.stringify(patches.map(({ element, target }) => {
          const pixels = target.getImageData(0, 0, element.width, element.height).data;
          let checksum = 0;
          for (let i = 0; i < pixels.length; i += 16) checksum = (checksum + pixels[i] * 3 + pixels[i + 1] * 5 + pixels[i + 2] * 7) >>> 0;
          return { width: element.width, height: element.height, checksum };
        }));
        lastInspection = elapsed;
      }
    }

    function tick(now) {
      frame = 0;
      if (!shouldRun()) return;
      if (!previous) previous = now;
      const interval = compact.matches ? 1000 / 20 : 1000 / 30;
      if (now - previous >= interval) {
        elapsed += Math.min((now - previous) / 1000, 0.1);
        previous = now;
        render();
      }
      frame = requestAnimationFrame(tick);
    }

    function sync() {
      cancelAnimationFrame(frame);
      frame = 0; previous = 0;
      host.hidden = !currentScene || !enabled || reduced.matches;
      host.dataset.motionState = shouldRun() ? 'running' : 'paused';
      if (shouldRun()) frame = requestAnimationFrame(tick);
    }

    function loadBird(version) {
      const backdrop = new Image(), sprite = new Image();
      const loaded = image => new Promise((resolve, reject) => {
        image.onload = resolve; image.onerror = reject;
      });
      const ready = Promise.all([loaded(backdrop), loaded(sprite)]);
      backdrop.src = 'assets/canyon/tower-bird-background.png';
      sprite.src = 'assets/canyon/tower-bird.png';
      ready.then(() => {
        if (version !== sequence || !currentScene) return;
        backdrop.className = 'living-bird-patch'; sprite.className = 'living-bird-sprite';
        backdrop.alt = ''; sprite.alt = '';
        const box = [479 / 1668 * 100, 857 / 2388 * 100, 60 / 1668 * 100, 77 / 2388 * 100];
        place(backdrop, box); place(sprite, box);
        host.append(backdrop, sprite); bird = sprite; render();
      }).catch(() => { /* The original bird remains visible if optional layers cannot load. */ });
    }

    function clear() {
      sequence++;
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      resizeObserver?.disconnect(); resizeObserver = null;
      host.replaceChildren(); patches = []; light = bird = null;
      currentScene = null; elapsed = 0; lastInspection = -1;
    }

    function setArtwork(artwork, image) {
      clear();
      currentScene = scenes[artwork.living?.preset];
      if (!currentScene) { sync(); return; }
      try {
        patches = currentScene.patches.map(spec => makePatch(image, spec, compact.matches));
        light = makeLight(currentScene.light, image);
        host.append(...patches.map(patch => patch.element), light.element);
        if (currentScene.bird) loadBird(sequence);
        resizeObserver = new ResizeObserver(() => { if (currentScene) render(); });
        resizeObserver.observe(host);
        render(); sync();
      } catch (error) {
        clear(); sync();
        console.warn('Living artwork is unavailable; showing the original painting.', error);
      }
    }

    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return {
      setArtwork,
      setPaused(value) { paused = Boolean(value); sync(); },
      setEnabled(value) { enabled = Boolean(value); sync(); },
      close() { clear(); paused = true; sync(); }
    };
  };
})();
