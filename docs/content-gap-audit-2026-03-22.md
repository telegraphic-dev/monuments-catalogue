# Content Gap Audit (2026-03-22)

## Scope

Audit of `data/raw/soupispamatek/manifest.json` and generated files in `src/content/monuments/`.

## Snapshot summary

- `totalVisited`: 2500
- `totalFetched`: 2500
- `monumentsGenerated`: 1524
- Rich pages not imported (`textLength >= 180` and not present in generated set): 465

## Key observations

1. Import heuristic appears to skip content-rich pages with higher `internalHtmlLinkCount`.
2. A small subset of generated entries has metadata quality issues (missing district or zero images).
3. Some slugs/filenames indicate legacy-title artifacts (`*htm.md`).

## High-value missing examples

- `https://www.soupispamatek.com/okres_broumov/foto/bozanov/bozanov.htm`
- `https://www.soupispamatek.com/okres_broumov/foto/policenadmetuji/policenadmetuji.htm`
- `https://www.soupispamatek.com/okres_as/as/as.htm`
- `https://www.soupispamatek.com/okres_broumov/foto/hermankovice/hermankovice.htm`
- `https://www.soupispamatek.com/okres_broumov/foto/vernerovice/vernerovice.htm`

## Follow-up actions

- File targeted content-addition/import-gap issues for the highest-value missing pages.
- Tune monument eligibility heuristic (internal-link threshold and directory patterns).
- Add post-import QA checks for district coverage, image count, and slug quality.
