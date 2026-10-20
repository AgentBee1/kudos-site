'use client';

import { useEffect } from 'react';

// Links from the AgentBee client portal (Circle and the ticker) carry ?ref=client.
// For those visitors we hide the prompts aimed at agents ("Claim this profile", the
// upgrade lock). It's remembered for the browser tab, so it carries over as they click
// through to an agent's profile.
export default function ClientView() {
  useEffect(() => {
    try {
      if (new URLSearchParams(location.search).get('ref') === 'client') sessionStorage.setItem('kudos-view', 'client');
      if (sessionStorage.getItem('kudos-view') === 'client') document.documentElement.dataset.view = 'client';
    } catch {}
  }, []);
  return null;
}
