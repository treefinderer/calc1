---
name: release
description: ADLC stage 5 for the Tally Calculator - ship a feature branch that passed review and QA - changelog, merge into main, push, verify the live site with curl, delete the branch. Use when a branch is ready to release, or when the owner types /release.
---

# Release a feature branch

The orchestrator runs this itself, without an agent. The owner said on 2026-10-19 not to ask them to merge, so don't ask for approval to push or merge.

Before you start, both of these must be true: the review said APPROVE, and `tests/run.sh` prints `RESULT: PASS`.

## 1. Finish the branch

On `feature/NNNN-slug`:
1. Run `tests/run.sh` one last time.
2. Add a one-line entry at the top of `CHANGELOG.md`, under today's date, that links the spec. Commit it, staging by explicit path.
3. Push the branch: `GIT_TERMINAL_PROMPT=0 git push -u origin feature/NNNN-slug`.

## 2. Merge

Run each command on its own, not joined with `&&`. Each one is allowed separately in `.claude/settings.local.json`.
1. `git switch main`
2. `git pull --ff-only origin main`
3. `git merge --no-ff feature/NNNN-slug -m "Merge feature/NNNN-slug: <summary> (spec NNNN)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
4. `GIT_TERMINAL_PROMPT=0 git push origin main`. A hook runs `tests/run.sh` first and blocks the push if it fails.

Stop and tell the owner if any step is refused, asks for a login, or hits a conflict. Don't work around it.

## 3. Verify with curl, not a browser

The push starts the `pages` workflow (`.github/workflows/pages.yml`). It fetches the news feeds and deploys the site, usually within a few minutes. Fetch the file that changed, with a cache-buster, and look for a string unique to the change:

```
curl -s "https://treefinderer.github.io/calc1/<file>?v=<short hash>" | grep -c '<marker>'
```

Poll in the background, for example every 30 seconds for up to 15 minutes. Don't use foreground sleeps. If the change doesn't show up, check the runs list:
`curl -s "https://api.github.com/repos/treefinderer/calc1/actions/runs?per_page=3"`. A queued run means GitHub is slow, not that something is broken.

## 4. Clean up

`git branch -d feature/NNNN-slug`, then `git push origin --delete feature/NNNN-slug`.

## Things to know

- **Workflow file changes:** pushing changes to `.github/workflows/` needs the owner's token to have the `workflow` scope. If GitHub rejects the push for that reason, ask the owner to fix the token. Don't try another way.
- **Schedule pause:** GitHub pauses scheduled workflows after 60 days with no repo activity. Any push, or Run workflow on the Actions page, restarts them.
- **Record of changes:** without the GitHub CLI no PR page is created. The branch, the merge commit and the changelog are the record.
