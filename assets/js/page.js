// Secondary pages (accessibility statement, privacy policy): the theme toggle only.
const root = document.documentElement;
root.classList.add('js');
const btn = document.querySelector('[data-theme-toggle]');
const dark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
function sync() {
  const d = dark();
  btn.setAttribute('aria-pressed', String(d));
  btn.querySelector('.sr-only').textContent = d ? 'מצב יום' : 'מצב לילה';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', d ? '#141311' : '#F7F3EC'));
}
btn.addEventListener('click', () => {
  root.dataset.theme = dark() ? 'light' : 'dark';
  try { localStorage.setItem('kz-theme', root.dataset.theme); } catch (e) { /* storage unavailable */ }
  sync();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
sync();
