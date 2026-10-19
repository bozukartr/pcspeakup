/* ==========================================================================
   Utilities — namespace, safe HTML templating, formatting, small helpers.
   Every view renders through `html`, which escapes interpolated values by
   default. Only values wrapped with `raw()` (trusted markup such as icons)
   bypass escaping.
   ========================================================================== */
(function () {
  'use strict';

  const SU = (window.SU = window.SU || {});

  /* ---------- Safe HTML templating ---------- */
  class SafeHTML {
    constructor(value) { this.value = value; }
    toString() { return this.value; }
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  const esc = (s) => String(s).replace(/[&<>"'`]/g, (c) => ESC[c]);

  function renderValue(v) {
    if (v == null || v === false || v === true) return '';
    if (v instanceof SafeHTML) return v.value;
    if (Array.isArray(v)) return v.map(renderValue).join('');
    return esc(v);
  }

  function html(strings, ...values) {
    let out = '';
    for (let i = 0; i < strings.length; i++) {
      out += strings[i];
      if (i < values.length) out += renderValue(values[i]);
    }
    return new SafeHTML(out);
  }

  const raw = (s) => new SafeHTML(String(s));

  /* ---------- DOM ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function setHTML(el, content) {
    el.innerHTML = content instanceof SafeHTML ? content.value : renderValue(content);
    return el;
  }

  function fragment(content) {
    const t = document.createElement('template');
    t.innerHTML = content instanceof SafeHTML ? content.value : renderValue(content);
    return t.content.firstElementChild;
  }

  /* ---------- Formatting ---------- */
  const DAY = 86400000;
  const fmtDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtShort = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const fmtMonthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  const fmtWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
  const fmtNum = new Intl.NumberFormat('en-US');

  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  function relativeTime(iso) {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 45 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < DAY && new Date(t).getDate() === new Date().getDate()) return `${Math.round(diff / 3600000)}h ago`;
    const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY);
    if (days <= 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    const d = new Date(t);
    return d.getFullYear() === new Date().getFullYear() ? fmtShort.format(d) : fmtDate.format(d);
  }

  function dayLabel(iso) {
    const days = Math.round((startOfDay(Date.now()) - startOfDay(iso)) / DAY);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return fmtWeekday.format(new Date(iso));
    return fmtDate.format(new Date(iso));
  }

  const formatDate = (iso) => fmtDate.format(new Date(iso));
  const formatShort = (iso) => fmtShort.format(new Date(iso));
  const formatTime = (iso) => fmtTime.format(new Date(iso));
  const formatDateTime = (iso) => `${fmtDate.format(new Date(iso))} at ${fmtTime.format(new Date(iso))}`;
  const formatMonth = (d) => fmtMonth.format(d);
  const formatMonthYear = (d) => fmtMonthYear.format(d);
  const formatNumber = (n) => fmtNum.format(n);

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map((p) => p[0].toUpperCase()).join('');
  }

  function pluralize(n, one, many) { return `${formatNumber(n)} ${n === 1 ? one : (many || one + 's')}`; }

  /* ---------- Misc ---------- */
  function debounce(fn, ms = 200) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function uid(prefix = 'id') {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return `${prefix}_${a[0].toString(36)}${a[1].toString(36)}`;
  }

  /** Light haptic tick on supported devices; never critical to the interaction. */
  function haptic(pattern = 8) {
    try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(pattern); } catch (_) { /* ignore */ }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const isDesktop = () => matchMedia('(min-width: 960px)').matches;
  const isWide = () => matchMedia('(min-width: 768px)').matches;
  const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Auto-grow a textarea to fit its content (used by message composers). */
  function autoGrow(textarea) {
    const fit = () => { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`; };
    textarea.addEventListener('input', fit);
    fit();
  }

  SU.util = {
    html, raw, esc, SafeHTML, $, $$, setHTML, fragment,
    DAY, relativeTime, dayLabel, formatDate, formatShort, formatTime, formatDateTime,
    formatMonth, formatMonthYear, formatNumber, formatBytes, initials, pluralize, startOfDay,
    debounce, sleep, uid, haptic, copyText, download, isDesktop, isWide, prefersReducedMotion, autoGrow,
  };
})();
