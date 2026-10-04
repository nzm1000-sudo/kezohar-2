// כזוהר הרקיע — interactions. Content, prices and forms live in the DOM; 3D is an enhancement.
const root = document.documentElement;
root.classList.add('js');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const mq = (q) => window.matchMedia(q);
const MOTION = root.classList.contains('motion');
const FX = root.classList.contains('fx');
const MOBILE = mq('(max-width: 767px)').matches || mq('(pointer: coarse)').matches;
// Test switches for local screenshot runs only: a test harness sets window.__kzTest before load
// (e.g. { poster: true, noGov: true }). Ignored on any host other than localhost.
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.__kzTest ? window.__kzTest : null;

/* ---------- theme ---------- */
const themeBtn = $('[data-theme-toggle]');
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : mq('(prefers-color-scheme: dark)').matches;
const syncThemeBtn = () => {
  const d = isDark();
  themeBtn.setAttribute('aria-pressed', String(d));
  $('.sr-only', themeBtn).textContent = d ? 'מצב יום' : 'מצב לילה';
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', d ? '#141311' : '#F7F3EC'));
};
themeBtn.addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('kz-theme', root.dataset.theme); } catch (e) { /* storage unavailable */ }
  syncThemeBtn();
  if (igniteScene) igniteScene.setTheme(isDark());
});
syncThemeBtn();
mq('(prefers-color-scheme: dark)').addEventListener('change', () => { syncThemeBtn(); if (igniteScene) igniteScene.setTheme(isDark()); });

/* ---------- toast ---------- */
const toast = $('[data-toast]');
let toastT;
function say(msg) {
  toast.textContent = msg; toast.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 2200);
}

/* ---------- copy ---------- */
$$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  const v = b.dataset.copy;
  try { await navigator.clipboard.writeText(v); } catch (e) {
    const ta = Object.assign(document.createElement('textarea'), { value: v }); ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) { /* ignore */ } ta.remove();
  }
  b.classList.add('is-done'); setTimeout(() => b.classList.remove('is-done'), 1600);
  say('הועתק בהצלחה!');
}));

/* ---------- header ---------- */
const header = $('[data-header]');
const hero = $('.hero');
function headerState() {
  const y = window.scrollY;
  const heroEnd = hero.offsetTop + hero.offsetHeight - header.offsetHeight;
  const over = y < heroEnd;
  if (over) header.dataset.over = 'hero'; else delete header.dataset.over;
  if (over) navLinks.forEach((l) => l.removeAttribute('aria-current'));
  header.classList.toggle('is-solid', !over);
  header.classList.toggle('is-scrolled', y > 40);
}
const navLinks = $$('.nav a');
const secIO = new IntersectionObserver((ents) => ents.forEach((e) => {
  if (!e.isIntersecting) return;
  navLinks.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id));
  navLinks.forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
}), { rootMargin: '-45% 0px -50% 0px' });
['vision', 'activities', 'partnership', 'benefits', 'donate'].forEach((id) => { const el = document.getElementById(id); if (el) secIO.observe(el); });

