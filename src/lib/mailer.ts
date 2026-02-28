import nodemailer from "nodemailer";

type MailParams = {
  to: string;
  subject: string;
  text: string;
};

function getBaseUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export function getMailFrom() {
  return process.env.MAIL_FROM || "ChefOps Pro <no-reply@chefops.local>";
}

/**
 * If SMTP env vars are missing, we fall back to console output (dev-friendly).
 */
export async function sendMail({ to, subject, text }: MailParams) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  // Fallback: console mode
  if (!host || !port || !user || !pass) {
    console.log("\n📧 (DEV) Email not configured — printing email instead");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log(text);
    console.log("\nBase URL:", getBaseUrl(), "\n");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: getMailFrom(),
    to,
    subject,
    text,
  });
}
