# Personal Blog & Profile Site

## 1. Extension Name & Purpose

**My Blog** is a static public website that doubles as a professional profile. It publishes posts in six categories: **Concepts**, **Issues**, **New Features**, **Code Bits**, **Full Solutions** and **Functional** topics. The About page lists skills and highlights so the site shows what you can do. No server, database or build step is needed.

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

Types: `concept` (how something works, explained simply), `issue`, `feature` (new platform features), `snippet`, `solution`, `functional` (finance and business-process topics).

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
- The site has no accounts or follower counter of its own. Comments use giscus (GitHub login), email subscribers live in your newsletter service, and following is via RSS, LinkedIn or GitHub. A built-in follower system would need a database and login service.
- No visitor analytics yet. A free tool such as GoatCounter can be added with one script tag.
- Posts must be re-indexed (`node tools/posts.js index`) after editing a post's header.
- Markdown is rendered as written. Only publish content you wrote yourself.

## 7. Change Log

| Date | Change |
|------|--------|
| 2026-10-19 | Initial version: home, post and about pages, search and filters, dark mode, post tool, 4 sample posts |
| 2026-10-19 | "Follow along" box (email subscribe form, RSS feed, LinkedIn/GitHub follow buttons) and automatic `feed.xml` generation |
| 2026-10-19 | Questions section under every post: giscus (GitHub Discussions) when configured in `config.js`, email / LinkedIn buttons otherwise |
| 2026-10-19 | About page rebuilt from resume: summary, stats, key highlights, experience timeline with client projects, grouped skills, certifications, education, Save as PDF |




{
        "slug": "2026-11-04-generate-gst-tax-rates-automatically",
        "title": "I stopped filling GST rates in Excel: generating thousands of GST tax rates in Business Central automatically",
        "date": "2026-11-04",
        "type": "solution",
        "tags": [
            "GST",
            "India",
            "Tax Engine",
            "AL",
            "Automation",
            "Business Central"
        ],
        "summary": "One HSN code can need over 100 GST rate lines in Business Central, and a company has hundreds of HSN codes. Instead of exporting to Excel, filling rows and importing back, I built a generator that creates every rate from data BC already has. Here's why I built it, how it works, why the duplicate check matters so much, and how you can build your own.",
        "readingTime": 16
    }

## Private analytics page

Open `#/admin` (for example `https://anilkcs001.github.io/#/admin`). It is not linked anywhere on the site.

1. In GoatCounter go to Settings, API, and create a token with **Read statistics** only.
2. Paste it into the Connect box. Optionally paste a GitHub token (public repositories, no extra permissions) to see comment counts per post.
3. The tokens are kept in your own browser only (localStorage). Use **Sign out** to remove them. Never put a token in the repo.

You see visitors per day, posts ranked by views, where visitors come from, countries, browsers, and a table of views and comments for every post. Views of the admin page are not counted.

This is not a password. The site is static, so anyone can open `#/admin`, but they only see the Connect box; the numbers stay behind GoatCounter's own login.

If the browser reports that GoatCounter could not be reached even with a correct token, GoatCounter is blocking its API from web pages. Tell Claude and a scheduled GitHub Action can fetch the stats into a file instead.

## Licence

- **Code** (`index.html`, `js/`, `css/`, `tools/`): MIT License, see [LICENSE](LICENSE).
- **Posts and images** (`posts/*.md`, `images/`): CC BY 4.0, see [LICENSE-CONTENT.md](LICENSE-CONTENT.md). Anyone may reuse them with credit and a link back.
- **CV** (`files/`): personal, not licensed for reuse.
