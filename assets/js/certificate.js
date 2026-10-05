// Dedication certificate (1080×1350 PNG), drawn entirely in the browser: a clay limestone plaque
// with a copper rim, the logo mark, the title, the dedication name and the chosen tier.
// Nothing leaves the device.

const W = 1080, H = 1350;
const MARK = ['M5 34h38', 'M14 34a10 10 0 0 1 20 0', 'M36 29l3.7-1.5M33.2 24.8l3.9-3.9M29 22l2.7-6.5M24 21v-9M19 22l-2.7-6.5M14.8 24.8l-3.9-3.9M12 29l-3.7-1.5'];
const DISPLAY = '"Bellefair", "Frank Ruhl Libre", "David", serif';
const UI = '"Plex Hebrew", "IBM Plex Sans Hebrew", "Arial Hebrew", sans-serif';

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function grain(g, alpha) {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const x = c.getContext('2d'), d = x.createImageData(160, 160);
  let s = 7;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 16807) % 2147483647; const v = 90 + (s % 120);
    d.data[i] = v; d.data[i + 1] = v * 0.86; d.data[i + 2] = v * 0.7; d.data[i + 3] = alpha;
  }
  x.putImageData(d, 0, 0);
  return g.createPattern(c, 'repeat');
}
function fitFont(g, text, family, max, min, width) {
  let size = max;
  for (; size > min; size -= 4) { g.font = `400 ${size}px ${family}`; if (g.measureText(text).width <= width) break; }
  g.font = `400 ${size}px ${family}`;
  return size;
}

