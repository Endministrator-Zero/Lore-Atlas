#!/usr/bin/env node
// Writes the three HTML pages from one template, so both world pages always share the same structure.
//   node tools/pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230c0e14'/%3E%3Cpath d='M16 4l3 9 9 3-9 3-3 9-3-9-9-3 9-3z' fill='%23dfc58d'/%3E%3C/svg%3E";
const head = v => `<!doctype html>
<html lang="en" data-world="${v.world}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${v.title}</title>
<meta name="description" content="${v.desc}">
<meta name="theme-color" content="${v.theme}">
<meta property="og:title" content="${v.title}">
<meta property="og:description" content="${v.desc}">
<link rel="icon" href="${ICON}">
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/site.css">
<script>try{if(sessionStorage.getItem('warp'))document.documentElement.classList.add('warp-in')}catch(e){}</script>
<script type="importmap">{"imports":{"three":"./assets/vendor/three.module.min.js"}}</script>
</head>
`;
const WARP = `<div class="warp" id="warp" aria-hidden="true">
  <div class="warp-bg"></div>
  <div class="warp-rings"><i></i><i></i><i></i></div>
  <div class="warp-card"><i class="warp-sigil"></i><small class="warp-k"></small><b class="warp-t"></b><span class="warp-s"></span></div>
</div>
`;
const NOTE = '<p><b>Unofficial fan project.</b> Lore Atlas is not affiliated with or endorsed by Kuro Games or HoYoverse. Wuthering Waves and Genshin Impact, their characters, artwork and voice lines belong to their respective owners.</p>';

