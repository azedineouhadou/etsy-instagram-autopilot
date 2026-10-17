import { AbsoluteFill } from 'remotion';
import type { SpotlightProps } from '../../render/spec';
import { Backdrop, CtaPill, Handle, Headline, PaperCard, Pill, Subline, productSrc } from '../components';
import { bg } from '../theme';

/** Single image post: one product mockup with headline, badges and CTA */
export const Spotlight: React.FC<SpotlightProps> = ({ productDir, background, eyebrow, headline, subline, mockup, badges, cta }) => (
  <Backdrop color={bg(background)} seed={headline}>
    <AbsoluteFill style={{ alignItems: 'center', padding: '90px 80px 70px', gap: 26 }}>
      {eyebrow && <Pill size={26}>{eyebrow.toUpperCase()}</Pill>}
      <Headline size={84}>{headline}</Headline>
      {subline && <Subline size={36}>{subline}</Subline>}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <PaperCard src={productSrc(productDir, mockup)} width={badges.length ? 470 : 520} rotate={-3} />
      </div>

      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
          {badges.map((b) => (
            <Pill key={b} size={26}>
              {b}
            </Pill>
          ))}
        </div>
      )}
      <CtaPill text={cta} size={36} />
      <Handle />
    </AbsoluteFill>
  </Backdrop>
);
