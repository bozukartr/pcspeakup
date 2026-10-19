/* ==========================================================================
   Employee · Track My Report — unlock with reference + access code, then
   follow status and exchange anonymous messages with the case team.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, haptic, relativeTime, formatDate, formatTime, dayLabel } = SU.util;
  const { catalog, ui, store, router } = SU;
  SU.views = SU.views || {};

  /* ---------------- Unlock screen ---------------- */
  SU.views.track = {
    area: 'employee',
    tab: 'track',
    depth: 0,
    title: 'Track My Report',
    pageClass: 'page--narrow',
    mount(page, ctx) {
      const session = store.reporterSession();
      setHTML(page, html`
        ${ui.pageHead({ title: 'Track My Report', sub: 'Enter the tracking reference and access code you received when you submitted your report.' })}

        ${session ? html`
          <a class="card card--pad pressable resume-card" href="#/track/${session.reference}">
            <span class="tile-icon tile-icon--green">${SU.icon('lock')}</span>
            <span class="grow"><span class="t-headline" style="display:block">Continue to ${session.reference}</span><span class="t-callout text-2">Your report is unlocked in this tab.</span></span>
            <span class="cell__chev">${SU.icon('chevronRight')}</span>
          </a>` : ''}

        <form class="card card--pad" novalidate data-form>
          <div class="field">
            <label class="field__label" for="t-ref">Tracking reference</label>
            <input class="input input--mono" id="t-ref" name="reference" placeholder="CL-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="14" data-validate="reference" aria-describedby="ref-err" required>
            ${ui.fieldError('ref')}
          </div>
          <div class="field">
            <label class="field__label" for="t-code">Access code</label>
            <div class="pw-wrap">
              <input class="input input--mono" id="t-code" name="code" type="password" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="14" data-validate="code" aria-describedby="code-err" required>
              <button class="icon-btn icon-btn--sm pw-toggle" type="button" data-reveal aria-label="Show access code" aria-pressed="false">${SU.icon('eye')}</button>
            </div>
            ${ui.fieldError('code')}
          </div>
          <button class="btn btn--primary btn--lg btn--block" type="submit" style="margin-top:24px" data-submit>${SU.icon('lock')}Open My Report</button>
        </form>

        <div class="callout callout--info" style="margin-top:16px">
          ${SU.icon('sparkle')}
          <div style="flex:1">
            <strong>Trying the demo?</strong> Use the sample report <span class="t-mono">${SU.seed.DEMO.reference}</span> with code <span class="t-mono">${SU.seed.DEMO.accessCode}</span>.
            <div style="margin-top:8px"><button class="link-btn" type="button" data-demo>Fill in demo credentials</button></div>
          </div>
        </div>

        <div class="list" style="margin-top:28px">
          <a class="cell cell--icon" href="#/submit">
            <span class="tile-icon">${SU.icon('compose')}</span>
            <span class="cell__body"><span class="cell__title">Don’t have a report yet?</span><span class="cell__sub" style="display:block">Submit one in a few minutes</span></span>
            <span class="cell__chev">${SU.icon('chevronRight')}</span>
          </a>
          <button class="cell cell--icon" type="button" data-lost>
            <span class="tile-icon">${SU.icon('key')}</span>
            <span class="cell__body"><span class="cell__title">Lost your access code?</span><span class="cell__sub" style="display:block">What you can do</span></span>
            <span class="cell__chev">${SU.icon('chevronRight')}</span>
          </button>
        </div>`);

      const form = page.querySelector('[data-form]');
      const ref = form.querySelector('#t-ref');
      const code = form.querySelector('#t-code');
      const submitBtn = form.querySelector('[data-submit]');

      // Auto-format as the user types (keeps the caret at the end — inputs are short).
      ref.addEventListener('input', () => { ref.value = SU.crypto.normalizeReference(ref.value); ui.setFieldError(ref, null); });
      code.addEventListener('input', () => { code.value = SU.crypto.normalizeAccessCode(code.value); ui.setFieldError(code, null); });

      const reveal = form.querySelector('[data-reveal]');
      reveal.addEventListener('click', () => {
        const show = code.type === 'password';
        code.type = show ? 'text' : 'password';
        reveal.setAttribute('aria-pressed', String(show));
        reveal.setAttribute('aria-label', show ? 'Hide access code' : 'Show access code');
        setHTML(reveal, SU.icon(show ? 'eyeOff' : 'eye'));
      });

      page.querySelector('[data-demo]').addEventListener('click', () => {
        ref.value = SU.seed.DEMO.reference;
        code.value = SU.seed.DEMO.accessCode;
        ui.setFieldError(ref, null); ui.setFieldError(code, null);
        haptic(6);
        submitBtn.focus();
      });

      page.querySelector('[data-lost]').addEventListener('click', () => {
        SU.overlay.sheet({
          title: 'Lost access code',
          body: html`
            <p class="text-2">To protect your anonymity, access codes are never stored in readable form — so nobody, including the case team, can look them up or reset them.</p>
            <ul class="bullets" style="margin-top:16px">
              <li>Check where you saved it — a downloaded text file, a password manager or a private note.</li>
              <li>If it’s truly lost, you can submit a new report and mention your earlier report’s reference and submission date.</li>
              <li>If you shared your identity, the case team may also contact you directly.</li>
            </ul>`,
          footer: html`<a class="btn btn--primary" href="#/submit" data-close>Submit a new report</a>`,
        });
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        let ok = true;
        if (!/^CL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref.value)) { ui.setFieldError(ref, 'Enter the full reference, e.g. CL-7K4M-Q2XD.'); ok = false; }
        if (code.value.replace(/-/g, '').length !== 12) { ui.setFieldError(code, 'Your access code has 12 characters.'); ok = false; }
        if (!ok) { haptic([10, 40, 10]); form.querySelector('[aria-invalid="true"]').focus(); return; }

        submitBtn.classList.add('is-loading');
        const success = await store.unlock(ref.value, code.value);
        if (!ctx.alive()) return;
        submitBtn.classList.remove('is-loading');
        if (!success) {
          haptic([10, 40, 10]);
          ui.setFieldError(code, 'We couldn’t find a report with these details. Check both and try again.');
          form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
          code.focus();
          return;
        }
        haptic(10);
        router.navigate(`/track/${SU.crypto.normalizeReference(ref.value)}`);
      });
    },
  };

  /* ---------------- Report detail (reporter view) ---------------- */
  SU.views.trackDetail = {
    area: 'employee',
    tab: 'track',
    depth: 1,
    title: 'My Report',
    hideTabbar: true,
    guard(match) {
      const s = store.reporterSession();
      return !s || s.reference !== match.params.ref ? '/track' : null;
    },
    mount(page, ctx) {
      const reference = ctx.params.ref;
      let report = null;
      let sending = false;

      const trail = ctx.shell.setTop({
        title: reference,
        back: { label: 'Track', to: '/track' },
        actions: html`<button class="btn btn--ghost btn--sm" type="button" data-lock>${SU.icon('lock')}<span>Lock</span></button>`,
      });
      trail.querySelector('[data-lock]').addEventListener('click', () => {
        store.lockReporter();
        SU.toast.info('Report locked on this device');
        router.navigate('/track', { replace: true });
      });

      setHTML(page, html`
        <div class="skel skel--text" style="width:120px"></div>
        <div class="skel skel--title" style="width:70%;margin:12px 0 24px;height:30px"></div>
        <div class="report-layout">
          <div>${ui.skelCard(260)}</div>
          <div>${ui.skelCard(160)}</div>
        </div>`);

      async function load(initial) {
        const prevStatus = report && report.status;
        try {
          report = await store.getReporterReport(reference);
        } catch (e) {
          if (!ctx.alive()) return;
          SU.toast.error('Your session has expired. Please enter your access code again.');
          router.navigate('/track', { replace: true });
          return;
        }
        if (!ctx.alive()) return;
        if (initial || prevStatus !== report.status) render(); else renderThread(true);
      }

      function timeline() {
        const reached = Object.fromEntries(report.statusHistory.map((h) => [h.status, h.at]));
        const currentIdx = catalog.statusIndex(report.status);
        return html`<div class="timeline">
          ${catalog.STATUSES.map((s, i) => {
            const done = i < currentIdx || (i === currentIdx && s.id === 'resolved');
            const current = i === currentIdx && s.id !== 'resolved';
            return html`
              <div class="tl-item ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}">
                <span class="tl-dot">${done ? SU.icon('check') : ''}</span>
                <div>
                  <div class="tl-title">${s.label}</div>
                  ${i <= currentIdx ? html`<div class="tl-text">${s.employeeText}</div>` : ''}
                  ${reached[s.id] ? html`<div class="tl-time">${formatDate(reached[s.id])}</div>` : ''}
                </div>
              </div>`;
          })}
        </div>`;
      }

      function thread() {
        if (!report.messages.length) {
          return html`<div class="thread-empty">
            <span class="tile-icon tile-icon--lg">${SU.icon('message')}</span>
            <p class="t-headline" style="margin-top:12px">No messages yet</p>
            <p class="t-callout text-2" style="margin-top:4px;max-width:34ch">The case team may reach out here with questions. You can also add information at any time.</p>
          </div>`;
        }
        let lastDay = '';
        return html`<div class="thread">
          ${report.messages.map((m) => {
            const day = dayLabel(m.at);
            const sep = day !== lastDay ? html`<div class="thread__day">${day}</div>` : '';
            lastDay = day;
            return html`${sep}
              <div class="msg ${m.mine ? 'msg--me' : 'msg--them'}">
                <div class="msg__meta">${m.author} · ${formatTime(m.at)}</div>
                <div class="msg__bubble">${m.body}</div>
              </div>`;
          })}
        </div>`;
      }

      function render() {
        const cat = catalog.category(report.category);
        setHTML(page, html`
          <header class="page-head" style="margin-bottom:20px">
            <div class="page-head__text">
              <div class="row gap-2 wrap">${ui.statusPill(report.status)}<span class="t-caption">Updated ${relativeTime(report.updatedAt)}</span></div>
              <h1 class="large-title" data-large-title style="margin-top:10px;font-size:26px">${report.subject}</h1>
              <div class="row gap-2 text-2 t-callout" style="margin-top:8px">${SU.icon(cat.icon, 'style="width:16px;height:16px"')}${cat.label} · Submitted ${formatDate(report.createdAt)}</div>
            </div>
          </header>

          <div class="report-layout">
            <section class="card messages-card" aria-labelledby="msgs-title">
              <div class="card-head" style="padding:18px 20px 0">
                <div>
                  <h2 class="card-title" id="msgs-title">Secure messages</h2>
                  <div class="card-sub">With the ${store.TEAM_LABEL} team · ${report.anonymous ? 'You appear as Anonymous' : 'Your identity is shared'}</div>
                </div>
                <span class="tile-icon tile-icon--green" title="End-to-end protected in production">${SU.icon('lock')}</span>
              </div>
              <div class="messages-scroll" data-thread aria-live="polite">${thread()}</div>
              <form class="messages-compose" data-compose>
                <label for="r-msg" class="sr-only">Message to the case team</label>
                <div class="composer">
                  <textarea id="r-msg" rows="1" placeholder="Write a message…" maxlength="2000" data-input></textarea>
                  <button class="composer__send" type="submit" aria-label="Send message" disabled data-send>${SU.icon('send')}</button>
                </div>
                <p class="t-caption" style="margin:8px 4px 0">Avoid sharing details that could identify you unless you intend to.</p>
              </form>
            </section>

            <aside class="stack gap-3">
              <section class="card card--pad" aria-labelledby="status-title">
                <h2 class="card-title" id="status-title" style="margin-bottom:18px">Status</h2>
                ${timeline()}
              </section>

              <section class="card accordion" aria-label="Report details">
                <details>
                  <summary>Report details ${SU.icon('chevronDown')}</summary>
                  <div class="accordion__body">
                    <div class="kv">
                      <div class="kv__row"><span class="kv__key">Reference</span><span class="kv__val t-mono">${report.reference}</span></div>
                      <div class="kv__row"><span class="kv__key">Category</span><span class="kv__val">${cat.label}</span></div>
                      ${report.occurredOn ? html`<div class="kv__row"><span class="kv__key">When</span><span class="kv__val">${report.occurredOn}</span></div>` : ''}
                      ${report.location ? html`<div class="kv__row"><span class="kv__key">Where</span><span class="kv__val">${report.location}</span></div>` : ''}
                      <div class="kv__row"><span class="kv__key">Identity</span><span class="kv__val">${report.anonymous ? 'Anonymous' : 'Shared with case team'}</span></div>
                    </div>
                    <p style="margin-top:14px;white-space:pre-wrap;color:var(--text)">${report.description}</p>
                    ${report.attachments.length ? html`<div style="margin-top:14px">${report.attachments.map((a) => html`
                      <div class="file-row"><span class="tile-icon">${SU.icon('paperclip')}</span><div class="grow" style="min-width:0"><div class="file-row__name truncate">${a.name}</div><div class="file-row__meta">${SU.util.formatBytes(a.size)}</div></div></div>`)}</div>` : ''}
                  </div>
                </details>
              </section>

              <div class="callout">
                ${SU.icon('clock')}
                <div>For your privacy, this report locks automatically after 20 minutes of inactivity.</div>
              </div>
            </aside>
          </div>`);

        bindComposer();
        scrollThread(false);
        ctx.onMounted();
      }

      function renderThread(animate) {
        const el = page.querySelector('[data-thread]');
        if (!el) return;
        setHTML(el, thread());
        scrollThread(animate);
      }

      function scrollThread(smooth) {
        const el = page.querySelector('[data-thread]');
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      }

      function bindComposer() {
        const form = page.querySelector('[data-compose]');
        const input = form.querySelector('[data-input]');
        const send = form.querySelector('[data-send]');
        SU.util.autoGrow(input);
        input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); }
        });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const body = input.value.trim();
          if (!body || sending) return;
          sending = true;
          send.disabled = true;
          try {
            report = await store.sendReporterMessage(reference, body);
            if (!ctx.alive()) return;
            input.value = '';
            input.dispatchEvent(new Event('input'));
            haptic(8);
            renderThread(true);
            SU.toast.success('Message sent securely');
          } catch (err) {
            SU.toast.error('Your session has expired. Please unlock your report again.');
            router.navigate('/track', { replace: true });
          } finally {
            sending = false;
          }
        });
      }

      load(true);
      // Reflect replies made by the case team in another tab.
      const unsub = store.subscribe((source) => { if (source === 'remote' && report) load(false); });
      return unsub;
    },
  };
})();