const world = v => head(v) + `<body>
<a class="skip" href="#timeline">Skip to timeline</a>
<canvas class="ambient" data-ambient="${v.world}" aria-hidden="true"></canvas>
<div class="veil" aria-hidden="true"></div>

<header class="top">
  <a class="brand" href="index.html" data-warp="atlas" aria-label="Lore Atlas home"><i class="sigil"></i><span><b>Lore Atlas</b><small>${v.game} · ${v.place}</small></span></a>
  <nav class="nav" aria-label="Sections">
    <a href="#now" data-goto="now">Now</a>
    <a href="#timeline" data-goto="timeline">Timeline</a>
    <a href="#characters" data-goto="characters" data-charword>Characters</a>
    <a href="#bosses" data-goto="bosses">Bosses</a>
    <a href="#teams" data-goto="teams">Teams</a>
    <a href="#connections" data-goto="connections">Connections</a>
  </nav>
  <a class="switch w-${v.other}" href="${v.otherHref}" data-warp="${v.other}"><span><small>Switch world</small><b>${v.otherGame}</b></span><i class="switch-orb"></i></a>
</header>

<main>
  <section class="hero wrap">
    <div class="hero-text">
      <p class="kicker" id="hero-kicker"></p>
      <h1 id="hero-title"></h1>
      <p class="intro" id="hero-intro"></p>
      <div class="hero-cta">
        <a class="btn" href="#now" data-goto="now">What is on now</a>
        <a class="btn ghost" href="#timeline" data-goto="timeline">Start at 1.0</a>
      </div>
      <div class="stats" id="hero-stats"></div>
    </div>
    <div class="hero-side">
      <div class="hero-3d" id="hero-3d" aria-hidden="true"></div>
      <button class="latest cardish" id="hero-latest" type="button" aria-label="Open the current version"></button>
    </div>
  </section>

  <section class="sec wrap" id="now">
    <header class="sec-head"><h2>Now</h2><p>The live version: banners, events, new arrivals and how many pulls it is worth. Dates show in your own time zone and refresh by themselves.</p></header>
    <div class="now-head cardish" id="now-head"></div>
    <div class="now-body" id="now-body"></div>
  </section>

  <section class="sec wrap" id="timeline">
    <header class="sec-head"><h2>Timeline</h2><p>Pick a chapter, then a version. The arrow keys move along the line.</p></header>
    <div class="arc-tabs" id="arc-tabs" role="tablist" aria-label="Chapters"></div>
    <div class="arc">
      <div class="arc-head" id="arc-head"></div>
      <div class="rail-wrap">
        <div class="rail" id="rail" aria-label="Versions in this chapter"></div>
        <div class="rail-ctl">
          <button id="ver-prev" class="step" type="button" aria-label="Previous version">&#8249;</button>
          <span id="ver-count"></span>
          <button id="ver-next" class="step" type="button" aria-label="Next version">&#8250;</button>
        </div>
      </div>
    </div>
    <div class="ver-detail cardish" id="ver-detail" aria-live="polite"></div>
  </section>

  <section class="sec wrap" id="characters">
    <header class="sec-head"><h2 data-charword>Characters</h2><p>Everyone playable so far. Select a portrait for their story, build, farming materials and voice lines.</p></header>
    <div class="filters">
      <div class="f-row">
        <label class="search"><span class="sr">Search by name</span><input id="f-q" type="search" autocomplete="off"></label>
        <div class="chips" id="f-rarity"></div>
        <div class="chips" id="f-sort"></div>
        <span class="count" id="roster-count"></span>
      </div>
      <div class="chips scroll" id="f-el"></div>
      <div class="chips scroll" id="f-region"></div>
    </div>
    <div class="grid" id="roster-grid"></div>
  </section>

  <section class="sec wrap" id="bosses">
    <header class="sec-head"><h2>Bosses</h2><p>Which boss drops which material, and who needs it. Select a portrait to open that profile.</p></header>
    <div class="chips" id="boss-tabs"></div>
    <div id="boss-body"></div>
  </section>

  <section class="sec wrap" id="teams">
    <header class="sec-head"><h2>Teams</h2><p>Team line-ups that are popular in the current endgame modes.</p></header>
    <div class="chips" id="team-tabs"></div>
    <div id="team-body"></div>
  </section>

  <section class="sec wrap" id="connections">
    <header class="sec-head"><h2>Connections</h2><p>Drawn from in-game voice lines. A line between two portraits means one of them talks about the other. Select a portrait to read what was said. Select it a second time to move it to the centre.</p></header>
    <div class="g-bar">
      <div class="g-search"><label><span class="sr">Find someone</span><input id="g-q" type="search" placeholder="Find someone" autocomplete="off"></label><div class="g-results" id="g-results" hidden></div></div>
      <div class="hub-row" id="hub-row" aria-label="Most connected"></div>
      <div class="chips" id="g-view"><button class="chip on" type="button" data-v="focus"><span>Focus</span></button><button class="chip" type="button" data-v="map"><span>3D star map</span></button></div>
      <button class="btn ghost" id="g-random" type="button">Surprise me</button>
    </div>
    <div class="g-layout">
      <div class="g-stage">
        <div class="graph" id="graph">
          <div class="g-deco" aria-hidden="true"><i></i><i></i><i></i></div>
          <svg id="graph-edges" viewBox="0 0 100 100" aria-hidden="true"></svg>
        </div>
        <div class="starmap" id="starmap" hidden></div>
        <div class="g-foot"><span id="graph-cap"></span><span class="legend"><i class="dir mutual"></i>both speak<i class="dir out"></i>one speaks</span></div>
      </div>
      <aside class="bond cardish" id="bond" aria-live="polite"></aside>
    </div>
  </section>
</main>

<footer class="foot wrap">
  ${NOTE}
  <p>Story summaries and builds are written for this site. Voice lines are short excerpts of in-game dialogue, quoted as written. Characters, materials, banners and events are rebuilt automatically from public game data and the games' own announcements.</p>
  <p id="foot-updated"></p>
  <p><a href="index.html" data-warp="atlas">Back to the gateway</a></p>
</footer>

<div class="scrim" id="scrim" hidden></div>
<aside class="sheet" id="sheet" role="dialog" aria-modal="true" hidden>
  <button class="sheet-close" id="sheet-close" type="button" aria-label="Close profile">&times;</button>
  <div class="sheet-body" id="sheet-body"></div>
</aside>
${WARP}
<script src="assets/data/${v.world}.js"></script>
<script src="assets/js/ambient.js"></script>
<script src="assets/js/app.js"></script>
<script src="assets/js/warp.js"></script>
<script type="module" src="assets/js/scene.js"></script>
</body>
</html>
`;

