import { Fragment } from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PageFlipReelProps } from '../../render/spec';
import { Backdrop, CheckItem, CtaPill, Handle, Headline, PaperCard, Pill, Subline, productSrc } from '../components';
import { bg } from '../theme';
import { REEL_TIMING, reelDuration } from '../timing';

// Instagram draws the caption, username and buttons over the bottom of a reel, so text and CTAs stay above this line (my estimate, not a published spec)
const SAFE_BOTTOM = 380;

/**
 * Reel: hook text pops in → interior pages fly onto a pile → mockup, selling points and CTA.
 */
export const PageFlipReel: React.FC<PageFlipReelProps> = (props) => {
  const { hook, perPage, crossfade } = REEL_TIMING;
  const pagesStart = hook - crossfade;
  const outroStart = hook + props.pages.length * perPage - crossfade;
  const total = reelDuration(props.pages.length);

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={hook}>
        <HookScene {...props} />
      </Sequence>
      <Sequence from={pagesStart} durationInFrames={outroStart + crossfade - pagesStart}>
        <FadeIn>
          <PagesScene {...props} />
        </FadeIn>
      </Sequence>
      <Sequence from={outroStart}>
        <FadeIn>
          <OutroScene {...props} />
        </FadeIn>
      </Sequence>
      {props.music && (
        <Audio
          src={staticFile(`audio/${props.music}`)}
          volume={(f) => interpolate(f, [0, 15, total - 30, total], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  );
};

const FadeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, REEL_TIMING.crossfade], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const pop = (frame: number, fps: number, delay: number) => spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 160 } });

const HookScene: React.FC<PageFlipReelProps> = ({ productDir, hook, subline, mockup }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = hook.split(' ');
  const cardRise = spring({ frame: frame - 18, fps, config: { damping: 16 } });

  return (
    <Backdrop color={bg('pink')} seed="hook" drift>
      <AbsoluteFill style={{ alignItems: 'center', padding: '260px 90px 0', gap: 40 }}>
        {/* Inline words (not flex) so text-wrap: balance can even out the lines */}
        <Headline size={118}>
          {words.map((w, i) => {
            const s = pop(frame, fps, i * 5);
            return (
              <Fragment key={i}>
                {i > 0 && ' '}
                <span style={{ display: 'inline-block', transform: `scale(${s}) translateY(${(1 - s) * 40}px)`, opacity: Math.min(1, s * 1.5) }}>
                  {w}
                </span>
              </Fragment>
            );
          })}
        </Headline>
        {subline && (
          <Subline size={46} style={{ opacity: interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
            {subline}
          </Subline>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
        <PaperCard
          src={productSrc(productDir, mockup)}
          width={640}
          rotate={-5}
          style={{ marginBottom: 60, translate: `0 ${(1 - cardRise) * 900}px` }}
        />
      </AbsoluteFill>
    </Backdrop>
  );
};

const PagesScene: React.FC<PageFlipReelProps> = ({ productDir, pages, pagesTitle, pagesBadge }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { perPage, crossfade } = REEL_TIMING;

  return (
    <Backdrop color={bg('sky')} seed="pages" drift>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 200, gap: 26 }}>
        <Headline size={96}>{pagesTitle}</Headline>
        {pagesBadge && <Pill size={34}>{pagesBadge}</Pill>}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: `420px 0 ${SAFE_BOTTOM}px` }}>
        {pages.map((page, i) => {
          const enter = spring({ frame: frame - crossfade - i * perPage, fps, config: { damping: 15, stiffness: 120 } });
          if (enter <= 0) return null;
          const rest = (i % 2 ? 1 : -1) * (2 + (i % 3));
          return (
            <PaperCard
              key={page}
              src={productSrc(productDir, page)}
              width={700}
              tape={false}
              rotate={interpolate(enter, [0, 1], [18, rest])}
              style={{ position: 'absolute', translate: `${(1 - enter) * 1200}px ${(1 - enter) * -120}px` }}
            />
          );
        })}
      </AbsoluteFill>
    </Backdrop>
  );
};

const OutroScene: React.FC<PageFlipReelProps> = ({ productDir, mockup, points, cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame, fps, config: { damping: 14 } });
  const ctaIn = pop(frame, fps, 20 + points.length * 8);
  const pulse = 1 + Math.max(0, Math.sin((frame - 60) / 6)) * 0.04 * (frame > 60 ? 1 : 0);

  return (
    <Backdrop color={bg('mint')} seed="outro" drift>
      <AbsoluteFill style={{ alignItems: 'center', padding: `200px 90px ${SAFE_BOTTOM - 40}px`, gap: 50 }}>
        <PaperCard src={productSrc(productDir, mockup)} width={540} rotate={-4} style={{ scale: `${card}` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, alignSelf: 'stretch', paddingLeft: 40 }}>
          {points.map((p, i) => {
            const s = pop(frame, fps, 14 + i * 8);
            return (
              <CheckItem key={p} size={48} style={{ opacity: Math.min(1, s), translate: `${(1 - s) * -60}px 0` }}>
                {p}
              </CheckItem>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <CtaPill text={cta} size={54} style={{ scale: `${ctaIn * pulse}` }} />
        <Handle size={34} />
      </AbsoluteFill>
    </Backdrop>
  );
};
