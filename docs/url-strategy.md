# URL strategy and legacy redirects

## Goals

- Standardize canonical URLs for the new Astro site.
- Preserve inbound links from legacy `www.soupispamatek.com` HTML pages.
- Avoid 404 responses for known legacy paths on static GitHub Pages hosting.

## Canonical URL structure

- Home: `/`
- Monument index: `/monuments/`
- Monument detail: `/monuments/{slug}/`
- District index: `/districts/`
- District detail: `/districts/{district}/`

Monument detail pages are generated from `src/content/monuments/*.md` entries.

## Legacy URL audit snapshot

Source: `data/raw/soupispamatek/manifest.json` (crawler snapshot generated on 2026-03-22).

- Total fetched legacy pages: `2500`
- Legacy HTML paths (`.htm`/`.html`): `2499`
- Imported monument entries: `1524`
- District frame/index legacy pages matched by pattern: `148`
- Legacy `okresy_cr*` index pages: `2`

Observed high-volume path families:

- district container pages, e.g. `/okres_<district>/okres*.htm`, `/okres_<district>/ramec*.htm`
- monument detail pages under district trees, e.g. `/okres_*/foto/*/*.htm`
- legacy top-level indexes like `/okresy_cr.htm`, `/okresy_cr_PRED 2021.htm`, `/navod.htm`

## Redirect implementation (GitHub Pages compatible)

GitHub Pages cannot execute custom rewrite middleware or return runtime 301 logic. Instead, we generate static redirect documents at the original legacy paths under `public/`.

Tooling:

- `scripts/generate-legacy-redirects.mjs`
- `scripts/clean-generated-redirects.mjs`
- output map: `data/generated/legacy-redirect-map.json`
- generated file list: `data/generated/legacy-redirect-files.json`

Redirect rules:

- If a legacy path matches a monument `sourceUrl`, redirect to `/monuments/{slug}/`.
- District frame/index pages redirect to `/districts/{district}/`.
- Legacy district overview pages (`/okresy_cr*`) redirect to `/districts/`.
- Known legacy home-like pages (`/index.htm`, `/index.html`, `/navod.htm`) redirect to `/`.
- Remaining known legacy pages fall back to `/monuments/`.

Redirect documents include:

- canonical link
- immediate meta refresh
- JS `window.location.replace(...)`

## Validation

Commands:

```bash
npm run redirects:generate
npm run build
npm run redirects:smoke-test
```

`scripts/smoke-test-redirects.mjs` verifies:

- each generated legacy redirect path is present in `dist`
- each canonical redirect target resolves to an output HTML page in `dist`

`npm run build` runs `prebuild` + `postbuild`, so redirect files are generated for build copy and then removed from `public/` to keep the git worktree clean.

## Notes and follow-up

- This strategy guarantees migration coverage for known crawled legacy URLs.
- Any uncrawled legacy paths should be added by re-running import crawl and regenerating redirects.
- If hosting moves to infrastructure with true server redirects, the redirect map can become a source for 301 rules.
