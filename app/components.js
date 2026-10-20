import { CLAIM_URL, PAID_TIER_NAME, formatDate, groupByAgent, groupByIssuer } from '../lib/data';
import SearchBox from './search-box';

export const KUDOS_LOGO = 'https://agentbee.net/wp-content/uploads/2023/09/kudos.png';

function Chevron() {
  return (
    <svg className="chev" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Medal() {
  return (
    <span className="medal" aria-hidden="true">
      🏅
    </span>
  );
}

export function Logo({ src, name, size = 40 }) {
  if (src) return <img className="logo" src={src} alt={`${name} logo`} width={size} height={size} />;
  return (
    <span className="logo" style={{ width: size, height: size }} aria-hidden="true">
      🏆
    </span>
  );
}

function Count({ n, label = 'award' }) {
  return (
    <span className="pill">
      🏅 {n} {label}
      {n === 1 ? '' : 's'}
    </span>
  );
}

export function AwardRow({ award, showAgent = false, target }) {
  const href = `/award/${award.award_slug}`;
  return (
    <div className="award">
      <Medal />
      <div className="award-body">
        <p className="award-title">
          <a href={href} target={target}>
            {award.award_title}
          </a>
        </p>
        <div className="meta">
          {showAgent && <strong className="meta-agent">{award.agent_name}</strong>}
          <span>{formatDate(award.award_date)}</span>
          {!showAgent && award.issuer_name && (
            <span>
              Issued by <strong>{award.issuer_name}</strong>
            </span>
          )}
        </div>
      </div>
      <a className="btn btn-ghost" href={href} target={target}>
        View award
      </a>
    </div>
  );
}

// One collapsed row per agent. The awards stay in the HTML (good for search engines),
// they're just folded until clicked.
export function AgentRow({ agent, target, open = false }) {
  const hidden = agent.total - agent.visible.length;
  return (
    <details className="row" data-search={`${agent.name} ${agent.country || ''}`.toLowerCase()} open={open}>
      <summary>
        <Logo src={agent.isClient ? agent.logo : null} name={agent.name} />
        <span className="row-name">
          {agent.name}
          {agent.country && <span className="row-sub">{agent.country}</span>}
        </span>
        <Count n={agent.total} />
        <Chevron />
      </summary>
      <div className="row-body">
        {agent.visible.map((a) => (
          <AwardRow key={a.award_id} award={a} target={target} />
        ))}
        <div className="row-foot">
          {hidden > 0 ? (
            <span className="lock agent-cta">
              🔒 Showing {agent.visible.length} of {agent.total} awards. {PAID_TIER_NAME} agents display their full
              award history.{' '}
              <a href={CLAIM_URL} target="_blank" rel="noopener">
                Is this your agency?
              </a>
            </span>
          ) : (
            <span />
          )}
          <a className="row-link" href={`/agent/${agent.slug}`} target={target}>
            View profile →
          </a>
        </div>
      </div>
    </details>
  );
}

function IssuerRow({ issuer, target }) {
  return (
    <details className="row" data-search={issuer.name.toLowerCase()}>
      <summary>
        <span className="logo" aria-hidden="true">
          🏛️
        </span>
        <span className="row-name">
          {issuer.name}
          {issuer.country && <span className="row-sub">{issuer.country}</span>}
        </span>
        <Count n={issuer.awards.length} />
        <Chevron />
      </summary>
      <div className="row-body">
        {issuer.awards.map((a) => (
          <AwardRow key={a.award_id} award={a} showAgent target={target} />
        ))}
      </div>
    </details>
  );
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

// The searchable directory used on the home page and in the WordPress embed.
export function Directory({ awards, view, basePath = '/', target }) {
  const agents = groupByAgent(awards).sort(byName);
  // Respect the free-tier cap in the institution view too.
  const visibleIds = new Set(agents.flatMap((g) => g.visible.map((a) => a.award_id)));
  const issuers = groupByIssuer(awards.filter((a) => visibleIds.has(a.award_id))).sort(byName);
  const isAgent = view !== 'institution';

  return (
    <section className="directory">
      <div className="dir-head">
        <div>
          <h2 className="dir-title">Agent Awards &amp; Recognition</h2>
          <p className="dir-sub">
            {awards.length} awards · {agents.length} agents · {groupByIssuer(awards).length} institutions
          </p>
        </div>
        <div className="tabs" role="tablist">
          <a href={basePath} className={isAgent ? 'tab active' : 'tab'} role="tab" aria-selected={isAgent}>
            By agent
          </a>
          <a
            href={`${basePath}?view=institution`}
            className={!isAgent ? 'tab active' : 'tab'}
            role="tab"
            aria-selected={!isAgent}
          >
            By institution
          </a>
        </div>
      </div>

      <SearchBox placeholder={isAgent ? 'Search agents or countries…' : 'Search institutions…'} />

      <div className="rows">
        {isAgent
          ? agents.map((g) => <AgentRow key={g.slug} agent={g} target={target} />)
          : issuers.map((i) => <IssuerRow key={i.name} issuer={i} target={target} />)}
      </div>
      <p id="no-results" className="muted empty" hidden>
        No matches.
      </p>
    </section>
  );
}
