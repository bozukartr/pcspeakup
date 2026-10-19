/* ==========================================================================
   Store — the data access layer.

   DEMONSTRATION ONLY. Everything here lives in this browser's localStorage,
   which provides NO real anonymity, confidentiality or security: anyone with
   access to this device or browser profile can read it.

   The public surface is intentionally shaped like a remote API (async methods,
   role-separated "endpoints", DTOs that strip internal fields for reporters)
   so the localStorage adapter can be swapped for an HTTPS client talking to a
   hardened backend without touching the views. See ARCHITECTURE.md.
   ========================================================================== */
(function () {
  'use strict';

  const { catalog } = SU;
  const KEY = 'clearline.db.v1';
  const ADMIN_SESSION = 'clearline.session.admin';
  const REPORTER_SESSION = 'clearline.session.reporter';
  const REPORTER_TTL = 20 * 60 * 1000; // 20 minutes
  const TEAM_LABEL = 'Ethics & Compliance';

  let db = null;
  const listeners = new Set();

  /* ---------- persistence ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.warn('[store] Persist failed', e); }
    emit();
  }
  function emit(source = 'local') { listeners.forEach((fn) => { try { fn(source); } catch (e) { console.error(e); } }); }

  // Simulated network latency so loading states are exercised realistically.
  const latency = (min = 160, max = 380) => SU.util.sleep(min + Math.random() * (max - min));

  async function seed() {
    const reports = SU.seed.build();
    const used = new Set();
    for (const r of reports) {
      if (!r.reference) {
        do { r.reference = SU.crypto.newReference(); } while (used.has(r.reference));
      }
      used.add(r.reference);
      const code = r.accessCode || SU.crypto.newAccessCode();
      r.accessHash = await SU.crypto.hash(code);
      delete r.accessCode; // plaintext codes are never persisted
    }
    db = { version: 1, seededAt: new Date().toISOString(), reports };
    save();
  }

  async function init() {
    db = load();
    if (!db || !Array.isArray(db.reports)) await seed();
    // Keep multiple tabs in sync (e.g. employee view in one tab, admin in another).
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) { db = load() || db; emit('remote'); }
    });
  }

  const now = () => new Date().toISOString();
  const findById = (id) => db.reports.find((r) => r.id === id);
  const findByRef = (ref) => db.reports.find((r) => r.reference === ref);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function log(r, by, type, text) {
    r.activity.push({ id: SU.util.uid('act'), at: now(), by, type, text });
  }

  /* ==================================================================
     Reporter-facing API (anonymous)
     ================================================================== */

  /** Reporter DTO — excludes internal notes, assignee, priority and audit trail. */
  function toReporterView(r) {
    const statusHistory = [{ status: 'received', at: r.createdAt }];
    r.activity.filter((a) => a.type === 'status').forEach((a) => {
      const s = catalog.STATUSES.find((st) => a.text.endsWith(st.label));
      if (s && s.id !== 'received') statusHistory.push({ status: s.id, at: a.at });
    });
    return clone({
      reference: r.reference,
      category: r.category,
      subject: r.subject,
      description: r.description,
      occurredOn: r.occurredOn,
      location: r.location,
      involved: r.involved,
      attachments: r.attachments,
      anonymous: r.identity.anonymous,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      statusHistory,
      unread: r.unreadForReporter,
      messages: r.messages.map((m) => ({
        id: m.id,
        mine: m.from === 'reporter',
        author: m.from === 'reporter' ? 'You' : TEAM_LABEL,
        body: m.body,
        at: m.at,
      })),
    });
  }

  async function submitReport(input) {
    await latency(600, 900);
    const reference = (() => { let ref; do { ref = SU.crypto.newReference(); } while (findByRef(ref)); return ref; })();
    const accessCode = SU.crypto.newAccessCode();
    const ts = now();
    const r = {
      id: SU.util.uid('rpt'),
      reference,
      accessHash: await SU.crypto.hash(accessCode),
      category: input.category,
      subject: input.subject.trim(),
      description: input.description.trim(),
      occurredOn: (input.occurredOn || '').trim(),
      location: (input.location || '').trim(),
      involved: (input.involved || '').trim(),
      attachments: (input.attachments || []).map(({ name, size, type }) => ({ name, size, type })),
      identity: input.anonymous ? { anonymous: true } : { anonymous: false, name: input.name.trim(), email: (input.email || '').trim() },
      status: 'received',
      priority: input.category === 'suggestion' ? 'low' : 'medium',
      assignee: null,
      createdAt: ts,
      updatedAt: ts,
      resolvedAt: null,
      messages: [],
      notes: [],
      activity: [{ id: SU.util.uid('act'), at: ts, by: 'reporter', type: 'created', text: 'Report submitted' }],
      unreadForTeam: 0,
      unreadForReporter: 0,
      isNew: true,
    };
    db.reports.unshift(r);
    save();
    return { reference, accessCode };
  }

  /** Verify credentials; on success opens a short-lived reporter session. */
  async function unlock(reference, accessCode) {
    await latency(450, 700);
    const ref = SU.crypto.normalizeReference(reference);
    const r = findByRef(ref);
    const hash = await SU.crypto.hash(accessCode);
    // Compare even when the report is missing to keep timing uniform.
    const ok = SU.crypto.safeEqual(hash, r ? r.accessHash : 'x'.repeat(hash.length)) && !!r;
    if (!ok) return false;
    try { sessionStorage.setItem(REPORTER_SESSION, JSON.stringify({ reference: ref, exp: Date.now() + REPORTER_TTL })); } catch (_) { /* ignore */ }
    return true;
  }

  function reporterSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(REPORTER_SESSION) || 'null');
      if (!s || s.exp < Date.now()) return null;
      return s;
    } catch (_) { return null; }
  }
  function lockReporter() { try { sessionStorage.removeItem(REPORTER_SESSION); } catch (_) { /* ignore */ } }

  function requireReporter(reference) {
    const s = reporterSession();
    if (!s || s.reference !== reference) throw Object.assign(new Error('Session expired'), { code: 'UNAUTHORIZED' });
    // Sliding expiry while the reporter is active.
    try { sessionStorage.setItem(REPORTER_SESSION, JSON.stringify({ reference, exp: Date.now() + REPORTER_TTL })); } catch (_) { /* ignore */ }
    const r = findByRef(reference);
    if (!r) throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
    return r;
  }

  async function getReporterReport(reference) {
    await latency();
    const r = requireReporter(reference);
    const view = toReporterView(r);
    if (r.unreadForReporter) { r.unreadForReporter = 0; save(); }
    return view;
  }

  async function sendReporterMessage(reference, body) {
    await latency(220, 400);
    const r = requireReporter(reference);
    const msg = { id: SU.util.uid('msg'), from: 'reporter', authorId: null, body: body.trim(), at: now() };
    r.messages.push(msg);
    r.unreadForTeam = (r.unreadForTeam || 0) + 1;
    r.updatedAt = msg.at;
    log(r, 'reporter', 'message', 'Reporter sent a message');
    save();
    return toReporterView(r);
  }

  /* ==================================================================
     Admin-facing API (authenticated)
     ================================================================== */

  function adminSession() {
    try { return JSON.parse(sessionStorage.getItem(ADMIN_SESSION) || localStorage.getItem(ADMIN_SESSION) || 'null'); }
    catch (_) { return null; }
  }
  function currentAdmin() {
    const s = adminSession();
    return s ? catalog.member(s.userId) : null;
  }

  async function signIn(email, password, remember) {
    await latency(500, 800);
    const user = catalog.TEAM.find((m) => m.email.toLowerCase() === String(email).trim().toLowerCase());
    // Demo rule: any listed team member with the shared demo password.
    if (!user || password !== 'demo') return null;
    const session = JSON.stringify({ userId: user.id, at: Date.now() });
    try {
      (remember ? localStorage : sessionStorage).setItem(ADMIN_SESSION, session);
    } catch (_) { /* ignore */ }
    return user;
  }
  function signOut() {
    try { sessionStorage.removeItem(ADMIN_SESSION); localStorage.removeItem(ADMIN_SESSION); } catch (_) { /* ignore */ }
  }
  function requireAdmin() {
    const u = currentAdmin();
    if (!u) throw Object.assign(new Error('Not signed in'), { code: 'UNAUTHORIZED' });
    return u;
  }

  function matches(r, f) {
    if (f.status && f.status !== 'all') {
      if (f.status === 'open' ? r.status === 'resolved' : r.status !== f.status) return false;
    }
    if (f.categories && f.categories.length && !f.categories.includes(r.category)) return false;
    if (f.priorities && f.priorities.length && !f.priorities.includes(r.priority)) return false;
    if (f.assignee === 'me' && r.assignee !== f.me) return false;
    if (f.assignee === 'none' && r.assignee) return false;
    if (f.unread && !r.unreadForTeam) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${r.reference} ${r.subject} ${r.description} ${catalog.category(r.category).label} ${r.location}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  const SORTS = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    priority: (a, b) => catalog.priority(b.priority).rank - catalog.priority(a.priority).rank || b.createdAt.localeCompare(a.createdAt),
  };

  function summary(r) {
    return {
      id: r.id, reference: r.reference, category: r.category, subject: r.subject,
      status: r.status, priority: r.priority, assignee: r.assignee,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
      anonymous: r.identity.anonymous, unread: r.unreadForTeam || 0, isNew: !!r.isNew,
      messages: r.messages.length, attachments: r.attachments.length,
    };
  }

  async function listReports(filters = {}, { fast } = {}) {
    if (!fast) await latency();
    const me = requireAdmin();
    const f = { ...filters, me: me.id };
    return db.reports.filter((r) => matches(r, f)).sort(SORTS[f.sort] || SORTS.newest).map(summary);
  }

  /** Synchronous counts for navigation badges. */
  function counts() {
    if (!db || !currentAdmin()) return { unread: 0, fresh: 0, open: 0 };
    let unread = 0, fresh = 0, open = 0;
    for (const r of db.reports) {
      if (r.unreadForTeam) unread++;
      if (r.isNew) fresh++;
      if (r.status !== 'resolved') open++;
    }
    return { unread, fresh, open };
  }

  async function getReport(id) {
    await latency();
    requireAdmin();
    const r = findById(id);
    if (!r) return null;
    let changed = false;
    if (r.isNew) { r.isNew = false; changed = true; }
    const view = clone(r);
    delete view.accessHash;
    if (r.unreadForTeam) { r.unreadForTeam = 0; changed = true; }
    if (changed) save();
    return view;
  }

  async function updateReport(id, patch) {
    await latency(120, 260);
    const me = requireAdmin();
    const r = findById(id);
    if (!r) throw new Error('Not found');
    if (patch.status && patch.status !== r.status) {
      r.status = patch.status;
      r.resolvedAt = patch.status === 'resolved' ? now() : null;
      log(r, me.id, 'status', `Status changed to ${catalog.status(patch.status).label}`);
      r.unreadForReporter = (r.unreadForReporter || 0) + 1; // reporters see status changes
    }
    if (patch.priority && patch.priority !== r.priority) {
      r.priority = patch.priority;
      log(r, me.id, 'priority', `Priority set to ${catalog.priority(patch.priority).label}`);
    }
    if (patch.category && patch.category !== r.category) {
      r.category = patch.category;
      log(r, me.id, 'category', `Recategorized as ${catalog.category(patch.category).label}`);
    }
    if ('assignee' in patch && patch.assignee !== r.assignee) {
      r.assignee = patch.assignee;
      log(r, me.id, 'assigned', patch.assignee ? `Assigned to ${catalog.member(patch.assignee).name}` : 'Unassigned');
    }
    r.updatedAt = now();
    save();
    const view = clone(r); delete view.accessHash;
    return view;
  }

  async function addNote(id, body) {
    await latency(150, 300);
    const me = requireAdmin();
    const r = findById(id);
    const note = { id: SU.util.uid('note'), authorId: me.id, body: body.trim(), at: now() };
    r.notes.push(note);
    log(r, me.id, 'note', 'Internal note added');
    save();
    return note;
  }

  async function deleteNote(id, noteId) {
    await latency(100, 200);
    requireAdmin();
    const r = findById(id);
    r.notes = r.notes.filter((n) => n.id !== noteId);
    save();
  }

  async function sendTeamMessage(id, body) {
    await latency(200, 380);
    const me = requireAdmin();
    const r = findById(id);
    const msg = { id: SU.util.uid('msg'), from: 'team', authorId: me.id, body: body.trim(), at: now() };
    r.messages.push(msg);
    r.unreadForReporter = (r.unreadForReporter || 0) + 1;
    r.updatedAt = msg.at;
    log(r, me.id, 'message', 'Message sent to reporter');
    save();
    return msg;
  }

  async function deleteReport(id) {
    await latency(200, 350);
    requireAdmin();
    const idx = db.reports.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const [removed] = db.reports.splice(idx, 1);
    save();
    return { restore: () => { db.reports.splice(Math.min(idx, db.reports.length), 0, removed); save(); } };
  }

  async function stats() {
    await latency(250, 500);
    requireAdmin();
    const R = db.reports;
    const nowD = new Date();
    const by = (key) => R.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {});

    // 12 calendar months ending with the current month.
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, date: d, received: 0, resolved: 0 });
    }
    const mIndex = Object.fromEntries(months.map((m, i) => [m.key, i]));
    const keyOf = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; };
    const resolutionDays = [];
    for (const r of R) {
      const i = mIndex[keyOf(r.createdAt)];
      if (i != null) months[i].received++;
      if (r.resolvedAt) {
        const j = mIndex[keyOf(r.resolvedAt)];
        if (j != null) months[j].resolved++;
        resolutionDays.push((new Date(r.resolvedAt) - new Date(r.createdAt)) / SU.util.DAY);
      }
    }

    const weekAgo = Date.now() - 7 * SU.util.DAY;
    const twoWeeksAgo = Date.now() - 14 * SU.util.DAY;
    const thisWeek = R.filter((r) => new Date(r.createdAt) >= weekAgo).length;
    const lastWeek = R.filter((r) => { const t = new Date(r.createdAt); return t >= twoWeeksAgo && t < weekAgo; }).length;
    const statusCounts = by('status');
    const anonymousShare = R.length ? R.filter((r) => r.identity.anonymous).length / R.length : 0;
    const firstResponse = R.map((r) => {
      const m = r.messages.find((x) => x.from === 'team');
      return m ? (new Date(m.at) - new Date(r.createdAt)) / 3600000 : null;
    }).filter((x) => x != null);

    const recent = [...R].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map(summary);
    const attention = R.filter((r) => r.status !== 'resolved' && (r.priority === 'critical' || r.priority === 'high' || !r.assignee || r.unreadForTeam))
      .sort(SORTS.priority).slice(0, 5).map(summary);

    return {
      total: R.length,
      pending: (statusCounts.received || 0) + (statusCounts.review || 0),
      inProgress: statusCounts.progress || 0,
      resolved: statusCounts.resolved || 0,
      open: R.length - (statusCounts.resolved || 0),
      thisWeek, lastWeek,
      byStatus: statusCounts,
      byCategory: by('category'),
      byPriority: by('priority'),
      months,
      avgResolutionDays: resolutionDays.length ? resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length : 0,
      medianFirstResponseHours: firstResponse.length ? firstResponse.sort((a, b) => a - b)[Math.floor(firstResponse.length / 2)] : null,
      anonymousShare,
      recent,
      attention,
      unread: R.filter((r) => r.unreadForTeam).length,
    };
  }

  async function resetDemo() {
    await latency(300, 500);
    localStorage.removeItem(KEY);
    await seed();
  }

  function exportCSV() {
    requireAdmin();
    const cols = ['reference', 'category', 'subject', 'status', 'priority', 'assignee', 'anonymous', 'createdAt', 'updatedAt'];
    // Quote every cell and neutralise spreadsheet formula injection.
    const q = (v) => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = db.reports.map((r) => [
      r.reference, catalog.category(r.category).label, r.subject, catalog.status(r.status).label,
      catalog.priority(r.priority).label, r.assignee ? catalog.member(r.assignee).name : '',
      r.identity.anonymous ? 'Yes' : 'No', r.createdAt, r.updatedAt,
    ].map(q).join(','));
    return [cols.join(','), ...rows].join('\n');
  }

  window.SU.store = {
    init,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    // reporter
    submitReport, unlock, reporterSession, lockReporter, getReporterReport, sendReporterMessage,
    // admin
    signIn, signOut, currentAdmin, listReports, counts, getReport, updateReport, addNote, deleteNote,
    sendTeamMessage, deleteReport, stats, resetDemo, exportCSV,
    TEAM_LABEL,
  };
})();
