import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import TeamLogBoard from "./TeamLogBoard";

export const dynamic = "force-dynamic";

function cutoff14DaysUTC() {
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - 13);
  return cutoff;
}

function serialize(items: any[]) {
  return items.map((i) => ({
    ...i,
    handoverDate: i.handoverDate?.toISOString?.() ?? null,
    createdAt: i.createdAt?.toISOString?.() ?? null,
    author: i.author ? { ...i.author } : null,
    reads: Array.isArray(i.reads)
  ? i.reads.map((r: any) => ({
      ...r,
      readAt: r.readAt?.toISOString?.() ?? null,
      reader: r.reader ? { ...r.reader } : null,
    }))
  : [],
  }));
}

export default async function TeamLogPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { id: true },
  });
  if (!membership) redirect("/login");

  const cutoff = cutoff14DaysUTC();

  const handovers = await prisma.teamHandover.findMany({
    where: { propertyId, handoverDate: { gte: cutoff } },
    orderBy: [{ handoverDate: "desc" }, { createdAt: "desc" }],
    include: {
  author: { select: { id: true, name: true, email: true } },
  reads: {
    orderBy: { readAt: "asc" },
    select: {
      id: true,
      readerId: true,
      readAt: true,
      reader: { select: { id: true, name: true, email: true } },
    },
  },
},
    take: 500,
  });

  return (
    <TeamLogBoard
      currentUserId={session.user.userId}
      handovers={serialize(handovers)}
    />
  );
}