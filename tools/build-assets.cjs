/*
 * Regenerates the static assets of the site (no build step is needed to RUN the site).
 *   cd tools && npm i three@0.180 gsap lenis @fontsource/bellefair @fontsource/ibm-plex-sans-hebrew qrcode sharp
 *   node build-assets.cjs <folder-with-source-jpegs>
 * Source JPEGs (AI-generated, 13 files named 01-…jpg … 13-…jpg) are not committed.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const QRCode = require('qrcode');

const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2];
const nm = (p) => require.resolve(p);
const out = (...p) => path.join(ROOT, 'assets', ...p);
const mk = (d) => fs.mkdirSync(d, { recursive: true });

// ---------- vendor ----------
mk(out('vendor', 'three'));
const threeBuild = path.dirname(nm('three'));
const threeDir = path.join(threeBuild.replace(/build$/, ''), 'build');
for (const f of ['three.module.min.js', 'three.core.min.js']) fs.copyFileSync(path.join(threeDir, f), out('vendor', 'three', f));
const gsapDir = path.dirname(nm('gsap/dist/gsap.min.js'));
fs.copyFileSync(path.join(gsapDir, 'gsap.min.js'), out('vendor', 'gsap.min.js'));
fs.copyFileSync(path.join(gsapDir, 'ScrollTrigger.min.js'), out('vendor', 'ScrollTrigger.min.js'));
fs.copyFileSync(path.join(path.dirname(nm('lenis')), 'lenis.min.js'), out('vendor', 'lenis.min.js'));
for (const f of fs.readdirSync(out('vendor'))) {
  const p = out('vendor', f);
  if (f.endsWith('.js')) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, ''));
}

// ---------- fonts ----------
mk(out('fonts'));
const fsrc = (pkg, f) => path.join(path.dirname(nm(`@fontsource/${pkg}/package.json`)), 'files', f);
const fonts = [
  ['bellefair', 'bellefair-hebrew-400-normal.woff2'],
  ['bellefair', 'bellefair-latin-400-normal.woff2'],
  ...[300, 400, 500, 600].flatMap((w) => [
    ['ibm-plex-sans-hebrew', `ibm-plex-sans-hebrew-hebrew-${w}-normal.woff2`],
    ['ibm-plex-sans-hebrew', `ibm-plex-sans-hebrew-latin-${w}-normal.woff2`],
  ]),
];
for (const [pkg, f] of fonts) fs.copyFileSync(fsrc(pkg, f), out('fonts', f));

// ---------- QR ----------
(async () => {
  mk(out('img'));
  const url = 'https://www.matara.pro/nedarimplus/online/?mosad=5776132';
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#1C1B18', light: '#F7F3EC' } });
  fs.writeFileSync(out('img', 'qr-nedarim.svg'), svg);

  if (!SRC) return console.log('vendor/fonts/qr done (no image source folder given)');
  // ---------- photos ----------
  const map = {
    '01': 'building-dawn', '02': 'building-night', '03': 'soldier-arrival', '04': 'soldier-reading',
    '05': 'class-teacher', '06': 'class-girl', '07': 'synagogue', '08': 'mikveh', '09': 'counseling',
    '10': 'meals', '11': 'clinic', '12': 'beit-midrash', '13': 'community',
  };
  const widths = { wide: [640, 1024, 1376], photo: [480, 800, 1200] };
  for (const f of fs.readdirSync(SRC).filter((f) => /^\d\d-.*\.jpg$/.test(f)).sort()) {
    const name = map[f.slice(0, 2)];
    const img = sharp(path.join(SRC, f));
    const meta = await img.metadata();
    const ws = meta.width / meta.height > 1.6 ? widths.wide : widths.photo;
    for (const w of ws) {
      const r = sharp(path.join(SRC, f)).resize(w).modulate({ saturation: 0.92 });
      await r.clone().avif({ quality: 42, effort: 6 }).toFile(out('img', `${name}-${w}.avif`));
      await r.clone().webp({ quality: 64, effort: 6 }).toFile(out('img', `${name}-${w}.webp`));
    }
    console.log(name, meta.width, meta.height);
  }
  // Open Graph image
  await sharp(path.join(SRC, fs.readdirSync(SRC).find((f) => f.startsWith('01-'))))
    .resize(1200, 630, { fit: 'cover', position: 'bottom' }).jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(ROOT, 'og-image.jpg'));
})();
