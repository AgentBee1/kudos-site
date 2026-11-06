'use client';

import { useEffect, useRef } from 'react';

// Loads /embed.js the same way an agent's website would.
export default function EmbedPreview({ widgetKey, layout, theme, preview }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const s = document.createElement('script');
    s.src = `/embed.js?v=${Date.now()}`;
    s.setAttribute('data-key', widgetKey);
    if (layout) s.setAttribute('data-layout', layout);
    if (theme) s.setAttribute('data-theme', theme);
    if (preview) s.setAttribute('data-preview', preview);
    el.appendChild(s);
  }, [widgetKey, layout, theme, preview]);
  return <div ref={ref} />;
}
