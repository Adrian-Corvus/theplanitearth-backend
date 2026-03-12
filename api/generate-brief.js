// api/generate-brief.js
// Called internally by webhook — does the heavy PDF generation + email send
// Separated so it can run with its own 30s timeout budget
import { generatePDF } from '../lib/generatePDF.js';
import { generateOptimisationReport } from '../lib/generateOptReport.js';
import { sendBriefEmail } from '../lib/sendEmail.js';
import Stripe from 'stripe';

export const config = { maxDuration: 60 }; // Vercel Pro allows up to 60s

export default async function handler(req, res) {
  // Only allow internal calls (from our own webhook)
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (req.method !== 'POST') return res.status(405).end();

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  // Respond immediately so the webhook caller doesn't wait
  res.status(202).json({ queued: true });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const full   = await stripe.checkout.sessions.retrieve(sessionId);

    if (full.payment_status !== 'paid') {
      console.log(`[generate-brief] Not paid: ${sessionId}`);
      return;
    }

    const m          = full.metadata || {};
    const email      = full.customer_email;
    const name       = m.customer_name   || 'there';
    const profession = m.ans_job_title   || m.profession || 'Professional';
    const isBundle   = m.plan === 'bundle';

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

    const archetype   = { name: m.archetype_name || 'Strategic Adapter', emoji: '' };
    const cvIssues    = m.cv_quality_issues ? m.cv_quality_issues.split(' | ') : [];
    const inputMethod = m.input_method || 'quiz';

    console.log(`[generate-brief] Generating for ${email} — ${profession}`);
    const pdfBuffer = await generatePDF({ name, email, profession, archetype, answers, scores });

    let optBuffer = null;
    if (isBundle) {
      optBuffer = await generateOptimisationReport({ name, profession, answers, scores, cvIssues, inputMethod });
    }

    await sendBriefEmail({ to: email, name, pdfBuffer, optBuffer, profession, archetype, isBundle });
    console.log(`[generate-brief] Done — sent to ${email}`);
  } catch (err) {
    console.error('[generate-brief] Error:', err.message, err.stack);
  }
}
