(function () {
  "use strict";

  const VOLUME = 0.18;

  function makeBreeze() {
    const rate = 22050;
    const count = rate * 10;
    const overlap = Math.round(rate * 0.4);
    const raw = new Float32Array(count + overlap);
    let low = 0;
    let mid = 0;
    let seed = 83621;

    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 4294967296 * 2 - 1;
    }

    for (let i = -rate; i < raw.length; i += 1) {
      const noise = random();
      low += 0.015 * (noise - low);
      mid += 0.12 * (noise - mid);
      if (i >= 0) raw[i] = low * 1.9 + (mid - low) * 0.2;
    }

    const buffer = new ArrayBuffer(44 + count * 2);
    const view = new DataView(buffer);
    const word = (offset, value) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    word(0, "RIFF");
    view.setUint32(4, buffer.byteLength - 8, true);
    word(8, "WAVE");
    word(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    word(36, "data");
    view.setUint32(40, count * 2, true);

    const drops = [[1.4, 1060], [4.7, 1390], [8.15, 910]];
    for (let i = 0; i < count; i += 1) {
      const time = i / rate;
      const blend = Math.min(1, i / overlap);
      // Crossfade the noise seam so the repeating breeze has no click.
      const noise = i < overlap ? raw[count + i] * (1 - blend) + raw[i] * blend : raw[i];
      const breath = 0.61 + 0.18 * Math.sin(time * Math.PI / 5) + 0.09 * Math.sin(time * Math.PI / 2.5 + 0.8);
      let sample = noise * breath;
      for (const [start, pitch] of drops) {
        const elapsed = time - start;
        if (elapsed >= 0 && elapsed < 0.55) {
          const envelope = Math.min(1, elapsed / 0.012) * Math.exp(-elapsed * 10);
          sample += Math.sin(2 * Math.PI * (pitch * elapsed - 95 * elapsed * elapsed)) * envelope * 0.025;
        }
      }
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
    }
    return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  }

  window.createGalleryAudio = function (button) {
    if (!button) return { setActive() {}, transition() {}, dispose() {} };

    let active = false;
    let enabled = false;
    let disposed = false;
    let failed = false;
    let howl = null;
    let soundId = null;
    let sourceUrl = null;
    let filter = null;
    let pauseTimer = null;
    let pendingTransition = false;
    const connected = new WeakSet();

    function updateButton() {
      button.disabled = failed;
      button.setAttribute("aria-pressed", String(enabled && !failed));
      const label = failed ? "环境声音暂不可用" : enabled ? "关闭环境声音" : "开启环境声音";
      button.title = label;
      button.setAttribute("aria-label", label);
      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", enabled && !failed ? "volume-2" : "volume-x");
      icon.setAttribute("aria-hidden", "true");
      button.replaceChildren(icon);
      if (window.lucide) window.lucide.createIcons();
    }

    function fail() {
      if (disposed) return;
      failed = true;
      enabled = false;
      clearTimeout(pauseTimer);
      if (howl) howl.stop();
      updateButton();
    }

    function shouldPlay() {
      return active && enabled && !disposed && !failed && !document.hidden;
    }

    function routeFilter() {
      const engine = window.Howler;
      if (!howl || !engine || !engine.ctx || !engine.masterGain) return false;
      if (!filter) {
        filter = engine.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 8000;
        filter.Q.value = 0.35;
        filter.connect(engine.masterGain);
      }
      // Howler 2.x exposes each Web Audio gain here; reroute only this sound.
      for (const sound of howl._sounds || []) {
        const node = sound._node;
        if (node && typeof node.disconnect === "function" && !connected.has(node)) {
          node.disconnect();
          node.connect(filter);
          connected.add(node);
        }
      }
      return true;
    }

    function transition() {
      if (!enabled || disposed || failed) return;
      pendingTransition = true;
      if (!howl || howl.state() !== "loaded" || !routeFilter()) return;
      const now = window.Howler.ctx.currentTime;
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(8000, now + 2);
      pendingTransition = false;
    }

    function synchronize(immediate) {
      clearTimeout(pauseTimer);
      if (!howl || howl.state() !== "loaded" || disposed) return;
      if (shouldPlay()) {
        routeFilter();
        if (soundId === null || !howl.playing(soundId)) {
          soundId = soundId === null ? howl.play() : howl.play(soundId);
        }
        howl.fade(howl.volume(soundId), VOLUME, 900, soundId);
        if (pendingTransition) transition();
      } else if (soundId !== null && howl.playing(soundId)) {
        if (immediate) {
          howl.pause(soundId);
          howl.volume(0, soundId);
        } else {
          howl.fade(howl.volume(soundId), 0, 450, soundId);
          pauseTimer = window.setTimeout(() => {
            if (!shouldPlay() && howl && !disposed) howl.pause(soundId);
          }, 480);
        }
      }
    }

    function initialize() {
      if (howl) return true;
      if (!window.Howl || !window.Howler || window.Howler.noAudio) {
        fail();
        return false;
      }
      try {
        sourceUrl = makeBreeze();
        howl = new window.Howl({
          src: [sourceUrl],
          format: ["wav"],
          html5: false,
          loop: true,
          volume: 0,
          preload: true,
          onload() { synchronize(); },
          onloaderror() { fail(); },
          onplayerror() {
            if (!howl || disposed) return;
            howl.once("unlock", () => synchronize());
          },
          onplay(id) {
            if (disposed) return;
            soundId = id;
            routeFilter();
            if (!shouldPlay()) synchronize(true);
          }
        });
        if (!window.Howler.usingWebAudio) {
          fail();
          return false;
        }
        return true;
      } catch (_) {
        fail();
        return false;
      }
    }

    function toggle() {
      if (disposed || failed) return;
      enabled = !enabled;
      if (enabled && !initialize()) return;
      updateButton();
      const context = window.Howler && window.Howler.ctx;
      if (enabled && context && context.state === "suspended") {
        context.resume().then(() => {
          if (!disposed) synchronize();
        }).catch(fail);
      }
      synchronize();
    }

    function visibility() { synchronize(document.hidden); }

    button.addEventListener("click", toggle);
    document.addEventListener("visibilitychange", visibility);
    failed = !window.Howl || !window.Howler || window.Howler.noAudio;
    updateButton();

    return {
      setActive(value) {
        active = Boolean(value);
        synchronize();
      },
      transition,
      dispose() {
        disposed = true;
        clearTimeout(pauseTimer);
        button.removeEventListener("click", toggle);
        document.removeEventListener("visibilitychange", visibility);
        if (howl) howl.unload();
        if (filter) filter.disconnect();
        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      }
    };
  };
}());
