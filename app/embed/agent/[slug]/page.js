import { notFound } from 'next/navigation';
import { getAgent, formatDate, PAID_TIER_NAME } from '../../../../lib/data';
import { KUDOS_LOGO } from '../../../components';
import EmbedResize from '../../resize';

export const revalidate = 600;

// One agent's awards, for the agent to embed on their own website (snippet from /widget).
// Same free-tier cap as their Kudos profile. Every link opens Kudos in a new tab, and the
// footer links back to their profile, which is what makes the list "verified".
export const metadata = { robots: { index: false, follow: true } };

export default async function AgentEmbed({ params }) {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) notFound();

  const hidden = agent.total - agent.visible.length;
  const profile = `/agent/${agent.slug}`;

  return (
    <div className="embed agent-embed">
      <div className="ae-card">
        <div className="ae-head">
          <span className="ae-title">Awards &amp; Recognition</span>
          <span className="pill">
            🏅 {agent.total} award{agent.total === 1 ? '' : 's'}
          </span>
        </div>

        <ul className="ae-list">
          {agent.visible.map((a) => (
            <li key={a.award_id}>
              <a className="ae-award" href={`/award/${a.award_slug}`} target="_blank" rel="noopener">
                <span className="medal" aria-hidden="true">
                  🏅
                </span>
                <span className="ae-body">
                  <span className="ae-award-title">{a.award_title}</span>
                  <span className="ae-meta">
                    {a.issuer_name && <strong>{a.issuer_name}</strong>}
                    {a.issuer_name && a.award_date && ' · '}
                    {formatDate(a.award_date)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        {hidden > 0 && (
          <a className="ae-more" href={profile} target="_blank" rel="noopener">
            + {hidden} more award{hidden === 1 ? '' : 's'} on Kudos
            <span className="ae-more-sub"> · {PAID_TIER_NAME} shows the full history here</span>
          </a>
        )}

        <a className="ae-foot" href={profile} target="_blank" rel="noopener">
          <span className="ae-check" aria-hidden="true">
            ✓
          </span>
          Verified by
          <img src={KUDOS_LOGO} alt="" height="18" />
          <strong>AgentBee Kudos</strong>
        </a>
      </div>
      <EmbedResize />
    </div>
  );
}
