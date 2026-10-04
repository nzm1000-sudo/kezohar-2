/*
 * Regenerates the static assets that are committed to the repo:
 * responsive images (AVIF + WebP), self-hosted font subsets, the local QR code
 * and the favicon. Dev-only; the site itself has no build step.
 *
 *   mkdir /tmp/kz && cd /tmp/kz && npm i sharp qrcode @fontsource/heebo @fontsource/frank-ruhl-libre
 *   NODE_PATH=/tmp/kz/node_modules node scripts/build-assets.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const QRCode = require('qrcode');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'images');
const OUT = path.join(IMG, 'r');
fs.mkdirSync(OUT, { recursive: true });

const DONATE_URL = 'https://www.matara.pro/nedarimplus/online/?mosad=5776132';

const photos = [
  ['soldier-arriving-room.jpg', 'soldier-arriving-room', [480, 800, 1024]],
  ['education-boy-learning.jpg', 'education-boy-learning', [480, 800, 1024]],
  ['education-teens.webp', 'education-teens', [480, 800]],
  ['soldier-sleeping.webp', 'soldier-sleeping', [480, 800, 1024]],
  ['education-girl-science.webp', 'education-girl-science', [480, 800, 1024]],
  ['rav.webp', 'rav', [800, 1200]],
];

async function photosOut() {
  for (const [src, name, widths] of photos) {
    for (const w of widths) {
      const base = sharp(path.join(IMG, src)).resize({ width: w, withoutEnlargement: true });
      await base.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(OUT, `${name}-${w}.avif`));
      await base.clone().webp({ quality: 72 }).toFile(path.join(OUT, `${name}-${w}.webp`));
    }
  }
  // Round portrait for the hero: square crop around the face.
  for (const s of [96, 192]) {
    const crop = sharp(path.join(IMG, 'rav.webp')).extract({ left: 420, top: 95, width: 360, height: 360 }).resize(s, s);
    await crop.clone().avif({ quality: 55 }).toFile(path.join(OUT, `rav-avatar-${s}.avif`));
    await crop.clone().webp({ quality: 78 }).toFile(path.join(OUT, `rav-avatar-${s}.webp`));
  }
}

async function posterOut() {
  // images/src/hero-render.png is a screenshot of the lit 3D scene (see DESIGN_NOTES.md).
  const src = path.join(IMG, 'src', 'hero-render.png');
  if (!fs.existsSync(src)) return console.warn('skip poster: no images/src/hero-render.png');
  for (const w of [800, 1600]) {
    const b = sharp(src).resize({ width: w });
    await b.clone().avif({ quality: 45, effort: 6 }).toFile(path.join(OUT, `hero-poster-${w}.avif`));
    await b.clone().webp({ quality: 70 }).toFile(path.join(OUT, `hero-poster-${w}.webp`));
  }
  const og = path.join(IMG, 'src', 'og-render.png');
  if (fs.existsSync(og)) await sharp(og).resize(1200, 630).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(IMG, 'og-kezohar.jpg'));
}

function fontsOut() {
  const dst = path.join(ROOT, 'fonts');
  fs.mkdirSync(dst, { recursive: true });
  const want = { heebo: [400, 500, 700], 'frank-ruhl-libre': [500, 700, 900] };
  for (const [fam, weights] of Object.entries(want)) {
    const dir = path.dirname(require.resolve(`@fontsource/${fam}/package.json`));
    for (const w of weights) for (const sub of ['hebrew', 'latin']) {
      const f = `${fam}-${sub}-${w}-normal.woff2`;
      fs.copyFileSync(path.join(dir, 'files', f), path.join(dst, f));
    }
  }
}

async function qrOut() {
  const svg = await QRCode.toString(DONATE_URL, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 2,
    color: { dark: '#061C32', light: '#FFFDF8' },
  });
  fs.writeFileSync(path.join(IMG, 'qr-donate.svg'), svg);
}

async function faviconOut() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#061C32"/>
  <path d="M18 54V28a14 14 0 0 1 28 0v26z" fill="#F2D89B"/>
  <path d="M18 54V28a14 14 0 0 1 28 0v26" fill="none" stroke="#D6AE62" stroke-width="3"/>
  <path d="M32 14v40M18 38h28" stroke="#061C32" stroke-width="2.5"/>
</svg>`;
  fs.writeFileSync(path.join(ROOT, 'favicon.svg'), svg);
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(path.join(ROOT, 'apple-touch-icon.png'));
  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(ROOT, 'favicon-32.png'));
}

(async () => {
  await photosOut();
  await posterOut();
  fontsOut();
  await qrOut();
  await faviconOut();
  console.log('assets done');
})();
