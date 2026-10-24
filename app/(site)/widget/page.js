import { getAwards, groupByAgent, SITE_URL } from '../../../lib/data';
import WidgetBuilder from './builder';

export const revalidate = 600;

export const metadata = {
  title: 'Show your awards on your website',
  description:
    'Education agents: add a verified list of your awards and recognition to your own website with one copy-and-paste snippet.',
  alternates: { canonical: '/widget' }
};

export default async function WidgetPage({ searchParams }) {
  const params = await searchParams;
  const awards = await getAwards().catch(() => []);
  const agents = groupByAgent(awards)
    .map((g) => ({ slug: g.slug, name: g.name, country: g.country || '', total: g.total }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <p className="eyebrow">For agents</p>
          <h1>Show your awards on your website</h1>
          <p className="sub">
            Find your agency, copy the code, and paste it into your site. The list updates itself whenever a new
            award is added to Kudos.
          </p>
        </div>
      </section>

      <main className="wrap detail">
        <WidgetBuilder agents={agents} initial={params?.agent || ''} siteUrl={SITE_URL} />
      </main>
    </>
  );
}
