import { useMemo, type ReactNode } from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import type { BeatSpec, StoryReelProps, StoryTiming } from '../../render/spec';
import { productSrc } from '../components';
import { Captions } from '../story/Captions';
import { ContrastScene, CoverScene, CtaScene, PagesScene, RevealScene, ZoomScene } from '../story/scenes';
import { CircleMark, Sticker } from '../story/stickers';
import { beatStarts, musicVolumes, OVERLAP, SFX_LEVELS, sfxCues, silentTiming, stickerFrame, totalFrames } from '../story/timeline';
import { theme } from '../theme';

/**
 * Reel told in beats: one spoken line each, with its own scene, stickers landing on cue words,
 * word-synced captions and sound effects, over a blurred backdrop made from the book's own art.
 */
export const StoryReel: React.FC<StoryReelProps & { sfx?: boolean }> = (props) => {
  const { productDir, backdrop, beats, voiceoverSrc, musicSrc, sfx = false } = props;
  const timing = useMemo(() => props.timing ?? silentTiming(beats), [props.timing, beats]);
  const music = useMemo(() => (musicSrc ? musicVolumes(timing) : []), [musicSrc, timing]);
  const starts = beatStarts(timing.beats);
  const total = totalFrames(timing.beats);
  const src = (path: string) => productSrc(productDir, path);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.ink }}>
      <ThemedBackdrop src={src(backdrop)} total={total} />
      {beats.map((beat, i) => (
        // Each beat stays OVERLAP frames into the next, under it, while the next one fades in
        <Sequence key={i} from={starts[i]} durationInFrames={timing.beats[i]! + (i < beats.length - 1 ? OVERLAP : 0)}>
          <BeatShell fade={i > 0}>
            <Beat beat={beat} index={i} timing={timing} src={src} />
          </BeatShell>
        </Sequence>
      ))}
      <Captions words={timing.words} beats={beats} />
      {voiceoverSrc && <Audio src={staticFile(voiceoverSrc)} />}
      {musicSrc && <Audio src={staticFile(musicSrc)} volume={(f) => music[f] ?? 0} />}
      {sfx &&
        sfxCues(beats, timing, theme.handle.length).map((cue, i) => (
          <Sequence key={i} from={cue.from} durationInFrames={cue.frames}>
            <Audio src={staticFile(`audio/sfx/${cue.sound}.mp3`)} volume={SFX_LEVELS[cue.sound]} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

export const storyReelFrames = (props: Pick<StoryReelProps, 'beats' | 'timing'>) => totalFrames((props.timing ?? silentTiming(props.beats)).beats);

const Beat: React.FC<{ beat: BeatSpec; index: number; timing: StoryTiming; src: (path: string) => string }> = ({ beat, index, timing, src }) => {
  const length = timing.beats[index]!;
  const { scene } = beat;
  const at = beat.stickers.map((s, k) => stickerFrame(s, k, index, timing));

  let view: ReactNode;
  switch (scene.kind) {
    case 'zoom':
      view = (
        <ZoomScene
          {...scene}
          src={src}
          length={length}
          overlay={(scale) =>
            beat.stickers.map((s, k) => (s.kind === 'circle' ? <CircleMark key={k} {...s} at={at[k]!} scale={scale} /> : null))
          }
        />
      );
      break;
    case 'pages':
      view = <PagesScene {...scene} src={src} length={length} />;
      break;
    case 'cover':
      view = <CoverScene {...scene} src={src} length={length} />;
      break;
    case 'contrast':
      view = <ContrastScene {...scene} src={src} length={length} />;
      break;
    case 'reveal':
      view = <RevealScene {...scene} src={src} length={length} />;
      break;
    case 'cta':
      view = <CtaScene {...scene} src={src} length={length} />;
      break;
  }

  return (
    <AbsoluteFill>
      {view}
      {beat.stickers.map((s, k) => (
        <Sticker key={k} sticker={s} at={at[k]!} />
      ))}
    </AbsoluteFill>
  );
};

/** Quick push-in fade so beats cut like an edit, not a slideshow */
const BeatShell: React.FC<{ fade: boolean; children: ReactNode }> = ({ fade, children }) => {
  const frame = useCurrentFrame();
  const t = fade ? interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateRight: 'clamp' }) : 1;
  return <AbsoluteFill style={{ opacity: t, transform: `scale(${1.06 - t * 0.06})` }}>{children}</AbsoluteFill>;
};

/** The book's own art, blurred and darkened, drifting slowly: each book brings its own mood */
const ThemedBackdrop: React.FC<{ src: string; total: number }> = ({ src, total }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, total], [1.25, 1.4]);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(34px) brightness(0.42) saturate(1.25)', transform: `scale(${scale})` }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(20, 16, 36, 0.55) 100%)' }} />
      {/* Darker behind the captions so white words read on any book */}
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(20, 16, 36, 0.5) 72%, rgba(20, 16, 36, 0.5) 100%)' }} />
    </AbsoluteFill>
  );
};
