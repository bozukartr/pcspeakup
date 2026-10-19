/* ==========================================================================
   Components — small render helpers shared by every view.
   ========================================================================== */
(function () {
  'use strict';

  const { html, initials } = SU.util;
  const { catalog } = SU;

  const statusPill = (id) => {
    const s = catalog.status(id);
    return html`<span class="pill pill--${s.css}"><span class="pill__dot"></span>${s.label}</span>`;
  };

  const priorityTag = (id) => {
    const p = catalog.priority(id);
    return html`<span class="prio prio--${p.id}"><span class="prio__bars" aria-hidden="true"><i></i><i></i><i></i></span>${p.label}</span>`;
  };

  const categoryTile = (id, size = '') => html`<span class="tile-icon ${size} tile-icon--navy">${SU.icon(catalog.category(id).icon)}</span>`;

  const avatar = (name, size = '') => html`<span class="avatar ${size}" aria-hidden="true">${initials(name)}</span>`;
  const anonAvatar = (size = '') => html`<span class="avatar avatar--anon ${size}" aria-hidden="true">${SU.icon('incognito')}</span>`;

  const pageHead = ({ title, sub, overline, actions }) => html`
    <header class="page-head">
      <div class="page-head__text">
        ${overline ? html`<div class="t-overline">${overline}</div>` : ''}
        <h1 class="large-title" data-large-title>${title}</h1>
        ${sub ? html`<p class="page-head__sub">${sub}</p>` : ''}
      </div>
      ${actions ? html`<div class="page-head__actions">${actions}</div>` : ''}
    </header>`;

  const empty = ({ icon = 'inbox', title, text, action }) => html`
    <div class="empty">
      <div class="empty__icon">${SU.icon(icon)}</div>
      <div class="empty__title">${title}</div>
      ${text ? html`<p class="empty__text">${text}</p>` : ''}
      ${action || ''}
    </div>`;

  /* ---------- Skeletons ---------- */
  const skelLines = (n = 3) => html`${Array.from({ length: n }, (_, i) => html`<div class="skel skel--text" style="width:${[92, 76, 58, 84][i % 4]}%;margin-top:${i ? 10 : 0}px"></div>`)}`;

  const skelList = (rows = 5) => html`
    <div class="list" aria-busy="true" aria-label="Loading">
      ${Array.from({ length: rows }, () => html`
        <div class="cell" style="min-height:76px">
          <div class="skel" style="width:36px;height:36px;border-radius:10px;flex:none"></div>
          <div class="cell__body">
            <div class="skel skel--text" style="width:${50 + Math.random() * 35}%"></div>
            <div class="skel skel--text" style="width:${25 + Math.random() * 25}%;margin-top:10px;height:10px"></div>
          </div>
          <div class="skel" style="width:76px;height:22px;border-radius:999px"></div>
        </div>`)}
    </div>`;

  const skelKpis = () => html`<div class="kpis">${Array.from({ length: 4 }, () => html`
    <div class="kpi"><div class="skel skel--text" style="width:60%"></div><div class="skel" style="width:45%;height:30px"></div><div class="skel skel--text" style="width:70%;height:10px"></div></div>`)}</div>`;

  const skelCard = (h = 220) => html`<div class="card card--pad"><div class="skel skel--title" style="width:40%"></div><div class="skel" style="height:${h}px;margin-top:18px;border-radius:12px"></div></div>`;

  /* ---------- Segmented control ---------- */
  /**
   * Renders a segmented control and wires keyboard + sliding thumb.
   * Returns markup; call `bindSegmented(container, onChange)` after insertion.
   */
  const segmented = ({ name, options, value, block = false, label }) => html`
    <div class="segmented ${block ? 'segmented--block' : ''}" role="radiogroup" aria-label="${label || name}" data-segmented="${name}">
      <span class="segmented__thumb" aria-hidden="true"></span>
      ${options.map((o) => html`<button type="button" role="radio" aria-checked="${o.value === value ? 'true' : 'false'}" tabindex="${o.value === value ? '0' : '-1'}" data-value="${o.value}">${o.label}</button>`)}
    </div>`;

  function bindSegmented(root, onChange) {
    const btns = Array.from(root.querySelectorAll('button'));
    const thumb = root.querySelector('.segmented__thumb');
    const place = () => {
      const active = btns.find((b) => b.getAttribute('aria-checked') === 'true') || btns[0];
      thumb.style.width = `${active.offsetWidth}px`;
      thumb.style.transform = `translateX(${active.offsetLeft - 3}px)`;
    };
    const select = (btn, focus) => {
      btns.forEach((b) => { const on = b === btn; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      place();
      if (focus) btn.focus();
      onChange(btn.dataset.value);
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => { if (b.getAttribute('aria-checked') !== 'true') { SU.util.haptic(5); select(b); } });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(btns[(i + 1) % btns.length], true); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(btns[(i - 1 + btns.length) % btns.length], true); }
      });
    });
    requestAnimationFrame(place);
    new ResizeObserver(place).observe(root);
  }

  /* ---------- Field ---------- */
  const fieldError = (id) => html`<div class="field__error" id="${id}-err" role="alert">${SU.icon('alertCircle')}<span></span></div>`;

  function setFieldError(input, message) {
    const field = input.closest('.field');
    if (!field) return;
    const err = field.querySelector('.field__error span');
    if (message) {
      field.classList.add('has-error');
      input.setAttribute('aria-invalid', 'true');
      if (err) err.textContent = message;
    } else {
      field.classList.remove('has-error');
      input.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    }
  }

  /** Wire every [data-copy] button inside root to copy its value with feedback. */
  function bindCopy(root) {
    root.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await SU.util.copyText(btn.dataset.copy);
        SU.util.haptic(8);
        if (ok) SU.toast.success(btn.dataset.copyLabel ? `${btn.dataset.copyLabel} copied` : 'Copied to clipboard');
        else SU.toast.error('Could not copy. Please select and copy manually.');
      });
    });
  }

  window.SU.ui = {
    statusPill, priorityTag, categoryTile, avatar, anonAvatar, pageHead, empty,
    skelLines, skelList, skelKpis, skelCard, segmented, bindSegmented, fieldError, setFieldError, bindCopy,
  };
})();
