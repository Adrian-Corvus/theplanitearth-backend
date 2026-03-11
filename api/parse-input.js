// api/parse-input.js
// Parses CV text or LinkedIn text via Claude and returns structured career data
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://theplanitearth.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, content, name } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are extracting structured career data from a person's ${type === 'cv' ? 'CV/resume' : 'LinkedIn profile text'}.

Here is the ${type === 'cv' ? 'CV' : 'LinkedIn profile'} content:
---
${content.slice(0, 6000)}
---

Extract and infer the following. Be specific — use exact job titles, companies, and skills mentioned.
Return ONLY valid JSON, no markdown:

{
  "job_title": "Their most recent or current job title (exact)",
  "profession_cat": "One of: healthcare, finance, tech, legal, creative, education, other",
  "experience_years": "Approximate years of experience as a number",
  "experience": "One of: junior (0-2yr), mid (3-7yr), senior (8-15yr), expert (15+yr)",
  "industry": "One of: public, private, startup, freelance, nonprofit, academic",
  "tasks": "One of: structured, judgment, people, creative — based on their primary work",
  "specialisation": "One of: generalist, moderate, specialist, rare",
  "regulatory": "One of: none, optional, required, strict — based on their field",
  "education": "One of: secondary, bachelors, masters, phd, professional, vocational",
  "digital_skills": "One of: basic, intermediate, advanced, expert",
  "key_skills": "Comma-separated list of up to 6 specific skills from their profile",
  "current_employer": "Current or most recent employer name",
  "career_summary": "2-3 sentence summary of their career trajectory based on the content",
  "linkedin_headline": "Their LinkedIn headline if present, or null",
  "cv_quality_issues": "Array of 3-5 specific issues with this CV/LinkedIn that could be improved for the AI job market era (be specific and actionable)",
  "optimisation_urgency": "One of: low, medium, high, critical — how urgently they need to update their profile"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    // Map experience_years to experience level
    const yrs = parseInt(parsed.experience_years) || 0;
    if (!parsed.experience) {
      parsed.experience = yrs <= 2 ? 'junior' : yrs <= 7 ? 'mid' : yrs <= 15 ? 'senior' : 'expert';
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('Parse error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
