// api/parse-input.js
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://theplanitearth.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, content, url, name } = req.body;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let profileText = content || '';

  // ── LINKEDIN: fetch the public profile page and strip to plain text ──
  if (type === 'linkedin') {
    if (!url || !url.includes('linkedin.com/in/')) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL' });
    }
    try {
      const fetchRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(8000),
      });

      const html = await fetchRes.text();

      // Strip HTML tags and collapse whitespace
      profileText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 6000);

      if (profileText.length < 100) {
        return res.status(400).json({
          error: 'Profile appears to be private. Please set your LinkedIn profile to Public in Settings & Privacy, then try again.'
        });
      }
    } catch (err) {
      return res.status(400).json({
        error: 'Could not fetch LinkedIn profile. Make sure it is set to Public and the URL is correct.'
      });
    }
  }

  // ── CV: content already sent as plain text from client ──
  if (type === 'cv' && (!profileText || profileText.trim().length < 50)) {
    return res.status(400).json({ error: 'CV text too short or empty — could not read file.' });
  }

  const prompt = `You are extracting structured career data from a person's ${type === 'cv' ? 'CV/resume' : 'LinkedIn profile'}.

Content:
---
${profileText.slice(0, 5000)}
---

Extract and infer the following. Use exact job titles and skills where visible.
Return ONLY valid JSON, no markdown backticks:

{
  "job_title": "Most recent or current job title (exact wording)",
  "profession_cat": "One of: healthcare, finance, tech, legal, creative, education, other",
  "experience_years": 5,
  "experience": "One of: junior, mid, senior, expert",
  "industry": "One of: public, private, startup, freelance, nonprofit, academic",
  "tasks": "One of: structured, judgment, people, creative",
  "specialisation": "One of: generalist, moderate, specialist, rare",
  "regulatory": "One of: none, optional, required, strict",
  "key_skills": "Up to 6 specific skills, comma-separated",
  "current_employer": "Most recent employer name",
  "career_summary": "2 sentence summary of their career trajectory",
  "cv_quality_issues": ["Issue 1 specific to their profile", "Issue 2", "Issue 3"],
  "optimisation_urgency": "One of: low, medium, high, critical"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });

    const text   = response.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    const yrs = parseInt(parsed.experience_years) || 0;
    if (!parsed.experience) {
      parsed.experience = yrs <= 2 ? 'junior' : yrs <= 7 ? 'mid' : yrs <= 15 ? 'senior' : 'expert';
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('Parse error:', err.message);
    return res.status(500).json({ error: 'Analysis failed — ' + err.message });
  }
}
