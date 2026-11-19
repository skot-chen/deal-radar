// Turn raw HTML / RSS from each source into plain objects. No dependencies.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

export function decode(s = '') {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTITIES[e]);
}

export function stripTags(html = '') {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Douban shows times in Beijing time (UTC+8). "11-19 14:51", "2024-08-05" or "2025-12-11 19:17:23". */
export function beijingTime(str, now = new Date()) {
  if (!str) return null;
  str = str.trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`).toISOString();
  }
  m = str.match(/^(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (m) {
    const bjNow = new Date(now.getTime() + 8 * 3600e3);
    let y = bjNow.getUTCFullYear();
    // A January run seeing "12-31" means last year.
    if (Number(m[1]) > bjNow.getUTCMonth() + 1) y -= 1;
    return new Date(`${y}-${m[1]}-${m[2]}T${m[3]}:${m[4]}:00+08:00`).toISOString();
  }
  return null;
}

/** Douban group "discussion" page → list of topics. */
export function parseDoubanList(html, now = new Date()) {
  const table = html.split('<table class="olt">')[1]?.split('</table>')[0] ?? '';
  const rows = table.split(/<tr class="[^"]*">/).slice(1);
  const out = [];
  for (const row of rows) {
    const a = row.match(/href="https:\/\/www\.douban\.com\/group\/topic\/(\d+)\/[^"]*" title="([^"]*)"/);
    if (!a) continue;
    const replies = Number(row.match(/class="r-count[^"]*">(\d*)</)?.[1] || 0);
    const lastReply = beijingTime(row.match(/class="time">([^<]+)</)?.[1], now);
    out.push({
      id: a[1],
      url: `https://www.douban.com/group/topic/${a[1]}/`,
      title: decode(a[2]),
      pinned: /title="置顶"/.test(row),
      replies,
      lastReply,
    });
  }
  return out;
}

/** Douban topic page → body text, creation time, comments on this page. */
export function parseDoubanTopic(html) {
  const created = html.match(/create-time[^>]*>([^<]+)</)?.[1] ?? html.match(/"dateCreated":\s*"([^"]+)"/)?.[1];
  const bodyHtml = html.split('class="rich-content topic-richtext">')[1]?.split('<link rel=')[0] ?? '';
  const links = [...bodyHtml.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1]));
  const comments = [];
  // Only the chronological list (#comments), not the duplicated "popular" block.
  const allPart = html.split('id="comments"')[1] ?? '';
  for (const chunk of allPart.split('class="clearfix comment-item reply-item"').slice(1)) {
    const cid = chunk.match(/data-cid="(\d+)"/)?.[1];
    const time = chunk.match(/class="pubtime">([^<]+)</)?.[1];
    const content = chunk.split('class="reply-content">')[1]?.split('</div>')[0] ?? '';
    // Quoted reply (reply-to) is a separate block; ignore it.
    if (cid) comments.push({ cid, time: beijingTime(time), text: stripTags(content) });
  }
  return { created: beijingTime(created), body: stripTags(bodyHtml), links, comments };
}

/** RSS 2.0 (什么值得买 etc.) → items. */
export function parseRss(xml) {
  const items = [];
  for (const chunk of xml.split('<item>').slice(1)) {
    const get = (tag) => {
      const m = chunk.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
      return m ? m[1].trim() : '';
    };
    const link = decode(get('link'));
    const pub = get('pubDate');
    items.push({
      id: link.match(/\/p\/(\d+)/)?.[1] ?? link,
      url: link,
      title: decode(get('title')),
      body: stripTags(get('description')).slice(0, 2000),
      // smzdm omits the zone; its times are Beijing time.
      created: pub ? new Date(/[+-]\d{4}|GMT|UTC/.test(pub) ? pub : `${pub} GMT+0800`).toISOString() : null,
    });
  }
  return items;
}
