/* EPIC Pulse UI Kit — hook resolution

   Every element the kit binds to is named by a data-ep-* attribute. A
   prototype can get away with ids: there is one of each per page. A kit
   cannot — two of the same component on one page collide on the lookup and
   on any aria reference pointing at it.

   This module is the single place that resolves a hook, so every consumer
   agrees on what "the instance" means, and so the deprecated unprefixed form
   keeps working for one major version.

   Load order: after the theme script, before every consumer. It registers its
   own DOMContentLoaded listener first, which is what lets the upgrade pass
   below run before any consumer looks for a hook.

     EpicPulse.hooks.sel('open')        '[data-ep-open],[data-open]'
     EpicPulse.hooks.get(el, 'open')    value, prefixed first, legacy second
     EpicPulse.hooks.closest(el, 'open')
     EpicPulse.hooks.all(scope, 'open') / .one(scope, 'open')
     EpicPulse.hooks.instances('shell') every instance root, document order
     EpicPulse.hooks.scopeOf(el, 'shell')  the instance an element belongs to
     EpicPulse.hooks.opener(panel, 'open') the control that opens an instance,
                                           which sits OUTSIDE it and so cannot
                                           be found by scoping
     EpicPulse.hooks.on(el, type, fn)   guarded addEventListener

   DEPRECATION. Unprefixed hooks are removed in 2.0.0. Until then a
   page may carry either form: at DOMContentLoaded every legacy attribute in
   the document is mirrored onto its prefixed name and one warning is logged
   per attribute. Markup injected AFTER that point must use the prefixed form
   — the upgrade pass is a migration aid, not a permanent shim. */

