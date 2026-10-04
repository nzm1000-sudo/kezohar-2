/*
 * Clay illustrations: keys AI renders made on a flat chroma-green background into transparent
 * AVIF/WebP (240 + 480 px squares, objects bottom-aligned with a 7% margin).
 *   node clay-key.cjs <folder-with-green-jpegs>      (files named act-*, pil-*, ben-*, step-*, pay-*, tier-*)
 * The source renders are not committed.
 */
const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const SRC = process.argv[2];
const OUT = path.resolve(__dirname, '../assets/img/clay');
fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => /^(act|pil|ben|step|pay|tier)-.*\.jpg$/.test(f));
(async () => {
  let total = 0;
  for (const f of files) {
    const { data, info } = await sharp(path.join(SRC, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, n = W * H;
    // background greenness from the border
    const gs = [];
    for (let x = 0; x < W; x += 4) for (const y of [2, H - 3]) { const i = (y * W + x) * 3; gs.push(data[i + 1] - Math.max(data[i], data[i + 2])); }
    gs.sort((a, b) => a - b); const bgG = gs[gs.length >> 1];
    const lo = bgG * 0.28, hi = bgG * 0.72;
    const out = Buffer.alloc(n * 4);
    for (let p = 0; p < n; p++) {
      let r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
      const gp = g - Math.max(r, b);
      let a = gp <= lo ? 1 : gp >= hi ? 0 : 1 - (gp - lo) / (hi - lo);
      a = a * a * (3 - 2 * a);
      // despill: strip the green excess from semi-transparent and spill-tinted edge pixels
      if (a < 1 || gp > lo * 0.6) g = Math.min(g, Math.max(r, b) + (a >= 1 ? lo * 0.6 : 0));
      out[p * 4] = r; out[p * 4 + 1] = g; out[p * 4 + 2] = b; out[p * 4 + 3] = Math.round(a * 255);
    }
    // 1px alpha erosion to kill fringe
    const al = Buffer.from(out.filter((_, i) => i % 4 === 3));
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x; const m = Math.min(al[p], al[p - 1], al[p + 1], al[p - W], al[p + W]);
      out[p * 4 + 3] = Math.round((al[p] + m) / 2);
    }
    // bounce-light despill near the silhouette: light, green-dominant pixels within ~40px of the edge
    const alpha = Buffer.alloc(n); for (let p = 0; p < n; p++) alpha[p] = out[p * 4 + 3];
    const near = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).blur(18).raw().toBuffer();
    let gd = 0, op = 0;
    for (let p = 0; p < n; p++) if (out[p * 4 + 3] > 250) { op++; if (out[p * 4 + 1] - Math.max(out[p * 4], out[p * 4 + 2]) > 12) gd++; }
    const sageHeavy = gd / op > 0.05;
    for (let p = 0; p < n && !sageHeavy; p++) {
      if (near[p] > 245 || out[p * 4 + 3] < 10) continue;
      const r = out[p * 4], g = out[p * 4 + 1], b = out[p * 4 + 2];
      if (g > r && g > b && g - Math.max(r, b) < 14 && (r + g + b) / 3 > 140) { const k = Math.min(1, (245 - near[p]) / 60); out[p * 4 + 1] = Math.round(g - (g - Math.max(r, b)) * (0.35 + 0.6 * k)); }
    }
    const name = f.replace('.jpg', '');
    const trimmed = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
    const t = await sharp(trimmed).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
    // fit into a square with ~7% margin, objects sit on the same baseline (bottom aligned)
    const S = 1000, M = 70, box = S - 2 * M;
    const sc = Math.min(box / t.info.width, box / t.info.height);
    const w = Math.round(t.info.width * sc), h = Math.round(t.info.height * sc);
    const fitted = await sharp(t.data).resize(w, h).toBuffer();
    const sq = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fitted, left: Math.round((S - w) / 2), top: S - M - h }]).png().toBuffer();
    for (const sz of [240, 480]) {
      const r = sharp(sq).resize(sz, sz);
      const a = await r.clone().avif({ quality: 52, effort: 6 }).toFile(`${OUT}/${name}-${sz}.avif`);
      const wb = await r.clone().webp({ quality: 78, alphaQuality: 80, effort: 6 }).toFile(`${OUT}/${name}-${sz}.webp`);
      total += a.size + wb.size;
    }
    console.log(name, 'bgG', bgG, 'sage', (gd/op).toFixed(3));
  }
  console.log('total bytes', total);
})();
