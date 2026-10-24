#!/bin/bash
# PreToolUse hook for Bash: blocks force-pushes, and runs tests/run.sh before any push to main.
# Exit 2 blocks the command and shows stderr to Claude.

cmd=$(python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))')

# Only look at git push commands.
echo "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+push([[:space:]]|$)' || exit 0

if echo "$cmd" | grep -Eq '[[:space:]](--force|--force-with-lease|-[A-Za-z]*f[A-Za-z]*)([[:space:]=]|$)|[[:space:]]\+[^[:space:]]'; then
  echo "Blocked by hook: force-pushing is not allowed in this repo (see CLAUDE.md)." >&2
  exit 2
fi

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
branch=$(git -C "$root" branch --show-current 2>/dev/null)

# Deleting a remote branch doesn't publish code; let it through.
echo "$cmd" | grep -Eq -- '--delete|[[:space:]]:[^[:space:]]' && exit 0

if echo "$cmd" | grep -Eq '(^|[[:space:]:])main([[:space:]]|$)' || [ "$branch" = "main" ]; then
  if ! out=$("$root/tests/run.sh" 2>&1); then
    echo "Blocked by hook: tests/run.sh failed, so this push to main was stopped." >&2
    echo "$out" | tail -15 >&2
    exit 2
  fi
fi
exit 0
