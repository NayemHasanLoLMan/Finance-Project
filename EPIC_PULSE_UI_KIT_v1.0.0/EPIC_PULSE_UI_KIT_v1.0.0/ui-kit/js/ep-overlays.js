/* EPIC Pulse UI Kit — overlays

   Built here:  Pulse Assistant · Run Report / Parameters ·
                Export · Add Chart Tile · Filters drawer ·
                Account popover · Toasts & progress
                — the seven overlays the design source actually designs (Phases 0-3)
                — plus Workspace picker, which is the workspace picker's own list rather
                than a new design: sign-in lands in the default workspace, so
                switching became an account action instead of a flow step.

                Subscribe & Schedule and the distribution center's delivery-history drawer
                arrived with the distribution center, which the specification says owns both.

   Not built:   Share, Notifications and Confirm land in
                Phases 4-6 and have no design frame yet.
                Rather than invent them, the actions that would open them
                report through toasts & progress, whose success/warning variants the design source
                does define ("Shared with 4 recipients", "Schedule saved",
                "Link copied").

   Any element can open one:  <button data-ep-open="export">…</button>
   Pages can retitle a modal: <body data-ep-export-subject="…" data-ep-run-report="…"> */

(function (global) {
  'use strict';

  /* Modules find each other through the namespace first and the bare
     global second. A host page with its own window.menus or window.app
     must not be able to stand in for the kit's, whichever script tag
     comes first. The bare globals are deprecated and go in 2.0.0. */
  function mod(name) {
    var ns = global.EpicPulse;
    return (ns && ns[name]) || global[name];
  }

  var icon = mod('icon');
  var root = null;
  var openName = null;
  var lastTrigger = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Demo copy for the overlays that have no backend behind them. A page
     supplies its own through window.EP_OVERLAY_COPY; the defaults below are
     deliberately bland, so an unconfigured kit reads as a product with no data
     rather than as somebody else's product. */
  function copy(key, fallback) {
    var map = global.EP_OVERLAY_COPY || {};
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
  }

  /* Where the kit's own chrome points, and the mark it renders. The kit does
     not know a consumer's file names or brand, so both come from outside it —
     window.EP_ROUTES / EP_BRAND, or EpicPulse.init({ routes, brand }). A route
     that was not supplied is not rendered at all: a link into a page that does
     not exist is worse than no link. */
  var DEFAULT_ROUTES = { home: '', signin: '', settings: '', help: '', drilldown: '' };
  var DEFAULT_BRAND  = { name: '', logo: '', logoRail: '' };

  function pick(defaults, supplied) {
    var out = {}, k;
    supplied = supplied || {};
    for (k in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, k)) {
        out[k] = Object.prototype.hasOwnProperty.call(supplied, k) ? supplied[k] : defaults[k];
      }
    }
    return out;
  }

  function route(name) { return pick(DEFAULT_ROUTES, global.EP_ROUTES)[name] || ''; }
  function brand() { return pick(DEFAULT_BRAND, global.EP_BRAND); }

  /* An anchor when there is somewhere to go, the same element as a span when
     there is not — the class carries the styling either way. */
  function linkOpen(cls, href, extra) {
    return href
      ? '<a class="' + cls + '" href="' + esc(href) + '"' + (extra || '') + '>'
      : '<span class="' + cls + '"' + (extra || '') + '>';
  }
  function linkClose(href) { return href ? '</a>' : '</span>'; }

  /* A popover row is a link when it has a destination and is left out when it
     does not — an inert row in a menu of links reads as broken. */
  function popLink(cls, href, label) {
    return href ? '<a class="' + cls + '" href="' + esc(href) + '">' + label + '</a>' : '';
  }

  function session() { return global.EP_SESSION || {}; }

  /* Who the action is recorded against. Not copy: the signed-in user. */
  function who() { return session().name || 'this account'; }

  /* Account popover */

  function accountHtml(s) {
    return '' +
    '<div class="ep-popover-layer" data-ep-layer="account">' +
      '<div class="ep-popover" role="dialog" aria-label="Account" data-ep-popover>' +
        '<div class="ep-popover__id">' +
          '<span class="ep-avatar ep-avatar--40 ep-avatar--indigo">' + esc(s.initials) + '</span>' +
          '<span class="ep-popover__id-text">' +
            '<span class="ep-popover__name">' + esc(s.name) + '</span>' +
            '<span class="ep-popover__email">' + esc(s.email) + '</span>' +
            '<span class="ep-popover__role">' + esc(s.role) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="ep-popover__section ep-popover__section--row">' +
          '<span class="ep-col ep-gap-1">' +
            '<span class="ep-eyebrow">Workspace</span>' +
            '<span class="ep-t-md ep-t-bold ep-t-head" data-ep-account-workspace>' + esc(s.workspace) + '</span>' +
          '</span>' +
          '<button class="ep-btn ep-btn--link ep-t-xs ep-t-bold" type="button" data-ep-open="workspace">Switch workspace</button>' +
        '</div>' +
        '<div class="ep-popover__section">' +
          '<span class="ep-eyebrow">Theme</span>' +
          '<div class="ep-theme-switch" role="group" aria-label="Theme">' +
            '<button type="button" data-ep-theme-set="light">Light</button>' +
            '<button type="button" data-ep-theme-set="dark">Dark</button>' +
            '<button type="button" data-ep-theme-set="system">System</button>' +
          '</div>' +
        '</div>' +
        '<div class="ep-popover__links">' +
          popLink('ep-popover__link', route('settings'), 'Settings') +
          popLink('ep-popover__link', route('help'), 'Help &amp; support') +
          popLink('ep-popover__link ep-popover__link--danger', route('signin'), 'Sign out') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Workspace picker

     Sign-in no longer stops at the workspace picker to ask which workspace; it lands in the
     default one. Switching is an account action from then on, so the workspace picker's own
     list — the same rows, search, sticky-default switch and revoked-access
     state — is served here instead. `the workspace picker` itself stays in the screen map as
     the standalone frame.

     Two surfaces serve that one list, because they are reached from opposite
     ends of the shell: the modal belongs to the account popover, where you
     arrive already thinking about your account, and the drawer belongs to
     the topbar mark, which is a glance-and-hop control. Both are built from
     the shared pieces below and both settle through the same
     `do-switch-workspace` action, so the list can never fork. */

  /* The workspaces a page offers are its own. The kit ships none; with no
     configuration the picker renders an empty list rather than somebody
     else's organisation. */
  var WORKSPACES = global.EP_WORKSPACES || [];

  /* the list itself: the three rows you can pick plus the workspace picker's revoked-access
     state. `data-ep-select-row` scopes to the nearest .modal / .drawer, so each
     surface tracks its own pick until a switch settles them both. */
  function wsListHtml() {
    var rows = WORKSPACES.filter(function (w) { return !w.locked; }).map(function (w) {
      return '<button class="ep-ws-row' + (w.current ? ' ep-is-selected' : '') + '" type="button"' +
               ' data-ep-select-row="workspace" aria-pressed="' + (w.current ? 'true' : 'false') + '"' +
               ' data-ep-ws="' + esc(w.hay) + '">' +
               '<span class="ep-ws-row__mark">' + esc(w.mark) + '</span>' +
               '<span class="ep-ws-row__text">' +
                 '<span class="ep-ws-row__name">' + esc(w.name) + '</span>' +
                 '<span class="ep-ws-row__meta">' + esc(w.meta) + '</span>' +
               '</span>' +
               '<span class="ep-ws-row__tick">' + icon('check-thick', 11) + '</span>' +
             '</button>';
    }).join('');

    /* The revoked-access row used to be hard-coded here, which made one
       customer's restricted workspace part of the component. It is a row like
       any other now: { locked: true } in the configured list. */
    var locked = (global.EP_WORKSPACES || []).filter(function (w) { return w.locked; })
      .map(function (w) {
        return '<div class="ep-ws-row ep-is-locked" data-ep-ws="' + esc(w.hay || w.name) + '">' +
                 '<span class="ep-ws-row__mark">' + icon('lock', 16) + '</span>' +
                 '<span class="ep-ws-row__text">' +
                   '<span class="ep-ws-row__name">' + esc(w.name) + '</span>' +
                   '<span class="ep-ws-row__meta">' + esc(w.meta) + '</span>' +
                 '</span>' +
                 '<span class="ep-badge ep-badge--outline-muted" style="border-radius:8px;padding:5px 9px">' +
                   esc(w.badge || 'Restricted') + '</span>' +
               '</div>';
      }).join('');

    return '<div class="ep-col ep-gap-4">' + rows + locked + '</div>';
  }

  /* the filter is scoped to its own surface so the two pickers, which are
     both in the DOM at once, do not filter each other */
  function wsSearchHtml(id, scrim) {
    return '<div class="ep-input-search">' +
      '<label class="ep-sr-only" for="' + id + '">Search workspaces</label>' +
      icon('search', 14) +
      '<input class="ep-input" id="' + id + '" type="search" placeholder="Search workspaces"' +
            ' data-ep-list-filter="[data-ep-scrim=\'' + scrim + '\'] [data-ep-ws]">' +
    '</div>';
  }

  function wsDefaultHtml() {
    return '<button class="ep-switch-row" type="button" data-ep-switch aria-pressed="true"' +
                  ' style="justify-content:flex-start;gap:9px">' +
      '<span class="ep-switch ep-is-on"><span class="ep-switch__knob"></span></span>' +
      '<span class="ep-switch-row__label ep-t-md">Always open this workspace</span>' +
    '</button>';
  }

  /* modal form — opened from the account popover */
  function workspaceHtml(s) {
    return '' +
    '<div class="ep-scrim" data-ep-scrim="workspace" data-ep-ws-picker>' +
      '<div class="ep-modal ep-modal--md" role="dialog" aria-label="Choose a workspace">' +
        '<div class="ep-modal__head">' +
          '<div class="ep-modal__titles">' +
            '<span class="ep-modal__title">Choose a workspace</span>' +
            '<span class="ep-modal__sub">Signed in as ' + esc(s.email) + '</span>' +
          '</div>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ep-modal__body">' +
          wsSearchHtml('ws-modal-search', 'workspace') +
          wsListHtml() +
          wsDefaultHtml() +
          '<div class="ep-modal__foot">' +
            '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-close>Cancel</button>' +
            '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-action="do-switch-workspace">Switch workspace</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* drawer form — opened from the topbar workspace mark, using the same
     right-hand drawer as the filters drawer so no new surface was designed */
  function workspacePanelHtml(s) {
    return '' +
    '<div class="ep-scrim ep-scrim--right" data-ep-scrim="wspanel" data-ep-ws-picker>' +
      '<div class="ep-drawer" role="dialog" aria-label="Switch workspace">' +
        '<div class="ep-drawer__head">' +
          '<div class="ep-col ep-gap-1">' +
            '<span class="ep-t-sm ep-t-bold ep-t-head" style="font-size:14px">Workspace</span>' +
            '<span class="ep-t-3xs ep-t-muted">Signed in as ' + esc(s.email) + '</span>' +
          '</div>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close workspace panel">&times;</button>' +
        '</div>' +
        '<div class="ep-drawer__body">' +
          wsSearchHtml('ws-panel-search', 'wspanel') +
          wsListHtml() +
          wsDefaultHtml() +
        '</div>' +
        '<div class="ep-drawer__foot">' +
          '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-close>Cancel</button>' +
          '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-action="do-switch-workspace">Switch workspace</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Pulse Assistant panel */

  function assistantHtml(s, cfg) {
    var ctx = cfg.assistantCtx || copy('assistantContext', 'This view');
    return '' +
    '<div class="ep-assistant" data-ep-panel="assistant" role="dialog" aria-label="Pulse Assistant">' +
      '<div class="ep-assistant__head">' +
        '<span class="ep-assistant__mark">' + icon('spark', 15) + '</span>' +
        '<span class="ep-assistant__titles">' +
          '<span class="ep-assistant__name">Pulse Assistant</span>' +
          '<span class="ep-assistant__ctx">Answering against ' + esc(ctx) + '</span>' +
        '</span>' +
        '<button type="button" data-ep-assistant-wide aria-label="Expand panel">' + icon('expand', 13) + '</button>' +
        '<button type="button" data-ep-close aria-label="Close assistant" style="font-size:15px;line-height:1">&times;</button>' +
      '</div>' +
      '<div class="ep-assistant__stream" data-ep-assistant-stream>' +
        '<div class="ep-bubble">Morning, ' + esc(s.firstName) + '. Ask me about any metric and I&rsquo;ll chart it against your current filters.</div>' +
        '<div class="ep-bubble ep-bubble--me">Why did on-time delivery drop?</div>' +
        '<div class="ep-bubble ep-bubble--rich">' +
          '<span>' + copy('assistantAnswer', 'A short answer about the metric you asked for, with the chart it is drawn from.') + '</span>' +
          '<div class="ep-bubble__card">' +
            '<div class="ep-bubble__card-head">' +
              '<span class="ep-bubble__card-title">On-Time Delivery</span>' +
              '<span class="ep-bubble__card-meta">' + esc(copy('assistantCardMeta', 'Current period')) + '</span>' +
            '</div>' +
            '<div class="ep-chart" style="height:70px">' +
              '<svg viewBox="0 0 300 70" fill="none" preserveAspectRatio="none" aria-label="On-Time Delivery over the last twelve days, crossing the 90 percent target and settling at 87.0">' +
                '<line x1="0" y1="34.0" x2="300" y2="34.0" stroke="var(--ep-chart-label)" stroke-width="1" stroke-dasharray="5 4"/>' +
                '<path d="M0.0,24.9C3.6,24.4 19.7,20.8 26.9,21.0C34.1,21.2 46.6,25.0 53.8,26.2C61.0,27.4 73.6,28.5 80.7,30.1C87.9,31.7 100.5,37.5 107.6,37.9C114.8,38.3 127.4,34.6 134.5,33.4C141.7,32.1 154.3,28.9 161.5,28.8C168.6,28.7 181.2,31.2 188.4,32.7C195.5,34.2 208.1,38.1 215.3,39.9C222.4,41.6 235.0,44.4 242.2,45.7C249.4,47.0 261.9,48.6 269.1,49.6C276.3,50.6 292.4,53.0 296.0,53.5" stroke="var(--ep-chart-1)" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
                '<circle cx="296.0" cy="53.5" r="3.4" fill="var(--ep-chart-1)"/>' +
              '</svg>' +
            '</div>' +
            '<div class="ep-bubble__card-actions">' +
              (route('drilldown')
                ? '<a class="ep-btn ep-btn--xs ep-btn--primary" href="' + esc(route('drilldown')) + '">Open drill-down</a>'
                : '') +
              '<button class="ep-btn ep-btn--xs ep-btn--ghost" type="button" data-ep-action="pin">Pin to dashboard</button>' +
              '<button class="ep-btn ep-btn--xs ep-btn--ghost" type="button" data-ep-action="share">Share</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ep-typing" data-ep-typing><span></span><span></span><span></span></div>' +
      '</div>' +
      '<div class="ep-assistant__foot">' +
        '<div class="ep-assistant__quick">' +
          '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-quick>Output vs plan today</button>' +
          '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-quick>Worst line this week</button>' +
          '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-quick>Share with PPC</button>' +
        '</div>' +
        '<form class="ep-assistant__composer" data-ep-assistant-form>' +
          '<input type="text" placeholder="Ask about any metric…" aria-label="Ask about any metric">' +
          '<button class="ep-assistant__send" type="submit" aria-label="Send">' + icon('send', 13) + '</button>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  /* Filters drawer */

  function filtersHtml() {
    var lines = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].map(function (l) {
      return '<button class="ep-chip ep-chip--sm ep-chip--active" type="button" data-ep-toggle-chip>' + l + '</button>';
    }).join('');

    return '' +
    '<div class="ep-scrim ep-scrim--right" data-ep-scrim="filters">' +
      '<div class="ep-drawer" role="dialog" aria-label="Filters">' +
        '<div class="ep-drawer__head">' +
          '<div class="ep-col ep-gap-1">' +
            '<span class="ep-t-sm ep-t-bold ep-t-head" style="font-size:14px">Filters</span>' +
            '<span class="ep-t-3xs ep-t-muted">' + esc(copy('filtersSummary', 'Filters applied')) + '</span>' +
          '</div>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close filters">&times;</button>' +
        '</div>' +
        '<div class="ep-drawer__body">' +
          '<div class="ep-filter-group">' +
            '<span class="ep-eyebrow">Saved views</span>' +
            '<div class="ep-filter-group__opts">' +
              '<button class="ep-chip ep-chip--xs ep-chip--active" type="button" data-ep-radio-chip="view">My unit, this month</button>' +
              '<button class="ep-chip ep-chip--xs ep-chip--outline" type="button" data-ep-radio-chip="view">Late orders only</button>' +
              '<button class="ep-chip ep-chip--xs ep-chip--dashed" type="button" data-ep-action="save-view">+ Save current</button>' +
            '</div>' +
          '</div>' +

          '<div class="ep-filter-group">' +
            '<div class="ep-filter-group__head">' +
              '<span class="ep-filter-group__title">Period</span>' +
              '<span class="ep-filter-group__count">1 applied</span>' +
            '</div>' +
            '<div class="ep-row ep-gap-2">' +
              datebtn('2026-12-01', 'period', 'start', 'Period start') +
              datebtn('2026-12-18', 'period', 'end', 'Period end') +
            '</div>' +
            '<div class="ep-filter-group__opts">' +
              '<button class="ep-chip ep-chip--sm ep-chip--active" type="button" data-ep-radio-chip="cmp">vs previous period</button>' +
              '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-radio-chip="cmp">vs last year</button>' +
              '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-radio-chip="cmp">vs target</button>' +
            '</div>' +
          '</div>' +

          '<div class="ep-filter-group">' +
            '<div class="ep-filter-group__head">' +
              '<span class="ep-filter-group__title">Unit</span>' +
              '<span class="ep-filter-group__count">1 of 3</span>' +
            '</div>' +
            '<div class="ep-col ep-gap-3">' +
              checkRow(copy('filterScopeOption', 'This scope'), true) +
              checkRow('Unit 1 — Fabrication', false) +
              checkRow('Unit 3 — Sub-assembly', false) +
            '</div>' +
          '</div>' +

          '<div class="ep-filter-group">' +
            '<div class="ep-filter-group__head">' +
              '<span class="ep-filter-group__title">Line</span>' +
              '<span class="ep-filter-group__count">6 of 6</span>' +
            '</div>' +
            '<div class="ep-filter-group__opts">' + lines + '</div>' +
          '</div>' +

          '<div class="ep-filter-group">' +
            '<span class="ep-filter-group__title">Customer</span>' +
            '<button class="ep-input" type="button" data-ep-menu="customers" aria-expanded="false">' +
              '<span data-ep-menu-label>All 11 customers</span>' +
              '<span class="ep-input__caret">&#9662;</span>' +
            '</button>' +
          '</div>' +

          '<div class="ep-filter-group">' +
            '<span class="ep-filter-group__title">Shift</span>' +
            '<div class="ep-filter-group__opts">' +
              '<button class="ep-chip ep-chip--sm ep-chip--active" type="button" data-ep-toggle-chip>A</button>' +
              '<button class="ep-chip ep-chip--sm ep-chip--active" type="button" data-ep-toggle-chip>B</button>' +
              '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-toggle-chip>C</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ep-drawer__foot">' +
          '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-action="reset-filters">Reset all</button>' +
          '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-close data-ep-action="apply-filters">Apply</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /** a date-picker trigger; ep-datepicker.js fills the label from the value */
  function datebtn(value, group, role, name, mode) {
    return '<button class="ep-input" type="button" data-ep-date data-ep-date-value="' + value + '"' +
           (group ? ' data-ep-date-group="' + group + '" data-ep-date-role="' + role + '"' : '') +
           (mode ? ' data-ep-date-mode="' + mode + '"' : '') +
           ' data-ep-date-name="' + esc(name) + '" aria-expanded="false" aria-label="' + esc(name) + '">' +
             '<span data-ep-date-label></span>' +
             '<span class="ep-input__caret">' + icon('calendar', 13) + '</span>' +
           '</button>';
  }

  /** a single-select menu trigger styled as an input */
  function selectbtn(menu, label, extra) {
    return '<button class="ep-input' + (extra ? ' ' + extra : '') + '" type="button" data-ep-menu="' + menu + '"' +
           ' aria-expanded="false">' +
             '<span data-ep-menu-label>' + esc(label) + '</span>' +
             '<span class="ep-input__caret">&#9662;</span>' +
           '</button>';
  }

  function checkRow(label, on) {
    return '<button class="ep-check ep-check--sm' + (on ? ' ep-is-on' : '') + '" type="button" data-ep-check>' +
             '<span class="ep-check__box">' + icon('check-thick', 9) + '</span>' +
             '<span class="ep-check__label">' + label + '</span>' +
           '</button>';
  }

  function checkRowMd(label, on) {
    return '<button class="ep-check' + (on ? ' ep-is-on' : '') + '" type="button" data-ep-check>' +
             '<span class="ep-check__box">' + icon('check-thick', 10) + '</span>' +
             '<span class="ep-check__label">' + label + '</span>' +
           '</button>';
  }

  /* Subscribe & Schedule

     The specification's own note is that editing a schedule reuses this modal from
     the distribution center, so it is built once here and opened from three places: Subscribe
     on a report, New delivery on the distribution center, and Edit schedule on a the distribution center row.
     Pages name what is being scheduled with <body data-ep-schedule-subject>. */

  function scheduleHtml(subject) {
    return '' +
    '<div class="ep-scrim" data-ep-scrim="schedule">' +
      '<div class="ep-modal ep-modal--md" role="dialog" aria-label="Subscribe and schedule">' +
        '<div class="ep-modal__head">' +
          '<div class="ep-modal__titles">' +
            '<span class="ep-modal__title">Subscribe &amp; schedule</span>' +
            '<span class="ep-modal__sub" data-ep-schedule-subject>' + esc(subject) + '</span>' +
          '</div>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ep-modal__body">' +
          '<div class="ep-row ep-gap-4 ep-row--wrap">' +
            '<div class="ep-field"><span class="ep-field__label">Frequency</span>' +
              selectbtn('frequency', 'Daily', 'ep-input--lg') + '</div>' +
            '<div class="ep-field"><span class="ep-field__label">Send at</span>' +
              selectbtn('sendtime', '07:00', 'ep-input--lg') + '</div>' +
          '</div>' +
          '<div class="ep-field"><span class="ep-field__label">Timezone</span>' +
            selectbtn('timezone', 'Asia/Dhaka (GMT+6)') + '</div>' +
          '<div class="ep-row ep-gap-4 ep-row--wrap">' +
            '<div class="ep-field"><span class="ep-field__label">Starts</span>' +
              datebtn('2026-12-19', 'sched', 'start', 'Schedule starts') + '</div>' +
            '<div class="ep-field"><span class="ep-field__label">Ends</span>' +
              datebtn('2027-03-31', 'sched', 'end', 'Schedule ends') + '</div>' +
          '</div>' +
          '<div class="ep-row ep-gap-4 ep-row--wrap">' +
            '<div class="ep-field"><span class="ep-field__label">Recipients</span>' +
              selectbtn('recipients', copy('scheduleRecipients', 'No recipients'), 'ep-input--lg') + '</div>' +
            '<div class="ep-field"><span class="ep-field__label">Format</span>' +
              selectbtn('sendformat', 'PDF', 'ep-input--lg') + '</div>' +
          '</div>' +
          '<div class="ep-field"><span class="ep-field__label">Channels</span>' +
            selectbtn('channels', 'In-app, email') + '</div>' +
          /* the two suppression rules — the specification's answer to inbox fatigue,
             the same idea the alert-rule builder solves with a sustained-for window */
          '<div class="ep-col ep-gap-4">' +
            '<span class="ep-field__label">Only send when it is worth sending</span>' +
            checkRowMd('Only send if the data changed since the last run', true) +
            checkRowMd('Only send if a threshold was breached', false) +
            checkRowMd('Skip the send if the report returns no rows', true) +
          '</div>' +
          '<div class="ep-field">' +
            '<label class="ep-field__label" for="sched-name">Schedule name</label>' +
            '<span class="ep-input"><input id="sched-name" type="text" value="Delivery Risk — daily 07:00"></span>' +
          '</div>' +
          '<p class="ep-note">Next run <strong class="ep-t-body">tomorrow 07:00</strong>, then every weekday morning. ' +
            'Recipients who lose access to the report stop receiving it automatically.</p>' +
          '<div class="ep-modal__foot">' +
            '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-close>Cancel</button>' +
            '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-action="save-schedule">Save schedule</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Delivery history drawer

     Per schedule rather than the whole log: the History tab answers "what
     has Pulse sent", this answers "is this one schedule healthy". Which is
     why it leads with the run list and puts the failure reason inline, next
     to the retry that fixes it. */

  /* Each row on the distribution center declares its own schedule with data-sched-* , and the
     drawer builds its run list from that when it opens. Doing it this way
     rather than hard-coding one history means the header, the recipient
     counts and the failure narrative all belong to the schedule you clicked
     — a 6-person weekly does not claim "18 of 18", and only the schedule
     that actually has a bounced address shows one. */
  var RUN_DATES = ['18 Dec', '17 Dec', '16 Dec', '15 Dec', '12 Dec', '11 Dec'];
  /* open rate per run, so the counts the drawer shows are derived rather
     than invented — the History tab's rows are written from these same
     numbers, which is what keeps the two surfaces agreeing */
  var RUN_OPEN_MIX = [0.667, 0.778, 0.647, 0.529, 0.833, 0.722];

  function scheduleFromTrigger(trigger) {
    var row = trigger && trigger.closest ? trigger.closest('[data-ep-sched-name]') : null;
    if (!row) {
      return { name: 'Delivery Risk — daily 07:00', at: '07:00', size: 18, fails: true };
    }
    return {
      name: row.getAttribute('data-ep-sched-name'),
      at: row.getAttribute('data-ep-sched-at') || '07:00',
      size: parseInt(row.getAttribute('data-ep-sched-size'), 10) || 1,
      skips: parseInt(row.getAttribute('data-ep-sched-skips'), 10) || 0,
      fails: row.getAttribute('data-ep-sched-fails') === 'true'
    };
  }

  var BOUNCE = copy('bounceAddress', 'recipient@example.com');

  function runsFor(sc) {
    return RUN_DATES.map(function (date, i) {
      // the alert-rule builder reports this address bouncing on the last three sends, so the
      // three failures are the three most recent runs
      var failed = sc.fails && i < 3;
      var sent = sc.size - sc.skips - (failed ? 1 : 0);
      return {
        when: date + ' · ' + sc.at,
        ok: !failed,
        sent: sent + ' of ' + sc.size,
        opens: Math.max(1, Math.round(sent * RUN_OPEN_MIX[i])) + ' opened',
        why: !failed
          ? (sc.skips
              ? sc.skips + ' recipient skipped — no longer has access to the item.'
              : null)
          : i === 0
            ? 'Same address bounced. Third consecutive failure, so Pulse has stopped retrying it.'
            : 'Email to ' + BOUNCE + ' bounced — mailbox full. The other ' + (sc.size - 1) + ' sends landed.'
      };
    });
  }

  function runRowHtml(r) {
    return '<div class="ep-run-row' + (r.ok ? '' : ' ep-run-row--failed') + '">' +
      '<div class="ep-run-row__head">' +
        '<span class="ep-run-row__when">' + esc(r.when) + '</span>' +
        (r.ok ? '<span class="ep-badge ep-badge--status-quiet">Delivered</span>'
              : '<span class="ep-badge ep-badge--severity">Failed</span>') +
      '</div>' +
      '<span class="ep-run-row__meta">' + esc(r.sent) + ' · ' + esc(r.opens) + '</span>' +
      (r.why ? '<p class="ep-run-row__why">' + esc(r.why) + '</p>' +
               (r.ok ? ''
                     : '<button class="ep-btn ep-btn--xs ep-btn--ghost" type="button" data-ep-action="retry-delivery">Retry this send</button>')
             : '') +
    '</div>';
  }

  /** repoint the drawer at the schedule whose History button was clicked */
  function fillDeliveryHistory(trigger) {
    var sc = scheduleFromTrigger(trigger);
    var runs = runsFor(sc);
    var failed = runs.filter(function (r) { return !r.ok; }).length;
    var sends = runs.reduce(function (n, r) { return n + parseInt(r.sent, 10); }, 0);
    var opens = runs.reduce(function (n, r) { return n + parseInt(r.opens, 10); }, 0);

    function put(sel, text) {
      var el = document.querySelector('[data-ep-scrim="delivhistory"] ' + sel);
      if (el) { el.textContent = text; }
    }
    put('[data-ep-history-subject]', sc.name);
    put('[data-ep-history-runs]', String(runs.length - failed));
    put('[data-ep-history-runs-note]', 'delivered of ' + runs.length + (failed ? ' · ' + failed + ' failed' : ''));
    put('[data-ep-history-opens]', Math.round(opens / sends * 100) + '%');

    var list = document.querySelector('[data-ep-scrim="delivhistory"] [data-ep-run-list]');
    if (list) { list.innerHTML = runs.map(runRowHtml).join(''); }
  }

  function deliveryHistoryHtml() {
    return '' +
    '<div class="ep-scrim ep-scrim--right" data-ep-scrim="delivhistory">' +
      '<div class="ep-drawer" role="dialog" aria-label="Delivery history">' +
        '<div class="ep-drawer__head">' +
          '<div class="ep-col ep-gap-1">' +
            '<span class="ep-t-sm ep-t-bold ep-t-head" style="font-size:14px">Delivery history</span>' +
            '<span class="ep-t-3xs ep-t-muted" data-ep-history-subject></span>' +
          '</div>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close delivery history">&times;</button>' +
        '</div>' +
        '<div class="ep-drawer__body">' +
          '<div class="ep-grid ep-grid--2">' +
            '<div class="ep-stat ep-stat--snug">' +
              '<span class="ep-stat__label">Recent runs</span>' +
              '<span class="ep-stat__value" data-ep-history-runs></span>' +
              '<span class="ep-stat__note" data-ep-history-runs-note></span>' +
            '</div>' +
            '<div class="ep-stat ep-stat--snug">' +
              '<span class="ep-stat__label">Open rate</span>' +
              '<span class="ep-stat__value" data-ep-history-opens></span>' +
              '<span class="ep-stat__note">across these runs</span>' +
            '</div>' +
          '</div>' +
          '<div class="ep-col ep-gap-3" data-ep-run-list></div>' +
        '</div>' +
        '<div class="ep-drawer__foot">' +
          '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-close>Close</button>' +
          '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-action="run-now">Run now</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Export */

  function exportHtml(subject) {
    var formats = [
      ['PDF', 'document', true], ['Excel', 'rows', false], ['CSV', 'raw', false],
      ['PNG', 'chart', false], ['PPT', 'dashboard', false]
    ].map(function (f) {
      return '<button class="ep-gallery-card' + (f[2] ? ' ep-is-active' : '') + '" type="button" data-ep-radio-card="format">' +
               '<span class="ep-t-2xs ep-t-bold ' + (f[2] ? 'ep-t-head' : 'ep-t-body') + '">' + f[0] + '</span>' +
               '<span>' + f[1] + '</span>' +
             '</button>';
    }).join('');

    return '' +
    '<div class="ep-scrim" data-ep-scrim="export">' +
      '<div class="ep-modal ep-modal--sm" role="dialog" aria-label="Export">' +
        '<div class="ep-modal__head">' +
          '<div class="ep-modal__titles">' +
            '<span class="ep-modal__title">Export</span>' +
            '<span class="ep-modal__sub" data-ep-export-subject>' + esc(subject) + '</span>' +
          '</div>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ep-modal__body">' +
          '<div class="ep-form-grid ep-form-grid--gallery" style="grid-template-columns:repeat(5,minmax(0,1fr))">' + formats + '</div>' +
          '<div class="ep-row ep-gap-4 ep-row--wrap">' +
            '<div class="ep-field">' +
              '<span class="ep-field__label">Page size</span>' +
              selectbtn('pagesize', 'A4') +
            '</div>' +
            '<div class="ep-field">' +
              '<span class="ep-field__label">Orientation</span>' +
              '<div class="ep-row ep-gap-2">' +
                '<button class="ep-btn ep-btn--sm ep-btn--primary" style="flex:1" type="button" data-ep-radio-btn="orient">Landscape</button>' +
                '<button class="ep-btn ep-btn--sm ep-btn--ghost" style="flex:1" type="button" data-ep-radio-btn="orient">Portrait</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="ep-col ep-gap-4">' +
            checkRowMd('Include charts', true) +
            checkRowMd('Include filter summary', true) +
            checkRowMd('Include root-cause notes', true) +
          '</div>' +
          '<p class="ep-note">Table exports are capped at 100,000 rows. This finding has 6 contributor rows and 3 charts.</p>' +
          '<div class="ep-modal__foot">' +
            '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-close>Cancel</button>' +
            '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-action="do-export">Export</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Add Chart Tile */

  function addTileHtml() {
    var forms = [
      ['Column', '<rect x="2" y="12" width="7" height="12" fill="var(--ep-chart-3)"/><rect x="12" y="6" width="7" height="18" fill="var(--ep-chart-3)"/><rect x="22" y="14" width="7" height="10" fill="var(--ep-chart-3)"/><rect x="32" y="4" width="7" height="20" fill="var(--ep-chart-3)"/>', false],
      ['Line', '<polyline points="2,20 12,12 22,16 32,6 40,9" stroke="var(--ep-chart-1)" stroke-width="2" fill="none"/>', true],
      ['Pareto', '<rect x="2" y="6" width="7" height="18" fill="var(--ep-chart-3)"/><rect x="12" y="11" width="7" height="13" fill="var(--ep-chart-3)"/><rect x="22" y="15" width="7" height="9" fill="var(--ep-chart-3)"/><polyline points="5,14 15,8 25,5 38,3" stroke="var(--ep-chart-2)" stroke-width="1.6" fill="none"/>', false],
      ['Waterfall', '<rect x="2" y="8" width="7" height="16" fill="var(--ep-chart-5)"/><rect x="12" y="6" width="7" height="5" fill="var(--ep-chart-2)"/><rect x="22" y="12" width="7" height="5" fill="var(--ep-chart-1)"/><rect x="32" y="14" width="7" height="10" fill="var(--ep-chart-6)"/>', false],
      ['Ranked bar', '<rect x="2" y="4" width="26" height="5" fill="var(--ep-chart-3)"/><rect x="2" y="12" width="18" height="5" fill="var(--ep-chart-3)"/><rect x="2" y="20" width="12" height="5" fill="var(--ep-chart-3)"/>', false],
      ['Donut', '<circle cx="21" cy="13" r="9" fill="none" stroke="var(--ep-chart-3)" stroke-width="5" stroke-dasharray="38 18"/>', false],
      ['Heat calendar', '<rect x="2" y="6" width="8" height="6" fill="var(--ep-chart-4)"/><rect x="12" y="6" width="8" height="6" fill="var(--ep-chart-1)"/><rect x="22" y="6" width="8" height="6" fill="var(--ep-chart-3)"/><rect x="32" y="6" width="8" height="6" fill="var(--ep-chart-6)"/><rect x="2" y="15" width="8" height="6" fill="var(--ep-chart-3)"/><rect x="12" y="15" width="8" height="6" fill="var(--ep-chart-4)"/><rect x="22" y="15" width="8" height="6" fill="var(--ep-chart-6)"/><rect x="32" y="15" width="8" height="6" fill="var(--ep-chart-1)"/>', false]
    ].map(function (f) {
      return '<button class="ep-gallery-card' + (f[2] ? ' ep-is-active' : '') + '" type="button" data-ep-radio-card="chartform">' +
               '<svg width="42" height="26" viewBox="0 0 42 26" fill="none" aria-hidden="true">' + f[1] + '</svg>' +
               '<span>' + f[0] + '</span>' +
             '</button>';
    }).join('');

    return '' +
    '<div class="ep-scrim" data-ep-scrim="addtile">' +
      '<div class="ep-modal ep-modal--lg" role="dialog" aria-label="Add chart tile">' +
        '<div class="ep-modal__head">' +
          '<span class="ep-modal__title">Add chart tile</span>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ep-modal__split">' +
          '<div class="ep-modal__split-main">' +
            '<div class="ep-col ep-gap-3">' +
              '<span class="ep-eyebrow">Source</span>' +
              '<div class="ep-row ep-gap-2">' +
                '<button class="ep-chip ep-chip--xs ep-chip--active" type="button" data-ep-radio-chip="src">Metric catalogue</button>' +
                '<button class="ep-chip ep-chip--xs ep-chip--outline" type="button" data-ep-radio-chip="src">Report</button>' +
              '</div>' +
              selectbtn('sources', 'On-Time Delivery %') +
            '</div>' +
            '<div class="ep-col ep-gap-4">' +
              '<span class="ep-eyebrow">Chart form</span>' +
              '<div class="ep-form-grid ep-form-grid--gallery">' + forms +
                '<button class="ep-gallery-card" type="button" data-ep-radio-card="chartform">' +
                  '<span class="ep-t-lg ep-t-bold" style="color:var(--ep-chart-label)">87%</span><span>KPI tile</span>' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div class="ep-row ep-gap-4">' +
              '<div class="ep-field"><span class="ep-field__label">Dimension</span>' + selectbtn('dimensions', 'Week') + '</div>' +
              '<div class="ep-field"><span class="ep-field__label">Measure</span>' + selectbtn('measures', 'OTD %') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="ep-modal__split-side">' +
            '<span class="ep-eyebrow">Live preview</span>' +
            '<div class="ep-card ep-card--snug">' +
              '<span class="ep-t-sm ep-t-bold ep-t-head">On-Time Delivery &mdash; weekly</span>' +
              '<div class="ep-chart" style="height:96px">' +
                '<svg viewBox="0 0 280 96" fill="none" preserveAspectRatio="none" aria-label="Preview: On-Time Delivery by week, falling through the 90 percent target">' +
                  '<line x1="4" y1="47.0" x2="276" y2="47.0" stroke="var(--ep-chart-label)" stroke-width="1" stroke-dasharray="5 4"/>' +
                  '<path d="M6.0,17.3C11.8,18.6 37.8,24.4 49.3,27.2C60.9,29.9 81.1,34.6 92.7,37.9C104.2,41.2 124.4,48.3 136.0,51.9C147.6,55.6 167.8,62.5 179.3,65.2C190.9,67.8 211.1,70.4 222.7,71.8C234.2,73.1 260.2,74.6 266.0,75.1" stroke="var(--ep-chart-1)" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
                  '<circle cx="266.0" cy="75.1" r="3.4" fill="var(--ep-chart-1)"/>' +
                '</svg>' +
              '</div>' +
              '<span class="ep-t-3xs ep-t-muted">Target line at 90% &middot; threshold colours on</span>' +
            '</div>' +
            '<div class="ep-field">' +
              '<span class="ep-field__label">Tile title</span>' +
              '<input class="ep-input" type="text" value="On-Time Delivery — weekly" data-ep-addtile-title aria-label="Tile title">' +
            '</div>' +
            '<div class="ep-modal__foot ep-modal__foot--bare">' +
              '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-close>Cancel</button>' +
              '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-action="do-addtile">Add tile</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Run Report / Parameters */

  function runHtml(report) {
    return '' +
    '<div class="ep-scrim" data-ep-scrim="run">' +
      '<div class="ep-modal ep-modal--md" role="dialog" aria-label="Run report">' +
        '<div class="ep-modal__head">' +
          '<div class="ep-modal__titles">' +
            '<span class="ep-modal__title">Run <span data-ep-run-report>' + esc(report) + '</span></span>' +
            '<span class="ep-modal__sub">Estimated run time 40 seconds</span>' +
          '</div>' +
          '<button class="ep-close-x" type="button" data-ep-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ep-modal__body">' +
          '<div class="ep-row ep-gap-3 ep-row--wrap">' +
            '<span class="ep-eyebrow">Recently used</span>' +
            '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-radio-chip="recent">' + esc(copy('runRecentChip', 'Most recent')) + '</button>' +
            '<button class="ep-chip ep-chip--sm ep-chip--outline" type="button" data-ep-radio-chip="recent">All units &middot; this month</button>' +
          '</div>' +
          '<div class="ep-row ep-gap-4 ep-row--wrap">' +
            '<div class="ep-field"><span class="ep-field__label">Ship week from</span>' +
              datebtn('2026-12-15', 'shipweek', 'start', 'Ship week from', 'week') + '</div>' +
            '<div class="ep-field"><span class="ep-field__label">Ship week to</span>' +
              datebtn('2027-02-08', 'shipweek', 'end', 'Ship week to', 'week') + '</div>' +
          '</div>' +
          '<div class="ep-row ep-gap-4 ep-row--wrap">' +
            '<div class="ep-field"><span class="ep-field__label">Unit</span>' + selectbtn('unit', copy('runParamUnit', 'All'), 'ep-input--lg') + '</div>' +
            '<div class="ep-field"><span class="ep-field__label">Lines</span>' + selectbtn('lines', 'All 6 lines', 'ep-input--lg') + '</div>' +
          '</div>' +
          '<div class="ep-row ep-gap-4 ep-row--wrap">' +
            '<div class="ep-field"><span class="ep-field__label">Customer</span>' + selectbtn('customers', copy('runParamCustomer', 'All'), 'ep-input--lg') + '</div>' +
            '<div class="ep-field"><span class="ep-field__label">Risk threshold</span>' +
              '<button class="ep-input ep-input--lg" type="button" data-ep-menu="risk" aria-expanded="false" style="border-color:var(--ep-accent-secondary)">' +
                '<span data-ep-menu-label>Medium and above</span><span class="ep-input__caret">&#9662;</span>' +
              '</button></div>' +
          '</div>' +
          '<div class="ep-col ep-gap-4">' +
            '<span class="ep-field__label">Output</span>' +
            '<div class="ep-row ep-gap-2">' +
              '<button class="ep-btn ep-btn--sm ep-btn--primary" type="button" data-ep-radio-btn="target">Open in viewer</button>' +
              '<button class="ep-btn ep-btn--sm ep-btn--ghost" type="button" data-ep-radio-btn="target">Export file</button>' +
            '</div>' +
          '</div>' +
          '<div class="ep-col ep-gap-4">' +
            checkRowMd('Save these parameters as a view', true) +
            checkRowMd('Also share when ready', false) +
          '</div>' +
          '<div class="ep-modal__foot">' +
            '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-close>Cancel</button>' +
            '<button class="ep-btn ep-btn--primary ep-btn--stack-wide" type="button" data-ep-action="do-run">Run</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Toasts & progress */

  function toast(opt) {
    var dock = document.querySelector('[data-ep-toast-dock]');
    if (!dock) { return; }
    var el = document.createElement('div');
    var kind = opt.kind || 'plain';

    if (kind === 'progress') {
      el.className = 'ep-toast ep-toast--progress ep-toast--accent';
      el.innerHTML =
        '<div class="ep-toast__row">' +
          '<span class="ep-toast__title">' + esc(opt.title) + '</span>' +
          '<span class="ep-toast__meta">' + (opt.pct || 0) + '%</span>' +
        '</div>' +
        '<div class="ep-progress"><div class="ep-progress__fill" style="width:' + (opt.pct || 0) + '%"></div></div>';
    } else if (kind === 'ready') {
      el.className = 'ep-toast ep-toast--accent';
      el.innerHTML =
        '<span class="ep-toast__icon">' + icon('check', 13) + '</span>' +
        '<span class="ep-toast__text">' +
          '<span class="ep-toast__title">' + esc(opt.title) + '</span>' +
          (opt.meta ? '<span class="ep-toast__meta">' + esc(opt.meta) + '</span>' : '') +
        '</span>' +
        ctaHtml(opt);
    } else if (kind === 'warn') {
      el.className = 'ep-toast ep-toast--warn';
      el.innerHTML =
        '<span class="ep-toast__icon ep-toast__icon--warn">' + icon('alert', 13) + '</span>' +
        '<span class="ep-toast__text">' +
          '<span class="ep-toast__title">' + esc(opt.title) + '</span>' +
          (opt.meta ? '<span class="ep-toast__meta">' + esc(opt.meta) + '</span>' : '') +
        '</span>' +
        ctaHtml(opt);
    } else {
      el.className = 'ep-toast';
      el.innerHTML =
        '<span class="ep-toast__title ep-grow">' + esc(opt.title) + '</span>' + ctaHtml(opt);
    }

    dock.appendChild(el);

    // an Undo-style callback on the toast's own action
    if (typeof opt.onCta === 'function') {
      var ctaEl = el.querySelector('.ep-toast__cta');
      if (ctaEl) {
        ctaEl.addEventListener('click', function (ev) {
          ev.preventDefault();
          opt.onCta();
          el.remove();
        });
      }
    }

    // progress toasts advance to their "ready" state, matching the
    // "Running report… → Report ready" pair the design source shows
    if (kind === 'progress' && opt.title) {
      var pct = opt.pct || 0;
      var bar = el.querySelector('.ep-progress__fill');
      var num = el.querySelector('.ep-toast__meta');
      var tick = setInterval(function () {
        pct = Math.min(100, pct + 12);
        if (bar) { bar.style.width = pct + '%'; }
        if (num) { num.textContent = pct + '%'; }
        if (pct >= 100) {
          clearInterval(tick);
          el.remove();
          toast({ kind: 'ready', title: opt.doneTitle || 'Ready', meta: opt.doneMeta, cta: opt.doneCta, href: opt.doneHref, ttl: 5000 });
        }
      }, 420);
      return el;
    }

    var ttl = opt.ttl == null ? 4200 : opt.ttl;
    if (ttl > 0) { setTimeout(function () { el.remove(); }, ttl); }
    return el;
  }

  function ctaHtml(opt) {
    if (!opt.cta) { return ''; }
    return opt.href
      ? '<a class="ep-toast__cta" href="' + esc(opt.href) + '">' + esc(opt.cta) + '</a>'
      : '<button class="ep-toast__cta" type="button" data-ep-close-toast>' + esc(opt.cta) + '</button>';
  }

  /* open / close */

  var PANELS = {
    account:   { sel: '[data-ep-layer="account"]',  cls: 'ep-is-open', anchored: true },
    assistant: { sel: '[data-ep-panel="assistant"]', cls: 'ep-is-open' },
    filters:   { sel: '[data-ep-scrim="filters"]',  cls: 'ep-is-open', locks: true },
    export:    { sel: '[data-ep-scrim="export"]',   cls: 'ep-is-open', locks: true },
    addtile:   { sel: '[data-ep-scrim="addtile"]',  cls: 'ep-is-open', locks: true },
    run:       { sel: '[data-ep-scrim="run"]',      cls: 'ep-is-open', locks: true },
    workspace: { sel: '[data-ep-scrim="workspace"]', cls: 'ep-is-open', locks: true },
    wspanel:   { sel: '[data-ep-scrim="wspanel"]',   cls: 'ep-is-open', locks: true },
    schedule:  { sel: '[data-ep-scrim="schedule"]',  cls: 'ep-is-open', locks: true },
    delivhistory: { sel: '[data-ep-scrim="delivhistory"]', cls: 'ep-is-open', locks: true }
  };

  function open(name, trigger) {
    var p = PANELS[name];
    if (!p) { return; }
    if (openName && openName !== name) { close(openName); }
    var el = document.querySelector(p.sel);
    if (!el) { return; }

    lastTrigger = trigger || null;

    if (p.anchored && trigger) { placePopover(el.querySelector('[data-ep-popover]'), trigger); }
    el.classList.add(p.cls);
    if (p.locks) { document.body.classList.add('ep-is-locked'); }
    openName = name;

    if (name === 'account') { syncThemeSwitch(); }
    if (name === 'delivhistory') { fillDeliveryHistory(trigger); }

    /* The trapped element is the panel, not the scrim around it. Guarded on
       the global: without ep-dialog.js the dialog still opens and still
       takes focus, it just does not hold it. */
    var panel = el.querySelector('.ep-modal, .ep-drawer, [data-ep-popover]') || el;
    if (global.EpicPulse && global.EpicPulse.dialog) {
      global.EpicPulse.dialog.trap(panel, trigger || null);
    } else {
      var focusable = el.querySelector('input, button, a');
      if (focusable && name !== 'account') { setTimeout(function () { focusable.focus(); }, 60); }
    }
  }

  function close(name) {
    name = name || openName;
    var p = PANELS[name];
    if (!p) { return; }
    var el = document.querySelector(p.sel);
    if (el) { el.classList.remove(p.cls); }
    if (p.locks) { document.body.classList.remove('ep-is-locked'); }
    if (openName === name) { openName = null; }
    if (global.EpicPulse && global.EpicPulse.dialog) {
      global.EpicPulse.dialog.release();   /* returns focus to the opener */
      lastTrigger = null;
    } else if (lastTrigger && lastTrigger.focus) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  }

  function placePopover(pop, trigger) {
    if (!pop || !trigger) { return; }
    var r = trigger.getBoundingClientRect();
    var w = 340;
    var left = Math.min(r.left, global.innerWidth - w - 12);
    pop.style.left = Math.max(12, left) + 'px';
    // prefer above the trigger (the account block sits at the sidebar bottom)
    pop.style.top = 'auto';
    pop.style.bottom = Math.max(12, global.innerHeight - r.top + 8) + 'px';
  }

  function syncThemeSwitch() {
    var pref = mod('theme').pref();
    document.querySelectorAll('[data-ep-theme-set]').forEach(function (b) {
      b.classList.toggle('ep-is-active', b.getAttribute('data-ep-theme-set') === pref);
    });
  }

  /* render + wire */

  function render(mountEl, session, cfg) {
    if (!mountEl) { return; }
    var subject = document.body.getAttribute('data-ep-export-subject') ||
                  copy('exportSubject', 'This view');
    var report = document.body.getAttribute('data-ep-run-report') || copy('reportName', 'Your report');
    var sched = document.body.getAttribute('data-ep-schedule-subject') ||
                copy('scheduleSubject', 'Your report');

    var host = document.createElement('div');
    host.setAttribute('data-ep-overlay-root', '');
    host.innerHTML =
      accountHtml(session) +
      workspaceHtml(session) +
      workspacePanelHtml(session) +
      assistantHtml(session, cfg) +
      filtersHtml() +
      exportHtml(subject) +
      addTileHtml() +
      runHtml(report) +
      scheduleHtml(sched) +
      deliveryHistoryHtml() +
      '<div class="ep-toast-dock" data-ep-toast-dock aria-live="polite" aria-atomic="false"></div>';

    mountEl.parentNode.replaceChild(host, mountEl);
    root = host;
    wire();

    // ?overlay=assistant|filters|export|run|addtile|account deep-links an
    // overlay open, so a demo or a review can land straight on one
    var want = null;
    try { want = new URLSearchParams(global.location.search).get('overlay'); } catch (e) {}
    if (want && PANELS[want]) {
      var anchor = want === 'account' ? document.querySelector('[data-ep-open="account"]') : null;
      setTimeout(function () { open(want, anchor); }, 0);
    }
  }

  /* Named actions.
     Most of these stand in for a Phase 4-6 overlay that has no design frame
     yet, reporting through toasts & progress instead. Returns true when handled, so the
     caller knows to preventDefault. */

  function runAction(name, el, item) {
    var label = item && item.l;

    switch (name) {
      case 'share':
        toast({ kind: 'ready', title: 'Shared with 4 recipients', meta: 'Filters travelled with it', cta: 'View', href: 'shared.html' });
        return true;
      case 'copy-link':
        toast({ title: 'Link copied' });
        return true;
      case 'pin':
        toast({ kind: 'ready', title: 'Pinned to ' + copy('pinTarget', 'your dashboard'), cta: 'Open', href: 'dashboard.html' });
        return true;
      case 'watch':
        toast({ kind: 'ready', title: 'Alert rule activated', meta: 'On-Time Delivery below 90%', cta: 'Signals', href: 'signals.html' });
        return true;
      case 'mute':
        toast({ title: 'Muted for 24 hours' });
        return true;
      case 'snooze':
        toast({ title: 'Snoozed for ' + (label || '1 hour').toLowerCase() });
        return true;
      case 'acknowledge':
        toast({ kind: 'ready', title: 'Signal acknowledged', meta: 'Recorded against ' + who() });
        return true;
      case 'do-export':
        close();
        toast({ kind: 'progress', title: 'Exporting to PDF…', pct: 34, doneTitle: 'Export ready', doneMeta: 'PDF · 3 charts · 6 rows', doneCta: 'Download' });
        return true;
      case 'do-run':
        close();
        toast({
          kind: 'progress', title: 'Running ' + copy('reportName', 'your report') + '\u2026', pct: 64,
          doneTitle: 'Report ready', doneMeta: copy('reportReadyMeta', 'Ready to open'),
          doneCta: 'Open', doneHref: 'report-viewer.html'
        });
        return true;
      case 'do-addtile':
        close();
        toast({ kind: 'ready', title: 'Tile added', meta: 'On-Time Delivery — weekly', cta: 'Undo' });
        return true;
      case 'do-switch-workspace':
        // Either picker can settle the switch, so read from whichever one is
        // open. The prototype carries a single dataset, so this reports
        // through toasts & progress rather than reloading — but the two places the
        // current workspace is named (the topbar mark and the account
        // popover) and the other picker's own selection are all brought into
        // step, or the shell would contradict the toast.
        var row = document.querySelector('[data-ep-ws-picker].ep-is-open .ep-ws-row.ep-is-selected');
        if (!row) { close(); return true; }

        var wsName = row.querySelector('.ep-ws-row__name');
        var wsMark = row.querySelector('.ep-ws-row__mark');
        if (!wsName || !wsMark) { close(); return true; }
        var full = wsName.textContent.trim();
        var mark = wsMark.textContent.trim();
        var key = row.getAttribute('data-ep-ws');
        close();

        document.querySelectorAll('[data-ep-ws-picker] .ep-ws-row[data-ep-select-row]').forEach(function (r) {
          var on = r.getAttribute('data-ep-ws') === key;
          r.classList.toggle('ep-is-selected', on);
          r.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        // the popover slot is narrow, so it takes the short tail of the name
        var short = full.replace(/^.*—\s*/, '');
        document.querySelectorAll('[data-ep-account-workspace]').forEach(function (n) { n.textContent = short; });
        document.querySelectorAll('[data-ep-workspace-mark]').forEach(function (n) {
          n.textContent = mark;
          var btn = n.closest('button');
          if (btn) { btn.setAttribute('aria-label', 'Switch workspace — currently ' + full); }
        });

        toast({ kind: 'ready', title: 'Workspace switched', meta: full, cta: 'Home', href: 'home.html' });
        return true;
      case 'download-shared':
        toast({ kind: 'progress', title: 'Preparing download\u2026', pct: 42, doneTitle: 'Download ready', doneMeta: 'PDF \u00b7 filters as shared', doneCta: 'Save' });
        return true;
      case 'mark-read-item':
        toast({ title: 'Marked as read' });
        return true;
      case 'remove-shared':
        toast({ kind: 'warn', title: 'Removed from Shared with me', meta: 'The sender still has access to the original', cta: 'Undo' });
        return true;
      case 'revoke-link':
        toast({ kind: 'warn', title: 'Link revoked', meta: 'Anyone opening it now sees a revoked notice', cta: 'Undo' });
        return true;
      case 'link-expiry':
        toast({ title: 'Expiry updated' });
        return true;
      case 'link-login':
        toast({ title: 'Sign-in is now required for this link' });
        return true;
      case 'new-link':
        toast({ kind: 'ready', title: 'Share link created', meta: 'Expires in 7 days \u00b7 sign-in required', cta: 'Copy' });
        return true;
      case 'save-schedule':
        close();
        toast({ kind: 'ready', title: 'Schedule saved', meta: 'Daily 07:00 \u00b7 18 recipients \u00b7 next run tomorrow', cta: 'Distribution', href: 'distribution.html' });
        return true;
      case 'run-now':
        close();
        toast({
          kind: 'progress', title: 'Running and sending\u2026', pct: 28,
          doneTitle: 'Delivered', doneMeta: copy('deliveredMeta', 'Sent to your recipients'),
          doneCta: 'History', doneHref: 'distribution.html?tab=history'
        });
        return true;
      case 'duplicate-schedule':
        toast({ kind: 'ready', title: 'Schedule duplicated', meta: 'Saved as a paused copy', cta: 'Edit', onCta: function () { open('schedule'); } });
        return true;
      case 'pause-schedule':
        toast({ title: 'Schedule paused', meta: 'No sends until you resume it', cta: 'Undo' });
        return true;
      case 'delete-schedule':
        toast({ kind: 'warn', title: 'Schedule deleted', meta: 'Recipients were notified that it ended', cta: 'Undo' });
        return true;
      case 'retry-delivery':
        toast({
          kind: 'progress', title: 'Retrying the failed send\u2026', pct: 40,
          doneTitle: 'Still bouncing', doneMeta: BOUNCE + '\u00b7 ask Admin to fix the address'
        });
        return true;
      case 'change-avatar':
        toast({ title: 'Photos come from your Microsoft account', meta: 'Change it in the Epic Group directory', ttl: 3200 });
        return true;
      case 'revoke-session':
        toast({ kind: 'warn', title: 'Session revoked', meta: 'That device has to sign in again', cta: 'Undo' });
        return true;
      case 'signout-everywhere':
        toast({ kind: 'warn', title: 'Signed out of 3 other sessions', meta: 'You are still signed in on this device' });
        return true;
      case 'save-view':
        toast({ title: 'View saved' });
        return true;
      case 'apply-filters':
        toast({ title: 'Filters applied' });
        return true;
      case 'reset-filters':
        toast({ title: 'Filters reset' });
        return true;
      case 'retry':
        toast({ kind: 'progress', title: 'Retrying quality inspection sync…', pct: 20, doneTitle: 'Sync complete', doneMeta: 'DHU figures are current' });
        return true;
      case 'request-access':
        toast({ kind: 'ready', title: 'Access requested', meta: 'Sent to Finance · Cost per Unit Analysis' });
        return true;
      case 'undo':
        toast({ title: 'Undo — removed the last tile change', ttl: 2400 });
        return true;
      case 'redo':
        toast({ title: 'Redo — reapplied the last tile change', ttl: 2400 });
        return true;
      case 'unmute':
        toast({ kind: 'ready', title: 'Rule unmuted', meta: 'Notifications resume on the next evaluation' });
        return true;
      case 'mark-read':
        toast({ title: 'All notifications marked as read' });
        return true;
      case 'forgot':
        toast({ kind: 'ready', title: 'Reset link sent', meta: 'Check ' + (session().email || 'your inbox') });
        return true;
      case 'template':
        toast({ kind: 'ready', title: 'Started from ' + (label || 'template'), meta: 'Tiles loaded into the canvas' });
        return true;
      case 'customise':
        toast({ title: label || 'Home layout updated' });
        return true;
      case 'primer':
        toast({ title: 'Primer will show on your next visit' });
        return true;
      case 'unfavourite':
        toast({ title: 'Removed from favourites' });
        return true;
      case 'duplicate-rule':
        toast({ kind: 'ready', title: 'Rule duplicated', meta: 'Saved as a paused copy', cta: 'Edit', href: 'alert-rule.html' });
        return true;
      case 'test-rule':
        toast({ kind: 'progress', title: 'Testing rule against 30 days…', pct: 30, doneTitle: 'Rule would have fired 4 times', doneMeta: 'Last on 15 Dec · peak 86.2%' });
        return true;
      case 'rule-history':
        toast({ title: 'Opening rule history', cta: 'History', href: 'signals.html?tab=history' });
        return true;
      case 'delete-rule':
        toast({ kind: 'warn', title: 'Rule deleted', meta: 'Recipients were notified', cta: 'Undo' });
        return true;
      case 'save-rule':
        toast({ kind: 'ready', title: 'Alert rule saved', meta: 'Paused until you activate it', cta: 'Signals', href: 'signals.html' });
        return true;
      case 'activate-rule':
        toast({ kind: 'ready', title: 'Alert rule activated', meta: 'Watching On-Time Delivery below 90%', cta: 'Signals', href: 'signals.html' });
        return true;
      default:
        return false;
    }
  }

  function wire() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t.closest) { return; }

      var opener = t.closest('[data-ep-open]');
      if (opener) {
        ev.preventDefault();
        open(opener.getAttribute('data-ep-open'), opener);
        return;
      }

      // a control may both run an action and close — run the action first
      var closer = t.closest('[data-ep-close]');
      if (closer) {
        ev.preventDefault();
        var closerAct = closer.getAttribute('data-ep-action');
        if (closerAct) { runAction(closerAct); }
        close();
        return;
      }

      /* The CTA stays a real link — it is the click that is routed, not the
         element. Without this the <a> navigates natively and the seam is
         bypassed. */
      var cta = t.closest('a.ep-toast__cta[href]');
      if (cta) {
        ev.preventDefault();
        if (global.EpicPulse && global.EpicPulse.navigate) { global.EpicPulse.navigate(cta.getAttribute('href')); }
        else { global.location.href = cta.getAttribute('href'); }
        return;
      }

      if (t.closest('[data-ep-close-toast]')) {
        ev.preventDefault();
        var deadToast = t.closest('.ep-toast');
        if (deadToast) { deadToast.remove(); }
        return;
      }

      // clicking the scrim itself (not the dialog) closes
      var scrim = t.closest('.ep-scrim');
      if (scrim && t === scrim) { close(); return; }
      var layer = t.closest('.ep-popover-layer');
      if (layer && t === layer) { close(); return; }

      var themeSet = t.closest('[data-ep-theme-set]');
      if (themeSet) {
        ev.preventDefault();
        mod('theme').set(themeSet.getAttribute('data-ep-theme-set'));
        syncThemeSwitch();
        return;
      }

      var wide = t.closest('[data-ep-assistant-wide]');
      if (wide) {
        ev.preventDefault();
        var panel = document.querySelector('[data-ep-panel="assistant"]');
        if (panel) { panel.classList.toggle('ep-is-wide'); }
        return;
      }

      var act = t.closest('[data-ep-action]');
      if (!act) { return; }
      if (runAction(act.getAttribute('data-ep-action'), act)) { ev.preventDefault(); }
    });

    // menu items can dispatch the same named actions
    document.addEventListener('pulse:action', function (ev) {
      runAction(ev.detail.act, ev.detail.trigger, ev.detail.item);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && openName) { close(); }
    });

    // assistant composer — echoes the question back as a user bubble so the
    // conversation reads as live without inventing new reply designs
    document.addEventListener('submit', function (ev) {
      var form = ev.target.closest && ev.target.closest('[data-ep-assistant-form]');
      if (!form) { return; }
      ev.preventDefault();
      var input = form.querySelector('input');
      if (!input) { return; }
      var text = (input.value || '').trim();
      if (!text) { return; }
      var stream = document.querySelector('[data-ep-assistant-stream]');
      if (!stream) { return; }
      var typing = stream.querySelector('[data-ep-typing]');
      var b = document.createElement('div');
      b.className = 'ep-bubble ep-bubble--me';
      b.textContent = text;
      stream.insertBefore(b, typing);
      input.value = '';
      stream.scrollTop = stream.scrollHeight;
    });

    // quick-reply chips drop their text into the composer
    document.addEventListener('click', function (ev) {
      var q = ev.target.closest && ev.target.closest('[data-ep-quick]');
      if (!q) { return; }
      var input = document.querySelector('[data-ep-assistant-form] input');
      if (input) { input.value = q.textContent.trim(); input.focus(); }
    });

    mod('theme').onChange(syncThemeSwitch);
    // the popover syncs its switch when it opens, but settings puts the same
    // control on the page, so it needs the state settling once up front
    syncThemeSwitch();
  }

  /* Deprecated alias, removed in 2.0.0 — use EpicPulse.overlays. */
  global.overlays = { render: render, open: open, close: close, toast: toast, action: runAction };
  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.overlays = global.overlays;
}(window));
