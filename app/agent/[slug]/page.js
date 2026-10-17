import { notFound } from 'next/navigation';
import { getAgent, getAwards, groupByAgent, CLAIM_URL, PAID_TIER_NAME, websiteHref, DISCLAIMER } from '../../../lib/data';
import { AwardRow, Logo } from '../../components';

export const revalidate = 600;

export async function generateStaticParams() {
  const awards = await getAwards();
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
    <div className="detail">
      <p className="eyebrow">Agent profile</p>
      <div className="card-head" style={{ padding: 0, marginBottom: 12 }}>
        <Logo src={agent.isClient ? agent.logo : null} name={agent.name} />
        <h1 style={{ margin: 0 }}>{agent.name}</h1>
      </div>
      <p className="muted">
        {agent.country ? `${agent.country} · ` : ''}
        {agent.total} award{agent.total === 1 ? '' : 's'} on record
      </p>

      {site && (
        <div className="actions">
          <a className="btn btn-gold" href={site} rel="noopener" target="_blank">
            Visit {agent.name} website ↗
          </a>
        </div>
      )}

      <section className="card">
        {agent.visible.map((a) => (
          <AwardRow key={a.award_id} award={a} />
        ))}
        {hidden > 0 && (
          <div className="lock">
            🔒 Showing {agent.visible.length} of {agent.total} awards. {PAID_TIER_NAME} agents display their full
            award history.
          </div>
        )}
      </section>

      {!agent.isClient && (
        <div className="callout">
          <p>
            <strong>Is this your agency?</strong> Claim your Kudos profile
            {hidden > 0 ? ` and upgrade to ${PAID_TIER_NAME} to display all ${agent.total} awards` : ''}.
          </p>
          <p>
            <a className="btn" href={CLAIM_URL}>
              Claim this profile →
            </a>
          </p>
        </div>
      )}

      <p className="muted small">{DISCLAIMER}</p>
    </div>
  );
}
