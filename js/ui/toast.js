/* ==========================================================================
   Toasts — brief, non-blocking confirmations with optional undo action.
   Swipe or tap the close affordance to dismiss; announced politely to AT.
   ========================================================================== */
(function () {
  'use strict';

  const { html, fragment } = SU.util;
  const ICONS = { success: 'checkCircle', error: 'alertCircle', info: 'info' };
  const MAX = 3;

  function region() { return document.getElementById('toastRegion'); }

  function dismiss(el) {
    if (!el || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }

  function show(message, { type = 'success', action, duration } = {}) {
    const root = region();
    while (root.children.length >= MAX) root.firstElementChild.remove();
    const el = fragment(html`
      <div class="toast toast--${type}" role="${type === 'error' ? 'alert' : 'status'}">
        <span class="toast__icon">${SU.icon(ICONS[type] || 'info')}</span>
        <span class="toast__msg">${message}</span>
        ${action ? html`<button class="toast__action" type="button">${action.label}</button>` : ''}
      </div>`);
    root.appendChild(el);

    let timer = setTimeout(() => dismiss(el), duration || (action ? 5200 : 3200));
    el.addEventListener('pointerenter', () => clearTimeout(timer));
    el.addEventListener('pointerleave', () => { timer = setTimeout(() => dismiss(el), 1800); });

    if (action) {
      el.querySelector('.toast__action').addEventListener('click', () => { clearTimeout(timer); action.onClick(); dismiss(el); });
    }

    // Horizontal swipe to dismiss.
    let startX = null;
    el.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    el.addEventListener('pointermove', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(1 - Math.min(Math.abs(dx) / 200, 0.8));
    });
    const end = (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 80) dismiss(el);
      else { el.style.transform = ''; el.style.opacity = ''; }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return el;
  }

  window.SU.toast = {
    show,
    success: (m, o) => show(m, { ...o, type: 'success' }),
    error: (m, o) => show(m, { ...o, type: 'error' }),
    info: (m, o) => show(m, { ...o, type: 'info' }),
  };
})();
