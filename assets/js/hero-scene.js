// Hero: the title becomes golden dust → the dust (and the desert's) gathers into a building of light
// → a slow orbit to the photo's viewpoint → a long dissolve into the photo.
import * as THREE from 'three';
import { buildCloud, makeMass, makeMaterial, makeGroundGlow, setDepth, skyTexture } from './building.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // the shader's ease()

// Stage map (fractions of the 720vh hero; main.js drives the DOM side with matching numbers):
//   the words leave 0.4–6.4% · only then the title → dust 7–12% · dust gathers 15–44% · hold ·
//   orbit 50–71% · dissolve 67–99% (photo 60–95%)
export const STAGE = { textIn: [0.07, 0.12], assemble: [0.15, 0.44], orbit: [0.5, 0.71], dissolve: [0.67, 0.99] };

// Device capability → quality tier (0 low, 1 mid, 2 high). Cheap signals first; the runtime governor
// below then corrects with real frame times.
function pickTier(renderer, mobile) {
  const hc = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  let score = 0;
  if (hc >= 8) score++; else if (hc <= 4) score--;
  if (mem >= 8) score++; else if (mem <= 2) score -= 2; else if (mem < 4) score--;
  const px = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 2) ** 2;
  if (px > 5.5e6) score--; // very large backing stores cost fill rate
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|mali-[4t]|adreno \(tm\) [2-5]\d\d|powervr sgx|hd graphics [2-5]\d\d/i.test(gpu)) score -= 2;
    else if (/apple m\d|apple gpu|rtx|radeon rx|geforce|adreno \(tm\) [67]\d\d|mali-g7\d|immortalis/i.test(gpu)) score++;
  } catch (e) { /* no renderer info */ }
  if (mobile) score -= 1;
  return score >= 1 ? 2 : score >= -1 ? 1 : 0;
}

