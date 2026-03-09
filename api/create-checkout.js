// api/create-checkout.js
// Creates a Stripe Checkout session for the £12 Career Intelligence Brief
// Called from quiz.html when user clicks "Get My Brief"

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, answers, scores, archetype, profession } = req.body;

    if (!email || !answers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store the user's analysis data in Stripe metadata
    // so we can retrieve it after payment to generate the PDF
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,

      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: 1200, // £12.00 in pence
          product_data: {
            name: 'Career Intelligence Brief',
            description: `Personalised AI career analysis for ${name || 'you'} — ${profession || ''}`,
            images: ['https://theplanitearth.com/og-image.png'],
          },
        },
        quantity: 1,
      }],

      // Pass user data through so we can generate their specific PDF after payment
      metadata: {
        customer_name:  name || '',
        profession:     profession || '',
        archetype_name: archetype?.name || '',
        archetype_emoji:archetype?.emoji || '',
        answers_json:   JSON.stringify(answers).slice(0, 500),
        scores_json:    JSON.stringify(scores).slice(0, 500),
      },

      success_url: `https://theplanitearth.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://theplanitearth.com/quiz.html`,

      // Collect billing address for compliance
      billing_address_collection: 'auto',
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
