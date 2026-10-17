import { ImageResponse } from 'next/og';

export const ogSize = { width: 1200, height: 630 };

// Branded share card used for LinkedIn / Facebook / X previews.
export function kudosCard({ eyebrow, title, line1, line2 }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #1450b8 0%, #1f6fe5 60%, #3d8bff 100%)',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
          color: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #f5cf73, #e0a83a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 36,
              fontWeight: 700
            }}
          >
            K
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
            Kudos<span style={{ color: '#dbe7ff', fontWeight: 400, marginLeft: 10 }}>by AgentBee</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 26,
              textTransform: 'uppercase',
              letterSpacing: 3,
              color: '#f5cf73',
              marginBottom: 16
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: title.length > 48 ? 56 : 68, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {line1 && <div style={{ fontSize: 38, marginTop: 24, fontWeight: 600 }}>{line1}</div>}
          {line2 && <div style={{ fontSize: 30, marginTop: 8, color: '#dbe7ff' }}>{line2}</div>}
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: '#dbe7ff' }}>kudos.agentbee.net</div>
      </div>
    ),
    ogSize
  );
}
