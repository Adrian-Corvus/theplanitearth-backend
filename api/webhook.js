// api/webhook.js
import Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { generatePDF } from '../lib/generatePDF.js';
import { generateOptimisationReport } from '../lib/generateOptReport.js';
import { sendBriefEmail } from '../lib/sendEmail.js';

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

// Set of session IDs we've already processed — guards against duplicate
// Stripe retries within the same function instance (cold starts reset this,
// but combined with the immediate 200 response it stops the retry loop)
const processed = new Set();

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

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const sessionId = event.data.object.id;
  console.log('[webhook] Received session:', sessionId);

  // ── IDEMPOTENCY GUARD ──
  // Stripe retries if it doesn't get 200 within 30s.
  // We respond 200 immediately below, but as a second safety net we also
  // track processed sessions so duplicate deliveries from cold-start retries are dropped.
  if (processed.has(sessionId)) {
    console.log('[webhook] Already processed, skipping:', sessionId);
    return res.status(200).json({ received: true, duplicate: true });
  }
  processed.add(sessionId);

  // ── RESPOND TO STRIPE IMMEDIATELY ──
  // This prevents Stripe from retrying. All work happens in waitUntil()
  // which keeps the function alive after the response is sent.
  res.status(200).json({ received: true });

  // ── DO THE HEAVY WORK AFTER RESPONDING ──
  waitUntil(async () => {
    try {
      const full = await stripe.checkout.sessions.retrieve(sessionId);

      if (full.payment_status !== 'paid') {
        console.log('[webhook] Not paid, skipping:', sessionId);
        return;
      }

      const m    = full.metadata || {};
      const email = full.customer_email;
      const name  = m.customer_name || 'there';
      const profession = m.ans_job_title || m.profession || 'Professional';

      const plan       = m.plan || 'brief';
      const isBundle   = plan === 'bundle'   || plan === 'opt-bundle';
      const needsBrief = plan === 'brief'    || plan === 'bundle' || plan === 'opt-bundle';
      const needsOpt   = plan === 'opt-only' || plan === 'bundle' || plan === 'opt-bundle';

      console.log(`[webhook] Processing ${email} — ${profession} — plan:${plan}`);

      const answers = {
        profession_cat:  m.ans_profession_cat  || 'other',
        job_title:       m.ans_job_title       || '',
        experience:      m.ans_experience      || 'mid',
        tasks:           m.ans_tasks           || 'judgment',
        ai_exposure:     m.ans_ai_exposure     || 'aware',
        ai_personal_use: m.ans_ai_personal_use || 'occasional',
        industry:        m.ans_industry        || 'private',
        decision_level:  m.ans_decision_level  || 'mid',
        regulatory:      m.ans_regulatory      || 'optional',
        specialisation:  m.ans_specialisation  || 'moderate',
        data_work:       m.ans_data_work       || 'some',
        writing_work:    m.ans_writing_work    || 'some',
        tech_comfort:    m.ans_tech_comfort    || 'mid',
        client_facing:   m.ans_client_facing   || 'internal',
        learning_habit:  m.ans_learning_habit  || 'occasional',
        concern:         m.ans_concern         || 'growth',
        biggest_worry:   m.ans_biggest_worry   || 'obsolescence',
        key_skills:      m.ans_key_skills      || '',
        career_summary:  m.ans_career_summary  || '',
      };

      const scores = {
        automation:     Number(m.score_automation     || 55),
        augmentation:   Number(m.score_augmentation   || 70),
        income:         Number(m.score_income         || 60),
        regulatory:     Number(m.score_regulatory     || 55),
        skill_pressure: Number(m.score_skill_pressure || 65),
        ai_adoption:    Number(m.score_ai_adoption    || 55),
      };

      const archetype     = { name: m.archetype_name || 'Strategic Adapter', emoji: '' };
      const cvIssues      = m.cv_quality_issues ? m.cv_quality_issues.split(' | ') : [];
      const inputMethod   = m.input_method   || 'quiz';
      const targetCountry = m.target_country || '';
      const targetCompany = m.target_company || '';
      const targetRole    = m.target_role    || '';

      let pdfBuffer = null;
      if (needsBrief) {
        console.log('[webhook] Generating career brief...');
        pdfBuffer = await generatePDF({ name, email, profession, archetype, answers, scores });
        console.log('[webhook] Brief done, bytes:', pdfBuffer.length);
      }

      let optBuffer = null;
      if (needsOpt) {
        console.log('[webhook] Generating optimisation report...');
        optBuffer = await generateOptimisationReport({ name, profession, answers, scores, cvIssues, inputMethod, targetCountry, targetCompany, targetRole });
        console.log('[webhook] Opt report done');
      }

      console.log('[webhook] Sending email to', email);
      await sendBriefEmail({ to: email, name, pdfBuffer, optBuffer, profession, archetype, isBundle, isOptOnly: needsOpt && !needsBrief });
      console.log('[webhook] Email sent OK for session', sessionId);

    } catch (err) {
      console.error('[webhook] Background job FAILED for', sessionId, ':', err.message);
      console.error(err.stack);
    }
  });
}
