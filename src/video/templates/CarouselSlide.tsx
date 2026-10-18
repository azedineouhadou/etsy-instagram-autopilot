import { AbsoluteFill } from 'remotion';
import type { CarouselSlideProps } from '../../render/spec';
import { Arrow, Backdrop, CheckItem, CtaPill, FitCard, Handle, Headline, PaperCard, Pill, Subline, productSrc } from '../components';
import { rotatingBg, theme } from '../theme';

/** One carousel slide; the renderer calls it once per slide with its index */
export const CarouselSlide: React.FC<CarouselSlideProps> = ({ productDir, slide, index, total }) => {
  const src = (path: string) => productSrc(productDir, path);

  return (
    <Backdrop color={rotatingBg(index)} seed={`slide-${index}`}>
      <AbsoluteFill style={{ alignItems: 'center', padding: '90px 80px 60px', gap: 26 }}>
        {slide.kind === 'cover' && (
          <>
            {slide.eyebrow && <Pill size={26}>{slide.eyebrow.toUpperCase()}</Pill>}
            <Headline size={92}>{slide.headline}</Headline>
            {slide.subline && <Subline size={38}>{slide.subline}</Subline>}
            <FitCard src={src(slide.image)} maxWidth={560} rotate={-4} />
            <Pill dark size={32} style={{ alignSelf: 'flex-end' }}>
              Swipe <Arrow size={30} />
            </Pill>
          </>
        )}

        {slide.kind === 'page' && (
          <>
            <Headline size={64}>{slide.caption}</Headline>
            <FitCard src={src(slide.image)} maxWidth={720} rotate={index % 2 ? 2 : -2} />
          </>
        )}

        {slide.kind === 'cta' && (
          <>
            <Headline size={76}>{slide.headline}</Headline>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 44, minHeight: 0 }}>
              <PaperCard src={src(slide.image)} width={450} rotate={-4} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 34, maxWidth: 420 }}>
                {slide.points.map((p) => (
                  <CheckItem key={p} size={38}>
                    {p}
                  </CheckItem>
                ))}
              </div>
            </div>
            <CtaPill text={slide.cta} size={40} />
            <Handle />
          </>
        )}

        {slide.kind !== 'cta' && <Dots index={index} total={total} />}
      </AbsoluteFill>
    </Backdrop>
  );
};

const Dots: React.FC<{ index: number; total: number }> = ({ index, total }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        style={{
          width: i === index ? 40 : 14,
          height: 14,
          borderRadius: 7,
          background: theme.colors.ink,
          opacity: i === index ? 0.8 : 0.25,
        }}
      />
    ))}
  </div>
);
