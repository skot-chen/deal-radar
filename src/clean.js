// Remove other people's rebate / invite links and codes, and pull prices out of text.

// Links that pay the sharer a commission (返利 / 推广).
const REBATE_HOSTS = [
  /(^|\.)s\.click\.taobao\.com$/,
  /(^|\.)uland\.taobao\.com$/,
  /(^|\.)u\.jd\.com$/,
  /(^|\.)union-click\.jd\.com$/,
  /(^|\.)union\.jd\.com$/,
  /(^|\.)p\.pinduoduo\.com$/,
  /(^|\.)duo\.pinduoduo\.com$/,
  /(^|\.)mobile\.yangkeduo\.com$/, // only when it carries a promotion id, see below
  /(^|\.)dpurl\.cn$/,
  /(^|\.)t\.cn$/,
  /(^|\.)url\.cn$/,
  /(^|\.)suo\.im$/,
  /(^|\.)go\.smzdm\.com$/,
];
const REBATE_PARAMS = /(^|[?&])(pid|unionId|union_id|customParameters|e|ali_trackid|mm_\w+|pdduid|_x_share_id|share_uin|refer_share_id)=/i;
const TRACKING_PARAMS = /^(spm|_spm_id|scm|utm_\w+|from|share\w*|tracelog|trackid|sourceType|abbucket|ns|ttid|sp_tk|xhsshare|app_platform)$/i;

/** Returns { url, kind } where kind is 'clean' | 'cleaned' | 'rebate'. */
export function cleanLink(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { url: null, kind: 'rebate' };
  }
  const host = u.hostname.toLowerCase();
  const promoYangkeduo = /yangkeduo\.com$/.test(host) && REBATE_PARAMS.test(u.search);
  if (REBATE_HOSTS.some((r) => r.test(host)) && (!/yangkeduo\.com$/.test(host) || promoYangkeduo)) {
    return { url: null, kind: 'rebate' };
  }
  if (/mm_\d+_\d+/.test(raw)) return { url: null, kind: 'rebate' };

  // Rebuild well-known product links in their bare official form.
  const id = u.searchParams.get('id');
  if (/(^|\.)(item\.taobao|detail\.tmall)\.com$/.test(host) && id) {
    return { url: `https://${host}/item.htm?id=${id}`, kind: u.search === `?id=${id}` ? 'clean' : 'cleaned' };
  }
  if (/(^|\.)item(\.m)?\.jd\.com$/.test(host)) {
    const sku = u.pathname.match(/(\d+)\.html/)?.[1];
    if (sku) return { url: `https://item.jd.com/${sku}.html`, kind: u.search ? 'cleaned' : 'clean' };
  }
  const before = u.toString();
  for (const k of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(k) || REBATE_PARAMS.test(`?${k}=`)) u.searchParams.delete(k);
  }
  const after = u.toString();
  return { url: after, kind: after === before ? 'clean' : 'cleaned' };
}

