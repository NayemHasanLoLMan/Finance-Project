# EPIC Pulse UI Kit

The interface of EPIC Pulse, packaged so another team can build screens with
it. Plain CSS and plain JavaScript that a browser loads directly: no build
step, no package manager, no framework, and no network requests. Copy the
folder, open a file, and everything in it works.

**Version 1.0.0.** `ui-kit/VERSION` is the single source of truth.

Start with `ui-templates.html`. It is the component reference: every element
the kit ships, rendered live by the kit itself, with the markup to copy beside
it and a note saying why the element is the way it is. Open it from your file
system — no server required.

---

## 1 · Contents

```
ui-kit/                    the kit itself — copy this folder whole
  css/                     12 stylesheets, loaded in order (section 3)
  js/                      9 scripts, loaded in order (section 4)
  assets/                  the typeface, the brand lockups, the favicon
  VERSION                  which release this is

ui-templates.html          the component reference — start here
example-project/           five working screens built from the kit
README.md                  this file
THIRD_PARTY_NOTICES        terms for the typeface and the two MIT sources
```

Nothing in this folder refers to anything outside it. Every path in every file
resolves inside it, and no page fetches anything from the network — the
typeface is included rather than linked.

---

## 2 · Setting up a project

Copy `ui-kit/` into your project and leave it whole. The layers are meant to
be picked from per screen, not pruned from the folder: deleting one you think
you do not need is how a screen ends up missing a rule nobody can find.

A screen is an ordinary HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your screen</title>

<link rel="stylesheet" href="ui-kit/css/ep-fonts.css">
<link rel="stylesheet" href="ui-kit/css/ep-tokens.css">
<link rel="stylesheet" href="ui-kit/css/ep-reset.css">
<link rel="stylesheet" href="ui-kit/css/ep-base.css">
<link rel="stylesheet" href="ui-kit/css/ep-controls.css">
<link rel="stylesheet" href="ui-kit/css/ep-surfaces.css">
<link rel="stylesheet" href="ui-kit/css/ep-shell.css">
<link rel="stylesheet" href="ui-kit/css/ep-extended.css">
<script src="ui-kit/js/ep-theme.js"></script>
</head>

<body data-ep-nav="home" data-ep-crumb="PULSE" data-ep-title="Home">

  <div class="ep-app">
    <div data-ep-mount="sidebar"></div>
    <div class="ep-app__main">
      <div data-ep-mount="topbar"></div>
      <main class="ep-page">
        <!-- your screen -->
      </main>
    </div>
  </div>

  <div data-ep-mount="overlays"></div>

  <script src="ui-kit/js/ep-hooks.js"></script>
  <script src="ui-kit/js/ep-dialog.js"></script>
  <script src="app-config.js"></script>
  <script src="ui-kit/js/ep-icons.js"></script>
  <script src="ui-kit/js/ep-menus.js"></script>
  <script src="ui-kit/js/ep-datepicker.js"></script>
  <script src="ui-kit/js/ep-shell.js"></script>
  <script src="ui-kit/js/ep-overlays.js"></script>
  <script src="ui-kit/js/ep-app.js"></script>
</body>
</html>
```

**The three mount points are the contract.** The kit replaces each one with
the chrome it owns: the sidebar, the topbar, and every overlay — dialogs, the
drawer, the assistant, the account popover and the toast dock. Leave the
overlays mount out and every control that opens one is inert; leave the topbar
mount out and the screen is treated as an auth screen, which is how sign-in
ends up without an assistant.

**Referencing the kit from a different depth.** Paths in the markup are
relative to the page, so a screen in a subfolder writes `../ui-kit/css/…`.
Paths *inside* the kit are relative to the kit and need no adjustment.

**Declaring your application's data.** The kit holds none of your content.
Everything specific to your application is supplied from outside it, in a file
of your own — `app-config.js` in the skeleton above:

```js
window.EP_SESSION = { name: 'A. Person', initials: 'AP',
                      email: 'person@example.com', role: 'Analyst',
                      workspaceName: 'Operations', workspaceMark: 'OP',
                      version: '1.0.0' };

window.EP_NAV = [{ group: 'Pulse', items: [
  { id: 'home', label: 'Home', icon: 'home', href: 'home.html' }
]}];

