/* ==========================================================================
   Admin · Overview — KPIs, items needing attention, trends, distribution.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, relativeTime, formatNumber, formatMonth, formatMonthYear } = SU.util;
  const { catalog, ui, store, charts } = SU;
  SU.views = SU.views || {};

  /**
   * Report row used across admin lists.
   * `table: true` adds priority / assignee / updated columns on wide screens.
   */
  SU.ui.reportCell = (r, opts) => {
    const cat = catalog.category(r.category);
    const table = !!(opts && opts.table);
    const assignee = r.assignee ? catalog.member(r.assignee) : null;
    return html`
      <a class="cell report-cell ${table ? 'report-cell--table' : ''} ${r.unread || r.isNew ? 'is-unread' : ''}" href="#/admin/reports/${r.id}">
        <span class="report-cell__dot" aria-hidden="true"></span>
        ${ui.categoryTile(r.category)}
        <span class="report-cell__body">
          <span class="cell__title truncate">${r.subject}</span>
          <span class="report-cell__meta">
            <span class="t-mono">${r.reference}</span>
            <span aria-hidden="true">·</span><span class="truncate">${cat.short}</span>
            ${r.unread ? html`<span class="report-cell__flag" title="New message">${SU.icon('message')}</span>` : ''}
          </span>
        </span>
        <span class="rc-status">${ui.statusPill(r.status)}</span>
        ${table ? html`
          <span class="rc-prio">${ui.priorityTag(r.priority)}</span>
          <span class="rc-assignee">${assignee ? html`${ui.avatar(assignee.name, 'avatar--sm')}<span class="truncate">${assignee.name.split(' ')[0]}</span>` : html`<span class="text-3">—</span>`}</span>` : ''}
        <span class="rc-time">${relativeTime(r.updatedAt)}</span>
        <span class="sr-only">${r.unread ? 'Unread message. ' : ''}${r.isNew ? 'New. ' : ''}${catalog.priority(r.priority).label} priority</span>
      </a>`;
  };

  SU.views.dashboard = {
    area: 'admin',
    tab: 'dashboard',
    depth: 0,
    title: 'Overview',
    pageClass: 'page--wide',
    guard: () => SU.adminGuard(),
    mount(page, ctx) {
      const me = store.currentAdmin();
      const hour = new Date().getHours();
      const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      const disposers = [];

      const trail = ctx.shell.setTop({
        title: 'Overview',
        actions: html`<a class="btn btn--primary btn--sm hide-sm" href="#/admin/reports">${SU.icon('inbox')}Open inbox</a>
                      <button class="icon-btn mobile-only" type="button" data-theme aria-label="Appearance">${SU.icon('sun')}</button>`,
      });
      const tb = trail.querySelector('[data-theme]');
      if (tb) tb.addEventListener('click', (e) => ctx.shell.themeMenu(e.currentTarget));

      setHTML(page, html`
        ${ui.pageHead({ overline: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), title: `${hello}, ${me.name.split(' ')[0]}` })}
        <div data-content>
          ${ui.skelKpis()}
          <div class="dash-grid" style="margin-top:16px">${ui.skelCard(240)}${ui.skelCard(240)}</div>
        </div>`);

      const load = () => store.stats().then((s) => {
        if (!ctx.alive()) return;
        disposers.splice(0).forEach((d) => d());
        const months = s.months;
        const delta = s.thisWeek - s.lastWeek;
        const cats = catalog.CATEGORIES.map((c) => ({ label: c.label, icon: c.icon, value: s.byCategory[c.id] || 0 })).sort((a, b) => b.value - a.value);

        const kpi = (label, value, icon, tone, foot, spark) => html`
          <div class="kpi">
            <div class="kpi__top"><span class="kpi__label">${label}</span><span class="tile-icon tile-icon--${tone}">${SU.icon(icon)}</span></div>
            <div class="row between" style="align-items:flex-end;gap:8px"><span class="kpi__value t-num">${formatNumber(value)}</span>${spark || ''}</div>
            <div class="kpi__foot">${foot}</div>
          </div>`;

        setHTML(page.querySelector('[data-content]'), html`
          <div class="kpis">
            ${kpi('Total reports', s.total, 'layers', 'navy',
              html`<span class="delta ${delta > 0 ? 'delta--up' : ''}">${SU.icon(delta >= 0 ? 'arrowUp' : 'arrowDown')}${Math.abs(delta)}</span> this week`,
              charts.sparkline(months.map((m) => m.received), undefined, 64, 24))}
            ${kpi('Pending', s.pending, 'inbox', 'amber', html`${formatNumber(s.byStatus.received || 0)} new · ${formatNumber(s.byStatus.review || 0)} reviewing`)}
            ${kpi('In progress', s.inProgress, 'activity', 'blue', html`${formatNumber(s.unread)} unread`)}
            ${kpi('Resolved', s.resolved, 'checkCircle', 'green', html`~${Math.round(s.avgResolutionDays)} days avg.`,
              charts.sparkline(months.map((m) => m.resolved), 'var(--chart-2)', 64, 24))}
          </div>

          <div class="dash-grid" style="margin-top:16px">
            <section class="card card--pad dash-trend">
              <div class="card-head">
                <div><h2 class="card-title">Trend</h2><div class="card-sub">Last 12 months</div></div>
                <a class="link-btn t-callout" href="#/admin/analytics">Analytics</a>
              </div>
              <div data-trend></div>
            </section>

            <section class="card dash-attention">
              <div class="card-head" style="padding:16px 16px 0;margin-bottom:4px">
                <h2 class="card-title">Needs attention</h2><span class="count-badge" style="background:var(--surface-3);color:var(--text-2)">${s.attention.length}</span>
              </div>
              ${s.attention.length
                ? html`<div class="attention-list">${s.attention.map((r) => SU.ui.reportCell(r))}</div>`
                : ui.empty({ icon: 'checkCircle', title: 'All caught up' })}
              <div style="padding:4px 10px 10px"><a class="btn btn--ghost btn--block btn--sm" href="#/admin/reports">All reports ${SU.icon('arrowRight')}</a></div>
            </section>

            <section class="card card--pad">
              <div class="card-head"><h2 class="card-title">By category</h2></div>
              ${charts.hbars(cats.slice(0, 6), { total: s.total })}
            </section>

            <section class="card card--pad">
              <div class="card-head"><h2 class="card-title">By status</h2></div>
              ${charts.stack(catalog.STATUSES.map((st) => ({ label: st.label, value: s.byStatus[st.id] || 0, color: `var(--st-${st.css})` })))}
              <hr>
              <div class="mini-stats">
                <div><div class="t-caption">This week</div><div class="t-title-3 t-num">${s.thisWeek}</div></div>
                <div><div class="t-caption">Anonymous</div><div class="t-title-3 t-num">${Math.round(s.anonymousShare * 100)}%</div></div>
                <div><div class="t-caption">First reply</div><div class="t-title-3 t-num">${s.medianFirstResponseHours != null ? `${Math.round(s.medianFirstResponseHours)}h` : '—'}</div></div>
              </div>
            </section>
          </div>

          <section class="section">
            <div class="section__head"><h2 class="section__title">Recent activity</h2><a class="link-btn t-callout" href="#/admin/reports">See all</a></div>
            <div class="list">${s.recent.slice(0, 5).map((r) => SU.ui.reportCell(r))}</div>
          </section>`);

        disposers.push(charts.line(page.querySelector('[data-trend]'), {
          caption: 'Reports received and resolved per month, last 12 months',
          labels: months.map((m) => formatMonth(m.date)),
          fullLabels: months.map((m) => formatMonthYear(m.date)),
          series: [
            { name: 'Received', values: months.map((m) => m.received), color: 'var(--chart-1)', area: true },
            { name: 'Resolved', values: months.map((m) => m.resolved), color: 'var(--chart-2)' },
          ],
          height: 210,
        }));
        ctx.onMounted();
      }).catch((e) => {
        console.error(e);
        if (ctx.alive()) SU.router.navigate('/admin/login', { replace: true });
      });
      load();
      ctx.setRefresh(load);

      return () => disposers.forEach((d) => d());
    },
  };
})();
