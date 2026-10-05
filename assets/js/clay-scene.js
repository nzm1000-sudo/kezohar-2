// Partnership: a clay miniature of the complex. Choosing a tier drops that many soft clay bricks
// onto the donors' wall in front of the building (illustrative only, nothing is counted).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

// the hero's building (building.js) grown into a taller clay model, in metres: a three-storey long wing,
// a timber link and a four-storey prayer hall. Every storey is FLOOR_H tall and the cornice bands of
// wing and hall share the same heights, so the façades read as one exact grid.
const FLOOR_H = 1.5;
const VOL = [
  { x0: -10, x1: 1.95, h: 3 * FLOOR_H + 0.2, z0: -2, z1: 2.2, floors: 3 },     // long wing
  { x0: 1.95, x1: 3.95, h: 3 * FLOOR_H - 0.3, z0: -1.2, z1: 1.7, floors: 0 },  // link (a step lower)
  { x0: 3.95, x1: 10, h: 4 * FLOOR_H + 0.3, z0: -3.6, z1: 2.2, floors: 4 },    // prayer hall
];
const WING = VOL[0], LINK = VOL[1], HALL = VOL[2];
const WING_CX = (WING.x0 + WING.x1) / 2, HALL_CX = (HALL.x0 + HALL.x1) / 2, HALL_CZ = (HALL.z0 + HALL.z1) / 2;
const S = 0.42; // building scale inside the diorama

// what each tier places on the wall
const PLAN = {
  100: ['b0'],
  180: ['b0', 'h1'],
  360: ['b0', 'b1', 'b2'],
  560: ['b0', 'b1', 'b2', 'b3', 'b4', 'stone'],
  1080: ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'stone', 'crown'],
};

const LIGHT = { hemiSky: '#FFF3E4', hemiGround: '#C79F7C', hemi: 1.55, key: '#FFE4C8', keyI: 2.3, fill: 0.45, glow: 0.55, shadow: 0.22 };
const DARK = { hemiSky: '#B9A792', hemiGround: '#3A2A20', hemi: 0.55, key: '#FFC48E', keyI: 1.5, fill: 0.18, glow: 2.2, shadow: 0.42 };

function clayTexture(maxAniso) {
  // a soft, large-scale hand-pressed relief: broad thumb dents and gentle swells, no pixel noise
  // (per-pixel noise reads as speckle on a phone). Seeded, tileable (every blob is drawn with its wraps).
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, N, N);
  let seed = 11; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const blob = (cx, cy, r, v, a) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      x.fillStyle = g; x.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
    }
  };
  for (let i = 0; i < 70; i++) blob(R() * N, R() * N, 40 + R() * 90, R() < 0.5 ? 255 : 0, 0.05 + R() * 0.05); // swells and hollows
  for (let i = 0; i < 26; i++) blob(R() * N, R() * N, 14 + R() * 18, 0, 0.1);                            // thumb dents
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = Math.min(8, maxAniso);
  return t;
}

