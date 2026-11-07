// Stripe webhook: keeps kudos_accounts.plan in step with the subscription
// (which also flips agents.is_kudos_client via the database trigger).
// Events: checkout.session.completed, customer.subscription.created|updated|deleted
import { getStripe, syncSubscription } from '../../../../lib/billing';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      req.headers.get('stripe-signature'),
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    return new Response(`Webhook signature check failed: ${e.message}`, { status: 400 });
  }

  try {
    const obj = event.data.object;
    if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
      const sub = await stripe.subscriptions.retrieve(obj.subscription);
      if (!sub.metadata?.account_id && obj.client_reference_id) sub.metadata = { ...sub.metadata, account_id: obj.client_reference_id };
      await syncSubscription(sub);
    } else if (event.type.startsWith('customer.subscription.')) {
      await syncSubscription(obj);
    }
    return Response.json({ received: true });
  } catch (e) {
    console.error('stripe webhook', event.type, e);
    return new Response(`Handler error: ${e.message}`, { status: 500 });
  }
}
