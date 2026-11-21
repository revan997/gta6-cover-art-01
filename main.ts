// Vice Cover Studio v2 — entry program for gta6-cover-art-01 (Node 22,
// standard library only). The app is this directory's app/ folder: plain
// static files a desktop browser loads offline (app/index.html and its ES
// modules, vendored OFL fonts, bundled sample photos, zero network
// requests). The program hands the entry in: it copies app/ and
// screenshots/ from beside this file into the output directory and writes
// /output/dossier.json with the vendored make.fun library, so the judge can
// read the app's source outline and the screenshots. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output, default /output.
// The program writes nowhere else — never to the repository, never to /bot
// (read-only in the grader) — and runs twice byte-identical: no timestamps,
// no randomness, no network.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Build the entry with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
