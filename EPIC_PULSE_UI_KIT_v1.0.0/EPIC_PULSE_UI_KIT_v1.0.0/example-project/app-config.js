/* EPIC Pulse — application configuration

   Everything in this demonstration that belongs to the organisation rather
   than to the kit: who is signed in, where the navigation goes, what the
   menus offer, the workspaces that can be switched to, and the date the data
   is stamped with.

   The kit ships none of it. Load this before the kit's other scripts, or call
   EpicPulse.init() with the same shape — whichever suits your build. Anything
   left out here is not rendered at all, which is why the account popover in
   this demonstration has no Settings row: no settings route was supplied,
   and a missing link is better than one into a page that does not exist. */

(function (global) {
  'use strict';

  /* --- session ----------------------------------------------------------
     The person signed in, and the two strings the shell renders beside their
     name: the workspace they are in and the mark that stands for it in the
     topbar. Everything here reaches the page through the shell.
     -------------------------------------------------------------------- */

  var SESSION = {
    name: 'A. Karim',
    firstName: 'Karim',
    initials: 'AK',
    email: 'a.karim@epicgroup.com',
    role: 'Production Head',
    roleLine: 'Production Head · Unit 2',
    workspace: 'Unit 2',
    workspaceName: 'Epic Manufacturing — Unit 2',
    workspaceMark: 'U2',
    version: '4.2.0',
    build: '20261218.3',
    asof: '18 Dec 4:41 PM',
    notifications: 4,
    support: 'pulse.support@epicgroup.com'
  };

  /* --- navigation -------------------------------------------------------
     Three groups, and every destination in them is a screen this project
     actually contains. A nav that names a page you have not built yet costs
     the reader a dead link on their first click, which is a worse first
     impression than a shorter sidebar.
     -------------------------------------------------------------------- */

  var NAV = [
    {
      group: 'PULSE',
      items: [
        { id: 'home', label: 'Home', icon: 'home', href: 'home.html' }
      ]
    },
    {
      group: 'ANALYTICS',
      items: [
        {
          id: 'dashboard', label: 'Dashboard', icon: 'chart', href: 'dashboard.html', expanded: true,
          children: [
            { id: 'dash-production', label: 'Production Overview', icon: 'rocket', href: 'dashboard.html?d=production' },
            { id: 'dash-quality', label: 'Quality', icon: 'check-circle', href: 'dashboard.html?d=quality' },
            { id: 'dash-delivery', label: 'Delivery Performance', icon: 'globe', href: 'dashboard.html?d=delivery' }
          ]
        }
      ]
    },
    {
      group: 'LIBRARY',
      items: [
        { id: 'library', label: 'Report Library', icon: 'docs', href: 'report-library.html' },
        { id: 'viewer', label: 'Production Pulse', icon: 'doc-text', href: 'report-viewer.html', badge: '2' }
      ]
    }
  ];

  /* --- menus ------------------------------------------------------------
     One entry per menu the five screens open, keyed by the name its trigger
     carries in data-ep-menu. The kit holds the engine; these are the lists.

     A menu with `value` is a single choice and marks the current one; `multi`
     keeps the menu open and adds Clear and Done; `act` names an action the
     kit or the page answers to; `href` navigates. A list nobody opens does
     not belong here — the product's full registry is several times this, and
     this file carries the dozen these five screens actually use.
     -------------------------------------------------------------------- */

  var MENUS = {
    /* topbar — the shell renders these three itself */
    period: {
      title: 'Period',
      value: 'dec-2026',
      items: [
        { v: 'today', l: 'Today', meta: '18 Dec' },
        { v: 'this-week', l: 'This week', meta: 'W51' },
        { v: 'this-month', l: 'This month', meta: 'Dec 2026' },
        { v: 'dec-2026', l: 'Dec 2026' },
        { v: 'q4-2026', l: 'Q4 2026', meta: 'Oct – Dec' },
        { v: '2026', l: 'Year 2026' },
        { sep: true },
        { l: 'Custom range…', icon: 'calendar', overlay: 'filters' }
      ]
    },

    search: {
      title: 'Jump to', search: 'Search dashboards, reports and metrics',
      items: [
        { head: 'Dashboards' },
        { l: 'Production Overview', icon: 'chart', href: 'dashboard.html?d=production' },
        { l: 'Delivery Performance', icon: 'chart', href: 'dashboard.html?d=delivery' },
        { head: 'Reports' },
        { l: 'Production Pulse (Daily)', icon: 'doc-text', href: 'report-viewer.html' },
        { l: 'Report library', icon: 'docs', href: 'report-library.html' }
      ]
    },

    notifications: {
      title: 'Notifications · 4 unread',
      items: [
        { rich: true, l: 'On-Time Delivery breached', note: 'Below the 90% floor · 22 min ago', icon: 'alert', href: 'dashboard.html?d=delivery' },
        { rich: true, l: 'Line 4 efficiency below floor', note: 'Third consecutive day · 1 h ago', icon: 'alert', href: 'dashboard.html' },
        { rich: true, l: 'Production Pulse (Daily) is ready', note: '8,412 rows · 3 h ago', icon: 'file', href: 'report-viewer.html' },
        { rich: true, l: 'R. Shah shared “Delivery Performance”', note: 'Dashboard · 4 h ago', icon: 'globe', href: 'dashboard.html?d=delivery' },
        { sep: true },
        { l: 'Mark all as read', icon: 'check', act: 'mark-read' }
      ]
    },

    /* the dashboard */
    dashboards: {
      title: 'Saved dashboards',
      value: 'production',
      items: [
        { v: 'production', l: 'Production Overview', meta: '5 tiles', href: 'dashboard.html?d=production' },
        { v: 'quality', l: 'Quality', meta: '5 tiles', href: 'dashboard.html?d=quality' },
        { v: 'delivery', l: 'Delivery Performance', meta: '5 tiles', href: 'dashboard.html?d=delivery' }
      ]
    },

    units: {
      title: 'Unit', multi: true,
      items: [
        { v: 'u1', l: 'Unit 1 — Fabrication' },
        { v: 'u2', l: 'Unit 2 — Assembly & Finishing', checked: true },
        { v: 'u3', l: 'Unit 3 — Sub-assembly' }
      ]
    },

    lines: {
      title: 'Line', multi: true,
      items: [1, 2, 3, 4, 5, 6].map(function (n) {
        return { v: 'l' + n, l: 'Line ' + n, checked: true };
      })
    },

    shifts: {
      title: 'Shift', multi: true,
      items: [
        { v: 'a', l: 'Shift A', checked: true },
        { v: 'b', l: 'Shift B', checked: true },
        { v: 'c', l: 'Shift C' }
      ]
    },

    filterdims: {
      title: 'Add filter',
      items: [
        { l: 'Period', icon: 'calendar', overlay: 'filters' },
        { l: 'Customer', overlay: 'filters' },
        { l: 'Product category', overlay: 'filters' },
        { l: 'Order status', overlay: 'filters' },
        { l: 'Stage', overlay: 'filters' }
      ]
    },

    customers: {
      title: 'Customer', multi: true, search: 'Search 6 customers',
      items: ['Northwind Industrial', 'Meridian Systems', 'Halvorsen Group',
              'Kestrel Retail', 'Bluefin Apparel', 'Orion Outfitters'].map(function (name) {
        return { v: name.toLowerCase().replace(/[^a-z]+/g, '-'), l: name };
      })
    },

    tilekebab: {
      title: 'Chart tile',
      items: [
        { l: 'Filter to this', icon: 'filter', overlay: 'filters' },
        { l: 'Full screen', icon: 'expand', act: 'fullscreen' },
        { l: 'Export', icon: 'download', overlay: 'export' },
        { l: 'Share', icon: 'share-out', act: 'share' },
        { sep: true },
        { l: 'Explain this', icon: 'chat', overlay: 'assistant' }
      ]
    },

    /* the report library */
    sort: {
      title: 'Sort by', value: 'recent',
      items: [
        { v: 'recent', l: 'Recently used', act: 'sort:recent' },
        { v: 'shared', l: 'Most shared', act: 'sort:shared' },
        { v: 'az', l: 'A – Z', act: 'sort:az' },
        { v: 'fresh', l: 'Freshness', act: 'sort:fresh' }
      ]
    },

    reportkebab: {
      title: 'Report',
      items: [
        { l: 'Open', icon: 'doc-text', href: 'report-viewer.html' },
        { l: 'Subscribe', icon: 'calendar', overlay: 'schedule' },
        { l: 'Copy link', icon: 'duplicate', act: 'copy-link' },
        { l: 'Export', icon: 'download', overlay: 'export' },
        { sep: true },
        { l: 'Remove from favourites', icon: 'star', act: 'unfavourite', danger: true }
      ]
    },

    /* the report viewer */
    columns: {
      title: 'Columns', multi: true, keepOpen: true,
      items: [
        { v: '0', l: 'Order', checked: true, locked: true },
        { v: '1', l: 'Customer', checked: true },
        { v: '2', l: 'Line', checked: true },
        { v: '3', l: 'Stage', checked: true },
        { v: '4', l: 'Promised', checked: true },
        { v: '5', l: 'Units', checked: true }
      ],
      act: 'columns'
    },

    density: {
      title: 'Row density', value: 'comfortable',
      items: [
        { v: 'comfortable', l: 'Comfortable', act: 'density:comfortable' },
        { v: 'compact', l: 'Compact', act: 'density:compact' }
      ]
    },

    groupby: {
      title: 'Group rows by', value: 'customer',
      items: [
        { v: 'customer', l: 'Customer', act: 'group:customer' },
        { v: 'line', l: 'Line', act: 'group:line' },
        { v: 'none', l: 'No grouping', act: 'group:none' }
      ]
    },

    /* the filters drawer and the run dialog, both rendered by the kit */
    risk: {
      title: 'Risk threshold', value: 'medium',
      items: [
        { v: 'low', l: 'Low and above', note: '412 orders' },
        { v: 'medium', l: 'Medium and above', note: '74 orders' },
        { v: 'high', l: 'High only', note: '18 orders' }
      ]
    }
  };

  var WORKSPACES = [
    {
      mark: 'U2', name: 'Epic Manufacturing — Unit 2',
      meta: 'Assembly & Finishing · Production Head · 148 members · Last visited today',
      hay: 'Epic Manufacturing Unit 2 Assembly Finishing Production Head', current: true
    },
    {
      mark: 'U1', name: 'Epic Manufacturing — Unit 1',
      meta: 'Fabrication · Viewer · 96 members · Last visited 4 Dec',
      hay: 'Epic Manufacturing Unit 1 Fabrication Viewer'
    },
    {
      mark: '', name: 'Epic Logistics — Warehouse',
      meta: 'Access revoked 8 Dec · Contact your workspace admin',
      hay: 'Epic Logistics Warehouse Restricted', badge: 'Restricted', locked: true
    }
  ];

  /* --- copy for the overlays the kit renders ----------------------------
     The assistant, the filters drawer, export, run, schedule and delivery
     history are built by the kit, and every name and number in them comes
     from here. The kit's own defaults are deliberately bland, so an
     unconfigured kit names nobody.

     Plain text, not markup: most of this reaches the page escaped, so an
     HTML entity written here would be printed as its own source.
     -------------------------------------------------------------------- */

  var OVERLAY_COPY = {
    assistantContext: 'Production Overview · Unit 2 · Dec',
    assistantAnswer: 'On-Time Delivery is 87%, down 3 points. Unit 2 accounts for 11 of the 14 late orders &mdash; mostly material delays.',
    assistantCardMeta: 'Dec · Unit 2',
    filtersSummary: '4 applied · Production Overview',
    filterScopeOption: 'Unit 2 — Assembly &amp; Finishing',
    scheduleRecipients: 'Merchandising, PPC',
    bounceAddress: 'merchandising@epicgroup.com',
    runRecentChip: 'Unit 2 · W51–W06',
    runParamUnit: 'Unit 2',
    runParamCustomer: 'Northwind, Meridian',
    exportSubject: 'Production Pulse · Unit 2 · Dec',
    reportName: 'Production Pulse (Daily)',
    scheduleSubject: 'Production Pulse (Daily) · report',
    pinTarget: 'Production Overview',
    reportReadyMeta: 'Production Pulse (Daily) · 8,412 rows',
    deliveredMeta: 'Production Pulse (Daily) · PDF'
  };

  /* --- where the shell's own chrome links -------------------------------
     The kit renders a brand link, a sign-out row and an account popover, and
     it does not know this application's file names. Only the two routes this
     project can honour are supplied: the rest of the popover's rows are left
     out rather than pointed at screens that are not here.
     -------------------------------------------------------------------- */

  var ROUTES = {
    home: 'home.html',
    signin: 'index.html?reason=signout'
  };

  /* Paths resolve against the page rather than the kit, because the lockups
     belong to the organisation and not to the kit. Both files are light
     marks, meant for a dark surface — which is what the sidebar gives them. */

  var BRAND = {
    name: 'EPIC Pulse',
    logo: 'assets/epic-pulse-logo.png',
    logoRail: 'assets/epic-pulse-logo-navy-tight.png'
  };

  /* The date this demonstration's data is stamped with. Remove it and the
     kit uses the real one — which is the right setting for an application
     with a backend behind it, and the wrong one for a frozen sample. */

  var TODAY = '2026-12-18';

  global.EP_SESSION = SESSION;
  global.EP_NAV = NAV;
  global.EP_MENUS = MENUS;
  global.EP_WORKSPACES = WORKSPACES;
  global.EP_OVERLAY_COPY = OVERLAY_COPY;
  global.EP_ROUTES = ROUTES;
  global.EP_BRAND = BRAND;
  global.EP_TODAY = TODAY;
}(window));
