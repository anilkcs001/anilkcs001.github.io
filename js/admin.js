/* Analytics page at #/admin. Not linked anywhere.
   GoatCounter does not allow its API to be called from web pages, so a GitHub
   Action (.github/workflows/stats.yml) fetches the numbers every few hours and
   saves them in data/stats.json. This page only reads that file. */
(() => {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n) => Number(n || 0).toLocaleString('en-IN');

  /* ---------- Data ---------- */

  async function load(days) {
    const r = await fetch('data/stats.json?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) { const e = new Error('missing'); e.kind = 'missing'; throw e; }
    const j = await r.json();
    const part = j.ranges && j.ranges[days];
    if (!part) { const e = new Error('range'); e.kind = 'missing'; throw e; }
    return Object.assign({}, part, { comments: j.comments || null, commentsError: '', days, generated: j.generated });
  }

  function ago(iso) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!(m >= 0)) return '';
    if (m < 2) return 'just now';
    if (m < 90) return m + ' minutes ago';
    const h = Math.round(m / 60);
    return h < 48 ? h + ' hours ago' : Math.round(h / 24) + ' days ago';
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

  function setupBox(msg) {
    return `<section class="ad-box">
      <h1>Admin</h1>
      ${msg ? `<p class="ad-msg">${msg}</p>` : ''}
      <p class="muted">There are no stats yet. To switch this page on:</p>
      <ol class="ad-steps">
        <li>In GoatCounter, open your username menu → <b>API</b> and create a token with <b>Read statistics</b> only.</li>
        <li>In your GitHub repository go to Settings → Secrets and variables → Actions → <b>New repository secret</b>. Name it <code>GOATCOUNTER_TOKEN</code> and paste the token.</li>
        <li>Open the <b>Actions</b> tab → <b>Update blog stats</b> → <b>Run workflow</b>.</li>
      </ol>
      <p class="muted ad-help">After that the numbers refresh by themselves every 3 hours.</p>
    </section>`;
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
        <div><h1>Admin</h1><p class="muted">Last ${d.days} days · updated ${esc(ago(d.generated))}</p></div>
        <div class="ad-actions"><div class="ad-ranges">${rangeBtns}</div></div>
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
        ${d.comments ? '' : '<p class="muted">Comment counts were not available in the last update.</p>'}
        <div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Post</th><th class="n">Views</th><th class="n">Comments</th></tr></thead><tbody>
        ${list.map((r) => `<tr><td><a href="#/post/${encodeURIComponent(r.slug)}">${esc(r.title)}</a></td>
          <td class="n">${nf(r.views)}</td>
          <td class="n">${r.comments == null ? '—' : (r.curl && r.comments ? `<a href="${esc(r.curl)}" target="_blank" rel="noopener">${nf(r.comments)}</a>` : nf(r.comments))}</td></tr>`).join('')}
        </tbody></table></div>
      </section>`;
  }

  async function render(app, ctx) {
    let days = 30;
    const show = (html) => { app.innerHTML = '<div class="ad">' + html + '</div>'; };
    const run = async () => {
      let data;
      try { data = await load(days); }
      catch (e) { return show(setupBox('')); }
      show(dashboard(ctx.S, ctx.posts, data));
      app.querySelectorAll('.ad-range').forEach((b) => b.addEventListener('click', () => { days = +b.dataset.days; run(); }));
    };
    show('<p class="muted ad-loading">Loading your stats…</p>');
    run();
  }

  window.BlogAdmin = { render };
})();
