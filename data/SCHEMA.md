# 省钱规则数据格式 (data/platforms/<id>.json)

Structure on the site: 大分类 (group) → 平台 (platform) → 券 (coupon), each coupon tagged
`最划算` (big savings, worth planning for) or `刚需` (everyday, use it all the time).

```jsonc
{
  "id": "taobao",                 // taobao | tmall | 1688 | jd | jdlite | pdd | meituan | meituan-waimai | eleme | eleme-waimai
  "name": "淘宝",
  "group": "shop",                // shop = 网购 | local = 外卖·本地生活
  "verified": "2026-11-19",       // date the facts were checked
  "summary": "一句话说明这个平台省钱的核心（≤40字）",
  "stackOrder": [                 // order discounts are applied at checkout, plain words
    "店铺券 / 商品券",
    "跨店满减（每满300减50）",
    "平台红包",
    "支付立减"
  ],
  "example": {                    // one worked example using stackOrder; numbers must add up
    "title": "买一件 199 元的衣服",
    "steps": [ { "label": "原价", "amount": 199 }, { "label": "店铺券", "amount": -20 }, { "label": "跨店满减", "amount": -25 } ],
    "final": 154,
    "note": "可选：说明前提条件"
  },
  "coupons": [
    {
      "name": "百亿补贴",
      "tag": "最划算",            // 最划算 | 刚需
      "what": "这是什么、能省多少（大白话，≤60字）",
      "howToGet": "在哪里领：App → 首页 → …（≤60字）",
      "stack": "能和什么叠加 / 不能和什么叠加（≤60字）",
      "times": [                  // fixed release times if publicly known; [] if none
        { "when": "每天", "time": "10:00", "note": "可选" }
        // when: 每天 | 周一..周日 | 每月X日 | 大促期间 | 具体日期 2026-11-11
      ],
      "tips": "抢券 / 使用技巧（≤60字）",
      "status": "ok",             // ok = confirmed by a source; check = unsure / may have changed
      "sources": [ { "title": "来源标题", "url": "https://…" } ]
    }
  ]
}
```

Rules: only facts from public sources (official rule/help pages first, then reputable news, then
recent user guides). Every coupon needs ≥1 source URL. Never invent times — use `[]` and
`status: "check"` when not sure. No affiliate / rebate / invite links or 口令. Simple Chinese.
