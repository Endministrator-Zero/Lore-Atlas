/* Lore Atlas: shared engine for both world pages.
   Reads window.LORE_DATA (assets/data/<world>.js) and renders timeline, roster, sheet and connections. */
(function () {
  'use strict';
  var D = window.LORE_DATA;
  var WORLD = document.documentElement.dataset.world;
  if (!D) return;

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, attrs) {
    var n = document.createElement(tag), i, k;
    if (attrs) for (k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x.nodeType ? x : document.createTextNode(x)); });
      else n.appendChild(c.nodeType ? c : document.createTextNode(c));
    }
    return n;
  }
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IMG = 'assets/img/' + WORLD + '/';
  var WW_EL = { Glacio: 'ice', Fusion: 'fire', Electro: 'sphunder', Aero: 'wind', Spectro: 'light', Havoc: 'dark' };
  function elIcon(name) {
    if (!name) return null;
    return 'assets/img/el/' + (WORLD === 'wuwa' ? 'ww_' + WW_EL[name] : 'gi_' + name.toLowerCase()) + '.webp';
  }
  var byId = {};
  D.chars.forEach(function (c) { byId[c.id] = c; });
  var outLines = {}, inLines = {};
  D.lines.forEach(function (l) {
    (outLines[l.f] = outLines[l.f] || []).push(l);
    (inLines[l.t] = inLines[l.t] || []).push(l);
  });
  var VERS = [];
  D.arcs.forEach(function (a, ai) { a.versions.forEach(function (v, vi) { VERS.push({ arc: ai, idx: vi, v: v }); }); });
  function verKey(v) { var p = v.split('.'); return (+p[0]) * 100 + (+p[1]); }
  function bondKey(a, b) { return [a, b].sort().join('|'); }
  function place(c) { return c.region + (c.faction && c.faction !== c.region ? ' · ' + c.faction : ''); }

  function face(c, cls) {
    var f = h('span', { class: 'face r' + c.rarity + ' ' + (c.el ? 'el-' + c.el.toLowerCase() : 'el-none') + (cls ? ' ' + cls : '') },
      h('img', { src: IMG + 'icons/' + c.id + '.webp', alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }));
    return f;
  }
  function elBadge(name) {
    if (!name) return null;
    return h('span', { class: 'elb el-' + name.toLowerCase(), title: name }, h('img', { src: elIcon(name), alt: '' }));
  }
  function stars(n) { return h('span', { class: 'stars', 'aria-label': n + ' star' }, new Array(n + 1).join('★')); }
  function scrollToId(id) {
    var t = document.getElementById(id); if (!t) return;
    var y = t.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function swap(container, node) {
    // crossfade content swap
    container.classList.remove('swap-in'); void container.offsetWidth;
    container.replaceChildren(node);
    container.classList.add('swap-in');
  }

  // ---------- hero ----------
  function initHero() {
    $('#hero-kicker').textContent = D.meta.kicker;
    $('#hero-title').textContent = D.meta.title;
    $('#hero-intro').textContent = D.meta.intro;
    var stats = [
      [VERS.length, 'versions charted'],
      [D.chars.length, D.meta.charWord.toLowerCase()],
      [D.lines.length, 'voice lines'],
      [D.arcs.length, 'chapters']
    ];
    var box = $('#hero-stats');
    stats.forEach(function (s) {
      var num = h('b', { text: reduceMotion ? String(s[0]) : '0' });
      box.appendChild(h('div', { class: 'stat' }, num, h('span', { text: s[1] })));
      if (!reduceMotion) countUp(num, s[0]);
    });
    var last = VERS[VERS.length - 1];
    var card = $('#hero-latest');
    card.appendChild(h('span', { class: 'lbl', text: 'Latest charted version' }));
    card.appendChild(h('div', { class: 'latest-row' },
      h('b', { class: 'latest-v', text: last.v.v }),
      h('div', null, h('strong', { text: last.v.name }), h('span', { text: last.v.date + ' · ' + D.arcs[last.arc].name }))));
    var faces = h('div', { class: 'latest-faces' });
    last.v.chars.forEach(function (id) { faces.appendChild(face(byId[id])); });
    card.appendChild(faces);
    card.addEventListener('click', function () { goVersion(last.v.v); });
  }
  function countUp(node, to) {
    var t0 = null, dur = 1100;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur); p = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(to * p);
      if (p < 1) requestAnimationFrame(step);
    }
    setTimeout(function () { requestAnimationFrame(step); }, 350);
  }

  // ---------- timeline ----------
  var T = { arc: 0, ver: 0 };
  function initTimeline() {
    var tabs = $('#arc-tabs');
    D.arcs.forEach(function (a, i) {
      tabs.appendChild(h('button', {
        class: 'arc-tab', role: 'tab', type: 'button', id: 'arc-tab-' + i, style: '--hue:' + a.hue,
        onclick: function () { selectArc(i, 0, true); }
      }, h('span', { class: 'arc-range', text: a.range.replace(' to ', ' – ') }), h('span', { class: 'arc-name', text: a.name })));
    });
    $('#ver-prev').addEventListener('click', function () { stepVersion(-1); });
    $('#ver-next').addEventListener('click', function () { stepVersion(1); });
    $('#rail').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { stepVersion(1); e.preventDefault(); focusNode(); }
      if (e.key === 'ArrowLeft') { stepVersion(-1); e.preventDefault(); focusNode(); }
    });
    selectArc(0, 0, false);
  }
  function focusNode() { var n = $('#rail .node.on'); if (n) n.focus(); }
  function selectArc(i, vi, user) {
    T.arc = i;
    var a = D.arcs[i];
    $$('#arc-tabs .arc-tab').forEach(function (b, bi) {
      b.classList.toggle('on', bi === i); b.setAttribute('aria-selected', bi === i ? 'true' : 'false');
    });
    var on = $('#arc-tabs .arc-tab.on');
    if (on && user && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    $('#timeline').style.setProperty('--hue', a.hue);
    swap($('#arc-head'), h('div', { class: 'arc-head-in' },
      h('span', { class: 'lbl', text: a.chapter }),
      h('h3', { text: a.name }),
      h('p', { text: a.blurb })));
    var rail = $('#rail'); rail.replaceChildren();
    var track = h('div', { class: 'rail-track' }, h('i', { class: 'rail-line' }), h('i', { class: 'rail-fill', id: 'rail-fill' }));
    a.versions.forEach(function (v, k) {
      track.appendChild(h('button', {
        class: 'node', type: 'button', 'data-k': k, style: '--i:' + k,
        'aria-label': 'Version ' + v.v + ', ' + v.name,
        onclick: function () { selectVersion(k, true); }
      }, h('i', { class: 'pip' }), h('b', { text: v.v }), h('span', { text: v.date.replace(/, (\d{4})$/, ' $1') })));
    });
    rail.appendChild(track);
    rail.classList.remove('rail-in'); void rail.offsetWidth; rail.classList.add('rail-in');
    selectVersion(vi, false);
  }
  function selectVersion(k, user) {
    T.ver = k;
    var a = D.arcs[T.arc], v = a.versions[k];
    var nodes = $$('#rail .node');
    nodes.forEach(function (n, i) { n.classList.toggle('on', i === k); n.classList.toggle('past', i < k); n.tabIndex = i === k ? 0 : -1; });
    var cur = nodes[k], track = $('#rail .rail-track');
    if (cur && track) {
      var x = cur.offsetLeft + cur.offsetWidth / 2;
      $('#rail-fill').style.width = x + 'px';
      var rail = $('#rail');
      var target = x - rail.clientWidth / 2;
      if (rail.scrollTo) rail.scrollTo({ left: target, behavior: user && !reduceMotion ? 'smooth' : 'auto' });
    }
    var gi = VERS.findIndex(function (x) { return x.arc === T.arc && x.idx === k; });
    $('#ver-prev').disabled = gi <= 0; $('#ver-next').disabled = gi >= VERS.length - 1;
    $('#ver-count').textContent = (gi + 1) + ' / ' + VERS.length;

    var cast = h('div', { class: 'cast' });
    if (v.chars.length) {
      v.chars.forEach(function (id, i) {
        var c = byId[id];
        cast.appendChild(h('button', { class: 'chip-char', type: 'button', style: '--i:' + i, onclick: function () { openSheet(id); } },
          face(c), h('span', null, h('b', { text: c.name }), h('small', { text: (c.el ? c.el + ' · ' : '') + c.weapon }))));
      });
    } else cast.appendChild(h('p', { class: 'cast-none', text: 'No new playable ' + D.meta.charWord.toLowerCase() + ' in this version.' }));

    var card = h('article', { class: 'ver-card' },
      h('div', { class: 'ver-main' },
        h('div', { class: 'ver-num' }, h('b', { text: v.v }), v.tag ? h('em', { text: v.tag }) : null),
        h('div', { class: 'ver-body' },
          h('h4', { text: v.name }),
          h('p', { class: 'ver-meta' }, h('span', { text: v.date }), h('span', { text: v.acts })),
          h('p', { class: 'ver-text', text: v.text }),
          h('div', { class: 'tags' }, v.tags.map(function (t) { return h('span', { class: 'tag', text: t }); })))),
      h('div', { class: 'ver-cast' },
        h('span', { class: 'lbl', text: 'First appearances' + (v.chars.length ? ' · ' + v.chars.length : '') }), cast));
    swap($('#ver-detail'), card);
  }
  function stepVersion(d) {
    var gi = VERS.findIndex(function (x) { return x.arc === T.arc && x.idx === T.ver; }) + d;
    if (gi < 0 || gi >= VERS.length) return;
    var n = VERS[gi];
    if (n.arc !== T.arc) selectArc(n.arc, n.idx, true); else selectVersion(n.idx, true);
  }
  function goVersion(vstr) {
    var n = VERS.filter(function (x) { return x.v.v === vstr; })[0]; if (!n) return;
    closeSheet();
    selectArc(n.arc, n.idx, true);
    scrollToId('timeline');
  }

  // ---------- roster ----------
  var R = { q: '', el: '', region: '', rarity: 0, sort: 'debut' };
  function initRoster() {
    var elRow = $('#f-el');
    elRow.appendChild(chip('All', '', 'el'));
    D.elements.forEach(function (e) {
      var b = chip(e, e, 'el'); b.classList.add('el-' + e.toLowerCase());
      b.insertBefore(h('img', { src: elIcon(e), alt: '' }), b.firstChild);
      elRow.appendChild(b);
    });
    var regRow = $('#f-region');
    regRow.appendChild(chip('Everywhere', '', 'region'));
    D.regions.forEach(function (r) {
      if (D.chars.some(function (c) { return c.region === r; })) regRow.appendChild(chip(r, r, 'region'));
    });
    var rarRow = $('#f-rarity');
    [['All', 0], ['5★', 5], ['4★', 4]].forEach(function (x) { rarRow.appendChild(chip(x[0], x[1], 'rarity')); });
    var sortRow = $('#f-sort');
    [['By debut', 'debut'], ['A to Z', 'name']].forEach(function (x) { sortRow.appendChild(chip(x[0], x[1], 'sort')); });
    $('#f-q').addEventListener('input', function (e) { R.q = e.target.value.trim().toLowerCase(); renderRoster(); });
    $('#f-q').setAttribute('placeholder', 'Search ' + D.meta.charWord.toLowerCase());
    syncChips(); renderRoster();
  }
  function chip(label, val, key) {
    return h('button', { class: 'chip', type: 'button', 'data-key': key, 'data-val': String(val), onclick: function () { R[key] = val; syncChips(); renderRoster(); } }, h('span', { text: label }));
  }
  function syncChips() {
    $$('.filters .chip').forEach(function (b) {
      var on = String(R[b.dataset.key]) === b.dataset.val;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function renderRoster() {
    var list = D.chars.filter(function (c) {
      return (!R.q || c.name.toLowerCase().indexOf(R.q) >= 0 || (c.faction || '').toLowerCase().indexOf(R.q) >= 0) &&
        (!R.el || c.el === R.el) && (!R.region || c.region === R.region) && (!R.rarity || c.rarity === R.rarity);
    });
    list.sort(R.sort === 'name'
      ? function (a, b) { return a.name.localeCompare(b.name); }
      : function (a, b) { return verKey(a.ver) - verKey(b.ver) || b.rarity - a.rarity || a.name.localeCompare(b.name); });
    $('#roster-count').textContent = list.length + ' of ' + D.chars.length;
    var grid = h('div', { class: 'grid-in' });
    list.forEach(function (c, i) {
      grid.appendChild(h('button', { class: 'card r' + c.rarity + (c.el ? ' el-' + c.el.toLowerCase() : ''), type: 'button', style: '--i:' + Math.min(i, 40), onclick: function () { openSheet(c.id); } },
        h('span', { class: 'card-art' }, h('img', { src: IMG + 'icons/' + c.id + '.webp', alt: '', loading: 'lazy', decoding: 'async' }), elBadge(c.el), h('i', { class: 'card-ver', text: c.ver })),
        h('span', { class: 'card-name', text: c.name })));
    });
    if (!list.length) grid.appendChild(h('p', { class: 'empty', text: 'Nobody matches those filters. Clear one to see more.' }));
    $('#roster-grid').replaceChildren(grid);
  }

  // ---------- character sheet ----------
  var sheetOpen = false, lastFocus = null;
  function quoteBlock(l, who, dir) {
    var c = byId[who];
    return h('div', { class: 'quote' },
      h('button', { class: 'quote-who', type: 'button', onclick: function () { openSheet(who); }, title: 'Open ' + c.name },
        face(c), h('span', null, h('small', { text: dir }), h('b', { text: c.name + (l.s ? ' · ' + l.s : '') }))),
      h('blockquote', { text: l.q }));
  }
  function openSheet(id) {
    var c = byId[id]; if (!c) return;
    var sheet = $('#sheet'), body = $('#sheet-body');
    if (!sheetOpen) lastFocus = document.activeElement;
    var says = outLines[id] || [], said = inLines[id] || [];
    var L = D.labels;
    function fact(k, v, click) {
      if (!v) return null;
      return h('div', { class: 'fact' }, h('dt', { text: k }), click ? h('dd', null, h('button', { class: 'linkish', type: 'button', onclick: click, text: v })) : h('dd', { text: v }));
    }
    var tabs = h('div', { class: 'tabs', role: 'tablist' });
    var panes = h('div', { class: 'panes' });
    function addTab(label, items, dir, key, emptyMsg) {
      var pane = h('div', { class: 'pane', role: 'tabpanel' });
      if (items.length) items.forEach(function (l) { pane.appendChild(quoteBlock(l, l[key], dir)); });
      else pane.appendChild(h('p', { class: 'empty', text: emptyMsg }));
      var btn = h('button', { class: 'tab', type: 'button', role: 'tab', onclick: function () { pick(btn, pane); } }, label, h('i', { text: String(items.length) }));
      tabs.appendChild(btn); panes.appendChild(pane);
      return [btn, pane];
    }
    function pick(btn, pane) {
      $$('.tab', tabs).forEach(function (b) { b.classList.toggle('on', b === btn); b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
      $$('.pane', panes).forEach(function (p) { p.hidden = p !== pane; });
    }
    var t1 = addTab(c.name.split(' ')[0] + ' on others', says, 'About', 't', 'No voice lines about other ' + D.meta.charWord.toLowerCase() + ' are recorded for ' + c.name + ' yet.');
    var t2 = addTab('Others on ' + c.name.split(' ')[0], said, 'From', 'f', 'Nobody has a recorded voice line about ' + c.name + ' yet.');
    if (!says.length && said.length) pick(t2[0], t2[1]); else pick(t1[0], t1[1]);

    var art = c.art
      ? h('img', { class: 'sheet-art', src: IMG + 'art/' + c.id + '.webp', alt: c.name + ' artwork', decoding: 'async' })
      : h('img', { class: 'sheet-art sheet-art-icon', src: IMG + 'icons/' + c.id + '.webp', alt: '' });
    var content = h('div', { class: 'sheet-in r' + c.rarity + ' ' + (c.el ? 'el-' + c.el.toLowerCase() : 'el-none') },
      h('div', { class: 'sheet-hero' }, art,
        h('div', { class: 'sheet-id' },
          h('span', { class: 'lbl', text: place(c) }),
          h('h3', { id: 'sheet-name', text: c.name }),
          c.title ? h('p', { class: 'sheet-title', text: (WORLD === 'wuwa' ? L.title + ': ' : '') + c.title }) : null,
          h('div', { class: 'sheet-chips' },
            c.el ? h('span', { class: 'pill el' }, h('img', { src: elIcon(c.el), alt: '' }), c.el) : null,
            h('span', { class: 'pill', text: c.weapon }), h('span', { class: 'pill rare' }, stars(c.rarity))))),
      h('p', { class: 'sheet-lore', text: c.lore }),
      h('dl', { class: 'facts' },
        fact('First appeared', 'Version ' + c.ver, function () { goVersion(c.ver); }),
        fact(L.faction, c.faction), fact(L.region, c.region), fact('Birthday', c.birthday), L.extra ? fact(L.extra, c.extra) : null),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn', type: 'button', onclick: function () { closeSheet(); setCenter(id, null); scrollToId('connections'); } }, 'Show connections'),
        h('span', { class: 'sheet-count', text: (says.length + said.length) + ' voice lines' })),
      h('h4', { class: 'sheet-h', text: 'Voice-overs' }), tabs, panes);
    body.replaceChildren(content);
    body.scrollTop = 0;
    sheet.setAttribute('aria-labelledby', 'sheet-name');
    if (!sheetOpen) {
      sheetOpen = true; sheet.hidden = false; $('#scrim').hidden = false;
      void sheet.offsetWidth; document.documentElement.classList.add('sheet-open');
    } else { content.classList.add('sheet-swap'); }
    $('#sheet-close').focus();
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false; document.documentElement.classList.remove('sheet-open');
    setTimeout(function () { if (!sheetOpen) { $('#sheet').hidden = true; $('#scrim').hidden = true; } }, reduceMotion ? 0 : 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ---------- connections ----------
  var G = { center: null, sel: null, nodes: {} };
  function neighbours(id) {
    var m = {};
    (outLines[id] || []).forEach(function (l) { (m[l.t] = m[l.t] || {}).out = l; });
    (inLines[id] || []).forEach(function (l) { (m[l.f] = m[l.f] || {}).inn = l; });
    return Object.keys(m).map(function (k) { return { id: k, out: m[k].out, inn: m[k].inn }; })
      .sort(function (a, b) { return ((b.out && b.inn) ? 1 : 0) - ((a.out && a.inn) ? 1 : 0) || verKey(byId[a.id].ver) - verKey(byId[b.id].ver); });
  }
  function initGraph() {
    var deg = {};
    D.lines.forEach(function (l) { deg[l.f] = (deg[l.f] || 0) + 1; deg[l.t] = (deg[l.t] || 0) + 1; });
    var hubs = Object.keys(deg).sort(function (a, b) { return deg[b] - deg[a]; }).slice(0, 12);
    var row = $('#hub-row');
    hubs.forEach(function (id) {
      row.appendChild(h('button', { class: 'hub', type: 'button', title: byId[id].name, 'data-id': id, onclick: function () { setCenter(id, null); } }, face(byId[id])));
    });
    var input = $('#g-q'), list = $('#g-results');
    function results() {
      var q = input.value.trim().toLowerCase();
      list.replaceChildren();
      if (!q) { list.hidden = true; return; }
      var found = D.chars.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 7);
      found.forEach(function (c) {
        list.appendChild(h('button', { class: 'res', type: 'button', onclick: function () { input.value = ''; list.hidden = true; setCenter(c.id, null); } }, face(c), h('span', { text: c.name })));
      });
      if (!found.length) list.appendChild(h('p', { class: 'empty', text: 'No match.' }));
      list.hidden = false;
    }
    input.addEventListener('input', results);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var b = $('.res', list); if (b) b.click(); }
      if (e.key === 'Escape') { input.value = ''; list.hidden = true; }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.g-search')) list.hidden = true; });
    $('#g-random').addEventListener('click', function () {
      var pool = Object.keys(deg); setCenter(pool[Math.floor(Math.random() * pool.length)], null);
    });
    var start = WORLD === 'wuwa' ? 'jinhsi' : 'zhongli';
    setCenter(deg[start] ? start : hubs[0], null);
    window.addEventListener('resize', debounce(function () { layoutGraph(false); }, 150));
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function setCenter(id, sel) {
    G.center = id; G.sel = sel;
    $$('#hub-row .hub').forEach(function (b) { b.classList.toggle('on', b.dataset.id === id); });
    layoutGraph(true); renderBond();
  }
  function selectBond(id) {
    if (id && G.sel === id) { setCenter(id, G.center); return; }
    G.sel = id;
    $$('#graph .gnode').forEach(function (n) { n.classList.toggle('sel', n.dataset.id === id); });
    $$('#graph-edges .edge').forEach(function (e) { e.classList.toggle('sel', e.getAttribute('data-id') === id); });
    renderBond();
  }
  function layoutGraph(animate) {
    var stage = $('#graph'), svg = $('#graph-edges');
    var size = stage.clientWidth; if (!size) return;
    var nb = neighbours(G.center), n = nb.length;
    var pos = {}; pos[G.center] = { x: 50, y: 50, r: 0 };
    var two = n > 11;
    var inner = two ? Math.min(Math.ceil(n * 0.4), 9) : 0;
    nb.forEach(function (x, i) {
      var ring, k, count, rad;
      if (two && i < inner) { ring = 0; k = i; count = inner; rad = 24; }
      else { ring = 1; k = two ? i - inner : i; count = two ? n - inner : n; rad = two ? 42 : (n <= 4 ? 30 : 37); }
      var ang = -Math.PI / 2 + (k / Math.max(count, 1)) * Math.PI * 2 + (ring === 0 ? Math.PI / Math.max(count, 1) : 0);
      pos[x.id] = { x: 50 + Math.cos(ang) * rad, y: 50 + Math.sin(ang) * rad, r: rad, nb: x };
    });
    stage.classList.toggle('dense', n > 13);
    // nodes: reuse existing elements so they glide to their new place
    Object.keys(G.nodes).forEach(function (id) {
      if (!pos[id]) { var old = G.nodes[id]; old.classList.add('out'); delete G.nodes[id]; setTimeout(function () { old.remove(); }, 350); }
    });
    Object.keys(pos).forEach(function (id, i) {
      var c = byId[id], p = pos[id], node = G.nodes[id];
      if (!node) {
        node = h('button', { class: 'gnode', type: 'button', 'data-id': id, style: 'left:' + (G.nodes[G.center] && id !== G.center ? 50 : p.x) + '%;top:' + (G.nodes[G.center] && id !== G.center ? 50 : p.y) + '%' },
          face(c), h('span', { class: 'gname', text: c.name.replace('Kamisato ', '').replace('Kaedehara ', '').replace('Sangonomiya ', '').replace('Shikanoin ', '').replace('Yumemizuki ', '') }));
        node.addEventListener('click', function () { if (id === G.center) { G.sel = null; $$('#graph .gnode').forEach(function (x) { x.classList.remove('sel'); }); $$('#graph-edges .edge').forEach(function (x) { x.classList.remove('sel'); }); renderBond(); } else selectBond(id); });
        node.addEventListener('dblclick', function () { if (id !== G.center) setCenter(id, null); });
        node.classList.add('in');
        stage.appendChild(node); G.nodes[id] = node; void node.offsetWidth;
      }
      node.className = 'gnode' + (id === G.center ? ' center' : '') + (id === G.sel ? ' sel' : '') + (p.nb && p.nb.out && p.nb.inn ? ' mutual' : '') + ' r' + c.rarity;
      node.style.setProperty('--d', (i * 18) + 'ms');
      node.style.left = p.x + '%'; node.style.top = p.y + '%';
      node.setAttribute('aria-label', c.name + (id === G.center ? ', centre' : ''));
    });
    // edges
    svg.replaceChildren();
    var NS = 'http://www.w3.org/2000/svg';
    nb.forEach(function (x, i) {
      var p = pos[x.id];
      var dx = p.x - 50, dy = p.y - 50, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
      var c0 = two ? 8.5 : 10, c1 = two ? 5.2 : 6.4;
      var x1 = 50 + ux * c0, y1 = 50 + uy * c0, x2 = p.x - ux * c1, y2 = p.y - uy * c1;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'edge ' + (x.out && x.inn ? 'mutual' : x.out ? 'out' : 'in') + (x.id === G.sel ? ' sel' : ''));
      g.setAttribute('data-id', x.id); g.style.setProperty('--d', (160 + i * 22) + 'ms');
      var line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('pathLength', '1');
      g.appendChild(line);
      function tip(tx, ty, sx, sy) {
        var a = Math.atan2(ty - sy, tx - sx), s = 1.7; tx += Math.cos(a) * s * 0.5; ty += Math.sin(a) * s * 0.5;
        var pth = document.createElementNS(NS, 'path');
        pth.setAttribute('d', 'M' + tx + ' ' + ty + ' L' + (tx - Math.cos(a - 0.45) * s) + ' ' + (ty - Math.sin(a - 0.45) * s) + ' L' + (tx - Math.cos(a + 0.45) * s) + ' ' + (ty - Math.sin(a + 0.45) * s) + 'Z');
        g.appendChild(pth);
      }
      // arrowheads sit along the line, clear of faces and labels
      var mx = function (f) { return x1 + (x2 - x1) * f; }, my = function (f) { return y1 + (y2 - y1) * f; };
      if (x.out) tip(mx(x.inn ? 0.72 : 0.6), my(x.inn ? 0.72 : 0.6), x1, y1);
      if (x.inn) tip(mx(x.out ? 0.28 : 0.4), my(x.out ? 0.28 : 0.4), x2, y2);
      svg.appendChild(g);
    });
    if (animate) { svg.classList.remove('draw'); void svg.getBoundingClientRect(); svg.classList.add('draw'); }
    var c = byId[G.center];
    $('#graph-cap').textContent = c.name + ' · ' + n + (n === 1 ? ' connection' : ' connections');
  }
  function renderBond() {
    var box = $('#bond'), c = byId[G.center];
    var nb = neighbours(G.center);
    if (!G.sel) {
      var list = h('div', { class: 'bond-list' });
      nb.forEach(function (x) {
        var o = byId[x.id];
        list.appendChild(h('button', { class: 'bond-row', type: 'button', onclick: function () { selectBond(x.id); } },
          face(o), h('span', null, h('b', { text: o.name }), h('small', { text: x.out && x.inn ? 'They speak of each other' : x.out ? c.name.split(' ')[0] + ' speaks of them' : 'Speaks of ' + c.name.split(' ')[0] })),
          h('i', { class: 'dir ' + (x.out && x.inn ? 'mutual' : x.out ? 'out' : 'in') })));
      });
      if (!nb.length) list.appendChild(h('p', { class: 'empty', text: 'No voice lines link ' + c.name + ' to anyone yet. Newer arrivals often have none recorded.' }));
      swap(box, h('div', { class: 'bond-in' },
        h('div', { class: 'bond-top' }, face(c, 'big'),
          h('div', null, h('span', { class: 'lbl', text: 'At the centre' }), h('h3', { text: c.name }), h('p', { class: 'bond-sub', text: place(c) }))),
        h('p', { class: 'bond-lore', text: c.lore }),
        h('div', { class: 'bond-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: function () { openSheet(c.id); } }, 'Open profile')),
        h('span', { class: 'lbl', text: 'Pick a connection' }), list));
      return;
    }
    var o = byId[G.sel];
    var x = nb.filter(function (k) { return k.id === G.sel; })[0] || {};
    var note = D.bonds[bondKey(c.id, o.id)];
    var shared = [];
    if (c.faction && c.faction === o.faction) shared.push('Both: ' + c.faction);
    else if (c.region === o.region && c.region !== 'Beyond' && c.region !== 'Unknown') shared.push('Both tied to ' + c.region);
    function side(a, b, l) {
      return h('div', { class: 'bond-quote' + (l ? '' : ' none') },
        h('div', { class: 'bq-head' }, face(a), h('span', null, h('b', { text: a.name }), ' on ' + b.name + (l && l.s ? ' · ' + l.s : ''))),
        l ? h('blockquote', { text: l.q }) : h('p', { class: 'empty', text: 'No recorded voice line.' }));
    }
    swap(box, h('div', { class: 'bond-in' },
      h('div', { class: 'bond-pair' }, face(c, 'big'),
        h('i', { class: 'pair-link ' + (x.out && x.inn ? 'mutual' : x.out ? 'out' : 'in') }), face(o, 'big')),
      h('h3', { class: 'bond-title' }, c.name, h('em', { text: ' and ' }), o.name),
      shared.length ? h('div', { class: 'tags' }, shared.map(function (s) { return h('span', { class: 'tag', text: s }); })) : null,
      note ? h('p', { class: 'bond-note', text: note }) : null,
      side(c, o, x.out), side(o, c, x.inn),
      h('div', { class: 'bond-actions' },
        h('button', { class: 'btn', type: 'button', onclick: function () { setCenter(o.id, null); } }, 'Centre on ' + o.name.split(' ')[0]),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { openSheet(o.id); } }, 'Open profile'),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { selectBond(null); } }, 'Back to list'))));
  }

  // ---------- nav ----------
  function initNav() {
    $$('[data-goto]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); scrollToId(a.dataset.goto); });
    });
    var links = $$('.nav a[data-goto]');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) links.forEach(function (l) { l.classList.toggle('on', l.dataset.goto === e.target.id); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ['timeline', 'characters', 'connections'].forEach(function (id) { io.observe(document.getElementById(id)); });
    }
    $$('[data-charword]').forEach(function (n) { n.textContent = D.meta.charWord; });
    $('#scrim').addEventListener('click', closeSheet);
    $('#sheet-close').addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
      if (e.key === 'Tab' && sheetOpen) {
        var f = $$('#sheet button, #sheet a[href]').filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
      }
    });
    var top = $('.top');
    window.addEventListener('scroll', function () { top.classList.toggle('scrolled', window.scrollY > 24); }, { passive: true });
  }

  initHero(); initTimeline(); initRoster(); initGraph(); initNav();
  document.documentElement.classList.add('ready');
})();
