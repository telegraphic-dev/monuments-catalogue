import type { CollectionEntry } from 'astro:content';

export type MonumentEntry = CollectionEntry<'monuments'>;

export type MonumentCard = {
  id: string;
  slug: string;
  href: string;
  title: string;
  district: string | null;
  imageCount: number;
  heroImage: string | null;
  sourceUrl: string | null;
  importedAt: string | null;
  excerpt: string;
};

export function normalizeDistrict(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toMonumentCard(entry: MonumentEntry): MonumentCard {
  const slug = (entry.data.slug || entry.slug).trim();
  const district = normalizeDistrict(entry.data.district);
  const excerpt = stripMarkdown(entry.body).slice(0, 210);

  return {
    id: entry.id,
    slug,
    href: `/monuments/${slug}/`,
    title: entry.data.title,
    district,
    imageCount: entry.data.imageCount ?? entry.data.images?.length ?? 0,
    heroImage: entry.data.images?.[0] ?? null,
    sourceUrl: entry.data.sourceUrl ?? null,
    importedAt: entry.data.importedAt ?? null,
    excerpt,
  };
}

export function byTitle(a: MonumentCard, b: MonumentCard): number {
  return new Intl.Collator('cs').compare(a.title, b.title);
}
