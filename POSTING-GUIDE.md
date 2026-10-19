# How to Publish Posts (Daily Guide)

Use this guide every time you add a post. Publishing one or several posts a day takes about two minutes of tooling once the writing is done.

> This file sits in the site root, not in `posts/`, so it is never published as a post.

---

## 1. The 5-step daily routine

```bash
# 1. Create the post file (repeat for each post you write today)
node tools/posts.js new "Your post title" --type issue --tags "AL, Reports"

# 2. Open the new file in posts/ and write the content

# 3. Rebuild the post list
node tools/posts.js index

# 4. Preview locally (optional but recommended)
npx serve

# 5. Publish
git add .
git commit -m "Post: Your post title"
git push
```

The site updates one to two minutes after `git push`.

If you post on Netlify Drop instead of GitHub, do steps 1 to 4, then drag the whole folder onto the Deploys page.

---

## 2. Several posts in one day

- Run the `new` command once per post. Each gets its own file, for example `2026-10-19-first-title.md` and `2026-10-19-second-title.md`.
- Use a **different title** for each post. Two posts with the same title on the same day would have the same file name.
- Run `node tools/posts.js index` **once** after you finish writing all of them, then commit and push together. You can also commit each post separately if you prefer.
- Posts with the same date are listed in file-name order, so the home page order stays consistent.

---

## 3. The four post types

| Type | Use it for | Command |
|------|------------|---------|
| `issue` | A real problem and its fix | `--type issue` |
| `feature` | A new platform feature explained with an example | `--type feature` |
| `snippet` | A short code bit worth keeping | `--type snippet` |
| `solution` | A complete, working solution with full code | `--type solution` |

If you leave out `--type`, the post defaults to `snippet`.

---

## 4. The header (front matter)

Every post starts with this block. The `new` command writes it for you.

```
---
title: Why exit doesn't skip a record in a report
date: 2026-10-19
type: issue
tags: AL, Reports
summary: One sentence that shows on the post card.
---
```

| Field | Rule |
|-------|------|
| `title` | The post heading. A colon inside the title is fine. |
| `date` | `YYYY-MM-DD`. It decides the order on the home page. |
| `type` | Exactly one of `issue`, `feature`, `snippet`, `solution` |
| `tags` | Comma-separated, short, for example `AL, GST, Permissions` |
| `summary` | One sentence. It shows on the home page card and is searchable. |

Keep each header value on a single line, with no line breaks.

---

## 5. Templates by type

The `new` command creates these for you. They are shown here so you know what to write under each heading.

### Issue

````
## The problem
What did you see? Paste the exact error message or describe the symptom.

## Why it happens
The root cause in plain words.

## The fix
```al
// the corrected code
```

## Takeaway
One sentence to remember next time.
````

### New feature

````
## What's new
Describe the feature and the version where it arrived.

## Why it matters
Who benefits and what it replaces.

## How to use it
```al
// minimal working example
```

## Gotchas
Anything that surprised you.
````

### Code bit

````
## The problem
One line on when you need this.

## The snippet
```al
// your code bit
```

## How it works
Short explanation.
````

### Full solution

````
## Requirement
What the solution has to do.

## Approach
Why this design, in a few sentences.

## Full code
```al
// full object(s)
```

## Setup
Steps to deploy or test it.

## Notes
Limitations and ideas for improvement.
````

---

## 6. Writing tips

**Code blocks.** Put the language after the opening backticks: `al`, `json`, `xml`, `javascript`, `bash`. Every block gets a Copy button automatically.

**Other formatting.**
- `## Heading` for sections, `### Heading` for sub-sections
- `**bold**` for emphasis and `` `code` `` for names inside a sentence
- `> note` for a warning or tip
- Tables with `|` columns
- Images: put the file in a new `images/` folder and add `![description](images/name.png)`

**Before you publish, check that:**
- The title says what the post solves, and an error message appears early if it is an issue post.
- The code runs and follows your AL standards (`CurrReport.Skip()` in report triggers, `Commit()` every 100 records with `mod`, a prefix on objects, permission set included).
- Customer names, amounts, keys and secrets are replaced with placeholders. Never publish real client data.
- The `summary` is one clear sentence.

---

## 7. Common problems

| Problem | Fix |
|---------|-----|
| New post is missing from the site | Run `node tools/posts.js index`, then commit and push `posts/posts.json` too |
| "Already exists" error | A post with the same title was created today. Use a different title |
| Post shows the wrong type badge | Check the `type:` line is exactly `issue`, `feature`, `snippet` or `solution` |
| Changed a title or tag, but the card still shows the old one | Run `node tools/posts.js index` again after editing a header |
| Site loads but shows "Could not load posts" locally | Use `npx serve` or `python -m http.server`. Do not double-click `index.html` |
| Update is not live yet | Wait one to two minutes, then hard refresh with Ctrl+F5 |
| `git push` is rejected | Run `git pull --rebase`, then push again |

---

## 8. Let followers ask questions (one-time setup)

Every post has a "Have a question?" section at the bottom. Out of the box it shows **Ask by email** and **Message on LinkedIn** buttons. To get a real discussion thread under each post, turn on giscus. It is free and stores questions as GitHub Discussions in your own repo. Visitors need a GitHub account to comment.

1. Your repository must be **public**.
2. In the repo, open **Settings → General → Features** and tick **Discussions**.
3. Install the giscus app on that repo: https://github.com/apps/giscus
4. Open https://giscus.app, enter your repo name (for example `yourusername/yourusername.github.io`), and pick the **Q&A** category.
5. Scroll to the "Enable giscus" box on that page. Copy the values of `data-repo-id` and `data-category-id`.
6. Paste them into `js/config.js`:

```js
comments: {
  repo: 'yourusername/yourusername.github.io',
  repoId: 'R_kgDO...',
  category: 'Q&A',
  categoryId: 'DIC_kwDO...'
},
```

7. Commit and push. Each post now has its own thread, matched by the post's file name.

To answer a question, open the **Discussions** tab of your repo, or reply right under the post. GitHub emails you when someone posts.

---

## 9. Ideas bank (when you are stuck for a topic)

- An error you fixed today and how you found the cause
- A new Business Central release feature you tested
- A report, API or integration pattern you reused
- A GST or India-localization setup you worked out
- A Power Automate, SharePoint or Graph API step that was tricky
- A before/after of a performance fix
- A small utility procedure you copy into every project
- A Copilot or Azure OpenAI experiment and what worked

Keep a running list of topics in a notes file so you never start the day without one.