export function createClay(canvas, { mobile = false, tier = '360', dark = false, noGov = false, onStop } = {}) {
  // MSAA everywhere (the clay edges are long straight lines that stair-step without it); phones render at
  // up to 2× — the diorama is small and mostly still, and the governor below still guards the frame rate
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 2, 0.1, 200);
  const bump = clayTexture(renderer.capabilities.getMaxAnisotropy());
  const disposables = [bump];
  const mat = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, bumpMap: bump, bumpScale: 0.35, ...o }); disposables.push(m); return m; };
  const geoCache = new Map();
  const rbox = (w, h, d, r) => {
    const k = [w, h, d, r].map((v) => v.toFixed(3)).join();
    if (!geoCache.has(k)) { const g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) * 0.999); geoCache.set(k, g); disposables.push(g); }
    return geoCache.get(k);
  };
  const mesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; };

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemi);
  const key = new THREE.DirectionalLight(LIGHT.key, LIGHT.keyI);
  key.position.set(-7, 11, 9); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.radius = 4; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.06; // no acne on the rounded edges
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -5, near: 1, far: 40 });
  const fill = new THREE.DirectionalLight('#D4DCEB', LIGHT.fill); fill.position.set(8, 4, 6);
  scene.add(hemi, key, fill);

  // ---- materials (matte earth clay) ----
  const M = {
    stone: mat('#EADCC6'), stoneTop: mat('#F2E8D8'), plinth: mat('#E4CFB1'), base: mat('#D9BC98'),
    wood: mat('#A8693F'), sage: mat('#97A685'), sageDark: mat('#7E8D6C'), trunk: mat('#9B7356'),
    glow: mat('#E58A4E', { emissive: new THREE.Color('#FF9A55'), emissiveIntensity: LIGHT.glow, roughness: 0.7 }),
    portal: mat('#6E4430', { emissive: new THREE.Color('#FF8A45'), emissiveIntensity: LIGHT.glow * 0.6 }),
    copper: mat('#C77A45', { roughness: 0.5, metalness: 0.15, bumpScale: 0.2, emissive: new THREE.Color('#5A2A10'), emissiveIntensity: 0.25 }),
    bricks: ['#C9805A', '#E6D2B3', '#DDB5A2', '#A9B596', '#D8A47C'].map((c) => mat(c)),
  };

  const world = new THREE.Group(); scene.add(world);
  // the soft ground catches contact shadows on the CSS clay panel behind the transparent canvas
  const shadowMat = new THREE.ShadowMaterial({ opacity: LIGHT.shadow }); disposables.push(shadowMat);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), shadowMat); disposables.push(ground.geometry);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);

  // puffy plinth (two stacked rounded slabs)
  const plinth = mesh(rbox(12.2, 0.5, 6.6, 0.25), M.base); plinth.position.set(0, 0.25, 0.55);
  const plinthTop = mesh(rbox(11.6, 0.3, 6.0, 0.15), M.plinth); plinthTop.position.set(0, 0.6, 0.55);
  world.add(plinth, plinthTop);
  const FLOOR = 0.75;

  // ---- the building ----
  const bld = new THREE.Group(); bld.position.set(0.2, FLOOR, -0.6); world.add(bld);
  const squishy = []; // parts that respond to a poke
  for (const v of VOL) {
    const w = (v.x1 - v.x0) * S, h = v.h * S, d = (v.z1 - v.z0) * S;
    const m = mesh(rbox(w, h, d, 0.2), M.stone); m.position.set((v.x0 + v.x1) / 2 * S, h / 2, (v.z0 + v.z1) / 2 * S);
    const cap = mesh(rbox(w + 0.1, 0.14, d + 0.1, 0.07), M.stoneTop); cap.position.set(m.position.x, h + 0.03, m.position.z);
    bld.add(m, cap); squishy.push(m);
    // cornice bands between the storeys, at the same heights on the wing and the hall
    for (let f = 1; f < v.floors; f++) {
      const band = mesh(rbox(w + 0.06, 0.07, d + 0.06, 0.035), M.stoneTop, false); band.position.set(m.position.x, f * FLOOR_H * S, m.position.z);
      m.add(band); band.position.sub(m.position);
    }
  }
  const front = (z1) => z1 * S + 0.02;
  // window slits: one exact grid on every storey of the wing — nine columns, 1.1 m apart, mirrored about
  // the façade's centre line — each slit centred in its storey
  const SLIT_H = 0.9, slitG = rbox(0.12, SLIT_H * S, 0.08, 0.05);
  for (let f = 0; f < WING.floors; f++) for (let i = -4; i <= 4; i++) {
    const sl = mesh(slitG, M.glow, false); sl.position.set((WING_CX + i * 1.1) * S, (f + 0.55) * FLOOR_H * S, front(WING.z1)); bld.add(sl);
  }
  // the link: one tall timber screen, centred
  const screen = mesh(rbox(1.6 * S, (LINK.h - 0.6) * S, 0.1, 0.06), M.wood, false); screen.position.set((LINK.x0 + LINK.x1) / 2 * S, (LINK.h - 0.6) / 2 * S + 0.05, front(LINK.z1)); bld.add(screen);
  // hall front: the arched portal centred on the façade in the ground storeys, three slits per upper storey
  for (let f = 2; f < HALL.floors; f++) for (const dx of [-1.8, 0, 1.8]) {
    const sl = mesh(slitG, M.glow, false); sl.position.set((HALL_CX + dx) * S, (f + 0.55) * FLOOR_H * S, front(HALL.z1)); bld.add(sl);
  }
  // hall side: three slits per storey, mirrored about the side wall's centre
  const sideG = rbox(0.08, SLIT_H * S, 0.12, 0.04);
  for (let f = 1; f < HALL.floors; f++) for (const dz of [-1.7, 0, 1.7]) {
    const sl = mesh(sideG, M.glow, false); sl.position.set(HALL.x1 * S + 0.02, (f + 0.55) * FLOOR_H * S, (HALL_CZ + dz) * S); bld.add(sl);
  }
  const portal = new THREE.Group(); portal.position.set(HALL_CX * S, 0, front(HALL.z1));
  const pw = 1.92 * S, PH = 2 * FLOOR_H - 0.12; // the frame stops just under the second cornice
  const pFrame = mesh(rbox(pw + 0.22, PH * S, 0.12, 0.06), M.stoneTop, false); pFrame.position.y = PH * S / 2;
  const pDoor = mesh(rbox(0.62 * 2 * S, 2.1 * S, 0.1, 0.05), M.portal, false); pDoor.position.set(0, 2.1 * S / 2, 0.04);
  const arcG = new THREE.CylinderGeometry(0.62 * S, 0.62 * S, 0.1, 32, 1, false, 0, Math.PI); disposables.push(arcG);
  const pArc = mesh(arcG, M.portal, false); pArc.rotation.set(Math.PI / 2, 0, -Math.PI / 2); pArc.position.set(0, 2.1 * S, 0.04);
  portal.add(pFrame, pDoor, pArc); bld.add(portal);

  // olive trees: chunky clay puffs
  function tree(x, z, s) {
    const g = new THREE.Group(); g.position.set(x, FLOOR, z); g.scale.setScalar(s);
    const trunkG = new THREE.CylinderGeometry(0.08, 0.13, 0.9, 8); disposables.push(trunkG);
    const t = mesh(trunkG, M.trunk); t.position.y = 0.45; g.add(t);
    const puffG = new THREE.SphereGeometry(0.42, 18, 14); disposables.push(puffG);
    [[0, 1.15, 0, 1], [0.32, 1.0, 0.1, 0.78], [-0.3, 1.02, -0.05, 0.8], [0.05, 1.42, 0.05, 0.7]].forEach(([px, py, pz, ps], i) => {
      const p = mesh(puffG, i % 2 ? M.sageDark : M.sage); p.position.set(px, py, pz); p.scale.set(ps, ps * 0.86, ps); g.add(p);
    });
    world.add(g); squishy.push(g); return g;
  }
  tree(-5.2, 2.0, 1.05); tree(5.25, 2.3, 0.9); tree(4.3, 2.9, 0.62);

  // ---- donors' wall: bricks drop onto a low clay ledge in front of the long wing ----
  const ledge = mesh(rbox(5.4, 0.22, 0.9, 0.1), M.base); ledge.position.set(-2.55, FLOOR + 0.11, 2.45); world.add(ledge);
  const BW = 0.8, BH = 0.38, BD = 0.46, ROW0 = FLOOR + 0.22;
  const slots = {};
  for (let i = 0; i < 10; i++) {
    const row = i < 5 ? 0 : 1, col = i % 5;
    slots['b' + i] = { x: -4.62 + col * (BW + 0.08) + (row ? (BW + 0.08) / 2 : 0), y: ROW0 + BH / 2 + row * (BH + 0.05), z: 2.45, w: BW, mat: M.bricks[(i * 3 + row) % 5] };
  }
  slots.h1 = { ...slots.b1, x: slots.b1.x - BW / 4, w: BW / 2 - 0.02, mat: M.bricks[1] };
  const items = {};
  function makeItem(id) {
    let o;
    if (id === 'stone') {
      o = new THREE.Group();
      const block = mesh(rbox(1.25, 0.82, 0.7, 0.18), M.stoneTop);
      const band = mesh(rbox(1.27, 0.13, 0.72, 0.06), M.copper, false);
      const medalG = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20); disposables.push(medalG);
      const medal = mesh(medalG, M.copper, false); medal.rotation.x = Math.PI / 2; medal.position.z = 0.37;
      o.add(block, band, medal); o.userData.h = 0.82; o.userData.home = new THREE.Vector3(0.05, FLOOR + 0.41, 2.6);
    } else if (id === 'crown') {
      o = new THREE.Group();
      const ringG = new THREE.CylinderGeometry(0.42, 0.46, 0.22, 24, 1, true); disposables.push(ringG);
      const ring = mesh(ringG, M.copper); ring.material.side = THREE.DoubleSide; o.add(ring);
      const spikeG = new THREE.ConeGeometry(0.09, 0.3, 10); disposables.push(spikeG);
      const ballG = new THREE.SphereGeometry(0.06, 10, 8); disposables.push(ballG);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const sp = mesh(spikeG, M.copper); sp.position.set(Math.cos(a) * 0.42, 0.24, Math.sin(a) * 0.42); o.add(sp);
        const b = mesh(ballG, M.copper); b.position.set(Math.cos(a) * 0.42, 0.42, Math.sin(a) * 0.42); o.add(b);
      }
      o.userData.h = 0.5; o.userData.home = new THREE.Vector3(bld.position.x + HALL_CX * S, FLOOR + HALL.h * S + 0.21, bld.position.z + HALL_CZ * S); // centred on the hall roof
    } else {
      const s = slots[id];
      o = mesh(rbox(s.w, BH, BD, 0.11), s.mat); o.userData.h = BH; o.userData.home = new THREE.Vector3(s.x, s.y, s.z);
      o.rotation.y = (Math.random() - 0.5) * 0.06;
    }
    o.position.copy(o.userData.home); o.visible = false; world.add(o);
    return o;
  }

  // ---- motion: drop with stretch, squash on landing, settle with a damped spring ----
  const anims = new Map(); // object → { kind, t0 }
  let clockT = 0;
  function drop(o, delay) { o.visible = true; anims.set(o, { kind: 'drop', t0: clockT + delay }); }
  function lift(o, delay) { anims.set(o, { kind: 'out', t0: clockT + delay }); }
  function poke(o) { anims.set(o, { kind: 'poke', t0: clockT }); }
  const FALL = 0.5, H0 = 4.2;
  function animate() {
    for (const [o, a] of anims) {
      const u = clockT - a.t0; const home = o.userData.home, h = o.userData.h || 1;
      if (u < 0) { if (a.kind === 'drop') o.scale.setScalar(0.0001); continue; }
      if (a.kind === 'drop') {
        if (u < FALL) {
          const f = u / FALL;
          o.position.set(home.x, home.y + H0 * (1 - f * f), home.z);
          o.scale.set(0.92, 1.12, 0.92);
        } else {
          const v = u - FALL, sq = Math.exp(-v * 6.5) * Math.cos(v * 17) * 0.3;
          o.scale.set(1 + sq * 0.55, 1 - sq, 1 + sq * 0.55);
          o.position.set(home.x, home.y - sq * h / 2, home.z);
          if (v > 1.4) { o.scale.set(1, 1, 1); o.position.copy(home); anims.delete(o); }
        }
      } else if (a.kind === 'out') {
        const f = Math.min(1, u / 0.32), e = f * f;
        o.scale.setScalar(Math.max(0.0001, 1 - e) * (1 + Math.sin(f * Math.PI) * 0.15));
        o.position.set(home.x, home.y + e * 0.6, home.z);
        if (f >= 1) { o.visible = false; o.scale.set(1, 1, 1); o.position.copy(home); anims.delete(o); }
      } else if (a.kind === 'poke') {
        const sq = Math.exp(-u * 6) * Math.sin(u * 20) * 0.12;
        o.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
        if (u > 1.2) { o.scale.set(1, 1, 1); anims.delete(o); }
      }
    }
  }

  let current = [];
  function setTier(v, first = false) {
    const want = PLAN[v] || PLAN[360];
    const going = current.filter((id) => !want.includes(id));
    const coming = want.filter((id) => !current.includes(id));
    going.forEach((id, i) => lift(items[id], i * 0.03));
    coming.forEach((id, i) => { items[id] = items[id] || makeItem(id); drop(items[id], (first ? 0.35 : going.length ? 0.18 : 0) + i * 0.14); });
    current = want.slice();
  }

  // ---- framing ----
  const view = { dist: 20, mx: 0, my: 0, cx: 0, cy: 0 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // fit the plinth and trees sideways and the taller hall (with its crown) upright, at any panel shape
    view.dist = Math.max(13, 7.4 / (t * Math.min(camera.aspect, 2.4)), 5.1 / t);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const onMove = (e) => { const r = canvas.getBoundingClientRect(); view.mx = ((e.clientX - r.left) / r.width) * 2 - 1; view.my = ((e.clientY - r.top) / r.height) * 2 - 1; };
  canvas.addEventListener('pointermove', onMove, { passive: true });
  // poke: a tap squishes whatever clay is under the pointer
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const onDown = (e) => {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = [...squishy, ...Object.values(items).filter((o) => o.visible)];
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return;
    let o = hit.object; while (o.parent && !targets.includes(o)) o = o.parent;
    if (!anims.has(o)) poke(o);
  };
  canvas.addEventListener('pointerdown', onDown, { passive: true });

  function setTheme(d) {
    const P = d ? DARK : LIGHT;
    hemi.color.set(P.hemiSky); hemi.groundColor.set(P.hemiGround); hemi.intensity = P.hemi;
    key.color.set(P.key); key.intensity = P.keyI; fill.intensity = P.fill;
    M.glow.emissiveIntensity = P.glow; M.portal.emissiveIntensity = P.glow * 0.6; shadowMat.opacity = P.shadow;
  }
  setTheme(dark);

  // ---- loop, visibility and a frame-rate governor (falls back to the static clay art) ----
  const clock = new THREE.Clock();
  let raf = 0, running = false, visible = false, frames = 0, acc = 0, slow = 0, dead = false;
  function render() {
    animate();
    const t = clockT;
    view.cx += (view.mx - view.cx) * 0.05; view.cy += (view.my - view.cy) * 0.05;
    const yaw = -0.36 + view.cx * 0.12 + Math.sin(t * 0.12) * 0.05;
    const pitch = 0.36 - view.cy * 0.05 + Math.sin(t * 0.09) * 0.015;
    camera.position.set(Math.sin(yaw) * view.dist * Math.cos(pitch), Math.sin(pitch) * view.dist + 1.4, Math.cos(yaw) * view.dist * Math.cos(pitch));
    camera.lookAt(0, 1.75, 0.6);
    renderer.render(scene, camera);
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1); clockT += dt;
    render();
    if (noGov) return;
    frames++; acc += dt;
    if (acc > 2.5) { if (frames / acc < 24) slow++; else slow = 0; frames = 0; acc = 0; if (slow > 1) stop(); }
  }
  function start() { if (running || dead) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  function pause() { running = false; cancelAnimationFrame(raf); }
  function stop() { pause(); dead = true; canvas.parentElement.classList.remove('is-live'); if (onStop) onStop(); }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
  io.observe(canvas);
  const sync = () => (visible && !document.hidden ? start() : pause());
  document.addEventListener('visibilitychange', sync);

  setTier(String(tier), true);
  render();
  canvas.parentElement.classList.add('is-live');

  return {
    setTier: (v) => setTier(String(v)),
    setTheme,
    // test runs only: advance the simulated clock in small steps, then draw one frame
    advance(sec) { for (let i = 0; i < sec * 60; i++) { clockT += 1 / 60; animate(); } render(); },
    destroy() { pause(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', sync); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); disposables.forEach((d) => d.dispose && d.dispose()); renderer.dispose(); },
  };
}
