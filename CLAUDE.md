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
| 5 | Release | `release-manager` | `CHANGELOG.md` entry, branch pushed, merged into `main` and pushed | Review APPROVE and QA PASS (no owner gate) |
| 6 | Verify | `release-manager` | Live-site check after the merge | Live site shows the change |

Merging (owner's instruction, 2026-10-19: "don't ask me to merge. Do it instead of me"):

- After review APPROVE and QA PASS, `release-manager` merges into `main` itself. Don't ask the owner to approve the push or the merge.
- Run the merge as separate commands, each allowed by `.claude/settings.local.json` (a local-only file, not in git):
  1. `git switch main`
  2. `git pull --ff-only origin main`
  3. `git merge --no-ff feature/NNNN-slug -m "Merge feature/NNNN-slug: <summary> (spec NNNN)" -m "Co-Authored-By: ..."`
  4. `GIT_TERMINAL_PROMPT=0 git push origin main`
- Never force-push. If any step is refused, asks for a login or hits a conflict, stop and tell the owner; don't work around it.
- The feature branch is still pushed before merging, so GitHub keeps its history. Without the GitHub CLI no PR page is created; the merge commit and the changelog are the record.
- After the merge, run stage 6, then delete the feature branch locally and on GitHub.
- **The owner's own PRs:** when the owner asks for one to be reviewed, run `code-reviewer` (and `qa-tester` if it changes behavior) on that branch and report the verdict. Don't push to or merge the owner's branches unless asked.

Rules:

- **Numbering.** `NNNN` is the next free four-digit number in `docs/specs/`. The spec, branch and QA report share it.
- **Loops.** A review with REQUEST CHANGES, or a QA FAIL, goes back to `developer` with the findings. After two failed rounds, stop and ask the owner.
- **Fast lane.** A trivial change (wording, a color, spacing, a typo) may skip stage 1: the orchestrator writes one line of acceptance criteria in the brief and tells the owner it is using the fast lane. Review and QA still apply.
- **Owner gate.** The owner approves each spec (stage 1). After that, the change ships on its own once review and QA pass.
- **Status updates.** After each stage, tell the owner in one or two lines what finished and what's next.
- **Briefs.** Agents start with no memory of the conversation. Each brief names the spec file, the branch, the files involved and what done looks like.
