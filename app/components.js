import { CLAIM_URL, PAID_TIER_NAME, formatDate } from '../lib/data';

export function Medal() {
  return (
    <span className="medal" aria-hidden="true">
      🏅
    </span>
  );
}

export function Logo({ src, name }) {
  if (src) return <img className="logo" src={src} alt={`${name} logo`} />;
  return (
    <span className="logo" aria-hidden="true">
      🏆
    </span>
  );
}

export function AwardRow({ award, showAgent = false }) {
  return (
    <div className="award">
      <Medal />
      <div className="award-body">
        <p className="award-title">
          <a href={`/award/${award.award_slug}`}>{award.award_title}</a>
        </p>
        <div className="meta">
          {showAgent && <span>{award.agent_name}</span>}
          <span>{formatDate(award.award_date)}</span>
          {!showAgent && award.agent_country && <span className="tag">{award.agent_country}</span>}
          {award.issuer_name && (
            <span>
              Issued by: <strong>{award.issuer_name}</strong>
            </span>
          )}
        </div>
      </div>
      <a className="btn" href={`/award/${award.award_slug}`}>
        View award ↗
      </a>
    </div>
  );
}

export function AgentCard({ agent, headingLevel = 2 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const hidden = agent.total - agent.visible.length;
  return (
    <section className="card" data-search={`${agent.name} ${agent.country || ''}`.toLowerCase()}>
      <div className="card-head">
        <Logo src={agent.isClient ? agent.logo : null} name={agent.name} />
        <H>
          <a href={`/agent/${agent.slug}`}>{agent.name}</a>
        </H>
        <span className="pill">
          🏅 {agent.total} award{agent.total === 1 ? '' : 's'}
        </span>
      </div>
      {agent.visible.map((a) => (
        <AwardRow key={a.award_id} award={a} />
      ))}
      {hidden > 0 && (
        <div className="lock">
          🔒 Showing {agent.visible.length} of {agent.total} awards. {PAID_TIER_NAME} agents display their full award
          history. <a href={CLAIM_URL}>Is this your agency?</a>
        </div>
      )}
    </section>
  );
}
