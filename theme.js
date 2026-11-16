'use strict';

(() => {
  const key = 'bioscan-prototype:v1:theme';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
  root.dataset.theme = read();
  function apply(theme) {
    root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    const dark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      button.querySelector('.theme-label').textContent = dark ? 'Light mode' : 'Dark mode';
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1916' : document.body?.classList.contains('client-site') ? '#ffffff' : '#f8f6ef');
  }
  addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header .header-inner');
    if (header) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'button secondary theme-toggle';
      toggle.dataset.themeToggle = '';
      toggle.innerHTML = '<svg class="theme-moon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20.5 13A8.6 8.6 0 0 1 11 3.5 8.7 8.7 0 1 0 20.5 13Z"/></svg>' +
        '<svg class="theme-sun" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><span class="theme-label">Dark mode</span>';
      toggle.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        apply(next);
        try { localStorage.setItem(key, next); } catch { /* Keep the selected theme for this page when storage is unavailable. */ }
      });
      header.append(toggle);
    }
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'button secondary back-to-top';
    top.setAttribute('aria-label', 'Back to top');
    top.title = 'Back to top';
    top.hidden = true;
    top.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 12 6-6 6 6M12 6v14M5 3h14"/></svg>';
    top.addEventListener('click', () => {
      scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      document.querySelector('main')?.focus({ preventScroll: true });
    });
    document.body.append(top);
    const update = () => { top.hidden = scrollY < 400; };
    addEventListener('scroll', update, { passive: true });
    update();
    apply(root.dataset.theme);
  });
  addEventListener('storage', event => { if (event.key === key || event.key === null) apply(read()); });
})();
