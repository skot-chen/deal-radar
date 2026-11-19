// 线报雷达 collector: polls the sources, keeps state in runs/, logs good deals.
// Usage: node src/collector.js [--once] [--hours 24]
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDoubanList, parseDoubanTopic, parseRss } from './parse.js';
import { isInviteSpam, scrubText, extractPrice, cleanLink } from './clean.js';
import { isDealPost, scorePost, productKey, overlap } from './score.js';
import { writeReport } from './report.js';
import { publish } from './publish.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = process.env.DEAL_RADAR_RUNS || join(ROOT, 'runs');
mkdirSync(RUNS, { recursive: true });
const STATE = join(RUNS, 'state.json');
const LOG = join(RUNS, 'events.jsonl');

export const SOURCES = {
  douban: [
    { id: '698716', name: '买组 & All buy & 不买不可能' },
    { id: '536786', name: '拼组 / 我跟你拼了！' },
  ],
  rss: [{ id: 'smzdm', name: '什么值得买', url: 'http://feed.smzdm.com' }],
};
const DOUBAN_EVERY_MIN = 5;
const RSS_EVERY_MIN = 3;
const MAX_TOPIC_FETCHES = 8; // per douban round, keeps us gentle
const REFRESH_COMMENTS_MIN = 20;
const ALERT_SCORE = 6;
const PUBLISH_EVERY_MIN = 10;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const PRICE_CUE = /(到手|实付|更低|更便宜|才|只要|一共|合计|总共|叠加|用了|我买|我拍|入手|拿下|最低)/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const log = (type, data = {}) => {
  const line = { t: now(), type, ...data };
  appendFileSync(LOG, JSON.stringify(line) + '\n');
  if (type !== 'fetch') console.log(`[${line.t.slice(11, 19)}] ${type}`, data.title ?? data.msg ?? data.url ?? '');
};

function loadState() {
  if (existsSync(STATE)) return JSON.parse(readFileSync(STATE, 'utf8'));
  return { startedAt: now(), posts: {}, stats: { requests: 0, errors: 0, blocked: 0 }, pausedUntil: {} };
}
function saveState(s) {
  writeFileSync(STATE + '.tmp', JSON.stringify(s));
  renameSync(STATE + '.tmp', STATE);
}

class Blocked extends Error {}

async function get(state, url, sourceKey) {
  state.stats.requests++;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
    redirect: 'manual',
    signal: AbortSignal.timeout(25000),
  });
  const loc = res.headers.get('location') ?? '';
  // Douban sends robots to a verification page. We stop and wait; we never try to get past it.
  if (res.status === 403 || res.status === 418 || /sec\.douban\.com|accounts\.douban\.com|passport/.test(loc)) {
    throw new Blocked(`${sourceKey} blocked (${res.status} ${loc.slice(0, 60)})`);
  }
  if (res.status >= 300) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  if (/百度安全验证|异常请求|检测到有异常请求/.test(text.slice(0, 3000))) throw new Blocked(`${sourceKey} verification page`);
  log('fetch', { url, status: res.status, bytes: text.length });
  return text;
}

const ageHours = (p) => (p.created ? (Date.now() - Date.parse(p.created)) / 3600e3 : null);

function rescore(state, p) {
  // Same product in another source within 48 h?
  let others = 0;
  for (const q of Object.values(state.posts)) {
    if (q.source === p.source || q.key === p.key) continue;
    if (Math.abs(Date.parse(q.firstSeen) - Date.parse(p.firstSeen)) > 48 * 3600e3) continue;
    if (overlap(p.pk, q.pk) >= 0.3) others++;
  }
  p.otherSources = others;
  // Heat: replies since we first saw it ÷ time watched; falls back to replies ÷ post age.
  const watchedH = (Date.now() - Date.parse(p.firstSeen)) / 3600e3;
  const heat =
    p.firstReplies != null && watchedH >= 0.25
      ? { replies: (p.replies ?? 0) - p.firstReplies, ageHours: watchedH }
      : { replies: p.replies, ageHours: ageHours(p) };
  const { score, reasons } = scorePost({ ...p, ...heat });
  p.score = score;
  p.reasons = reasons;
  if (score >= ALERT_SCORE && !p.alerted) {
    p.alerted = now();
    log('ALERT', { key: p.key, title: p.title, score, price: p.price, url: p.url });
  }
}

