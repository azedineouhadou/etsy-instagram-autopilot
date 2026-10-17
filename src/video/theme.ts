import { loadFont as loadFredoka } from '@remotion/google-fonts/Fredoka';
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito';
import brand from '../../brand/brand.json';
import type { Background } from '../render/spec';

const heading = loadFredoka('normal', { weights: ['600', '700'], subsets: ['latin'] });
const body = loadNunito('normal', { weights: ['400', '700', '800'], subsets: ['latin'] });

export const theme = {
  colors: brand.colors,
  handle: brand.handle,
  // Staged into the render's public dir under brand/ by src/cli/render.ts
  logo: brand.logo ? `brand/${brand.logo}` : null,
  fonts: { heading: heading.fontFamily, body: body.fontFamily },
  formats: brand.formats,
};

export const bg = (name: Background): string => brand.colors[name];

/** Rotates through the brand's background order so consecutive slides differ */
export const rotatingBg = (index: number): string => {
  const order = brand.backgroundRotation as Background[];
  return bg(order[index % order.length] ?? 'butter');
};
