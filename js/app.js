/* ==========================================================================
   App shell — navigation chrome, routing lifecycle, theme, shortcuts.
   Views register with the router; the shell owns everything around them.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, $, haptic } = SU.util;
  const { store, router } = SU;
  const V = SU.views;

  /* ---------- Navigation model ---------- */
  const NAV = {
    employee: {
      label: 'Employee',
      items: [
        { id: 'home', label: 'Home', icon: 'home', to: '/' },
        { id: 'submit', label: 'Report', longLabel: 'Submit a Report', icon: 'compose', to: '/submit' },
        { id: 'track', label: 'Track', longLabel: 'Track My Report', icon: 'track', to: '/track' },
        { id: 'how', label: 'Help', longLabel: 'How It Works', icon: 'help', to: '/how' },
      ],
    },
    admin: {
      label: 'Case Management',
      items: [
        { id: 'dashboard', label: 'Overview', icon: 'dashboard', to: '/admin' },
        { id: 'reports', label: 'Reports', icon: 'inbox', to: '/admin/reports', badge: 'unread' },
        { id: 'analytics', label: 'Analytics', icon: 'chart', to: '/admin/analytics' },
        { id: 'settings', label: 'Settings', icon: 'settings', to: '/admin/settings' },
      ],
    },
  };

  /* ---------- Routes ---------- */
  router.register('/', V.home);
  router.register('/submit', V.submit);
  router.register('/track', V.track);
  router.register('/track/:ref', V.trackDetail);
  router.register('/how', V.how);
  router.register('/admin/login', V.login);
  router.register('/admin', V.dashboard);
  router.register('/admin/reports', V.reports);
  router.register('/admin/reports/:id', V.caseView);
  router.register('/admin/analytics', V.analytics);
  router.register('/admin/settings', V.settings);

  /* ---------- Elements ---------- */
  const el = {
    root: document.documentElement,
    view: $('#view'),
    topbar: $('#topbar'),
    lead: $('#topbarLead'),
    title: $('#topbarTitle'),
    trail: $('#topbarTrail'),
    tabbar: $('#tabbar'),
    sidebarNav: $('#sidebarNav'),
    sidebarFoot: $('#sidebarFoot'),
    sidebarCtx: $('#sidebarContext'),
    sidebarToggle: $('#sidebarToggle'),
    announcer: $('#routeAnnouncer'),
  };

  let renderedArea = null;
  let cleanup = null;
  let token = 0;
  let titleObserver = null;
  let firstRoute = true;

  /* ---------- Theme ---------- */
  const theme = {
    get pref() { try { return localStorage.getItem('clearline.theme') || 'system'; } catch (_) { return 'system'; } },
    apply(pref) {
      try { localStorage.setItem('clearline.theme', pref); } catch (_) { /* ignore */ }
      const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      el.root.dataset.theme = dark ? 'dark' : 'light';
      el.root.dataset.themePref = pref;
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0D0F13' : '#F6F6F4'));
      renderSidebarFoot();
    },
    menu(anchor) {
      const p = theme.pref;
      SU.overlay.menu(anchor, [
        { heading: 'Appearance' },
        { label: 'System', icon: 'monitor', checked: p === 'system', onSelect: () => theme.apply('system') },
        { label: 'Light', icon: 'sun', checked: p === 'light', onSelect: () => theme.apply('light') },
        { label: 'Dark', icon: 'moon', checked: p === 'dark', onSelect: () => theme.apply('dark') },
      ], { title: 'Appearance' });
    },
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (theme.pref === 'system') theme.apply('system'); });

  /* ---------- Sidebar ---------- */
  function setCollapsed(collapsed) {
    el.root.classList.toggle('sidebar-collapsed', collapsed);
    try { localStorage.setItem('clearline.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (_) { /* ignore */ }
    el.sidebarToggle.setAttribute('aria-pressed', String(collapsed));
    el.sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    el.sidebarToggle.title = collapsed ? 'Expand sidebar  [' : 'Collapse sidebar  [';
  }
  setHTML(el.sidebarToggle, SU.icon('sidebar'));
  el.sidebarToggle.addEventListener('click', () => setCollapsed(!el.root.classList.contains('sidebar-collapsed')));
  setCollapsed(el.root.classList.contains('sidebar-collapsed'));

  function badgeFor(item) {
    if (item.badge !== 'unread') return 0;
    const c = store.counts();
    return c.unread + c.fresh;
  }

  function renderNav(area) {
    const nav = NAV[area];
    const isAdmin = area === 'admin';

    setHTML(el.sidebarCtx, html`
      <div class="t-overline" style="margin-bottom:6px">${isAdmin ? 'Ethics & Compliance' : 'Speak Up Safely'}</div>`);

    setHTML(el.sidebarNav, html`
      ${nav.items.map((it) => html`
        <a class="nav-item" href="#${it.to}" data-nav="${it.id}" title="${it.longLabel || it.label}">
          ${SU.icon(it.icon)}<span class="nav-item__label">${it.longLabel || it.label}</span>
          <span class="nav-item__badge nav-item__badge--alert" data-badge="${it.id}" hidden></span>
        </a>`)}
      ${isAdmin ? '' : html`
        <div class="nav-label t-overline">Your privacy</div>
        <div class="card card--sunken nav-privacy" style="margin:0 4px;padding:14px;border-radius:14px">
          <div class="row gap-2" style="font-weight:600;font-size:13px">${SU.icon('shieldCheck', 'style="width:16px;height:16px;color:var(--success)"')}Anonymous by default</div>
          <p class="t-caption" style="margin-top:6px;color:var(--text-2)">We never ask for your name unless you choose to share it.</p>
        </div>`}`);

    setHTML(el.tabbar, html`${nav.items.map((it) => html`
      <a class="tab" href="#${it.to}" data-nav="${it.id}">
        ${SU.icon(it.icon)}<span>${it.label}</span>
        <span class="tab__pip" data-badge="${it.id}" hidden></span>
      </a>`)}`);

    el.tabbar.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => haptic(5)));
    renderSidebarFoot();
    updateBadges();
  }

  function renderSidebarFoot() {
    if (!renderedArea) return;
    const pref = theme.pref;
    const themeIcon = pref === 'dark' ? 'moon' : pref === 'light' ? 'sun' : 'monitor';
    const admin = store.currentAdmin();
    setHTML(el.sidebarFoot, html`
      <button class="nav-item" type="button" data-theme-btn title="Appearance">${SU.icon(themeIcon)}<span class="nav-item__label">Appearance</span><span class="nav-item__badge" style="background:none">${pref[0].toUpperCase() + pref.slice(1)}</span></button>
      ${renderedArea === 'admin'
        ? html`
          <a class="nav-item" href="#/" title="Employee portal">${SU.icon('users')}<span class="nav-item__label">Employee portal</span></a>
          ${admin ? html`
            <div class="user-chip">
              ${SU.ui.avatar(admin.name)}
              <div class="user-chip__text grow"><div class="user-chip__name">${admin.name}</div><div class="user-chip__role">${admin.role}</div></div>
            </div>` : ''}`
        : html`<a class="nav-item" href="#/admin" title="Case management">${SU.icon('lock')}<span class="nav-item__label">Case management</span></a>`}`);
    el.sidebarFoot.querySelector('[data-theme-btn]').addEventListener('click', (e) => theme.menu(e.currentTarget));
  }

  function updateBadges() {
    const area = renderedArea && NAV[renderedArea];
    if (!area) return;
    area.items.forEach((it) => {
      const n = badgeFor(it);
      document.querySelectorAll(`[data-badge="${it.id}"]`).forEach((b) => {
        b.hidden = !n;
        b.textContent = n > 99 ? '99+' : String(n);
      });
    });
  }

  function setActive(tab) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------- Top bar API for views ---------- */
  const shell = {
    setTop({ title = '', back = null, actions = null, brand = false } = {}) {
      setHTML(el.title, title);
      setHTML(el.lead, back
        ? html`<button class="back-btn" type="button" data-back>${SU.icon('chevronLeft')}<span>${back.label || 'Back'}</span></button>`
        : brand ? html`<a class="brand" href="#/" aria-label="Clearline home"><span class="brand__mark" aria-hidden="true"></span><span class="brand__name">Clearline</span></a>` : '');
      if (back) el.lead.querySelector('[data-back]').addEventListener('click', () => router.back(back.to));
      setHTML(el.trail, actions || '');
      return el.trail;
    },
    themeMenu: (anchor) => theme.menu(anchor),
    applyTheme: (p) => theme.apply(p),
    get themePref() { return theme.pref; },
    refreshBadges: updateBadges,
  };
  SU.shell = shell;

  /* ---------- Large title → compact title on scroll ---------- */
  function observeTitle(page) {
    if (titleObserver) titleObserver.disconnect();
    const large = page.querySelector('[data-large-title]');
    el.topbar.classList.toggle('show-title', !large);
    if (!large) return;
    titleObserver = new IntersectionObserver(([entry]) => {
      el.topbar.classList.toggle('show-title', !entry.isIntersecting);
    }, { rootMargin: `-${el.topbar.offsetHeight}px 0px 0px 0px`, threshold: 0 });
    titleObserver.observe(large);
  }

  const onScroll = () => el.topbar.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Route lifecycle ---------- */
  function onRoute(match, prev, direction) {
    const view = match.view;
    const myToken = ++token;
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    SU.overlay.closeAll();

    const area = view.area === 'auth' ? 'admin' : view.area;
    el.root.dataset.area = view.area;
    el.root.classList.toggle('no-chrome', !!view.chromeless);
    el.root.classList.toggle('hide-tabbar', !!view.hideTabbar);
    if (area !== renderedArea) { renderedArea = area; renderNav(area); }
    setActive(view.tab);

    const page = document.createElement('div');
    page.className = `page ${view.pageClass || ''} ${firstRoute || SU.util.prefersReducedMotion() ? '' : `enter-${direction}`}`;
    el.view.replaceChildren(page);
    window.scrollTo(0, 0);
    onScroll();
    shell.setTop({ title: view.title });

    const ctx = {
      params: match.params,
      query: match.query,
      shell,
      alive: () => myToken === token,
      onMounted: () => observeTitle(page),
    };
    try {
      const result = view.mount(page, ctx);
      if (typeof result === 'function') cleanup = result;
    } catch (e) {
      console.error(e);
      setHTML(page, SU.ui.empty({ icon: 'alertCircle', title: 'Something went wrong', text: 'Please try again in a moment.' }));
    }
    observeTitle(page);

    const docTitle = typeof view.title === 'string' && view.title ? `${view.title} · Clearline` : 'Clearline · Speak Up Safely';
    document.title = docTitle;
    if (!firstRoute) {
      el.announcer.textContent = view.title || 'Clearline';
      el.view.focus({ preventScroll: true });
    }
    firstRoute = false;
  }

  /* ---------- Keyboard shortcuts ---------- */
  function isTyping(e) {
    const t = e.target;
    return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
  }
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || document.body.classList.contains('is-locked')) return;
    if (e.key === '/') {
      const search = document.querySelector('[data-search]');
      if (search) { e.preventDefault(); search.focus(); search.select(); }
    } else if (e.key === '[') {
      if (SU.util.isDesktop()) setCollapsed(!el.root.classList.contains('sidebar-collapsed'));
    } else if (e.key === '?') {
      showShortcuts();
    }
  });

  function showShortcuts() {
    const rows = [
      ['/', 'Focus search'],
      ['[', 'Collapse or expand sidebar'],
      ['?', 'Show keyboard shortcuts'],
      ['Esc', 'Close sheet, dialog or menu'],
      ['Tab', 'Move between controls'],
      ['← →', 'Change segmented options'],
      ['⌘ / Ctrl + Enter', 'Send a message'],
    ];
    SU.overlay.sheet({
      title: 'Keyboard shortcuts',
      body: html`<div class="kv">${rows.map(([k, d]) => html`<div class="kv__row"><span class="kv__key">${d}</span><span class="kbd">${k}</span></div>`)}</div>`,
    });
  }
  shell.showShortcuts = showShortcuts;

  /* ---------- Boot ---------- */
  store.init().then(() => {
    store.subscribe(() => { updateBadges(); });
    router.start(onRoute);
  });
})();
