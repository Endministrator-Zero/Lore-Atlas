// "Now" data: the current version's banners, events, outfits and dates.
// Sources: the two Fandom wikis (structured version pages) and the games' own announcement feeds.
import { getJSON, verKey, log, warn } from './util.mjs';

const WIKI = { wuwa: 'wutheringwaves', genshin: 'genshin-impact' };
const DAY = 864e5;

export function wikitext(game, title, maxAgeH = 10) {
  const url = `https://${WIKI[game]}.fandom.com/api.php?action=parse&prop=wikitext&format=json&redirects=1&page=` + encodeURIComponent(title);
  const j = getJSON(url, `wiki/${game}/` + title.replace(/[^\w.-]+/g, '_') + '.json', { optional: true, maxAgeH });
  return j && j.parse ? j.parse.wikitext['*'] : null;
}
const field = (txt, key) => { const m = txt.match(new RegExp('\\|\\s*' + key + '\\s*=\\s*([^\\n|]*)')); return m ? m[1].replace(/<!--.*?-->/g, '').trim() : ''; };
/** "2026-11-12 11:00" in server time (UTC+8) -> ISO string */
function when(s, offset = 8) {
  if (!s) return '';
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/); if (!m) return '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (m[4] ? +m[4] : 11) - offset, +m[5] || 0)).toISOString();
}
/** Strip wiki markup from one line. */
function plain(s) {
  return s.replace(/<!--.*?-->/g, '').replace(/\[\[File:[^\]]*\]\]/g, '')
    .replace(/\{\{[^{}|]*\|([^{}]*)\}\}/g, (_, a) => a.split('|').pop())
    .replace(/\{\{([^{}]*)\}\}/g, '$1')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, (_, a) => a.replace(/\/\d{4}-\d{2}-\d{2}$/, ''))
    .replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
/** Split a version page into { heading: [{depth, text, raw}] } for both wiki layouts. */
function sections(txt) {
  const out = {}; let cur = '';
  for (const line of txt.split('\n')) {
    let m;
    if ((m = line.match(/^(=+)\s*(.+?)\s*=+\s*$/))) { cur = plain(m[2]); out[cur] ??= []; continue; }
    if ((m = line.match(/^;\s*(.+)$/))) { cur = plain(m[1]); out[cur] ??= []; continue; }
    if ((m = line.match(/^(\*+)\s*(.+)$/)) && cur) out[cur].push({ depth: m[1].length, text: plain(m[2]), raw: m[2] });
  }
  return out;
}
const linkDate = raw => { const m = raw.match(/\/(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; };
const inParens = text => { const m = text.match(/\(([^)]*)\)\s*$/); return m ? m[1].split(/,|&| and /).map(s => s.trim()).filter(Boolean) : []; };
const noParens = text => text.replace(/\s*\([^)]*\)\s*$/, '').trim();

