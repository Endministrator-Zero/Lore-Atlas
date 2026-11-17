#!/usr/bin/env node
// Lore Atlas updater. Rebuilds assets/data/*.js from public game data plus the hand-written files in content/.
//   cd tools && npm install && node update.mjs            (both games)
//   node update.mjs wuwa | genshin                        (one game)
// Environment: LORE_CACHE=<dir> keeps downloads between runs, LORE_OFFLINE=1 uses the cache only.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, readJSON, parseBuilds, verKey, fmtDate, log, warn } from './lib/util.mjs';
import { buildWuwa } from './lib/wuwa.mjs';
import { buildGenshin } from './lib/genshin.mjs';
import { buildLive, versionFacts } from './lib/live.mjs';

const DAY = 864e5;
const HUES = ['#7fe3c4', '#ffc46b', '#8fc7ff', '#c9a2ff', '#ff9d7a', '#9bd45c', '#bfe6ff'];

function pullEstimate(game, now, manual) {
  const days = Math.max(1, Math.round((Date.parse(now.end) - Date.parse(now.start)) / DAY));
  const events = Math.min(5, now.events.filter(e => !/Challenge|Overflow|Double|Permanent|Login|Hologram/i.test((e.kind || '') + e.name)).length);
  const rows = game === 'genshin' ? [
    ['Daily commissions', 60 * days],
    ['Spiral Abyss, Theater and Stygian Onslaught', Math.round(2050 * days / 30)],
    ['Version events', 1000 + Math.max(0, events - 1) * 420],
    ['Update compensation and livestream codes', 900],
    ['New quests and achievements', 500],
    ['Monthly shop and free battle pass (15 fates)', 15 * 160 * Math.max(1, Math.round(days / 30))],
  ] : [
    ['Daily activity', 60 * days],
    ['Tower of Adversity and Whimpering Wastes', Math.round(800 * days / 14)],
    ['Version events', 600 + Math.max(0, events - 1) * 400],
    ['Update compensation and livestream codes', 900],
    ['New quests and exploration', 800],
    ['Monthly shop and free Pioneer Podcast (about 10 tides)', 10 * 160 * Math.max(1, Math.round(days / 30))],
  ];
  const free = rows.reduce((a, r) => a + r[1], 0);
  const pass = 90 * days + (game === 'genshin' ? 0 : 0);
  const est = {
    days, unit: game === 'genshin' ? 'Primogems' : 'Astrite', per: 160, rows,
    free, freePulls: Math.floor(free / 160), pass, passPulls: Math.floor((free + pass) / 160),
    passName: game === 'genshin' ? 'Blessing of the Welkin Moon' : 'Lunite Subscription',
    note: 'Estimate from recurring sources. One-off exploration rewards are only roughly counted.',
  };
  return Object.assign(est, manual || {});
}

function ensureVersions(game, content, chars, live) {
  const arcs = content.arcs;
  const known = new Set(arcs.flatMap(a => a.versions.map(v => v.v)));
  const want = new Set(chars.map(c => c.ver).filter(v => /^\d+\.\d+$/.test(v)));
  if (live) want.add(live.v);
  const missing = [...want].filter(v => !known.has(v)).sort((a, b) => verKey(a) - verKey(b));
  for (const v of missing) {
    const facts = (live && live.v === v ? live : versionFacts(game, v)) || {};
    const debut = chars.filter(c => c.ver === v && !c.same).map(c => c.name);
    const bits = [];
    if (facts.quests?.length) bits.push('Main story: ' + facts.quests.join('; ') + '.');
    if (facts.areas?.length) bits.push('New areas: ' + facts.areas.slice(0, 4).join(', ') + '.');
    if (debut.length) bits.push(debut.join(' and ') + (debut.length > 1 ? ' debut.' : ' debuts.'));
    const entry = {
      v, name: facts.name || 'Version ' + v, date: facts.start ? fmtDate(Date.parse(facts.start) + 8 * 36e5) : 'New',
      acts: facts.quests?.length ? facts.quests.map(q => q.replace(/:.*$/, '')).join(', ') : 'New version',
      tags: (facts.areas || []).slice(0, 2), auto: true,
      text: (bits.join(' ') || 'This version has just been detected.') + ' A written summary has not been added yet.',
    };
    const last = arcs[arcs.length - 1];
    const lastMajor = last.versions[last.versions.length - 1].v.split('.')[0];
    if (v.split('.')[0] === lastMajor || last.auto) last.versions.push(entry);
    else arcs.push({ id: 'v' + v.split('.')[0], name: 'Version ' + v.split('.')[0], chapter: 'A new chapter', hue: HUES[arcs.length % HUES.length], auto: true, blurb: 'A new chapter has begun. Its story summary has not been written yet.', versions: [entry] });
    log(`${game}: added timeline entry for ${v}`);
  }
  for (const a of arcs) {
    a.versions.sort((x, y) => verKey(x.v) - verKey(y.v));
    a.range = a.versions[0].v + ' to ' + a.versions[a.versions.length - 1].v;
    for (const v of a.versions) v.chars = chars.filter(c => c.ver === v.v).sort((x, y) => y.rarity - x.rarity || x.name.localeCompare(y.name)).map(c => c.id);
  }
}

