/* ==========================================================================
   Admin · Analytics — monthly volume, outcomes, categories, priorities.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, formatNumber, formatMonth, formatMonthYear } = SU.util;
  const { catalog, ui, store, charts } = SU;
  SU.views = SU.views || {};

  SU.views.analytics = {
    area: 'admin',
    tab: 'analytics',
    depth: 0,
    title: 'Analytics',
    pageClass: 'page--wide',
    guard: () => SU.adminGuard(),
    mount(page, ctx) {
      let range = sessionStorage.getItem('clearline.analytics.range') || '12';
      let stats = null;
      let disposers = [];

      ctx.shell.setTop({ title: 'Analytics' });
      setHTML(page, html`
        ${ui.pageHead({ title: 'Analytics', sub: 'Aggregated, de-identified insights to spot patterns early.' })}
        <div class="row between wrap gap-3" style="margin-bottom:16px">
          ${ui.segmented({ name: 'range', label: 'Time range', value: range, options: [{ value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '12', label: '12 months' }] })}
          <span class="t-caption">Updated just now</span>
        </div>
        <div data-content>${ui.skelKpis()}<div class="dash-grid" style="margin-top:16px">${ui.skelCard(220)}${ui.skelCard(220)}</div></div>`);

      ui.bindSegmented(page.querySelector('[data-segmented]'), (v) => {
        range = v;
        try { sessionStorage.setItem('clearline.analytics.range', v); } catch (_) { /* ignore */ }
        if (stats) render();
      });

      function render() {
        disposers.forEach((d) => d());
        disposers = [];
        const months = stats.months.slice(-Number(range));
        const received = months.reduce((a, m) => a + m.received, 0);
        const resolved = months.reduce((a, m) => a + m.resolved, 0);
        const avg = received / months.length;
        const peak = months.reduce((p, m) => (m.received > p.received ? m : p), months[0]);
        const cats = catalog.CATEGORIES.map((c) => ({ label: c.label, icon: c.icon, value: stats.byCategory[c.id] || 0 })).sort((a, b) => b.value - a.value);
        const prioColors = { low: 'var(--pr-low)', medium: 'var(--pr-medium)', high: 'var(--pr-high)', critical: 'var(--pr-critical)' };

        setHTML(page.querySelector('[data-content]'), html`
          <div class="kpis">
            <div class="kpi"><span class="kpi__label">Reports received</span><span class="kpi__value t-num">${formatNumber(received)}</span><span class="kpi__foot">${avg.toFixed(1)} per month on average</span></div>
            <div class="kpi"><span class="kpi__label">Cases resolved</span><span class="kpi__value t-num">${formatNumber(resolved)}</span><span class="kpi__foot">${received ? Math.round((resolved / received) * 100) : 0}% of volume in period</span></div>
            <div class="kpi"><span class="kpi__label">Avg. time to resolve</span><span class="kpi__value t-num">${Math.round(stats.avgResolutionDays)}<small style="font-size:16px;font-weight:600;color:var(--text-3)"> days</small></span><span class="kpi__foot">Target: under 45 days</span></div>
            <div class="kpi"><span class="kpi__label">Anonymous reports</span><span class="kpi__value t-num">${Math.round(stats.anonymousShare * 100)}%</span><span class="kpi__foot">Share of all submissions</span></div>
          </div>

          <div class="dash-grid" style="margin-top:16px">
            <section class="card card--pad">
              <div class="card-head"><div><h2 class="card-title">Monthly volume</h2><div class="card-sub">Reports received per month · peak ${formatMonthYear(peak.date)}</div></div></div>
              <div data-cols></div>
            </section>
            <section class="card card--pad">
              <div class="card-head"><div><h2 class="card-title">Received vs. resolved</h2><div class="card-sub">Is the team keeping pace with intake?</div></div></div>
              <div data-line></div>
            </section>
            <section class="card card--pad">
              <div class="card-head"><div><h2 class="card-title">Category distribution</h2><div class="card-sub">All time · ranked by volume</div></div></div>
              ${charts.hbars(cats, { total: stats.total })}
            </section>
            <section class="card card--pad">
              <div class="card-head"><div><h2 class="card-title">Priority mix</h2><div class="card-sub">All time</div></div></div>
              ${charts.stack(catalog.PRIORITIES.slice().reverse().map((p) => ({ label: p.label, value: stats.byPriority[p.id] || 0, color: prioColors[p.id] })))}
              <hr>
              <div class="card-title" style="margin-bottom:12px">Status pipeline</div>
              ${charts.stack(catalog.STATUSES.map((s) => ({ label: s.label, value: stats.byStatus[s.id] || 0, color: `var(--st-${s.css})` })))}
            </section>
          </div>

          <div class="callout" style="margin-top:16px">
            ${SU.icon('shield')}
            <div>Analytics only use aggregated case metadata. In production, segments with fewer than 5 reports are suppressed to prevent re-identification.</div>
          </div>`);

        disposers.push(charts.columns(page.querySelector('[data-cols]'), {
          caption: 'Reports received per month',
          name: 'Received',
          labels: months.map((m) => formatMonth(m.date)),
          fullLabels: months.map((m) => formatMonthYear(m.date)),
          values: months.map((m) => m.received),
          color: 'var(--chart-1)',
          height: 220,
        }));
        disposers.push(charts.line(page.querySelector('[data-line]'), {
          caption: 'Reports received and resolved per month',
          labels: months.map((m) => formatMonth(m.date)),
          fullLabels: months.map((m) => formatMonthYear(m.date)),
          series: [
            { name: 'Received', values: months.map((m) => m.received), color: 'var(--chart-1)' },
            { name: 'Resolved', values: months.map((m) => m.resolved), color: 'var(--chart-2)' },
          ],
          height: 220,
        }));
      }

      store.stats().then((s) => {
        if (!ctx.alive()) return;
        stats = s;
        render();
        ctx.onMounted();
      }).catch(() => SU.router.navigate('/admin/login', { replace: true }));

      return () => disposers.forEach((d) => d());
    },
  };
})();
