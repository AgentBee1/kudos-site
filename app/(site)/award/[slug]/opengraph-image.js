import { getAward, formatDate } from '../../../../lib/data';
import { kudosCard, ogSize } from '../../../../lib/og';

export const size = ogSize;
export const contentType = 'image/png';
export const revalidate = 600;
export const alt = 'Kudos award';

export default async function Image({ params }) {
  const { slug } = await params;
  const found = await getAward(slug);
  if (!found) {
    return kudosCard({ eyebrow: 'Award & Recognition', title: 'Education Agent Awards' });
  }
  const { award } = found;
  return kudosCard({
    eyebrow: 'Award & Recognition',
    title: award.award_title,
    line1: award.agent_name,
    line2: [award.issuer_name && `Awarded by ${award.issuer_name}`, formatDate(award.award_date)]
      .filter(Boolean)
      .join(' · ')
  });
}
