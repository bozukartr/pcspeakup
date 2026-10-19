/* ==========================================================================
   Charts — lightweight, dependency-free SVG charts.
   Thin marks, hairline grid, one y-axis, crosshair + tooltip on hover/touch,
   legend for 2+ series, and an accessible data-table fallback.
   Colors come from CSS tokens so light/dark themes switch automatically.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, formatNumber } = SU.util;
  const NS = 'http://www.w3.org/2000/svg';

  function niceMax(v) {
    if (v <= 4) return 4;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function observe(el, render) {
    let w = 0;
    const ro = new ResizeObserver((entries) => {
      const nw = Math.round(entries[0].contentRect.width);
      if (nw && Math.abs(nw - w) > 2) { w = nw; render(nw); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }

  function dataTable(caption, head, rows) {
    return html`
      <table class="data-table">
        <caption class="sr-only">${caption}</caption>
        <thead><tr>${head.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead>
        <tbody>${rows.map((r) => html`<tr>${r.map((c, i) => (i === 0 ? html`<th scope="row" style="font-weight:500;color:var(--text);text-align:left;font-size:13px;padding:8px 10px;border-bottom:1px solid var(--divider)">${c}</th>` : html`<td>${c}</td>`))}</tr>`)}</tbody>
      </table>`;
  }

  /**
   * Line / area chart.
   * @param {HTMLElement} el
   * @param {{labels: string[], fullLabels?: string[], series: {name: string, values: number[], color: string, area?: boolean}[], height?: number, caption: string}} cfg
   */
  function line(el, cfg) {
    const height = cfg.height || 220;
    const pad = { t: 14, r: 14, b: 26, l: 30 };
    let first = true;

    setHTML(el, html`
      <div class="chart" role="img" aria-label="${cfg.caption}">
        <div class="chart__svg"></div>
        <div class="chart-tip" aria-hidden="true"></div>
      </div>
      ${cfg.series.length > 1 ? html`<div class="legend" style="margin-top:12px">${cfg.series.map((s) => html`<span class="legend__item"><span class="swatch swatch--line" style="background:${s.color}"></span>${s.name}</span>`)}</div>` : ''}
      <details class="chart-table" style="margin-top:12px">
        <summary class="link-btn t-caption" style="cursor:pointer;display:inline-block">View as table</summary>
        <div style="margin-top:8px;overflow-x:auto">${dataTable(cfg.caption, ['Month', ...cfg.series.map((s) => s.name)], (cfg.fullLabels || cfg.labels).map((l, i) => [l, ...cfg.series.map((s) => formatNumber(s.values[i]))]))}</div>
      </details>`);

    const host = el.querySelector('.chart__svg');
    const tip = el.querySelector('.chart-tip');
    const chartEl = el.querySelector('.chart');

    const render = (width) => {
      const n = cfg.labels.length;
      const max = niceMax(Math.max(1, ...cfg.series.flatMap((s) => s.values)));
      const iw = width - pad.l - pad.r;
      const ih = height - pad.t - pad.b;
      const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
      const y = (v) => pad.t + ih - (v / max) * ih;
      const ticks = [0, max / 2, max];
      const showEvery = width < 420 ? 2 : 1;

      let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="${first && !SU.util.prefersReducedMotion() ? 'chart-draw' : ''}">`;
      s += '<g class="chart__grid">';
      ticks.forEach((t) => { if (t) s += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(t)}" y2="${y(t)}"/>`; });
      s += '</g>';
      ticks.forEach((t) => { s += `<text class="chart__tick" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${formatNumber(t)}</text>`; });
      cfg.labels.forEach((l, i) => {
        if (i % showEvery === (n - 1) % showEvery) s += `<text class="chart__tick" x="${x(i)}" y="${height - 6}" text-anchor="middle">${SU.util.esc(l)}</text>`;
      });
      s += `<line class="chart__baseline" x1="${pad.l}" x2="${width - pad.r}" y1="${y(0)}" y2="${y(0)}"/>`;

      cfg.series.forEach((ser) => {
        const pts = ser.values.map((v, i) => [x(i), y(v)]);
        const d = smooth(pts);
        if (ser.area) s += `<path class="chart__area" d="${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z" fill="${ser.color}"/>`;
        const len = Math.ceil(pathLength(pts) * 1.2);
        s += `<path class="chart__line" d="${d}" stroke="${ser.color}" style="--len:${len}"/>`;
        const last = pts[pts.length - 1];
        s += `<circle class="chart__dot" cx="${last[0]}" cy="${last[1]}" r="4" fill="${ser.color}"/>`;
      });

      s += `<line class="chart__cross" x1="0" x2="0" y1="${pad.t}" y2="${y(0)}" style="opacity:0"/>`;
      s += `<g class="chart__hover"></g>`;
      s += `<rect class="chart__hit" x="${pad.l - 10}" y="0" width="${iw + 20}" height="${height}"/>`;
      s += '</svg>';
      host.innerHTML = s;
      first = false;

      const svg = host.querySelector('svg');
      const cross = svg.querySelector('.chart__cross');
      const hoverG = svg.querySelector('.chart__hover');
      const hit = svg.querySelector('.chart__hit');

      const showAt = (clientX) => {
        const rect = svg.getBoundingClientRect();
        const px = ((clientX - rect.left) / rect.width) * width;
        const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.opacity = 1;
        hoverG.innerHTML = cfg.series.map((ser) => `<circle class="chart__dot" cx="${x(i)}" cy="${y(ser.values[i])}" r="4.5" fill="${ser.color}"/>`).join('');
        setHTML(tip, html`
          <div class="chart-tip__title">${(cfg.fullLabels || cfg.labels)[i]}</div>
          ${cfg.series.map((ser) => html`<div class="chart-tip__row"><span class="swatch swatch--line" style="background:${ser.color}"></span>${ser.name}<b>${formatNumber(ser.values[i])}</b></div>`)}`);
        const left = (x(i) / width) * rect.width;
        const tipW = tip.offsetWidth || 140;
        tip.style.left = `${Math.min(Math.max(left, tipW / 2), rect.width - tipW / 2)}px`;
        tip.style.top = `${(Math.min(...cfg.series.map((ser) => y(ser.values[i]))) / height) * rect.height}px`;
        tip.classList.add('is-visible');
      };
      const hide = () => { cross.style.opacity = 0; hoverG.innerHTML = ''; tip.classList.remove('is-visible'); };
      hit.addEventListener('pointermove', (e) => showAt(e.clientX));
      hit.addEventListener('pointerdown', (e) => showAt(e.clientX));
      hit.addEventListener('pointerleave', hide);
      chartEl.addEventListener('pointerleave', hide);
    };

    return observe(host, render);
  }

  /** Monotone-ish smoothing (Catmull-Rom → Bézier with tension clamp). */
  function smooth(pts) {
    if (pts.length < 2) return `M${pts[0][0]},${pts[0][1]}`;
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    const t = 0.18;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
      const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
      d += ` C${c1x.toFixed(1)},${Math.min(hi, Math.max(lo, c1y)).toFixed(1)} ${c2x.toFixed(1)},${Math.min(hi, Math.max(lo, c2y)).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function pathLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }

  /**
   * Column chart (single series) with value-on-cap for the highlighted column.
   */
  function columns(el, cfg) {
    const height = cfg.height || 200;
    const pad = { t: 18, r: 6, b: 26, l: 30 };
    let first = true;
    setHTML(el, html`
      <div class="chart" role="img" aria-label="${cfg.caption}"><div class="chart__svg"></div><div class="chart-tip" aria-hidden="true"></div></div>
      <details style="margin-top:12px">
        <summary class="link-btn t-caption" style="cursor:pointer;display:inline-block">View as table</summary>
        <div style="margin-top:8px;overflow-x:auto">${dataTable(cfg.caption, ['Month', cfg.name], (cfg.fullLabels || cfg.labels).map((l, i) => [l, cfg.format ? cfg.format(cfg.values[i]) : formatNumber(cfg.values[i])]))}</div>
      </details>`);
    const host = el.querySelector('.chart__svg');
    const tip = el.querySelector('.chart-tip');
    const fmt = cfg.format || formatNumber;

    const render = (width) => {
      const n = cfg.values.length;
      const max = niceMax(Math.max(1, ...cfg.values));
      const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
      const band = iw / n;
      const bw = Math.min(24, band * 0.56);
      const y = (v) => pad.t + ih - (v / max) * ih;
      const showEvery = width < 420 ? 2 : 1;
      let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
      s += '<g class="chart__grid">';
      [max / 2, max].forEach((t) => { s += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(t)}" y2="${y(t)}"/>`; });
      s += '</g>';
      [0, max / 2, max].forEach((t) => { s += `<text class="chart__tick" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
      cfg.values.forEach((v, i) => {
        const cx = pad.l + band * i + band / 2;
        const h = Math.max(0, (v / max) * ih);
        const r = Math.min(4, h);
        const x0 = cx - bw / 2, y0 = pad.t + ih - h, yb = pad.t + ih;
        const d = h > 0 ? `M${x0},${yb} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + bw - r} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} V${yb} Z` : '';
        const hl = i === n - 1;
        s += `<g class="col" data-i="${i}">`;
        if (d) s += `<path d="${d}" fill="${cfg.color}" style="opacity:${hl ? 1 : 0.55};transform-origin:${cx}px ${yb}px;${first && !SU.util.prefersReducedMotion() ? `animation:grow-y 600ms ${i * 30}ms var(--ease-out) both` : ''}"/>`;
        if (hl) s += `<text class="chart__label" x="${cx}" y="${y0 - 6}" text-anchor="middle">${fmt(v)}</text>`;
        if (i % showEvery === (n - 1) % showEvery) s += `<text class="chart__tick" x="${cx}" y="${height - 6}" text-anchor="middle">${SU.util.esc(cfg.labels[i])}</text>`;
        s += `<rect class="chart__hit" x="${pad.l + band * i}" y="${pad.t}" width="${band}" height="${ih}"/>`;
        s += '</g>';
      });
      s += `<line class="chart__baseline" x1="${pad.l}" x2="${width - pad.r}" y1="${y(0)}" y2="${y(0)}"/>`;
      s += '</svg>';
      host.innerHTML = s;
      first = false;

      const svg = host.querySelector('svg');
      svg.querySelectorAll('.col').forEach((g) => {
        const i = +g.dataset.i;
        const show = () => {
          const rect = svg.getBoundingClientRect();
          setHTML(tip, html`<div class="chart-tip__title">${(cfg.fullLabels || cfg.labels)[i]}</div><div class="chart-tip__row">${cfg.name}<b>${fmt(cfg.values[i])}</b></div>`);
          const cx = ((pad.l + band * i + band / 2) / width) * rect.width;
          const tipW = tip.offsetWidth || 140;
          tip.style.left = `${Math.min(Math.max(cx, tipW / 2), rect.width - tipW / 2)}px`;
          tip.style.top = `${(y(cfg.values[i]) / height) * rect.height}px`;
          tip.classList.add('is-visible');
          svg.querySelectorAll('.col path').forEach((p, j) => (p.style.opacity = j === i ? 1 : 0.4));
        };
        const hide = () => {
          tip.classList.remove('is-visible');
          svg.querySelectorAll('.col path').forEach((p, j) => (p.style.opacity = j === n - 1 ? 1 : 0.55));
        };
        g.addEventListener('pointerenter', show);
        g.addEventListener('pointerdown', show);
        g.addEventListener('pointerleave', hide);
      });
    };
    return observe(host, render);
  }

  /** Horizontal bars — ranked category distribution (HTML, so labels never clip). */
  function hbars(rows, { total, color = 'var(--chart-1)' } = {}) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    const sum = total || rows.reduce((a, r) => a + r.value, 0) || 1;
    return html`<div class="hbars" role="list">
      ${rows.map((r, i) => html`
        <div class="hbar" role="listitem" aria-label="${r.label}: ${r.value} (${Math.round((r.value / sum) * 100)}%)">
          <div class="hbar__label">${r.icon ? SU.icon(r.icon) : ''}<span>${r.label}</span></div>
          <div class="hbar__value">${formatNumber(r.value)}<small>${Math.round((r.value / sum) * 100)}%</small></div>
          <div class="hbar__track"><div class="hbar__fill" style="width:${(r.value / max) * 100}%;background:${color};animation-delay:${i * 40}ms"></div></div>
        </div>`)}
    </div>`;
  }

  /** Stacked status bar + legend (identity never relies on color alone). */
  function stack(segments) {
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    return html`
      <div class="stackbar" role="img" aria-label="${segments.map((s) => `${s.label}: ${s.value}`).join(', ')}">
        ${segments.filter((s) => s.value > 0).map((s, i) => html`<div class="stackbar__seg" title="${s.label}: ${s.value}" style="flex:${s.value} 1 0;background:${s.color};animation-delay:${i * 60}ms"></div>`)}
      </div>
      <div class="legend" style="margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px">
        ${segments.map((s) => html`
          <div class="legend__item" style="justify-content:space-between">
            <span class="row gap-2"><span class="swatch" style="background:${s.color}"></span>${s.label}</span>
            <b class="t-num" style="color:var(--text);font-weight:600">${formatNumber(s.value)} <span class="text-3" style="font-weight:500">· ${Math.round((s.value / total) * 100)}%</span></b>
          </div>`)}
      </div>`;
  }

  /** Tiny inline sparkline for KPI tiles (decorative; the number carries meaning). */
  function sparkline(values, color = 'var(--chart-1)', w = 84, h = 28) {
    const max = Math.max(1, ...values), min = Math.min(...values);
    const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6)]);
    return SU.util.raw(`<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${smooth(pts)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  }

  window.SU.charts = { line, columns, hbars, stack, sparkline };
})();
