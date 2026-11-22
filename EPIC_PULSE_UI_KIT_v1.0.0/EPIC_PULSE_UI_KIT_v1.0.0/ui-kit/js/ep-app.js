/* EPIC Pulse UI Kit — page-level interactions

   Generic, declarative behaviours shared by every screen, driven entirely by
   data attributes so the page HTML stays readable:

     data-ep-tabs="name"        + data-ep-tab="key"     tab strip
     data-ep-panel-group="name" + data-ep-panel-key="key"  panels the tabs reveal
     data-ep-segmented          + button              segmented / view switcher
     data-ep-toggle-chip                              independent on/off chip
     data-ep-radio-chip="group"                       one-of-many chip
     data-ep-radio-btn="group"                        one-of-many button
     data-ep-radio-card="group"                       one-of-many card (galleries)
     data-ep-check                                    checkbox row
     data-ep-switch                                   toggle switch
     data-ep-star                                     favourite star
     data-ep-select-row="group"                       one-of-many row (workspaces)
     data-ep-fab-bubble                               first-visit prompt bubble
     data-ep-tabs-deeplink                            strip honours ?tab=<key>
     data-ep-dirty-guard + data-ep-dirty-bar             unsaved-changes guard
     data-ep-env="browser|os|screen|cookies"          filled from the real client */

