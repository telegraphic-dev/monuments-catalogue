# Operations Runbook

This runbook covers day-to-day operation of the SoupisPamatek import pipeline.

## Services and dependencies

- Source: `https://www.soupispamatek.com/`
- Runtime: Node.js (CLI execution)
- Output artifacts:
  - `data/raw/soupispamatek/pages/*.html`
  - `data/raw/soupispamatek/manifest.json`
  - `src/content/monuments/*.md`

## Standard import procedure

1. Sync branch with `main`.
2. Install dependencies:

```bash
npm install
```

3. Run import:

```bash
npm run import:soupispamatek -- --max-pages 2500 --delay-ms 80
```

4. Validate output:

```bash
jq '.totalVisited, .totalFetched, .monumentsGenerated' data/raw/soupispamatek/manifest.json
```

5. Spot check a sample of generated files for encoding and frontmatter integrity.

## Deployment notes

This repository currently stores generated content and pipeline scripts. If consumed by a separate website/service, deploy that downstream service using its own release process after content updates are merged.

Recommended release sequence:

1. Merge content/import PR to `main`.
2. Trigger downstream site build/deploy.
3. Verify key pages, search indexing, and metadata rendering.

## Rollback procedure

If an import introduces bad content:

1. Identify last known good commit.
2. Revert the import commit (or range) in a new PR.
3. Re-run downstream deploy from the rollback commit.
4. Record root cause in PR notes and follow-up issue.

## DNS / hosting notes

This repository itself does not define DNS or hosting infrastructure. DNS and hosting are expected to live in the downstream web app or platform configuration.

Track the following in project docs/tickets when available:

- production domain and DNS owner
- hosting provider/project
- build trigger and rollout strategy
- rollback owner and escalation contacts

## Incident response checklist

- Source website unavailable or rate-limited
- Import run fails (script error or malformed content)
- Unexpected drop in `monumentsGenerated`
- Character encoding regression in generated markdown

Immediate actions:

1. Stop further imports.
2. Preserve failing output for diagnosis.
3. Open/attach incident issue with logs and manifest snapshot.
4. Roll back bad content if already merged.