function applyComments(p, comments) {
  p.commentsSeen ??= 0;
  p.spamFiltered ??= 0;
  p.tips ??= [];
  const known = new Set(p.tips.map((t) => t.cid));
  for (const c of comments) {
    p.commentsSeen++;
    if (isInviteSpam(c.text)) {
      p.spamFiltered++;
      continue;
    }
    if (!PRICE_CUE.test(c.text) || known.has(c.cid)) continue;
    const price = extractPrice(c.text);
    if (price == null) continue;
    // "5元券" style noise: a tip must be a real final price, not a tiny fraction of the post price.
    if (p.price && price > 0 && price < p.price * 0.15) continue;
    p.tips.push({ cid: c.cid, price, time: c.time, text: scrubText(c.text).text.slice(0, 160) });
  }
  p.tips.sort((a, b) => a.price - b.price);
  p.tips = p.tips.slice(0, 5);
  const best = p.tips[0]?.price;
  p.lowerInComments = best != null && (p.price == null || best < p.price) ? best : null;
}

async function fetchTopic(state, p, latestPage) {
  const start = latestPage ? Math.max(0, Math.floor((p.replies - 1) / 100) * 100) : 0;
  const html = await get(state, `${p.url}${start ? `?start=${start}` : ''}`, 'douban');
  const t = parseDoubanTopic(html);
  if (!p.created && t.created) {
    p.created = t.created;
    p.delayMin = Math.round((Date.parse(p.firstSeen) - Date.parse(t.created)) / 60000);
  }
  if (!latestPage || !p.body) {
    const s = scrubText(t.body);
    p.body = s.text.slice(0, 1500);
    p.removedLinks = (p.removedLinks ?? 0) + s.removed;
    const links = t.links.map(cleanLink);
    p.removedLinks += links.filter((l) => l.kind !== 'clean').length;
    p.links = links.filter((l) => l.url).map((l) => l.url).slice(0, 5);
    if (p.price == null) p.price = extractPrice(p.body);
  }
  applyComments(p, t.comments);
  p.commentsAt = now();
}

async function doubanRound(state, firstRound) {
  if (Date.now() < Date.parse(state.pausedUntil.douban ?? 0)) return;
  const queue = [];
  for (const g of SOURCES.douban) {
    const list = parseDoubanList(await get(state, `https://www.douban.com/group/${g.id}/discussion?start=0`, 'douban'));
    for (const row of list) {
      if (row.pinned || !isDealPost(row.title)) continue;
      const key = `douban:${row.id}`;
      let p = state.posts[key];
      if (!p) {
        p = state.posts[key] = {
          key,
          source: 'douban',
          group: g.name,
          url: row.url,
          title: row.title,
          pk: productKey(row.title),
          price: extractPrice(row.title),
          firstSeen: now(),
          // Posts already there on the very first round are "backlog", not a speed test.
          backlog: firstRound,
          firstReplies: row.replies,
        };
        // With no replies yet, the list's "last reply" time is the posting time.
        if (row.replies === 0 && row.lastReply) {
          p.created = row.lastReply;
          p.delayMin = Math.round((Date.parse(p.firstSeen) - Date.parse(p.created)) / 60000);
        }
        log('new', { key, title: row.title });
        queue.push([p, false]);
      } else if (row.replies > (p.replies ?? 0) && (ageHours(p) ?? 0) < 48) {
        const stale = !p.commentsAt || Date.now() - Date.parse(p.commentsAt) > REFRESH_COMMENTS_MIN * 60e3;
        if (stale && (p.score ?? 0) >= 3) queue.push([p, true]);
      }
      p.replies = row.replies;
      p.lastReply = row.lastReply;
    }
    await sleep(2000 + Math.random() * 2000);
  }
  // New posts first, then the hottest refreshes.
  queue.sort((a, b) => Number(a[1]) - Number(b[1]) || (b[0].score ?? 0) - (a[0].score ?? 0));
  // Topic pages (body + comments) are sometimes refused to visitors ("没有访问权限").
  // Then we keep using the list only and retry topics an hour later — never work around it.
  const topicsOpen = Date.now() >= Date.parse(state.pausedUntil['douban-topic'] ?? 0);
  for (const [p, latest] of topicsOpen ? queue.slice(0, MAX_TOPIC_FETCHES) : []) {
    try {
      await fetchTopic(state, p, latest);
    } catch (e) {
      if (e instanceof Blocked) {
        state.stats.blocked++;
        state.pausedUntil['douban-topic'] = new Date(Date.now() + 60 * 60e3).toISOString();
        log('blocked', { msg: `douban topic pages refused — list only for 60 min (${e.message})` });
        break;
      }
      state.stats.errors++;
      log('error', { msg: e.message, key: p.key });
    }
    rescore(state, p);
    await sleep(2500 + Math.random() * 2500);
  }
  // Reply counts changed, so heat changed: rescore everything from the last two days.
  for (const p of Object.values(state.posts)) {
    if (p.source === 'douban' && Date.now() - Date.parse(p.firstSeen) < 48 * 3600e3) rescore(state, p);
  }
}

