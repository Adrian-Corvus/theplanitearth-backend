// lib/generatePDF.js
// Generates a personalised Career Intelligence Brief PDF using PDFKit.
// Called from the webhook after successful payment.
// Uses Claude API to generate the personalised narrative sections.

import PDFDocument from 'pdfkit';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── COLOURS ──
const C = {
  ink:    '#0D0F14',
  sage:   '#3D6B4F',
  amber:  '#D4841A',
  red:    '#C0392B',
  purple: '#7B5EA7',
  mid:    '#8A8880',
  light:  '#F5F2EC',
  mist:   '#E8E4DC',
  white:  '#FFFFFF',
  teal:   '#1A7A9D',
};

const METRIC_COLORS = {
  automation:     C.red,
  augmentation:   C.sage,
  income:         C.amber,
  regulatory:     C.purple,
  skill_pressure: C.teal,
  ai_adoption:    C.sage,
};

// ── AI NARRATIVE GENERATION ──
async function generateNarratives(data) {
  const { name, profession, archetype, answers, scores } = data;

  const prompt = `You are writing a personalised Career Intelligence Brief for ${name}, a ${profession}.

Their archetype is: ${archetype.name}
Their scores (0-100):
- Automation Exposure: ${Math.round(scores.automation || 55)}
- Augmentation Potential: ${Math.round(scores.augmentation || 70)}
- Income Protection: ${Math.round(scores.income || 60)}
- Regulatory Protection: ${Math.round(scores.regulatory || 55)}
- Skill Evolution Pressure: ${Math.round(scores.skill_pressure || 65)}

Their experience level: ${answers.experience || 'mid'}
Their primary work type: ${answers.tasks || 'judgment'}
Their AI exposure: ${answers.ai_exposure || 'aware'}

Write these 5 sections. Be specific, nuanced, probabilistic. Not fearful, not dismissive. Like a trusted advisor.
Return ONLY valid JSON, no markdown:

{
  "executive_summary": "3 sentences. What does their specific situation mean? What's the headline insight?",
  "archetype_explanation": "2-3 sentences on WHY they got this archetype based on their specific profile.",
  "tasks_at_risk_insight": "2 sentences explaining the pattern in their at-risk tasks.",
  "tasks_augmented_insight": "2 sentences on the opportunity — what AI will amplify in their work.",
  "horizon_1yr": "1 sentence on their situation in 12 months.",
  "horizon_3yr": "1 sentence on their situation in 3 years.",
  "horizon_5yr": "1 sentence on their situation in 5 years.",
  "skill_step_1": "Specific skill to develop first (15 words max)",
  "skill_step_2": "Second skill priority (15 words max)",
  "skill_step_3": "Third skill priority (15 words max)",
  "skill_step_4": "Fourth skill priority (15 words max)",
  "skill_step_5": "Fifth skill priority (15 words max)",
  "skill_step_6": "Sixth skill priority (15 words max)",
  "closing_advice": "2 sentences. Calm, confident, forward-looking close."
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('AI generation error:', err);
    // Fallback narratives
    return {
      executive_summary: `As a ${profession}, your career sits at an important inflection point. AI is reshaping your field — but the direction depends heavily on how you position yourself in the next 12–18 months.`,
      archetype_explanation: `Your profile reflects the ${archetype.name} pattern: a professional whose expertise can be amplified by AI tools, but who needs a clear roadmap to navigate the transition strategically.`,
      tasks_at_risk_insight: 'The tasks most at risk are those that follow predictable, rule-based patterns. These are the areas where AI tools are already demonstrating capability.',
      tasks_augmented_insight: 'Where you have the most opportunity is in work requiring judgment, relationships, and contextual expertise — areas where AI becomes a powerful assistant rather than a replacement.',
      horizon_1yr:  'The next 12 months are a critical window to build foundational AI fluency in your field.',
      horizon_3yr:  'By 2027, professionals in your sector who have adopted AI tools will command a measurable productivity and earnings premium.',
      horizon_5yr:  'Your long-term position depends on the adjacent skills you develop now — particularly those that leverage your existing expertise in new ways.',
      skill_step_1: 'Learn the 2–3 leading AI tools specific to your profession',
      skill_step_2: 'Develop prompt engineering fluency for your work context',
      skill_step_3: 'Build one adjacent technical skill that complements your core expertise',
      skill_step_4: 'Strengthen strategic communication and stakeholder influence',
      skill_step_5: 'Explore cross-functional collaboration with adjacent teams',
      skill_step_6: 'Consider a recognised credential in AI application in your field',
      closing_advice: `The professionals who thrive won't be those who ignored AI, nor those who panicked about it — they'll be those who understood it early and used it strategically. You're already ahead of the curve by getting this analysis.`,
    };
  }
}

