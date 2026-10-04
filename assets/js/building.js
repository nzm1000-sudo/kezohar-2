// Procedural point cloud of the community complex + shared particle material.
// Volumes (meters-ish): a long two-storey wing, a wood-clad link, a taller prayer hall
// with a recessed portal and arched door; narrow vertical window slits throughout.
// The cloud is built to read as a SOLID limestone building made of light: points sit on
// (and just behind) the faces with ashlar coursing, openings are recessed with lit reveals,
// edges are barely emphasised, and the shader dims faces turned away from the camera.
import * as THREE from 'three';

export function rng(seed = 7) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// Silhouette follows the illustrative dawn render (assets/img/building-dawn-*): do not change
// these without re-checking the dissolve-to-photo framing in hero-scene.js.
const LONG = { x0: -10, x1: 1.95, y0: 0, y1: 3.9, z0: -2, z1: 2.2 };
const LINK = { x0: 1.95, x1: 3.95, y0: 0, y1: 3.7, z0: -1.2, z1: 1.7 };
const HALL = { x0: 3.95, x1: 10, y0: 0, y1: 5.05, z0: -3.6, z1: 2.2 };
export const BOUNDS = { x0: -10, x1: 10, y1: 5.05 };

// Openings in face coords (a = along the face, b = height).
//   slit / arch → recessed, glowing copper-amber;  wood → flush timber panel;  portal → deep stone recess
const longFront = [];
[-9.19, -8.43, -5.22, -4.51, -3.81, -3.12, -2.42, -1.72, -1.03, -0.33, 0.39, 1.09]
  .forEach((c) => longFront.push({ t: 'slit', a0: c - 0.09, a1: c + 0.09, b0: 1.95, b1: 3.3 }));
longFront.push({ t: 'wood', a0: -7.75, a1: -5.85, b0: 1.95, b1: 3.3 });
[[-7.83, -5.95], [-5.85, -3.9], [-3.8, -1.75], [-1.65, -0.22]].forEach(([a0, a1]) => longFront.push({ t: 'wood', a0, a1, b0: 0.05, b1: 1.5, glass: 1 }));
const ARCH = { t: 'arch', c: 7.1, hw: 0.62, top: 2.1 };
const hallFront = [{ t: 'portal', a0: 6.15, a1: 8.07, b0: 0, b1: 3.3 }];
const hallSide = [-2.4, -0.7, 1.0].map((c) => ({ t: 'slit', a0: c - 0.09, a1: c + 0.09, b0: 0.9, b1: 4.3 }));
const linkFront = [{ t: 'wood', a0: 2.0, a1: 3.9, b0: 0.05, b1: 3.6 }];
const PORTAL_DEPTH = 0.55, SLIT_DEPTH = 0.32;

