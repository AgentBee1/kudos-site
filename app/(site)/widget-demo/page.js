import EmbedPreview from '../../embed-preview';
import { SITE_URL } from '../../../lib/data';

export const metadata = {
  title: 'Awards widget demo',
  robots: { index: false, follow: false }
};

const KEY = 'kd_demo_kcoverseas';

const examples = [
  { title: 'Wall – free plan', note: '3 awards, then a link to the rest on Kudos.', layout: 'wall' },
  { title: 'Wall – Kudos Pro', note: 'Every award, grouped by year.', layout: 'wall', preview: 'pro' },
  { title: 'Carousel – Kudos Pro', note: 'One scrolling row, for a homepage.', layout: 'carousel', preview: 'pro' },
  { title: 'Wall – dark theme', note: 'For dark website footers or sections.', layout: 'wall', theme: 'dark', preview: 'pro' },
  { title: 'Badge', note: 'A small link for a header, footer or sidebar.', layout: 'badge' }
];

export default function WidgetDemo() {
  const snippet = `<script src="${SITE_URL}/embed.js" data-key="${KEY}" async></script>`;
  return (
    <main className="wrap" style={{ padding: '32px 16px 64px' }}>
      <h1 style={{ marginBottom: 6 }}>Awards widget demo</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        KC Overseas Education, using the test key <code>{KEY}</code>. Agents paste one line into their website:
      </p>
      <pre style={{ background: '#f5f7fb', border: '1px solid #e6eaf2', borderRadius: 10, padding: 12, overflowX: 'auto', fontSize: 13 }}>
        {snippet}
      </pre>
      {examples.map((ex) => (
        <section key={ex.title} style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: 4 }}>{ex.title}</h2>
          <p className="muted small" style={{ marginTop: 0 }}>{ex.note}</p>
          <div style={ex.theme === 'dark' ? { background: '#0b1220', padding: 16, borderRadius: 18 } : undefined}>
            <EmbedPreview widgetKey={KEY} layout={ex.layout} theme={ex.theme} preview={ex.preview} />
          </div>
        </section>
      ))}
    </main>
  );
}
