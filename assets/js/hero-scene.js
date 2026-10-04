// Hero: desert dust → a building of light → slight orbit → dissolves into the photo.
import * as THREE from 'three';
import { buildCloud, makeMass, makeMaterial, makeGroundGlow, setDepth, skyTexture } from './building.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// noGov: disables the FPS governor (only passed by local test runs on software GL).
// photo: the <img> of the dawn render the scene dissolves into; its cover-fit crop sets the final framing.
export function createHero(canvas, { mobile = false, poster = false, noGov = false, photo = null, onStop } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: poster });
  let dprCap = mobile ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  const N = mobile ? 16000 : 34000;
  const geo = buildCloud(N);
  const mat = makeMaterial({ size: mobile ? 2.3 : 2.7, pr: dpr });
  // the building covers far more screen pixels on desktop than on a phone: lift the gain there
  const gain = mobile ? 0.92 : 1.32;
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const ground = makeGroundGlow(), mass = makeMass();
  const group = new THREE.Group();
  group.add(ground, mass, pts);
  group.position.set(0.1, 0, 0);
  scene.add(group);

  // Where the building sits in the 1376×768 dawn render: centre x, ground line y, px per metre
  // (20 m wide wing-to-hall = 1143 px). The final camera reproduces the photo's cover-fit crop.
  const PHOTO = { w: 1376, h: 768, cx: 696.5, base: 645, ppu: 57.15 };
  function photoPose(w, h) {
    let ox = 0.5, oy = 0.78;
    if (photo) {
      const op = getComputedStyle(photo).objectPosition.split(' ').map(parseFloat);
      if (op.length === 2 && op.every((v) => !Number.isNaN(v))) { ox = op[0] / 100; oy = op[1] / 100; }
    }
    const s = Math.max(w / PHOTO.w, h / PHOTO.h), ppu = PHOTO.ppu * s;
    const sx = (w - PHOTO.w * s) * ox + PHOTO.cx * s, sy = (h - PHOTO.h * s) * oy + PHOTO.base * s;
    return { x: group.position.x - (sx - w / 2) / ppu, y: (sy - h / 2) / ppu, z: 2.2 + h / (2 * state.half * ppu) };
  }

  const state = { progress: 0, mx: 0, my: 0, cx: 0, cy: 0, running: false, visible: true, dist: 34, baseSize: mat.uniforms.uSize.value };
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    state.half = Math.tan(half);
    state.dist = Math.max(30, (camera.aspect < 1 ? 11.6 : 14) / state.half / camera.aspect);          // assembled framing (≈28 units wide)
    state.final = photoPose(w, h);                                        // final framing = the photo
    mat.uniforms.uSize.value = state.baseSize * (state.dist / 30);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  // pointer / gyro parallax
  const onMove = (e) => { state.mx = (e.clientX / window.innerWidth) * 2 - 1; state.my = (e.clientY / window.innerHeight) * 2 - 1; };
  window.addEventListener('pointermove', onMove, { passive: true });
  const onTilt = (e) => { if (e.gamma == null) return; state.mx = Math.max(-1, Math.min(1, e.gamma / 30)); state.my = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); };
  if (mobile && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', onTilt, { passive: true });
  }

  // FPS governor
  let frames = 0, acc = 0, level = 0, warm = 0;
  function govern(dt) {
    if (noGov) return;
    warm += dt; if (warm < 1.5) return; // ignore start-up jank
    frames++; acc += dt;
    if (acc < 2) return;
    const fps = frames / acc; frames = 0; acc = 0;
    if (fps < 42 && level === 0) {
      level = 1; dprCap = 1; dpr = 1; renderer.setPixelRatio(1); mat.uniforms.uPR.value = 1; resize();
      geo.setDrawRange(0, Math.floor(N * 0.55));
    } else if (fps < 24 && level === 1) {
      level = 2; stop(true);
    }
  }

  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    render(t);
    govern(dt);
  }
  function render(t) {
    const p = state.progress;
    // stage map (520vh): dust gathers 3–30%, orbit to the photo's viewpoint 32–62%, then a long dissolve
    // 55–97% that overlaps the photo cross-fade driven by main.js (50–94%), so light and stone coexist
    const assemble = sm(0.03, 0.3, p), orbit = sm(0.32, 0.62, p), dissolve = state.holdDissolve ? 0 : sm(0.55, 0.97, p);
    const u = mat.uniforms;
    u.uTime.value = t; u.uAssemble.value = assemble; u.uDissolve.value = dissolve;
    u.uIntensity.value = lerp(1.35, gain, assemble);
    ground.material.uniforms.uOpacity.value = assemble * assemble * (1 - dissolve);
    mass.userData.material.uniforms.uOpacity.value = sm(0.55, 1, assemble) * (1 - sm(0, 0.55, dissolve)) * 0.94;
    state.cx += (state.mx - state.cx) * 0.04; state.cy += (state.my - state.cy) * 0.04;
    // assembled: 3/4 view from slightly above; orbit swings round to the frontal view of the render
    const swing = Math.sin(orbit * Math.PI) * 0.38;
    group.rotation.y = lerp(-0.62, -0.42, assemble) * (1 - orbit) + swing + Math.sin(t * 0.08) * 0.02 * (1 - orbit) + (1 - assemble) * t * 0.004;
    const F = state.final;
    const d = lerp(state.dist * lerp(1.08, 1, assemble), F.z, orbit);
    setDepth(mat, d); // depth cues are relative to the current framing
    const par = 1 - orbit; // pointer parallax fades out so the last frame lines up with the photo
    // slow, subtle camera drift while the building stands assembled
    const drift = assemble * (1 - orbit);
    const dx = (Math.sin(t * 0.093) * 0.9 + Math.sin(t * 0.041) * 0.5) * drift, dy = Math.sin(t * 0.067 + 1.3) * 0.3 * drift;
    const lx = lerp(1.6 * assemble, F.x, orbit); // the 3/4 turn brings the hall forward: recentre the mass
    camera.position.set(lx + state.cx * 2.2 * par + dx, lerp(lerp(7, 8.2, assemble), F.y, orbit) - state.cy * 1.0 * par + dy, d + Math.sin(t * 0.05) * 0.6 * drift);
    camera.lookAt(lx, lerp(lerp(6.5, 5.2, assemble), F.y, orbit), 0);
    renderer.render(scene, camera);
  }

  function start() { if (state.running || level === 2) return; state.running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  function pause() { state.running = false; cancelAnimationFrame(raf); }
  function stop(fromGovernor) {
    pause(); level = 2;
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
    // test runs only (main.js exposes this object on localhost): render one frame, optionally without the dissolve
    renderAt(p, t, { holdDissolve = false } = {}) { state.progress = p; state.holdDissolve = holdDissolve; render(t); state.holdDissolve = false; },
    stop,
    destroy() { pause(); ro.disconnect(); ground.geometry.dispose(); ground.material.dispose(); mass.userData.dispose(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove); window.removeEventListener('deviceorientation', onTilt); geo.dispose(); mat.dispose(); renderer.dispose(); },
  };
}
