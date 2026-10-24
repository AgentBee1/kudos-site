import { notFound } from 'next/navigation';
import { getAgent, getAwards, groupByAgent, CLAIM_URL, PAID_TIER_NAME, websiteHref, DISCLAIMER } from '../../../../lib/data';
import { AwardRow, Logo } from '../../../components';

export const revalidate = 600;

export async function generateStaticParams() {
  // If the data can't be reached at build time, pages are simply built on first visit.
  const awards = await getAwards().catch(() => []);
  return groupByAgent(awards).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) return {};
  const issuers = [...new Set(agent.visible.map((a) => a.issuer_name).filter(Boolean))].slice(0, 3);
  const description = `${agent.name} has ${agent.total} award${agent.total === 1 ? '' : 's'} on record${
    issuers.length ? `, including from ${issuers.join(', ')}` : ''
  }.`;
  return {
    title: `${agent.name} – Awards & Recognition`,
    description,
    alternates: { canonical: `/agent/${agent.slug}` },
    openGraph: { title: `${agent.name} – Awards & Recognition`, description, url: `/agent/${agent.slug}` }
  };
}

export default async function AgentPage({ params }) {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) notFound();

  const hidden = agent.total - agent.visible.length;
  const site = agent.isClient ? websiteHref(agent.website) : null;

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <p className="eyebrow">Agent profile</p>
          <h1>{agent.name}</h1>
          <p className="sub">
            {agent.country ? `${agent.country} · ` : ''}
            {agent.total} award{agent.total === 1 ? '' : 's'} on record
          </p>
        </div>
      </section>

      <main className="wrap detail">
        {agent.isClient && (agent.logo || site) && (
          <div className="actions">
            {agent.logo && <Logo src={agent.logo} name={agent.name} size={56} />}
            {site && (
              <a className="btn btn-gold" href={site} rel="noopener" target="_blank">
                Visit {agent.name} website ↗
              </a>
            )}
          </div>
        )}

        <div className="panel">
          {agent.visible.map((a) => (
            <AwardRow key={a.award_id} award={a} />
          ))}
          {hidden > 0 && (
            <div className="row-foot">
              <span className="lock agent-cta">
                🔒 Showing {agent.visible.length} of {agent.total} awards. {PAID_TIER_NAME} agents display their full
                award history.
              </span>
              <span className="client-note">
                Showing the {agent.visible.length} most recent of {agent.total} awards. The full list is in your AgentBee
                portal.
              </span>
            </div>
          )}
        </div>

        {!agent.isClient && (
          <div className="callout agent-cta">
            <p>
              <strong>Is this your agency?</strong> Claim your Kudos profile
              {hidden > 0 ? ` and upgrade to ${PAID_TIER_NAME} to display all ${agent.total} awards` : ''}.
            </p>
            <a className="btn btn-gold" href={CLAIM_URL}>
              Claim this profile
            </a>
          </div>
        )}

        <p className="agent-embed-link agent-cta">
          <a href={`/widget?agent=${agent.slug}`}>Show these awards on your own website →</a>
        </p>

        <p className="disclaimer">{DISCLAIMER}</p>
      </main>
    </>
  );
}
