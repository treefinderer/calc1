# Tally Calculator

A one-page calculator website served by GitHub Pages from `main` (root) of
https://github.com/treefinderer/calc1, live at https://treefinderer.github.io/calc1/.

## Project facts

- Everything lives in `index.html`: plain HTML, CSS and JavaScript. No build step, no dependencies, no framework.
- Colors are CSS tokens on `:root` with dark-mode overrides. New colors must be tokens too.
- Fonts come from Google Fonts only, always with a fallback stack.
- The radio streams Radio Paradise Rock Mix (`stream.radioparadise.com`). Browsers allow sound only after a click, tap or key press, so never try to autoplay. Don't use stations that block playback from other sites, and don't work around such blocks.
- The page must work at phone width (about 400px) with no sideways scrolling, and with keyboard only.
- Local preview: `python3 -m http.server 8000` from the repo root (configured in `.claude/launch.json` as `site`).
- Pushing uses the macOS keychain credential that the owner set up. If a push asks for a login, stop and ask the owner to sign in themselves.

## How we work: the ADLC

Every change goes through the stages below, each run by its own agent in `.claude/agents/`.
The main session is the **orchestrator**: it talks to the owner, starts each agent with a complete
brief, passes results between stages, and enforces the gates. It doesn't write feature code itself.

| # | Stage | Agent | Output | Gate to continue |
|---|-------|-------|--------|------------------|
| 1 | Spec | `product-analyst` | `docs/specs/NNNN-slug.md` | **Owner approves the spec** |
| 2 | Build | `developer` | Commits on branch `feature/NNNN-slug` | Developer's self-check passes |
| 3 | Review | `code-reviewer` | Review verdict with findings | Verdict is APPROVE |
| 4 | Test | `qa-tester` | `docs/qa/NNNN-slug.md` | Every acceptance criterion PASS |
| 5 | Release | `release-manager` | `CHANGELOG.md` entry, branch pushed, pull request opened | **Owner reviews and merges the PR on GitHub** |
| 6 | Verify | `release-manager` | Live-site check after the merge | Live site shows the change |

Pull requests:

- `main` changes only through pull requests, and **only the owner merges them**. Agents never merge into `main` or push to it.
- Stage 5 pushes `feature/NNNN-slug` and opens a PR whose description links the spec and QA report and lists the acceptance criteria. Without the GitHub CLI, it gives the owner the compare link instead: `https://github.com/treefinderer/calc1/compare/main...feature/NNNN-slug?expand=1`.
- If the owner leaves review comments, they go back to `developer`, then through review and QA again, and the branch is pushed to update the same PR.
- After the owner merges, run stage 6: pull `main`, check the live site, delete the local branch.
- **The owner's own PRs:** when the owner asks for one to be reviewed, run `code-reviewer` (and `qa-tester` if it changes behavior) on that branch and report the verdict. Don't push to the owner's branches unless asked.

Rules:

- **Numbering.** `NNNN` is the next free four-digit number in `docs/specs/`. The spec, branch and QA report share it.
- **Loops.** A review with REQUEST CHANGES, or a QA FAIL, goes back to `developer` with the findings. After two failed rounds, stop and ask the owner.
- **Fast lane.** A trivial change (wording, a color, spacing, a typo) may skip stage 1: the orchestrator writes one line of acceptance criteria in the brief and tells the owner it is using the fast lane. Review, QA and the release gate still apply.
- **Owner gates are real.** Push a feature branch and open its PR only after the owner's go-ahead for that change. Never merge to `main`; that is the owner's job on GitHub.
- **Status updates.** After each stage, tell the owner in one or two lines what finished and what's next.
- **Briefs.** Agents start with no memory of the conversation. Each brief names the spec file, the branch, the files involved and what done looks like.
