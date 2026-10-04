/*
 * Hero 3D scene: the complex at night, lit window by window.
 * Procedural illustration (no architectural model exists yet) — captioned "המחשה" in the DOM.
 * The canvas never holds essential text; everything here is aria-hidden decoration.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, Group, Mesh, Points, InstancedMesh,
  HemisphereLight, DirectionalLight, PointLight, MeshStandardMaterial, ShaderMaterial,
  BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, ConeGeometry, ShapeGeometry, Shape,
  BufferGeometry, BufferAttribute, InstancedBufferAttribute, Object3D, Vector2, Vector3,
  TextureLoader, SRGBColorSpace, ACESFilmicToneMapping, AdditiveBlending, BackSide, MathUtils,
  EffectComposer, RenderPass, UnrealBloomPass, OutputPass, mergeGeometries, WebGLRenderTarget, HalfFloatType,
} from 'three-kit';

const css = getComputedStyle(document.documentElement);
const tok = (name) => new Color(css.getPropertyValue(name).trim());
const C = {
  night: tok('--night'),
  nightDeep: tok('--night-deep'),
  stone: tok('--stone'),
  windowOff: tok('--window-off'),
  gold: tok('--gold'),
  goldSoft: tok('--gold-soft'),
  moon: tok('--on-midnight-muted'),
  teal: tok('--teal'),
  starA: tok('--on-midnight'),
};

// Building dimensions (meters, roughly)
const W = 24, D = 12, FH = 3.6, FLOORS = 3, H = FH * FLOORS;
const WIN_W = 1.3, WIN_H = 2.3;
const FRONT_COLS = 9;

function archShape(w, h) {
  const r = w / 2;
  const s = new Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return s;
}

function archGeometry(w, h, segments = 16) {
  const g = new ShapeGeometry(archShape(w, h), segments);
  // Normalised UVs (0..1 over the bounding box) so photos map cleanly.
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + w / 2) / w;
    uv[i * 2 + 1] = pos.getY(i) / h;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

/* ---------- Window layout ---------- */
function buildWindowList() {
  const list = [];
  const step = W / FRONT_COLS;
  for (let f = 0; f < FLOORS; f++) {
    const y = f * FH + 0.75;
    for (let c = 0; c < FRONT_COLS; c++) {
      const x = -W / 2 + step * (c + 0.5);
      if (f === 0 && c === 4) continue; // entrance
      list.push({ face: 'front', floor: f, col: c, pos: new Vector3(x, y, D / 2 + 0.03), rotY: 0, sx: 1, sy: 1 });
    }
  }
  // Entrance door (counts as a light, lit last on the ground floor)
  list.push({ face: 'front', floor: 0, col: 4, door: true, pos: new Vector3(0, 0.45, D / 2 + 1.63), rotY: 0, sx: 1.9, sy: 1.55 });
  // Side facades
  for (const side of [-1, 1]) {
    for (let f = 0; f < FLOORS; f++) {
      for (let k = 0; k < 4; k++) {
        const z = -D / 2 + 1.5 + k * 3;
        list.push({ face: side < 0 ? 'left' : 'right', floor: f, col: k, pos: new Vector3(side * (W / 2 + 0.03), f * FH + 0.75, z), rotY: side * Math.PI / 2, sx: 1, sy: 1 });
      }
    }
  }
  return list;
}

