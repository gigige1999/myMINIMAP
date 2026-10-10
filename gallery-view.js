(() => {
  window.createGalleryView = ({ onExit, loadArtwork, onViewed }) => {
    const $ = id => document.getElementById(id);
    const gallery = $('gallery');
    const viewport = $('artViewport');
    const motion = $('artMotion');
    const picture = $('galleryImage');
    const curtain = $('galleryCurtain');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const living = window.createLivingArtwork?.({ host: $('artLiving'), image: picture });
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    let chapter, index = -1, retryIndex = 0, version = 0;
    let active = false, busy = false, listenerScope, resizeObserver;
    let animations = [], frame = 0, imageWidth = 0, imageHeight = 0;
    let dimensions = { width: 0, height: 0, left: 0, top: 0, viewportWidth: 0, viewportHeight: 0 };
    let pan = 0, targetPan = 0, panX = 0, targetPanX = 0, driftX = 0, driftY = 0, targetX = 0, targetY = 0;
    let gesture = null, storyTrigger = null, multiplePointers = false, suppressTapUntil = 0;
    let motionEnabled = !reduced.matches;
    const pointers = new Set();
    const artwork = () => chapter?.artworks[index];
    const whole = () => gallery.dataset.view === 'whole';
    const isCanyon = () => chapter?.id === 'canyon';
    const hasLivingArtwork = () => isCanyon() && Boolean(artwork()?.living);
    const canAdvanceArtwork = () => active && hasLivingArtwork() && !whole() && !busy && index >= 0 && $('galleryError').hidden && $('storyPanel').hidden;
    const icon = name => {
      const element = document.createElement('i');
      element.dataset.lucide = name;
      element.setAttribute('aria-hidden', 'true');
      return element;
    };

    function stopAnimations() {
      animations.forEach(animation => animation.cancel());
      animations = [];
    }

    function animate(element, keyframes, duration) {
      if (reduced.matches || !element.animate) return Promise.resolve();
      const animation = element.animate(keyframes, { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
      animations.push(animation);
      return animation.finished.catch(() => {});
    }

    function setBusy(value) {
      busy = value;
      gallery.setAttribute('aria-busy', String(value));
      $('prev').disabled = value || index <= 0;
      $('next').disabled = value || index < 0;
      $('viewWhole').disabled = value || index < 0;
      $('galleryProgress').querySelectorAll('button').forEach(button => { button.disabled = value; });
      $('artHotspots').inert = value;
      syncLiving();
    }

    function syncLiving() {
      const supported = hasLivingArtwork();
      const enabled = supported && !whole() && !reduced.matches;
      const control = $('viewMotion');
      gallery.dataset.living = String(enabled);
      gallery.dataset.clickable = String(canAdvanceArtwork());
      viewport.tabIndex = supported ? 0 : -1;
      viewport.setAttribute('role', 'group');
      viewport.setAttribute('aria-label', canAdvanceArtwork() ? `${artwork()?.title || '插画'}，${index === chapter.artworks.length - 1 ? '返回地图' : '进入下一幅'}` : '插画');
      if (control) {
        control.hidden = !supported;
        control.disabled = busy || whole() || reduced.matches;
        control.setAttribute('aria-pressed', String(motionEnabled && !reduced.matches));
        control.title = reduced.matches ? '已减少动态效果' : motionEnabled ? '暂停画面动效' : '播放画面动效';
        control.setAttribute('aria-label', control.title);
        const name = motionEnabled && !reduced.matches ? 'pause' : 'play';
        if (control.dataset.motionIcon !== name) {
          control.dataset.motionIcon = name;
          control.replaceChildren(icon(name));
          window.lucide?.createIcons({ root: control });
        }
      }
      living?.setEnabled(enabled);
      living?.setPaused(!active || !motionEnabled || busy || !$('storyPanel').hidden || document.hidden || !$('galleryError').hidden);
    }

    function setError(value) {
      $('galleryError').hidden = !value;
      if (value) {
        const message = $('galleryError').querySelector('[data-error-message]');
        if (message) message.textContent = '这幅风景暂时未能抵达。';
      }
      syncLiving();
    }

    function renderPosition() {
      const d = dimensions;
      const dx = whole() ? 0 : clamp(panX + driftX, d.viewportWidth - d.width - d.left, -d.left);
      const dy = whole() ? 0 : clamp(pan + driftY, d.viewportHeight - d.height - d.top, -d.top);
      motion.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }

    function tick() {
      frame = 0;
      if (!active || busy) return;
      pan += (targetPan - pan) * 0.14;
      panX += (targetPanX - panX) * 0.14;
      driftX += (targetX - driftX) * 0.075;
      driftY += (targetY - driftY) * 0.075;
      renderPosition();
      if (Math.abs(targetPan - pan) + Math.abs(targetPanX - panX) + Math.abs(targetX - driftX) + Math.abs(targetY - driftY) > 0.06) frame = requestAnimationFrame(tick);
    }

    function schedulePosition() {
      if (reduced.matches) {
        pan = targetPan;
        panX = targetPanX;
        driftX = driftY = 0;
        renderPosition();
      } else if (!frame) frame = requestAnimationFrame(tick);
    }

    function fit(reset = false) {
      if (!imageWidth || !imageHeight) return;
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      const ratio = whole() ? Math.min(width / imageWidth, height / imageHeight) : Math.max(width / imageWidth, height / imageHeight);
      const drawnWidth = imageWidth * ratio;
      const drawnHeight = imageHeight * ratio;
      const focus = artwork()?.focus || [50, 50];
      dimensions = {
        width: drawnWidth, height: drawnHeight,
        left: (width - drawnWidth) * (whole() ? 0.5 : clamp(focus[0], 0, 100) / 100),
        top: (height - drawnHeight) * (whole() ? 0.5 : clamp(focus[1], 0, 100) / 100),
        viewportWidth: width, viewportHeight: height
      };
      if (reset) pan = targetPan = panX = targetPanX = driftX = driftY = targetX = targetY = 0;
      else {
        targetPan = clamp(targetPan, height - drawnHeight - dimensions.top, -dimensions.top);
        pan = targetPan;
        targetPanX = clamp(targetPanX, width - drawnWidth - dimensions.left, -dimensions.left);
        panX = targetPanX;
      }
      Object.assign(motion.style, {
        width: `${drawnWidth}px`, height: `${drawnHeight}px`,
        left: `${dimensions.left}px`, top: `${dimensions.top}px`, transformOrigin: '50% 50%'
      });
      renderPosition();
    }

    function closeStory(restoreFocus = true) {
      $('storyPanel').hidden = true;
      gallery.dataset.story = 'closed';
      syncLiving();
      if (restoreFocus && active && storyTrigger?.isConnected) storyTrigger.focus({ preventScroll: true });
      storyTrigger = null;
    }

    function openStory(point, trigger) {
      if (busy) return;
      storyTrigger = trigger;
      $('storyTitle').textContent = point.label;
      $('storyText').textContent = point.story || '';
      $('storyPanel').hidden = false;
      gallery.dataset.story = 'open';
      syncLiving();
      $('storyClose').focus({ preventScroll: true });
    }

    function renderHotspots(current) {
      const container = $('artHotspots');
      container.replaceChildren();
      const points = [...(current.hotspots || []).map(point => ({ ...point, kind: 'story' }))];
      if (current.portal) points.unshift({ ...current.portal, kind: 'portal' });
      points.forEach(point => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `art-hotspot ${point.kind}-hotspot`;
        button.style.left = `${point.x}%`;
        button.style.top = `${point.y}%`;
        button.title = point.label || (point.kind === 'portal' ? '穿过这道门' : '旅途拾记');
        button.setAttribute('aria-label', button.title);
        const glyph = document.createElement('span');
        glyph.className = 'hotspot-glyph';
        glyph.append(icon(point.kind === 'portal' ? 'move-up-right' : 'sparkles'));
        const label = document.createElement('span');
        label.className = 'hotspot-label';
        label.textContent = button.title;
        button.append(glyph, label);
        button.addEventListener('click', () => point.kind === 'portal' ? next() : openStory(point, button));
        button.addEventListener('focus', () => {
          if (!active || busy || whole() || !button.matches(':focus-visible')) return;
          const bounds = viewport.getBoundingClientRect();
          const hotspotBounds = button.getBoundingClientRect();
          const margin = Math.min(90, bounds.height * 0.2);
          const upperEdge = bounds.top + margin;
          const lowerEdge = bounds.bottom - margin;
          const delta = hotspotBounds.top < upperEdge ? upperEdge - hotspotBounds.top : hotspotBounds.bottom > lowerEdge ? lowerEdge - hotspotBounds.bottom : 0;
          if (!delta) return;
          const d = dimensions;
          const minimum = d.viewportHeight - d.height - d.top;
          const maximum = -d.top;
          targetPan = clamp(clamp(pan + driftY, minimum, maximum) + delta, minimum, maximum);
          targetX = targetY = 0;
          schedulePosition();
        });
        container.append(button);
      });
      window.lucide?.createIcons({ root: container });
    }

    function renderMetadata() {
      const current = artwork();
      $('galleryChapter').textContent = `${chapter.roman || ''} · ${chapter.name}`;
      $('galleryTitle').textContent = current.title;
      $('galleryDesc').textContent = current.description || '';
      $('counter').textContent = `${String(index + 1).padStart(2, '0')} / ${String(chapter.artworks.length).padStart(2, '0')}`;
      const last = index === chapter.artworks.length - 1;
      $('next').title = last ? '返回地图' : '下一幅作品';
      $('next').setAttribute('aria-label', $('next').title);
      $('galleryReturnLight').hidden = !last;
      gallery.dataset.artworkType = current.type;
      gallery.style.setProperty('--art-ground', current.ground || '#536046');
      const progress = $('galleryProgress');
      progress.replaceChildren();
      chapter.artworks.forEach((work, position) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gallery-step';
        button.title = work.title;
        button.setAttribute('aria-label', `${position + 1} · ${work.title}`);
        if (position === index) button.setAttribute('aria-current', 'step');
        button.append(document.createElement('span'));
        button.addEventListener('click', () => { if (!busy && position !== index) void show(position); });
        progress.append(button);
      });
      renderHotspots(current);
    }

    async function show(nextIndex, initial = false) {
      if (!active || !chapter?.artworks[nextIndex]) return;
      const requestVersion = ++version;
      const targetChapter = chapter;
      const incoming = targetChapter.artworks[nextIndex];
      const outgoing = artwork();
      const direction = nextIndex >= index ? 1 : -1;
      retryIndex = nextIndex;
      cancelGesture();
      setBusy(true);
      setError(false);
      closeStory(false);
      cancelAnimationFrame(frame);
      frame = 0;
      try {
        const loaded = await loadArtwork(incoming);
        if (!active || requestVersion !== version) return;
        const kind = outgoing?.type || incoming.type;
        const baseTransform = motion.style.transform || 'translate3d(0,0,0)';
        if (!initial && !reduced.matches) {
          const origin = outgoing?.portal || { x: 50, y: 50 };
          motion.style.transformOrigin = `${origin.x}% ${origin.y}%`;
          let endTransform = kind === 'gate' ? `${baseTransform} scale(2.1)` : kind === 'nature' ? `${baseTransform} translateY(${-direction * 68}px) scale(1.02)` : baseTransform;
          if (isCanyon() && direction > 0 && outgoing?.portal) {
            const d = dimensions;
            const dx = clamp(panX + driftX, d.viewportWidth - d.width - d.left, -d.left);
            const dy = clamp(pan + driftY, d.viewportHeight - d.height - d.top, -d.top);
            const travelX = d.viewportWidth / 2 - (d.left + dx + d.width * origin.x / 100);
            const travelY = d.viewportHeight / 2 - (d.top + dy + d.height * origin.y / 100);
            endTransform = `${baseTransform} translate(${travelX}px, ${travelY}px) scale(${kind === 'gate' ? 2.1 : 1.2})`;
          }
          const duration = kind === 'gate' ? 900 : kind === 'nature' ? 800 : 600;
          await Promise.all([
            animate(motion, [{ transform: baseTransform, opacity: 1, filter: 'blur(0px)' }, { transform: endTransform, opacity: 0.22, filter: kind === 'gate' ? 'blur(5px)' : 'blur(0px)' }], duration),
            animate(curtain, [{ opacity: 0 }, { opacity: 1 }], duration)
          ]);
          if (!active || requestVersion !== version) return;
        }
        curtain.style.opacity = reduced.matches ? '0' : '1';
        stopAnimations();
        index = nextIndex;
        imageWidth = loaded.naturalWidth || loaded.width;
        imageHeight = loaded.naturalHeight || loaded.height;
        picture.src = loaded.src;
        picture.alt = incoming.title;
        picture.hidden = false;
        living?.setArtwork(incoming, loaded);
        renderMetadata();
        fit(true);
        document.dispatchEvent(new CustomEvent('gallery:artwork', { detail: { chapterId: targetChapter.id, index, type: incoming.type } }));
        try { onViewed?.(targetChapter.id, incoming.id || incoming.image); } catch (error) { console.warn(error); }
        const nextArtwork = targetChapter.artworks[nextIndex + 1];
        if (nextArtwork) Promise.resolve(loadArtwork(nextArtwork)).catch(() => {});
        const settledTransform = motion.style.transform;
        const startTransform = kind === 'nature' ? `${settledTransform} translateY(${direction * 44}px) scale(1.02)` : kind === 'gate' ? `${settledTransform} scale(1.06)` : settledTransform;
        await Promise.all([
          animate(motion, [{ transform: startTransform, opacity: 0.55 }, { transform: settledTransform, opacity: 1 }], 800),
          animate(curtain, [{ opacity: 1 }, { opacity: 0 }], 850)
        ]);
        if (!active || requestVersion !== version) return;
        curtain.style.opacity = '0';
        stopAnimations();
        setBusy(false);
      } catch (error) {
        if (!active || requestVersion !== version) return;
        stopAnimations();
        curtain.style.opacity = '0';
        setBusy(false);
        setError(true);
        console.warn('Artwork could not be displayed.', error);
      }
    }

    function exit() { if (active) { close(); onExit?.(); } }
    function next() {
      if (!active || busy || index < 0) return;
      if (index === chapter.artworks.length - 1) exit();
      else void show(index + 1);
    }
    function previous() { if (active && !busy && index > 0) void show(index - 1); }

    function movePan(delta) {
      if (!active || busy || whole() || !$('storyPanel').hidden) return;
      const d = dimensions;
      targetPan = clamp(targetPan - delta, d.viewportHeight - d.height - d.top, -d.top);
      schedulePosition();
    }

    function cancelGesture() {
      const previousGesture = gesture;
      gesture = null;
      gallery.dataset.dragging = 'false';
      if (previousGesture && viewport.hasPointerCapture?.(previousGesture.id)) viewport.releasePointerCapture(previousGesture.id);
    }

    function bind() {
      listenerScope?.abort();
      listenerScope = new AbortController();
      const listen = (target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: listenerScope.signal });
      listen($('galleryMap'), 'click', exit);
      listen($('galleryReturnLight'), 'click', exit);
      listen($('next'), 'click', next);
      listen($('prev'), 'click', previous);
      listen($('storyClose'), 'click', () => closeStory());
      listen($('galleryRetry'), 'click', () => { if (!busy) void show(retryIndex, index < 0); });
      listen($('viewWhole'), 'click', () => {
        if (busy) return;
        gallery.dataset.view = whole() ? 'immersive' : 'whole';
        $('viewWhole').setAttribute('aria-pressed', String(whole()));
        $('viewWhole').title = whole() ? '沉浸观看' : '完整画作';
        $('viewWhole').setAttribute('aria-label', $('viewWhole').title);
        fit(true);
        syncLiving();
      });
      if ($('viewMotion')) listen($('viewMotion'), 'click', () => {
        motionEnabled = !motionEnabled;
        targetX = targetY = 0;
        schedulePosition();
        syncLiving();
      });
      listen($('viewNotes'), 'click', () => {
        const visible = gallery.dataset.notes !== 'visible';
        gallery.dataset.notes = visible ? 'visible' : 'hidden';
        $('viewNotes').setAttribute('aria-pressed', String(visible));
      });
      listen($('viewFullscreen'), 'click', async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else if (gallery.requestFullscreen) await gallery.requestFullscreen();
        } catch { /* Browser policy may deny fullscreen; the gallery remains usable. */ }
      });
      listen(document, 'fullscreenchange', () => {
        $('viewFullscreen').setAttribute('aria-pressed', String(document.fullscreenElement === gallery));
        $('viewFullscreen').title = document.fullscreenElement === gallery ? '退出全屏' : '全屏';
        $('viewFullscreen').setAttribute('aria-label', $('viewFullscreen').title);
        fit();
      });
      listen(document, 'keydown', event => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key === 'Escape') { event.preventDefault(); $('storyPanel').hidden ? exit() : closeStory(); }
        else if (!$('storyPanel').hidden) return;
        else if (event.target === viewport && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          if (canAdvanceArtwork()) next();
        }
        else if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); movePan(event.key === 'ArrowDown' ? 120 : -120); }
      });
      listen(viewport, 'wheel', event => {
        suppressTapUntil = performance.now() + 400;
        cancelGesture();
        if (event.ctrlKey) return;
        event.preventDefault();
        movePan(event.deltaY * (event.deltaMode === 1 ? 16 : 1));
      }, { passive: false });
      listen(viewport, 'pointerdown', event => {
        if (event.button !== 0) return;
        pointers.add(event.pointerId);
        if (pointers.size > 1) {
          multiplePointers = true;
          cancelGesture();
          return;
        }
        if (multiplePointers || busy || whole() || !$('storyPanel').hidden || !$('galleryError').hidden || event.target.closest('button, a')) return;
        gesture = {
          id: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY,
          lastX: event.clientX, lastY: event.clientY, started: performance.now(), dragged: false
        };
        targetX = targetY = 0;
      });
      listen(viewport, 'pointermove', event => {
        if (gesture?.id === event.pointerId) {
          const dx = event.clientX - gesture.startX;
          const dy = event.clientY - gesture.startY;
          if (!gesture.dragged && Math.hypot(dx, dy) > (gesture.type === 'touch' ? 9 : 5)) {
            gesture.dragged = true;
            gallery.dataset.dragging = 'true';
            viewport.setPointerCapture(event.pointerId);
          }
          if (gesture.dragged) {
            event.preventDefault();
            const horizontalSwipe = gesture.type === 'touch' && Math.abs(dx) > Math.abs(dy) * 1.3;
            if (!horizontalSwipe) {
              movePan(gesture.lastY - event.clientY);
              const d = dimensions;
              targetPanX = clamp(targetPanX + event.clientX - gesture.lastX, d.viewportWidth - d.width - d.left, -d.left);
              schedulePosition();
            }
          }
          gesture.lastX = event.clientX;
          gesture.lastY = event.clientY;
          return;
        }
        if (busy || whole() || !$('storyPanel').hidden || reduced.matches || (hasLivingArtwork() && !motionEnabled) || !precisePointer.matches || event.pointerType === 'touch') return;
        const bounds = viewport.getBoundingClientRect();
        targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * -16;
        targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * -16;
        schedulePosition();
      });
      listen(viewport, 'pointerleave', () => { targetX = targetY = 0; schedulePosition(); });
      listen(document, 'pointerup', event => {
        pointers.delete(event.pointerId);
        const ended = gesture?.id === event.pointerId ? gesture : null;
        if (ended) {
          cancelGesture();
          const dx = event.clientX - ended.startX;
          const dy = event.clientY - ended.startY;
          const distance = Math.hypot(dx, dy);
          if (!multiplePointers && ended.dragged && ended.type === 'touch' && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.3) dx < 0 ? next() : previous();
          else if (!multiplePointers && !ended.dragged && distance < 9 && performance.now() - ended.started < 650 && performance.now() > suppressTapUntil && canAdvanceArtwork()) {
            const bounds = viewport.getBoundingClientRect();
            if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) next();
          }
        }
        if (!pointers.size) multiplePointers = false;
      });
      listen(document, 'pointercancel', event => {
        pointers.delete(event.pointerId);
        cancelGesture();
        if (!pointers.size) multiplePointers = false;
      });
      listen(viewport, 'lostpointercapture', event => {
        if (event.target === viewport && gesture?.id === event.pointerId) cancelGesture();
      });
      listen(window, 'blur', () => { pointers.clear(); multiplePointers = false; cancelGesture(); });
      listen(document, 'visibilitychange', () => { cancelGesture(); syncLiving(); });
      listen(reduced, 'change', () => { targetX = targetY = 0; schedulePosition(); syncLiving(); });
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => fit());
      resizeObserver.observe(viewport);
    }

    async function open(nextChapter, startIndex = 0) {
      close();
      chapter = nextChapter;
      index = -1;
      active = true;
      gallery.dataset.view = 'immersive';
      gallery.dataset.notes = 'hidden';
      $('viewWhole').setAttribute('aria-pressed', 'false');
      $('viewNotes').setAttribute('aria-pressed', 'false');
      $('viewWhole').title = '查看完整原画';
      $('viewWhole').setAttribute('aria-label', '查看完整原画');
      $('galleryReturnLight').hidden = true;
      $('viewFullscreen').hidden = !gallery.requestFullscreen;
      syncLiving();
      bind();
      await show(clamp(startIndex, 0, Math.max(0, chapter.artworks.length - 1)), true);
    }

    function close() {
      active = false;
      version++;
      listenerScope?.abort();
      resizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
      stopAnimations();
      curtain.style.opacity = '0';
      cancelGesture();
      pointers.clear();
      multiplePointers = false;
      closeStory(false);
      living?.close();
      if (document.fullscreenElement === gallery) document.exitFullscreen().catch(() => {});
      $('viewFullscreen').setAttribute('aria-pressed', 'false');
      $('viewFullscreen').title = '全屏观看';
      $('viewFullscreen').setAttribute('aria-label', '全屏观看');
      gallery.removeAttribute('aria-busy');
    }

    return { open, close, next, previous };
  };
})();
