# PROGRESS

## Done (2026-11-19)
- Parsers for Douban group list / topic and RSS; rebate-link + share-code cleaning; price extraction
  tuned on real titles; scoring (作业 tag, keywords, price, reply heat, comment lower price,
  cross-source match, piracy penalty). 9 tests green.
- Collector + HTML report. 24 h trial started 2026-11-19 07:17 UTC (pid in `runs/collector.pid`).

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
