#!/usr/bin/env bash
# Copies shared/motion.js into every goksen mod that imports it (mods cannot
# import across mod folders). Run after editing shared/motion.js.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
for dir in "$root"/mods/g-*/; do
  if grep -q '"./motion.js"' "$dir/main.js" 2>/dev/null; then
    cp "$root/shared/motion.js" "$dir/motion.js"
    echo "synced $(basename "$dir")"
  fi
done
