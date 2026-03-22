# SoupisPamatek Import Pipeline

This script crawls `www.soupispamatek.com`, snapshots raw HTML, and transforms eligible pages into Markdown entries for an Astro content collection.

## Output paths

- Raw source snapshot: `data/raw/soupispamatek/`
- Generated content entries: `src/content/monuments/`

## Usage

```bash
npm run import:soupispamatek
```

Optional flags:

- `--base-url <url>`: override start URL (default `https://www.soupispamatek.com/`)
- `--max-pages <n>`: crawl cap (default `2500`)
- `--delay-ms <n>`: delay between requests in milliseconds (default `80`)
- `--keep-existing`: do not wipe previous `data/raw/soupispamatek` and `src/content/monuments` output

Example:

```bash
npm run import:soupispamatek -- --max-pages 600 --delay-ms 120
```

## What gets generated

1. `data/raw/soupispamatek/pages/*.html`: raw HTML snapshots of crawled pages.
2. `data/raw/soupispamatek/manifest.json`: structured crawl report with URL inventory and metadata.
3. `src/content/monuments/*.md`: normalized monument content records with frontmatter:
   - `title`
   - `slug`
   - `sourceUrl`
   - `sourcePath`
   - `district`
   - `importedAt`
   - `images`

## Notes

- The source site is legacy HTML (Word-exported pages, mixed encodings). The importer auto-detects charset from HTTP/meta and decodes accordingly.
- Monument pages are selected with a conservative heuristic (leaf-like HTML pages with substantial text) to avoid directory/index/frame files.
- Re-run imports whenever source content changes.
