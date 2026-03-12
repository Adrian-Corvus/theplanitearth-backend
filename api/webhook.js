// api/webhook.js
// Stays lean — verifies Stripe signature, responds 200 immediately,
// then fires off generate-brief in the background
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig     = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature failed:', err.message);
    return res.status(400).json({ error: err.message });
  }

  // Respond to Stripe immediately — must be fast
  res.status(200).json({ received: true });

  if (event.type === 'checkout.session.completed') {
    const sessionId = event.data.object.id;
    console.log(`[webhook] Triggering generate-brief for session ${sessionId}`);

    // Fire-and-forget: call our own generate-brief endpoint
    // This runs in its own Vercel function with its own timeout budget
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://theplanitearth-backend.vercel.app';

    fetch(`${baseUrl}/api/generate-brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SECRET || 'planitearth-internal',
      },
      body: JSON.stringify({ sessionId }),
    }).catch(err => console.error('[webhook] Failed to trigger generate-brief:', err.message));
  }
}
