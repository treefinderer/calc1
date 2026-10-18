# QA 0001 Weather widget

- **Date:** 2026-10-18
- **Branch:** `feature/0001-weather-widget`
- **Commit tested:** `0f59da2`
- **Spec:** `docs/specs/0001-weather-widget.md`
- **Verdict:** **FAIL** (1 of 46 criteria: AC10 fails when the mouse pointer is resting where the results list appears)

## How it was tested

- The site ran locally with `python3 -m http.server 8000` and was used in the built-in browser at http://localhost:8000/. The `site` preview could not start from the agent's working directory, so the server was started by hand.
- Clicks, typing and key presses were real browser input. Page state (localStorage, aria attributes, sizes, scrollWidth vs clientWidth, contrast) was read with JavaScript.
- City searches and forecasts were real Open-Meteo requests ("Lon", "Paris", "Berlin", "Madrid", "Tokyo", "zzqqxx", "Llanfairpwllgwyngyll").
- **Network failures were simulated** because the browser has no Offline switch: `window.fetch` was wrapped so that Open-Meteo requests rejected (offline). For the timeout, they never answered but still listened to the abort signal.
- **Storage failure was simulated** by overriding `Storage.prototype.setItem`, `getItem` and `removeItem` to throw after the page had loaded.
- **15-minute refresh was simulated:** `setTimeout` was wrapped to capture timers of a minute or longer. `Date` was moved forward 15 minutes, then the captured callback was run instead of waiting.
- Viewports were 1280x900, 900x900 and 375x812. Dark mode was tested with emulated `prefers-color-scheme: dark` and with `data-theme="dark"`.
- Before each first-visit check, `tally-weather-v1` and `tally-weather-units-v1` were removed and the page was reloaded.

## Acceptance criteria

