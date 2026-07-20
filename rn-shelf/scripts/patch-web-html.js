#!/usr/bin/env node
// Inject PWA meta + safe-area / no-zoom styles into dist/index.html
const fs = require('fs')
const path = require('path')

const base = process.argv[2] || '/shelf'
const cream = process.argv[3] || '#F4F1EA'
const dist = path.join(__dirname, '..', 'dist')
const f = path.join(dist, 'index.html')

let html = fs.readFileSync(f, 'utf8')
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
      * { -webkit-tap-highlight-color: transparent; tap-highlight-color: transparent; }
      :focus, :focus-visible { outline: none !important; }
      div[tabindex] { outline: none !important; }
    </style>
`
html = html.replace('</head>', inject + '  </head>')
fs.writeFileSync(f, html)

const manifest = {
  name: 'Shelf',
  short_name: 'Shelf',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: cream,
  theme_color: cream,
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2))

for (const name of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  fs.copyFileSync(path.join(__dirname, '..', 'assets', 'pwa', name), path.join(dist, name))
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '')
console.log('patched', f)
