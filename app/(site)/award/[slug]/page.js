import { notFound } from 'next/navigation';
import {
  getAward,
  getAwards,
  CLAIM_URL,
  PAID_TIER_NAME,
  formatDate,
  websiteHref,
  DISCLAIMER
} from '../../../../lib/data';
import { AwardRow } from '../../../components';

export const revalidate = 600;

export async function generateStaticParams() {
  const awards = await getAwards();
  return awards.map((a) => ({ slug: a.award_slug }));
}

function isHidden(award, agent) {
  return !agent.visible.some((v) => v.award_id === award.award_id);
}

function sourceLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('linkedin') || host === 'lnkd.in') return 'View the announcement on LinkedIn';
    if (host.includes('instagram')) return 'View the announcement on Instagram';
    if (host.includes('facebook')) return 'View the announcement on Facebook';
    return `View the announcement (${host})`;
  } catch {
    return 'View the announcement';
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const found = await getAward(slug);
  if (!found) return {};
  const { award, agent } = found;
  const title = `${award.agent_name} – ${award.award_title}${award.issuer_name ? ` (${award.issuer_name})` : ''}`;
  const description = `${award.agent_name} received "${award.award_title}" from ${
    award.issuer_name || 'an education provider'
  }${award.award_date ? `, ${formatDate(award.award_date)}` : ''}. See all awards for ${award.agent_name} on Kudos.`;
  return {
    title,
    description,
    alternates: { canonical: `/award/${award.award_slug}` },
    robots: isHidden(award, agent) ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: `/award/${award.award_slug}`, type: 'article' },
    twitter: { card: 'summary_large_image', title, description }
  };
}

export default async function AwardPage({ params }) {
  const { slug } = await params;
  const found = await getAward(slug);
  if (!found) notFound();
  const { award, agent } = found;
  const site = agent.isClient ? websiteHref(agent.website) : null;

  let more = [];
  if (!agent.isClient) {
    const all = await getAwards();
    more = all.filter((a) => a.agent_slug !== agent.slug).slice(0, 3);
  }

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <p className="eyebrow">🏆 Award &amp; Recognition</p>
          <h1>{award.award_title}</h1>
          <p className="sub">
            Awarded to <a href={`/agent/${agent.slug}`}>{award.agent_name}</a>
            {award.issuer_name ? ` by ${award.issuer_name}` : ''}
          </p>
        </div>
      </section>

      <main className="wrap detail">
        <div className="panel">
          <dl className="facts">
            <dt>Recipient</dt>
            <dd>
              <a href={`/agent/${agent.slug}`}>{award.agent_name}</a>
              {award.agent_country ? <span className="muted"> · {award.agent_country}</span> : null}
            </dd>
            <dt>Awarded by</dt>
            <dd>{award.issuer_name || '—'}</dd>
            <dt>Date</dt>
            <dd>{formatDate(award.award_date) || '—'}</dd>
            <dt>Source</dt>
            <dd>
              {award.source_url ? (
                <a href={award.source_url} rel="noopener nofollow" target="_blank">
                  {sourceLabel(award.source_url)} ↗
                </a>
              ) : (
                <span className="muted">Source on file with AgentBee</span>
              )}
            </dd>
          </dl>
        </div>

        <div className="actions">
          {agent.total > 1 && (
            <a className="btn btn-blue" href={`/agent/${agent.slug}`}>
              See all {agent.total} awards for {agent.name} →
            </a>
          )}
          {site && (
            <a className="btn btn-gold" href={site} rel="noopener" target="_blank">
              Visit {agent.name} website ↗
            </a>
          )}
        </div>

        {!agent.isClient && (
          <div className="callout">
            <p>
              <strong>Is this your agency?</strong> Claim your Kudos profile
              {agent.total > agent.visible.length
                ? ` and upgrade to ${PAID_TIER_NAME} to display all ${agent.total} of your awards`
                : ''}
              .
            </p>
            <a className="btn btn-gold" href={CLAIM_URL}>
              Claim this profile
            </a>
          </div>
        )}

        {more.length > 0 && (
          <>
            <h2 className="section-title">Recently added to Kudos</h2>
            <div className="panel">
              {more.map((a) => (
                <AwardRow key={a.award_id} award={a} showAgent />
              ))}
            </div>
          </>
        )}

        <p className="disclaimer">{DISCLAIMER}</p>
      </main>
    </>
  );
}
