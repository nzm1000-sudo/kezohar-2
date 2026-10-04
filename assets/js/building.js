// Procedural point cloud of the community complex + shared particle material.
// Volumes (meters-ish): a long two-storey wing, a glass/wood link, a taller prayer hall
// with an arched entrance; narrow vertical window slits throughout.
import * as THREE from 'three';

export function rng(seed = 7) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LONG = { x0: -10, x1: 1.95, y0: 0, y1: 3.9, z0: -2, z1: 2.2 };
const LINK = { x0: 1.95, x1: 3.95, y0: 0, y1: 3.7, z0: -1.2, z1: 1.7 };
const HALL = { x0: 3.95, x1: 10, y0: 0, y1: 5.05, z0: -3.6, z1: 2.2 };
export const BOUNDS = { x0: -10, x1: 10, y1: 5.05 };

// openings on faces, in face coords (a, b) where b = y — proportions follow the illustrative render
const longFront = [];
[-9.19, -8.43, -5.22, -4.51, -3.81, -3.12, -2.42, -1.72, -1.03, -0.33, 0.39, 1.09]
  .forEach((c) => longFront.push({ t: 'r', a0: c - 0.09, a1: c + 0.09, b0: 1.95, b1: 3.3 }));
longFront.push({ t: 'r', a0: -7.75, a1: -5.85, b0: 1.95, b1: 3.3, dim: 1 });
[[-7.83, -5.95], [-5.85, -3.9], [-3.8, -1.75], [-1.65, -0.22]].forEach(([a0, a1]) => longFront.push({ t: 'r', a0, a1, b0: 0.05, b1: 1.5, dim: 1 }));
const hallFront = [
  { t: 'arch', c: 7.1, hw: 0.62, top: 2.1 },
  { t: 'r', a0: 6.15, a1: 8.07, b0: 0, b1: 3.3, frame: 1 },
];
const hallSide = [-2.4, -0.7, 1.0].map((c) => ({ t: 'r', a0: c - 0.09, a1: c + 0.09, b0: 0.9, b1: 4.3 }));
const linkFront = [{ t: 'r', a0: 2.05, a1: 3.85, b0: 0.1, b1: 3.5, dim: 1 }];

function inside(o, a, b) {
  if (o.t === 'r') return a > o.a0 && a < o.a1 && b > o.b0 && b < o.b1;
  const dx = a - o.c;
  if (Math.abs(dx) > o.hw || b < 0) return false;
  if (b <= o.top) return true;
  return dx * dx + (b - o.top) * (b - o.top) < o.hw * o.hw;
}
function perimeterPoint(o, r) {
  if (o.t === 'r') {
    const w = o.a1 - o.a0, h = o.b1 - o.b0, P = 2 * (w + h); let s = r * P;
    if (s < w) return [o.a0 + s, o.b0]; s -= w;
    if (s < h) return [o.a1, o.b0 + s]; s -= h;
    if (s < w) return [o.a1 - s, o.b1]; s -= w;
    return [o.a0, o.b1 - s];
  }
  const straight = o.top * 2, arc = Math.PI * o.hw, P = straight + arc; let s = r * P;
  if (s < o.top) return [o.c - o.hw, s]; s -= o.top;
  if (s < arc) { const ang = Math.PI - (s / arc) * Math.PI; return [o.c + Math.cos(ang) * o.hw, o.top + Math.sin(ang) * o.hw]; }
  s -= arc; return [o.c + o.hw, o.top - s];
}
function area(o) { const A = o.t === 'r' ? (o.a1 - o.a0) * (o.b1 - o.b0) : o.hw * 2 * o.top + Math.PI * o.hw * o.hw / 2; return Math.sqrt(A); }
function fillPoint(o, R) {
  for (let i = 0; i < 20; i++) {
    const a = o.t === 'r' ? o.a0 + R() * (o.a1 - o.a0) : o.c - o.hw + R() * o.hw * 2;
    const b = o.t === 'r' ? o.b0 + R() * (o.b1 - o.b0) : R() * (o.top + o.hw);
    if (inside(o, a, b)) return [a, b];
  }
  return o.t === 'r' ? [(o.a0 + o.a1) / 2, (o.b0 + o.b1) / 2] : [o.c, o.top * 0.5];
}