(function (global) {
  'use strict';

  var PREFIX = 'data-ep-';
  var REMOVED_IN = '2.0.0';
  var warned = {};

  /* The kit's complete hook inventory. It is what the upgrade pass walks, and
     it doubles as the list of attribute names the kit owns. */
  var NAMES = [
    'account-workspace', 'ack', 'action', 'active-count', 'addtile-title', 'asof',
    'assistant-ctx', 'assistant-form', 'assistant-stream', 'assistant-wide', 'auth-banner',
    'auth-banner-text', 'base', 'cal-close', 'cal-day', 'cal-nav', 'cal-pop', 'cal-today',
    'cal-week', 'cat', 'cat-section', 'check', 'chip-name', 'chip-remove', 'close',
    'close-toast', 'columns-table', 'crumb', 'date', 'date-group', 'date-label', 'date-mode',
    'date-name', 'date-quiet', 'date-role', 'date-value', 'dirty-bar', 'dirty-discard',
    'dirty-guard', 'dirty-save', 'dismiss', 'empty-filter', 'empty-filter-name', 'env',
    'env-popups', 'env-verdict', 'env-verdict-note', 'exit-fullscreen', 'export-subject',
    'fab-bubble', 'fab-bubble-close', 'fav', 'fav-filter', 'filter', 'fresh', 'fullscreen',
    'goto', 'history-opens', 'history-runs', 'history-runs-note', 'history-subject', 'icon',
    'icon-size', 'inspector-name', 'inspector-title', 'late', 'layer', 'layout', 'layout-mode',
    'list-filter', 'locked', 'matrix-browser', 'menu', 'menu-clear', 'menu-done',
    'menu-filter', 'menu-label', 'menu-layer', 'menu-list', 'menu-pop', 'mi', 'mount',
    'mute-signal', 'name', 'nav', 'nav-close', 'nav-open', 'nav-toggle', 'noise-count',
    'noise-count-2', 'noise-echo', 'noise-input', 'noise-line', 'noise-none', 'noise-warn',
    'note-cancel', 'note-form', 'note-open', 'note-save', 'notes', 'open', 'order',
    'overlay-root', 'page-btn', 'panel', 'panel-group', 'panel-key', 'period', 'popover',
    'print', 'projected', 'promised', 'quick', 'radio-btn', 'radio-card', 'radio-chip',
    'rail-toggle', 'recent', 'reveal', 'run-list', 'run-report', 'sched-at', 'sched-fails',
    'sched-name', 'sched-size', 'sched-skips', 'schedule-subject', 'scrim', 'seg', 'segmented',
    'select-row', 'shares', 'slider', 'slider-delay', 'slider-dot', 'slider-slide',
    'slider-track', 'sortable', 'stage', 'stage-row', 'star', 'sub', 'switch', 'tab', 'tabs',
    'tabs-deeplink', 'theme-btn', 'theme-set', 'tile-del', 'tile-dup', 'tile-form',
    'timeline-sub', 'timeline-title', 'tip', 'tip-pop', 'tip-title', 'title', 'toast-dock',
    'toggle-chip', 'typing', 'workspace-mark', 'ws', 'ws-picker'
  ];

  function deprecated(name) {
    if (warned[name]) { return; }
    warned[name] = true;
    if (global.console && global.console.warn) {
      global.console.warn(
        'EpicPulse: [data-' + name + '] is deprecated \u2014 use [' + PREFIX + name +
        ']. The unprefixed form is removed in ' + REMOVED_IN + '.');
    }
  }

  function sel(name) { return '[' + PREFIX + name + '],[data-' + name + ']'; }

  function get(el, name) {
    if (!el || !el.getAttribute) { return null; }
    var v = el.getAttribute(PREFIX + name);
    if (v !== null) { return v; }
    v = el.getAttribute('data-' + name);
    if (v !== null) { deprecated(name); }
    return v;
  }

  function has(el, name) {
    if (!el || !el.hasAttribute) { return false; }
    if (el.hasAttribute(PREFIX + name)) { return true; }
    if (el.hasAttribute('data-' + name)) { deprecated(name); return true; }
    return false;
  }

  function closest(el, name) {
    return (el && el.closest) ? el.closest(sel(name)) : null;
  }

  function all(scope, name) {
    return (scope || document).querySelectorAll(sel(name));
  }

  function one(scope, name) {
    return (scope || document).querySelector(sel(name));
  }

  function instances(name) {
    return Array.prototype.slice.call(all(document, name));
  }

  /* The instance an element belongs to. Falls back to the document, so a page
     with no marker behaves exactly as it did before one existed. */
  function scopeOf(el, name) {
    return closest(el, name) || document;
  }

  /* Openers sit outside the thing they open, so scoping cannot find them.
     With one instance the first match is unambiguous; with several, pair them
     by id: <button data-ep-open="upload"> next to <div id="upload" …>. */
  function opener(panel, name) {
    if (!panel) { return null; }
    var id = panel.id;
    if (id) {
      var paired = document.querySelector('[' + PREFIX + name + '="' + id + '"]');
      if (paired) { return paired; }
    }
    return one(document, name);
  }

  function on(el, type, fn) {
    if (el && el.addEventListener) { el.addEventListener(type, fn); }
  }

  /* Mirror every legacy attribute onto its prefixed name, once, before any
     consumer runs. Values are copied rather than moved, so a page that reads
     its own unprefixed markup keeps working. */
  function upgrade(root) {
    var scope = root || document;
    var n, i, nodes, j, el;
    for (i = 0; i < NAMES.length; i++) {
      n = NAMES[i];
      nodes = scope.querySelectorAll('[data-' + n + ']');
      for (j = 0; j < nodes.length; j++) {
        el = nodes[j];
        if (el.hasAttribute(PREFIX + n)) { continue; }
        el.setAttribute(PREFIX + n, el.getAttribute('data-' + n));
        deprecated(n);
      }
    }
  }

  var hooks = {
    prefix: PREFIX,
    names: NAMES,
    sel: sel, get: get, has: has, closest: closest,
    all: all, one: one, instances: instances, scopeOf: scopeOf,
    opener: opener, on: on, upgrade: upgrade
  };

  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.hooks = hooks;

  /* Runtime switches a host page may flip. Kept here because this module
     loads before every consumer, so a page can set them in one place. */
  global.EpicPulse.config = global.EpicPulse.config || {
    /* Acknowledge a click on a control nothing wired. A prototype wants
       this; a real application does not, and a page whose own chrome is
       buttons would toast on every one of them. */
    ackUnwired: false,

    /* Every navigation the kit itself triggers goes through here: a menu
       item with an href, a form marked data-ep-goto, and a toast CTA.
       Replace it to keep the kit inside a page that is not the app — a
       component gallery, a preview, a test harness. A capture-phase click
       listener is not enough: two of the three assign location.href, which
       no listener can intercept. */
    navigate: function (href) { global.location.href = href; }
  };

  /* Used by the kit rather than calling location directly, so a page that
     replaces config.navigate replaces all of it. */
  global.EpicPulse.navigate = function (href) {
    if (!href) { return; }
    var fn = global.EpicPulse.config && global.EpicPulse.config.navigate;
    if (typeof fn === 'function') { fn(href); return; }
    global.location.href = href;
  };
  global.hooks = hooks;

  /* The second configuration shape. Globals work everywhere and need no build
     step; init() suits a bundler or a server-rendered page. It must run before
     the kit's other scripts parse, because they read their configuration once.
     Where a module is already live its registry is updated in place, so a late
     call still takes effect for menus. */
  global.EpicPulse.init = function (cfg) {
    cfg = cfg || {};
    if (cfg.session) { global.EP_SESSION = cfg.session; }
    if (cfg.nav) { global.EP_NAV = cfg.nav; }
    if (cfg.today) { global.EP_TODAY = cfg.today; }
    if (cfg.routes) { global.EP_ROUTES = cfg.routes; }
    if (cfg.brand) { global.EP_BRAND = cfg.brand; }
    if (cfg.menus) {
      global.EP_MENUS = cfg.menus;
      var live = global.EpicPulse.menus && global.EpicPulse.menus.registry;
      if (live) {
        for (var k in live) {
          if (Object.prototype.hasOwnProperty.call(live, k)) { delete live[k]; }
        }
        for (var j in cfg.menus) {
          if (Object.prototype.hasOwnProperty.call(cfg.menus, j)) { live[j] = cfg.menus[j]; }
        }
      }
    }
    return global.EpicPulse;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { upgrade(document); });
  } else {
    upgrade(document);
  }
}(window));