// Share codes / invite requests ("口令", "助力", "帮我点").
const CODE_PATTERNS = [
  /[⇥￥€$₤¢₳(（]?\s*[0-9a-z]{0,3}:?\/?\s*[⇥￥€₤¢₳][A-Za-z0-9]{8,}[⇤￥€₤¢₳]/, // 淘口令 / pdd 口令
  /[✂-➰]?[A-Za-z0-9]{10,}\s*(复制|打开|淘宝|拼多多|抖音|京东)/,
  /复制(这|此)?(条|段)?(信息|口令|内容)/,
  /(打开|去)(淘宝|拼多多|京东|抖音|美团)\s*(APP|app)?\s*(查看|领取|助力)/,
];
const INVITE_WORDS = /(助力|帮(我|忙)?点|互点|砍一刀|帮砍|就差你|好事不忘你|求点|点一下|已点|回点|互助|戳我|邀请码|返利|返佣|佣金|私我|私信我)/;

export function hasShareCode(text) {
  return CODE_PATTERNS.some((r) => r.test(text));
}

/** True if a comment is mainly someone asking for clicks / pushing their own code. */
export function isInviteSpam(text) {
  const t = text.replace(/\s+/g, '');
  if (!t) return true;
  if (hasShareCode(t)) return true;
  if (INVITE_WORDS.test(t) && t.length < 60) return true;
  return false;
}

/** Remove share codes and rebate links from free text (keep the rest readable). */
export function scrubText(text) {
  let removed = 0;
  let out = text;
  for (const r of CODE_PATTERNS) {
    const g = new RegExp(r.source, 'g');
    out = out.replace(g, () => {
      removed++;
      return '[已去除口令]';
    });
  }
  out = out.replace(/https?:\/\/[^\s"'<>，。）)]+/g, (m) => {
    const c = cleanLink(m);
    if (c.kind === 'rebate') {
      removed++;
      return '[已去除返利链接]';
    }
    if (c.kind === 'cleaned') removed++;
    return c.url;
  });
  return { text: out, removed };
}

const NUM = '(\\d+(?:\\.\\d+)?)';
const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/**
 * Best guess at the final price the poster paid ("到手价"). Returns a number or null.
 * Preference: explicit 到手/实付/最低 > 💰 > "X元" (lowest).
 */
export function extractPrice(text) {
  if (!text) return null;
  let t = text.replace(/[，,](?=\d{3}\b)/g, ''); // 1,299 → 1299
  if (/(零|(?<![\d.])0)\s*元\s*(购|撸|拿|入|得)|免费(拿|领|得|喝|吃)|白嫖|免单/.test(t)) return 0;
  // Coupon values and thresholds are not the final price: "满120减3元", "5元无门槛券", "6-5叠加券".
  t = t
    .replace(/满?\s*\d+(\.\d+)?\s*(元)?\s*减\s*\d+(\.\d+)?\s*(元)?/g, ' ')
    .replace(/\d+(\.\d+)?\s*[-－]\s*\d+(\.\d+)?\s*(叠加)?券/g, ' ')
    .replace(/\d+(\.\d+)?\s*元?\s*[一-龥]{0,6}?(券|红包|立减金|津贴|补贴)/g, ' ')
    .replace(/\d+(\.\d+)?\s*折/g, ' ')
    .replace(/几十/g, ' ');
  const strong = [
    new RegExp(`(?:到手价?|实付|最低|只要|仅需?|才|合计|一共|总共|共)\\s*[:：约]?\\s*[¥￥]?\\s*${NUM}`, 'g'),
    new RegExp(`${NUM}\\s*(?:元|块|r|R)?\\s*(?:到手|入手|拿下)`, 'g'),
    // "88左右", "20不到", "10r不到"
    new RegExp(`${NUM}\\s*(?:元|块|r|R)?\\s*(?:左右|不到|以内|出头)`, 'g'),
    // "33r", "23.7r买" — r = 元 in shopping slang
    new RegExp(`(?<![a-zA-Z])${NUM}\\s*[rR](?![a-zA-Z])`, 'g'),
    // "4.3一条", "0.57一根" (unit price)
    new RegExp(`${NUM}\\s*(?:元|块)?\\s*(?:一|1)\\s*(?:条|个|件|瓶|包|支|盒|杯|根|斤|袋|箱|罐|双|只|片)`, 'g'),
    // "2件28" (quantity then total)
    new RegExp(`(?:\\d+|两|二|三)\\s*(?:件|个|支|瓶|包|盒|条|双)\\s*${NUM}(?!\\s*(?:g|ml|cm|mm|kg|米|克|斤|寸|L))`, 'gi'),
    // "搬运0.01遮瑕": a bare cents price
    /(?<![\d.])(0\.\d{1,2})(?=\s*[一-龥])/g,
  ];
  for (const r of strong) {
    const vals = [...t.matchAll(r)].map((m) => Number(m[1])).filter((v) => v >= 0 && v < 100000);
    if (vals.length) return Math.min(...vals);
  }
  // "14.6💰6瓶": the number before 💰 is the price, so try that form first.
  const before = [...t.matchAll(new RegExp(`${NUM}\\s*💰`, 'g'))].map((m) => Number(m[1]));
  if (before.length) return Math.min(...before);
  const money = [...t.matchAll(new RegExp(`💰\\s*${NUM}|[¥￥]\\s*${NUM}|${NUM}\\s*(?:元|块钱?)`, 'g'))]
    .map((m) => Number(m[1] ?? m[2] ?? m[3]))
    .filter((v) => v >= 0 && v < 100000);
  if (money.length) return Math.min(...money);
  const cn = t.match(/([一二两三四五六七八九十])\s*(?:块|元)/);
  if (cn) return CN_DIGITS[cn[1]];
  return null;
}
