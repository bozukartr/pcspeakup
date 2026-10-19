/* ==========================================================================
   Admin · Case — full case workspace: properties, reporter messages,
   private internal notes, report details and audit activity.
   ========================================================================== */
(function () {
  'use strict';

  const { html, setHTML, haptic, relativeTime, formatDate, formatDateTime, formatTime, dayLabel, formatBytes } = SU.util;
  const { catalog, ui, store, router } = SU;
  SU.views = SU.views || {};

  const TEMPLATES = [
    ['Acknowledge', 'Thank you for raising this concern. Your report has been received and is being reviewed confidentially by our team. We may follow up here with questions.'],
    ['Ask for details', 'Thank you for your report. To help us look into this, could you share approximately when this happened and whether anyone else witnessed it?'],
    ['Update', 'We wanted to let you know your case is progressing. We are actively reviewing the information and will update you here as soon as we can.'],
    ['Closing', 'We have completed our review and taken appropriate action. While we can’t share every detail for privacy reasons, we are closing this case. Thank you for speaking up.'],
  ];

  SU.views.caseView = {
    area: 'admin',
    tab: 'reports',
    depth: 1,
    title: 'Case',
    pageClass: 'page--wide',
    hideTabbar: true,
    guard: () => SU.adminGuard(),
    mount(page, ctx) {
      const id = ctx.params.id;
      const me = store.currentAdmin();
      let r = null;
      let tab = sessionStorage.getItem('clearline.case.tab') || 'messages';

      const trail = ctx.shell.setTop({
        title: 'Case',
        back: { label: 'Reports', to: '/admin/reports' },
        actions: html`<button class="icon-btn" type="button" data-more aria-label="Case actions" disabled>${SU.icon('more')}</button>`,
      });
      const moreBtn = trail.querySelector('[data-more]');
      moreBtn.addEventListener('click', () => caseMenu(moreBtn));

      setHTML(page, html`
        <div class="skel skel--text" style="width:160px"></div>
        <div class="skel skel--title" style="width:60%;margin:12px 0 28px;height:30px"></div>
        <div class="case-layout"><div>${ui.skelCard(320)}</div><div>${ui.skelCard(200)}</div></div>`);

      store.getReport(id).then((data) => {
        if (!ctx.alive()) return;
        if (!data) {
          setHTML(page, ui.empty({ icon: 'search', title: 'Report not found', text: 'It may have been deleted, or the link is incorrect.', action: html`<a class="btn btn--primary" href="#/admin/reports">Back to reports</a>` }));
          return;
        }
        r = data;
        moreBtn.disabled = false;
        document.getElementById('topbarTitle').textContent = r.reference;
        render();
        ctx.shell.refreshBadges();
      }).catch(() => router.navigate('/admin/login', { replace: true }));

      /* ---------- Mutations ---------- */
      async function patch(change, message) {
        try {
          r = await store.updateReport(id, change);
          if (!ctx.alive()) return;
          haptic(8);
          renderHeader();
          renderProps();
          if (tab === 'activity') renderTab();
          if (message) SU.toast.success(message);
        } catch (e) {
          SU.toast.error('Couldn’t save changes. Please try again.');
        }
      }

      async function setStatus(status) {
        if (status === r.status) return;
        if (status === 'resolved') {
          const ok = await SU.overlay.confirm({
            title: 'Mark as resolved?',
            message: 'The reporter will see this case as concluded. You can reopen it later if needed.',
            confirmLabel: 'Mark Resolved', icon: 'checkCircle',
          });
          if (!ok) return;
        }
        patch({ status }, `Status updated to ${catalog.status(status).label}`);
      }

      function statusMenu(anchor) {
        SU.overlay.menu(anchor, [
          { heading: 'Status' },
          ...catalog.STATUSES.map((s) => ({ label: s.label, icon: s.icon, checked: r.status === s.id, onSelect: () => setStatus(s.id) })),
        ], { title: 'Change status' });
      }
      function priorityMenu(anchor) {
        SU.overlay.menu(anchor, [
          { heading: 'Priority' },
          ...catalog.PRIORITIES.slice().reverse().map((p) => ({ label: p.label, icon: 'flag', checked: r.priority === p.id, onSelect: () => patch({ priority: p.id }, `Priority set to ${p.label}`) })),
        ], { title: 'Set priority' });
      }
      function assigneeMenu(anchor) {
        SU.overlay.menu(anchor, [
          { heading: 'Assign to' },
          ...catalog.TEAM.map((m) => ({ label: m.id === me.id ? `${m.name} (you)` : m.name, icon: 'user', checked: r.assignee === m.id, onSelect: () => patch({ assignee: m.id }, `Assigned to ${m.id === me.id ? 'you' : m.name}`) })),
          { separator: true },
          { label: 'Unassigned', icon: 'userX', checked: !r.assignee, onSelect: () => patch({ assignee: null }, 'Case unassigned') },
        ], { title: 'Assign case' });
      }
      function categoryMenu(anchor) {
        SU.overlay.menu(anchor, [
          { heading: 'Category' },
          ...catalog.CATEGORIES.map((c) => ({ label: c.label, icon: c.icon, checked: r.category === c.id, onSelect: () => patch({ category: c.id }, `Recategorized as ${c.label}`) })),
        ], { title: 'Change category' });
      }

      function caseMenu(anchor) {
        SU.overlay.menu(anchor, [
          { label: 'Copy reference', icon: 'copy', onSelect: async () => { await SU.util.copyText(r.reference); SU.toast.success('Reference copied'); } },
          r.assignee !== me.id ? { label: 'Assign to me', icon: 'user', onSelect: () => patch({ assignee: me.id }, 'Assigned to you') } : null,
          r.status !== 'resolved'
            ? { label: 'Mark as resolved', icon: 'checkCircle', onSelect: () => setStatus('resolved') }
            : { label: 'Reopen case', icon: 'refresh', onSelect: () => patch({ status: 'progress' }, 'Case reopened') },
          { label: 'Change category', icon: 'tag', onSelect: () => categoryMenu(anchor) },
          { separator: true },
          { label: 'Delete report', icon: 'trash', danger: true, onSelect: remove },
        ].filter(Boolean), { title: r.reference });
      }

      async function remove() {
        const ok = await SU.overlay.confirm({
          title: 'Delete this report?',
          message: `${r.reference} and all of its messages and notes will be permanently removed.`,
          confirmLabel: 'Delete', destructive: true, icon: 'trash',
        });
        if (!ok) return;
        const handle = await store.deleteReport(id);
        SU.toast.show('Report deleted', { type: 'info', action: { label: 'Undo', onClick: () => { handle.restore(); SU.toast.success('Report restored'); } } });
        router.navigate('/admin/reports', { replace: true });
      }

      /* ---------- Rendering ---------- */
      function render() {
        setHTML(page, html`
          <header class="case-head" data-head></header>
          <div class="case-layout">
            <div class="case-main">
              <div class="card case-tabs-card">
                <div class="tabs" role="tablist" aria-label="Case sections" data-tabs></div>
                <div class="case-panel" role="tabpanel" data-panel tabindex="0"></div>
              </div>
            </div>
            <aside class="case-side" aria-label="Case properties">
              <div class="list" data-props></div>
              <div class="card card--pad" data-reporter></div>
            </aside>
          </div>`);
        renderHeader();
        renderProps();
        renderTabs();
        renderTab();
        ctx.onMounted();
      }

      function renderHeader() {
        const cat = catalog.category(r.category);
        setHTML(page.querySelector('[data-head]'), html`
          <div class="row gap-2 wrap">
            <span class="t-mono t-caption" style="color:var(--text-2)">${r.reference}</span>
            ${ui.statusPill(r.status)}
            ${ui.priorityTag(r.priority)}
          </div>
          <h1 class="large-title case-title" data-large-title>${r.subject}</h1>
          <div class="case-meta">
            <span class="row gap-2">${SU.icon(cat.icon)}${cat.label}</span>
            <span class="row gap-2">${SU.icon('calendar')}Submitted ${formatDate(r.createdAt)}</span>
            <span class="row gap-2">${SU.icon(r.identity.anonymous ? 'incognito' : 'user')}${r.identity.anonymous ? 'Anonymous reporter' : r.identity.name}</span>
          </div>`);
      }

      function renderProps() {
        const assignee = r.assignee ? catalog.member(r.assignee) : null;
        const cat = catalog.category(r.category);
        setHTML(page.querySelector('[data-props]'), html`
          <button class="cell prop" type="button" data-prop="status">
            <span class="cell__body"><span class="t-caption">Status</span></span>${ui.statusPill(r.status)}<span class="cell__chev">${SU.icon('chevronDown')}</span>
          </button>
          <button class="cell prop" type="button" data-prop="priority">
            <span class="cell__body"><span class="t-caption">Priority</span></span>${ui.priorityTag(r.priority)}<span class="cell__chev">${SU.icon('chevronDown')}</span>
          </button>
          <button class="cell prop" type="button" data-prop="assignee">
            <span class="cell__body"><span class="t-caption">Assignee</span></span>
            ${assignee ? html`<span class="row gap-2 t-callout" style="font-weight:500">${ui.avatar(assignee.name, 'avatar--sm')}${assignee.name}</span>` : html`<span class="t-callout text-3">Unassigned</span>`}
            <span class="cell__chev">${SU.icon('chevronDown')}</span>
          </button>
          <button class="cell prop" type="button" data-prop="category">
            <span class="cell__body"><span class="t-caption">Category</span></span><span class="t-callout truncate" style="font-weight:500;max-width:60%">${cat.label}</span><span class="cell__chev">${SU.icon('chevronDown')}</span>
          </button>`);
        const map = { status: statusMenu, priority: priorityMenu, assignee: assigneeMenu, category: categoryMenu };
        page.querySelectorAll('[data-prop]').forEach((b) => b.addEventListener('click', () => map[b.dataset.prop](b)));

        setHTML(page.querySelector('[data-reporter]'), html`
          <div class="row gap-3">
            ${r.identity.anonymous ? ui.anonAvatar() : ui.avatar(r.identity.name)}
            <div class="grow" style="min-width:0">
              <div class="t-headline" style="font-size:15px">${r.identity.anonymous ? 'Anonymous reporter' : r.identity.name}</div>
              <div class="t-caption truncate">${r.identity.anonymous ? 'Identity protected · reachable via messages' : r.identity.email || 'No email provided'}</div>
            </div>
          </div>
          <div class="kv" style="margin-top:10px">
            <div class="kv__row"><span class="kv__key">Last updated</span><span class="kv__val">${relativeTime(r.updatedAt)}</span></div>
            <div class="kv__row"><span class="kv__key">Days open</span><span class="kv__val t-num">${Math.max(0, Math.round(((r.resolvedAt ? new Date(r.resolvedAt) : Date.now()) - new Date(r.createdAt)) / SU.util.DAY))}</span></div>
          </div>`);
      }

      function renderTabs() {
        const tabs = [
          ['messages', 'Messages', r.messages.length],
          ['details', 'Details', null],
          ['notes', 'Internal notes', r.notes.length],
          ['activity', 'Activity', null],
        ];
        const el = page.querySelector('[data-tabs]');
        setHTML(el, tabs.map(([k, label, n]) => html`
          <button type="button" role="tab" id="tab-${k}" aria-controls="case-panel" aria-selected="${tab === k ? 'true' : 'false'}" tabindex="${tab === k ? '0' : '-1'}" data-tab="${k}">${label}${n ? html`<span class="chip__count">${n}</span>` : ''}</button>`));
        const btns = Array.from(el.querySelectorAll('[data-tab]'));
        btns.forEach((b, i) => {
          b.addEventListener('click', () => select(b));
          b.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); select(btns[(i + 1) % btns.length], true); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); select(btns[(i - 1 + btns.length) % btns.length], true); }
          });
        });
        function select(b, focus) {
          if (tab === b.dataset.tab) return;
          tab = b.dataset.tab;
          try { sessionStorage.setItem('clearline.case.tab', tab); } catch (_) { /* ignore */ }
          btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
          if (focus) b.focus();
          haptic(4);
          renderTab();
        }
      }

      function renderTab() {
        const panel = page.querySelector('[data-panel]');
        panel.id = 'case-panel';
        panel.setAttribute('aria-labelledby', `tab-${tab}`);
        const view = { messages: messagesTab, details: detailsTab, notes: notesTab, activity: activityTab }[tab];
        setHTML(panel, view());
        panel.classList.remove('enter-fade'); void panel.offsetWidth; panel.classList.add('enter-fade');
        if (tab === 'messages') bindMessages(panel);
        if (tab === 'notes') bindNotes(panel);
        panel.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => SU.toast.info('File downloads are disabled in this demo')));
      }

      /* ---------- Messages ---------- */
      function thread() {
        if (!r.messages.length) {
          return html`<div class="thread-empty">
            <span class="tile-icon tile-icon--lg">${SU.icon('message')}</span>
            <p class="t-headline" style="margin-top:12px">Start the conversation</p>
            <p class="t-callout text-2" style="margin-top:4px;max-width:36ch">Messages are delivered to the reporter’s secure inbox. They’ll see them next time they track their report.</p>
          </div>`;
        }
        let last = '';
        return html`<div class="thread">${r.messages.map((m) => {
          const d = dayLabel(m.at);
          const sep = d !== last ? html`<div class="thread__day">${d}</div>` : '';
          last = d;
          const mine = m.from === 'team';
          const author = mine ? (m.authorId === me.id ? 'You' : (catalog.member(m.authorId) || {}).name || store.TEAM_LABEL) : (r.identity.anonymous ? 'Anonymous reporter' : r.identity.name);
          return html`${sep}<div class="msg ${mine ? 'msg--me' : 'msg--them'}"><div class="msg__meta">${author} · ${formatTime(m.at)}</div><div class="msg__bubble">${m.body}</div></div>`;
        })}</div>`;
      }

      function messagesTab() {
        return html`
          <div class="messages-scroll messages-scroll--admin" data-thread aria-live="polite">${thread()}</div>
          <form class="messages-compose" data-compose>
            <div class="chips templates" aria-label="Reply templates">
              ${TEMPLATES.map(([label], i) => html`<button class="chip" type="button" data-template="${i}">${SU.icon('reply')}${label}</button>`)}
            </div>
            <label for="c-msg" class="sr-only">Message to reporter</label>
            <div class="composer" style="margin-top:10px">
              <textarea id="c-msg" rows="1" maxlength="4000" placeholder="Message the reporter…" data-input></textarea>
              <button class="composer__send" type="submit" aria-label="Send message" disabled data-send>${SU.icon('send')}</button>
            </div>
            <p class="t-caption" style="margin:8px 4px 0">${SU.icon('eye', 'style="width:12px;height:12px;display:inline;vertical-align:-1px"')} Visible to the reporter. Use internal notes for private comments.</p>
          </form>`;
      }

      function bindMessages(panel) {
        const form = panel.querySelector('[data-compose]');
        const input = form.querySelector('[data-input]');
        const send = form.querySelector('[data-send]');
        const scroller = panel.querySelector('[data-thread]');
        scroller.scrollTop = scroller.scrollHeight;
        SU.util.autoGrow(input);
        input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); } });
        form.querySelectorAll('[data-template]').forEach((b) => b.addEventListener('click', () => {
          input.value = TEMPLATES[+b.dataset.template][1];
          input.dispatchEvent(new Event('input'));
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }));
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const body = input.value.trim();
          if (!body) return;
          send.disabled = true;
          input.disabled = true;
          try {
            const msg = await store.sendTeamMessage(id, body);
            if (!ctx.alive()) return;
            r.messages.push(msg);
            r.updatedAt = msg.at;
            input.value = '';
            setHTML(scroller, thread());
            scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
            renderTabs();
            haptic(8);
            SU.toast.success('Message sent to reporter');
          } catch (err) {
            SU.toast.error('Message not sent. Please try again.');
          } finally {
            input.disabled = false;
            input.dispatchEvent(new Event('input'));
            input.focus();
          }
        });
      }

      /* ---------- Details ---------- */
      function detailsTab() {
        const kv = (k, v) => (v ? html`<div class="kv__row"><span class="kv__key">${k}</span><span class="kv__val">${v}</span></div>` : '');
        return html`
          <div class="case-details">
            <h2 class="t-overline">Description</h2>
            <p class="case-desc">${r.description}</p>
            <h2 class="t-overline" style="margin-top:24px">Context</h2>
            <div class="kv">
              ${kv('Category', catalog.category(r.category).label)}
              ${kv('When', r.occurredOn)}
              ${kv('Where', r.location)}
              ${kv('People involved', r.involved)}
              ${kv('Submitted', formatDateTime(r.createdAt))}
              ${r.resolvedAt ? kv('Resolved', formatDateTime(r.resolvedAt)) : ''}
            </div>
            <h2 class="t-overline" style="margin-top:24px">Attachments</h2>
            ${r.attachments.length
              ? html`<div style="margin-top:10px">${r.attachments.map((a) => html`
                <div class="file-row">
                  <span class="tile-icon">${SU.icon(a.type.startsWith('image/') ? 'image' : 'file')}</span>
                  <div class="grow" style="min-width:0"><div class="file-row__name truncate">${a.name}</div><div class="file-row__meta">${formatBytes(a.size)} · Metadata stripped · Virus scan passed</div></div>
                  <button class="icon-btn icon-btn--sm" type="button" aria-label="Download ${a.name}" data-dl>${SU.icon('download')}</button>
                </div>`)}</div>`
              : html`<p class="t-callout text-3" style="margin-top:8px">No files were attached.</p>`}
          </div>`;
      }

      /* ---------- Internal notes ---------- */
      function notesTab() {
        return html`
          <div class="callout callout--warning" style="margin-bottom:16px">${SU.icon('lock')}<div><strong>Private to the case team.</strong> Internal notes are never shared with the reporter.</div></div>
          <form data-note-form>
            <label for="n-body" class="sr-only">New internal note</label>
            <textarea class="textarea textarea--sm" id="n-body" maxlength="4000" placeholder="Add an internal note, finding or next step…" data-note-input></textarea>
            <div class="row between" style="margin-top:10px">
              <span class="t-caption">Notes are time-stamped and audit-logged.</span>
              <button class="btn btn--primary btn--sm" type="submit" disabled data-note-save>Add note</button>
            </div>
          </form>
          <div class="notes" data-notes>${notesList()}</div>`;
      }

      function notesList() {
        if (!r.notes.length) return html`<div class="notes-empty t-callout text-3">No internal notes yet.</div>`;
        return [...r.notes].reverse().map((n) => {
          const a = catalog.member(n.authorId) || { name: 'Team member' };
          return html`
            <article class="note">
              ${ui.avatar(a.name, 'avatar--sm')}
              <div class="grow" style="min-width:0">
                <div class="row between"><span class="t-callout" style="font-weight:600">${a.name}</span>
                  <span class="row gap-1"><span class="t-caption">${relativeTime(n.at)}</span>
                  ${n.authorId === me.id ? html`<button class="icon-btn icon-btn--sm" type="button" data-del-note="${n.id}" aria-label="Delete note">${SU.icon('trash')}</button>` : ''}</span>
                </div>
                <p class="note__body">${n.body}</p>
              </div>
            </article>`;
        });
      }

      function bindNotes(panel) {
        const form = panel.querySelector('[data-note-form]');
        const input = form.querySelector('[data-note-input]');
        const save = form.querySelector('[data-note-save]');
        input.addEventListener('input', () => { save.disabled = !input.value.trim(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); } });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!input.value.trim()) return;
          save.classList.add('is-loading');
          const note = await store.addNote(id, input.value);
          if (!ctx.alive()) return;
          r.notes.push(note);
          input.value = '';
          save.classList.remove('is-loading');
          save.disabled = true;
          setHTML(panel.querySelector('[data-notes]'), notesList());
          bindNoteDelete(panel);
          renderTabs();
          haptic(8);
          SU.toast.success('Internal note added');
        });
        bindNoteDelete(panel);
      }

      function bindNoteDelete(panel) {
        panel.querySelectorAll('[data-del-note]').forEach((b) => b.addEventListener('click', async () => {
          const ok = await SU.overlay.confirm({ title: 'Delete note?', message: 'This internal note will be removed for everyone on the case team.', confirmLabel: 'Delete', destructive: true });
          if (!ok) return;
          await store.deleteNote(id, b.dataset.delNote);
          r.notes = r.notes.filter((n) => n.id !== b.dataset.delNote);
          setHTML(panel.querySelector('[data-notes]'), notesList());
          bindNoteDelete(panel);
          renderTabs();
          SU.toast.success('Note deleted');
        }));
      }

      /* ---------- Activity ---------- */
      function activityTab() {
        const actor = (by) => by === 'reporter' ? 'Reporter' : by === 'system' ? 'System' : ((catalog.member(by) || {}).name || 'Team member');
        const ICON = { created: 'inbox', assigned: 'user', status: 'activity', priority: 'flag', category: 'tag', note: 'note', message: 'message' };
        return html`
          <ol class="activity">
            ${[...r.activity].reverse().map((a) => html`
              <li class="activity__item">
                <span class="tile-icon">${SU.icon(ICON[a.type] || 'info')}</span>
                <div class="grow" style="min-width:0">
                  <div class="t-callout"><b style="font-weight:600">${actor(a.by)}</b> · ${a.text}</div>
                  <div class="t-caption">${formatDateTime(a.at)}</div>
                </div>
              </li>`)}
          </ol>
          <p class="t-caption" style="margin-top:16px">${SU.icon('shield', 'style="width:12px;height:12px;display:inline;vertical-align:-1px"')} In production, the audit trail is append-only and tamper-evident.</p>`;
      }

      // Reflect new reporter messages arriving from another tab.
      const unsub = store.subscribe(async (src) => {
        if (src !== 'remote' || !r) return;
        const fresh = await store.getReport(id);
        if (!ctx.alive() || !fresh) return;
        const hadNew = fresh.messages.length > r.messages.length;
        r = fresh;
        renderHeader(); renderProps(); renderTabs();
        if (tab === 'messages' || tab === 'activity') renderTab();
        if (hadNew) SU.toast.info('New message from reporter');
      });
      return unsub;
    },
  };
})();
