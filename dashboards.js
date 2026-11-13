/* Interactive dashboard demos (sample data) with video-style guided walkthroughs */
(() => {
const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STEP_MS = 4200;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sum = a => a.reduce((x, y) => x + y, 0);
const pick = (arr, idx) => idx.map(i => arr[i]);
const fmt = v => Math.abs(v) >= 1000 ? `EGP ${(v / 1000).toFixed(2)}M` : `EGP ${Math.round(v)}K`;
const fmtShort = v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}M` : `${Math.round(v)}K`;
const pct = v => `${(v * 100).toFixed(1)}%`;

function s(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) {
    const v = attrs[k];
    if ((k === 'fill' || k === 'stroke') && String(v).startsWith('var(')) n.style[k] = v; else n.setAttribute(k, v);
  }
  if (parent) parent.appendChild(n);
  return n;
}
function h(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function css(el, name) { return getComputedStyle(el).getPropertyValue(name).trim(); }

/* ---------- tooltip ---------- */
const tip = h('div', 'viz-tip', document.body);
tip.setAttribute('role', 'tooltip'); tip.dir = 'ltr';
function showTip(x, y, title, rows) {
  tip.replaceChildren();
  h('div', 'tt-title', tip, title);
  rows.forEach(r => {
    const row = h('div', 'tt-row', tip);
    const key = h('i', 'tt-key', row); key.style.background = r.color;
    h('strong', '', row, r.value);
    h('span', '', row, r.name);
  });
  tip.classList.add('show');
  const w = tip.offsetWidth, ht = tip.offsetHeight;
  let left = x + 14, top = y - ht - 12;
  if (left + w > innerWidth - 8) left = x - w - 14;
  if (top < 8) top = y + 16;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = top + 'px';
}
function hideTip() { tip.classList.remove('show'); }
addEventListener('scroll', hideTip, { passive: true });

/* rounded-end bar paths (4px on the data end only) */
function vBar(x, y, w, hgt, r = 4) {
  r = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}
function hBar(x, y, w, hgt, r = 4) {
  r = Math.min(r, hgt / 2, w);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt - r}Q${x + w},${y + hgt} ${x + w - r},${y + hgt}H${x}Z`;
}

/* ---------- line chart (crosshair + tooltip) ---------- */
function lineChart(host, { labels, series, height = 230 }) {
  host.replaceChildren();
  const W = Math.max(host.clientWidth, 280), H = height;
  const m = { l: 46, r: series.length > 1 ? 74 : 16, t: 12, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(Math.max(...series.flatMap(x => x.values)) * 1.05);
  const X = i => m.l + (labels.length === 1 ? iw / 2 : (i * iw) / (labels.length - 1));
  const Y = v => m.t + ih - (v / max) * ih;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz' }, host);
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k, y = Y(v);
    s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: k ? 'grid' : 'axis' }, svg);
    s('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = fmtShort(v);
  }
  const step = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 44)));
  labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) s('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', class: 'tick' }, svg).textContent = l; });
  const ends = [];
  series.forEach(se => {
    const d = se.values.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join('');
    const p = s('path', { d, class: 'line', stroke: se.color }, svg);
    if (!reduce) { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; requestAnimationFrame(() => { p.style.transition = 'stroke-dashoffset 1s ease'; p.style.strokeDashoffset = 0; }); }
    if (labels.length <= 6) se.values.forEach((v, i) => s('circle', { cx: X(i), cy: Y(v), r: 4, fill: se.color, class: 'pt' }, svg));
    ends.push({ y: Y(se.values[se.values.length - 1]), name: se.name });
  });
  if (series.length > 1) {
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach(e => s('text', { x: X(labels.length - 1) + 8, y: e.y + 4, class: 'end-label' }, svg).textContent = e.name);
  }
  const cross = s('line', { y1: m.t, y2: m.t + ih, class: 'cross', visibility: 'hidden' }, svg);
  const dots = series.map(se => s('circle', { r: 5, fill: se.color, class: 'hover-dot', visibility: 'hidden' }, svg));
  const hit = s('rect', { x: m.l - 10, y: m.t, width: iw + 20, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': 'Chart: use arrow keys to read values' }, svg);
  let cur = -1;
  function hover(i) {
    if (i < 0) { cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); hideTip(); cur = -1; return; }
    cur = i;
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
    series.forEach((se, k) => { dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(se.values[i])); dots[k].setAttribute('visibility', 'visible'); });
    const r = svg.getBoundingClientRect(), sc = r.width / W;
    showTip(r.left + X(i) * sc, r.top + Y(Math.max(...series.map(se => se.values[i]))) * sc, labels[i], series.map(se => ({ color: se.color, name: se.name, value: fmt(se.values[i]) })));
  }
  hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) * (W / r.width); hover(Math.max(0, Math.min(labels.length - 1, Math.round(((x - m.l) / iw) * (labels.length - 1))))); });
  hit.addEventListener('pointerleave', () => hover(-1));
  hit.addEventListener('blur', () => hover(-1));
  hit.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); hover(Math.max(0, Math.min(labels.length - 1, (cur < 0 ? 0 : cur) + (e.key === 'ArrowRight' ? 1 : -1)))); } });
  function pos(i) { const r = svg.getBoundingClientRect(), sc = r.width / W; return { x: r.left + X(i) * sc, y: r.top + Y(series[0].values[i]) * sc }; }
  return { hover, pos, el: svg };
}

