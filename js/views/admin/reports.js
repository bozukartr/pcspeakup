/* ==========================================================================
   Admin · Reports — searchable, filterable inbox of all cases.
   Filter state survives navigation to a case and back (session only).
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, debounce, formatNumber, haptic } = SU.util;
  const { catalog, ui, store } = SU;
  SU.views = SU.views || {};

  const KEY = 'clearline.reports.filters';
  const DEFAULTS = { q: '', status: 'open', categories: [], priorities: [], assignee: 'all', unread: false, sort: 'newest' };
  const SORT_LABELS = { newest: 'Newest first', oldest: 'Oldest first', updated: 'Recently updated', priority: 'Highest priority' };

  const loadFilters = () => { try { return { ...DEFAULTS, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }; } catch (_) { return { ...DEFAULTS }; } };
  const saveFilters = (f) => { try { sessionStorage.setItem(KEY, JSON.stringify(f)); } catch (_) { /* ignore */ } };

  SU.views.reports = {
    area: 'admin',
    tab: 'reports',
    depth: 0,
    title: 'Reports',
    pageClass: 'page--wide',
    guard: () => SU.adminGuard(),
    mount(page, ctx) {
      const f = loadFilters();
      let all = [];
      let first = true;

      const trail = ctx.shell.setTop({
        title: 'Reports',
        actions: html`
          <button class="icon-btn" type="button" data-sort aria-label="Sort">${SU.icon('sort')}</button>
          <button class="icon-btn" type="button" data-more aria-label="More actions">${SU.icon('more')}</button>`,
      });
      trail.querySelector('[data-sort]').addEventListener('click', (e) => sortMenu(e.currentTarget));
      trail.querySelector('[data-more]').addEventListener('click', (e) => SU.overlay.menu(e.currentTarget, [
        { label: 'Export as CSV', icon: 'download', onSelect: exportCSV },
        { label: 'Reset filters', icon: 'refresh', onSelect: () => { Object.assign(f, DEFAULTS); syncControls(); refresh(); } },
      ], { title: 'Reports' }));

      setHTML(page, html`
        ${ui.pageHead({ title: 'Reports', sub: null })}
        <div class="toolbar">
          <div class="search grow">
            ${SU.icon('search')}
            <input class="input" type="search" placeholder="Search by subject, reference or keyword" aria-label="Search reports" value="${f.q}" data-search autocomplete="off">
            <span class="search__kbd" aria-hidden="true">/</span>
          </div>
          <button class="btn btn--secondary toolbar__filter" type="button" data-filter>${SU.icon('filter')}<span>Filters</span><span class="count-badge" data-filter-count hidden></span></button>
        </div>
        <div class="chips status-chips" role="toolbar" aria-label="Filter by status" data-status-chips></div>
        <div class="row between results-bar">
          <span class="t-caption" data-count aria-live="polite"></span>
          <button class="link-btn t-caption" type="button" data-sort-inline></button>
        </div>
        <div data-list>${ui.skelList(7)}</div>`);

      const search = page.querySelector('[data-search]');
      const listEl = page.querySelector('[data-list]');
      const chipsEl = page.querySelector('[data-status-chips]');

      search.addEventListener('input', debounce(() => { f.q = search.value.trim(); refresh(); }, 160));
      search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; f.q = ''; refresh(); } });
      page.querySelector('[data-filter]').addEventListener('click', filterSheet);
      page.querySelector('[data-sort-inline]').addEventListener('click', (e) => sortMenu(e.currentTarget));

      function sortMenu(anchor) {
        SU.overlay.menu(anchor, [
          { heading: 'Sort by' },
          ...Object.entries(SORT_LABELS).map(([k, label]) => ({ label, checked: f.sort === k, onSelect: () => { f.sort = k; refresh(); } })),
        ], { title: 'Sort by' });
      }

      function exportCSV() {
        SU.util.download(`clearline-reports-${new Date().toISOString().slice(0, 10)}.csv`, store.exportCSV());
        SU.toast.success('Export downloaded');
      }

      function activeFilterCount() {
        return f.categories.length + f.priorities.length + (f.assignee !== 'all' ? 1 : 0) + (f.unread ? 1 : 0);
      }

      function syncControls() {
        search.value = f.q;
        const n = activeFilterCount();
        const badge = page.querySelector('[data-filter-count]');
        badge.hidden = !n;
        badge.textContent = String(n);
        page.querySelector('[data-sort-inline]').textContent = SORT_LABELS[f.sort];
      }

      function renderChips() {
        const count = (st) => st === 'all' ? all.length : st === 'open' ? all.filter((r) => r.status !== 'resolved').length : all.filter((r) => r.status === st).length;
        const opts = [{ id: 'open', label: 'Open' }, ...catalog.STATUSES.map((s) => ({ id: s.id, label: s.label })), { id: 'all', label: 'All' }];
        setHTML(chipsEl, opts.map((o) => html`
          <button class="chip" type="button" aria-pressed="${f.status === o.id ? 'true' : 'false'}" data-status="${o.id}">${o.label}<span class="chip__count">${formatNumber(count(o.id))}</span></button>`));
        chipsEl.querySelectorAll('[data-status]').forEach((c) => c.addEventListener('click', () => {
          f.status = c.dataset.status;
          haptic(5);
          renderList();
        }));
      }

      function renderList() {
        saveFilters(f);
        syncControls();
        renderChips();
        const rows = all.filter((r) => f.status === 'all' || (f.status === 'open' ? r.status !== 'resolved' : r.status === f.status));
        page.querySelector('[data-count]').textContent = `${formatNumber(rows.length)} ${rows.length === 1 ? 'report' : 'reports'}`;
        if (!rows.length) {
          const filtered = f.q || activeFilterCount();
          setHTML(listEl, html`<div class="card">${ui.empty({
            icon: filtered ? 'search' : 'inbox',
            title: filtered ? 'No matching reports' : 'No reports here',
            text: filtered ? 'Try a different search term or clear your filters.' : 'New reports will appear here as soon as they’re submitted.',
            action: filtered ? html`<button class="btn btn--secondary" type="button" data-clear>Clear search and filters</button>` : '',
          })}</div>`);
          const clear = listEl.querySelector('[data-clear]');
          if (clear) clear.addEventListener('click', () => { Object.assign(f, { ...DEFAULTS, status: f.status }); syncControls(); refresh(); });
          return;
        }
        setHTML(listEl, html`<div class="list report-list ${first ? 'enter-fade' : ''}">${rows.map(SU.ui.reportCell)}</div>`);
        first = false;
      }

      async function refresh(slow) {
        try {
          all = await store.listReports({ ...f, status: 'all' }, { fast: !slow });
        } catch (e) {
          SU.router.navigate('/admin/login', { replace: true });
          return;
        }
        if (!ctx.alive()) return;
        renderList();
      }

      function filterSheet() {
        const draft = { categories: [...f.categories], priorities: [...f.priorities], assignee: f.assignee, unread: f.unread };
        SU.overlay.sheet({
          title: 'Filters',
          body: html`
            <div class="filter-group">
              <div class="t-overline">Category</div>
              <div class="chips wrap" style="flex-wrap:wrap" data-group="categories">
                ${catalog.CATEGORIES.map((c) => html`<button class="chip" type="button" data-v="${c.id}" aria-pressed="${draft.categories.includes(c.id) ? 'true' : 'false'}">${SU.icon(c.icon)}${c.short}</button>`)}
              </div>
            </div>
            <div class="filter-group">
              <div class="t-overline">Priority</div>
              <div class="chips" style="flex-wrap:wrap" data-group="priorities">
                ${catalog.PRIORITIES.map((p) => html`<button class="chip" type="button" data-v="${p.id}" aria-pressed="${draft.priorities.includes(p.id) ? 'true' : 'false'}">${p.label}</button>`)}
              </div>
            </div>
            <div class="filter-group">
              <div class="t-overline">Assigned to</div>
              ${ui.segmented({ name: 'assignee', label: 'Assigned to', block: true, value: draft.assignee, options: [{ value: 'all', label: 'Anyone' }, { value: 'me', label: 'Me' }, { value: 'none', label: 'Unassigned' }] })}
            </div>
            <label class="row between filter-group" style="cursor:pointer">
              <span><span class="t-headline" style="font-size:15px;display:block">Unread messages only</span><span class="t-caption">Reports with new replies from reporters</span></span>
              <span class="switch"><input type="checkbox" data-unread ${draft.unread ? 'checked' : ''} aria-label="Unread messages only"><span class="switch__track"></span></span>
            </label>`,
          footer: html`<button class="btn btn--secondary" type="button" data-reset>Reset</button><button class="btn btn--primary" type="button" data-apply>Show results</button>`,
          onMount(panel, close) {
            panel.querySelectorAll('[data-group]').forEach((g) => {
              const key = g.dataset.group;
              g.querySelectorAll('[data-v]').forEach((chip) => chip.addEventListener('click', () => {
                const v = chip.dataset.v;
                const on = draft[key].includes(v);
                draft[key] = on ? draft[key].filter((x) => x !== v) : [...draft[key], v];
                chip.setAttribute('aria-pressed', String(!on));
                haptic(4);
              }));
            });
            ui.bindSegmented(panel.querySelector('[data-segmented]'), (v) => { draft.assignee = v; });
            panel.querySelector('[data-unread]').addEventListener('change', (e) => { draft.unread = e.target.checked; });
            panel.querySelector('[data-reset]').addEventListener('click', () => {
              Object.assign(f, { categories: [], priorities: [], assignee: 'all', unread: false });
              close(); refresh();
            });
            panel.querySelector('[data-apply]').addEventListener('click', () => {
              Object.assign(f, draft);
              close(); refresh();
            });
          },
        });
      }

      syncControls();
      refresh(true).then(() => ctx.onMounted());
      const unsub = store.subscribe((src) => { if (src === 'remote') refresh(); });
      return unsub;
    },
  };
})();
