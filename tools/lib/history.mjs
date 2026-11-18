// Banner history: every limited character banner since 1.0, read from the wiki's version pages.
// Used to show how many banner phases have passed since a character's last banner.
import { versionFacts, wikitext, field } from './live.mjs';
import { log } from './util.mjs';

const DAY = 864e5;
const ymd = t => new Date(t).toISOString().slice(0, 10);

/**
 * versions: [{ v, date }] in release order. Returns
 * { phases: ['YYYY-MM-DD', ...], runs: { id: [[date, v, kind], ...] }, missing: [names] }
 */
export function bannerHistory(game, versions, resolve, isFive) {
  const phases = new Set(), runs = {}, missing = new Set();
  const now = Date.now();
  for (const { v, date } of versions) {
    const start = Date.parse(date);
    // old pages never change, so keep them cached for months
    const age = Number.isFinite(start) ? now - start : 0;
    const f = versionFacts(game, v, { light: true, maxAgeH: age > 90 * DAY ? 24 * 120 : 20 });
    if (!f || !f.banners) continue;
    const vStart = f.start ? ymd(f.start) : Number.isFinite(start) ? ymd(start) : '';
    const list = f.banners.filter(b => b.kind !== 'weapon');
    if (game === 'genshin') {
      // phase II links sometimes lack a date: borrow one from the same phase, or use version start + 20 days
      const phaseNames = [...new Set(list.map(b => b.phase))];
      for (const b of list) {
        if (b.date) continue;
        const twin = list.find(x => x.phase === b.phase && x.date);
        const i = phaseNames.indexOf(b.phase);
        b.date = twin ? twin.date : vStart && ymd(Date.parse(vStart) + (i > 0 ? 20 * DAY * i : 0));
      }
    }
    for (const b of list) {
      let names = b.chars || [];
      if (game === 'wuwa' && b.date) {
        // older version pages do not name the featured Resonator: read it from the convene page
        const page = wikitext(game, `${b.name}/${b.date}`, age > 90 * DAY ? 24 * 120 : 20);
        const featured = page && field(page, 'resonator_5_F');
        if (featured) names = featured.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      }
      if (!b.date) continue;
      const ids = names.map(n => resolve(n) || (missing.add(n), null)).filter(id => id && isFive(id));
      if (!ids.length) continue;
      if (b.kind !== 'chronicle') phases.add(b.date);
      for (const id of ids) {
        const r = (runs[id] ??= []);
        if (!r.some(x => x[0] === b.date)) r.push([b.date, v, b.kind === 'chronicle' ? 'chronicle' : r.length ? 'rerun' : 'debut']);
      }
    }
  }
  for (const r of Object.values(runs)) r.sort((a, b) => a[0].localeCompare(b[0]));
  const out = { phases: [...phases].sort(), runs };
  log(`${game}: banner history, ${out.phases.length} phases, ${Object.keys(runs).length} characters` + (missing.size ? `, unmatched: ${[...missing].slice(0, 8).join(', ')}` : ''));
  return out;
}