/* ---------- hero scroll choreography (CSS vars; 3D reads the same progress) ---------- */
// The raw scroll position is only a target: every frame the shown progress eases toward it
// (time-based, so it feels the same at 60 or 120 Hz). A flick of the wheel or a fast swipe glides
// through the dust → building → photo story instead of snapping.
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let heroScene = null, heroP = 0, heroT = 0, heroRaf = 0, heroLast = 0;
const heroCopy = $('.hero-copy');
function heroTarget() {
  const r = hero.getBoundingClientRect();
  const span = hero.offsetHeight - window.innerHeight;
  return Math.min(1, Math.max(0, -r.top / span));
}
function heroApply(p) {
  const copy = 1 - sm(0.015, 0.11, p);
  const line = sm(0.14, 0.22, p) * (1 - sm(0.4, 0.48, p));
  // a long, luxurious cross-fade: the photo eases in over nearly half the stage while the points thin out
  const photo = sm(0.5, 0.97, p);
  const blur = 1 - sm(0.52, 0.9, p);
  hero.style.setProperty('--copy', copy.toFixed(3));
  hero.style.setProperty('--line', line.toFixed(3));
  hero.style.setProperty('--photo', photo.toFixed(4));
  hero.style.setProperty('--blur', blur.toFixed(3));
  heroCopy.toggleAttribute('data-hidden', copy < 0.02);
  if (heroScene) heroScene.setProgress(p);
}
function heroTick(now) {
  const dt = Math.min(0.1, (now - (heroLast || now)) / 1000); heroLast = now;
  const k = 1 - Math.exp(-dt * 3.2);
  heroP += (heroT - heroP) * k;
  if (Math.abs(heroT - heroP) < 0.0004) heroP = heroT;
  heroApply(heroP);
  heroRaf = heroP === heroT ? 0 : requestAnimationFrame(heroTick);
}
function heroState() {
  if (!FX || !root.classList.contains('fx')) return;
  heroT = heroTarget();
  if (TEST && TEST.instant) { heroP = heroT; heroApply(heroP); return; }
  if (!heroRaf) { heroLast = 0; heroRaf = requestAnimationFrame(heroTick); }
}
if (FX) { heroT = heroP = heroTarget(); heroApply(heroP); }
// keyboard users tabbing into hero CTAs: bring hero copy back into view
heroCopy.addEventListener('focusin', () => { if (FX && heroP > 0.1) { window.scrollTo({ top: hero.offsetTop, behavior: 'auto' }); heroT = heroP = 0; heroApply(0); } });

let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => { ticking = false; headerState(); heroState(); });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
onScroll();

/* ---------- reveal ---------- */
if (MOTION && 'IntersectionObserver' in window) {
  const rio = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => rio.observe(el));
} else {
  $$('.reveal').forEach((el) => el.classList.add('is-in'));
}

/* ---------- dialogs ---------- */
let lenis = null;
const menu = $('#menu');
const sheet = $('#donate-sheet');
function openDialog(d) { d.showModal(); if (lenis) lenis.stop(); document.body.style.overflow = 'hidden'; }
function closed() { if (lenis) lenis.start(); document.body.style.overflow = ''; }
[menu, sheet].forEach((d) => {
  d.addEventListener('close', closed);
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
});
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('[data-close-nav]').forEach((a) => a.addEventListener('click', () => a.closest('dialog').close()));
$('[data-open-menu]').addEventListener('click', () => openDialog(menu));

/* ---------- tiers (section ↔ sheet stay in sync) ---------- */
const NAMES = { 100: 'מטר אחד', 180: 'מטר וחצי', 360: 'שלושה מטרים', 560: 'היכל המייסדים', 1080: 'נבחרת המאה' };
const fmt = (n) => '₪' + Number(n).toLocaleString('en-US');
let igniteScene = null;
const ART = { 100: 'tier-1', 180: 'tier-15', 360: 'tier-3', 560: 'tier-founder', 1080: 'tier-crown' };
const igArt = $('.ignite-art');
function swapArt(v) {
  if (!igArt || !ART[v]) return;
  const base = 'assets/img/clay/' + ART[v];
  $('source', igArt).srcset = `${base}-240.avif 240w, ${base}-480.avif 480w`;
  const img = $('img', igArt); img.srcset = `${base}-240.webp 240w, ${base}-480.webp 480w`; img.src = base + '-240.webp';
  if (MOTION) { igArt.classList.remove('is-drop'); void igArt.offsetWidth; igArt.classList.add('is-drop'); }
}
function setTier(v, from) {
  v = String(v);
  const a = $(`input[name="tier"][value="${v}"]`); if (a && from !== 'section') a.checked = true;
  const b = $(`input[name="sheet-tier"][value="${v}"]`); if (b && from !== 'sheet') b.checked = true;
  $('[data-plaque-tier]').textContent = NAMES[v];
  $('[data-sheet-sum]').innerHTML = `<bdi>${fmt(v)}</bdi> לחודש`;
  $('[data-ignite-name]').textContent = NAMES[v];
  if (igniteScene) igniteScene.setTier(v); else swapArt(v);
}
$$('input[name="tier"]').forEach((i) => i.addEventListener('change', () => setTier(i.value, 'section')));
$$('input[name="sheet-tier"]').forEach((i) => i.addEventListener('change', () => setTier(i.value, 'sheet')));
$$('[data-open-donate]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.tier) setTier(b.dataset.tier);
  openDialog(sheet);
  const checked = $('input[name="sheet-tier"]:checked', sheet);
  if (checked && b.dataset.tier) checked.focus();
}));
setTier($('input[name="tier"]:checked').value);
const ded = $('#dedication-name'), plaque = $('[data-plaque-name]');
ded.addEventListener('input', () => { plaque.textContent = ded.value.trim() || 'שמכם כאן'; });

