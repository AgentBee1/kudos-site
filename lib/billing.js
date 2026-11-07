// Server-only helpers for Kudos Pro billing (Stripe).
//
// Env (kudos-site Vercel project):
//   STRIPE_SECRET_KEY           sk_test_… / sk_live_…
//   STRIPE_WEBHOOK_SECRET       whsec_… for /api/stripe/webhook
//   STRIPE_PRICE_MONTHLY        price_… (Kudos Pro, US$79/month launch price)
//   STRIPE_PRICE_YEARLY         price_… (Kudos Pro, US$790/year launch price)
//   STRIPE_AUTOMATIC_TAX        "true" to charge GST via Stripe Tax
//   SUPABASE_SERVICE_ROLE_KEY   to update kudos_accounts from the webhook

import Stripe from 'stripe';
import { SITE_URL } from './data';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

let stripe;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Billing is not set up yet (STRIPE_SECRET_KEY).');
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export const PRICES = {
  month: process.env.STRIPE_PRICE_MONTHLY,
  year: process.env.STRIPE_PRICE_YEARLY
};

export const ACCOUNT_URL = `${SITE_URL}/account`;

// Service-role REST call (bypasses RLS: server only).
export async function db(path, opts = {}) {
  if (!SERVICE) throw new Error('Billing is not set up yet (SUPABASE_SERVICE_ROLE_KEY).');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    cache: 'no-store'
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// The signed-in user's approved account, from their Supabase access token.
export async function ownerAccount(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Please sign in.', status: 401 };
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!u.ok) return { error: 'Your session has expired. Please sign in again.', status: 401 };
  const user = await u.json();
  const [acc] = await db(
    `kudos_accounts?user_id=eq.${user.id}&claim_status=eq.approved&select=id,email,role,plan,agent_id,stripe_customer_id,stripe_subscription_id,subscription_status`
  );
  if (!acc) return { error: 'Your account is not linked to an agency yet.', status: 403 };
  if (acc.role !== 'owner') return { error: 'Only the account owner can manage billing.', status: 403 };
  const [agent] = await db(`agents?id=eq.${acc.agent_id}&select=agency_name`);
  return { account: acc, agencyName: agent?.agency_name || '' };
}

// Subscription statuses that keep Pro switched on. past_due keeps access while Stripe retries the card.
const ACTIVE = ['active', 'trialing', 'past_due'];

export async function syncSubscription(sub) {
  const accountId = sub.metadata?.account_id;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const filter = accountId ? `id=eq.${accountId}` : `stripe_customer_id=eq.${customerId}`;
  const item = sub.items?.data?.[0];
  const periodEnd = sub.current_period_end || item?.current_period_end;
  const pro = ACTIVE.includes(sub.status);
  await db(`kudos_accounts?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      plan: pro ? 'pro' : 'free',
      stripe_customer_id: customerId,
      stripe_subscription_id: pro ? sub.id : null,
      stripe_price_id: item?.price?.id || null,
      billing_interval: item?.price?.recurring?.interval || null,
      subscription_status: sub.status,
      paid_until: periodEnd ? new Date(periodEnd * 1000).toISOString() : null
    })
  });
}
