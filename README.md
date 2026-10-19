# Personal Blog & Profile Site

## 1. Extension Name & Purpose

**My Blog** is a static public website that doubles as a professional profile. It publishes one post a day in four categories: **Issues**, **New Features**, **Code Bits** and **Full Solutions**. The About page lists skills and highlights so the site shows what you can do. No server, database or build step is needed.

## 2. Object List

| ID | Type | Name |
|----|------|------|
| 1 | Page | `index.html` (app shell) |
| 2 | Config | `js/config.js` (your name, bio, links, skills) |
| 3 | Script | `js/app.js` (router, home, post, about, search, code copy) |
| 4 | Stylesheet | `css/style.css` (light/dark theme, layout) |
| 5 | Tool | `tools/posts.js` (create posts, rebuild index) |
| 6 | Data | `posts/posts.json` (generated post index) |
| 7 | Content | `posts/*.md` (one Markdown file per post) |
| 8 | Marker | `.nojekyll` (tells GitHub Pages to serve files as-is) |

## 3. Dependencies

- **Node.js 16+** (only for `tools/posts.js` on your computer)
- **GitHub account** for free hosting with GitHub Pages (any static host also works)
- Loaded from CDN at runtime: `marked` (Markdown), `highlight.js` (code colouring), Google Fonts
- No Azure services or other extensions

## 4. Setup Steps

1. **Personalise:** open `js/config.js` and set your name, role, bio, links and skills. Also change the `<title>` in `index.html`.
2. **Preview locally:** run `npx serve` (or `python -m http.server`) in this folder and open the address shown. Opening `index.html` by double-click will not work because the browser blocks `fetch` on local files.
3. **Publish:** create a GitHub repository, push this folder, then go to *Settings → Pages* and choose the `main` branch, root folder. Your site goes live at `https://<username>.github.io/<repo>/`. Name the repo `<username>.github.io` to get the shorter address.
4. **Custom domain (optional):** add it in *Settings → Pages* and point a CNAME record at `<username>.github.io`.
5. **Delete the 4 sample posts** in `posts/` once you write your own, then run `node tools/posts.js index`.

### Daily routine

```bash
node tools/posts.js new "Fix for X error in posted sales invoice" --type issue --tags "AL, Sales"
# edit the generated file in posts/, then:
node tools/posts.js index
git add . && git commit -m "Post: Fix for X error" && git push
```

Types: `issue`, `feature`, `snippet`, `solution`.

Post front matter looks like this:

```
---
title: My title
date: 2026-10-19
type: snippet
tags: AL, Reports
summary: One sentence shown on the post card.
---
```

Code blocks tagged `al` are coloured using the Delphi/Pascal grammar, the closest match available in highlight.js.

## 5. Key Logic Explanation

- **Routing:** the site is one HTML page. The part of the address after `#` decides what shows: `#/` is the post list, `#/post/<file-name>` is a post, `#/about` is the profile. This works on any static host with no server rules.
- **Post list:** `tools/posts.js index` reads the header of every Markdown file in `posts/` and writes `posts/posts.json`. The browser loads that one small file to build the list, filters and search.
- **Reading a post:** when you open a post, the browser downloads its `.md` file, removes the header, converts it to HTML with `marked`, then adds colouring and a Copy button to every code block.
- **Theme:** follows the visitor's system setting, and the ◐ button overrides it and remembers the choice.

## 6. Known Limitations

- Because pages use `#` routes, individual posts are not indexed as separate pages by search engines as well as normal URLs would be. If search traffic matters later, move to a static site generator such as Eleventy or Astro; your Markdown posts carry over unchanged.
- No comments, RSS feed or analytics yet. Comments can be added with a free tool such as giscus; a feed can be generated from `posts.json`.
- Posts must be re-indexed (`node tools/posts.js index`) after editing a post's header.
- Markdown is rendered as written. Only publish content you wrote yourself.

## 7. Change Log

| Date | Change |
|------|--------|
| 2026-10-19 | Initial version: home, post and about pages, search and filters, dark mode, post tool, 4 sample posts |
