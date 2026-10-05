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

/* ---------- layout metrics (read on resize only, never inside the scroll path) ---------- */
const header = $('[data-header]');
const hero = $('.hero');
const M = { top: 0, h: 0, vh: 0, head: 0 };
function measure() { M.top = hero.offsetTop; M.h = hero.offsetHeight; M.vh = window.innerHeight; M.head = header.offsetHeight; }
measure();

/* ---------- header ---------- */
function headerState() {
  const y = window.scrollY;
  const over = y < M.top + M.h - M.head;
  if (over) { if (header.dataset.over !== 'hero') { header.dataset.over = 'hero'; navLinks.forEach((l) => l.removeAttribute('aria-current')); } }
  else if (header.dataset.over) delete header.dataset.over;
  header.classList.toggle('is-solid', !over);
  header.classList.toggle('is-scrolled', y > 24);
}
const navLinks = $$('.nav a');
const secIO = new IntersectionObserver((ents) => ents.forEach((e) => {
  if (!e.isIntersecting || header.dataset.over) return;
  navLinks.forEach((a) => { if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
}), { rootMargin: '-45% 0px -50% 0px' });
['vision', 'activities', 'partnership', 'benefits', 'donate'].forEach((id) => { const el = document.getElementById(id); if (el) secIO.observe(el); });

/* ---------- hero scroll choreography (CSS vars; 3D reads the same progress) ---------- */
// The raw scroll position is only a target: every frame the shown progress eases toward it
// (time-based, so it feels the same at 60 or 120 Hz). A flick of the wheel or a fast swipe glides
// through the words → dust → building → photo story instead of snapping.
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let heroScene = null, heroP = 0, heroT = 0, heroRaf = 0, heroLast = 0;
const heroCopy = $('.hero-copy');
const dustTitle = $('[data-dust-title]');
const railDots = $$('.hero-rail b').map((el) => ({ el, at: parseFloat(el.style.getPropertyValue('--at')), on: false }));
const H = {
  title: $('.hero-title'),
  // the words around the title, in the order they leave: the plaque, the presidency and the buttons first,
  // then the kicker and the eyebrow, and last the two lines that hug the title
  outer: $$('.hero-lede, .hero-presidency, .hero-ctas'), mid: $$('.hero-kicker, .hero-eyebrow'), inner: $$('.hero-sub, .hero-motto'),
  photo: $('.hero-photo'), sharp: $('.hero-photo-sharp'), scrim: $('.hero-scrim'), veil: $('.hero-veil'), halo: $('.hero-halo'),
  line: $('.hero-line'), scroll: $('.hero-scroll'), rail: $('.hero-rail'), fill: $('.hero-rail-fill'), caption: $('.hero-caption'),
};
// write a style only when it changes, straight onto the element that uses it
const put = (el, prop, v) => { const c = el.__kz || (el.__kz = {}); if (c[prop] !== v) { c[prop] = v; el.style[prop] = v; } };
function heroClear() { Object.values(H).flat().forEach((el) => { if (el && el.__kz) { Object.keys(el.__kz).forEach((k) => { el.style[k] = ''; }); el.__kz = null; } }); }
function heroTarget() {
  const span = M.h - M.vh;
  return span > 0 ? Math.min(1, Math.max(0, (window.scrollY - M.top) / span)) : 0;
}
function heroApply(p) {
  // Order of the story: first the words around the title leave (outer lines first, the lines that
  // hug the title last), and only once they are all gone does the title hand over to its particle
  // twin (hero-scene STAGE.textIn 7–12%). Without the 3D the title simply fades at the same moment.
  const dust = heroScene && heroScene.hasDust;
  const title = 1 - (dust ? sm(0.072, 0.118, p) : sm(0.072, 0.15, p));
  const outer = 1 - sm(0.004, 0.044, p), mid = 1 - sm(0.014, 0.054, p), inner = 1 - sm(0.024, 0.064, p);
  const line = sm(0.3, 0.37, p) * (1 - sm(0.5, 0.57, p));
  // a long, overlapping cross-fade: the photo arrives over ~35% of the stage while the points thin out
  const photo = sm(0.6, 0.95, p);
  const blur = 1 - sm(0.62, 0.92, p);
  const halo = sm(0.75, 0.97, p);
  const f = (x) => x.toFixed(3);
  put(H.title, 'opacity', f(title));
  for (const [els, v] of [[H.outer, outer], [H.mid, mid], [H.inner, inner]]) {
    const o = f(v), t = `translateY(${((1 - v) * -14).toFixed(1)}px)`;
    els.forEach((el) => { put(el, 'opacity', o); put(el, 'transform', t); });
  }
  put(H.scroll, 'opacity', f(outer));
  put(H.line, 'opacity', f(line)); put(H.line, 'transform', `translateY(${((1 - line) * 16).toFixed(1)}px)`);
  put(H.photo, 'opacity', f(photo)); put(H.sharp, 'opacity', f(1 - blur));
  put(H.caption, 'opacity', f(photo)); // "המחשה" arrives with the photo it labels
  put(H.scrim, 'opacity', f(photo * 0.42)); put(H.veil, 'opacity', f(photo));
  put(H.halo, 'opacity', f(halo));
  put(H.rail, 'opacity', f(sm(0.004, 0.025, p) * (1 - sm(0.975, 0.999, p))));
  put(H.fill, 'transform', `scaleY(${f(p)})`);
  railDots.forEach((d) => { const on = p >= d.at - 0.005; if (on !== d.on) { d.on = on; d.el.classList.toggle('is-on', on); } });
  const hOn = halo > 0.005; if (hOn !== H.halo.__on) { H.halo.__on = hOn; H.halo.classList.toggle('is-on', hOn); }
  const hidden = inner < 0.02 && title < 0.02; if (hidden !== heroCopy.__hid) { heroCopy.__hid = hidden; heroCopy.toggleAttribute('data-hidden', hidden); }
  if (heroScene) heroScene.setProgress(p);
}
function heroTick(now) {
  const dt = Math.min(0.1, (now - (heroLast || now)) / 1000); heroLast = now;
  const k = 1 - Math.exp(-dt * 2.8);
  heroP += (heroT - heroP) * k;
  if (Math.abs(heroT - heroP) < 0.0003) heroP = heroT;
  heroApply(heroP);
  heroRaf = heroP === heroT ? 0 : requestAnimationFrame(heroTick);
}
function heroState() {
  if (!FX || !root.classList.contains('fx')) return;
  heroT = heroTarget();
  if (TEST && TEST.instant) { heroP = heroT; heroApply(heroP); return; }
  if (!heroRaf) { heroLast = 0; heroRaf = requestAnimationFrame(heroTick); }
}
// the golden aura sits behind the building of the photo: match the photo's cover-fit box. On portrait
// screens the photo is the portrait render (tools/portrait-renders.cjs): the 1376×768 frame is scaled by
// 900/1256 (sideways) and 550/768 (down), shifted 60 px left and placed 1040 px down a 900×1950 picture.
const heroImg = $('.hero-photo-sharp img');
const PORTRAIT = mq('(max-aspect-ratio: 4/5)');
function layoutHalo() {
  if (!FX) return;
  const W = hero.clientWidth, Hh = M.vh;
  const op = getComputedStyle(heroImg).objectPosition.split(' ').map(parseFloat);
  const ox = Number.isNaN(op[0]) ? 0.5 : op[0] / 100, oy = Number.isNaN(op[1]) ? 0.78 : op[1] / 100;
  const P = PORTRAIT.matches ? { w: 900, h: 1950, x: -60 * 900 / 1256, y: 1040, bw: 1376 * 900 / 1256, bh: 550 } : { w: 1376, h: 768, x: 0, y: 0, bw: 1376, bh: 768 };
  const s = Math.max(W / P.w, Hh / P.h), l = (W - P.w * s) * ox + P.x * s, t = (Hh - P.h * s) * oy + P.y * s;
  Object.assign(H.halo.style, { left: l.toFixed(1) + 'px', top: t.toFixed(1) + 'px', width: (P.bw * s).toFixed(1) + 'px', height: (P.bh * s).toFixed(1) + 'px' });
}
if (FX) { layoutHalo(); heroT = heroP = heroTarget(); heroApply(heroP); }
// keyboard users tabbing into hero CTAs: bring hero copy back into view
heroCopy.addEventListener('focusin', () => { if (FX && heroP > 0.004) { window.scrollTo({ top: M.top, behavior: 'auto' }); if (lenis) lenis.scrollTo(M.top, { immediate: true }); heroT = heroP = 0; heroApply(0); } });

/* ---------- back to top ---------- */
const toTop = $('[data-to-top]');
function toTopState() {
  const y = window.scrollY, on = toTop.classList.contains('is-on');
  // a little hysteresis: shows past the first screen, hides again only near the top
  if (!on && y > M.vh) toTop.classList.add('is-on');
  else if (on && y < M.vh * 0.6) toTop.classList.remove('is-on');
}
toTop.addEventListener('click', (e) => {
  if (lenis) lenis.scrollTo(0, { duration: 1.4 });
  else window.scrollTo({ top: 0, behavior: MOTION ? 'smooth' : 'auto' });
  // keyboard and screen-reader activation (no pointer): continue from the top of the page, at the skip link
  if (e.detail === 0) $('.skip-link').focus({ preventScroll: true });
  else toTop.blur();
});

let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => { ticking = false; headerState(); heroState(); toTopState(); });
}
function onResize() { measure(); layoutHalo(); onScroll(); }
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onResize, { passive: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
onScroll();

/* ---------- living title (and the royal tier's gold): pause the slow drift while off screen ---------- */
if (MOTION && 'IntersectionObserver' in window) {
  const lio = new IntersectionObserver((ents) => ents.forEach((e) => e.target.classList.toggle('is-paused', !e.isIntersecting)));
  $$('.lux-wrap, .tier-royal').forEach((el) => lio.observe(el));
}

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
const menuBtn = $('[data-open-menu]');
function openDialog(d) { d.showModal(); if (lenis) lenis.stop(); document.body.style.overflow = 'hidden'; if (d === menu) menuBtn.setAttribute('aria-expanded', 'true'); }
// the menu panel springs closed (CSS) before the dialog really closes
function closeDialog(d) {
  if (!d.open || d.classList.contains('is-closing')) return;
  if (d !== menu || !MOTION) { d.close(); return; }
  d.classList.add('is-closing');
  let done = false;
  const fin = () => { if (done) return; done = true; d.classList.remove('is-closing'); d.close(); };
  d.addEventListener('animationend', fin, { once: true });
  setTimeout(fin, 320);
}
function closed(e) { if (lenis) lenis.start(); document.body.style.overflow = ''; if (e.currentTarget === menu) { menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus({ preventScroll: true }); } }
[menu, sheet].forEach((d) => {
  d.addEventListener('close', closed);
  d.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(d); }); // Esc
  // keep Tab inside the open dialog (wrap around instead of escaping to the browser UI)
  d.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked', d).filter((el) => el.offsetParent !== null || el.getClientRects().length);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // backdrop click: the pointer landed outside the dialog's own box
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(d);
  });
});
$$('[data-close]').forEach((b) => b.addEventListener('click', () => closeDialog(b.closest('dialog'))));
$$('[data-close-nav]').forEach((a) => a.addEventListener('click', () => { const d = a.closest('dialog'); d.classList.remove('is-closing'); d.close(); }));
menuBtn.addEventListener('click', () => openDialog(menu));

