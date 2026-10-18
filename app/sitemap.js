import { getAwards, groupByAgent, SITE_URL } from '../lib/data';

export const revalidate = 3600;

export default async function sitemap() {
  const awards = await getAwards().catch(() => []);
  const agents = groupByAgent(awards);
  const visible = new Set(agents.flatMap((g) => g.visible.map((a) => a.award_id)));
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    ...agents.map((g) => ({ url: `${SITE_URL}/agent/${g.slug}`, lastModified: g.latest || undefined, priority: 0.8 })),
    ...awards
      .filter((a) => visible.has(a.award_id))
      .map((a) => ({ url: `${SITE_URL}/award/${a.award_slug}`, lastModified: a.award_date || undefined, priority: 0.6 }))
  ];
}
