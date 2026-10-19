/* ==========================================================================
   Admin · Sign in — demo authentication for authorized case handlers.
   Production: SSO (SAML/OIDC) with MFA, enforced server-side.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, haptic } = SU.util;
  const { catalog, ui, store, router } = SU;
  SU.views = SU.views || {};

  SU.adminGuard = () => (store.currentAdmin() ? null : '/admin/login');

  SU.views.login = {
    area: 'auth',
    tab: null,
    depth: 0,
    title: 'Sign in',
    chromeless: true,
    pageClass: 'page--auth',
    guard: () => (store.currentAdmin() ? '/admin' : null),
    mount(page, ctx) {
      ctx.shell.setTop({});
      setHTML(page, html`
        <div class="auth">
          <div class="auth__brand">
            <span class="brand__mark" aria-hidden="true"></span>
          </div>
          <h1 class="t-title-2" style="text-align:center;margin-top:18px" data-large-title>Case Management</h1>
          <p class="text-2" style="text-align:center;margin-top:6px">Sign in to review and respond to reports.</p>

          <form class="card card--pad" style="margin-top:28px" novalidate data-form>
            <div class="field">
              <label class="field__label" for="a-email">Work email</label>
              <input class="input" id="a-email" name="email" type="email" autocomplete="username" inputmode="email" value="${catalog.TEAM[0].email}" data-validate="email" aria-describedby="email-err" required>
              ${ui.fieldError('email')}
            </div>
            <div class="field">
              <label class="field__label" for="a-pass">Password</label>
              <input class="input" id="a-pass" name="password" type="password" autocomplete="current-password" placeholder="••••" data-validate="password" aria-describedby="pass-hint password-err" required>
              <p class="field__hint" id="pass-hint">Demo password: <span class="t-mono">demo</span></p>
              ${ui.fieldError('password')}
            </div>
            <label class="row between" style="margin-top:18px;min-height:44px;cursor:pointer">
              <span class="t-callout">Keep me signed in</span>
              <span class="switch"><input type="checkbox" name="remember" aria-label="Keep me signed in"><span class="switch__track"></span></span>
            </label>
            <button class="btn btn--primary btn--lg btn--block" type="submit" style="margin-top:18px" data-submit>Sign In</button>
          </form>

          <div style="margin-top:20px">
            <div class="t-overline" style="text-align:center;margin-bottom:10px">Demo accounts</div>
            <div class="chips" style="justify-content:center;flex-wrap:wrap">
              ${catalog.TEAM.map((m, i) => html`<button class="chip" type="button" aria-pressed="${i === 0 ? 'true' : 'false'}" data-user="${m.email}">${ui.avatar(m.name, 'avatar--sm')}${m.name.split(' ')[0]}</button>`)}
            </div>
          </div>

          <div class="callout" style="margin-top:24px">
            ${SU.icon('shield')}
            <div>Production deployments use single sign-on with multi-factor authentication and role-based access. Every case view is audit-logged.</div>
          </div>

          <a class="btn btn--ghost btn--block" href="#/" style="margin-top:16px">${SU.icon('chevronLeft')}Back to employee portal</a>
        </div>`);

      const form = page.querySelector('[data-form]');
      const email = form.querySelector('#a-email');
      const pass = form.querySelector('#a-pass');
      const btn = form.querySelector('[data-submit]');

      page.querySelectorAll('[data-user]').forEach((chip) => chip.addEventListener('click', () => {
        page.querySelectorAll('[data-user]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        email.value = chip.dataset.user;
        pass.value = 'demo';
        ui.setFieldError(email, null); ui.setFieldError(pass, null);
        haptic(5);
        btn.focus();
      }));
      [email, pass].forEach((i) => i.addEventListener('input', () => ui.setFieldError(i, null)));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        let ok = true;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { ui.setFieldError(email, 'Enter a valid work email.'); ok = false; }
        if (!pass.value) { ui.setFieldError(pass, 'Enter your password.'); ok = false; }
        if (!ok) { form.querySelector('[aria-invalid="true"]').focus(); haptic([10, 40, 10]); return; }
        btn.classList.add('is-loading');
        const user = await store.signIn(email.value, pass.value, form.remember.checked);
        if (!ctx.alive()) return;
        btn.classList.remove('is-loading');
        if (!user) {
          ui.setFieldError(pass, 'Email or password is incorrect.');
          form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
          pass.focus(); pass.select();
          haptic([10, 40, 10]);
          return;
        }
        haptic(10);
        SU.toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
        router.navigate('/admin', { replace: true });
      });

      // Avoid popping the on-screen keyboard on touch devices.
      if (!matchMedia('(pointer: coarse)').matches) requestAnimationFrame(() => pass.focus({ preventScroll: true }));
    },
  };
})();
