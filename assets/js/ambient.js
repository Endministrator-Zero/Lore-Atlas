/* Ambient background canvases. <canvas data-ambient="wuwa|genshin">
   wuwa: slow frequency lines and drifting motes. genshin: a twinkling night sky with a few constellations. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function setup(cv) {
    var kind = cv.getAttribute('data-ambient');
    var ctx = cv.getContext('2d');
    var w = 0, h = 0, dpr = 1, items = [], lines = [], raf = 0, last = 0, visible = true;

    function resize() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed(); draw(performance.now());
    }
    function seed() {
      items = []; lines = [];
      var i, n;
      if (kind === 'wuwa') {
        n = Math.round(Math.min(46, w * h / 26000));
        for (i = 0; i < n; i++) items.push({ x: rnd(0, w), y: rnd(0, h), s: rnd(1, 2.6), v: rnd(4, 14), a: rnd(0.12, 0.5), p: rnd(0, 6.28) });
        for (i = 0; i < 5; i++) lines.push({ y: h * (0.18 + i * 0.17), amp: rnd(10, 34), f: rnd(0.0016, 0.0042), sp: rnd(0.08, 0.22) * (i % 2 ? 1 : -1), a: 0.05 + i * 0.012, ph: rnd(0, 6.28) });
      } else {
        n = Math.round(Math.min(190, w * h / 7000));
        for (i = 0; i < n; i++) items.push({ x: rnd(0, w), y: rnd(0, h), s: rnd(0.5, 1.7), a: rnd(0.2, 0.9), p: rnd(0, 6.28), v: rnd(0.4, 1.4), big: Math.random() < 0.06 });
        // constellations: short chains of nearby points
        for (i = 0; i < 3; i++) {
          var cx = rnd(w * 0.1, w * 0.9), cy = rnd(h * 0.12, h * 0.88), pts = [], k, m = 4 + Math.floor(rnd(0, 3));
          for (k = 0; k < m; k++) { pts.push({ x: cx, y: cy }); cx += rnd(40, 110) * (Math.random() < 0.5 ? -1 : 1) * 0.8 + 30; cy += rnd(-70, 70); }
          lines.push({ pts: pts, p: rnd(0, 6.28) });
        }
      }
    }
    function star4(x, y, r, a) {
      ctx.globalAlpha = a; ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
    }
    function draw(t) {
      var s = t / 1000, i, it;
      ctx.clearRect(0, 0, w, h);
      if (kind === 'wuwa') {
        ctx.lineWidth = 1;
        for (i = 0; i < lines.length; i++) {
          var L = lines[i]; ctx.beginPath();
          for (var x = 0; x <= w; x += 8) {
            var y = L.y + Math.sin(x * L.f + s * L.sp + L.ph) * L.amp + Math.sin(x * L.f * 2.7 - s * L.sp * 1.6) * L.amp * 0.28;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = 'rgba(230,201,138,' + L.a + ')'; ctx.stroke();
        }
        ctx.fillStyle = '#e6c98a';
        for (i = 0; i < items.length; i++) {
          it = items[i];
          var yy = (it.y - s * it.v) % h; if (yy < 0) yy += h;
          ctx.globalAlpha = it.a * (0.55 + 0.45 * Math.sin(s * 0.8 + it.p));
          ctx.save(); ctx.translate(it.x + Math.sin(s * 0.3 + it.p) * 8, yy); ctx.rotate(Math.PI / 4);
          ctx.fillRect(-it.s / 2, -it.s / 2, it.s, it.s); ctx.restore();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = 'rgba(211,188,142,0.16)'; ctx.lineWidth = 1;
        for (i = 0; i < lines.length; i++) {
          var C = lines[i]; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(s * 0.25 + C.p); ctx.beginPath();
          C.pts.forEach(function (p, k) { if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
          ctx.stroke();
          ctx.fillStyle = '#f1dfb1';
          C.pts.forEach(function (p) { star4(p.x, p.y, 4.5, 0.5 + 0.3 * Math.sin(s * 0.6 + C.p)); });
        }
        for (i = 0; i < items.length; i++) {
          it = items[i];
          var tw = 0.45 + 0.55 * Math.sin(s * it.v + it.p);
          ctx.fillStyle = it.big ? '#f1dfb1' : '#dfe6ff';
          if (it.big) star4(it.x, it.y, 3 + it.s * 2 * tw, it.a * tw);
          else { ctx.globalAlpha = it.a * tw; ctx.beginPath(); ctx.arc(it.x, it.y, it.s, 0, 6.283); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
      }
    }
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (!visible || t - last < 33) return;
      last = t; draw(t);
    }
    window.addEventListener('resize', function () { clearTimeout(cv._rt); cv._rt = setTimeout(resize, 120); });
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; });
    resize();
    if (!reduce) raf = requestAnimationFrame(loop);
  }

  Array.prototype.forEach.call(document.querySelectorAll('canvas[data-ambient]'), setup);
})();
