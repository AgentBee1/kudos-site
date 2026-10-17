import { getAwards } from '../../lib/data';
import { Directory } from '../components';
import EmbedResize from './resize';

export const revalidate = 600;

// Bare directory for embedding in agentbee.net (WordPress) via an iframe.
// Links open the full Kudos pages in a new tab.
export const metadata = { robots: { index: false, follow: true } };

export default async function Embed({ searchParams }) {
  const params = await searchParams;
  const view = params?.view === 'institution' ? 'institution' : 'agent';
  const awards = await getAwards();
  return (
    <div className="embed">
      <Directory awards={awards} view={view} basePath="/embed" target="_blank" />
      <p className="embed-foot">
        <a href="/" target="_blank" rel="noopener">
          Open the full Kudos directory ↗
        </a>
      </p>
      <EmbedResize />
    </div>
  );
}
