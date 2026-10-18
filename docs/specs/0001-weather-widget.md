# 0001 Weather widget

## Request

> "add weather widget to the left side of calculator. Allow city search after calculator is opened for the first time. then enable saving location"

## Goal

A small weather panel sits to the left of the calculator. On a first visit it invites the visitor to search for a city. Once they pick one it shows that city's current weather, and the city (and the visitor's °C/°F choice) is remembered so it loads straight away on later visits.

## Owner decisions

- "After calculator is opened for the first time" means: on the first page visit, the city search is offered right away, beside the calculator.
- The location is remembered automatically when a city is picked. There is no Save button. The visitor can change the city and forget the remembered one.
- Interacting with the weather panel does not start the radio.
- There is a °C/°F toggle. °C (the default) shows Celsius and km/h; °F shows Fahrenheit and mph. The choice is remembered.
- Between 721px and 1040px the weather panel sits above the calculator (accepted as written below).

## Scope

**In**

- A new weather panel (`<section class="weather" aria-label="Weather">`) inside `.workspace`, placed before the calculator.
- City search by name using the Open-Meteo geocoding API, with a short list of results to pick from.
- Current weather for the picked city from the Open-Meteo forecast API: temperature, a condition label and icon, "feels like", wind, and today's high and low.
- Automatic remembering of the picked city in `localStorage`, with **Change city** and **Forget city** controls.
- A °C/°F toggle, remembered across visits.
- Loading, no-results and network-failure states.
- Automatic refresh every 15 minutes while the page is open.
- Layout changes so desktop shows three columns (weather | calculator | tape) and narrower screens stack.

**Out**

- Browser geolocation ("use my location"). Not requested; do not call `navigator.geolocation`.
- Mixed units (for example °C with mph). The toggle switches temperature and wind together.
- Multi-day forecast, hourly forecast, maps, alerts.
- More than one remembered city.
- Any API key, new library, framework, image host or emoji. Icons are inline SVG or CSS.
- Changes to calculator maths, the tape or the radio's behavior (apart from the keyboard and radio rules in Behavior).

## Behavior

### Layout

- `.page` max-width grows from 920px to about 1200px so three columns fit.
- **Wide (above 1040px):** `.workspace` has three columns: weather (about 240-280px), calculator (up to 360px, as now), tape (the rest). Columns align to the top.
- **Medium (721-1040px):** two columns as today. The left column holds the weather panel stacked directly above the calculator, at the calculator's width. The tape stays on the right.
- **Phone (720px and below):** one column in this order: weather, calculator, tape. The weather panel is compact (the search state is just the input, hint and any results) and has the same max-width (400px) and centering as the calculator.
- No sideways scrolling at 375px in any state, including long city names (they wrap or truncate with an ellipsis) and an open results list.
- The panel's look fits the existing desk/paper style (rounded panel, existing fonts). Every new color is a CSS token defined on `:root` and in both dark-mode blocks (`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`). Reusing existing tokens is preferred.

### Data source