async function run(game) {
  const dir = path.join(ROOT, 'content', game);
  const content = readJSON(path.join(dir, 'story.json'));
  if (!content) throw new Error('missing content/' + game + '/story.json');
  content.bosses = readJSON(path.join(dir, 'bosses.json'), {});
  const manualNow = readJSON(path.join(dir, 'now.json'), {});
  const prev = (() => { try { const s = fs.readFileSync(path.join(OUT, 'data', game + '.js'), 'utf8'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch { return null; } })();

  let live = null;
  if (!process.env.LORE_NO_LIVE) live = buildLive(game, content.meta.current);
  const d = game === 'wuwa' ? await buildWuwa(content, live?.v) : await buildGenshin(content, live?.v);
  const id = n => d.nameToId[n] || d.nameToId[n?.replace(/^The /, '')];
  const canon = i => (d.chars.find(c => c.id === i)?.same) || i;

  ensureVersions(game, content, d.chars, live);

  // builds and teams
  const builds = parseBuilds(path.join(dir, 'builds.txt'), d.nameToId);
  for (const c of d.chars) { const b = builds[c.id] || builds[c.same]; if (b) c.build = b; }
  const teams = (readJSON(path.join(dir, 'teams.json'), []) || []).map(m => ({ ...m, teams: (m.teams || []).map(t => ({ ...t, chars: t.chars.map(n => id(n) || n) })) }));

  // relationship notes
  const bonds = {};
  for (const [k, v] of Object.entries(content.bonds || {})) {
    const [a, b] = k.split('|').map(n => canon(id(n)));
    if (a && b) bonds[[a, b].sort().join('|')] = v; else warn(game, 'bond with unknown name:', k);
  }

  // current version
  let now = live || prev?.now || null;
  if (now) {
    const mapNames = list => (list || []).map(n => id(n) || n);
    now = { ...now };
    now.newChars = mapNames(now.newChars);
    now.banners = (now.banners || []).map(b => ({ ...b, chars: mapNames(b.chars), four: mapNames(b.four) }));
    now.outfits = (now.outfits || []).map(o => ({ ...o, char: id(o.char) || o.char }));
    if (manualNow.events) now.events = [...now.events, ...manualNow.events];
    if (manualNow.notes) now.notes = manualNow.notes;
    if (manualNow.endgame) now.endgame = manualNow.endgame;
    now.pulls = pullEstimate(game, now, manualNow.pulls);
  }

  const meta = { ...content.meta, current: live?.v || content.meta.current, updated: new Date().toISOString().slice(0, 10) };
  for (const c of d.chars) { for (const k of Object.keys(c)) if (c[k] === undefined || c[k] === '') delete c[k]; }
  const data = { meta, arcs: content.arcs, chars: d.chars, lines: d.lines, bonds, items: d.items, bosses: d.bosses, outfits: d.outfits, now, teams, elements: d.elements, regions: d.regions, labels: d.labels };

  // only touch the file when something other than timestamps changed
  const strip = o => JSON.stringify(o, (k, v) => (k === 'updated' || k === 'fetched' ? undefined : v));
  const file = path.join(OUT, 'data', game + '.js');
  if (prev && strip(prev) === strip(data)) { log(game, 'no changes'); return prev; }
  fs.writeFileSync(file, 'window.LORE_DATA = ' + JSON.stringify(data) + ';\n');
  log(game, 'wrote', path.relative(ROOT, file), (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
  return data;
}

const FACES = {
  wuwa: ['jinhsi', 'shorekeeper', 'cartethyia', 'camellya', 'changli', 'phrolova', 'aemeath', 'rover', 'jiyan', 'carlotta', 'lynae', 'qingxiao', 'zani', 'yinlin', 'iuno', 'lily'],
  genshin: ['furina', 'zhongli', 'raiden_shogun', 'nahida', 'venti', 'mavuika', 'hu_tao', 'columbina', 'arlecchino', 'kaedehara_kazuha', 'neuvillette', 'xiao', 'ganyu', 'klee', 'varka', 'lumine'],
};
const games = process.argv.slice(2).filter(a => !a.startsWith('-'));
const todo = games.length ? games : ['wuwa', 'genshin'];
const summary = readJSON(path.join(OUT, 'data', 'summary.json'), {});
let failed = 0;
for (const g of todo) {
  try {
    const d = await run(g);
    summary[g] = {
      title: d.meta.title, world: d.meta.world, current: d.meta.current, name: d.now?.name || '',
      chars: d.chars.length, lines: d.lines.length, versions: d.arcs.reduce((a, x) => a + x.versions.length, 0),
      faces: FACES[g].filter(i => d.chars.some(c => c.id === i)),
    };
  } catch (e) { failed++; console.error('[update] FAILED', g, e); }
}
fs.writeFileSync(path.join(OUT, 'data', 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'data', 'summary.js'), 'window.LORE_SUMMARY = ' + JSON.stringify(summary) + ';\n');
process.exit(failed === todo.length ? 1 : 0);
