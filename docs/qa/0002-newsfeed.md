# QA report: 0002 Newsfeed

- **Date:** 2026-10-19
- **Branch:** `feature/0002-newsfeed`
- **Commit tested:** `b361085` (Add News section with five category tabs below the calculator)
- **Spec:** `docs/specs/0002-newsfeed.md`
- **Environment:** `python3 -m http.server 8000` from the repo root, Claude desktop built-in browser (Chromium), http://localhost:8000/. Viewports 1280x900, 900x900, 720x900 and 375x812; light and dark color schemes. Browser time zone America/Chicago (UTC-5).
- **Verdict:** **PASS**. All 44 acceptance criteria pass. Two criteria (24, 42) were checked as far as this browser allows; see the notes on those rows.

## How failures and timers were simulated

- `window.fetch` was wrapped as the spec's tester notes describe: reject (network error), `{status:"error"}`, empty `items`, a promise that never settles, and fake items for the XSS and `javascript:` link checks. Non-rss2json requests went to the real `fetch`.
- **15-minute refresh (21, 34):** I did not wait 15 minutes. I wrapped `window.setTimeout` to record calls with a delay of 60 s or more, then called the recorded callback by hand. The recorded delays were 784,624 ms when the tab was selected (15 min minus the age of the cached stories) and then 900,000 ms for each refresh after that.
- **Throwing storage (17):** overriding `Storage.prototype` in the console doesn't survive a reload. So I fetched `index.html`, put a `<script>` at the top of `<head>` that makes `getItem`, `setItem` and `removeItem` throw and logs `error` and `unhandledrejection` events, and loaded the result with `document.open()/write()/close()` in the same tab. That is the same as reloading with storage blocked.
- **Reduced motion (42):** this browser can't emulate `prefers-reduced-motion`, so I checked the CSS rule instead.

## Acceptance criteria