- City search: `https://geocoding-api.open-meteo.com/v1/search?name=<query>&count=5&language=en&format=json`. The query is URL-encoded. Use `results[]` fields `name`, `admin1` (region, may be missing), `country`, `latitude`, `longitude`, `timezone`. A response without `results` means no matches.
- Weather: `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto`, plus `&temperature_unit=fahrenheit&wind_speed_unit=mph` when the unit is °F (no unit parameters for °C, which is Open-Meteo's default of Celsius and km/h). Use `current.*` and the first entry of each `daily` array.
- City names and other API text are inserted as text (`textContent`), never as HTML.

### Weather display

Shows, for the current city:

- City name, with region and country on a smaller line (region omitted if missing).
- Current temperature, rounded to a whole number, with "°C" or "°F".
- Condition icon and label from `weather_code` (table below). Icons are inline SVG or CSS shapes, decorative (`aria-hidden="true"`); the text label carries the meaning.
- "Feels like N°", "Wind N km/h" (or "N mph" in °F), "H N° / L N°" (all rounded).
- "Updated HH:MM" (visitor's local time of the last successful fetch).

WMO code mapping:

| Code | Label | Icon group |
|------|-------|------------|
| 0 | Clear | sun (moon when `is_day` is 0) |
| 1 | Mainly clear | sun/moon |
| 2 | Partly cloudy | sun/moon with cloud |
| 3 | Overcast | cloud |
| 45, 48 | Fog | fog |
| 51, 53, 55 | Drizzle | rain |
| 56, 57 | Freezing drizzle | rain |
| 61, 63, 65 | Rain | rain |
| 66, 67 | Freezing rain | rain |
| 71, 73, 75 | Snow | snow |
| 77 | Snow grains | snow |
| 80, 81, 82 | Rain showers | rain |
| 85, 86 | Snow showers | snow |
| 95 | Thunderstorm | thunder |
| 96, 99 | Thunderstorm with hail | thunder |
| anything else | Unknown | cloud |

### First visit (no remembered city): search state

- On page load with no remembered city, the panel shows a heading ("Weather"), a labelled text input (visible label or `aria-label` "Search for a city", placeholder such as "Type a city"), and a short hint ("Search for a city to see its weather").
- The input does **not** take focus automatically, so the calculator works immediately and keyboard shortcuts behave exactly as before until the visitor clicks or tabs into the input.
- No weather request is made until a city is picked.

### City search

- Searching starts once the input holds at least 2 non-space characters, after about 300ms without typing. Pressing Enter in the input searches immediately (or picks the highlighted result if the list is open).
- While a search is running the panel shows "Searching…".
- Results appear as a list under the input, up to 5 items, each "City, Region, Country" (region left out if missing). The input and list follow the combobox/listbox pattern: `role="combobox"` with `aria-expanded` and `aria-controls` on the input, `role="listbox"` / `role="option"` on the list, and the highlighted option exposed via `aria-activedescendant`.
- Keyboard: Down/Up arrows move the highlight (wrapping is fine), Enter picks the highlighted result, Esc closes the list (a second Esc clears the input). Tab leaves the input normally.
- Mouse/touch: clicking or tapping a result picks it. Hovering highlights it.
- If the visitor keeps typing, only the newest search's results are shown; replies to older searches are ignored.
- **No results:** "No cities found for "<query>"" under the input.
- **Search failure** (network error or non-OK response): "Couldn't search right now. Check your connection and try again." The input stays usable.
- Fewer than 2 characters closes the list and clears any message.

### Picking a city and remembering it

- Picking a city closes the list, switches the panel to the weather view for that city with a "Loading weather…" state, then shows the weather.
- Picking a city immediately stores it in `localStorage` under the key `tally-weather-v1` as JSON: `{ name, admin1, country, latitude, longitude, timezone }`. Picking another city later replaces it. There is no Save button and no separate "saved" state.
- The weather view has two text buttons:
  - **Change city** returns to the search state with the input empty and focused (the visitor asked for it). Esc in the search input with the list closed and the input empty, or a **Cancel** button, returns to the current city without changing anything. The remembered city changes only when a new city is picked.
  - **Forget city** removes `tally-weather-v1` from `localStorage`, stops the refresh timer, and returns the panel to the first-visit search state (input empty). Focus moves to the search input. A polite live-region message announces "City forgotten". The unit choice is not cleared.
- All `localStorage` reads and writes are wrapped in `try/catch`.
- If storage is unavailable or throws (private mode, blocked storage), picking a city still shows its weather for this page view, and a quiet note under the weather reads "Can't remember this city on this browser". No uncaught errors.
- A corrupted or unreadable stored value is treated as "no remembered city" (first-visit search state).

### Later visits (remembered city)

- On page load the remembered city's weather loads directly ("Loading weather…" then the weather), in the remembered unit. No search step.

### Units toggle (°C / °F)

- The weather view shows a two-option toggle labelled "°C" and "°F" (a group with `aria-label="Units"` of two buttons using `aria-pressed`, or an equivalent radio group). The selected option is visually distinct (filled with `--key-op` / `--accent` style, not just color: for example bold text plus fill) and exposed to assistive technology as pressed/checked.
- Default is °C.
- °C shows temperatures in °C and wind in km/h. °F shows temperatures in °F and wind in mph. All values (current, feels like, high, low, wind) switch together.
- Switching units **refetches** the forecast with the matching Open-Meteo unit parameters (see Data source); values are not converted locally. While refetching, the previous values stay visible until the new ones arrive. If the refetch fails, the toggle reverts to the previous unit and the "Couldn't update" message appears.
- The choice is stored automatically in a sibling key `tally-weather-units-v1` holding `"c"` or `"f"` (wrapped in `try/catch`; an unknown value means °C). It is kept when the visitor changes or forgets the city.
- Keyboard: both options are reachable with Tab (or arrow keys within a radio group), and Enter/Space selects. Selecting the already-selected unit does nothing (no request).

### Refresh and failures

- Weather is fetched when a city is shown (on load for a remembered city, on pick, or on a unit change) and again every 15 minutes while the page is open. Only one timer runs at a time; changing city or unit resets it.
- **Weather failure with nothing shown yet:** "Couldn't load the weather." with a **Try again** button.
- **Refresh failure while weather is shown:** keep the last weather and add "Couldn't update. Showing HH:MM data." The next 15-minute refresh retries.
- Requests that never answer must not leave the panel stuck forever: after about 15 seconds treat it as a failure.

### Keyboard and calculator shortcuts

- The document-level `keydown` handler for calculator keys must ignore every keystroke whose target is inside the weather panel's text input (digits, `+ - * / x . , %`, Enter, Esc, Backspace, Delete). Typing "New York", "St. Louis", a postcode-like "10115", or pressing Backspace in the input changes only the input, never the calculator display or tape.
- Enter and Space on weather buttons and result options (Change city, Forget city, Cancel, Try again, °C, °F) activate that control and do not trigger `=` on the calculator.
- Once focus leaves the weather panel (for example, clicking a calculator key or the page background), calculator shortcuts work as before.
- Every weather control is reachable with Tab in a sensible order (the weather panel comes before the calculator in tab order, matching its visual position) and shows a visible focus outline using `--accent`, like the existing buttons.

### Radio

- Clicks, taps and key presses inside the weather panel do **not** start the radio. The radio's capture-phase `autoStart` handler skips events whose target is inside the weather panel. Nothing in the weather widget plays sound.
- Interacting with the calculator still starts the radio exactly as today.

### Dark mode and motion

- The panel is readable in both light and dark themes, including the results list, highlighted option, unit toggle (both states), error text and icons.
- Any loading animation is disabled under `prefers-reduced-motion: reduce`.

## Acceptance criteria

Setup notes for the tester: "first visit" means `localStorage` keys `tally-weather-v1` and `tally-weather-units-v1` are absent (clear them in DevTools or use a private window). Use DevTools network throttling "Offline" for failure checks.

**Layout**

1. At a 1280px-wide window, the weather panel is to the left of the calculator and the tape is to the right of the calculator, all three side by side.
2. At 900px wide, the weather panel sits directly above the calculator in the left column and the tape is on the right.
3. At 375px wide, the order from top to bottom is weather, calculator, tape, and the page has no horizontal scrollbar.
4. At 375px wide, with a results list open and with a long city name showing (for example search "Llanfairpwllgwyngyll"), there is still no horizontal scrollbar.

**First visit**

5. On a first visit, the weather panel shows a "Search for a city" input and a hint, and no weather data.
6. On a first visit, without clicking anything, pressing `7`, `+`, `2`, `Enter` shows 9 on the calculator display (the search input did not take focus).
7. On a first visit, the Network panel shows no request to `api.open-meteo.com` before a city is picked.

**Search**

8. Typing "Lon" into the input shows "Searching…" and then a list of at most 5 results, each formatted "City, Region, Country" (for example "London, England, United Kingdom").
9. Typing a single character shows no results list and makes no geocoding request.
10. With results shown, pressing Down highlights the first result, Down again highlights the second, and Up returns to the first.
11. With a result highlighted, pressing Enter picks it: the list closes and that city's weather loads.
12. Clicking a result with the mouse picks it and loads that city's weather.
13. With the results list open, pressing Esc closes the list and leaves the typed text in the input.
14. Searching "zzqqxx" shows a message saying no cities were found for that text.
15. With the network set to Offline, searching "Paris" shows "Couldn't search right now" and the input stays editable.

**Weather view**

16. After picking a city, the panel shows "Loading weather…" and then: city name, region/country line, a whole-number temperature with °C, a condition label, an icon, "Feels like", wind in km/h, today's high and low, and an "Updated HH:MM" time.
17. The condition label matches the WMO table for the `current.weather_code` value in the forecast response (check in the Network panel).
18. The weather icon has `aria-hidden="true"` and the condition is also given as text.
19. With the network set to Offline, picking a city shows "Couldn't load the weather." and a Try again button; turning the network back on and pressing Try again shows the weather.
20. The weather view has no "Save location" button.

**Remembering the city**

21. After picking a city, DevTools shows `localStorage` key `tally-weather-v1` containing that city's name, country, latitude and longitude.
22. After picking a city and reloading, that city's weather loads directly with no search step.
23. After picking city A, pressing Change city and picking city B, reloading shows city B.
24. Pressing Change city shows the search input with focus in it; pressing Cancel (or Esc with the input empty) returns to the same city's weather, and reloading still shows that city.
25. Pressing Forget city returns the panel to the first-visit search state, removes `tally-weather-v1` from `localStorage`, and reloading shows the search state.
26. If `tally-weather-v1` is set by hand to `not json`, reloading shows the first-visit search state and the console shows no uncaught error.
27. When `localStorage` throws (for example Safari private mode, or `Storage.prototype.setItem` overridden in DevTools to throw), picking a city still shows its weather, a note reads "Can't remember this city on this browser", and the console shows no uncaught error.

**Units**

28. The weather view shows a °C/°F toggle with °C selected by default, and the selected option is visibly distinct and reported as pressed/checked (check `aria-pressed` or `aria-checked` in DevTools).
29. Selecting °F sends a new forecast request whose URL includes `temperature_unit=fahrenheit` and `wind_speed_unit=mph`, and then the temperature, feels like, high and low show °F and wind shows mph.
30. Selecting °C again sends a forecast request without those unit parameters and the values return to °C and km/h.
31. After selecting °F and reloading, the remembered city loads in °F with °F selected, and `localStorage` key `tally-weather-units-v1` holds `"f"`.
32. After selecting °F, pressing Forget city and picking a new city, the new city shows in °F.
33. Using only the keyboard, a tester can move focus to the unit toggle and switch between °C and °F with Enter or Space, and doing so does not change the calculator display.
34. Selecting the unit that is already selected sends no new forecast request.

**Keyboard isolation and radio**

35. With the calculator showing 0, typing "St. Louis 10115" into the search input changes only the input; the calculator display still shows 0 and nothing is added to the tape.
36. Pressing Backspace, Esc, Enter, `+`, `-`, `*`, `/` and `%` while the search input has focus does not change the calculator display.
37. After picking a city, clicking the AC key and then pressing `5` on the keyboard shows 5 on the display (shortcuts work again once focus leaves the panel).
38. Using only Tab, Shift+Tab, arrows, Enter and Esc, a tester can search, pick a city, switch units, press Change city, and press Forget city, and each focused control shows a visible outline.
39. Pressing Enter on a focused Change city or Forget city button activates it and does not perform `=` on the calculator.
40. On a fresh load, clicking the search input, typing a city, picking it and switching units does not start the radio; the radio status still reads "Press Play or any key to start".

**Refresh**

41. With a city showing, the Network panel shows a new forecast request about 15 minutes after the previous one, and the "Updated" time changes.
42. With a city showing, setting the network to Offline before the next refresh keeps the last weather visible and shows "Couldn't update" with the time of the data shown.

**Theme and regressions**

43. In dark mode (system dark, or `data-theme="dark"` on `<html>`), the panel's text, input, results list, highlighted result, unit toggle in both states, error messages and icons are all clearly readable against their backgrounds.
44. Every new color in the CSS is a custom property defined in `:root` and overridden in both dark-mode blocks; no new hard-coded colors appear in weather rules.
45. The calculator, tape (including tapping a tape line), Clear tape and radio Play/Mute work as before.
46. No new `<script src>` or stylesheet is added, and the only new network hosts are `geocoding-api.open-meteo.com` and `api.open-meteo.com`.

## Open questions

