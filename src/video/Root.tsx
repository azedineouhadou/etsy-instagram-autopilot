import { Composition, Still } from 'remotion';
import type { CarouselSlideProps, PageFlipReelProps, SpotlightProps } from '../render/spec';
import { CarouselSlide } from './templates/CarouselSlide';
import { PageFlipReel } from './templates/PageFlipReel';
import { Spotlight } from './templates/Spotlight';
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
        calculateMetadata={({ props }) => ({ durationInFrames: reelDuration(props.pages.length) })}
      />
    </>
  );
};
