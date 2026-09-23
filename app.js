/* BroPage — логика страницы новой вкладки (расширение) */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /* Хранилище: chrome.storage.local в расширении; localStorage — запасной
     вариант, если файл открыли напрямую через file:// */
  const ext = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  const store = {
    async get(keys) {
      if (ext) return chrome.storage.local.get(keys);
      const out = {};
      for (const k of keys) {
        try { out[k] = JSON.parse(localStorage.getItem('bropage.' + k)); } catch { out[k] = null; }
      }
      return out;
    },
    async set(obj) {
      if (ext) return chrome.storage.local.set(obj);
      for (const [k, v] of Object.entries(obj)) {
        try { localStorage.setItem('bropage.' + k, JSON.stringify(v)); } catch { /* нет доступа — не сохраняем */ }
      }
    },
  };

  const svg = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  const ICONS = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.4-4.4"/>'),
    pencil: svg('<path d="m14.5 5.5 4 4L8 20H4v-4L14.5 5.5Z"/>'),
    cross: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  };

  /* ================= Тема ================= */

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
  }

  /* ================= Часы ================= */

  const timeEl = $('#time');
  const dateEl = $('#date');
  const dateFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  function tick() {
    const n = new Date();
    timeEl.textContent = n.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = dateFmt.format(n);
  }
  tick();
  setInterval(tick, 1000);

  /* ================= Поиск ================= */

  const ENGINES = [
    { id: 'google', name: 'Google', letter: 'G', url: 'https://www.google.com/search?q=' },
    { id: 'yandex', name: 'Яндекс', letter: 'Я', url: 'https://yandex.ru/search/?text=' },
    { id: 'bing', name: 'Bing', letter: 'b', url: 'https://www.bing.com/search?q=' },
    { id: 'ddg', name: 'DuckDuckGo', letter: 'D', url: 'https://duckduckgo.com/?q=' },
  ];

  const searchForm = $('#searchForm');
  const input = $('#searchInput');
  const engineBtn = $('#engineBtn');
  const engineLetter = $('#engineLetter');
  const engineMenu = $('#engineMenu');

  let engine = ENGINES[0];

  function normalizeUrl(raw) {
    let u = raw.trim();
    if (!u) return '';
    if (!/^([a-z][a-z0-9+.-]*:)?\/\//i.test(u) && !/^localhost(:\d+)?([/?#]\S*)?$/i.test(u)) u = 'https://' + u;
    try { return new URL(u).href; } catch { return ''; }
  }

  function looksLikeUrl(s) {
    if (/^(https?|ftp|file):\/\//i.test(s)) return true;
    if (/^localhost(:\d+)?([/?#]\S*)?$/i.test(s)) return true;
    return /^[a-z0-9][a-z0-9-]*([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(s);
  }

  function renderEngineMenu() {
    engineMenu.innerHTML = '';
    ENGINES.forEach((e) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'engine-item' + (e.id === engine.id ? ' active' : '');
      b.innerHTML =
        `<span class="engine-letter">${e.letter}</span>` +
        `<span class="engine-name">${e.name}</span>` +
        `<span class="engine-check">${ICONS.check}</span>`;
      b.addEventListener('click', () => {
        engine = e;
        store.set({ engine: e.id });
        syncEngine();
        engineMenu.classList.add('hidden');
        input.focus();
      });
      engineMenu.appendChild(b);
    });
  }

  function syncEngine() {
    engineLetter.textContent = engine.letter;
    input.placeholder = `Поиск в ${engine.name} или адрес…`;
    renderEngineMenu();
  }

  engineBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    engineMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target)) engineMenu.classList.add('hidden');
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    location.href = looksLikeUrl(q) ? normalizeUrl(q) : engine.url + encodeURIComponent(q);
  });

  /* ================= Закладки ================= */

  const DEFAULTS = [
    { name: 'YouTube', url: 'https://www.youtube.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Википедия', url: 'https://ru.wikipedia.org' },
    { name: 'Telegram', url: 'https://web.telegram.org' },
    { name: 'Reddit', url: 'https://www.reddit.com' },
    { name: 'Gmail', url: 'https://mail.google.com' },
  ];

  const grid = $('#bmGrid');
  let bookmarks = DEFAULTS.map((b) => ({ ...b }));
  let dragFrom = -1;

  const validBm = (b) => b && typeof b.name === 'string' && typeof b.url === 'string';

  const saveBookmarks = () => store.set({ bookmarks });

  function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }

  function actBtn(icon, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bm-act ' + (title === 'Удалить' ? 'bm-del' : 'bm-edit');
    b.title = title;
    b.innerHTML = icon;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(e); });
    return b;
  }

  function makeTile(bm, idx) {
    const tile = document.createElement('div');
    tile.className = 'bm';
    tile.draggable = true;
    tile.title = `${bm.name} — ${bm.url}`;

    const link = document.createElement('a');
    link.className = 'bm-link';
    link.href = bm.url;

    const icon = document.createElement('span');
    icon.className = 'bm-icon';
    icon.textContent = (bm.name.trim().charAt(0) || '?').toUpperCase();

    const host = hostOf(bm.url);
    if (host) {
      const fav = new Image();
      fav.alt = '';
      fav.onload = () => { icon.textContent = ''; icon.appendChild(fav); };
      fav.onerror = () => { icon.textContent = (bm.name.trim().charAt(0) || '?').toUpperCase(); };
      fav.src = 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(host);
    }

    const label = document.createElement('span');
    label.className = 'bm-label';
    label.textContent = bm.name;

    link.append(icon, label);
    tile.append(
      link,
      actBtn(ICONS.pencil, 'Изменить', () => openModal(idx)),
      actBtn(ICONS.cross, 'Удалить', () => { bookmarks.splice(idx, 1); saveBookmarks(); render(); }),
    );

    /* Перетаскивание для сортировки */
    tile.addEventListener('dragstart', (e) => {
      dragFrom = idx;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* старые браузеры */ }
    });
    tile.addEventListener('dragend', () => {
      dragFrom = -1;
      grid.querySelectorAll('.bm').forEach((el) => el.classList.remove('drop-before', 'dragging'));
    });
    tile.addEventListener('dragover', (e) => {
      if (dragFrom < 0 || dragFrom === idx) return;
      e.preventDefault();
      tile.classList.add('drop-before');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-before'));
    tile.addEventListener('drop', (e) => {
      e.preventDefault();
      tile.classList.remove('drop-before');
      if (dragFrom < 0 || dragFrom === idx) return;
      const [moved] = bookmarks.splice(dragFrom, 1);
      bookmarks.splice(idx, 0, moved);
      saveBookmarks();
      render();
    });

    return tile;
  }

  function render() {
    grid.innerHTML = '';
    if (!bookmarks.length) {
      const p = document.createElement('p');
      p.className = 'bm-empty';
      p.textContent = 'Закладок пока нет — добавьте первую';
      grid.appendChild(p);
      return;
    }
    bookmarks.forEach((bm, i) => grid.appendChild(makeTile(bm, i)));
  }

  /* ---------- Модальное окно добавления/изменения ---------- */

  const modal = $('#modal');
  const bmForm = $('#bmForm');
  const bmName = $('#bmName');
  const bmUrl = $('#bmUrl');
  let editIdx = -1;

  function openModal(i) {
    editIdx = i;
    $('#modalTitle').textContent = i < 0 ? 'Новая закладка' : 'Изменить закладку';
    bmName.value = i < 0 ? '' : bookmarks[i].name;
    bmUrl.value = i < 0 ? '' : bookmarks[i].url;
    bmUrl.classList.remove('error');
    modal.classList.remove('hidden');
    setTimeout(() => bmName.focus(), 0);
    setTimeout(() => bmName.select(), 0);
  }

  function closeModal() { modal.classList.add('hidden'); }

  $('#bmAdd').addEventListener('click', () => openModal(-1));
  $('#bmCancel').addEventListener('click', closeModal);
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });

  bmForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = normalizeUrl(bmUrl.value);
    if (!url) { bmUrl.classList.add('error'); bmUrl.focus(); return; }
    const name = bmName.value.trim() || hostOf(url) || 'Закладка';
    if (editIdx < 0) bookmarks.push({ name, url });
    else bookmarks[editIdx] = { name, url };
    saveBookmarks();
    render();
    closeModal();
  });

  bmUrl.addEventListener('input', () => bmUrl.classList.remove('error'));

  /* ---------- Горячие клавиши ---------- */

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      engineMenu.classList.add('hidden');
      return;
    }
    if (!modal.classList.contains('hidden')) return;
    const typing = /^(input|textarea)$/i.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key === '/' && !typing) {
      e.preventDefault();
      input.focus();
    }
  });

  /* ---------- Запуск ---------- */

  (async function init() {
    const data = await store.get(['theme', 'engine', 'bookmarks', 'enabled']);

    let theme = data.theme;
    if (theme !== 'dark' && theme !== 'light') {
      theme = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(theme);

    if (data.enabled === false) document.body.classList.add('disabled');

    if (ENGINES.some((e) => e.id === data.engine)) {
      engine = ENGINES.find((e) => e.id === data.engine);
    }
    syncEngine();

    if (Array.isArray(data.bookmarks) && data.bookmarks.every(validBm)) {
      bookmarks = data.bookmarks;
    }
    render();
  })();

  /* Живой отклик на настройки из попапа расширения */
  if (ext) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.theme) {
        const t = changes.theme.newValue;
        if (t === 'dark' || t === 'light') applyTheme(t);
      }
      if (changes.enabled) {
        document.body.classList.toggle('disabled', changes.enabled.newValue === false);
      }
    });
  }
})();
