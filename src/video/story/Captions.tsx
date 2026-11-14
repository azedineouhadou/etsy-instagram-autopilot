import { createTikTokStyleCaptions, type TikTokPage } from '@remotion/captions';
import { useMemo } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { normalWord, type BeatSpec, type TimedWord } from '../../render/spec';
import { theme } from '../theme';
import { CAPTIONS } from './layout';

const { colors, fonts } = theme;
// Words closer together than this share a caption page: about 3 words at the reel voice's pace
const GROUP_MS = 1000;
const OUTLINE = [
  [-5, -5], [0, -6], [5, -5], [6, 0], [5, 5], [0, 6], [-5, 5], [-6, 0],
].map(([x, y]) => `${x}px ${y}px 0 ${colors.ink}`).join(', ');

type Page = TikTokPage & { beat: number; endMs: number };

/**
 * Word-synced captions: a few words at a time, each lighting up as it's spoken.
 * Pages never span two beats, so a caption changes with the scene.
 */
export const Captions: React.FC<{ words: TimedWord[]; beats: BeatSpec[] }> = ({ words, beats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;

  const pages = useMemo(() => {
    const all = beats.flatMap((_, beat) => {
      const own = words.filter((w) => w.beat === beat);
      const captions = own.map((w, i) => ({ text: i ? ` ${w.text}` : w.text, startMs: w.startMs, endMs: w.endMs, timestampMs: null, confidence: null }));
      return createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: GROUP_MS }).pages.map((p) => ({ ...p, beat }));
    });
    // A page stays up until the next one starts, so pauses don't leave the screen empty
    return all.map((p, i): Page => ({ ...p, endMs: all[i + 1]?.startMs ?? Infinity }));
  }, [words, beats]);

  const page = pages.find((p) => p.startMs <= ms && ms < p.endMs);
  if (!page) return null;
  const emphasis = new Set(beats[page.beat]?.emphasis.map(normalWord));
  const enter = spring({ frame: frame - Math.round((page.startMs / 1000) * fps), fps, config: { damping: 14, stiffness: 220 } });

  return (
    <AbsoluteFill style={{ top: CAPTIONS.top, height: CAPTIONS.bottom - CAPTIONS.top, alignItems: 'center', justifyContent: 'center', padding: '0 70px' }}>
      <div
        style={{
          fontFamily: fonts.heading,
          fontWeight: 700,
          fontSize: 104,
          lineHeight: 1.12,
          textAlign: 'center',
          textWrap: 'balance',
          transform: `scale(${0.85 + enter * 0.15})`,
          opacity: Math.min(1, enter * 2),
        }}
      >
        {page.tokens.map((token, i) => {
          const spoken = ms >= token.fromMs;
          const active = spoken && ms < token.toMs;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: '0 0.14em',
                color: emphasis.has(normalWord(token.text)) ? colors.butter : '#fff',
                opacity: spoken ? 1 : 0.5,
                transform: `scale(${active ? 1.08 : 1})`,
                textShadow: `${OUTLINE}, 0 10px 24px rgba(0, 0, 0, 0.45)`,
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
