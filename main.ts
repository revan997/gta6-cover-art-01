// Vice Cover Studio — the program that hands the entry in (Node 22, standard
// library only). The web app itself is plain static files under app/ — an
// offline GTA-style cover maker that draws everything on a canvas — and this
// file just gathers it: it copies app/ and screenshots/ from beside this file
// into the output directory and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library. It runs twice in grading
// and both runs must write identical bytes, so there is no timestamp, no
// randomness and no network anywhere in here.
//
// Try it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the app itself with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory holding this file; the output directory
// is /output in the grader, or MAKEFUN_OUTPUT_DIR when set for a local run.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
}

// The scorer's caps for this competition: the dossier text is capped, at most
// four screenshots of 256 KiB each, and app/ stays inside 993 files / 48 MiB
// with no path over 1000 bytes. buildDossier refuses an entry the scorer
// would refuse, so a bad entry fails here instead of silently passing.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
