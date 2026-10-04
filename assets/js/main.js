// כזוהר הרקיע — interactions. Content, prices and forms live in the DOM; 3D is an enhancement.
const root = document.documentElement;
root.classList.add('js');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const mq = (q) => window.matchMedia(q);
const MOTION = root.classList.contains('motion');
const FX = root.classList.contains('fx');
const MOBILE = mq('(max-width: 767px)').matches || mq('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

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
});
syncThemeBtn();

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
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let heroScene = null, heroP = 0;
const heroCopy = $('.hero-copy');
function heroState() {
  if (!FX || !root.classList.contains('fx')) return;
  const r = hero.getBoundingClientRect();
  const span = hero.offsetHeight - window.innerHeight;
  heroP = Math.min(1, Math.max(0, -r.top / span));
  const copy = 1 - sm(0.02, 0.14, heroP);
  const line = sm(0.2, 0.3, heroP) * (1 - sm(0.58, 0.68, heroP));
  const photo = sm(0.8, 0.96, heroP);
  hero.style.setProperty('--copy', copy.toFixed(3));
  hero.style.setProperty('--line', line.toFixed(3));
  hero.style.setProperty('--photo', photo.toFixed(3));
  heroCopy.toggleAttribute('data-hidden', copy < 0.02);
  if (heroScene) heroScene.setProgress(heroP);
}
// keyboard users tabbing into hero CTAs: bring hero copy back into view
heroCopy.addEventListener('focusin', () => { if (FX && heroP > 0.1) window.scrollTo({ top: hero.offsetTop, behavior: 'auto' }); });

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
const igCircle = $('[data-ignite-circle]');
const SVG_SEEDS = { 100: [70, 150, 22], 180: [130, 190, 30], 360: [190, 160, 46], 560: [308, 175, 62], 1080: [200, 140, 230] };
function setTier(v, from) {
  v = String(v);
  const a = $(`input[name="tier"][value="${v}"]`); if (a && from !== 'section') a.checked = true;
  const b = $(`input[name="sheet-tier"][value="${v}"]`); if (b && from !== 'sheet') b.checked = true;
  $('[data-plaque-tier]').textContent = NAMES[v];
  $('[data-sheet-sum]').innerHTML = `<bdi>${fmt(v)}</bdi> לחודש`;
  $('[data-ignite-name]').textContent = NAMES[v];
  const s = SVG_SEEDS[v];
  if (igCircle && s) { igCircle.setAttribute('cx', s[0]); igCircle.setAttribute('cy', s[1]); igCircle.setAttribute('r', s[2]); }
  if (igniteScene) igniteScene.setTier(v);
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
function whenIdleOrInteract(fn) {
  let done = false;
  const go = () => { if (done) return; done = true; evs.forEach((e) => window.removeEventListener(e, go)); fn(); };
  const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
  evs.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1800));
  const kick = () => idle(go, { timeout: 3500 });
  if (document.readyState === 'complete') kick(); else window.addEventListener('load', kick, { once: true });
}
if (FX) {
  const posterMode = params.has('poster');
  const loadHero = async () => {
    try {
      const { createHero } = await import('./hero-scene.js');
      heroScene = createHero($('.hero-canvas'), {
        mobile: MOBILE, poster: posterMode,
        onStop: () => { heroScene = null; },
      });
      heroScene.setProgress(heroP);
      window.__hero = heroScene;
    } catch (err) {
      console.warn('3D disabled:', err && err.message);
      root.classList.remove('fx'); onScroll();
    }
  };
  if (posterMode) loadHero(); else whenIdleOrInteract(loadHero);

  const ig = $('[data-ignite]');
  const igIO = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    igIO.disconnect();
    try {
      const { createIgnite } = await import('./ignite-scene.js');
      igniteScene = createIgnite($('.ignite-canvas'), { mobile: MOBILE, tier: $('input[name="tier"]:checked').value });
    } catch (err) { console.warn('ignite fallback:', err && err.message); }
  }, { rootMargin: '400px 0px' });
  igIO.observe(ig);
}

/* ---------- smooth scroll + pinned activities (motion only) ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}
if (MOTION && !params.has('nolenis')) {
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
    window.__st = ScrollTrigger;
  })();
}
