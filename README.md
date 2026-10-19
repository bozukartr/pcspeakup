# Clearline — Speak Up Safely

A mobile-first internal reporting platform for anonymous reports, whistleblowing, complaints and feedback. It has an employee portal and a case-management workspace for administrators. It is built with plain **HTML5, CSS3 and vanilla JavaScript**. There is no build step and no framework. The only external resource is the Inter web font.

> ⚠️ **This is a demonstration.** All data lives in your browser's `localStorage`. Client-side storage provides **no genuine anonymity, confidentiality or security**: anyone with access to the browser can read it, and nothing is sent to a server. Do not enter real reports. See [ARCHITECTURE.md](ARCHITECTURE.md) for what a production deployment requires.

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080   # then visit http://localhost:8080
```

## Try it

| Flow | How |
|---|---|
| Submit a report | Home → **Submit a Report** (5 steps: category → details → evidence → identity → review) |
| Track a report | **Track** → "Fill in demo credentials" (`CL-7K4M-Q2XD` / `H8RT-2MXQ-PZ4N`) |
| Case management | Sidebar/Help → **Case management**. Sign in as any demo account with the password `demo` |
| Two-way messaging | Open the employee view and the admin view in two tabs. Messages and status changes sync live |
| Reset sample data | Admin → Settings → **Reset demo data** |

## Features

**Employee portal**
- A home screen with three primary actions: Submit a Report, Track My Report and How It Works
- A progressive five-step form with nine categories, optional context and attachments (metadata only), and optional identity disclosure. It validates accessibly and auto-advances on single-choice steps
- A CSPRNG tracking reference and a 12-character access code. The code is stored only as a SHA-256 hash, and you can copy it or save it as a file
- A status timeline (Received → Under Review → In Progress → Resolved) and anonymous messaging with the case team
- The reporter session locks automatically after 20 minutes. There is also a privacy FAQ and a transparent explanation of the process

**Case management**
- An overview with KPIs (total, pending, in progress, resolved), a needs-attention queue, a 12-month received-vs-resolved trend, and breakdowns by category and status
- A reports inbox with full-text search (`/`), status chips with counts, a filter sheet (category, priority, assignee, unread) and sorting. Filters can be reset, and the list exports to CSV
- A case workspace where you can change status, priority, assignee and category. It has reporter messaging with reply templates, private internal notes, a details tab and an audit activity log. You can delete a case with confirmation and undo
- Analytics with 3, 6 and 12-month ranges, monthly volume, intake vs. resolution, and category, priority and status mix. Every chart has a data-table view
- Settings for appearance, notifications, data export and reset, and a production-architecture summary

**Design system and interactions**
- Inter typography, an off-white, charcoal and deep-navy palette, and light and dark themes that follow the system or a manual choice
- A bottom tab bar on mobile and a collapsible sidebar on desktop (`[`). Large titles collapse into the navigation bar as you scroll
- Mobile gestures: swipe from the left edge to go back, pull to refresh, and tap the active tab to scroll to the top. Scroll position is restored when you return to a screen, and message threads dock the composer to the bottom like a chat app
- Desktop: a ⌘K / Ctrl+K command palette for navigation, quick actions and report search, plus a dense table view in the reports inbox
- Bottom sheets with drag-to-dismiss. On desktop these become centered modals
- Context menus: popovers on desktop, action sheets on mobile. Also confirmation dialogs, toasts with undo and swipe-to-dismiss, and skeleton loaders
- Direction-aware page transitions, haptic ticks on supported devices, and support for reduced motion
- Accessibility: keyboard navigation, focus trapping, ARIA roles, live regions and visible focus rings. Touch targets are at least 44px, and the layout uses safe-area insets

## Project structure

```
index.html              App shell
css/tokens.css          Design tokens (light + dark)
css/base.css            Reset, typography, utilities
css/layout.css          Sidebar, top bar, tab bar, pages, transitions
css/components.css      Buttons, cells, forms, sheets, menus, charts, …
css/views.css           Screen-specific composition
js/core/                utils (safe HTML templating), icons, crypto, store, router
js/data/                catalog (categories, statuses, team), seed data
js/ui/                  toast, overlay (sheet/dialog/menu), charts, components
js/views/employee/      home, submit, track, how
js/views/admin/         login, dashboard, reports, case, analytics, settings
js/app.js               Shell: navigation, routing lifecycle, theme, shortcuts
```

All rendering goes through an auto-escaping `html` tagged template, so user-supplied text is never injected as markup.