function inRect(o, a, b) { return a > o.a0 && a < o.a1 && b > o.b0 && b < o.b1; }
function inArch(o, a, b) {
  const dx = a - o.c;
  if (Math.abs(dx) > o.hw || b < 0) return false;
  if (b <= o.top) return true;
  return dx * dx + (b - o.top) * (b - o.top) < o.hw * o.hw;
}
// faces: n = outward normal, map(a, b) → point on the face; lit = baked dawn shading; imp = sampling weight
const faces = [
  { k: 'front', n: [0, 0, 1], open: longFront, map: (a, b) => [a, b, LONG.z1], A: [LONG.x0, LONG.x1], B: [LONG.y0, LONG.y1], lit: 1, imp: 1 },
  { k: 'front', n: [0, 0, 1], open: linkFront, map: (a, b) => [a, b, LINK.z1], A: [LINK.x0, LINK.x1], B: [LINK.y0, LINK.y1], lit: 0.9, imp: 1 },
  { k: 'front', n: [0, 0, 1], open: hallFront, map: (a, b) => [a, b, HALL.z1], A: [HALL.x0, HALL.x1], B: [HALL.y0, HALL.y1], lit: 1.04, imp: 1 },
  { k: 'side', n: [1, 0, 0], open: hallSide, map: (a, b) => [HALL.x1, b, a], A: [HALL.z0, HALL.z1], B: [HALL.y0, HALL.y1], lit: 0.72, imp: 0.85 },
  { k: 'side', n: [-1, 0, 0], open: [], map: (a, b) => [LONG.x0, b, a], A: [LONG.z0, LONG.z1], B: [LONG.y0, LONG.y1], lit: 0.62, imp: 0.7 },
  { k: 'side', n: [-1, 0, 0], open: [], map: (a, b) => [HALL.x0, b, a], A: [HALL.z0, HALL.z1], B: [LONG.y1, HALL.y1], lit: 0.6, imp: 0.7 },
  { k: 'top', n: [0, 1, 0], open: [], map: (a, b) => [a, LONG.y1, b], A: [LONG.x0, LONG.x1], B: [LONG.z0, LONG.z1], lit: 0.78, imp: 0.42 },
  { k: 'top', n: [0, 1, 0], open: [], map: (a, b) => [a, LINK.y1, b], A: [LINK.x0, LINK.x1], B: [LINK.z0, LINK.z1], lit: 0.7, imp: 0.42 },
  { k: 'top', n: [0, 1, 0], open: [], map: (a, b) => [a, HALL.y1, b], A: [HALL.x0, HALL.x1], B: [HALL.z0, HALL.z1], lit: 0.8, imp: 0.42 },
  { k: 'back', n: [0, 0, -1], open: [], map: (a, b) => [a, b, LONG.z0], A: [LONG.x0, LONG.x1], B: [LONG.y0, LONG.y1], lit: 0.4, imp: 0.08 },
  { k: 'back', n: [0, 0, -1], open: [], map: (a, b) => [a, b, HALL.z0], A: [HALL.x0, HALL.x1], B: [HALL.y0, HALL.y1], lit: 0.4, imp: 0.08 },
];
faces.forEach((f) => { f.area = (f.A[1] - f.A[0]) * (f.B[1] - f.B[0]); f.w = f.area * f.imp; });
const hallFrontFace = faces[2];

// palette (multipliers under additive blending on a dark dawn sky)
const C_STONE = new THREE.Color('#F3E1C6');       // warm Jerusalem limestone
const C_STONE_SHADE = new THREE.Color('#C99E7A'); // stone inside recesses
const C_WOOD = new THREE.Color('#B9804F');
const C_GLOW = new THREE.Color('#FFA25C');        // copper-amber window light
const C_GLOW_CORE = new THREE.Color('#FFD7A0');
const C_GROUND = new THREE.Color('#B8693A');
const KIND = { stone: 0, glow: 1, ground: 2, dust: 3, wood: 4, reflect: 5 };

