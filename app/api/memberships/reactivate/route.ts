import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

async function requireAdmin(propertyId: string, userId: string) {
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId, isActive: true },
    select: { role: true },
  });
  return membership?.role === "PROPERTY_ADMIN";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const isAdmin = await requireAdmin(propertyId, session.user.userId);
  if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const memberId = asString(body?.memberId);
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  const target = await prisma.propertyMembership.findFirst({
    where: { id: memberId, propertyId },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

  await prisma.propertyMembership.update({
    where: { id: target.id },
    data: { isActive: true },
  });

  return NextResponse.json({ ok: true });
}