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
  twitter: { card: 'summary_large_image' },
  icons: { icon: 'https://agentbee.net/wp-content/uploads/2025/08/cropped-AgentBee-Logo-2025-512-270x270.png' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
