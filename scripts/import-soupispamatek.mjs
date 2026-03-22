#!/usr/bin/env node

import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://www.soupispamatek.com/';
const RAW_BASE_DIR = 'data/raw/soupispamatek';
const CONTENT_DIR = 'src/content/monuments';

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    maxPages: 2500,
    delayMs: 80,
    keepExisting: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === '--base-url') {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (part === '--max-pages') {
      args.maxPages = Number(argv[i + 1]);
      i += 1;
    } else if (part === '--delay-ms') {
      args.delayMs = Number(argv[i + 1]);
      i += 1;
    } else if (part === '--keep-existing') {
      args.keepExisting = true;
    } else if (part === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFileName(input) {
  const safe = input.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe || 'page';
}

function slugify(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function dedupe(arr) {
  return [...new Set(arr)];
}

function normalizeCrawlUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hash = '';
  return url.toString();
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function extractCharset(contentType, html) {
  const fromHeader = /charset=([^;]+)/i.exec(contentType || '');
  if (fromHeader) return fromHeader[1].trim();

  const fromMeta = /<meta[^>]+charset=\s*['\"]?([^\s'\">]+)/i.exec(html.toString('latin1'));
  if (fromMeta) return fromMeta[1].trim();

  return 'utf-8';
}

function decodeHtml(buffer, contentType) {
  const charset = extractCharset(contentType, buffer);
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function extractLinks(html, pageUrl) {
  const links = [];
  const hrefRegex = /href\s*=\s*['\"]([^'\"]+)['\"]/gi;
  let match = hrefRegex.exec(html);

  while (match) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('javascript:')) {
      match = hrefRegex.exec(html);
      continue;
    }

    try {
      const absolute = new URL(raw, pageUrl);
      links.push(normalizeCrawlUrl(absolute.toString()));
    } catch {
      // Ignore malformed URLs in legacy HTML.
    }

    match = hrefRegex.exec(html);
  }

  return dedupe(links);
}

function extractImages(html, pageUrl) {
  const images = [];
  const imgRegex = /<img[^>]+src\s*=\s*['\"]([^'\"]+)['\"][^>]*>/gi;
  let match = imgRegex.exec(html);

  while (match) {
    try {
      const absolute = new URL(match[1], pageUrl);
      images.push(absolute.toString());
    } catch {
      // Ignore malformed image URL.
    }
    match = imgRegex.exec(html);
  }

  return dedupe(images);
}

function stripHtml(html) {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>'),
  );
}

function extractTitle(html, pageUrl) {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) {
    return normalizeWhitespace(stripHtml(titleMatch[1]));
  }

  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1Match) {
    return normalizeWhitespace(stripHtml(h1Match[1]));
  }

  const url = new URL(pageUrl);
  return url.pathname.split('/').filter(Boolean).at(-1) || 'untitled-page';
}

function pickDistrict(pageUrl) {
  const pathname = new URL(pageUrl).pathname.toLowerCase();
  const match = /\/okres_([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

function isHtmlPage(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.xml') || pathname.endsWith('.mso') || pathname.endsWith('.thmx')) return false;
  return pathname.endsWith('.htm') || pathname.endsWith('.html') || pathname.endsWith('/');
}

function shouldCreateMonumentEntry(page) {
  const pathname = new URL(page.url).pathname.toLowerCase();
  if (pathname === '/' || pathname.endsWith('/index.htm') || pathname.endsWith('/index.html')) return false;
  if (/\/ramec/i.test(pathname)) return false;
  if (/okresy_cr/i.test(pathname)) return false;
  if (/navod/i.test(pathname)) return false;

  const contentRich = page.text.length >= 180;
  const likelyLeaf = page.internalHtmlLinks <= 2;
  return contentRich && likelyLeaf;
}

function toFrontmatterValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function buildMarkdown(entry) {
  const frontmatter = [
    '---',
    `title: ${toFrontmatterValue(entry.title)}`,
    `slug: ${toFrontmatterValue(entry.slug)}`,
    `sourceUrl: ${toFrontmatterValue(entry.sourceUrl)}`,
    `sourcePath: ${toFrontmatterValue(entry.sourcePath)}`,
    `district: ${toFrontmatterValue(entry.district)}`,
    `importedAt: ${toFrontmatterValue(entry.importedAt)}`,
    `imageCount: ${entry.images.length}`,
    `images: [${entry.images.map((img) => toFrontmatterValue(img)).join(', ')}]`,
    '---',
    '',
  ].join('\n');

  return `${frontmatter}${entry.description}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeCrawlUrl(new URL(args.baseUrl).toString());
  const baseHost = new URL(baseUrl).host;

  if (!args.keepExisting && !args.dryRun) {
    await rm(RAW_BASE_DIR, { recursive: true, force: true });
    await rm(CONTENT_DIR, { recursive: true, force: true });
  }

  if (!args.dryRun) {
    await mkdir(path.join(RAW_BASE_DIR, 'pages'), { recursive: true });
    await mkdir(CONTENT_DIR, { recursive: true });
  }

  const queue = [baseUrl];
  const visited = new Set();
  const pages = [];

  while (queue.length > 0 && pages.length < args.maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    let response;
    try {
      response = await fetch(current, {
        headers: {
          'user-agent': 'monuments-catalogue-importer/1.0 (+https://www.soupispamatek.com)',
        },
      });
    } catch (error) {
      pages.push({ url: current, status: 'network_error', error: String(error), htmlLinks: [], internalHtmlLinks: 0, text: '' });
      continue;
    }

    const contentType = response.headers.get('content-type') || '';
    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    const bodyText = decodeHtml(bodyBuffer, contentType);

    const allLinks = extractLinks(bodyText, current);
    const htmlLinks = allLinks.filter((url) => {
      try {
        return isHtmlPage(url);
      } catch {
        return false;
      }
    });

    const internalHtmlLinks = htmlLinks.filter((url) => new URL(url).host === baseHost);

    for (const link of internalHtmlLinks) {
      if (!visited.has(link)) queue.push(link);
    }

    const text = stripHtml(bodyText);
    const title = extractTitle(bodyText, current);
    const filenameBase = sanitizeFileName(new URL(current).pathname.replace(/^\//, '') || 'home');
    const uniqueBase = `${String(pages.length + 1).padStart(5, '0')}-${filenameBase}`;

    if (!args.dryRun) {
      await writeFile(path.join(RAW_BASE_DIR, 'pages', `${uniqueBase}.html`), bodyText);
    }

    pages.push({
      url: current,
      sourceFile: `pages/${uniqueBase}.html`,
      status: response.status,
      contentType,
      title,
      text,
      textLength: text.length,
      htmlLinks,
      internalHtmlLinks: internalHtmlLinks.length,
      images: extractImages(bodyText, current),
      district: pickDistrict(current),
    });

    if (args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  const importedAt = new Date().toISOString();
  const monumentCandidates = pages.filter((page) => page.status === 200 && shouldCreateMonumentEntry(page));

  const manifest = {
    baseUrl,
    fetchedAt: importedAt,
    totalVisited: visited.size,
    totalFetched: pages.length,
    maxPages: args.maxPages,
    monumentsGenerated: monumentCandidates.length,
    pages: pages.map((page) => ({
      url: page.url,
      sourceFile: page.sourceFile,
      status: page.status,
      title: page.title,
      textLength: page.textLength,
      htmlLinkCount: page.htmlLinks.length,
      internalHtmlLinkCount: page.internalHtmlLinks,
      imageCount: page.images.length,
      district: page.district,
    })),
  };

  if (!args.dryRun) {
    await writeFile(path.join(RAW_BASE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  const usedSlugs = new Set();

  for (const page of monumentCandidates) {
    const baseSlug = slugify(page.title) || slugify(new URL(page.url).pathname) || 'entry';
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(slug);

    const summary = page.text.length > 1600 ? `${page.text.slice(0, 1600)}...` : page.text;
    const markdown = buildMarkdown({
      title: page.title,
      slug,
      sourceUrl: page.url,
      sourcePath: page.sourceFile,
      district: page.district,
      importedAt,
      images: page.images,
      description: summary,
    });

    if (!args.dryRun) {
      await writeFile(path.join(CONTENT_DIR, `${slug}.md`), markdown);
    }
  }

  const resultLines = [
    `Base URL: ${baseUrl}`,
    `Visited pages: ${visited.size}`,
    `Fetched pages: ${pages.length}`,
    `Monument entries generated: ${monumentCandidates.length}`,
    `Dry run: ${args.dryRun ? 'yes' : 'no'}`,
    `Raw manifest: ${args.dryRun ? '(skipped in dry-run)' : path.join(RAW_BASE_DIR, 'manifest.json')}`,
    `Content output: ${args.dryRun ? '(skipped in dry-run)' : CONTENT_DIR}`,
  ];

  console.log(resultLines.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
