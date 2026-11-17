/* Lore Atlas: shared engine for both world pages.
   Reads window.LORE_DATA (assets/data/<world>.js, rebuilt by tools/update.mjs) and renders every section. */
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
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(n, x); });
    else n.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IMG = 'assets/img/' + WORLD + '/';
  var WW_EL = { Glacio: 'ice', Fusion: 'fire', Electro: 'sphunder', Aero: 'wind', Spectro: 'light', Havoc: 'dark' };
  function elIcon(name) { return name ? 'assets/img/el/' + (WORLD === 'wuwa' ? 'ww_' + WW_EL[name] : 'gi_' + name.toLowerCase()) + '.webp' : null; }
  var byId = {};
  D.chars.forEach(function (c) { byId[c.id] = c; });
  function canon(id) { return byId[id] && byId[id].same ? byId[id].same : id; }
  var outLines = {}, inLines = {};
  D.lines.forEach(function (l) { (outLines[l.f] = outLines[l.f] || []).push(l); (inLines[l.t] = inLines[l.t] || []).push(l); });
  var VERS = [];
  D.arcs.forEach(function (a, ai) { a.versions.forEach(function (v, vi) { VERS.push({ arc: ai, idx: vi, v: v }); }); });
  function verKey(v) { var p = String(v).split('.'); return (+p[0]) * 100 + (+p[1] || 0); }
  function bondKey(a, b) { return [a, b].sort().join('|'); }
  function place(c) { return c.region + (c.faction && c.faction !== c.region ? ' · ' + c.faction : ''); }
  function shortName(c) { return c.name.replace(/^(Kamisato|Kaedehara|Sangonomiya|Shikanoin|Yumemizuki|Arataki|Kujou) /, '').replace(/^Yangyang: /, ''); }
  function first(c) { return c.name.split(/[ :]/)[0]; }

  function face(c, cls) {
    return h('span', { class: 'face r' + c.rarity + ' ' + (c.el ? 'el-' + c.el.toLowerCase() : 'el-none') + (cls ? ' ' + cls : '') },
      h('img', { src: IMG + 'icons/' + c.id + '.webp', alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }));
  }
  function faceBtn(id, cls) {
    var c = byId[id]; if (!c) return h('span', { class: 'chip-text', text: id });
    return h('button', { class: 'face-btn', type: 'button', title: c.name, 'aria-label': c.name, onclick: function (e) { e.stopPropagation(); openSheet(id); } }, face(c, cls));
  }
  function elBadge(name) { return name ? h('span', { class: 'elb el-' + name.toLowerCase(), title: name }, h('img', { src: elIcon(name), alt: '' })) : null; }
  function stars(n) { return h('span', { class: 'stars', 'aria-label': n + ' star' }, new Array(n + 1).join('★')); }
  function scrollToId(id) {
    var t = document.getElementById(id); if (!t) return;
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 64, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function swap(container, node) { container.classList.remove('swap-in'); void container.offsetWidth; container.replaceChildren(node); container.classList.add('swap-in'); }
  function day(iso, opt) { return iso ? new Date(iso).toLocaleDateString(undefined, opt || { month: 'short', day: 'numeric' }) : ''; }
  function span(a, b) { return a && b ? day(a) + ' – ' + day(b) : a ? 'From ' + day(a) : 'Dates to be announced'; }
  function left(ms) {
    var d = Math.floor(ms / 864e5), hr = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return d > 0 ? d + 'd ' + hr + 'h' : hr > 0 ? hr + 'h ' + m + 'm' : m + 'm';
  }
  function status(a, b) {
    var now = Date.now(), s = Date.parse(a), e = Date.parse(b);
    if (!a) return { key: 'tba', text: 'Not dated yet', pct: 0 };
    if (now < s) return { key: 'soon', text: 'Starts in ' + left(s - now), pct: 0 };
    if (e && now > e) return { key: 'done', text: 'Ended', pct: 100 };
    return { key: 'live', text: e ? 'Ends in ' + left(e - now) : 'Live', pct: e ? Math.max(2, Math.min(100, (now - s) / (e - s) * 100)) : 50 };
  }
  function big(n) { return n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 2 : 0).replace(/\.?0+$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : String(n); }

  // ---------- hero ----------
  function initHero() {
    $('#hero-kicker').textContent = D.meta.kicker;
    $('#hero-title').textContent = D.meta.title;
    $('#hero-intro').textContent = D.meta.intro;
    var people = D.chars.filter(function (c) { return !c.same; }).length;
    [[VERS.length, 'versions charted'], [people, D.meta.charWord.toLowerCase()], [D.lines.length, 'voice lines'], [(D.bosses || []).length, 'bosses tracked']].forEach(function (s) {
      var num = h('b', { text: reduceMotion ? String(s[0]) : '0' });
      $('#hero-stats').appendChild(h('div', { class: 'stat' }, num, h('span', { text: s[1] })));
      if (!reduceMotion) countUp(num, s[0]);
    });
    var last = VERS[VERS.length - 1], card = $('#hero-latest');
    var st = D.now ? status(D.now.start, D.now.end) : null;
    add(card, [h('span', { class: 'lbl', text: 'Current version' }),
      h('div', { class: 'latest-row' }, h('b', { class: 'latest-v', text: last.v.v }),
        h('div', null, h('strong', { text: last.v.name }), h('span', { text: st ? st.text + ' · ' + D.arcs[last.arc].name : last.v.date + ' · ' + D.arcs[last.arc].name }))),
      st ? h('div', { class: 'bar' }, h('i', { style: 'width:' + st.pct + '%' })) : null,
      h('div', { class: 'latest-faces' }, last.v.chars.map(function (id) { return face(byId[id]); }))]);
    card.addEventListener('click', function () { scrollToId(D.now ? 'now' : 'timeline'); });
    $('#foot-updated').textContent = 'Data refreshed ' + (D.meta.updated || '') + '. Current to version ' + D.meta.current + '.';
  }
  function countUp(node, to) {
    var t0 = null;
    function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 1100); p = 1 - Math.pow(1 - p, 3); node.textContent = Math.round(to * p); if (p < 1) requestAnimationFrame(step); }
    setTimeout(function () { requestAnimationFrame(step); }, 350);
  }

  // ---------- now: current version ----------
  function chipList(names) { return h('div', { class: 'tags' }, names.map(function (n) { return h('span', { class: 'tag', text: n }); })); }
  function renderNow() {
    var N = D.now, box = $('#now-body');
    if (!N) { $('#now').hidden = true; return; }
    var st = status(N.start, N.end);
    $('#now-head').replaceChildren(
      h('div', { class: 'now-v' }, h('b', { text: N.v }), h('span', { class: 'pill live-' + st.key, text: st.key === 'live' ? 'Live now' : st.text })),
      h('div', { class: 'now-t' }, h('h3', { text: N.name || 'Version ' + N.v }),
        h('p', { class: 'ver-meta' }, h('span', { text: span(N.start, N.end) }), h('span', { text: st.text }), N.upcoming && N.upcoming.start ? h('span', { text: 'Version ' + N.upcoming.v + ' expected ' + day(N.upcoming.start) }) : null),
        h('div', { class: 'bar big' }, h('i', { style: 'width:' + st.pct + '%' }))));

    // banners grouped into phases by start day
    var groups = {}, order = [];
    var RANK = { char: 0, weapon: 1, chronicle: 2, rerun: 3 };
    (N.banners || []).forEach(function (b) { var k = (b.start || '').slice(0, 10); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(b); });
    order.sort(); order.forEach(function (k) { groups[k].sort(function (a, b) { return (RANK[a.kind] || 0) - (RANK[b.kind] || 0); }); });
    var KIND = { char: WORLD === 'wuwa' ? 'Featured Resonator' : 'Character Event Wish', weapon: WORLD === 'wuwa' ? 'Featured Weapon' : 'Weapon Event Wish', rerun: 'Rerun selection', chronicle: 'Chronicled Wish' };
    var banners = h('div', { class: 'now-block' }, h('h4', { text: WORLD === 'wuwa' ? 'Convenes' : 'Wishes' }));
    order.forEach(function (k, i) {
      var list = groups[k], s = status(list[0].start, list[0].end);
      add(banners, h('div', { class: 'phase' },
        h('div', { class: 'phase-head' }, h('span', { class: 'lbl', text: 'Phase ' + (i + 1) + ' · ' + span(list[0].start, list[0].end) }), h('span', { class: 'pill live-' + s.key, text: s.text })),
        h('div', { class: 'banners' }, list.map(function (b) {
          return h('div', { class: 'banner k-' + b.kind + ' st-' + status(b.start, b.end).key },
            h('span', { class: 'lbl', text: KIND[b.kind] || 'Banner' }),
            h('b', { class: 'banner-name', text: b.name }),
            b.chars.length ? h('div', { class: 'banner-faces' }, b.chars.map(function (id) { return faceBtn(id, 'big'); }), (b.four || []).map(function (id) { return faceBtn(id); })) : null,
            b.chars.length === 1 && byId[b.chars[0]] ? h('span', { class: 'banner-who', text: byId[b.chars[0]].name }) : null,
            b.weapons && b.weapons.length ? h('p', { class: 'banner-weapons', text: b.weapons.join(' · ') }) : null);
        }))));
    });
    if (!order.length) add(banners, h('p', { class: 'empty', text: 'No banner data yet.' }));

    var events = h('div', { class: 'now-block' }, h('h4', { text: 'Events' }));
    (N.events || []).forEach(function (e) {
      var s = status(e.start, e.end);
      add(events, h('div', { class: 'event st-' + s.key },
        h('div', { class: 'event-main' }, h('b', { text: e.name }), h('small', { text: [e.kind, e.reward, span(e.start, e.end)].filter(Boolean).join(' · ') })),
        h('span', { class: 'pill live-' + s.key, text: s.text }),
        h('div', { class: 'bar' }, h('i', { style: 'width:' + s.pct + '%' }))));
    });
    if (!(N.events || []).length) add(events, h('p', { class: 'empty', text: 'No events listed yet.' }));

    var fresh = h('div', { class: 'now-block cardish' }, h('h4', { text: 'New in ' + N.v }));
    if ((N.newChars || []).length) add(fresh, [h('span', { class: 'lbl', text: D.meta.charWord }), h('div', { class: 'cast one' }, N.newChars.map(function (id) {
      var c = byId[id]; return c ? h('button', { class: 'chip-char', type: 'button', onclick: function () { openSheet(id); } }, face(c), h('span', null, h('b', { text: c.name }), h('small', { text: (c.el ? c.el + ' · ' : '') + c.weapon }))) : h('span', { class: 'tag', text: id });
    }))]);
    if ((N.newWeapons || []).length) add(fresh, [h('span', { class: 'lbl', text: 'Weapons' }), weaponChips(N.newWeapons)]);
    if ((N.outfits || []).length) add(fresh, [h('span', { class: 'lbl', text: 'Outfits' }), h('div', { class: 'outfits' }, N.outfits.map(function (o) {
      var c = byId[o.char]; return h('div', { class: 'outfit' }, c ? faceBtn(o.char) : null, h('span', null, h('b', { text: o.name }), h('small', { text: c ? c.name : o.char })));
    }))]);
    if ((N.quests || []).length) add(fresh, [h('span', { class: 'lbl', text: 'Main story' }), h('ul', { class: 'plain' }, N.quests.map(function (q) { return h('li', { text: q }); }))]);
    if ((N.areas || []).length) add(fresh, [h('span', { class: 'lbl', text: 'New areas' }), chipList(N.areas)]);
    add(fresh, h('button', { class: 'btn ghost', type: 'button', onclick: function () { goVersion(N.v); } }, 'Read the story summary'));

    var side = [fresh];
    if ((N.challenges || []).length) {
      side.push(h('div', { class: 'now-block cardish' }, h('h4', { text: 'Endgame resets' }), N.challenges.map(function (c) {
        var s = status(c.start, c.end);
        return h('div', { class: 'event st-' + s.key }, h('div', { class: 'event-main' }, h('b', { text: c.name }), h('small', { text: span(c.start, c.end) })), h('span', { class: 'pill live-' + s.key, text: s.text }), h('div', { class: 'bar' }, h('i', { style: 'width:' + s.pct + '%' })));
      }), h('button', { class: 'btn ghost', type: 'button', onclick: function () { scrollToId('teams'); } }, 'See popular teams')));
    }
    if (N.pulls) {
      var P = N.pulls;
      side.push(h('div', { class: 'now-block cardish pulls' }, h('h4', { text: 'Pull estimate' }),
        h('div', { class: 'pull-top' }, h('div', null, h('b', { text: '≈ ' + P.freePulls }), h('span', { text: 'pulls, free to play' })), h('div', null, h('b', { text: '≈ ' + P.passPulls }), h('span', { text: 'with ' + P.passName }))),
        h('table', { class: 'pull-table' }, h('tbody', null, P.rows.map(function (r) { return h('tr', null, h('td', { text: r[0] }), h('td', { text: r[1].toLocaleString() })); }),
          h('tr', { class: 'sum' }, h('td', { text: 'Total ' + P.unit + ' over ' + P.days + ' days' }), h('td', { text: P.free.toLocaleString() })))),
        h('p', { class: 'fine', text: P.note })));
    }
    box.replaceChildren(h('div', { class: 'now-main' }, banners, events), h('div', { class: 'now-side' }, side));
  }

  // ---------- timeline ----------
  var T = { arc: 0, ver: 0 };
  function initTimeline() {
    var tabs = $('#arc-tabs');
    D.arcs.forEach(function (a, i) {
      tabs.appendChild(h('button', { class: 'arc-tab', role: 'tab', type: 'button', id: 'arc-tab-' + i, style: '--hue:' + a.hue, onclick: function () { selectArc(i, 0, true); } },
        h('span', { class: 'arc-range', text: a.range.replace(' to ', ' – ') }), h('span', { class: 'arc-name', text: a.name })));
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
    $$('#arc-tabs .arc-tab').forEach(function (b, bi) { b.classList.toggle('on', bi === i); b.setAttribute('aria-selected', bi === i ? 'true' : 'false'); });
    var on = $('#arc-tabs .arc-tab.on'), tabs = $('#arc-tabs');
    if (on && user) tabs.scrollTo({ left: on.offsetLeft - tabs.clientWidth / 2 + on.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    $('#timeline').style.setProperty('--hue', a.hue);
    swap($('#arc-head'), h('div', { class: 'arc-head-in' }, h('span', { class: 'lbl', text: a.chapter }), h('h3', { text: a.name }), h('p', { text: a.blurb })));
    var rail = $('#rail'); rail.replaceChildren();
    var track = h('div', { class: 'rail-track' }, h('i', { class: 'rail-line' }), h('i', { class: 'rail-fill', id: 'rail-fill' }));
    a.versions.forEach(function (v, k) {
      track.appendChild(h('button', { class: 'node', type: 'button', style: '--i:' + k, 'aria-label': 'Version ' + v.v + ', ' + v.name, onclick: function () { selectVersion(k, true); } },
        h('i', { class: 'pip' }), h('b', { text: v.v }), h('span', { text: v.date.replace(/, (\d{4})$/, ' $1') })));
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
    var cur = nodes[k], rail = $('#rail');
    if (cur) {
      var x = cur.offsetLeft + cur.offsetWidth / 2;
      $('#rail-fill').style.width = x + 'px';
      rail.scrollTo({ left: x - rail.clientWidth / 2, behavior: user && !reduceMotion ? 'smooth' : 'auto' });
    }
    var gi = VERS.findIndex(function (x) { return x.arc === T.arc && x.idx === k; });
    $('#ver-prev').disabled = gi <= 0; $('#ver-next').disabled = gi >= VERS.length - 1;
    $('#ver-count').textContent = (gi + 1) + ' / ' + VERS.length;
    var cast = h('div', { class: 'cast' });
    if (v.chars.length) v.chars.forEach(function (id, i) {
      var c = byId[id];
      cast.appendChild(h('button', { class: 'chip-char', type: 'button', style: '--i:' + i, onclick: function () { openSheet(id); } },
        face(c), h('span', null, h('b', { text: c.name + (c.tag ? ' (' + c.tag + ')' : '') }), h('small', { text: (c.el ? c.el + ' · ' : '') + c.weapon }))));
    });
    else cast.appendChild(h('p', { class: 'cast-none', text: 'No new playable ' + D.meta.charWord.toLowerCase() + ' in this version.' }));
    swap($('#ver-detail'), h('article', { class: 'ver-card' },
      h('div', { class: 'ver-main' },
        h('div', { class: 'ver-num' }, h('b', { text: v.v }), v.tag ? h('em', { text: v.tag }) : null, v.auto ? h('em', { text: 'Auto entry' }) : null),
        h('div', { class: 'ver-body' }, h('h4', { text: v.name }),
          h('p', { class: 'ver-meta' }, h('span', { text: v.date }), h('span', { text: v.acts })),
          h('p', { class: 'ver-text', text: v.text }),
          h('div', { class: 'tags' }, (v.tags || []).map(function (t) { return h('span', { class: 'tag', text: t }); })))),
      h('div', { class: 'ver-cast' }, h('span', { class: 'lbl', text: 'First appearances' + (v.chars.length ? ' · ' + v.chars.length : '') }), cast)));
    renderVerMore(v);
  }
  function stepVersion(d) {
    var gi = VERS.findIndex(function (x) { return x.arc === T.arc && x.idx === T.ver; }) + d;
    if (gi < 0 || gi >= VERS.length) return;
    var n = VERS[gi];
    if (n.arc !== T.arc) selectArc(n.arc, n.idx, true); else selectVersion(n.idx, true);
  }
  function goVersion(vstr) {
    var n = VERS.filter(function (x) { return x.v.v === vstr; })[0]; if (!n) return;
    closeSheet(true); selectArc(n.arc, n.idx, true); scrollToId('timeline');
  }

  // ---------- version detail: main story and what came with it ----------
  var W_BY_NAME = {};
  Object.keys(D.weapons || {}).forEach(function (k) { W_BY_NAME[D.weapons[k].n] = k; });
  function weaponChips(names) {
    return h('div', { class: 'tags' }, names.map(function (n) {
      var k = W_BY_NAME[n];
      return h('span', { class: 'tag wtag' }, k ? weaponIcon(k, 'tiny') : null, n);
    }));
  }
  function renderVerMore(v) {
    var box = $('#ver-more'), d = v.detail;
    if (!box) return;
    if (!d) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    var story = h('div', { class: 'vm-story' }, h('h4', { text: 'Main story' }));
    if (d.story && d.story.length) d.story.forEach(function (a, ai) {
      var parts = a.parts || [], fold = parts.length > 4;
      var act = h('article', { class: 'act' + (fold ? ' folded' : ''), style: '--i:' + ai });
      add(act, [h('span', { class: 'lbl', text: a.label || 'Main story' }), h('h5', { text: a.title }),
        a.desc ? h('p', { class: 'act-desc', text: a.desc }) : null,
        parts.length ? h('ol', { class: 'steps' }, parts.map(function (p, i) { return h('li', { class: fold && i >= 3 ? 'extra' : null }, h('b', { text: p.t }), p.d ? h('p', { text: p.d }) : null); })) : null,
        fold ? h('button', { class: 'linkish more', type: 'button', onclick: function (e) { var f = act.classList.toggle('folded'); e.currentTarget.textContent = f ? 'Show all ' + parts.length + ' quests' : 'Show fewer'; } }, 'Show all ' + parts.length + ' quests') : null]);
      add(story, act);
    });
    else add(story, h('p', { class: 'empty', text: 'No main story chapter was released in this version. Its story came from events and character stories.' }));
    var side = h('div', { class: 'vm-side' });
    if (d.featured) add(side, [h('span', { class: 'lbl', text: 'Featured on banners' }), h('div', { class: 'team-faces' }, d.featured.map(function (id) { return faceBtn(id); }))]);
    if (d.areas) add(side, [h('span', { class: 'lbl', text: 'New areas' }), chipList(d.areas)]);
    if (d.weapons) add(side, [h('span', { class: 'lbl', text: 'New weapons' }), weaponChips(d.weapons)]);
    if (d.events) add(side, [h('span', { class: 'lbl', text: 'Events' }), h('ul', { class: 'plain' }, d.events.map(function (e) { return h('li', { text: e }); }))]);
    swap(box, h('div', { class: 'vm-in' }, story, side.childNodes.length ? h('aside', { class: 'vm-aside cardish' }, side) : null));
  }

  // ---------- tier list ----------
  var TF = '';
  function initTiers() {
    var T = D.tiers;
    if (!T) { $('#tiers').hidden = true; return; }
    var stale = verKey(T.reviewed) < verKey(D.meta.current);
    $('#tier-meta').replaceChildren(
      h('div', { class: 'tier-pills' }, h('span', { class: 'pill', text: 'Reviewed for version ' + T.reviewed }), stale ? h('span', { class: 'pill warnpill', text: 'Not reviewed for ' + D.meta.current + ' yet' }) : h('span', { class: 'pill live-live', text: 'Up to date' })),
      h('p', { class: 'fine', text: T.note }));
    var row = $('#tier-el');
    function chip(label, val) {
      var b = h('button', { class: 'chip' + (val ? ' el-' + val.toLowerCase() : ''), type: 'button', onclick: function () { TF = val; $$('.chip', row).forEach(function (x) { x.classList.toggle('on', x === b); }); renderTiers(); } }, val ? h('img', { src: elIcon(val), alt: '' }) : null, h('span', { text: label }));
      if (val === TF) b.classList.add('on');
      return b;
    }
    row.appendChild(chip('All', ''));
    D.elements.forEach(function (e) { row.appendChild(chip(e, e)); });
    renderTiers();
  }
  function renderTiers() {
    var T = D.tiers, keep = function (id) { var c = byId[id]; return c && (!TF || c.el === TF); };
    function cell(ids) {
      return h('div', { class: 'tier-cell' }, ids.filter(keep).map(function (id) {
        var c = byId[id];
        return h('button', { class: 'tier-face', type: 'button', title: c.name, onclick: function () { openSheet(id); } }, face(c), h('small', { text: shortName(c) }));
      }));
    }
    var grid = h('div', { class: 'tier-grid', style: '--cols:' + T.columns.length },
      h('div', { class: 'tier-head' }, h('span'), T.columns.map(function (c) { return h('span', { class: 'lbl', text: c }); })));
    T.rows.forEach(function (r, i) {
      grid.appendChild(h('div', { class: 'tier-row t-' + r.tier.toLowerCase(), style: '--i:' + i },
        h('div', { class: 'tier-badge' }, h('b', { text: r.tier }), r.label ? h('small', { text: r.label }) : null),
        r.cells.map(function (ids, j) { return h('div', { class: 'tier-col', 'data-col': T.columns[j] }, cell(ids)); })));
    });
    if (T.unrated.length) {
      grid.appendChild(h('div', { class: 'tier-row t-new' },
        h('div', { class: 'tier-badge' }, h('b', { text: 'New' }), h('small', { text: 'Not rated yet' })),
        h('div', { class: 'tier-col wide' }, cell(T.unrated))));
    }
    swap($('#tier-body'), grid);
  }

  // ---------- roster ----------
  var R = { q: '', el: '', region: '', rarity: 0, sort: 'debut' };
  function chip(label, val, key, render) {
    return h('button', { class: 'chip', type: 'button', 'data-key': key, 'data-val': String(val), onclick: function () { R[key] = val; syncChips(); render(); } }, h('span', { text: label }));
  }
  function syncChips() { $$('.filters .chip').forEach(function (b) { var on = String(R[b.dataset.key]) === b.dataset.val; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
  function initRoster() {
    var elRow = $('#f-el');
    elRow.appendChild(chip('All', '', 'el', renderRoster));
    D.elements.forEach(function (e) { var b = chip(e, e, 'el', renderRoster); b.classList.add('el-' + e.toLowerCase()); b.insertBefore(h('img', { src: elIcon(e), alt: '' }), b.firstChild); elRow.appendChild(b); });
    var regRow = $('#f-region');
    regRow.appendChild(chip('Everywhere', '', 'region', renderRoster));
    var regs = D.regions.slice(); D.chars.forEach(function (c) { if (regs.indexOf(c.region) < 0) regs.push(c.region); });
    regs.forEach(function (r) { if (D.chars.some(function (c) { return c.region === r; })) regRow.appendChild(chip(r, r, 'region', renderRoster)); });
    [['All', 0], ['5★', 5], ['4★', 4]].forEach(function (x) { $('#f-rarity').appendChild(chip(x[0], x[1], 'rarity', renderRoster)); });
    [['By debut', 'debut'], ['A to Z', 'name']].forEach(function (x) { $('#f-sort').appendChild(chip(x[0], x[1], 'sort', renderRoster)); });
    $('#f-q').addEventListener('input', function (e) { R.q = e.target.value.trim().toLowerCase(); renderRoster(); });
    $('#f-q').setAttribute('placeholder', 'Search ' + D.meta.charWord.toLowerCase());
    syncChips(); renderRoster();
  }
  function renderRoster() {
    var list = D.chars.filter(function (c) {
      return (!R.q || c.name.toLowerCase().indexOf(R.q) >= 0 || (c.faction || '').toLowerCase().indexOf(R.q) >= 0) &&
        (!R.el || c.el === R.el) && (!R.region || c.region === R.region) && (!R.rarity || c.rarity === R.rarity);
    });
    list.sort(R.sort === 'name' ? function (a, b) { return a.name.localeCompare(b.name); }
      : function (a, b) { return verKey(a.ver) - verKey(b.ver) || b.rarity - a.rarity || a.name.localeCompare(b.name); });
    $('#roster-count').textContent = list.length + ' of ' + D.chars.length;
    var grid = h('div', { class: 'grid-in' });
    list.forEach(function (c, i) {
      grid.appendChild(h('button', { class: 'card r' + c.rarity + (c.el ? ' el-' + c.el.toLowerCase() : ''), type: 'button', style: '--i:' + Math.min(i, 40), onclick: function () { openSheet(c.id); } },
        h('span', { class: 'card-art' }, h('img', { src: IMG + 'icons/' + c.id + '.webp', alt: '', loading: 'lazy', decoding: 'async' }), elBadge(c.el), h('i', { class: 'card-ver', text: c.ver }), c.tag ? h('i', { class: 'card-tag', text: c.tag }) : null),
        h('span', { class: 'card-name', text: c.name })));
    });
    if (!list.length) grid.appendChild(h('p', { class: 'empty', text: 'Nobody matches those filters. Clear one to see more.' }));
    $('#roster-grid').replaceChildren(grid);
  }

  // ---------- character sheet ----------
  var sheetOpen = false, lastFocus = null, sheetTab = 'profile';
  var EL_HEX = { Pyro: '#ff7d55', Hydro: '#4cc2f1', Anemo: '#74e0bb', Dendro: '#a5c83b', Cryo: '#9fe3ef', Geo: '#f2b83a', Electro: '#b98cf5', Glacio: '#5fc8ff', Fusion: '#ff7a4d', Aero: '#5ff0b5', Spectro: '#f7df6b', Havoc: '#e85aa8' };
  function elHex(c) { return EL_HEX[c && c.el] || (WORLD === 'wuwa' ? '#e6c98a' : '#d9c08f'); }
  function quoteBlock(l, who, dir) {
    var c = byId[formOf(who)] || byId[who];
    return h('div', { class: 'quote' },
      h('button', { class: 'quote-who', type: 'button', onclick: function () { openSheet(c.id); }, title: 'Open ' + c.name },
        face(c), h('span', null, h('small', { text: dir }), h('b', { text: c.name + (l.s ? ' · ' + l.s : '') }))),
      h('blockquote', { text: l.q }));
  }
  function itemTile(id, n) {
    var it = (D.items || {})[id]; if (!it) return null;
    var today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    var src = it.d ? it.d.join(' · ') : (it.src || '');
    return h('div', { class: 'mat r' + it.r + (it.d && it.d.indexOf(today) >= 0 ? ' today' : ''), title: it.n + (src ? ' · ' + src : '') },
      h('span', { class: 'mat-ico' }, it.i ? h('img', { src: IMG + 'items/' + id + '.webp', alt: '', loading: 'lazy' }) : h('i', { text: it.n.charAt(0) })),
      h('b', { text: n != null ? '×' + big(n) : '' }), h('span', { class: 'mat-name', text: it.n }), src ? h('small', { text: src }) : null);
  }
  function teamRow(t) {
    var ids = t.filter(function (x) { return byId[x]; });
    if (ids.length < t.length) return h('p', { class: 'team-text', text: t.join(', ') });
    return h('div', { class: 'team-faces' }, ids.map(function (id) { return faceBtn(id); }));
  }
  function weaponIcon(k, cls) {
    var w = (D.weapons || {})[k]; if (!w) return null;
    return h('span', { class: 'w-ico r' + w.r + (cls ? ' ' + cls : '') }, w.i ? h('img', { src: IMG + 'weapons/' + k + '.webp', alt: '', loading: 'lazy' }) : h('i', { text: w.n.charAt(0) }));
  }
  function weaponCard(k, badge, rank) {
    var w = (D.weapons || {})[k]; if (!w) return null;
    return h('article', { class: 'weapon r' + w.r + (badge === 'Signature' ? ' sig' : '') },
      h('div', { class: 'weapon-top' }, weaponIcon(k, 'big'),
        h('div', { class: 'weapon-id' },
          h('div', { class: 'weapon-tags' }, badge ? h('em', { class: 'wbadge', text: badge }) : null, rank ? h('span', { class: 'wrank', text: '#' + rank }) : null),
          h('b', { text: w.n }),
          h('span', { class: 'weapon-meta' }, stars(w.r), ' ' + w.type))),
      h('dl', { class: 'weapon-stats' },
        h('div', null, h('dt', { text: 'Base ATK' }), h('dd', { text: String(w.atk) })),
        w.sub ? h('div', null, h('dt', { text: w.sub }), h('dd', { text: w.subv })) : null),
      w.p ? h('details', { class: 'weapon-passive' }, h('summary', null, w.pn || 'Passive', h('small', { text: ' · rank 1' })), h('p', { text: w.p })) : null);
  }
  function weaponsPane(c) {
    var b = c.build || {}, list = (b.wk || []).filter(Boolean), seen = {};
    var out = h('div', { class: 'weapons-pane' });
    if (c.sig) { seen[c.sig] = 1; add(out, [h('span', { class: 'lbl', text: 'Signature weapon' }), weaponCard(c.sig, 'Signature')]); }
    var rec = list.filter(function (k) { return !seen[k] && (seen[k] = 1); });
    if (rec.length) add(out, [h('span', { class: 'lbl', text: c.sig ? 'Other good picks' : 'Recommended weapons' }), h('div', { class: 'weapon-list' }, rec.map(function (k) { return weaponCard(k, list.indexOf(k) === 0 && !c.sig ? 'Best' : '', list.indexOf(k) + 1); }))]);
    if (!c.sig && !rec.length) add(out, h('p', { class: 'empty', text: 'No weapon data for ' + c.name + ' yet.' }));
    add(out, h('p', { class: 'fine', text: 'Stats are at level 90. Passives are shown at rank 1. The signature weapon is the one released alongside the character.' }));
    return out;
  }
  function buildPane(c) {
    var b = c.build;
    if (!b) return h('p', { class: 'empty', text: 'No build guide has been written for ' + c.name + ' yet. Farming materials are listed under Materials.' });
    function row(k, v) { return v ? h('div', { class: 'brow' }, h('dt', { text: k }), h('dd', { text: v })) : null; }
    function list(k, arr, best, keys) {
      return arr && arr.length ? h('div', { class: 'brow' }, h('dt', { text: k }), h('dd', null, h('ol', { class: 'rank' }, arr.map(function (x, i) {
        var key = keys && keys[i];
        return h('li', null, key ? weaponIcon(key, 'tiny') : null, x, key && key === c.sig ? h('em', { class: 'sigtag', text: 'Signature' }) : i === 0 && best ? h('em', { text: best }) : null);
      })))) : null;
    }
    var provisional = /provisional/i.test(b.note || '');
    return h('div', { class: 'build' },
      h('p', { class: 'build-role' }, h('span', { class: 'lbl', text: 'Role' }), b.role, provisional ? h('em', { class: 'warn', text: 'Early guide' }) : null),
      h('dl', { class: 'btable' }, list('Weapons', b.weapons, 'Best', b.wk), list(WORLD === 'wuwa' ? 'Echo sets' : 'Artifact sets', b.sets, 'Best'),
        row('Main stats', b.main), row('Substats', b.subs), row(WORLD === 'wuwa' ? 'Forte priority' : 'Talent priority', b.skills)),
      b.teams && b.teams.length ? h('div', { class: 'build-teams' }, h('span', { class: 'lbl', text: 'Suggested teams' }), b.teams.map(teamRow)) : null,
      b.note ? h('p', { class: 'bond-note', text: b.note.replace(/^Provisional build\.?\s*/i, '') || 'An early build that may change as players test the character.' }) : null,
      h('p', { class: 'fine', text: 'Builds are community-standard recommendations written for this site. Check an up-to-date guide before spending rare resources.' }));
  }
  function matsPane(c) {
    var m = c.mats || { a: [], s: [] };
    if (!m.a.length && !m.s.length) return h('p', { class: 'empty', text: 'No material data for ' + c.name + '.' });
    function group(label, list) { return list.length ? [h('span', { class: 'lbl', text: label }), h('div', { class: 'mats' }, list.map(function (x) { return itemTile(x[0], x[1]); }))] : null; }
    return h('div', { class: 'mat-pane' }, group(D.labels.asc || 'Ascension', m.a), group(D.labels.skill || 'Skills', m.s),
      WORLD === 'genshin' ? h('p', { class: 'fine', text: 'Talent books show the days their domain is open. Books you can farm today are outlined. Sunday opens every domain.' }) : null,
      h('button', { class: 'btn ghost', type: 'button', onclick: function () { closeSheet(true); scrollToId('bosses'); } }, 'See the boss list'));
  }
  function tierOf(cid) {
    var T = D.tiers; if (!T) return null;
    for (var i = 0; i < T.rows.length; i++) for (var j = 0; j < T.rows[i].cells.length; j++) if (T.rows[i].cells[j].indexOf(cid) >= 0) return { tier: T.rows[i].tier, col: T.columns[j] };
    return null;
  }
  function openSheet(id) {
    var c = byId[id]; if (!c) return;
    var sheet = $('#sheet'), body = $('#sheet-body'), cid = canon(id), wasOpen = sheetOpen;
    if (!sheetOpen) lastFocus = document.activeElement;
    G.form[cid] = id;
    var says = outLines[cid] || [], said = inLines[cid] || [], L = D.labels;
    function fact(k, v, click) { return v ? h('div', { class: 'fact' }, h('dt', { text: k }), click ? h('dd', null, h('button', { class: 'linkish', type: 'button', onclick: click, text: v })) : h('dd', { text: v })) : null; }
    var other = D.chars.filter(function (x) { return x.id !== id && canon(x.id) === cid; })[0];
    var voice = h('div', null);
    var vtabs = h('div', { class: 'tabs sub', role: 'tablist' }), vpanes = h('div', { class: 'panes' });
    function vtab(label, items, dir, key, emptyMsg) {
      var pane = h('div', { class: 'pane' }, items.length ? items.map(function (l) { return quoteBlock(l, l[key], dir); }) : h('p', { class: 'empty', text: emptyMsg }));
      var btn = h('button', { class: 'tab', type: 'button', onclick: function () { pick(btn, pane); } }, label, h('i', { text: String(items.length) }));
      vtabs.appendChild(btn); vpanes.appendChild(pane); return [btn, pane];
    }
    function pick(btn, pane) { $$('.tab', vtabs).forEach(function (b) { b.classList.toggle('on', b === btn); }); $$('.pane', vpanes).forEach(function (p) { p.hidden = p !== pane; }); }
    var t1 = vtab(first(c) + ' on others', says, 'About', 't', 'No voice lines about other ' + D.meta.charWord.toLowerCase() + ' are recorded for ' + c.name + '.');
    var t2 = vtab('Others on ' + first(c), said, 'From', 'f', 'Nobody has a recorded voice line about ' + c.name + ' yet.');
    if (!says.length && said.length) pick(t2[0], t2[1]); else pick(t1[0], t1[1]);
    add(voice, [vtabs, vpanes]);
    var tr = tierOf(cid);
    var profile = h('div', null,
      h('p', { class: 'sheet-lore', text: c.lore }),
      h('dl', { class: 'facts' }, fact('First appeared', 'Version ' + c.ver, function () { goVersion(c.ver); }),
        tr ? fact('Tier', tr.tier + ' · ' + tr.col, function () { closeSheet(true); scrollToId('tiers'); }) : null,
        fact(L.faction, c.faction), fact(L.region, c.region), fact('Birthday', c.birthday), L.extra ? fact(L.extra, c.extra) : null),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn', type: 'button', onclick: function () { closeSheet(true); setCenter(cid, null); scrollToId('connections'); } }, 'Show connections'),
        other ? h('button', { class: 'btn ghost', type: 'button', onclick: function () { openSheet(other.id); } }, other.tag ? 'View ' + other.tag.toLowerCase() + ' version' : 'View ' + other.name) : null));
    var panes = { profile: profile, build: buildPane(c), weapons: weaponsPane(c), mats: matsPane(c), voice: voice };
    var tabs = h('div', { class: 'tabs main', role: 'tablist' });
    var holder = h('div', { class: 'sheet-pane' });
    [['profile', 'Profile'], ['build', 'Build'], ['weapons', 'Weapons'], ['mats', 'Materials'], ['voice', 'Voice-overs']].forEach(function (t) {
      tabs.appendChild(h('button', { class: 'tab', type: 'button', role: 'tab', 'data-t': t[0], onclick: function () { show(t[0]); } }, t[1], t[0] === 'voice' ? h('i', { text: String(says.length + said.length) }) : null));
    });
    function show(k) {
      sheetTab = k;
      $$('.tab', tabs).forEach(function (b) { b.classList.toggle('on', b.dataset.t === k); b.setAttribute('aria-selected', b.dataset.t === k ? 'true' : 'false'); });
      swap(holder, panes[k]);
    }
    var artSrc = c.art ? IMG + 'art/' + c.id + '.webp' : IMG + 'icons/' + c.id + '.webp';
    var img = h('img', { class: 'sheet-art' + (c.art ? '' : ' sheet-art-icon'), src: artSrc, alt: c.name + ' artwork', decoding: 'async' });
    function loaded() { img.classList.add('loaded'); }
    if (img.complete) loaded(); else img.addEventListener('load', loaded);
    var stage = h('div', { class: 'sheet-3d', 'aria-hidden': 'true' });
    var hero = h('div', { class: 'sheet-hero', style: '--elc:' + elHex(c) }, img, stage,
      h('div', { class: 'sheet-id' }, h('span', { class: 'lbl', text: place(c) }),
        h('h3', { id: 'sheet-name', text: c.name }),
        c.title ? h('p', { class: 'sheet-title', text: (WORLD === 'wuwa' ? L.title + ': ' : '') + c.title }) : null,
        h('div', { class: 'sheet-chips' }, c.el ? h('span', { class: 'pill el' }, h('img', { src: elIcon(c.el), alt: '' }), c.el) : null,
          c.tag ? h('span', { class: 'pill', text: c.tag }) : null, h('span', { class: 'pill', text: c.weapon }), h('span', { class: 'pill rare' }, stars(c.rarity)),
          tr ? h('span', { class: 'pill tierpill t-' + tr.tier.toLowerCase(), text: tr.tier + ' tier' }) : null)),
      h('span', { class: 'drag-hint', text: 'Drag to turn' }));
    var content = h('div', { class: 'sheet-in r' + c.rarity + ' ' + (c.el ? 'el-' + c.el.toLowerCase() : 'el-none') + (wasOpen ? ' quiet' : '') }, hero, tabs, holder);
    body.replaceChildren(content); body.scrollTop = 0;
    show(sheetTab);
    sheet.setAttribute('aria-labelledby', 'sheet-name');
    if (!sheetOpen) { sheetOpen = true; sheet.hidden = false; $('#scrim').hidden = false; void sheet.offsetWidth; document.documentElement.classList.add('sheet-open'); }
    $('#sheet-close').focus({ preventScroll: true });
    whenScene(function () {
      if (!sheetOpen) return;
      window.LoreScene.showcase(stage, { art: artSrc, color: elHex(c), world: WORLD, isIcon: !c.art }, function () { hero.classList.add('has3d'); });
    });
  }
  function closeSheet(leaving) {
    if (!sheetOpen) return;
    sheetOpen = false; document.documentElement.classList.remove('sheet-open');
    if (window.LoreScene) window.LoreScene.showcaseStop();
    setTimeout(function () { if (!sheetOpen) { $('#sheet').hidden = true; $('#scrim').hidden = true; } }, reduceMotion ? 0 : 380);
    if (leaving !== true && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // ---------- bosses ----------
  var bossKind = true;
  function renderBosses() {
    var list = (D.bosses || []).filter(function (b) { return !!b.weekly === bossKind; });
    $$('#boss-tabs .chip').forEach(function (b) { b.classList.toggle('on', (b.dataset.k === 'w') === bossKind); });
    var grid = h('div', { class: 'boss-grid' });
    list.forEach(function (b, i) {
      var drops = b.drops || [{ item: b.item, chars: b.chars }];
      grid.appendChild(h('article', { class: 'boss cardish', style: '--i:' + Math.min(i, 24) },
        h('h4', { text: b.name }), b.note ? h('p', { class: 'boss-note', text: b.note }) : null,
        drops.map(function (d) {
          return h('div', { class: 'drop' }, itemTile(d.item, null),
            h('div', { class: 'drop-who' }, h('span', { class: 'lbl', text: 'Needed by ' + d.chars.length }), h('div', { class: 'team-faces small' }, d.chars.map(function (id) { return faceBtn(id); }))));
        })));
    });
    if (!list.length) grid.appendChild(h('p', { class: 'empty', text: 'No bosses in this group.' }));
    $('#boss-body').replaceChildren(grid);
  }
  function initBosses() {
    if (!(D.bosses || []).length) { $('#bosses').hidden = true; return; }
    var tabs = $('#boss-tabs');
    [['w', D.labels.boss || 'Weekly bosses'], ['o', 'World bosses']].forEach(function (x) {
      tabs.appendChild(h('button', { class: 'chip', type: 'button', 'data-k': x[0], onclick: function () { bossKind = x[0] === 'w'; renderBosses(); } }, h('span', { text: x[1] })));
    });
    renderBosses();
  }

  // ---------- teams ----------
  function initTeams() {
    var T2 = D.teams || [];
    if (!T2.length) { $('#teams').hidden = true; return; }
    var tabs = $('#team-tabs'), body = $('#team-body');
    function show(i) {
      $$('.chip', tabs).forEach(function (b, bi) { b.classList.toggle('on', bi === i); });
      var m = T2[i];
      swap(body, h('div', null, h('p', { class: 'team-note', text: m.note || '' }),
        h('div', { class: 'team-grid' }, m.teams.map(function (t, k) {
          return h('article', { class: 'team cardish', style: '--i:' + k }, h('span', { class: 'lbl', text: t.name || 'Team' }),
            h('div', { class: 'team-faces big' }, t.chars.map(function (id) { var c = byId[id]; return c ? h('button', { class: 'team-slot', type: 'button', onclick: function () { openSheet(id); } }, face(c, 'big'), h('small', { text: shortName(c) })) : h('span', { class: 'tag', text: id }); })),
            t.note ? h('p', { text: t.note }) : null);
        }))));
    }
    T2.forEach(function (m, i) { tabs.appendChild(h('button', { class: 'chip', type: 'button', onclick: function () { show(i); } }, h('span', { text: m.mode }))); });
    show(0);
  }

  // ---------- connections ----------
  var G = { center: null, sel: null, nodes: {}, form: {}, view: 'focus' };
  function formOf(cid) { return G.form[cid] || cid; }
  function neighbours(id) {
    var m = {};
    (outLines[id] || []).forEach(function (l) { (m[l.t] = m[l.t] || {}).out = l; });
    (inLines[id] || []).forEach(function (l) { (m[l.f] = m[l.f] || {}).inn = l; });
    return Object.keys(m).filter(function (k) { return byId[k]; }).map(function (k) { return { id: k, out: m[k].out, inn: m[k].inn }; })
      .sort(function (a, b) { return ((b.out && b.inn) ? 1 : 0) - ((a.out && a.inn) ? 1 : 0) || verKey(byId[a.id].ver) - verKey(byId[b.id].ver); });
  }
  var DEG = {};
  function initGraph() {
    D.lines.forEach(function (l) { DEG[l.f] = (DEG[l.f] || 0) + 1; DEG[l.t] = (DEG[l.t] || 0) + 1; });
    var hubs = Object.keys(DEG).filter(function (k) { return byId[k]; }).sort(function (a, b) { return DEG[b] - DEG[a]; }).slice(0, 12);
    hubs.forEach(function (id) { $('#hub-row').appendChild(h('button', { class: 'hub', type: 'button', title: byId[id].name, 'data-id': id, onclick: function () { setCenter(id, null); } }, face(byId[id]))); });
    var input = $('#g-q'), list = $('#g-results');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(); list.replaceChildren();
      if (!q) { list.hidden = true; return; }
      var found = D.chars.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 7);
      found.forEach(function (c) { list.appendChild(h('button', { class: 'res', type: 'button', onclick: function () { input.value = ''; list.hidden = true; G.form[canon(c.id)] = c.id; setCenter(canon(c.id), null); } }, face(c), h('span', { text: c.name + (c.tag ? ' (' + c.tag + ')' : '') }))); });
      if (!found.length) list.appendChild(h('p', { class: 'empty', text: 'No match.' }));
      list.hidden = false;
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var b = $('.res', list); if (b) b.click(); } if (e.key === 'Escape') { input.value = ''; list.hidden = true; } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.g-search')) list.hidden = true; });
    $('#g-random').addEventListener('click', function () { var pool = Object.keys(DEG).filter(function (k) { return byId[k]; }); setCenter(pool[Math.floor(Math.random() * pool.length)], null); });
    $$('#g-view .chip').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.v); }); });
    var start = WORLD === 'wuwa' ? 'jinhsi' : 'zhongli';
    setCenter(DEG[start] ? start : hubs[0], null);
    window.addEventListener('resize', debounce(function () { layoutGraph(false); }, 150));
  }
  function setView(v) {
    G.view = v;
    $$('#g-view .chip').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    $('#graph').hidden = v !== 'focus'; $('#starmap').hidden = v !== 'map';
    $('.legend').hidden = v !== 'focus';
    if (v === 'map') whenScene(function () { window.LoreScene.starmap($('#starmap'), mapData(), function (id) { setCenter(id, null, true); }); window.LoreScene.focus(G.center); });
    else { if (window.LoreScene) window.LoreScene.pause(); layoutGraph(true); }
  }
  function mapData() {
    return {
      world: WORLD,
      nodes: D.chars.filter(function (c) { return !c.same; }).map(function (c) { return { id: c.id, name: c.name, region: c.region, img: IMG + 'icons/' + formOf(c.id) + '.webp', deg: DEG[c.id] || 0, color: elHex(c), rare: c.rarity }; }),
      regionHue: D.regions.reduce(function (o, r) { o[r] = regionHue(r); return o; }, {}),
      edges: D.lines.filter(function (l) { return byId[l.f] && byId[l.t]; }).map(function (l) { return [l.f, l.t]; })
    };
  }
  function whenScene(cb) { if (window.LoreScene) cb(); else document.addEventListener('lorescene', cb, { once: true }); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function setCenter(id, sel, fromMap) {
    id = canon(id); if (!byId[id]) return;
    if (G.center !== id) GF.region = '';
    G.center = id; G.sel = sel;
    $$('#hub-row .hub').forEach(function (b) { b.classList.toggle('on', b.dataset.id === id); });
    if (G.view === 'focus') layoutGraph(true); else if (!fromMap && window.LoreScene) window.LoreScene.focus(id);
    renderBond();
  }
  function selectBond(id) {
    if (id && G.sel === id) { setCenter(id, G.center); return; }
    G.sel = id;
    $$('#graph .gnode').forEach(function (n) { n.classList.toggle('sel', n.dataset.id === id); });
    $$('#graph-edges .edge').forEach(function (e) { e.classList.toggle('sel', e.getAttribute('data-id') === id); });
    renderBond();
  }
  var GF = { region: '', mutual: false };
  var REGION_HUE = ['#e6c98a', '#7fe3c4', '#8fc7ff', '#c9a2ff', '#ff9d7a', '#9bd45c', '#ffd36b', '#ff8fb8', '#9fe3ef', '#b9b9c9'];
  function regionOf(id) { var c = byId[id]; return c ? c.region || 'Unknown' : 'Unknown'; }
  function regionHue(r) { var i = D.regions.indexOf(r); return REGION_HUE[(i < 0 ? D.regions.length : i) % REGION_HUE.length]; }
  function renderGraphFilters(all) {
    var box = $('#g-filters');
    if (all.length <= 20) { box.hidden = true; box.replaceChildren(); GF.region = ''; GF.mutual = false; return; }
    var counts = {};
    all.forEach(function (x) { var r = regionOf(x.id); counts[r] = (counts[r] || 0) + 1; });
    var regs = Object.keys(counts).sort(function (a, b) { return D.regions.indexOf(a) - D.regions.indexOf(b); });
    if (GF.region && !counts[GF.region]) GF.region = '';
    var mutualN = all.filter(function (x) { return x.out && x.inn; }).length;
    function f(label, n, on, click, hue) {
      return h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', style: hue ? '--rh:' + hue : null, onclick: click }, hue ? h('i', { class: 'rdot' }) : null, h('span', { text: label }), h('small', { text: String(n) }));
    }
    box.hidden = false;
    box.replaceChildren();
    add(box, [
      f('Everyone', all.length, !GF.region, function () { GF.region = ''; layoutGraph(true); }),
      regs.map(function (r) { return f(r, counts[r], GF.region === r, function () { GF.region = GF.region === r ? '' : r; layoutGraph(true); }, regionHue(r)); }),
      h('span', { class: 'g-sep' }),
      f('Both speak only', mutualN, GF.mutual, function () { GF.mutual = !GF.mutual; layoutGraph(true); })]);
  }
  function layoutGraph(animate) {
    var stage = $('#graph'), svg = $('#graph-edges');
    if (!stage.clientWidth) return;
    var all = neighbours(G.center);
    renderGraphFilters(all);
    var nb = all.filter(function (x) { return (!GF.region || regionOf(x.id) === GF.region) && (!GF.mutual || (x.out && x.inn)); });
    var n = nb.length, pos = {};
    pos[G.center] = { x: 50, y: 50 };
    // group neighbours by region so the circle reads as named sectors instead of a random ring
    var ri = function (id) { var i = D.regions.indexOf(regionOf(id)); return i < 0 ? 99 : i; };
    nb.sort(function (a, b) { return ri(a.id) - ri(b.id) || ((b.out && b.inn) ? 1 : 0) - ((a.out && a.inn) ? 1 : 0) || verKey(byId[a.id].ver) - verKey(byId[b.id].ver); });
    var groups = [];
    nb.forEach(function (x) { var r = regionOf(x.id); if (!groups.length || groups[groups.length - 1].r !== r) groups.push({ r: r, items: [] }); groups[groups.length - 1].items.push(x); });
    var L = n <= 12 ? 1 : n <= 28 ? 2 : n <= 56 ? 3 : 4;
    var radii = L === 1 ? [n <= 5 ? 30 : 37] : L === 2 ? [27, 41.5] : L === 3 ? [21, 32.5, 44] : [18, 27, 36, 45];
    var gap = groups.length > 1 ? Math.min(0.16, 1.1 / groups.length) : 0;
    var avail = Math.PI * 2 - gap * groups.length, a = -Math.PI / 2 + gap / 2, sectors = [];
    groups.forEach(function (gp) {
      var spanA = avail * gp.items.length / Math.max(n, 1), per = Math.ceil(gp.items.length / L);
      gp.items.forEach(function (x, j) {
        var layer = L - 1 - (j % L), slot = Math.floor(j / L), cols = per;
        var off = L > 1 && per > 1 ? (layer % 2 ? 0.22 : -0.22) : 0;
        var ang = a + (slot + 0.5 + off) / cols * spanA;
        pos[x.id] = { x: 50 + Math.cos(ang) * radii[layer], y: 50 + Math.sin(ang) * radii[layer], nb: x, ang: ang, mid: a + spanA / 2, r: radii[layer] };
      });
      sectors.push({ r: gp.r, a0: a, a1: a + spanA, count: gp.items.length });
      a += spanA + gap;
    });
    stage.classList.toggle('dense', n > 13); stage.classList.toggle('crowd', n > 28); stage.classList.toggle('swarm', n > 56);
    // nodes: reuse elements so they glide between layouts
    Object.keys(G.nodes).forEach(function (id) { if (!pos[id]) { var old = G.nodes[id]; old.classList.add('out'); delete G.nodes[id]; setTimeout(function () { old.remove(); }, 350); } });
    Object.keys(pos).forEach(function (id) {
      var c = byId[formOf(id)] || byId[id], p = pos[id], node = G.nodes[id];
      if (!node) {
        var fromCentre = G.nodes[G.center] && id !== G.center;
        node = h('button', { class: 'gnode in', type: 'button', 'data-id': id, style: 'left:' + (fromCentre ? 50 : p.x) + '%;top:' + (fromCentre ? 50 : p.y) + '%' }, face(c), h('span', { class: 'gname', text: shortName(c) }));
        node.addEventListener('click', function () { if (id === G.center) selectBond(null); else selectBond(id); });
        node.addEventListener('dblclick', function () { if (id !== G.center) setCenter(id, null); });
        node.addEventListener('mouseenter', function () { var e = $('#graph-edges .edge[data-id="' + id + '"]'); if (e) e.classList.add('hot'); });
        node.addEventListener('mouseleave', function () { var e = $('#graph-edges .edge[data-id="' + id + '"]'); if (e) e.classList.remove('hot'); });
        stage.appendChild(node); G.nodes[id] = node; void node.offsetWidth;
      } else { var im = $('img', node), src = IMG + 'icons/' + c.id + '.webp'; if (im.getAttribute('src') !== src) im.setAttribute('src', src); $('.gname', node).textContent = shortName(c); }
      node.className = 'gnode' + (id === G.center ? ' center' : '') + (id === G.sel ? ' sel' : '') + (p.nb && p.nb.out && p.nb.inn ? ' mutual' : '') + ' r' + c.rarity;
      node.style.left = p.x + '%'; node.style.top = p.y + '%';
      node.style.setProperty('--rh', id === G.center ? '' : regionHue(regionOf(id)));
      node.setAttribute('aria-label', c.name + (id === G.center ? ', centre' : ''));
    });
    // region labels around the rim
    $$('.g-label', stage).forEach(function (l) { l.remove(); });
    if (groups.length > 1) sectors.forEach(function (s) {
      var m = (s.a0 + s.a1) / 2, x = 50 + Math.cos(m) * 50.5, y = 50 + Math.sin(m) * 50.5;
      if (s.a1 - s.a0 < 0.22 && s.count < 3) return;
      stage.appendChild(h('span', { class: 'g-label', style: 'left:' + x + '%;top:' + y + '%;--rh:' + regionHue(s.r) + ';--tx:' + (Math.cos(m) > 0.25 ? '0%' : Math.cos(m) < -0.25 ? '-100%' : '-50%') + ';--ty:' + (Math.sin(m) > 0.25 ? '0%' : Math.sin(m) < -0.25 ? '-100%' : '-50%') }, s.r, h('small', { text: ' ' + s.count })));
    });
    // edges: curves bundled per region sector, so a big circle stays readable
    svg.replaceChildren();
    var NS = 'http://www.w3.org/2000/svg', rim = L === 1 ? radii[0] + 6.5 : 48;
    function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
    if (groups.length > 1) sectors.forEach(function (s) {
      var p0 = [50 + Math.cos(s.a0) * rim, 50 + Math.sin(s.a0) * rim], p1 = [50 + Math.cos(s.a1) * rim, 50 + Math.sin(s.a1) * rim];
      var arc = el('path', { d: 'M' + p0 + ' A' + rim + ' ' + rim + ' 0 ' + (s.a1 - s.a0 > Math.PI ? 1 : 0) + ' 1 ' + p1, class: 'sector' });
      arc.style.stroke = regionHue(s.r); svg.appendChild(arc);
    });
    var c1 = n > 56 ? 2.4 : n > 28 ? 3.2 : n > 13 ? 4.8 : 6.2, c0 = n > 13 ? 8 : 9.5;
    nb.forEach(function (x, i) {
      var p = pos[x.id], bund = Math.min(p.r * 0.42, 15), cx = 50 + Math.cos(p.mid) * bund, cy = 50 + Math.sin(p.mid) * bund;
      if (groups.length <= 1 || L === 1) { cx = 50 + (p.x - 50) * 0.5; cy = 50 + (p.y - 50) * 0.5; }
      var sx = cx - 50, sy = cy - 50, sl = Math.sqrt(sx * sx + sy * sy) || 1;
      var x0 = 50 + sx / sl * c0, y0 = 50 + sy / sl * c0;
      var ex = p.x - cx, ey = p.y - cy, el2 = Math.sqrt(ex * ex + ey * ey) || 1;
      var x1 = p.x - ex / el2 * c1, y1 = p.y - ey / el2 * c1;
      var g = el('path', { d: 'M' + x0 + ' ' + y0 + ' Q' + cx + ' ' + cy + ' ' + x1 + ' ' + y1, class: 'edge ' + (x.out && x.inn ? 'mutual' : x.out ? 'out' : 'in') + (x.id === G.sel ? ' sel' : ''), 'data-id': x.id });
      g.style.setProperty('--d', (120 + Math.min(i, 50) * 10) + 'ms');
      if (x.out && x.inn) g.style.setProperty('--rh', regionHue(regionOf(x.id)));
      svg.appendChild(g);
      if (n <= 13) svg.appendChild(el('circle', { cx: x1, cy: y1, r: 0.7, class: 'edge-dot ' + (x.out ? 'out' : 'in'), 'data-id': x.id }));
    });
    if (animate) { svg.classList.remove('draw'); void svg.getBoundingClientRect(); svg.classList.add('draw'); }
    var shown = n === all.length ? n + (n === 1 ? ' connection' : ' connections') : n + ' of ' + all.length + ' connections';
    $('#graph-cap').textContent = (byId[formOf(G.center)] || byId[G.center]).name + ' · ' + shown;
  }
  function renderBond() {
    var box = $('#bond'), c = byId[formOf(G.center)] || byId[G.center], nb = neighbours(G.center);
    if (!G.sel) {
      var list = h('div', { class: 'bond-list' });
      nb.forEach(function (x) {
        var o = byId[formOf(x.id)] || byId[x.id];
        list.appendChild(h('button', { class: 'bond-row', type: 'button', onclick: function () { if (G.view === 'map') { G.sel = x.id; renderBond(); } else selectBond(x.id); } },
          face(o), h('span', null, h('b', { text: o.name }), h('small', { text: x.out && x.inn ? 'They speak of each other' : x.out ? first(c) + ' speaks of them' : 'Speaks of ' + first(c) })),
          h('i', { class: 'dir ' + (x.out && x.inn ? 'mutual' : x.out ? 'out' : 'in') })));
      });
      if (!nb.length) list.appendChild(h('p', { class: 'empty', text: 'No voice lines link ' + c.name + ' to anyone yet. New arrivals often have none recorded.' }));
      swap(box, h('div', { class: 'bond-in' },
        h('div', { class: 'bond-top' }, face(c, 'big'), h('div', null, h('span', { class: 'lbl', text: 'At the centre' }), h('h3', { text: c.name }), h('p', { class: 'bond-sub', text: place(c) }))),
        h('p', { class: 'bond-lore', text: c.lore }),
        h('div', { class: 'bond-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: function () { openSheet(c.id); } }, 'Open profile')),
        h('span', { class: 'lbl', text: nb.length + ' connections' }), list));
      return;
    }
    var o = byId[formOf(G.sel)] || byId[G.sel];
    var x = nb.filter(function (k) { return k.id === G.sel; })[0] || {};
    var note = D.bonds[bondKey(G.center, G.sel)], shared = [];
    if (c.faction && c.faction === o.faction) shared.push('Both: ' + c.faction);
    else if (c.region === o.region && c.region !== 'Beyond' && c.region !== 'Unknown') shared.push('Both tied to ' + c.region);
    function side(a, b, l) {
      return h('div', { class: 'bond-quote' + (l ? '' : ' none') },
        h('div', { class: 'bq-head' }, face(a), h('span', null, h('b', { text: a.name }), ' on ' + b.name + (l && l.s ? ' · ' + l.s : ''))),
        l ? h('blockquote', { text: l.q }) : h('p', { class: 'empty', text: 'No recorded voice line.' }));
    }
    swap(box, h('div', { class: 'bond-in' },
      h('div', { class: 'bond-pair' }, face(c, 'big'), h('i', { class: 'pair-link ' + (x.out && x.inn ? 'mutual' : x.out ? 'out' : 'in') }), face(o, 'big')),
      h('h3', { class: 'bond-title' }, c.name, h('em', { text: ' and ' }), o.name),
      shared.length ? h('div', { class: 'tags' }, shared.map(function (s) { return h('span', { class: 'tag', text: s }); })) : null,
      note ? h('p', { class: 'bond-note', text: note }) : null,
      side(c, o, x.out), side(o, c, x.inn),
      h('div', { class: 'bond-actions' },
        h('button', { class: 'btn', type: 'button', onclick: function () { setCenter(G.sel, null); } }, 'Centre on ' + first(o)),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { openSheet(o.id); } }, 'Open profile'),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { if (G.view === 'map') { G.sel = null; renderBond(); } else selectBond(null); } }, 'Back to list'))));
  }

  // ---------- nav ----------
  function initNav() {
    $$('[data-goto]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); scrollToId(a.dataset.goto); }); });
    var links = $$('.nav a[data-goto]');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) { var on = l.dataset.goto === e.target.id; l.classList.toggle('on', on); if (on && l.parentNode.scrollTo) l.parentNode.scrollTo({ left: l.offsetLeft - 40, behavior: 'smooth' }); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      links.forEach(function (l) { var s = document.getElementById(l.dataset.goto); if (s) io.observe(s); });
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

  initHero(); renderNow(); initTimeline(); initRoster(); initTiers(); initBosses(); initTeams(); initGraph(); initNav();
  setInterval(function () { if (!document.hidden) renderNow(); }, 60000);
  whenScene(function () { try { window.LoreScene.hero($('#hero-3d'), WORLD); } catch (e) {} });
  document.documentElement.classList.add('ready');
})();
