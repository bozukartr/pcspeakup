/* ==========================================================================
   Gestures — native-feeling touch interactions for phones and tablets:
   • edge swipe from the left to go back (wherever a back button exists)
   • pull-to-refresh on screens that register a refresh handler
   Desktop and mouse input are untouched.
   ========================================================================== */
(function () {
  'use strict';

  const { haptic, prefersReducedMotion } = SU.util;
  const EDGE = 24;
  const BACK_DISTANCE = 90;
  const PULL_TRIGGER = 72;

  function init({ view, lead }) {
    let refreshFn = null;
    let refreshing = false;

    const ptr = document.createElement('div');
    ptr.className = 'ptr';
    ptr.setAttribute('aria-hidden', 'true');
    ptr.innerHTML = `<span class="ptr__spinner">${SU.icon('refresh')}</span>`;
    document.body.appendChild(ptr);

    const isTouchLayout = () => !matchMedia('(min-width: 960px)').matches;
    const overlayOpen = () => document.body.classList.contains('is-locked');
    const backButton = () => lead.querySelector('[data-back]');
    const page = () => view.querySelector('.page');

    let mode = null; // 'back' | 'pull' | null
    let x0 = 0, y0 = 0, t0 = 0, dx = 0, dy = 0, decided = false;

    view.addEventListener('touchstart', (e) => {
      if (!isTouchLayout() || overlayOpen() || e.touches.length !== 1) return;
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; t0 = performance.now(); dx = dy = 0; decided = false;
      if (x0 <= EDGE && backButton()) mode = 'back';
      else if (refreshFn && !refreshing && window.scrollY <= 0) mode = 'pull';
      else mode = null;
    }, { passive: true });

    view.addEventListener('touchmove', (e) => {
      if (!mode) return;
      const t = e.touches[0];
      dx = t.clientX - x0;
      dy = t.clientY - y0;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true;
        // Abort if the gesture goes the "wrong" way (e.g. a vertical scroll).
        if (mode === 'back' && Math.abs(dy) > Math.abs(dx)) { mode = null; return; }
        if (mode === 'pull' && (dy < 0 || Math.abs(dx) > Math.abs(dy))) { mode = null; return; }
      }
      if (mode === 'back') {
        const p = page();
        if (p) { p.style.transition = 'none'; p.style.transform = `translate3d(${Math.max(0, dx)}px,0,0)`; }
      } else if (mode === 'pull') {
        const pull = Math.max(0, dy) * 0.5; // resistance
        ptr.style.transition = 'none';
        ptr.style.opacity = String(Math.min(pull / PULL_TRIGGER, 1));
        ptr.style.transform = `translate(-50%, ${Math.min(pull, PULL_TRIGGER + 20)}px) rotate(${pull * 4}deg)`;
        ptr.classList.toggle('is-armed', pull >= PULL_TRIGGER);
        const p = page();
        if (p) { p.style.transition = 'none'; p.style.transform = `translate3d(0,${Math.min(pull, PULL_TRIGGER + 20) * 0.6}px,0)`; }
      }
    }, { passive: true });

    const settle = (el, transform = '') => {
      if (!el) return;
      el.style.transition = prefersReducedMotion() ? 'none' : 'transform 280ms cubic-bezier(0.32,0.72,0,1), opacity 200ms';
      el.style.transform = transform;
      setTimeout(() => { el.style.transition = ''; if (!transform) el.style.transform = ''; }, 300);
    };

    view.addEventListener('touchend', async () => {
      const m = mode;
      mode = null;
      if (m === 'back') {
        const velocity = dx / Math.max(performance.now() - t0, 1);
        const p = page();
        if (dx > BACK_DISTANCE || velocity > 0.5) {
          haptic(8);
          if (p) settle(p, `translate3d(${innerWidth}px,0,0)`);
          const btn = backButton();
          setTimeout(() => btn && btn.click(), 140);
        } else settle(p);
      } else if (m === 'pull') {
        const p = page();
        settle(p);
        if (ptr.classList.contains('is-armed') && refreshFn) {
          refreshing = true;
          haptic(10);
          ptr.classList.add('is-spinning');
          ptr.style.transition = 'transform 200ms';
          ptr.style.transform = `translate(-50%, ${PULL_TRIGGER * 0.7}px)`;
          try { await refreshFn(); } catch (err) { console.error(err); }
          refreshing = false;
        }
        ptr.classList.remove('is-spinning', 'is-armed');
        ptr.style.transition = 'transform 260ms, opacity 200ms';
        ptr.style.transform = 'translate(-50%, 0)';
        ptr.style.opacity = '0';
      }
    });

    return {
      setRefresh(fn) { refreshFn = fn; },
    };
  }

  window.SU.gestures = { init };
})();
