/*
 * כזוהר הרקיע — page behaviour.
 * Everything essential is already in the HTML; this file only enhances it.
 * The 3D hero (js/scene.js) loads last, on idle, and only on capable devices.
 */
const doc = document.documentElement;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const fmt = new Intl.NumberFormat('he-IL');
const shekel = (n) => '₪' + fmt.format(Math.round(n));
const TAX_RATE = 0.35;

doc.classList.add('js', 'reveal-ready');

/* ---------- Reveal on scroll (replaces AOS) ---------- */
function initReveal() {
  const els = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
}

/* ---------- Navigation ---------- */
function initNav() {
  const btn = $('#menu-toggle');
  const links = $('#nav-links');
  if (!btn || !links) return;
  const set = (open) => {
    links.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!links.contains(e.target) && !btn.contains(e.target)) set(false);
  });

  // Mark the section in view
  const map = new Map($$('a', links).map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const a = map.get(e.target.id);
      if (!a) continue;
      if (e.isIntersecting) {
        map.forEach((x) => x.removeAttribute('aria-current'));
        a.setAttribute('aria-current', 'true');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* ---------- Theme ---------- */
function initTheme() {
  const btn = $('#theme-toggle');
  if (!btn) return;
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (doc.dataset.theme ? doc.dataset.theme === 'dark' : sysDark.matches);
  const sync = () => btn.setAttribute('aria-pressed', String(isDark()));
  sync();
  sysDark.addEventListener('change', sync);
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    doc.dataset.theme = next;
    try { localStorage.setItem('kz-theme', next); } catch (e) { /* ignore */ }
    sync();
  });
}

/* ---------- Rav dialog (native <dialog>) ---------- */
function initDialog() {
  const dlg = $('#rav-dialog');
  const open = $('#rav-open');
  const close = $('#rav-close');
  if (!dlg || !open || typeof dlg.showModal !== 'function') return;
  open.addEventListener('click', () => { dlg.showModal(); close.focus(); });
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => open.focus());
}

/* ---------- Copy account number ---------- */
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2600);
}
function initCopy() {
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = b.dataset.copy;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'visually-hidden';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
    }
    toast(ok ? 'מספר החשבון הועתק' : 'לא הצלחנו להעתיק. מספר החשבון: ' + text);
  }));
}

/* ---------- Floating CTA (mobile) ---------- */
function initFloat() {
  const fab = $('#float-cta');
  const hero = $('#home');
  const donate = $('#donate');
  const partnership = $('#partnership');
  if (!fab || !hero || !donate) return;
  const seen = { hero: true, donate: false, partnership: false };
  const update = () => fab.classList.toggle('is-visible', !seen.hero && !seen.donate && !seen.partnership);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target === hero) seen.hero = e.isIntersecting;
      if (e.target === donate) seen.donate = e.isIntersecting;
      if (e.target === partnership) seen.partnership = e.isIntersecting;
    }
    update();
  }, { threshold: 0 });
  io.observe(hero); io.observe(donate);
  if (partnership) io.observe(partnership);
}

/* ---------- Wall of meters + tiers ---------- */
const TIER_TEXT = {
  1: { status: 'נבחר מטר אחד', name: 'מטר אחד' },
  2: { status: 'נבחרו מטר וחצי', name: 'מטר וחצי' },
  3: { status: 'נבחרו <bdi>3</bdi> מטרים', name: 'שלושה מטרים' },
  4: { status: 'נבחר היכל המייסדים', name: 'היכל המייסדים' },
  5: { status: 'נבחרה נבחרת המאה', name: 'נבחרת המאה' },
};
const SVG_NS = 'http://www.w3.org/2000/svg';
const COLS = 4, ROWS = 3, CW = 84, CH = 92, GX = 24, GY = 22, X0 = 36, Y0 = 122;

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
function cellBox(i) {
  const row = ROWS - 1 - Math.floor(i / COLS); // fill from the bottom row
  const col = COLS - 1 - (i % COLS);          // right to left (RTL)
  return { x: X0 + col * (CW + GX), y: Y0 + row * (CH + GY) };
}
function archPath(x, y, w, h) {
  const r = w / 2;
  return `M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}Z`;
}

