import { Hono } from 'hono';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { TOKEN_BUNDLES } from '@tokenai/shared';
import type { AppVariables } from '../types';
import type { BundleId } from '@tokenai/shared';

export const paymentsRouter = new Hono<{ Variables: AppVariables }>();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
}

paymentsRouter.get('/bundles', (c) => {
  return c.json(TOKEN_BUNDLES);
});

paymentsRouter.post('/create-checkout', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const { bundleId } = await c.req.json<{ bundleId: BundleId }>();

  const bundle = TOKEN_BUNDLES.find((b) => b.id === bundleId);
  if (!bundle) {
    return c.json({ error: 'Invalid bundle' }, 400);
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: bundle.usd * 100,
    currency: 'usd',
    metadata: {
      userId,
      bundleId: bundle.id,
      nanodollarsGranted: bundle.nanodollars.toString(),
    },
  });

  return c.json({ clientSecret: intent.client_secret, amount: bundle.usd });
});

paymentsRouter.post('/webhook', async (c) => {
  const stripe = getStripe();
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event: Stripe.Event;
  const rawBody = await c.req.text();

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const { userId, bundleId, nanodollarsGranted } = intent.metadata;

    const supabase = getSupabaseAdmin();

    await supabase.from('orders').insert({
      user_id: userId,
      stripe_payment_intent: intent.id,
      amount_usd_cents: intent.amount,
      tokens_granted: parseInt(nanodollarsGranted),
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    await supabase.rpc('add_tokens', {
      p_user_id: userId,
      p_amount: parseInt(nanodollarsGranted),
      p_description: `Balance top-up — ${bundleId}`,
      p_metadata: { stripe_payment_intent: intent.id, bundleId },
    });
  }

  return c.json({ received: true });
});