// faces: map (a,b) → xyz
const faces = [
  { v: LONG, w: 0.30, k: 'front', open: longFront, map: (a, b) => [a, b, LONG.z1], A: [LONG.x0, LONG.x1], br: 1 },
  { v: LINK, w: 0.02, k: 'front', open: linkFront, map: (a, b) => [a, b, LINK.z1], A: [LINK.x0, LINK.x1], br: 0.9 },
  { v: HALL, w: 0.26, k: 'front', open: hallFront, map: (a, b) => [a, b, HALL.z1], A: [HALL.x0, HALL.x1], br: 1 },
  { v: HALL, w: 0.10, k: 'side', open: hallSide, map: (a, b) => [HALL.x1, b, a], A: [HALL.z0, HALL.z1], br: 0.75 },
  { v: LONG, w: 0.05, k: 'side', open: [], map: (a, b) => [LONG.x0, b, a], A: [LONG.z0, LONG.z1], br: 0.6 },
  { v: LONG, w: 0.07, k: 'top', open: [], map: (a, b) => [a, LONG.y1, b], A: [LONG.x0, LONG.x1], B: [LONG.z0, LONG.z1], br: 0.7 },
  { v: HALL, w: 0.05, k: 'top', open: [], map: (a, b) => [a, HALL.y1, b], A: [HALL.x0, HALL.x1], B: [HALL.z0, HALL.z1], br: 0.7 },
  { v: LONG, w: 0.04, k: 'back', open: [], map: (a, b) => [a, b, LONG.z0], A: [LONG.x0, LONG.x1], br: 0.22 },
  { v: HALL, w: 0.03, k: 'back', open: [], map: (a, b) => [a, b, HALL.z0], A: [HALL.x0, HALL.x1], br: 0.22 },
  { v: HALL, w: 0.03, k: 'side', open: [], map: (a, b) => [HALL.x0, b, a], A: [HALL.z0, HALL.z1], B: [LONG.y1, HALL.y1], br: 0.45 },
];
const openFaces = faces.filter((f) => f.open.length);

const C_STONE = new THREE.Color('#E9C9A8');
const C_EDGE = new THREE.Color('#FFF3E2');
const C_GLOW = new THREE.Color('#FFA968');
const C_GROUND = new THREE.Color('#B8693A');