function initWall() {
  const svg = $('#wall-svg');
  const cellsG = $('#wall-cells');
  const nameEl = $('#wall-name');
  const plaque = $('#wall-plaque');
  const plaqueName = $('#plaque-name');
  const status = $('#wall-status');
  const input = $('#dedication');
  const other = $('#other-amount');
  const otherTax = $('#other-amount-tax');
  const track = $('#tiers-track');
  const dotsWrap = $('#tiers-dots');
  if (!svg || !cellsG) return;

  const defs = svg.querySelector('defs');
  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const { x, y } = cellBox(i);
    const g = svgEl('g', { class: 'wall-cell', 'data-i': i });
    g.appendChild(svgEl('path', { class: 'wall-cell__base', d: archPath(x, y, CW, CH) }));
    const glow = svgEl('path', { class: 'wall-cell__glow', d: archPath(x, y, CW, CH) });
    g.appendChild(glow);
    g.appendChild(svgEl('path', { class: 'wall-cell__mullion', d: `M${x + CW / 2} ${y + 6}V${y + CH}M${x} ${y + CH * 0.62}H${x + CW}` }));
    cellsG.appendChild(g);
    cells.push({ g, glow, x, y });
  }
  // Half-cell clip (the right half of the second cell, next to the first one)
  const half = svgEl('clipPath', { id: 'half-cell' });
  const c1 = cellBox(1);
  half.appendChild(svgEl('rect', { x: c1.x + CW / 2, y: c1.y - 2, width: CW / 2 + 2, height: CH + 4 }));
  defs.appendChild(half);

  let current = { tier: 3, cells: 3, plaque: false };

  function placeName() {
    const raw = (input && input.value.trim()) || '';
    const text = raw || 'שמכם כאן';
    nameEl.classList.toggle('is-placeholder', !raw);
    plaqueName.classList.toggle('is-placeholder', !raw);
    if (current.plaque) {
      nameEl.textContent = '';
      plaqueName.textContent = text;
      fit(plaqueName, 212);
      return;
    }
    plaqueName.textContent = '';
    const n = current.cells;
    if (!n) { nameEl.textContent = ''; return; }
    const span = Math.ceil(n);
    const first = cellBox(0);
    const last = cellBox(span - 1);
    const right = first.x + CW;
    const left = n % 1 ? last.x + CW / 2 : last.x;
    nameEl.textContent = text;
    nameEl.setAttribute('x', String((left + right) / 2));
    nameEl.setAttribute('y', String(first.y + CH * 0.5));
    fit(nameEl, right - left - 10);
  }
  function fit(el, max) {
    el.removeAttribute('textLength');
    el.removeAttribute('lengthAdjust');
    try {
      if (el.getComputedTextLength() > max) {
        el.setAttribute('textLength', String(max));
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
    } catch (e) { /* not rendered yet */ }
  }

  function light(nCells, usePlaque) {
    cells.forEach((c, i) => {
      const on = !usePlaque && i < Math.ceil(nCells);
      c.g.classList.toggle('is-lit', on);
      if (on && nCells % 1 && i === Math.ceil(nCells) - 1) c.glow.setAttribute('clip-path', 'url(#half-cell)');
      else c.glow.removeAttribute('clip-path');
    });
    plaque.classList.toggle('is-lit', !!usePlaque);
  }

  function selectTier(card, announce = true) {
    const tier = Number(card.dataset.tier);
    const cellsAttr = card.dataset.cells;
    const monthly = Number(card.dataset.monthly);
    const usePlaque = cellsAttr === 'plaque';
    current = { tier, cells: usePlaque ? 0 : Number(cellsAttr), plaque: usePlaque };
    light(current.cells, usePlaque);
    placeName();
    if (announce) status.innerHTML = `${TIER_TEXT[tier].status}, <bdi>${shekel(monthly)}</bdi> לחודש`;
  }

  const radios = $$('.tier__radio');
  radios.forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    if (other) { other.value = ''; otherTax.textContent = 'כל סכום מתקבל באהבה.'; }
    const card = r.closest('.tier');
    selectTier(card);
    centerCard(card, true);
  }));

  if (input) input.addEventListener('input', placeName);

  let otherTimer = 0;
  if (other) other.addEventListener('input', () => {
    const v = Math.floor(Number(other.value));
    if (!v || v < 1) { otherTax.textContent = 'כל סכום מתקבל באהבה.'; return; }
    radios.forEach((r) => { r.checked = false; });
    current = { tier: 0, cells: 0, plaque: false };
    light(0, false);
    placeName();
    otherTax.innerHTML = `אחרי החזר מס: כ־<bdi>${shekel(v * (1 - TAX_RATE))}</bdi> בחודש`;
    clearTimeout(otherTimer);
    otherTimer = setTimeout(() => { status.innerHTML = `סכום אחר: <bdi>${shekel(v)}</bdi> לחודש`; }, 500);
  });

  /* Mobile carousel: dots + centering */
  const cards = $$('.tier', track);
  const scrollable = () => track.scrollWidth > track.clientWidth + 4;
  function centerCard(card, smooth) {
    if (!scrollable()) return;
    const tr = track.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const delta = (cr.left + cr.width / 2) - (tr.left + tr.width / 2);
    track.scrollBy({ left: delta, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
  }
  const dots = cards.map((card, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tiers__dot';
    b.setAttribute('aria-label', `הצגת רמה ${i + 1} מתוך ${cards.length}: ${TIER_TEXT[card.dataset.tier].name}`);
    b.addEventListener('click', () => centerCard(card, true));
    dotsWrap.appendChild(b);
    return b;
  });
  let raf = 0;
  function syncDots() {
    raf = 0;
    const tr = track.getBoundingClientRect();
    const mid = tr.left + tr.width / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === best)));
  }
  function layout() {
    dotsWrap.hidden = !scrollable();
    syncDots();
  }
  track.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(syncDots); }, { passive: true });
  window.addEventListener('resize', layout);

  const checked = radios.find((r) => r.checked) || radios[2];
  if (checked) { checked.checked = true; selectTier(checked.closest('.tier'), false); }
  layout();
  requestAnimationFrame(() => { if (checked) centerCard(checked.closest('.tier'), false); syncDots(); });
  // Re-fit names once the display font has loaded
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeName);
}

