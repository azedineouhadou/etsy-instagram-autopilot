import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, random, staticFile, useCurrentFrame } from 'remotion';
import { theme } from './theme';

const { colors, fonts } = theme;
const DOODLES = ['dot', 'star', 'squiggle', 'ring'] as const;
type DoodleKind = 'blob' | (typeof DOODLES)[number];

export const productSrc = (productDir: string, path: string) => staticFile(`${productDir}/${path}`);

/** Pastel background with soft doodles; `drift` animates them for reels, stills render frame 0 */
export const Backdrop: React.FC<{ color: string; seed: string; drift?: boolean; children?: ReactNode }> = ({
  color,
  seed,
  drift = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const shapes = Array.from({ length: 14 }, (_, i) => {
    const r = (k: string) => random(`${seed}-${i}-${k}`);
    const move = drift ? Math.sin(frame / 40 + i) * 14 : 0;
    return {
      kind: (i < 3 ? 'blob' : (DOODLES[i % DOODLES.length] ?? 'dot')) as DoodleKind,
      // Small doodles stay in the side margins so they never sit behind text
      x: i < 3 ? r('x') * 100 : r('side') < 0.5 ? 2 + r('x') * 9 : 89 + r('x') * 9,
      y: i < 3 ? r('y') * 100 : 4 + r('y') * 92,
      size: i < 3 ? 380 + r('s') * 260 : 36 + r('s') * 46,
      rotate: r('r') * 360 + (drift ? frame * 0.3 : 0),
      move,
    };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: color, overflow: 'hidden' }}>
      {shapes.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            transform: `translate(-50%, -50%) translateY(${s.move}px) rotate(${s.rotate}deg)`,
          }}
        >
          <Doodle kind={s.kind} />
        </div>
      ))}
      {children}
    </AbsoluteFill>
  );
};

const Doodle: React.FC<{ kind: DoodleKind }> = ({ kind }) => {
  const stroke = { fill: 'none', stroke: colors.ink, strokeOpacity: 0.16, strokeWidth: 6, strokeLinecap: 'round' } as const;
  switch (kind) {
    case 'blob':
      return <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.35)' }} />;
    case 'dot':
      return <div style={{ width: '40%', height: '40%', margin: '30%', borderRadius: '50%', background: colors.ink, opacity: 0.12 }} />;
    case 'star':
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <path d="M50 8 L61 38 L93 39 L67 58 L77 90 L50 71 L23 90 L33 58 L7 39 L39 38 Z" {...stroke} strokeLinejoin="round" />
        </svg>
      );
    case 'squiggle':
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <path d="M8 55 Q20 30 32 55 T56 55 T80 55 T96 50" {...stroke} />
        </svg>
      );
    case 'ring':
      return (
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="50" cy="50" r="36" {...stroke} />
        </svg>
      );
  }
};

/** A product image on white paper with a strip of tape, like a page pinned to a board */
export const PaperCard: React.FC<{ src: string; width: number; rotate?: number; tape?: boolean; style?: CSSProperties }> = ({
  src,
  width,
  rotate = 0,
  tape = true,
  style,
}) => (
  <div
    style={{
      position: 'relative',
      width,
      padding: 16,
      background: '#fff',
      borderRadius: 18,
      boxShadow: '0 24px 60px rgba(46, 42, 71, 0.22), 0 4px 12px rgba(46, 42, 71, 0.12)',
      transform: `rotate(${rotate}deg)`,
      ...style,
    }}
  >
    <Img src={src} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 8 }} />
    {tape && (
      <div
        style={{
          position: 'absolute',
          top: -22,
          left: '50%',
          width: 150,
          height: 44,
          // Accent is never a background colour, so the tape stays visible on every slide
          background: colors.accent,
          opacity: 0.55,
          transform: 'translateX(-50%) rotate(-4deg)',
          boxShadow: '0 2px 6px rgba(46, 42, 71, 0.1)',
        }}
      />
    )}
  </div>
);

export const Headline: React.FC<{ size: number; children: ReactNode; style?: CSSProperties }> = ({ size, children, style }) => (
  <div
    style={{
      fontFamily: fonts.heading,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.05,
      letterSpacing: -0.5,
      color: colors.ink,
      textAlign: 'center',
      textWrap: 'balance',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Subline: React.FC<{ size?: number; children: ReactNode; style?: CSSProperties }> = ({ size = 40, children, style }) => (
  <div
    style={{
      fontFamily: fonts.body,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.3,
      color: colors.inkSoft,
      textAlign: 'center',
      textWrap: 'balance',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{ children: ReactNode; dark?: boolean; size?: number; style?: CSSProperties }> = ({
  children,
  dark = false,
  size = 30,
  style,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 14,
      padding: `${size * 0.5}px ${size * 1.05}px`,
      borderRadius: 999,
      background: dark ? colors.ink : '#fff',
      color: dark ? '#fff' : colors.ink,
      fontFamily: fonts.body,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: 0.3,
      boxShadow: '0 8px 20px rgba(46, 42, 71, 0.14)',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Crayon: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(-35deg)' }}>
    <rect x="22" y="38" width="56" height="24" rx="4" fill={colors.accent} />
    <path d="M78 38 L96 50 L78 62 Z" fill={colors.accent} />
    <rect x="34" y="38" width="8" height="24" fill="rgba(255,255,255,0.55)" />
    <rect x="58" y="38" width="8" height="24" fill="rgba(255,255,255,0.55)" />
  </svg>
);

export const Arrow: React.FC<{ size: number; color?: string }> = ({ size, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path d="M4 12 H19 M13 6 L19 12 L13 18" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CtaPill: React.FC<{ text: string; size?: number; style?: CSSProperties }> = ({ text, size = 40, style }) => (
  <Pill dark size={size} style={style}>
    <Crayon size={size * 1.4} />
    {text}
    <Arrow size={size * 0.9} />
  </Pill>
);

export const Handle: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.5 }}>
    {theme.logo && (
      // Source logo is 75 px, so it stays badge-sized to avoid upscaling blur; circle crop hides its square background
      <Img
        src={staticFile(theme.logo)}
        style={{ width: size * 2.6, height: size * 2.6, borderRadius: '50%', boxShadow: '0 4px 12px rgba(46, 42, 71, 0.15)' }}
      />
    )}
    <div style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: size, color: colors.ink, opacity: 0.55, letterSpacing: 0.5 }}>
      {theme.handle}
    </div>
  </div>
);

export const CheckItem: React.FC<{ children: ReactNode; size?: number; style?: CSSProperties }> = ({ children, size = 38, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 20, ...style }}>
    <svg viewBox="0 0 40 40" width={size * 1.3} height={size * 1.3} style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r="19" fill="#fff" />
      <path d="M11 21 L17.5 27 L29 14" fill="none" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <div style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: size, color: colors.ink, lineHeight: 1.2 }}>{children}</div>
  </div>
);
