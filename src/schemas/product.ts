import { z } from 'zod';

export const LISTING_ID = /^\d{6,12}$/;

export const productSchema = z
  .object({
    listingId: z.string().regex(LISTING_ID, 'listing ID is the number after /listing/ in the Etsy link'),
    title: z.string().min(1),
    url: z.url(),
    theme: z.string().min(1),
    ageRange: z.object({
      min: z.int().min(0),
      // null = no upper bound ("ages 4+")
      max: z.int().min(0).nullable(),
    }),
    pageCount: z.int().positive(),
    format: z.enum(['digital', 'physical']),
    sellingPoints: z.array(z.string().min(1)).min(1).max(8),
    keywords: z.array(z.string().min(1)).default([]),
    mockups: z.array(z.string().min(1)).min(1),
    interior: z.array(z.string().min(1)).default([]),
    // When Claude last read the live listing; stale facts are re-checked before featuring
    sourceCheckedAt: z.iso.date(),
    notes: z.string().optional(),
  })
  .refine((p) => p.url.includes(`/listing/${p.listingId}`), {
    message: 'url must point to the same listing as listingId',
    path: ['url'],
  })
  .refine((p) => p.ageRange.max === null || p.ageRange.max >= p.ageRange.min, {
    message: 'ageRange.max must be >= ageRange.min',
    path: ['ageRange'],
  });

export type Product = z.infer<typeof productSchema>;
