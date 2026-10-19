#!/usr/bin/env node
/*
 * Post helper. No dependencies, needs Node 16+.
 *
 *   node tools/posts.js new "Post title" --type snippet --tags "AL, Reports"
 *   node tools/posts.js index
 *
 * Types: issue | feature | snippet | solution
 */
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const TYPES = ['issue', 'feature', 'snippet', 'solution'];

const TEMPLATES = {
  issue: `## The problem

What did you see? Include the exact error message or symptom.

## Why it happens

The root cause in plain words.

## The fix

\`\`\`al
// the corrected code
\`\`\`

## Takeaway

One sentence to remember next time.
`,
  feature: `## What's new

Describe the feature and the version it arrived in.

## Why it matters

Who benefits and what it replaces.

## How to use it

\`\`\`al
// minimal example
\`\`\`

## Gotchas

Anything that surprised you.
`,
  snippet: `## The problem

One line on when you need this.

## The snippet

\`\`\`al
// your code bit
\`\`\`

## How it works

Short explanation.
`,
  solution: `## Requirement

What the solution has to do.

## Approach

Why this design, in a few sentences.

## Full code

\`\`\`al
// full object(s)
\`\`\`

## Setup

Steps to deploy or test it.

## Notes

Limitations and ideas for improvement.
`
};

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

function today() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function parseFrontMatter(txt) {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: txt };
  const meta = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return { meta, body: m[2] };
}

function buildIndex() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const posts = files.map((file) => {
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'));
    const type = TYPES.includes(meta.type) ? meta.type : 'snippet';
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title || file,
      date: meta.date || today(),
      type,
      tags: (meta.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      summary: meta.summary || '',
      readingTime: Math.max(1, Math.round(words / 200))
    };
  });
  posts.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));
  fs.writeFileSync(path.join(POSTS_DIR, 'posts.json'), JSON.stringify(posts, null, 2) + '\n');
  console.log(`posts.json rebuilt: ${posts.length} post(s)`);
}

function newPost(args) {
  const title = args.find((a) => !a.startsWith('--'));
  const opt = (name, fallback) => {
    const i = args.indexOf('--' + name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  if (!title) {
    console.error('Usage: node tools/posts.js new "Title" --type issue|feature|snippet|solution --tags "a, b"');
    process.exit(1);
  }
  const type = opt('type', 'snippet');
  if (!TYPES.includes(type)) {
    console.error(`Unknown type "${type}". Use one of: ${TYPES.join(', ')}`);
    process.exit(1);
  }
  const date = today();
  const file = `${date}-${slugify(title)}.md`;
  const full = path.join(POSTS_DIR, file);
  if (fs.existsSync(full)) {
    console.error(`Already exists: posts/${file}`);
    process.exit(1);
  }
  const front =
    `---\ntitle: ${title}\ndate: ${date}\ntype: ${type}\n` +
    `tags: ${opt('tags', '')}\nsummary: One sentence that shows on the post card.\n---\n\n`;
  fs.writeFileSync(full, front + TEMPLATES[type]);
  buildIndex();
  console.log(`Created posts/${file}\nEdit it, then run: node tools/posts.js index`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'new') newPost(rest);
else if (cmd === 'index') buildIndex();
else console.log('Commands:\n  new "Title" --type <type> --tags "a, b"\n  index');
