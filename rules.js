// 省钱规则: today's grab clock, platform browser, stacking calculator. No dependencies.
(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (v) => '¥' + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');

  // ---------- view switch (#rules / #deals) ----------
  function showView() {
    const deals = location.hash === '#deals';
    $('rules-view').hidden = deals;
    $('deals-view').hidden = !deals;
    $('go-rules').setAttribute('aria-selected', String(!deals));
    $('go-deals').setAttribute('aria-selected', String(deals));
  }
  addEventListener('hashchange', showView);
  showView();

  // ---------- data ----------
  let R = null;
  let group = store.get('r-group') || '';
  let plat = store.get('r-plat') || '';
  let tag = store.get('r-tag') || '';
  let clockAll = false;

  // Beijing time, whatever the visitor's own time zone is.
  function bjNow() {
    const d = new Date(Date.now() + 8 * 3600e3);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  function appliesToday(when, t) {
    if (!when) return false;
    if (/每天|每日|天天/.test(when)) return true;
    const wk = when.match(/(?:周|星期)([一二三四五六日天])/g);
    if (wk && wk.some((w) => WD[t.wd] === w.slice(-1).replace('天', '日'))) return true;
    const md = when.match(/每月\s*(\d{1,2})\s*[日号]/g);
    if (md && md.some((x) => Number(x.match(/\d+/)[0]) === t.d)) return true;
    const date = when.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (date && Number(date[1]) === t.y && Number(date[2]) === t.m && Number(date[3]) === t.d) return true;
    return false;
  }
  const toMin = (s) => {
    const m = String(s || '').match(/(\d{1,2})[:：](\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  function renderClock() {
    const t = bjNow();
    const items = [];
    for (const p of R.platforms) {
      for (const c of p.coupons) {
        for (const tm of c.times || []) {
          const min = toMin(tm.time);
          if (min == null || !appliesToday(tm.when, t)) continue;
          items.push({ min, time: tm.time.replace('：', ':'), p, c, note: tm.note });
        }
      }
    }
    items.sort((a, b) => a.min - b.min);
    const nextIdx = items.findIndex((x) => x.min >= t.min);
    $('today-hint').textContent = items.length
      ? `北京时间 ${String(Math.floor(t.min / 60)).padStart(2, '0')}:${String(t.min % 60).padStart(2, '0')} · 周${WD[t.wd]}。划掉的是今天已经过去的场次。`
      : `北京时间 周${WD[t.wd]}。这 ${R.platforms.length} 个平台现在都没有公开、固定的每日放券时间（查过官方说明和新闻，网上流传的“几点抢”说法互相矛盾）。大促前查到可靠时间会写在这里。`;
    // Show from a little before the next slot, so the list starts where it matters.
    let shown = items.map((x, i) => ({ ...x, i }));
    if (!clockAll && items.length > 8) {
      const from = Math.max(0, (nextIdx < 0 ? items.length : nextIdx) - 2);
      shown = shown.slice(from, from + 8);
    }
    $('clock').innerHTML =
      shown
        .map((x) => `<li class="${x.i === nextIdx ? 'next' : x.min < t.min ? 'past' : ''}">
        <span class="t">${esc(x.time)}</span>
        <span class="w">${esc(x.p.name)} · ${esc(x.c.name)}<small>${esc(x.c.tag)}${x.c.status === 'check' ? ' · ⚠️ 待核实' : ''}</small></span>
        <span class="d">${esc(x.note || x.c.howToGet)}</span></li>`)
        .join('') +
      (items.length > 8 ? `<li style="border:none;padding:0"><button type="button" class="more" id="clock-more">${clockAll ? '收起' : `看今天全部 ${items.length} 场`}</button></li>` : '');
    const more = $('clock-more');
    if (more) more.onclick = () => { clockAll = !clockAll; renderClock(); };
  }

  function chips(el, list, current, attr) {
    el.innerHTML = list
      .map(([v, label, n]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === current}">${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`)
      .join('');
    el.dataset.attr = attr;
  }

  function renderBrowser() {
    const groups = R.groups;
    if (!groups.some((g) => g.id === group)) group = groups[0].id;
    chips($('r-group'), groups.map((g) => [g.id, g.name]), group, 'group');
    const plats = R.platforms.filter((p) => p.group === group);
    if (!plats.some((p) => p.id === plat)) plat = plats[0]?.id ?? '';
    chips($('r-plat'), plats.map((p) => [p.id, p.name]), plat, 'plat');
    const p = R.platforms.find((x) => x.id === plat);
    if (!p) { $('platform').innerHTML = '<p class="empty">这个分类还在整理中。</p>'; return; }
    const count = (tg) => p.coupons.filter((c) => !tg || c.tag === tg).length;
    chips($('r-tag'), [['', '全部券', count('')], ['最划算', '💰 最划算', count('最划算')], ['刚需', '🧺 刚需', count('刚需')]], tag, 'tag');
    const coupons = p.coupons.filter((c) => !tag || c.tag === tag);
    const ex = p.example;
    $('platform').innerHTML = `<article class="pcard">
      <p class="sum">${esc(p.summary)}</p>
      <ol class="coupons">${coupons.map((c) => couponHtml(c, p)).join('') || '<li class="empty">这个类型暂时没有。</li>'}</ol>
      <details class="rules">
        <summary>想知道怎么叠加最省？看结账顺序和算账例子</summary>
        <ol class="order">${(p.stackOrder || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${ex ? `<div class="receipt"><div class="rt">${esc(ex.title)}</div>
          ${ex.steps.map((s) => `<div class="row${s.amount < 0 ? ' minus' : ''}"><span>${esc(s.label)}</span><span>${s.amount < 0 ? '−' + money(-s.amount) : money(s.amount)}</span></div>`).join('')}
          <div class="row total"><span>到手</span><span>${money(ex.final)}</span></div>
          ${ex.note ? `<div class="note">${esc(ex.note)}</div>` : ''}</div>` : ''}
      </details>
      <p class="srcs" style="font-size:12px;color:var(--pencil)">核实日期：${esc(p.verified)}</p>
    </article>`;
  }

  // "App → 首页 → 领券中心" or a sentence → short do-this steps.
  function stepsFor(c, p) {
    const parts = String(c.howToGet || '')
      .split(/\s*(?:→|->|＞|>|；|;|。)\s*/)
      .map((s) => s.replace(/^(?:在|进入?|打开)?\s*(?:淘宝|天猫|京东|拼多多|美团外卖|美团|饿了么|1688)?\s*App\s*/i, '').trim())
      .filter((s) => s && !/^App$/i.test(s));
    // "店铺首页 → 领券 → 或商品详情页 → 领券": keep the main path, mention the other way once.
    const alt = parts.findIndex((s) => /^或/.test(s));
    if (alt > 0) {
      const other = parts.slice(alt).join(' → ').replace(/^或\s*/, '');
      parts.splice(alt, parts.length - alt);
      parts[parts.length - 1] += `（也可以：${other}）`;
    }
    const app = p.open?.app || p.name;
    const first = p.id === 'jdlite' ? '打开京东极速版 App（没有就用京东 App）' : `打开${app} App`;
    return [first, ...parts].slice(0, 5);
  }

  function couponHtml(c, p) {
    const t0 = bjNow();
    const today = `${t0.y}-${String(t0.m).padStart(2, '0')}-${String(t0.d).padStart(2, '0')}`;
    // Dated slots that are already over (e.g. last 双11) only confuse people — hide them.
    const times = (c.times || [])
      .filter((t) => !/^\d{4}-\d{2}-\d{2}$/.test(t.when) || t.when >= today)
      .map((t) => `${t.when} ${t.time}${t.note ? `（${t.note}）` : ''}`)
      .join('；');
    const app = p.open?.app || p.name;
    const goLabel = /不用领|自动|不需要领/.test(c.howToGet || '') ? `去${app}看看` : `去${app}领取`;
    return `<li>
      <div class="nm">${esc(c.name)}<span class="stamp${c.tag === '最划算' ? ' hot' : ''}">${esc(c.tag)}</span>${c.status === 'check' ? '<span class="stamp check">⚠️ 以 App 为准</span>' : ''}</div>
      <ol class="steps">${stepsFor(c, p).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${times ? `<p class="when">⏰ ${esc(times)}</p>` : ''}
      ${p.open ? `<a class="go" href="${esc(p.open.url)}" target="_blank" rel="noopener noreferrer">${esc(goLabel)}</a>` : ''}
      <details class="why">
        <summary>能省多少？能和什么一起用？</summary>
        <dl>
          <dt>是什么</dt><dd>${esc(c.what)}</dd>
          <dt>能叠加</dt><dd>${esc(c.stack)}</dd>
          ${c.tips ? `<dt>小技巧</dt><dd>${esc(c.tips)}</dd>` : ''}
        </dl>
        <div class="srcs">来源：${(c.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(s.title)}</a>`).join('；')}</div>
      </details>
    </li>`;
  }

  for (const id of ['r-group', 'r-plat', 'r-tag']) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = b.dataset.v;
      const a = $(id).dataset.attr;
      if (a === 'group') { group = v; plat = ''; store.set('r-group', v); }
      if (a === 'plat') { plat = v; store.set('r-plat', v); }
      if (a === 'tag') { tag = v; store.set('r-tag', v); }
      renderBrowser();
    });
  }

  // ---------- calculator ----------
  const KINDS = {
    full: { label: '满 X 减 Y', a: '满', b: '减' },
    every: { label: '每满 X 减 Y', a: '每满', b: '减' },
    off: { label: '直接减 Y（无门槛 / 立减）', a: '', b: '减' },
    rate: { label: '打 X 折', a: '打', b: '折' },
  };
  let lines = [
    { name: '店铺券', kind: 'full', x: 150, y: 20 },
    { name: '跨店满减', kind: 'every', x: 300, y: 50 },
    { name: '支付立减', kind: 'off', x: 0, y: 5 },
  ];
  let price = 199;

  function calcBody() {
    $('calc-body').innerHTML = `
      <label for="c-price">商品原价（多件就填总价）</label>
      <input id="c-price" type="number" inputmode="decimal" min="0" step="0.01" value="${price}">
      <label>手上的券（按结账顺序从上往下用）</label>
      <div id="c-lines">${lines.map((l, i) => `<div class="line" data-i="${i}">
        <input aria-label="券名" data-k="name" value="${esc(l.name)}" style="width:110px">
        <select aria-label="券的类型" data-k="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === l.kind ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
        ${l.kind === 'off' ? '' : `<span>${KINDS[l.kind].a}</span><input aria-label="${KINDS[l.kind].a}" data-k="x" type="number" inputmode="decimal" min="0" step="0.01" value="${l.x}">`}
        ${l.kind === 'rate' ? '<span>折</span>' : `<span>减</span><input aria-label="减多少" data-k="y" type="number" inputmode="decimal" min="0" step="0.01" value="${l.y}">`}
        <button type="button" class="x" aria-label="删掉这张券" data-del="${i}">×</button></div>`).join('')}</div>
      <button type="button" class="add" id="c-add">+ 再加一张券</button>
      <div class="out" id="c-out"></div>`;
    $('c-price').oninput = (e) => { price = Number(e.target.value) || 0; calcOut(); };
    $('c-lines').oninput = $('c-lines').onchange = (e) => {
      const row = e.target.closest('.line');
      if (!row) return;
      const l = lines[row.dataset.i];
      const k = e.target.dataset.k;
      if (!k) return;
      if (k === 'name' || k === 'kind') l[k] = e.target.value; else l[k] = Number(e.target.value) || 0;
      if (k === 'kind') { if (l.kind === 'rate') l.x = 9; calcBody(); return; }
      calcOut();
    };
    $('c-lines').onclick = (e) => {
      const d = e.target.closest('[data-del]');
      if (d) { lines.splice(Number(d.dataset.del), 1); calcBody(); }
    };
    $('c-add').onclick = () => { lines.push({ name: '平台红包', kind: 'full', x: 99, y: 10 }); calcBody(); };
    calcOut();
  }

  function calcOut() {
    let left = price;
    const rows = [`<div class="row"><span>原价</span><span>${money(price)}</span></div>`];
    const tips = [];
    for (const l of lines) {
      let cut = 0;
      if (l.kind === 'full') {
        if (left >= l.x) cut = l.y; else if (l.x > 0) tips.push(`「${l.name}」还差 ${money(l.x - left)} 才能用（满 ${l.x} 减 ${l.y}），可以考虑凑单。`);
      } else if (l.kind === 'every') {
        if (l.x > 0) {
          const n = Math.floor(left / l.x);
          cut = n * l.y;
          const gap = (n + 1) * l.x - left;
          if (gap > 0 && gap <= l.x * 0.2) tips.push(`「${l.name}」再凑 ${money(gap)} 就能多减 ${money(l.y)}。`);
        }
      } else if (l.kind === 'off') cut = l.y;
      else if (l.kind === 'rate' && l.x > 0 && l.x < 10) cut = left * (1 - l.x / 10);
      cut = Math.min(cut, left);
      left -= cut;
      rows.push(`<div class="row${cut ? ' minus' : ''}"><span>${esc(l.name)}${cut ? '' : '（这次用不上）'}</span><span>${cut ? '−' + money(cut) : '—'}</span></div>`);
    }
    rows.push(`<div class="row total"><span>到手</span><span>${money(left)}</span></div>`);
    $('c-out').innerHTML = `<div class="receipt">${rows.join('')}${price ? `<div class="note">一共省了 ${money(price - left)}（${Math.round((1 - left / price) * 100)}%）。实际以结账页为准：有些券只算部分商品。</div>` : ''}</div>${tips.map((t) => `<p class="tip">💡 ${esc(t)}</p>`).join('')}`;
  }
  calcBody();

  // ---------- load ----------
  fetch('rules.json?t=' + Date.now(), { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => {
      R = d;
      renderClock();
      renderBrowser();
      setInterval(renderClock, 60 * 1000);
    })
    .catch(() => {
      $('today-hint').textContent = '暂时读不到规则数据，请稍后刷新页面。';
    });
})();
