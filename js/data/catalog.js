/* ==========================================================================
   Catalog — reporting categories, statuses, priorities and the case team.
   Shared vocabulary for the employee and admin surfaces.
   ========================================================================== */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'harassment', label: 'Workplace Harassment', short: 'Harassment', icon: 'handRaised',
      desc: 'Unwelcome conduct, including sexual harassment, threats or intimidation.' },
    { id: 'bullying', label: 'Bullying', short: 'Bullying', icon: 'megaphone',
      desc: 'Repeated mistreatment, humiliation, exclusion or verbal abuse.' },
    { id: 'discrimination', label: 'Discrimination', short: 'Discrimination', icon: 'scale',
      desc: 'Unfair treatment based on a protected characteristic.' },
    { id: 'ethics', label: 'Ethical Violations', short: 'Ethics', icon: 'compass',
      desc: 'Conflicts of interest, bribery, or breaches of our Code of Conduct.' },
    { id: 'misconduct', label: 'Misconduct', short: 'Misconduct', icon: 'alertTriangle',
      desc: 'Policy violations, safety breaches, theft or misuse of company assets.' },
    { id: 'management', label: 'Management Complaints', short: 'Management', icon: 'briefcase',
      desc: 'Concerns about leadership decisions, fairness or a manager’s behavior.' },
    { id: 'conditions', label: 'Working Conditions', short: 'Conditions', icon: 'building',
      desc: 'Workload, hours, health and safety, or the physical work environment.' },
    { id: 'fraud', label: 'Fraud', short: 'Fraud', icon: 'coins',
      desc: 'Financial irregularities, falsified records, or expense abuse.' },
    { id: 'suggestion', label: 'Suggestions', short: 'Suggestions', icon: 'bulb',
      desc: 'Ideas to improve how we work, our culture or our processes.' },
  ];

  const STATUSES = [
    { id: 'received', label: 'Received', css: 'received', icon: 'inbox',
      employeeText: 'Your report has been securely received and logged.' },
    { id: 'review', label: 'Under Review', css: 'review', icon: 'eye',
      employeeText: 'An authorized reviewer is assessing your report.' },
    { id: 'progress', label: 'In Progress', css: 'progress', icon: 'activity',
      employeeText: 'The case is being actively investigated or addressed.' },
    { id: 'resolved', label: 'Resolved', css: 'resolved', icon: 'checkCircle',
      employeeText: 'The case has been concluded. Thank you for speaking up.' },
  ];

  const PRIORITIES = [
    { id: 'low', label: 'Low', rank: 1 },
    { id: 'medium', label: 'Medium', rank: 2 },
    { id: 'high', label: 'High', rank: 3 },
    { id: 'critical', label: 'Critical', rank: 4 },
  ];

  const TEAM = [
    { id: 'u_sarah', name: 'Sarah Mitchell', role: 'Head of Ethics & Compliance', email: 'sarah.mitchell@clearline.example' },
    { id: 'u_david', name: 'David Chen', role: 'Senior Investigator', email: 'david.chen@clearline.example' },
    { id: 'u_priya', name: 'Priya Raman', role: 'HR Business Partner', email: 'priya.raman@clearline.example' },
    { id: 'u_james', name: 'James Walker', role: 'Legal Counsel', email: 'james.walker@clearline.example' },
  ];

  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const catMap = byId(CATEGORIES);
  const statusMap = byId(STATUSES);
  const prioMap = byId(PRIORITIES);
  const teamMap = byId(TEAM);

  window.SU.catalog = {
    CATEGORIES, STATUSES, PRIORITIES, TEAM,
    category: (id) => catMap[id] || { id, label: 'Uncategorized', short: 'Other', icon: 'tag', desc: '' },
    status: (id) => statusMap[id] || STATUSES[0],
    priority: (id) => prioMap[id] || PRIORITIES[1],
    member: (id) => teamMap[id] || null,
    statusIndex: (id) => STATUSES.findIndex((s) => s.id === id),
  };
})();
