// api/webhook.js
import Stripe from 'stripe';
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
  console.log('[webhook] Payment completed, session:', sessionId);

  // Retrieve full session with metadata
  const full = await stripe.checkout.sessions.retrieve(sessionId);

  if (full.payment_status !== 'paid') {
    console.log('[webhook] Not paid yet, skipping');
    return res.status(200).json({ received: true });
  }

  const m          = full.metadata || {};
  const email      = full.customer_email;
  const name       = m.customer_name   || 'there';
  const profession = m.ans_job_title   || m.profession || 'Professional';
  const plan       = m.plan || 'brief';
  const isBundle   = plan === 'bundle'     || plan === 'opt-bundle';
  const needsBrief = plan === 'brief'      || plan === 'bundle' || plan === 'opt-bundle';
  const needsOpt   = plan === 'opt-only'   || plan === 'bundle' || plan === 'opt-bundle';

  console.log(`[webhook] Generating for ${email} — ${profession} — plan:${plan}`);

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
  const inputMethod   = m.input_method || 'quiz';
  const targetCountry = m.target_country || '';
  const targetCompany = m.target_company || '';
  const targetRole    = m.target_role    || '';

  try {
    let pdfBuffer = null;
    if (needsBrief) {
      console.log('[webhook] Generating career brief PDF...');
      pdfBuffer = await generatePDF({ name, email, profession, archetype, answers, scores });
      console.log('[webhook] PDF done, size:', pdfBuffer.length);
    }

    let optBuffer = null;
    if (needsOpt) {
      console.log('[webhook] Generating optimisation report...');
      optBuffer = await generateOptimisationReport({ name, profession, answers, scores, cvIssues, inputMethod, targetCountry, targetCompany, targetRole });
      console.log('[webhook] Opt report done');
    }

    console.log('[webhook] Sending email to', email);
    await sendBriefEmail({ to: email, name, pdfBuffer, optBuffer, profession, archetype, isBundle, isOptOnly: needsOpt && !needsBrief });
    console.log('[webhook] Email sent successfully to', email);

    return res.status(200).json({ received: true, sent: true });
  } catch (err) {
    console.error('[webhook] FAILED:', err.message);
    console.error('[webhook] Stack:', err.stack);
    // Still return 200 so Stripe doesn't retry endlessly
    return res.status(200).json({ received: true, error: err.message });
  }
}
