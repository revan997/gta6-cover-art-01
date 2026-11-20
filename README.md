# Vice Cover Studio — GTA-style cover art maker

[![Make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/revan997/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/revan997/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Vice Cover Studio is an offline canvas cover maker for the make.fun
[gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01) bounty: build a
GTA-style cover in the browser, no server and no network needed.

## What it does

- 6 cover layouts (single hero, duo, trio, grid, panorama, poster)
- 5 colour grades for the classic Vice City look
- Photo upload — drop your own image in as the hero shot
- Live canvas editor with title, tagline and character placement
- PNG export in 4 sizes, ready to share or print

## How to run it

Requires Node 22 (standard library only, no dependencies to install).

```sh
node serve.ts
```

Then open http://localhost:8080 in your browser. Use `--port` to pick a
different port:

```sh
node serve.ts --port 9000
```

To build the graded entry bundle locally:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `app/` — the static web app (HTML, CSS, JS, fonts, samples)
- `main.ts` — bundles the app and writes the grading dossier
- `serve.ts` — tiny local static server for trying the app
- `screenshots/` — cover and editor screenshots
- `vendor/` — vendored make.fun library

## License

MIT — see [LICENSE](LICENSE).
