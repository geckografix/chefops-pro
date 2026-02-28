import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

const ALLOWED_REASONS = new Set([
  "MENU_CHANGE",
  "OUT_OF_SEASON",
  "SUPPLIER_OUT_OF_STOCK",
  "ALREADY_IN_STOCK",
  "BUDGET_COST_CONTROL",
  "NOT_APPROVED",
  "OTHER",
]);

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Not logged in" }, { status: 401 }) as const };
  }

  const propertyId = session.user.activePropertyId;
  if (!propertyId) {
    return { error: NextResponse.json({ error: "No active property" }, { status: 400 }) as const };
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
    return { error: NextResponse.json({ error: "No access to this property" }, { status: 403 }) as const };
  }

  if (membership.role !== "PROPERTY_ADMIN") {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) as const };
  }

  return { session, propertyId } as const;
}

/**
 * POST /api/procurement/requests/rejected
 * Body JSON:
 * {
 *   "id": "procurementRequestId",
 *   "rejectedReason": "MENU_CHANGE" | "OUT_OF_SEASON" | "SUPPLIER_OUT_OF_STOCK" | "ALREADY_IN_STOCK" |
 *                     "BUDGET_COST_CONTROL" | "NOT_APPROVED" | "OTHER",
 *   "rejectedNote": "optional text"
 * }
 *
 * Marks a request as REJECTED (admin-only) and records who/when.
 * If rejectedReason = OTHER, rejectedNote is required.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = asString(body.id).trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const rejectedReason = asString(body.rejectedReason).trim().toUpperCase();
  if (!rejectedReason || !ALLOWED_REASONS.has(rejectedReason)) {
    return NextResponse.json(
      { error: "rejectedReason is required and must be a valid reason" },
      { status: 400 }
    );
  }

  const rejectedNote = asString(body.rejectedNote).trim() || null;
  if (rejectedReason === "OTHER" && !rejectedNote) {
    return NextResponse.json(
      { error: "rejectedNote is required when rejectedReason is OTHER" },
      { status: 400 }
    );
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
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: auth.session.user.userId,
      rejectedReason,
      rejectedNote,

      // If previously ordered/delivered, clear delivery close-out
      deliveredAt: null,
    },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ item: updated });
}
