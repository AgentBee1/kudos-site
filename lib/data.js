// Reads public award data from the Supabase view `kudos_awards_public`.
// Runs on the server only: the key is never sent to the browser.

import fs from 'fs';
import path from 'path';

export const SITE_URL = (process.env.SITE_URL || 'https://kudos.agentbee.net').replace(/\/+$/, '');
export const CLAIM_URL = process.env.KUDOS_CLAIM_URL || 'https://agentbee.net/kudos-agents/';
export const FREE_CAP = 3;
export const PAID_TIER_NAME = process.env.KUDOS_PAID_TIER_NAME || 'Kudos Pro';
export const REVALIDATE_SECONDS = 600;

async function fetchRows() {
  if (process.env.KUDOS_FIXTURE) {
    return JSON.parse(fs.readFileSync(path.resolve(process.env.KUDOS_FIXTURE), 'utf8'));
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Kudos: SUPABASE_URL and SUPABASE_ANON_KEY are not set for this environment.');

  const res = await fetch(
    `${url.replace(/\/+$/, '')}/rest/v1/kudos_awards_public?select=*&order=award_date.desc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: REVALIDATE_SECONDS, tags: ['kudos'] }
    }
  );
  if (!res.ok) throw new Error(`Kudos: Supabase responded ${res.status} ${await res.text().catch(() => '')}`);
  return res.json();
}

export async function getAwards() {
  const rows = await fetchRows();
  return rows
    .map((r) => ({ ...r, award_date: r.award_date || null }))
    .sort((a, b) => String(b.award_date).localeCompare(String(a.award_date)));
}

// Group awards by agent. Paid (Kudos client) agents show everything,
// free/unclaimed agents show the most recent FREE_CAP awards.
export function groupByAgent(awards) {
  const map = new Map();
  for (const a of awards) {
    let g = map.get(a.agent_slug);
    if (!g) {
      g = {
        slug: a.agent_slug,
        name: a.agent_name,
        country: a.agent_country,
        website: a.agent_website,
        logo: a.agent_logo_url,
        isClient: false,
        awards: []
      };
      map.set(a.agent_slug, g);
    }
    g.website = g.website || a.agent_website;
    g.logo = g.logo || a.agent_logo_url;
    g.country = g.country || a.agent_country;
    g.isClient = g.isClient || Boolean(a.is_kudos_client);
    g.awards.push(a);
  }
  for (const g of map.values()) {
    g.total = g.awards.length;
    g.visible = g.isClient ? g.awards : g.awards.slice(0, FREE_CAP);
    g.latest = g.awards[0]?.award_date || '';
  }
  return [...map.values()];
}

export function groupByIssuer(awards) {
  const map = new Map();
  for (const a of awards) {
    const key = a.issuer_name || 'Unknown issuer';
    if (!map.has(key)) map.set(key, { name: key, country: a.issuer_country, awards: [] });
    map.get(key).awards.push(a);
  }
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name));
}

export async function getAgent(slug) {
  const awards = await getAwards();
  return groupByAgent(awards).find((g) => g.slug === slug) || null;
}

export async function getAward(slug) {
  const awards = await getAwards();
  const award = awards.find((a) => a.award_slug === slug);
  if (!award) return null;
  const agent = groupByAgent(awards).find((g) => g.slug === award.agent_slug);
  return { award, agent };
}

export function formatDate(d) {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function websiteHref(w) {
  if (!w) return null;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

export const DISCLAIMER =
  'Kudos lists awards as publicly announced by the issuing organisation. A listing is not an endorsement or assessment of the agent by AgentBee.';
