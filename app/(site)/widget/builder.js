'use client';

import { useEffect, useMemo, useState } from 'react';

// Agent finds their agency, sees a live preview of their awards embed, and copies the snippet.
export default function WidgetBuilder({ agents, initial, siteUrl }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => agents.find((a) => a.slug === initial) || null);
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(320);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return agents.filter((a) => a.name.toLowerCase().includes(n)).slice(0, 8);
  }, [q, agents]);

  // The preview resizes itself the same way it will on the agent's site.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin === window.location.origin && e.data?.type === 'kudos-embed-height') setHeight(e.data.height);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function pick(a) {
    setPicked(a);
    setQ('');
    setCopied(false);
    setHeight(320);
    try {
      history.replaceState(null, '', `?agent=${a.slug}`);
    } catch {}
  }

  const snippet = picked
    ? `<iframe id="kudos-awards" src="${siteUrl}/embed/agent/${picked.slug}"
  style="width:100%;max-width:640px;border:0;min-height:240px" loading="lazy"
  title="${picked.name.replace(/"/g, '&quot;')} – Awards & Recognition"></iframe>
<script>
  window.addEventListener('message', function (e) {
    var f = document.getElementById('kudos-awards');
    if (f && e.origin === '${siteUrl}' && e.source === f.contentWindow &&
        e.data && e.data.type === 'kudos-embed-height') {
      f.style.height = e.data.height + 'px';
    }
  });
</script>`
    : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      const t = document.getElementById('snippet');
      t.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="wb">
      <div className="wb-step">
        <span className="wb-num">1</span>
        <div className="wb-step-body">
          <h2>Find your agency</h2>
          {picked && (
            <div className="wb-picked">
              <span>
                <strong>{picked.name}</strong>
                <span className="muted">
                  {picked.country ? ` · ${picked.country}` : ''} · {picked.total} award{picked.total === 1 ? '' : 's'}
                </span>
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setPicked(null)}>
                Change
              </button>
            </div>
          )}
          {!picked && (
            <>
              <div className="search-wrap" style={{ marginBottom: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  className="search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Type your agency name…"
                  aria-label="Agency name"
                  autoFocus
                />
              </div>
              {matches.length > 0 && (
                <ul className="wb-results">
                  {matches.map((a) => (
                    <li key={a.slug}>
                      <button type="button" onClick={() => pick(a)}>
                        <span className="wb-r-name">{a.name}</span>
                        <span className="muted">
                          {a.country ? `${a.country} · ` : ''}
                          {a.total} award{a.total === 1 ? '' : 's'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q.trim().length >= 2 && matches.length === 0 && (
                <p className="wb-none">
                  No agency by that name has an award on Kudos yet.{' '}
                  <a href="https://agentbee-kudos-widget.vercel.app/" target="_blank" rel="noopener">
                    Submit your award
                  </a>{' '}
                  and come back once it's approved.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {picked && (
        <>
          <div className="wb-step">
            <span className="wb-num">2</span>
            <div className="wb-step-body">
              <h2>Preview</h2>
              <div className="wb-preview">
                <iframe
                  key={picked.slug}
                  src={`/embed/agent/${picked.slug}`}
                  style={{ height }}
                  title={`${picked.name} – Awards & Recognition preview`}
                />
              </div>
            </div>
          </div>

          <div className="wb-step">
            <span className="wb-num">3</span>
            <div className="wb-step-body">
              <h2>Copy the code into your website</h2>
              <p className="muted wb-help">
                Paste it wherever your site lets you add HTML: a Custom HTML block in WordPress, an Embed element in
                Wix or Squarespace, or straight into your page's code.
              </p>
              <textarea id="snippet" className="wb-code" readOnly value={snippet} rows={13} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-blue wb-copy" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy code'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
