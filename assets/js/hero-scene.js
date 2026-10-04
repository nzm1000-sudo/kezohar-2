// Hero: desert dust → a building of light → slight orbit → dissolves into the photo.
import * as THREE from 'three';
import { buildCloud, makeMaterial, skyTexture } from './building.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createHero(canvas, { mobile = false, poster = false, onStop } = {}) {
  const noGov = /[?&]nogov/.test(location.search); // test hook for software-GL screenshots
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: poster });
  let dprCap = mobile ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  const N = mobile ? 16000 : 34000;
  const geo = buildCloud(N);
  const mat = makeMaterial({ size: mobile ? 2.6 : 2.3, pr: dpr });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const group = new THREE.Group();
  group.add(pts);
  group.position.set(0.1, 0, 0);
  scene.add(group);

  const state = { progress: 0, mx: 0, my: 0, cx: 0, cy: 0, running: false, visible: true, dist: 34, baseSize: mat.uniforms.uSize.value };
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    state.half = Math.tan(half);
    state.dist = Math.max(30, (camera.aspect < 1 ? 11.6 : 14) / state.half / camera.aspect);          // assembled framing (≈28 units wide)
    state.near = Math.max(23, 10.75 / state.half / camera.aspect);       // final framing ≈ the photo
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
    const assemble = sm(0.05, 0.5, p), orbit = sm(0.4, 0.78, p), dissolve = sm(0.72, 0.93, p);
    const u = mat.uniforms;
    u.uTime.value = t; u.uAssemble.value = assemble; u.uDissolve.value = dissolve;
    u.uIntensity.value = lerp(1.35, 1, assemble);
    state.cx += (state.mx - state.cx) * 0.04; state.cy += (state.my - state.cy) * 0.04;
    // assembled: 3/4 view from slightly above; orbit swings round to the frontal view of the render
    const swing = Math.sin(orbit * Math.PI) * 0.38;
    group.rotation.y = lerp(-0.62, -0.32, assemble) * (1 - orbit) + swing + Math.sin(t * 0.08) * 0.02 * (1 - orbit) + (1 - assemble) * t * 0.004;
    const d = lerp(state.dist * lerp(1.08, 1, assemble), state.near, orbit);
    const par = 1 - orbit * 0.7;
    camera.position.set(state.cx * 2.2 * par, lerp(lerp(7, 6, assemble), 1.6, orbit) - state.cy * 1.0 * par, d);
    camera.lookAt(0, lerp(lerp(6.5, 5.2, assemble), 4.4, orbit), 0);
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
    renderAt(p, t) { state.progress = p; render(t); },
    stop,
    destroy() { pause(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove); window.removeEventListener('deviceorientation', onTilt); geo.dispose(); mat.dispose(); renderer.dispose(); },
  };
}
