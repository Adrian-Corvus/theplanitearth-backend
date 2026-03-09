// lib/sendEmail.js
// Sends the Career Intelligence Brief PDF via Resend (free tier: 3,000 emails/month).
// Sign up at resend.com — free, no credit card needed.

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBriefEmail({ to, name, pdfBuffer, profession, archetype }) {
  const firstName = name.split(' ')[0] || 'there';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, 'Helvetica Neue', sans-serif; background: #F5F2EC; margin: 0; padding: 0; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: #3D6B4F; padding: 40px 36px; }
    .header .brand { font-size: 13px; color: rgba(255,255,255,0.6); letter-spacing: 2px; margin-bottom: 12px; }
    .header h1 { font-size: 28px; color: white; margin: 0 0 8px; font-weight: 700; line-height: 1.2; }
    .header p { font-size: 14px; color: rgba(255,255,255,0.75); margin: 0; }
    .body { padding: 36px; }
    .greeting { font-size: 16px; color: #0D0F14; margin-bottom: 16px; }
    .archetype-box { background: #F0F7F3; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #3D6B4F; }
    .archetype-box .label { font-size: 11px; color: #3D6B4F; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .archetype-box .name { font-size: 20px; font-weight: 700; color: #0D0F14; }
    .cta-btn { display: block; background: #3D6B4F; color: white; text-align: center; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 28px 0; }
    .what-inside { margin: 24px 0; }
    .what-inside h3 { font-size: 14px; font-weight: 700; color: #0D0F14; margin-bottom: 14px; }
    .inside-item { display: flex; gap: 10px; margin-bottom: 10px; font-size: 14px; color: #4A4845; }
    .inside-check { color: #3D6B4F; font-weight: 700; flex-shrink: 0; }
    .footer { padding: 24px 36px; border-top: 1px solid #E8E4DC; }
    .footer p { font-size: 12px; color: #8A8880; margin: 4px 0; line-height: 1.5; }
    .footer a { color: #3D6B4F; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">PLANITEARTH</div>
        <h1>Your Career Intelligence Brief is attached.</h1>
        <p>${profession} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div class="body">
        <p class="greeting">Hi ${firstName},</p>
        <p style="font-size:15px;color:#4A4845;line-height:1.6;margin-bottom:0">Your personalised Career Intelligence Brief is attached to this email as a PDF. It's built specifically for your profile — not a generic template.</p>

        <div class="archetype-box">
          <div class="label">Your Career Archetype</div>
          <div class="name">${archetype.emoji}  ${archetype.name}</div>
        </div>

        <div class="what-inside">
          <h3>What's inside your brief:</h3>
          <div class="inside-item"><span class="inside-check">✓</span>6-dimension career dashboard with your scores</div>
          <div class="inside-item"><span class="inside-check">✓</span>Task-level breakdown — what's at risk and what AI amplifies</div>
          <div class="inside-item"><span class="inside-check">✓</span>1, 3 and 5-year horizon outlook for your field</div>
          <div class="inside-item"><span class="inside-check">✓</span>6-step prioritised skill roadmap</div>
          <div class="inside-item"><span class="inside-check">✓</span>Data sources and methodology</div>
        </div>

        <p style="font-size:14px;color:#4A4845;line-height:1.6">If you have questions about your results, or want a more in-depth consultation, reply to this email and we'll be in touch.</p>
      </div>
      <div class="footer">
        <p>© 2025 PlanItEarth · <a href="https://theplanitearth.com">theplanitearth.com</a></p>
        <p>You received this because you purchased a Career Intelligence Brief. <a href="#">Unsubscribe</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from:    'PlanItEarth <briefs@theplanitearth.com>',
    to:      [to],
    subject: `${firstName}, your Career Intelligence Brief is ready`,
    html,
    attachments: [{
      filename:   `PlanItEarth_CareerBrief_${name.replace(/\s+/g, '_')}.pdf`,
      content:    pdfBuffer.toString('base64'),
      contentType:'application/pdf',
    }],
  });
}