export function buildCloud(N, seed = 11) {
  const R = rng(seed);
  const pos = new Float32Array(N * 3), start = new Float32Array(N * 3), col = new Float32Array(N * 3), nrm = new Float32Array(N * 3);
  const delay = new Float32Array(N), scale = new Float32Array(N), phase = new Float32Array(N), kind = new Float32Array(N);
  let i = 0;
  const put = (x, y, z, c, br, sc, dl, k, n) => {
    if (i >= N) return;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = c.r * br; col[i * 3 + 1] = c.g * br; col[i * 3 + 2] = c.b * br;
    if (n) { nrm[i * 3] = n[0]; nrm[i * 3 + 1] = n[1]; nrm[i * 3 + 2] = n[2]; }
    scale[i] = sc; delay[i] = dl; phase[i] = R(); kind[i] = k;
    // desert dust / starfield start
    const g = (R() + R() + R() - 1.5) / 1.5; // soft gaussian
    start[i * 3] = g * 46; start[i * 3 + 1] = -2 + Math.pow(R(), 2.2) * 26; start[i * 3 + 2] = -36 + R() * 44;
    i++;
  };
  const dl = (y) => Math.min(1, (y / 5.05) * 0.7 + R() * 0.3);
  const off = (f, p, d) => [p[0] - f.n[0] * d, p[1] - f.n[1] * d, p[2] - f.n[2] * d];

  // budget (fractions of N) — density is weighted to the faces, not the edges
  const nAmb = Math.floor(N * 0.025), nGround = Math.floor(N * 0.07), nReflect = Math.floor(N * 0.04);
  const nEdge = Math.floor(N * 0.025), nGlow = Math.floor(N * 0.085), nReveal = Math.floor(N * 0.05);
  const nShell = Math.floor(N * 0.07);
  const nFace = N - nAmb - nGround - nReflect - nEdge - nGlow - nReveal - nShell;

  for (let k = 0; k < nAmb; k++) put(0, 0, 0, C_STONE, 0.45, 2 + R() * 2.4, 2.4, KIND.dust); // stays airborne

  // ground: soft dust disc, denser right in front of the building (warm light spill)
  for (let k = 0; k < nGround; k++) {
    let x, z, br;
    if (R() < 0.45) { x = -10.5 + R() * 21; z = 2.3 + Math.pow(R(), 1.6) * 4.5; br = 0.55 * (1 - (z - 2.3) / 5); }
    else { const r = Math.pow(R(), 0.7) * 26, a = R() * Math.PI * 2; x = Math.cos(a) * r * 1.2; z = Math.sin(a) * r * 0.7 + 1; br = 0.6 * (1 - r / 28); }
    put(x, -0.02 + R() * 0.03, z, C_GROUND, br, 0.7 + R() * 0.4, R() * 0.25, KIND.ground);
  }

  // stone surfaces with ashlar coursing (course 0.34 m, blocks 0.5–0.9 m, offset joints)
  const wTot = faces.reduce((s, f) => s + f.w, 0);
  const pickFace = () => { let r = R() * wTot, j = 0; while (r > faces[j].w) { r -= faces[j].w; j++; } return faces[j]; };
  const stoneTone = (f, a, b) => {
    if (f.k === 'top') return { tone: 0.9 + hash2(Math.floor(a * 1.3), Math.floor(b * 1.3)) * 0.12, joint: false };
    const course = Math.floor(b / 0.34), fb = b / 0.34 - course;
    const L = 0.5 + hash2(course, 3.1) * 0.4, sh = (course % 2) * L * 0.5;
    const blk = Math.floor((a + sh) / L), fa = (a + sh) / L - blk;
    const joint = fb < 0.07 || fa < 0.035;
    return { tone: 0.84 + hash2(blk, course) * 0.26, joint };
  };
  let made = 0, guard = 0;
  while (made < nFace && guard++ < nFace * 6) {
    const f = pickFace();
    const a = f.A[0] + R() * (f.A[1] - f.A[0]), b = f.B[0] + R() * (f.B[1] - f.B[0]);
    const hit = f.open.find((o) => inRect(o, a, b));
    const p = f.map(a, b);
    const y = p[1];
    if (hit && hit.t === 'slit') continue; // handled by glow + reveal
    if (hit && hit.t === 'wood') {
      // vertical planks; the lower panels are timber + glass with warm light between boards
      const plank = Math.floor((a - hit.a0) / 0.2), seam = ((a - hit.a0) / 0.2) % 1 < 0.08;
      if (hit.glass && seam && R() < 0.6) { put(...off(f, p, 0.1), C_GLOW, 0.75, 1.2, dl(y), KIND.glow, f.n); made++; continue; }
      put(...off(f, p, 0.07), C_WOOD, (R() < 0.6 ? 0.3 : 0.7 + hash2(plank, hit.a0) * 0.25) * f.lit, R() < 0.6 ? 2.3 : 1.2 + R() * 0.3, dl(y), KIND.wood, f.n);
      made++; continue;
    }
    if (hit && hit.t === 'portal') {
      if (inArch(ARCH, a, b)) continue; // the arched door glows (below)
      const { tone } = stoneTone(f, a, b);
      put(...off(f, p, PORTAL_DEPTH), C_STONE_SHADE, 0.5 * tone, 1.3 + R() * 0.3, dl(y), KIND.stone, f.n);
      made++; continue;
    }
    const { tone, joint } = stoneTone(f, a, b);
    if (joint && R() < 0.55) continue; // mortar joints read as faint darker lines
    // two layers: a soft "body" of broad dim points that fuse into a continuous lit surface,
    // and a finer grain of small brighter points that gives the limestone its texture
    const body = R() < 0.62;
    const br = (body ? 0.3 : 0.58 + R() * 0.14) * tone * f.lit * (joint ? 0.55 : 1);
    put(p[0], p[1], p[2], C_STONE, br, body ? 2.5 + R() * 0.6 : 1.15 + R() * 0.3, dl(y), KIND.stone, f.n);
    made++;
  }

  // shell: a thin body just behind the faces gives the walls thickness (dim, non-directional)
  for (let k = 0; k < nShell; k++) {
    const f = pickFace(); if (f.k === 'back') { k--; continue; }
    const a = f.A[0] + R() * (f.A[1] - f.A[0]), b = f.B[0] + R() * (f.B[1] - f.B[0]);
    const d = Math.min(1.6, -Math.log(1 - R() * 0.98) * 0.35);
    const p = off(f, f.map(a, b), d);
    put(p[0], p[1], p[2], C_STONE, 0.16 * (1 - d / 1.7) * f.lit, 1.6 + R() * 0.5, dl(p[1]), KIND.stone);
  }

  // openings: glowing slits + arched door, set back inside their reveals
  const glows = [];
  for (const f of faces) for (const o of f.open) if (o.t === 'slit') glows.push({ f, o, a: (o.a1 - o.a0) * (o.b1 - o.b0) });
  glows.push({ f: hallFrontFace, o: ARCH, a: ARCH.hw * 2 * ARCH.top + Math.PI * ARCH.hw * ARCH.hw / 2 });
  const gTot = glows.reduce((s, g) => s + g.a, 0);
  const pickGlow = () => { let r = R() * gTot, j = 0; while (r > glows[j].a) { r -= glows[j].a; j++; } return glows[j]; };
  const glowPoint = (o) => {
    let a, b;
    if (o.t === 'arch') { do { a = o.c - o.hw + R() * o.hw * 2; b = R() * (o.top + o.hw); } while (!inArch(o, a, b)); }
    else { a = o.a0 + R() * (o.a1 - o.a0); b = o.b0 + R() * (o.b1 - o.b0); }
    return [a, b];
  };
  for (let k = 0; k < nGlow; k++) {
    const { f, o } = pickGlow();
    const [a, b] = glowPoint(o);
    const depth = (o.t === 'arch' ? PORTAL_DEPTH + 0.12 : SLIT_DEPTH) + R() * 0.08;
    const p = off(f, f.map(a, b), depth);
    // hotter at the centre line, cooler copper toward the frame
    const u = o.t === 'arch' ? Math.abs(a - o.c) / o.hw : Math.abs(a - (o.a0 + o.a1) / 2) / ((o.a1 - o.a0) / 2);
    const c = u < 0.45 && R() < 0.5 ? C_GLOW_CORE : C_GLOW;
    put(p[0], p[1], p[2], c, (o.t === 'arch' ? 0.95 : 1.05) * (1 - u * 0.35) + R() * 0.2, 1.35 + R() * 0.5, dl(p[1]), KIND.glow, f.n);
  }

  // reveals: jambs, sills and heads of every opening, lit warm by the window light
  const reveals = [];
  for (const f of faces) for (const o of f.open) {
    if (o.t === 'slit') reveals.push({ f, o, d: SLIT_DEPTH, w: (o.b1 - o.b0) * 2 * SLIT_DEPTH });
    if (o.t === 'portal') reveals.push({ f, o, d: PORTAL_DEPTH, w: ((o.b1 - o.b0) * 2 + (o.a1 - o.a0)) * PORTAL_DEPTH });
  }
  const rTot = reveals.reduce((s, r) => s + r.w, 0);
  for (let k = 0; k < nReveal; k++) {
    let r = R() * rTot, j = 0; while (r > reveals[j].w) { r -= reveals[j].w; j++; }
    const { f, o, d } = reveals[j];
    const h = o.b1 - o.b0, w = o.a1 - o.a0, per = o.t === 'portal' ? h * 2 + w : h * 2 + w * 2;
    let s = R() * per, a, b;
    if (s < h) { a = o.a0; b = o.b0 + s; } else if ((s -= h) < h) { a = o.a1; b = o.b0 + s; } else { s -= h; a = o.a0 + (s % w); b = (o.t === 'portal' || s < w) ? o.b1 : o.b0; }
    const t = R();
    const p = off(f, f.map(a, b), t * d);
    const warm = o.t === 'slit' ? 0.45 + t * 0.5 : 0.25;
    put(p[0], p[1], p[2], C_STONE.clone().lerp(C_GLOW, warm), (o.t === 'slit' ? 0.62 : 0.5) * f.lit, 1.1 + R() * 0.3, dl(p[1]), KIND.stone, f.n);
  }

  // arrises: only a faint catch-light on the outer corners and parapets (no wireframe)
  const edges = [];
  for (const v of [LONG, LINK, HALL]) {
    edges.push([[v.x0, v.y1, v.z1], [v.x1, v.y1, v.z1]]); // front parapet
    edges.push([[v.x0, v.y0, v.z1], [v.x0, v.y1, v.z1]]); // front-left corner
    edges.push([[v.x1, v.y0, v.z1], [v.x1, v.y1, v.z1]]); // front-right corner
  }
  edges.push([[HALL.x1, HALL.y1, HALL.z0], [HALL.x1, HALL.y1, HALL.z1]]);
  edges.push([[LONG.x0, LONG.y1, LONG.z0], [LONG.x0, LONG.y1, LONG.z1]]);
  const lens = edges.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  const eTot = lens.reduce((s, l) => s + l, 0);
  for (let k = 0; k < nEdge; k++) {
    let r = R() * eTot, e = 0; while (r > lens[e]) { r -= lens[e]; e++; }
    const [a, b] = edges[e], t = r / lens[e];
    const y = a[1] + (b[1] - a[1]) * t;
    put(a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t, C_STONE, 0.6, 1.05, dl(y), KIND.stone);
  }

  // soft reflection of the lit facade on the ground plane (mirrored, faded with height)
  for (let k = 0; k < nReflect; k++) {
    let x, y, z, c, br;
    if (R() < 0.5) {
      const { f, o } = pickGlow(); if (f.k !== 'front') { k--; continue; }
      [x, y, z] = f.map(...glowPoint(o)); c = C_GLOW; br = 0.24;
    } else {
      const f = faces[R() < 0.62 ? 0 : 2]; const a = f.A[0] + R() * (f.A[1] - f.A[0]), b = R() * f.B[1];
      [x, y, z] = f.map(a, b); c = C_STONE; br = 0.12;
    }
    put(x + (R() - 0.5) * 0.12, -y * 0.55 - 0.04, z + 0.15 + R() * 0.5, c, br * Math.exp(-y * 0.7), 1.6 + R() * 0.6, 0.5 + R() * 0.3, KIND.reflect);
  }

  while (i < N) put((R() - 0.5) * 18, R() * 5, 2.2, C_STONE, 0.25, 0.8, R(), KIND.stone, [0, 0, 1]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aNormal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  g.setAttribute('aText', new THREE.BufferAttribute(new Float32Array(N * 4), 4)); // filled by hero-scene (title dust)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 80);
  // categories are generated in blocks; a deterministic shuffle makes any draw-range
  // reduction (FPS governor) keep an even random subset of every category
  permute(g, N, R);
  return g;
}

function permute(g, N, R) {
  const idx = new Uint32Array(N); for (let k = 0; k < N; k++) idx[k] = k;
  for (let k = N - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); const t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name], s = at.itemSize, src = at.array, dst = new Float32Array(src.length);
    for (let k = 0; k < N; k++) for (let c = 0; c < s; c++) dst[k * s + c] = src[idx[k] * s + c];
    at.array = dst; at.needsUpdate = true;
  }
}