| # | Criterion | Result | What I saw |
|---|-----------|--------|------------|
| 1 | 1280px: weather, calculator, tape side by side | PASS | Weather x=56 w=260, calculator x=344 w=360, tape x=732 w=492. All tops at y=170. |
| 2 | 900px: weather above calculator, tape right | PASS | Weather and calculator both at x=16 w=360. Weather is at y=170, calculator at y=344. Tape at x=404. |
| 3 | 375px: order weather, calculator, tape; no h-scroll | PASS | Tops 179, 303, 939. scrollWidth 375 = clientWidth 375. |
| 4 | 375px: results open + long name, no h-scroll | PASS | "Llanfairpwllgwyngyll" list open: scrollWidth 375. Weather view for that city: scrollWidth 375. A 58-character name injected for a stress test wrapped inside the panel (`overflow-wrap: anywhere`). |
| 5 | First visit shows search input + hint, no weather | PASS | Input has aria-label "Search for a city" and placeholder "Type a city". Hint reads "Search for a city to see its weather". No weather data. |
| 6 | First visit `7 + 2 Enter` shows 9 | PASS | Display 9 and tape "7 + 2 = 9". Focus stayed on body. |
| 7 | No api.open-meteo.com request before picking | PASS | Resource list had 0 Open-Meteo entries on first load. |
| 8 | "Lon" shows "Searching…" then ≤5 "City, Region, Country" | PASS | Message went "Searching…", then cleared. Results: "London, England, United Kingdom", "Loni, Uttar Pradesh, India", and 3 more (5 in all). |
| 9 | Single character: no list, no geocoding request | PASS | After "L": 0 fetches, list hidden. |
| 10 | Down, Down, Up highlights 1st, 2nd, 1st | **FAIL** | Works when the mouse pointer is elsewhere (wxOpt0 → wxOpt1 → wxOpt0, and aria-activedescendant follows). **Fails when the pointer is resting where the list appears:** an option gets highlighted without any mouse movement, so the first Down skips ahead. See Failure 1. |
| 11 | Enter picks highlighted result, list closes, weather loads | PASS | London picked, list closed, weather showed. (The wrong city is picked in the Failure 1 situation, because the highlight was already wrong.) |
| 12 | Clicking a result picks it | PASS | Hover highlighted "Paris, Île-de-France Region, France". Clicking it loaded Paris. |
| 13 | Esc closes list, keeps text | PASS | List hidden, aria-expanded false, input still "Lon", focus still in input. |
| 14 | "zzqqxx" shows no-cities message | PASS | "No cities found for “zzqqxx”". |
| 15 | Offline search shows "Couldn't search right now", input editable | PASS (simulated) | Message: "Couldn't search right now. Check your connection and try again." The input was not disabled, and Backspace then typing still edited it. |
| 16 | Loading, then full weather view | PASS | Saw "Loading weather…", then London, "England, United Kingdom", 11°C, Drizzle, icon, "Feels like 8°", "Wind 15 km/h", "H 14° / L 8°", "Updated 15:49". |
| 17 | Condition label matches WMO code | PASS | Forecast reply `weather_code` 51 showed "Drizzle". Paris showed "Partly cloudy" and Madrid "Overcast". The code's mapping table matches the spec table. |
| 18 | Icon aria-hidden, condition as text | PASS | `#wxIcon` has aria-hidden="true" and contains an inline SVG. Label is in `#wxCond`. |
| 19 | Offline pick shows error + Try again; online Try again works | PASS (simulated) | "Couldn't load the weather." with a Try again button. After the network came back, Try again showed Paris weather. |
| 20 | No "Save location" button | PASS | Only Change city, Forget city and the °C/°F toggle. |
| 21 | localStorage `tally-weather-v1` has the city | PASS | `{"name":"London","admin1":"England","country":"United Kingdom","latitude":51.50853,"longitude":-0.12574,"timezone":"Europe/London"}` |
| 22 | Reload loads remembered city directly | PASS | Search state hidden, "Loading weather…", then London. One forecast request, no geocoding. |
| 23 | City A → Change → city B → reload shows B | PASS | London, then Paris. After reload, Paris. |
| 24 | Change city focuses input; Cancel / Esc returns to the same city | PASS | Focus went to wxInput (empty). Cancel brought back London (focus on Change city). Esc in the empty input did the same. Stored city did not change. |
| 25 | Forget city: search state, key removed, reload shows search | PASS | Key was null, focus in input, "City forgotten" announced, unit key kept. After reload: search state, no requests. |
| 26 | `not json` stored: search state, no uncaught error | PASS | Search state shown, 0 Open-Meteo requests, console clean. |
| 27 | Storage throws: weather still shows, note, no errors | PASS (simulated) | Tokyo weather showed with "Can't remember this city on this browser". The unit toggle and Forget city also worked. window error / unhandledrejection listeners caught nothing, and the console was clean. |
| 28 | °C/°F toggle, °C default, pressed state visible and exposed | PASS | °C aria-pressed="true", °F "false". Selected button is bold (700 vs 500) with a filled `--key-op` background. |
| 29 | °F refetches with unit params, values in °F/mph | PASS | URL ended `&temperature_unit=fahrenheit&wind_speed_unit=mph`. Showed 51°F, "Feels like 46°", "Wind 9 mph", "H 56° / L 47°". The old values stayed on screen while it loaded. |
| 30 | °C refetches without unit params, back to °C/km/h | PASS | URL had no unit params. Showed 11°C and 15 km/h. |
| 31 | °F survives reload; key holds "f" | PASS | Reload loaded Paris in °F with °F pressed. `tally-weather-units-v1` = `"f"` (JSON string). |
| 32 | °F, Forget, new city shows in °F | PASS | After Forget city, Berlin loaded in °F (53°F, 8 mph). |
| 33 | Keyboard-only unit switch, display unchanged | PASS | Shift+Tab to °F, then Space switched to °F. Shift+Tab to °C, then Enter switched back. Display stayed 0. |
| 34 | Selecting the current unit sends no request | PASS | Clicking °F while °F was selected sent 0 new fetches. |
| 35 | "St. Louis 10115" changes only the input | PASS | Typed key by key (real keydown events). Display stayed "3" with the pending "5 + 3". Tape unchanged. |
| 36 | Backspace, Esc, Enter, + - * / % in input don't touch calculator | PASS | Also tried x , Delete. Display and expression unchanged throughout. |
| 37 | Click AC then press 5 shows 5 | PASS | Display 5. |
| 38 | Full keyboard-only flow with visible outlines | PASS | Tab, type, Down, Enter, Shift+Tab to units, Space/Enter, Tab to Change city, Enter, Esc, Tab to Forget city, Enter. Every focused control had a solid 2-3px outline in `--accent` (rgb 224,102,47). Weather comes before the calculator in tab order. |
| 39 | Enter on Change city / Forget city doesn't do `=` | PASS | With "5 + 3" pending, Enter on each button ran the button. Display stayed 3 and the tape was unchanged. |
| 40 | Fresh load: search, pick, switch units doesn't start radio | PASS | Status stayed "Press Play or any key to start" through clicking the input, typing "Lon", picking with Enter and clicking °F and °C. |
| 41 | New forecast request ~15 min later, Updated time changes | PASS (simulated) | Refresh timer was 900000 ms. Running it (clock +15 min) sent a new forecast request, and "Updated 15:52" became "Updated 16:08". A new 15-minute timer was then scheduled. |
| 42 | Offline before refresh: last weather kept + "Couldn't update" | PASS (simulated) | Weather stayed, with "Couldn't update. Showing 16:08 data." added. Next timer still scheduled. |
| 43 | Dark mode readable | PASS | Contrast in dark: text 11.8:1, muted text/links 5.4:1, input 10.1:1, options 13:1, highlighted option 6.4:1, °C/°F selected 6.4:1 and unselected 10.7:1, error and stale text 11.8:1, icon fill vs panel about 6.5:1. `data-theme="dark"` applies the same panel colors. Screenshots looked right. |
| 44 | New colors are tokens in `:root` and both dark blocks | PASS | The diff adds no hex, rgb() or hsl() colors and no named colors. Weather rules only use existing tokens (`var(--…)`). |
| 45 | Calculator, tape, Clear tape, radio still work | PASS | See regression below. |
| 46 | No new script/stylesheet; only Open-Meteo hosts | PASS | No `<script src>` or `<link>` added. The only new URLs are `geocoding-api.open-meteo.com` and `api.open-meteo.com`. `navigator.geolocation` is not used. |

