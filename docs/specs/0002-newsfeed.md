# 0002 Newsfeed

## Request

> "new PR: i want to add newsfeed at the bottom of the page, below the calculator. Newsfeed should allow selecting the categories of news from Politics, Technology, Science, Stock Market, Sports. Create a separate tab for every news category."

## Goal

A "News" section at the bottom of the page shows current headlines. It has one tab for each of five categories (Politics, Technology, Science, Stock Market, Sports), and the visitor switches between them to read that category's latest stories. Each headline opens the full article on the publisher's site.

## Owner decisions

- **"Allow selecting the categories" means switching between the category tabs.** All five tabs are always shown. There is no control for choosing which categories to follow.
- **Politics shows world news, not UK politics.** The Politics tab uses BBC World News (`https://feeds.bbci.co.uk/news/world/rss.xml`). This is general world news, but it is mostly politics and conflict. The tab label stays "Politics" and its source label stays "BBC News". Politico Europe (`https://www.politico.eu/feed/`) was considered and rejected: some of its items are in French and it has no thumbnails.
- **rss2json is accepted as the data source.** rss2json.com turns public RSS feeds into JSON that the browser can fetch. It works from a static site with no key and no server of our own. Direct news APIs were tested from the live site and failed: The Guardian's shared test key is rejected, GDELT and Reddit block requests from other sites, and Hacker News only covers technology. The owner accepts the free tier's limits (see Known limits).
- **CNBC Investing is accepted for Stock Market**, even though its items may have no thumbnails.
- **The credit line reads "Headlines from BBC News, BBC Sport and CNBC, converted by rss2json."** The Sports tab is labelled "BBC Sport", which is the feed's real source.

## Other decisions in this spec

- **Placement.** The News section goes after the keyboard-shortcuts line, as the last thing on the page. The shortcuts line describes the calculator, so it stays right under the workspace. The news is a separate, page-wide section, so it comes last.
- **Feeds per category:**

  | Tab | Feed URL | Source label |
  |-----|----------|--------------|
  | Politics | `https://feeds.bbci.co.uk/news/world/rss.xml` | BBC News |
  | Technology | `https://feeds.bbci.co.uk/news/technology/rss.xml` | BBC News |
  | Science | `https://feeds.bbci.co.uk/news/science_and_environment/rss.xml` | BBC News |
  | Stock Market | `https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069` | CNBC |
  | Sports | `https://feeds.bbci.co.uk/sport/rss.xml` | BBC Sport |

- **Default tab.** Politics on a first visit. After that, the last tab the visitor chose.
- **Tabs that don't fit on a phone** wrap onto a second row. Every tab stays visible without scrolling.

## Scope

**In**

- A new `<section class="news" id="news" aria-labelledby="newsTitle">` placed after `.shortcuts` inside `.page`, with an `<h2 id="newsTitle">` reading "News".
- Five tabs using the ARIA tabs pattern, one tab panel per category.
- For each story: headline link, source label, relative time, an optional thumbnail and a short plain-text summary. Up to 10 stories per category.
- Each category loads the first time its tab is shown, is kept in memory for the page session, and refreshes every 15 minutes while its tab is the one showing.
- The last chosen tab is remembered in `localStorage`.
- Loading, error (with Try again), stale-after-failed-refresh and empty states.
- A credit line under the stories.
- Small changes to the existing calculator keyboard handler and radio `autoStart` handler so they ignore events inside the News section.

**Out**

- Choosing which categories to follow, or hiding and reordering tabs.
- Searching news, more than 10 stories, "load more", pagination, or reading articles inside the page.
- Any API key, server, proxy, new library, framework, `<script src>` or stylesheet.
- Showing any HTML from the feeds. Feed text is shown as plain text only.
- Sources other than the five feeds above.
- Changes to the calculator maths, the tape, the weather panel or the radio's behavior, except for the keyboard and radio rules in Behavior.
- Sound of any kind. Nothing in the News section plays audio.

## Behavior

### Layout

