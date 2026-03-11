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

  // ── LINKEDIN: attempt to fetch public profile, fail fast if blocked ──
  if (type === 'linkedin') {
    if (!url || !url.includes('linkedin.com/in/')) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL' });
    }

    let fetchOk = false;
    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 6000);

      const fetchRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);

      const html = await fetchRes.text();

      // LinkedIn returns a login wall or JS redirect when blocking — detect this
      const isBlocked = html.includes('authwall') || html.includes('login') ||
                        html.length < 2000 || !html.includes('profile');

      if (!isBlocked) {
        profileText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 5000);
        fetchOk = profileText.length > 200;
      }
    } catch (err) {
      // Fetch timed out or failed — fall through to URL-only analysis
      fetchOk = false;
    }

    // If we couldn't fetch the page, extract what we can from the URL itself
    // and ask Claude to make educated guesses (still useful for the brief)
    if (!fetchOk) {
      const slug = url.replace(/.*linkedin\.com\/in\//i, '').replace(/[/?#].*/, '');
      // Convert slug like "john-smith-senior-engineer" into readable text
      profileText = `LinkedIn profile URL slug: ${slug.replace(/-/g, ' ')}. Name provided: ${name || 'unknown'}.`;
    }
  }

  // ── CV ──
  if (type === 'cv' && (!profileText || profileText.trim().length < 50)) {
    return res.status(400).json({ error: 'CV text too short — could not read file.' });
  }

  const isUrlOnly = type === 'linkedin' && profileText.startsWith('LinkedIn profile URL slug');

  const prompt = `You are extracting structured career data from ${
    type === 'cv' ? "a person's CV/resume" :
    isUrlOnly ? "a LinkedIn profile URL slug (limited info — make reasonable inferences)" :
    "a LinkedIn profile page"
  }.

${isUrlOnly ? `Note: Full profile could not be fetched (private or blocked). Infer what you can from the name and URL slug.` : ''}

Content:
---
${profileText.slice(0, 5000)}
---

Return ONLY valid JSON, no markdown:
{
  "job_title": "Most likely job title based on available info",
  "profession_cat": "One of: healthcare, finance, tech, legal, creative, education, other",
  "experience_years": 5,
  "experience": "One of: junior, mid, senior, expert",
  "industry": "One of: public, private, startup, freelance, nonprofit, academic",
  "tasks": "One of: structured, judgment, people, creative",
  "specialisation": "One of: generalist, moderate, specialist, rare",
  "regulatory": "One of: none, optional, required, strict",
  "key_skills": "Up to 6 skills comma-separated",
  "current_employer": "Most recent employer or unknown",
  "career_summary": "2 sentence summary",
  "cv_quality_issues": ${isUrlOnly
    ? '["Profile set to private — set LinkedIn to Public for better analysis", "Could not read full profile details"]'
    : '["Issue 1 specific to their profile", "Issue 2", "Issue 3"]'
  },
  "optimisation_urgency": "One of: low, medium, high, critical"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text   = response.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    const yrs    = parseInt(parsed.experience_years) || 0;
    if (!parsed.experience) {
      parsed.experience = yrs <= 2 ? 'junior' : yrs <= 7 ? 'mid' : yrs <= 15 ? 'senior' : 'expert';
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('Parse error:', err.message);
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
}
