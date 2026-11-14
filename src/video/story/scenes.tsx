import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StorySceneSpec } from '../../render/spec';
import { Crayon, CtaPill, Headline, PaperCard, Pill } from '../components';
import { theme } from '../theme';
import { STAGE, TOP_SAFE } from './layout';
import { contrastLanding, TYPE_FRAMES, TYPE_START } from './timeline';

const { colors, fonts } = theme;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SHADOW = '0 30px 80px rgba(0, 0, 0, 0.45), 0 6px 18px rgba(0, 0, 0, 0.3)';

type SceneProps<K extends StorySceneSpec['kind']> = Extract<StorySceneSpec, { kind: K }> & {
  src: (path: string) => string;
  /** Frames this beat is on screen */
  length: number;
};

/** The clipped area above the captions; content is centred below Instagram's top bar */
const Stage: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ top: STAGE.top, height: STAGE.height, overflow: 'hidden' }}>
    <AbsoluteFill style={{ paddingTop: TOP_SAFE - 20, alignItems: 'center', justifyContent: 'center' }}>{children}</AbsoluteFill>
  </AbsoluteFill>
);

/** Slow push into a detail: the focus point slides to the centre while the image scales up */
export const ZoomScene: React.FC<SceneProps<'zoom'> & { overlay?: (scale: number) => ReactNode }> = ({ src, image, from, to, length, overlay }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, length], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const [x, y, s] = from.map((v, i) => v + (to[i]! - v) * t) as [number, number, number];

  return (
    <Stage>
      <div
        style={{
          position: 'relative',
          padding: 12,
          background: '#fff',
          borderRadius: 14,
          boxShadow: SHADOW,
          // translate % is of the unscaled box, so moving by (0.5 - focus) × scale centres the focus point
          transform: `translate(${(0.5 - x) * s * 100}%, ${(0.5 - y) * s * 100}%) scale(${s})`,
        }}
      >
        <Img src={src(image)} style={{ display: 'block', maxWidth: 940, maxHeight: STAGE.height - TOP_SAFE - 80, borderRadius: 6 }} />
        {overlay?.(s)}
      </div>
    </Stage>
  );
};

/** 2–4 pages land one after another and fan out */
export const PagesScene: React.FC<SceneProps<'pages'>> = ({ src, images, length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = images.length;
  const step = Math.min(16, Math.floor((length * 0.5) / n));
  const width = n === 2 ? 560 : 470;
  const spread = n === 2 ? 170 : n === 3 ? 230 : 250;

  return (
    <Stage>
      {images.map((image, i) => {
        const enter = spring({ frame: frame - i * step, fps, config: { damping: 15, stiffness: 120 } });
        const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread;
        const rotate = (i / Math.max(1, n - 1) - 0.5) * 16;
        return (
          <PaperCard
            key={image}
            src={src(image)}
            width={width}
            tape={false}
            rotate={interpolate(enter, [0, 1], [rotate * 2.5, rotate])}
            style={{ position: 'absolute', translate: `${offset}px ${(1 - enter) * 1500 + (i % 2) * 40}px`, boxShadow: SHADOW }}
          />
        );
      })}
    </Stage>
  );
};

/** The book pops in, settles at a tilt and floats */
export const CoverScene: React.FC<SceneProps<'cover'>> = ({ src, image }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 140 } });
  const float = Math.sin(frame / 16) * 10;

  return (
    <Stage>
      <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.28), transparent 65%)', opacity: pop }} />
      <Img
        src={src(image)}
        style={{
          // Landscape mockups get the full width; portrait ones are limited by the height
          maxWidth: 960,
          maxHeight: STAGE.height - TOP_SAFE - 120,
          borderRadius: 18,
          boxShadow: SHADOW,
          transform: `translateY(${float}px) scale(${0.4 + pop * 0.6}) rotate(${interpolate(pop, [0, 1], [-16, -4])}deg)`,
        }}
      />
    </Stage>
  );
};

/** The old habit gets struck out, then the better one lands */
export const ContrastScene: React.FC<SceneProps<'contrast'>> = ({ before, after, length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const strike = interpolate(frame, [12, 24], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const land = spring({ frame: frame - contrastLanding(length), fps, config: { damping: 16, stiffness: 150 } });

  const card = (text: string, good: boolean) => (
    <div
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        width: 880,
        padding: '60px 64px',
        borderRadius: 32,
        background: good ? colors.butter : colors.paper,
        boxShadow: SHADOW,
        fontFamily: fonts.heading,
        fontWeight: 700,
        fontSize: 92,
        lineHeight: 1.08,
        color: good ? colors.ink : colors.inkSoft,
        textAlign: 'center',
        textWrap: 'balance',
      }}
    >
      {text}
      <Mark good={good} />
    </div>
  );

  return (
    <Stage>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 70 }}>
        <div style={{ position: 'relative', transform: `rotate(-2deg) scale(${1 - strike * 0.06})`, opacity: 1 - strike * 0.25 }}>
          {card(before, false)}
          <div style={{ position: 'absolute', left: 40, top: '50%', height: 14, width: `${strike * 92}%`, borderRadius: 7, background: colors.accent, transform: 'rotate(-4deg)' }} />
        </div>
        <div style={{ transform: `rotate(1.5deg) scale(${land})`, opacity: Math.min(1, land * 2) }}>{card(after, true)}</div>
      </div>
    </Stage>
  );
};

