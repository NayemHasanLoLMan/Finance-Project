# Example project

Five working screens of EPIC Pulse, built from the kit and nothing else.

Open `index.html` in a browser. No server, no build step, no installation —
every screen links to the same `ui-kit/` folder that ships one level up, and
every path in them is relative.

```
index.html            sign in
home.html             Pulse Home
dashboard.html        Production Overview
report-library.html   Report library
report-viewer.html    Production Pulse (Daily)
app-config.js         the only file here holding this organisation's data
assets/               the two brand lockups
ui-kit/               a copy of the kit, identical to the one beside this folder
```

Sign in with the details already filled in — the form navigates rather than
submitting, so any values reach Home. From there the sidebar, the topbar and
every link in the five screens lead somewhere that exists.

---

## What it is for

This is a demonstration of adoption, not a second copy of the product. Every
line of markup in these five screens was assembled from an entry in
`../ui-templates.html`, and every rule that paints them comes from `ui-kit/`.
Nothing here is bespoke: if a screen needed markup the reference page did not
teach, the entry was added there first and the screen built from it
afterwards.

That constraint is the point. It is what proves the reference page is
complete enough to build from, and it is why these five screens are worth
reading beside it: each one shows the entries in composition rather than in
isolation.

## What each screen shows

| Screen | Stylesheets | What it demonstrates |
|---|---:|---|
| `index.html` | 7 | The short rung of the ladder — seven files rather than twelve, on a screen with no shell, no data and no overlays. The brand panel keeps its dark surface in both themes, the password reveal is the kit's, and the form navigates rather than submitting. |
| `home.html` | 11 | The widest screen: the shell and its rail, six vital-sign tiles in six different chart forms, a signal card, an event feed, list cards, the looping primer, and the assistant, account popover and toasts the kit renders for itself. |
| `dashboard.html` | 11 | The chart vocabulary at full size in a five-position grid, a filter toolbar whose chips open real menus, a KPI strip with target meters, and the loading, no-data and per-tile-failure states behind one control. |
| `report-library.html` | 11 | Report cards in grid and list layout, category tabs that filter in place, sorting, favourites, the no-access card and the nothing-matches state. |
| `report-viewer.html` | 11 | A grouped data table with a total row, density switching, the multi-select column chooser, the segmented view switcher, and the paper document surface that keeps its own palette in both themes. |

Every control in them is real. Menus open, the drawer applies, the date picker
draws a month, the rail collapses and is remembered, the theme switch switches,
and toasts are raised by the actions that raise them.

## What it deliberately leaves out

Seven screens of the product are not here: the dashboard builder, the metric
drill-down, root-cause analysis, the alert-rule builder, the distribution
centre, shared-with-me and settings.

They are left out on purpose. Five screens were chosen because between them
they load every layer in the kit and exercise every component family, which is
enough to prove the kit works without rebuilding the product twice. **The
components those seven screens are built from are documented in
`../ui-templates.html` all the same** — the reference page is the inventory,
and this folder is a sample of it in use. A few small parts belong only to those
screens and have no entry of their own; each is a piece of a component the
reference page does document, rather than a component nobody can find.

## The configuration

`app-config.js` is the only file here that holds anything belonging to this
organisation: who is signed in, the three navigation groups, the menus these
screens open, the workspaces the topbar can switch between, the copy the kit's
overlays render, and the date the data is stamped with.

The kit itself holds none of it. Two consequences are visible in these screens
and worth noticing:

- **The navigation names only pages that exist here.** A destination that was
  not supplied is not rendered at all.
- **The account popover has no Settings row.** No settings route was supplied,
  because this project has no settings screen — and the kit renders no link
  rather than a link into a page that is not there.

The date is pinned to 18 December 2026 so the figures, the calendar and the
freshness badges stay consistent. Remove `EP_TODAY` and the kit uses the real
date.

## Keeping the kit copy in step

`ui-kit/` here is a copy of the kit one level up, kept identical so this folder
runs on its own. If you change the kit, copy it again:

```sh
rsync -a --delete ../ui-kit/ ui-kit/
```

The figures in these screens are illustrative and do not describe a real
production period.
