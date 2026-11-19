# PROGRESS

## Done (2026-11-19)
- Parsers for Douban group list / topic and RSS; rebate-link + share-code cleaning; price extraction
  tuned on real titles; scoring (作业 tag, keywords, price, reply heat, comment lower price,
  cross-source match, piracy penalty). 9 tests green.
- Collector + HTML report. 24 h trial started 2026-11-19 07:17 UTC (pid in `runs/collector.pid`).

- Public site live: https://skot-chen.github.io/deal-radar/ (repo skot-chen/deal-radar, Pages from
  `gh-pages`). Report shows only 最热 / 最新 (user: scores are confusing). Collector runs with
  `--publish`: every 10 min it writes `runs/pages/deals.json` and pushes a normal commit to gh-pages
  (force-push/amend was refused by the safety check — don't reintroduce it).
- Test fixtures (real Douban pages) are local-only (gitignored); their tests skip in a fresh clone.

## Findings
- 什么值得买 RSS: works, ~30 items per fetch, titles include 到手价.
- Douban: lists readable at first; topic pages (body + comments) answered 403 "没有访问权限" after a
  few requests, then lists redirected to sec.douban.com verification. Collector backs off (30 / 60 min)
  and does not work around it. So comment mining ("评论区更低") is unavailable anonymously.
- Tieba: verification page → not used. Weibo: visitor passport needed → not tried yet.

## Next
- Read the trial report (`runs/report.html`), decide M2 sources with the user.
- Open question for the user: use a logged-in Douban account (their own, at their risk) or drop Douban?

## Known issues
- Price guess from free text is heuristic; some titles have no price.

## 2026-11-19 later
- Dropped 什么值得买 (user: low quality). Site now has group filter (买组/拼组), 11 categories
  (`src/category.js`), 20-per-page paging, refresh button; publishes every 5 min; Douban lists read with `type=new`.
- Optional login: user's spare Douban account cookie in `secrets/douban-cookie.txt` (git-ignored),
  saved by the user with `set-douban-cookie.ps1` (never via chat). Collector re-reads it and lifts pauses.
- WAITING: user will provide the spare account later. Until then Douban blocks visitors → site shows 0 items.
- GitHub prior art: gakkiismywife/douban_spider (watches 买组, rotates paid proxies — we won't),
  lesywix/douban_group_spy (needs login cookie, slow).

## 2026-11-19 省钱规则 (now the default view)
- `data/platforms/*.json` (format in `data/SCHEMA.md`, checked by `node src/rules.js` + tests): 10 platforms,
  大分类 网购 / 外卖·本地生活 → 平台 → 券 tagged 最划算 / 刚需. Site: `site/rules.js` (today's grab clock,
  platform browser, stacking calculator). Published as rules.json with the site.
- Research finding: almost no official rule pages are readable; most items are ⚠️ check (media / guides).
  No reliable fixed daily release times on any platform → clock shows an honest note. 双11-only times are
  marked `大促期间`, never `每天`.
- Next: re-verify before big sales (双12, 年货节, 618); fill times when reliable sources appear.
