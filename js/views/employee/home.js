/* ==========================================================================
   Employee · Home — three primary actions, privacy reassurance, categories.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML } = SU.util;
  const { catalog, ui } = SU;
  SU.views = SU.views || {};

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  SU.views.home = {
    area: 'employee',
    tab: 'home',
    depth: 0,
    title: 'Home',
    mount(page, { shell }) {
      const trail = shell.setTop({
        title: 'Clearline',
        brand: true,
        actions: html`<button class="icon-btn" type="button" data-theme aria-label="Appearance">${SU.icon(shell.themePref === 'dark' ? 'moon' : 'sun')}</button>`,
      });
      trail.querySelector('[data-theme]').addEventListener('click', (e) => shell.themeMenu(e.currentTarget));

      setHTML(page, html`
        <section class="hero">
          <div class="t-overline">${greeting()}</div>
          <h1 class="hero__title t-hero" data-large-title>Speak up safely.<br><span class="text-3">We’re listening.</span></h1>
          <p class="hero__lead">Raise a concern, report misconduct or share an idea — confidentially, and anonymously if you prefer. Every report is reviewed by a small, authorized team.</p>
        </section>

        <section class="actions-grid" aria-label="Primary actions">
          <a class="action-card action-card--primary pressable" href="#/submit">
            <span class="action-card__icon">${SU.icon('compose')}</span>
            <span class="action-card__body">
              <span class="action-card__title">Submit a Report</span>
              <span class="action-card__text">Takes about 3 minutes. No login, no name required.</span>
            </span>
            <span class="action-card__chev">${SU.icon('arrowRight')}</span>
          </a>
          <a class="action-card pressable" href="#/track">
            <span class="action-card__icon">${SU.icon('track')}</span>
            <span class="action-card__body">
              <span class="action-card__title">Track My Report</span>
              <span class="action-card__text">Check status and reply to messages using your access code.</span>
            </span>
            <span class="action-card__chev">${SU.icon('chevronRight')}</span>
          </a>
          <a class="action-card pressable" href="#/how">
            <span class="action-card__icon">${SU.icon('help')}</span>
            <span class="action-card__body">
              <span class="action-card__title">How It Works</span>
              <span class="action-card__text">What happens after you report, and how your privacy is protected.</span>
            </span>
            <span class="action-card__chev">${SU.icon('chevronRight')}</span>
          </a>
        </section>

        <section class="section">
          <div class="trust-strip card card--pad">
            ${[
              ['incognito', 'Anonymous by default', 'Your name is never requested unless you choose to share it.'],
              ['lock', 'Confidential handling', 'Only authorized Ethics & Compliance staff can view reports.'],
              ['shieldCheck', 'Zero retaliation', 'Retaliation against anyone who speaks up in good faith is prohibited.'],
            ].map(([icon, title, text]) => html`
              <div class="trust-item">
                <span class="tile-icon tile-icon--green">${SU.icon(icon)}</span>
                <div><div class="t-headline" style="font-size:15px">${title}</div><p class="t-callout text-2" style="margin-top:2px">${text}</p></div>
              </div>`)}
          </div>
        </section>

        <section class="section">
          <div class="section__head">
            <h2 class="section__title">What can I report?</h2>
            <a class="link-btn t-callout" href="#/how">Learn more</a>
          </div>
          <div class="cat-grid">
            ${catalog.CATEGORIES.map((c) => html`
              <a class="cat-chip pressable" href="#/submit?category=${c.id}">
                ${ui.categoryTile(c.id)}
                <span class="cat-chip__label">${c.label}</span>
              </a>`)}
          </div>
        </section>

        <section class="section">
          <div class="callout callout--info">
            ${SU.icon('alertCircle')}
            <div><strong>In an emergency, do not use this form.</strong> If you or someone else is in immediate danger, contact local emergency services right away.</div>
          </div>
          <p class="demo-note">${SU.icon('info')}<span>This is a demonstration. Data is stored in your browser only and is not anonymous, confidential or secure. <a class="link-btn" href="#/how">Read more</a></span></p>
        </section>`);
    },
  };
})();