- The News section is a full-width block inside `.page` (so up to 1200px wide), after `.shortcuts`. Its panel style matches the page's desk/paper look: a rounded panel using existing tokens such as `--paper` or `--body` and the existing fonts. The heading uses the same small uppercase style as the "Tape" and "Weather" headings.
- **Tab bar:** a row of five tab buttons under the heading. When the tabs don't fit on one line (for example at 375px), they wrap onto further rows. The tab bar never makes the page scroll sideways.
- **Story list:** two columns above 720px and one column at 720px and below. Each story is a row: a thumbnail (if any) on the left, and the text on the right.
- **Thumbnails** have a fixed box (about 112x72px above 720px and about 88x56px at 720px and below), with `object-fit: cover` and rounded corners. They reserve that space before the image loads, so the layout does not jump. A story without a thumbnail uses the full width for its text.
- Long headlines, summaries and unbroken strings wrap (`overflow-wrap: anywhere`). Nothing in the section causes a horizontal scrollbar at 375px in any state.
- Every new color is a CSS token defined on `:root` and in both dark-mode blocks (`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`). Reusing existing tokens is preferred. Fonts are the existing Google Fonts stacks.

### Tabs (ARIA pattern)

- The container has `role="tablist"` and `aria-label="News categories"`. Each tab is a `<button role="tab">` with `id`, `aria-controls` pointing to its panel, and `aria-selected="true"` or `"false"`. Each panel has `role="tabpanel"`, `aria-labelledby` pointing to its tab, and `tabindex="0"`. Panels that aren't selected are `hidden`.
- Tab order is Politics, Technology, Science, Stock Market, Sports.
- Roving tabindex: the selected tab has `tabindex="0"` and the others have `tabindex="-1"`, so Tab enters the tab bar once and the next Tab moves into the selected panel.
- Keyboard, with focus on a tab:
  - Right Arrow moves focus to the next tab and selects it. From Sports it wraps to Politics.
  - Left Arrow moves to the previous tab and selects it. From Politics it wraps to Sports.
  - Home selects the first tab (Politics). End selects the last tab (Sports).
  - Enter and Space select the focused tab. This is already true, because selection follows focus.
  - These keys call `preventDefault()` so the page does not scroll, and they never reach the calculator.
- Mouse/touch: clicking or tapping a tab selects it.
- The selected tab looks clearly different, and not only by color. For example, it uses the filled `--key-op` style with bold text, like the weather unit toggle. Each tab shows a visible `--accent` focus outline when focused with the keyboard (`:focus-visible`).

### Remembering the tab

- Selecting a tab stores its id in `localStorage` under `tally-news-tab-v1`, as one of `"politics"`, `"technology"`, `"science"`, `"stocks"`, `"sports"` (stored as a JSON string).
- On page load, a stored valid id selects that tab. A missing, unknown or unreadable value means Politics.
- All `localStorage` reads and writes are wrapped in `try/catch`. If storage throws, the tabs still work for this page view, with no visible message and no uncaught error.

### Loading and caching

- Request URL: `https://api.rss2json.com/v1/api.json?rss_url=` + `encodeURIComponent(feedUrl)`. No other parameters, and no API key.
- **Lazy loading.** On page load, only the selected tab's feed is requested. Each other category is requested the first time its tab is selected. A fresh page load with no tab clicks makes exactly one rss2json request.
- **Session cache.** A category's stories stay in memory after loading. Going back to a tab shows its stories straight away with no new request, unless they are 15 minutes old or older. In that case the cached stories stay visible while a refresh runs in the background.
- **Refresh.** While a tab is selected, its feed is fetched again every 15 minutes. Only one refresh timer runs at a time, and selecting another tab resets it for the new tab. Hidden tabs are not refreshed.
- **In-flight requests.** There is at most one request per category at a time. If a category is already loading, selecting its tab again does not start another request. A reply that comes back after the visitor has switched tabs still fills that category's cache, but only the selected tab's panel is redrawn.
- **Timeout.** If a request has not finished after 15 seconds, it counts as a failure. This must hold even if the `fetch` promise never settles: use a timer that marks the failure itself, not only an `AbortController`. Any late reply after the timeout is ignored.
- **What counts as a failure:** a network error, a non-OK HTTP status, a reply that isn't JSON, `status` other than `"ok"`, an `items` value that isn't an array, or the timeout.

### Story content

From each entry in `items` (in feed order, up to 10 shown):

