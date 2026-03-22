#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const REDIRECT_MAP_PATH = path.join(ROOT_DIR, 'data/generated/legacy-redirect-map.json');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function canonicalTargetToDistFile(targetPath) {
  const trimmed = targetPath.replace(/^\//, '').replace(/\/+$/, '');
  if (!trimmed) return path.join(DIST_DIR, 'index.html');
  return path.join(DIST_DIR, trimmed, 'index.html');
}

function redirectLegacyPathToDistFile(legacyPath) {
  const trimmed = legacyPath.replace(/^\//, '');
  if (!trimmed) return path.join(DIST_DIR, 'index.html');
  return path.join(DIST_DIR, trimmed);
}

async function assertExists(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} missing: ${path.relative(ROOT_DIR, filePath)}`);
  }
}

async function main() {
  const raw = await readFile(REDIRECT_MAP_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const redirects = parsed.redirects ?? {};

  let checkedRedirectFiles = 0;
  let checkedTargets = 0;

  for (const [legacyPath, targetPath] of Object.entries(redirects)) {
    if (legacyPath !== '/' && legacyPath !== targetPath) {
      await assertExists(redirectLegacyPathToDistFile(legacyPath), 'Redirect file');
      checkedRedirectFiles += 1;
    }

    await assertExists(canonicalTargetToDistFile(targetPath), 'Canonical target');
    checkedTargets += 1;
  }

  console.log(`Smoke test passed. Redirect files checked: ${checkedRedirectFiles}. Canonical targets checked: ${checkedTargets}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