window.EP_MENUS  = { /* trigger name → { title, items } */ };
window.EP_ROUTES = { home: 'home.html', signin: 'index.html' };
window.EP_BRAND  = { name: 'Your product', logo: 'assets/logo.png' };
window.EP_TODAY  = '2026-12-18';   // omit for the real date
```

Anything you do not supply is simply not rendered: an empty navigation rather
than somebody else's, and no link at all rather than a link into a page you do
not have. `EpicPulse.init({ session, nav, menus, routes, brand, today })` takes
the same shape and suits a bundler; where both are set, `init()` wins.

The reference page's *Getting started* section carries all of this as copyable
snippets, and `example-project/app-config.js` is a complete, working one.

**Configuration that differs per screen.** Most of what you declare is the same
on every screen — the session, the navigation, the brand, the routes. Some of
it is not, and a single file that carries every screen's worth of it grows into
something nobody wants to edit. Keep what is common in `app-config.js` and give
a screen with additions of its own a second file, loaded after the shared one
and before the kit's scripts:

```html
<script src="app-config.js"></script>
<script src="dashboard-config.js"></script>
<script src="ui-kit/js/ep-menus.js"></script>
```

**The second file is optional, and most screens do not need one.** A screen
with nothing of its own to declare loads `app-config.js` and stops there. Add a
per-screen file only where a screen genuinely has something the others do not,
and name it for that screen, so where a value comes from is answered by the
file list rather than by reading both files.

Where you do add one, it extends what the first declared. Menus are the usual
case — every screen opens the few the shell renders in the topbar, and a
screen adds the ones its own controls open:

```js
window.EP_MENUS = window.EP_MENUS || {};

window.EP_MENUS.lines = {
  title: 'Line',
  multi: true,
  items: [{ v: 'line-1', l: 'Line 1' }, { v: 'line-2', l: 'Line 2' }]
};
```

Where a file builds its values rather than stating them, wrap it so the working
names stay out of the global scope:

```js
(function (global) {
  'use strict';

  var MENUS = global.EP_MENUS = global.EP_MENUS || {};

  MENUS.lines = {
    title: 'Line',
    multi: true,
    items: [1, 2, 3, 4, 5, 6].map(function (n) {
      return { v: 'line-' + n, l: 'Line ' + n };
    })
  };
}(window));
```

**Add keys; do not reassign.** This holds for every one of the globals. Writing
`window.EP_MENUS = { … }` in the second file replaces what the first declared
instead of extending it, and the same is true of `EP_ROUTES`, `EP_BRAND` and
the rest. `EpicPulse.init()` behaves the same way: it swaps a whole value
rather than merging into it. Nothing reports an error — the shared half simply
stops working, so a menu stops opening or a link stops being rendered.

**All of it must be in place before the kit's scripts parse**, because they read
their configuration once and keep it. Menus are the single exception: they are
read into a registry that stays live, so a menu whose items depend on data you
have to fetch can be added afterwards through `EpicPulse.menus.registry`.
Everything else has to be declared up front.

---

## 3 · Which stylesheets a screen loads

| # | Layer | What it carries | Loaded by |
|---:|---|---|---|
| 1 | `ep-fonts.css` | the typeface | optional — `@font-face` only |
| 2 | `ep-tokens.css` | colour, type, spacing, radius, shadow | **always, first** |
| 3 | `ep-reset.css` | element normalisation | **always**, unless your page has its own reset |
| 4 | `ep-base.css` | type scale, text and layout utilities | **always** |
| 5 | `ep-controls.css` | buttons, chips, fields, switches, tabs | every screen |
| 6 | `ep-surfaces.css` | cards, notes, states, skeletons, feed rows, the build strip | every screen |
| 7 | `ep-data.css` | KPIs, charts, tables | data screens |
| 8 | `ep-shell.css` | the application frame | every authenticated screen |
| 9 | `ep-overlays.css` | dialogs, drawer, popovers, assistant, toasts | screens with any of them |
| 10 | `ep-screens.css` | the screen assemblies | the screens that use them |
| 11 | `ep-auth.css` | the sign-in screen | sign-in |
| 12 | `ep-extended.css` | menus, calendar, tooltip, and the deliberate overrides | **last, and meant to win** |

Three of these orderings are load-bearing rather than tidy:

- **Tokens, then reset, then base.** Every later layer resolves variables the
  token file declares and assumes the reset normalised the box model.
- **Layers 5 to 11 are additive and order-free between themselves.** That is
  what lets a sign-in screen load seven files instead of twelve.
- **The extended layer loads last because it is meant to win.** Several rules
  in it deliberately override earlier layers; move it and they stop working.

**Running inside an existing application.** If the host page already has a
reset, skip layer 3 rather than loading both. Everything else is prefixed —
every class begins `ep-`, every token `--ep-`, every behaviour hook
`data-ep-` — so the kit cannot collide with styles that are already there.

---

## 4 · Script load order

Two of these orderings are load-bearing, and **both fail quietly**:

- **`ep-icons.js` must come before `ep-menus.js`, `ep-datepicker.js`,
  `ep-shell.js` and `ep-overlays.js`.** Each of those captures the icon
  function when it is evaluated, not when it is called. Load one of them first
  and every glyph on the page renders as an empty string — no error, no
  warning, just nothing where the icons were.
- **`ep-theme.js` must come before `ep-shell.js` and `ep-overlays.js`, and
  must stay in the `<head>`, undeferred.** Both call it as they parse. It is
  in the head so the theme is resolved before the first paint; defer it and
  every page visibly flashes the wrong theme and then corrects itself.

Your own configuration files go after `ep-hooks.js` and before the rest: the
kit's scripts read their configuration once, as they parse. Menus are the
exception — a later `EpicPulse.init({ menus })` reaches the live registry. Note
that it replaces that registry rather than adding to it; to extend the menus a
screen already has, assign into `EpicPulse.menus.registry`.

Every script is guarded. A page that carries part of a component wires the
part it has and leaves the rest alone: nothing thrown, nothing logged. That is
what makes it safe to load only the scripts a screen needs.

---

## 5 · Customising

**Change tokens, not rules.** Almost everything about how this looks resolves
through `ui-kit/css/ep-tokens.css`, so a brand colour or a radius is one edit
in one file rather than a search through twelve. Override in your own
stylesheet, loaded after the kit, rather than editing the kit itself — that
way the next release drops in:

```css
:root {
  --ep-accent-primary: #0056b3;    /* every primary button and link */
  --ep-accent-secondary: #1d306d;  /* the sidebar gradient's dark end */
  --ep-radius-lg: 15px;            /* the card radius, and the dominant one */
  --ep-font-exo: 'Your Face', system-ui, sans-serif;
}

