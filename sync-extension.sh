#!/usr/bin/env bash
# Copies the shared game files from web/ into extension/ so both versions stay identical.
# The extension keeps its own manifest.json, background.js and game.html.
set -euo pipefail
cd "$(dirname "$0")"
for f in core.js sfx.js tower.js game.js style.css game.css; do cp "web/$f" "extension/$f"; done
cp -r web/fonts web/icons extension/
echo "extension/ is up to date with web/"
