import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/session-helpers";
import { getPropertySettings } from "@/src/property-settings";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const propertyId = session.user.activePropertyId;
  if (!propertyId) {
    return NextResponse.json({ error: "No active property" }, { status: 400 });
  }

  // Must be an active member (admin OR user)
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "No access to this property" }, { status: 403 });
  }

    const settings = await getPropertySettings(propertyId);

  return NextResponse.json({ settings });

}