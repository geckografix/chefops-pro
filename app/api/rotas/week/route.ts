import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers"; // use your existing helper

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start"); // YYYY-MM-DD
  if (!start) return NextResponse.json({ error: "Missing start" }, { status: 400 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  const weekStart = new Date(`${start}T00:00:00.000Z`);

  const week = await prisma.rotaWeek.findUnique({
    where: { propertyId_weekStart: { propertyId, weekStart } },
    include: {
      shifts: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ dayIndex: "asc" }, { startTime: "asc" }],
      },
    },
  });

  return NextResponse.json({ week });
}
