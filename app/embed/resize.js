'use client';

import { useEffect } from 'react';

// Tells the parent page how tall the embed is, so the iframe can grow and shrink
// as rows are opened and closed (see the snippet in README.md).
export default function EmbedResize() {
  useEffect(() => {
    if (window.parent === window) return;
    const send = () =>
      window.parent.postMessage({ type: 'kudos-embed-height', height: document.documentElement.scrollHeight }, '*');
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    document.addEventListener('toggle', send, true);
    send();
    return () => {
      ro.disconnect();
      document.removeEventListener('toggle', send, true);
    };
  }, []);
  return null;
}
