#!/usr/bin/env node

import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const FILE_LIST_PATH = path.join(ROOT_DIR, 'data/generated/legacy-redirect-files.json');

async function main() {
  const raw = await readFile(FILE_LIST_PATH, 'utf8').catch(() => '[]');
  const files = JSON.parse(raw);

  for (const relativePath of files) {
    const absolutePath = path.join(ROOT_DIR, relativePath);
    await rm(absolutePath, { force: true });
  }

  console.log(`Cleaned generated redirect files: ${files.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