export async function drawCertificate({ name, tier }) {
  // fonts first: the canvas only draws with faces that are already loaded
  try {
    await Promise.all([
      document.fonts.load(`400 120px ${DISPLAY}`, 'כזוהר הרקיע ' + name),
      document.fonts.load(`400 30px ${UI}`, 'שמכם חקוק לנצח'),
      document.fonts.load(`600 30px ${UI}`, tier),
    ]);
  } catch (e) { /* fall back to whatever is available */ }

  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';

  // backdrop: warm dusk clay
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2A221C'); bg.addColorStop(0.55, '#3A2A20'); bg.addColorStop(1, '#5A3A26');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 760);
  glow.addColorStop(0, 'rgba(240, 190, 140, .32)'); glow.addColorStop(1, 'rgba(240, 190, 140, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = grain(g, 14); g.fillRect(0, 0, W, H);

  // the plaque: soft drop shade, limestone body, top-left light and bottom-right shade
  const px = 84, py = 96, pw = W - px * 2, ph = H - py * 2, pr = 64;
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, .55)'; g.shadowBlur = 70; g.shadowOffsetX = 18; g.shadowOffsetY = 28;
  rrect(g, px, py, pw, ph, pr);
  const stone = g.createLinearGradient(px, py, px + pw, py + ph);
  stone.addColorStop(0, '#F6EEE2'); stone.addColorStop(0.5, '#EDE2D0'); stone.addColorStop(1, '#E1D2BA');
  g.fillStyle = stone; g.fill();
  g.restore();
  g.save();
  rrect(g, px, py, pw, ph, pr); g.clip();
  g.fillStyle = grain(g, 22); g.fillRect(px, py, pw, ph);
  const sheen = g.createLinearGradient(px, py, px + pw * 0.6, py + ph * 0.6);
  sheen.addColorStop(0, 'rgba(255, 255, 255, .55)'); sheen.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
  g.fillStyle = sheen; g.fillRect(px, py, pw, ph);
  // inner bevel
  g.lineWidth = 26;
  g.strokeStyle = 'rgba(255, 255, 255, .45)'; rrect(g, px - 8, py - 8, pw, ph, pr); g.stroke();
  g.strokeStyle = 'rgba(110, 76, 44, .2)'; rrect(g, px + 8, py + 8, pw, ph, pr); g.stroke();
  g.restore();

  // copper rim: a double inlay
  const rim = g.createLinearGradient(px, py, px + pw, py + ph);
  rim.addColorStop(0, '#D9A57A'); rim.addColorStop(0.3, '#A65A2E'); rim.addColorStop(0.55, '#E2B48C'); rim.addColorStop(0.8, '#8F4B24'); rim.addColorStop(1, '#C07A4A');
  g.strokeStyle = rim; g.lineWidth = 7; rrect(g, px + 34, py + 34, pw - 68, ph - 68, pr - 26); g.stroke();
  g.strokeStyle = 'rgba(143, 75, 36, .45)'; g.lineWidth = 1.5; rrect(g, px + 48, py + 48, pw - 96, ph - 96, pr - 36); g.stroke();

  const cx = W / 2;
  // logo mark
  g.save();
  g.translate(cx - 72, 196); g.scale(3, 3);
  g.lineCap = 'round'; g.lineWidth = 2; g.strokeStyle = '#A65A2E';
  MARK.forEach((d) => g.stroke(new Path2D(d)));
  g.restore();

  // title, glossy copper-ink with a pearl edge
  g.font = `400 112px ${DISPLAY}`;
  const tg = g.createLinearGradient(cx - 300, 330, cx + 300, 420);
  tg.addColorStop(0, '#5A3822'); tg.addColorStop(0.45, '#9C6038'); tg.addColorStop(0.55, '#B9794C'); tg.addColorStop(1, '#4A3226');
  g.fillStyle = 'rgba(255, 255, 255, .8)'; g.fillText('כזוהר הרקיע', cx + 2, 432);
  g.fillStyle = tg; g.fillText('כזוהר הרקיע', cx, 430);
  g.font = `400 30px ${UI}`; g.fillStyle = '#6A6157';
  g.fillText('עולמות יחד · קומפלקס רוחני-קהילתי בלב נתיבות', cx, 488);

  // ornament
  const orn = (y) => {
    g.strokeStyle = 'rgba(143, 75, 36, .5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 220, y); g.lineTo(cx - 26, y); g.moveTo(cx + 26, y); g.lineTo(cx + 220, y); g.stroke();
    g.fillStyle = '#A65A2E'; g.save(); g.translate(cx, y); g.rotate(Math.PI / 4); g.fillRect(-8, -8, 16, 16); g.restore();
  };
  orn(560);

  // the engraved line and name (debossed: light below-right, shade above-left)
  g.font = `500 36px ${UI}`; g.fillStyle = '#8F4B24';
  g.fillText('שמכם חקוק לנצח', cx, 660);
  // name well
  g.save();
  rrect(g, px + 90, 700, pw - 180, 230, 40);
  const well = g.createLinearGradient(0, 700, 0, 930);
  well.addColorStop(0, '#E4D6C0'); well.addColorStop(1, '#EFE5D5');
  g.fillStyle = well; g.fill();
  g.clip();
  g.lineWidth = 18; g.strokeStyle = 'rgba(110, 76, 44, .16)'; rrect(g, px + 96, 706, pw - 180, 230, 40); g.stroke();
  g.strokeStyle = 'rgba(255, 255, 255, .6)'; rrect(g, px + 84, 694, pw - 180, 230, 40); g.stroke();
  g.restore();
  // one line when it fits at a generous size; a long name breaks into two balanced lines at a space;
  // a single very long word is condensed (fillText's maxWidth) so it never runs out of the well
  const NW = pw - 260;
  let lines = [name], size = fitFont(g, name, DISPLAY, 132, 72, NW);
  const words = name.split(/\s+/);
  if (g.measureText(name).width > NW && words.length > 1) {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      g.font = `400 100px ${DISPLAY}`; const m = Math.max(g.measureText(a).width, g.measureText(b).width);
      if (!best || m < best.m) best = { m, l: [a, b] };
    }
    lines = best.l;
    const longer = lines.reduce((x, y) => (g.measureText(x).width >= g.measureText(y).width ? x : y));
    size = fitFont(g, longer, DISPLAY, 84, 44, NW);
  } else if (g.measureText(name).width > NW) size = fitFont(g, name, DISPLAY, 72, 44, NW);
  const lh = size * 1.08;
  lines.forEach((ln, i) => {
    const ny = 815 + size * 0.36 + (i - (lines.length - 1) / 2) * lh;
    g.fillStyle = 'rgba(255, 255, 255, .85)'; g.fillText(ln, cx + 2, ny + 2, NW);
    g.fillStyle = 'rgba(110, 76, 44, .35)'; g.fillText(ln, cx - 1.5, ny - 1.5, NW);
    g.fillStyle = '#2A2622'; g.fillText(ln, cx, ny, NW);
  });

  // tier: a copper clay pill
  g.font = `600 34px ${UI}`;
  const tw = g.measureText(tier).width + 96, th = 70, tx = cx - tw / 2, ty = 976;
  g.save();
  g.shadowColor = 'rgba(110, 50, 20, .35)'; g.shadowBlur = 18; g.shadowOffsetX = 6; g.shadowOffsetY = 8;
  rrect(g, tx, ty, tw, th, th / 2);
  const cg = g.createLinearGradient(0, ty, 0, ty + th);
  cg.addColorStop(0, '#B8693C'); cg.addColorStop(1, '#8F4B24');
  g.fillStyle = cg; g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255, 214, 180, .45)'; g.lineWidth = 2; rrect(g, tx + 3, ty + 3, tw - 6, th - 6, th / 2 - 3); g.stroke();
  g.fillStyle = '#FFFFFF'; g.fillText(tier, cx, ty + 47);

  orn(1092);
  g.font = `400 38px ${DISPLAY}`; g.fillStyle = '#6A4A36';
  g.fillText('כִּי לְעוֹלָם חַסְדּוֹ', cx, 1146);
  g.font = `400 20px ${UI}`; g.fillStyle = '#7A6F63';
  g.fillText('תעודה סמלית · אינה קבלה או אישור מס', cx, 1184);

  return new Promise((res) => c.toBlob(res, 'image/png'));
}
