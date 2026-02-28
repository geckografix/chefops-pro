import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

/**
 * Procurement Requests API
 * - GET: list requests for the active property (staff + admin)
 * - POST: create a new request (staff + admin)
 *
 * Notes:
 * - Admin decision actions (ORDERED / REJECTED) will be separate endpoints.
 */

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function toDecimalOrNull(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return new Prisma.Decimal(v);
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return new Prisma.Decimal(n);
  }
  return null;
}

function toDateOrNull(v: unknown) {
  if (!v) return null;
  if (typeof v === "string" || v instanceof Date) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function requireActiveMember() {
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

  return { session, propertyId, role: membership.role } as const;
}

/**
 * GET /api/procurement/requests
 * Optional query params:
 * - category=FOOD|SUPPLIES
 * - status=REQUESTED|ORDERED|REJECTED|DELIVERED|CANCELED
 * - limit=number (default 100, max 200)
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const category = url.searchParams.get("category") || undefined;
  const status = url.searchParams.get("status") || undefined;

  const limitRaw = Number(url.searchParams.get("limit") || "100");
  const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

  const rows = await prisma.procurementRequest.findMany({
    where: {
      propertyId: auth.propertyId,
      ...(category ? { category: category as any } : {}),
      ...(status ? { status: status as any } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ items: rows });
}

/**
 * POST /api/procurement/requests
 * Body JSON:
 * {
 *   "category": "FOOD" | "SUPPLIES",
 *   "itemName": string,
 *   "quantity": number|string|null,
 *   "unit": string|null,
 *   "neededBy": string|null (ISO date),
 *   "notes": string|null
 * }
 */
export async function POST(req: Request) {
  const auth = await requireActiveMember();
  if ("error" in auth) return auth.error;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const itemName = asString(body.itemName).trim();
  if (!itemName) {
    return NextResponse.json({ error: "itemName is required" }, { status: 400 });
  }
  if (itemName.length > 120) {
    return NextResponse.json({ error: "itemName is too long (max 120 chars)" }, { status: 400 });
  }

  const category = (asString(body.category) || "FOOD").toUpperCase();
  if (category !== "FOOD" && category !== "SUPPLIES") {
    return NextResponse.json({ error: "category must be FOOD or SUPPLIES" }, { status: 400 });
  }

  const quantity = toDecimalOrNull(body.quantity);
  const unit = asString(body.unit).trim() || null;
  const neededBy = toDateOrNull(body.neededBy);
  const notes = asString(body.notes).trim() || null;

  const created = await prisma.procurementRequest.create({
    data: {
      propertyId: auth.propertyId,
      category: category as any,
      status: "REQUESTED",
      itemName,
      quantity,
      unit,
      neededBy,
      notes,
      requestedById: auth.session.user.userId,
    },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ item: created }, { status: 201 });
}

