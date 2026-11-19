import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseDoubanList, parseDoubanTopic, parseRss, beijingTime } from '../src/parse.js';
import { cleanLink, isInviteSpam, scrubText, extractPrice } from '../src/clean.js';
import { isDealPost, scorePost, productKey, overlap } from '../src/score.js';

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
// Saved real pages stay local (they contain other people's posts), so the public repo skips these.
const fxSkip = existsSync(new URL('./fixtures/group.html', import.meta.url)) ? false : 'local fixtures not present';

test('douban group list: topics, pinned, reply counts', { skip: fxSkip }, () => {
  const list = parseDoubanList(fx('group.html'), new Date('2026-11-19T08:00:00Z'));
  assert.ok(list.length >= 25, `got ${list.length}`);
  const pinned = list.filter((t) => t.pinned);
  assert.ok(pinned.length >= 3);
  assert.ok(list.some((t) => t.title.startsWith('【作业】')));
  for (const t of list) {
    assert.match(t.id, /^\d+$/);
    assert.ok(Number.isFinite(t.replies));
    assert.equal(t.url, `https://www.douban.com/group/topic/${t.id}/`);
  }
});

test('douban topic: created time, comments without the popular duplicate', { skip: fxSkip }, () => {
  const t = parseDoubanTopic(fx('topic.html'));
  assert.equal(t.created, '2025-12-11T11:17:23.000Z');
  assert.ok(t.comments.length >= 50);
  const ids = t.comments.map((c) => c.cid);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate comments');
  assert.ok(t.body.includes('互点'));
});

test('smzdm rss items', { skip: fxSkip }, () => {
  const items = parseRss(fx('smzdm.xml'));
  assert.ok(items.length >= 20);
  assert.ok(items[0].title.length > 5);
  assert.ok(items[0].created.endsWith('Z'));
});

test('beijing time conversions', () => {
  assert.equal(beijingTime('2026-11-19 15:01'), '2026-11-19T07:01:00.000Z');
  assert.equal(beijingTime('11-19 15:01', new Date('2026-11-19T08:00:00Z')), '2026-11-19T07:01:00.000Z');
  assert.equal(beijingTime('12-31 23:00', new Date('2027-01-01T01:00:00Z')), '2026-12-31T15:00:00.000Z');
});

test('rebate links are removed, product links cleaned', () => {
  assert.equal(cleanLink('https://s.click.taobao.com/abc').kind, 'rebate');
  assert.equal(cleanLink('https://u.jd.com/xYz').kind, 'rebate');
  assert.equal(cleanLink('https://mobile.yangkeduo.com/goods.html?goods_id=1&pid=123_456').kind, 'rebate');
  assert.equal(cleanLink('https://item.taobao.com/item.htm?id=123&ali_trackid=2:mm_1_2_3').kind, 'rebate');
  assert.deepEqual(cleanLink('https://item.taobao.com/item.htm?spm=a1.b&id=123'), {
    url: 'https://item.taobao.com/item.htm?id=123',
    kind: 'cleaned',
  });
  assert.deepEqual(cleanLink('https://item.m.jd.com/product/100012.html?utm_source=x'), {
    url: 'https://item.jd.com/100012.html',
    kind: 'cleaned',
  });
  assert.equal(cleanLink('https://www.douban.com/group/topic/1/').kind, 'clean');
});

test('invite / share-code comments are spam', () => {
  assert.ok(isInviteSpam('l:/⇥1HixyybDMKKgM⇤好事不忘你！拼多多百亿补贴5折红包就差你了！'));
  assert.ok(isInviteSpam('帮我点一下谢谢'));
  assert.ok(isInviteSpam('已点，求回点'));
  assert.ok(!isInviteSpam('我用了店铺券再叠加88会员，到手4.9元，比楼主低'));
  const s = scrubText('看这个 https://s.click.taobao.com/x 和 https://item.taobao.com/item.htm?id=9&spm=1');
  assert.equal(s.removed, 2);
  assert.ok(s.text.includes('[已去除返利链接]'));
  assert.ok(s.text.includes('https://item.taobao.com/item.htm?id=9'));
});

test('price extraction from real titles', () => {
  assert.equal(extractPrice('【作业】刷券格力高11包小饼干+loopy收纳箱到手5.68'), 5.68);
  assert.equal(extractPrice('【作业】科瑞德吹风机4060好价，到手140左右'), 140);
  assert.equal(extractPrice('【作业】14.6💰6瓶水卫士洗衣机清洗剂'), 14.6);
  assert.equal(extractPrice('【作业】3元入手2支滋色隔离 最低可以零元购'), 0);
  assert.equal(extractPrice('【作业】好吃的饼干8盒加收纳箱一共11元，评论区更低5元'), 11);
  assert.equal(extractPrice('88VIP：江中猴姑饼干120g 9.4元（淘金币到手7.81元）'), 7.81);
  assert.equal(extractPrice('【作业】酷态科cp12充电宝到手40+'), 40);
  assert.equal(extractPrice('随便聊聊'), null);
  assert.equal(extractPrice('【作业】雅鹿电热毯33r，刷券，棉绒的'), 33);
  assert.equal(extractPrice('【作业】23.7r买42根台湾烤肠 大概0.57一根 好价'), 23.7);
  assert.equal(extractPrice('【作业】母婴类刷券-酷骑扭扭车N3 88左右'), 88);
  assert.equal(extractPrice('【作业】20不到1500g金味麦片'), 20);
  assert.equal(extractPrice('【作业】秘密世界内裤4.3一条，需刷券'), 4.3);
  assert.equal(extractPrice('【作业】刷券好价四层全碳钢小推车10r不到'), 10);
  assert.equal(extractPrice('京东 领券缴费 领满120减3元/80减2元 生活缴费券 领3元生活缴费券'), null);
  assert.equal(extractPrice('【作业】4.21两人组队可以领6-5叠加券！！！'), null);
  assert.equal(extractPrice('【作业】探路者户外1折，很多几十块衣服'), null);
  assert.equal(extractPrice('【作业】keep哑铃2kg  10元'), 10);
});

test('deal detection and scoring', () => {
  assert.ok(isDealPost('【作业】酷态科cp12充电宝到手40+'));
  assert.ok(!isDealPost('【专楼】外卖券交易专用'));
  const hot = scorePost({ source: 'douban', title: '【作业】bug价 0元购', price: 0, replies: 60, ageHours: 1 });
  const cold = scorePost({ source: 'douban', title: '【作业】一般的东西', price: 89, replies: 1, ageHours: 5 });
  assert.ok(hot.score > cold.score + 5, JSON.stringify({ hot, cold }));
  assert.ok(scorePost({ source: 'douban', title: '【作业】x', price: 10, lowerInComments: 5 }).reasons.some((r) => r.includes('评论区更低')));
});

test('same product across sources is detected', () => {
  const a = productKey('【作业】刷券格力高11包小饼干+loopy收纳箱到手5.68');
  const b = productKey('格力高 百醇饼干 11包 + loopy收纳箱 5.9元');
  const c = productKey('科瑞德吹风机4060好价');
  assert.ok(overlap(a, b) > 0.25, String(overlap(a, b)));
  assert.ok(overlap(a, c) < 0.1);
});
