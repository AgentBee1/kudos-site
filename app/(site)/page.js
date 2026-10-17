import { getAwards } from '../../lib/data';
import { Directory, KUDOS_LOGO } from '../components';

export const revalidate = 600;

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const view = params?.view === 'institution' ? 'institution' : 'agent';
  const awards = await getAwards();

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <h1>Education Agent Awards &amp; Recognition</h1>
          <p className="hero-sub">…supporting better agent selection</p>
        </div>
        <svg className="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0,60 C120,30 240,80 360,55 C480,30 600,70 720,50 C840,30 960,75 1080,55 C1200,35 1320,65 1440,45 L1440,90 L0,90 Z"
            fill="#ffffff"
            opacity="0.45"
          />
          <path
            d="M0,70 C160,45 300,90 460,68 C620,46 760,88 920,66 C1080,44 1260,86 1440,62 L1440,90 L0,90 Z"
            fill="var(--bg)"
          />
        </svg>
      </section>

      <section className="intro wrap">
        <img src={KUDOS_LOGO} alt="Kudos by AgentBee" width="240" height="120" />
        <p className="definition">
          <em>Kudos</em> [ˈkjuːdɒs] : <em>praise or recognition for an achievement</em>
        </p>
        <h2 className="tagline">Free agent checking tool for institutions and students</h2>
      </section>

      <main className="wrap">
        <Directory awards={awards} view={view} basePath="/" />

        <div className="cta-band">
          <div>
            <h3>Are you an education agent?</h3>
            <p>Make sure all your awards are listed, and show your full award history to institutions and students.</p>
          </div>
          <a className="btn btn-gold" href="https://agentbee.net/kudos-agents/">
            List your awards
          </a>
        </div>
      </main>
    </>
  );
}
