import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "No access to this property" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const handoverId = typeof body?.handoverId === "string" ? body.handoverId : "";
  if (!handoverId) return NextResponse.json({ error: "handoverId is required" }, { status: 400 });

  // Make sure the handover belongs to this property
  const h = await prisma.teamHandover.findFirst({
    where: { id: handoverId, propertyId },
    select: { id: true },
  });
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Create read record; unique constraint prevents duplicates
  try {
    await prisma.teamHandoverRead.create({
      data: {
        handoverId,
        readerId: session.user.userId,
      },
    });
  } catch {
    // Already read — treat as ok
  }

  return NextResponse.json({ ok: true });
}