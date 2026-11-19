// Builds the public deals.json and pushes the site to the gh-pages branch.
// Each update is a normal commit on the gh-pages branch (no history rewriting).
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { heat, isHidden } from './report.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE = 'https://github.com/skot-chen/deal-radar.git';
const SHORT = { '买组 & All buy & 不买不可能': '豆瓣买组', '拼组 / 我跟你拼了！': '豆瓣拼组', 什么值得买: '什么值得买' };

/** Public data only: titles, links, prices, counts. No comment text, no usernames. */
export function buildDeals(state, nowMs = Date.now()) {
  const posted = (p) => p.created ?? p.firstSeen;
  const visible = Object.values(state.posts).filter((p) => !isHidden(p));
  const pick = (p) => ({
    title: p.title,
    url: p.url,
    source: SHORT[p.group] ?? p.group,
    posted: posted(p),
    price: p.price ?? null,
    lower: p.lowerInComments ?? null,
    replies: p.replies ?? null,
    heat: heat(p, nowMs) == null ? null : Math.round(heat(p, nowMs) * 10) / 10,
  });
  const twoDaysAgo = nowMs - 48 * 3600e3;
  const hot = visible
    .filter((p) => (heat(p, nowMs) ?? 0) >= 1 && Date.parse(posted(p)) >= twoDaysAgo)
    .sort((a, b) => heat(b, nowMs) - heat(a, nowMs))
    .slice(0, 30)
    .map(pick);
  const latest = [...visible].sort((a, b) => posted(b).localeCompare(posted(a))).slice(0, 100).map(pick);
  return { updatedAt: new Date(nowMs).toISOString(), count: visible.length, hot, latest };
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

export function publish(state, runs) {
  const dir = join(runs, 'pages');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(ROOT, 'site', 'index.html'), join(dir, 'index.html'));
  writeFileSync(join(dir, 'deals.json'), JSON.stringify(buildDeals(state)));
  writeFileSync(join(dir, '.nojekyll'), '');
  if (!existsSync(join(dir, '.git'))) {
    git(dir, 'init', '-q', '-b', 'gh-pages');
    git(dir, 'remote', 'add', 'origin', REMOTE);
  }
  git(dir, 'add', '-A');
  if (!git(dir, 'status', '--porcelain')) return false; // nothing changed
  git(dir, 'commit', '-q', '-m', `Update deals ${new Date().toISOString().slice(0, 16)}Z`);
  git(dir, 'push', '-q', '-u', 'origin', 'gh-pages');
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const runs = process.env.DEAL_RADAR_RUNS || join(ROOT, 'runs');
  const state = JSON.parse(readFileSync(join(runs, 'state.json'), 'utf8'));
  publish(state, runs);
  console.log('published');
}
