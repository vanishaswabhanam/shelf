#!/usr/bin/env bash
# Build the Shelf RN app for web and deploy it to the gh-pages branch.
# Usage: bash scripts/deploy-web.sh
# Prefer: push to main (GitHub Action builds on a machine with enough RAM).
set -euo pipefail

REPO_URL="https://github.com/vanishaswabhanam/shelf"
BASE="/shelf"
CREAM="#F4F1EA"

cd "$(dirname "$0")/.."   # -> rn-shelf/
ROOT="$(pwd)"

echo "==> Exporting web build"
rm -rf dist
CI=1 EXPO_NO_TELEMETRY=1 npx expo export -p web

echo "==> Patching PWA / safe-area HTML"
node scripts/patch-web-html.js "$BASE" "$CREAM"

echo "==> Deploying dist -> gh-pages"
rm -rf .ghpages-deploy
mkdir .ghpages-deploy
cp -R dist/. .ghpages-deploy/
cd .ghpages-deploy
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.email=deploy@shelf.local -c user.name="shelf-deploy" commit -q -m "Deploy Shelf web app"
git push -f "$REPO_URL" HEAD:gh-pages
cd "$ROOT"
rm -rf .ghpages-deploy

echo "==> Done. Live at https://vanishaswabhanam.github.io${BASE}/"
