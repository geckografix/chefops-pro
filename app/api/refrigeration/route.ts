import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.activePropertyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const units = await prisma.refrigerationUnit.findMany({
    where: { propertyId: session.user.activePropertyId, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ units });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.activePropertyId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const type = body?.type === "FREEZER" ? "FREEZER" : "FRIDGE";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const unit = await prisma.refrigerationUnit.create({
      data: {
        propertyId: session.user.activePropertyId,
        name,
        type,
      },
    });

    return NextResponse.json({ unit });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Could not create unit (name may already exist)" },
      { status: 400 }
    );
  }
}
