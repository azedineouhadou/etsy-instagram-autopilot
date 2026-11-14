import { Composition, Still } from 'remotion';
import type { CarouselSlideProps, PageFlipReelProps, SpotlightProps, StoryReelProps } from '../render/spec';
import { CarouselSlide } from './templates/CarouselSlide';
import { PageFlipReel } from './templates/PageFlipReel';
import { Spotlight } from './templates/Spotlight';
import { StoryReel, storyReelFrames } from './templates/StoryReel';
import { theme } from './theme';
import { reelDuration } from './timing';

// Defaults only drive `npm run studio` previews; real renders pass props from each post's render.json
const SAMPLE_DIR = 'products/9999999999-sample-dino-coloring-book';

const spotlightDefaults: SpotlightProps = {
  productDir: SAMPLE_DIR,
  background: 'butter',
  eyebrow: 'New in the shop',
  headline: 'Rainy day? Print this.',
  subline: '30 dinosaur pages, ready in seconds',
  mockup: 'mockups/01.png',
  badges: ['Instant download', 'Ages 4–8', 'Letter & A4'],
  cta: 'Link in bio',
};

const carouselDefaults: CarouselSlideProps = {
  productDir: SAMPLE_DIR,
  index: 0,
  total: 4,
  slide: { kind: 'cover', eyebrow: 'Printable coloring book', headline: 'Which page would they color first?', image: 'mockups/01.png' },
};

const reelDefaults: PageFlipReelProps = {
  productDir: SAMPLE_DIR,
  hook: 'Rainy day? Print this.',
  subline: 'Screen-free fun in seconds',
  pagesTitle: 'A peek inside',
  pagesBadge: '30 pages',
  pages: ['interior/01.png', 'interior/02.png', 'interior/03.png', 'interior/04.png'],
  mockup: 'mockups/01.png',
  points: ['Instant download', 'Thick, simple outlines', 'Print as many as you like'],
  cta: 'Link in bio',
};

const storyDefaults: StoryReelProps = {
  productDir: SAMPLE_DIR,
  backdrop: 'interior/02.png',
  voiced: false,
  musicStart: 0,
  beats: [
    {
      say: 'Which dinosaur would your kid color first?',
      scene: { kind: 'zoom', image: 'interior/01.png', from: [0.5, 0.5, 1], to: [0.45, 0.45, 1.8] },
      stickers: [{ kind: 'circle', x: 0.45, y: 0.45, r: 0.2, on: 'first' }],
      emphasis: ['dinosaur'],
    },
    {
      say: 'Not another hour of cartoons on a tablet.',
      scene: { kind: 'contrast', before: 'Cartoons on a tablet', after: 'Crayons at the table' },
      stickers: [],
      emphasis: ['tablet'],
    },
    { say: 'This is the dino coloring book.', scene: { kind: 'cover', image: 'mockups/01.png' }, stickers: [{ kind: 'count', value: 30, label: 'pages', on: 'dino' }], emphasis: ['dino'] },
    {
      say: 'Big bold outlines for little hands.',
      scene: { kind: 'pages', images: ['interior/01.png', 'interior/02.png', 'interior/03.png'] },
      stickers: [{ kind: 'chips', items: ['Bold lines', 'Ages 4–8'], on: 'outlines' }],
      emphasis: ['little'],
    },
    {
      say: 'Color one, print it again tomorrow.',
      scene: { kind: 'zoom', image: 'interior/04.png', from: [0.5, 0.5, 1.1], to: [0.5, 0.4, 1.5] },
      stickers: [{ kind: 'checks', items: ['Print', 'Color', 'Repeat'] }],
      emphasis: ['again'],
    },
    {
      say: 'Grab the printable from the link in my bio.',
      scene: { kind: 'cta', image: 'mockups/01.png', title: 'Dino Coloring Book', points: ['Instant download'], cta: 'Link in bio' },
      stickers: [],
      emphasis: ['bio'],
    },
  ],
};

export const Root: React.FC = () => {
  const { image, carousel, reel } = theme.formats;
  return (
    <>
      <Still id="Spotlight" component={Spotlight} width={image.width} height={image.height} defaultProps={spotlightDefaults} />
      <Still id="CarouselSlide" component={CarouselSlide} width={carousel.width} height={carousel.height} defaultProps={carouselDefaults} />
      <Composition
        id="PageFlipReel"
        component={PageFlipReel}
        width={reel.width}
        height={reel.height}
        fps={reel.fps}
        durationInFrames={reelDuration(reelDefaults.pages.length)}
        defaultProps={reelDefaults}
        calculateMetadata={({ props }) => ({ durationInFrames: reelDuration(props.pages.length, props.voiceover?.timing) })}
      />
      <Composition
        id="StoryReel"
        component={StoryReel}
        width={reel.width}
        height={reel.height}
        fps={reel.fps}
        durationInFrames={storyReelFrames(storyDefaults)}
        defaultProps={storyDefaults}
        calculateMetadata={({ props }) => ({ durationInFrames: storyReelFrames(props) })}
      />
    </>
  );
};
