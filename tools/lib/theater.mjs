// Imaginarium Theater: reads this month's season from the wiki and picks the strongest teams
// that fit its element rules. Runs daily, so a new season shows up right after the reset on the 1st.
import { wikitext, field } from './live.mjs';
import { log, warn } from './util.mjs';

const TIER_SCORE = { SS: 5, S: 4, A: 3, B: 2, C: 1 };
const split = s => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
/** "2026-11-01 04:00:00" at UTC+8 -> ISO */
const iso = s => { const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5])).toISOString() : ''; };
const monthKey = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

function season(key) {
  const t = wikitext('genshin', 'Imaginarium Theater/Seasons/' + key, 12);
  if (!t || !/Imaginarium Theater Season/.test(t)) return null;
  return {
    key, season: +field(t, 'season') || null, start: iso(field(t, 'start')), end: iso(field(t, 'end')),
    elements: split(field(t, 'elements')), opening: split(field(t, 'characters')), guests: split(field(t, 'guests')),
    blessing: field(t, 'blessing'),
  };
}

/**
 * chars: site characters; id: name -> id; tiers: built tier object; pool: [[ids...], ...] candidate teams
 */
export function buildTheater(chars, id, tiers, pool) {
  // the season runs from 04:00 on the 1st, server time (UTC+8)
  const now = new Date(Date.now() + 8 * 36e5 - 4 * 36e5);
  const cur = season(monthKey(now));
  if (!cur) { warn('genshin: no Imaginarium Theater season page for', monthKey(now)); return null; }
  const nx = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const next = season(monthKey(nx));

  const byId = Object.fromEntries(chars.map(c => [c.id, c]));
  const tierOf = {}, roleOf = {};
  for (const r of tiers?.rows || []) r.cells.forEach((ids, j) => ids.forEach(i => { tierOf[i] ??= TIER_SCORE[r.tier] || 2; roleOf[i] ??= tiers.columns[j]; }));
  for (const i of tiers?.unrated || []) tierOf[i] ??= 3.5;

  const pick = s => {
    const opening = s.opening.map(id).filter(Boolean), guests = s.guests.map(id).filter(Boolean);
    // Travelers can take any of the allowed elements, so they always qualify
    const ok = c => !c.same && (s.elements.includes(c.el) || guests.includes(c.id) || c.id === 'aether' || c.id === 'lumine');
    const allowed = new Set(chars.filter(ok).map(c => c.id));
    const score = t => t.reduce((a, i) => a + (tierOf[i] || 2) + (opening.includes(i) ? 1.2 : 0) + (guests.includes(i) ? 0.3 : 0), 0);
    const seen = new Set(), cands = [];
    const addTeam = (t, flex) => { const k = [...t].sort().join(); if (seen.has(k)) return; seen.add(k); cands.push({ chars: t, flex, score: score(t) - (flex ? 1.5 : 0) }); };
    for (const t of pool) if (t.length === 4 && t.every(i => allowed.has(i))) addTeam(t, null);
    // teams with one banned member: fill the slot with the best allowed character of the same role
    for (const t of pool) {
      if (t.length !== 4) continue;
      const bad = t.filter(i => !allowed.has(i));
      // only a support or sub DPS slot can be swapped; the team is built around its main DPS
      if (bad.length !== 1 || bad[0] === t[0]) continue;
      const role = roleOf[bad[0]] === 'Main DPS' ? 'Sub DPS' : roleOf[bad[0]] || 'Support';
      const sub = [...allowed].filter(i => !t.includes(i) && (roleOf[i] || 'Support') === role && byId[i]?.rarity)
        .sort((a, b) => (tierOf[b] || 2) + (opening.includes(b) ? 1 : 0) - (tierOf[a] || 2) - (opening.includes(a) ? 1 : 0))[0];
      if (sub) addTeam(t.map(i => i === bad[0] ? sub : i), { out: bad[0], in: sub });
    }
    cands.sort((a, b) => b.score - a.score);
    // keep variety: each character in at most two picked teams, and only one team per main DPS
    const use = {}, mains = new Set(), teams = [];
    for (const c of cands) {
      if (teams.length >= 8) break;
      const main = c.chars[0];
      if (mains.has(main) || c.chars.some(i => (use[i] || 0) >= 2)) continue;
      mains.add(main); c.chars.forEach(i => (use[i] = (use[i] || 0) + 1)); teams.push(c);
    }
    // the characters worth building for this season
    const cast = [...allowed].filter(i => byId[i] && byId[i].rarity).sort((a, b) =>
      (tierOf[b] || 2) + (opening.includes(b) ? 1.2 : 0) - (tierOf[a] || 2) - (opening.includes(a) ? 1.2 : 0)).slice(0, 16);
    return { season: s.season, key: s.key, start: s.start, end: s.end, elements: s.elements, opening, guests, blessing: s.blessing,
      teams: teams.map(t => ({ chars: t.chars, flex: t.flex || undefined, opening: t.chars.filter(i => opening.includes(i)).length })), cast };
  };
  const out = { current: pick(cur), next: next ? pick(next) : null };
  log(`genshin: Imaginarium Theater season ${cur.season} (${cur.elements.join(', ')}), ${out.current.teams.length} teams` + (next ? `, next season ${next.season} known` : ''));
  return out;
}