// noGov: disables the FPS governor (only passed by local test runs on software GL).
// photo: the <img> of the dawn render the scene dissolves into; its cover-fit crop sets the final framing.
// title: the hero title element whose glyphs become the first particles.
export function createHero(canvas, { mobile = false, poster = false, noGov = false, photo = null, title = null, tier: forceTier = null, onStop } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: poster });
  const tier = forceTier != null ? forceTier : pickTier(renderer, mobile);
  const COUNTS = mobile ? [7000, 11000, 15000] : [12000, 21000, 30000];
  const DPRS = [1, 1.25, 1.5];
  const N = COUNTS[tier];
  let dpr = Math.min(window.devicePixelRatio || 1, DPRS[tier]);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  const geo = buildCloud(N);
  // fewer points → each a little larger, so the building keeps the same luminous body
  const mat = makeMaterial({ size: (mobile ? 2.3 : 2.7) * ((mobile ? 15000 : 30000) / N) ** 0.3, pr: dpr });
  const gain = mobile ? 0.92 : 1.32;
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const ground = makeGroundGlow(), mass = makeMass();
  const group = new THREE.Group();
  group.add(ground, mass, pts);
  group.position.set(0.1, 0, 0);
  scene.add(group);

  // Particles that may become title dust: the first building points (kinds stone / glow / wood) in
  // buffer order. They sit at the front, so a reduced draw range never thins the glyphs.
  const kindA = geo.attributes.aKind.array, textAttr = geo.attributes.aText;
  const MAXT = mobile ? 1700 : 3400;
  const textIdx = [];
  for (let k = 0; k < N && textIdx.length < MAXT; k++) { const kd = kindA[k]; if (kd < 1.5 || (kd > 3.5 && kd < 4.5)) textIdx.push(k); }
  const minDraw = textIdx.length ? textIdx[textIdx.length - 1] + 1 : 0;

  // Where the building sits in the 1376×768 dawn render: centre x, ground line y, px per metre
  // (20 m wide wing-to-hall = 1143 px). The final camera reproduces the photo's cover-fit crop.
  const PHOTO = { w: 1376, h: 768, cx: 696.5, base: 645, ppu: 57.15 };
  // portrait screens show the portrait render instead (the same picture on a 900×1950 canvas: crop x 60,
  // scale 900/1256 sideways and 550/768 down, placed 1040 px down — tools/portrait-renders.cjs)
  const PS = 900 / 1256, PSY = 550 / 768;
  const PHOTO_PORTRAIT = { w: 900, h: 1950, cx: (696.5 - 60) * PS, base: 1040 + 645 * PSY, ppu: 57.15 * PS };
  const portraitMq = window.matchMedia('(max-aspect-ratio: 4/5)');
  const EYE = (645 - 555) / 57.15; // the render's horizon sits 90 px above its ground line
  function photoPose(w, h) {
    const PHOTO_ = portraitMq.matches ? PHOTO_PORTRAIT : PHOTO;
    let ox = 0.5, oy = 0.78;
    if (photo) {
      const op = getComputedStyle(photo).objectPosition.split(' ').map(parseFloat);
      if (op.length === 2 && op.every((v) => !Number.isNaN(v))) { ox = op[0] / 100; oy = op[1] / 100; }
    }
    const s = Math.max(w / PHOTO_.w, h / PHOTO_.h), ppu = PHOTO_.ppu * s;
    const sx = (w - PHOTO_.w * s) * ox + PHOTO_.cx * s, sy = (h - PHOTO_.h * s) * oy + PHOTO_.base * s;
    const z = 2.2 + h / (2 * state.half * ppu);
    // The portrait picture puts the building low in a tall frame. Raising the camera to line the ground
    // up would look down onto the roofs (their tops and the dark mass would show above the photo's roof
    // line). Instead the camera stays at the render's eye height (its horizon: 1.57 m) and the lens is
    // shifted (an off-axis view) so the ground line still lands where the photo has it.
    if (PHOTO_ === PHOTO_PORTRAIT) return { x: group.position.x - (sx - w / 2) / ppu, y: EYE, z, shift: sy - EYE * ppu - h / 2 };
    return { x: group.position.x - (sx - w / 2) / ppu, y: (sy - h / 2) / ppu, z, shift: 0 };
  }

  const state = { progress: 0, mx: 0, my: 0, cx: 0, cy: 0, running: false, visible: true, dist: 34, baseSize: mat.uniforms.uSize.value, dust: false };
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    state.w = w; state.h = h; state.shift = null; // re-apply the lens shift for the new size
    camera.aspect = w / h;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    state.half = Math.tan(half);
    state.dist = Math.max(30, (camera.aspect < 0.8 ? 12.8 : camera.aspect < 1 ? 11.6 : 14) / state.half / camera.aspect); // assembled framing (≈28 units wide; tall screens keep a margin round the 3/4 view)
    state.final = photoPose(w, h);                                        // final framing = the photo
    mat.uniforms.uSize.value = state.baseSize * (state.dist / 30);
    camera.updateProjectionMatrix();
  }
  resize();
  let rsT = 0, lastW = 0, lastH = 0;
  const ro = new ResizeObserver(() => {
    resize();
    // phones resize the viewport as the URL bar slides; only re-sample on a real layout change
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (Math.abs(w - lastW) > 2 || Math.abs(h - lastH) > 80) { clearTimeout(rsT); rsT = setTimeout(sampleTitle, 220); }
  });
  ro.observe(canvas);

  // ---------- title → golden dust ----------
  // Draw each word of the title with its own computed font onto an offscreen canvas, exactly where
  // the browser laid it out, sample the glyph pixels and turn them into view-space start points.
  const TEXT_DEPTH = 18;
  async function sampleTitle() {
    if (!title || !textIdx.length) return;
    const node = title.firstChild;
    if (!node || node.nodeType !== 3) return;
    const cs = getComputedStyle(title);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    try { await document.fonts.load(font, node.data); } catch (e) { /* draw with what is there */ }
    const cr = canvas.getBoundingClientRect(), W = Math.round(cr.width), H = Math.round(cr.height);
    if (!W || !H) return;
    lastW = canvas.clientWidth; lastH = canvas.clientHeight;
    const words = [];
    let i = 0;
    for (const w of node.data.split(' ')) {
      if (w) {
        const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + w.length);
        const rc = r.getBoundingClientRect();
        if (rc.width) words.push({ w, rc });
      }
      i += w.length + 1;
    }
    if (!words.length) return;
    const x0 = Math.max(0, Math.floor(Math.min(...words.map((o) => o.rc.left)) - cr.left - 8));
    const y0 = Math.max(0, Math.floor(Math.min(...words.map((o) => o.rc.top)) - cr.top - 8));
    const x1 = Math.min(W, Math.ceil(Math.max(...words.map((o) => o.rc.right)) - cr.left + 8));
    const y1 = Math.min(H, Math.ceil(Math.max(...words.map((o) => o.rc.bottom)) - cr.top + 8));
    const bw = x1 - x0, bh = y1 - y0;
    if (bw < 4 || bh < 4) return;
    const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.font = font; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
    for (const { w, rc } of words) {
      const m = g.measureText(w);
      const asc = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent * 1.15, desc = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent;
      const y = rc.top - cr.top - y0 + (rc.height - (asc + desc)) / 2 + asc;
      g.fillText(w, rc.right - cr.left - x0, y);
    }
    const data = g.getImageData(0, 0, bw, bh).data;
    let ink = 0;
    for (let k = 3; k < data.length; k += 4) if (data[k] > 110) ink++;
    const want = textIdx.length;
    const step = Math.max(1.4, Math.sqrt(ink / want));
    const smp = [];
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = step / 2; y < bh; y += step) for (let x = step / 2; x < bw; x += step) {
      const sx = Math.min(bw - 1, Math.max(0, Math.round(x + (rnd() - 0.5) * step * 0.7)));
      const sy = Math.min(bh - 1, Math.max(0, Math.round(y + (rnd() - 0.5) * step * 0.7)));
      if (data[(sy * bw + sx) * 4 + 3] > 110) smp.push(sx + x0, sy + y0);
    }
    const n = Math.min(want, smp.length / 2);
    const arr = textAttr.array;
    arr.fill(0);
    const fx = state.half * camera.aspect * TEXT_DEPTH, fy = state.half * TEXT_DEPTH;
    for (let k = 0; k < n; k++) {
      // samples are in reading order; take an even spread when there are more samples than particles
      const j = Math.floor((k * smp.length / 2) / n) * 2;
      const o = textIdx[k] * 4;
      arr[o] = (smp[j] / W * 2 - 1) * fx;
      arr[o + 1] = (1 - smp[j + 1] / H * 2) * fy;
      arr[o + 2] = -TEXT_DEPTH;
      arr[o + 3] = 1;
    }
    textAttr.needsUpdate = true;
    mat.uniforms.uTextPx.value = Math.min(4.2, Math.max(1.6, step * 1.25)) * dpr;
    state.textN = n;
    state.dust = n > 200;
  }
  sampleTitle();

  // ---------- pointer / gyro parallax (slow, gentle, time-based) ----------
  const onMove = (e) => { state.mx = (e.clientX / window.innerWidth) * 2 - 1; state.my = (e.clientY / window.innerHeight) * 2 - 1; };
  window.addEventListener('pointermove', onMove, { passive: true });
  const onTilt = (e) => { if (e.gamma == null) return; state.mx = Math.max(-1, Math.min(1, e.gamma / 40)); state.my = Math.max(-1, Math.min(1, (e.beta - 45) / 40)); };
  if (mobile && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', onTilt, { passive: true });
  }

  // ---------- adaptive quality: frame-time governor ----------
  // Steps down (fewer points, lower DPR) when the measured frame rate stays low; stops the scene
  // (the poster / photo take over) only if even the lightest setting cannot keep up.
  let frames = 0, acc = 0, level = 0, warm = 0;
  function govern(dt) {
    if (noGov || poster) return;
    warm += dt; if (warm < 1.2) return; // ignore start-up jank
    frames++; acc += dt;
    if (acc < 1.5) return;
    const fps = frames / acc; frames = 0; acc = 0;
    if (fps >= 48 || level >= 3) return;
    if (fps < 22 && level >= 2) { level = 3; stop(true); return; }
    level = fps < 15 ? 2 : level + 1; // very slow devices skip straight to the lightest setting
    const keep = level === 1 ? 0.7 : 0.48;
    dpr = level === 1 ? Math.max(1, dpr - 0.25) : 1;
    renderer.setPixelRatio(dpr); mat.uniforms.uPR.value = dpr; resize();
    geo.setDrawRange(0, Math.max(minDraw, Math.floor(N * keep)));
    warm = 0.6; // let the new setting settle before measuring again
  }

  const vtl = mat.uniforms.uViewToLocal.value;
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    render(clock.elapsedTime, dt);
    govern(dt);
  }
  function render(t, dt = 1 / 60) {
    const p = state.progress;
    const assemble = sm(...STAGE.assemble, p), orbit = sm(...STAGE.orbit, p), dissolve = state.holdDissolve ? 0 : sm(...STAGE.dissolve, p);
    const u = mat.uniforms;
    const tt = t * 0.7; // all ambient motion runs a little slower
    u.uTime.value = tt; u.uAssemble.value = assemble; u.uDissolve.value = dissolve;
    u.uTextIn.value = state.dust ? sm(...STAGE.textIn, p) : 0;
    // how much of the dust title still stands on the letters (the slowest particle: delay 1 → .3)
    const te = ease(Math.min(1, Math.max(0, (assemble - 0.126) / 0.58)));
    state.titleA = u.uTextIn.value * (1 - sm(0, 0.35, te));
    u.uIntensity.value = lerp(1.35, gain, assemble);
    ground.material.uniforms.uOpacity.value = assemble * assemble * (1 - dissolve);
    mass.userData.material.uniforms.uOpacity.value = sm(0.55, 1, assemble) * (1 - sm(0, 0.55, dissolve)) * 0.94;
    const kp = 1 - Math.exp(-dt * 1.1);
    state.cx += (state.mx - state.cx) * kp; state.cy += (state.my - state.cy) * kp;
    // assembled: 3/4 view from slightly above; orbit swings round to the frontal view of the render
    const swing = Math.sin(orbit * Math.PI) * 0.38;
    group.rotation.y = lerp(-0.62, -0.42, assemble) * (1 - orbit) + swing + Math.sin(tt * 0.08) * 0.02 * (1 - orbit) + (1 - assemble) * tt * 0.004;
    const F = state.final;
    // on tall screens the swing of the orbit shows the side walls too: step back a little mid-turn so the
    // whole building (wing to hall) stays inside the frame all the way to the photo
    const back = camera.aspect < 0.8 ? 1 + 0.14 * Math.sin(orbit * Math.PI) : 1;
    const d = lerp(state.dist * lerp(1.08, 1, assemble), F.z, orbit) * back;
    setDepth(mat, d); // depth cues are relative to the current framing
    const par = 1 - orbit; // pointer parallax fades out so the last frame lines up with the photo
    const drift = assemble * (1 - orbit);
    const dx = (Math.sin(tt * 0.093) * 0.9 + Math.sin(tt * 0.041) * 0.5) * drift, dy = Math.sin(tt * 0.067 + 1.3) * 0.3 * drift;
    const lx = lerp(1.6 * assemble, F.x, orbit); // the 3/4 turn brings the hall forward: recentre the mass
    camera.position.set(lx + state.cx * 1.3 * par + dx, lerp(lerp(7, 8.2, assemble), F.y, orbit) - state.cy * 0.6 * par + dy, d + Math.sin(tt * 0.05) * 0.6 * drift);
    camera.lookAt(lx, lerp(lerp(6.5, 5.2, assemble), F.y, orbit), 0);
    const shift = F.shift * orbit;
    if (state.shift == null || Math.abs(shift - state.shift) > 0.01) {
      state.shift = shift;
      if (Math.abs(shift) > 0.01) camera.setViewOffset(state.w, state.h, 0, -shift, state.w, state.h); else camera.clearViewOffset();
    }
    camera.updateMatrixWorld(); group.updateMatrixWorld();
    vtl.copy(group.matrixWorld).invert().multiply(camera.matrixWorld);
    renderer.render(scene, camera);
  }

  function start() { if (state.running || level === 3) return; state.running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  function pause() { state.running = false; cancelAnimationFrame(raf); }
  function stop(fromGovernor) {
    pause(); level = 3;
    canvas.classList.remove('is-live');
    if (onStop) onStop(fromGovernor ? 'fps' : 'manual');
  }

  const io = new IntersectionObserver(([en]) => { state.visible = en.isIntersecting; sync(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  function sync() { if (state.visible && !document.hidden) start(); else pause(); }

  if (poster) { render(4.2); } else { sync(); }
  requestAnimationFrame(() => canvas.classList.add('is-live'));

  return {
    setProgress(p) { state.progress = p; },
    get hasDust() { return state.dust; },
    get dustTitle() { return state.titleA || 0; },
    get points() { return { N, tier, drawn: Math.min(N, geo.drawRange.count), dpr, level, text: state.textN || 0 }; },
    resample: sampleTitle,
    // test runs only (main.js exposes this object on localhost): render one frame, optionally without the dissolve
    renderAt(p, t, { holdDissolve = false } = {}) { state.progress = p; state.holdDissolve = holdDissolve; render(t); state.holdDissolve = false; },
    stop,
    destroy() { pause(); ro.disconnect(); ground.geometry.dispose(); ground.material.dispose(); mass.userData.dispose(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove); window.removeEventListener('deviceorientation', onTilt); geo.dispose(); mat.dispose(); renderer.dispose(); },
  };
}
