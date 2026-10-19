/* ==========================================================================
   Command palette (⌘K / Ctrl+K) — jump to any screen, run quick actions
   and, for signed-in case handlers, find reports by subject or reference.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, fragment, debounce, haptic } = SU.util;
  const { store, router, catalog } = SU;
  let open = false;

  function baseItems() {
    const nav = SU.shell.nav();
    const admin = SU.shell.area() === 'admin';
    const items = nav.items.map((it) => ({ group: 'Go to', label: it.longLabel || it.label, icon: it.icon, run: () => router.navigate(it.to) }));
    if (!admin) {
      items.push({ group: 'Actions', label: 'Report a concern', icon: 'compose', run: () => router.navigate('/submit') });
    }
    items.push(
      { group: 'Actions', label: 'Switch appearance', icon: 'sun', run: () => {
        const order = ['system', 'light', 'dark'];
        const next = order[(order.indexOf(SU.shell.themePref) + 1) % order.length];
        SU.shell.applyTheme(next);
        SU.toast.info(`Appearance: ${next[0].toUpperCase()}${next.slice(1)}`);
      } },
      { group: 'Actions', label: admin ? 'Open employee portal' : 'Open case management', icon: admin ? 'users' : 'lock', run: () => router.navigate(admin ? '/' : '/admin') },
      { group: 'Actions', label: 'Keyboard shortcuts', icon: 'keyboard', run: () => SU.shell.showShortcuts() },
    );
    return items;
  }

  function openPalette() {
    if (open) return;
    open = true;
    const panel = fragment(html`
      <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette" tabindex="-1">
        <div class="palette__search">
          ${SU.icon('search')}
          <input type="text" placeholder="Search or jump to…" aria-label="Search commands" role="combobox" aria-expanded="true" aria-controls="palette-list" autocomplete="off" spellcheck="false" data-input>
          <span class="kbd">esc</span>
        </div>
        <div class="palette__list" id="palette-list" role="listbox" data-list></div>
      </div>`);

    const entry = SU.overlay.mount(panel, { initialFocus: '[data-input]', onClose: () => { open = false; } });
    const input = panel.querySelector('[data-input]');
    const listEl = panel.querySelector('[data-list]');
    const base = baseItems();
    let items = [];
    let active = 0;

    function render() {
      if (!items.length) {
        setHTML(listEl, html`<div class="palette__empty">No results</div>`);
        return;
      }
      let lastGroup = '';
      setHTML(listEl, items.map((it, i) => {
        const head = it.group !== lastGroup ? html`<div class="palette__group">${it.group}</div>` : '';
        lastGroup = it.group;
        return html`${head}<button type="button" class="palette__item" role="option" id="pal-${i}" aria-selected="${i === active ? 'true' : 'false'}" data-i="${i}">
          ${SU.icon(it.icon)}<span class="grow truncate">${it.label}</span>${it.meta ? html`<span class="palette__meta">${it.meta}</span>` : ''}
        </button>`;
      }));
      input.setAttribute('aria-activedescendant', `pal-${active}`);
      listEl.querySelectorAll('[data-i]').forEach((b) => {
        b.addEventListener('click', () => choose(+b.dataset.i));
        b.addEventListener('pointermove', () => { if (active !== +b.dataset.i) { active = +b.dataset.i; highlight(); } });
      });
    }

    function highlight() {
      listEl.querySelectorAll('[data-i]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.i === active)));
      input.setAttribute('aria-activedescendant', `pal-${active}`);
      const el = listEl.querySelector(`[data-i="${active}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    function choose(i) {
      const it = items[i];
      if (!it) return;
      haptic(6);
      entry.close();
      setTimeout(it.run, 20);
    }

    const search = debounce(async () => {
      const q = input.value.trim().toLowerCase();
      const matched = q ? base.filter((it) => it.label.toLowerCase().includes(q)) : base;
      let reports = [];
      if (q && store.currentAdmin()) {
        try {
          reports = (await store.listReports({ q, status: 'all', sort: 'updated' }, { fast: true })).slice(0, 6).map((r) => ({
            group: 'Reports', label: r.subject, icon: catalog.category(r.category).icon, meta: r.reference,
            run: () => router.navigate(`/admin/reports/${r.id}`),
          }));
        } catch (_) { reports = []; }
      }
      if (!open) return;
      items = [...reports, ...matched];
      active = 0;
      render();
    }, 90);

    input.addEventListener('input', search);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    });

    items = base;
    render();
  }

  window.SU.palette = { open: openPalette };
})();
