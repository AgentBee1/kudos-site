import { getAwards, groupByAgent, groupByIssuer } from '../lib/data';
import { AgentCard, AwardRow } from './components';
import SearchBox from './search-box';

export const revalidate = 600;

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const view = params?.view === 'institution' ? 'institution' : 'agent';
  const awards = await getAwards();

  return (
    <>
      <div className="hero">
        <h1>Education Agent Awards &amp; Recognition</h1>
        <p>
          A free record of awards given to international student recruitment agents by universities and colleges.{' '}
          {awards.length} awards listed.
        </p>
      </div>

      <SearchBox placeholder={view === 'agent' ? 'Search agents or countries…' : 'Search institutions…'} />

      {view === 'agent' ? <AgentList awards={awards} /> : <IssuerList awards={awards} />}

      <p id="no-results" className="muted" hidden>
        No matches.
      </p>
    </>
  );
}

function AgentList({ awards }) {
  // Neutral ordering: most recent award first, never by award count or tier.
  const agents = groupByAgent(awards).sort((a, b) => String(b.latest).localeCompare(String(a.latest)));
  return agents.map((agent) => <AgentCard key={agent.slug} agent={agent} />);
}

function IssuerList({ awards }) {
  // Respect the free-tier cap here too, so hidden awards aren't exposed via the institution view.
  const visibleIds = new Set(groupByAgent(awards).flatMap((g) => g.visible.map((a) => a.award_id)));
  return groupByIssuer(awards.filter((a) => visibleIds.has(a.award_id))).map((issuer) => (
    <section className="card" key={issuer.name} data-search={issuer.name.toLowerCase()}>
      <div className="card-head">
        <span className="logo" aria-hidden="true">
          🏛️
        </span>
        <h2>{issuer.name}</h2>
        <span className="pill">
          🏅 {issuer.awards.length} award{issuer.awards.length === 1 ? '' : 's'} listed
        </span>
      </div>
      {issuer.awards.map((a) => (
        <AwardRow key={a.award_id} award={a} showAgent />
      ))}
    </section>
  ));
}