/* ---------- Live campaign data (data/campaign.json) ---------- */
async function loadCampaign() {
  try {
    const res = await fetch('data/campaign.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function applyCampaign(data) {
  if (!data) return null;
  let fraction = null;
  if (isNum(data.goalMeters) && isNum(data.soldMeters) && data.goalMeters > 0) {
    fraction = Math.max(0, Math.min(1, data.soldMeters / data.goalMeters));
    const box = $('#campaign-progress');
    $('#campaign-progress-label').innerHTML = `הודלקו <bdi>${fmt.format(data.soldMeters)}</bdi> מתוך <bdi>${fmt.format(data.goalMeters)}</bdi> מטרים`;
    $('#campaign-progress-bar').value = Math.round(fraction * 100);
    box.hidden = false;
  }
  if (Array.isArray(data.recentDonors) && data.recentDonors.length) {
    const list = $('#ticker-list');
    data.recentDonors.slice(0, 6).forEach((d) => {
      const name = typeof d === 'string' ? d : d && d.name;
      if (!name) return;
      const li = document.createElement('li');
      li.textContent = name + (d && isNum(d.meters) ? ` · ${fmt.format(d.meters)} מ׳` : '');
      list.appendChild(li);
    });
    if (list.children.length) $('#ticker').hidden = false;
  }
  return fraction;
}

/* ---------- 3D hero: device tiering + deferred load ---------- */
function canRun3D() {
  if (params.has('no3d')) return { ok: false, why: 'disabled' };
  if (params.has('force3d') || params.has('poster')) return { ok: true, low: false };
  if (reduceMotion.matches) return { ok: false, why: 'reduced-motion' };
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return { ok: false, why: 'save-data' };
  if (!('WebGL2RenderingContext' in window)) return { ok: false, why: 'no-webgl2' };
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (cores <= 2 && mem <= 2) return { ok: false, why: 'weak-device' };
  return { ok: true, low: cores <= 4 || mem <= 4 };
}

// Scroll story only when the sticky hero fits the viewport.
function prepareStory() {
  if (params.has('poster')) return;
  doc.classList.add('story-on');
  const sticky = $('.hero__sticky');
  if (sticky.scrollHeight > sticky.clientHeight + 2) doc.classList.remove('story-on');
}

async function boot3D(fractionPromise, verdict) {
  const mount = $('#hero-canvas');
  const stage = $('#hero-stage');
  const track = $('#hero-track');
  const poster = $('#hero-poster');
  const isMobile = !window.matchMedia('(min-width: 960px)').matches;
  const posterMode = params.has('poster');
  // Real WebGL2 probe (creating a context is not free, so it waits until now).
  let gl2 = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl2 = !!gl;
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) { gl2 = false; }
  if (!gl2) { doc.classList.remove('story-on'); doc.dataset.hero3d = 'off-no-webgl2'; return; }
  if (!doc.classList.contains('story-on')) prepareStory();

  try {
    const fraction = await fractionPromise;
    const { startScene } = await import('./scene.js');
    await startScene({
      mount, stage, track,
      steps: $$('.story__step'),
      visionNote: $('#story-vision'),
      campaignFraction: fraction,
      isMobile,
      lowPower: !!verdict.low || params.has('lowpower'),
      force: params.has('force3d') || posterMode,
      posterMode,
      reduceMotion: reduceMotion.matches,
      story: doc.classList.contains('story-on'),
      onFail(reason) {
        doc.classList.remove('story-on');
        mount.classList.remove('is-ready');
        poster.classList.remove('is-hidden');
        doc.dataset.hero3d = 'off-' + reason.split(' ')[0];
      },
    });
    if (doc.dataset.hero3d && doc.dataset.hero3d.startsWith('off-')) return;
    requestAnimationFrame(() => {
      mount.classList.add('is-ready');
      poster.classList.add('is-hidden');
      doc.dataset.hero3d = 'on';
    });
  } catch (err) {
    doc.classList.remove('story-on');
    doc.dataset.hero3d = 'off-error';
    console.warn('3D hero unavailable:', err && err.message);
  }
}

/* ---------- Boot ---------- */
initReveal();
initNav();
initTheme();
initDialog();
initCopy();
initFloat();
initWall();
const y = $('#year');
if (y) y.textContent = String(new Date().getFullYear());

const campaign = loadCampaign().then(applyCampaign);
const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600));
const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : window.addEventListener('load', fn, { once: true }));

/*
 * Desktop: the 3D scene loads after `load`, on idle.
 * Mobile: the poster (identical to the final state) stays until the visitor first
 * touches or scrolls the page; only then does the 3D load, on idle. Visitors who
 * read and leave never pay for WebGL on a phone.
 */
const verdict = canRun3D();
doc.dataset.hero3d = verdict.ok ? 'waiting' : 'off-' + verdict.why;
if (verdict.ok) {
  const desktop = window.matchMedia('(min-width: 960px)').matches || params.has('force3d') || params.has('poster');
  if (desktop) {
    afterLoad(() => whenIdle(() => boot3D(campaign, verdict)));
  } else {
    const events = ['pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];
    const go = (e) => {
      if (e.type === 'scroll' && e.target !== document) return; // ignore inner scrollers (tier carousel)
      events.forEach((e) => window.removeEventListener(e, go, true));
      prepareStory(); // same frame as the input, before the page moves
      afterLoad(() => whenIdle(() => boot3D(campaign, verdict)));
    };
    events.forEach((e) => window.addEventListener(e, go, { capture: true, passive: true }));
  }
}