/* ---------- bar chart (vertical / horizontal, single or grouped) ---------- */
function barChart(host, { cats, series, horizontal = false, colors, valueLabels = true, height, dim = [] }) {
  host.replaceChildren();
  const W = Math.max(host.clientWidth, 280);
  const H = height || (horizontal ? cats.length * 34 + 14 : 230);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'viz' }, host);
  const all = series.flatMap(x => x.values);
  const max = niceMax(Math.max(...all) * (horizontal ? 1.18 : 1.1));
  const marks = [];
  const tipFor = (i, el) => {
    const r = el.getBoundingClientRect();
    showTip(r.left + r.width / 2, r.top, cats[i], series.map((se, k) => ({ color: colors ? colors[i] : se.color, name: se.name, value: fmt(se.values[i]) })));
  };
  if (horizontal) {
    const labelW = Math.min(140, W * (W < 460 ? 0.42 : 0.34)), m = { l: labelW, r: 12, t: 4 };
    const iw = W - m.l - m.r, band = (H - m.t - 10) / cats.length, bh = Math.min(20, band - 8);
    cats.forEach((c, i) => {
      const y = m.t + i * band + (band - bh) / 2, v = series[0].values[i], w = Math.max(2, (v / max) * iw);
      const g = s('g', { class: 'bar-g' + (dim.includes(i) ? ' dim' : ''), tabindex: 0 }, svg);
      s('rect', { x: 0, y: m.t + i * band, width: W, height: band, fill: 'transparent' }, g);
      s('text', { x: m.l - 10, y: y + bh / 2 + 4, 'text-anchor': 'end', class: 'cat' }, g).textContent = c;
      const p = s('path', { d: hBar(m.l, y, w, bh), fill: colors ? colors[i] : series[0].color, class: 'bar' }, g);
      if (!reduce) { p.style.transformOrigin = `${m.l}px 0`; p.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', delay: i * 60, fill: 'backwards' }); }
      if (valueLabels) s('text', { x: m.l + w + 6, y: y + bh / 2 + 4, class: 'val' }, g).textContent = fmtShort(v);
      g.addEventListener('pointerenter', () => tipFor(i, p)); g.addEventListener('focus', () => tipFor(i, p));
      g.addEventListener('pointerleave', hideTip); g.addEventListener('blur', hideTip);
      marks.push(p);
    });
    s('line', { x1: m.l, x2: m.l, y1: 0, y2: H - 6, class: 'axis' }, svg);
  } else {
    const m = { l: 46, r: 10, t: 18, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const Y = v => m.t + ih - (v / max) * ih;
    for (let k = 0; k <= 4; k++) { const v = (max / 4) * k; s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: k ? 'grid' : 'axis' }, svg); s('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = fmtShort(v); }
    const band = iw / cats.length, n = series.length, gap = 2;
    const bw = Math.min(n > 1 ? 16 : 46, (band * 0.7 - gap * (n - 1)) / n);
    const step = Math.ceil(cats.length / Math.max(2, Math.floor(iw / 40)));
    cats.forEach((c, i) => {
      const g = s('g', { class: 'bar-g', tabindex: 0 }, svg);
      s('rect', { x: m.l + i * band, y: m.t, width: band, height: ih, fill: 'transparent' }, g);
      const x0 = m.l + i * band + (band - (bw * n + gap * (n - 1))) / 2;
      let topEl;
      series.forEach((se, k) => {
        const v = se.values[i], y = Y(v), hh = m.t + ih - y;
        const p = s('path', { d: vBar(x0 + k * (bw + gap), y, bw, Math.max(hh, 1)), fill: colors ? colors[i] : se.color, class: 'bar' }, g);
        if (!reduce) { p.style.transformOrigin = `0 ${m.t + ih}px`; p.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', delay: i * 40, fill: 'backwards' }); }
        if (!topEl || y < topEl.y) topEl = { p, y };
        if (valueLabels && n === 1) s('text', { x: x0 + bw / 2, y: y - 6, 'text-anchor': 'middle', class: 'val' }, g).textContent = fmtShort(v);
      });
      if (i % step === 0 || i === cats.length - 1) s('text', { x: m.l + i * band + band / 2, y: H - 6, 'text-anchor': 'middle', class: 'tick' }, g).textContent = c;
      g.addEventListener('pointerenter', () => tipFor(i, topEl.p)); g.addEventListener('focus', () => tipFor(i, topEl.p));
      g.addEventListener('pointerleave', hideTip); g.addEventListener('blur', hideTip);
      marks.push(topEl.p);
    });
  }
  return { hover(i) { if (i < 0) return hideTip(); tipFor(i, marks[i]); }, el: svg };
}

/* ---------- dashboard definitions (sample data) ---------- */
const DASHES = [
  {
    id: 'fin', tool: 'excel', toolName: 'Excel', file: 'Financial_Performance.xlsx',
    title: 'Financial Performance Dashboard',
    blurb: 'Revenue, expenses and profitability by month and quarter.',
    slicers: [{ key: 'period', label: 'Period', options: ['FY', 'Q1', 'Q2', 'Q3', 'Q4'] }],
    state: { period: 'FY' },
    data: {
      rev: [820, 760, 905, 880, 940, 1010, 980, 1050, 1120, 1080, 1160, 1240],
      exp: [690, 655, 720, 735, 760, 790, 800, 815, 850, 860, 880, 930],
      cats: [['Salaries & wages', .34], ['Cost of sales', .27], ['Admin & general', .11], ['Rent', .11], ['Marketing', .10], ['Utilities', .07]]
    },
    calc(st) {
      const P = { FY: [...Array(12).keys()], Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11] };
      const idx = P[st.period], prevKey = { Q2: 'Q1', Q3: 'Q2', Q4: 'Q3' }[st.period];
      const R = sum(pick(this.data.rev, idx)), E = sum(pick(this.data.exp, idx));
      const prev = prevKey ? { R: sum(pick(this.data.rev, P[prevKey])), E: sum(pick(this.data.exp, P[prevKey])) } : null;
      return { idx, R, E, NP: R - E, M: (R - E) / R, prev, prevKey, label: st.period === 'FY' ? 'the full year' : st.period };
    },
    kpis(c) {
      const d = (a, b, good = 1) => c.prev ? { v: (a - b) / b, good } : null;
      return [
        { name: 'Revenue', value: fmt(c.R), delta: d(c.R, c.prev?.R) },
        { name: 'Expenses', value: fmt(c.E), delta: d(c.E, c.prev?.E, -1) },
        { name: 'Net profit', value: fmt(c.NP), delta: c.prev ? d(c.NP, c.prev.R - c.prev.E) : null },
        { name: 'Net margin', value: pct(c.M), delta: c.prev ? { v: c.M - (c.prev.R - c.prev.E) / c.prev.R, good: 1, pts: true } : null }
      ];
    },
    charts(c) {
      const cats = this.data.cats.map(([n, sh]) => [n, c.E * sh]).sort((a, b) => b[1] - a[1]);
      return [
        { key: 'trend', title: 'Revenue vs expenses by month', wide: false, type: 'line',
          spec: { labels: pick(MONTHS, c.idx), series: [{ name: 'Revenue', values: pick(this.data.rev, c.idx), color: 'var(--s1)' }, { name: 'Expenses', values: pick(this.data.exp, c.idx), color: 'var(--s2)' }] },
          legend: [['Revenue', 's1', 'line'], ['Expenses', 's2', 'line']] },
        { key: 'cats', title: 'Expenses by category', type: 'bar',
          spec: { cats: cats.map(x => x[0]), series: [{ name: 'Expenses', values: cats.map(x => x[1]), color: 'var(--s1)' }], horizontal: true } }
      ];
    },
    insights(c) {
      const rev = pick(this.data.rev, c.idx), best = rev.indexOf(Math.max(...rev));
      const out = [`Revenue for ${c.label} is ${fmt(c.R)} against expenses of ${fmt(c.E)}, leaving a net profit of ${fmt(c.NP)}.`];
      if (c.prev) { const g = (c.R - c.prev.R) / c.prev.R; out.push(`Revenue is ${g >= 0 ? 'up' : 'down'} ${pct(Math.abs(g))} versus ${c.prevKey}.`); }
      out.push(`Net margin is ${pct(c.M)}, ${c.M >= .15 ? 'above' : 'below'} a 15% target.`);
      out.push(`${MONTHS[c.idx[best]]} was the strongest month at ${fmt(rev[best])}.`);
      out.push(`Salaries & wages are the largest cost (34% of expenses), so they are the biggest lever for improving margin.`);
      return out;
    },
    script: [
      { cap: 'Full-year view: revenue, expenses, profit and margin at a glance.', state: { period: 'FY' }, target: '.kpis' },
      { cap: 'Hover the trend to read any month. Both series show in one tooltip.', state: { period: 'FY' }, hover: ['trend', 9] },
      { cap: 'Slice by quarter. Every visual updates together.', state: { period: 'Q2' }, click: '[data-opt="Q2"]' },
      { cap: 'Q4: compared automatically with the previous quarter.', state: { period: 'Q4' }, click: '[data-opt="Q4"]' },
      { cap: 'Salaries & wages are the largest expense category.', state: { period: 'Q4' }, hover: ['cats', 0] },
      { cap: 'AI Insights writes a plain-English summary of the current view.', state: { period: 'Q4' }, click: '.ai-btn', ai: true },
      { cap: 'Back to the full year. Now explore it yourself.', state: { period: 'FY' }, click: '[data-opt="FY"]' }
    ]
  },
  {
    id: 'ar', tool: 'pbi', toolName: 'Power BI', file: 'AR_Aging.pbix',
    title: 'Accounts Receivable & Collections',
    blurb: 'Aging buckets, overdue exposure, DSO and collection trends by customer segment.',
    slicers: [{ key: 'seg', label: 'Segment', options: ['All', 'Wholesale', 'Retail', 'Hotels'] }],
    state: { seg: 'All' },
    data: {
      buckets: ['Current', '1–30', '31–60', '61–90', '90+'],
      aging: { Wholesale: [420, 260, 140, 70, 45], Retail: [180, 120, 60, 35, 28], Hotels: [240, 150, 95, 55, 62] },
      top: { Wholesale: [['W-104', 210], ['W-117', 165], ['W-109', 120], ['W-122', 95], ['W-131', 80]], Retail: [['R-208', 72], ['R-215', 60], ['R-203', 48], ['R-221', 40], ['R-230', 33]], Hotels: [['H-305', 150], ['H-312', 118], ['H-301', 90], ['H-318', 70], ['H-309', 58]] },
      coll: { Wholesale: [300, 320, 310, 350, 360, 340, 370, 390, 380, 400, 410, 430], Retail: [150, 140, 160, 155, 165, 170, 160, 175, 180, 170, 185, 190], Hotels: [200, 210, 190, 230, 250, 260, 240, 220, 210, 230, 250, 270] },
      sales: { Wholesale: 5200, Retail: 2300, Hotels: 3400 }
    },
    calc(st) {
      const segs = st.seg === 'All' ? ['Wholesale', 'Retail', 'Hotels'] : [st.seg];
      const add = (k) => this.data[k][segs[0]].map((_, i) => sum(segs.map(sg => this.data[k][sg][i])));
      const aging = add('aging'), coll = add('coll');
      const top = segs.flatMap(sg => this.data.top[sg]).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const AR = sum(aging), over = sum(aging.slice(2)), sales = sum(segs.map(sg => this.data.sales[sg]));
      return { segs, aging, coll, top, AR, over, dso: AR / (sales / 365), label: st.seg === 'All' ? 'all segments' : st.seg };
    },
    kpis(c) {
      return [
        { name: 'Total receivables', value: fmt(c.AR) },
        { name: 'Overdue > 30 days', value: pct(c.over / c.AR), note: fmt(c.over) },
        { name: 'DSO', value: `${Math.round(c.dso)} days`, note: c.dso > 45 ? 'Above 45-day target' : 'Within 45-day target', status: c.dso > 45 ? 'bad' : 'good' },
        { name: 'Collected in Dec', value: fmt(c.coll[11]), delta: { v: (c.coll[11] - c.coll[10]) / c.coll[10], good: 1 } }
      ];
    },
    charts(c) {
      return [
        { key: 'aging', title: 'Receivables by aging bucket', type: 'bar',
          spec: { cats: this.data.buckets, series: [{ name: 'Balance', values: c.aging, color: 'var(--s1)' }], colors: ['var(--o1)', 'var(--o2)', 'var(--o3)', 'var(--o4)', 'var(--o5)'] } },
        { key: 'top', title: 'Top 5 customers by balance', type: 'bar',
          spec: { cats: c.top.map(t => 'Customer ' + t[0]), series: [{ name: 'Balance', values: c.top.map(t => t[1]), color: 'var(--s1)' }], horizontal: true } },
        { key: 'coll', title: 'Monthly collections', wide: true, type: 'line',
          spec: { labels: MONTHS, series: [{ name: 'Collections', values: c.coll, color: 'var(--s1)' }], height: 200 } }
      ];
    },
    insights(c) {
      const l3 = sum(c.coll.slice(9)), p3 = sum(c.coll.slice(6, 9)), g = (l3 - p3) / p3;
      const share = c.top[0][1] / c.AR;
      return [
        `Total receivables for ${c.label} are ${fmt(c.AR)}, and ${pct(c.over / c.AR)} (${fmt(c.over)}) is overdue by more than 30 days.`,
        `The 90+ bucket holds ${fmt(c.aging[4])}. Prioritise these accounts for collection calls and review them for a doubtful-debt provision.`,
        `Customer ${c.top[0][0]} alone is ${pct(share)} of the balance${share > .15 ? ', a concentration risk worth monitoring' : ''}.`,
        `DSO is ${Math.round(c.dso)} days, ${c.dso > 45 ? 'above' : 'within'} the 45-day target.`,
        `Collections in the last quarter are ${g >= 0 ? 'up' : 'down'} ${pct(Math.abs(g))} on the previous quarter.`
      ];
    },
    script: [
      { cap: 'All segments: total receivables, overdue share, DSO and latest collections.', state: { seg: 'All' }, target: '.kpis' },
      { cap: 'The aging chart shows where the overdue money sits.', state: { seg: 'All' }, hover: ['aging', 4] },
      { cap: 'Filter to Hotels. All visuals update together.', state: { seg: 'Hotels' }, click: '[data-opt="Hotels"]' },
      { cap: 'The biggest balances to follow up on, ranked.', state: { seg: 'Hotels' }, hover: ['top', 0] },
      { cap: 'Collections trend: read any month from the tooltip.', state: { seg: 'Hotels' }, hover: ['coll', 11] },
      { cap: 'AI Insights flags concentration risk, DSO and the 90+ exposure.', state: { seg: 'Hotels' }, click: '.ai-btn', ai: true },
      { cap: 'Wholesale is the largest segment. Now try the filters yourself.', state: { seg: 'Wholesale' }, click: '[data-opt="Wholesale"]' }
    ]
  },
  {
    id: 'cash', tool: 'pbi', toolName: 'Power BI', file: 'Cash_Flow_Treasury.pbix',
    title: 'Cash Flow & Treasury',
    blurb: 'Inflows, outflows and closing balances across bank accounts and petty cash.',
    slicers: [
      { key: 'acc', label: 'Account', options: ['All', 'Main bank', 'Payroll bank', 'Petty cash'] },
      { key: 'per', label: 'Period', options: ['FY', 'H1', 'H2'] }
    ],
    state: { acc: 'All', per: 'FY' },
    data: {
      accs: ['Main bank', 'Payroll bank', 'Petty cash'],
      open: { 'Main bank': 1200, 'Payroll bank': 80, 'Petty cash': 25 },
      inf: { 'Main bank': [900, 850, 980, 950, 1020, 1080, 1050, 1120, 1190, 1150, 1230, 1310], 'Payroll bank': [260, 260, 265, 265, 270, 270, 275, 275, 280, 280, 285, 290], 'Petty cash': [45, 40, 50, 48, 52, 55, 50, 58, 60, 55, 62, 65] },
      out: { 'Main bank': [780, 820, 860, 900, 880, 950, 990, 1000, 1040, 1100, 1080, 1150], 'Payroll bank': [255, 258, 262, 266, 268, 272, 274, 276, 279, 283, 286, 292], 'Petty cash': [42, 44, 47, 50, 49, 53, 52, 55, 58, 57, 60, 66] }
    },
    calc(st) {
      const accs = st.acc === 'All' ? this.data.accs : [st.acc];
      const idx = { FY: [...Array(12).keys()], H1: [0, 1, 2, 3, 4, 5], H2: [6, 7, 8, 9, 10, 11] }[st.per];
      const series = k => MONTHS.map((_, i) => sum(accs.map(a => this.data[k][a][i])));
      const inf = series('inf'), out = series('out');
      let bal = sum(accs.map(a => this.data.open[a]));
      const closing = inf.map((v, i) => (bal += v - out[i]));
      const opening = idx[0] === 0 ? sum(accs.map(a => this.data.open[a])) : closing[idx[0] - 1];
      const byAcc = this.data.accs.map(a => { let b = this.data.open[a]; this.data.inf[a].forEach((v, i) => { if (i <= idx[idx.length - 1]) b += v - this.data.out[a][i]; }); return [a, b]; });
      return { accs, idx, inf: pick(inf, idx), out: pick(out, idx), closing: pick(closing, idx), opening, byAcc, label: st.acc === 'All' ? 'all accounts' : st.acc };
    },
    kpis(c) {
      const I = sum(c.inf), O = sum(c.out), C = c.closing[c.closing.length - 1];
      return [
        { name: 'Opening balance', value: fmt(c.opening) },
        { name: 'Total inflows', value: fmt(I) },
        { name: 'Total outflows', value: fmt(O) },
        { name: 'Closing balance', value: fmt(C), delta: { v: (C - c.opening) / c.opening, good: 1 } }
      ];
    },
    charts(c) {
      const sel = this.state.acc;
      return [
        { key: 'flow', title: 'Inflows vs outflows by month', wide: true, type: 'bar',
          spec: { cats: pick(MONTHS, c.idx), series: [{ name: 'Inflows', values: c.inf, color: 'var(--s1)' }, { name: 'Outflows', values: c.out, color: 'var(--s2)' }], height: 220 },
          legend: [['Inflows', 's1', 'rect'], ['Outflows', 's2', 'rect']] },
        { key: 'bal', title: 'Closing balance trend', type: 'line',
          spec: { labels: pick(MONTHS, c.idx), series: [{ name: 'Closing balance', values: c.closing, color: 'var(--s1)' }] } },
        { key: 'acc', title: 'Closing balance by account', type: 'bar',
          spec: { cats: c.byAcc.map(x => x[0]), series: [{ name: 'Closing balance', values: c.byAcc.map(x => x[1]), color: 'var(--s1)' }], horizontal: true, dim: sel === 'All' ? [] : c.byAcc.map((x, i) => x[0] === sel ? -1 : i) } }
      ];
    },
    insights(c) {
      const net = c.inf.map((v, i) => v - c.out[i]);
      const neg = net.map((v, i) => v < 0 ? MONTHS[c.idx[i]] : null).filter(Boolean);
      const worst = net.indexOf(Math.min(...net));
      const main = c.byAcc[0][1], payroll = sum(this.data.out['Payroll bank'].slice(-3)) / 3;
      const C = c.closing[c.closing.length - 1];
      return [
        `For ${c.label}, net cash flow is ${fmt(sum(net))}, taking the balance from ${fmt(c.opening)} to ${fmt(C)}.`,
        neg.length ? `Outflows exceeded inflows in ${neg.join(', ')}. Plan supplier payments around these months.` : 'Inflows covered outflows in every month of the period.',
        `${MONTHS[c.idx[worst]]} had the weakest net flow (${fmt(net[worst])}).`,
        `The main bank balance covers about ${(main / payroll).toFixed(1)} months of payroll at the current run-rate.`
      ];
    },
    script: [
      { cap: 'Treasury overview: opening, inflows, outflows and closing balance.', state: { acc: 'All', per: 'FY' }, target: '.kpis' },
      { cap: 'Inflows vs outflows month by month, in one tooltip.', state: { acc: 'All', per: 'FY' }, hover: ['flow', 3] },
      { cap: 'Switch to the second half of the year.', state: { acc: 'All', per: 'H2' }, click: '[data-opt="H2"]' },
      { cap: 'Focus on the main bank. The other accounts fade back for context.', state: { acc: 'Main bank', per: 'H2' }, click: '[data-opt="Main bank"]' },
      { cap: 'Closing balance trend for the selected account.', state: { acc: 'Main bank', per: 'H2' }, hover: ['bal', 5] },
      { cap: 'AI Insights spots negative-flow months and payroll coverage.', state: { acc: 'Main bank', per: 'H2' }, click: '.ai-btn', ai: true },
      { cap: 'Reset to all accounts. Your turn to explore.', state: { acc: 'All', per: 'FY' }, click: '[data-opt="All"]' }
    ]
  }
];

/* ---------- dashboard builder ---------- */
const ICONS = {
  excel: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8l8 8M16 8l-8 8"/>',
  pbi: '<path d="M6 20V12M10 20V8M14 20V4M18 20v-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  cursor: '<path d="M5 3l14 7-6 2-2 6z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>'
};
const ic = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

function buildDash(D, host) {
  const frame = h('div', `dash-frame tool-${D.tool}`, host);
  frame.dir = 'ltr'; frame.lang = 'en';
  frame.innerHTML = `
    <div class="dash-chrome"><span class="dots"><i></i><i></i><i></i></span><span class="tool-badge">${ic(D.tool)}${D.toolName}</span><span class="file"></span><span class="sample">Sample data</span></div>
    <div class="dash-body">
      <div class="dash-title"><div><h3></h3><p></p></div></div>
      <div class="slicers"></div>
      <div class="kpis"></div>
      <div class="dash-grid"></div>
      <div class="ai-panel"><div class="ai-head"><span class="ai-badge">${ic('spark')} AI Insights</span><button type="button" class="ai-btn">${ic('spark')}<span>Generate insights</span></button></div><ul class="ai-out"><li class="ai-hint">Click "Generate insights" for an automatic summary of the current view.</li></ul></div>
    </div>
    <div class="vcursor">${ic('cursor')}<span class="ripple"></span></div>
    <button type="button" class="play-overlay"><span class="big-play">${ic('play')}</span><span>Watch the walkthrough</span><small>${D.script.length} steps · about ${Math.round(D.script.length * STEP_MS / 1000)} sec</small></button>
    <div class="player-wrap"><div class="caption" aria-live="polite"><span class="cap-step">Guide</span><span class="cap-text">Press play for a guided walkthrough, or use the filters yourself.</span></div>
    <div class="player"><button type="button" class="pp" aria-label="Play">${ic('play')}</button><div class="track" role="slider" tabindex="0" aria-label="Walkthrough progress" aria-valuemin="0" aria-valuemax="100"><div class="fill"></div></div><span class="time"></span></div></div>`;
  frame.querySelector('.file').textContent = D.file;
  frame.querySelector('.dash-title h3').textContent = D.title;
  frame.querySelector('.dash-title p').textContent = D.blurb;
  const track = frame.querySelector('.track');
  D.script.forEach((_, i) => { const t = h('span', 'tick', track); t.style.left = (i / D.script.length * 100) + '%'; });

  const charts = {}, tableMode = {};
  let calc;

  function renderSlicers() {
    const box = frame.querySelector('.slicers'); box.replaceChildren();
    D.slicers.forEach(sl => {
      const g = h('div', 'slicer', box); h('span', 'sl-label', g, sl.label);
      const opts = h('div', 'sl-opts', g); opts.setAttribute('role', 'group'); opts.setAttribute('aria-label', sl.label);
      sl.options.forEach(o => {
        const b = h('button', 'sl-btn' + (D.state[sl.key] === o ? ' on' : ''), opts, o);
        b.type = 'button'; b.dataset.opt = o; b.setAttribute('aria-pressed', String(D.state[sl.key] === o));
        b.onclick = e => { if (e.isTrusted) player.pause(); setState({ [sl.key]: o }); };
      });
    });
  }
  function renderKpis() {
    const box = frame.querySelector('.kpis'); box.replaceChildren();
    D.kpis(calc).forEach(k => {
      const c = h('div', 'kpi', box);
      h('span', 'kpi-name', c, k.name);
      h('strong', 'kpi-val', c, k.value);
      if (k.delta) {
        const up = k.delta.v >= 0, good = (up ? 1 : -1) * k.delta.good > 0;
        const d = h('span', 'kpi-delta ' + (good ? 'good' : 'bad'), c);
        d.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="${up ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'}"/></svg>`;
        h('span', '', d, k.delta.pts ? `${(Math.abs(k.delta.v) * 100).toFixed(1)} pts` : pct(Math.abs(k.delta.v)));
        h('span', 'muted', d, D.id === 'fin' ? ` vs ${calc.prevKey}` : D.id === 'ar' ? ' vs Nov' : ' vs opening');
      } else if (k.note) {
        const n = h('span', 'kpi-delta ' + (k.status || 'muted'), c, k.note);
        if (k.status) n.prepend(Object.assign(document.createElement('b'), { textContent: k.status === 'good' ? '✓ ' : '! ' }));
      } else h('span', 'kpi-delta muted', c, D.id === 'fin' ? 'Full year' : D.id === 'cash' ? (D.state.per === 'FY' ? 'Start of year' : D.state.per === 'H1' ? 'Start of H1' : 'Start of H2') : 'All buckets');
    });
  }
  function renderCharts() {
    const grid = frame.querySelector('.dash-grid'); grid.replaceChildren();
    D.charts(calc).forEach(ch => {
      const card = h('div', 'viz-card' + (ch.wide ? ' wide' : ''), grid);
      const head = h('div', 'viz-head', card);
      h('h4', '', head, ch.title);
      const tgl = h('button', 'viz-toggle', head); tgl.type = 'button';
      tgl.innerHTML = tableMode[ch.key] ? `${ic('chart')}<span>Chart</span>` : `${ic('table')}<span>Table</span>`;
      tgl.setAttribute('aria-label', tableMode[ch.key] ? 'Show chart' : 'Show data table');
      tgl.onclick = () => { tableMode[ch.key] = !tableMode[ch.key]; renderCharts(); };
      if (ch.legend && !tableMode[ch.key]) {
        const lg = h('div', 'legend', card);
        ch.legend.forEach(([n, v, shape]) => { const it = h('span', '', lg); const k = h('i', 'lg-' + shape, it); k.style.background = `var(--${v})`; it.append(n); });
      }
      const body = h('div', 'viz-body', card);
      if (tableMode[ch.key]) {
        const t = h('table', 'viz-table', body), tr = h('tr', '', h('thead', '', t));
        const cats = ch.spec.labels || ch.spec.cats, ser = ch.spec.series;
        h('th', '', tr, ''); ser.forEach(se => h('th', '', tr, se.name));
        const tb = h('tbody', '', t);
        cats.forEach((c, i) => { const r = h('tr', '', tb); h('td', '', r, c); ser.forEach(se => h('td', '', r, fmt(se.values[i]))); });
        charts[ch.key] = { hover() {} };
      } else {
        charts[ch.key] = ch.type === 'line' ? lineChart(body, ch.spec) : barChart(body, ch.spec);
      }
    });
  }
  function resetAi() { frame.querySelector('.ai-out').innerHTML = '<li class="ai-hint">Click "Generate insights" for an automatic summary of the current view.</li>'; }
  let aiTimer;
  function runAi() {
    clearTimeout(aiTimer);
    const out = frame.querySelector('.ai-out'), btn = frame.querySelector('.ai-btn');
    out.replaceChildren(); btn.classList.add('busy');
    const lines = D.insights(calc);
    const think = h('li', 'ai-think', out, 'Analysing the data in this view');
    let li = 0, ci = 0, cur;
    const type = () => {
      if (li >= lines.length) { btn.classList.remove('busy'); return; }
      if (!cur) cur = h('li', '', out);
      if (reduce) { cur.textContent = lines[li]; li++; cur = null; return type(); }
      ci += 3; cur.textContent = lines[li].slice(0, ci);
      if (ci >= lines[li].length) { li++; ci = 0; cur = null; aiTimer = setTimeout(type, 160); }
      else aiTimer = setTimeout(type, 14);
    };
    aiTimer = setTimeout(() => { think.remove(); type(); }, reduce ? 0 : 700);
  }
  frame.querySelector('.ai-btn').onclick = e => { if (e.isTrusted) player.pause(); runAi(); };

  function setState(patch) {
    Object.assign(D.state, patch);
    calc = D.calc(D.state);
    hideTip(); clearTimeout(aiTimer); resetAi(); frame.querySelector('.ai-btn').classList.remove('busy');
    renderSlicers(); renderKpis(); renderCharts();
  }

  /* ---------- video-style player ---------- */
  const cursor = frame.querySelector('.vcursor'), cap = frame.querySelector('.caption');
  const total = D.script.length * STEP_MS;
  function reveal(target) {
    const r = target.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 20) target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
  function moveCursorXY(x, y) { const fr = frame.getBoundingClientRect(); cursor.style.transform = `translate(${x - fr.left}px, ${y - fr.top}px)`; }
  function moveCursor(target) {
    if (!target) return;
    const r = target.getBoundingClientRect();
    moveCursorXY(r.left + Math.min(r.width / 2, 60), r.top + r.height / 2);
  }
  function clickFx() { cursor.classList.remove('click'); void cursor.offsetWidth; cursor.classList.add('click'); }
  const player = {
    t: 0, playing: false, step: -1, raf: 0, last: 0, timers: [],
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; },
    runStep(i) {
      this.step = i; this.clearTimers(); hideTip();
      const st = D.script[i];
      cap.querySelector('.cap-step').textContent = `Step ${i + 1}/${D.script.length}`;
      cap.querySelector('.cap-text').textContent = st.cap;
      cap.classList.add('show');
      const needsState = Object.keys(st.state).some(k => D.state[k] !== st.state[k]);
      if (needsState && !st.click) setState(st.state);
      frame.querySelectorAll('.spot-on').forEach(x => x.classList.remove('spot-on'));
      if (st.target) { const t = frame.querySelector(st.target); t.classList.add('spot-on'); reveal(t); this.timers.push(setTimeout(() => moveCursor(t), reduce ? 0 : 350)); }
      if (st.click) {
        if (!st.click.includes('data-opt') && needsState) setState(st.state);
        const tg = frame.querySelector(st.click); reveal(tg);
        this.timers.push(setTimeout(() => moveCursor(tg), reduce ? 0 : 350));
        this.timers.push(setTimeout(() => {
          clickFx();
          if (st.ai) runAi(); else setState(st.state);
          const after = frame.querySelector(st.click); if (after) after.classList.add('spot-on');
        }, reduce ? 0 : 1150));
      }
      if (st.hover) {
        const [key, idx] = st.hover, chart = charts[key];
        const target = chart && chart.el ? chart.el : null;
        if (target) {
          const card = target.closest('.viz-card'); card.classList.add('spot-on');
          reveal(card);
          this.timers.push(setTimeout(() => {
            const marks = target.querySelectorAll('.bar-g');
            if (chart.pos) { const q = chart.pos(idx); moveCursorXY(q.x, q.y); } else moveCursor(marks[idx] ? marks[idx].querySelector('.bar') : target);
          }, reduce ? 0 : 350));
          this.timers.push(setTimeout(() => chart.hover(idx), reduce ? 0 : 1150));
        }
      }
    },
    tick(now) {
      if (!this.playing) return;
      this.t += now - this.last; this.last = now;
      if (this.t >= total) { this.t = total; this.render(); this.end(); return; }
      const i = Math.floor(this.t / STEP_MS);
      if (i !== this.step) this.runStep(i);
      this.render();
      this.raf = requestAnimationFrame(n => this.tick(n));
    },
    render() {
      frame.querySelector('.fill').style.width = (this.t / total * 100) + '%';
      track.setAttribute('aria-valuenow', Math.round(this.t / total * 100));
      const sec = x => `0:${String(Math.floor(x / 1000)).padStart(2, '0')}`;
      frame.querySelector('.time').textContent = `${sec(this.t)} / ${sec(total)}`;
    },
    play() {
      if (this.t >= total) { this.t = 0; this.step = -1; }
      frame.classList.add('playing', 'started');
      this.playing = true; this.last = performance.now();
      frame.querySelector('.pp').innerHTML = ic('pause'); frame.querySelector('.pp').setAttribute('aria-label', 'Pause');
      if (this.step >= 0 && this.timers.length === 0) {}
      this.raf = requestAnimationFrame(n => this.tick(n));
    },
    pause() {
      if (!this.playing) return;
      this.playing = false; cancelAnimationFrame(this.raf);
      frame.classList.remove('playing');
      frame.querySelector('.pp').innerHTML = ic('play'); frame.querySelector('.pp').setAttribute('aria-label', 'Play');
    },
    end() {
      this.pause(); this.clearTimers(); hideTip();
      frame.querySelectorAll('.spot-on').forEach(x => x.classList.remove('spot-on'));
      frame.querySelector('.pp').innerHTML = ic('replay'); frame.querySelector('.pp').setAttribute('aria-label', 'Replay');
      cap.querySelector('.cap-step').textContent = 'Done';
      cap.querySelector('.cap-text').textContent = 'Walkthrough complete. Every filter, chart and table is live, so explore freely.';
    },
    seek(frac) {
      this.t = Math.max(0, Math.min(total - 1, frac * total));
      const i = Math.floor(this.t / STEP_MS);
      this.t = i * STEP_MS; this.render(); this.runStep(i);
      frame.classList.add('started');
    }
  };
  frame.querySelector('.play-overlay').onclick = () => player.play();
  frame.querySelector('.pp').onclick = () => player.playing ? player.pause() : player.play();
  track.addEventListener('click', e => { const r = track.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); });
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); player.seek((Math.max(0, player.step) + (e.key === 'ArrowRight' ? 1 : -1)) * STEP_MS / total + 0.0001); }
  });
  frame.addEventListener('pointerdown', e => {
    if (e.isTrusted && player.playing && !e.target.closest('.player') && !e.target.closest('.play-overlay')) player.pause();
  });

  setState({});
  player.render();
  return { frame, player, rerender: () => { calc = D.calc(D.state); renderCharts(); } };
}

/* ---------- mount ---------- */
const host = document.getElementById('dashHost'), tabs = document.getElementById('dashTabs');
if (!host || !tabs) return;
const built = [];
DASHES.forEach((D, i) => {
  const b = h('button', 'dash-tab' + (i ? '' : ' on'), tabs); b.type = 'button';
  b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(!i));
  b.innerHTML = `<span class="dt-ic tool-${D.tool}">${ic(D.tool)}</span><span><b></b><small></small></span>`;
  b.querySelector('b').textContent = D.title; b.querySelector('small').textContent = D.toolName + ' · interactive';
  const wrap = h('div', 'dash-wrap', host); wrap.hidden = !!i;
  built.push({ wrap, ...(i === 0 ? buildDash(D, wrap) : { lazy: D }) });
  b.onclick = () => {
    built.forEach((x, k) => { x.wrap.hidden = k !== i; if (x.player) x.player.pause(); tabs.children[k].classList.toggle('on', k === i); tabs.children[k].setAttribute('aria-selected', String(k === i)); });
    hideTip();
    if (built[i].lazy) { const D2 = built[i].lazy; Object.assign(built[i], buildDash(D2, built[i].wrap)); delete built[i].lazy; }
    else built[i].rerender();
  };
});
let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => built.forEach(x => { if (!x.lazy && !x.wrap.hidden) x.rerender(); }), 200); });
})();
