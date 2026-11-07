// Starts Stripe Checkout for Kudos Pro. POST {interval: 'month'|'year'} with the user's
// Supabase access token (Authorization: Bearer …). Owner only.
import { getStripe, PRICES, ACCOUNT_URL, ownerAccount, db } from '../../../../lib/billing';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { interval } = await req.json().catch(() => ({}));
    const price = PRICES[interval];
    if (!price) return Response.json({ error: 'Choose monthly or yearly.' }, { status: 400 });

    const auth = await ownerAccount(req);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
    const { account, agencyName } = auth;
    if (account.plan === 'pro' && account.stripe_subscription_id) {
      return Response.json({ error: 'Your agency is already on Kudos Pro.' }, { status: 409 });
    }

    const stripe = getStripe();
    let customer = account.stripe_customer_id;
    if (!customer) {
      const c = await stripe.customers.create({
        email: account.email,
        name: agencyName || undefined,
        metadata: { kudos_account_id: account.id, agent_id: account.agent_id }
      });
      customer = c.id;
      await db(`kudos_accounts?id=eq.${account.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ stripe_customer_id: customer })
      });
    }

    const tax = process.env.STRIPE_AUTOMATIC_TAX === 'true';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: account.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { account_id: account.id, agent_id: account.agent_id } },
      metadata: { account_id: account.id },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      tax_id_collection: { enabled: true },
      ...(tax ? { automatic_tax: { enabled: true } } : {}),
      success_url: `${ACCOUNT_URL}?upgraded=1`,
      cancel_url: `${ACCOUNT_URL}?tab=plan`
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error('checkout', e);
    return Response.json({ error: e.message || 'Could not start checkout.' }, { status: 500 });
  }
}