[data-theme="dark"] {
  --ep-accent-primary: #4f8ef7;    /* twelve tokens are redefined for dark */
}
```

The four edits that move the most are the two accent colours, the large
radius, and the typeface. Two things deliberately do not follow a token
change: the brand gradients and the paper surface of the report view. Both are
product decisions and both are marked in the token file.

---

## 6 · Versioning

`ui-kit/VERSION` holds the release. The same string is stamped in the token
file's banner, the theme script's banner, and `EpicPulse.version` at runtime,
so a consumer holding one file can tell which release it is.

In this kit's terms:

> **major** — markup, class or token rename · **minor** — a new component or
> token · **patch** — a visual fix only

Two deprecations are already scheduled for **2.0.0**: the unprefixed behaviour
hooks (`data-open` as well as `data-ep-open`) and the bare module globals
(`window.theme`, `window.menus`, and the rest). Both still work in 1.0.0, and
using a deprecated hook logs one console warning naming the attribute and the
release it disappears in.

This kit's version is not your application's version. The build strip in the
example screens shows an application version, and it comes from your own
configuration.

---

## 7 · Theming

One attribute, on the root element: `data-theme="light"` or `data-theme="dark"`.
`EpicPulse.theme.set('light' | 'dark' | 'system')` changes it and remembers the
choice; `system` resolves against the reader's operating system and follows it
if it changes while the page is open. With nothing stored the preference is
light. `?theme=dark` in the URL overrides and persists, which is useful when
sending someone a link to a screen.

Every dark-theme selector is unqualified, so a subtree can carry the attribute
itself. That is how the sidebar and the sign-in brand panel keep a dark brand
surface on a light page.

**The theme script cannot be deferred.** It is in the `<head>`, before the
stylesheets, because it resolves the theme before the first paint. Move it to
the end of the body and every page paints light and then corrects itself in
front of the reader.

Two surfaces do not flip: the brand gradients, and the paper surface of the
report document. A report is a document, and a printed page does not invert
when the reader turns the lights off.

---

## 8 · Accessibility

**What is in place.** Every page in this folder passes an automated
accessibility audit in both themes, with no violations. Every dismissible panel
traps focus: opening one moves focus inside, Tab cycles within it rather than
walking out behind it, and closing returns focus to the control that opened it.
Each sets `role="dialog"` and `aria-modal="true"` at runtime and takes its
accessible name from its own heading. Icon-only controls carry labels, toggles
carry `aria-pressed`, tabs carry `aria-selected`, menu triggers carry
`aria-expanded`, and the toast dock is a live region so a toast is announced
without moving focus. Every text colour is measured against every surface it is
painted on, in both themes — including the sidebar, whose ground is a gradient
and therefore has to be measured by hand.

**One rule to keep.** The accent colour has two jobs and they pull apart in the
dark theme: as text it has to be light enough to read on a dark ground, and as
a surface it has to be dark enough to carry white text. Use
`--ep-accent-primary` for ink and `--ep-accent-fill` for a ground with white on
it. A decorative mark — a dot, a meter — keeps the ink value, because it needs
to stay visible rather than legible.

**`ep-dialog.js` is the focus trap.** Every dismissible surface calls it, and
each caller checks it is there first — so omitting the file leaves dialogs
working but untrapped rather than broken. It is the only thing between a
dialog and a keyboard user who cannot get out of it. If you replace it, keep
that behaviour.

**Known open.** Eleven elements use `role="button"` on something that is not a
button. They are reachable and announced correctly but do not get a native
button's Space and Enter handling for free; changing the element is a markup
change, so it waits for a major release.

**Re-running the audit.** Every page here is static HTML, so any browser
accessibility checker — the axe or Lighthouse panel in your browser's
developer tools — runs against it directly. Two things are worth knowing before
you trust the result. Check **both themes**: contrast differs between them, and
a failure in one is invisible in the other. And a checker **skips any element
whose background is a gradient**, which is every label in the sidebar — those
have to be measured by hand, and the numbers are written beside the values in
`ui-kit/css/ep-shell.css`.

---

## 9 · The example project

`example-project/` is five working screens built entirely from this kit and
the reference page — sign-in, a home screen, a dashboard, a report library and
a report viewer. It is a demonstration of adoption rather than a second copy
of the product, and it carries its own README explaining what it shows and
what it deliberately leaves out.

It includes its own synchronised copy of `ui-kit/`, so it runs standing alone.
**If you want the kit only, delete the folder** — nothing else in this
deliverable refers to it.

---

## 10 · Porting to a framework

If you are rebuilding these screens in React, Vue or Angular, the layers port
differently:

- **Keep as they are:** every stylesheet. They are plain CSS with no build
  step and no framework assumptions. Load them once at the application root.
- **Keep, at least at first:** `ep-theme.js` and `ep-icons.js`. The theme
  script must still run before first paint, which in most frameworks means a
  small inline script in the HTML shell rather than a component. The icon set
  is data with a render function around it.
- **Reimplement as components:** the shell, the menus, the date picker, the
  overlays. Their markup is the specification — the reference page shows what
  the kit renders — and the behaviour is straightforward once state lives in
  the framework rather than in the DOM.
- **Replace with the framework's own:** the hook resolution in `ep-hooks.js`
  and the page-level wiring in `ep-app.js`. Both exist because there is no
  component model; with one, they are not needed.

Two things to carry across whatever you do: the focus trap, and the rule that
every navigation goes through one overridable function rather than assigning
to the address bar in several places.

---

## 11 · Notes

**Printing.** The report document view keeps a paper surface in both themes
and prints as it appears. Nothing else in the kit is print-specific.

**Browser support.** Edge, Chrome and Firefox 120 and later, and current
Safari. The kit uses `color-mix()` and CSS custom properties throughout; both
are supported across those versions. The scripts are ES5-compatible and are
loaded as plain scripts rather than modules.

**The demonstration date.** The example project pins today's date to
18 December 2026 so its figures, its calendar and its freshness badges stay
consistent. Remove `EP_TODAY` from your own configuration and the kit uses the
real date — a pinned date is right for a frozen sample and wrong for an
application with a backend behind it.

**No network.** Nothing in this folder fetches anything. The typeface is
included under `ui-kit/assets/fonts/`, the terms are in
`THIRD_PARTY_NOTICES`, and every
page opens from a file system with no server.
