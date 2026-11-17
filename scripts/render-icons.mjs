// Renders the extension icons to public/icon/{16,32,48,128}.png, which WXT puts in the manifest.
//   16/32/48: assets/icons/toolbar.svg (hammer head + gem, no rays; D30)
//   128:      src/assets/emblem.svg cropped to a square around the hammer (store and extensions page)
// Optional: `node scripts/render-icons.mjs --preview <file.png>` also saves a sheet showing each
// toolbar size at 1x on light and dark toolbar colours, for a legibility check.
// Run with: pnpm icons
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const toolbar = await readFile('assets/icons/toolbar.svg', 'utf8');
const emblem = (await readFile('src/assets/emblem.svg', 'utf8'))
  // Square crop around the hammer: the emblem's rays reach about 150 px from its centre (340, 170).
  .replace(/viewBox="[^"]*"/, 'viewBox="190 20 300 300"')
  .replace(/width="100%"/, '');

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svg, size, path) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

for (const size of [16, 32, 48]) await render(toolbar, size, `public/icon/${size}.png`);
await render(emblem, 128, 'public/icon/128.png');
console.log('icons: public/icon/{16,32,48,128}.png');

const previewIndex = process.argv.indexOf('--preview');
if (previewIndex > 0) {
  const out = process.argv[previewIndex + 1];
  const img = async (size) => `data:image/png;base64,${(await readFile(`public/icon/${size}.png`)).toString('base64')}`;
  const row = async (bg) =>
    `<div style="background:${bg};padding:12px;display:flex;gap:18px;align-items:center">` +
    (await Promise.all([16, 32, 48].map(async (s) => `<img src="${await img(s)}" width="${s}" height="${s}">`))).join('') +
    `<img src="${await img(16)}" width="96" height="96" style="image-rendering:pixelated">` +
    `<img src="${await img(128)}" width="128" height="128"></div>`;
  await page.setViewportSize({ width: 420, height: 320 });
  await page.setContent(`<body style="margin:0">${await row('#f1f3f4')}${await row('#35363a')}</body>`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`preview: ${out}`);
}

await browser.close();
