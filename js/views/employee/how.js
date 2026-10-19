/* ==========================================================================
   Employee · How It Works — process, privacy commitments and FAQ.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML } = SU.util;
  const { ui } = SU;
  SU.views = SU.views || {};

  const STEPS = [
    ['compose', 'Submit your report', 'Choose a category and describe what happened. You don’t need to log in or give your name.'],
    ['key', 'Save your credentials', 'You’ll receive a tracking reference and a private access code. Keep them safe — they can’t be recovered.'],
    ['eye', 'An authorized team reviews it', 'Ethics & Compliance acknowledges your report, typically within 2 business days, and assesses next steps.'],
    ['message', 'Stay in the loop', 'Check status and exchange anonymous messages with the case team at any time.'],
  ];

  const FAQ = [
    ['Will my manager find out that I reported something?',
      'No. Reports are visible only to a small group of authorized Ethics & Compliance staff. If a report concerns someone on that team, it is routed to an independent reviewer.'],
    ['Can I really stay anonymous?',
      'Yes. We never ask for your name unless you choose to share it. In a production deployment, IP addresses and device identifiers are not logged for reporters. Be mindful that details you write — or metadata in attached files — could indirectly identify you.'],
    ['What should I include in my report?',
      'Focus on facts: what happened, when and where, who was involved and whether anyone else witnessed it. You don’t need proof to raise a concern in good faith.'],
    ['What happens if I lose my access code?',
      'Access codes are stored only as one-way hashes, so nobody can retrieve or reset them. You can submit a new report and reference the original one.'],
    ['How long does an investigation take?',
      'It depends on complexity. Most cases are acknowledged within 2 business days and concluded within 30–60 days. You’ll see each status change as it happens.'],
    ['Am I protected from retaliation?',
      'Yes. Retaliation against anyone who raises a concern in good faith is strictly prohibited and is itself treated as serious misconduct.'],
  ];

  SU.views.how = {
    area: 'employee',
    tab: 'how',
    depth: 0,
    title: 'How It Works',
    pageClass: 'page--narrow',
    mount(page, { shell }) {
      setHTML(page, html`
        ${ui.pageHead({ title: 'How It Works', sub: 'A simple, transparent process designed to protect you at every step.' })}

        <section class="card card--pad">
          <ol class="steps">
            ${STEPS.map(([icon, title, text], i) => html`
              <li class="steps__item">
                <span class="steps__icon">${SU.icon(icon)}<span class="steps__num">${i + 1}</span></span>
                <div><h3 class="t-headline">${title}</h3><p class="t-callout text-2" style="margin-top:4px">${text}</p></div>
              </li>`)}
          </ol>
          <a class="btn btn--primary btn--lg btn--block" href="#/submit" style="margin-top:24px">Submit a Report</a>
        </section>

        <section class="section">
          <div class="section__head"><h2 class="section__title">Our privacy commitments</h2></div>
          <div class="privacy-grid">
            ${[
              ['incognito', 'Anonymous by design', 'No account, no name, no email required.'],
              ['fingerprint', 'No tracking', 'Reporter IP addresses and device fingerprints are not collected.'],
              ['lock', 'Encrypted', 'Reports and messages are encrypted in transit and at rest.'],
              ['users', 'Need-to-know access', 'Role-based access limits each case to its assigned reviewers.'],
            ].map(([icon, t, d]) => html`
              <div class="card card--pad privacy-tile">
                <span class="tile-icon tile-icon--green">${SU.icon(icon)}</span>
                <div class="t-headline" style="margin-top:12px;font-size:15px">${t}</div>
                <p class="t-callout text-2" style="margin-top:4px">${d}</p>
              </div>`)}
          </div>
          <p class="t-caption" style="margin:10px 4px 0">These commitments describe the intended production system. See the demo notice below.</p>
        </section>

        <section class="section">
          <div class="section__head"><h2 class="section__title">Frequently asked questions</h2></div>
          <div class="card accordion">
            ${FAQ.map(([q, a]) => html`
              <details><summary>${q}${SU.icon('chevronDown')}</summary><div class="accordion__body">${a}</div></details>`)}
          </div>
        </section>

        <section class="section">
          <div class="card card--pad demo-card">
            <div class="row gap-3" style="align-items:flex-start">
              <span class="tile-icon tile-icon--amber">${SU.icon('alertTriangle')}</span>
              <div>
                <h2 class="t-headline">About this demonstration</h2>
                <p class="t-callout text-2" style="margin-top:6px">This prototype stores all data in your browser’s <b>localStorage</b>. Client-side storage provides <b>no real anonymity, confidentiality or security</b> — anyone with access to this browser can read it, and nothing is sent to a server. Please do not enter real reports here.</p>
                <p class="t-callout text-2" style="margin-top:8px">A production deployment requires a secure backend with encrypted storage, authentication, role-based access control, audit logging and protected messaging.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="list">
            <button class="cell cell--icon" type="button" data-theme>
              <span class="tile-icon">${SU.icon('sun')}</span>
              <span class="cell__body"><span class="cell__title">Appearance</span></span>
              <span class="cell__value" data-theme-value>${shell.themePref[0].toUpperCase() + shell.themePref.slice(1)}</span>
              <span class="cell__chev">${SU.icon('chevronRight')}</span>
            </button>
            <button class="cell cell--icon" type="button" data-shortcuts>
              <span class="tile-icon">${SU.icon('keyboard')}</span>
              <span class="cell__body"><span class="cell__title">Keyboard shortcuts</span></span>
              <span class="cell__chev">${SU.icon('chevronRight')}</span>
            </button>
            <a class="cell cell--icon" href="#/admin">
              <span class="tile-icon tile-icon--navy">${SU.icon('lock')}</span>
              <span class="cell__body"><span class="cell__title">Case management</span><span class="cell__sub" style="display:block">For authorized Ethics & Compliance staff</span></span>
              <span class="cell__chev">${SU.icon('chevronRight')}</span>
            </a>
          </div>
        </section>`);

      page.querySelector('[data-theme]').addEventListener('click', (e) => {
        shell.themeMenu(e.currentTarget);
      });
      page.querySelector('[data-shortcuts]').addEventListener('click', () => shell.showShortcuts());
      const sync = new MutationObserver(() => {
        const p = shell.themePref;
        const v = page.querySelector('[data-theme-value]');
        if (v) v.textContent = p[0].toUpperCase() + p.slice(1);
      });
      sync.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-pref'] });
      return () => sync.disconnect();
    },
  };
})();
