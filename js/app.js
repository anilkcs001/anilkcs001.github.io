(() => {
  'use strict';

  const S = window.SITE;
  const app = document.getElementById('app');

  const TYPES = {
    issue:    { label: 'Issue',         cls: 't-issue' },
    feature:  { label: 'New Feature',   cls: 't-feature' },
    snippet:  { label: 'Code Bit',      cls: 't-snippet' },
    solution: { label: 'Full Solution', cls: 't-solution' }
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

  /* ---------- Shell (header / footer / theme) ---------- */

  function setupShell() {
    document.getElementById('brand').textContent = S.name;
    const links = (S.links || []).map((l) => extLink(l, '')).join(' · ');
    document.getElementById('footer').innerHTML =
      `<span>© ${new Date().getFullYear()} ${esc(S.name)}</span><span>${links}</span>`;

    document.getElementById('theme-toggle').addEventListener('click', () => {
      const root = document.documentElement;
      const dark = root.getAttribute('data-theme')
        ? root.getAttribute('data-theme') === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
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

  function renderHome() {
    setActiveNav('home');
    setTitle('');
    const counts = { all: state.posts.length };
    Object.keys(TYPES).forEach((k) => (counts[k] = state.posts.filter((p) => p.type === k).length));
    const links = (S.links || []).map((l) => extLink(l, 'pill-link')).join('');

    app.innerHTML = `
      <section class="hero">
        <div class="eyebrow">${esc(S.role)} · ${esc(S.location)}</div>
        <h1>${esc(S.name)}</h1>
        <p>${esc(S.intro)}</p>
        <div class="link-row">
          <a class="pill-link" href="#/about">About me →</a>${links}
        </div>
        <div class="stats">
          <div><b>${state.posts.length}</b>posts</div>
          <div><b>${new Set(state.posts.flatMap((p) => p.tags || [])).size}</b>topics</div>
          <div><b>${state.posts[0] ? fmtDate(state.posts[0].date) : '–'}</b>latest</div>
        </div>
      </section>

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
    });
    app.querySelector('#search').addEventListener('input', (e) => {
      state.q = e.target.value;
      app.querySelector('#list').innerHTML = listHtml();
    });
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
        `<div class="codebar"><span>${esc(lang.toUpperCase())}</span><button class="copy" type="button">Copy</button></div>`;
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
      const attr = document.documentElement.getAttribute('data-theme');
      const dark = attr ? attr === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
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
      <article class="article">
        <div class="meta">${badge(p.type)}<span>${fmtDate(p.date)}</span><span>${p.readingTime} min read</span></div>
        <h1>${esc(p.title)}</h1>
        <div class="tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="meta"></div>
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
    renderAsk(p);
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
        <div class="eyebrow-line">${esc(S.role)} · ${esc(S.location)}</div>
        <h1>${esc(S.name)}</h1>
        <div class="prose">${summary}</div>
        <div class="link-row">${links}<button class="pill-link print-btn" id="print-btn" type="button">Save as PDF</button></div>
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
    if (page === '') return renderHome();
    if (page === 'about') return renderAbout();
    if (page === 'post' && parts[1]) return renderPost(decodeURIComponent(parts[1]));
    renderNotFound();
  }

  async function init() {
    setupShell();
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
