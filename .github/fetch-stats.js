// Runs in GitHub Actions. Reads stats from GoatCounter and comment counts from
// GitHub Discussions, and writes data/stats.json for the #/admin page.
// Needs the repository secret GOATCOUNTER_TOKEN (Read statistics only).
const fs = require('fs');

const CODE = process.env.GOATCOUNTER_CODE || 'anilkcs001';
const TOKEN = process.env.GOATCOUNTER_TOKEN;
const GH = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || 'anilkcs001/anilkcs001.github.io';
const CATEGORY_ID = process.env.DISCUSSION_CATEGORY_ID || 'DIC_kwDOVPCHjc4DJq1g';

if (!TOKEN) { console.error('GOATCOUNTER_TOKEN secret is missing'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.toISOString().slice(0, 13) + ':00:00Z';

async function gc(path, params) {
  const url = `https://${CODE}.goatcounter.com/api/v0/${path}?` + new URLSearchParams(params);
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } });
    if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    await sleep(400); // stay under GoatCounter's rate limit
    return r.json();
  }
  throw new Error(path + ': rate limited');
}

async function comments() {
  if (!GH) return null;
  const [owner, name] = REPO.split('/');
  const query = `query($o:String!,$n:String!,$c:ID){repository(owner:$o,name:$n){
    discussions(first:100,categoryId:$c,orderBy:{field:CREATED_AT,direction:DESC}){
      nodes{title url comments(first:100){totalCount nodes{replies{totalCount}}}}}}}`;
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + GH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { o: owner, n: name, c: CATEGORY_ID } })
  });
  const j = await r.json();
  if (!r.ok || j.errors || !j.data) throw new Error('GitHub: ' + (j.message || JSON.stringify(j.errors || j).slice(0, 200)));
  const out = {};
  j.data.repository.discussions.nodes.forEach((d) => {
    const replies = d.comments.nodes.reduce((a, c) => a + (c.replies ? c.replies.totalCount : 0), 0);
    out[d.title] = { count: d.comments.totalCount + replies, url: d.url };
  });
  return out;
}

(async () => {
  const end = new Date(); end.setMinutes(0, 0, 0); end.setHours(end.getHours() + 1);
  const result = { generated: new Date().toISOString(), ranges: {}, comments: null };

  for (const days of [7, 30, 90]) {
    const range = { start: iso(new Date(end.getTime() - days * 86400000)), end: iso(end) };
    const part = {};
    part.total = await gc('stats/total', range);
    part.hits = await gc('stats/hits', { ...range, limit: 100 });
    for (const [key, page] of [['refs', 'toprefs'], ['places', 'locations'], ['browsers', 'browsers']]) {
      try { part[key] = await gc('stats/' + page, { ...range, limit: 8 }); } catch (e) { console.warn(e.message); part[key] = null; }
    }
    result.ranges[days] = part;
    console.log('fetched', days, 'days');
  }

  try { result.comments = await comments(); } catch (e) { console.warn(e.message); }

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/stats.json', JSON.stringify(result));
  console.log('wrote data/stats.json');
})().catch((e) => { console.error(e.message); process.exit(1); });