Extra spec behavior checked (not numbered criteria): °F failing to load turns the toggle back to °C and shows "Couldn't update". A request that never answers is aborted after 15.0 s, the toggle turns back and the stale note shows. The reduced-motion rule turns off the loading animation (CSS inspected). City text is set with `textContent`; `innerHTML` is only used for the built-in SVG icon strings.

## Regression

| Check | Result |
|-------|--------|
| `2 + 3 × 4 =` → 14 | PASS |
| `2,400 − 15% =` → 2,040 | PASS |
| `5 ÷ 0 =` → message | PASS ("Can't divide by zero") |
| Keyboard digits, Enter, Backspace, Esc | PASS (123 then Backspace gave 12, Esc gave 0) |
| Tape lines appear; clicking one reuses its result | PASS (clicking "14" put 14 on the display) |
| Clear tape | PASS |
| Radio starts from Play, Mute stops it | PASS ("Live from Radio Paradise", then Mute gave "Muted" and audio paused). Left paused at the end. |
| Radio still starts from a calculator click or key | PASS |
| 375px no sideways scroll | PASS |
| Dark mode readable | PASS |
| Console errors | PASS (none seen in the whole session) |

## Failures

### Failure 1 (AC10): a resting mouse pointer silently changes the keyboard highlight, so Down + Enter picks the wrong city

Steps (1280px wide, a city showing):

1. Click **Forget city** (or **Change city**) with the mouse, then don't move the mouse. The search state appears, and the pointer now sits over where the results list will open.
2. Type `Berlin` and wait for the results: Berlin (Germany), Berlin (New Hampshire), Berlin (New Jersey), Brunswick (Maryland), Berlin (Wisconsin).
3. Without touching the mouse, an option under the pointer is already highlighted (I saw "Brunswick, Maryland, United States").
4. Press **Down**. **Expected:** the first result is highlighted. **Actual:** "Berlin, Wisconsin, United States" (the 5th) is highlighted.
5. Press **Enter**. Berlin, Wisconsin loads instead of Berlin, Germany.

This happened during normal testing (Forget city, then type Berlin, Enter, Down, Enter picked Berlin, Wisconsin). It also reproduced with the pointer placed over the list area. With the pointer away from the list, Down/Up work correctly. The cause looks like the `mouseover` handler on the list calling `setActive()`. The browser fires `mouseover` when the list appears under a still pointer, or when `scrollIntoView` moves it, without any mouse movement by the user.

## Notes (not failures)

- Pressing Tab on a freshly loaded page (focus on the body, before reaching the weather input) starts the radio. That keydown happens outside the weather panel, so this is the existing "any key starts the radio" behavior and not the weather rule. Keyboard-only visitors will still hear the radio start on their first Tab.
- With focus on the radio's Play/Mute button, Enter activates that button instead of `=`. This was already the behavior before this change.
