// Combines data/platforms/*.json into the public rules.json and checks each file follows data/SCHEMA.md.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PLATFORM_DIR = join(ROOT, 'data', 'platforms');
export const GROUPS = [
  { id: 'shop', name: '🛒 网购' },
  { id: 'local', name: '🍱 外卖·本地生活' },
];
export const ORDER = ['taobao', 'tmall', '1688', 'jd', 'jdlite', 'pdd', 'meituan-waimai', 'meituan', 'taobao-waimai', 'eleme-waimai', 'eleme'];
const TAGS = new Set(['最划算', '刚需']);

/** Returns a list of problems (empty = fine). */
export function validatePlatform(p) {
  const errs = [];
  const need = (cond, msg) => cond || errs.push(`${p.id ?? '?'}: ${msg}`);
  need(ORDER.includes(p.id), `unknown id`);
  need(typeof p.name === 'string' && p.name, 'name');
  need(GROUPS.some((g) => g.id === p.group), 'group');
  need(/^\d{4}-\d{2}-\d{2}$/.test(p.verified ?? ''), 'verified date');
  need(typeof p.summary === 'string' && p.summary.length > 0, 'summary');
  need(Array.isArray(p.stackOrder) && p.stackOrder.length > 0, 'stackOrder');
  need(Array.isArray(p.coupons) && p.coupons.length > 0, 'coupons');
  // The "去领取" button: official site only, no tracking / rebate parameters.
  need(p.open && /^https:\/\/[^/?#]+\/[^?#]*$/.test(p.open.url ?? '') && p.open.app, 'open link (https, no query string)');
  if (p.example) {
    const sum = p.example.steps.reduce((n, s) => n + Number(s.amount), 0);
    need(Math.abs(sum - p.example.final) < 0.011, `example adds up to ${sum}, not ${p.example.final}`);
  }
  for (const c of p.coupons ?? []) {
    const n = c.name ?? '?';
    need(TAGS.has(c.tag), `${n}: tag must be 最划算 or 刚需`);
    need(c.what && c.howToGet && c.stack, `${n}: what/howToGet/stack`);
    need(['ok', 'check'].includes(c.status), `${n}: status`);
    need(Array.isArray(c.sources) && c.sources.length > 0, `${n}: needs a source`);
    for (const s of c.sources ?? []) {
      need(/^https?:\/\//.test(s.url ?? ''), `${n}: source url`);
      need(!/s\.click\.taobao|u\.jd\.com|union|mm_\d+|pid=|t\.cn\/|dpurl/.test(s.url ?? ''), `${n}: affiliate-looking link ${s.url}`);
    }
    for (const t of c.times ?? []) need(/^\d{1,2}[:：]\d{2}$/.test(t.time ?? '') && t.when, `${n}: time "${t.when} ${t.time}"`);
  }
  return errs;
}

export function loadPlatforms(dir = PLATFORM_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

export function buildRules(dir = PLATFORM_DIR) {
  const platforms = loadPlatforms(dir).filter((p) => validatePlatform(p).length === 0);
  return { groups: GROUPS, platforms };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const all = loadPlatforms();
  let bad = 0;
  for (const p of all) {
    const errs = validatePlatform(p);
    bad += errs.length;
    console.log(`${errs.length ? '✗' : '✓'} ${p.id}: ${p.coupons?.length ?? 0} coupons, ${p.coupons?.filter((c) => c.status === 'check').length ?? 0} to check`);
    for (const e of errs) console.log('   ', e);
  }
  process.exit(bad ? 1 : 0);
}