function parseVersion(game, v, opt = {}) {
  const txt = wikitext(game, 'Version/' + v, opt.maxAgeH || 10);
  if (!txt) return null;
  const S = sections(txt);
  const info = { v, name: field(txt, 'title'), start: when(field(txt, 'date')), end: when(field(txt, 'date_end')), expected: when(field(txt, 'expected')), next: field(txt, 'next') };
  const list = (h, depth = 1) => (S[h] || []).filter(x => x.depth === depth).map(x => x.text);
  if (game === 'wuwa') {
    info.newChars = list('Resonators');
    info.newWeapons = list('Weapons');
    info.outfits = list('Resonator Outfits').map(s => ({ name: noParens(s), char: inParens(s)[0] || '' }));
    info.banners = [
      ...(S['Character Event Convenes'] || []).map(x => ({ name: noParens(x.text), kind: /Reverb/i.test(x.text) ? 'rerun' : 'char', date: linkDate(x.raw), chars: inParens(x.text), weapons: [] })),
      ...(S['Weapon Event Convenes'] || []).map(x => ({ name: noParens(x.text), kind: /Reverb/i.test(x.text) ? 'rerun' : 'weapon', date: linkDate(x.raw), chars: [], weapons: inParens(x.text).length ? inParens(x.text) : [noParens(x.text).replace(/^Absolute Pulsation:\s*/, '')] })),
    ];
    info.quests = (S['Main Quests'] || []).map(x => x.text).reduce((acc, s, i, arr) => { if (/^Chapter/.test(s)) acc.chapter = s; else acc.out.push((acc.chapter ? acc.chapter + ' ' : '') + s.replace(' - ', ': ')); return acc; }, { out: [], chapter: '' }).out;
    info.events = list('Events').concat(list('Tactical Hologram'));
    info.areas = [];
    const locIdx = txt.indexOf('===Locations===');
    if (locIdx >= 0) {
      const rest = txt.slice(locIdx + 15); const stop = rest.search(/\n={2,3}[^=]/);
      const part = stop > 0 ? rest.slice(0, stop) : rest;
      info.areas = [...part.matchAll(/^\*+\s*(.+)$/gm)].map(m => plain(m[1]));
    }
    // convene pages carry exact start and end times
    for (const b of opt.light ? [] : info.banners) {
      const page = wikitext(game, b.date ? `${b.name}/${b.date}` : b.name);
      if (page) { b.start = when(field(page, 'time_start')); b.end = when(field(page, 'time_end')); }
      if (!b.start && b.date) b.start = when(b.date + ' 11:00');
    }
  } else {
    info.newChars = list('New Characters').map(s => (s.match(/"\s*([A-Z][^("]*?)\s*\(/) || [])[1] || noParens(s).replace(/^"[^"]*"\s*/, ''));
    info.newWeapons = list('New Weapons').map(noParens);
    info.outfits = (S['New Outfits'] || S['New Character Outfits'] || []).filter(x => x.depth === 1).map(x => ({ name: noParens(x.text).replace(/^"|"$/g, ''), char: (inParens(x.text)[0] || '').replace(/^for /, '') }));
    info.banners = []; let phase = '', last = null;
    for (const x of S['Event Wishes'] || []) {
      if (x.depth === 1) { phase = x.text; continue; }
      if (x.depth === 2) {
        const who = inParens(x.text); const chron = /Chronicled/i.test(x.text);
        last = { name: noParens(x.text), kind: chron ? 'chronicle' : 'char', date: linkDate(x.raw), phase, chars: chron ? [] : who, weapons: [] };
        info.banners.push(last);
      } else if (x.depth === 3 && last) {
        const m = x.text.match(/^(Characters|Weapons):\s*(.+)$/);
        if (m) last[m[1] === 'Characters' ? 'chars' : 'weapons'] = m[2].split(',').map(s => s.trim());
      }
    }
    for (const b of info.banners) if (b.date) b.start = when(b.date + ' 11:00');
    const q = []; let ch = '';
    for (const x of S['New Quests'] || []) {
      if (x.depth === 1 && !/Archon/.test(x.text)) break;
      if (x.depth === 2) { ch = x.text; if (/(Act [IVXL]+|Prologue|Interlude)\s*[-–:]/.test(x.text)) q.push(x.text); }
      if (x.depth === 3) q.push(ch + ' ' + x.text);
    }
    info.quests = q;
    info.events = list('New Events');
    info.areas = (S['New Areas'] || []).filter(x => x.depth === 2).map(x => x.text);
  }
  return info;
}

/** Find the live version and any announced next one, starting from the last version the site knows. */
function discover(game, known) {
  let cur = null, next = null, v = known, guard = 0;
  const now = Date.now();
  while (guard++ < 12) {
    const info = parseVersion(game, v);
    if (!info) break;
    if (info.start && Date.parse(info.start) <= now) cur = info; else { next = info; break; }
    const [a, b] = v.split('.').map(Number);
    const cands = info.next ? [info.next] : [`${a}.${b + 1}`, `${a + 1}.0`];
    let moved = false;
    for (const c of cands) { if (c !== v && wikitext(game, 'Version/' + c)) { v = c; moved = true; break; } }
    if (!moved) break;
  }
  return { cur, next };
}

