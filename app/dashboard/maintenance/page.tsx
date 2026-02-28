import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import MaintenanceBoard from "./MaintenanceBoard";

export const dynamic = "force-dynamic";

type Person = { id: string; name: string | null; email: string };

function serializeRequests(items: any[]) {
  return items.map((i) => ({
    ...i,
    createdAt: i.createdAt ? i.createdAt.toISOString() : null,
    reportedBy: i.reportedBy ? { ...i.reportedBy } : null,
    read: i.read
      ? {
          ...i.read,
          readAt: i.read.readAt ? i.read.readAt.toISOString() : null,
          admin: i.read.admin ? { ...i.read.admin } : null,
        }
      : null,
    completed: i.completed
      ? {
          ...i.completed,
          completedAt: i.completed.completedAt ? i.completed.completedAt.toISOString() : null,
          admin: i.completed.admin ? { ...i.completed.admin } : null,
        }
      : null,
  }));
}

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (!membership) redirect("/login");

  const isAdmin = membership.role === "PROPERTY_ADMIN";

  const requests = await prisma.maintenanceRequest.findMany({
    where: { propertyId },
    orderBy: [
      { createdAt: "desc" },
    ],
    take: 300,
    include: {
      reportedBy: { select: { id: true, name: true, email: true } },
      read: {
        select: {
          id: true,
          readAt: true,
          admin: { select: { id: true, name: true, email: true } },
        },
      },
      completed: {
        select: {
          id: true,
          completedAt: true,
          admin: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const safe = serializeRequests(requests);

  return (
    <MaintenanceBoard
      isAdmin={isAdmin}
      requests={safe}
    />
  );
}