const VERT = /* glsl */`
uniform float uTime, uAssemble, uDissolve, uSize, uPR, uRadius, uIgnite, uDepthRef, uFogNear, uFogFar, uTextIn, uTextPx;
uniform vec3 uSeed, uFogColor;
uniform mat4 uViewToLocal;
attribute vec3 aStart; attribute vec3 aColor; attribute vec3 aNormal; attribute vec4 aText;
attribute float aDelay; attribute float aScale; attribute float aPhase; attribute float aKind;
varying vec3 vColor; varying float vAlpha;
float ease(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) / 2.; }
void main(){
  // "golden dust" twins of the hero title: their start is a view-space point placed exactly over
  // a glyph pixel of the DOM title (re-projected every frame, so they stay pinned to the letters)
  bool txt = aText.w > .5;
  float dly = txt ? aDelay * .3 : aDelay;
  float t = clamp((uAssemble - dly * .42) / .58, 0., 1.);
  float e = ease(t);
  vec3 drift = vec3(sin(uTime*.19 + aPhase*31.), cos(uTime*.15 + aPhase*17.), sin(uTime*.12 + aPhase*23.));
  vec3 start = txt ? (uViewToLocal * vec4(aText.xyz, 1.)).xyz + drift * .012 : aStart + drift * 1.4;
  vec3 p = mix(start, position, e);
  float mid = sin(e * 3.14159);
  float ang = aPhase * 6.2831 + uTime * .25;
  p += vec3(cos(ang), .35 * sin(ang * 1.3), sin(ang)) * mid * (txt ? 1.2 : 1.8);
  p += drift * .008 * e;
  // dissolve: a slow, staggered release — each point drifts gently upward like warm dust in the light
  float d = clamp((uDissolve - aDelay * .45) / .55, 0., 1.);
  p += vec3((fract(aPhase*13.) - .5) * 3., 1. + fract(aPhase*7.) * 5., (fract(aPhase*29.) - .5) * 3.) * d * d;
  vec4 wp = modelMatrix * vec4(p, 1.);
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;

  // solidity: faces turned away from the camera fall almost dark once assembled
  float facing = 1.;
  if (dot(aNormal, aNormal) > .5) {
    vec3 nW = normalize(mat3(modelMatrix) * aNormal);
    float c = dot(nW, normalize(cameraPosition - wp.xyz));
    facing = mix(.06, 1., smoothstep(-.03, .2, c)) * (.82 + .18 * smoothstep(.2, .9, c));
  }
  facing = mix(1., facing, e);

  // depth cues: farther points smaller + dimmer, hazed toward the dawn horizon
  float near = clamp(pow(uDepthRef / depth, 1.6), .38, 1.35);
  float fog = smoothstep(uFogNear, uFogFar, depth);

  bool glow = aKind > .5 && aKind < 1.5;
  float amp = mix(.34, glow ? .16 : (aKind > 1.5 ? .26 : .07), e);
  float tw = 1. - amp + amp * sin(uTime * (.7 + aPhase * 2.1) + aPhase * 50.);
  if (glow) tw *= .92 + .08 * sin(uTime * .6 + position.x * .4); // slow breathing light
  vec3 dust = txt ? vec3(1., .84, .58) * (.95 + .25 * fract(aPhase * 3.7)) : vec3(1., .66, .42) * (.45 + .6 * fract(aPhase * 3.7));
  vec3 col = mix(dust, aColor, smoothstep(.15, 1., t));
  if (uIgnite > 0.) {
    float g = (1. - smoothstep(uRadius - 1.1, uRadius, distance(position, uSeed))) * uIgnite;
    vec3 off = aColor * (glow ? .2 : .4);
    vec3 on = glow ? aColor * 1.75 : aColor * 1.12 + vec3(.3, .14, .04);
    col = mix(off, on, g);
  }
  col = mix(col, uFogColor, fog * .45 * (txt ? e : 1.));
  vColor = col;
  float a = tw * (1. - d * d * (3. - 2. * d)) * mix(.6, 1., e) * facing * near * (1. - fog * .5);
  float size = clamp(uSize * aScale * uPR * (30. / depth) * mix(1., sqrt(near), e), 1., 48.);
  if (txt) {
    float k = smoothstep(0., .35, e);
    float shimmer = .88 + .12 * sin(uTime * (.9 + aPhase * 1.7) + aPhase * 40.);
    a = mix(uTextIn * shimmer, a, k);
    size = mix(uTextPx * (.8 + .45 * fract(aPhase * 5.3)), size, k);
  }
  vAlpha = a;
  gl_PointSize = size;
}`;
const FRAG = /* glsl */`
uniform float uIntensity;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - .5; float r = length(c);
  if (r > .5) discard;
  float a = pow(1. - r * 2., 1.6);
  gl_FragColor = vec4(vColor * a * vAlpha * uIntensity, 1.);
}`;

