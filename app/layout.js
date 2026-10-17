import './globals.css';
import { SITE_URL } from '../lib/data';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Kudos – Education Agent Awards & Recognition | AgentBee',
    template: '%s | Kudos by AgentBee'
  },
  description:
    'A free, searchable record of awards and recognition given to international student recruitment agents by universities and colleges.',
  openGraph: { siteName: 'Kudos by AgentBee', type: 'website' },
  twitter: { card: 'summary_large_image' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap header-inner">
            <a href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">🏆</span>
              <span>
                <strong>Kudos</strong> <span className="muted">by AgentBee</span>
              </span>
            </a>
            <nav className="nav">
              <a href="/">Agents</a>
              <a href="/?view=institution">Institutions</a>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <p>
              Kudos lists awards as publicly announced by the issuing organisation. A listing is not an
              endorsement or assessment of the agent by AgentBee.
            </p>
            <p>
              © {new Date().getFullYear()} <a href="https://agentbee.net">AgentBee</a> ·{' '}
              <a href="https://agentbee.net/privacy/">Privacy</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
