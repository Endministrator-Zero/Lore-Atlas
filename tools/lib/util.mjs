// Shared helpers for the Lore Atlas updater.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = process.env.LORE_CACHE || path.join(ROOT, '.cache');
export const OUT = path.join(ROOT, 'assets');
fs.mkdirSync(CACHE, { recursive: true });

export const log = (...a) => console.log('[update]', ...a);
export const warn = (...a) => console.warn('[update] WARN', ...a);

/** Download a URL into the cache (curl honours proxies). Returns the file path, or null when optional and it fails. */
export function get(url, name, { maxAgeH = 20, optional = false } = {}) {
  const file = path.join(CACHE, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.statSync(file).size > 0) {
    const ageH = (Date.now() - fs.statSync(file).mtimeMs) / 36e5;
    if (ageH < maxAgeH || process.env.LORE_OFFLINE) return file;
  }
  if (process.env.LORE_OFFLINE) { if (optional) return null; throw new Error('offline and not cached: ' + name); }
  try {
    execFileSync('curl', ['-sSL', '--fail', '--retry', '3', '-m', '400', '-A', 'lore-atlas-updater', '-o', file + '.part', url], { stdio: ['ignore', 'ignore', 'pipe'] });
    fs.renameSync(file + '.part', file);
    return file;
  } catch (e) {
    try { fs.rmSync(file + '.part', { force: true }); } catch {}
    if (fs.existsSync(file) && fs.statSync(file).size > 0) { warn('using stale cache for', name); return file; }
    if (optional) { warn('could not fetch', url); return null; }
    throw new Error('download failed: ' + url + '\n' + String(e.stderr || e.message).slice(0, 300));
  }
}
export function getJSON(url, name, opts) {
  const f = get(url, name, opts);
  if (!f) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { if (opts && opts.optional) { warn('bad JSON', name); return null; } throw e; }
}
export const readJSON = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
export const writeJSON = (p, obj) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 1) + '\n'); };

/** Download many files in parallel. jobs: [{url, file}] (absolute file paths). Missing files are skipped quietly. */
export function getMany(jobs) {
  jobs = jobs.filter(j => !fs.existsSync(j.file) || fs.statSync(j.file).size === 0);
  if (!jobs.length || process.env.LORE_OFFLINE) return;
  const cfg = path.join(CACHE, 'curl-batch.txt');
  for (const j of jobs) fs.mkdirSync(path.dirname(j.file), { recursive: true });
  fs.writeFileSync(cfg, jobs.map(j => `url = "${j.url.replace(/ /g, '%20')}"\noutput = "${j.file}"`).join('\n') + '\n');
  try {
    execFileSync('curl', ['-sSL', '--fail', '--retry', '2', '-m', '120', '--parallel', '--parallel-max', '10', '-A', 'lore-atlas-updater', '-K', cfg], { stdio: 'ignore' });
  } catch { /* some files may be missing; callers check existence */ }
  for (const j of jobs) { try { if (fs.existsSync(j.file) && fs.statSync(j.file).size < 200) fs.rmSync(j.file); } catch {} }
}

/** List files of a GitHub repo branch without downloading it (blob-less clone). */
export function repoFiles(repo, branch, key) {
  const dir = path.join(CACHE, 'repos', key);
  const list = path.join(CACHE, 'repos', key + '.txt');
  if (fs.existsSync(list) && (Date.now() - fs.statSync(list).mtimeMs) / 36e5 < 20) return fs.readFileSync(list, 'utf8').split('\n');
  if (process.env.LORE_OFFLINE) return fs.existsSync(list) ? fs.readFileSync(list, 'utf8').split('\n') : [];
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const args = ['clone', '-q', '--filter=blob:none', '--no-checkout', '--depth', '1'];
    if (branch) args.push('-b', branch);
    execFileSync('git', [...args, `https://github.com/${repo}`, dir], { stdio: 'ignore', timeout: 600000 });
    const out = execFileSync('git', ['-C', dir, 'ls-tree', '-r', 'HEAD', '--name-only'], { maxBuffer: 1 << 28 }).toString();
    fs.writeFileSync(list, out);
    return out.split('\n');
  } catch (e) {
    warn('could not list', repo, branch || '');
    return fs.existsSync(list) ? fs.readFileSync(list, 'utf8').split('\n') : [];
  }
}
export function repoBranches(repo) {
  try {
    return execFileSync('git', ['ls-remote', '--heads', `https://github.com/${repo}`], { timeout: 120000 }).toString()
      .split('\n').map(l => l.split('refs/heads/')[1]).filter(Boolean);
  } catch { return []; }
}

