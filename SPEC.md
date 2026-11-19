# 线报雷达 (deal-radar) — SPEC

Goal: a public deal site for other users. It finds first-hand coupon / stacking "作业" posts by itself,
removes other people's rebate links and invite codes, works out the lowest final price (到手价), and
surfaces the best deals fast. No auto-grabbing of coupons and no collecting users' login data.

## Rules (decided with the user)
- Fully automatic discovery — no manual pasting.
- Read only public pages, gently (minutes between rounds). If a site refuses or asks for verification,
  back off and retry later. Never work around captchas, verification or access limits.
- Strip rebate / affiliate links and share codes (淘口令, pdd 口令, 助力/互点 comments).
- Down-rank cracked software, pirate video apps and bot scripts.
- Show summaries + link to the original post; don't copy whole posts.

## Milestones
- **M1 — 24 h trial collector (now).** Sources: 豆瓣 买组 (698716), 拼组 (536786), 什么值得买 RSS.
  Acceptance: runs 24 h unattended; report shows count, high-score deals, discovery delay,
  filtered spam/links; tests pass (`npm run check`).
- **M2 — decide sources.** From the trial data: is Douban usable without login? Add more public
  sources (more RSS deal feeds, Weibo deal accounts via visitor pages if stable).
- **M3 — public site.** GitHub Pages (account skot-chen) showing the live deal list, cheapest-first
  view, stacking steps; collector publishes JSON.
- **M4 — push alerts** for high-score deals.