export function buildCloud(N, seed = 11) {
  const R = rng(seed);
  const pos = new Float32Array(N * 3), start = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const delay = new Float32Array(N), scale = new Float32Array(N), phase = new Float32Array(N);
  let i = 0;
  const put = (x, y, z, c, br, sc, dl) => {
    if (i >= N) return;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = c.r * br; col[i * 3 + 1] = c.g * br; col[i * 3 + 2] = c.b * br;
    scale[i] = sc; delay[i] = dl; phase[i] = R();
    // desert dust / starfield start
    const g = (R() + R() + R() - 1.5) / 1.5; // soft gaussian
    const sx = g * 46, sy = -2 + Math.pow(R(), 2.2) * 26, sz = -36 + R() * 44;
    start[i * 3] = sx; start[i * 3 + 1] = sy; start[i * 3 + 2] = sz;
    i++;
  };
  const dl = (y) => Math.min(1, (y / 5.05) * 0.7 + R() * 0.3);

  const nGround = Math.floor(N * 0.12), nEdge = Math.floor(N * 0.17), nOutline = Math.floor(N * 0.08), nFill = Math.floor(N * 0.12), nAmb = Math.floor(N * 0.03);
  const nFace = N - nGround - nEdge - nOutline - nFill - nAmb;
  for (let k = 0; k < nAmb; k++) put(0, 0, 0, C_STONE, 0.5, 2.2 + R() * 2.8, 2.4); // ambient dust, stays airborne

  // ground: soft disc of dust, denser near the building
  for (let k = 0; k < nGround; k++) {
    const r = Math.pow(R(), 0.7) * 26, a = R() * Math.PI * 2;
    const x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r * 0.7 + 1;
    const br = 0.95 * (1 - r / 28);
    put(x, -0.02 + R() * 0.04, z, C_GROUND, br, 0.7 + R() * 0.4, R() * 0.25);
  }
  // edges of every volume
  const vols = [LONG, LINK, HALL];
  const edges = [];
  for (const v of vols) {
    const X = [v.x0, v.x1], Y = [v.y0, v.y1], Z = [v.z0, v.z1];
    for (const y of Y) for (const z of Z) edges.push([[v.x0, y, z], [v.x1, y, z]]);
    for (const x of X) for (const z of Z) edges.push([[x, v.y0, z], [x, v.y1, z]]);
    for (const x of X) for (const y of Y) edges.push([[x, y, v.z0], [x, y, v.z1]]);
  }
  const lens = edges.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  const tot = lens.reduce((s, l) => s + l, 0);
  for (let k = 0; k < nEdge; k++) {
    let r = R() * tot, e = 0; while (r > lens[e]) { r -= lens[e]; e++; }
    const [a, b] = edges[e], t = r / lens[e];
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
    const back = z < -1 ? 0.35 : 1;
    put(x + (R() - 0.5) * 0.03, y + (R() - 0.5) * 0.03, z + (R() - 0.5) * 0.03, C_EDGE, 0.95 * back, 1.05, dl(y));
  }
  // openings: crisp outlines + warm glowing fill set slightly back
  const openings = [];
  for (const f of openFaces) for (const o of f.open) openings.push({ f, o, a: area(o) });
  const oTot = openings.reduce((s, x) => s + x.a, 0);
  const pick = () => { let r = R() * oTot, j = 0; while (r > openings[j].a) { r -= openings[j].a; j++; } return openings[j]; };
  for (let k = 0; k < nOutline; k++) {
    const { f, o } = pick();
    const [a, b] = perimeterPoint(o, R());
    const [x, y, z] = f.map(a, b);
    put(x, y, z, C_EDGE, o.frame ? 0.7 : 1.0, 1.0, dl(y));
  }
  const fillable = openings.filter((x) => !x.o.frame);
  const fTot = fillable.reduce((s2, x) => s2 + x.a, 0);
  const pickFill = () => { let r = R() * fTot, j = 0; while (r > fillable[j].a) { r -= fillable[j].a; j++; } return fillable[j]; };
  for (let k = 0; k < nFill; k++) {
    const { f, o } = pickFill();
    const [a, b] = fillPoint(o, R);
    let [x, y, z] = f.map(a, b);
    if (f.k === 'front') z -= 0.2 + R() * 0.25; else x -= 0.2 + R() * 0.25;
    put(x, y, z, C_GLOW, (o.dim ? 0.5 : 1.05) + R() * 0.35, (o.dim ? 1.0 : 1.5) + R() * 0.6, dl(y));
  }
  // surfaces
  const wTot = faces.reduce((s, f) => s + f.w, 0);
  for (let k = 0; k < nFace; k++) {
    let r = R() * wTot, j = 0; while (r > faces[j].w) { r -= faces[j].w; j++; }
    const f = faces[j];
    let a, b, tries = 0;
    do {
      a = f.A[0] + R() * (f.A[1] - f.A[0]);
      b = f.B ? f.B[0] + R() * (f.B[1] - f.B[0]) : f.v.y0 + R() * (f.v.y1 - f.v.y0);
      tries++;
    } while (f.open.some((o) => !o.frame && inside(o, a, b)) && tries < 12);
    const [x, y, z] = f.map(a, b);
    // limestone courses: faint horizontal banding
    const course = f.k === 'front' ? 0.8 + 0.2 * Math.round((b * 3.2) % 1) : 1;
    put(x, y, z, C_STONE, (0.5 + R() * 0.3) * f.br * course, 0.85 + R() * 0.35, dl(y));
  }
  while (i < N) put((R() - 0.5) * 18, R() * 5, 2.2, C_STONE, 0.3, 0.7, R());

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 80);
  // shuffle-free: draw range reductions keep a random subset because ordering is by category;
  // so interleave categories by swapping with a deterministic permutation
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
uniform float uTime, uAssemble, uDissolve, uSize, uPR, uRadius, uIgnite;
uniform vec3 uSeed;
attribute vec3 aStart; attribute vec3 aColor; attribute float aDelay; attribute float aScale; attribute float aPhase;
varying vec3 vColor; varying float vAlpha;
float ease(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) / 2.; }
void main(){
  float t = clamp((uAssemble - aDelay * .42) / .58, 0., 1.);
  float e = ease(t);
  vec3 drift = vec3(sin(uTime*.19 + aPhase*31.), cos(uTime*.15 + aPhase*17.), sin(uTime*.12 + aPhase*23.));
  vec3 p = mix(aStart + drift * 1.4, position, e);
  float mid = sin(e * 3.14159);
  float ang = aPhase * 6.2831 + uTime * .25;
  p += vec3(cos(ang), .35 * sin(ang * 1.3), sin(ang)) * mid * 1.8;
  p += drift * .012 * e;
  float d = clamp((uDissolve - aDelay * .3) / .7, 0., 1.);
  p += vec3((fract(aPhase*13.) - .5) * 6., 2. + fract(aPhase*7.) * 8., (fract(aPhase*29.) - .5) * 6.) * d * d;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float tw = .74 + .26 * sin(uTime * (.7 + aPhase * 2.1) + aPhase * 50.);
  vec3 dust = vec3(1., .66, .42) * (.45 + .6 * fract(aPhase * 3.7));
  vec3 col = mix(dust, aColor, smoothstep(.15, 1., t));
  if (uIgnite > 0.) {
    float g = 1. - smoothstep(uRadius - 1.1, uRadius, distance(position, uSeed));
    col = mix(aColor * .34, vec3(1., .63, .36) * 1.65, g * uIgnite);
  }
  vColor = col;
  vAlpha = tw * (1. - d) * mix(.6, 1., e);
  gl_PointSize = clamp(uSize * aScale * uPR * (30. / -mv.z), 1., 48.);
}`;
const FRAG = /* glsl */`
uniform float uIntensity;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - .5; float r = length(c);
  if (r > .5) discard;
  float a = pow(1. - r * 2., 1.7);
  gl_FragColor = vec4(vColor * a * vAlpha * uIntensity, 1.);
}`;

export function makeMaterial({ size = 2.2, pr = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAssemble: { value: 0 }, uDissolve: { value: 0 }, uSize: { value: size }, uPR: { value: pr },
      uIntensity: { value: 1 }, uSeed: { value: new THREE.Vector3() }, uRadius: { value: 0 }, uIgnite: { value: 0 },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
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