const Mark: React.FC<{ good: boolean }> = ({ good }) => (
  <svg viewBox="0 0 40 40" width={96} height={96} style={{ position: 'absolute', top: -38, right: -26 }}>
    <circle cx="20" cy="20" r="19" fill={good ? colors.mint : colors.accent} stroke="#fff" strokeWidth={2.5} />
    {good ? (
      <path d="M11 21 L17.5 27 L29 14" fill="none" stroke={colors.ink} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M13 13 L27 27 M27 13 L13 27" fill="none" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" />
    )}
  </svg>
);

/** Wipes from one image to another (line art → colored in) with a crayon riding the edge */
export const RevealScene: React.FC<SceneProps<'reveal'>> = ({ src, from, to, length }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [length * 0.3, length * 0.75], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const edge = p * 125 - 10;
  const box = { width: 880, height: STAGE.height - TOP_SAFE - 110 };
  const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#fff' } as const;

  return (
    <Stage>
      <div style={{ position: 'relative', ...box, padding: 14, background: '#fff', borderRadius: 16, boxShadow: SHADOW, overflow: 'hidden' }}>
        <Img src={src(from)} style={fill} />
        <Img
          src={src(to)}
          style={{ ...fill, maskImage: `linear-gradient(100deg, #000 ${edge}%, transparent ${edge + 10}%)`, WebkitMaskImage: `linear-gradient(100deg, #000 ${edge}%, transparent ${edge + 10}%)` }}
        />
      </div>
      {p > 0 && p < 1 && (
        <div style={{ position: 'absolute', left: (1080 - box.width) / 2 + (box.width * (edge + 5)) / 100 - 70, top: '52%' }}>
          <Crayon size={150} />
        </div>
      )}
    </Stage>
  );
};

/** Closing shop card: the handle is typed into a search bar, then the book, its title and the CTA */
export const CtaScene: React.FC<SceneProps<'cta'>> = ({ src, image, title, points, cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame, fps, config: { damping: 14 } });
  const typed = theme.handle.slice(0, Math.max(0, Math.floor((frame - TYPE_START) / TYPE_FRAMES)));
  const typedAll = typed.length === theme.handle.length;
  const doneAt = TYPE_START + theme.handle.length * TYPE_FRAMES;
  const show = spring({ frame: frame - doneAt, fps, config: { damping: 14 } });
  const ctaIn = spring({ frame: frame - doneAt - 12, fps, config: { damping: 10, stiffness: 160 } });
  const pulse = 1 + Math.max(0, Math.sin((frame - doneAt) / 6)) * 0.05 * (frame > doneAt + 30 ? 1 : 0);

  return (
    <Stage>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, transform: `scale(${0.9 + card * 0.1})`, opacity: card }}>
        <div style={{ width: 900, padding: '34px 40px 40px', borderRadius: 40, background: colors.paper, boxShadow: SHADOW, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
          <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 18, padding: '20px 30px', borderRadius: 999, background: '#fff', border: `3px solid ${colors.lavender}`, fontFamily: fonts.body, fontWeight: 800, fontSize: 40, color: colors.ink }}>
            <svg viewBox="0 0 24 24" width={40} height={40}>
              <circle cx="10" cy="10" r="7" fill="none" stroke={colors.inkSoft} strokeWidth={2.6} />
              <path d="M15.5 15.5 L21 21" stroke={colors.inkSoft} strokeWidth={2.6} strokeLinecap="round" />
            </svg>
            <span>{typed}</span>
            {!typedAll && Math.floor(frame / 8) % 2 === 0 && <span style={{ width: 4, height: 44, background: colors.ink }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, opacity: show, transform: `translateY(${(1 - show) * 40}px)` }}>
            <Img src={src(image)} style={{ maxWidth: 760, maxHeight: 430, borderRadius: 16, boxShadow: '0 12px 30px rgba(46, 42, 71, 0.2)' }} />
            <Headline size={58}>{title}</Headline>
            {points.length > 0 && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {points.map((p) => (
                  <Pill key={p} size={28} style={{ background: colors.mint }}>
                    {p}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, transform: `scale(${ctaIn * pulse})` }}>
          <CtaPill text={cta} size={54} />
        </div>
      </div>
    </Stage>
  );
};
