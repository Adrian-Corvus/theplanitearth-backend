// api/create-checkout.js
import Stripe from 'stripe';

const PLANS = {
  'brief':      { amount: 799,  label: 'Career Intelligence Brief',                       desc: 'Personalised AI career analysis PDF' },
  'bundle':     { amount: 999,  label: 'Career Brief + Profile Optimisation',              desc: 'Full career analysis + LinkedIn/CV optimisation report' },
  'opt-only':   { amount: 499,  label: 'Profile Optimisation Report',                     desc: 'LinkedIn rewrite, CV bullets, ATS keywords, quick wins' },
  'opt-bundle': { amount: 999,  label: 'Profile Optimisation + Career Intelligence Brief', desc: 'Full optimisation report + personalised career analysis' },
  'deep-index': { amount: 499,  label: 'AI Risk Deep Index',                                   desc: 'Cross-referenced automation risk: country × sector × profession' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://theplanitearth.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const {
      name, email, answers, scores, archetype, profession,
      plan, inputMethod, cvQualityIssues,
      targetCountry, targetCompany, targetRole,
      liUrl, sourceFromOptimise,
    } = req.body;

    if (!email && planKey !== 'deep-index') return res.status(400).json({ error: 'Email is required' });

    const planKey  = plan || 'brief';
    const planInfo = PLANS[planKey] || PLANS['brief'];

    const metadata = {
      plan:             planKey,
      input_method:     inputMethod || 'quiz',
      customer_name:    (name        || '').slice(0, 100),
      profession:       (profession  || '').slice(0, 100),
      archetype_name:   (archetype?.name  || '').slice(0, 100),

      // Context fields
      target_country:   (targetCountry || '').slice(0, 100),
      target_company:   (targetCompany || '').slice(0, 100),
      target_role:      (targetRole    || '').slice(0, 100),
      li_url:           (liUrl         || '').slice(0, 300),
      source_optimise:  sourceFromOptimise ? 'true' : 'false',

      // Answers
      ans_profession_cat:  (answers?.profession_cat  || ''),
      ans_job_title:       (answers?.job_title        || '').slice(0, 100),
      ans_experience:      (answers?.experience       || ''),
      ans_tasks:           (answers?.tasks            || ''),
      ans_ai_exposure:     (answers?.ai_exposure      || 'aware'),
      ans_ai_personal_use: (answers?.ai_personal_use  || ''),
      ans_industry:        (answers?.industry         || ''),
      ans_decision_level:  (answers?.decision_level   || ''),
      ans_regulatory:      (answers?.regulatory       || ''),
      ans_specialisation:  (answers?.specialisation   || ''),
      ans_data_work:       (answers?.data_work        || ''),
      ans_writing_work:    (answers?.writing_work     || ''),
      ans_tech_comfort:    (answers?.tech_comfort     || ''),
      ans_client_facing:   (answers?.client_facing    || ''),
      ans_learning_habit:  (answers?.learning_habit   || ''),
      ans_concern:         (answers?.concern          || ''),
      ans_biggest_worry:   (answers?.biggest_worry    || ''),
      ans_key_skills:      (answers?.key_skills       || '').slice(0, 200),
      ans_career_summary:  (answers?.career_summary   || '').slice(0, 400),

      // Scores
      score_automation:     String(Math.round(scores?.automation     || 55)),
      score_augmentation:   String(Math.round(scores?.augmentation   || 70)),
      score_income:         String(Math.round(scores?.income         || 60)),
      score_regulatory:     String(Math.round(scores?.regulatory     || 55)),
      score_skill_pressure: String(Math.round(scores?.skill_pressure || 65)),
      score_ai_adoption:    String(Math.round(scores?.ai_adoption    || 55)),

      cv_quality_issues: Array.isArray(cvQualityIssues)
        ? cvQualityIssues.join(' | ').slice(0, 450)
        : '',
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      ...(email ? { customer_email: email } : {}),
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: planInfo.amount,
          product_data: { name: planInfo.label, description: planInfo.desc },
        },
        quantity: 1,
      }],
      metadata,
      success_url: planKey === 'deep-index'
        ? `https://theplanitearth.com/index-deep.html?unlocked=true`
        : `https://theplanitearth.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://theplanitearth.com/quiz.html`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
