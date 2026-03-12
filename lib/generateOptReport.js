// lib/generateOptReport.js
// Generates a LinkedIn + CV Optimisation Report PDF
import PDFDocument from 'pdfkit';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const C = {
  ink:   '#0D0F14', sage:  '#3D6B4F', amber: '#D4841A',
  red:   '#C0392B', mid:   '#8A8880', white: '#FFFFFF',
  light: '#F5F2EC', mist:  '#E8E4DC', bg2:   '#FAFAF8',
  teal:  '#1A7A9D', purple:'#7B5EA7',
};
function hex(h) {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return [r,g,b];
}

async function generateOptNarratives({ name, profession, answers, scores, cvIssues, inputMethod, targetCountry, targetCompany, targetRole }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isCV       = inputMethod === 'cv';
  const isLinkedIn = inputMethod === 'linkedin';
  const hasIssues  = cvIssues && cvIssues.length > 0;
  const hasCountry = targetCountry && targetCountry.length > 0;
  const hasCompany = targetCompany && targetCompany.length > 0;
  const hasRole    = targetRole    && targetRole.length    > 0;

  const prompt = `You are a senior career coach writing a personalised Profile Optimisation Report for ${name}, who works as: ${profession}.

Their career context:
- Sector: ${answers.profession_cat}
- Experience: ${answers.experience}
- Key skills: ${answers.key_skills || 'not specified'}
- Career summary: ${answers.career_summary || 'not specified'}
- Input method: ${inputMethod} (${isCV ? 'CV uploaded' : isLinkedIn ? 'LinkedIn provided' : 'quiz taken'})
${hasIssues ? `\nIssues already identified in their profile:\n${cvIssues.map((v,i) => `${i+1}. ${v}`).join('\n')}` : ''}

Write a highly specific, actionable Profile Optimisation Report. Reference their actual job title and profession throughout.
Do NOT be generic. Give specific examples, exact wording suggestions, and named tools.
${hasCountry ? `IMPORTANT: Apply ${targetCountry} hiring norms throughout. For example: UK CVs are typically 2 pages max and never include photos; French CVs (CVs) often include a photo and personal statement; US resumes are 1 page for under 10 years experience; German Bewerbung includes a formal cover letter and photo; UAE CVs may include nationality. Adjust all advice accordingly.` : ''}
${hasCompany ? `Where relevant, tailor advice to ${targetCompany}'s known culture and values.` : ''}

Return ONLY valid JSON, no markdown:

{
  "report_intro": "2-3 sentences: why their ${isCV ? 'CV' : 'LinkedIn'} matters right now in the AI job market, specific to their profession.",

  "linkedin_headline_current": "${isLinkedIn ? 'The headline from their profile if visible, or a likely generic one for their role' : 'A typical generic headline someone with their job title would have'}",
  "linkedin_headline_improved": "A specific, punchy, AI-era headline for their exact job title (max 15 words)",
  "linkedin_headline_why": "1 sentence explaining what makes the improved version better",

  "linkedin_summary_tips": [
    "Specific tip 1 for their About/summary section — what to add or change",
    "Specific tip 2",
    "Specific tip 3"
  ],

  "linkedin_skills_to_add": [
    "Specific skill 1 relevant to their profession and AI era",
    "Specific skill 2",
    "Specific skill 3",
    "Specific skill 4"
  ],

  "cv_structure_issues": [
    "Issue 1 — specific to their career stage and profession",
    "Issue 2",
    "Issue 3"
  ],

  "cv_bullet_before": "An example weak CV bullet point typical of their profession",
  "cv_bullet_after": "The same bullet rewritten with impact metrics and AI-era relevance",

  "keywords_to_add": [
    "Keyword 1 that ATS systems and recruiters look for in their field",
    "Keyword 2",
    "Keyword 3",
    "Keyword 4",
    "Keyword 5"
  ],

  "positioning_strategy": "2-3 sentences: how they should position themselves as an AI-era professional in their specific field. What story should their profile tell?",

  "quick_wins": [
    "Action they can do in 10 minutes that will immediately improve their profile",
    "Second quick win",
    "Third quick win"
  ],

  "urgency_message": "1 punchy sentence about why updating their profile matters NOW for someone in their specific profession."
}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1800,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

function checkPageBreak(doc, needed, M) {
  if (doc.y + needed > 800) { doc.addPage(); doc.y = M.top; }
}

function sectionBanner(doc, title, M, UW, color = C.ink) {
  doc.rect(M.left, doc.y, UW, 26).fill(hex(color));
  const ty = doc.y + 7;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(hex(C.white))
     .text(title.toUpperCase(), M.left + 12, ty, { width: UW - 24, characterSpacing: 0.8 });
  doc.y += 28;
}

function pageHeader(doc, name, pageNum, M, UW) {
  doc.font('Helvetica').fontSize(7.5).fillColor(hex(C.mid))
     .text(`THEPLANITEARTH.COM  ·  PROFILE OPTIMISATION REPORT  ·  ${name.toUpperCase()}`, M.left, 16, { width: UW, align: 'left' })
     .text(`PAGE ${pageNum}`, M.left, 16, { width: UW, align: 'right' });
  doc.moveTo(M.left, 27).lineTo(M.left + UW, 27).strokeColor(hex(C.mist)).lineWidth(0.5).stroke();
}

export async function generateOptimisationReport({ name, profession, answers, scores, cvIssues, inputMethod, targetCountry = '', targetCompany = '', targetRole = '' }) {
  const n = await generateOptNarratives({ name, profession, answers, scores, cvIssues, inputMethod, targetCountry, targetCompany, targetRole });
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const isCV  = inputMethod === 'cv';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: { Title: `Profile Optimisation Report — ${name}`, Author: 'ThePlanItEarth' },
    });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = 595;
    const M  = { left: 40, right: 40, top: 40, bottom: 40 };
    const UW = PW - M.left - M.right;

    // ── COVER PAGE ──
    doc.rect(0, 0, PW, 842).fill(hex('#0D1F14')); // dark green

    try {
      const logoData = readFileSync(join(__dirname, '..', 'assets', 'logo-white.png'));
      doc.image(logoData, M.left, 36, { width: 90 });
    } catch(e) {
      doc.font('Helvetica-Bold').fontSize(12).fillColor(hex(C.white))
         .text('THEPLANITEARTH.COM', M.left, 40, { characterSpacing: 2 });
    }

    doc.font('Helvetica-Bold').fontSize(44).fillColor(hex(C.white))
       .text('Profile', M.left, 140, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(44).fillColor(hex(C.white))
       .text('Optimisation', M.left, 192, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(44).fillColor(hex(C.sage))
       .text('Report', M.left, 244, { lineBreak: false });

    doc.rect(M.left, 304, 48, 3).fill(hex(C.amber));

    doc.font('Helvetica').fontSize(14).fillColor(hex(C.sage))
       .text(`Prepared for ${name}`, M.left, 318, { lineBreak: false });
    const targetLine = [targetCountry, targetCompany, targetRole].filter(Boolean).join(' · ');
    const profShort = profession.length > 40 ? profession.slice(0,38)+'…' : profession;
    doc.font('Helvetica').fontSize(12).fillColor('rgba(245,242,236,0.6)')
       .text(profShort, M.left, 338, { lineBreak: false });
    if (targetLine) {
      doc.font('Helvetica').fontSize(10).fillColor('rgba(245,242,236,0.45)')
         .text(targetLine.slice(0, 60), M.left, 356, { lineBreak: false });
    }
    doc.font('Helvetica').fontSize(10).fillColor('rgba(245,242,236,0.3)')
       .text(today, M.left, 358, { lineBreak: false });

    // What's inside box
    const bY = 410;
    doc.rect(M.left, bY, UW, 130).fill(hex('#1A3020'));
    doc.rect(M.left, bY, 4, 130).fill(hex(C.amber));
    doc.font('Helvetica-Bold').fontSize(8).fillColor(hex(C.amber))
       .text("WHAT'S INSIDE", M.left + 16, bY + 14, { characterSpacing: 1.5, lineBreak: false });

    const items = [
      'LinkedIn headline rewrite — specific to your role',
      'AI-era keywords and skills to add',
      'CV bullet point transformation example',
      '3 quick wins you can do today',
      'Profile positioning strategy',
    ];
    items.forEach((item, i) => {
      doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.white))
         .text(`→  ${item}`, M.left + 16, bY + 32 + i * 18, { lineBreak: false });
    });

    doc.font('Helvetica').fontSize(7.5).fillColor('rgba(245,242,236,0.2)')
       .text('theplanitearth.com  ·  Profile Optimisation Report  ·  AI-powered career intelligence',
             M.left, 790, { width: UW, align: 'center', lineBreak: false });

    // ── PAGE 2: LINKEDIN ──
    doc.addPage();
    pageHeader(doc, name, 2, M, UW);
    doc.y = 44;

    doc.font('Helvetica-Bold').fontSize(19).fillColor(hex(C.ink))
       .text('LinkedIn Profile Optimisation', M.left, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor(hex(C.mid)).lineGap(3)
       .text(n.report_intro, M.left, doc.y, { width: UW });
    doc.moveDown(1);

    // Headline rewrite
    sectionBanner(doc, 'Headline Rewrite', M, UW, C.teal);

    const hlBeforeH = Math.max(44, doc.heightOfString(n.linkedin_headline_current || '', { width: UW - 32 }) + 24);
    doc.rect(M.left, doc.y, UW, hlBeforeH).fill(hex('#FDF4F3'));
    doc.rect(M.left, doc.y, 4, hlBeforeH).fill(hex(C.red));
    doc.font('Helvetica-Bold').fontSize(8).fillColor(hex(C.red))
       .text('CURRENT (TYPICAL)', M.left + 14, doc.y + 8, { characterSpacing: 0.8, lineBreak: false });
    doc.font('Helvetica').fontSize(11).fillColor(hex(C.ink))
       .text(n.linkedin_headline_current || '', M.left + 14, doc.y + 22, { width: UW - 28 });
    doc.y += hlBeforeH + 4;

    const hlAfterH = Math.max(44, doc.heightOfString(n.linkedin_headline_improved || '', { width: UW - 32 }) + 24);
    doc.rect(M.left, doc.y, UW, hlAfterH).fill(hex('#EEF5F1'));
    doc.rect(M.left, doc.y, 4, hlAfterH).fill(hex(C.sage));
    doc.font('Helvetica-Bold').fontSize(8).fillColor(hex(C.sage))
       .text('IMPROVED', M.left + 14, doc.y + 8, { characterSpacing: 0.8, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(hex(C.ink))
       .text(n.linkedin_headline_improved || '', M.left + 14, doc.y + 22, { width: UW - 28 });
    doc.y += hlAfterH + 4;

    doc.font('Helvetica').fontSize(10).fillColor(hex(C.mid)).lineGap(3)
       .text(`Why: ${n.linkedin_headline_why || ''}`, M.left, doc.y, { width: UW });
    doc.moveDown(1.2);

    // Summary tips
    checkPageBreak(doc, 120, M);
    sectionBanner(doc, 'About / Summary Section Tips', M, UW, C.teal);
    (n.linkedin_summary_tips || []).forEach((tip, i) => {
      checkPageBreak(doc, 40, M);
      doc.font('Helvetica').fontSize(10).fillColor(hex(C.mid))
         .text(`${String(i+1)}.`, M.left + 4, doc.y, { lineBreak: false, width: 16 });
      doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.ink))
         .text(tip, M.left + 22, doc.y, { width: UW - 22 });
      doc.moveDown(0.6);
    });
    doc.moveDown(0.6);

    // Skills to add
    checkPageBreak(doc, 100, M);
    sectionBanner(doc, 'Skills to Add to Your Profile', M, UW, C.teal);
    const skills = n.linkedin_skills_to_add || [];
    const skColW = (UW - 8) / 2;
    skills.forEach((skill, i) => {
      checkPageBreak(doc, 28, M);
      const col = i % 2;
      const sY  = col === 0 ? doc.y : doc.y;
      const sX  = M.left + col * (skColW + 8);
      doc.roundedRect(sX, sY, skColW, 24, 6).fill(hex(C.mist));
      doc.font('Helvetica').fontSize(10).fillColor(hex(C.ink))
         .text(`+ ${skill}`, sX + 10, sY + 7, { width: skColW - 16, lineBreak: false });
      if (col === 1 || i === skills.length - 1) doc.y = sY + 28;
    });
    doc.moveDown(0.8);

    // Keywords
    checkPageBreak(doc, 100, M);
    sectionBanner(doc, 'Keywords to Add (ATS & Recruiter Visibility)', M, UW, C.ink);
    const kws = n.keywords_to_add || [];
    kws.forEach((kw, i) => {
      checkPageBreak(doc, 28, M);
      const col = i % 2;
      const kX  = M.left + col * (skColW + 8);
      doc.roundedRect(kX, doc.y, skColW, 24, 6).fill(hex('#EEF5F1'));
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(hex(C.sage))
         .text(kw, kX + 10, doc.y + 7, { width: skColW - 16, lineBreak: false });
      if (col === 1 || i === kws.length - 1) doc.y += 28;
    });

    // ── PAGE 3: CV ──
    doc.addPage();
    pageHeader(doc, name, 3, M, UW);
    doc.y = 44;

    doc.font('Helvetica-Bold').fontSize(19).fillColor(hex(C.ink))
       .text('CV Optimisation', M.left, doc.y);
    doc.moveDown(1);

    // Bullet transformation
    sectionBanner(doc, 'Bullet Point Transformation', M, UW, C.amber);

    doc.font('Helvetica').fontSize(10).fillColor(hex(C.mid))
       .text('Weak bullet (typical for your level):', M.left, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor(hex(C.mid))
       .text('Before:', M.left + 4, doc.y, { lineBreak: false, width: 40 });
    const bfH = Math.max(32, doc.heightOfString(n.cv_bullet_before || '', { width: UW - 32 }) + 16);
    doc.rect(M.left, doc.y, UW, bfH).fill(hex('#FDF4F3'));
    doc.rect(M.left, doc.y, 4, bfH).fill(hex(C.red));
    doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.ink))
       .text(n.cv_bullet_before || '', M.left + 14, doc.y + 10, { width: UW - 28 });
    doc.y += bfH + 6;

    const afH = Math.max(32, doc.heightOfString(n.cv_bullet_after || '', { width: UW - 32 }) + 16);
    doc.rect(M.left, doc.y, UW, afH).fill(hex('#EEF5F1'));
    doc.rect(M.left, doc.y, 4, afH).fill(hex(C.sage));
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(hex(C.ink))
       .text(n.cv_bullet_after || '', M.left + 14, doc.y + 10, { width: UW - 28 });
    doc.y += afH + 14;

    // Structure issues
    checkPageBreak(doc, 100, M);
    sectionBanner(doc, 'Structure Issues to Fix', M, UW, C.amber);
    (n.cv_structure_issues || []).forEach((issue, i) => {
      checkPageBreak(doc, 40, M);
      const iY = doc.y;
      const iH = Math.max(36, doc.heightOfString(issue, { width: UW - 32 }) + 20);
      doc.rect(M.left, iY, UW, iH).fill(hex(i % 2 === 0 ? C.bg2 : C.white));
      doc.font('Helvetica-Bold').fontSize(10).fillColor(hex(C.amber))
         .text(`${i+1}`, M.left + 12, iY + (iH - 14) / 2, { lineBreak: false });
      doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.ink))
         .text(issue, M.left + 28, iY + 10, { width: UW - 36 });
      doc.y = iY + iH + 4;
    });
    doc.moveDown(1);

    // Positioning strategy
    checkPageBreak(doc, 100, M);
    sectionBanner(doc, 'Your AI-Era Positioning Strategy', M, UW, C.ink);
    doc.font('Helvetica').fontSize(11).fillColor('#3A3835').lineGap(5)
       .text(n.positioning_strategy || '', M.left, doc.y, { width: UW });
    doc.moveDown(1.2);

    // Quick wins
    checkPageBreak(doc, 120, M);
    sectionBanner(doc, '3 Quick Wins — Do These Today', M, UW, C.sage);
    (n.quick_wins || []).forEach((win, i) => {
      checkPageBreak(doc, 48, M);
      const wY = doc.y;
      const wH = Math.max(44, doc.heightOfString(win, { width: UW - 60 }) + 22);
      doc.rect(M.left, wY, UW, wH).fill(hex(i % 2 === 0 ? C.bg2 : C.white));
      doc.circle(M.left + 20, wY + wH / 2, 12).fill(hex(C.sage));
      doc.font('Helvetica-Bold').fontSize(11).fillColor(hex(C.white))
         .text(`${i+1}`, M.left + 16, wY + wH / 2 - 7, { lineBreak: false });
      doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.ink))
         .text(win, M.left + 40, wY + 14, { width: UW - 50 });
      doc.y = wY + wH + 4;
    });
    doc.moveDown(1);

    // Urgency closing
    checkPageBreak(doc, 60, M);
    const urgY = doc.y;
    doc.roundedRect(M.left, urgY, UW, 52, 8).fill(hex(C.ink));
    doc.font('Helvetica-Bold').fontSize(11).fillColor(hex(C.white))
       .text(n.urgency_message || '', M.left + 16, urgY + 18, { width: UW - 32, align: 'center' });
    doc.y = urgY + 56;

    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(8).fillColor(hex(C.mid))
       .text(`Generated ${today}  ·  theplanitearth.com  ·  For informational purposes only.`,
             M.left, doc.y, { width: UW, align: 'center' });

    doc.end();
  });
}
