import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { InviteAuditAction } from "@prisma/client";

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const inviteId = asString(body?.inviteId);
  if (!inviteId) return NextResponse.json({ error: "Missing inviteId" }, { status: 400 });

  const invite = await prisma.propertyInvite.findFirst({
    where: { id: inviteId, propertyId },
    select: { id: true, usedAt: true },
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  // already revoked/used
  if (invite.usedAt) return NextResponse.json({ ok: true, already: true });

  const now = new Date();

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
      data: { expiresAt: now, usedAt: now },
    }),
  ]);

  return NextResponse.json({ ok: true });
}