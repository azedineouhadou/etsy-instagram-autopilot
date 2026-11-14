import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StickerSpec } from '../../render/spec';
import { theme } from '../theme';
import { STAGE, TOP_SAFE } from './layout';
import { checkTick } from './timeline';

const { colors, fonts } = theme;
const STICKER_SHADOW = '0 14px 34px rgba(0, 0, 0, 0.35)';

type Props<K extends StickerSpec['kind']> = Extract<StickerSpec, { kind: K }> & { at: number };

const usePop = (at: number, damping = 10) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness: 170 } });
};

/** Every sticker except `circle`, which is drawn on the zoomed image by StoryReel */
export const Sticker: React.FC<{ sticker: StickerSpec; at: number }> = ({ sticker, at }) => {
  switch (sticker.kind) {
    case 'count':
      return <CountBadge {...sticker} at={at} />;
    case 'chips':
      return <Chips {...sticker} at={at} />;
    case 'stamp':
      return <Stamp {...sticker} at={at} />;
    case 'pill':
      return <SuccessPill {...sticker} at={at} />;
    case 'checks':
      return <Checklist {...sticker} at={at} />;
    case 'circle':
      return null;
  }
};

/** Round "200 pages" badge, top left */
const CountBadge: React.FC<Props<'count'>> = ({ value, label, at }) => {
  const s = usePop(at);
  return (
    <div
      style={{
        position: 'absolute',
        top: TOP_SAFE + 20,
        left: 50,
        width: 270,
        height: 270,
        borderRadius: '50%',
        background: colors.butter,
        border: `8px solid ${colors.ink}`,
        boxShadow: STICKER_SHADOW,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.ink,
        transform: `scale(${s}) rotate(${interpolate(s, [0, 1], [-40, -10])}deg)`,
      }}
    >
      <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: String(value).length > 3 ? 84 : 104, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 36, marginTop: 4 }}>{label}</div>
    </div>
  );
};

/** A row of benefit chips near the bottom of the stage, landing one after another */
const Chips: React.FC<Props<'chips'>> = ({ items, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ top: STAGE.height - 150, height: 120, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      {items.map((item, i) => {
        const s = spring({ frame: frame - at - i * 7, fps, config: { damping: 10, stiffness: 170 } });
        return (
          <div
            key={item}
            style={{
              padding: '18px 34px',
              borderRadius: 999,
              background: '#fff',
              border: `5px solid ${[colors.mint, colors.sky, colors.pink][i % 3]}`,
              boxShadow: STICKER_SHADOW,
              fontFamily: fonts.body,
              fontWeight: 800,
              fontSize: 40,
              color: colors.ink,
              whiteSpace: 'nowrap',
              transform: `scale(${s}) rotate(${(i % 2 ? 1 : -1) * 3}deg)`,
            }}
          >
            {item}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Rubber stamp that slams down at an angle */
const Stamp: React.FC<Props<'stamp'>> = ({ text, at }) => {
  const frame = useCurrentFrame();
  const slam = interpolate(frame - at, [0, 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (frame < at) return null;
  return (
    <AbsoluteFill style={{ top: STAGE.height * 0.62, height: 220, alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          padding: '22px 46px',
          border: `10px solid ${colors.accent}`,
          borderRadius: 18,
          background: 'rgba(255, 251, 245, 0.94)',
          color: colors.accent,
          fontFamily: fonts.heading,
          fontWeight: 700,
          // Always one line: long stamps get a smaller size instead of wrapping
          fontSize: text.length > 16 ? 56 : 76,
          whiteSpace: 'nowrap',
          letterSpacing: 1,
          textTransform: 'uppercase',
          boxShadow: STICKER_SHADOW,
          opacity: slam,
          transform: `rotate(-8deg) scale(${interpolate(slam, [0, 1], [2.3, 1])})`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** "Found them all!" pill, top right */
const SuccessPill: React.FC<Props<'pill'>> = ({ text, at }) => {
  const s = usePop(at, 9);
  return (
    <div
      style={{
        position: 'absolute',
        top: TOP_SAFE + 30,
        right: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '22px 38px',
        borderRadius: 999,
        background: colors.mint,
        border: '5px solid #fff',
        boxShadow: STICKER_SHADOW,
        fontFamily: fonts.body,
        fontWeight: 800,
        fontSize: 50,
        color: colors.ink,
        whiteSpace: 'nowrap',
        transform: `scale(${s}) rotate(${interpolate(s, [0, 1], [12, 4])}deg)`,
      }}
    >
      <svg viewBox="0 0 24 24" width={44} height={44}>
        <path d="M5 12.5 L10 17.5 L19.5 7" fill="none" stroke={colors.ink} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {text}
    </div>
  );
};

/** A small checklist whose items tick one by one */
const Checklist: React.FC<Props<'checks'>> = ({ items, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = usePop(at, 14);
  return (
    <div
      style={{
        position: 'absolute',
        left: 50,
        bottom: 1920 - STAGE.top - STAGE.height + 40,
        padding: '34px 46px',
        borderRadius: 32,
        background: colors.paper,
        boxShadow: STICKER_SHADOW,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        transform: `scale(${card}) rotate(-3deg)`,
        transformOrigin: 'bottom left',
      }}
    >
      {items.map((item, i) => {
        const tick = spring({ frame: frame - at - checkTick(i), fps, config: { damping: 12, stiffness: 200 } });
        return (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 20, fontFamily: fonts.body, fontWeight: 800, fontSize: 54, color: colors.ink }}>
            <svg viewBox="0 0 40 40" width={66} height={66}>
              <rect x="3" y="3" width="34" height="34" rx="9" fill={tick > 0.5 ? colors.mint : '#fff'} stroke={colors.ink} strokeWidth={3} />
              <path
                d="M11 21 L17.5 27 L29 14"
                fill="none"
                stroke={colors.ink}
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - tick}
              />
            </svg>
            <span style={{ opacity: 0.55 + tick * 0.45 }}>{item}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Hand-drawn ring around a spot on the zoomed image; lives inside the zoom transform */
export const CircleMark: React.FC<Props<'circle'> & { scale: number }> = ({ x, y, r, at, scale }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame - at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (frame < at) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: `${r * 200}%`, aspectRatio: '1', transform: 'translate(-50%, -50%) rotate(-12deg)', overflow: 'visible' }}
    >
      <ellipse
        cx="50"
        cy="50"
        rx="48"
        ry="44"
        fill="none"
        stroke={colors.accent}
        // Divided by the zoom so the ring keeps the same weight on screen as the camera pushes in
        strokeWidth={6 / scale}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
};
