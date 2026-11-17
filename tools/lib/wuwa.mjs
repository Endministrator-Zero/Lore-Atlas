// Wuthering Waves: characters, voice lines, materials and bosses from the public data dump.
import fs from 'node:fs';
import path from 'node:path';
import { get, getJSON, getMany, repoFiles, repoBranches, toWebp, clean, dedupeLines, wslug, verKey, log, warn, CACHE, OUT } from './util.mjs';

const DATA = 'https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/master/';
const ASSETS = '555me/Wuthering-Waves-GameAssets';
const EL = { 1: 'Glacio', 2: 'Fusion', 3: 'Electro', 4: 'Aero', 5: 'Spectro', 6: 'Havoc' };
const WP = { 1: 'Broadblade', 2: 'Sword', 3: 'Pistols', 4: 'Gauntlets', 5: 'Rectifier' };
const SAME = { 'yangyang-xuanling': 'yangyang', 'rover-m': 'rover' };

const bin = (p, opt) => getJSON(DATA + 'BinData/' + p, 'ww/' + p.replace(/\//g, '_'), opt);

export async function buildWuwa(content, autoVer) {
  log('wuwa: loading game data');
  const textFile = get(DATA + 'Textmaps/en/multi_text/MultiText.json', 'ww/MultiText.json');
  const T = new Map();
  for (const x of JSON.parse(fs.readFileSync(textFile, 'utf8'))) T.set(x.Id, x.Content);
  const t = k => T.get(k) || '';
  const roles = bin('role/roleinfo.json').filter(r => r.RoleType === 1 && !r.IsTrial);
  const favor = Object.fromEntries(bin('favor/favorroleinfo.json').map(x => [x.RoleId, x]));
  const words = bin('favor/favorword.json').sort((a, b) => a.Sort - b.Sort);
  const breach = bin('role_level/rolebreach.json');
  const skills = bin('skill/skill.json');
  const skillLevels = bin('skill/skilllevel.json');
  const tree = bin('skillTree/skilltree.json');
  const itemInfo = Object.fromEntries(bin('item/iteminfo.json').map(x => [x.Id, x]));
  const skins = bin('role/roleskin.json', { optional: true }) || [];
  const readme = fs.readFileSync(get(DATA + 'README.md', 'ww/README.md', { optional: true }) || '/dev/null', 'utf8');
  const dataVersion = (readme.match(/Game Version:\s*(\d+\.\d+)/) || [])[1] || '';

  // ----- characters -----
  const chars = [], roleOf = {}, nameToId = {}, idOfRole = {};
  const rover = { els: new Set() };
  for (const r of roles) {
    const raw = t(r.Name), f = favor[r.Id] || {};
    const isRover = raw.startsWith('Rover');
    const sex = clean(t(f.Sex));
    const id = isRover ? (sex === 'Male' ? 'rover-m' : 'rover') : wslug(raw);
    idOfRole[r.Id] = id;
    if (isRover) rover.els.add(EL[r.ElementId]);
    if (roleOf[id]) continue;
    roleOf[id] = r;
    const name = isRover ? 'Rover' : raw;
    const cur = content.chars[name] || {};
    let fac = clean(t(f.Influence));
    const former = /<s>/.test(t(f.Influence));
    fac = fac.replace(/^"|"$/g, '');
    if (former) fac += ' (former)';
    if (fac === 'Unknown') fac = '';
    if (cur.faction != null) fac = cur.faction;
    if (isRover) fac = 'The Black Shores';
    const bd = clean(t(f.Birthday));
    const info = clean(t(f.Info));
    chars.push({
      id, name, tag: isRover ? (sex || '') : '', title: isRover ? '' : clean(t(f.TalentName)),
      el: isRover ? '' : EL[r.ElementId], weapon: WP[r.WeaponType] || '', rarity: r.QualityId,
      region: cur.region || 'Unknown', faction: fac, birthday: bd === 'Unknown' ? '' : bd, extra: '',
      ver: cur.ver || autoVer || dataVersion || '?', lore: cur.lore || info.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') || 'Profile coming soon.',
      auto: !cur.lore || undefined, same: SAME[id],
    });
    if (!isRover) nameToId[raw] = id;
  }
  nameToId['Rover'] = 'rover';
  for (const c of chars) if (c.id.startsWith('rover')) c.extra = [...rover.els].join(' · ');
  const byId = Object.fromEntries(chars.map(c => [c.id, c]));
  const canon = id => SAME[id] || id;

  // ----- voice lines -----
  const raw = [];
  const order = roles.slice().sort((a, b) => (idOfRole[a.Id] === 'yangyang-xuanling') - (idOfRole[b.Id] === 'yangyang-xuanling'));
  for (const r of order) {
    const id = idOfRole[r.Id];
    if (id.startsWith('rover')) continue;
    const form = id === 'yangyang-xuanling' ? 'as Xuanling' : '';
    const mine = words.filter(w => w.RoleId === r.Id).map(w => ({ title: clean(t(w.Title)), text: t(w.Content) }));
    let toRover = mine.find(l => l.title === 'About Rover');
    if (!toRover) { const th = mine.filter(l => /^Thoughts/.test(l.title)); toRover = th[th.length - 1]; }
    for (const l of mine) {
      if (!l.title.startsWith('About ')) continue;
      const rest = l.title.slice(6);
      let tgt = nameToId[rest], sub = '';
      if (!tgt) { const i = rest.indexOf(':'); if (i > 0) { tgt = nameToId[rest.slice(0, i).trim()]; sub = rest.slice(i + 1).trim(); } }
      if (!tgt) tgt = nameToId[(content.aliases || {})[rest]];
      if (!tgt || tgt === 'rover') continue;
      raw.push({ f: canon(id), t: canon(tgt), s: [sub, form].filter(Boolean).join(' · '), q: l.text });
    }
    if (toRover) raw.push({ f: canon(id), t: 'rover', s: [toRover.title === 'About Rover' ? '' : toRover.title, form].filter(Boolean).join(' · '), q: toRover.text });
  }
  const lines = dedupeLines(raw);

  // ----- materials -----
  const used = new Set();
  const sum = list => { const m = new Map(); for (const c of list) m.set(c.Key, (m.get(c.Key) || 0) + c.Value); return [...m].sort((a, b) => (itemInfo[b[0]]?.QualityId || 0) - (itemInfo[a[0]]?.QualityId || 0) || a[0] - b[0]); };
  for (const c of chars) {
    const r = roleOf[c.id];
    const asc = sum(breach.filter(b => b.BreachGroupId === r.BreachId).flatMap(b => b.BreachConsume || []));
    const groups = new Set(skills.filter(s => s.SkillGroupId === r.SkillId).map(s => s.SkillLevelGroupId));
    const sk = sum([
      ...skillLevels.filter(s => groups.has(s.SkillLevelGroupId)).flatMap(s => s.Consume || []),
      ...tree.filter(n => n.NodeGroup === r.SkillTreeGroupId && !n.SkillId).flatMap(n => n.Consume || []),
    ]);
    c.mats = { a: asc, s: sk };
    for (const [k] of [...asc, ...sk]) used.add(k);
  }
  const items = {};
  const bossOf = {};
  for (const id of used) {
    const it = itemInfo[id]; if (!it) continue;
    const desc = clean(t(it.AttributesDescription));
    const m = desc.match(/^(.+?)(?:'s|') drop, used for (Skill Upgrade|Resonator Ascension)/);
    const icon = (it.Icon || '').split('/').pop().split('.')[0];
    items[id] = { n: clean(t(it.Name)), r: it.QualityId, src: m ? m[1] : '', _icon: it.Icon };
    if (m) bossOf[id] = { boss: m[1], weekly: m[2] === 'Skill Upgrade' };
    if (!icon) delete items[id]._icon;
  }
  const bossMap = new Map();
  for (const c of chars) {
    if (c.same) continue;
    for (const [k] of [...c.mats.a, ...c.mats.s]) {
      const b = bossOf[k]; if (!b) continue;
      const key = b.boss + (b.weekly ? '|w' : '|o');
      if (!bossMap.has(key)) bossMap.set(key, { name: b.boss, weekly: b.weekly, item: k, chars: [] });
      const e = bossMap.get(key); if (!e.chars.includes(c.id)) e.chars.push(c.id);
    }
  }
  const notes = content.bosses || {};
  const bosses = [...bossMap.values()].map(b => ({ ...b, note: notes[b.name] || '' }))
    .sort((a, b) => (b.weekly - a.weekly) || Math.min(...a.chars.map(i => verKey(byId[i].ver))) - Math.min(...b.chars.map(i => verKey(byId[i].ver))));

  // ----- outfits -----
  const outfits = [];
  for (const s of skins) {
    const id = idOfRole[s.RoleId]; if (!id || id.startsWith('rover')) continue;
    if (s.Id === roleOf[id]?.SkinId) continue;
    const n = clean(t(s.TitleName) || t(s.Name));
    if (n && !outfits.some(o => o.name === n && o.char === canon(id))) outfits.push({ name: n, char: id });
  }

  // ----- images -----
  await images(chars, roleOf, items);
  for (const c of chars) c.art = fs.existsSync(path.join(OUT, 'img/wuwa/art', c.id + '.webp'));
  for (const id of Object.keys(items)) { items[id].i = fs.existsSync(path.join(OUT, 'img/wuwa/items', id + '.webp')) ? 1 : 0; delete items[id]._icon; }

  log(`wuwa: ${chars.length} characters, ${lines.length} lines, ${Object.keys(items).length} items, ${bosses.length} bosses (data ${dataVersion})`);
  return {
    chars, lines, items, bosses, outfits, nameToId, dataVersion,
    elements: ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc'],
    regions: ['Huanglong', 'Black Shores', 'Rinascita', 'Lahai-Roi', 'New Federation', 'Fractsidus', 'Crossover', 'Unknown'],
    labels: { extra: 'Attributes', title: 'Resonance power', faction: 'Affiliation', region: 'Sphere', weapon: 'Weapon', el: 'Attribute', asc: 'Ascension to level 90', skill: 'All Forte skills to max', boss: 'Weekly Challenge' },
  };
}

async function images(chars, roleOf, items) {
  const need = [];
  const dir = n => path.join(OUT, 'img/wuwa', n);
  for (const c of chars) {
    const r = roleOf[c.id];
    if (!fs.existsSync(path.join(dir('icons'), c.id + '.webp'))) need.push({ game: r.RoleHeadIconLarge, dest: path.join(dir('icons'), c.id + '.webp'), w: 176, q: 84 });
    if (!fs.existsSync(path.join(dir('art'), c.id + '.webp'))) need.push({ game: r.FormationRoleCard, dest: path.join(dir('art'), c.id + '.webp'), w: 560, q: 80, optional: true });
  }
  for (const [id, it] of Object.entries(items)) {
    if (it._icon && !fs.existsSync(path.join(dir('items'), id + '.webp'))) need.push({ game: it._icon, dest: path.join(dir('items'), id + '.webp'), w: 96, q: 86 });
  }
  if (!need.length) return;
  log('wuwa: fetching', need.length, 'new images');
  const branches = repoBranches(ASSETS).filter(b => /^beta\d/i.test(b)).sort((a, b) => verKey(b.replace(/[^\d.]/g, '')) - verKey(a.replace(/[^\d.]/g, '')));
  const branch = branches[0]; if (!branch) { warn('wuwa: no asset branch found'); return; }
  const files = repoFiles(ASSETS, branch, 'ww-assets-' + branch);
  const lower = new Map(files.map(f => [f.toLowerCase(), f]));
  const jobs = [];
  for (const n of need) {
    const rel = 'ui/' + n.game.split('.')[0].replace(/^\/Game\/Aki\/UI\//, '').toLowerCase() + '.png';
    const real = lower.get(rel);
    if (!real) { if (!n.optional) warn('wuwa: image not in asset repo:', path.basename(n.dest)); continue; }
    n.tmp = path.join(CACHE, 'img/ww', real.replace(/[\/]/g, '_'));
    jobs.push({ url: `https://raw.githubusercontent.com/${ASSETS}/${branch}/${real}`, file: n.tmp });
  }
  getMany(jobs);
  for (const n of need) if (n.tmp) await toWebp(n.tmp, n.dest, { w: n.w, q: n.q });
}
