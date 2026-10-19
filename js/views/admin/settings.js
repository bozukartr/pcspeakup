/* ==========================================================================
   Admin · Settings — profile, appearance, notifications, data, security.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, haptic } = SU.util;
  const { ui, store, router } = SU;
  SU.views = SU.views || {};

  const PREFS = 'clearline.prefs';
  const loadPrefs = () => { try { return { newReports: true, replies: true, digest: false, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch (_) { return { newReports: true, replies: true, digest: false }; } };

  SU.views.settings = {
    area: 'admin',
    tab: 'settings',
    depth: 0,
    title: 'Settings',
    pageClass: 'page--narrow',
    guard: () => SU.adminGuard(),
    mount(page, ctx) {
      const me = store.currentAdmin();
      const prefs = loadPrefs();
      ctx.shell.setTop({ title: 'Settings' });

      const toggle = (key, title, sub) => html`
        <label class="cell">
          <span class="cell__body"><span class="cell__title">${title}</span>${sub ? html`<span class="cell__sub" style="display:block">${sub}</span>` : ''}</span>
          <span class="switch"><input type="checkbox" data-pref="${key}" ${prefs[key] ? 'checked' : ''} aria-label="${title}"><span class="switch__track"></span></span>
        </label>`;

      const arch = [
        ['server', 'Secure backend API', 'Replace the localStorage adapter in store.js with an HTTPS client.'],
        ['database', 'Encrypted storage', 'Envelope encryption at rest with keys held in a managed KMS/HSM.'],
        ['fingerprint', 'Authentication', 'SSO (SAML/OIDC) with enforced MFA for all case handlers.'],
        ['users', 'Role-based access', 'Per-case access lists, conflict-of-interest exclusion, least privilege.'],
        ['lock', 'Protected messaging', 'Reporter channel via access-code session; no IP or device logging.'],
        ['activity', 'Audit trail', 'Append-only, tamper-evident logging of every view and change.'],
      ];

      setHTML(page, html`
        ${ui.pageHead({ title: 'Settings' })}

        <div class="list">
          <div class="cell" style="padding:16px">
            ${ui.avatar(me.name)}
            <div class="cell__body"><div class="cell__title">${me.name}</div><div class="cell__sub">${me.role} · ${me.email}</div></div>
            <span class="pill pill--neutral">Case handler</span>
          </div>
        </div>

        <section class="section">
          <h2 class="list__header t-overline">Appearance</h2>
          <div class="card card--pad" style="padding:16px">
            ${ui.segmented({ name: 'theme', label: 'Theme', block: true, value: ctx.shell.themePref, options: [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] })}
          </div>
        </section>

        <section class="section">
          <h2 class="list__header t-overline">Notifications</h2>
          <div class="list">
            ${toggle('newReports', 'New reports', '')}
            ${toggle('replies', 'Reporter replies', '')}
            ${toggle('digest', 'Weekly digest', '')}
          </div>
        </section>

        <section class="section">
          <h2 class="list__header t-overline">Data</h2>
          <div class="list">
            <button class="cell cell--icon" type="button" data-export>
              <span class="tile-icon">${SU.icon('download')}</span>
              <span class="cell__body"><span class="cell__title">Export CSV</span></span>
              <span class="cell__chev">${SU.icon('chevronRight')}</span>
            </button>
            <button class="cell cell--icon" type="button" data-shortcuts>
              <span class="tile-icon">${SU.icon('keyboard')}</span>
              <span class="cell__body"><span class="cell__title">Keyboard shortcuts</span></span>
              <span class="cell__chev">${SU.icon('chevronRight')}</span>
            </button>
            <button class="cell cell--icon" type="button" data-reset>
              <span class="tile-icon tile-icon--red">${SU.icon('refresh')}</span>
              <span class="cell__body"><span class="cell__title text-danger">Reset demo data</span></span>
            </button>
          </div>
        </section>

        <section class="section">
          <details class="card disclosure">
            <summary>${SU.icon('server')}<span>Production architecture</span><span class="pill pill--review" style="margin-left:auto">Demo build</span></summary>
            <div class="disclosure__body">
              <ul class="arch-list">
                ${arch.map(([icon, t, d]) => html`<li><span class="tile-icon tile-icon--navy">${SU.icon(icon)}</span><div><div class="t-headline" style="font-size:14px">${t}</div><p class="t-caption">${d}</p></div></li>`)}
              </ul>
            </div>
          </details>
        </section>

        <section class="section">
          <button class="btn btn--danger-ghost btn--block" type="button" data-signout style="background:var(--surface);box-shadow:var(--shadow-sm),0 0 0 1px var(--border)">${SU.icon('logout')}Sign Out</button>
          <p class="t-caption" style="text-align:center;margin-top:16px">Clearline 1.0 · Demo build</p>
        </section>`);

      ui.bindSegmented(page.querySelector('[data-segmented]'), (v) => ctx.shell.applyTheme(v));

      page.querySelectorAll('[data-pref]').forEach((input) => input.addEventListener('change', () => {
        prefs[input.dataset.pref] = input.checked;
        try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (_) { /* ignore */ }
        haptic(5);
        SU.toast.success('Preference saved');
      }));

      page.querySelector('[data-export]').addEventListener('click', () => {
        SU.util.download(`clearline-reports-${new Date().toISOString().slice(0, 10)}.csv`, store.exportCSV());
        SU.toast.success('Export downloaded');
      });
      page.querySelector('[data-shortcuts]').addEventListener('click', () => ctx.shell.showShortcuts());

      page.querySelector('[data-reset]').addEventListener('click', async () => {
        const ok = await SU.overlay.confirm({
          title: 'Reset demo data?',
          message: 'All reports, messages and notes — including any you created — will be replaced with the original sample data.',
          confirmLabel: 'Reset', destructive: true, icon: 'refresh',
        });
        if (!ok) return;
        await store.resetDemo();
        SU.toast.success('Demo data restored');
      });

      page.querySelector('[data-signout]').addEventListener('click', async () => {
        const ok = await SU.overlay.confirm({ title: 'Sign out?', message: 'You’ll need to sign in again to access case management.', confirmLabel: 'Sign Out', icon: 'logout' });
        if (!ok) return;
        store.signOut();
        SU.toast.info('Signed out');
        router.navigate('/admin/login', { replace: true });
      });
    },
  };
})();
