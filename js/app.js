(() => {
  'use strict';

  const S = window.SITE;
  const app = document.getElementById('app');

  const TYPES = {
    concept:  { label: 'Concepts',      cls: 't-concept' },
    issue:    { label: 'Issue',         cls: 't-issue' },
    feature:  { label: 'New Feature',   cls: 't-feature' },
    snippet:  { label: 'Code Bit',      cls: 't-snippet' },
    solution: { label: 'Full Solution', cls: 't-solution' },
    functional: { label: 'Functional', cls: 't-functional' }
  };

  const state = { posts: [], type: 'all', q: '' };
  let routeToken = 0;

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  const fmtDate = (d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // mailto: links open normally; web links open in a new tab
  const extLink = (l, cls) => {
    const mail = /^mailto:/i.test(l.url);
    return `<a${cls ? ` class="${cls}"` : ''} href="${esc(l.url)}"${mail ? '' : ' target="_blank" rel="noopener"'}>${esc(l.label)}${mail || !cls ? '' : ' ↗'}</a>`;
  };

  const badge = (t) => {
    const x = TYPES[t] || { label: t, cls: '' };
    return `<span class="badge ${x.cls}">${esc(x.label)}</span>`;
  };

  const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

  const initials = (name) =>
    String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fade cards in as they scroll into view, and tilt them in 3D under the mouse
  let observer = null;
  function enhanceUI(root) {
    // Only small blocks fade in. Long blocks (the article itself) are always visible.
    const items = root.querySelectorAll('.card, .stat, .hl-card, .project, .follow, .ask, .pager a, .hero-panel, .about-panel');
    if (!reduceMotion() && 'IntersectionObserver' in window) {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('in'); observer.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -30px 0px', threshold: 0 });
      items.forEach((el, i) => {
        el.classList.add('reveal');
        el.style.transitionDelay = Math.min(i, 6) * 40 + 'ms';
        observer.observe(el);
      });
      // Safety net: never leave anything hidden
      setTimeout(() => items.forEach((el) => el.classList.add('in')), 2500);
    }

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine || reduceMotion()) return;
    root.querySelectorAll('.card, .stat, .hl-card, .project, .pager a').forEach((el) => {
      el.classList.add('tilt');
      const max = el.classList.contains('card') ? 5 : 7;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.transitionDelay = '0ms';
        el.style.transform =
          `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-3px)`;
        el.style.setProperty('--mx', x * 100 + '%');
        el.style.setProperty('--my', y * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Colour theme picker ---------- */

  const PALETTES = [
    { id: 'aurora',   name: 'Aurora',   sw: 'linear-gradient(135deg, #a78bfa, #60a5fa, #5eead4)' },
    { id: 'ocean',    name: 'Ocean',    sw: 'linear-gradient(135deg, #3b82f6, #0ea5e9, #22d3ee)' },
    { id: 'neon',     name: 'Neon',     sw: 'linear-gradient(135deg, #f0abfc, #ec4899, #22d3ee)' },
    { id: 'sunset',   name: 'Sunset',   sw: 'linear-gradient(135deg, #fbbf24, #fb7185, #c084fc)' },
    { id: 'graphite', name: 'Graphite', sw: 'linear-gradient(135deg, #e4e4e7, #71717a, #bef264)' },
    { id: 'emerald',  name: 'Emerald',  sw: 'linear-gradient(135deg, #6ee7b7, #10b981, #fcd34d)' }
  ];

  const currentPalette = () => document.documentElement.getAttribute('data-palette') || 'aurora';

  function applyPalette(id) {
    const root = document.documentElement;
    if (id === 'aurora') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', id);
    try { localStorage.setItem('palette', id); } catch (e) {}
  }

  function setupPalettePicker() {
    const btn = document.getElementById('palette-toggle');
    const pop = document.getElementById('palette-pop');
    if (!btn || !pop) return;

    // The site owner can set a default in config.js; a visitor's own choice wins
    let saved = null;
    try { saved = localStorage.getItem('palette'); } catch (e) {}
    if (!saved && S.palette && S.palette !== 'aurora') document.documentElement.setAttribute('data-palette', S.palette);

    pop.innerHTML =
      '<div class="palette-title">Colour theme</div>' +
      PALETTES.map((p) =>
        `<button type="button" class="palette-opt" role="menuitemradio" data-pal="${p.id}">
           <span class="sw" style="background:${p.sw}"></span>${esc(p.name)}
         </button>`).join('');

    const sync = () => pop.querySelectorAll('.palette-opt').forEach((o) => {
      const on = o.dataset.pal === currentPalette();
      o.classList.toggle('on', on);
      o.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const open = (yes) => {
      pop.hidden = !yes;
      btn.setAttribute('aria-expanded', yes ? 'true' : 'false');
      if (yes) sync();
    };

    btn.addEventListener('click', (e) => { e.stopPropagation(); open(pop.hidden); });
    pop.addEventListener('click', (e) => {
      const o = e.target.closest('.palette-opt');
      if (!o) return;
      applyPalette(o.dataset.pal);
      sync();
    });
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) open(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
  }

  /* ---------- Shell (header / footer / theme) ---------- */

  function setupShell() {
    setupPalettePicker();
    document.getElementById('brand').textContent = S.name;
    document.getElementById('brand-mark').textContent = initials(S.name);
    const links = (S.links || []).map((l) => extLink(l, '')).join(' · ');
    document.getElementById('footer').innerHTML =
      `<span>© ${new Date().getFullYear()} ${esc(S.name)} · Posts licensed <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></span><span>${links}</span>`;

    document.getElementById('theme-toggle').addEventListener('click', () => {
      const root = document.documentElement;
      const next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'dark' ? '#07060d' : '#f6f4fb');
      // Keep the comments box in the same theme
      const frame = document.querySelector('iframe.giscus-frame');
      if (frame) frame.contentWindow.postMessage({ giscus: { setConfig: { theme: next } } }, 'https://giscus.app');
    });

    setupReaderBar();

    // Reading progress bar (shown on posts)
    const bar = document.createElement('div');
    bar.className = 'progress';
    document.body.appendChild(bar);
    window.addEventListener('scroll', () => {
      if (!document.querySelector('.article')) { bar.style.width = '0'; return; }
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    }, { passive: true });
  }

  /* ---------- Reader controls (text size, width, pinch) ----------
     Browser pinch zoom only magnifies the page, so lines run off the
     screen. These controls change CSS variables instead, so the text
     gets bigger or smaller and the lines wrap again to fit. */
  const READ_MIN = 0.8, READ_MAX = 1.6, READ_STEP = 0.1;

  function setupReaderBar() {
    const root = document.documentElement;
    let scale = 1;
    try { scale = parseFloat(localStorage.getItem('readScale')) || 1; } catch (e) {}

    const bar = document.createElement('div');
    bar.className = 'reader-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Reading options');
    bar.innerHTML =
      '<button class="rb-small" data-act="down" aria-label="Smaller text" title="Smaller text">A−</button>' +
      '<button class="rb-size" data-act="reset" aria-label="Reset text size" title="Reset text size">100%</button>' +
      '<button class="rb-big" data-act="up" aria-label="Bigger text" title="Bigger text">A+</button>' +
      '<span class="rb-sep" aria-hidden="true"></span>' +
      '<button class="rb-width" data-act="wide" aria-label="Wide reading column" title="Wide / normal column" aria-pressed="false">↔</button>';
    document.body.appendChild(bar);
    const sizeBtn = bar.querySelector('.rb-size');
    const wideBtn = bar.querySelector('.rb-width');

    function applyScale(v, save) {
      scale = Math.min(READ_MAX, Math.max(READ_MIN, Math.round(v * 100) / 100));
      root.style.setProperty('--read-scale', scale);
      sizeBtn.textContent = Math.round(scale * 100) + '%';
      if (save) { try { localStorage.setItem('readScale', String(scale)); } catch (e) {} }
    }
    function setScaleKeepPlace(v) {
      // Keep the reader at the same point in the article while it reflows
      const h = document.documentElement;
      const ratio = h.scrollHeight > 0 ? h.scrollTop / h.scrollHeight : 0;
      applyScale(v, true);
      h.scrollTop = ratio * h.scrollHeight;
    }
    function applyWide(on, save) {
      if (on) root.setAttribute('data-read-wide', '1'); else root.removeAttribute('data-read-wide');
      wideBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (save) { try { localStorage.setItem('readWide', on ? '1' : '0'); } catch (e) {} }
    }

    applyScale(scale, false);
    let wide = false;
    try { wide = localStorage.getItem('readWide') === '1'; } catch (e) {}
    applyWide(wide, false);

    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'up') setScaleKeepPlace(scale + READ_STEP);
      else if (act === 'down') setScaleKeepPlace(scale - READ_STEP);
      else if (act === 'reset') setScaleKeepPlace(1);
      else if (act === 'wide') applyWide(!root.hasAttribute('data-read-wide'), true);
    });

    // Two-finger pinch on the article changes the text size (and reflows).
    // Outside the article, normal browser zoom still works.
    let startDist = 0, startScale = 1, pending = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2 && e.target.closest && e.target.closest('body.reading .article-shell')) {
        startDist = dist(e.touches); startScale = scale;
      }
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!startDist || e.touches.length !== 2) return;
      e.preventDefault();
      const next = startScale * (dist(e.touches) / startDist);
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => applyScale(next, false));
    }, { passive: false });
    document.addEventListener('touchend', (e) => {
      if (startDist && e.touches.length < 2) {
        startDist = 0;
        try { localStorage.setItem('readScale', String(scale)); } catch (err) {}
      }
    }, { passive: true });
  }

  function setActiveNav(name) {
    document.querySelectorAll('[data-nav]').forEach((a) =>
      a.classList.toggle('active', a.dataset.nav === name));
  }

  function setTitle(t) {
    document.title = t ? `${t} · ${S.name}` : `${S.name} · Blog`;
  }

  /* ---------- Home ---------- */

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return state.posts.filter((p) => {
      if (state.type !== 'all' && p.type !== state.type) return false;
      if (!q) return true;
      return (p.title + ' ' + p.summary + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q);
    });
  }

  function cardHtml(p) {
    return `
      <a class="card" href="#/post/${encodeURIComponent(p.slug)}">
        <div class="meta">${badge(p.type)}<span>${fmtDate(p.date)}</span><span>${p.readingTime} min read</span></div>
        <span class="latest-label">Latest</span>
        <span class="arrow" aria-hidden="true">↗</span>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary)}</p>
        <div class="tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </a>`;
  }

  function listHtml() {
    const items = filtered();
    if (!items.length) return '<div class="empty">No posts match. Try another filter.</div>';
    return items.map(cardHtml).join('');
  }

  // "View CV" button, shown when S.resume.url is set in config.js. Opens the PDF in a new browser tab.
  function cvLink(extraClass) {
    const r = S.resume || {};
    if (!r.url) return '';
    const label = r.label || 'View CV';
    return `<a class="pill-link cv-link ${extraClass || ''}" href="${esc(r.url)}" target="_blank" rel="noopener">` +
      `${esc(label)} <span aria-hidden="true">↗</span></a>`;
  }

  function renderHome() {
    setActiveNav('home');
    setTitle('');
    const counts = { all: state.posts.length };
    Object.keys(TYPES).forEach((k) => (counts[k] = state.posts.filter((p) => p.type === k).length));
    const links = (S.links || []).map((l) => extLink(l, 'pill-link')).join('');

    app.innerHTML = `
      <section class="hero">
        <div class="hero-panel">
          <div class="avatar">${S.photo
            ? `<img src="${esc(S.photo)}" alt="${esc(S.name)}">`
            : `<span>${esc(initials(S.name))}</span>`}</div>
          <div class="hero-main">
            <span class="status">Writing about Business Central</span>
            <div class="eyebrow">${esc(S.role)} · ${esc(S.location)}</div>
            <h1><span class="grad-text">${esc(S.name)}</span></h1>
            <p class="lead">${esc(S.intro)}</p>
            <div class="link-row">
              ${state.posts[0] ? `<a class="pill-link primary" href="#/post/${encodeURIComponent(state.posts[0].slug)}">Read the latest post →</a>` : ''}
              <a class="pill-link" href="#/about">About me</a>${cvLink()}${links}
            </div>
          </div>
          <div class="stats">
            <div><b>${state.posts.length}</b>posts</div>
            <div><b>${new Set(state.posts.flatMap((p) => p.tags || [])).size}</b>topics</div>
            <div><b>${state.posts[0] ? fmtDate(state.posts[0].date) : '–'}</b>latest</div>
            <div id="total-views" hidden></div>
          </div>
        </div>
      </section>

      <div class="section-title"><h2>Posts</h2></div>

      <div class="toolbar">
        <div class="chips" id="chips">
          <button class="chip" data-type="all">All<small>${counts.all}</small></button>
          ${Object.entries(TYPES)
            .map(([k, v]) => `<button class="chip" data-type="${k}">${esc(v.label)}<small>${counts[k]}</small></button>`)
            .join('')}
        </div>
        <input class="search" id="search" type="search" placeholder="Search posts…" value="${esc(state.q)}" aria-label="Search posts">
      </div>

      <div class="post-list" id="list">${listHtml()}</div>
      ${followBox()}`;

    const syncChips = () =>
      app.querySelectorAll('.chip[data-type]').forEach((c) =>
        c.classList.toggle('on', c.dataset.type === state.type));
    syncChips();

    app.querySelector('#chips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip[data-type]');
      if (!b) return;
      state.type = b.dataset.type;
      syncChips();
      app.querySelector('#list').innerHTML = listHtml();
      enhanceUI(app.querySelector('#list'));
    });
    app.querySelector('#search').addEventListener('input', (e) => {
      state.q = e.target.value;
      app.querySelector('#list').innerHTML = listHtml();
      enhanceUI(app.querySelector('#list'));
    });
    enhanceUI(app);
    showViews(app.querySelector('#total-views'), 'TOTAL');
  }

  /* ---------- Post ---------- */

  function enhanceCode(root) {
    root.querySelectorAll('pre > code').forEach((code) => {
      const m = /language-([\w+-]+)/.exec(code.className || '');
      const lang = m ? m[1] : 'text';
      // highlight.js has no AL grammar; Delphi/Pascal is the closest match
      const hl = lang === 'al' ? 'delphi' : lang;
      if (window.hljs && window.hljs.getLanguage(hl)) {
        code.className = `language-${hl}`;
        window.hljs.highlightElement(code);
      }

      const pre = code.parentElement;
      const wrap = document.createElement('div');
      wrap.className = 'codeblock';
      wrap.innerHTML =
        `<div class="codebar"><span><span class="dots"><i></i><i></i><i></i></span>${esc(lang.toUpperCase())}</span><button class="copy" type="button">Copy</button></div>`;
      pre.replaceWith(wrap);
      wrap.appendChild(pre);

      wrap.querySelector('.copy').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(code.textContent);
          btn.textContent = 'Copied ✓';
        } catch (err) {
          btn.textContent = 'Press Ctrl+C';
        }
        setTimeout(() => (btn.textContent = 'Copy'), 1600);
      });
    });
  }

  // "Follow along" box: email subscribe form, RSS feed and social follow buttons
  function followBox() {
    const sub = S.subscribe || {};
    const form = sub.action
      ? `<form class="sub-form" action="${esc(sub.action)}" method="post" target="_blank">
           <input type="email" name="${esc(sub.emailField || 'email')}" placeholder="you@example.com" required aria-label="Email address">
           <button class="chip on" type="submit">Subscribe</button>
         </form>`
      : '';
    const btns = [];
    if (S.siteUrl) btns.push('<a class="pill-link" href="feed.xml">RSS feed</a>');
    (S.links || []).forEach((l) => {
      if (/^mailto:/i.test(l.url)) return;
      btns.push(`<a class="pill-link" href="${esc(l.url)}" target="_blank" rel="noopener">Follow on ${esc(l.label)} ↗</a>`);
    });
    if (!form && !btns.length) return '';
    return `
      <section class="follow">
        <h2>Follow along</h2>
        <p class="muted">${form ? 'Get each new post by email, or follow me where you already are.' : 'Follow me to catch every new post.'}</p>
        ${form}
        <div class="link-row">${btns.join('')}</div>
      </section>`;
  }

  // Questions section: giscus (GitHub Discussions) when configured, otherwise email / LinkedIn
  function renderAsk(p) {
    const box = document.getElementById('ask');
    if (!box) return;
    const c = S.comments || {};

    if (c.repo && c.repoId && c.categoryId) {
      box.innerHTML =
        '<h2>Questions &amp; discussion</h2>' +
        '<p class="muted">Sign in with GitHub to ask a question or share your own approach.</p>' +
        '<div class="giscus-wrap"></div>';
      const dark = isDark();
      const s = document.createElement('script');
      s.src = 'https://giscus.app/client.js';
      s.async = true;
      s.crossOrigin = 'anonymous';
      const data = {
        repo: c.repo, 'repo-id': c.repoId,
        category: c.category || 'Q&A', 'category-id': c.categoryId,
        mapping: 'specific', term: p.slug, strict: '0',
        'reactions-enabled': '1', 'emit-metadata': '0',
        'input-position': 'top', theme: dark ? 'dark' : 'light', lang: 'en'
      };
      Object.keys(data).forEach((k) => s.setAttribute('data-' + k, data[k]));
      box.querySelector('.giscus-wrap').appendChild(s);
      return;
    }

    const mail = (S.links || []).find((l) => /^mailto:/i.test(l.url));
    const li = (S.links || []).find((l) => /linkedin\.com/i.test(l.url));
    const btns = [];
    if (mail) {
      const href = mail.url.split('?')[0] + '?subject=' + encodeURIComponent('Question: ' + p.title);
      btns.push(`<a class="pill-link" href="${esc(href)}">Ask by email</a>`);
    }
    if (li) btns.push(`<a class="pill-link" href="${esc(li.url)}" target="_blank" rel="noopener">Message on LinkedIn ↗</a>`);
    box.innerHTML =
      '<h2>Have a question?</h2>' +
      '<p class="muted">Ask about this post and I will reply. Good questions often become a follow-up post.</p>' +
      `<div class="link-row">${btns.join('')}</div>`;
  }

  async function renderPost(slug) {
    setActiveNav('home');
    const token = ++routeToken;
    const idx = state.posts.findIndex((p) => p.slug === slug);
    if (idx < 0) return renderNotFound();
    const p = state.posts[idx];

    app.innerHTML = '<p class="muted">Loading…</p>';
    let md;
    try {
      const res = await fetch(`posts/${encodeURIComponent(slug)}.md`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      md = (await res.text()).replace(/^---[\s\S]*?\r?\n---\r?\n?/, '');
    } catch (e) {
      if (token !== routeToken) return;
      return renderNotFound();
    }
    if (token !== routeToken) return;

    const newer = state.posts[idx - 1];
    const older = state.posts[idx + 1];
    setTitle(p.title);

    app.innerHTML = `
      <a class="back" href="#/">← All posts</a>
      <article class="article article-shell">
        <div class="meta">${badge(p.type)}<span>${fmtDate(p.date)}</span><span>${p.readingTime} min read</span><span id="post-views" hidden></span></div>
        <h1>${esc(p.title)}</h1>
        <div class="tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="prose" id="prose">${window.marked.parse(md)}</div>
        <div class="share"><button class="chip" id="share">Copy link</button></div>
      </article>
      <section class="ask" id="ask"></section>
      ${followBox()}
      <nav class="pager">
        ${older ? `<a class="prev" href="#/post/${encodeURIComponent(older.slug)}"><small>← Older</small>${esc(older.title)}</a>` : '<span></span>'}
        ${newer ? `<a class="next" href="#/post/${encodeURIComponent(newer.slug)}"><small>Newer →</small>${esc(newer.title)}</a>` : ''}
      </nav>`;

    enhanceCode(app.querySelector('#prose'));
    // Wide tables scroll sideways on small screens
    app.querySelectorAll('#prose table').forEach((t) => {
      const w = document.createElement('div');
      w.className = 'table-wrap';
      t.replaceWith(w);
      w.appendChild(t);
    });
    renderAsk(p);
    enhanceUI(app);
    showViews(app.querySelector('#post-views'), '/post/' + p.slug, 'views');
    app.querySelector('#share').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(location.href);
        e.currentTarget.textContent = 'Link copied ✓';
      } catch (err) {
        e.currentTarget.textContent = 'Copy from address bar';
      }
    });
    window.scrollTo(0, 0);
  }

  /* ---------- About ---------- */

  function renderAbout() {
    setActiveNav('about');
    setTitle('About');

    const chips = (items) =>
      `<div class="chips">${(items || []).map((i) => `<span class="chip">${esc(i)}</span>`).join('')}</div>`;
    const bullets = (b) =>
      (b && b.length) ? `<ul class="bullets">${b.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const section = (title, inner) =>
      inner ? `<section class="a-sec"><h2>${esc(title)}</h2>${inner}</section>` : '';

    const links = (S.links || []).map((l) => extLink(l, 'pill-link')).join('');

    const stats = (S.stats || [])
      .map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
      .join('');

    const summary = (S.summary || []).map((t) => `<p>${esc(t)}</p>`).join('');

    const highlights = (S.highlights || [])
      .map((h) => `<div class="hl-card"><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>`)
      .join('');

    const experience = (S.experience || [])
      .map((job) => `
        <div class="job">
          <div class="job-head">
            <h3>${esc(job.title)}</h3>
            <div class="meta"><span>${esc(job.company)}</span><span>${esc(job.period)}</span></div>
          </div>
          ${bullets(job.bullets)}
          ${(job.projects || []).length ? `
            <div class="projects">
              <h4>Client projects</h4>
              ${job.projects.map((p) => `
                <div class="project">
                  <div class="project-head"><b>${esc(p.name)}</b><span class="meta"><span>${esc(p.duration)}</span></span></div>
                  ${bullets(p.bullets)}
                </div>`).join('')}
            </div>` : ''}
        </div>`)
      .join('');

    const skills = (S.skills || [])
      .map((g) => `<div class="skill-group"><h3>${esc(g.group)}</h3>${chips(g.items)}</div>`)
      .join('');

    const certs = (S.certifications || [])
      .map((c) => `<div class="cert"><b>${esc(c.title)}</b><span class="muted">${esc(c.note || '')}</span></div>`)
      .join('');

    const edu = (S.education || [])
      .map((e) => `<div class="cert"><b>${esc(e.degree)}</b><span class="muted">${esc(e.school)} · ${esc(e.year)}</span></div>`)
      .join('');

    app.innerHTML = `
      <section class="about">
        <div class="about-panel">
          <div class="avatar about-avatar">${S.photo
            ? `<img src="${esc(S.photo)}" alt="${esc(S.name)}">`
            : `<span>${esc(initials(S.name))}</span>`}</div>
          <div class="eyebrow-line">${esc(S.role)} · ${esc(S.location)}</div>
          <h1><span class="grad-text">${esc(S.name)}</span></h1>
          <div class="prose">${summary}</div>
          <div class="link-row">${cvLink('primary')}${links}${(S.resume || {}).url ? '' : '<button class="pill-link print-btn" id="print-btn" type="button">Save as PDF</button>'}</div>
        </div>
        ${stats ? `<div class="stat-row">${stats}</div>` : ''}

        ${section('Key technical highlights', highlights ? `<div class="hl-grid">${highlights}</div>` : '')}
        ${section('Experience', experience ? `<div class="timeline">${experience}</div>` : '')}
        ${section('Functional expertise', chips(S.functional))}
        ${section('Technical skills', skills)}
        ${section('Certifications', certs)}
        ${section('Education', edu)}
        ${section('Languages', chips(S.languages))}
        ${section('Writing', `<p class="muted">${state.posts.length} posts so far. <a href="#/">Read the latest →</a></p>`)}
      </section>`;

    const pb = app.querySelector('#print-btn');
    if (pb) pb.addEventListener('click', () => window.print());
    enhanceUI(app);
    window.scrollTo(0, 0);
  }

  function renderNotFound() {
    setTitle('Not found');
    app.innerHTML = '<div class="empty"><h2>Page not found</h2><p><a href="#/">← Back to all posts</a></p></div>';
  }

  /* ---------- Router ---------- */

  function route() {
    routeToken++;
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const page = parts[0] || '';
    // Calm "reading mode" on post pages
    document.body.classList.toggle('reading', page === 'post');
    if (page === '') return renderHome();
    if (page === 'about') return renderAbout();
    if (page === 'post' && parts[1]) return renderPost(decodeURIComponent(parts[1]));
    renderNotFound();
  }

  /* ---------- Public view counts (GoatCounter) ---------- */
  // Needs "Allow adding visitor counts on your website" switched on in GoatCounter settings.
  // GoatCounter caches these numbers for up to a few hours, so they lag a little behind.
  const viewCache = {};
  function fetchViews(path) {
    const code = (S.goatcounter || '').trim();
    if (!/^[a-z0-9-]+$/i.test(code)) return Promise.resolve(null);
    if (!viewCache[path]) {
      const p = path === 'TOTAL' ? 'TOTAL' : encodeURIComponent(path);
      viewCache[path] = fetch('https://' + code + '.goatcounter.com/counter/' + p + '.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j && j.count ? String(j.count) : null))
        .catch(() => null);
    }
    return viewCache[path];
  }
  function showViews(el, path, suffix) {
    if (!el) return;
    fetchViews(path).then((n) => {
      if (!n || n === '0') return;
      el.innerHTML = suffix ? `${esc(n)} ${suffix}` : `<b>${esc(n)}</b>views`;
      el.hidden = false;
    });
  }

  /* ---------- Visitor counter (GoatCounter) ---------- */
  // Counts one view per page: the home page, About, and each post (#/post/slug).
  // Off when S.goatcounter is empty. GoatCounter ignores visits from localhost.
  function setupAnalytics() {
    const code = (S.goatcounter || '').trim();
    if (!/^[a-z0-9-]+$/i.test(code)) return;
    window.goatcounter = { no_onload: true };
    const count = () => {
      if (!window.goatcounter || !window.goatcounter.count) return;
      const path = (location.hash || '#/').replace(/^#/, '') || '/';
      window.goatcounter.count({ path: path, title: document.title });
    };
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://gc.zgo.at/count.js';
    tag.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
    tag.addEventListener('load', () => setTimeout(count, 300));
    document.head.appendChild(tag);
    window.addEventListener('hashchange', () => setTimeout(count, 300));
  }

  async function init() {
    setupShell();
    setupAnalytics();
    try {
      const res = await fetch('posts/posts.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      state.posts = await res.json();
      state.posts.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));
    } catch (e) {
      app.innerHTML =
        '<div class="empty"><h2>Could not load posts</h2>' +
        '<p>Open the site through a web server (for example <code>npx serve</code> or GitHub Pages), not by double-clicking index.html.</p></div>';
      return;
    }
    if (window.marked) window.marked.setOptions({ gfm: true, breaks: false });
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})();
