import { z } from 'zod';
import { CONTENT_RULES } from '../schemas/content-rules';

// src/video imports these types; keep runtime imports extensionless and dependency-free so Remotion's webpack bundle could resolve them.

export const BACKGROUNDS = ['pink', 'peach', 'butter', 'mint', 'sky', 'lavender'] as const;

/** Path inside the product folder, e.g. "interior/03.png" */
const productImage = z.string().regex(/^(mockups|interior)\/[^/]+\.(png|jpe?g)$/i, 'must be mockups/<file> or interior/<file>');
const line = (max: number) => z.string().min(1).max(max);
const cta = line(30).default('Link in bio');

export const spotlightSpec = z.object({
  template: z.literal('spotlight'),
  background: z.enum(BACKGROUNDS).default('butter'),
  eyebrow: line(32).optional(),
  headline: line(60),
  subline: line(90).optional(),
  mockup: productImage,
  badges: z.array(line(28)).max(3).default([]),
  cta,
});

export const carouselSlideSpec = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cover'), eyebrow: line(32).optional(), headline: line(60), subline: line(90).optional(), image: productImage }),
  z.object({ kind: z.literal('page'), caption: line(70), image: productImage }),
  z.object({ kind: z.literal('cta'), headline: line(50), image: productImage, points: z.array(line(48)).min(1).max(3), cta }),
]);

export const carouselSpec = z.object({
  template: z.literal('carousel'),
  slides: z.array(carouselSlideSpec).min(CONTENT_RULES.carouselMinSlides).max(CONTENT_RULES.carouselMaxSlides),
});

export const pageFlipReelSpec = z.object({
  template: z.literal('page-flip-reel'),
  hook: line(48),
  subline: line(70).optional(),
  pagesTitle: line(40).default('A peek inside'),
  pagesBadge: line(20).optional(),
  pages: z.array(productImage).min(2).max(6),
  mockup: productImage,
  points: z.array(line(48)).min(1).max(3),
  cta,
  // File name in assets/audio/; royalty-free tracks only
  music: z.string().regex(/^[\w.-]+\.(mp3|m4a|wav)$/).optional(),
});

export const renderSpec = z.discriminatedUnion('template', [spotlightSpec, carouselSpec, pageFlipReelSpec]);

export type RenderSpec = z.infer<typeof renderSpec>;
export type SpotlightSpec = z.infer<typeof spotlightSpec>;
export type CarouselSlideSpec = z.infer<typeof carouselSlideSpec>;
export type PageFlipReelSpec = z.infer<typeof pageFlipReelSpec>;
export type Background = (typeof BACKGROUNDS)[number];

/** Folder (relative to the render's public dir) holding the product's images */
type WithProduct = { productDir: string };

// `template` stays out of composition props so Remotion's Studio defaults stay short
export type SpotlightProps = Omit<SpotlightSpec, 'template'> & WithProduct;
export type CarouselSlideProps = { slide: CarouselSlideSpec; index: number; total: number } & WithProduct;
export type PageFlipReelProps = Omit<PageFlipReelSpec, 'template'> & WithProduct;
