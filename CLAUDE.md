# Tally Calculator

A one-page calculator site, live at https://treefinderer.github.io/calc1/ (repo `treefinderer/calc1`).
The `pages` GitHub Actions workflow deploys it on every push to `main` and every 30 minutes.

## Files

- `index.html` (markup), `style.css` (all styles), `common.js` (shared helpers on `window.Tally`).
- `calc.js` (calculator, tape, keyboard shortcuts, radio), `weather.js` (spec 0001), `news.js` (spec 0002).
- `scripts/fetch_news.py` + `.github/workflows/pages.yml` (spec 0003) build `news/<id>.json` at deploy time. `news/` is never committed.
- A new feature gets its own IIFE `.js` file, loaded after `common.js`, and shares only through `window.Tally`.
- Read only the files a change touches.

## Rules

- Plain HTML/CSS/JS: no build step, no dependencies. Colors are CSS tokens on `:root` with both dark-mode overrides. Fonts from Google Fonts with fallbacks.
- Must work at about 400px with no sideways scroll, and with keyboard only.
- The radio (Radio Paradise) plays only after a click or key press. Never autoplay, and never work around a station's blocks.
- `tests/run.sh` must print `RESULT: PASS` before anything merges. A hook enforces this on pushes to `main`.
- Never force-push (a hook blocks it). If a push asks for a login, stop and ask the owner.

## Workflow (ADLC)

The main session orchestrates: it briefs agents with only the files involved and doesn't write feature code itself.

| # | Stage | Who | Gate |
|---|-------|-----|------|
| 1 | Spec, `docs/specs/NNNN-slug.md`, short, at most about 12 checks | `product-analyst` | **Owner approves** |
| 2 | Build on `feature/NNNN-slug` | `developer` | `tests/run.sh` PASS |
| 3 | Review | `code-reviewer` (sonnet) | APPROVE |
| 4 | Tests added to `tests/tests.js`, short `docs/qa/NNNN-slug.md` | `qa-tester` (sonnet) | `tests/run.sh` PASS |
| 5 | Release: merge, push, curl check | orchestrator, using the `release` skill | No owner gate |

- `NNNN` is the next free number in `docs/specs/`.
- After two failed review or QA rounds, stop and ask the owner.
- **Fast lane:** trivial changes (wording, a color, a typo) skip stage 1. Tell the owner you're using it.
- After each stage, give the owner a one- or two-line status.
- To review the owner's own branch, run `code-reviewer`, plus `qa-tester` if behavior changes.
