(() => {
  const chapters = [
    {
      id: 'canyon', name: '微风峡谷', roman: 'I',
      summary: '溪流沿着石壁，捎来远方的风。',
      position: [-3.35, -2.4], labelHeight: 2.0,
      artworks: [
        { image: '门/10a719c93dbaf72895948cfc84a13f80.jpg', title: '风经过的门', description: '石阶的尽头，风轻轻推开了清晨。', type: 'gate', focus:[50,49], ground:'#4f6047', living:{preset:'gate-breeze'},
          portal:{x:50.5,y:46,label:'穿过石门'},
          hotspots:[{x:50.8,y:33,label:'悬在风里的纹章',story:'没有人再记得这枚纹章的名字。风经过时，它依然发出很轻的回响。'}] },
        { image: '门/f0d98c03ee3b35347a7c7112138c18eb.jpg', title: '仰望，风在上方', description: '白色的羽翼，替高塔量过了天空。', type: 'nature', focus:[58,6], ground:'#65774b', living:{preset:'tower-flight'},
          portal:{x:60,y:11,label:'循着天光向上'},
          hotspots:[{x:63.3,y:18.8,label:'高处的身影',story:'她在最高的回廊停了一会儿。飞鸟掠过肩头，远方的脚步声终于变成了一阵风。'}] },
        { image: '门/fe4034bebc7f6af30cca3e095d07564c.jpg', title: '把风写进手记', description: '走到这里，世界终于安静了一些。', type: 'portrait', focus:[43,8], ground:'#8d9870', living:{preset:'quiet-pages'},
          hotspots:[{x:26,y:23.1,label:'未寄出的手记',story:'「今天，风把我带到了一座没有屋顶的高塔。这里的每一道裂缝，都长出了新的叶子。」'},
            {x:40.4,y:18.8,label:'回廊上的旅人',story:'旅途不一定要有答案。她合上书，把余下的一页留给明天的晨光。'}] }
      ]
    },
    {
      id: 'sanctum', name: '被遗忘的圣所', roman: 'II',
      summary: '山坡上的断柱，还守着一池天光。',
      position: [2.75, -2.15], labelHeight: 2.25,
      artworks: [
        { image: '圣殿/132b3accc85bee41c3d83a6d8eb763c6.jpg', title: '无人打扰的午后', description: '叶影落在石上，像一封没有寄出的信。', type: 'sanctuary' },
        { image: '圣殿/90085bc37eb1934dc15c2d086667b099.jpg', title: '静静流淌', description: '水声替这座圣所，记住了很久以前的事。', type: 'sanctuary' }
      ]
    },
    {
      id: 'meadow', name: '遗迹旷野', roman: 'III',
      summary: '草浪漫过柔软的山丘与旧石墙。',
      position: [-2.8, 2.7], labelHeight: 1.35,
      artworks: [
        { image: '旷野/2035e50b5e522c453c9377e351123acd.jpg', title: '风栖之地', description: '沿着草木的方向，走进开阔的天光。', type: 'nature' },
        { image: '旷野/3ad95407f3c5a015752846c7e013ed96.jpg', title: '草木归来', description: '被遗忘的地方，也在认真地生长。', type: 'nature' },
        { image: '旷野/bfe5195a773a80e1c158d31ba6f18961.jpg', title: '慢慢走远', description: '不必急着抵达，山丘之后还有山丘。', type: 'nature' }
      ]
    },
    {
      id: 'unknown', name: '未知领域', roman: 'IV',
      summary: '薄雾之后，有一条尚未命名的小路。',
      position: [3.65, 2.5], labelHeight: 1.95,
      artworks: [
        { image: '旷野/2035e50b5e522c453c9377e351123acd.jpg', title: '尚未命名的远方', description: '把下一段旅程，留给明天的风。', type: 'nature' }
      ]
    }
  ];
  window.journeyChapters = chapters;
  const chapterIds = new Set(chapters.map(chapter => chapter.id));
  const visited = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem('quiet-lands-visited') || '[]');
    if (Array.isArray(saved)) saved.forEach(id => { if (chapterIds.has(id)) visited.add(id); });
  } catch { /* Private browsing can make local storage unavailable. */ }
  window.journeyVisited = visited;

  const $ = id => document.getElementById(id);
  const screens = { landing: $('landing'), map: $('map'), gallery: $('gallery') };
  const passage = $('passage');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const imageCache = new Map();
  const labels = new Map();
  let activeScreen = 'landing';
  let navigationVersion = 0;
  let lastChapterId = null;
  const padded = value => String(value).padStart(2, '0');
  const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
  const gallery = window.createGalleryView({
    onExit: () => window.showJourneyScreen('map'),
    loadArtwork,
    onViewed: chapter => markVisited(typeof chapter === 'string' ? chapter : chapter.id)
  });
  let ambient = null;
  document.addEventListener('DOMContentLoaded', () => {
    ambient = window.createGalleryAudio?.($('gallerySound'));
    ambient?.setActive(activeScreen === 'gallery');
  });
  document.addEventListener('gallery:artwork', () => ambient?.transition());

  for (const chapter of chapters) {
    const thread = document.createElement('span');
    thread.className = 'region-thread';
    thread.dataset.chapter = chapter.id;
    thread.setAttribute('aria-hidden', 'true');
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'region-label';
    label.dataset.chapter = chapter.id;
    for (const [className, text] of [
      ['region-number', chapter.roman],
      ['region-name', chapter.name],
      ['region-story', chapter.summary]
    ]) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      label.append(span);
    }
    label.addEventListener('click', () => window.openJourneyChapter(chapter.id));
    labels.set(chapter.id, { label, thread });
    $('mapLabels').append(thread, label);
  }

  function updateVisited() {
    $('exploredCount').textContent = `足迹 ${padded(visited.size)} / ${padded(chapters.length)}`;
    for (const chapter of chapters) {
      const explored = visited.has(chapter.id);
      const { label, thread } = labels.get(chapter.id);
      label.classList.toggle('is-visited', explored);
      thread.classList.toggle('is-visited', explored);
      label.setAttribute('aria-label', `${chapter.name}，${explored ? '已探索' : '尚未探索'}`);
    }
  }

  function markVisited(id) {
    if (visited.has(id)) return;
    visited.add(id);
    updateVisited();
    try { localStorage.setItem('quiet-lands-visited', JSON.stringify([...visited])); } catch { /* Exploration still works without storage. */ }
    document.dispatchEvent(new CustomEvent('journey:visited', { detail: { id } }));
  }

  function setScreen(name) {
    if (!screens[name]) return;
    const changed = activeScreen !== name;
    if (changed && screens[activeScreen].contains(document.activeElement)) document.activeElement.blur();
    activeScreen = name;
    ambient?.setActive(name === 'gallery');
    for (const [id, screen] of Object.entries(screens)) {
      const current = id === name;
      screen.classList.toggle('active', current);
      screen.inert = !current;
      screen.setAttribute('aria-hidden', String(!current));
    }
    document.dispatchEvent(new CustomEvent('journey:screen', { detail: { screen: name } }));
    if (!changed) return;
    requestAnimationFrame(() => {
      if (activeScreen !== name) return;
      const focusTarget = name === 'landing' ? $('enterBtn') : name === 'gallery' ? $('galleryMap') :
        labels.get(lastChapterId)?.label || $('mapBack');
      focusTarget.focus({ preventScroll: true });
    });
  }

  window.showJourneyScreen = function showJourneyScreen(name) {
    if (!screens[name]) return;
    navigationVersion++;
    passage.classList.remove('active');
    if (name !== 'gallery') gallery.close();
    screens.gallery.removeAttribute('aria-busy');
    setScreen(name);
  };

  function loadArtwork(artwork) {
    if (imageCache.has(artwork.image)) return imageCache.get(artwork.image);
    const pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      const timeout = setTimeout(() => {
        image.onload = image.onerror = null;
        imageCache.delete(artwork.image);
        reject(new Error(`Artwork request timed out: ${artwork.image}`));
      }, 12000);
      image.onload = async () => {
        clearTimeout(timeout);
        try { if (image.decode) await image.decode(); } catch { /* onload already confirms this image is displayable. */ }
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timeout);
        imageCache.delete(artwork.image);
        reject(new Error(`Unable to load artwork: ${artwork.image}`));
      };
      image.src = new URL(artwork.image, document.baseURI).href;
    });
    imageCache.set(artwork.image, pending);
    return pending;
  }

  window.openJourneyChapter = async function openJourneyChapter(id) {
    const chapter = chapters.find(item => item.id === id);
    if (!chapter) return;
    const version = ++navigationVersion;
    lastChapterId = id;
    passage.classList.add('active');
    await wait(reducedMotion.matches ? 0 : 360);
    if (version !== navigationVersion) return;
    setScreen('gallery');
    const opening = gallery.open(chapter, 0);
    passage.classList.remove('active');
    await opening;
    if (version !== navigationVersion) return;
    passage.classList.remove('active');
  };

  $('enterBtn').addEventListener('click', () => window.enterJourney?.());
  document.addEventListener('journey:entered', () => window.showJourneyScreen('map'));
  $('mapBack').addEventListener('click', () => window.showJourneyScreen('landing'));
  $('mapReset').addEventListener('click', () => window.journeyMap?.reset());
  $('mapNight').addEventListener('click', () => {
    if (!window.journeyMap) return;
    const night = !window.journeyMap?.isNight();
    window.journeyMap?.setNight(night);
  });
  document.addEventListener('journey:map-theme', event => updateMapNightControl(event.detail.night));
  function updateMapNightControl(night = window.journeyMap?.isNight() || false) {
    $('mapNight').setAttribute('aria-pressed', String(night));
    $('mapNight').setAttribute('aria-label', night ? '切换白昼模式' : '切换夜晚模式');
    $('mapNight').title = night ? '切换白昼模式' : '切换夜晚模式';
    const icon = document.createElement('i');
    icon.dataset.lucide = night ? 'sun' : 'moon';
    $('mapNight').replaceChildren(icon);
    window.lucide?.createIcons({ root: $('mapNight') });
  }
  $('mapZoomIn').addEventListener('click', () => window.journeyMap?.zoom(1.15));
  $('mapZoomOut').addEventListener('click', () => window.journeyMap?.zoom(.87));
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'Escape' && activeScreen === 'map') {
      event.preventDefault();
      window.showJourneyScreen('landing');
    }
  });
  document.addEventListener('DOMContentLoaded', () => { window.lucide?.createIcons(); updateMapNightControl(); });
  updateVisited();
})();