- **Headline:** `title`, shown as plain text. It is an `<a>` to `link`, with `target="_blank"` and `rel="noopener"`. Only `http:` and `https:` links are allowed: parse with `new URL()` and check the protocol. An item with no title (after trimming) or no valid http(s) link is skipped.
- **Source label:** fixed per category, from the feeds table (BBC News, CNBC or BBC Sport). It is not taken from the feed.
- **Relative time:** from `pubDate`, read as UTC (`"YYYY-MM-DD HH:MM:SS"` means `YYYY-MM-DDTHH:MM:SSZ`). Shown in a `<time>` element whose `datetime` attribute is the ISO UTC time:
  - under 1 minute old, or in the future: "Just now"
  - under 60 minutes: "N min ago"
  - under 24 hours: "N h ago" (whole hours, rounded down)
  - otherwise: "N d ago"
  - If `pubDate` is missing or can't be parsed, the time is left out.
  - Relative times are recalculated whenever the panel is redrawn (when it is shown, refreshed, or switched to).
- **Thumbnail (optional):** use `thumbnail` if it is a non-empty `https:` URL. Otherwise use `enclosure.link` if it is an `https:` URL and `enclosure.type` starts with `image/`. Otherwise show no image. The `<img>` has `alt=""` (the headline carries the meaning), `loading="lazy"`, `decoding="async"` and `referrerpolicy="no-referrer"`. If the image fails to load, it is removed and the text takes the full width.
- **Summary:** `description` is HTML from a third party. It is turned into plain text with an inert parser, for example `new DOMParser().parseFromString(html, "text/html").body.textContent`. **Do not** assign it to `innerHTML` of any element in the live document, even a detached one, because that can load images and run `onerror` handlers. Collapse runs of whitespace, trim, and cut to about 200 characters at a word boundary with a trailing "…". Leave the summary out if it is empty or the same as the headline. Insert it with `textContent`.
- All feed text goes in through `textContent` or attributes. No feed value is ever inserted as HTML.

### States (per category panel)