// ── TASK DATA ──
function getTaskData(sector) {
  const tasks = {
    healthcare:  { risk: ['Routine diagnostic screening', 'Clinical documentation drafting', 'Standard referral letters', 'Protocol-based triage decisions'], augmented: ['Complex case diagnosis', 'Patient communication & empathy', 'Interdisciplinary care coordination', 'Rare disease pattern recognition'] },
    finance:     { risk: ['Rule-based data reconciliation', 'Standard report generation', 'Basic portfolio rebalancing', 'Compliance checklist reviews'], augmented: ['Complex deal structuring', 'Client relationship management', 'Strategic financial planning', 'Novel regulatory interpretation'] },
    tech:        { risk: ['Boilerplate code generation', 'Standard QA test scripts', 'Basic API documentation', 'Routine bug fixes'], augmented: ['System architecture design', 'Complex performance optimisation', 'Stakeholder requirement translation', 'Technical leadership & mentoring'] },
    legal:       { risk: ['Contract template review', 'Legal research & citation', 'Standard clause drafting', 'Discovery document review'], augmented: ['Courtroom advocacy', 'Complex negotiation strategy', 'Novel legal interpretation', 'Client trust & strategic counsel'] },
    creative:    { risk: ['Basic copywriting from briefs', 'Template-based design work', 'Stock asset curation', 'Caption and social copy'], augmented: ['Brand strategy direction', 'Original concept development', 'Client creative direction', 'Cultural insight & audience strategy'] },
    education:   { risk: ['Content delivery (lecture format)', 'Standard assessment marking', 'Routine lesson planning', 'Administrative reporting'], augmented: ['Personalised mentoring & coaching', 'Adaptive curriculum design', 'Complex student support', 'Critical thinking facilitation'] },
    other:       { risk: ['Repetitive administrative tasks', 'Standard data processing', 'Template-based report generation', 'Rule-based decision making'], augmented: ['Strategic judgment calls', 'Stakeholder relationships', 'Creative problem-solving', 'Complex contextual decisions'] },
  };
  return tasks[sector] || tasks.other;
}

// ── PDF HELPERS ──
function hexToRGB(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return [r, g, b];
}

function drawBar(doc, x, y, width, value, color, trackColor = '#E8E4DC') {
  // Track
  const [tr,tg,tb] = hexToRGB(trackColor);
  doc.roundedRect(x, y, width, 8, 4).fill([tr,tg,tb]);
  // Fill
  if (value > 0) {
    const [fr,fg,fb] = hexToRGB(color);
    const fillW = Math.max(8, (value / 100) * width);
    doc.roundedRect(x, y, fillW, 8, 4).fill([fr,fg,fb]);
  }
}

function drawMetricRow(doc, label, value, color, note, x, y, width) {
  const [cr,cg,cb] = hexToRGB(color);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink).text(label, x, y);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(color).text(`${Math.round(value)}/100`, x + width - 60, y - 1, { width: 60, align: 'right' });
  drawBar(doc, x, y + 18, width, value, color);
  doc.font('Helvetica').fontSize(9).fillColor(C.mid).text(note, x, y + 32, { width });
}

