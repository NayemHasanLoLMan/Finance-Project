/* EPIC Pulse UI Kit — global shell renderer
   Builds the sidebar, content topbar, assistant FAB and
   the global overlay layer into the mount points each page declares:

     <div data-ep-mount="sidebar"></div>
     <div data-ep-mount="topbar"></div>
     <div data-ep-mount="overlays"></div>

   Page-level configuration comes off <body>:
     data-ep-nav            active sidebar item id
     data-ep-crumb          topbar eyebrow, e.g. "ANALYTICS / DASHBOARD"
     data-ep-title          topbar title
     data-ep-period         global period selector label   (default "This month")
     data-ep-asof           freshness chip timestamp       (default per session)
     data-ep-assistant-ctx  what the assistant is answering against */

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

  /* --- configuration ---------------------------------------------------
     The kit holds no application data. A page supplies its own through
     window.EP_SESSION / EP_NAV, or EpicPulse.init({ session, nav }). The
     defaults below are deliberately empty: with no configuration the shell
     renders its chrome and no destinations, rather than this customer's.
     -------------------------------------------------------------------- */

  var DEFAULT_SESSION = {
    name: '', firstName: '', initials: '', email: '', role: '', roleLine: '',
    workspace: '', workspaceName: '', workspaceMark: '', version: '',
    build: '', asof: '', notifications: '', support: ''
  };

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

  function configured() {
    var out = {};
    var supplied = global.EP_SESSION || {};
    for (var k in DEFAULT_SESSION) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SESSION, k)) {
        out[k] = Object.prototype.hasOwnProperty.call(supplied, k) ? supplied[k] : DEFAULT_SESSION[k];
      }
    }
    return out;
  }

  var SESSION = configured();
  var NAV = global.EP_NAV || [];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* The shell's instance region. With no [data-ep-shell] marker this is the
     document and the shell behaves exactly as it always did; inside a
     preview card the marker stops it reaching out and driving the real
     shell around it. */
  function region() {
    return document.querySelector('[data-ep-shell]') || document;
  }

  function mount(name) { return region().querySelector('[data-ep-mount="' + name + '"]'); }

  function swap(el, html) {
    if (!el) { return null; }
    var tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    var node = tmp.firstElementChild;
    el.parentNode.replaceChild(node, el);
    return node;
  }

  /* Preferences are namespaced so two things using the kit can share an
     origin — a product and its component gallery, or two deployments —
     without overwriting each other. Set window.EP_STORAGE_PREFIX before
     the kit loads: it is read as each script parses, which is earlier
     than init() runs. */
  var STORE_PREFIX = global.EP_STORAGE_PREFIX || 'epic-pulse.';
  var RAIL_KEY = STORE_PREFIX + 'rail';
  var GROUP_KEY = STORE_PREFIX + 'navgroups';

  function store(key, val) { try { global.localStorage.setItem(key, val); } catch (e) {} }
  function load(key) { try { return global.localStorage.getItem(key); } catch (e) { return null; } }

  function navItemHtml(item, activeId) {
    var childIds = (item.children || []).map(function (c) { return c.id; });
    var childActive = childIds.indexOf(activeId) > -1;

    /* A row that has children is a disclosure control, not a destination:
       clicking it opens and closes its own list, and it is never shown as
       selected — its children are the real destinations. Being a real
       <button> also means Enter and Space work for free, and there is no
       longer an interactive element nested inside a link.

       Rail mode is the one exception: the sub-list is hidden there, so the
       parent icon carries the group's selected state instead. That is styled
       off .is-child-active in shell.css and only applies while railed. */
    if (item.children) {
      var openState = load(GROUP_KEY + '.' + item.id);
      var open = childActive ||
                 (openState === null ? !!item.expanded : openState === '1');

      var subs = item.children.map(function (c) {
        return '<a class="ep-nav-subitem' + (c.id === activeId ? ' ep-is-active' : '') + '"' +
               ' href="' + esc(c.href) + '"' +
               (c.id === activeId ? ' aria-current="page"' : '') + '>' +
                 '<span class="ep-nav-subitem__icon">' + icon(c.icon, 15) + '</span>' +
                 '<span class="ep-nav-subitem__label">' + esc(c.label) + '</span>' +
               '</a>';
      }).join('');

      return '<div class="ep-nav-parent">' +
               '<button class="ep-nav-item ep-nav-item--group' + (childActive ? ' ep-is-child-active' : '') + '"' +
               ' type="button" data-ep-nav-toggle="' + esc(item.id) + '"' +
               ' aria-expanded="' + (open ? 'true' : 'false') + '"' +
               ' aria-controls="nav-sub-' + esc(item.id) + '">' +
                 '<span class="ep-nav-item__icon">' + icon(item.icon, 17) + '</span>' +
                 '<span class="ep-nav-item__label">' + esc(item.label) + '</span>' +
                 (item.badge ? '<span class="ep-nav-item__badge">' + esc(item.badge) + '</span>' : '') +
                 '<span class="ep-nav-item__chevron">' + icon('chevron-down', 10) + '</span>' +
               '</button>' +
               '<div class="ep-nav-sub" id="nav-sub-' + esc(item.id) + '" data-ep-sub="' + esc(item.id) + '"' +
               (open ? '' : ' hidden') + '>' + subs + '</div>' +
             '</div>';
    }

    // a leaf row is a plain link, and the only kind that can be selected
    var isActive = item.id === activeId;
    return '<a class="ep-nav-item' + (isActive ? ' ep-is-active' : '') + '" href="' + esc(item.href) + '"' +
             (isActive ? ' aria-current="page"' : '') + '>' +
             '<span class="ep-nav-item__icon">' + icon(item.icon, 17) + '</span>' +
             '<span class="ep-nav-item__label">' + esc(item.label) + '</span>' +
             (item.badge ? '<span class="ep-nav-item__badge">' + esc(item.badge) + '</span>' : '') +
           '</a>';
  }

  /* All of a group's sub-items point at the same page with a different query
     (dashboard.html?d=quality, ?d=cost), so the page's own data-ep-nav cannot
     say which one you are on. Resolve it from the URL, and fall back to
     data-ep-nav when there is no query. */
  function resolveActive(navAttr) {
    var ids = {};
    var parents = {};
    NAV.forEach(function (g) {
      g.items.forEach(function (it) {
        ids[it.id] = true;
        if (it.children) { parents[it.id] = it; }
        (it.children || []).forEach(function (c) { ids[c.id] = true; });
      });
    });

    var id = navAttr;
    try {
      var q = new URLSearchParams(global.location.search);
      var byParam = [['d', 'dash-'], ['s', 'space-']];
      for (var i = 0; i < byParam.length; i++) {
        var val = q.get(byParam[i][0]);
        if (val && ids[byParam[i][1] + val]) { id = byParam[i][1] + val; break; }
      }
    } catch (e) { /* no URLSearchParams */ }

    // Parent rows only open and close their list, so a page that names one
    // resolves to its first child instead — otherwise nothing would show as
    // selected at all.
    if (parents[id]) { return parents[id].children[0].id; }
    return id;
  }

  function sidebarHtml(activeId) {
    var b = brand();
    var groups = NAV.map(function (g) {
      return '<div class="ep-nav-group">' + esc(g.group) + '</div>' +
             g.items.map(function (it) { return navItemHtml(it, activeId); }).join('');
    }).join('');

    return '' +
      '<aside class="ep-sidebar" id="sidebar" data-ep-sidebar aria-label="Primary">' +
        '<div class="ep-sidebar__brand">' +
          linkOpen('ep-sidebar__brand-link', route('home'),
                   b.name ? ' aria-label="' + esc(b.name) + '"' : '') +
            (b.logo ? '<img class="ep-sidebar__logo" src="' + esc(b.logo) + '" alt="' + esc(b.name) + '">' : '') +
            (b.logoRail ? '<img class="ep-sidebar__logo--rail" src="' + esc(b.logoRail) + '" alt="">' : '') +
            '<span class="ep-sidebar__version">THIN CLIENT · v' + esc(SESSION.version) + '</span>' +
          linkClose(route('home')) +
          '<button class="ep-sidebar__collapse" type="button" data-ep-rail-toggle aria-label="Collapse sidebar">' +
            icon('chevron-left', 14) +
          '</button>' +
        '</div>' +
        '<nav class="ep-sidebar__nav">' + groups + '</nav>' +
        '<div class="ep-sidebar__foot">' +
          '<button class="ep-sidebar__account" type="button" data-ep-open="account" aria-haspopup="dialog">' +
            '<span class="ep-sidebar__avatar">' + esc(SESSION.initials) + '</span>' +
            '<span class="ep-sidebar__account-text">' +
              '<span class="ep-sidebar__account-name">' + esc(SESSION.name) + '</span>' +
              '<span class="ep-sidebar__account-role">' + esc(SESSION.roleLine) + '</span>' +
            '</span>' +
            '<span class="ep-sidebar__account-chevron">' + icon('chevron-updown', 12) + '</span>' +
          '</button>' +
          (route('signin')
            ? '<a class="ep-sidebar__signout" href="' + esc(route('signin')) + '">' +
                '<span class="ep-nav-item__icon">' + icon('arrow-forward', 17) + '</span>' +
                '<span>Sign out</span>' +
              '</a>'
            : '') +
        '</div>' +
      '</aside>' ;
  }

  /* The theme control reports the theme that is actually rendering: a moon
     while dark, a sun while light. "System" resolves to one of the two, so
     the icon still tells the truth — the three-way choice lives in the
     account popover and settings. The label names the action, since that is what
     a screen reader needs from a button. */
  function themeBtnHtml() {
    var dark = mod('theme').resolved() === 'dark';
    return '<button class="ep-icon-btn ep-icon-btn--accent" type="button" data-ep-action="theme"' +
           ' data-ep-theme-btn aria-label="' + (dark ? 'Dark theme. Switch to light.' : 'Light theme. Switch to dark.') + '">' +
             icon(dark ? 'moon' : 'sun', 15) +
           '</button>';
  }

  /* Every one of them, not the first one found: a screen has a single topbar,
     but anything rendering the shell twice — a gallery, an embedded preview, a
     page showing old and new chrome side by side — would leave the rest
     insisting the theme is what it no longer is. */
  function syncThemeBtn() {
    var dark = mod('theme').resolved() === 'dark';
    var label = dark ? 'Dark theme. Switch to light.' : 'Light theme. Switch to dark.';
    var glyph = icon(dark ? 'moon' : 'sun', 15);
    var all = document.querySelectorAll('[data-ep-theme-btn]');
    for (var i = 0; i < all.length; i++) {
      all[i].innerHTML = glyph;
      all[i].setAttribute('aria-label', label);
    }
  }

  function topbarHtml(cfg) {
    return '' +
      '<header class="ep-topbar">' +
        '<button class="ep-topbar__burger" type="button" data-ep-nav-open aria-label="Open navigation" aria-controls="sidebar">' +
          icon('menu', 18) +
        '</button>' +
        '<div class="ep-topbar__titles">' +
          '<div class="ep-topbar__crumb">' + esc(cfg.crumb) + '</div>' +
          '<div class="ep-topbar__title">' + esc(cfg.title) + '</div>' +
        '</div>' +
        '<div class="ep-spacer"></div>' +
        '<div class="ep-topbar__search">' +
          icon('search', 14) +
          '<input type="search" placeholder="Search reports" data-ep-menu="search"' +
          ' aria-label="Search reports, dashboards, metrics and spaces">' +
        '</div>' +
        '<button class="ep-topbar__search-btn ep-icon-btn" type="button" data-ep-menu="search" aria-label="Search">' +
          icon('search', 15) +
        '</button>' +
        '<button class="ep-topbar__period" type="button" data-ep-menu="period" aria-expanded="false" aria-label="Global period selector">' +
          '<span class="ep-topbar__period-icon">' + icon('calendar', 14) + '</span>' +
          '<span class="ep-topbar__period-label" data-ep-menu-label>' + esc(cfg.period) + '</span>' +
          '<span class="ep-caret">' + icon('chevron-down', 10) + '</span>' +
        '</button>' +
        '<div class="ep-topbar__fresh">' +
          '<span class="ep-topbar__fresh-dot"></span>' +
          '<span class="ep-topbar__fresh-text">Data as of ' + esc(cfg.asof) + '</span>' +
          '<button type="button" data-ep-action="refresh" aria-label="Refresh data">' + icon('refresh', 12) + '</button>' +
        '</div>' +
        '<div class="ep-topbar__tools">' +
          '<button class="ep-icon-btn" type="button" data-ep-menu="notifications" aria-expanded="false" aria-label="Notifications, 4 unread">' +
            icon('bell', 17) +
            '<span class="ep-icon-btn__badge">' + esc(SESSION.notifications) + '</span>' +
          '</button>' +
          '<button class="ep-icon-btn" type="button" data-ep-open="assistant" aria-label="Open Pulse Assistant">' +
            icon('chat', 16) +
          '</button>' +
          themeBtnHtml() +
          /* Workspace switcher. The icon set has no glyph that reads as
             "workspace", and the topbar had nowhere showing which one you are
             in — so the button wears the workspace's own two-letter mark, the
             same mark its row carries in the picker. It doubles as the
             indicator and the way out. */
          '<button class="ep-icon-btn ep-icon-btn--mark" type="button" data-ep-open="wspanel"' +
                 ' aria-label="Switch workspace &mdash; currently ' + esc(SESSION.workspaceName) + '">' +
            '<span data-ep-workspace-mark>' + esc(SESSION.workspaceMark) + '</span>' +
          '</button>' +
        '</div>' +
      '</header>';
  }

  function boot() {
    var body = document.body;
    var cfg = {
      nav: resolveActive(body.getAttribute('data-ep-nav') || ''),
      crumb: body.getAttribute('data-ep-crumb') || 'PULSE',
      title: body.getAttribute('data-ep-title') || 'Home',
      period: body.getAttribute('data-ep-period') || 'This month',
      asof: body.getAttribute('data-ep-asof') || SESSION.asof,
      assistantCtx: body.getAttribute('data-ep-assistant-ctx') || ''
    };

    var hadTopbar = !!mount('topbar');

    swap(mount('sidebar'), sidebarHtml(cfg.nav));
    swap(mount('topbar'), topbarHtml(cfg));

    // Assistant FAB — the assistant says it follows the user everywhere, so the shell
    // owns it rather than each page. Auth screens have no topbar and skip it.
    if (hadTopbar) {
      var dock = document.createElement('div');
      dock.className = 'ep-fab-dock';
      /* appended to the body, so nothing else contains it: without a landmark
         of its own its content belongs to no region at all */
      dock.setAttribute('role', 'complementary');
      dock.setAttribute('aria-label', 'Assistant');
      dock.innerHTML =
        '<div class="ep-fab-bubble" data-ep-fab-bubble>Ask me about any metric — I&rsquo;ll chart it.</div>' +
        '<button class="ep-fab" type="button" data-ep-open="assistant" aria-label="Open Pulse Assistant">' +
          icon('chat', 22) +
        '</button>';
      (region() === document ? body : region()).appendChild(dock);
    }

    var host = region();
    var app = host.querySelector('.ep-app');
    var sidebar = host.querySelector('[data-ep-sidebar]');

    // backdrop for the off-canvas sidebar
    if (app && sidebar) {
      var backdrop = document.createElement('div');
      backdrop.className = 'ep-sidebar__backdrop';
      backdrop.setAttribute('data-ep-nav-close', '');
      sidebar.parentNode.insertBefore(backdrop, sidebar.nextSibling);
    }

    // rail mode, remembered
    if (app && load(RAIL_KEY) === '1') { app.classList.add('ep-app--rail'); }

    // overlays + assistant + toast dock
    if (mod('overlays')) { mod('overlays').render(mount('overlays'), SESSION, cfg); }

    wire(app, sidebar);
  }

  function toggleNavGroup(chevron) {
    var id = chevron.getAttribute('data-ep-nav-toggle');
    var sub = document.querySelector('[data-ep-sub="' + id + '"]');
    if (!sub) { return; }
    var nowHidden = !sub.hidden;
    sub.hidden = nowHidden;
    chevron.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
    store(GROUP_KEY + '.' + id, nowHidden ? '0' : '1');
  }

  function wire(app, sidebar) {
    document.addEventListener('click', function (ev) {
      var t = ev.target;

      var railBtn = t.closest && t.closest('[data-ep-rail-toggle]');
      if (railBtn && app) {
        ev.preventDefault();
        var railed = app.classList.toggle('ep-app--rail');
        store(RAIL_KEY, railed ? '1' : '0');
        railBtn.setAttribute('aria-label', railed ? 'Expand sidebar' : 'Collapse sidebar');
        return;
      }

      var navToggle = t.closest && t.closest('[data-ep-nav-toggle]');
      if (navToggle) {
        ev.preventDefault();
        // Railed, the sub-list is hidden, so toggling it would do nothing
        // visible. Expand the rail and open the group instead.
        if (app && app.classList.contains('ep-app--rail')) {
          app.classList.remove('ep-app--rail');
          store(RAIL_KEY, '0');
          var sub = document.querySelector('[data-ep-sub="' + navToggle.getAttribute('data-ep-nav-toggle') + '"]');
          if (sub && sub.hidden) { toggleNavGroup(navToggle); }
          return;
        }
        toggleNavGroup(navToggle);
        return;
      }

      if (t.closest && t.closest('[data-ep-nav-open]')) {
        ev.preventDefault();
        if (app && sidebar) { app.classList.add('ep-nav-open'); sidebar.classList.add('ep-is-open'); }
        return;
      }

      if (t.closest && t.closest('[data-ep-nav-close]')) {
        ev.preventDefault();
        if (app && sidebar) { app.classList.remove('ep-nav-open'); sidebar.classList.remove('ep-is-open'); }
        return;
      }

      var themeBtn = t.closest && t.closest('[data-ep-action="theme"]');
      if (themeBtn) { ev.preventDefault(); mod('theme').toggle(); return; }

      var refreshBtn = t.closest && t.closest('[data-ep-action="refresh"]');
      if (refreshBtn && mod('overlays')) {
        ev.preventDefault();
        var title = document.body.getAttribute('data-ep-title') || 'this screen';
        mod('overlays').toast({
          kind: 'progress', title: 'Refreshing ' + title + '…', pct: 42,
          doneTitle: 'Data refreshed', doneMeta: 'Data as of 18 Dec 4:52 PM'
        });
        return;
      }
    });

    document.addEventListener('keydown', function (ev) {
      // the group row is a real <button>, so Enter and Space already fire a
      // click — nothing extra to bind here
      if (ev.key === 'Escape' && app && sidebar) {
        app.classList.remove('ep-nav-open');
        sidebar.classList.remove('ep-is-open');
      }
    });

    if (global.matchMedia) {
      var wide = global.matchMedia('(min-width: 1024px)');
      var onWide = function () {
        if (wide.matches && app && sidebar) {
          app.classList.remove('ep-nav-open');
          sidebar.classList.remove('ep-is-open');
        }
      };
      if (wide.addEventListener) { wide.addEventListener('change', onWide); }
      else if (wide.addListener) { wide.addListener(onWide); }
    }

    // navigating inside the off-canvas sidebar should close it
    if (sidebar) {
      sidebar.addEventListener('click', function (ev) {
        if (ev.target.closest('a') && app) {
          app.classList.remove('ep-nav-open');
          sidebar.classList.remove('ep-is-open');
        }
      });
    }
  }

  mod('theme').onChange(syncThemeBtn);

  global.shell = { session: SESSION, nav: NAV, esc: esc, boot: boot, region: region };
  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.shell = global.shell;

  /* A page that renders the shell into a card decides when and into what.
     <html data-ep-manual-boot> suppresses the automatic pass; call
     EpicPulse.shell.boot() yourself. */
  function autoboot() {
    if (document.documentElement.hasAttribute('data-ep-manual-boot')) { return; }
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoboot);
  } else {
    autoboot();
  }
}(window));