async function rssRound(state, firstRound) {
  for (const src of SOURCES.rss) {
    for (const it of parseRss(await get(state, src.url, src.id))) {
      const key = `${src.id}:${it.id}`;
      if (state.posts[key]) continue;
      const s = scrubText(it.body);
      const p = (state.posts[key] = {
        key,
        source: src.id,
        group: src.name,
        url: cleanLink(it.url).url ?? it.url,
        title: it.title,
        body: s.text.slice(0, 600),
        removedLinks: s.removed,
        pk: productKey(it.title),
        price: extractPrice(it.title),
        created: it.created,
        firstSeen: now(),
        backlog: firstRound,
      });
      p.delayMin = p.created ? Math.round((Date.parse(p.firstSeen) - Date.parse(p.created)) / 60000) : null;
      rescore(state, p);
    }
  }
}

async function guarded(state, name, fn) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Blocked) {
      state.stats.blocked++;
      // Back off for 30 minutes, then try again gently.
      state.pausedUntil[name] = new Date(Date.now() + 30 * 60e3).toISOString();
      log('blocked', { msg: `${e.message} — pausing ${name} 30 min` });
    } else {
      state.stats.errors++;
      log('error', { msg: `${name}: ${e.message}` });
    }
  }
}

async function main() {
  const once = process.argv.includes('--once');
  const hoursArg = process.argv.indexOf('--hours');
  const hours = hoursArg > 0 ? Number(process.argv[hoursArg + 1]) : 24;
  const endAt = Date.now() + hours * 3600e3;
  const state = loadState();
  const firstRound = Object.keys(state.posts).length === 0;
  writeFileSync(join(RUNS, 'collector.pid'), String(process.pid));
  log('start', { msg: `pid ${process.pid}, ${once ? 'once' : `${hours}h`}` });

  const doPublish = process.argv.includes('--publish');
  let nextPublish = 0;
  let nextDouban = 0;
  let nextRss = 0;
  let round = 0;
  while (true) {
    if (Date.now() >= nextRss) {
      await guarded(state, 'rss', () => rssRound(state, firstRound && round === 0));
      nextRss = Date.now() + RSS_EVERY_MIN * 60e3;
    }
    if (Date.now() >= nextDouban) {
      await guarded(state, 'douban', () => doubanRound(state, firstRound && round === 0));
      nextDouban = Date.now() + DOUBAN_EVERY_MIN * 60e3;
    }
    round++;
    state.lastRound = now();
    saveState(state);
    writeReport(state, join(RUNS, 'report.html'));
    if (doPublish && Date.now() >= nextPublish) {
      try {
        publish(state, RUNS);
        log('published', { msg: 'site updated' });
      } catch (e) {
        log('error', { msg: `publish: ${String(e.stderr ?? e.message).slice(0, 200)}` });
      }
      nextPublish = Date.now() + PUBLISH_EVERY_MIN * 60e3;
    }
    if (once || Date.now() >= endAt) break;
    await sleep(Math.max(5000, Math.min(nextDouban, nextRss) - Date.now()));
  }
  state.endedAt = now();
  saveState(state);
  writeReport(state, join(RUNS, 'report.html'));
  log('stop', { msg: `rounds ${round}` });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    log('crash', { msg: e.stack });
    process.exit(1);
  });
}
