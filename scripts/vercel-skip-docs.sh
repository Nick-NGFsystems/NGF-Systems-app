#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" script — exit 0 to skip the deploy,
# exit 1 to proceed. Skips when only documentation / config files changed.
#
# Wire it up in each Vercel project:
#   Settings → Git → Ignored Build Step
#   Command: bash scripts/vercel-skip-docs.sh
#
# What counts as "docs only" (extend if you add more non-deployable files):
#   - any .md anywhere
#   - .github/* (workflows, templates)
#   - .gitignore, .gitattributes
#   - LICENSE
#   - NGF-STANDARDS.md, CLAUDE.md (specifically — they're roots)
#
# How to read the exit code:
#   $? == 0  → no non-docs changes → SKIP DEPLOY (saves credit)
#   $? != 0  → real code changed → DEPLOY (build runs)

set -e

# Vercel runs this from the repo root with HEAD checked out at the new commit.
# `git diff HEAD^ HEAD` shows what changed in this commit only.

if git diff --quiet HEAD^ HEAD -- . \
    ':(exclude)*.md' \
    ':(exclude)**/*.md' \
    ':(exclude).github/**' \
    ':(exclude).gitignore' \
    ':(exclude).gitattributes' \
    ':(exclude)LICENSE' \
    ':(exclude)CLAUDE.md' \
    ':(exclude)NGF-STANDARDS.md' \
    ':(exclude)README.md'; then
  echo "📄 Only docs/config changed — skipping deploy."
  exit 0
fi

echo "✅ Code changes detected — proceeding with deploy."
exit 1