/* ---------- tiers (section ↔ sheet stay in sync) ---------- */
const NEDARIM = 'https://www.matara.pro/nedarimplus/online/?mosad=5776132';
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
  // Nedarim Plus pre-fill (parameters read by the donation page itself): monthly sum, 48 charges, הוראת קבע
  $('[data-nedarim]').href = `${NEDARIM}&Amount=${v}&Payment=48&KevaDefault=1`;
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
const syncPlaque = () => { plaque.textContent = ded.value.trim() || 'שמכם כאן'; };
ded.addEventListener('input', syncPlaque);
syncPlaque(); // a name the browser restored (reload / back) shows on the plaque too

/* ---------- dedication certificate (drawn on the visitor's device; the name is never sent) ---------- */
let certMod = null;
async function makeCert() {
  const name = ded.value.trim();
  if (!name) { say('הקלידו שם להקדשה'); ded.focus(); return null; }
  if (!certMod) certMod = await import('./certificate.js');
  const v = $('input[name="sheet-tier"]:checked', sheet).value;
  return certMod.drawCertificate({ name, tier: NAMES[v] });
}
$('[data-cert-download]').addEventListener('click', async () => {
  const blob = await makeCert(); if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'kezohar-harakia-dedication.png' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  say('התעודה נשמרה');
});
$('[data-cert-share]').addEventListener('click', async () => {
  const site = location.href.split('#')[0];
  const msg = 'כְּזֹהַר הָרָקִיעַ — קומפלקס רוחני-קהילתי בלב נתיבות. כל מטר שתתרמו ישא את שמכם לנצח:';
  // open WhatsApp synchronously when files cannot be shared (popup blockers need the click's gesture)
  const canFiles = !!(navigator.canShare && window.File) && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] });
  if (!canFiles) { window.open('https://wa.me/?text=' + encodeURIComponent(msg + ' ' + site), '_blank', 'noopener'); return; }
  const blob = await makeCert(); if (!blob) return;
  const file = new File([blob], 'תעודת-הקדשה.png', { type: 'image/png' });
  try { await navigator.share({ files: [file], text: msg + ' ' + site }); } catch (e) { /* the visitor closed the share sheet */ }
});

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
        mobile: MOBILE, poster: posterMode, noGov: !!(TEST && TEST.noGov), photo: heroImg, title: dustTitle, tier: TEST && TEST.tier != null ? TEST.tier : null,
        onStop: () => { heroScene = null; },
      });
      heroScene.setProgress(heroP);
      if (TEST) window.__hero = heroScene;
    } catch (err) {
      console.warn('3D disabled:', err && err.message);
      root.classList.remove('fx'); heroClear(); onScroll();
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
      // a calmer wheel: each notch travels ~25% less and glides a little longer (keyboard, anchors
      // and the scrollbar keep native distances; phones never load Lenis; reduced motion skips it)
      lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.75, smoothWheel: true, anchors: true }); // Lenis already honours the page's scroll-padding-top (the header clearance)
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
