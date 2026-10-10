(function () {
  'use strict';

  const pages = [
    { id: 'flower-1', title: '第一朵花', image: '旷野/3ad95407f3c5a015752846c7e013ed96.jpg', description: '风又来了，有一朵花替你记得。', alt: '海风吹过遗迹与青绿山坡，成片白色小花在阳光下开放。', label: '第一份纪念' },
    { id: 'flower-2', title: '风栖之地', image: '旷野/2035e50b5e522c453c9377e351123acd.jpg', description: '沿着草木的方向，走进开阔的天光。', alt: '旅人沿青绿山谷的小径走过石墙遗迹，远处有明亮的山坡与云。', label: '第二份纪念' },
    { id: 'flower-3', title: '慢慢走远', image: '旷野/bfe5195a773a80e1c158d31ba6f18961.jpg', description: '不必急着抵达，山丘之后还有山丘。', alt: '小龙停在古老石塔上，旅人穿过开满小花的山坡，头顶是明亮天空。', label: '第三份纪念' }
  ];
  const seedDrawing = '<svg viewBox="0 0 88 88" fill="none" aria-hidden="true"><path d="M43 65C23 53 24 29 53 16c16 22 16 39-10 49Z" fill="#b3ba86" fill-opacity=".28" stroke="currentColor" stroke-width="1.3"/><path d="M38 68c1-19 8-31 15-43M43 51l-9-10m12 1 12-6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M29 71c12 4 25 3 32-1" stroke="currentColor" stroke-opacity=".35" stroke-linecap="round"/></svg>';
  const flowerDrawing = '<svg viewBox="0 0 220 270" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M109 228c-10-39-4-82 6-117M109 193c-31-3-47-19-50-39 26 1 43 13 50 39Zm-2-20c29-2 47-17 52-40-24 1-43 15-52 40Z"/><path d="M113 105C89 94 89 72 99 68c12-3 19 14 18 25 2-26 19-37 27-27 9 10-1 26-17 34 25-8 39 1 34 12-5 12-25 12-36 0 8 24-3 37-13 29-11-8-7-26 1-31-24 8-39 0-32-11 6-10 21-5 32 6Z"/><circle cx="119" cy="105" r="7" fill="#c4ad72" fill-opacity=".3"/><path d="M83 230c20 4 36 4 54 0M165 78l6-10m-18-20 1-8M69 118l-9 3" stroke-opacity=".35"/></g></svg>';
  const littleFlower = '<svg viewBox="0 0 24 30" fill="none" aria-hidden="true"><path d="M12 27V13m0 10c-5 0-7-3-7-6 5 0 7 3 7 6Zm0-3c5 0 7-3 7-6-5 0-7 3-7 6Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M12 10C5 8 6 2 9 3c2 0 3 2 3 5 1-7 7-7 7-3 0 2-2 4-5 5 7 0 8 5 4 6-2 0-4-2-5-4 1 7-5 9-6 5-1-2 1-5 3-6-6 2-9-3-6-5 2-1 5 1 8 4Z" stroke="currentColor" stroke-width="1.05" fill="currentColor" fill-opacity=".07"/><circle cx="12" cy="10" r="1.8" fill="currentColor"/></svg>';
  const cornerSprig = '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M12 70c5-32 18-49 55-59M27 39c-2-15 3-23 12-27 3 12-3 20-12 27Zm-4 9c16 0 22-7 23-16-12 1-21 5-23 16Zm23-23c1-13 8-19 17-20-1 10-7 17-17 20ZM18 59c-9-7-10-16-6-24 8 5 11 12 6 24Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  window.createGardenJournal = function ({ getState, onRead = function () {}, onReset = function () {} }) {
    const dialog = document.createElement('dialog');
    dialog.className = 'garden-journal';
    dialog.setAttribute('aria-labelledby', 'gardenJournalTitle');
    dialog.setAttribute('aria-describedby', 'gardenJournalSubtitle');
    dialog.innerHTML = `
      <div class="garden-book">
        <span class="garden-book-ribbon" aria-hidden="true"><span>✦</span></span>
        <header class="garden-book-heading">
          <div class="garden-book-title"><span class="garden-book-emblem" aria-hidden="true">${littleFlower}</span><div><span class="garden-book-kicker">THE LITTLE FIELD JOURNAL</span><h2 id="gardenJournalTitle">旅途手记</h2></div></div>
          <button class="garden-journal-close" type="button" aria-label="合上手记" autofocus><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.3"/></svg></button>
        </header>
        <div class="garden-pages">
          <section class="garden-page garden-keepsakes" aria-labelledby="gardenKeepsakeTitle">
            <p id="gardenJournalSubtitle" class="garden-page-eyebrow">给路过的春天，留一页。</p>
            <h3 id="gardenKeepsakeTitle">随身拾物</h3>
            <div class="garden-seed-item">
              <div class="garden-seed-drawing">${seedDrawing}</div>
              <div><p class="garden-item-name">风铃花种子 <span class="garden-seed-count"></span></p><p class="garden-item-note"></p></div>
            </div>
            <div class="garden-flower-record"><div class="garden-flower-stamps" aria-hidden="true"><span>${littleFlower}</span><span>${littleFlower}</span><span>${littleFlower}</span></div><span class="garden-flower-count"></span></div>
            <p class="garden-restoration-note"></p>
            <div class="garden-pressed-line" aria-hidden="true"><span>✦</span></div>
            <h3 class="garden-index-title">风景收藏</h3>
            <nav class="garden-entry-index" aria-label="风景收藏目录">${pages.map((page, index) => `<button class="garden-entry-link" type="button" data-entry-id="${page.id}" aria-controls="gardenMemoryPage"><span class="garden-entry-number">0${index + 1}</span><span>${page.title}<small class="garden-entry-condition"></small></span><span class="garden-entry-mark" aria-hidden="true">·</span></button>`).join('')}</nav>
            <div class="garden-page-sprig" aria-hidden="true">${cornerSprig}</div>
            <p class="garden-keepsake-verse">风经过的地方，<br>有小小的春天。</p>
          </section>
          <section class="garden-page garden-memory" id="gardenMemoryPage" aria-labelledby="gardenMemoryTitle">
            <div class="garden-memory-empty">
              <span class="garden-memory-label">A SMALL BEGINNING</span>
              <div class="garden-flower-drawing">${flowerDrawing}</div>
              <p class="garden-empty-heading">等一朵花醒来</p>
              <p class="garden-empty-note"></p>
              <span class="garden-page-number">— 01 —</span>
            </div>
            <div class="garden-memory-entry" hidden>
              <div class="garden-entry-heading"><span class="garden-memory-label">微风峡谷 · 第一份纪念</span><span class="garden-entry-seal" aria-label="已收藏">✿</span></div>
              <button class="garden-art-button" type="button" aria-label="展开完整插画"><img class="garden-memory-art" alt="" decoding="async"></button>
              <div class="garden-image-error" hidden><p>这幅风景还没有展开。</p><button class="garden-image-retry" type="button">重新载入插画</button></div>
              <div class="garden-memory-caption"><div><h3 id="gardenMemoryTitle">第一朵花</h3><p>风又来了，有一朵花替你记得。</p></div><span class="garden-page-number">01</span></div>
            </div>
            <nav class="garden-page-turner" aria-label="翻阅收藏"><button class="garden-page-previous" type="button" aria-label="上一页">←</button><span class="garden-page-position" aria-live="polite">01 / 03</span><button class="garden-page-next" type="button" aria-label="下一页">→</button></nav>
          </section>
        </div>
        <footer class="garden-book-footer">
          <p class="garden-save-note"></p>
          <button class="garden-reset-open" type="button">重走花径</button>
          <div class="garden-reset-confirm" hidden role="group" aria-labelledby="gardenResetQuestion"><p id="gardenResetQuestion">重新开始种花旅程？<small>将重置种子、三朵花、手记与峡谷一期修复。<br>原有章节足迹与昼夜偏好会保留。</small></p><div><button class="garden-reset-cancel" type="button">留住春天</button><button class="garden-reset-yes" type="button">重新出发</button></div></div>
        </footer>
      </div>
      <div class="garden-original" hidden>
        <header><button class="garden-original-back" type="button">← 回到手记</button><span>第一朵花 · 01</span><button class="garden-original-close" type="button" aria-label="合上手记">✕</button></header>
        <img class="garden-original-art" alt="第一朵花：海湾、遗迹与开满白花的山坡。" decoding="async">
      </div>`;
    document.body.append(dialog);

    const $ = selector => dialog.querySelector(selector);
    const book = $('.garden-book');
    const original = $('.garden-original');
    const artImage = $('.garden-memory-art');
    const artButton = $('.garden-art-button');
    const errorMessage = $('.garden-image-error');
    const originalImage = $('.garden-original-art');
    const entryButtons = Array.from(dialog.querySelectorAll('.garden-entry-link'));
    const confirmPanel = $('.garden-reset-confirm');
    let previousFocus = null;
    const readRequested = new Set();
    let selectedIndex = 0;
    let imagePageId = null;
    let resetPending = false;
    let isOriginal = false;
    let imageFailed = false;

    function notify(open) {
      document.dispatchEvent(new CustomEvent('journey:journal', { detail: { open } }));
    }

    function entryState(state, index) {
      const page = pages[index];
      const entry = Array.isArray(state.entries) && state.entries.find(item => item.id === page.id);
      return entry || { id: page.id, unlocked: index === 0 && !!state.entryUnlocked, read: index === 0 && !!state.entryRead };
    }

    function markReadWhenVisible() {
      const page = pages[selectedIndex];
      const entry = entryState(getState(), selectedIndex);
      if (!dialog.open || !entry.unlocked || entry.read || readRequested.has(page.id)) return;
      readRequested.add(page.id);
      queueMicrotask(function () {
        const current = entryState(getState(), selectedIndex);
        if (!dialog.open || pages[selectedIndex].id !== page.id || !current.unlocked) { readRequested.delete(page.id); return; }
        if (!current.read) onRead(page.id);
      });
    }

    function render() {
      const state = getState();
      const plantedCount = Math.min(3, Math.max(0, Number(state.plantedCount) || (['growing', 'bloomed', 'remembered'].includes(state.stage) ? 1 : 0)));
      const bloomCount = Math.min(3, Math.max(0, Number(state.bloomCount) || (['bloomed', 'remembered'].includes(state.stage) ? 1 : 0)));
      const page = pages[selectedIndex];
      const entry = entryState(state, selectedIndex);
      const flower = state.flowers && state.flowers[selectedIndex];
      const flowerBloomed = !!(flower && flower.bloomed);
      $('.garden-seed-count').textContent = `× ${Number(state.seedCount) || 0}`;
      $('.garden-seed-item').dataset.hasSeed = state.seedCount ? 'true' : 'false';
      $('.garden-item-note').textContent = state.seedCount ? '峡谷捎来的小礼物，等你种下。' : plantedCount >= 3 ? '三粒种子，都在草地安了家。' : state.needsRest ? '在篝火旁歇满一分钟，再去拾种。' : plantedCount ? '再去峡谷走走，带回下一粒。' : '去峡谷走走，把春天带回来。';
      $('.garden-flower-count').textContent = `种下 ${plantedCount} / 3`;
      $('.garden-flower-record').setAttribute('aria-label', `已种下 ${plantedCount} 朵花，其中 ${bloomCount} 朵已开放`);
      dialog.querySelectorAll('.garden-flower-stamps > span').forEach(function (stamp, index) { stamp.dataset.state = index < bloomCount ? 'bloomed' : index < plantedCount ? 'planted' : 'empty'; });
      $('.garden-restoration-note').textContent = state.canyonRestored ? '✧ 虹归 · 峡谷的第一缕新生' : state.canRestore ? '三粒种子安了家，去唤醒峡谷吧' : '三朵花，为峡谷唤回一点颜色。';
      $('.garden-restoration-note').dataset.restored = state.canyonRestored ? 'true' : 'false';
      entryButtons.forEach(function (button, index) {
        const item = entryState(state, index);
        const bloom = !!(state.flowers && state.flowers[index] && state.flowers[index].bloomed);
        button.dataset.unlocked = item.unlocked ? 'true' : 'false';
        button.setAttribute('aria-current', index === selectedIndex ? 'page' : 'false');
        button.querySelector('.garden-entry-condition').textContent = item.unlocked ? item.read ? '已珍藏' : '新拾的风景' : bloom ? '回营地看花' : `第 ${index + 1} 朵花开放后`;
        button.querySelector('.garden-entry-mark').textContent = item.unlocked ? item.read ? '↗' : '✦' : '·';
      });
      $('.garden-memory-empty').hidden = !!entry.unlocked;
      $('.garden-memory-entry').hidden = !entry.unlocked;
      $('.garden-empty-heading').textContent = flowerBloomed ? '一朵花在等你' : `等第${['一', '二', '三'][selectedIndex]}朵花醒来`;
      $('.garden-empty-note').textContent = flowerBloomed ? '花已经开了。回营地看看，便能收藏这一页风景。' : flower ? '种子安了家。走一走，回来看看它吧。' : selectedIndex > 0 ? '每带回一粒种子，便为这一页留下一点春天。' : state.seedCount ? '把种子种在篝火旁，让这一页慢慢有了风景。' : '去峡谷带回一粒种子，故事便开始了。';
      $('.garden-memory-empty .garden-page-number').textContent = `— 0${selectedIndex + 1} —`;
      $('.garden-entry-heading .garden-memory-label').textContent = `微风峡谷 · ${page.label}`;
      $('#gardenMemoryTitle').textContent = page.title;
      $('.garden-memory-caption p').textContent = page.description;
      $('.garden-memory-caption .garden-page-number').textContent = `0${selectedIndex + 1}`;
      $('.garden-page-position').textContent = `0${selectedIndex + 1} / 03`;
      $('.garden-page-previous').disabled = selectedIndex === 0;
      $('.garden-page-next').disabled = selectedIndex === pages.length - 1;
      artButton.setAttribute('aria-label', `展开${page.title}的完整插画`);
      if (entry.unlocked) {
        if (imagePageId !== page.id) {
          imagePageId = page.id;
          imageFailed = false;
          artButton.hidden = false;
          errorMessage.hidden = true;
          artImage.alt = page.alt;
          artImage.src = page.image;
        }
      } else {
        imagePageId = null;
        artImage.removeAttribute('src');
        originalImage.removeAttribute('src');
        if (isOriginal) leaveOriginal();
      }
      $('.garden-original header>span').textContent = `${page.title} · 0${selectedIndex + 1}`;
      originalImage.alt = `${page.title}：${page.alt}`;
      $('.garden-save-note').textContent = state.storageAvailable === false ? '仅暂存于此刻，关闭后不会保留' : '拾物与风景，已妥善收好';
      if (dialog.open) markReadWhenVisible();
    }

    function open() {
      if (dialog.open) { render(); return; }
      previousFocus = document.activeElement;
      const state = getState();
      const unreadIndex = pages.findIndex((page, index) => { const item = entryState(state, index); return item.unlocked && !item.read; });
      const firstUnlockedIndex = pages.findIndex((page, index) => entryState(state, index).unlocked);
      if (unreadIndex !== -1) selectedIndex = unreadIndex;
      else if (!entryState(state, selectedIndex).unlocked) selectedIndex = Math.max(0, firstUnlockedIndex);
      resetConfirmation(false);
      isOriginal = false;
      book.hidden = false;
      original.hidden = true;
      dialog.classList.remove('garden-journal--original');
      render();
      dialog.showModal();
      $('.garden-journal-close').focus({ preventScroll: true });
      notify(true);
      markReadWhenVisible();
    }

    function close() {
      if (dialog.open) dialog.close();
    }

    function leaveOriginal() {
      isOriginal = false;
      original.hidden = true;
      book.hidden = false;
      dialog.classList.remove('garden-journal--original');
      if (dialog.open) artButton.focus({ preventScroll: true });
    }

    function resetConfirmation(show) {
      confirmPanel.hidden = !show;
      $('.garden-reset-open').hidden = show;
      if (show) $('.garden-reset-cancel').focus({ preventScroll: true });
    }

    $('.garden-journal-close').addEventListener('click', close);
    $('.garden-original-close').addEventListener('click', close);
    dialog.addEventListener('close', function () {
      notify(false);
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    });
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      if (isOriginal) leaveOriginal();
      else if (!confirmPanel.hidden) { resetConfirmation(false); $('.garden-reset-open').focus(); }
      else close();
    });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) close(); });
    dialog.addEventListener('keydown', function (event) {
      // Map movement must not receive keys while the traveler reads.
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), [href], [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('keyup', function (event) { event.stopPropagation(); });
    function selectPage(index) {
      if (index < 0 || index >= pages.length) return;
      selectedIndex = index;
      render();
      $('.garden-memory').scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
    entryButtons.forEach(function (button, index) {
      button.addEventListener('click', function () { selectPage(index); });
    });
    $('.garden-page-previous').addEventListener('click', function () { selectPage(selectedIndex - 1); });
    $('.garden-page-next').addEventListener('click', function () { selectPage(selectedIndex + 1); });
    artButton.addEventListener('click', function () {
      if (!entryState(getState(), selectedIndex).unlocked || imageFailed) return;
      isOriginal = true;
      originalImage.src = artImage.src;
      book.hidden = true;
      original.hidden = false;
      dialog.classList.add('garden-journal--original');
      $('.garden-original-back').focus({ preventScroll: true });
    });
    $('.garden-original-back').addEventListener('click', leaveOriginal);
    artImage.addEventListener('error', function () {
      if (!imagePageId || imagePageId !== pages[selectedIndex].id || !entryState(getState(), selectedIndex).unlocked) return;
      imageFailed = true;
      artButton.hidden = true;
      errorMessage.hidden = false;
    });
    artImage.addEventListener('load', function () {
      if (!imagePageId || imagePageId !== pages[selectedIndex].id || !entryState(getState(), selectedIndex).unlocked) return;
      imageFailed = false;
      artButton.hidden = false;
      errorMessage.hidden = true;
    });
    $('.garden-image-retry').addEventListener('click', function () {
      if (!entryState(getState(), selectedIndex).unlocked) return;
      artImage.src = pages[selectedIndex].image + '?retry=' + Date.now();
    });
    $('.garden-reset-open').addEventListener('click', function () { resetConfirmation(true); });
    $('.garden-reset-cancel').addEventListener('click', function () { resetConfirmation(false); $('.garden-reset-open').focus(); });
    $('.garden-reset-yes').addEventListener('click', async function () {
      if (resetPending) return;
      resetPending = true;
      $('.garden-reset-yes').disabled = true;
      try {
        await onReset();
        readRequested.clear();
        selectedIndex = 0;
        resetConfirmation(false);
        render();
        $('.garden-reset-open').focus({ preventScroll: true });
      } finally {
        resetPending = false;
        $('.garden-reset-yes').disabled = false;
      }
    });

    render();
    return { open, close, render, isOpen: function () { return dialog.open; } };
  };
})();
