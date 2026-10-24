# Tests

- `tests/run.sh` runs `python3 scripts/fetch_news.py --selftest`, then the browser suite in headless Chrome, and prints `RESULT: PASS n/n` or one `FAIL [Group] name: detail` line per failure. It exits 0 on PASS and 1 otherwise. A run takes about 4 seconds.
- `tests/tests.js` loads the real `index.html` into a same-origin `srcdoc` iframe. It mocks `fetch`, audio and image loading, so the suite never touches the network or plays sound. Add new fixtures inline in `tests.js`, next to the existing ones. Feed samples for the Python selftest live in `tests/fixtures/`.
- Each group starts with the `tally-*` localStorage keys cleared, and the run restores your own keys afterwards.
- Drive the page with real DOM events and assert on the DOM. Reuse the existing helpers rather than writing new ones.
- When behavior changes on purpose, update the check that covers it. Never weaken a check just to get a pass.
- A new feature gets its own group, named after the feature. Keep checks short, about one assertion each.