| # | Criterion | Result | What I saw |
|---|-----------|--------|------------|
| 1 | News is the last section, below shortcuts | PASS | `.page` children: `HEADER`, `MAIN.workspace`, `DIV.shortcuts`, `SECTION.news#news` (the last child). The h2 reads "News". |
| 2 | Five tabs in order | PASS | Politics, Technology, Science, Stock Market, Sports. |
| 3 | 2 columns at 1280, 1 column at 720 and below | PASS | 1280: `534px 534px`. 900: `repeat(2, …)`. 720: `minmax(0px, 1fr)`. 375: one column (`287px`). Thumbnails are 88x56 at 375. |
| 4 | 375px: all tabs visible, no horizontal scroll with any tab | PASS | The tabs wrap to two rows (Politics/Technology/Science, then Stock Market/Sports), and every tab sits inside 0–375px. scrollWidth = clientWidth = 375 with Technology, Science and Stock Market loaded, Sports empty and Politics loading/error. |
| 5 | 375px: no horizontal scroll in loading, error and empty states | PASS | scrollWidth 375 = clientWidth in all three states. |
| 6 | ARIA roles and attributes | PASS | `role="tablist"` with `aria-label="News categories"`. Each tab has `role="tab"`, and its `aria-controls` names a `role="tabpanel"` whose `aria-labelledby` points back to the tab. Only the selected tab has `aria-selected="true"`. |
| 7 | Roving tabindex | PASS | Selected tab has 0, the others have -1. This held after every switch. |
| 8 | First visit selects Politics | PASS | With `tally-news-tab-v1` removed and the page reloaded, Politics was selected and its panel visible. |
| 9 | Right/Left from Politics | PASS | Real key presses: Right Arrow moved focus to Technology and selected it. Left Arrow went back to Politics. |
| 10 | Wraparound | PASS | Left on Politics went to Sports. Right on Sports went to Politics. |
| 11 | Home/End | PASS | End selected Sports. From Science, Home selected Politics. |
| 12 | Tab keys don't reach the calculator; no sideways scroll | PASS | The display was 0. After Left, Right, Home, End, Enter and Space on the tabs: display still 0, expression empty, tape count unchanged, scrollX 0, scrollY unchanged (Space didn't scroll the page). |
| 13 | Click selects a tab and shows only its panel | PASS | Real clicks on every tab. Only the selected panel is not `hidden`. |
| 14 | Selected tab looks different (fill + bold); focus outline | PASS | Selected tab uses the `--key-op` fill with weight 700. Unselected tabs use `--key` with weight 500. Keyboard focus shows a 3px solid `--accent` outline (`:focus-visible`), confirmed in a screenshot. Note: in dark mode the two fills are close (contrast 1.61:1 between them), so bold text does most of the work there. The spec allows this. |
| 15 | Science persists across reload | PASS | After clicking Science, storage held `"science"`. After the reload, Science was selected and the only request was for the science_and_environment feed. |
| 16 | `not json` / `"weather"` fall back to Politics | PASS | Both values were stored and the page reloaded. Each time Politics was selected and the world feed requested. The only console error was the local server's `favicon.ico` 404 (not from the page code). |
| 17 | Throwing storage: tabs still work, no uncaught error | PASS | With storage throwing (see method above), Politics loaded 10 stories. A real click on Technology loaded 10 stories. No errors or unhandled rejections were recorded. |
| 18 | Fresh load: exactly one rss2json request, world feed | PASS | Resource list: one request, `…api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Fworld%2Frss.xml`. No other parameters. |
| 19 | Technology first time: one request; going back uses the cache | PASS | Clicking Technology sent one request. Politics then Technology again sent 0 new requests. |
| 20 | Feeds per tab | PASS | Politics `news/world/rss.xml`, Technology `news/technology/rss.xml`, Science `news/science_and_environment/rss.xml`, Stock Market CNBC `…&id=15839069`, Sports `sport/rss.xml`. |
| 21 | 15-minute refresh of the selected tab only | PASS | Timer captured as described above. Calling it sent one request for Technology only, and the panel changed from "Updated 22:04" to "Updated 22:06". The next timer was 900,000 ms. Hidden tabs got no requests. |
| 22 | No direct feed requests; only rss2json and image hosts are new | PASS | Hosts seen: fonts.googleapis.com, fonts.gstatic.com, api.rss2json.com, ichef.bbci.co.uk, plus the existing Open-Meteo weather hosts. No requests to feeds.bbci.co.uk or search.cnbc.com. |
| 23 | At most 10 stories with headline, source and relative time | PASS | Every tab showed 10. Source labels: BBC News on Politics/Technology/Science, CNBC on Stock Market, BBC Sport on Sports. Times looked like "5 h ago" and "1 d ago". |
| 24 | Headline link: `target="_blank"`, `rel` has noopener, opens a new tab | PASS (with note) | All links have `target="_blank"` and `rel="noopener"`. A mouse click and Enter on a headline each made the page open the bbc.co.uk article in a new tab. The test browser blocks pages from opening tabs, so I couldn't watch the new tab load. |
| 25 | `<time datetime>` matches pubDate as UTC; age text correct | PASS | Compared 10 Technology items against the recorded response. For example `2026-10-19 21:12:30` became `2026-10-19T21:12:30Z`, shown as "5 h ago" at 03:03Z. `2026-10-18 23:24:59` showed "1 d ago". A future date showed "Just now". A bad date left the time out. |
| 26 | BBC thumbnails: `alt=""`, lazy; no image means no empty box | PASS | BBC items show `<img alt="" loading="lazy">` from ichef.bbci.co.uk. CNBC items have no thumbnails: no `<img>`, no `has-thumb` class, and the text uses the full width. 0 empty image boxes. An https `enclosure` with type `image/jpeg` was used as the thumbnail. An `http:` thumbnail was ignored. |
| 27 | Summaries are plain text, about 200 characters, end in "…" when cut | PASS | No tags or entities in any live summary (longest 173). A fake 480-character description with `&amp;` and `<p>` became 199 characters of plain text with "&", cut at a word boundary and ending in "…". |
| 28 | XSS description shows "Hello world", no `__xss`, no request for `x` | PASS | Summary was "Hello world". `typeof window.__xss` was `"undefined"`. No resource entry ending in `/x`. |
| 29 | `javascript:` link item is dropped | PASS | The item with `link:"javascript:alert(1)"` was not shown. The https items (and an http item) were shown. |
| 30 | Hang: loading, then error with Try again after about 15 s | PASS | "Loading headlines…" with `aria-busy="true"`. Still loading at 10.07 s. At 16.07 s: "Couldn't load the headlines." with Try again, and `aria-busy="false"`. |
| 31 | Reject: error, then Try again after restoring shows stories | PASS | Error state appeared at once. After restoring fetch, a mouse click on Try again showed "Loading headlines…" (`aria-busy="true"`), then 10 stories and "Updated 22:05". |
| 32 | `status:"error"` shows the error state | PASS | Stock Market showed "Couldn't load the headlines." with Try again. |
| 33 | Empty `items` shows the empty state | PASS | Sports showed "No stories in this category right now." with Try again. The live region announced it. |
| 34 | Failed refresh keeps stories and shows the stale message | PASS | Called the refresh timer with fetch rejecting: 10 stories kept, "Updated 22:06" plus "Couldn't update. Showing headlines from 22:06." The next refresh with fetch restored removed the stale line. Repeated in light and dark themes on Science. |
| 35 | `aria-busy` true while loading, false after | PASS | `"true"` during the first load and Try again. `"false"` after loading, error and empty. |
| 36 | News interactions don't start the radio | PASS | On a fresh load: tab clicks, arrow/Home/End/Enter/Space on tabs, a Try again click, Enter on a headline and a mouse click on a headline. The status still read "Press Play or any key to start" and the audio stayed paused. |
| 37 | Enter on a headline opens it and doesn't trigger `=` | PASS | Display 0, expression empty, tape count unchanged. The page tried to open the article (see 24). |
| 38 | After News, AC then the `5` key shows 5 | PASS | Display "5". The radio then started from the calculator interaction, as before. |
| 39 | Keyboard-only access with visible outlines | PASS | Tab from the last tape button reaches the selected tab. Arrows switch tabs. Tab goes to the panel (outline), then the first headline (accent outline and underline). In the error state, Tab reaches Try again (accent outline). From the last headline, Tab reaches the rss2json credit link (outline), and Shift+Tab goes back. |
| 40 | Dark mode readable | PASS | Screenshots in system dark and light. Contrast in dark: link on paper 12.2, visited 9.3, muted on paper 6.0, text 13.0, unselected tab 10.1, selected tab 6.4, Try again 6.4, credit 5.4. Loading, error, empty and stale messages were all readable. |
| 41 | New colors are tokens in `:root` and both dark blocks | PASS | The only new colors are `--news-link` and `--news-link-visited`, defined in `:root`, `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`. The news rules have no hard-coded colors. |
| 42 | Reduced motion stops the blink | PASS (CSS check) | This browser can't emulate reduced motion. The stylesheet has `@media (prefers-reduced-motion: reduce) { .wx-loading::before, .news-loading::before { animation: none } }`. Without it, the animation is `lcd-blink`. |
| 43 | Credit line text | PASS | "Headlines from BBC News, BBC Sport and CNBC, converted by rss2json." The "rss2json" link has `target="_blank" rel="noopener"`. |
| 44 | Calculator, tape, Clear tape, weather and radio work; no new script or stylesheet | PASS | See the regression results below. `document.scripts` has no `src`. The only stylesheet is the existing Google Fonts link. |

