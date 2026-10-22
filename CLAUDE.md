# Tally Calculator

A one-page calculator website served by GitHub Pages from `main` (root) of
https://github.com/treefinderer/calc1, live at https://treefinderer.github.io/calc1/.

## Project facts

- Plain HTML, CSS and JavaScript. No build step, no dependencies, no framework. Files:
  - `index.html`: markup only, plus the Google Fonts link and the script tags.
  - `style.css`: all styles.
  - `common.js`: helpers shared between features (`window.Tally`: `fetchJSON`, `fetchJSONWithin`, `hhmm`).
  - `calc.js`: calculator, tape, keyboard shortcuts, radio.
  - `weather.js`: weather widget (spec 0001). `news.js`: News section (spec 0002).
  - A new feature gets its own `.js` file, loaded after `common.js`. Each file is its own IIFE; share only through `window.Tally`.
- **Tests:** `tests/run.sh` runs the whole suite in headless Chrome in about 4 seconds and prints `RESULT: PASS n/n` or the failing checks (exit 0/1). All network calls and audio are mocked in `tests/tests.js`. Opening http://localhost:8000/tests/ shows the same results in a browser.
- Colors are CSS tokens on `:root` with dark-mode overrides. New colors must be tokens too.
- Fonts come from Google Fonts only, always with a fallback stack.
- The radio streams Radio Paradise Rock Mix (`stream.radioparadise.com`). Browsers allow sound only after a click, tap or key press, so never try to autoplay. Don't use stations that block playback from other sites, and don't work around such blocks.
- The page must work at phone width (about 400px) with no sideways scrolling, and with keyboard only.
- Local preview: `python3 -m http.server 8000` from the repo root (configured in `.claude/launch.json` as `site`).
- Pushing uses the macOS keychain credential that the owner set up. If a push asks for a login, stop and ask the owner to sign in themselves.

## How we work: the ADLC

The main session is the **orchestrator**: it talks to the owner, briefs each agent, passes results between
stages and enforces the gates. It doesn't write feature code itself; it does run the release (stage 5).

| # | Stage | Who | Output | Gate to continue |
|---|-------|-----|--------|------------------|
| 1 | Spec | `product-analyst` | `docs/specs/NNNN-slug.md` | **Owner approves the spec** |
| 2 | Build | `developer` | Commits on `feature/NNNN-slug`, `tests/run.sh` passing | Self-check and tests pass |
| 3 | Review | `code-reviewer` (sonnet) | Verdict with findings | APPROVE |
| 4 | Test | `qa-tester` (sonnet) | New checks in `tests/tests.js`, short `docs/qa/NNNN-slug.md` | `tests/run.sh` PASS |
| 5 | Release | orchestrator | Changelog, merge into `main`, push, `curl` check | Review APPROVE and QA PASS (no owner gate) |

### Stage 5: release (the orchestrator runs it directly, no agent)

Owner's instruction, 2026-10-19: "don't ask me to merge. Do it instead of me".

1. On the feature branch: run `tests/run.sh` once more, add a one-line `CHANGELOG.md` entry linking the spec, commit, and push the branch (`GIT_TERMINAL_PROMPT=0 git push -u origin feature/NNNN-slug`).
2. Merge as separate commands, each allowed by `.claude/settings.local.json` (local-only, not in git):
   1. `git switch main`
   2. `git pull --ff-only origin main`
   3. `git merge --no-ff feature/NNNN-slug -m "Merge feature/NNNN-slug: <summary> (spec NNNN)" -m "Co-Authored-By: ..."`
   4. `GIT_TERMINAL_PROMPT=0 git push origin main`
3. Verify with `curl`, not a browser: wait about a minute, then fetch the file that changed with a cache-buster and look for a string unique to the change, for example
   `curl -s "https://treefinderer.github.io/calc1/news.js?v=<short hash>" | grep -c '<marker>'`. Retry a few times if GitHub Pages still serves the old file.
4. Delete the feature branch locally (`git branch -d`) and on GitHub (`git push origin --delete`).

Never force-push. If any step is refused, asks for a login or hits a conflict, stop and tell the owner; don't work around it. Without the GitHub CLI no PR page is created; the branch, the merge commit and the changelog are the record.

**The owner's own PRs:** when the owner asks for one to be reviewed, run `code-reviewer` (and `qa-tester` if it changes behavior) on that branch and report the verdict. Don't push to or merge the owner's branches unless asked.

### Rules

- **Numbering.** `NNNN` is the next free four-digit number in `docs/specs/`. The spec, branch and QA report share it.
- **Loops.** A review with REQUEST CHANGES, or a QA FAIL, goes back to `developer` with the findings. After two failed rounds, stop and ask the owner.
- **Fast lane.** A trivial change (wording, a color, spacing, a typo) skips stage 1: the orchestrator writes one line of acceptance criteria in the brief and tells the owner it is using the fast lane. Review and `tests/run.sh` still apply.
- **Owner gate.** The owner approves each spec (stage 1). After that, the change ships on its own once review and QA pass.
- **Status updates.** After each stage, tell the owner in one or two lines what finished and what's next.
- **Briefs.** Agents start with no memory of the conversation. Each brief names the spec file, the branch, and only the files involved, plus what done looks like.
