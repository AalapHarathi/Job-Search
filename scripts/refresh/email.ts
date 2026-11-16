// Optional email digest. Enabled only when SMTP_URL and NOTIFY_EMAIL secrets exist.
// SMTP_URL example (Gmail app password): smtps://you%40gmail.com:app-password@smtp.gmail.com:465
import nodemailer from 'nodemailer';

export async function sendDigest(items: { title: string; body: string }[], dashboardUrl: string | null) {
  const url = process.env.SMTP_URL;
  const to = process.env.NOTIFY_EMAIL;
  if (!url || !to || !items.length) return;
  const transport = nodemailer.createTransport(url);
  const lines = items.map((i) => `• ${i.title}\n  ${i.body}`).join('\n\n');
  await transport.sendMail({
    from: process.env.SMTP_FROM || to,
    to,
    subject: `Career Intel: ${items.length} update${items.length > 1 ? 's' : ''}`,
    text: `${lines}\n\n${dashboardUrl ? `Open your dashboard: ${dashboardUrl}` : ''}`,
  });
}