## Regression pass

| Check | Result | What I saw |
|-------|--------|------------|
| `2 + 3 × 4 =` | PASS | 14 (digits and Enter from the keyboard, operators clicked). |
| `2,400 − 15% =` | PASS | 2,040. |
| Divide by zero | PASS | "Can't divide by zero". |
| Keyboard digits, Enter, Backspace, Esc | PASS | `123` then Backspace gave 12. Esc gave 0. Enter worked as `=`. (The test browser's key tool can't send shifted characters like `+` and `*`, so operators were clicked.) |
| Tape lines and reuse | PASS | Lines "2 + 3 × 4 = 14" and "2,400 − 360 = 2,040" appeared. Clicking "Use result 14" put 14 on the display. |
| Clear tape | PASS | The tape emptied, showing "Nothing on the tape yet…". |
| Radio | PASS | On a fresh load, Play started it ("Live from Radio Paradise", audio playing). Mute stopped it ("Muted", paused). Left muted. |
| Weather (guards changed) | PASS | Searched "Paris", picked "Paris, Île-de-France Region, France": 12°C, Rain. °F gave 54°F. °C gave 12°C. Units were saved. The radio didn't start. |
| 375px width | PASS | No sideways scrolling (scrollWidth 375). |
| Dark mode | PASS | Readable (see 40). |
| Console | PASS | No errors from the page. The only entry was the local server's `favicon.ico` 404, which is outside this change. |

## Observations (not failures)

- **Light mode credit line contrast is low.** The credit line is 12px muted text on the `--body` panel, with about 3.55:1 contrast in light mode. The weather panel's muted text uses the same token pairing. It is readable, but below the 4.5:1 WCAG AA level for small text.
- **Dark mode tab fills are close.** The selected and unselected tab fills differ by only about 1.61:1 in dark mode. The bold weight carries the difference.
- **Empty results are cached.** A tab whose request succeeded with no usable items is cached for 15 minutes like any other result. Going back to it shows the empty state again without a new request; Try again still fetches. This matches the spec's caching rules.

## Failures

None.