export function makeMaterial({ size = 2.2, pr = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAssemble: { value: 0 }, uDissolve: { value: 0 }, uSize: { value: size }, uPR: { value: pr },
      uIntensity: { value: 1 }, uSeed: { value: new THREE.Vector3() }, uRadius: { value: 0 }, uIgnite: { value: 0 },
      uDepthRef: { value: 34 }, uFogNear: { value: 32 }, uFogFar: { value: 60 }, uFogColor: { value: new THREE.Color('#4a2a1a') },
      uTextIn: { value: 0 }, uTextPx: { value: 3 }, uViewToLocal: { value: new THREE.Matrix4() },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
}
// keep fog + depth reference in step with the camera distance (call after framing changes)
export function setDepth(mat, dist) {
  mat.uniforms.uDepthRef.value = dist;
  mat.uniforms.uFogNear.value = dist - 2;
  mat.uniforms.uFogFar.value = dist + 26;
}

// The building's solid mass: the three volumes as a dark, softly shaded stone silhouette drawn
// under the points, so the sky no longer shows through and the light-points read as a surface.
export function makeMass() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */`varying vec3 vN; varying float vY;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`uniform float uOpacity; varying vec3 vN; varying float vY;
      void main(){
        // dusk limestone: tops catch the sky, the faces warm up toward the glowing ground
        vec3 c = vec3(.17, .12, .09);
        c += vec3(.07, .05, .035) * max(vN.y, 0.);
        c += vec3(.03, .015, .005) * max(vN.z, 0.);
        c += vec3(.09, .045, .02) * exp(-max(vY, 0.) * .9) * (1. - max(vN.y, 0.));
        gl_FragColor = vec4(c, uOpacity);
      }`,
    transparent: true, depthWrite: true, depthTest: true,
  });
  const g = new THREE.Group();
  const inset = 0.04;
  for (const v of [LONG, LINK, HALL]) {
    const w = v.x1 - v.x0 - inset * 2, h = v.y1 - v.y0 - inset, d = v.z1 - v.z0 - inset * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set((v.x0 + v.x1) / 2, v.y0 + h / 2, (v.z0 + v.z1) / 2);
    m.renderOrder = -1; m.frustumCulled = false;
    g.add(m);
  }
  g.userData.material = mat;
  g.userData.dispose = () => { g.children.forEach((m) => m.geometry.dispose()); mat.dispose(); };
  return g;
}

// Soft warm light pooled on the ground under and in front of the building.
export function makeGroundGlow() {
  const geo = new THREE.PlaneGeometry(56, 28, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#FF9A5A') } },
    vertexShader: /* glsl */`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform vec3 uColor; varying vec3 vP;
      void main(){
        vec2 q = vec2(vP.x / 15., (vP.z - .6) / 6.5);
        float pool = exp(-dot(q, q) * 2.2);
        float spill = exp(-pow((vP.z - 3.6) / 2.2, 2.)) * smoothstep(13., 6., abs(vP.x));
        float a = (pool * .17 + spill * .06) * uOpacity;
        gl_FragColor = vec4(uColor * a, 1.);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -0.03; m.renderOrder = -2; m.frustumCulled = false;
  return m;
}

// Dawn sky background matching the CSS gradient in .hero-sky
export function skyTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  const lg = x.createLinearGradient(0, 0, 0, 512);
  [[0, '#121110'], [0.38, '#1f1915'], [0.64, '#3d281c'], [0.86, '#8a4a2a'], [1, '#d49067']].forEach(([o, col]) => lg.addColorStop(o, col));
  x.fillStyle = lg; x.fillRect(0, 0, 512, 512);
  x.save(); x.translate(256, 553); x.scale(1, 0.5);
  const rg = x.createRadialGradient(0, 0, 0, 0, 0, 620);
  rg.addColorStop(0, 'rgba(233,201,168,.55)'); rg.addColorStop(0.32, 'rgba(166,90,46,.35)'); rg.addColorStop(0.62, 'rgba(166,90,46,0)');
  x.fillStyle = rg; x.fillRect(-700, -1400, 1400, 2800); x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
