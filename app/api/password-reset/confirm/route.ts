import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/src/lib/prisma";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// PBKDF2 hash format used in your app:
// pbkdf2_sha256$120000$salt$hashhex
function hashPasswordPBKDF2(password: string) {
  const iterations = 120000;
  const salt = crypto.randomBytes(16).toString("hex");
  const hashHex = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hashHex}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const token = String(body?.token || "").trim();
  const password = String(body?.password || "");

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const tokenHash = sha256Hex(token);

  // Find a valid (unused, unexpired) token
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
    },
  });

  if (!reset) {
    return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
  }

  if (reset.usedAt) {
    return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });
  }

  if (reset.expiresAt <= new Date()) {
    return NextResponse.json({ error: "This reset link has expired" }, { status: 400 });
  }

  const newHash = hashPasswordPBKDF2(password);

  await prisma.$transaction([
  prisma.user.update({
    where: { id: reset.userId },
    data: { passwordHash: newHash },
  }),
  prisma.passwordResetToken.update({
    where: { id: reset.id },
    data: { usedAt: new Date() },
  }),
  prisma.passwordResetToken.updateMany({
    where: {
      userId: reset.userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
      NOT: { id: reset.id },
    },
    data: { usedAt: new Date() },
  }),
]);

  return NextResponse.json({ ok: true });
}
