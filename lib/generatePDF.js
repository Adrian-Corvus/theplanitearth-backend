// lib/generatePDF.js
// Generates a personalised Career Intelligence Brief PDF using PDFKit.
// v2 — fixes: emoji rendering, page overflow, logo, generic text, Claude API call

import PDFDocument from 'pdfkit';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── COLOURS ──
const C = {
  ink:    '#0D0F14',
  sage:   '#3D6B4F',
  amber:  '#D4841A',
  red:    '#C0392B',
  purple: '#7B5EA7',
  teal:   '#1A7A9D',
  mid:    '#8A8880',
  light:  '#F5F2EC',
  mist:   '#E8E4DC',
  white:  '#FFFFFF',
  bg2:    '#FAFAF8',
};

function hex(h) {
  const r = parseInt(h.slice(1,3),16);
  const g = parseInt(h.slice(3,5),16);
  const b = parseInt(h.slice(5,7),16);
  return [r,g,b];
}

// ── AI NARRATIVE GENERATION ──
async function generateNarratives(data) {
  const { name, profession, archetype, answers, scores } = data;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are writing a personalised Career Intelligence Brief for ${name}, who works as: ${profession}.

Their career archetype is: ${archetype.name}
Their analysis scores (0-100):
- Automation Exposure: ${Math.round(scores.automation || 55)}
- Augmentation Potential: ${Math.round(scores.augmentation || 70)}  
- Income Protection: ${Math.round(scores.income || 60)}
- Regulatory Protection: ${Math.round(scores.regulatory || 55)}
- Skill Evolution Pressure: ${Math.round(scores.skill_pressure || 65)}
- AI Adoption in their field: ${Math.round(scores.ai_adoption || 55)}

Their quiz answers:
- Profession category: ${answers.profession_cat || 'unknown'}
- Specific job title: ${answers.job_title || profession}
- Experience level: ${answers.experience || 'mid'}
- Primary work type: ${answers.tasks || 'judgment'}
- Current AI exposure: ${answers.ai_exposure || 'aware'}
- Team size: ${answers.team_size || 'unknown'}
- Industry sector: ${answers.industry || 'unknown'}
- Education level: ${answers.education || 'unknown'}
- Remote/office: ${answers.work_location || 'unknown'}
- Primary concern: ${answers.concern || 'growth'}

Write sections that are SPECIFIC to this person's actual job title and situation. Do NOT be generic.
Reference their specific profession, sector, and tasks directly.
Be probabilistic and nuanced — avoid both panic and dismissiveness.
Tone: calm expert advisor. Like a trusted mentor who has studied this field deeply.

Return ONLY valid JSON, no markdown backticks:

{
  "executive_summary": "3 specific sentences about THIS person's situation. Name their job. Name what's actually happening in their field right now.",
  "archetype_explanation": "2-3 sentences explaining WHY they got this archetype based on their specific scores and profession.",
  "tasks_at_risk_insight": "2 sentences on the pattern in their at-risk tasks, specific to their profession.",
  "tasks_augmented_insight": "2 sentences on their specific opportunities — what AI amplifies in their actual work.",
  "horizon_1yr": "1 specific sentence about their profession in the next 12 months.",
  "horizon_3yr": "1 specific sentence about their profession by 2028.",
  "horizon_5yr": "1 specific sentence about their profession by 2030.",
  "skill_step_1": "Specific skill for this exact profession (max 12 words)",
  "skill_step_2": "Second specific skill (max 12 words)",
  "skill_step_3": "Third specific skill (max 12 words)",
  "skill_step_4": "Fourth specific skill (max 12 words)",
  "skill_step_5": "Fifth specific skill (max 12 words)",
  "skill_step_6": "Sixth specific skill (max 12 words)",
  "income_insight": "1 sentence on income trajectory for this specific profession.",
  "closing_advice": "2 sentences. Specific, actionable, forward-looking. Reference their actual profession."
}`;

  try {
    console.log('Calling Claude API for:', name, profession);
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    console.log('Claude response received, length:', text.length);
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.error('Claude API error:', err.message, err.status);
    throw err; // Don't silently swallow — surface the error
  }
}

// ── TASK DATA per sector ──
function getTaskData(sector, jobTitle) {
  const tasks = {
    healthcare:  {
      risk: ['Routine diagnostic image screening', 'Clinical documentation drafting', 'Standard referral letters', 'Protocol-based triage decisions'],
      augmented: ['Complex case diagnosis & second opinions', 'Patient communication & empathy', 'Interdisciplinary care coordination', 'Rare disease pattern recognition']
    },
    finance: {
      risk: ['Rule-based data reconciliation', 'Standard report generation', 'Basic portfolio rebalancing', 'Compliance checklist reviews'],
      augmented: ['Complex deal structuring & negotiation', 'Client relationship management', 'Strategic financial planning', 'Novel regulatory interpretation']
    },
    tech: {
      risk: ['Boilerplate & CRUD code generation', 'Standard QA test script writing', 'Basic API documentation', 'Routine bug fixes & hotfixes'],
      augmented: ['System & architecture design', 'Complex performance optimisation', 'Stakeholder requirement translation', 'Technical leadership & mentoring']
    },
    legal: {
      risk: ['Contract template review & redlining', 'Legal research & citation lookup', 'Standard clause drafting', 'Discovery document review'],
      augmented: ['Courtroom advocacy & oral argument', 'Complex multi-party negotiation', 'Novel legal interpretation & strategy', 'Client trust & long-term counsel']
    },
    creative: {
      risk: ['First-draft copywriting from briefs', 'Template-based design variations', 'Stock asset selection & curation', 'Basic social media caption writing'],
      augmented: ['Brand strategy & creative direction', 'Original concept & campaign development', 'Client relationship & creative briefs', 'Cultural insight & audience strategy']
    },
    education: {
      risk: ['Standard lecture-style content delivery', 'Routine assessment marking', 'Generic lesson plan creation', 'Administrative progress reporting'],
      augmented: ['Personalised student mentoring & coaching', 'Adaptive & differentiated curriculum design', 'Complex pastoral & student welfare support', 'Critical thinking & Socratic facilitation']
    },
    other: {
      risk: ['Repetitive administrative processing', 'Standard data entry & reporting', 'Template-based document generation', 'Rule-based decision workflows'],
      augmented: ['Strategic judgment & decision-making', 'Stakeholder relationships & trust', 'Creative and novel problem-solving', 'Complex contextual & ethical reasoning']
    },
  };
  return tasks[sector] || tasks.other;
}

// ── PDF LAYOUT HELPERS ──
function drawBar(doc, x, y, width, value, color) {
  doc.roundedRect(x, y, width, 9, 4).fill(hex(C.mist));
  if (value > 0) {
    const fillW = Math.max(9, (value / 100) * width);
    doc.roundedRect(x, y, fillW, 9, 4).fill(hex(color));
  }
}

function sectionBanner(doc, title, M, UW, color = C.ink) {
  doc.rect(M.left, doc.y, UW, 26).fill(hex(color));
  const ty = doc.y + 7;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(hex(C.white))
     .text(title.toUpperCase(), M.left + 12, ty, { width: UW - 24, characterSpacing: 0.8 });
  doc.y += 28;
}

function checkPageBreak(doc, neededSpace, M) {
  if (doc.y + neededSpace > 800) {
    doc.addPage();
    doc.y = M.top;
  }
}

function pageHeader(doc, name, profession, pageNum, M, UW) {
  const shortName = name.length > 20 ? name.split(' ')[0] : name;
  const shortProf = profession.length > 30 ? profession.slice(0, 28) + '…' : profession;
  doc.font('Helvetica').fontSize(7.5).fillColor(hex(C.mid))
     .text(`THEPLANITEARTH.COM  ·  CAREER INTELLIGENCE BRIEF  ·  ${shortName.toUpperCase()}`, M.left, 16, { width: UW, align: 'left' })
     .text(`${shortProf.toUpperCase()}  ·  PAGE ${pageNum}`, M.left, 16, { width: UW, align: 'right' });
  doc.moveTo(M.left, 27).lineTo(M.left + UW, 27).strokeColor(hex(C.mist)).lineWidth(0.5).stroke();
}

// ── MAIN EXPORT ──
export async function generatePDF(data) {
  const { name, profession, archetype, answers, scores } = data;

  // Generate AI narratives — throw if fails so error surfaces
  const narratives = await generateNarratives(data);
  const taskData   = getTaskData(answers.profession_cat || 'other', profession);
  const today      = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title:   `Career Intelligence Brief — ${name}`,
        Author:  'ThePlanItEarth',
        Subject: `AI Career Analysis — ${profession}`,
      },
      autoFirstPage: true,
    });

    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = 595;
    const M  = { left: 40, right: 40, top: 40, bottom: 40 };
    const UW = PW - M.left - M.right; // 515

    // ══════════════════════════════════════════
    // PAGE 1 — COVER
    // ══════════════════════════════════════════
    // Full dark background
    doc.rect(0, 0, PW, 842).fill(hex(C.ink));

    // Try to embed logo (white version)
    try {
      const logoPath = join(__dirname, '..', 'assets', 'logo-white.png');
      const logoData = readFileSync(logoPath);
      doc.image(logoData, M.left, 36, { width: 100 });
    } catch(e) {
      // Logo not found — use text fallback
      doc.font('Helvetica-Bold').fontSize(13).fillColor(hex(C.white))
         .text('THEPLANITEARTH.COM', M.left, 40, { characterSpacing: 2 });
    }

    // Cover title
    doc.font('Helvetica-Bold').fontSize(48).fillColor(hex(C.white))
       .text('Career', M.left, 130)
       .text('Intelligence', M.left, 182)
       .text('Brief', M.left, 234);

    // Accent line
    doc.rect(M.left, 296, 60, 3).fill(hex(C.sage));

    // Name + profession
    doc.font('Helvetica').fontSize(16).fillColor(hex(C.sage))
       .text(`Prepared for ${name}`, M.left, 310);
    doc.font('Helvetica').fontSize(13).fillColor('rgba(245,242,236,0.65)')
       .text(profession, M.left, 332);
    doc.font('Helvetica').fontSize(11).fillColor('rgba(245,242,236,0.4)')
       .text(today, M.left, 352);

    // Archetype box
    const boxY = 400;
    doc.roundedRect(M.left, boxY, UW, 110, 12)
       .fill([255,255,255,0.06]);
    doc.roundedRect(M.left, boxY, UW, 110, 12)
       .stroke([255,255,255,0.12]);

    doc.font('Helvetica-Bold').fontSize(9).fillColor(hex(C.sage))
       .text('YOUR CAREER ARCHETYPE', M.left + 20, boxY + 18, { characterSpacing: 1.5 });

    // Archetype name (no emoji — PDFKit can't render them)
    doc.font('Helvetica-Bold').fontSize(24).fillColor(hex(C.white))
       .text(archetype.name, M.left + 20, boxY + 36);

    doc.font('Helvetica').fontSize(11).fillColor('rgba(245,242,236,0.7)')
       .text(narratives.archetype_explanation, M.left + 20, boxY + 66, { width: UW - 40, lineGap: 3 });

    // Score strip at bottom of cover
    const metrics = [
      { label: 'Automation Risk',    val: scores.automation    || 55, color: C.red    },
      { label: 'Augmentation',       val: scores.augmentation  || 70, color: C.sage   },
      { label: 'Income Protection',  val: scores.income        || 60, color: C.amber  },
      { label: 'Skill Pressure',     val: scores.skill_pressure|| 65, color: C.purple },
    ];
    const stripY = 560;
    const colW   = UW / 4;
    metrics.forEach((m, i) => {
      const x = M.left + i * colW;
      doc.font('Helvetica-Bold').fontSize(22).fillColor(hex(m.color))
         .text(`${Math.round(m.val)}`, x, stripY, { width: colW, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('rgba(245,242,236,0.5)')
         .text(m.label, x, stripY + 28, { width: colW, align: 'center' });
    });

    // Cover footer
    doc.font('Helvetica').fontSize(8).fillColor('rgba(245,242,236,0.25)')
       .text('theplanitearth.com  ·  Data: WEF · McKinsey · O*NET · BLS · Brookings', M.left, 790, { width: UW, align: 'center' });

    // ══════════════════════════════════════════
    // PAGE 2 — EXECUTIVE SUMMARY + DASHBOARD
    // ══════════════════════════════════════════
    doc.addPage();
    pageHeader(doc, name, profession, 2, M, UW);
    doc.y = 44;

    // Executive summary
    doc.font('Helvetica-Bold').fontSize(19).fillColor(hex(C.ink))
       .text('Executive Summary', M.left, doc.y);
    doc.moveDown(0.5);

    doc.roundedRect(M.left, doc.y, UW, 2, 1).fill(hex(C.sage));
    doc.moveDown(0.4);

    doc.font('Helvetica').fontSize(11.5).fillColor('#3A3835').lineGap(5)
       .text(narratives.executive_summary, M.left, doc.y, { width: UW });
    doc.moveDown(1.2);

    // Income insight callout
    checkPageBreak(doc, 50, M);
    doc.roundedRect(M.left, doc.y, UW, 38, 8).fill(hex('#EEF5F1'));
    doc.font('Helvetica-Bold').fontSize(9).fillColor(hex(C.sage))
       .text('INCOME OUTLOOK', M.left + 14, doc.y + 8, { characterSpacing: 1 });
    doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.ink))
       .text(narratives.income_insight, M.left + 14, doc.y + 20, { width: UW - 28 });
    doc.y += 46;
    doc.moveDown(0.8);

    // Dashboard header
    checkPageBreak(doc, 30, M);
    sectionBanner(doc, 'Your 6-Dimension Career Dashboard', M, UW);

    const metricDefs = [
      { label: 'Automation Exposure',      key: 'automation',     color: C.red,    note: 'How much of your work AI tools can currently replicate or automate' },
      { label: 'Augmentation Potential',   key: 'augmentation',   color: C.sage,   note: 'How much AI could multiply your productivity and output quality' },
      { label: 'Income Protection',        key: 'income',         color: C.amber,  note: 'Structural resilience of your earnings over the next 5 years' },
      { label: 'Regulatory Protection',    key: 'regulatory',     color: C.purple, note: 'Licensing and legal barriers protecting your role' },
      { label: 'Skill Evolution Pressure', key: 'skill_pressure', color: C.teal,   note: 'Urgency to develop new capabilities to stay competitive' },
      { label: 'AI Adoption in Your Field',key: 'ai_adoption',    color: '#1A7A9D',note: 'Current penetration of AI tools across your sector' },
    ];

    metricDefs.forEach((m, i) => {
      checkPageBreak(doc, 58, M);
      const bg = i % 2 === 0 ? C.bg2 : C.white;
      const rowH = 56;
      doc.rect(M.left, doc.y, UW, rowH).fill(hex(bg));

      const val = Math.round(scores[m.key] || 50);
      const iy  = doc.y;

      // Label
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(hex(C.ink))
         .text(m.label, M.left + 12, iy + 8, { width: UW - 100 });
      // Score
      doc.font('Helvetica-Bold').fontSize(15).fillColor(hex(m.color))
         .text(`${val}`, M.left + UW - 70, iy + 6, { width: 50, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor(hex(C.mid))
         .text('/100', M.left + UW - 22, iy + 11, { width: 20 });
      // Bar
      drawBar(doc, M.left + 12, iy + 27, UW - 80, val, m.color);
      // Note
      doc.font('Helvetica').fontSize(8.5).fillColor(hex(C.mid))
         .text(m.note, M.left + 12, iy + 40, { width: UW - 24 });

      doc.y = iy + rowH + 2;
    });

    // ══════════════════════════════════════════
    // PAGE 3 — TASK ANALYSIS + HORIZON
    // ══════════════════════════════════════════
    doc.addPage();
    pageHeader(doc, name, profession, 3, M, UW);
    doc.y = 44;

    // Task analysis title
    doc.font('Helvetica-Bold').fontSize(19).fillColor(hex(C.ink))
       .text('Task-Level Analysis', M.left, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.mid))
       .text(narratives.tasks_at_risk_insight, M.left, doc.y, { width: UW, lineGap: 3 });
    doc.moveDown(1);

    // Two columns
    const tColW = (UW - 14) / 2;

    // Risk header
    const thY = doc.y;
    doc.rect(M.left, thY, tColW, 24).fill(hex(C.red));
    doc.font('Helvetica-Bold').fontSize(9).fillColor(hex(C.white))
       .text('TASKS UNDER PRESSURE', M.left + 10, thY + 8, { characterSpacing: 0.5 });

    // Augmented header
    doc.rect(M.left + tColW + 14, thY, tColW, 24).fill(hex(C.sage));
    doc.font('Helvetica-Bold').fontSize(9).fillColor(hex(C.white))
       .text('AI WILL AMPLIFY', M.left + tColW + 24, thY + 8, { characterSpacing: 0.5 });

    doc.y = thY + 26;

    taskData.risk.forEach((task, i) => {
      checkPageBreak(doc, 32, M);
      const rowY = doc.y;
      const rowBg = i % 2 === 0 ? '#FDF4F3' : C.white;
      const augBg = i % 2 === 0 ? '#F2F7F4' : C.white;

      doc.rect(M.left, rowY, tColW, 30).fill(hex(rowBg));
      doc.font('Helvetica').fontSize(9.5).fillColor(hex(C.ink))
         .text(task, M.left + 10, rowY + 9, { width: tColW - 18 });

      doc.rect(M.left + tColW + 14, rowY, tColW, 30).fill(hex(augBg));
      doc.font('Helvetica').fontSize(9.5).fillColor(hex(C.ink))
         .text(taskData.augmented[i] || '', M.left + tColW + 22, rowY + 9, { width: tColW - 18 });

      doc.y = rowY + 32;
    });

    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(10).fillColor(hex(C.mid)).lineGap(3)
       .text(narratives.tasks_augmented_insight, M.left, doc.y, { width: UW });
    doc.moveDown(1.5);

    // Horizon outlook — each row on same page
    checkPageBreak(doc, 180, M);
    sectionBanner(doc, 'Horizon Outlook', M, UW);

    const horizons = [
      { label: '12 Months', sub: 'Near-term',  text: narratives.horizon_1yr,  color: C.sage   },
      { label: '3 Years',   sub: 'Medium-term', text: narratives.horizon_3yr,  color: C.amber  },
      { label: '5 Years',   sub: 'Long-term',   text: narratives.horizon_5yr,  color: C.purple },
    ];

    horizons.forEach((h, i) => {
      checkPageBreak(doc, 60, M);
      const hY  = doc.y;
      const hBg = i % 2 === 0 ? C.bg2 : C.white;
      doc.rect(M.left, hY, UW, 52).fill(hex(hBg));
      doc.rect(M.left, hY, 4, 52).fill(hex(h.color));

      doc.font('Helvetica-Bold').fontSize(11).fillColor(hex(h.color))
         .text(h.label, M.left + 14, hY + 8);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(hex(C.mid))
         .text(h.sub.toUpperCase(), M.left + 14, hY + 22, { characterSpacing: 0.8 });
      doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.ink))
         .text(h.text, M.left + 14, hY + 34, { width: UW - 28 });

      doc.y = hY + 54;
    });

    // ══════════════════════════════════════════
    // PAGE 4 — SKILL ROADMAP + CLOSING
    // ══════════════════════════════════════════
    doc.addPage();
    pageHeader(doc, name, profession, 4, M, UW);
    doc.y = 44;

    doc.font('Helvetica-Bold').fontSize(19).fillColor(hex(C.ink))
       .text('Your Prioritised Skill Roadmap', M.left, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10.5).fillColor(hex(C.mid))
       .text('Ordered by urgency and impact. Prioritise steps 1–3 in the next 90 days.', M.left, doc.y, { width: UW });
    doc.moveDown(1);

    const steps = [
      narratives.skill_step_1, narratives.skill_step_2,
      narratives.skill_step_3, narratives.skill_step_4,
      narratives.skill_step_5, narratives.skill_step_6,
    ];
    const stepColors = [C.sage, C.sage, C.amber, C.amber, C.teal, C.teal];
    const stepLabels = ['Priority', 'Priority', 'Important', 'Important', 'Develop', 'Develop'];

    steps.forEach((step, i) => {
      checkPageBreak(doc, 52, M);
      const sY  = doc.y;
      const sBg = i % 2 === 0 ? C.bg2 : C.white;
      doc.rect(M.left, sY, UW, 46).fill(hex(sBg));

      // Number bubble
      doc.circle(M.left + 22, sY + 23, 16).fill(hex(stepColors[i]));
      doc.font('Helvetica-Bold').fontSize(13).fillColor(hex(C.white))
         .text(`${i+1}`, M.left + (i >= 9 ? 16 : 18), sY + 16);

      // Tag
      doc.roundedRect(M.left + 46, sY + 8, 58, 14, 7).fill(hex(stepColors[i] + '22'));
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(hex(stepColors[i]))
         .text(stepLabels[i].toUpperCase(), M.left + 52, sY + 11, { characterSpacing: 0.5 });

      // Step text
      doc.font('Helvetica').fontSize(11).fillColor(hex(C.ink))
         .text(step, M.left + 46, sY + 26, { width: UW - 56 });

      doc.y = sY + 48;
    });

    doc.moveDown(1.2);

    // Final word
    checkPageBreak(doc, 100, M);
    doc.rect(M.left, doc.y, UW, 4).fill(hex(C.sage));
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(hex(C.ink))
       .text('Final Word', M.left, doc.y);
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11.5).fillColor('#3A3835').lineGap(5)
       .text(narratives.closing_advice, M.left, doc.y, { width: UW });
    doc.moveDown(1.5);

    // Sources
    checkPageBreak(doc, 80, M);
    doc.roundedRect(M.left, doc.y, UW, 68, 8).fill(hex(C.light));
    const srcY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(hex(C.mid))
       .text('DATA SOURCES', M.left + 14, srcY + 10, { characterSpacing: 1.2 });
    doc.font('Helvetica').fontSize(8).fillColor(hex(C.mid)).lineGap(3)
       .text(
         'World Economic Forum — Future of Jobs Report 2023  ·  McKinsey Global Institute — AI and the Future of Work  ·  ' +
         "O*NET Online (US Dept. of Labor)  ·  Bureau of Labor Statistics Occupational Outlook  ·  " +
         "Brookings Institution — Automation & AI  ·  Goldman Sachs Global Investment Research  ·  Pew Research Center",
         M.left + 14, srcY + 24, { width: UW - 28 }
       );
    doc.y = srcY + 70;

    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(8).fillColor(hex(C.mid))
       .text(
         `Generated ${today}  ·  theplanitearth.com  ·  For informational purposes only. Career outcomes depend on many individual and market factors.`,
         M.left, doc.y, { width: UW, align: 'center' }
       );

    doc.end();
  });
}
