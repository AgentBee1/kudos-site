// Data for the embeddable agent awards widget (public/embed.js).
//
//   GET  /api/widget?key=kd_...            → widget settings + awards (logs a view)
//   POST /api/widget  {key, award_id}      → logs a click (sent with navigator.sendBeacon)
//
// Free agents get their 3 featured awards (or the latest 3) plus a count of the rest.
// Kudos Pro agents (agents.is_kudos_client) get every award.
// When an embed has allowed_domains, the widget only loads on those sites (and their
// subdomains). Kudos itself is always allowed, so the account preview works.

import { getAwards, SITE_URL, FREE_CAP, formatDate, issuerLabel } from '../../../lib/data';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY;
const KUDOS_HOST = new URL(SITE_URL).hostname;

async function rpc(name, args, { cache = 'no-store' } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache
  });
  if (!res.ok) throw new Error(`${name} responded ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// The site the widget is being shown on. Browsers set Origin on cross-site requests and
// it can't be changed by page scripts; same-site requests are marked by Sec-Fetch-Site.
function requestingHost(req) {
  const origin = req.headers.get('origin');
  if (origin && origin !== 'null') return hostOf(origin);
  if (req.headers.get('sec-fetch-site') === 'same-origin') return KUDOS_HOST;
  return hostOf(req.headers.get('referer') || '');
}

function cleanDomain(d) {
  return String(d || '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

function isAllowed(host, allowed) {
  if (!allowed?.length) return true;
  if (!host) return false;
  const h = host.replace(/^www\./, '');
  if (h === KUDOS_HOST || h === 'localhost' || h === '127.0.0.1') return true;
  return allowed.map(cleanDomain).some((d) => d && (h === d || h.endsWith(`.${d}`)));
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
}

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) }
  });

export function OPTIONS(req) {
  return new Response(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

export async function GET(req) {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || '';
  if (!/^kd_[a-z0-9_]{4,40}$/i.test(key)) return json({ error: 'Invalid widget key.' }, 400, origin);

  let embed;
  try {
    embed = await rpc('kudos_widget_get', { p_key: key });
  } catch (e) {
    console.error('widget lookup failed', e);
    return json({ error: 'Kudos is unavailable right now.' }, 502, origin);
  }
  if (!embed) return json({ error: 'This Kudos widget is not active.' }, 404, origin);

  const host = requestingHost(req);
  if (!isAllowed(host, embed.allowed_domains)) {
    return json({ error: 'This Kudos widget is not enabled for this website.' }, 403, origin);
  }

  // Kudos pages may show the Pro version as a preview (e.g. the upgrade screen).
  const previewPro = host === KUDOS_HOST && url.searchParams.get('preview') === 'pro';
  const isPro = Boolean(embed.is_pro) || previewPro;

  const all = (await getAwards()).filter((a) => a.agent_id === embed.agent_id);
  let shown = all;
  if (!isPro) {
    const featured = (embed.featured_award_ids || [])
      .map((id) => all.find((a) => a.award_id === id))
      .filter(Boolean);
    const rest = all.filter((a) => !featured.includes(a));
    // Keep date order so the wall's year headings stay grouped.
    shown = [...featured, ...rest]
      .slice(0, FREE_CAP)
      .sort((a, b) => String(b.award_date).localeCompare(String(a.award_date)));
  }

  if (host !== KUDOS_HOST) {
    rpc('kudos_widget_log', { p_key: key, p_event: 'view', p_domain: host || null }).catch(() => {});
  }

  return json(
    {
      agent: {
        name: embed.agent_name,
        logo: embed.agent_logo_url || null,
        url: `${SITE_URL}/agent/${embed.agent_slug}`
      },
      settings: { layout: embed.layout, theme: embed.theme, accent: embed.accent },
      plan: isPro ? 'pro' : 'free',
      total: all.length,
      hidden: all.length - shown.length,
      awards: shown.map((a) => ({
        id: a.award_id,
        title: a.award_title,
        issuer: issuerLabel(a),
        date: a.award_date,
        dateLabel: formatDate(a.award_date),
        year: a.award_date ? a.award_date.slice(0, 4) : '',
        url: `${SITE_URL}/award/${a.award_slug}`
      }))
    },
    200,
    origin
  );
}

export async function POST(req) {
  const origin = req.headers.get('origin');
  let body = {};
  try {
    body = JSON.parse(await req.text());
  } catch {}
  const key = String(body.key || '');
  const awardId = /^[0-9a-f-]{36}$/i.test(body.award_id || '') ? body.award_id : null;
  const host = requestingHost(req);
  if (/^kd_[a-z0-9_]{4,40}$/i.test(key) && host !== KUDOS_HOST) {
    await rpc('kudos_widget_log', { p_key: key, p_event: 'click', p_award_id: awardId, p_domain: host || null }).catch(
      () => {}
    );
  }
  return new Response(null, { status: 204, headers: cors(origin) });
}
