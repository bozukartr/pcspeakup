/* ==========================================================================
   Router — tiny hash router with route params, guards and transition
   direction (forward / back / fade) derived from route depth.
   Hash routing keeps the demo runnable from file:// and static hosting.
   ========================================================================== */
(function () {
  'use strict';

  const routes = [];
  let current = null;
  let handler = null;
  let previousPath = null;

  function compile(pattern) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '/([^/]+)')) + '/?$');
    return { re, keys };
  }

  function register(pattern, view) {
    routes.push({ pattern, view, ...compile(pattern) });
  }

  function parse(hash) {
    const path = (hash || '').replace(/^#/, '') || '/';
    const [pathname, query = ''] = path.split('?');
    for (const r of routes) {
      const m = pathname.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return { path: pathname, query: new URLSearchParams(query), params, view: r.view, pattern: r.pattern };
      }
    }
    return null;
  }

  function resolve() {
    let match = parse(location.hash);
    if (!match) { navigate('/', { replace: true }); return; }
    // Guards may redirect (e.g. admin auth, reporter session).
    if (match.view.guard) {
      const redirect = match.view.guard(match);
      if (redirect) { navigate(redirect, { replace: true }); return; }
    }
    const prev = current;
    let direction = 'fade';
    if (prev && prev.view.area === match.view.area) {
      const a = prev.view.depth || 0;
      const b = match.view.depth || 0;
      direction = b > a ? 'forward' : b < a ? 'back' : 'fade';
    }
    previousPath = prev ? prev.path : null;
    current = match;
    if (handler) handler(match, prev, direction);
  }

  function navigate(path, { replace = false } = {}) {
    const target = '#' + path;
    if (replace) {
      history.replaceState(null, '', target);
      resolve();
    } else if (location.hash === target) {
      resolve();
    } else {
      location.hash = path;
    }
  }

  /**
   * Native-style "back": pop history when the previous screen is the parent,
   * otherwise go to the parent explicitly (e.g. after a deep link).
   */
  function back(parent = '/') {
    if (previousPath && previousPath === parent) history.back();
    else navigate(parent);
  }

  function start(onRoute) {
    handler = onRoute;
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  window.SU.router = { register, navigate, back, start, current: () => current };
})();
