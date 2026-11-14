import { z } from 'zod';
import { CONTENT_RULES } from '../schemas/content-rules';

// src/video imports these types; keep runtime imports extensionless and dependency-free so Remotion's webpack bundle could resolve them.

export const BACKGROUNDS = ['pink', 'peach', 'butter', 'mint', 'sky', 'lavender'] as const;

/** Path inside the product folder, e.g. "interior/03.png" */
const productImage = z.string().regex(/^(mockups|interior)\/[^/]+\.(png|jpe?g)$/i, 'must be mockups/<file> or interior/<file>');
const line = (max: number) => z.string().min(1).max(max);
const cta = line(30).default('Link in bio');
const frames = z.number().int().positive();

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
  // Spoken instead of music. `timing` and voiceover.wav come from `npm run voiceover`
  voiceover: z
    .object({
      hook: line(120),
      pages: line(240),
      outro: line(240),
      timing: z.object({ hook: frames, perPage: frames, outro: frames }).optional(),
    })
    .optional(),
});

// ── Story reel: one beat per spoken line, each with its own scene, stickers and word-synced captions ──

const fraction = z.number().min(0).max(1);
/** Where the camera looks on the image (x, y as fractions of the image) and how far it is zoomed in */
const focus = z.tuple([fraction, fraction, z.number().min(1).max(4)]);

export const storySceneSpec = z.discriminatedUnion('kind', [
  // Slow push into a detail of one image (Ken Burns)
  z.object({ kind: z.literal('zoom'), image: productImage, from: focus.default([0.5, 0.5, 1]), to: focus.default([0.5, 0.5, 1.5]) }),
  // 2–4 pages fanned out, landing one after another
  z.object({ kind: z.literal('pages'), images: z.array(productImage).min(2).max(4) }),
  // The book pops in and floats
  z.object({ kind: z.literal('cover'), image: productImage }),
  // "Not this → this": the old habit is struck out, the better one lands
  z.object({ kind: z.literal('contrast'), before: line(40), after: line(40) }),
  // Wipe from one image to another, e.g. a line-art page to a mockup of it colored in
  z.object({ kind: z.literal('reveal'), from: productImage, to: productImage }),
  // Closing shop card: the handle is typed into a search bar, then the book and the CTA
  z.object({ kind: z.literal('cta'), image: productImage, title: line(50), points: z.array(line(28)).max(2).default([]), cta }),
]);

export const stickerSpec = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('count'), value: z.number().int().positive().max(9999), label: line(14) }),
  z.object({ kind: z.literal('chips'), items: z.array(line(22)).min(1).max(3) }),
  z.object({ kind: z.literal('stamp'), text: line(28) }),
  z.object({ kind: z.literal('pill'), text: line(28) }),
  z.object({ kind: z.literal('checks'), items: z.array(line(28)).min(1).max(4) }),
  // A ring drawn around a spot on a zoom scene's image (x, y, r as fractions of the image width/height)
  z.object({ kind: z.literal('circle'), x: fraction, y: fraction, r: z.number().min(0.03).max(0.5) }),
]);

/** Optional word from the beat's `say`: the sticker lands as that word is spoken */
const stickerWithCue = z.intersection(stickerSpec, z.object({ on: z.string().min(1).optional() }));

export const beatSpec = z
  .object({
    // Spoken and shown as captions; digits are fine ("200"), the voiceover spells them out
    say: line(90),
    scene: storySceneSpec,
    stickers: z.array(stickerWithCue).max(2).default([]),
    // Words from `say` drawn in the accent colour
    emphasis: z.array(z.string().min(1)).max(3).default([]),
  })
  .superRefine((beat, ctx) => {
    const words = new Set(captionWords(beat.say).map(normalWord));
    for (const word of beat.emphasis) {
      if (!words.has(normalWord(word))) ctx.addIssue({ code: 'custom', path: ['emphasis'], message: `"${word}" is not a word of say` });
    }
    beat.stickers.forEach((s, i) => {
      if (s.on && !words.has(normalWord(s.on))) ctx.addIssue({ code: 'custom', path: ['stickers', i, 'on'], message: `"${s.on}" is not a word of say` });
      if (s.kind === 'circle' && beat.scene.kind !== 'zoom') {
        ctx.addIssue({ code: 'custom', path: ['stickers', i], message: 'circle stickers only work on a zoom scene' });
      }
    });
  });

export const storyReelSpec = z
  .object({
    template: z.literal('story-reel'),
    // Shown blurred and darkened behind every beat, so each book brings its own mood
    backdrop: productImage,
    // Beat whose middle frame becomes the reel cover; defaults to the first cover scene
    cover: z.number().int().min(0).optional(),
    // false only for silent previews (examples); real reels are voiced with `npm run voiceover`
    voiced: z.boolean().default(true),
    // Background track in assets/audio/ (royalty-free only), played quietly and dipped under the voice
    music: z.string().regex(/^[\w.-]+\.(mp3|m4a|wav)$/).optional(),
    // Seconds into the track to start from, to skip a slow intro
    musicStart: z.number().min(0).default(0),
    beats: z.array(beatSpec).min(CONTENT_RULES.storyBeatsMin).max(CONTENT_RULES.storyBeatsMax),
  })
  .refine((s) => s.cover === undefined || s.cover < s.beats.length, { path: ['cover'], message: 'cover must be a beat index' });

/** Caption tokens of a line, as shown on screen */
export const captionWords = (say: string): string[] => say.split(/\s+/).filter(Boolean);
/** Lower case without punctuation, for matching `emphasis` and `on` against caption tokens */
export const normalWord = (word: string): string => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const renderSpec = z.discriminatedUnion('template', [spotlightSpec, carouselSpec, pageFlipReelSpec, storyReelSpec]);

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
export type PageFlipReelProps = Omit<PageFlipReelSpec, 'template'> & WithProduct & { voiceoverSrc?: string };

export type StoryReelSpec = z.infer<typeof storyReelSpec>;
export type BeatSpec = z.infer<typeof beatSpec>;
export type StorySceneSpec = z.infer<typeof storySceneSpec>;
export type StickerSpec = z.infer<typeof stickerWithCue>;

/** A caption word with the moment it's spoken, in ms from the start of the reel */
export type TimedWord = { beat: number; text: string; startMs: number; endMs: number };
/** Frames per beat plus the timed caption words; written to voiceover.json by `npm run voiceover` */
export type StoryTiming = { beats: number[]; words: TimedWord[] };

export type StoryReelProps = Omit<StoryReelSpec, 'template'> &
  WithProduct & { voiceoverSrc?: string; timing?: StoryTiming; /** Staged copy of the track, loudness-matched and trimmed */ musicSrc?: string };
