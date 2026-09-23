/* BroPage — попап расширения */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const ext = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  const enabledEl = $('#enabled');
  const darkBtn = $('#themeDark');
  const lightBtn = $('#themeLight');

  function syncTheme(t) {
    darkBtn.classList.toggle('active', t === 'dark');
    lightBtn.classList.toggle('active', t === 'light');
    document.documentElement.dataset.theme = t; /* попап в выбранной теме */
  }

  async function init() {
    let theme = 'dark';
    let enabled = true;
    if (ext) {
      const d = await chrome.storage.local.get(['theme', 'enabled']);
      if (d.theme === 'light' || d.theme === 'dark') theme = d.theme;
      if (d.enabled === false) enabled = false;
    }
    enabledEl.checked = enabled;
    syncTheme(theme);
  }

  enabledEl.addEventListener('change', () => {
    if (ext) chrome.storage.local.set({ enabled: enabledEl.checked });
  });
  darkBtn.addEventListener('click', () => {
    syncTheme('dark');
    if (ext) chrome.storage.local.set({ theme: 'dark' });
  });
  lightBtn.addEventListener('click', () => {
    syncTheme('light');
    if (ext) chrome.storage.local.set({ theme: 'light' });
  });

  /* Ссылка из попапа: попап не умеет переходить на внешние сайты сам,
     поэтому открываем адрес новой вкладкой браузера */
  const creditLink = $('#creditLink');
  creditLink.addEventListener('click', (e) => {
    if (ext) {
      e.preventDefault();
      chrome.tabs.create({ url: creditLink.href });
    }
  });

  init();
})();
