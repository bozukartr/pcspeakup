/* ==========================================================================
   Employee · Submit a Report — progressive, five-step flow:
   Category → Details → Evidence → Identity → Review, then credentials.
   Drafts are kept in memory only (never persisted) to protect privacy.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, haptic, formatBytes } = SU.util;
  const { catalog, ui, store, router } = SU;
  SU.views = SU.views || {};

  const STEPS = [
    { id: 'category', title: 'What is this about?', sub: 'Choose the category that fits best. Our team can adjust it later if needed.' },
    { id: 'details', title: 'Tell us what happened', sub: 'Share as much as you’re comfortable with. Specific facts help us act faster.' },
    { id: 'evidence', title: 'Add supporting files', sub: 'Optional. Screenshots, documents or photos can help the review.' },
    { id: 'identity', title: 'How should we know you?', sub: 'Staying anonymous is completely fine. You can still receive updates.' },
    { id: 'review', title: 'Review and submit', sub: 'Check everything looks right before you send it.' },
  ];

  const LIMITS = { subjectMin: 6, subjectMax: 120, descMin: 30, descMax: 5000, files: 5, fileSize: 10 * 1024 * 1024 };
  const ACCEPT = '.pdf,.png,.jpg,.jpeg,.heic,.doc,.docx,.xls,.xlsx,.txt,.csv,.mp3,.m4a,.mp4,.mov';

  SU.views.submit = {
    area: 'employee',
    tab: 'submit',
    depth: 0,
    title: 'Submit a Report',
    hideTabbar: true,
    pageClass: 'page--narrow',
    mount(page, ctx) {
      const preset = ctx.query.get('category');
      const state = {
        step: 0,
        category: catalog.CATEGORIES.some((c) => c.id === preset) ? preset : '',
        subject: '', description: '', occurredOn: '', location: '', involved: '',
        files: [],
        anonymous: true, name: '', email: '',
        confirm: false,
        attempted: {},
        submitting: false,
        result: null,
      };
      const isDirty = () => !state.result && !!(state.subject || state.description || state.files.length);

      const onBeforeUnload = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };
      window.addEventListener('beforeunload', onBeforeUnload);

      setHTML(page, html`
        <div class="flow">
          <div class="flow__progress">
            <div class="row between" style="margin-bottom:10px">
              <span class="t-caption" data-stepcount></span>
              <span class="t-caption" data-steplabel></span>
            </div>
            <div class="progress" role="progressbar" aria-label="Report progress" aria-valuemin="1" aria-valuemax="${STEPS.length}"><div class="progress__bar"></div></div>
          </div>
          <div class="flow__body" data-body></div>
        </div>
        <div class="flow__bar" data-bar>
          <div class="flow__bar-inner">
            <button class="btn btn--secondary btn--lg" type="button" data-prev>Back</button>
            <button class="btn btn--primary btn--lg grow" type="button" data-next>Continue</button>
          </div>
        </div>`);

      const body = page.querySelector('[data-body]');
      const bar = page.querySelector('[data-bar]');
      const prevBtn = page.querySelector('[data-prev]');
      const nextBtn = page.querySelector('[data-next]');

      prevBtn.addEventListener('click', () => go(state.step - 1));
      nextBtn.addEventListener('click', next);

      function setTop() {
        if (state.result) {
          ctx.shell.setTop({ title: 'Report submitted' });
          return;
        }
        const trail = ctx.shell.setTop({
          title: 'New Report',
          back: state.step > 0 ? { label: 'Back' } : null,
          actions: html`<button class="btn btn--ghost btn--sm" type="button" data-cancel>Cancel</button>`,
        });
        // Override default back behaviour: step back within the flow.
        const backBtn = document.querySelector('#topbarLead [data-back]');
        if (backBtn) {
          const clone = backBtn.cloneNode(true);
          backBtn.replaceWith(clone);
          clone.addEventListener('click', () => go(state.step - 1));
        }
        trail.querySelector('[data-cancel]').addEventListener('click', cancel);
      }

      async function cancel() {
        if (isDirty()) {
          const ok = await SU.overlay.confirm({
            title: 'Discard this report?',
            message: 'What you’ve written will be permanently erased. Nothing has been sent yet.',
            confirmLabel: 'Discard', cancelLabel: 'Keep editing', destructive: true, icon: 'trash',
          });
          if (!ok) return;
        }
        state.subject = state.description = '';
        state.files = [];
        router.navigate('/');
      }

      function go(step, dir) {
        if (step < 0 || step >= STEPS.length) return;
        const direction = dir || (step > state.step ? 'forward' : 'back');
        state.step = step;
        render(direction);
        window.scrollTo({ top: 0, behavior: SU.util.prefersReducedMotion() ? 'auto' : 'smooth' });
      }

      function next() {
        if (state.step === STEPS.length - 1) return submit();
        state.attempted[STEPS[state.step].id] = true;
        if (!validate(true)) { haptic([10, 40, 10]); return; }
        haptic(6);
        go(state.step + 1);
      }

      /* ---------- Validation ---------- */
      function errorsFor(stepId) {
        const e = {};
        if (stepId === 'category' && !state.category) e.category = 'Please choose a category to continue.';
        if (stepId === 'details') {
          const s = state.subject.trim(), d = state.description.trim();
          if (!s) e.subject = 'Please add a short subject.';
          else if (s.length < LIMITS.subjectMin) e.subject = `Subject should be at least ${LIMITS.subjectMin} characters.`;
          if (!d) e.description = 'Please describe what happened.';
          else if (d.length < LIMITS.descMin) e.description = `Please add a little more detail (at least ${LIMITS.descMin} characters).`;
        }
        if (stepId === 'identity' && !state.anonymous) {
          if (!state.name.trim()) e.name = 'Please enter your name, or choose to stay anonymous.';
          if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) e.email = 'Please enter a valid email address.';
        }
        if (stepId === 'review' && !state.confirm) e.confirm = 'Please confirm before submitting.';
        return e;
      }

      function validate(focus) {
        const stepId = STEPS[state.step].id;
        const errs = errorsFor(stepId);
        body.querySelectorAll('[data-validate]').forEach((input) => {
          ui.setFieldError(input, state.attempted[stepId] ? errs[input.dataset.validate] : null);
        });
        const keys = Object.keys(errs);
        if (focus && keys.length) {
          const first = body.querySelector(`[data-validate="${keys[0]}"]`);
          if (first) first.focus();
        }
        return keys.length === 0;
      }

      /* ---------- Step renderers ---------- */
      function stepCategory() {
        return html`
          <div class="field">
            <fieldset>
              <legend class="sr-only">Category</legend>
              <div class="choice-grid" role="radiogroup" aria-label="Category">
                ${catalog.CATEGORIES.map((c, i) => html`
                  <label class="choice">
                    <input type="radio" name="category" value="${c.id}" ${state.category === c.id ? 'checked' : ''} ${i === 0 ? html`data-validate="category" aria-describedby="cat-err"` : ''}>
                    <span class="choice__card">
                      ${ui.categoryTile(c.id)}
                      <span class="grow"><span class="choice__title">${c.label}</span><span class="choice__desc">${c.desc}</span></span>
                      <span class="choice__check">${SU.icon('check')}</span>
                    </span>
                  </label>`)}
              </div>
            </fieldset>
            ${ui.fieldError('cat')}
          </div>`;
      }

      function stepDetails() {
        return html`
          <div class="card card--pad">
            <div class="field">
              <label class="field__label" for="f-subject">Subject <span class="field__count" data-count="subject">${state.subject.length}/${LIMITS.subjectMax}</span></label>
              <input class="input" id="f-subject" name="subject" maxlength="${LIMITS.subjectMax}" autocomplete="off" placeholder="e.g. Repeated inappropriate comments in team meetings" value="${state.subject}" data-validate="subject" aria-describedby="subject-err" required>
              ${ui.fieldError('subject')}
            </div>
            <div class="field">
              <label class="field__label" for="f-desc">What happened? <span class="field__count" data-count="description">${state.description.length}/${LIMITS.descMax}</span></label>
              <textarea class="textarea" id="f-desc" name="description" maxlength="${LIMITS.descMax}" placeholder="Describe the situation: what happened, how often, and any impact it had. Avoid including your own name if you want to stay anonymous." data-validate="description" aria-describedby="desc-hint description-err" required>${state.description}</textarea>
              <p class="field__hint" id="desc-hint">Tip: who, what, when and where are the most useful details.</p>
              ${ui.fieldError('description')}
            </div>
          </div>

          <div class="card card--pad" style="margin-top:12px">
            <div class="t-overline" style="margin-bottom:14px">Optional context</div>
            <div class="field">
              <label class="field__label" for="f-when">When did it happen? <span class="field__optional">Optional</span></label>
              <input class="input" id="f-when" name="occurredOn" autocomplete="off" placeholder="e.g. Last Tuesday, or ongoing since March" value="${state.occurredOn}">
            </div>
            <div class="field">
              <label class="field__label" for="f-where">Where? <span class="field__optional">Optional</span></label>
              <input class="input" id="f-where" name="location" autocomplete="off" placeholder="e.g. London office, 3rd floor, or a team channel" value="${state.location}">
            </div>
            <div class="field">
              <label class="field__label" for="f-who">Who was involved? <span class="field__optional">Optional</span></label>
              <input class="input" id="f-who" name="involved" autocomplete="off" placeholder="Names or roles of the people involved or witnesses" value="${state.involved}">
            </div>
          </div>`;
      }

      function stepEvidence() {
        return html`
          <label class="dropzone" data-drop>
            <input type="file" multiple accept="${ACCEPT}" data-file aria-describedby="drop-hint">
            <span class="tile-icon tile-icon--lg tile-icon--navy">${SU.icon('upload')}</span>
            <span class="dropzone__title">Choose files or drag them here</span>
            <span class="dropzone__hint" id="drop-hint">Up to ${LIMITS.files} files · 10 MB each · PDF, images, Office documents, audio, video</span>
          </label>
          <div data-files style="margin-top:12px">${fileRows()}</div>
          <div class="callout callout--warning" style="margin-top:16px">
            ${SU.icon('eyeOff')}
            <div><strong>Protect your anonymity.</strong> Files can contain hidden details such as author names, device info or location. Remove anything that could identify you, or skip this step.</div>
          </div>`;
      }

      function fileRows() {
        return state.files.map((f, i) => html`
          <div class="file-row">
            <span class="tile-icon">${SU.icon(f.type.startsWith('image/') ? 'image' : 'file')}</span>
            <div class="grow" style="min-width:0"><div class="file-row__name truncate">${f.name}</div><div class="file-row__meta">${formatBytes(f.size)}</div></div>
            <button class="icon-btn icon-btn--sm" type="button" data-remove="${i}" aria-label="Remove ${f.name}">${SU.icon('close')}</button>
          </div>`);
      }

      function stepIdentity() {
        return html`
          <fieldset>
            <legend class="sr-only">Identity</legend>
            <div class="choice-grid" style="grid-template-columns:1fr">
              <label class="choice">
                <input type="radio" name="identity" value="anon" ${state.anonymous ? 'checked' : ''}>
                <span class="choice__card">
                  <span class="tile-icon tile-icon--green">${SU.icon('incognito')}</span>
                  <span class="grow"><span class="choice__title">Stay anonymous <span class="pill pill--resolved" style="margin-left:6px;height:20px;font-size:11px">Recommended</span></span>
                  <span class="choice__desc">We won’t know who you are. You’ll get a private access code to follow up.</span></span>
                  <span class="choice__check">${SU.icon('check')}</span>
                </span>
              </label>
              <label class="choice">
                <input type="radio" name="identity" value="named" ${!state.anonymous ? 'checked' : ''}>
                <span class="choice__card">
                  <span class="tile-icon tile-icon--navy">${SU.icon('user')}</span>
                  <span class="grow"><span class="choice__title">Share my identity</span>
                  <span class="choice__desc">Only the case team will see your details. This can make follow-up easier.</span></span>
                  <span class="choice__check">${SU.icon('check')}</span>
                </span>
              </label>
            </div>
          </fieldset>

          <div class="card card--pad identity-fields ${state.anonymous ? 'hidden' : ''}" style="margin-top:12px" data-identity-fields>
            <div class="field">
              <label class="field__label" for="f-name">Full name</label>
              <input class="input" id="f-name" name="name" autocomplete="name" placeholder="Your name" value="${state.name}" data-validate="name" aria-describedby="name-err">
              ${ui.fieldError('name')}
            </div>
            <div class="field">
              <label class="field__label" for="f-email">Work email <span class="field__optional">Optional</span></label>
              <input class="input" id="f-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@company.com" value="${state.email}" data-validate="email" aria-describedby="email-err">
              ${ui.fieldError('email')}
            </div>
          </div>

          <div class="callout" style="margin-top:16px">
            ${SU.icon('shieldCheck')}
            <div>Whichever you choose, our policy strictly prohibits retaliation against anyone who reports a concern in good faith.</div>
          </div>`;
      }

      function stepReview() {
        const cat = catalog.category(state.category);
        const row = (label, value, step) => html`
          <div class="review-row">
            <div class="grow" style="min-width:0">
              <div class="t-caption">${label}</div>
              <div class="review-row__value">${value || html`<span class="text-3">Not provided</span>`}</div>
            </div>
            <button class="link-btn t-callout" type="button" data-edit="${step}" aria-label="Edit ${label}">Edit</button>
          </div>`;
        return html`
          <div class="card review">
            ${row('Category', html`<span class="row gap-2">${ui.categoryTile(cat.id)}${cat.label}</span>`, 0)}
            ${row('Subject', state.subject, 1)}
            ${row('Description', html`<span style="white-space:pre-wrap">${state.description}</span>`, 1)}
            ${state.occurredOn || state.location || state.involved ? row('Context', [state.occurredOn, state.location, state.involved].filter(Boolean).join(' · '), 1) : ''}
            ${row('Attachments', state.files.length ? state.files.map((f) => f.name).join(', ') : '', 2)}
            ${row('Identity', state.anonymous ? html`<span class="row gap-2">${SU.icon('incognito', 'style="width:16px;height:16px"')}Anonymous</span>` : `${state.name}${state.email ? ` · ${state.email}` : ''}`, 3)}
          </div>

          <div class="field" style="margin-top:16px">
            <label class="confirm-row">
              <input type="checkbox" name="confirm" ${state.confirm ? 'checked' : ''} data-validate="confirm" aria-describedby="confirm-err">
              <span>I confirm this report is made in good faith and is accurate to the best of my knowledge.</span>
            </label>
            ${ui.fieldError('confirm')}
          </div>`;
      }

      function stepSuccess() {
        const { reference, accessCode } = state.result;
        return html`
          <div class="success">
            <div class="success-mark">
              <svg viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="26" cy="26" r="24" stroke-width="2.5" opacity=".35"/><path d="m16 27 7 7 13-15"/>
              </svg>
            </div>
            <h1 class="t-title-2" style="margin-top:20px;text-align:center" data-large-title tabindex="-1" data-success-title>Report submitted</h1>
            <p class="text-2" style="text-align:center;margin:8px auto 0;max-width:42ch">Thank you for speaking up. Save the details below — they are the only way to check status and read replies.</p>
          </div>

          <div class="card card--pad" style="margin-top:24px">
            <div class="stack gap-3">
              <div class="code-box">
                <div style="min-width:0"><div class="code-box__label">Tracking reference</div><div class="code-box__value">${reference}</div></div>
                <button class="icon-btn" type="button" data-copy="${reference}" data-copy-label="Reference" aria-label="Copy tracking reference">${SU.icon('copy')}</button>
              </div>
              <div class="code-box">
                <div style="min-width:0"><div class="code-box__label">Access code</div><div class="code-box__value">${accessCode}</div></div>
                <button class="icon-btn" type="button" data-copy="${accessCode}" data-copy-label="Access code" aria-label="Copy access code">${SU.icon('copy')}</button>
              </div>
            </div>
            <div class="callout callout--warning" style="margin-top:16px">
              ${SU.icon('key')}
              <div><strong>We can’t recover your access code.</strong> It isn’t stored in readable form, so keep it somewhere private — not on a shared or work device if you want to stay anonymous.</div>
            </div>
            <button class="btn btn--secondary btn--block" type="button" style="margin-top:16px" data-download>${SU.icon('download')}Save as text file</button>
          </div>

          <div class="card card--pad" style="margin-top:12px">
            <div class="card-title">What happens next</div>
            <ol class="next-steps">
              <li><span>1</span><div><b>Within 2 business days</b><p>A reviewer acknowledges your report and may ask questions.</p></div></li>
              <li><span>2</span><div><b>Review and investigation</b><p>The case team assesses the facts confidentially.</p></div></li>
              <li><span>3</span><div><b>Outcome</b><p>You’ll see status updates and messages when you track your report.</p></div></li>
            </ol>
          </div>

          <div class="stack gap-2" style="margin-top:20px">
            <button class="btn btn--primary btn--lg btn--block" type="button" data-open>Open my report</button>
            <a class="btn btn--ghost btn--lg btn--block" href="#/">Back to Home</a>
          </div>`;
      }

      /* ---------- Render ---------- */
      function render(direction = 'fade') {
        setTop();
        if (state.result) {
          page.querySelector('.flow__progress').remove();
          bar.remove();
          setHTML(body, stepSuccess());
          body.className = 'flow__body enter-fade';
          ui.bindCopy(body);
          body.querySelector('[data-download]').addEventListener('click', () => {
            const { reference, accessCode } = state.result;
            SU.util.download(`clearline-${reference}.txt`,
              `Clearline — report credentials\n\nTracking reference: ${reference}\nAccess code: ${accessCode}\nSubmitted: ${SU.util.formatDateTime(new Date().toISOString())}\n\nKeep this file private. Use these details at Track My Report to check status and messages.\n`);
          });
          body.querySelector('[data-open]').addEventListener('click', async (e) => {
            e.currentTarget.classList.add('is-loading');
            await store.unlock(state.result.reference, state.result.accessCode);
            router.navigate(`/track/${state.result.reference}`);
          });
          body.querySelector('[data-success-title]').focus({ preventScroll: true });
          ctx.onMounted();
          return;
        }

        const s = STEPS[state.step];
        page.querySelector('[data-stepcount]').textContent = `Step ${state.step + 1} of ${STEPS.length}`;
        page.querySelector('[data-steplabel]').textContent = ['Category', 'Details', 'Evidence', 'Identity', 'Review'][state.step];
        page.querySelector('.progress').setAttribute('aria-valuenow', String(state.step + 1));
        page.querySelector('.progress__bar').style.transform = `scaleX(${(state.step + 1) / STEPS.length})`;

        const content = [stepCategory, stepDetails, stepEvidence, stepIdentity, stepReview][state.step]();
        setHTML(body, html`
          <header class="flow__head">
            <h1 class="t-title-2" data-large-title tabindex="-1">${s.title}</h1>
            <p class="text-2" style="margin-top:6px">${s.sub}</p>
          </header>
          ${content}`);
        body.className = `flow__body ${SU.util.prefersReducedMotion() ? '' : `enter-${direction}`}`;

        prevBtn.hidden = state.step === 0;
        nextBtn.textContent = state.step === STEPS.length - 1 ? 'Submit Report' : s.id === 'evidence' && !state.files.length ? 'Skip for now' : 'Continue';
        nextBtn.classList.remove('is-loading');
        bind();
        validate(false);
        ctx.onMounted();
        if (direction !== 'fade') body.querySelector('h1').focus({ preventScroll: true });
      }

      function bind() {
        // Text inputs → state (+ live counters / validation after first attempt).
        body.querySelectorAll('input[name]:not([type=radio]):not([type=checkbox]):not([type=file]), textarea[name]').forEach((input) => {
          input.addEventListener('input', () => {
            state[input.name] = input.value;
            const counter = body.querySelector(`[data-count="${input.name}"]`);
            if (counter) counter.textContent = `${input.value.length}/${input.maxLength}`;
            if (state.attempted[STEPS[state.step].id]) validate(false);
          });
          // Validate a touched field on blur so errors surface before "Continue".
          input.addEventListener('blur', () => {
            const errs = errorsFor(STEPS[state.step].id);
            if (input.dataset.validate && input.value && errs[input.dataset.validate]) ui.setFieldError(input, errs[input.dataset.validate]);
          });
        });

        body.querySelectorAll('input[name=category]').forEach((r) => r.addEventListener('change', () => {
          state.category = r.value;
          haptic(5);
          validate(false);
          // Auto-advance after a short beat — a common native pattern for single-choice steps.
          clearTimeout(bind._t);
          bind._t = setTimeout(() => { if (state.step === 0 && state.category === r.value) next(); }, 280);
        }));

        body.querySelectorAll('input[name=identity]').forEach((r) => r.addEventListener('change', () => {
          state.anonymous = r.value === 'anon';
          haptic(5);
          const fields = body.querySelector('[data-identity-fields]');
          fields.classList.toggle('hidden', state.anonymous);
          if (!state.anonymous) { fields.classList.add('enter-fade'); body.querySelector('#f-name').focus(); }
          validate(false);
        }));

        const confirmBox = body.querySelector('input[name=confirm]');
        if (confirmBox) confirmBox.addEventListener('change', () => { state.confirm = confirmBox.checked; validate(false); });

        body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.edit, 'back')));

        const fileInput = body.querySelector('[data-file]');
        if (fileInput) {
          const drop = body.querySelector('[data-drop]');
          fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
          ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
          ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
          drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
          bindFileRemove();
        }
      }

      function addFiles(list) {
        let rejected = 0;
        for (const f of Array.from(list)) {
          if (state.files.length >= LIMITS.files) { SU.toast.error(`You can attach up to ${LIMITS.files} files.`); break; }
          if (f.size > LIMITS.fileSize) { rejected++; continue; }
          if (state.files.some((x) => x.name === f.name && x.size === f.size)) continue;
          state.files.push({ name: f.name, size: f.size, type: f.type || 'application/octet-stream' });
        }
        if (rejected) SU.toast.error(`${rejected} file${rejected > 1 ? 's' : ''} exceeded 10 MB and ${rejected > 1 ? 'were' : 'was'} skipped.`);
        refreshFiles();
      }
      function refreshFiles() {
        setHTML(body.querySelector('[data-files]'), fileRows());
        nextBtn.textContent = state.files.length ? 'Continue' : 'Skip for now';
        bindFileRemove();
      }
      function bindFileRemove() {
        body.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
          const [f] = state.files.splice(+b.dataset.remove, 1);
          refreshFiles();
          SU.toast.info(`Removed ${f.name}`);
        }));
      }

      async function submit() {
        state.attempted.review = true;
        if (!validate(true)) { haptic([10, 40, 10]); return; }
        if (state.submitting) return;
        state.submitting = true;
        nextBtn.classList.add('is-loading');
        prevBtn.disabled = true;
        try {
          state.result = await store.submitReport({
            category: state.category, subject: state.subject, description: state.description,
            occurredOn: state.occurredOn, location: state.location, involved: state.involved,
            attachments: state.files, anonymous: state.anonymous, name: state.name, email: state.email,
          });
          if (!ctx.alive()) return;
          haptic([12, 60, 18]);
          render('fade');
          window.scrollTo(0, 0);
        } catch (e) {
          console.error(e);
          SU.toast.error('We couldn’t submit your report. Please try again.');
          nextBtn.classList.remove('is-loading');
          prevBtn.disabled = false;
        } finally {
          state.submitting = false;
        }
      }

      render('fade');
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    },
  };
})();
