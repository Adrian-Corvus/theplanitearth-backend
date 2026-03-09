// api/create-checkout.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://theplanitearth.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { name, email, answers, scores, archetype, profession } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: 1200,
          product_data: {
            name: 'Career Intelligence Brief',
            description: `Personalised AI career analysis — ${profession || 'your profession'}`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        customer_name:   (name || '').slice(0, 100),
        profession:      (profession || '').slice(0, 100),
        archetype_name:  (archetype?.name  || '').slice(0, 100),
        archetype_emoji: (archetype?.emoji || '').slice(0, 10),
        answers_json:    JSON.stringify(answers  || {}).slice(0, 500),
        scores_json:     JSON.stringify(scores   || {}).slice(0, 500),
      },
      success_url: `https://theplanitearth.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://theplanitearth.com/quiz.html`,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
