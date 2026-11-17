// Genshin Impact: characters and materials from genshin-db, voice lines from the public data dump.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { get, getMany, toWebp, clean, dedupeLines, gslug, verKey, log, warn, CACHE, OUT } from './util.mjs';

const require = createRequire(import.meta.url);
const DATA = 'https://raw.githubusercontent.com/DimbreathBot/AnimeGameData/master/';
const PAIMON = 'https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/static/images/';
const TWINS = 'https://raw.githubusercontent.com/FortOfFans/GI/main/Cards/';
const REGFIX = { Zibai: 'Liyue', Nicole: 'Beyond', Skirk: 'Beyond', Aloy: 'Beyond', Aether: 'Beyond', Lumine: 'Beyond' };
const SKIP = new Set(['Manekin', 'Manekina']);
const SAME = { lumine: 'aether' };

export async function buildGenshin(content, autoVer) {
  log('genshin: loading game data');
  const g = require('genshin-db');
  const opt = { matchAliases: false, matchCategories: false };
  const names = g.characters('names', { matchCategories: true }).filter(n => !SKIP.has(n));

  // ----- characters -----
  const chars = [], nameToId = {}, idOfAvatar = {}, db = {};
  for (const n of names) {
    const c = g.characters(n, opt); if (!c) continue;
    const id = gslug(n); db[id] = c; nameToId[n] = id; idOfAvatar[c.id] = id;
    const cur = content.chars[n] || {};
    const twin = n === 'Aether' || n === 'Lumine';
    let aff = (c.affiliation || '').replace(/^"|"$/g, ''); if (aff === 'None' || aff === '——') aff = '';
    chars.push({
      id, name: n, tag: '', title: twin ? 'Outlander' : (c.title || '').replace(/^"|"$/g, ''),
      el: twin || c.elementText === 'None' ? '' : c.elementText, weapon: c.weaponText, rarity: c.rarity,
      region: cur.region || REGFIX[n] || c.region || 'Beyond', faction: aff, birthday: twin ? '' : (c.birthday || ''),
      extra: c.constellation || '', ver: c.version || autoVer || '?',
      lore: cur.lore || clean(c.description) || 'Profile coming soon.', auto: !cur.lore || undefined, same: SAME[id],
    });
  }
  nameToId['Traveler'] = 'aether';
  const byId = Object.fromEntries(chars.map(c => [c.id, c]));
  const canon = id => SAME[id] || id;

  // ----- voice lines -----
  let lines = [];
  try { lines = voiceLines(content, chars, nameToId, idOfAvatar, canon); }
  catch (e) { warn('genshin: voice lines unavailable:', e.message); }

  // ----- materials -----
  const items = {}, itemName = {};
  const add = (m, list, mult = 1) => { for (const x of list || []) { m.set(x.id, (m.get(x.id) || 0) + x.count * mult); itemName[x.id] = x.name; } };
  const order = m => [...m].sort((a, b) => (rar(b[0]) - rar(a[0])) || a[0] - b[0]);
  const matCache = {};
  const mat = id => (matCache[id] ??= g.materials(itemName[id], opt) || {});
  const rar = id => id === 202 ? 0 : (mat(id).rarity || 1);
  const weeklyUse = new Map(), bossUse = new Map();
  for (const c of chars) {
    const d = db[c.id];
    const asc = new Map(), sk = new Map();
    for (let i = 1; i <= 6; i++) add(asc, d.costs?.['ascend' + i]);
    const tal = g.talents(c.name, opt);
    const early = new Set(), late = new Set();
    if (tal?.costs) for (let i = 2; i <= 10; i++) { add(sk, tal.costs['lvl' + i], 3); for (const x of tal.costs['lvl' + i] || []) (i < 7 ? early : late).add(x.id); }
    c.mats = { a: order(asc), s: order(sk) };
    if (c.same) continue;
    for (const id of late) {
      if (early.has(id) || id === 202 || /Crown of Insight/.test(itemName[id]) || rar(id) < 5) continue;
      if (!weeklyUse.has(id)) weeklyUse.set(id, []); weeklyUse.get(id).push(c.id);
    }
    for (const [id, n] of asc) {
      const src = (mat(id).sources || []).join(' ');
      if (n >= 40 && n <= 50 && /Dropped by|Challenge Reward|Lv\. \d+\+/.test(src) && !/Found in the wild|Sold by/.test(src)) { if (!bossUse.has(id)) bossUse.set(id, []); bossUse.get(id).push(c.id); }
    }
  }
  for (const id of Object.keys(itemName)) {
    const m = mat(id);
    items[id] = { n: itemName[id], r: +id === 202 ? 3 : (m.rarity || 1) };
    if (m.daysOfWeek) items[id].d = m.daysOfWeek.map(x => x.slice(0, 3));
    if (m.dropDomainName) items[id].src = m.dropDomainName.replace(/^Domain of Mastery: /, '');
  }
  const bossName = id => {
    const s = (mat(id).sources || [])[0] || '';
    const m = s.match(/Lv\. \d+\+ (.+?) Challenge Reward/) || s.match(/Dropped by Lv\. \d+\+ (.+)/) || s.match(/(.+?) Challenge Reward/);
    return m ? m[1].replace(/\s+$/, '') : '';
  };
  const bossMap = new Map();
  const put = (use, weekly) => {
    for (const [id, list] of use) {
      const name = bossName(id); if (!name) continue;
      items[id].src = name;
      const key = name + (weekly ? '|w' : '|o');
      if (!bossMap.has(key)) bossMap.set(key, { name, weekly, drops: [] });
      bossMap.get(key).drops.push({ item: +id, chars: list });
    }
  };
  put(weeklyUse, true); put(bossUse, false);
  const notes = content.bosses || {};
  const first = b => Math.min(...b.drops.flatMap(d => d.chars.map(i => verKey(byId[i].ver))));
  const bosses = [...bossMap.values()].map(b => ({ ...b, note: notes[b.name] || '' })).sort((a, b) => (b.weekly - a.weekly) || first(a) - first(b));

  // ----- outfits -----
  const outfits = [];
  try {
    for (const n of g.outfits('names', { matchCategories: true })) {
      const o = g.outfits(n, opt); if (!o || o.isDefault || o.isdefault) continue;
      const id = nameToId[o.characterName || o.character]; if (id) outfits.push({ name: o.name, char: id });
    }
  } catch {}

  // ----- weapons -----
  const weaponIndex = {};
  for (const n of g.weapons('names', { matchCategories: true })) {
    const w = g.weapons(n, opt); if (!w || w.rarity < 3) continue;
    let st = {}; try { st = w.stats(90, '+') || {}; } catch {}
    const pct = w.mainStatType && w.mainStatType !== 'FIGHT_PROP_ELEMENT_MASTERY';
    let passive = w.effectTemplateRaw || '';
    ((w.r1 && w.r1.values) || []).forEach((v, i) => { passive = passive.split('{' + i + '}').join(v); });
    weaponIndex[gslug(w.name)] = {
      n: w.name, r: w.rarity, type: w.weaponText, atk: Math.round(st.attack || 0),
      sub: w.mainStatText || '', subv: w.mainStatText ? (pct ? (st.specialized * 100).toFixed(1) + '%' : String(Math.round(st.specialized || 0))) : '',
      pn: w.effectName || '', p: clean(passive),
    };
  }
  const weaponImages = async list => {
    const jobs = [], conv = [];
    for (const w of list) {
      const dest = path.join(OUT, 'img/genshin/weapons', gslug(w.n) + '.webp'); if (fs.existsSync(dest)) continue;
      const slug = w.n.toLowerCase().replace(/['’"“”]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const tmp = path.join(CACHE, 'img/gi', 'w_' + slug + '.png');
      jobs.push({ url: PAIMON + 'weapons/' + slug + '.png', file: tmp }); conv.push([tmp, dest]);
    }
    if (!jobs.length) return;
    log('genshin: fetching', jobs.length, 'weapon images');
    getMany(jobs);
    for (const [tmp, dest] of conv) await toWebp(tmp, dest, { w: 128, q: 86 });
  };

  await images(chars, items);
  for (const c of chars) c.art = fs.existsSync(path.join(OUT, 'img/genshin/art', c.id + '.webp'));
  for (const id of Object.keys(items)) items[id].i = fs.existsSync(path.join(OUT, 'img/genshin/items', id + '.webp')) ? 1 : 0;

  log(`genshin: ${chars.length} characters, ${lines.length} lines, ${Object.keys(items).length} items, ${bosses.length} bosses`);
  return {
    chars, lines, items, bosses, outfits, nameToId, weaponIndex, weaponImages, slug: gslug,
    elements: ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'],
    regions: ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Snezhnaya', 'Beyond'],
    labels: { extra: 'Constellation', title: 'Title', faction: 'Affiliation', region: 'Nation', weapon: 'Weapon', el: 'Vision', asc: 'Ascension to level 90', skill: 'All three talents to level 10', boss: 'Weekly boss' },
  };
}

function voiceLines(content, chars, nameToId, idOfAvatar, canon) {
  const T = JSON.parse(fs.readFileSync(get(DATA + 'TextMap/TextMapEN.json', 'gi/TextMapEN.json'), 'utf8'));
  const med = get(DATA + 'TextMap/TextMap_MediumEN.json', 'gi/TextMap_MediumEN.json', { optional: true });
  if (med) Object.assign(T, JSON.parse(fs.readFileSync(med, 'utf8')));
  const t = h => T[String(h)] || '';
  const fetters = JSON.parse(fs.readFileSync(get(DATA + 'ExcelBinOutput/FettersExcelConfigData.json', 'gi/Fetters.json'), 'utf8'));
  const aliases = content.aliases || {};
  // name tokens for matching free-form Traveler line titles
  const count = {};
  for (const c of chars) for (const w of c.name.split(' ')) count[w] = (count[w] || 0) + 1;
  const tokens = [];
  for (const c of chars) {
    if (c.id === 'aether' || c.id === 'lumine') continue;
    tokens.push([c.name, c.id]);
    for (const w of c.name.split(' ')) if (w.length >= 4 && count[w] === 1 && w !== 'Shogun' && w !== c.name) tokens.push([w, c.id]);
  }
  const raw = [], toTraveler = {};
  for (const f of fetters) {
    let id = idOfAvatar[f.avatarId]; if (!id) continue;
    const title = clean(t(f.voiceTitleTextMapHash)), text = t(f.voiceFileTextTextMapHash);
    if (!title.startsWith('About ') || !text) continue;
    const rest = title.slice(6);
    if (id === 'aether' || id === 'lumine') {
      if (id === 'lumine') continue; // the twins share the same lines
      const hits = new Set();
      for (const [tok, tid] of tokens) if (new RegExp('(^|[^A-Za-z])' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z]|$)').test(rest)) hits.add(tid);
      const al = nameToId[aliases[rest]]; if (al) hits.add(al);
      for (const tid of hits) raw.push({ f: 'aether', t: canon(tid), s: hits.size > 1 || rest !== chars.find(c => c.id === tid).name ? rest : '', q: text });
      continue;
    }
    if (/^Us\b/.test(rest)) { if (!toTraveler[id]) toTraveler[id] = { f: id, t: 'aether', s: rest.replace(/^Us:?\s*/, ''), q: text }; continue; }
    const i = rest.indexOf(':');
    const base = (i > 0 ? rest.slice(0, i) : rest).trim(), sub = i > 0 ? rest.slice(i + 1).trim() : '';
    const tgt = nameToId[base] || nameToId[aliases[base]];
    if (!tgt || tgt === 'aether') continue;
    raw.push({ f: id, t: canon(tgt), s: sub, q: text });
  }
  for (const l of Object.values(toTraveler)) raw.push(l);
  return dedupeLines(raw);
}

async function images(chars, items) {
  const dir = n => path.join(OUT, 'img/genshin', n);
  const jobs = [], conv = [];
  const want = (url, tmpName, dest, o) => { if (fs.existsSync(dest)) return; const tmp = path.join(CACHE, 'img/gi', tmpName); jobs.push({ url, file: tmp }); conv.push([tmp, dest, o]); };
  for (const c of chars) {
    if (c.id === 'aether' || c.id === 'lumine') { want(TWINS + (c.id === 'aether' ? 'UI_AvatarIcon_PlayerBoy.png' : 'UI_AvatarIcon_PlayerGirl.png'), c.id + '.png', path.join(dir('icons'), c.id + '.webp'), { w: 176, q: 88 }); continue; }
    want(PAIMON + 'characters/' + c.id + '.png', 'c_' + c.id + '.png', path.join(dir('icons'), c.id + '.webp'), { q: 90 });
    want(PAIMON + 'characters/full/' + c.id + '.png', 'f_' + c.id + '.png', path.join(dir('art'), c.id + '.webp'), { w: 800, q: 78 });
  }
  for (const [id, it] of Object.entries(items)) {
    const slug = it.n.toLowerCase().replace(/['’"“”]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    want(PAIMON + 'items/' + slug + '.png', 'i_' + slug + '.png', path.join(dir('items'), id + '.webp'), { w: 96, q: 86 });
  }
  if (!jobs.length) return;
  log('genshin: fetching', jobs.length, 'new images');
  getMany(jobs);
  for (const [tmp, dest, o] of conv) await toWebp(tmp, dest, o);
}
