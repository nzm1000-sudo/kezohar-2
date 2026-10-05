/*
 * Portrait versions of the dawn / night building renders for phones (and tablets held upright).
 * The 16:9 render is cover-cropped to its middle third on a phone; these 900×1950 frames keep the
 * WHOLE building, untouched and edge to edge, and extend the picture around it: more sky above
 * (the render's own sky, continued and deepened toward the zenith) and a soft, out-of-focus desert
 * foreground below (the render's own ground strip, magnified as if nearer the lens).
 *   node tools/portrait-renders.cjs
 * GEOM below is mirrored in assets/js/hero-scene.js (PHOTO_PORTRAIT) and main.js (halo box).
 */
const path = require('path');
const sharp = require('sharp');
const IMG = path.resolve(__dirname, '..', 'assets', 'img');
// source crop of the 1376×768 render → 900 px wide portrait; the band sits with its top at Y0
const GEOM = { W: 900, H: 1950, cropX: 60, cropW: 1256, Y0: 1040 };
const S = GEOM.W / GEOM.cropW, BH = Math.round(768 * S);
const ZENITH = { dawn: [150, 138, 150], night: [34, 28, 31] };

async function raw(img) { const { data, info } = await img.raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height, c: info.channels }; }

async function build(name) {
  const src = path.join(IMG, `building-${name}-1376.webp`);
  const bandImg = sharp(src).removeAlpha().extract({ left: GEOM.cropX, top: 0, width: GEOM.cropW, height: 768 }).resize(GEOM.W, BH, { fit: 'fill', kernel: 'lanczos3' });
  const band = await raw(bandImg.clone());
  const soft = await raw(sharp(await bandImg.clone().png().toBuffer()).blur(9));
  // foreground: the band's ground strip, magnified ×5.2 and defocused
  const GS = 84, FG = 5.2;
  const fgW = Math.round(GEOM.W * FG), fgH = Math.round(GS * FG);
  const fg = await raw(sharp(await bandImg.clone().extract({ left: 0, top: BH - GS, width: GEOM.W, height: GS }).png().toBuffer())
    .resize(fgW, fgH, { kernel: 'cubic' }).extract({ left: Math.round((fgW - GEOM.W) / 2), top: 0, width: GEOM.W, height: fgH }).blur(3.2));
  const { W, H, Y0 } = GEOM, out = Buffer.alloc(W * H * 3);
  const at = (o, x, y, k) => o.d[(y * o.w + x) * o.c + k];
  // per-column sky colour at the band's top edge, smoothed sideways
  const top = new Float32Array(W * 3);
  for (let x = 0; x < W; x++) for (let k = 0; k < 3; k++) { let s = 0; for (let y = 1; y < 9; y++) s += at(band, x, y, k); top[x * 3 + k] = s / 8; }
  const topS = new Float32Array(W * 3), R = 70;
  for (let x = 0; x < W; x++) for (let k = 0; k < 3; k++) { let s = 0, n = 0; for (let i = Math.max(0, x - R); i <= Math.min(W - 1, x + R); i++) { s += top[i * 3 + k]; n++; } topS[x * 3 + k] = s / n; }
  const z = ZENITH[name], P = 190; // mirror only rows of pure sky (the hall roof starts at row ~259)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    for (let k = 0; k < 3; k++) {
      let v;
      if (y < Y0) {
        const d = Y0 - y, m = d % (2 * P), r = Math.min(BH - 1, 1 + (m < P ? m : 2 * P - m)); // mirrored cloud detail
        const t = Math.pow(d / Y0, 1.15);
        // near the seam, the column's own top colour; the cloud detail fades out with distance
        const base = topS[x * 3 + k] + (top[x * 3 + k] - topS[x * 3 + k]) * Math.exp(-d / 30);
        const detail = (at(soft, x, r, k) - topS[x * 3 + k]) * 0.7 * Math.exp(-d / 420);
        v = (base + detail) * (1 - t) + z[k] * t;
      } else if (y < Y0 + BH) {
        v = at(band, x, y - Y0, k);
        const e = y - (Y0 + BH - 36); // feather the band's last rows into the foreground
        if (e > 0) { const f = e / 36, g = f * f * (3 - 2 * f); v = v * (1 - g) + at(fg, x, Math.min(fg.h - 1, e), k) * g; }
      } else {
        const r = Math.min(fg.h - 1, y - (Y0 + BH) + 36);
        const t = (y - (Y0 + BH)) / (H - Y0 - BH);
        v = at(fg, x, r, k) * (1 - 0.32 * t * t); // gently darker toward the lens
      }
      out[o + k] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  const img = sharp(out, { raw: { width: W, height: H, channels: 3 } });
  for (const w of [450, 900]) {
    const r = w === W ? img.clone() : img.clone().resize(w, null, { kernel: 'lanczos3' });
    await r.clone().avif({ quality: 60, effort: 7 }).toFile(path.join(IMG, `building-${name}-portrait-${w}.avif`));
    await r.clone().webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(path.join(IMG, `building-${name}-portrait-${w}.webp`));
  }
  console.log(name, 'band', W, '×', BH, 'at', Y0, 'scale', S.toFixed(5));
}
(async () => { for (const n of ['dawn', 'night']) await build(n); })();
