import { getAgent } from '../../../../lib/data';
import { kudosCard, ogSize } from '../../../../lib/og';

export const size = ogSize;
export const contentType = 'image/png';
export const revalidate = 600;
export const alt = 'Kudos agent profile';

export default async function Image({ params }) {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) return kudosCard({ eyebrow: 'Agent profile', title: 'Education Agent Awards' });
  return kudosCard({
    eyebrow: 'Agent profile',
    title: agent.name,
    line1: `${agent.total} award${agent.total === 1 ? '' : 's'} on record`,
    line2: agent.country || ''
  });
}
