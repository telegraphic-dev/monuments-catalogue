#!/usr/bin/env node

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const MANIFEST_PATH = path.join(ROOT_DIR, 'data/raw/soupispamatek/manifest.json');
const MONUMENTS_DIR = path.join(ROOT_DIR, 'src/content/monuments');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const GENERATED_DIR = path.join(ROOT_DIR, 'data/generated');
const REDIRECT_MAP_PATH = path.join(GENERATED_DIR, 'legacy-redirect-map.json');
const GENERATED_FILES_PATH = path.join(GENERATED_DIR, 'legacy-redirect-files.json');

function normalizeLegacyPath(rawPath) {
  if (!rawPath || rawPath === '/') return '/';
  const clean = rawPath.split('?')[0].split('#')[0];
  const normalized = clean.startsWith('/') ? clean : `/${clean}`;
  return normalized.replace(/\/+/g, '/');
}

function normalizeTargetPath(rawPath) {
  if (!rawPath || rawPath === '/') return '/';
  const noQuery = rawPath.split('?')[0].split('#')[0];
  const withLeading = noQuery.startsWith('/') ? noQuery : `/${noQuery}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function toPublicFilePath(legacyPath) {
  const withoutLeadingSlash = legacyPath.slice(1);
  return path.join(PUBLIC_DIR, withoutLeadingSlash);
}

function renderRedirectHtml(legacyPath, targetPath) {
  const safeLegacy = legacyPath.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeTarget = targetPath.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    `    <title>Redirecting ${safeLegacy}</title>`,
    `    <link rel="canonical" href="${safeTarget}" />`,
    `    <meta http-equiv="refresh" content="0; url=${safeTarget}" />`,
    '    <meta name="robots" content="noindex" />',
    '  </head>',
    '  <body>',
    `    <p>Redirecting to <a href="${safeTarget}">${safeTarget}</a>.</p>`,
    `    <script>window.location.replace(${JSON.stringify(targetPath)});</script>`,
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

async function collectMonumentFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMonumentFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseFrontmatter(rawMarkdown) {
  const match = rawMarkdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};

  const pairs = {};
  for (const line of match[1].split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const valueRaw = line.slice(separatorIndex + 1).trim();
    if (!key) continue;

    if (!valueRaw) {
      pairs[key] = '';
      continue;
    }

    try {
      pairs[key] = JSON.parse(valueRaw);
    } catch {
      pairs[key] = valueRaw;
    }
  }

  return pairs;
}

function inferTargetForLegacyPath(legacyPath, sourceTargets, knownDistricts) {
  const fromSource = sourceTargets.get(legacyPath);
  if (fromSource) return fromSource;

  const lower = legacyPath.toLowerCase();

  if (lower === '/' || lower === '/index.htm' || lower === '/index.html' || lower === '/navod.htm') {
    return '/';
  }

  if (lower === '/okresy_cr.htm' || lower === '/okresy_cr_pred%202021.htm') {
    return '/districts/';
  }

  const districtMatch = lower.match(/^\/okres_([^/]+)\/(?:okres[^/]*|ramec[^/]*)\.html?$/);
  if (districtMatch) {
    return knownDistricts.has(districtMatch[1]) ? `/districts/${districtMatch[1]}/` : '/districts/';
  }

  return '/monuments/';
}

async function cleanPreviouslyGenerated(filesToDelete) {
  for (const filePath of filesToDelete) {
    const absolutePath = path.join(ROOT_DIR, filePath);
    if (!absolutePath.startsWith(PUBLIC_DIR)) continue;
    await rm(absolutePath, { force: true });
  }
}

async function main() {
  const [manifestRaw, previousFilesRaw] = await Promise.all([
    readFile(MANIFEST_PATH, 'utf8'),
    readFile(GENERATED_FILES_PATH, 'utf8').catch(() => '[]'),
  ]);

  const manifest = JSON.parse(manifestRaw);
  const previousFiles = JSON.parse(previousFilesRaw);

  await cleanPreviouslyGenerated(previousFiles);

  const monumentFiles = await collectMonumentFiles(MONUMENTS_DIR);
  const sourceTargets = new Map();
  const knownDistricts = new Set();

  for (const monumentFile of monumentFiles) {
    const markdown = await readFile(monumentFile, 'utf8');
    const frontmatter = parseFrontmatter(markdown);

    if (typeof frontmatter.sourceUrl !== 'string' || typeof frontmatter.slug !== 'string') {
      continue;
    }

    let legacyPath;
    try {
      legacyPath = normalizeLegacyPath(new URL(frontmatter.sourceUrl).pathname);
    } catch {
      continue;
    }

    sourceTargets.set(legacyPath, normalizeTargetPath(`/monuments/${frontmatter.slug}/`));
    if (typeof frontmatter.district === 'string' && frontmatter.district) {
      knownDistricts.add(frontmatter.district.toLowerCase());
    }
  }

  const redirectMap = {};

  for (const page of manifest.pages ?? []) {
    if (typeof page.url !== 'string') continue;

    let legacyPath;
    try {
      legacyPath = normalizeLegacyPath(new URL(page.url).pathname);
    } catch {
      continue;
    }

    const inferred = inferTargetForLegacyPath(legacyPath, sourceTargets, knownDistricts);
    redirectMap[legacyPath] = normalizeTargetPath(inferred);
  }

  for (const [legacyPath, targetPath] of sourceTargets.entries()) {
    redirectMap[legacyPath] = targetPath;
  }

  const generatedFiles = [];

  for (const [legacyPath, targetPath] of Object.entries(redirectMap)) {
    if (legacyPath === '/' || legacyPath === targetPath || normalizeTargetPath(legacyPath) === targetPath) {
      continue;
    }

    const destination = toPublicFilePath(legacyPath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, renderRedirectHtml(legacyPath, targetPath));
    generatedFiles.push(path.relative(ROOT_DIR, destination));
  }

  await mkdir(GENERATED_DIR, { recursive: true });

  await writeFile(
    REDIRECT_MAP_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), count: Object.keys(redirectMap).length, redirects: redirectMap }, null, 2)}\n`,
  );

  generatedFiles.sort((a, b) => a.localeCompare(b));
  await writeFile(GENERATED_FILES_PATH, `${JSON.stringify(generatedFiles, null, 2)}\n`);

  console.log(`Legacy redirects generated: ${generatedFiles.length}`);
  console.log(`Redirect map: ${path.relative(ROOT_DIR, REDIRECT_MAP_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