(function (global) {
  'use strict';

  /* Preferences are namespaced so two things using the kit can share an
     origin — a product and its component gallery, or two deployments —
     without overwriting each other. Set window.EP_STORAGE_PREFIX before
     the kit loads: it is read as each script parses, which is earlier
     than init() runs. */
  var STORE_PREFIX = global.EP_STORAGE_PREFIX || 'epic-pulse.';

  /* Modules find each other through the namespace first and the bare
     global second. A host page with its own window.menus or window.app
     must not be able to stand in for the kit's, whichever script tag
     comes first. The bare globals are deprecated and go in 2.0.0. */
  function mod(name) {
    var ns = global.EpicPulse;
    return (ns && ns[name]) || global[name];
  }

  /* The instance an interaction belongs to. A page marks a region with
     [data-ep-scope]; without one the scope is the document and behaviour is
     unchanged. It exists because the four behaviours below used to reach
     across the whole page, so two Report Libraries in one document drove
     each other. */
  function scopeFrom(origin) {
    return (origin && origin.closest && origin.closest('[data-ep-scope]')) || document;
  }

  function activateTab(strip, btn) {
    var group = strip.getAttribute('data-ep-tabs');
    strip.querySelectorAll('[data-ep-tab]').forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('ep-is-active', on);
      if (b.hasAttribute('aria-selected')) { b.setAttribute('aria-selected', on ? 'true' : 'false'); }
    });

    var key = btn.getAttribute('data-ep-tab');
    document.querySelectorAll('[data-ep-panel-group="' + group + '"]').forEach(function (p) {
      p.hidden = p.getAttribute('data-ep-panel-key') !== key;
    });

    // a tab may filter a card set in place rather than swap panels — the
    // Report Library category tabs work this way
    var cat = btn.getAttribute('data-ep-filter');
    if (cat !== null) { filterByCategory(cat, strip); }
  }

  /* --- settings environment panel -------------------------------------------
     The specification asks settings to report the *detected* browser, OS and resolution,
     so these are read off the real client rather than written into the page.
     Anything that cannot honestly be detected without acting on the user's
     behalf — the pop-up blocker — gets a button that tests it instead.
     -------------------------------------------------------------------- */

  var BROWSERS = [
    { re: /Edg\/(\d+)/,                  name: 'Edge',    min: 120 },
    { re: /Firefox\/(\d+)/,              name: 'Firefox', min: 121 },
    { re: /Chrome\/(\d+)/,               name: 'Chrome',  min: 120 },
    { re: /Version\/(\d+).*\bSafari\//,  name: 'Safari',  min: null }
  ];

  function detectBrowser() {
    var ua = global.navigator.userAgent;
    for (var i = 0; i < BROWSERS.length; i++) {
      var m = ua.match(BROWSERS[i].re);
      if (m) { return { name: BROWSERS[i].name, version: parseInt(m[1], 10), min: BROWSERS[i].min }; }
    }
    return { name: 'Unknown', version: 0, min: null };
  }

  function detectOs() {
    var ua = global.navigator.userAgent;
    if (/Windows NT 10/.test(ua)) { return 'Windows 10 or 11'; }
    if (/Windows/.test(ua)) { return 'Windows'; }
    if (/Android/.test(ua)) { return 'Android'; }
    if (/(iPhone|iPad|iPod)/.test(ua)) { return 'iOS or iPadOS'; }
    if (/Mac OS X/.test(ua)) { return 'macOS'; }
    if (/(Linux|X11)/.test(ua)) { return 'Linux'; }
    return 'Unknown';
  }

  function fillEnvironment() {
    if (!document.querySelector('[data-ep-env]')) { return; }

    var b = detectBrowser();
    var supported = b.min !== null && b.version >= b.min;
    var dpr = global.devicePixelRatio || 1;

    var values = {
      browser: b.name + ' ' + (b.version || '—'),
      os: detectOs(),
      screen: global.screen.width + ' × ' + global.screen.height +
              (dpr !== 1 ? ' at ' + (Math.round(dpr * 100) / 100) + '×' : ''),
      viewport: global.innerWidth + ' × ' + global.innerHeight + ' CSS px',
      cookies: global.navigator.cookieEnabled ? 'Enabled' : 'Blocked',
      storage: hasStorage() ? 'Available' : 'Blocked',
      language: global.navigator.language || '—',
      timezone: timezone()
    };

    document.querySelectorAll('[data-ep-env]').forEach(function (el) {
      var key = el.getAttribute('data-ep-env');
      if (values[key] != null) { el.textContent = values[key]; }
    });

    // the Supported / Not supported verdict the specification asks for
    document.querySelectorAll('[data-ep-env-verdict]').forEach(function (el) {
      el.textContent = supported ? 'Supported' : 'Not supported';
      el.classList.toggle('ep-badge--status-quiet', supported);
      el.classList.toggle('ep-badge--severity', !supported);
    });
    document.querySelectorAll('[data-ep-env-verdict-note]').forEach(function (el) {
      el.textContent = supported
        ? b.name + ' ' + b.version + ' meets the minimum of ' + b.min + '.'
        : b.min === null
          ? b.name + ' is not on the supported list. Pulse may work, but it is not tested against it.'
          : b.name + ' ' + b.version + ' is below the minimum of ' + b.min + '. Update before reporting a fault.';
    });

    // highlight this client's row in the browser matrix
    document.querySelectorAll('[data-ep-matrix-browser]').forEach(function (row) {
      row.classList.toggle('ep-is-selected-row', row.getAttribute('data-ep-matrix-browser') === b.name);
    });
  }

  function hasStorage() {
    try { global.localStorage.setItem(STORE_PREFIX + 'probe', '1');
          global.localStorage.removeItem(STORE_PREFIX + 'probe'); return true; }
    catch (e) { return false; }
  }

  function timezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '—'; }
    catch (e) { return '—'; }
  }

  /* --- settings unsaved-changes guard ---------------------------------------
     Editing anything inside a [data-ep-dirty-guard] reveals its [data-ep-dirty-bar]
     until the change is saved or discarded. The theme buttons are exempt:
     the theme is a live preference that persists the moment it is picked, so
     holding it hostage behind a Save would be a lie.
     -------------------------------------------------------------------- */

  function markDirty(el) {
    var guard = el.closest ? el.closest('[data-ep-dirty-guard]') : null;
    if (!guard) { return; }
    if (el.closest('[data-ep-theme-set], [data-ep-tab], [data-ep-seg], [data-ep-dirty-bar]')) { return; }
    var bar = guard.querySelector('[data-ep-dirty-bar]');
    if (bar) { bar.hidden = false; }
  }

  function clearDirty(guard) {
    var bar = guard && guard.querySelector('[data-ep-dirty-bar]');
    if (bar) { bar.hidden = true; }
  }

  function filterByCategory(cat, origin) {
    var root = scopeFrom(origin);
    var shown = 0;
    root.querySelectorAll('[data-ep-cat]').forEach(function (item) {
      var cats = item.getAttribute('data-ep-cat').split(/\s+/);
      var on = cat === 'all' || cats.indexOf(cat) > -1;
      item.hidden = !on;
      if (on) { shown++; }
    });

    // hide a section whose whole card set filtered out
    root.querySelectorAll('[data-ep-cat-section]').forEach(function (sec) {
      var items = sec.querySelectorAll('[data-ep-cat]');
      var visible = 0;
      items.forEach(function (i) { if (!i.hidden) { visible++; } });
      sec.hidden = items.length > 0 && visible === 0;
    });

    // "no results for this filter"
    var empty = root.querySelector('[data-ep-empty-filter]');
    if (empty) {
      empty.hidden = shown > 0;
      var label = empty.querySelector('[data-ep-empty-filter-name]');
      if (label) { label.textContent = cat === 'all' ? 'this filter' : cat.replace(/-/g, ' '); }
    }
  }

  function activateSegment(seg, btn) {
    seg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('ep-is-active', b === btn);
      if (b.hasAttribute('aria-selected')) { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); }
    });

    var group = seg.getAttribute('data-ep-segmented');
    var key = btn.getAttribute('data-ep-seg');
    if (!group || !key) { return; }
    document.querySelectorAll('[data-ep-panel-group="' + group + '"]').forEach(function (p) {
      p.hidden = p.getAttribute('data-ep-panel-key') !== key;
    });
  }

  function radio(attr, el, activeClass, idleClass) {
    var group = el.getAttribute(attr);
    var scope = el.closest('[data-ep-overlay-root], .ep-page, .ep-modal, .ep-drawer, body') || document;
    scope.querySelectorAll('[' + attr + '="' + group + '"]').forEach(function (b) {
      var on = b === el;
      if (activeClass) { b.classList.toggle(activeClass, on); }
      if (idleClass) { b.classList.toggle(idleClass, !on); }
      b.classList.toggle('ep-is-active', on);
    });
  }

  /* --- looping slider ----------------------------------------------------
     Any container marked data-ep-slider with a [data-ep-slider-track], one or more
     [data-ep-slider-slide], and matching [data-ep-slider-dot] buttons becomes a
     continuous carousel. Used by the Pulse Home first-run primer.

     show() takes the index modulo the slide count, so advancing past the last
     slide wraps to the first — that is what makes the loop continuous rather
     than stopping at the end.

     Accessibility: it pauses on hover and on keyboard focus, stops while the
     tab is hidden, and does not auto-advance at all under
     prefers-reduced-motion. The dots always work, so there is a way to reach
     every slide without waiting.
     ---------------------------------------------------------------------- */

  function initSliders() {
    document.querySelectorAll('[data-ep-slider]').forEach(function (root) {
      var track = root.querySelector('[data-ep-slider-track]');
      var slides = Array.prototype.slice.call(root.querySelectorAll('[data-ep-slider-slide]'));
      var dots = Array.prototype.slice.call(root.querySelectorAll('[data-ep-slider-dot]'));
      if (!track || slides.length < 2) { return; }

      var at = 0;
      var timer = null;
      var delay = parseInt(root.getAttribute('data-ep-slider-delay'), 10) || 6000;
      var still = global.matchMedia &&
                  global.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function show(n) {
        at = (n + slides.length) % slides.length;          // wrap = continuous loop
        track.style.transform = 'translateX(' + (at * -100) + '%)';
        slides.forEach(function (s, k) {
          s.classList.toggle('ep-is-on', k === at);
          s.setAttribute('aria-hidden', k === at ? 'false' : 'true');
        });
        dots.forEach(function (d, k) {
          d.classList.toggle('ep-is-on', k === at);
          if (k === at) { d.setAttribute('aria-current', 'true'); }
          else { d.removeAttribute('aria-current'); }
        });
      }

      function stop() { if (timer) { clearInterval(timer); timer = null; } }

      function start() {
        if (still || timer) { return; }
        timer = setInterval(function () {
          if (!root.isConnected) { stop(); return; }       // dismissed
          show(at + 1);
        }, delay);
      }

      dots.forEach(function (d, k) {
        d.addEventListener('click', function (ev) {
          ev.preventDefault();
          show(k);
          stop();
          start();                                          // restart the dwell
        });
      });

      root.addEventListener('mouseenter', stop);
      root.addEventListener('mouseleave', start);
      root.addEventListener('focusin', stop);
      root.addEventListener('focusout', start);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stop(); } else { start(); }
      });

      show(0);
      start();
    });
  }

  /* --- icon hydration ----------------------------------------------------
     Pages mark an icon slot as <span data-ep-icon="filter" data-ep-icon-size="14">
     instead of inlining the SVG, which keeps the page markup readable.
     ---------------------------------------------------------------------- */

  function hydrateIcons(scope) {
    (scope || document).querySelectorAll('[data-ep-icon]').forEach(function (el) {
      if (el.firstElementChild) { return; }
      var size = parseInt(el.getAttribute('data-ep-icon-size'), 10) || 14;
      el.innerHTML = mod('icon')(el.getAttribute('data-ep-icon'), size);
    });
  }

  function boot() {
    // ep-app.js loads last, so by here ep-shell.js has rendered the chrome and
    // ep-overlays.js the overlay layer — label everything in one pass
    hydrateIcons(document);
    if (mod('datepicker')) { mod('datepicker').hydrate(); }
    initSliders();

    // remember the assistant prompt bubble dismissal; it shows on first visit only
    var bubble = document.querySelector('[data-ep-fab-bubble]');
    if (bubble) {
      var seen = null;
      try { seen = global.localStorage.getItem(STORE_PREFIX + 'fab-seen'); } catch (e) {}
      if (seen === '1') { bubble.hidden = true; }
    }

    // reflect a ?reason=… arrival on the sign-in screen
    var banner = document.querySelector('[data-ep-auth-banner]');
    if (banner) {
      var reason = new URLSearchParams(global.location.search).get('reason');
      var copy = {
        signout: 'You have been signed out. Sign in again to pick up where you left off.',
        expired: 'Your session expired after 30 minutes of inactivity. Please sign in again.',
        locked: 'This account is locked after 5 failed attempts. Contact ' +
               ((global.EP_SESSION || {}).support || 'your administrator') + '.',
        invalid: 'That email and password combination was not recognised.'
      };
      var bannerText = banner.querySelector('[data-ep-auth-banner-text]');
      if (copy[reason] && bannerText) {
        bannerText.textContent = copy[reason];
        banner.classList.add('ep-is-shown');
      }
    }

    // the dashboard's state demo (loading / no-data / loaded)
    var stateSeg = document.querySelector('[data-ep-segmented="dashstate"]');
    if (stateSeg) {
      var want = new URLSearchParams(global.location.search).get('state');
      if (want) {
        var target = stateSeg.querySelector('[data-ep-seg="' + want + '"]');
        if (target) { activateSegment(stateSeg, target); }
      }
    }

    // the report viewer honours ?view=table|document|chart|summary
    var viewSeg = document.querySelector('[data-ep-segmented="reportview"]');
    if (viewSeg) {
      var v = new URLSearchParams(global.location.search).get('view');
      if (v) {
        var vb = viewSeg.querySelector('[data-ep-seg="' + v + '"]');
        if (vb) { activateSegment(viewSeg, vb); }
      }
    }

    // any strip marked data-ep-tabs-deeplink honours ?tab=<key>, so a link can
    // land on one tab of a tabbed screen (signals and alerts's tabs, settings's ?tab=about)
    var wantTab = null;
    try { wantTab = new URLSearchParams(global.location.search).get('tab'); } catch (e) {}
    if (wantTab) {
      document.querySelectorAll('[data-ep-tabs][data-ep-tabs-deeplink]').forEach(function (strip) {
        var btn = strip.querySelector('[data-ep-tab="' + wantTab + '"]');
        if (btn) { activateTab(strip, btn); }
      });
    }

    fillEnvironment();

    wire();
  }

  function wire() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t.closest) { return; }

      var tab = t.closest('[data-ep-tab]');
      if (tab) {
        var strip = tab.closest('[data-ep-tabs]');
        if (strip) { ev.preventDefault(); activateTab(strip, tab); return; }
      }

      var segBtn = t.closest('[data-ep-segmented] button');
      if (segBtn) {
        ev.preventDefault();
        activateSegment(segBtn.closest('[data-ep-segmented]'), segBtn);
        return;
      }

      var chip = t.closest('[data-ep-toggle-chip]');
      if (chip) {
        ev.preventDefault();
        var on = chip.classList.toggle('ep-chip--active');
        chip.classList.toggle('ep-chip--outline', !on);
        return;
      }

      var rchip = t.closest('[data-ep-radio-chip]');
      if (rchip) {
        ev.preventDefault();
        radio('data-ep-radio-chip', rchip, 'ep-chip--active', 'ep-chip--outline');
        return;
      }

      var rbtn = t.closest('[data-ep-radio-btn]');
      if (rbtn) {
        ev.preventDefault();
        radio('data-ep-radio-btn', rbtn, 'ep-btn--primary', 'ep-btn--ghost');
        return;
      }

      var rcard = t.closest('[data-ep-radio-card]');
      if (rcard) {
        ev.preventDefault();
        radio('data-ep-radio-card', rcard, null, null);
        return;
      }

      var check = t.closest('[data-ep-check]');
      if (check) {
        ev.preventDefault();
        check.classList.toggle('ep-is-on');
        check.setAttribute('aria-pressed', check.classList.contains('ep-is-on') ? 'true' : 'false');
        return;
      }

      var sw = t.closest('[data-ep-switch]');
      if (sw) {
        ev.preventDefault();
        var swEl = sw.matches('.ep-switch') ? sw : sw.querySelector('.ep-switch');
        if (swEl) {
          var isOn = swEl.classList.toggle('ep-is-on');
          sw.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        }
        return;
      }

      var star = t.closest('[data-ep-star]');
      if (star) {
        ev.preventDefault();
        star.classList.toggle('ep-star--off');
        var fav = !star.classList.contains('ep-star--off');
        star.setAttribute('aria-label', fav ? 'Remove from favourites' : 'Add to favourites');
        if (mod('overlays')) { mod('overlays').toast({ title: fav ? 'Added to favourites' : 'Removed from favourites', ttl: 2200 }); }
        return;
      }

      // A selectable row may contain its own controls (the builder tile has
      // duplicate and delete), so only select when the click was not on one.
      var row = t.closest('[data-ep-select-row]');
      if (row && !t.closest('button:not([data-ep-select-row])') && !t.closest('a')) {
        ev.preventDefault();
        radio('data-ep-select-row', row, 'ep-is-selected', null);
        if (row.classList.contains('ep-builder-tile')) { syncInspector(row); }
        return;
      }

      var discard = t.closest('[data-ep-dirty-discard]');
      if (discard) {
        ev.preventDefault();
        clearDirty(discard.closest('[data-ep-dirty-guard]'));
        toast({ title: 'Changes discarded', ttl: 2200 });
        return;
      }

      var saveSet = t.closest('[data-ep-dirty-save]');
      if (saveSet) {
        ev.preventDefault();
        clearDirty(saveSet.closest('[data-ep-dirty-guard]'));
        toast({ kind: 'ready', title: 'Settings saved', meta: 'Applied to this account across every device' });
        return;
      }

      // the pop-up blocker is the one environment fact that cannot be read
      // without acting, so settings offers to try it rather than claim it
      var popTest = t.closest('[data-ep-action="test-popup"]');
      if (popTest) {
        ev.preventDefault();
        var w = null;
        try { w = global.open('', '_blank', 'width=220,height=140'); } catch (e) {}
        if (w) {
          w.close();
          toast({ kind: 'ready', title: 'Pop-ups are allowed', meta: 'Report exports will open normally' });
          document.querySelectorAll('[data-ep-env-popups]').forEach(function (el) { el.textContent = 'Allowed'; });
        } else {
          toast({ kind: 'warn', title: 'Pop-ups are blocked', meta: 'Allow them for this site, or exports will not open' });
          document.querySelectorAll('[data-ep-env-popups]').forEach(function (el) { el.textContent = 'Blocked'; });
        }
        return;
      }

      var closeBubble = t.closest('[data-ep-fab-bubble-close], [data-ep-open="assistant"]');
      if (closeBubble) {
        var b = document.querySelector('[data-ep-fab-bubble]');
        if (b && !b.hidden) {
          b.hidden = true;
          try { global.localStorage.setItem(STORE_PREFIX + 'fab-seen', '1'); } catch (e) {}
        }
        return;
      }

      var reveal = t.closest('[data-ep-reveal]');
      if (reveal) {
        ev.preventDefault();
        var input = document.getElementById(reveal.getAttribute('data-ep-reveal'));
        if (input) {
          var shown = input.type === 'text';
          input.type = shown ? 'password' : 'text';
          reveal.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
        }
        return;
      }

      var dismiss = t.closest('[data-ep-dismiss]');
      if (dismiss) {
        ev.preventDefault();
        var card = dismiss.closest(dismiss.getAttribute('data-ep-dismiss') || '.ep-card');
        if (card) { card.remove(); }
        return;
      }

      // --- controls added for the interactive pass ----------------------

      // add chart tile's "Add tile" appends a real tile to the canvas
      if (t.closest('[data-ep-action="do-addtile"]')) { addBuilderTile(); return; }

      var fs = t.closest('[data-ep-fullscreen]');
      if (fs) { ev.preventDefault(); enterFullscreen(fs.closest('.ep-tile')); return; }

      if (t.closest('[data-ep-exit-fullscreen]')) { ev.preventDefault(); exitFullscreen(); return; }

      var printBtn = t.closest('[data-ep-print]');
      if (printBtn) { ev.preventDefault(); global.print(); return; }

      var layout = t.closest('[data-ep-layout]');
      if (layout) {
        ev.preventDefault();
        radio('data-ep-layout', layout, null, null);
        setLayout(layout.getAttribute('data-ep-layout-mode'), layout);
        return;
      }

      var favBtn = t.closest('[data-ep-fav-filter]');
      if (favBtn) {
        ev.preventDefault();
        var favOn = favBtn.classList.toggle('ep-is-on');
        favBtn.classList.toggle('ep-btn--primary', favOn);
        favBtn.classList.toggle('ep-btn--ghost', !favOn);
        favBtn.setAttribute('aria-pressed', favOn ? 'true' : 'false');
        filterFavourites(favOn, favBtn);
        return;
      }

      var tip = t.closest('[data-ep-tip]');
      if (tip) { ev.preventDefault(); showTip(tip); return; }

      var noteOpen = t.closest('[data-ep-note-open]');
      if (noteOpen) {
        ev.preventDefault();
        var form = document.querySelector('[data-ep-note-form]');
        if (form) {
          form.hidden = false;
          var openTa = form.querySelector('textarea');
          if (openTa) { openTa.focus(); }
        }
        return;
      }

      var noteSave = t.closest('[data-ep-note-save]');
      if (noteSave) { ev.preventDefault(); addNote(noteSave.closest('[data-ep-note-form]')); return; }

      var noteCancel = t.closest('[data-ep-note-cancel]');
      if (noteCancel) {
        ev.preventDefault();
        var nf = noteCancel.closest('[data-ep-note-form]');
        if (!nf) { return; }
        nf.hidden = true;
        var nfTa = nf.querySelector('textarea');
        if (nfTa) { nfTa.value = ''; }
        return;
      }

      var orderRow = t.closest('[data-ep-order]');
      if (orderRow && !t.closest('a')) { selectOrder(orderRow); return; }

      var ack = t.closest('[data-ep-ack]');
      if (ack) {
        ev.preventDefault();
        resolveSignal(ack.closest('.ep-card'), 'ack');
        toast({ kind: 'ready', title: 'Signal acknowledged',
                meta: 'Recorded against ' + ((global.EP_SESSION || {}).name || 'this account') });
        return;
      }

      var muteBtn = t.closest('[data-ep-mute-signal]');
      if (muteBtn) {
        ev.preventDefault();
        resolveSignal(muteBtn.closest('.ep-card'), 'mute');
        toast({ title: 'Signal muted for 24 hours', cta: 'Undo' });
        return;
      }

      var tileDup = t.closest('[data-ep-tile-dup]');
      if (tileDup) {
        ev.preventDefault();
        var src = tileDup.closest('.ep-builder-tile');
        if (!src) { return; }
        var copy = src.cloneNode(true);
        copy.classList.remove('ep-is-selected');
        copy.setAttribute('aria-pressed', 'false');
        var nameEl = copy.querySelector('.ep-builder-tile__name');
        if (nameEl) { nameEl.textContent = nameEl.textContent + ' (copy)'; }
        src.parentNode.insertBefore(copy, src.nextSibling);
        radio('data-ep-select-row', copy, 'ep-is-selected', null);
        syncInspector(copy);
        toast({ kind: 'ready', title: 'Tile duplicated', meta: nameEl ? nameEl.textContent : '' });
        return;
      }

      var tileDel = t.closest('[data-ep-tile-del]');
      if (tileDel) {
        ev.preventDefault();
        var doomed = tileDel.closest('.ep-builder-tile');
        if (!doomed) { return; }
        var labelEl = doomed.querySelector('.ep-builder-tile__name');
        var label = labelEl ? labelEl.textContent : '';
        var anchor = doomed.nextSibling;
        var parent = doomed.parentNode;
        doomed.remove();
        toast({
          kind: 'warn', title: 'Tile deleted', meta: label, cta: 'Undo',
          ttl: 6000, onCta: function () { parent.insertBefore(doomed, anchor); }
        });
        return;
      }

      var page = t.closest('[data-ep-page-btn]');
      if (page) {
        ev.preventDefault();
        var pager = page.closest('.ep-pager');
        if (!pager) { return; }
        pager.querySelectorAll('[data-ep-page-btn]').forEach(function (b) {
          b.classList.toggle('ep-is-active', b === page);
          if (b === page) { b.setAttribute('aria-current', 'page'); }
          else { b.removeAttribute('aria-current'); }
        });
        toast({ title: 'Page ' + page.textContent.trim() + ' of 3', ttl: 1800 });
        return;
      }

      var chipRemove = t.closest('[data-ep-chip-remove]');
      if (chipRemove) {
        ev.preventDefault();
        ev.stopPropagation();
        var chip = chipRemove.closest('.ep-chip');
        if (!chip) { return; }
        var name = chip.querySelector('[data-ep-chip-name]');
        chip.remove();
        toast({ title: 'Filter removed' + (name ? ': ' + name.textContent.trim() : ''), ttl: 2200, cta: 'Undo' });
        return;
      }
    });

    // menu picks
    document.addEventListener('pulse:action', function (ev) {
      onMenuAction(ev.detail.act, ev.detail.item, ev.detail.trigger);
    });

    // a committed date shows what it changed
    document.addEventListener('pulse:date', function (ev) {
      var t = ev.detail.trigger;
      if (t.hasAttribute('data-ep-date-quiet')) { return; }
      toast({ title: (t.getAttribute('data-ep-date-name') || 'Date') + ' set to ' + ev.detail.label, ttl: 2200 });
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { exitFullscreen(); }
    });

    // an edit anywhere inside a settings guard reveals its save bar
    document.addEventListener('click', function (ev) {
      var c = ev.target.closest && ev.target.closest(
        '[data-ep-check], [data-ep-switch], [data-ep-menu], [data-ep-radio-btn], [data-ep-radio-chip], [data-ep-toggle-chip], [data-ep-date]');
      if (c) { markDirty(c); }
    });

    document.addEventListener('input', function (ev) {
      if (ev.target.closest) { markDirty(ev.target); }
    });

    /* --- safety net --------------------------------------------------
       Every interactive control above calls preventDefault. Anything that
       reaches here is a button nobody wired, so it still acknowledges the
       click rather than feeling broken — and it shows up in review.
       ---------------------------------------------------------------- */
    document.addEventListener('click', function (ev) {
      if (!global.EpicPulse || !global.EpicPulse.config ||
          !global.EpicPulse.config.ackUnwired) { return; }
      if (ev.defaultPrevented) { return; }
      var btn = ev.target.closest && ev.target.closest('button, [role="button"]');
      if (!btn || btn.closest('a') || btn.type === 'submit') { return; }
      if (btn.hasAttribute('data-ep-menu') || btn.hasAttribute('data-ep-date') ||
          btn.hasAttribute('data-ep-open') || btn.hasAttribute('data-ep-close') ||
          btn.hasAttribute('data-ep-seg') || btn.hasAttribute('data-ep-tab')) { return; }
      var name = (btn.getAttribute('aria-label') || btn.textContent || 'Control').trim();
      toast({ title: name.slice(0, 60), ttl: 2000 });
    });

    // the alert-rule builder noise preview: the threshold drives the line, the count and the
    // too-noisy / no-match warnings
    var noiseInput = document.querySelector('[data-ep-noise-input]');
    if (noiseInput) {
      var runNoise = function () {
        var pct = parseFloat(noiseInput.value);
        if (isNaN(pct)) { return; }

        // The preview chart maps 96% to y=20 and 80% to y=165, so:
        //   y = 20 + (96 - pct) / 16 * 145
        // Keep this in step with the SVG in alert-rule.html.
        var y = 20 + ((96 - pct) / 16) * 145;
        y = Math.max(20, Math.min(165, y));
        var line = document.querySelector('[data-ep-noise-line]');
        if (line) { line.setAttribute('y1', y); line.setAttribute('y2', y); }

        // a fire is a sample below the line (larger y = lower value)
        var samples = [49.0, 43.6, 55.3, 59.9, 48.1, 63.5, 78.0, 67.1, 57.2, 52.6, 64.4, 70.7, 86.2, 72.6, 60.8, 56.2, 66.2, 81.6, 68.9, 58.1, 53.5, 88.9, 68.0, 61.7];
        var fires = samples.filter(function (s) { return s > y; }).length;

        document.querySelectorAll('[data-ep-noise-count], [data-ep-noise-count-2]')
          .forEach(function (el) { el.textContent = String(fires); });
        var echo = document.querySelector('[data-ep-noise-echo]');
        if (echo) { echo.textContent = String(pct); }

        var warn = document.querySelector('[data-ep-noise-warn]');
        var none = document.querySelector('[data-ep-noise-none]');
        if (warn) { warn.hidden = fires <= 6; }
        if (none) { none.hidden = fires !== 0; }
      };
      noiseInput.addEventListener('input', runNoise);
      runNoise();
    }

    // a text field marked data-ep-list-filter filters a list in place
    document.addEventListener('input', function (ev) {
      var f = ev.target.closest && ev.target.closest('[data-ep-list-filter]');
      if (!f) { return; }
      var q = (f.value || '').trim().toLowerCase();
      document.querySelectorAll(f.getAttribute('data-ep-list-filter')).forEach(function (row) {
        var hay = (row.getAttribute('data-ep-ws') || row.textContent).toLowerCase();
        row.hidden = q !== '' && hay.indexOf(q) === -1;
      });
    });

    // a form marked data-ep-goto navigates instead of submitting, so nothing is
    // serialised into the URL
    document.addEventListener('submit', function (ev) {
      var form = ev.target.closest && ev.target.closest('form[data-ep-goto]');
      if (!form) { return; }
      ev.preventDefault();
      var goto = form.getAttribute('data-ep-goto');
      if (global.EpicPulse && global.EpicPulse.navigate) { global.EpicPulse.navigate(goto); }
      else { global.location.href = goto; }
    });

    // keyboard support for the role="button" spans used as controls
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') { return; }
      var el = ev.target.closest && ev.target.closest('[role="button"][data-ep-check], [role="button"][data-ep-switch], [role="button"][data-ep-star]');
      if (el) { ev.preventDefault(); el.click(); }
    });
  }

  /* Behaviours driven by menu picks (dispatched as pulse:action by ep-menus.js) */

  function toast(opt) { if (mod('overlays')) { mod('overlays').toast(opt); } }

  function onMenuAction(act, item, trigger) {
    var kind = act.split(':')[0];
    var arg = act.split(':')[1];

    if (kind === 'density') {
      document.querySelectorAll('.ep-dtable').forEach(function (t) {
        t.classList.toggle('ep-dtable--compact', arg === 'compact');
      });
      toast({ title: 'Row density: ' + arg, ttl: 2000 });
      return true;
    }

    if (kind === 'group') {
      document.querySelectorAll('.ep-dtable__group').forEach(function (r) { r.hidden = arg === 'none'; });
      toast({ title: arg === 'none' ? 'Grouping removed' : 'Grouped by ' + arg, ttl: 2200 });
      return true;
    }

    if (kind === 'sort') { sortCards(arg, trigger); return true; }

    if (kind === 'columns') { applyColumns(trigger); return true; }

    if (kind === 'fullscreen') {
      var tile = trigger && trigger.closest ? trigger.closest('.ep-tile') : null;
      if (!tile) { tile = document.querySelector('.ep-tile'); }
      enterFullscreen(tile);
      return true;
    }

    return false;
  }

  function applyColumns(origin) {
    var table = scopeFrom(origin).querySelector('[data-ep-columns-table]');
    if (!table || !mod('menus')) { return; }
    var on = mod('menus').checked('columns').map(Number);
    var total = mod('menus').registry.columns.items.length;

    for (var c = 0; c < total; c++) {
      var show = on.indexOf(c) > -1;
      table.querySelectorAll('tr').forEach(function (row) {
        var cell = row.children[c];
        // group and total rows use colspan — leave them alone
        if (!cell || cell.hasAttribute('colspan')) { return; }
        cell.hidden = !show;
      });
    }
    // keep the group banner spanning the visible columns
    table.querySelectorAll('[colspan]').forEach(function (cell) {
      cell.setAttribute('colspan', String(on.length));
    });
  }

  function sortCards(mode, origin) {
    var labels = { recent: 'Recently used', shared: 'Most shared', az: 'A – Z', fresh: 'Freshness' };
    scopeFrom(origin).querySelectorAll('[data-ep-sortable]').forEach(function (grid) {
      var cards = Array.prototype.slice.call(grid.children);
      cards.sort(function (a, b) {
        if (mode === 'az') {
          return (a.getAttribute('data-ep-name') || '').localeCompare(b.getAttribute('data-ep-name') || '');
        }
        var key = mode === 'shared' ? 'data-ep-shares' : mode === 'fresh' ? 'data-ep-fresh' : 'data-ep-recent';
        return (parseInt(a.getAttribute(key), 10) || 0) - (parseInt(b.getAttribute(key), 10) || 0);
      });
      cards.forEach(function (c) { grid.appendChild(c); });
    });
    toast({ title: 'Sorted by ' + (labels[mode] || mode), ttl: 2200 });
  }

  function setLayout(mode, origin) {
    scopeFrom(origin).querySelectorAll('[data-ep-sortable]').forEach(function (grid) {
      grid.classList.toggle('ep-grid--list', mode === 'list');
    });
  }

  function filterFavourites(on, origin) {
    var root = scopeFrom(origin);
    var shown = 0;
    root.querySelectorAll('[data-ep-cat]').forEach(function (card) {
      if (!on) { card.hidden = false; shown++; return; }
      var fav = card.hasAttribute('data-ep-fav');
      card.hidden = !fav;
      if (fav) { shown++; }
    });
    root.querySelectorAll('[data-ep-cat-section]').forEach(function (sec) {
      var items = sec.querySelectorAll('[data-ep-cat]');
      var visible = 0;
      items.forEach(function (i) { if (!i.hidden) { visible++; } });
      sec.hidden = items.length > 0 && visible === 0;
    });
    toast({ title: on ? 'Showing favourites only' : 'Showing all reports', ttl: 2000 });
  }

  var fsScrim = null;

  function enterFullscreen(tile) {
    if (!tile) { return; }
    exitFullscreen();
    fsScrim = document.createElement('div');
    fsScrim.className = 'ep-fullscreen-scrim';
    fsScrim.addEventListener('click', exitFullscreen);
    document.body.appendChild(fsScrim);
    tile.classList.add('ep-is-fullscreen');
    document.body.classList.add('ep-is-locked');
    toast({ title: 'Full screen · press Escape to exit', ttl: 2600 });
  }

  function exitFullscreen() {
    var tile = document.querySelector('.ep-tile.ep-is-fullscreen');
    if (tile) { tile.classList.remove('ep-is-fullscreen'); }
    if (fsScrim) { fsScrim.remove(); fsScrim = null; }
    document.body.classList.remove('ep-is-locked');
  }

  function showTip(anchor) {
    if (!mod('menus')) { return; }
    var host = mod('menus').ensureLayer();
    var title = anchor.getAttribute('data-ep-tip-title') || '';
    host.innerHTML = '<div class="ep-pop ep-tip" role="tooltip" data-ep-tip-pop>' +
      (title ? '<strong class="ep-tip__title">' + title + '</strong>' : '') +
      anchor.getAttribute('data-ep-tip') + '</div>';
    host.classList.add('ep-is-open');
    var pop = host.querySelector('[data-ep-tip-pop]');
    if (!pop) { return; }
    var r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(10, Math.min(r.left - 8, global.innerWidth - pop.offsetWidth - 10)) + 'px';
    pop.style.top = (r.bottom + 6 + pop.offsetHeight > global.innerHeight
      ? Math.max(10, r.top - 6 - pop.offsetHeight)
      : r.bottom + 6) + 'px';
  }

  function addNote(form) {
    if (!form) { return; }
    var ta = form.querySelector('textarea');
    if (!ta) { return; }
    var text = (ta.value || '').trim();
    if (!text) { ta.focus(); return; }
    var list = document.querySelector('[data-ep-notes]');
    if (!list) { return; }
    var note = document.createElement('div');
    note.className = 'ep-evidence-note';
    note.innerHTML =
      '<span class="ep-avatar ep-avatar--26">' + ((global.EP_SESSION || {}).initials || '') + '</span>' +
      '<div class="ep-evidence-note__text">' +
        '<span class="ep-evidence-note__body"></span>' +
        '<span class="ep-evidence-note__by">' + ((global.EP_SESSION || {}).name || '') + ' \u00b7 just now</span>' +
      '</div>';
    note.querySelector('.ep-evidence-note__body').textContent = text;
    list.appendChild(note);
    ta.value = '';
    form.hidden = true;
    toast({ kind: 'ready', title: 'Note added to the finding', meta: 'It travels with the finding when shared' });
  }

  /** Reflect the selected tile in the inspector, so an appended tile does not
      leave the panel describing a different one. */
  function syncInspector(tile) {
    if (!tile) { return; }
    var name = (tile.querySelector('.ep-builder-tile__name') || {}).textContent || '';
    name = name.trim();
    var label = document.querySelector('[data-ep-inspector-name]');
    var title = document.querySelector('[data-ep-inspector-title]');
    if (label) { label.textContent = name; }
    if (title) { title.value = name; }
  }

  /** Append a tile in the form chosen in add chart tile, cloning that form's template. */
  function addBuilderTile() {
    var canvas = document.querySelector('.ep-builder__canvas');
    var drop = canvas && canvas.querySelector('.ep-builder-drop');
    if (!canvas || !drop) { return; }

    var picked = document.querySelector('[data-ep-radio-card="chartform"].ep-is-active');
    var pickedLabel = picked && picked.querySelector('span:last-of-type');
    var form = pickedLabel ? (pickedLabel.textContent || '').trim() : 'Line';

    var titled = document.querySelector('[data-ep-addtile-title]');
    var name = (titled && titled.value.trim()) || form + ' tile';

    var tpl = document.querySelector('[data-ep-tile-form="' + form + '"]');

    var tile = document.createElement('article');
    tile.className = 'ep-builder-tile';
    tile.setAttribute('data-ep-select-row', 'tile');
    tile.setAttribute('aria-pressed', 'false');
    tile.innerHTML =
      '<span class="ep-builder-tile__flag">SELECTED</span>' +
      '<div class="ep-builder-tile__head">' +
        '<span class="ep-builder-tile__name"></span>' +
        '<div class="ep-builder-tile__tools">' +
          '<button type="button" data-ep-tile-dup aria-label="Duplicate tile">' + mod('icon')('duplicate', 13) + '</button>' +
          '<button type="button" data-ep-tile-del aria-label="Delete tile">' + mod('icon')('trash', 13) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ep-builder-tile__viz"></div>';
    tile.querySelector('.ep-builder-tile__name').textContent = name;
    if (tpl) {
      tile.querySelector('.ep-builder-tile__viz').appendChild(tpl.content.cloneNode(true));
    }

    canvas.insertBefore(tile, drop);

    // the new tile becomes the selection, as it would after any insert
    radio('data-ep-select-row', tile, 'ep-is-selected', null);
    syncInspector(tile);

    var count = canvas.querySelectorAll('.ep-builder-tile').length;
    toast({
      kind: 'ready', title: 'Tile added', meta: name + ' · ' + form + ' · ' + count + ' tiles on the canvas',
      cta: 'Undo', ttl: 6000,
      onCta: function () {
        tile.remove();
        var last = canvas.querySelector('.ep-builder-tile:last-of-type');
        if (last) { radio('data-ep-select-row', last, 'ep-is-selected', null); syncInspector(last); }
      }
    });
  }

  function selectOrder(row) {
    var order = row.getAttribute('data-ep-order');
    var stage = row.getAttribute('data-ep-stage');
    var late = row.getAttribute('data-ep-late');
    var promised = row.getAttribute('data-ep-promised');
    var projected = row.getAttribute('data-ep-projected');

    document.querySelectorAll('[data-ep-order]').forEach(function (r) {
      r.classList.toggle('ep-is-selected-row', r === row);
    });

    var title = document.querySelector('[data-ep-timeline-title]');
    var sub = document.querySelector('[data-ep-timeline-sub]');
    if (title) { title.textContent = order + ' — stage timeline'; }
    if (sub) {
      sub.textContent = 'Promised ' + promised + ' · projected ' + projected +
                        ' · the delay sits in ' + stage.toLowerCase();
    }

    // highlight the stage this order is sitting in, and re-tag the delay
    document.querySelectorAll('[data-ep-stage-row]').forEach(function (r) {
      var on = r.getAttribute('data-ep-stage-row') === stage;
      var stageLabel = r.querySelector('.ep-bar-row__label');
      if (stageLabel) { stageLabel.classList.toggle('ep-is-strong', on); }
      var seg = r.querySelector('.ep-bar-row__seg');
      if (seg) { seg.style.background = on ? 'var(--ep-chart-6)' : seg.getAttribute('data-ep-base'); }
      var tag = r.querySelector('.ep-bar-row__tag');
      if (tag) { tag.hidden = !on; tag.textContent = '+' + late + ' days'; }
    });
  }

  function resolveSignal(card, mode) {
    if (!card) { return; }
    if (mode === 'ack') {
      var badge = card.querySelector('.ep-badge--severity');
      if (badge) {
        badge.textContent = 'ACKNOWLEDGED';
        badge.classList.remove('ep-badge--severity');
        badge.classList.add('ep-badge--outline');
      }
      card.classList.add('ep-is-acknowledged');
    } else {
      card.hidden = true;
      var live = document.querySelector('[data-ep-active-count]');
      if (live) { live.textContent = String(Math.max(0, (parseInt(live.textContent, 10) || 1) - 1)); }
    }
  }

  /* Page-level behaviour re-runs on demand: a page that injects markup
     after load calls this to wire it. Deliberately the only export —
     everything else here is reached through a hook, not a function. */
  global.EpicPulse = global.EpicPulse || {};
  global.EpicPulse.app = { boot: boot };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(window));
