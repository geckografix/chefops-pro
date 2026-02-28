import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

type AdminAuthOk = { ok: true; propertyId: string; userId: string };
type AdminAuthFail = { ok: false; res: NextResponse };

async function requireAdmin(): Promise<AdminAuthOk | AdminAuthFail> {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, res: NextResponse.json({ error: "Not logged in" }, { status: 401 }) };
  }

  const propertyId = session.user.activePropertyId;
  if (!propertyId) {
    return { ok: false, res: NextResponse.json({ error: "No active property" }, { status: 400 }) };
  }

  const membership = await prisma.propertyMembership.findFirst({
    where: {
      propertyId,
      userId: session.user.userId,
      isActive: true,
    },
    select: { role: true },
  });

  if (!membership) {
    return { ok: false, res: NextResponse.json({ error: "No access to this property" }, { status: 403 }) };
  }

  if (membership.role !== "PROPERTY_ADMIN") {
    return { ok: false, res: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }

  return { ok: true, propertyId, userId: session.user.userId };
}

/**
 * POST /api/procurement/requests/ordered
 * Body JSON:
 * { "id": "procurementRequestId" }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = asString(body.id).trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Ensure the request belongs to the active property
  const existing = await prisma.procurementRequest.findFirst({
    where: { id, propertyId: auth.propertyId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.procurementRequest.update({
    where: { id },
    data: {
      status: "ORDERED" as any, // keep as any to avoid enum friction if Prisma generated type differs
      decidedAt: new Date(),
      decidedById: auth.userId,

      // Clear any previous rejection info
      rejectedReason: null,
      rejectedNote: null,
    },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ item: updated });
}
