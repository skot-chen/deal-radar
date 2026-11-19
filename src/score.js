// Decide how good a deal post looks, without a human telling us. Higher = better.

const HOT_WORDS = /(bug价?|神券|叠加|史低|历史最低|免单|(?<![\d.])0元|零元|白嫖|好价|速度|手慢无|大额券|隐藏券|漏洞|骨折|闭眼入|冲)/gi;
const SKIP_TITLE = /^【?(公告|组规|专楼|交流|求助|求|问|讨论|吐槽|晒单|出物|收物|出|收|转|置换|举报)】?/;
const PIRACY_WORDS = /(破解|激活版|激活码|盗版|绿色版|永久会员|免费看剧|看短剧|追剧神器|脚本|外挂|自动化)/;
const NEG_WORDS =/(广告|推广|代拍|代点|有偿|收费|拉群|加群|私聊|私我|vx|wx|微信号)/i;

/** Which posts are deal "homework" worth tracking. */
export function isDealPost(title) {
  if (/【作业】|\[作业\]|作业[｜|]/.test(title)) return true;
  if (SKIP_TITLE.test(title)) return false;
  return false;
}

/**
 * @param {object} p  { title, body, price, replies, ageHours, source, lowerInComments, shareCodes }
 * @returns {{score:number, reasons:string[]}}
 */
export function scorePost(p) {
  let score = 0;
  const reasons = [];
  const add = (n, why) => {
    score += n;
    reasons.push(`${n > 0 ? '+' : ''}${n} ${why}`);
  };
  const text = `${p.title} ${p.body ?? ''}`;

  if (p.source === 'douban' && /【作业】/.test(p.title)) add(2, '作业帖');
  const hot = new Set((text.match(HOT_WORDS) ?? []).map((w) => w.toLowerCase()));
  if (hot.size) add(Math.min(hot.size, 3), `关键词:${[...hot].slice(0, 3).join('/')}`);
  if (NEG_WORDS.test(p.title)) add(-3, '像广告/代拍');
  // Cracked software, pirate video apps and bot scripts are not deals we want to spread.
  if (PIRACY_WORDS.test(text)) add(-6, '疑似破解/盗版/脚本');

  if (p.price === 0) add(3, '0元');
  else if (p.price != null && p.price <= 5) add(2, `到手≤5元`);
  else if (p.price != null && p.price <= 20) add(1, `到手≤20元`);
  if (p.price == null) add(-1, '没写到手价');

  // Replies per hour: lots of people joining in fast = real and hot.
  if (p.replies != null && p.ageHours != null) {
    const rate = p.replies / Math.max(p.ageHours, 0.25);
    if (rate >= 30) add(3, `热度 ${rate.toFixed(0)}回复/小时`);
    else if (rate >= 10) add(2, `热度 ${rate.toFixed(0)}回复/小时`);
    else if (rate >= 3) add(1, `热度 ${rate.toFixed(0)}回复/小时`);
  }
  if (p.lowerInComments != null && (p.price == null || p.lowerInComments < p.price)) {
    add(2, `评论区更低 ${p.lowerInComments}元`);
  }
  if (p.otherSources) add(2, `${p.otherSources} 个来源同时出现`);
  return { score, reasons };
}

const STOP = /(到手|入手|好价|作业|最低|可以|包邮|优惠|叠加|领券|刷券|左右|一共|评论|区更|更低|元|块)/g;

/** Character pairs used to spot the same product across sources (Chinese has no spaces). */
export function productKey(title) {
  const t = title
    .replace(/【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, '')
    .replace(/^[^：:]{1,8}[：:]/, '') // "88VIP：" style prefixes
    .replace(/\d+(\.\d+)?/g, ' ')
    .replace(STOP, ' ')
    .replace(/[^一-龥a-z]/gi, ' ')
    .toLowerCase();
  const pairs = new Set();
  for (const part of t.split(/\s+/)) for (let i = 0; i + 1 < part.length; i++) pairs.add(part.slice(i, i + 2));
  return [...pairs];
}

/** Similarity of two product keys (0..1, Jaccard on character pairs). */
export function overlap(a, b) {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  let hit = 0;
  for (const w of a) if (sb.has(w)) hit++;
  return hit / (a.length + b.length - hit);
}
