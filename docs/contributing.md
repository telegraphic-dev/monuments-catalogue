# Contributing Guide

This repository hosts an import pipeline that crawls `www.soupispamatek.com` and generates markdown entries under `src/content/monuments/`.

## Prerequisites

- Node.js 20+ (Node 18+ may work, but 20+ is recommended)
- npm
- Network access to `https://www.soupispamatek.com/`

## Repository layout

- `scripts/import-soupispamatek.mjs`: crawler + transformer
- `data/raw/soupispamatek/`: raw HTML snapshots and crawl manifest
- `src/content/monuments/`: generated markdown records

## Running the importer

```bash
npm install
npm run import:soupispamatek
```

Optional flags:

- `--base-url <url>`
- `--max-pages <n>`
- `--delay-ms <n>`
- `--keep-existing`

Example:

```bash
npm run import:soupispamatek -- --max-pages 600 --delay-ms 120
```

## Adding new monument entries manually

1. Create a new file in `src/content/monuments/` using a kebab-case filename.
2. Include frontmatter fields used by imported content:
   - `title`
   - `slug`
   - `sourceUrl`
   - `sourcePath`
   - `district`
   - `importedAt`
   - `imageCount`
   - `images`
3. Add the cleaned monument text in the markdown body.
4. Keep provenance: always include the original source URL and source path.

Example template:

```md
---
title: "Památky obce Example"
slug: "pamatky-obce-example"
sourceUrl: "https://www.soupispamatek.com/..."
sourcePath: "pages/99999-example.htm.html"
district: "example"
importedAt: "2026-03-22T00:00:00.000Z"
imageCount: 1
images: ["https://www.soupispamatek.com/.../image001.jpg"]
---

Monument content goes here.
```

## Contributor workflow

1. Create a branch from `main`.
2. Make focused changes.
3. Validate by running at least one dry run of the importer:

```bash
npm run import:soupispamatek -- --max-pages 25 --delay-ms 80 --keep-existing
```

4. Check git diff for unexpected bulk rewrites.
5. Open a PR with:
   - what changed
   - how it was validated
   - risks/follow-ups

## Quality checks before PR

- Ensure generated markdown has valid frontmatter.
- Ensure filenames are deterministic and slug-safe.
- Ensure `manifest.json` reflects the run configuration.
- Spot check source URL and image URL validity for changed entries.

## Common pitfalls

- Running without `--keep-existing` wipes existing generated content.
- Legacy source pages use mixed encodings; verify character fidelity in output.
- Pages with many internal links may be skipped by the current heuristic.
