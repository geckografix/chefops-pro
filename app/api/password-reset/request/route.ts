import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/src/lib/prisma";
import { sendMail } from "@/src/lib/mailer";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email || "").trim().toLowerCase();

  // Always respond 200 to avoid leaking which emails exist
  if (!email) return NextResponse.json({ ok: true });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ ok: true });
  }

// Cooldown: avoid creating endless reset tokens if someone spams the endpoint
const cooldownSeconds = 120;

const recent = await prisma.passwordResetToken.findFirst({
  where: {
    userId: user.id,
    createdAt: { gt: new Date(Date.now() - cooldownSeconds * 1000) },
  },
  select: { id: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});

if (recent) {
  console.log("\n🕒 Password reset requested too soon for", user.email);
  console.log("Skipping new token (cooldown active)\n");
  return NextResponse.json({ ok: true });
}


  // Create a raw token (only shown once) + store hashed token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawToken);

  // 60 minutes expiry (tweak later)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 60);

  // Optional: invalidate any previous unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password/${rawToken}`;

try {
  await sendMail({
    to: user.email,
    subject: "ChefOps Pro — Password reset",
    text: `A password reset was requested for your ChefOps Pro account.

Reset your password using this link (valid for 60 minutes):
${resetLink}

If you didn't request this, you can ignore this email.`,
  });
} catch (err) {
  console.log("\n⚠️ Password reset email failed to send for", user.email);
  console.log(err);
  console.log("Reset link (use manually):", resetLink, "\n");
}


  return NextResponse.json({ ok: true });
}
