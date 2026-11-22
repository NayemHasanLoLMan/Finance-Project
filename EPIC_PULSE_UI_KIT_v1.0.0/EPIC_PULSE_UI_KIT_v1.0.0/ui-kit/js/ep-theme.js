/* EPIC Pulse UI Kit v1.0.0 — theme controller
   Light / Dark / System, persisted per account. The stored value is
   the *preference*; "system" is resolved against prefers-color-scheme and
   re-resolved live if the OS setting changes. The resolved value lands on
   <html data-theme="…">, which is what tokens.css keys off.

   With nothing stored the preference is "light". It is a preference and not
   a resolution, so a reader who picks System afterwards still gets their OS
   setting — the default only decides what a first visit looks like.

   Loaded in <head> before paint so there is no light-theme flash. */

(function (global) {
  'use strict';

  /* Preferences are namespaced so two things using the kit can share an
     origin — a product and its component gallery, or two deployments —
     without overwriting each other. Set window.EP_STORAGE_PREFIX before
     the kit loads: it is read as each script parses, which is earlier
     than init() runs. */
  var STORE_PREFIX = global.EP_STORAGE_PREFIX || 'epic-pulse.';
  var KEY = STORE_PREFIX + 'theme';
  var media = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;
  var listeners = [];

  function read() {
    try {
      var v = global.localStorage.getItem(KEY);
      return (v === 'light' || v === 'dark' || v === 'system') ? v : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function write(pref) {
    try { global.localStorage.setItem(KEY, pref); } catch (e) { /* private mode */ }
  }

  function resolve(pref) {
    if (pref === 'system') { return (media && media.matches) ? 'dark' : 'light'; }
    return pref;
  }

  function apply(pref) {
    var resolved = resolve(pref);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', pref);
    return resolved;
  }

  var theme = {
    /** current preference: 'light' | 'dark' | 'system' */
    pref: function () { return read(); },

    /** what the preference currently resolves to: 'light' | 'dark' */
    resolved: function () { return resolve(read()); },

    /** set the preference, persist it and notify subscribers */
    set: function (pref) {
      if (pref !== 'light' && pref !== 'dark' && pref !== 'system') { return; }
      write(pref);
      var resolved = apply(pref);
      listeners.forEach(function (fn) { fn(pref, resolved); });
    },

    /** flip between light and dark — what the topbar control does */
    toggle: function () {
      theme.set(theme.resolved() === 'dark' ? 'light' : 'dark');
    },

    /** fn(pref, resolved) on every change, including OS-level changes */
    onChange: function (fn) { listeners.push(fn); }
  };

  // ?theme=light|dark|system overrides and persists — handy for demoing a
  // screen in one theme, and for capturing both themes in review
  try {
    var q = new URLSearchParams(global.location.search).get('theme');
    if (q === 'light' || q === 'dark' || q === 'system') { write(q); }
  } catch (e) { /* no URLSearchParams / opaque origin */ }

  // paint the stored preference immediately
  apply(read());

  // keep "system" honest when the OS flips
  if (media) {
    var onSystem = function () {
      if (read() !== 'system') { return; }
      var resolved = apply('system');
      listeners.forEach(function (fn) { fn('system', resolved); });
    };
    if (media.addEventListener) { media.addEventListener('change', onSystem); }
    else if (media.addListener) { media.addListener(onSystem); }
  }

  /* Deprecated alias, removed in 2.0.0 — use EpicPulse.theme. */
  global.theme = theme;
  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.theme = theme;

  /* The kit's own release. This is the UI kit, not the product: the
     "THIN CLIENT · v…" line in the sidebar is the application's version
     and comes from the session configuration. Never conflate the two.
     Stamped here because this script loads first on every screen, so the
     answer is available before anything else has run. The same string is
     in the banner above, in the banner of ep-tokens.css, and in VERSION. */
  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.version = '1.0.0';
}(window));
