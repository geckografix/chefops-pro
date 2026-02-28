import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { InviteAuditAction, type Prisma } from "@prisma/client";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Same hashing approach as /api/register (PBKDF2, Node built-in)
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 120_000;
  const keylen = 32;
  const digest = "sha256";
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString("hex");
  return `pbkdf2_${digest}$${iterations}$${salt}$${hash}`;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const rawToken = String(form.get("token") || "").trim();
  const name = String(form.get("name") || "").trim();
  const password = String(form.get("password") || "");

  if (!rawToken || !name || !password) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (password.length < 8) {
    return NextResponse.redirect(
      new URL(`/invite/${encodeURIComponent(rawToken)}?error=weak_password`, req.url)
    );
  }

  const tokenHash = sha256Hex(rawToken);
  const now = new Date();

  const invite = await prisma.propertyInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      propertyId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!invite) {
    return NextResponse.redirect(new URL(`/invite/${encodeURIComponent(rawToken)}?error=invalid`, req.url));
  }

  if (invite.usedAt) {
    return NextResponse.redirect(new URL(`/invite/${encodeURIComponent(rawToken)}?error=used`, req.url));
  }

  if (invite.expiresAt.getTime() < now.getTime()) {
    return NextResponse.redirect(new URL(`/invite/${encodeURIComponent(rawToken)}?error=expired`, req.url));
  }

  const passwordHash = hashPassword(password);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create or update user by email
    const existingUser = await tx.user.findUnique({
      where: { email: invite.email },
      select: { id: true, name: true, email: true },
    });

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email: invite.email,
          name,
          passwordHash,
        },
        select: { id: true, name: true, email: true },
      }));

    // If the user already existed, we update their name (if blank) and set password to the new one from invite
    if (existingUser) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: user.name ? undefined : name,
          passwordHash,
        },
      });
    }

    // Upsert membership (unique by propertyId + userId)
    await tx.propertyMembership.upsert({
      where: { propertyId_userId: { propertyId: invite.propertyId, userId: user.id } },
      update: {
        isActive: true,
        role: invite.role,
      },
      create: {
        propertyId: invite.propertyId,
        userId: user.id,
        role: invite.role,
        isActive: true,
      },
    });

    // Mark invite as used
    await tx.propertyInvite.update({
      where: { id: invite.id },
      data: { usedAt: now },
    });

    // Audit: ACCEPTED
    await tx.inviteAudit.create({
      data: {
        propertyId: invite.propertyId,
        inviteId: invite.id,
        action: InviteAuditAction.ACCEPTED,
        actorUserId: user.id,
      },
    });

    return { user };
  });

  // Log them in and set active property
  const session = await getSession();
  session.user = {
    userId: result.user.id,
    email: result.user.email,
    activePropertyId: invite.propertyId,
  };
  await session.save();

  return NextResponse.redirect(new URL("/dashboard/rotas", req.url));
}