function makeStars(count, isMobile) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  const tint = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Upper hemisphere of a large dome, denser near the zenith.
    const u = Math.random();
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - u * 0.92); // 0 (zenith) .. ~85deg
    const r = 160;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) + 6;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 40;
    seed[i] = Math.random() * 100;
    size[i] = (Math.random() ** 3) * 2.2 + 0.7;
    tint[i] = Math.random() < 0.12 ? 1 : 0;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new BufferAttribute(seed, 1));
  g.setAttribute('aSize', new BufferAttribute(size, 1));
  g.setAttribute('aTint', new BufferAttribute(tint, 1));
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixel: { value: isMobile ? 1.0 : 1.4 },
      uColA: { value: C.starA },
      uColB: { value: C.goldSoft },
      uFade: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed; attribute float aSize; attribute float aTint;
      uniform float uTime; uniform float uPixel;
      varying float vAlpha; varying float vTint;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // slow twinkle
        vAlpha = 0.55 + 0.45 * sin(uTime * (0.35 + fract(aSeed) * 0.6) + aSeed);
        vTint = aTint;
        gl_PointSize = aSize * uPixel;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColA; uniform vec3 uColB; uniform float uFade;
      varying float vAlpha; varying float vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha * uFade;
        gl_FragColor = vec4(mix(uColA, uColB, vTint), a);
      }`,
  });
  return new Points(g, m);
}

function makeSky() {
  const g = new SphereGeometry(300, 24, 12);
  const m = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: C.nightDeep }, uHorizon: { value: C.night } },
    vertexShader: /* glsl */`
      varying float vY;
      void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uHorizon; varying float vY;
      void main() { gl_FragColor = vec4(mix(uHorizon, uTop, smoothstep(0.0, 0.6, vY)), 1.0); }`,
  });
  return new Mesh(g, m);
}

function windowMaterial(reflect = 0) {
  return new ShaderMaterial({
    transparent: reflect > 0,
    depthWrite: reflect === 0,
    uniforms: {
      uLight: { value: 0 },
      uOff: { value: C.windowOff },
      uOn: { value: C.goldSoft },
      uWarm: { value: C.gold },
      uBoost: { value: 1.4 },
      uReflect: { value: reflect },
    },
    vertexShader: /* glsl */`
      attribute float aThreshold; attribute float aEnabled; attribute float aSeed;
      uniform float uLight;
      varying float vLight; varying vec2 vUv; varying float vSeed; varying float vDepth;
      void main() {
        vLight = aEnabled * smoothstep(aThreshold, aThreshold + 0.035, uLight);
        vUv = uv; vSeed = aSeed;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vDepth = world.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uOff; uniform vec3 uOn; uniform vec3 uWarm; uniform float uBoost; uniform float uReflect;
      varying float vLight; varying vec2 vUv; varying float vSeed; varying float vDepth;
      void main() {
        // warm interior: brighter low in the window, a soft vertical mullion
        float grad = mix(1.15, 0.8, vUv.y);
        float mullion = smoothstep(0.0, 0.03, abs(vUv.x - 0.5));
        vec3 lit = mix(uWarm, uOn, 0.55 + 0.45 * vUv.y) * uBoost * grad * (0.9 + 0.1 * fract(vSeed * 7.3));
        vec3 col = mix(uOff, lit, vLight) * mix(0.75, 1.0, mullion);
        float alpha = uReflect > 0.0 ? uReflect * (0.35 + 0.65 * vLight) * exp(vDepth * 0.32) : 1.0;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

function portalMaterial(texture, cropX) {
  texture.colorSpace = SRGBColorSpace;
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: texture },
      uOpacity: { value: 0 },
      uCrop: { value: cropX },
      uWidth: { value: 0.32 },
      uFrame: { value: C.gold },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform float uOpacity; uniform float uCrop; uniform float uWidth; uniform vec3 uFrame;
      varying vec2 vUv;
      void main() {
        vec2 uv = vec2(uCrop + (vUv.x - 0.5) * uWidth, 0.06 + vUv.y * 0.9);
        vec4 tex = texture2D(uMap, uv);
        // thin gold edge along the arch
        float edge = min(min(vUv.x, 1.0 - vUv.x), vUv.y);
        float rim = 1.0 - smoothstep(0.0, 0.025, edge);
        vec3 col = mix(tex.rgb, uFrame * 1.4, rim);
        gl_FragColor = vec4(col, uOpacity);
        #include <colorspace_fragment>
      }`,
  });
}

/* ---------- Public API ---------- */
export async function startScene(opts) {
  const { mount, stage, track, steps, visionNote, campaignFraction, isMobile, lowPower, force, posterMode, reduceMotion, onFail } = opts;
  const { gsap, ScrollTrigger } = await import('gsap-kit');

  const renderer = new WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.setAttribute('tabindex', '-1');
  mount.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = C.night;
  scene.fog = new Fog(C.night, 90, 260);

  const camera = new PerspectiveCamera(isMobile ? 42 : 34, 1, 0.5, 700);

  scene.add(makeSky());
  const starCount = posterMode ? 2600 : (isMobile || lowPower ? 1500 : 2600);
  const stars = makeStars(starCount, isMobile);
  scene.add(stars);

  /* Lights: cold moon, cool sky, a warm glow at the entrance */
  scene.add(new HemisphereLight(C.moon, C.nightDeep, 0.3));
  const moon = new DirectionalLight(C.moon, 1.15);
  moon.position.set(-30, 45, 50);
  scene.add(moon);
  const warm = new PointLight(C.gold, 0, 18, 2);
  warm.position.set(0, 2.2, D / 2 + 4);
  scene.add(warm);

  /* Ground: dark, soft reflection */
  const ground = new Mesh(
    new PlaneGeometry(600, 600),
    new MeshStandardMaterial({ color: C.nightDeep, roughness: 0.42, metalness: 0.35, transparent: true, opacity: 0.74 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = 2;
  scene.add(ground);

  /* Building */
  const building = new Group();
  scene.add(building);

  const stoneParts = [];
  const add = (geo, x, y, z) => { geo.translate(x, y, z); stoneParts.push(geo); };
  add(new BoxGeometry(W, H, D), 0, H / 2, 0);
  add(new BoxGeometry(W + 0.8, 0.45, D + 0.8), 0, 0.22, 0);                // plinth
  for (let f = 1; f < FLOORS; f++) add(new BoxGeometry(W + 0.3, 0.22, D + 0.3), 0, f * FH, 0); // string courses
  add(new BoxGeometry(W + 0.7, 0.42, D + 0.7), 0, H + 0.1, 0);             // cornice
  add(new BoxGeometry(W + 0.2, 0.7, D + 0.2), 0, H + 0.6, 0);              // parapet (flat roof)
  add(new BoxGeometry(5.2, 4.6, 1.6), 0, 2.3, D / 2 + 0.8);                // entrance portal
  add(new BoxGeometry(5.8, 0.4, 2.0), 0, 4.75, D / 2 + 0.8);               // portal cap
  add(new CylinderGeometry(2.5, 2.5, 1.4, 32), -7, H + 1.6, -0.5);          // dome drum (synagogue)
  const stoneGeo = mergeGeometries(stoneParts.map((g) => g.toNonIndexed()));
  const stoneMat = new MeshStandardMaterial({ color: C.stone, roughness: 0.93, metalness: 0, emissive: C.gold, emissiveIntensity: 0 });
  building.add(new Mesh(stoneGeo, stoneMat));

  const dome = new Mesh(
    mergeGeometries([
      new SphereGeometry(2.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(-7, H + 2.3, -0.5).toNonIndexed(),
      new ConeGeometry(0.12, 1.1, 8).translate(-7, H + 5.4, -0.5).toNonIndexed(),
    ]),
    new MeshStandardMaterial({ color: C.stone, roughness: 0.55, metalness: 0.35, emissive: C.gold, emissiveIntensity: 0.06 }),
  );
  building.add(dome);

  /* Window surrounds: a slightly larger dark arch behind each window (instanced) */
  const surroundMat = new MeshStandardMaterial({ color: C.windowOff, roughness: 0.9, metalness: 0 });
  /* Sills (instanced) */
  const winList = buildWindowList();
  const sills = new InstancedMesh(new BoxGeometry(WIN_W + 0.3, 0.14, 0.28), stoneMat, winList.length);
  /* Windows: one InstancedMesh, per-window light intensity */
  const winGeo = archGeometry(WIN_W, WIN_H);
  const winMat = windowMaterial(0);
  const windows = new InstancedMesh(winGeo, winMat, winList.length);
  const surrounds = new InstancedMesh(archGeometry(WIN_W + 0.36, WIN_H + 0.22, 12), surroundMat, winList.length);
  const reflMat = windowMaterial(0.16);
  const reflection = new InstancedMesh(winGeo, reflMat, winList.length);
  reflection.renderOrder = 1;

  // Lighting order: bottom to top, front first, then sides
  const order = winList.map((w, i) => i).sort((a, b) => {
    const A = winList[a], B = winList[b];
    if (A.floor !== B.floor) return A.floor - B.floor;
    const fa = A.face === 'front' ? 0 : 1, fb = B.face === 'front' ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return Math.abs(A.pos.x) - Math.abs(B.pos.x) || A.pos.z - B.pos.z;
  });
  const threshold = new Float32Array(winList.length);
  const enabled = new Float32Array(winList.length).fill(1);
  const seed = new Float32Array(winList.length);
  const firstLit = winList.findIndex((w) => w.face === 'front' && w.floor === 0 && w.col === 2);
  const soldierIdx = winList.findIndex((w) => w.face === 'front' && w.floor === 1 && w.col === 6);
  const kidIdx = firstLit;
  order.forEach((wi, rank) => { threshold[wi] = 0.02 + (rank / order.length) * 0.92; });
  threshold[firstLit] = -1;
  threshold[soldierIdx] = Math.min(threshold[soldierIdx], 0.3);
  // Live data: if sold/goal is known, the final state lights only that share.
  if (typeof campaignFraction === 'number') {
    const n = Math.round(MathUtils.clamp(campaignFraction, 0, 1) * order.length);
    order.forEach((wi, rank) => { enabled[wi] = rank < n ? 1 : 0; });
    enabled[firstLit] = 1;
  }
  const dummy = new Object3D();
  winList.forEach((w, i) => {
    seed[i] = Math.random() * 10;
    dummy.position.copy(w.pos);
    dummy.rotation.set(0, w.rotY, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    windows.setMatrixAt(i, dummy.matrix);
    // mirrored copy under the ground plane
    dummy.position.set(w.pos.x, -w.pos.y, w.pos.z);
    dummy.scale.set(w.sx, -w.sy, 1);
    dummy.updateMatrix();
    reflection.setMatrixAt(i, dummy.matrix);
    const n = new Vector3(Math.sin(w.rotY), 0, Math.cos(w.rotY));
    // surround, just behind the glass
    dummy.position.copy(w.pos).addScaledVector(n, -0.015);
    dummy.position.y -= 0.04;
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    surrounds.setMatrixAt(i, dummy.matrix);
    // sill
    dummy.position.copy(w.pos).addScaledVector(n, 0.1);
    dummy.position.y -= 0.06;
    dummy.scale.set(w.door ? 1.6 : 1, w.door ? 0.01 : 1, 1);
    dummy.updateMatrix();
    sills.setMatrixAt(i, dummy.matrix);
  });
  winGeo.setAttribute('aThreshold', new InstancedBufferAttribute(threshold, 1));
  winGeo.setAttribute('aEnabled', new InstancedBufferAttribute(enabled, 1));
  winGeo.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));
  building.add(surrounds, windows, sills);
  scene.add(reflection); // stays unrotated relative to ground but follows building rotation below
  reflection.matrixAutoUpdate = true;

  /* Portals: photos revealed inside two windows */
  const loader = new TextureLoader();
  const loadTex = (url) => new Promise((res) => loader.load(url, res, undefined, () => res(null)));
  const [texSoldier, texKid] = await Promise.all([
    loadTex('images/r/soldier-arriving-room-800.webp'),
    loadTex('images/r/education-boy-learning-800.webp'),
  ]);
  const portals = [];
  function makePortal(tex, idx, cropX) {
    if (!tex) return null;
    const w = winList[idx];
    const mesh = new Mesh(archGeometry(WIN_W, WIN_H, 24), portalMaterial(tex, cropX));
    mesh.position.copy(w.pos).add(new Vector3(0, 0, 0.02));
    mesh.renderOrder = 3;
    building.add(mesh);
    const p = { mesh, base: w.pos.clone(), mat: mesh.material, pop: 0 };
    portals.push(p);
    return p;
  }
  const portalSoldier = makePortal(texSoldier, soldierIdx, 0.27);
  const portalKid = makePortal(texKid, kidIdx, 0.74);

  /* Post-processing */
  let composer = null;
  let bloom = null;
  const useBloom = !lowPower;
  if (useBloom) {
    // MSAA on the composer target keeps edges clean (desktop only; mobile keeps it cheap).
    composer = new EffectComposer(renderer, new WebGLRenderTarget(256, 256, { type: HalfFloatType, samples: isMobile ? 0 : 4 }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(256, 256), isMobile ? 0.28 : 0.4, 0.38, 0.88);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ---------- Choreography state ---------- */
  const frame = isMobile ? { tx: 0, ty: 3.2, dist: 0.8 } : { tx: 9, ty: 0, dist: 1 };
  const state = {
    camX: 0, camY: 6.5, camZ: 84 * frame.dist,
    tgtX: frame.tx, tgtY: 6 - frame.ty, tgtZ: 0,
    rot: 0, light: 0, dim: 0, warm: 0,
    soldier: 0, kid: 0,
  };
  const winWorld = (idx, rot, out = new Vector3()) => out.copy(winList[idx].pos).add(new Vector3(0, WIN_H / 2, 0)).applyAxisAngle(new Vector3(0, 1, 0), rot);
  const sw = winWorld(soldierIdx, -Math.PI / 6);
  const kw = winWorld(kidIdx, -Math.PI / 12);
  const nS = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), -Math.PI / 6);
  const nK = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), -Math.PI / 12);
  const close = isMobile ? 9.5 : 10.5;
  const sideShift = isMobile ? 0 : -3.2; // keep the window clear of the copy panel on desktop

  const final = { camX: 0, camY: 7.5, camZ: 74 * frame.dist, tgtX: frame.tx * 1.45, tgtY: 6.4 - frame.ty, tgtZ: 0, rot: 0, light: 1, warm: 1, soldier: 0, kid: 0 };

  function applyState() {
    building.rotation.y = state.rot;
    reflection.rotation.y = state.rot;
    camera.position.set(state.camX, state.camY, state.camZ);
    camera.lookAt(state.tgtX, state.tgtY, state.tgtZ);
    winMat.uniforms.uLight.value = state.light;
    reflMat.uniforms.uLight.value = state.light;
    warm.intensity = 7 * state.warm;
    stoneMat.emissiveIntensity = 0.025 * state.light;
    for (const [p, v] of [[portalSoldier, state.soldier], [portalKid, state.kid]]) {
      if (!p) continue;
      p.mat.uniforms.uOpacity.value = v;
      const s = 1 + v * 0.9;
      p.mesh.scale.set(1 + v * 1.6, s * 0.95 + 0.05 * v, 1);
      p.mesh.position.set(p.base.x, p.base.y - v * 0.35, p.base.z + 0.02 + v * 0.9);
    }
    renderer.domElement.style.opacity = String(1 - state.dim * 0.65);
  }

  /* ---------- Rendering ---------- */
  let width = 1, height = 1;
  function resize() {
    const r = mount.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = width / height;
    // Portrait: widen the view so the whole facade fits.
    camera.fov = camera.aspect < 1 ? 48 : (isMobile ? 42 : 34);
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(width, height);
    if (bloom) bloom.resolution.set(width, height);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(mount);

  let running = true, onScreen = true, rafId = 0, last = performance.now(), t = 0;
  let frames = 0, measureStart = 0, measured = force || posterMode;
  let bloomOn = !!composer;
  const animateStars = !reduceMotion;

  function renderOnce() {
    applyState();
    if (bloomOn && composer) composer.render(); else renderer.render(scene, camera);
  }

  function loop(now) {
    rafId = 0;
    if (!running || !onScreen || document.hidden) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (animateStars) t += dt;
    stars.material.uniforms.uTime.value = t;
    renderOnce();

    if (!measured) {
      if (!measureStart) measureStart = now;
      frames++;
      const el = now - measureStart;
      if (el >= 2000) {
        measured = true;
        const fps = (frames * 1000) / el;
        document.documentElement.dataset.heroFps = fps.toFixed(0);
        if (fps < 25) { fail('fps ' + fps.toFixed(1)); return; }
        if (fps < 40) {
          document.documentElement.dataset.heroTier = 'reduced';
          bloomOn = false;
          stars.geometry.setDrawRange(0, Math.floor(starCount / 2));
        }
      }
    }
    if (animateStars || !measured) rafId = requestAnimationFrame(loop);
  }
  function kick() { if (!rafId && running) { last = performance.now(); rafId = requestAnimationFrame(loop); } }

  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (onScreen) kick();
  });
  io.observe(stage);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  let st = null, tl = null, lenis = null;
  function destroy() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    if (st) st.kill();
    if (tl) tl.kill();
    if (lenis) lenis.destroy();
    renderer.dispose();
    renderer.domElement.remove();
  }
  function fail(reason) {
    destroy();
    onFail && onFail(reason);
  }

  /* ---------- Static (poster / reduced motion / no story) or scroll story ---------- */
  const story = opts.story && !posterMode && !reduceMotion;
  if (!story) {
    Object.assign(state, final);
    if (posterMode) state.dim = 0;
    renderOnce();
    if (visionNote && typeof campaignFraction !== 'number') visionNote.hidden = false;
    kick();
    return { destroy, renderOnce, ready: Promise.resolve() };
  }

  // One master timeline drives camera, rotation, windows and portals.
  tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  // 0 – 25%: approach, windows light bottom → top
  tl.to(state, { camZ: 42 * frame.dist, camY: 6.2, tgtX: frame.tx * 0.85, light: 0.55, duration: 0.25 }, 0);
  // 25 – 50%: rotate 30°, a second-floor window comes forward with the soldier photo
  tl.to(state, { rot: -Math.PI / 6, duration: 0.15, ease: 'power1.inOut' }, 0.25);
  tl.to(state, {
    camX: sw.x + nS.x * close - sideShift, camY: sw.y + 0.6, camZ: sw.z + nS.z * close,
    tgtX: sw.x - sideShift * 0.6, tgtY: sw.y, tgtZ: sw.z, light: 0.68, duration: 0.17, ease: 'power2.inOut',
  }, 0.25);
  tl.to(state, { soldier: 1, duration: 0.07 }, 0.38);
  tl.to(state, { soldier: 0, duration: 0.05 }, 0.49);
  // 50 – 75%: a ground-floor window with the child photo
  tl.to(state, { rot: -Math.PI / 12, duration: 0.12, ease: 'power1.inOut' }, 0.5);
  tl.to(state, {
    camX: kw.x + nK.x * close - sideShift, camY: kw.y + 0.9, camZ: kw.z + nK.z * close,
    tgtX: kw.x - sideShift * 0.6, tgtY: kw.y + 0.1, tgtZ: kw.z, light: 0.82, warm: 0.6, duration: 0.14, ease: 'power2.inOut',
  }, 0.5);
  tl.to(state, { kid: 1, duration: 0.07 }, 0.62);
  tl.to(state, { kid: 0, duration: 0.05 }, 0.73);
  // 75 – 100%: whole building lit, camera stops facing the facade, canvas dims
  tl.to(state, { ...final, duration: 0.17, ease: 'power2.inOut' }, 0.75);
  tl.to(state, { dim: 1, duration: 0.08 }, 0.92);

  const stepAt = (p) => (p < 0.03 ? 0 : p < 0.25 ? 1 : p < 0.5 ? 2 : p < 0.75 ? 3 : 4);
  let currentStep = -1;
  function setStep(p) {
    const s = stepAt(p);
    if (s === currentStep) return;
    currentStep = s;
    steps.forEach((el, i) => el.classList.toggle('is-active', i + 1 === s));
    if (visionNote) visionNote.hidden = typeof campaignFraction === 'number';
  }

  const headerH = () => (document.querySelector('.site-header')?.offsetHeight || 64);

  // Smooth scrolling on desktop only (never with reduced motion).
  if (!isMobile && window.matchMedia('(pointer: fine)').matches) {
    try {
      const { default: Lenis } = await import('lenis');
      lenis = new Lenis({ autoRaf: false, anchors: { offset: -headerH() - 16 }, lerp: 0.12 });
      document.documentElement.classList.add('lenis');
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis && lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } catch (e) { lenis = null; }
  }

  st = ScrollTrigger.create({
    trigger: track,
    start: () => `top ${headerH()}px`,
    end: 'bottom bottom',
    scrub: isMobile ? true : 0.6,
    invalidateOnRefresh: true,
    onUpdate(self) {
      tl.progress(self.progress);
      setStep(self.progress);
      kick();
    },
  });
  tl.progress(st.progress || 0);
  setStep(st.progress || 0);
  renderOnce();
  kick();

  return { destroy, renderOnce, ready: Promise.resolve() };
}
