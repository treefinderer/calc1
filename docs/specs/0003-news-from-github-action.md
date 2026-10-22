# 0003 News from a scheduled GitHub Action

## Request

> "Yes, write a spec for fetching the feeds with a scheduled GitHub Action and serving them from the site."

## Goal

The News section shows headlines again. A scheduled GitHub Action fetches the five feeds and publishes them as JSON files on the same site, so the page no longer depends on rss2json. This replaces the data source of [spec 0002](0002-newsfeed.md); everything else in 0002 (tabs, lazy load, cache, 15-minute refresh, 15 s timeout, states, plain-text and http(s)-only safety, keyboard and radio isolation) stays as is.

Why: since 2026-10-22 api.rss2json.com answers browsers with a Cloudflare bot challenge, so the page shows "Couldn't load the headlines." We do not try to get around that challenge.

## Scope

**In**
- `.github/workflows/pages.yml`, `scripts/fetch_news.py`, `tests/fixtures/sample-rss.xml`.
- `news.js` reads `news/<id>.json` (same origin, relative URL) instead of rss2json. Credit line text change.
- `tests/tests.js` news fixtures switch to the new JSON shape and URLs; `tests/run.sh` also runs the selftest.

**Out**
- Committing fetched files to the repo (the Action never commits). New feeds, more than 10 items, any change to tabs or layout, any key, server or proxy.

## Behavior

### Workflow `pages.yml`
- Triggers: `push` to `main`, `schedule` every 30 minutes (cron `7,37 * * * *`), `workflow_dispatch`.
- Permissions: `contents: read`, `pages: write`, `id-token: write`.
- Steps: checkout, `python3 scripts/fetch_news.py`, `actions/upload-pages-artifact`, `actions/deploy-pages`. The site (repo files plus generated `news/`) is what gets deployed.

### `scripts/fetch_news.py`
- Python 3 standard library only (urllib, xml.etree, json, html).
- Fetches the five feeds from 0002's table (same URLs) and writes `news/<id>.json` for `politics`, `technology`, `science`, `stocks`, `sports`.
- Shape: `{"source": "BBC News", "fetchedAt": "<ISO UTC>", "items": [{"title", "link", "pubDate" (ISO UTC), "summary" (plain text), "thumbnail" (https URL or null)}]}`. At most 10 items, in feed order.
- Thumbnail comes from `media:thumbnail`, else `media:content` (image), else an image `enclosure`; non-https gives null. Summary has HTML tags and entities removed.
- Failure of one feed: reuse that category's file from `https://treefinderer.github.io/calc1/news/<id>.json` if it can be downloaded; otherwise write `{"source": ..., "fetchedAt": ..., "items": [], "error": true}`. The job fails only if every feed failed and no previous copy was found.
- `--selftest`: parses `tests/fixtures/sample-rss.xml` offline, checks the output shape (keys, ISO dates, max 10, https-or-null thumbnails, plain-text summary), prints a result and exits 0/1. No network.

### `news.js`
- Request URL is `news/<id>.json` (relative, same origin, no query parameters). Failures are as in 0002 (network error, non-OK, not JSON, `items` not an array, timeout), plus `error: true`, which counts as an error. Zero usable items is the existing empty state.
- Field mapping: `title`, `link`, `pubDate` (already ISO UTC), `summary` (still inserted with `textContent`, still trimmed to about 200 characters), `thumbnail` (https only). "Updated HH:MM" uses `fetchedAt` (local time), falling back to the load time if it is missing.
- Credit line: "Headlines from BBC News, BBC Sport and CNBC." No link to or mention of rss2json remains in any file except `CHANGELOG.md` and old specs.
- The page never requests BBC or CNBC feed URLs directly.

### Release step (orchestrator tells the owner)
After merge, the owner must do once: GitHub, Settings, Pages, Build and deployment, Source: "GitHub Actions". Until then the old branch deploy is used and news stays broken (`news/*.json` are not in the repo). Then run the workflow once (Actions, pages, Run workflow) or wait for the next scheduled run (up to 30 minutes).

### Known limits
- Headlines are up to about 30 minutes old (more if GitHub delays a run). GitHub may delay scheduled runs, and disables schedules in repos with no activity for 60 days.

## Acceptance criteria

1. `pages.yml` has triggers `push` (branch `main`), `schedule` (cron every 30 minutes) and `workflow_dispatch`, and permissions exactly `contents: read`, `pages: write`, `id-token: write`.
2. `pages.yml` runs, in order: checkout, `python3 scripts/fetch_news.py`, `actions/upload-pages-artifact`, `actions/deploy-pages`, and contains no `git commit` or `git push`.
3. `python3 scripts/fetch_news.py --selftest` works offline, prints a pass line and exits 0; it exits 1 if the output shape is wrong.
4. `scripts/fetch_news.py` imports only the standard library and lists the five feed URLs from spec 0002 unchanged.
5. The selftest confirms for the sample feed: at most 10 items, `pubDate` in ISO UTC, summary free of tags and entities, thumbnail https or null, and thumbnails found from `media:thumbnail`, `media:content` and `enclosure`.
6. `tests/run.sh` runs the selftest and prints `RESULT: PASS n/n` with all earlier news checks still passing.
7. With mocked `news/<id>.json`, a fresh page load makes exactly one request, to `news/politics.json`; selecting each other tab requests `news/technology.json`, `news/science.json`, `news/stocks.json` or `news/sports.json` respectively.
8. With mocked JSON in the new shape, stories show headline link, source label, relative time, thumbnail and summary as in 0002; a `javascript:` link or non-https thumbnail is dropped.
9. A response of `{"items": [], "error": true}` shows "Couldn't load the headlines." with Try again; `{"items": []}` shows the empty message.
10. "Updated HH:MM" reflects `fetchedAt` from the response.
11. The credit line reads exactly "Headlines from BBC News, BBC Sport and CNBC." and `grep -ri rss2json` finds nothing in `index.html`, `news.js`, `style.css`, `calc.js`, `tests/` or the workflow and script.
12. After release, `curl -s https://treefinderer.github.io/calc1/news/politics.json` returns JSON with `items` of 1 to 10 entries and a `fetchedAt` less than about 1 hour old.

## Open questions

- Owner decided 2026-10-22: every 30 minutes.
