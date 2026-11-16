/* World-to-world transition.
   Leaving: an overlay in the destination's colours grows from the click point, then we navigate.
   Arriving: the page starts covered (class set in <head> before first paint) and the cover opens. */
(function () {
  'use strict';
  var root = document.documentElement;
  var warp = document.getElementById('warp');
  if (!warp) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAMES = {
    wuwa: { t: 'Solaris-3', s: 'Resonance Archive', k: 'Tuning frequency' },
    genshin: { t: 'Teyvat', s: 'Irminsul Records', k: 'Charting the stars' },
    atlas: { t: 'Lore Atlas', s: 'Two worlds, one archive', k: 'Returning' }
  };
  function fill(to) {
    var n = NAMES[to] || NAMES.atlas;
    warp.setAttribute('data-to', to);
    warp.querySelector('.warp-k').textContent = n.k;
    warp.querySelector('.warp-t').textContent = n.t;
    warp.querySelector('.warp-s').textContent = n.s;
  }

  // arriving
  if (root.classList.contains('warp-in')) {
    fill(root.dataset.world || 'atlas');
    try { sessionStorage.removeItem('warp'); } catch (e) {}
    var done = false;
    var reveal = function () {
      if (done) return; done = true;
      requestAnimationFrame(function () {
        root.classList.add('warp-reveal');
        setTimeout(function () { root.classList.remove('warp-in', 'warp-reveal'); }, reduce ? 50 : 1150);
      });
    };
    window.addEventListener('load', function () { setTimeout(reveal, reduce ? 0 : 420); });
    setTimeout(reveal, 2200);
  }

  // leaving
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-warp]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    var to = a.getAttribute('data-warp');
    fill(to);
    var r = a.getBoundingClientRect();
    var x = e.clientX || (r.left + r.width / 2), y = e.clientY || (r.top + r.height / 2);
    warp.style.setProperty('--x', x + 'px');
    warp.style.setProperty('--y', y + 'px');
    try { sessionStorage.setItem('warp', to); } catch (err) {}
    root.classList.add('warp-out');
    setTimeout(function () { window.location.href = a.href; }, reduce ? 0 : 980);
  });

  // back/forward cache: never show a stale cover
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) root.classList.remove('warp-out', 'warp-in', 'warp-reveal');
  });
})();
