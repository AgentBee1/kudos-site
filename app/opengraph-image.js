import { kudosCard, ogSize } from '../lib/og';

export const size = ogSize;
export const contentType = 'image/png';
export const alt = 'Kudos – Education Agent Awards & Recognition';

export default function Image() {
  return kudosCard({
    eyebrow: 'Free agent checking tool',
    title: 'Education Agent Awards & Recognition',
    line2: 'For institutions and students'
  });
}
