#!/usr/bin/env bash
# Build the Shelf RN app for web and deploy it to the gh-pages branch.
# Usage: bash scripts/deploy-web.sh
set -euo pipefail

REPO_URL="https://github.com/vanishaswabhanam/shelf"
BASE="/shelf"
CREAM="#F4F1EA"

cd "$(dirname "$0")/.."   # -> rn-shelf/
ROOT="$(pwd)"

echo "==> Exporting web build"
rm -rf dist
npx expo export -p web

echo "==> Generating home-screen icons"
ICON_SRC="assets/shelf-icon.png"
sips -s format png -z 180 180 "$ICON_SRC" --out dist/apple-touch-icon.png >/dev/null
sips -s format png -z 192 192 "$ICON_SRC" --out dist/icon-192.png >/dev/null
sips -s format png -z 512 512 "$ICON_SRC" --out dist/icon-512.png >/dev/null

echo "==> Writing web manifest"
cat > dist/manifest.json <<JSON
{
  "name": "Shelf",
  "short_name": "Shelf",
  "start_url": "${BASE}/",
  "scope": "${BASE}/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "${CREAM}",
  "theme_color": "${CREAM}",
  "icons": [
    { "src": "${BASE}/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "${BASE}/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "${BASE}/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
JSON

echo "==> Injecting PWA meta + safe-area styling into index.html"
node - "$BASE" "$CREAM" <<'NODE'
const fs = require('fs');
const [base, cream] = process.argv.slice(2);
const f = 'dist/index.html';
let html = fs.readFileSync(f, 'utf8');

// Make the whole page (incl. iOS status-bar safe area) match the app background,
// and let the app paint into the safe areas so there is no white strip on top.
const inject = `
    <link rel="manifest" href="${base}/manifest.json" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Shelf" />
    <meta name="theme-color" content="${cream}" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no" />
    <style id="shelf-safe-area">
      html, body { background-color: ${cream} !important; }
      #root { background-color: ${cream}; min-height: 100%; }
      /* kill the mobile tap-highlight flash and focus outline on tappable elements */
      * { -webkit-tap-highlight-color: transparent; tap-highlight-color: transparent; }
      :focus, :focus-visible { outline: none !important; }
      div[tabindex] { outline: none !important; }
    </style>
`;
html = html.replace('</head>', inject + '  </head>');
fs.writeFileSync(f, html);
console.log('   patched', f);
NODE

touch dist/.nojekyll

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

echo "==> Done. Live at ${REPO_URL#https://github.com/vanishaswabhanam/}"
echo "   https://vanishaswabhanam.github.io${BASE}/"
