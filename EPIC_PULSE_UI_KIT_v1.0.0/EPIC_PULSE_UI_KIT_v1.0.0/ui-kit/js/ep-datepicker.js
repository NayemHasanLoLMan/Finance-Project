/* EPIC Pulse UI Kit — date picker

   Any element becomes a date trigger:

     <button class="input" data-ep-date data-ep-date-value="2026-12-01">
       <span data-ep-date-label>1 Dec 2026</span>
     </button>

   Optional attributes:
     data-ep-date-mode="week"     pick a whole ISO week; label reads "W51 · 15 Dec 2026"
     data-ep-date-group="period"  pair two triggers into a range
     data-ep-date-role="start|end"  which end of the range this one is

   "Today" is pinned to 18 December 2026 — the date the whole prototype's data
   is stamped with — so the calendar opens on the month the numbers describe
   rather than on the real system date. */

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
  /* A date is application data. A page pins one through window.EP_TODAY or
     EpicPulse.init({ today: 'YYYY-MM-DD' }); with none, the kit uses the
     real date rather than believing it is always December 2026. */
  function today() {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(global.EP_TODAY || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  }

  var TODAY = today();
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  var open = null;   // { trigger, view: Date, el }

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function iso(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function same(a, b) { return a && b && iso(a) === iso(b); }

  function fmt(d) { return d.getDate() + ' ' + SHORT[d.getMonth()] + ' ' + d.getFullYear(); }

  /** Monday-based start of the week containing d */
  function weekStart(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var shift = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - shift);
    return x;
  }

  /** ISO 8601 week number */
  function isoWeek(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
    var week1 = new Date(x.getFullYear(), 0, 4);
    return 1 + Math.round(
      ((x - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  }

  function weekLabel(d) {
    var s = weekStart(d);
    return 'W' + String(isoWeek(s)).padStart(2, '0') + ' · ' + fmt(s);
  }

  function partner(trigger) {
    var group = trigger.getAttribute('data-ep-date-group');
    if (!group) { return null; }
    var role = trigger.getAttribute('data-ep-date-role');
    var other = role === 'start' ? 'end' : 'start';
    return document.querySelector('[data-ep-date-group="' + group + '"][data-ep-date-role="' + other + '"]');
  }

  function rangeOf(trigger) {
    var group = trigger.getAttribute('data-ep-date-group');
    if (!group) { return {}; }
    var s = document.querySelector('[data-ep-date-group="' + group + '"][data-ep-date-role="start"]');
    var e = document.querySelector('[data-ep-date-group="' + group + '"][data-ep-date-role="end"]');
    return {
      start: s && parse(s.getAttribute('data-ep-date-value')),
      end: e && parse(e.getAttribute('data-ep-date-value'))
    };
  }

  function grid(view, trigger) {
    var week = trigger.getAttribute('data-ep-date-mode') === 'week';
    var sel = parse(trigger.getAttribute('data-ep-date-value'));
    var range = rangeOf(trigger);

    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var cursor = weekStart(first);
    var rows = '';

    for (var w = 0; w < 6; w++) {
      var cells = '';
      var rowStart = new Date(cursor);
      var rowHasSel = false;

      for (var i = 0; i < 7; i++) {
        var d = new Date(cursor);
        var out = d.getMonth() !== view.getMonth();
        var isSel = same(d, sel);
        var inRange = range.start && range.end && d > range.start && d < range.end;
        if (week && sel && same(weekStart(sel), rowStart)) { rowHasSel = true; }

        cells += '<button class="ep-cal__day' +
                   (out ? ' ep-is-out' : '') +
                   (same(d, TODAY) ? ' ep-is-today' : '') +
                   (isSel ? ' ep-is-selected' : '') +
                   (inRange ? ' ep-is-range' : '') + '"' +
                 ' type="button" data-ep-cal-day="' + iso(d) + '"' +
                 ' aria-label="' + fmt(d) + '"' +
                 (isSel ? ' aria-current="date"' : '') + '>' + d.getDate() + '</button>';
        cursor.setDate(cursor.getDate() + 1);
      }

      rows += '<div class="cal__row' + (week ? ' ep-cal__row--hoverable' : '') +
                (week && rowHasSel ? ' ep-cal__row--selected' : '') + '"' +
              ' style="display:contents"' +
              (week ? ' data-ep-cal-week="' + iso(rowStart) + '"' : '') + '>' +
                (week ? '<span class="ep-cal__wk">' + String(isoWeek(rowStart)).padStart(2, '0') + '</span>' : '') +
                cells +
              '</div>';
    }

    return '<div class="ep-cal__grid">' +
             (week ? '<span class="ep-cal__dow">Wk</span>' : '') +
             DOW.map(function (d) { return '<span class="ep-cal__dow">' + d + '</span>'; }).join('') +
           '</div>' +
           '<div class="ep-cal__grid">' + rows + '</div>';
  }

  function render(trigger, view) {
    var week = trigger.getAttribute('data-ep-date-mode') === 'week';
    var host = mod('menus').ensureLayer();

    host.innerHTML =
      '<div class="ep-pop ep-cal' + (week ? ' ep-cal--week' : '') + '" role="dialog" data-ep-cal-pop aria-label="Choose a date">' +
        '<div class="ep-cal__head">' +
          '<button class="ep-cal__nav" type="button" data-ep-cal-nav="-1" aria-label="Previous month">' + icon('chevron-left', 14) + '</button>' +
          '<span class="ep-cal__title">' + MONTHS[view.getMonth()] + ' ' + view.getFullYear() + '</span>' +
          '<button class="ep-cal__nav" type="button" data-ep-cal-nav="1" aria-label="Next month">' + icon('chevron-left', 14, 'style="transform:rotate(180deg)"') + '</button>' +
        '</div>' +
        grid(view, trigger) +
        (week ? '<p class="ep-cal__hint">Pick any day to select its ship week.</p>' : '') +
        '<div class="ep-cal__foot">' +
          '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-cal-today>Today</button>' +
          '<button class="ep-btn ep-btn--primary ep-btn--stack" type="button" data-ep-cal-close>Done</button>' +
        '</div>' +
      '</div>';

    host.classList.add('ep-is-open');
    var pop = host.querySelector('[data-ep-cal-pop]');
    place(pop, trigger);
    open = { trigger: trigger, view: view, el: pop };
    trigger.setAttribute('aria-expanded', 'true');
  }

  function place(pop, trigger) {
    var r = trigger.getBoundingClientRect();
    var pw = pop.offsetWidth;
    var ph = pop.offsetHeight;

    var left = Math.min(r.left, global.innerWidth - pw - 10);
    var top = r.bottom + 6;
    if (top + ph > global.innerHeight - 10) {
      var above = r.top - 6 - ph;
      top = above > 10 ? above : Math.max(10, global.innerHeight - ph - 10);
    }
    pop.style.left = Math.max(10, Math.round(left)) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }

  function close() {
    if (!open) { return; }
    open.trigger.setAttribute('aria-expanded', 'false');
    var host = document.querySelector('[data-ep-menu-layer]');
    if (host) { host.classList.remove('ep-is-open'); host.innerHTML = ''; }
    open = null;
  }

  function commit(trigger, d) {
    var week = trigger.getAttribute('data-ep-date-mode') === 'week';
    var value = week ? weekStart(d) : d;

    trigger.setAttribute('data-ep-date-value', iso(value));
    var slot = trigger.querySelector('[data-ep-date-label]');
    if (slot) { slot.textContent = week ? weekLabel(value) : fmt(value); }

    // keep a range in order — nudge the partner rather than reject the pick
    var mate = partner(trigger);
    if (mate) {
      var mateDate = parse(mate.getAttribute('data-ep-date-value'));
      var role = trigger.getAttribute('data-ep-date-role');
      var wrong = mateDate && (role === 'start' ? value > mateDate : value < mateDate);
      if (wrong) {
        mate.setAttribute('data-ep-date-value', iso(value));
        var mateSlot = mate.querySelector('[data-ep-date-label]');
        if (mateSlot) { mateSlot.textContent = week ? weekLabel(value) : fmt(value); }
      }
    }

    document.dispatchEvent(new CustomEvent('pulse:date', {
      detail: { trigger: trigger, value: iso(value), label: week ? weekLabel(value) : fmt(value) }
    }));
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t.closest) { return; }

    var day = t.closest('[data-ep-cal-day]');
    if (day && open) {
      ev.preventDefault();
      var picked = parse(day.getAttribute('data-ep-cal-day'));
      commit(open.trigger, picked);
      // re-render so the new selection and any range shading show
      render(open.trigger, new Date(picked.getFullYear(), picked.getMonth(), 1));
      return;
    }

    var nav = t.closest('[data-ep-cal-nav]');
    if (nav && open) {
      ev.preventDefault();
      var step = parseInt(nav.getAttribute('data-ep-cal-nav'), 10);
      var v = new Date(open.view.getFullYear(), open.view.getMonth() + step, 1);
      render(open.trigger, v);
      return;
    }

    if (t.closest('[data-ep-cal-today]') && open) {
      ev.preventDefault();
      commit(open.trigger, TODAY);
      render(open.trigger, new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
      return;
    }

    if (t.closest('[data-ep-cal-close]')) { ev.preventDefault(); close(); return; }

    var trigger = t.closest('[data-ep-date]');
    if (trigger) {
      ev.preventDefault();
      if (open && open.trigger === trigger) { close(); return; }
      if (mod('menus')) { mod('menus').close(); }
      var start = parse(trigger.getAttribute('data-ep-date-value')) || TODAY;
      render(trigger, new Date(start.getFullYear(), start.getMonth(), 1));
      return;
    }

    if (open && !t.closest('[data-ep-cal-pop]')) { close(); }
  });

  document.addEventListener('keydown', function (ev) {
    if (open && ev.key === 'Escape') {
      ev.preventDefault();
      var tr = open.trigger;
      close();
      if (tr.focus) { tr.focus(); }
    }
  });

  global.addEventListener('resize', close);

  // label every trigger from its value on load, so the markup only has to
  // carry the ISO date
  function hydrate() {
    document.querySelectorAll('[data-ep-date]').forEach(function (t) {
      var d = parse(t.getAttribute('data-ep-date-value'));
      if (!d) { return; }
      var slot = t.querySelector('[data-ep-date-label]');
      if (!slot || slot.textContent.trim()) { return; }
      slot.textContent = t.getAttribute('data-ep-date-mode') === 'week' ? weekLabel(d) : fmt(d);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }

  // The overlays are rendered by ep-shell.js on DOMContentLoaded, which is after
  // the listener above has already run — so ep-app.js calls hydrate() again once
  // everything exists. Without it, date fields inside run report and the filters drawer render
  // with an empty label.
  /* Deprecated alias, removed in 2.0.0 — use EpicPulse.datepicker. */
  global.datepicker = {
    today: TODAY, format: fmt, weekLabel: weekLabel, close: close, hydrate: hydrate
  };
  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.datepicker = global.datepicker;
}(window));
