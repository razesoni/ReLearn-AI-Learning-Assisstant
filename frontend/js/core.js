/**
 * Margin — shared core.
 * Exposes window.Margin: helpers, API client, auth guard.
 * Pages wait on `Margin.ready` (resolves with the signed-in user, or null on public pages).
 */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- errors & HTTP ---------- */
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  function messageFrom(data, fallback) {
    if (!data) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail.length) return data.detail.map(d => d.msg || d).join(' ');
    return data.message || fallback;
  }

  async function http(path, opts) {
    opts = opts || {};
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.json) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.json); }
    let res;
    try { res = await fetch(path, init); }
    catch (e) { throw new ApiError('Could not reach the server. Check your connection and try again.', 0); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new ApiError(messageFrom(data, 'Something went wrong (' + res.status + ').'), res.status);
    return data;
  }

  function upload(path, form, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', path);
      xhr.withCredentials = true;
      xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) { /* empty */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(messageFrom(data, 'Upload failed (' + xhr.status + ').'), xhr.status));
      };
      xhr.onerror = () => reject(new ApiError('Upload failed. Check your connection and try again.', 0));
      xhr.send(form);
    });
  }

  /* ---------- backend detection ---------- */
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') localStorage.setItem('margin-demo', '1');
  if (params.get('demo') === '0') localStorage.removeItem('margin-demo');

  const backend = (async () => {
    if (localStorage.getItem('margin-demo') === '1') return 'demo';
    try {
      const r = await fetch('/health', { credentials: 'same-origin' });
      return (r.status === 404 || r.status === 405) ? 'demo' : 'live';
    } catch (e) { return 'demo'; }
  })();

  const enc = encodeURIComponent;
  const live = {
    me: async () => null,
    login: body => http('/api/auth/login', { method: 'POST', json: body }).then(d => d.user),
    register: body => http('/api/auth/register', { method: 'POST', json: body }).then(d => d.user),
    logout: () => http('/api/auth/logout', { method: 'POST' }),
    listSets: () => http('/api/study-sets'),
    getSet: id => http('/api/study-sets/' + enc(id)),
    setStatus: id => http('/api/study-sets/' + enc(id) + '/status'),
    deleteSet: id => http('/api/study-sets/' + enc(id), { method: 'DELETE' }),
    createSet: (form, onProgress) => upload('/api/study-sets', form, onProgress),
    uploadVideo: (form, onProgress) => upload('/upload-video/', form, onProgress),
    saveAttempt: (id, body) => http('/api/study-sets/' + enc(id) + '/attempts', { method: 'POST', json: body })
  };

  // api.<method>(...) routes to the live backend or to sample mode.
  const api = new Proxy({}, {
    get: (_, name) => async function () {
      const mode = await backend;
      const impl = mode === 'demo' ? window.MarginDemo : live;
      return impl[name].apply(impl, arguments);
    }
  });

  /* ---------- UI helpers ---------- */
  function toast(message, type) {
    const stack = $('#toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3600);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const ICONS = {
    video: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="m16 10.5 5-2.5v8l-5-2.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="4" stroke="currentColor" stroke-width="1.7"/><path d="m10.5 9.5 4 2.5-4 2.5v-5Z" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const KIND_LABEL = { video: 'Video', pdf: 'PDF', youtube: 'YouTube' };
  const kindLabel = k => KIND_LABEL[k] || 'Source';
  const kindIcon = k => ICONS[k] || ICONS.pdf;

  function statusChip(status) {
    if (status === 'ready') return '<span class="chip ok">Ready</span>';
    if (status === 'failed') return '<span class="chip bad">Failed</span>';
    return '<span class="chip busy">Processing</span>';
  }

  function setRow(item, extraClass) {
    const ready = item.status === 'ready';
    const meta = ['<span>' + esc(kindLabel(item.kind)) + '</span>', '<span>' + esc(formatDate(item.created_at)) + '</span>'];
    if (ready) {
      meta.push('<span>' + (item.term_count || 0) + ' terms</span>');
      meta.push('<span>' + (item.question_count || 0) + ' problems</span>');
    }
    const best = item.best_score != null ? '<span class="chip">Best ' + item.best_score + '%</span>' : '';
    return '<a class="set-row ' + (extraClass || '') + '" href="/sets/' + enc(item.id) + '" data-id="' + esc(item.id) + '">' +
      '<span class="kind">' + kindIcon(item.kind) + '</span>' +
      '<span class="set-main"><strong>' + esc(item.title) + '</strong><span class="set-meta">' + meta.join('') + '</span></span>' +
      '<span class="set-end">' + best + statusChip(item.status) + '</span></a>';
  }

  // Wrap key terms in text with a highlighter mark. Input is plain text; output is safe HTML.
  function highlight(text, terms) {
    const safe = esc(text);
    const list = (terms || []).map(t => esc(t.term)).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!list.length) return safe;
    const pattern = list.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp('(?<![\\p{L}\\p{N}])(' + pattern + ')(?![\\p{L}\\p{N}])', 'giu');
    return safe.replace(re, (m) => '<mark class="hl" data-term="' + m.toLowerCase() + '" tabindex="0" role="button">' + m + '</mark>');
  }

  function safeNext(value) {
    return typeof value === 'string' && value.charAt(0) === '/' && value.charAt(1) !== '/' && value.charAt(1) !== '\\' ? value : '/dashboard';
  }

  /* ---------- page boot ---------- */
  const domReady = new Promise(r => {
    if (document.readyState !== 'loading') r(); else document.addEventListener('DOMContentLoaded', r);
  });

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function fillUser(user) {
    if (!user) return;
    $$('[data-user-name]').forEach(el => { el.textContent = user.name; });
    $$('[data-user-email]').forEach(el => { el.textContent = user.email; });
    $$('[data-user-initials]').forEach(el => { el.textContent = initials(user.name); });
    const first = String(user.name || '').split(/\s+/)[0];
    $$('[data-user-first]').forEach(el => { el.textContent = first; });
  }

  function initChrome(user, mode) {
    // theme
    $$('[data-theme-toggle]').forEach(btn => btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('margin-theme', next); } catch (e) { /* private mode */ }
    }));

    // mobile nav
    const side = $('#side'), scrim = $('#scrim'), menu = $('#menuToggle');
    const setNav = open => {
      if (!side) return;
      side.classList.toggle('open', open);
      if (scrim) scrim.classList.toggle('open', open);
      if (menu) menu.setAttribute('aria-expanded', String(open));
    };
    if (menu) menu.addEventListener('click', () => setNav(!side.classList.contains('open')));
    if (scrim) scrim.addEventListener('click', () => setNav(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });

    // active nav
    $$('.nav-link[href]').forEach(a => {
      const href = a.getAttribute('href');
      const here = location.pathname;
      if (here === href || (href !== '/' && here.indexOf(href + '/') === 0) || (href === '/library' && here.indexOf('/sets/') === 0)) {
        a.setAttribute('aria-current', 'page');
      }
    });

    // logout
    $$('[data-logout]').forEach(btn => btn.addEventListener('click', async () => {
      try { await api.logout(); } catch (e) { /* ignore, leave anyway */ }
      location.href = '/login';
    }));

    // public pages: swap guest/user actions
    $$('[data-when="user"]').forEach(el => { el.hidden = !user; });
    $$('[data-when="guest"]').forEach(el => { el.hidden = !!user; });

    if (mode === 'demo') {
      const bar = document.createElement('div');
      bar.className = 'demo-banner';
      bar.textContent = 'Sample mode: no backend is connected, so accounts and study sets exist only in this browser and the content is example material.';
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  const never = new Promise(() => {});
  const ready = (async () => {
    await domReady;
    const mode = await backend;
    const auth = document.body.dataset.auth;
    let user = null;
    try { user = await api.me(); } catch (e) { /* treat as signed out */ }

    if (auth === 'required' && !user) {
      location.replace('/login?next=' + enc(location.pathname + location.search));
      return never;
    }
    if (auth === 'guest' && user) {
      location.replace(safeNext(params.get('next')));
      return never;
    }
    document.documentElement.classList.remove('auth-pending');
    fillUser(user);
    initChrome(user, mode);
    return user;
  })();

  window.Margin = { $, $$, esc, api, ApiError, toast, formatDate, kindLabel, kindIcon, ICONS, statusChip, setRow, highlight, safeNext, ready };
})();
