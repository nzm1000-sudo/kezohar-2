/*
 * High-quality AVIF + WebP sets for the client-supplied photos (never upscaled past the source width).
 *   node export-photos.cjs <folder-with-the-client-images>
 *   community-terrace.webp (1752×898) · mikveh-luxury.webp (1376×768) · soldier-front-to-home.jpg (1024×572)
 */
const path = require('path');
const sharp = require('sharp');
const SRC = process.argv[2];
const OUT = path.resolve(__dirname, '..', 'assets', 'img');
const jobs = [
  ['community-terrace.webp', 'community-terrace', [640, 1024, 1376, 1752]],
  ['mikveh-luxury.webp', 'mikveh-luxury', [640, 1024, 1376]],
  ['soldier-front-to-home.jpg', 'soldier-home', [480, 800, 1024]],
];
(async () => {
  if (!SRC) return console.log('usage: node export-photos.cjs <folder>');
  for (const [src, name, widths] of jobs) {
    const file = path.join(SRC, src);
    const { width } = await sharp(file).metadata();
    for (const w of widths.filter((w) => w <= width)) {
      let r = sharp(file);
      if (w < width) r = r.resize(w, null, { kernel: 'lanczos3' }).sharpen({ sigma: 0.45 });
      await r.clone().avif({ quality: 63, effort: 7 }).toFile(path.join(OUT, `${name}-${w}.avif`));
      await r.clone().webp({ quality: 84, effort: 6, smartSubsample: true }).toFile(path.join(OUT, `${name}-${w}.webp`));
      console.log(name, w);
    }
  }
})();
