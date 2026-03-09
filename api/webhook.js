// api/webhook.js
// Stripe sends a POST here the moment payment succeeds.
// We: 1) verify the event  2) generate the PDF  3) email it to the customer.
// Set STRIPE_WEBHOOK_SECRET in Vercel env vars (from Stripe Dashboard → Webhooks).

import Stripe from 'stripe';
import { generatePDF } from '../lib/generatePDF.js';
import { sendBriefEmail } from '../lib/sendEmail.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Vercel parses body by default — we need the raw body for Stripe signature verification
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig     = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Only handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Retrieve full session with line items
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items'],
    });

    if (fullSession.payment_status === 'paid') {
      try {
        const { metadata } = fullSession;
        const customerEmail = fullSession.customer_email;
        const customerName  = metadata.customer_name || 'there';

        // Parse the stored analysis data
        const answers  = JSON.parse(metadata.answers_json  || '{}');
        const scores   = JSON.parse(metadata.scores_json   || '{}');
        const archetype = {
          name:  metadata.archetype_name  || 'Strategic Adapter',
          emoji: metadata.archetype_emoji || '🧭',
        };

        console.log(`Generating PDF for ${customerEmail} — ${metadata.profession}`);

        // 1. Generate the personalised PDF
        const pdfBuffer = await generatePDF({
          name:       customerName,
          email:      customerEmail,
          profession: metadata.profession,
          archetype,
          answers,
          scores,
        });

        // 2. Email it
        await sendBriefEmail({
          to:         customerEmail,
          name:       customerName,
          pdfBuffer,
          profession: metadata.profession,
          archetype,
        });

        console.log(`✅ Brief delivered to ${customerEmail}`);

      } catch (err) {
        console.error('Error generating/sending brief:', err);
        // Don't return 500 — Stripe would retry. Log and handle gracefully.
      }
    }
  }

  return res.status(200).json({ received: true });
}
