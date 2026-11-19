# deal-radar — notes for Claude

- Zero dependencies, Node 22. `npm run check` = tests (fixtures in `test/fixtures`, real pages).
- `npm run once` = one round; `npm start` = 24 h; set `DEAL_RADAR_RUNS=<dir>` to write elsewhere
  (use `../../tmp/...` for experiments, never the real `runs/`).
- `runs/` holds the trial state, log and `report.html`. Stop the trial: `stop.ps1`.
- Be gentle with sources. On 403 / verification pages back off — never bypass (mobile APIs, other
  endpoints, captcha tricks are off limits).
- Code map: `src/parse.js` (HTML/RSS), `src/clean.js` (rebate links, share codes, price),
  `src/score.js` (scoring, same-product match), `src/collector.js`, `src/report.js`.