let sharpMod;
/** Convert an image to WebP. Returns true on success. */
export async function toWebp(src, dest, { w = 0, h = 0, q = 82 } = {}) {
  if (!fs.existsSync(src)) return false;
  if (sharpMod === undefined) { try { sharpMod = (await import('sharp')).default; } catch { sharpMod = null; warn('sharp is not installed; new images are skipped'); } }
  if (!sharpMod) return false;
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let img = sharpMod(src);
    if (w || h) img = img.resize({ width: w || null, height: h || null, fit: 'inside', withoutEnlargement: true });
    await img.webp({ quality: q, effort: 4 }).toFile(dest);
    return true;
  } catch (e) { warn('image failed', path.basename(src), e.message); return false; }
}

// ---------- text ----------
export function clean(t) {
  if (!t) return '';
  t = String(t).replace(/\\n/g, ' ').replace(/\n/g, ' ');
  t = t.replace(/\{M#([^}]*)\}\{F#[^}]*\}/g, '$1').replace(/\{F#[^}]*\}\{M#([^}]*)\}/g, '$1');
  t = t.replace(/\{Male=([^;}]*);Female=[^}]*\}/g, '$1');
  t = t.replace(/\{RUBY#\[[A-Z]\][^}]*\}/g, '');
  t = t.replace(/\{NICKNAME\}/g, 'Traveler').replace(/\{PlayerName\}/g, 'Rover');
  t = t.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '');
  return t.replace(/^#+/, '').replace(/\s+/g, ' ').trim();
}
export function trim(t, max = 200) {
  if (t.length <= max) return t;
  const parts = t.split(/(?<=[.!?…"”])\s+/);
  let out = '';
  for (const p of parts) { if (out.length + p.length + 1 > max) break; out = (out + ' ' + p).trim(); }
  if (out.length < 60) out = t.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '…';
  else if (!out.endsWith('…')) out += ' …';
  return out;
}
export const gslug = n => n.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
export const wslug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const verKey = v => { const p = String(v).split('.'); return (+p[0]) * 100 + (+p[1] || 0); };
export const isoDay = d => new Date(d).toISOString().slice(0, 10);
export const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** First line per (from,to) pair, in source order. raw: [{f,t,s,q}] */
export function dedupeLines(raw, max = 200) {
  const seen = new Set(), out = [];
  for (const l of raw) {
    if (!l.f || !l.t || l.f === l.t) continue;
    const k = l.f + '>' + l.t;
    if (seen.has(k)) continue;
    seen.add(k);
    const q = trim(clean(l.q), max);
    if (q) out.push({ f: l.f, t: l.t, s: l.s || '', q });
  }
  return out;
}

/** Parse content/<game>/builds.txt: one character per line, fields split by " | ". */
export function parseBuilds(file, nameToId) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const p = line.split('|').map(s => s.trim());
    const id = nameToId[p[0]];
    if (!id) { warn('builds.txt: unknown character', p[0]); continue; }
    const list = s => (s || '').split(';').map(x => x.trim()).filter(Boolean);
    out[id] = {
      role: p[1] || '', weapons: list(p[2]), sets: list(p[3]), main: p[4] || '', subs: p[5] || '', skills: p[6] || '',
      teams: list(p[7]).map(t => t.split(',').map(x => x.trim()).filter(Boolean).map(n => nameToId[n] || n)),
      note: p[8] || '',
    };
  }
  return out;
}
