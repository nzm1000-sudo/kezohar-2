// Partnership: choosing a tier ignites a cluster of the building's points (illustrative only).
import * as THREE from 'three';
import { buildCloud, makeMaterial, skyTexture } from './building.js';

export const SEEDS = {
  100: { seed: [-8.4, 2.6, 2.2], r: 1.2 },
  180: { seed: [-4.4, 1.0, 2.2], r: 1.7 },
  360: { seed: [-1.0, 2.4, 2.2], r: 2.6 },
  560: { seed: [7.1, 1.8, 2.2], r: 3.4 },
  1080: { seed: [0.0, 2.5, 0.0], r: 14 },
};

export function createIgnite(canvas, { mobile = false, tier = '360' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 200);
  const N = mobile ? 7000 : 12000;
  const geo = buildCloud(N, 23);
  const mat = makeMaterial({ size: 2.4, pr: dpr });
  mat.uniforms.uAssemble.value = 1; mat.uniforms.uIgnite.value = 1;
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  const group = new THREE.Group(); group.add(pts); scene.add(group);

  const target = { r: SEEDS[tier].r, seed: new THREE.Vector3(...SEEDS[tier].seed) };
  mat.uniforms.uRadius.value = 0.01; mat.uniforms.uSeed.value.copy(target.seed);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const dist = Math.max(26, 11.2 / Math.tan(half) / camera.aspect);
    camera.position.set(-5, 7, dist); camera.lookAt(0, 2.2, 0); camera.updateProjectionMatrix();
    mat.uniforms.uSize.value = 2.5 * (dist / 26);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  const clock = new THREE.Clock();
  let raf = 0, running = false, visible = false, frames = 0, acc = 0, slow = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    const u = mat.uniforms;
    u.uTime.value = t;
    u.uRadius.value += (target.r - u.uRadius.value) * 0.06;
    u.uSeed.value.lerp(target.seed, 0.08);
    group.rotation.y = -0.18 + Math.sin(t * 0.15) * 0.12;
    renderer.render(scene, camera);
    frames++; acc += dt;
    if (acc > 2.5) { if (frames / acc < 24) slow++; frames = 0; acc = 0; if (slow > 1) { pause(); canvas.parentElement.classList.remove('is-live'); } }
  }
  function start() { if (running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  function pause() { running = false; cancelAnimationFrame(raf); }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
  io.observe(canvas);
  const sync = () => (visible && !document.hidden ? start() : pause());
  document.addEventListener('visibilitychange', sync);
  canvas.parentElement.classList.add('is-live');

  return {
    setTier(v) {
      const s = SEEDS[v]; if (!s) return;
      target.r = s.r; target.seed.set(...s.seed);
      mat.uniforms.uRadius.value = Math.min(mat.uniforms.uRadius.value, 0.6);
    },
  };
}
