/* Private analytics page at #/admin.
   Not linked anywhere. There is no server here, so the "login" is a read-only
   GoatCounter API token (and an optional GitHub token for comment counts) that
   you paste once. Tokens stay in this browser only (localStorage) and are never
   in the repo. Without a token the page shows nothing but the connect box. */
(() => {
  'use strict';

  const KEY_GC = 'admin.gc';
  const KEY_GH = 'admin.gh';
  const store = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n) => Number(n || 0).toLocaleString('en-IN');

  /* ---------- Data ---------- */

  async function gc(code, token, path, params) {
    const q = new URLSearchParams(params || {});
    const url = 'https://' + code + '.goatcounter.com/api/v0/' + path + (q.toString() ? '?' + q : '');
    let r;
    try {
      r = await fetch(url, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
    } catch (e) {
      const err = new Error('blocked'); err.kind = 'network'; throw err;
    }
    if (r.status === 401 || r.status === 403) { const err = new Error('token'); err.kind = 'token'; throw err; }
    if (!r.ok) { const err = new Error('HTTP ' + r.status); err.kind = 'http'; throw err; }
    return r.json();
  }

  // Comments per post from GitHub Discussions (giscus uses the slug as the discussion title)
  async function ghComments(cfg, token) {
    if (!token || !cfg || !cfg.repo) return null;
    const [owner, name] = cfg.repo.split('/');
    const query = `query($o:String!,$n:String!,$c:ID){repository(owner:$o,name:$n){
      discussions(first:100,categoryId:$c,orderBy:{field:CREATED_AT,direction:DESC}){
        nodes{title url comments(first:100){totalCount nodes{replies{totalCount}}}}}}}`;
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { o: owner, n: name, c: cfg.categoryId || null } })
    });
    if (!r.ok) { const err = new Error('gh'); err.kind = r.status === 401 ? 'ghtoken' : 'gh'; throw err; }
    const j = await r.json();
    if (j.errors || !j.data) { const err = new Error('gh'); err.kind = 'gh'; throw err; }
    const out = {};
    j.data.repository.discussions.nodes.forEach((d) => {
      const replies = d.comments.nodes.reduce((a, c) => a + (c.replies ? c.replies.totalCount : 0), 0);
      out[d.title] = { count: d.comments.totalCount + replies, url: d.url };
    });
    return out;
  }

  const iso = (d) => d.toISOString().slice(0, 13) + ':00:00Z';

  async function load(S, days, gcToken, ghToken) {
    const end = new Date(); end.setMinutes(0, 0, 0); end.setHours(end.getHours() + 1);
    const start = new Date(end.getTime() - days * 86400000);
    const range = { start: iso(start), end: iso(end) };
    const code = S.goatcounter;
    const [total, hits, refs, places, browsers] = await Promise.all([
      gc(code, gcToken, 'stats/total', range),
      gc(code, gcToken, 'stats/hits', Object.assign({ limit: 100 }, range)),
      gc(code, gcToken, 'stats/toprefs', Object.assign({ limit: 8 }, range)).catch(() => null),
      gc(code, gcToken, 'stats/locations', Object.assign({ limit: 8 }, range)).catch(() => null),
      gc(code, gcToken, 'stats/browsers', Object.assign({ limit: 6 }, range)).catch(() => null)
    ]);
    let comments = null, commentsError = '';
    try { comments = await ghComments(S.comments, ghToken); }
    catch (e) { commentsError = e.kind === 'ghtoken' ? 'The GitHub token was not accepted.' : 'Could not read comments from GitHub.'; }
    return { total, hits, refs, places, browsers, comments, commentsError, days };
  }

  /* ---------- Charts (inline SVG, theme colours from CSS) ---------- */

  function lineChart(days) {
    const W = 760, H = 220, P = { l: 40, r: 12, t: 12, b: 26 };
    const vals = days.map((d) => d.daily || 0);
    const max = Math.max(1, ...vals);
    const nice = Math.max(1, Math.ceil(max / 4) * 4);
    const x = (i) => P.l + (days.length < 2 ? 0 : (i * (W - P.l - P.r)) / (days.length - 1));
    const y = (v) => P.t + (H - P.t - P.b) * (1 - v / nice);
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${x(vals.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = (nice * i) / 4;
      grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" class="ad-grid"/>` +
              `<text x="${P.l - 6}" y="${y(v) + 4}" class="ad-axis" text-anchor="end">${Math.round(v)}</text>`;
    }
    const every = Math.max(1, Math.ceil(days.length / 6));
    const labels = days.map((d, i) => ((i % every === 0 && days.length - 1 - i >= every / 2) || i === days.length - 1)
      ? `<text x="${x(i)}" y="${H - 6}" class="ad-axis" text-anchor="${i === days.length - 1 ? 'end' : 'middle'}">${esc(shortDay(d.day))}</text>` : '').join('');
    const dots = days.length <= 35
      ? pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" class="ad-dot"><title>${esc(shortDay(days[i].day))}: ${vals[i]} visitors</title></circle>`).join('') : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visitors per day" class="ad-svg">
      <defs><linearGradient id="adg" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path d="${area}" fill="url(#adg)"/><path d="${line}" class="ad-line"/>${dots}${labels}</svg>`;
  }

  function shortDay(s) {
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function barList(items, empty) {
    if (!items || !items.length) return `<p class="muted">${esc(empty || 'Nothing yet.')}</p>`;
    const max = Math.max(1, ...items.map((i) => i.value));
    return '<ul class="ad-bars">' + items.map((i) =>
      `<li><div class="ad-bar-top"><span class="ad-bar-name" title="${esc(i.name)}">${i.href ? `<a href="${esc(i.href)}">${esc(i.name)}</a>` : esc(i.name)}</span><b>${nf(i.value)}</b></div>
       <div class="ad-bar"><i style="width:${Math.max(2, (i.value / max) * 100).toFixed(1)}%"></i></div></li>`).join('') + '</ul>';
  }

  /* ---------- Page ---------- */

  function connectBox(S, msg) {
    return `<section class="ad-box">
      <h1>Admin</h1>
      <p class="muted">Private view of how your posts are doing. Nothing here is saved on the website; the keys stay in this browser only.</p>
      ${msg ? `<p class="ad-msg">${msg}</p>` : ''}
      <form id="ad-form" autocomplete="off">
        <label>GoatCounter API token <span class="muted">(required, read-only)</span>
          <input type="password" id="ad-gc" placeholder="Paste token" value="${esc(store.get(KEY_GC))}" spellcheck="false"></label>
        <label>GitHub token <span class="muted">(optional, for comment counts; needs no permissions beyond public read)</span>
          <input type="password" id="ad-gh" placeholder="Paste token (optional)" value="${esc(store.get(KEY_GH))}" spellcheck="false"></label>
        <div class="link-row"><button class="pill-link primary" type="submit">Connect</button></div>
        <p class="muted ad-help">GoatCounter: Settings → API → create token with <b>Read statistics</b> only.
        GitHub: Settings → Developer settings → fine-grained token, public repositories, no extra permissions.</p>
      </form></section>`;
  }

  function errorText(e) {
    if (e.kind === 'token') return 'GoatCounter did not accept this token. Check that it has the "Read statistics" permission.';
    if (e.kind === 'network') return 'The browser could not reach the GoatCounter API. Either the token is for a different site code, or GoatCounter does not allow its API to be called from web pages. The README of this blog has the fallback.';
    return 'GoatCounter returned an error (' + esc(e.message) + '). Try again in a minute.';
  }

  function dashboard(S, posts, d, onRange) {
    const bySlug = {};
    posts.forEach((p) => { bySlug[p.slug] = p; });

    const rows = new Map();
    posts.forEach((p) => rows.set(p.slug, { slug: p.slug, title: p.title, date: p.date, views: 0, comments: d.comments ? ((d.comments[p.slug] || {}).count || 0) : null, curl: d.comments && d.comments[p.slug] ? d.comments[p.slug].url : '' }));
    let otherViews = 0;
    (d.hits.hits || []).forEach((h) => {
      const m = /^\/post\/([^/?#]+)/.exec(h.path || '');
      const slug = m ? decodeURIComponent(m[1]) : null;
      if (slug && rows.has(slug)) rows.get(slug).views += h.count || 0;
      else if (!slug) otherViews += h.count || 0;
    });
    const list = Array.from(rows.values()).sort((a, b) => b.views - a.views || (b.date || '').localeCompare(a.date || ''));
    const totalComments = d.comments ? list.reduce((a, r) => a + (r.comments || 0), 0) : null;
    const top = list[0] && list[0].views ? list[0] : null;
    const visitors = d.total.total_utc != null ? d.total.total_utc : d.total.total;
    const days = (d.total.stats || []).filter((s) => s && s.day);

    const refs = d.refs && d.refs.stats ? d.refs.stats.map((s) => ({ name: s.name || '(direct)', value: s.count })) : null;
    const places = d.places && d.places.stats ? d.places.stats.map((s) => ({ name: s.name || 'Unknown', value: s.count })) : null;
    const brs = d.browsers && d.browsers.stats ? d.browsers.stats.map((s) => ({ name: s.name || 'Unknown', value: s.count })) : null;

    const rangeBtns = [7, 30, 90].map((n) =>
      `<button type="button" class="ad-range${n === d.days ? ' on' : ''}" data-days="${n}">${n} days</button>`).join('');

    return `<section class="ad-head">
        <div><h1>Admin</h1><p class="muted">Last ${d.days} days · data from GoatCounter${d.comments ? ' and GitHub' : ''}</p></div>
        <div class="ad-actions"><div class="ad-ranges">${rangeBtns}</div>
          <button type="button" class="pill-link" id="ad-out">Sign out</button></div>
      </section>
      <div class="stat-row">
        <div class="stat"><b>${nf(visitors)}</b><span>Visitors</span></div>
        <div class="stat"><b>${nf(list.filter((r) => r.views).length)}</b><span>Posts read</span></div>
        <div class="stat"><b>${totalComments == null ? '—' : nf(totalComments)}</b><span>Comments</span></div>
        <div class="stat"><b class="ad-small">${top ? esc(top.title) : '—'}</b><span>Most read${top ? ' · ' + nf(top.views) : ''}</span></div>
      </div>
      <section class="ad-card"><h2>Visitors per day</h2>${days.length ? lineChart(days) : '<p class="muted">No data for this period yet.</p>'}</section>
      <div class="ad-two">
        <section class="ad-card"><h2>Posts by views</h2>
          ${barList(list.filter((r) => r.views).slice(0, 12).map((r) => ({ name: r.title, value: r.views, href: '#/post/' + encodeURIComponent(r.slug) })), 'No post views in this period.')}
          ${otherViews ? `<p class="muted ad-foot">Home, About and other pages: ${nf(otherViews)}</p>` : ''}</section>
        <section class="ad-card"><h2>Where visitors come from</h2>${barList(refs, 'No referrer data.')}
          <h2 class="ad-sub">Countries</h2>${barList(places, 'No location data.')}
          <h2 class="ad-sub">Browsers</h2>${barList(brs, 'No browser data.')}</section>
      </div>
      <section class="ad-card"><h2>All posts</h2>
        ${d.commentsError ? `<p class="ad-msg">${esc(d.commentsError)}</p>` : (d.comments ? '' : '<p class="muted">Add a GitHub token to see comment counts here.</p>')}
        <div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Post</th><th class="n">Views</th><th class="n">Comments</th></tr></thead><tbody>
        ${list.map((r) => `<tr><td><a href="#/post/${encodeURIComponent(r.slug)}">${esc(r.title)}</a></td>
          <td class="n">${nf(r.views)}</td>
          <td class="n">${r.comments == null ? '—' : (r.curl && r.comments ? `<a href="${esc(r.curl)}" target="_blank" rel="noopener">${nf(r.comments)}</a>` : nf(r.comments))}</td></tr>`).join('')}
        </tbody></table></div>
      </section>`;
  }

  async function render(app, ctx) {
    const S = ctx.S;
    let days = 30;
    const code = (S.goatcounter || '').trim();

    const show = (html) => { app.innerHTML = '<div class="ad">' + html + '</div>'; };

    const run = async () => {
      const gcT = store.get(KEY_GC), ghT = store.get(KEY_GH);
      if (!code) return show(connectBox(S, 'GoatCounter is not set up in config.js.'));
      if (!gcT) return bindConnect(connectBox(S));
      show('<p class="muted ad-loading">Loading your stats…</p>');
      let data;
      try { data = await load(S, days, gcT, ghT); }
      catch (e) { return bindConnect(connectBox(S, errorText(e))); }
      show(dashboard(S, ctx.posts, data));
      app.querySelectorAll('.ad-range').forEach((b) => b.addEventListener('click', () => { days = +b.dataset.days; run(); }));
      const out = app.querySelector('#ad-out');
      if (out) out.addEventListener('click', () => { store.set(KEY_GC, ''); store.set(KEY_GH, ''); run(); });
    };

    const bindConnect = (html) => {
      show(html);
      const f = app.querySelector('#ad-form');
      if (!f) return;
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        store.set(KEY_GC, f.querySelector('#ad-gc').value.trim());
        store.set(KEY_GH, f.querySelector('#ad-gh').value.trim());
        run();
      });
    };

    run();
  }

  window.BlogAdmin = { render };
})();
