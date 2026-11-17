// Main story detail for every version: acts, the quests inside each act and their official descriptions,
// plus a short "what else came with this version" block (areas, events, featured characters, weapons).
import fs from 'node:fs';
import { get, getJSON, clean, verKey, log, warn } from './util.mjs';
import { versionFacts, actPage } from './live.mjs';

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const DESC_MAX = 320;
const cut = t => { t = clean(t); return t.length > DESC_MAX ? t.slice(0, DESC_MAX).replace(/\s+\S*$/, '') + '…' : t; };

// ---------------- acts from game data ----------------
function wuwaActs() {
  const D = 'https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/master/BinData/';
  const textFile = get('https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/master/Textmaps/en/multi_text/MultiText.json', 'ww/MultiText.json');
  const T = new Map(); for (const x of JSON.parse(fs.readFileSync(textFile, 'utf8'))) T.set(x.Id, x.Content);
  const t = k => T.get(k) || '';
  const quests = (getJSON(D + 'QuestData/questdata.json', 'ww/QuestData_questdata.json', { optional: true }) || []).map(q => q.Data).filter(q => q.Type === 1 && q.ChapterId);
  const byChapter = new Map();
  for (const q of quests) { if (!byChapter.has(q.ChapterId)) byChapter.set(q.ChapterId, []); byChapter.get(q.ChapterId).push(q); }
  const acts = [];
  for (const [cid, list] of [...byChapter].sort((a, b) => a[0] - b[0])) {
    if (cid >= 1000) continue; // side and event stories
    const k = 'QuestChapter_' + cid + '_';
    const pick = n => t(k + n) || t(k + n + '_new');
    const title = clean(pick('ActName') || pick('ChapterName'));
    if (!title) continue;
    // order quests by their prerequisite chain
    const ids = new Set(list.map(q => q.Id)), pre = q => ((q.ProvideType?.Conditions || []).find(c => c.Type === 'PreQuest') || {}).PreQuest;
    const ordered = [], left = list.slice().sort((a, b) => a.Id - b.Id);
    let cur = left.find(q => !ids.has(pre(q))) || left[0];
    while (cur) { ordered.push(cur); left.splice(left.indexOf(cur), 1); cur = left.find(q => pre(q) === ordered[ordered.length - 1].Id) || left[0]; }
    acts.push({
      key: norm(title), title, label: [clean(pick('ChapterNum')), clean(pick('SectionNum'))].filter(Boolean).join(' · '), chapter: clean(pick('ChapterName')),
      parts: ordered.map(q => ({ t: clean(t(q.TidName)), d: cut(t(q.TidDesc)) })).filter(p => p.t),
    });
  }
  return acts;
}

function genshinActs() {
  const D = 'https://raw.githubusercontent.com/DimbreathBot/AnimeGameData/master/';
  const T = JSON.parse(fs.readFileSync(get(D + 'TextMap/TextMapEN.json', 'gi/TextMapEN.json'), 'utf8'));
  const med = get(D + 'TextMap/TextMap_MediumEN.json', 'gi/TextMap_MediumEN.json', { optional: true });
  if (med) Object.assign(T, JSON.parse(fs.readFileSync(med, 'utf8')));
  const t = h => T[String(h)] || '';
  const chapters = getJSON(D + 'ExcelBinOutput/ChapterExcelConfigData.json', 'gi/Chapter.json', { optional: true }) || [];
  const mains = getJSON(D + 'ExcelBinOutput/MainQuestExcelConfigData.json', 'gi/MainQuest.json', { optional: true }) || [];
  const acts = [];
  for (const c of chapters) {
    if (c.questType !== 'AQ') continue;
    const title = clean(t(c.chapterTitleTextMapHash)); if (!title) continue;
    const parts = mains.filter(m => m.chapterId === c.id).map(m => ({ t: clean(t(m.titleTextMapHash)), d: cut(t(m.descTextMapHash)) })).filter(p => p.t);
    acts.push({ key: norm(title), title, label: clean(t(c.chapterNumTextMapHash)), parts });
  }
  return acts;
}

// ---------------- matching acts to versions ----------------
export function buildStory(game, arcs, chars, nameToId, current) {
  let acts = [];
  try { acts = game === 'wuwa' ? wuwaActs() : genshinActs(); } catch (e) { warn(game, 'story acts unavailable:', e.message); }
  const byKey = new Map(acts.map(a => [a.key, a]));
  const versions = arcs.flatMap(a => a.versions);
  const used = new Set();
  let n = 0;
  for (const v of versions) {
    const past = verKey(v.v) < verKey(current);
    const f = versionFacts(game, v.v, { light: true, maxAgeH: past ? 24 * 30 : 10 }) || {};
    if (!f.v && !v.quests) continue;
    const detail = {};
    // main story acts named on the version page
    const story = [], partNames = new Set();
    for (const q of v.quests || f.quests || []) {
      const name = q.replace(/^.*?(?:Act [IVXL]+|Prologue|Segue|Overture|Interlude|Side Story)\s*[:\-–]\s*/i, '').replace(/\s*\(.*\)$/, '').trim();
      if (!name || name.length > 80 || /adjust|remove|optimi|requirement/i.test(q) || partNames.has(norm(name))) continue;
      const label = q.slice(0, q.length - name.length).replace(/[\s:\-–]+$/, '').trim();
      let act = byKey.get(norm(name));
      if (act && used.has(act.key + v.v)) continue;
      if (!act) {
        const w = actPage(game, name, past ? 24 * 30 : 10);
        act = { title: name, label, parts: (w?.quests || []).map(x => ({ t: x, d: '' })), desc: w?.desc || '' };
        if (!act.parts.length && !act.desc) { story.push({ title: name, label, parts: [] }); continue; }
      } else {
        used.add(act.key + v.v);
        if (!act.desc) { const w = actPage(game, act.title, past ? 24 * 30 : 10); if (w?.desc) act.desc = w.desc; }
      }
      story.push({ title: act.title, label: (act.label || '').length > (label || '').length ? act.label : label, desc: act.desc ? cut(act.desc) : '', parts: act.parts });
      for (const p of act.parts) partNames.add(norm(p.t));
    }
    // a version named after its own act (for example Wuthering Waves 1.1, Thaw of Eons)
    if (!story.length && byKey.has(norm(v.name))) { const a = byKey.get(norm(v.name)); story.push({ title: a.title, label: a.label, desc: '', parts: a.parts }); }
    if (story.length) detail.story = story;
    if (f.areas?.length) detail.areas = f.areas.slice(0, 8);
    const events = (f.events || []).map(e => e.replace(/\s*\(Event\)$/, '')).filter(e => !/^(Optimized|Adjusted)/.test(e));
    if (events.length) detail.events = events.slice(0, 10);
    const five = [];
    for (const b of f.banners || []) for (const c of b.chars || []) { const id = nameToId[c]; if (id && !five.includes(id)) five.push(id); }
    if (five.length) detail.featured = five.slice(0, 12);
    const weapons = (f.newWeapons || []).map(w => w.replace(/\s*\(?\d-Star\b.*$/i, '').trim()).filter(w => w.length < 40 && !/[.,]|Wish|Event|Forgeable|Battle Pass|Traveler|Quest/.test(w));
    if (weapons.length) detail.weapons = weapons.slice(0, 10);
    if (Object.keys(detail).length) { v.detail = detail; n++; }
  }
  log(`${game}: story detail for ${n} versions (${acts.length} acts in game data)`);
}
