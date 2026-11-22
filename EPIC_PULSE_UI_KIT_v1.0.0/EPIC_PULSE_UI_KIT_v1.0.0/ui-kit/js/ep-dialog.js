/* EPIC Pulse UI Kit — dialog focus management

   Move focus in on open, cycle Tab inside, restore focus to the opener on
   close, and set role / aria-modal / aria-label at runtime for panels that do
   not already carry them.

   This is the only thing between a dialog and a keyboard user who cannot get
   out of it. Every caller guards on the global, so removing this file leaves
   dialogs working but untrapped — degraded, not broken.

   Labelling uses aria-label taken from the panel's own heading rather than
   aria-labelledby, deliberately: generating ids for headings would mint
   duplicates the moment two instances of a component share a document.

     EpicPulse.dialog.trap(panel, opener)   arm the trap
     EpicPulse.dialog.release()             disarm and return focus
     EpicPulse.dialog.active()              the trapped panel, or null */

(function (global) {
  'use strict';

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]),' +
                  ' select:not([disabled]), textarea:not([disabled]),' +
                  ' [tabindex]:not([tabindex="-1"])';
  var TITLES = '.ep-modal__title, .ep-drawer__head .ep-h-card, .ep-popover__name,' +
               ' .ep-assistant__name, .ep-drawer__head [class$="__title"]';

  var state = null;

  function shown(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function tabbable(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), shown);
  }

  /* Capture phase, so the panel's own key handlers cannot swallow Tab first. */
  function onKeydown(ev) {
    if (!state || ev.key !== 'Tab') { return; }
    var list = tabbable(state.el);
    if (!list.length) { ev.preventDefault(); return; }
    var first = list[0];
    var last = list[list.length - 1];
    var at = document.activeElement;

    if (!state.el.contains(at)) { ev.preventDefault(); first.focus(); return; }
    if (ev.shiftKey && at === first) { ev.preventDefault(); last.focus(); return; }
    if (!ev.shiftKey && at === last) { ev.preventDefault(); first.focus(); }
  }

  function label(el) {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) { return null; }
    var title = el.querySelector(TITLES);
    var text = title && (title.textContent || '').trim();
    return text ? text.slice(0, 120) : null;
  }

  function trap(el, opener) {
    if (!el) { return; }
    release();

    state = {
      el: el,
      opener: opener || null,
      had: {
        role: el.getAttribute('role'),
        modal: el.getAttribute('aria-modal'),
        label: el.getAttribute('aria-label'),
        tabindex: el.getAttribute('tabindex')
      }
    };

    if (!state.had.role) { el.setAttribute('role', 'dialog'); }
    el.setAttribute('aria-modal', 'true');
    var text = label(el);
    if (text) { el.setAttribute('aria-label', text); }

    document.addEventListener('keydown', onKeydown, true);

    var list = tabbable(el);
    var target = list[0];
    if (!target) {
      if (state.had.tabindex === null) { el.setAttribute('tabindex', '-1'); }
      target = el;
    }
    /* after the open transition, or the panel is still pointer-events:none */
    global.setTimeout(function () {
      if (state && state.el === el) { try { target.focus(); } catch (e) {} }
    }, 60);
  }

  function restore(el, had) {
    if (had.role === null) { el.removeAttribute('role'); } else { el.setAttribute('role', had.role); }
    if (had.modal === null) { el.removeAttribute('aria-modal'); } else { el.setAttribute('aria-modal', had.modal); }
    if (had.label === null) { el.removeAttribute('aria-label'); } else { el.setAttribute('aria-label', had.label); }
    if (had.tabindex === null) { el.removeAttribute('tabindex'); } else { el.setAttribute('tabindex', had.tabindex); }
  }

  function release() {
    if (!state) { return; }
    document.removeEventListener('keydown', onKeydown, true);
    restore(state.el, state.had);
    var opener = state.opener;
    state = null;
    if (opener && opener.focus) { try { opener.focus(); } catch (e) {} }
  }

  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.dialog = {
    trap: trap,
    release: release,
    active: function () { return state ? state.el : null; }
  };
}(window));