/* ---------- lazy 3D ---------- */
function whenEngaged(fn) {
  let done = false;
  const go = () => { if (done) return; done = true; evs.forEach((e) => window.removeEventListener(e, go)); fn(); };
  // The poster is a render of the scene's first frame, so nothing is lost by waiting for the
  // visitor to engage: the 3D only boots on the first scroll / pointer / key interaction, or —
  // if the visitor is already moving the pointer over the hero — once the browser is idle.
  const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
  evs.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
  hero.addEventListener('pointermove', () => idle(go, { timeout: 2000 }), { once: true, passive: true });
  if (window.scrollY > 0) go();
}
if (FX) {
  const posterMode = !!(TEST && TEST.poster);
  const loadHero = async () => {
    try {
      const { createHero } = await import('./hero-scene.js');
      heroScene = createHero($('.hero-canvas'), {
        mobile: MOBILE, poster: posterMode, noGov: !!(TEST && TEST.noGov), photo: $('.hero-photo img'),
        onStop: () => { heroScene = null; },
      });
      heroScene.setProgress(heroP);
      if (TEST) window.__hero = heroScene;
    } catch (err) {
      console.warn('3D disabled:', err && err.message);
      root.classList.remove('fx'); onScroll();
    }
  };
  if (posterMode) loadHero(); else whenEngaged(loadHero);

  const ig = $('[data-ignite]');
  const igIO = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    igIO.disconnect();
    try {
      const { createClay } = await import('./clay-scene.js');
      igniteScene = createClay($('.ignite-canvas'), {
        mobile: MOBILE, tier: $('input[name="tier"]:checked').value, dark: isDark(), noGov: !!(TEST && TEST.noGov),
        onStop: () => { igniteScene = null; swapArt($('input[name="tier"]:checked').value); },
      });
      if (TEST) window.__clay = igniteScene;
    } catch (err) { console.warn('ignite fallback:', err && err.message); }
  }, { rootMargin: '400px 0px' });
  igIO.observe(ig);
}

/* ---------- smooth scroll + pinned activities (motion only) ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}
// Smooth scroll and the pinned horizontal chapter are desktop-only, so phones never download GSAP/Lenis.
if (MOTION && !(TEST && TEST.noLenis) && mq('(min-width: 1024px)').matches && !MOBILE) {
  (async () => {
    try {
      await loadScript('assets/vendor/gsap.min.js');
      await Promise.all([loadScript('assets/vendor/ScrollTrigger.min.js'), loadScript('assets/vendor/lenis.min.js')]);
    } catch (e) { return; }
    const { gsap, ScrollTrigger, Lenis } = window;
    gsap.registerPlugin(ScrollTrigger);
    if (!MOBILE) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -72 } });
      lenis.on('scroll', () => { ScrollTrigger.update(); onScroll(); });
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    const section = $('#activities');
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px) and (min-height: 620px)', () => {
      section.classList.add('is-horizontal');
      const track = $('[data-act-track]'), pin = $('.act-pin'), bar = $('.act-progress');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tw = gsap.to(track, {
        x: () => dist(), ease: 'none',
        scrollTrigger: {
          trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: (s) => bar.style.setProperty('--act', s.progress.toFixed(4)),
        },
      });
      return () => { tw.scrollTrigger && tw.scrollTrigger.kill(); tw.kill(); gsap.set(track, { clearProps: 'transform' }); section.classList.remove('is-horizontal'); };
    });
    // in-page anchors after pin spacers exist
    ScrollTrigger.refresh();
  })();
}
