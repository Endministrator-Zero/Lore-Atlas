/* Gateway page: live facts for each world (version, banners on now, Theater season),
   rotating splash art of the characters on banner, and the daily reset countdown. */
(function () {
  'use strict';
  var S = window.LORE_SUMMARY || {};
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EL = { Pyro: 'pyro', Hydro: 'hydro', Anemo: 'anemo', Electro: 'electro', Dendro: 'dendro', Cryo: 'cryo', Geo: 'geo' };

  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function left(ms) {
    if (ms <= 0) return 'now';
    var d = Math.floor(ms / 864e5), hr = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return d > 0 ? d + 'd ' + hr + 'h' : hr > 0 ? hr + 'h ' + m + 'm' : m + 'm';
  }
  function nextReset() { var d = new Date(), r = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 20); return r > d.getTime() ? r : r + 864e5; }

  function live(w) {
    var s = S[w], box = document.querySelector('[data-live="' + w + '"]');
    if (!s || !box) return;
    box.replaceChildren();
    var now = Date.now(), N = s.now;
    if (N) {
      var a = Date.parse(N.start), b = Date.parse(N.end), pct = Math.max(0, Math.min(100, (now - a) / (b - a) * 100));
      var head = h('div', 'dl-head');
      head.append(h('b', 'dl-v', N.v), h('span', 'dl-name', N.name || 'Version ' + N.v), h('span', 'dl-left', now < b ? 'ends in ' + left(b - now) : 'ended'));
      var bar = h('div', 'dl-bar'), fill = h('i'); fill.style.width = pct.toFixed(1) + '%'; bar.append(fill);
      box.append(head, bar);
      // banners on now, or the next ones if a phase just ended
      var on = (N.banners || []).filter(function (x) { return Date.parse(x.start) <= now && now < Date.parse(x.end); });
      var soon = on.length ? [] : (N.banners || []).filter(function (x) { return Date.parse(x.start) > now; });
      var list = on.length ? on : soon.slice(0, 3);
      if (list.length) {
        var row = h('div', 'dl-banners');
        row.append(h('span', 'dl-lbl', on.length ? 'On banner now' : 'Next banners'));
        var faces = h('div', 'dl-faces'), seen = {};
        list.forEach(function (x) {
          x.chars.forEach(function (id) {
            if (seen[id]) return; seen[id] = 1;
            var f = h('span', 'dl-face' + (x.kind === 'char' ? ' main' : ''));
            f.title = (s.names && s.names[id] || id) + ' · ' + x.name;
            var im = h('img'); im.src = 'assets/img/' + w + '/icons/' + id + '.webp'; im.alt = ''; im.loading = 'lazy';
            f.append(im); faces.append(f);
          });
        });
        var firstEnd = Math.min.apply(null, list.map(function (x) { return Date.parse(on.length ? x.end : x.start); }));
        row.append(faces, h('span', 'dl-when', (on.length ? 'Phase ends in ' : 'Starts in ') + left(firstEnd - now)));
        box.append(row);
      }
    }
    if (s.theater && Date.parse(s.theater.end) > now) {
      var t = h('div', 'dl-theater');
      t.append(h('span', 'dl-lbl', 'Imaginarium Theater'));
      var els = h('span', 'dl-els');
      s.theater.elements.forEach(function (e) { var im = h('img'); im.src = 'assets/img/el/gi_' + (EL[e] || e.toLowerCase()) + '.webp'; im.alt = e; im.title = e; els.append(im); });
      t.append(els, h('span', 'dl-when', 'resets in ' + left(Date.parse(s.theater.end) - now)));
      box.append(t);
    }
  }

  function stats(w) {
    var s = S[w], st = document.querySelector('[data-stats="' + w + '"]');
    if (!s || !st) return;
    [[s.versions, 'versions'], [s.chars, w === 'wuwa' ? 'resonators' : 'characters'], [s.lines, 'voice lines']].forEach(function (x) {
      var d = h('div'); d.append(h('b', null, x[0]), h('span', null, x[1])); st.append(d);
    });
  }

  // splash art of the characters on banner, crossfading every few seconds
  function art(w) {
    var s = S[w], box = document.querySelector('[data-door="' + w + '"] .door-art');
    if (!s || !box || !s.art || !s.art.length) return;
    var imgs = box.querySelectorAll('img'), i = 0, cur = 0;
    var now = Date.now(), N = s.now || { banners: [] };
    var liveIds = {}; N.banners.forEach(function (x) { if (Date.parse(x.start) <= now && now < Date.parse(x.end)) x.chars.forEach(function (id) { liveIds[id] = 1; }); });
    var list = s.art.filter(function (id) { return liveIds[id]; });
    if (!list.length) list = s.art.slice();
    function show(id) {
      var next = imgs[1 - cur];
      next.onload = function () { next.classList.add('on'); imgs[cur].classList.remove('on'); cur = 1 - cur; };
      next.src = 'assets/img/' + w + '/art/' + id + '.webp';
    }
    show(list[0]);
    if (list.length > 1 && !reduce) setInterval(function () { if (!document.hidden) { i = (i + 1) % list.length; show(list[i]); } }, 7000);
  }

  function reset() {
    var p = document.getElementById('gate-reset'); if (!p) return;
    p.textContent = 'Daily reset in ' + left(nextReset() - Date.now()) + ' · 4:00 AM China time (UTC+8)';
  }

  ['wuwa', 'genshin'].forEach(function (w) { stats(w); live(w); art(w); });
  reset();
  setInterval(function () { if (document.hidden) return; live('wuwa'); live('genshin'); reset(); }, 60000);

  // a gentle parallax on the art, following the pointer
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    var gate = document.querySelector('.gate'), raf = 0, mx = 0, my = 0;
    gate.addEventListener('pointermove', function (e) {
      mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; gate.style.setProperty('--px', mx.toFixed(3)); gate.style.setProperty('--py', my.toFixed(3)); });
    });
  }
})();