function drawSectionHeader(doc, title, pageWidth, margins) {
  const usableWidth = pageWidth - margins.left - margins.right;
  doc.rect(margins.left, doc.y, usableWidth, 28)
     .fill(hexToRGB(C.sage));
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.white)
     .text(title, margins.left + 12, doc.y - 22, { width: usableWidth - 24 });
  doc.y += 6;
}

function pageHeader(doc, name, profession, pageNum) {
  doc.font('Helvetica').fontSize(8).fillColor(C.mid)
     .text(`PLANITEARTH · CAREER INTELLIGENCE BRIEF · ${name.toUpperCase()}`, 40, 18, { width: 515, align: 'left' })
     .text(`${profession.toUpperCase()} · PAGE ${pageNum}`, 40, 18, { width: 515, align: 'right' });
  doc.moveTo(40, 30).lineTo(555, 30).strokeColor(hexToRGB(C.mist)).lineWidth(0.5).stroke();
}

// ── MAIN EXPORT ──
export async function generatePDF(data) {
  const { name, profession, archetype, answers, scores } = data;
  const narratives = await generateNarratives(data);
  const taskData   = getTaskData(answers.profession_cat || 'other');
  const today      = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      info: {
        Title: `Career Intelligence Brief — ${name}`,
        Author: 'PlanItEarth',
        Subject: `AI Career Analysis for ${profession}`,
      }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = 595; // A4 width in points
    const M  = { left: 40, right: 40, top: 50, bottom: 50 };
    const UW = PW - M.left - M.right; // usable width = 515

    // ══════════════════════════════════════════════
    // PAGE 1 — COVER
    // ══════════════════════════════════════════════
    const [sr,sg,sb] = hexToRGB(C.sage);
    doc.rect(0, 0, PW, 842).fill([sr,sg,sb]);

    // Brand
    doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.5)')
       .text('PLANITEARTH', M.left, 60, { characterSpacing: 3 });

    // Title block
    doc.font('Helvetica-Bold').fontSize(42).fillColor(C.white)
       .text('Career', M.left, 130)
       .text('Intelligence', M.left, 175)
       .text('Brief', M.left, 220);

    doc.font('Helvetica').fontSize(14).fillColor('rgba(255,255,255,0.7)')
       .text(`Personalised for ${name}`, M.left, 290);

    // Divider
    doc.moveTo(M.left, 320).lineTo(M.left + 200, 320)
       .strokeColor([255,255,255]).lineWidth(1).stroke();

    // Meta
    doc.font('Helvetica').fontSize(12).fillColor('rgba(255,255,255,0.9)')
       .text(profession, M.left, 336)
       .text(today, M.left, 356);

    // Archetype box
    doc.rect(M.left, 420, UW, 120)
       .fill('rgba(0,0,0,0.2)');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('rgba(255,255,255,0.6)')
       .text('YOUR CAREER ARCHETYPE', M.left + 20, 440, { characterSpacing: 1.5 });
    doc.font('Helvetica-Bold').fontSize(26).fillColor(C.white)
       .text(`${archetype.emoji}  ${archetype.name}`, M.left + 20, 460);
    doc.font('Helvetica').fontSize(12).fillColor('rgba(255,255,255,0.8)')
       .text(narratives.archetype_explanation, M.left + 20, 500, { width: UW - 40, lineGap: 3 });

    // Footer
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.4)')
       .text('Data sources: WEF Future of Jobs Report · McKinsey Global Institute · O*NET · Bureau of Labor Statistics · Brookings Institution', M.left, 790, { width: UW, align: 'center' });

    // ══════════════════════════════════════════════
    // PAGE 2 — EXECUTIVE SUMMARY + METRICS
    // ══════════════════════════════════════════════
    doc.addPage();
    pageHeader(doc, name, profession, 2);

    doc.y = 48;

    // Executive Summary
    doc.font('Helvetica-Bold').fontSize(20).fillColor(C.ink)
       .text('Executive Summary', M.left, doc.y);
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12).fillColor('#3A3835').lineGap(4)
       .text(narratives.executive_summary, M.left, doc.y, { width: UW });
    doc.moveDown(1.5);

    // Metrics header
    doc.rect(M.left, doc.y, UW, 28).fill(hexToRGB(C.ink));
    const hdrY = doc.y + 8;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white)
       .text('YOUR 6-DIMENSION CAREER DASHBOARD', M.left + 12, hdrY);
    doc.y = hdrY + 28;

    const metricDefs = [
      { label: 'Automation Exposure',     key: 'automation',     color: C.red,    note: 'How much of your current work AI tools can replicate or automate' },
      { label: 'Augmentation Potential',  key: 'augmentation',   color: C.sage,   note: 'How much AI could multiply your effectiveness and output quality' },
      { label: 'Income Protection',       key: 'income',         color: C.amber,  note: 'Structural resilience of your earnings over the next 5 years' },
      { label: 'Regulatory Protection',   key: 'regulatory',     color: C.purple, note: 'Licensing, accreditation, and legal barriers protecting your role' },
      { label: 'Skill Evolution Pressure',key: 'skill_pressure', color: C.teal,   note: 'Urgency to develop new capabilities to remain competitive' },
      { label: 'AI Adoption in Your Field', key: 'ai_adoption',  color: '#1A7A9D',note: 'Current penetration of AI tools across your sector' },
    ];

    metricDefs.forEach((m, i) => {
      const bg = i % 2 === 0 ? '#FAFAF8' : C.white;
      doc.rect(M.left, doc.y, UW, 54).fill(hexToRGB(bg));
      drawMetricRow(doc, m.label, scores[m.key] || 50, m.color, m.note, M.left + 12, doc.y + 6, UW - 24);
      doc.y += 56;
    });

    // ══════════════════════════════════════════════
    // PAGE 3 — TASKS + HORIZON
    // ══════════════════════════════════════════════
    doc.addPage();
    pageHeader(doc, name, profession, 3);
    doc.y = 48;

    // Tasks at risk
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.ink).text('Task-Level Analysis', M.left, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor(C.mid).text(narratives.tasks_at_risk_insight, M.left, doc.y, { width: UW });
    doc.moveDown(1);

    const colW = (UW - 16) / 2;

    // Risk column header
    doc.rect(M.left, doc.y, colW, 24).fill(hexToRGB(C.red));
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white)
       .text('⚠  TASKS UNDER PRESSURE', M.left + 10, doc.y + 7, { characterSpacing: 0.5 });
    const riskHeaderY = doc.y + 24;

    // Augmented column header
    doc.rect(M.left + colW + 16, doc.y, colW, 24).fill(hexToRGB(C.sage));
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white)
       .text('✦  AI WILL AMPLIFY', M.left + colW + 26, doc.y + 7, { characterSpacing: 0.5 });

    doc.y = riskHeaderY;

    taskData.risk.forEach((task, i) => {
      const rowBg = i % 2 === 0 ? '#FDF4F3' : C.white;
      doc.rect(M.left, doc.y, colW, 30).fill(hexToRGB(rowBg));
      doc.font('Helvetica').fontSize(10).fillColor(C.ink)
         .text(`• ${task}`, M.left + 10, doc.y + 10, { width: colW - 20 });

      const augBg = i % 2 === 0 ? '#F2F7F4' : C.white;
      doc.rect(M.left + colW + 16, doc.y, colW, 30).fill(hexToRGB(augBg));
      doc.font('Helvetica').fontSize(10).fillColor(C.ink)
         .text(`• ${taskData.augmented[i] || ''}`, M.left + colW + 26, doc.y + 10, { width: colW - 20 });

      doc.y += 30;
    });

    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(10).fillColor(C.mid)
       .text(narratives.tasks_augmented_insight, M.left, doc.y, { width: UW });
    doc.moveDown(1.5);

    // Horizon outlook
    doc.rect(M.left, doc.y, UW, 26).fill(hexToRGB(C.ink));
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white)
       .text('HORIZON OUTLOOK', M.left + 12, doc.y + 8, { characterSpacing: 1 });
    doc.y += 28;

    const horizons = [
      { label: '12 Months', text: narratives.horizon_1yr,  color: C.sage   },
      { label: '3 Years',   text: narratives.horizon_3yr,  color: C.amber  },
      { label: '5 Years',   text: narratives.horizon_5yr,  color: C.purple },
    ];

    horizons.forEach((h, i) => {
      const hBg = i % 2 === 0 ? '#FAFAF8' : C.white;
      doc.rect(M.left, doc.y, UW, 50).fill(hexToRGB(hBg));
      const [cr,cg,cb] = hexToRGB(h.color);
      doc.rect(M.left, doc.y, 4, 50).fill([cr,cg,cb]);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(h.color)
         .text(h.label, M.left + 14, doc.y + 8);
      doc.font('Helvetica').fontSize(10).fillColor(C.ink)
         .text(h.text, M.left + 14, doc.y + 22, { width: UW - 28 });
      doc.y += 52;
    });

    // ══════════════════════════════════════════════
    // PAGE 4 — SKILL ROADMAP + CLOSING
    // ══════════════════════════════════════════════
    doc.addPage();
    pageHeader(doc, name, profession, 4);
    doc.y = 48;

    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.ink)
       .text('Your Prioritised Skill Roadmap', M.left, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor(C.mid)
       .text('Ordered by urgency and impact. Focus on steps 1–3 in the next 90 days.', M.left, doc.y, { width: UW });
    doc.moveDown(1);

    const steps = [
      narratives.skill_step_1, narratives.skill_step_2,
      narratives.skill_step_3, narratives.skill_step_4,
      narratives.skill_step_5, narratives.skill_step_6,
    ];
    const stepColors = [C.sage, C.sage, C.amber, C.amber, C.teal, C.teal];

    steps.forEach((step, i) => {
      const [cr,cg,cb] = hexToRGB(stepColors[i]);
      // Number circle
      doc.circle(M.left + 16, doc.y + 16, 14).fill([cr,cg,cb]);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(C.white)
         .text(`${i+1}`, M.left + (i+1 >= 10 ? 10 : 13), doc.y + 10);
      // Step text
      doc.font('Helvetica').fontSize(11).fillColor(C.ink)
         .text(step, M.left + 38, doc.y + 10, { width: UW - 40 });
      // Connector line (not on last)
      if (i < steps.length - 1) {
        doc.moveTo(M.left + 16, doc.y + 30).lineTo(M.left + 16, doc.y + 44)
           .strokeColor(hexToRGB(C.mist)).lineWidth(1).dash(2, { space: 2 }).stroke().undash();
      }
      doc.y += 44;
    });

    doc.moveDown(1.5);

    // Closing
    doc.rect(M.left, doc.y, UW, 5).fill(hexToRGB(C.sage));
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(C.ink).text('Final Word', M.left, doc.y);
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(12).fillColor('#3A3835').lineGap(4)
       .text(narratives.closing_advice, M.left, doc.y, { width: UW });

    doc.moveDown(2);

    // Sources box
    doc.rect(M.left, doc.y, UW, 80).fill(hexToRGB('#F5F2EC'));
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.mid).text('DATA SOURCES', M.left + 12, doc.y + 10, { characterSpacing: 1 });
    doc.font('Helvetica').fontSize(8).fillColor(C.mid)
       .text(
         'World Economic Forum — Future of Jobs Report 2023 · McKinsey Global Institute — AI and the Future of Work · ' +
         "O*NET Online (US Dept. of Labor) · Bureau of Labor Statistics Occupational Outlook · " +
         "Brookings Institution — Automation & AI · Goldman Sachs Global Investment Research · Pew Research Center",
         M.left + 12, doc.y + 24, { width: UW - 24, lineGap: 3 }
       );

    doc.moveDown(4);

    // Footer
    doc.font('Helvetica').fontSize(8).fillColor(C.mid)
       .text(`Generated ${today} · PlanItEarth · theplanitearth.com · This report is for informational purposes. Career outcomes depend on many individual and market factors.`, M.left, doc.y, { width: UW, align: 'center' });

    doc.end();
  });
}
