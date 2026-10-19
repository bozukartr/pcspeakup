/* ==========================================================================
   Seed data — realistic, fictional sample cases for the demonstration.
   All names, events and organisations are invented.
   `SU.seed.build()` returns reports with *plaintext* demo access codes;
   the store hashes them on first load and discards the plaintext.
   ========================================================================== */
(function () {
  'use strict';

  const DAY = 86400000;
  const HOUR = 3600000;

  /** Public demo credentials, shown on the Track screen as a convenience. */
  const DEMO = { reference: 'CL-7K4M-Q2XD', accessCode: 'H8RT-2MXQ-PZ4N' };

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ago = (now, days, hours = 0) => new Date(now - days * DAY - hours * HOUR).toISOString();

  let seq = 0;
  const id = (p) => `${p}_seed${(++seq).toString(36)}`;

  function activityFor(r, now) {
    const a = [{ id: id('act'), at: r.createdAt, by: 'reporter', type: 'created', text: 'Report submitted' }];
    const order = ['received', 'review', 'progress', 'resolved'];
    const idx = order.indexOf(r.status);
    const created = new Date(r.createdAt).getTime();
    const span = Math.max(new Date(r.updatedAt).getTime() - created, HOUR);
    if (r.assignee) a.push({ id: id('act'), at: new Date(created + span * 0.15).toISOString(), by: 'u_sarah', type: 'assigned', text: `Assigned to ${SU.catalog.member(r.assignee).name}` });
    for (let i = 1; i <= idx; i++) {
      a.push({ id: id('act'), at: new Date(created + span * (i / Math.max(idx, 1)) * 0.98).toISOString(), by: r.assignee || 'u_sarah', type: 'status', text: `Status changed to ${SU.catalog.status(order[i]).label}` });
    }
    return a.sort((x, y) => x.at.localeCompare(y.at));
  }

  function curated(now) {
    const list = [
      {
        reference: DEMO.reference, accessCode: DEMO.accessCode,
        category: 'harassment', status: 'review', priority: 'high', assignee: 'u_priya',
        subject: 'Repeated inappropriate comments from a team lead',
        description: 'Over the past several weeks, a team lead in the Product Design group has repeatedly made comments about my appearance and personal life during stand-ups and in direct messages. I have asked them to stop, but it has continued. It is affecting my ability to focus and I have started avoiding meetings where they are present.',
        occurredOn: 'Ongoing since early September', location: 'Product Design team, 4th floor and Slack',
        involved: 'Team lead, Product Design',
        attachments: [{ name: 'screenshot-dm-sept-24.png', size: 284113, type: 'image/png' }],
        identity: { anonymous: true },
        createdDays: 3.2, updatedDays: 0.4,
        messages: [
          { from: 'team', authorId: 'u_priya', body: 'Thank you for trusting us with this. Your report is being handled confidentially by a small, authorized team. Could you tell us roughly when the comments started, and whether anyone else was present when they happened?', d: 2.1 },
          { from: 'reporter', body: 'It started around the first week of September. Two colleagues were in the sprint retrospective on September 24 when it happened in front of the team.', d: 1.6 },
          { from: 'team', authorId: 'u_priya', body: 'That is very helpful. We will speak with those witnesses discreetly without revealing who raised the concern. In the meantime, if you would like temporary changes to your meeting schedule, just let us know here.', d: 0.4 },
        ],
        notes: [
          { authorId: 'u_priya', body: 'Cross-checked with HR records: no prior formal complaints against this lead, but one informal concern raised in 2025 exit interview.', d: 1.9 },
          { authorId: 'u_sarah', body: 'Please schedule witness interviews this week. Keep the circle limited to Priya and me.', d: 1.2 },
        ],
        unreadForReporter: 1,
      },
      {
        category: 'fraud', status: 'progress', priority: 'critical', assignee: 'u_david',
        subject: 'Duplicate vendor invoices approved in Q3',
        description: 'While reconciling accounts payable, I noticed at least six invoices from the same logistics vendor that appear twice with slightly different invoice numbers. Both versions were approved by the same regional manager. The total value of the duplicates is roughly $48,000.',
        occurredOn: 'July – September 2026', location: 'Finance – Accounts Payable', involved: 'Regional operations manager (approver)',
        attachments: [{ name: 'ap-reconciliation-q3.xlsx', size: 91234, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
        identity: { anonymous: true }, createdDays: 12, updatedDays: 1.5,
        messages: [
          { from: 'team', authorId: 'u_david', body: 'Thank you — this is a serious matter and we have opened a formal investigation. Are you aware of any other vendors where this pattern might apply?', d: 10 },
          { from: 'reporter', body: 'I only checked the logistics vendor so far. I can look at facilities vendors if that would help, but I do not want to draw attention.', d: 9 },
          { from: 'team', authorId: 'u_david', body: 'Please do not take any further action yourself — our forensic accountants will handle the review. We will update you here as the case progresses.', d: 8.5 },
        ],
        notes: [
          { authorId: 'u_david', body: 'Forensic review engaged. Preliminary match: 7 duplicates, $51.2k total. Approver access to vendor master restricted pending review.', d: 4 },
          { authorId: 'u_james', body: 'Legal hold issued on AP mailbox and approval logs.', d: 3 },
        ],
      },
      {
        category: 'conditions', status: 'resolved', priority: 'medium', assignee: 'u_sarah',
        subject: 'Cooling failure in Warehouse B during heat wave',
        description: 'The air conditioning in Warehouse B has been broken for over a week. Temperatures on the floor have exceeded 95°F in the afternoons, and two colleagues have felt unwell. Requests to facilities have not been answered.',
        occurredOn: 'Late August 2026', location: 'Distribution Center – Warehouse B', involved: '',
        attachments: [], identity: { anonymous: true }, createdDays: 41, updatedDays: 30,
        messages: [
          { from: 'team', authorId: 'u_sarah', body: 'Thank you for raising this. We have escalated to the Site Director and Health & Safety. Portable cooling units are being delivered today and shifts will include additional breaks.', d: 40 },
          { from: 'reporter', body: 'The portable units arrived — thank you. It is much better already.', d: 37 },
          { from: 'team', authorId: 'u_sarah', body: 'The permanent HVAC repair was completed yesterday, and facilities now has a 24-hour response target for temperature issues. We are closing this case. Thank you for speaking up.', d: 30 },
        ],
        notes: [{ authorId: 'u_sarah', body: 'Root cause: maintenance contract lapsed. Procurement renewed with SLA.', d: 31 }],
      },
      {
        category: 'suggestion', status: 'received', priority: 'low', assignee: null,
        subject: 'Introduce meeting-free Friday afternoons',
        description: 'Many of us in Engineering spend most of the week in meetings. A protected, meeting-free block on Friday afternoons would give teams time for focused work, documentation and learning. Several peer companies have done this successfully.',
        occurredOn: '', location: 'Engineering', involved: '', attachments: [],
        identity: { anonymous: false, name: 'Daniel Okafor', email: 'daniel.okafor@clearline.example' },
        createdDays: 0.15, updatedDays: 0.15, messages: [], notes: [], unreadForTeam: 0, isNew: true,
      },
      {
        category: 'discrimination', status: 'progress', priority: 'high', assignee: 'u_priya',
        subject: 'Promotion criteria applied inconsistently',
        description: 'In the last promotion cycle, several colleagues with comparable performance ratings were treated differently. Those who work flexible hours due to caregiving responsibilities were told they lacked "visibility", while the written criteria do not mention this.',
        occurredOn: 'Spring 2026 promotion cycle', location: 'Customer Success', involved: 'Promotion committee',
        attachments: [{ name: 'promotion-criteria-2026.pdf', size: 412004, type: 'application/pdf' }],
        identity: { anonymous: false, name: 'Maya Thompson', email: 'maya.thompson@clearline.example' },
        createdDays: 20, updatedDays: 2,
        messages: [
          { from: 'team', authorId: 'u_priya', body: 'Hi Maya, thank you for raising this. We are reviewing the cycle data across the department. Would you be open to a confidential conversation next week?', d: 18 },
          { from: 'reporter', body: 'Yes, any afternoon works for me.', d: 17 },
          { from: 'team', authorId: 'u_priya', body: 'Thank you. We have completed the data review and are now meeting with the committee members. We expect to share an update within two weeks.', d: 2 },
        ],
        notes: [{ authorId: 'u_priya', body: 'Calibration data shows a 14-point gap in promotion rate for flexible-schedule employees with equal ratings. Escalating to CHRO.', d: 6 }],
      },
      {
        category: 'bullying', status: 'review', priority: 'medium', assignee: 'u_priya',
        subject: 'Deliberate exclusion from team communications',
        description: 'Since I raised concerns about a project timeline, I have been removed from the team channel and left off key meeting invites. Decisions that affect my work are made without me and I learn about them afterwards.',
        occurredOn: 'Past month', location: 'Marketing Operations', involved: 'Two senior team members',
        attachments: [], identity: { anonymous: true }, createdDays: 6, updatedDays: 3,
        messages: [{ from: 'team', authorId: 'u_priya', body: 'Thank you for reporting this. Retaliation for raising concerns is never acceptable. Could you share the approximate date you were removed from the channel?', d: 3 }],
        notes: [],
      },
      {
        category: 'ethics', status: 'review', priority: 'high', assignee: 'u_james',
        subject: 'Undisclosed relationship with a key supplier',
        description: 'A procurement lead appears to have a close family relationship with the owner of a packaging supplier that recently won a multi-year contract. I do not believe this was disclosed in the conflict of interest register.',
        occurredOn: 'Contract awarded in August 2026', location: 'Procurement', involved: 'Procurement lead',
        attachments: [], identity: { anonymous: true }, createdDays: 9, updatedDays: 5,
        messages: [], notes: [{ authorId: 'u_james', body: 'Conflict of interest register checked — no declaration on file. Requesting bid evaluation documents.', d: 5 }],
      },
      {
        category: 'misconduct', status: 'received', priority: 'critical', assignee: null,
        subject: 'Forklift safety checks signed off without inspection',
        description: 'On the night shift, daily forklift pre-use inspections are being signed off in bulk at the start of the shift without anyone actually checking the vehicles. One forklift has had a faulty brake for several days.',
        occurredOn: 'This week', location: 'Distribution Center – Night shift', involved: 'Shift supervisor',
        attachments: [{ name: 'inspection-log-photo.jpg', size: 1832004, type: 'image/jpeg' }],
        identity: { anonymous: true }, createdDays: 0.9, updatedDays: 0.9, messages: [], notes: [], unreadForTeam: 0, isNew: true,
      },
      {
        category: 'management', status: 'resolved', priority: 'medium', assignee: 'u_sarah',
        subject: 'Overtime approvals withheld from part of the team',
        description: 'Our manager approves overtime for some team members but repeatedly rejects it for others doing the same extra hours. There is no clear policy explaining the difference.',
        occurredOn: 'Q2 2026', location: 'Customer Support – EMEA', involved: 'Support manager',
        attachments: [], identity: { anonymous: true }, createdDays: 56, updatedDays: 33,
        messages: [
          { from: 'team', authorId: 'u_sarah', body: 'Thank you. We are reviewing overtime records for the team.', d: 54 },
          { from: 'team', authorId: 'u_sarah', body: 'Our review confirmed inconsistencies. Back pay has been processed for affected employees and a written overtime policy has been published. This case is now resolved.', d: 33 },
        ],
        notes: [],
      },
      {
        category: 'misconduct', status: 'resolved', priority: 'high', assignee: 'u_david',
        subject: 'Personal use of company fuel cards',
        description: 'A small group of field technicians appear to be using company fuel cards for personal vehicles on weekends.',
        occurredOn: 'Ongoing', location: 'Field Services – North region', involved: '',
        attachments: [], identity: { anonymous: true }, createdDays: 82, updatedDays: 50, messages: [], notes: [],
      },
      {
        category: 'conditions', status: 'progress', priority: 'medium', assignee: 'u_sarah',
        subject: 'Unsustainable on-call rotation in the support team',
        description: 'Our team of four covers 24/7 on-call with no compensation days. Most of us have been paged overnight several times a week for the last two months and burnout is becoming serious.',
        occurredOn: 'Since August 2026', location: 'Platform Support', involved: '',
        attachments: [], identity: { anonymous: true }, createdDays: 15, updatedDays: 4,
        messages: [
          { from: 'team', authorId: 'u_sarah', body: 'Thank you for flagging this. We are working with Engineering leadership on interim relief and a longer-term staffing plan.', d: 12 },
          { from: 'reporter', body: 'Thank you. Is there any timeline for the interim changes?', d: 5 },
        ],
        notes: [], unreadForTeam: 1,
      },
      {
        category: 'suggestion', status: 'resolved', priority: 'low', assignee: 'u_priya',
        subject: 'Pulse surveys after reorganizations',
        description: 'After each reorganization it would help to run a short anonymous pulse survey so leadership can see how teams are adjusting.',
        occurredOn: '', location: 'Company-wide', involved: '', attachments: [],
        identity: { anonymous: true }, createdDays: 101, updatedDays: 70,
        messages: [{ from: 'team', authorId: 'u_priya', body: 'Great idea — People Analytics will introduce a 5-question pulse survey 30 days after any reorganization, starting next quarter. Thank you!', d: 70 }],
        notes: [],
      },
      {
        category: 'harassment', status: 'received', priority: 'high', assignee: null,
        subject: 'Uncomfortable behavior at the regional offsite',
        description: 'At the regional offsite dinner, a senior colleague made repeated unwanted physical contact with a junior team member and continued after being asked to stop. Several people noticed.',
        occurredOn: 'October 15, 2026', location: 'Regional offsite – hotel restaurant', involved: 'Senior account director',
        attachments: [], identity: { anonymous: true }, createdDays: 2, updatedDays: 2, messages: [], notes: [], isNew: true,
      },
    ];

    return list.map((c) => {
      const createdAt = ago(now, c.createdDays);
      const r = {
        id: id('rpt'),
        reference: c.reference || null,
        accessCode: c.accessCode || null,
        category: c.category,
        subject: c.subject,
        description: c.description,
        occurredOn: c.occurredOn || '',
        location: c.location || '',
        involved: c.involved || '',
        attachments: c.attachments || [],
        identity: c.identity,
        status: c.status,
        priority: c.priority,
        assignee: c.assignee,
        createdAt,
        updatedAt: ago(now, c.updatedDays),
        resolvedAt: c.status === 'resolved' ? ago(now, c.updatedDays) : null,
        messages: (c.messages || []).map((m) => ({ id: id('msg'), from: m.from, authorId: m.authorId || null, body: m.body, at: ago(now, m.d) })),
        notes: (c.notes || []).map((n) => ({ id: id('note'), authorId: n.authorId, body: n.body, at: ago(now, n.d) })),
        unreadForTeam: c.unreadForTeam != null ? c.unreadForTeam : 0,
        unreadForReporter: c.unreadForReporter || 0,
        isNew: !!c.isNew,
      };
      // Mark reporter-authored latest messages as unread for the team.
      if (c.unreadForTeam == null) {
        const last = r.messages[r.messages.length - 1];
        r.unreadForTeam = last && last.from === 'reporter' && r.status !== 'resolved' ? 1 : 0;
      }
      r.activity = activityFor(r, now);
      return r;
    });
  }

  const POOL = {
    harassment: [
      ['Unwanted comments in team chat', 'A colleague has been posting suggestive remarks in our team chat and directing them at specific people.'],
      ['Intimidating behavior from a contractor', 'A contractor working on site has repeatedly followed staff to the parking area and made them uncomfortable.'],
    ],
    bullying: [
      ['Public criticism in team meetings', 'A manager regularly singles out one team member for harsh criticism in front of others.'],
      ['Persistent mocking from coworkers', 'A group of coworkers repeatedly mocks a new hire’s accent during lunch and in meetings.'],
    ],
    discrimination: [
      ['Age-related comments during hiring', 'During interview debriefs, older candidates have been described as “not a culture fit” without explanation.'],
      ['Unequal access to training budget', 'Training opportunities appear to be offered mainly to employees in the head office, not regional staff.'],
    ],
    ethics: [
      ['Gifts accepted from a vendor', 'A buyer accepted expensive event tickets from a vendor during an active tender.'],
      ['Customer data shared with a partner', 'Customer contact lists were shared with a marketing partner without a data processing agreement.'],
    ],
    misconduct: [
      ['Timesheets edited after approval', 'Approved timesheets are being edited afterwards to add hours that were not worked.'],
      ['Safety equipment not provided', 'New starters on the production line are working without the required protective equipment.'],
    ],
    management: [
      ['Unclear decisions on remote work', 'Remote work requests are approved or rejected without any consistent reasoning.'],
      ['Feedback ignored by leadership', 'Concerns raised in team retrospectives are never acknowledged or followed up on.'],
    ],
    conditions: [
      ['Insufficient break room facilities', 'The break room on the second floor has been closed for months with no alternative space.'],
      ['Excessive mandatory weekend shifts', 'Weekend shifts have become mandatory every other week without consultation.'],
    ],
    fraud: [
      ['Inflated expense claims', 'Several expense claims include receipts that appear to have been altered.'],
      ['Ghost vendor in payment system', 'A vendor in the payment system has no physical address and receives regular small payments.'],
    ],
    suggestion: [
      ['Mentoring program for new managers', 'A structured mentoring program would help first-time managers build confidence.'],
      ['Quiet rooms in open-plan offices', 'Adding a few bookable quiet rooms would make focused work much easier.'],
      ['Clearer onboarding checklist', 'A single onboarding checklist across teams would reduce confusion for new joiners.'],
    ],
  };

  const NAMES = ['Alex Morgan', 'Jordan Lee', 'Sam Patel', 'Chris Novak', 'Taylor Brooks', 'Robin Alvarez', 'Jamie Fischer', 'Casey Wong'];

  // Weighting gives a realistic distribution (suggestions & conditions most common).
  const WEIGHTS = { suggestion: 16, conditions: 13, management: 12, bullying: 9, harassment: 8, misconduct: 9, ethics: 6, discrimination: 6, fraud: 5 };
  const PRIOS_BY_CAT = { fraud: ['high', 'critical', 'medium'], harassment: ['high', 'medium', 'high'], suggestion: ['low', 'low', 'medium'] };

  function generated(now, rand) {
    const cats = Object.entries(WEIGHTS).flatMap(([k, w]) => Array(w).fill(k));
    const team = ['u_sarah', 'u_david', 'u_priya', 'u_james'];
    const out = [];
    // Monthly volume with a gentle upward trend + noise across the last 12 months.
    for (let m = 11; m >= 0; m--) {
      const volume = Math.round(4 + (11 - m) * 0.45 + rand() * 3);
      for (let i = 0; i < volume; i++) {
        const daysAgo = m * 30.4 + rand() * 30;
        if (daysAgo < 3) continue;
        const cat = cats[Math.floor(rand() * cats.length)];
        const pool = POOL[cat];
        const [subject, description] = pool[Math.floor(rand() * pool.length)];
        const prioOpts = PRIOS_BY_CAT[cat] || ['low', 'medium', 'medium', 'high'];
        let status;
        if (daysAgo > 60) status = rand() < 0.94 ? 'resolved' : 'progress';
        else if (daysAgo > 25) status = rand() < 0.6 ? 'resolved' : 'progress';
        else status = ['review', 'progress', 'resolved', 'review'][Math.floor(rand() * 4)];
        const resolveDays = 5 + rand() * 30;
        const createdAt = ago(now, daysAgo);
        const updatedDays = status === 'resolved' ? Math.max(daysAgo - resolveDays, 0.5) : Math.max(daysAgo - rand() * Math.min(daysAgo, 12), 0.5);
        const r = {
          id: id('rpt'), reference: null, accessCode: null,
          category: cat, subject, description,
          occurredOn: '', location: '', involved: '', attachments: [],
          identity: rand() < 0.82 ? { anonymous: true } : (() => { const n = NAMES[Math.floor(rand() * NAMES.length)]; return { anonymous: false, name: n, email: n.toLowerCase().replace(' ', '.') + '@clearline.example' }; })(),
          status,
          priority: prioOpts[Math.floor(rand() * prioOpts.length)],
          assignee: team[Math.floor(rand() * team.length)],
          createdAt,
          updatedAt: ago(now, updatedDays),
          resolvedAt: status === 'resolved' ? ago(now, updatedDays) : null,
          messages: [], notes: [], unreadForTeam: 0, unreadForReporter: 0, isNew: false,
        };
        r.activity = activityFor(r, now);
        out.push(r);
      }
    }
    return out;
  }

  function build(now = Date.now()) {
    seq = 0;
    const rand = mulberry32(20261019);
    return [...curated(now), ...generated(now, rand)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  window.SU.seed = { build, DEMO };
})();
