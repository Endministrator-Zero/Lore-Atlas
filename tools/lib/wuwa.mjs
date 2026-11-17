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
  // ----- weapons -----
  const conf = bin('weapon/weaponconf.json', { optional: true }) || [];
  const growth = bin('property/weaponpropertygrowth.json', { optional: true }) || [];
  const at90 = curve => (growth.find(g => g.CurveId === curve && g.Level === 90 && g.BreachLevel === 6) || {}).CurveValue || 0;
  const PROP = { 7: ['ATK', 0], 8: ['Crit. Rate', 1], 9: ['Crit. DMG', 1], 10: ['DEF', 0], 11: ['Energy Regen', 1], 10002: ['HP%', 1], 10007: ['ATK%', 1], 10010: ['DEF%', 1] };
  const wbreach = bin('weapon/weaponbreach.json', { optional: true }) || [];
  const weaponIndex = {};
  for (const w of conf) {
    const n = clean(t(w.WeaponName)); if (!n || !w.IsShow) continue;
    const sp = w.SecondPropId || {}, info = PROP[sp.Id] || [String(sp.Id), 1];
    const sv = (sp.Value || 0) * at90(w.SecondCurve) / 10000 * (sp.IsRatio ? 10000 : 1);
    let passive = t(w.Desc);
    (w.DescParams || []).forEach((p, i) => { passive = passive.split('{' + i + '}').join((p.ArrayString || [])[0] || ''); });
    weaponIndex[wslug(n)] = {
      n, r: w.QualityId, type: WP[w.WeaponType] || '', atk: Math.floor((w.FirstPropId?.Value || 0) * at90(w.FirstCurve) / 10000),
      sub: info[0], subv: info[1] ? (sv / 100).toFixed(1) + '%' : String(Math.floor(sv)),
      p: clean(passive), _icon: w.Icon, id: w.ItemId,
      mats: sum(wbreach.filter(b => b.BreachId === w.BreachId).flatMap(b => [...(b.Consume || []), { Key: 2, Value: b.GoldConsume || 0 }])).filter(([, v]) => v > 0),
    };
    for (const [k] of weaponIndex[wslug(n)].mats) used.add(k);
  }
  const weaponImages = async list => {
    const need = list.filter(w => w._icon && !fs.existsSync(path.join(OUT, 'img/wuwa/weapons', wslug(w.n) + '.webp')))
      .map(w => ({ game: w._icon, dest: path.join(OUT, 'img/wuwa/weapons', wslug(w.n) + '.webp'), w: 128, q: 86 }));
    await fetchImages(need);
  };

  // ----- echo sets -----
  const fgroups = bin('phantom/phantomfettergroup.json', { optional: true }) || [];
  const fetters = Object.fromEntries((bin('phantom/phantomfetter.json', { optional: true }) || []).map(f => [f.Id, f]));
  const setIndex = {};
  for (const gset of fgroups) {
    const n = clean(t(gset.FetterGroupName)); if (!n) continue;
    const fx = (gset.FetterMap || []).map(m => {
      const f = fetters[m.Value]; if (!f) return null;
      let d = t(f.EffectDescription) || t(f.SimplyEffectDesc);
      (f.EffectDescriptionParam || []).forEach((v, i) => { d = d.split('{' + i + '}').join(v); });
      return [m.Key, clean(d)];
    }).filter(Boolean).sort((a, b) => a[0] - b[0]);
    setIndex[wslug(n)] = { n, fx, _icon: gset.AimModelElementPath || gset.FetterElementPath };
  }
  const setImages = async list => {
    const need = list.filter(a => a._icon && !fs.existsSync(path.join(OUT, 'img/wuwa/sets', wslug(a.n) + '.webp')))
      .map(a => ({ game: a._icon, dest: path.join(OUT, 'img/wuwa/sets', wslug(a.n) + '.webp'), w: 112, q: 86 }));
    await fetchImages(need);
  };

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
    chars, lines, items, bosses, outfits, nameToId, dataVersion, weaponIndex, weaponImages, setIndex, setImages, slug: wslug, setWord: 'Echo sets',
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
  await fetchImages(need);
}

async function fetchImages(need) {
  if (!need.length) return;
  log('wuwa: fetching', need.length, 'new images');
  // the main branch tracks the live game; the newest beta branch is a fallback for anything missing there
  const all = repoBranches(ASSETS);
  const betas = all.filter(b => /^beta\d/i.test(b)).sort((a, b) => verKey(b.replace(/[^\d.]/g, '')) - verKey(a.replace(/[^\d.]/g, '')));
  const order = [...(all.includes('main') ? ['main'] : []), ...betas.slice(0, 1)];
  if (!order.length) { warn('wuwa: no asset branch found'); return; }
  const lists = order.map(b => [b, new Map(repoFiles(ASSETS, b, 'ww-assets-' + b).map(f => [f.toLowerCase(), f]))]);
  const jobs = [];
  for (const n of need) {
    const rel = 'ui/' + n.game.split('.')[0].replace(/^\/Game\/Aki\/UI\//, '').toLowerCase() + '.png';
    let real = null, branch = null;
    for (const [b, lower] of lists) { real = lower.get(rel); if (real) { branch = b; break; } }
    if (!real) { if (!n.optional) warn('wuwa: image not in asset repo:', path.basename(n.dest)); continue; }
    n.tmp = path.join(CACHE, 'img/ww', real.replace(/[\/]/g, '_'));
    jobs.push({ url: `https://raw.githubusercontent.com/${ASSETS}/${branch}/${real}`, file: n.tmp });
  }
  getMany(jobs);
  for (const n of need) if (n.tmp) await toWebp(n.tmp, n.dest, { w: n.w, q: n.q });
}
