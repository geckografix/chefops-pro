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

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "No access to this property" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const title = asString(body?.title).trim();
  const details = asString(body?.details).trim();
  const location = asString(body?.location).trim();
  const equipment = asString(body?.equipment).trim();
  const urgencyRaw = asString(body?.urgency).trim(); // "H24" | "H48" | "WEEK"

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const urgency =
    urgencyRaw === "H24" || urgencyRaw === "H48" || urgencyRaw === "WEEK" ? urgencyRaw : "WEEK";

  const created = await prisma.maintenanceRequest.create({
    data: {
      propertyId,
      reportedById: session.user.userId,
      title,
      details: details || null,
      location: location || null,
      equipment: equipment || null,
      urgency,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}