# Changelog

## 2026-10-22

- Newsfeed fixed: headlines are now fetched every 30 minutes by a GitHub Action and served from the site itself, instead of through rss2json. ([spec 0003](docs/specs/0003-news-from-github-action.md))
- Behind the scenes: the page is split into style.css and one script per feature, with an automated test suite (tests/run.sh). No visible change.

## 2026-10-19

- News section below the calculator: browse the latest headlines in five category tabs. ([spec 0002](docs/specs/0002-newsfeed.md))

## 2026-10-18

- Weather panel beside the calculator: search for a city to see its current weather; the city and °C/°F choice are remembered for next time. ([spec 0001](docs/specs/0001-weather-widget.md))
- Calculator with order of operations, percent, tape and keyboard shortcuts.
- Blinking display digits.
- Radio Paradise Rock Mix player with Play and Mute.
