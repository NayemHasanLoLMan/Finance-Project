/* EPIC Pulse UI Kit — dropdown menus

   Any element becomes a menu trigger with one attribute:

     <button data-ep-menu="dashboards">
       <span data-ep-menu-label>Current selection</span>
       <span class="caret" data-ep-icon="chevron-down"></span>
     </button>

   The option lists live in the MENUS registry below, populated with sample
   data consistent with the rest of the prototype (the same units, lines,
   customers, metrics and teams the design source uses). Single-select menus write
   the chosen label back into [data-ep-menu-label]; multi-select menus tick
   items, stay open and summarise the selection.

   An item may carry a behaviour instead of, or as well as, being a value:
     href:    navigate
     overlay: open an overlay by name (see ep-overlays.js)
     toast:   show an toasts & progress toast with this title
     act:     dispatch a named action, handled in ep-app.js / ep-overlays.js */

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
  var layer = null;
  var current = null;      // { name, trigger, el, def }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Registry */

  /* The menu engine ships without menus. A page supplies its own through
     window.EP_MENUS, or EpicPulse.init({ menus }). With none, open() finds no
     definition and returns — an unpopulated trigger, not a thrown error. */
  var MENUS = global.EP_MENUS || {};

  function ensureLayer() {
    if (layer) { return layer; }
    layer = document.createElement('div');
    layer.className = 'ep-menu-layer';
    layer.setAttribute('data-ep-menu-layer', '');
    document.body.appendChild(layer);
    return layer;
  }

  function itemHtml(item, def, i) {
    if (item.sep) { return '<div class="ep-menu__sep" role="separator"></div>'; }
    if (item.head) { return '<div class="ep-menu__head">' + esc(item.head) + '</div>'; }

    var selected = def.multi
      ? !!item.checked
      : (item.v != null && item.v === def.value);

    var marker = def.multi
      ? '<span class="ep-menu__box">' + icon('check-thick', 10) + '</span>'
      : '<span class="ep-menu__tick">' + icon('check-thick', 12) + '</span>';

    return '<button class="ep-menu__item' +
             (item.rich ? ' ep-menu__item--rich' : '') +
             (selected ? ' ep-is-selected' : '') +
             (item.danger ? ' ep-is-danger' : '') + '"' +
           ' type="button" role="menuitem" data-ep-mi="' + i + '"' +
           (item.locked ? ' data-ep-locked="1"' : '') + '>' +
             marker +
             (item.icon ? '<span class="ep-menu__icon">' + icon(item.icon, 14) + '</span>' : '') +
             '<span class="ep-menu__text">' +
               '<span class="ep-menu__label">' + esc(item.l) + '</span>' +
               (item.note ? '<span class="ep-menu__note">' + esc(item.note) + '</span>' : '') +
             '</span>' +
             (item.meta ? '<span class="ep-menu__meta">' + esc(item.meta) + '</span>' : '') +
           '</button>';
  }

  function listHtml(def, query) {
    var q = (query || '').trim().toLowerCase();
    var rows = def.items.map(function (item, i) {
      if (q && !item.sep && !item.head && String(item.l).toLowerCase().indexOf(q) === -1) { return ''; }
      if (q && item.head) { return ''; }
      return itemHtml(item, def, i);
    }).join('');
    return rows.replace(/^(?:<div class="ep-menu__sep"[^>]*><\/div>)+/, '') ||
           '<div class="ep-menu__empty">No matches</div>';
  }

  function open(name, trigger) {
    var def = MENUS[name];
    if (!def) { return; }
    close();

    var host = ensureLayer();
    // when the trigger is itself a text field (the global search), the field
    // does the filtering and the menu shows results only
    var viaInput = trigger.tagName === 'INPUT';
    var multiFoot = def.multi
      ? '<div class="ep-menu__foot">' +
          '<button class="ep-btn ep-btn--ghost ep-btn--stack" type="button" data-ep-menu-clear>Clear</button>' +
          '<button class="ep-btn ep-btn--primary ep-btn--stack" type="button" data-ep-menu-done>Done</button>' +
        '</div>'
      : '';

    host.innerHTML =
      '<div class="ep-pop ep-menu" role="menu" data-ep-menu-pop aria-label="' + esc(def.title || name) + '">' +
        (def.title ? '<div class="ep-menu__head">' + esc(def.title) + '</div>' : '') +
        (def.search && !viaInput
          ? '<div class="ep-menu__search"><input type="search" data-ep-menu-filter placeholder="' + esc(def.search) + '" aria-label="' + esc(def.search) + '"></div>'
          : '') +
        '<div class="ep-menu__list" data-ep-menu-list>' +
          listHtml(def, viaInput ? trigger.value : '') +
        '</div>' +
        multiFoot +
      '</div>';

    host.classList.add('ep-is-open');
    current = { name: name, def: def, trigger: trigger, el: host.querySelector('[data-ep-menu-pop]'), viaInput: viaInput };
    place(current.el, trigger);
    trigger.setAttribute('aria-expanded', 'true');

    if (!viaInput) {
      var f = host.querySelector('[data-ep-menu-filter]');
      if (f) { setTimeout(function () { f.focus(); }, 30); }
    }
  }

  function place(pop, trigger) {
    var r = trigger.getBoundingClientRect();
    var pw = pop.offsetWidth;
    var ph = pop.offsetHeight;
    var gap = 6;

    var left = r.left;
    if (left + pw > global.innerWidth - 10) { left = Math.max(10, r.right - pw); }
    if (left < 10) { left = 10; }

    var top = r.bottom + gap;
    if (top + ph > global.innerHeight - 10) {
      var above = r.top - gap - ph;
      top = above > 10 ? above : Math.max(10, global.innerHeight - ph - 10);
    }

    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }

  /* Whether the layer is showing anything — which is not the same question
     as whether open() put it there. A tooltip goes straight into the layer. */
  function showing() {
    return !!current || !!(layer && layer.classList.contains('ep-is-open'));
  }

  function close() {
    if (!current) {
      if (layer && layer.classList.contains('ep-is-open')) {
        layer.classList.remove('ep-is-open');
        layer.innerHTML = '';
      }
      return;
    }
    if (current.trigger) { current.trigger.setAttribute('aria-expanded', 'false'); }
    if (layer) { layer.classList.remove('ep-is-open'); layer.innerHTML = ''; }
    current = null;
  }

  /* Selection */

  function summarise(def) {
    var on = def.items.filter(function (i) { return i.checked; });
    if (!on.length) { return 'None'; }
    if (on.length === 1) { return on[0].l; }
    var all = def.items.filter(function (i) { return i.v != null; });
    if (on.length === all.length) { return 'All ' + all.length; }
    return on.length + ' selected';
  }

  function setLabel(trigger, text) {
    if (!trigger) { return; }
    var slot = trigger.querySelector('[data-ep-menu-label]');
    if (slot) { slot.textContent = text; }
  }

  function behave(item, trigger) {
    if (item.toast && mod('overlays')) { mod('overlays').toast({ title: item.toast }); }
    if (item.overlay && mod('overlays')) { mod('overlays').open(item.overlay, trigger); }
    if (item.act) { dispatch(item.act, item, trigger); }
    if (item.href) {
      if (global.EpicPulse && global.EpicPulse.navigate) { global.EpicPulse.navigate(item.href); }
      else { global.location.href = item.href; }
      return true;
    }
    return false;
  }

  function dispatch(act, item, trigger) {
    document.dispatchEvent(new CustomEvent('pulse:action', {
      detail: { act: act, item: item, trigger: trigger, menu: current ? current.name : null }
    }));
  }

  function pick(idx) {
    if (!current) { return; }
    var def = current.def;
    var item = def.items[idx];
    if (!item || item.sep || item.head) { return; }

    if (def.multi) {
      if (item.locked) {
        if (mod('overlays')) { mod('overlays').toast({ title: item.l + ' cannot be hidden', ttl: 2200 }); }
        return;
      }
      item.checked = !item.checked;
      setLabel(current.trigger, summarise(def));
      var listEl = layer && layer.querySelector('[data-ep-menu-list]');
      var filterEl = layer && layer.querySelector('[data-ep-menu-filter]');
      if (listEl) { listEl.innerHTML = listHtml(def, filterEl ? filterEl.value : ''); }
      if (def.act) { dispatch(def.act, item, current.trigger); }
      if (item.act) { dispatch(item.act, item, current.trigger); }
      return;
    }

    if (item.v != null) { def.value = item.v; setLabel(current.trigger, item.l); }
    var trigger = current.trigger;
    close();
    behave(item, trigger);
  }

  /* Wiring */

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t.closest) { return; }

    var mi = t.closest('[data-ep-mi]');
    if (mi) { ev.preventDefault(); pick(parseInt(mi.getAttribute('data-ep-mi'), 10)); return; }

    if (t.closest('[data-ep-menu-done]')) { ev.preventDefault(); close(); return; }

    if (t.closest('[data-ep-menu-clear]')) {
      ev.preventDefault();
      if (current && current.def.multi) {
        current.def.items.forEach(function (i) { if (!i.locked) { i.checked = false; } });
        setLabel(current.trigger, summarise(current.def));
        var clearList = layer && layer.querySelector('[data-ep-menu-list]');
        if (clearList) { clearList.innerHTML = listHtml(current.def); }
        if (current.def.act) { dispatch(current.def.act, null, current.trigger); }
      }
      return;
    }

    var trigger = t.closest('[data-ep-menu]');
    if (trigger) {
      // never swallow the click on a text field — it has to be able to focus
      if (trigger.tagName !== 'INPUT') { ev.preventDefault(); }
      var name = trigger.getAttribute('data-ep-menu');
      if (current && current.trigger === trigger) {
        if (trigger.tagName !== 'INPUT') { close(); }
      } else {
        open(name, trigger);
      }
      return;
    }

    // a click anywhere else closes whatever the layer is showing — a menu or
    // a tooltip. Clicks inside either one are left alone.
    if (showing() && !t.closest('[data-ep-menu-pop]') && !t.closest('[data-ep-tip-pop]')) { close(); }
  });

  document.addEventListener('input', function (ev) {
    if (!current) { return; }
    var f = ev.target.closest && ev.target.closest('[data-ep-menu-filter]');
    // filtering comes either from the menu's own field or from an input trigger
    if (!f && !(current.viaInput && ev.target === current.trigger)) { return; }
    var filterList = layer && layer.querySelector('[data-ep-menu-list]');
    if (!filterList) { return; }
    filterList.innerHTML = listHtml(current.def, (f || current.trigger).value);
    place(current.el, current.trigger);
  });

  document.addEventListener('keydown', function (ev) {
    if (!current) {
      // no menu to walk, but a tooltip still has to answer to Escape
      if (ev.key === 'Escape' && showing()) { ev.preventDefault(); close(); }
      return;
    }
    var items = Array.prototype.slice.call(layer.querySelectorAll('.ep-menu__item'));
    var at = items.indexOf(document.activeElement);

    if (ev.key === 'Escape') {
      ev.preventDefault();
      var tr = current.trigger;
      close();
      if (tr && tr.focus) { tr.focus(); }
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      (items[at + 1] || items[0] || {}).focus && (items[at + 1] || items[0]).focus();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      (items[at - 1] || items[items.length - 1] || {}).focus && (items[at - 1] || items[items.length - 1]).focus();
    }
  });

  global.addEventListener('resize', close);
  global.addEventListener('scroll', function () { if (current) { place(current.el, current.trigger); } }, true);

  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.menus = global.menus = {
    open: open,
    close: close,
    registry: MENUS,
    /** current value of a single-select menu */
    value: function (name) { return MENUS[name] && MENUS[name].value; },
    /** checked values of a multi-select menu */
    checked: function (name) {
      var d = MENUS[name];
      if (!d) { return []; }
      return d.items.filter(function (i) { return i.checked; }).map(function (i) { return i.v; });
    },
    ensureLayer: ensureLayer
  };
}(window));
