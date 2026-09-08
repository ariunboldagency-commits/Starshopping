#!/bin/sh
# starshopping-mn.github.io repo дотор (Git Bash, C:/Users/ariun/Documents/Starshopping-web):
#   git fetch oldsite claude/wizardly-lamport-p0swub
#   git show FETCH_HEAD:HANDOVER/apply.sh | sh
# Таван commit-ыг дарааллаар нь тавина. Дараа нь: git push origin main
set -e
git fetch oldsite claude/wizardly-lamport-p0swub
for f in $(git ls-tree --name-only FETCH_HEAD:HANDOVER/patches/ | sort); do
  echo "== $f"
  git show "FETCH_HEAD:HANDOVER/patches/$f" | git am
done
git log --oneline -6
echo "Одоо: git push origin main"
