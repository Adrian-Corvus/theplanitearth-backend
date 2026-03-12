// lib/sendEmail.js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBriefEmail({ to, name, pdfBuffer, optBuffer, profession, archetype, isBundle, isOptOnly }) {
  const firstName = name.split(' ')[0] || 'there';
  const today     = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:-apple-system,'Helvetica Neue',sans-serif;background:#F5F2EC;margin:0;padding:0}
    .wrap{max-width:580px;margin:0 auto;padding:40px 20px}
    .card{background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
    .hdr{background:#0D1F14;padding:40px 36px}
    .hdr .brand{font-size:12px;color:rgba(255,255,255,.5);letter-spacing:2px;margin-bottom:12px}
    .hdr h1{font-size:26px;color:white;margin:0 0 8px;font-weight:700;line-height:1.2}
    .hdr p{font-size:14px;color:rgba(255,255,255,.6);margin:0}
    .body{padding:36px}
    .arch-box{background:#F0F7F3;border-radius:12px;padding:18px 20px;margin:24px 0;border-left:4px solid #3D6B4F}
    .arch-label{font-size:10px;color:#3D6B4F;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px}
    .arch-name{font-size:18px;font-weight:700;color:#0D0F14}
    .items{margin:24px 0}
    .items h3{font-size:14px;font-weight:700;color:#0D0F14;margin-bottom:12px}
    .item{display:flex;gap:10px;margin-bottom:9px;font-size:14px;color:#4A4845}
    .chk{color:#3D6B4F;font-weight:700;flex-shrink:0}
    ${isBundle ? `.bundle-badge{background:#3D6B4F;color:white;border-radius:10px;padding:16px 20px;margin:24px 0;font-size:13px}
    .bundle-badge strong{display:block;font-size:15px;margin-bottom:4px}` : ''}
    .ftr{padding:22px 36px;border-top:1px solid #E8E4DC}
    .ftr p{font-size:12px;color:#8A8880;margin:3px 0;line-height:1.5}
    .ftr a{color:#3D6B4F;text-decoration:none}
  </style>
</head><body>
<div class="wrap"><div class="card">
  <div class="hdr">
    <div class="brand">THEPLANITEARTH.COM</div>
    <h1>Your ${isBundle ? 'Career Bundle' : 'Career Intelligence Brief'} ${isBundle ? 'is attached' : 'is ready'}.</h1>
    <p>${profession} · ${today}</p>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#4A4845;margin-bottom:16px">Hi ${firstName},</p>
    <p style="font-size:15px;color:#4A4845;line-height:1.6;margin-bottom:0">
      ${isBundle
        ? 'Your Career Intelligence Brief <strong>and</strong> Profile Optimisation Report are both attached — each built specifically around your role and experience.'
        : 'Your personalised Career Intelligence Brief is attached — built specifically for your profile, not a generic template.'}
    </p>

    <div class="arch-box">
      <div class="arch-label">Your Career Archetype</div>
      <div class="arch-name">${archetype.name}</div>
    </div>

    ${isBundle ? `<div class="bundle-badge">
      <strong>📋 Career Intelligence Brief</strong>
      Your full analysis — dashboard, task breakdown, horizon outlook, skill roadmap, and recommended AI tools.
    </div>
    <div class="bundle-badge" style="background:#1A3D28">
      <strong>✏️ Profile Optimisation Report</strong>
      LinkedIn headline rewrite, CV bullet transformation, ATS keywords, quick wins, and your AI-era positioning strategy.
    </div>` : ''}

    <div class="items">
      <h3>Your Career Brief includes:</h3>
      <div class="item"><span class="chk">✓</span>6-dimension career dashboard with your scores</div>
      <div class="item"><span class="chk">✓</span>Task-level breakdown — at risk vs AI-amplified</div>
      <div class="item"><span class="chk">✓</span>3 specific AI tools to learn for your role</div>
      <div class="item"><span class="chk">✓</span>1, 3 and 5-year horizon outlook</div>
      <div class="item"><span class="chk">✓</span>6-step prioritised skill roadmap</div>
    </div>

    <p style="font-size:14px;color:#4A4845;line-height:1.6">
      Questions about your results? Reply to this email and we'll get back to you.
    </p>
  </div>
  <div class="ftr">
    <p>© 2025 ThePlanItEarth · <a href="https://theplanitearth.com">theplanitearth.com</a></p>
    <p>You received this because you purchased a Career Intelligence Brief.</p>
  </div>
</div></div>
</body></html>`;

  const attachments = [];

  if (pdfBuffer) {
    attachments.push({
      filename:    `ThePlanItEarth_CareerBrief_${name.replace(/\s+/g,'_')}.pdf`,
      content:     pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
    });
  }

  if (optBuffer) {
    attachments.push({
      filename:    `ThePlanItEarth_ProfileOptimisation_${name.replace(/\s+/g,'_')}.pdf`,
      content:     optBuffer.toString('base64'),
      contentType: 'application/pdf',
    });
  }

  await resend.emails.send({
    from:    'ThePlanItEarth <briefs@theplanitearth.com>',
    to:      [to],
    subject: isOptOnly
      ? `${firstName}, your Profile Optimisation Report is ready`
      : isBundle
        ? `${firstName}, your Career Brief + Profile Optimisation Report are ready`
        : `${firstName}, your Career Intelligence Brief is ready`,
    html,
    attachments,
  });
}
