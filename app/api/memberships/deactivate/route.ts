import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  // Admin only
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const memberId = asString(body?.memberId);
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  // Ensure the membership belongs to this property
  const target = await prisma.propertyMembership.findFirst({
    where: { id: memberId, propertyId },
    select: { id: true, userId: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

  // Prevent admin locking themselves out (simple safety)
  if (target.userId === session.user.userId) {
    return NextResponse.json({ error: "You cannot remove your own access." }, { status: 400 });
  }
  // ####ADD CODE HERE#### (Prevent removing last active admin)
if (target.role === "PROPERTY_ADMIN") {
  const activeAdmins = await prisma.propertyMembership.count({
    where: { propertyId, role: "PROPERTY_ADMIN", isActive: true },
  });
  if (activeAdmins <= 1) {
    return NextResponse.json({ error: "You cannot remove the last admin for this property." }, { status: 400 });
  }
}
  await prisma.propertyMembership.update({
    where: { id: target.id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}