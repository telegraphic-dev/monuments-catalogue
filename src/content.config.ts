import { defineCollection, z } from 'astro:content';

const monuments = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z.string(),
      slug: z.string().optional(),
      sourceUrl: z.string().url().optional(),
      sourcePath: z.string().optional(),
      district: z.string().nullable().optional(),
      importedAt: z.string().optional(),
      imageCount: z.number().optional(),
      images: z.array(z.string()).optional(),
    })
    .passthrough(),
});

export const collections = { monuments };
