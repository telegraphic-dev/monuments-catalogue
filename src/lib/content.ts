import { getCollection } from 'astro:content';

export type MonumentEntry = Awaited<ReturnType<typeof getCollection<'monuments'>>>[number];

export async function getMonumentsSorted() {
  const entries = await getCollection('monuments');
  return entries.sort((a, b) => a.data.title.localeCompare(b.data.title, 'cs'));
}

export function getCanonicalMonumentPath(entry: MonumentEntry) {
  return `/monuments/${entry.slug}/`;
}

export function getCanonicalDistrictPath(district: string) {
  return `/districts/${district}/`;
}
