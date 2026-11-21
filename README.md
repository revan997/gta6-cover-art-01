# Vice Cover Studio — GTA-style cover art maker

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/revan997/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/revan997/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Entry for [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01) — a free,
offline web app that turns any photo and a caption into GTA 6-style multi-panel
cover art, exported as a PNG to share.

## What it does

- **6 layouts** — poster (hero + panel strip + skyline title band), nine-panel
  grid with a halftone title block, tilted polaroid snapshots over a full-bleed
  photo, full-bleed hero, 2×2 split, and vertical strips.
- **5 Vice City grades** — sunset, neon, miami, noir, vice — each with its own
  skyline palette, neon signs and photo tint.
- **Any photo** — upload your own or use the bundled samples; assign a photo
  per panel, drag to pan, scroll to zoom, crop memory per panel.
- **One click** — “Make my cover” deals your photos into the poster with
  sensible defaults; the full editor stays available for power users.
- **4 export sizes** — 1080×1080, 1080×1350, 1920×1080, 1080×1920, real PNG
  downloads from the browser.
- **Procedural poster art** — a layered Vice City skyline with lit windows and
  glowing neon signs, palm silhouettes, halftone title block, film grain and
  vignette, all drawn by the app itself (no Rockstar logos, artwork or fonts).
- **Fully offline** — static files under `app/`, zero network requests; your
  photos never leave your machine. Undo/redo included.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Build the entry (writes `out/` with `app/`, `screenshots/` and `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `main.ts` — the entry program (Node 22, stdlib only): copies `app/` +
  `screenshots/` to the output dir and writes `dossier.json`.
- `app/index.html`, `app/style.css` — the editor shell and theme.
- `app/src/cover.js` — the cover rendering engine (layouts, grades, skyline,
  halftone, grain, vignette).
- `app/src/main.js` — editor state, controls, preview, export.
- `app/src/shots.js` — `?shot=` scenes used for the entry screenshots.
- `app/samples/` — bundled sample photos (2 kit photos + 2 procedural ones
  generated for this entry).
- `app/fonts/` — Anton + Pacifico, SIL Open Font License 1.1 (texts beside them).
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.
- `screenshots/` — the entry screenshots (cover first, then editor).

## License

MIT (see `LICENSE`). Fonts: Anton and Pacifico under the SIL Open Font
License 1.1. All cover art is drawn by this app; nothing here is Rockstar
Games artwork, a Rockstar logo, or a Rockstar font.
