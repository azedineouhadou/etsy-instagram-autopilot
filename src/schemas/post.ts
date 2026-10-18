import { z } from 'zod';
import { CONTENT_RULES } from './content-rules.js';
import { INSTAGRAM_LIMITS } from './instagram-limits.js';
import { LISTING_ID } from './product.js';

const mediaPath = z.string().min(1);

const imageMedia = z.object({
  type: z.literal('image'),
  file: mediaPath,
});

const carouselMedia = z.object({
  type: z.literal('carousel'),
  files: z.array(mediaPath).min(CONTENT_RULES.carouselMinSlides).max(CONTENT_RULES.carouselMaxSlides),
});

const reelMedia = z.object({
  type: z.literal('reel'),
  video: mediaPath,
  cover: mediaPath.optional(),
  shareToFeed: z.boolean().default(true),
});

export const postSchema = z
  .object({
    id: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/, 'id is <YYYY-MM-DD>-<slug>, same as its folder name'),
    listingId: z.string().regex(LISTING_ID),
    // Offset is required so a post time can't shift with the runner's timezone or DST
    scheduledAt: z.iso.datetime({ offset: true }),
    // Requirement: option C — merged posts publish only when approved
    approved: z.boolean().default(false),
    media: z.discriminatedUnion('type', [imageMedia, carouselMedia, reelMedia]),
    caption: z.string().min(1),
    hashtags: z
      .array(z.string().regex(/^#[\p{L}\p{N}_]+$/u, 'hashtag must start with # and contain no spaces'))
      .max(INSTAGRAM_LIMITS.hashtagsMax)
      .default([]),
    altText: z.string().max(1000).optional(),
    // Written by the publisher, never by hand: lets a re-run finish a post instead of publishing it twice
    instagram: z
      .object({
        containerId: z.string().optional(),
        mediaId: z.string().optional(),
        permalink: z.url().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
      })
      .optional(),
  })
  .refine((p) => fullCaption(p).length <= INSTAGRAM_LIMITS.captionMaxChars, {
    message: `caption + hashtags exceed ${INSTAGRAM_LIMITS.captionMaxChars} characters`,
    path: ['caption'],
  });

export type Post = z.infer<typeof postSchema>;

export function fullCaption(post: { caption: string; hashtags: string[] }): string {
  return post.hashtags.length ? `${post.caption}\n\n${post.hashtags.join(' ')}` : post.caption;
}

export function mediaFiles(post: Post): string[] {
  switch (post.media.type) {
    case 'image':
      return [post.media.file];
    case 'carousel':
      return post.media.files;
    case 'reel':
      return post.media.cover ? [post.media.video, post.media.cover] : [post.media.video];
  }
}
