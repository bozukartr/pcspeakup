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
          <h1 class="hero__title t-hero" data-large-title>Speak up safely.</h1>
          <p class="hero__lead">Confidential. Anonymous by default.</p>
        </section>

        <section class="actions-grid" aria-label="Primary actions">
          <a class="action-card action-card--primary pressable" href="#/submit">
            <span class="action-card__icon">${SU.icon('compose')}</span>
            <span class="action-card__body">
              <span class="action-card__title">Submit a Report</span>
              <span class="action-card__text">About 3 minutes · No login</span>
            </span>
            <span class="action-card__chev">${SU.icon('arrowRight')}</span>
          </a>
          <a class="action-card action-card--tile pressable" href="#/track">
            <span class="action-card__icon">${SU.icon('track')}</span>
            <span class="action-card__title">Track My Report</span>
          </a>
          <a class="action-card action-card--tile pressable" href="#/how">
            <span class="action-card__icon">${SU.icon('help')}</span>
            <span class="action-card__title">How It Works</span>
          </a>
        </section>

        <ul class="trust-row" aria-label="Our commitments">
          ${[['incognito', 'Anonymous'], ['lock', 'Confidential'], ['shieldCheck', 'No retaliation']].map(([icon, label]) => html`
            <li class="trust-pill">${SU.icon(icon)}${label}</li>`)}
        </ul>

        <section class="section">
          <div class="section__head">
            <h2 class="section__title">What can I report?</h2>
          </div>
          <div class="cat-grid">
            ${catalog.CATEGORIES.map((c) => html`
              <a class="cat-chip pressable" href="#/submit?category=${c.id}" aria-label="Report: ${c.label}">
                ${ui.categoryTile(c.id)}
                <span class="cat-chip__label">${c.label}</span>
              </a>`)}
          </div>
        </section>

        <p class="demo-note">${SU.icon('alertCircle')}<span>Emergency? Contact local emergency services. · Demo build — data stays in this browser. <a class="link-btn" href="#/how">Details</a></span></p>`);
    },
  };
})();