const index = v => head(v) + `<body>
<header class="gate-top"><span class="brand"><i class="sigil"></i><span><b>Lore Atlas</b><small>Two worlds, one fan archive</small></span></span></header>
<main class="gate">
  <a class="door w-wuwa" href="wuthering-waves.html" data-warp="wuwa" aria-label="Enter the Wuthering Waves archive">
    <canvas data-ambient="wuwa" aria-hidden="true"></canvas>
    <div class="door-in">
      <p class="kicker" style="display:flex;align-items:center;gap:12px">Wuthering Waves</p>
      <h2>Resonance Archive</h2>
      <p class="d">Solaris-3 from the first awakening in Huanglong onward. Story, builds, banners and what the Resonators say about each other.</p>
      <p class="door-now" data-now="wuwa"></p>
      <div class="door-stats" data-stats="wuwa"></div>
      <div class="door-faces" data-faces="wuwa"></div>
      <span class="btn">Enter Solaris-3</span>
    </div>
  </a>
  <a class="door w-genshin" href="genshin-impact.html" data-warp="genshin" aria-label="Enter the Genshin Impact archive">
    <canvas data-ambient="genshin" aria-hidden="true"></canvas>
    <div class="door-in">
      <p class="kicker" style="display:flex;align-items:center;gap:12px">Genshin Impact</p>
      <h2>Irminsul Records</h2>
      <p class="d">Teyvat from the first step in Mondstadt to the snows of Snezhnaya. Story, builds, banners and everyone met on the road.</p>
      <p class="door-now" data-now="genshin"></p>
      <div class="door-stats" data-stats="genshin"></div>
      <div class="door-faces" data-faces="genshin"></div>
      <span class="btn">Enter Teyvat</span>
    </div>
  </a>
  <div class="seam" aria-hidden="true"><i></i></div>
</main>
<p class="gate-foot">Unofficial fan project. Not affiliated with Kuro Games or HoYoverse. Game content belongs to its owners.</p>
${WARP}
<script src="assets/data/summary.js"></script>
<script>
(function () {
  var S = window.LORE_SUMMARY || {};
  ['wuwa', 'genshin'].forEach(function (w) {
    var s = S[w]; if (!s) return;
    var st = document.querySelector('[data-stats="' + w + '"]');
    [[s.versions, 'versions'], [s.chars, w === 'wuwa' ? 'resonators' : 'characters'], [s.lines, 'voice lines']].forEach(function (x) {
      var d = document.createElement('div'); var b = document.createElement('b'); b.textContent = x[0]; var sp = document.createElement('span'); sp.textContent = x[1]; d.appendChild(b); d.appendChild(sp); st.appendChild(d);
    });
    document.querySelector('[data-now="' + w + '"]').textContent = 'Now live: ' + s.current + (s.name ? ' · ' + s.name : '');
    var f = document.querySelector('[data-faces="' + w + '"]');
    s.faces.forEach(function (id, i) {
      var sp = document.createElement('span'); sp.className = 'face r5'; sp.style.setProperty('--i', i);
      var im = document.createElement('img'); im.src = 'assets/img/' + w + '/icons/' + id + '.webp'; im.alt = ''; im.loading = 'lazy';
      sp.appendChild(im); f.appendChild(sp);
    });
  });
})();
</script>
<script src="assets/js/ambient.js"></script>
<script src="assets/js/warp.js"></script>
</body>
</html>
`;

const pages = [
  ['wuthering-waves.html', world, { world: 'wuwa', title: 'Resonance Archive · Wuthering Waves lore, builds and banners', desc: 'An unofficial Wuthering Waves companion: story timeline, every Resonator with builds and materials, current banners and events, and the voice lines that connect the cast.', theme: '#090b0e', game: 'Wuthering Waves', place: 'Solaris-3', other: 'genshin', otherHref: 'genshin-impact.html', otherGame: 'Genshin Impact' }],
  ['genshin-impact.html', world, { world: 'genshin', title: 'Irminsul Records · Genshin Impact lore, builds and banners', desc: 'An unofficial Genshin Impact companion: story timeline, every character with builds and materials, current banners and events, and the voice lines that connect the cast.', theme: '#141a2b', game: 'Genshin Impact', place: 'Teyvat', other: 'wuwa', otherHref: 'wuthering-waves.html', otherGame: 'Wuthering Waves' }],
  ['index.html', index, { world: 'atlas', title: 'Lore Atlas · Wuthering Waves and Genshin Impact', desc: 'An unofficial fan archive of two worlds: story timelines, character builds, current banners and voice line connections for Wuthering Waves and Genshin Impact.', theme: '#0c0e14' }],
];
for (const [name, tpl, v] of pages) { fs.writeFileSync(path.join(ROOT, name), tpl(v)); console.log('wrote', name); }
