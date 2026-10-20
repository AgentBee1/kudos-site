import { DISCLAIMER } from '../../lib/data';
import ClientView from '../client-view';

const AGENTBEE_LOGO = 'https://agentbee.net/wp-content/uploads/2020/06/Copy-of-Small-Logo-Transparent.png';
const FOOTER_LOGO = 'https://agentbee.net/wp-content/uploads/2025/01/AgentBee-Logo-2025-footer-1.png';

export default function SiteLayout({ children }) {
  return (
    <>
      <header className="site-header">
        <div className="wrap-wide header-inner">
          <a href="https://agentbee.net" className="brand" aria-label="AgentBee home">
            <img src={AGENTBEE_LOGO} alt="AgentBee" height="36" />
          </a>
          <nav className="nav" aria-label="Main">
            <a href="https://agentbee.net">Home</a>
            <a href="/">Kudos</a>
            <a href="https://agentbee.net/kudos-agents/">For Agents</a>
            <a href="https://agentbee.net/blog">Blog</a>
            <a href="https://airtable.com/shrlheeW9qhBskrlp">Contact Us</a>
          </nav>
        </div>
      </header>

      <ClientView />
      {children}

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <img src={FOOTER_LOGO} alt="AgentBee" height="40" />
          <p>{DISCLAIMER}</p>
          <p>
            © {new Date().getFullYear()} AgentBee · <a href="https://agentbee.net/privacy/">Privacy</a> ·{' '}
            <a href="https://airtable.com/shrlheeW9qhBskrlp">Contact</a>
          </p>
        </div>
      </footer>
    </>
  );
}
