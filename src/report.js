// Builds runs/report.html from the collector state. Run alone: node src/report.js
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const bj = (iso) => (iso ? new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '');
const yuan = (v) => (v == null ? '—' : `¥${v}`);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export function summarize(state) {
  const posts = Object.values(state.posts);
  const started = Date.parse(state.startedAt);
  // "Fresh" = written after we started watching, so the delay is a real speed measurement.
  const fresh = posts.filter((p) => !p.backlog && p.created && Date.parse(p.created) >= started && p.delayMin != null);
  const bySource = {};
  for (const p of posts) {
    const s = (bySource[p.group] ??= { all: 0, good: 0, fresh: [], spam: 0, links: 0 });
    s.all++;
    if ((p.score ?? 0) >= 6) s.good++;
    s.spam += p.spamFiltered ?? 0;
    s.links += p.removedLinks ?? 0;
  }
  for (const p of fresh) bySource[p.group].fresh.push(p.delayMin);
  return {
    posts,
    fresh,
    bySource,
    alerts: posts.filter((p) => p.alerted).sort((a, b) => b.alerted.localeCompare(a.alerted)),
    hoursRun: ((Date.parse(state.lastRound ?? state.startedAt) - started) / 3600e3).toFixed(1),
  };
}

/** Replies per hour: since we first saw the post, or since it was posted. Null when unknown. */
export function heat(p, nowMs = Date.now()) {
  const watchedH = (nowMs - Date.parse(p.firstSeen)) / 3600e3;
  if (p.firstReplies != null && p.replies != null && watchedH >= 0.25) return (p.replies - p.firstReplies) / watchedH;
  if (p.replies != null && p.created) return p.replies / Math.max((nowMs - Date.parse(p.created)) / 3600e3, 0.25);
  return null;
}
const postedAt = (p) => p.created ?? p.firstSeen;

// Piracy / bot-script posts and ads stay hidden from the lists.
export const isHidden = (p) => (p.reasons ?? []).some((r) => /盗版|广告/.test(r));

function row(p) {
  const tips = (p.tips ?? [])
    .filter((t) => p.lowerInComments != null && t.price <= p.lowerInComments)
    .slice(0, 1)
    .map((t) => `<div class="tip">💬 评论区 ${yuan(t.price)}：${esc(t.text)}</div>`)
    .join('');
  const h = heat(p);
  return `<tr>
    <td><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>
      <div class="meta">${esc(p.group)} · ${bj(postedAt(p))}${p.replies != null ? ` · ${p.replies} 回复` : ''}${h != null && h >= 1 ? ` · 🔥 每小时 ${Math.round(h)} 条新回复` : ''}</div>
      ${tips}</td>
    <td class="num">${yuan(p.price)}</td>
    <td class="num">${p.lowerInComments != null ? `<b class="low">${yuan(p.lowerInComments)}</b>` : ''}</td>
  </tr>`;
}
const table = (rows, empty) =>
  rows.length
    ? `<div class="wrap"><table><tr><th>线报</th><th class="num">到手价</th><th class="num">评论更低</th></tr>${rows.map(row).join('')}</table></div>`
    : `<div class="sub">${empty}</div>`;

export function renderReport(state) {
  const s = summarize(state);
  const visible = s.posts.filter((p) => !isHidden(p));
  const dayAgo = Date.now() - 24 * 3600e3;
  const hottest = visible
    .filter((p) => (heat(p) ?? 0) >= 1 && Date.parse(postedAt(p)) >= dayAgo - 24 * 3600e3)
    .sort((a, b) => heat(b) - heat(a))
    .slice(0, 30);
  const newest = [...visible].sort((a, b) => postedAt(b).localeCompare(postedAt(a))).slice(0, 50);
  const srcRows = Object.entries(s.bySource)
    .map(([name, v]) => `<tr><td>${esc(name)}</td><td class="num">${v.all}</td>
      <td class="num">${v.fresh.length ? `${median(v.fresh)} 分钟（${v.fresh.length} 条）` : '—'}</td>
      <td class="num">${v.spam}</td><td class="num">${v.links}</td></tr>`)
    .join('');
  const st = state.stats;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>线报雷达 试验报告</title>
<style>
:root{--bg:#f7f5f0;--fg:#1d1b18;--mut:#6b665d;--line:#e2ddd2;--card:#fff;--acc:#c2410c;--low:#15803d}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#17161a;--fg:#ece9e2;--mut:#a29d93;--line:#2e2c31;--card:#1f1e23;--acc:#fb923c;--low:#4ade80}}
:root[data-theme=dark]{--bg:#17161a;--fg:#ece9e2;--mut:#a29d93;--line:#2e2c31;--card:#1f1e23;--acc:#fb923c;--low:#4ade80}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,"PingFang SC","Microsoft YaHei",sans-serif}
main{max-width:1000px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}
.sub{color:var(--mut);font-size:13px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.card b{display:block;font-size:22px;font-variant-numeric:tabular-nums}.card span{color:var(--mut);font-size:12px}
.wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
th{font-size:12px;color:var(--mut);font-weight:600}
.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
a{color:var(--fg);text-decoration-color:var(--line)}a:hover{color:var(--acc)}
.meta,.why{color:var(--mut);font-size:12px}.why{opacity:.8}
.tip{font-size:13px;margin-top:3px}.low{color:var(--low)}
</style></head><body><main>
<h1>线报雷达 · 试验报告</h1>
<div class="sub">开始 ${bj(state.startedAt)}（北京时间） · 已运行 ${s.hoursRun} 小时 · 最后更新 ${bj(state.lastRound)}${state.endedAt ? ' · 已结束' : ' · 运行中'}</div>
<div class="cards">
  <div class="card"><b>${s.posts.length}</b><span>收集到的线报</span></div>
  <div class="card"><b>${s.fresh.length ? median(s.fresh.map((p) => p.delayMin)) + ' 分' : '—'}</b><span>发帖到被发现（中位数）</span></div>
  <div class="card"><b>${s.posts.filter((p) => p.lowerInComments != null).length}</b><span>评论区找到更低价</span></div>
  <div class="card"><b>${Object.values(s.bySource).reduce((n, v) => n + v.spam, 0)}</b><span>过滤掉的助力/口令评论</span></div>
  <div class="card"><b>${Object.values(s.bySource).reduce((n, v) => n + v.links, 0)}</b><span>去除/清洗的链接</span></div>
</div>
<h2>🔥 最热</h2>
<div class="sub">按“每小时新增回复”排序，越多人在跟帖越靠前（只有豆瓣小组有回复数）。</div>
${table(hottest, '暂时没有正在变热的线报。')}
<h2>🆕 最新</h2>
${table(newest, '还没有收集到线报。')}
<h2>各来源</h2>
<div class="wrap"><table><tr><th>来源</th><th class="num">线报</th><th class="num">发现速度</th><th class="num">过滤评论</th><th class="num">去除链接</th></tr>${srcRows}</table></div>
<div class="sub">请求 ${st.requests} 次 · 出错 ${st.errors} 次 · 被网站拦截 ${st.blocked} 次（被拦截时自动暂停，不会绕过）</div>
</main></body></html>`;
}

export function writeReport(state, path) {
  writeFileSync(path, renderReport(state));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const runs = process.env.DEAL_RADAR_RUNS || join(dirname(fileURLToPath(import.meta.url)), '..', 'runs');
  const state = JSON.parse(readFileSync(join(runs, 'state.json'), 'utf8'));
  writeReport(state, join(runs, 'report.html'));
  console.log('wrote', join(runs, 'report.html'));
}
