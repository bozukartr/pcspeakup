/* ==========================================================================
   Overlays — bottom sheets (modal on desktop), alert dialogs and context
   menus (popover on desktop, action sheet on touch/mobile).
   All overlays trap focus, close on Escape / scrim tap, restore focus to
   the invoking control, and lock background scroll.
   ========================================================================== */
(function () {
  'use strict';

  const { html, fragment, isWide, haptic } = SU.util;
  const stack = [];
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const root = () => document.getElementById('overlayRoot');

  function lockScroll() { document.body.classList.add('is-locked'); }
  function unlockScroll() { if (!stack.length) document.body.classList.remove('is-locked'); }

  function trapFocus(container, e) {
    const items = Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) { e.preventDefault(); container.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown', (e) => {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); top.close(); }
    else if (e.key === 'Tab') trapFocus(top.panel, e);
  });

  /** Shared open/close mechanics for a scrim + panel pair. */
  function mount(panel, { scrimClass = '', onClose, initialFocus } = {}) {
    const opener = document.activeElement;
    const scrim = fragment(html`<div class="scrim ${scrimClass}"></div>`);
    root().append(scrim, panel);
    lockScroll();

    let closed = false;
    const entry = {
      panel,
      close(result) {
        if (closed) return;
        closed = true;
        stack.splice(stack.indexOf(entry), 1);
        scrim.classList.add('is-leaving');
        panel.classList.add('is-leaving');
        const done = () => { scrim.remove(); panel.remove(); };
        panel.addEventListener('animationend', done, { once: true });
        setTimeout(done, 420);
        unlockScroll();
        if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
        if (onClose) onClose(result);
      },
    };
    stack.push(entry);
    scrim.addEventListener('click', () => entry.close());

    requestAnimationFrame(() => {
      const target = initialFocus ? panel.querySelector(initialFocus) : panel.querySelector('[autofocus]');
      (target || panel).focus({ preventScroll: true });
    });
    return entry;
  }

  /* ---------- Sheet ---------- */
  /**
   * @param {object} o
   * @param {string} o.title
   * @param {SafeHTML} o.body
   * @param {SafeHTML} [o.footer]
   * @param {(panel: HTMLElement, close: Function) => void} [o.onMount]
   */
  function sheet({ title, body, footer, onMount, onClose, initialFocus, label }) {
    const id = SU.util.uid('sheet');
    const panel = fragment(html`
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}" tabindex="-1">
        <div class="sheet__grabber" aria-hidden="true"></div>
        <header class="sheet__head">
          <span></span>
          <h2 class="sheet__title" id="${id}">${title || label || ''}</h2>
          <button class="icon-btn icon-btn--sm" type="button" data-close aria-label="Close">${SU.icon('close')}</button>
        </header>
        <div class="sheet__body">${body}</div>
        ${footer ? html`<footer class="sheet__foot">${footer}</footer>` : ''}
      </section>`);

    const entry = mount(panel, { onClose, initialFocus });
    panel.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => entry.close()));
    enableDrag(panel, entry);
    if (onMount) onMount(panel, entry.close);
    return entry;
  }

  /** Drag the grabber/header down to dismiss — mobile sheets only. */
  function enableDrag(panel, entry) {
    const handles = [panel.querySelector('.sheet__grabber'), panel.querySelector('.sheet__head')];
    let startY = 0, dy = 0, startT = 0, dragging = false;
    const onDown = (e) => {
      if (isWide() || e.target.closest('button')) return;
      dragging = true; startY = e.clientY; startT = performance.now(); dy = 0;
      panel.classList.add('is-dragging');
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      panel.style.transform = `translateY(${dy}px)`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-dragging');
      const velocity = dy / Math.max(performance.now() - startT, 1);
      if (dy > panel.offsetHeight * 0.3 || velocity > 0.6) {
        panel.style.transition = 'transform 240ms cubic-bezier(0.32,0.72,0,1)';
        panel.style.transform = 'translateY(100%)';
        haptic(6);
        setTimeout(() => entry.close(), 200);
      } else {
        panel.style.transition = 'transform 280ms cubic-bezier(0.32,0.72,0,1)';
        panel.style.transform = '';
        setTimeout(() => { panel.style.transition = ''; }, 300);
      }
    };
    handles.forEach((h) => {
      if (!h) return;
      h.addEventListener('pointerdown', onDown);
      h.addEventListener('pointermove', onMove);
      h.addEventListener('pointerup', onUp);
      h.addEventListener('pointercancel', onUp);
    });
  }

  /* ---------- Confirm dialog ---------- */
  function confirm({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, icon }) {
    return new Promise((resolve) => {
      const tid = SU.util.uid('dlg');
      const panel = fragment(html`
        <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="${tid}" aria-describedby="${tid}-m" tabindex="-1">
          ${icon ? html`<div class="dialog__icon tile-icon tile-icon--lg ${destructive ? 'tile-icon--red' : 'tile-icon--navy'}">${SU.icon(icon)}</div>` : ''}
          <h2 class="dialog__title" id="${tid}">${title}</h2>
          ${message ? html`<p class="dialog__msg" id="${tid}-m">${message}</p>` : ''}
          <div class="dialog__actions">
            <button class="btn ${destructive ? 'btn--danger' : 'btn--primary'}" type="button" data-ok>${confirmLabel}</button>
            <button class="btn btn--secondary" type="button" data-cancel>${cancelLabel}</button>
          </div>
        </div>`);
      const entry = mount(panel, { onClose: (r) => resolve(r === true), initialFocus: destructive ? '[data-cancel]' : '[data-ok]' });
      panel.querySelector('[data-ok]').addEventListener('click', () => { haptic(10); entry.close(true); });
      panel.querySelector('[data-cancel]').addEventListener('click', () => entry.close(false));
    });
  }

  /* ---------- Context menu ---------- */
  /**
   * items: [{ label, icon, onSelect, danger, checked, separator, heading }]
   * Desktop: anchored popover with arrow-key navigation.
   * Touch / narrow: bottom action sheet.
   */
  function menu(anchor, items, { title } = {}) {
    const renderItems = (cls = '') => items.map((it) => {
      if (it.separator) return html`<div class="menu__sep" role="separator"></div>`;
      if (it.heading) return html`<div class="menu__label t-overline">${it.heading}</div>`;
      const role = it.checked != null ? 'menuitemradio' : 'menuitem';
      return html`<button type="button" class="menu__item ${it.danger ? 'menu__item--danger' : ''} ${cls}" role="${role}"
        ${it.checked != null ? html`aria-checked="${it.checked ? 'true' : 'false'}"` : ''}>
        ${it.icon ? SU.icon(it.icon) : ''}<span>${it.label}</span>
        ${it.checked != null ? html`<span class="menu__check">${SU.icon('check')}</span>` : ''}
      </button>`;
    });

    const actionable = items.filter((it) => !it.separator && !it.heading);
    const bind = (container, close) => {
      container.querySelectorAll('.menu__item').forEach((btn, i) => {
        btn.addEventListener('click', () => { haptic(6); close(); setTimeout(() => actionable[i].onSelect && actionable[i].onSelect(), 10); });
      });
    };

    if (!SU.util.isDesktop()) {
      return sheet({
        title: title || 'Actions',
        body: html`<div class="action-list" role="menu">${renderItems()}</div>`,
        onMount: (panel, close) => bind(panel, close),
      });
    }

    const panel = fragment(html`<div class="menu" role="menu" tabindex="-1">${renderItems()}</div>`);
    const entry = mount(panel, { scrimClass: 'scrim--clear', initialFocus: '.menu__item' });
    bind(panel, entry.close);

    // Position relative to the anchor, flipping to stay in the viewport.
    const r = anchor.getBoundingClientRect();
    const w = panel.offsetWidth, h = panel.offsetHeight;
    let left = r.right - w;
    let top = r.bottom + 6;
    let origin = 'top right';
    if (left < 8) { left = Math.min(r.left, innerWidth - w - 8); origin = 'top left'; }
    if (top + h > innerHeight - 8) { top = r.top - h - 6; origin = origin.replace('top', 'bottom'); }
    panel.style.left = `${Math.max(8, left)}px`;
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.setProperty('--origin', origin);

    panel.addEventListener('keydown', (e) => {
      const btns = Array.from(panel.querySelectorAll('.menu__item'));
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      if (e.key === 'Home') { e.preventDefault(); btns[0].focus(); }
      if (e.key === 'End') { e.preventDefault(); btns[btns.length - 1].focus(); }
    });
    return entry;
  }

  window.SU.overlay = { sheet, confirm, menu, closeAll: () => [...stack].reverse().forEach((s) => s.close()) };
})();
