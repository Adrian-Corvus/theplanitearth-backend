// api/webhook.js
import Stripe from 'stripe';
import { generatePDF } from '../lib/generatePDF.js';
import { sendBriefEmail } from '../lib/sendEmail.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
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
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items'],
    });

    if (fullSession.payment_status === 'paid') {
      const m = fullSession.metadata;
      const customerEmail = fullSession.customer_email;

      try {
        // ── Reconstruct answers from flat metadata keys ──
        const answers = {
          profession_cat:  m.ans_profession_cat  || 'other',
          job_title:       m.ans_job_title        || '',
          experience:      m.ans_experience       || 'mid',
          tasks:           m.ans_tasks            || 'judgment',
          ai_exposure:     m.ans_ai_exposure      || 'aware',
          ai_personal_use: m.ans_ai_personal_use  || 'occasional',
          industry:        m.ans_industry         || 'private',
          decision_level:  m.ans_decision_level   || 'mid',
          regulatory:      m.ans_regulatory       || 'optional',
          specialisation:  m.ans_specialisation   || 'moderate',
          data_work:       m.ans_data_work        || 'some',
          writing_work:    m.ans_writing_work      || 'some',
          tech_comfort:    m.ans_tech_comfort      || 'mid',
          client_facing:   m.ans_client_facing     || 'internal',
          learning_habit:  m.ans_learning_habit    || 'occasional',
          concern:         m.ans_concern           || 'growth',
          biggest_worry:   m.ans_biggest_worry     || 'obsolescence',
        };

        // ── Reconstruct scores from flat metadata keys ──
        const scores = {
          automation:     Number(m.score_automation    || 55),
          augmentation:   Number(m.score_augmentation  || 70),
          income:         Number(m.score_income        || 60),
          regulatory:     Number(m.score_regulatory    || 55),
          skill_pressure: Number(m.score_skill_pressure|| 65),
          ai_adoption:    Number(m.score_ai_adoption   || 55),
        };

        const archetype = {
          name:  m.archetype_name  || 'Strategic Adapter',
          emoji: m.archetype_emoji || '',
        };

        const name       = m.customer_name || 'there';
        const profession = m.ans_job_title  || m.profession || 'Professional';

        console.log(`Generating PDF for ${customerEmail} — ${profession}`);

        const pdfBuffer = await generatePDF({ name, email: customerEmail, profession, archetype, answers, scores });

        await sendBriefEmail({ to: customerEmail, name, pdfBuffer, profession, archetype });

        console.log(`Brief delivered to ${customerEmail}`);

      } catch (err) {
        console.error('Error generating/sending brief:', err.message, err.stack);
      }
    }
  }

  return res.status(200).json({ received: true });
}
