// Opens the Stripe billing portal (change card, invoices, cancel). Owner only.
import { getStripe, ACCOUNT_URL, ownerAccount } from '../../../../lib/billing';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const auth = await ownerAccount(req);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
    if (!auth.account.stripe_customer_id) {
      return Response.json({ error: 'There is no billing account yet.' }, { status: 404 });
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: auth.account.stripe_customer_id,
      return_url: `${ACCOUNT_URL}?tab=plan`
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error('portal', e);
    return Response.json({ error: e.message || 'Could not open billing.' }, { status: 500 });
  }
}
