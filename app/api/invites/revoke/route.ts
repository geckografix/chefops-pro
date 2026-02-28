import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { NextResponse } from "next/server";
import { InviteAuditAction } from "@prisma/client";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.redirect(new URL("/login", req.url));

  // Admin check
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard/rotas", req.url));
  }

  const form = await req.formData();
  const inviteId = String(form.get("inviteId") || "").trim();

  if (!inviteId) {
    return NextResponse.redirect(new URL("/dashboard/settings/invites?error=missing_inviteId", req.url));
  }

  const invite = await prisma.propertyInvite.findFirst({
    where: { id: inviteId, propertyId },
    select: { id: true },
  });

  if (!invite) {
    return NextResponse.redirect(new URL("/dashboard/settings/invites?error=invite_not_found", req.url));
  }

  const now = new Date();

  // ✅ Soft revoke: write audit + make invite unusable (expire + usedAt)
  await prisma.$transaction([
    prisma.inviteAudit.create({
      data: {
        propertyId,
        inviteId: invite.id,
        action: InviteAuditAction.REVOKED,
        actorUserId: session.user.userId,
        note: "Revoked by admin",
      },
    }),
    prisma.propertyInvite.update({
      where: { id: invite.id },
      data: {
        expiresAt: now,
        usedAt: now, // simple "revoked" marker so it can’t be accepted
      },
    }),
  ]);

  return NextResponse.redirect(new URL("/dashboard/settings/invites?revoked=1", req.url));
}