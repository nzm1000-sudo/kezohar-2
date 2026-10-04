/* Runs before first paint: applies the stored theme so there is no flash. */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('kz-theme');
    if (t === 'dark' || t === 'light') d.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the system setting */ }
})();