- **Loading (nothing cached yet):** "Loading headlines…" with the same blinking-dot style as the weather's loading line (the animation stops under `prefers-reduced-motion: reduce`). The panel has `aria-busy="true"` while loading.
- **Loaded:** the story list, then a small line "Updated HH:MM" (visitor's local time of the last successful fetch).
- **Empty:** the request succeeded but no usable items remain after filtering. Show "No stories in this category right now." with a **Try again** button.
- **Error (nothing cached):** "Couldn't load the headlines." with a **Try again** button that requests that category again and shows the loading state.
- **Refresh failure with stories showing:** keep the stories and show "Couldn't update. Showing headlines from HH:MM." The next 15-minute refresh tries again.
- When a refresh succeeds, the stale message goes away and "Updated HH:MM" changes.
- A polite live region inside the section announces only the error and empty messages, not every load, so screen readers aren't flooded.

### Credit line

- Under the panels, in small muted text: "Headlines from BBC News, BBC Sport and CNBC, converted by rss2json." "rss2json" may be a link to `https://rss2json.com/` with `target="_blank" rel="noopener"`.

### Keyboard isolation and the calculator

- The document-level calculator `keydown` handler ignores every key event whose target is inside `#news`, the same way it ignores `#weather`. Two things follow:
  - Enter on a focused headline link opens the article and does not trigger `=`.
  - Enter, Space, arrows, Home and End on tabs, links and Try again buttons only act on those controls.
- Once focus leaves the News section (for example, the visitor clicks a calculator key), calculator shortcuts work as before.
- Tab order: the News section comes after the shortcuts line, which is after the workspace. Inside the section the order is: selected tab, then the panel, then the links and buttons inside the panel, then the credit link.

### Radio

- The radio's capture-phase `autoStart` handler skips click, keydown and touchend events whose target is inside `#news`, as it does for `#weather`. Clicking a tab, a headline or Try again, or pressing keys in the News section, does not start the radio.
- Nothing plays before a click or key press. The News section never plays sound. Interacting with the calculator still starts the radio exactly as today.

### Dark mode and motion

- In both themes, all text, tabs (selected, unselected and focused), links (including visited), the summary, time, error, empty and stale messages and the Try again button are clearly readable against their backgrounds.
- Headline links are visibly links (for example, underlined on hover and focus), with link colors as tokens.
- The loading animation is disabled under `prefers-reduced-motion: reduce`.

### Network hosts

- The only new hosts contacted are `api.rss2json.com` and the image hosts in the feeds' thumbnail URLs (for example `ichef.bbci.co.uk`). The page never requests the BBC or CNBC feed URLs directly.

### Known limits (accepted by the owner)

- rss2json's free tier has daily request limits and caches each feed for a while, so headlines can lag the source by some minutes. If the limit is reached, or the service is down, visitors see the error state.
- The Politics tab shows BBC World News. It is general world news, mostly politics and conflict, so some stories may be on other topics.
- CNBC Investing items may have no thumbnails.

## Acceptance criteria

Setup notes for the tester:
- "First visit" means `localStorage` key `tally-news-tab-v1` is absent. Clear it in DevTools or use a private window.
- To simulate failures, wrap `fetch` in the DevTools console before acting, as in spec 0001's QA. Keep the original with `const _f = window.fetch;`, then for example:
  - network error: `window.fetch = (u, o) => String(u).includes("rss2json") ? Promise.reject(new TypeError("offline")) : _f(u, o);`
  - service error: `... ? Promise.resolve(new Response(JSON.stringify({status:"error", message:"limit"}))) : ...`
  - empty feed: `... ? Promise.resolve(new Response(JSON.stringify({status:"ok", feed:{}, items:[]}))) : ...`
  - hang: `... ? new Promise(() => {}) : ...`
  - Restore with `window.fetch = _f;`.
- The wrap affects requests made after it, so set it up and then trigger the request (Try again, a not-yet-loaded tab, or the refresh timer).

**Placement and layout**

1. The News section, headed "News", is the last section on the page, below the keyboard-shortcuts line, which is below the weather, calculator and tape.
2. The section shows five tabs in this order: Politics, Technology, Science, Stock Market, Sports.
3. At 1280px wide, the stories of the selected tab are laid out in two columns. At 720px wide and below, they are in one column.
4. At 375px wide, all five tabs are visible without scrolling (wrapping onto more than one row is fine), and the page has no horizontal scrollbar with any tab selected.
5. At 375px wide, in the loading, error and empty states, there is still no horizontal scrollbar.

**Tabs and keyboard**

6. In DevTools, the tab container has `role="tablist"`, each tab has `role="tab"` with `aria-controls` naming a panel with `role="tabpanel"`, and only the selected tab has `aria-selected="true"`.
7. Only the selected tab has `tabindex="0"`; the other four have `tabindex="-1"`.
8. On a first visit, Politics is selected.
9. With focus on the Politics tab, pressing Right Arrow selects and focuses Technology, and Left Arrow selects and focuses Politics again.
10. With focus on Sports, Right Arrow selects Politics. With focus on Politics, Left Arrow selects Sports.
11. With focus on any tab, Home selects Politics and End selects Sports.
12. With the calculator showing 0, focusing a tab and pressing Left, Right, Home, End, Enter and Space leaves the calculator display at 0 and adds nothing to the tape. The page does not scroll sideways.
13. Clicking a tab with the mouse selects it and shows its panel. The other panels are hidden.
14. The selected tab looks clearly different from the others (fill plus bold text, not color alone), and each tab focused by keyboard shows a visible outline.

**Remembering the tab**

15. After selecting Science and reloading, Science is selected, and `localStorage` key `tally-news-tab-v1` holds `"science"`.
16. If `tally-news-tab-v1` is set by hand to `not json` or `"weather"`, reloading selects Politics and the console shows no uncaught error.
17. With `Storage.prototype.setItem` and `Storage.prototype.getItem` overridden in DevTools to throw, then reloading, the tabs still switch and load stories, and the console shows no uncaught error.

**Loading and caching**

18. On a fresh first-visit load with no clicks, the Network panel shows exactly one request to `api.rss2json.com`, and its `rss_url` is the encoded BBC World News feed URL (`https://feeds.bbci.co.uk/news/world/rss.xml`).
19. Selecting Technology for the first time sends one request for the BBC Technology feed. Selecting Politics and then Technology again within 15 minutes sends no further requests.
20. Each tab's request uses the feed from the table: Politics gets the BBC World News feed (`news/world/rss.xml`, not `news/politics`), Science the BBC science_and_environment feed, Stock Market the CNBC feed (`id=15839069`), and Sports the BBC sport feed.
21. With a tab selected and left open, a new request for that tab's feed appears about 15 minutes after the previous one, and its "Updated HH:MM" time changes. No request is made for the tabs that aren't selected.
22. No request goes directly to `feeds.bbci.co.uk` or `search.cnbc.com`. The only new hosts in the Network panel are `api.rss2json.com` and image hosts used by thumbnails.

**Story content**

23. A loaded tab shows at most 10 stories, each with a headline, a source label (BBC News for Politics, Technology and Science; CNBC for Stock Market; BBC Sport for Sports) and a relative time such as "2 h ago".
24. Each headline is a link with `target="_blank"` and `rel` containing `noopener`, and clicking it opens the article in a new tab.
25. For a story, the `<time>` element's `datetime` matches its `pubDate` from the response read as UTC, and the text matches the age rule ("N min ago" under an hour, "N h ago" under a day, "N d ago" otherwise).
26. BBC stories that have a `thumbnail` in the response show an image with `alt=""` and `loading="lazy"`. Stories without a usable https image show no image and no empty image box.
27. Summaries are plain text with no HTML tags or entities visible, and are at most about 200 characters, ending in "…" when cut.
28. With `fetch` wrapped to return `{status:"ok", feed:{}, items:[{title:"Test story", link:"https://example.com/a", pubDate:"2026-10-19 10:00:00", description:"<img src=x onerror=\"window.__xss=1\">Hello <b>world</b>", thumbnail:""}]}` and a not-yet-loaded tab then selected, the story shows the summary "Hello world", `window.__xss` is `undefined`, and the Network panel shows no request for `x`.
29. With `fetch` wrapped to return two items where one has `link:"javascript:alert(1)"`, only the item with the https link is shown.

**States**

30. With `fetch` wrapped to hang and a not-yet-loaded tab selected, the panel shows "Loading headlines…" and then, about 15 seconds later, "Couldn't load the headlines." with a Try again button.
31. With `fetch` wrapped to reject and a not-yet-loaded tab selected, the panel shows "Couldn't load the headlines." and Try again. After restoring `fetch`, pressing Try again shows the stories.
32. With `fetch` wrapped to return `status:"error"`, a not-yet-loaded tab shows the error state with Try again.
33. With `fetch` wrapped to return an empty `items` array, a not-yet-loaded tab shows "No stories in this category right now." with Try again.
34. With stories showing on a tab, wrapping `fetch` to reject and waiting for the 15-minute refresh keeps the stories visible and shows "Couldn't update. Showing headlines from HH:MM."
35. While a tab is loading, its panel has `aria-busy="true"`, and the attribute is gone or `"false"` once it has loaded.

**Isolation and radio**

36. On a fresh load, clicking a tab, pressing arrow keys on the tabs, clicking Try again and clicking a headline do not start the radio. Its status still reads "Press Play or any key to start".
37. With focus on a headline link, pressing Enter opens the article and does not perform `=` on the calculator (the display and tape do not change).
38. After using the News section, clicking the AC key and then pressing `5` on the keyboard shows 5 on the display.
39. Using only Tab, Shift+Tab, arrows and Enter, a tester can reach the tabs, switch categories, move into the panel, reach each headline link and the Try again button (in an error state), and every focused control shows a visible outline.

**Theme and regressions**

40. In dark mode (system dark, or `data-theme="dark"` on `<html>`), tabs in every state, headlines, source and time, summaries, the loading, error, empty and stale messages, the Try again button and the credit line are all clearly readable.
41. Every new color in the CSS is a custom property defined in `:root` and overridden in both dark-mode blocks. No new hard-coded colors appear in news rules.
42. Under `prefers-reduced-motion: reduce` (emulated in DevTools), the loading indicator does not blink.
43. The credit line under the panels reads "Headlines from BBC News, BBC Sport and CNBC, converted by rss2json."
44. The calculator, tape (including tapping a tape line), Clear tape, weather panel and radio Play/Mute work as before, and no new `<script src>` or stylesheet has been added.

## Open questions