function wuwaFeed() {
  const j = getJSON('https://aki-gm-resources-back.aki-game.net/gamenotice/G153/6eb2a235b30d05efd77bedb5cf60999e/en.json', 'live/ww_notice.json', { optional: true, maxAgeH: 3 });
  if (!j) return [];
  const out = [];
  for (const k of ['game', 'recommend', 'activity']) for (const x of j[k] || []) {
    const raw = typeof x.tabTitle === 'object' ? (x.tabTitle.en || Object.values(x.tabTitle)[0]) : x.tabTitle;
    const title = String(raw || '').replace(/\s+/g, ' ').trim();
    const name = (title.match(/^\[([^\]]+)\]/) || [])[1] || title;
    out.push({ title, name: name.replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III'), label: title.replace(/^\[[^\]]+\]\s*/, ''), start: new Date(x.startTimeMs).toISOString(), end: new Date(x.endTimeMs).toISOString(), permanent: !!x.permanent });
  }
  return out;
}
function genshinFeed() {
  const j = getJSON('https://api.ennead.cc/mihoyo/genshin/calendar', 'live/gi_calendar.json', { optional: true, maxAgeH: 3 });
  const iso = s => s ? new Date(s * 1000).toISOString() : '';
  if (!j) return null;
  return {
    events: (j.events || []).map(e => ({ name: e.name, start: iso(e.start_time), end: iso(e.end_time), type: e.type_name })),
    banners: (j.banners || []).map(b => ({ name: b.name, start: iso(b.start_time), end: iso(b.end_time), chars: (b.characters || []).map(c => ({ name: c.name, rarity: c.rarity })), weapons: (b.weapons || []).map(w => w.name) })),
    challenges: (j.challenges || []).map(c => ({ name: c.name, start: iso(c.start_time), end: iso(c.end_time) })),
  };
}
function genshinOfficial() {
  const j = getJSON('https://sg-hk4e-api.hoyoverse.com/common/hk4e_global/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_global&lang=en&bundle_id=hk4e_global&platform=pc&region=os_usa&level=55&uid=100000000', 'live/gi_ann.json', { optional: true, maxAgeH: 3 });
  const out = [];
  for (const grp of j?.data?.list || []) for (const a of grp.list || []) out.push({ title: (a.subtitle || a.title || '').replace(/<[^>]+>/g, ''), start: when(a.start_time), end: when(a.end_time) });
  return out;
}

export function buildLive(game, knownVersion) {
  let found;
  try { found = discover(game, knownVersion); } catch (e) { warn(game, 'live discovery failed:', e.message); return null; }
  const { cur, next } = found;
  if (!cur) { warn(game, 'no live version page found'); return null; }
  const now = { ...cur, challenges: [], sources: ['wiki'] };
  delete now.expected; delete now.next;
  if (!now.end) now.end = next && (next.start || next.expected) ? (next.start || next.expected) : new Date(Date.parse(now.start) + 42 * DAY).toISOString();
  if (next) now.upcoming = { v: next.v, name: next.name || '', start: next.start || next.expected || '' };
  let events = (cur.events || []).map(name => ({ name: name.replace(/\/\d{4}-\d{2}-\d{2}$/, ''), start: '', end: '', kind: '' }));

  if (game === 'wuwa') {
    const feed = wuwaFeed();
    if (feed.length) now.sources.push('official notices');
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    for (const b of now.banners) {
      const f = feed.find(x => /Convene/i.test(x.label) && (norm(x.name) === norm(b.name) || norm(b.name).endsWith(norm(x.name))));
      if (f) { b.start ||= f.start; b.end ||= f.end; }
    }
    for (const e of events) { const f = feed.find(x => norm(x.name) === norm(e.name)); if (f) { e.start = f.start; e.end = f.end; e.kind = f.label; } }
    for (const f of feed) {
      if (/Convene|Patch Notes|Known Issues|Policy|Community|Bundles|Offer|Podcast|Feature Details/i.test(f.title) || f.permanent) continue;
      if (!events.some(e => norm(e.name) === norm(f.name))) events.push({ name: f.name, start: f.start, end: f.end, kind: f.label });
    }
  } else {
    const cal = genshinFeed();
    // event pages on the wiki carry exact times and the event type
    for (const e of events) {
      const page = wikitext(game, e.name);
      if (!page) continue;
      e.start = when(field(page, 'time_start')); e.end = when(field(page, 'time_end'));
      const grp = field(page, 'group'); if (grp) e.kind = grp;
      const reward = field(page, 'rewardType'); if (reward) e.reward = reward;
    }
    if (cal) {
      // the calendar feed uses a different clock base; line it up with the wiki's version start
      const firstStart = Math.min(...cal.banners.map(b => Date.parse(b.start)).filter(Boolean));
      const shift = Number.isFinite(firstStart) ? Date.parse(now.start) - firstStart : 0;
      if (shift && Math.abs(shift) < 26 * 36e5) {
        const fix = t => t ? new Date(Date.parse(t) + shift).toISOString() : t;
        for (const k of ['events', 'banners', 'challenges']) for (const x of cal[k]) { x.start = fix(x.start); x.end = fix(x.end); }
      }
      now.sources.push('HoYoLAB calendar');
      now.challenges = cal.challenges;
      for (const e of cal.events) {
        const hit = events.find(x => x.name.toLowerCase() === e.name.toLowerCase());
        if (hit) { hit.start ||= e.start; hit.end ||= e.end; }
        else events.push({ name: e.name, start: e.start, end: e.end, kind: /Hard|Tower|RoleCombat/.test(e.type || '') ? 'Challenge' : '' });
      }
      const live = cal.banners.filter(b => b.chars.length);
      for (const b of now.banners) {
        if (b.kind !== 'char') continue;
        const five = b.chars[0];
        const hit = live.find(x => x.chars.some(c => c.rarity === 5 && c.name === five));
        if (hit) { b.start = hit.start; b.end = hit.end; b.four = hit.chars.filter(c => c.rarity === 4).map(c => c.name); b.chars = [five]; }
        else b.chars = b.chars.slice(0, 1);
      }
      const wb = cal.banners.find(b => b.weapons.length);
      if (wb) now.banners.push({ name: 'Epitome Invocation', kind: 'weapon', start: wb.start, end: wb.end, chars: [], weapons: wb.weapons.slice(0, 2), phase: 'Phase I' });
    }
    if (!cal) { const ann = genshinOfficial(); if (ann.length) now.sources.push('official notices'); for (const e of events) { const f = ann.find(a => a.title.includes(e.name)); if (f) { e.start ||= f.start; e.end ||= f.end; } } }
  }
  // phases: fill missing banner ends from the next banner start or the version end
  const starts = [...new Set(now.banners.map(b => b.start).filter(Boolean))].sort();
  for (const b of now.banners) {
    if (!b.start) b.start = now.start;
    if (!b.end) { const nx = starts.find(s => s > b.start); b.end = b.kind === 'rerun' || !nx ? now.end : nx; }
  }
  now.events = events.sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
  now.fetched = new Date().toISOString();
  log(`${game}: live version ${now.v} "${now.name}", ${now.banners.length} banners, ${now.events.length} events` + (now.upcoming ? `, next ${now.upcoming.v}` : ''));
  return now;
}

/** Facts about one version for a timeline stub (used when the site has no written entry yet). */
export function versionFacts(game, v, opt = { light: true }) { try { return parseVersion(game, v, opt); } catch { return null; } }

/** An act page on the wiki: its official description and the names of its quests. */
export function actPage(game, title, maxAgeH = 24 * 14) {
  const txt = wikitext(game, title, maxAgeH);
  if (!txt) return null;
  let desc = field(txt, 'description');
  const d = txt.match(/\{\{(?:Quest )?Description\|([^}]*)\}\}/);
  if (!desc && d) desc = d[1];
  desc = plain(String(desc || '').replace(/<br\s*\/?>/g, ' '));
  const sec = txt.match(/==\s*(?:Quests|List of Parts|Parts)\s*==\n([\s\S]*?)(?:\n==|$)/);
  const quests = sec ? [...sec[1].matchAll(/^[#*]+\s*(.+)$/gm)].map(m => plain(m[1])).filter(Boolean) : [];
  return { desc, quests };
}
export { plain };
export { verKey };
