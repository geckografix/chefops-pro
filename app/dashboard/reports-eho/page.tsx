import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import ReportsEHOBoard from "./ReportsEHOBoard";

export const dynamic = "force-dynamic";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function serializeDecimal(v: any) {
  return v == null ? null : v.toString?.() ?? String(v);
}

function iso(v: any) {
  return v ? (v.toISOString?.() ?? String(v)) : null;
}

export default async function ReportsEHOPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { id: true },
  });
  if (!membership) redirect("/login");

  const cutoff90 = daysAgo(90);
  const cutoff14 = daysAgo(14);

  // ===== Food Temperature Logs (3 months) =====
  const foodLogs = await prisma.foodTemperatureLog.findMany({
    where: { propertyId, loggedAt: { gte: cutoff90 } },
    orderBy: { loggedAt: "desc" },
    take: 5000,
  });

  const eventFoodLogs = await prisma.eventFoodTemperatureLog.findMany({
    where: { propertyId, loggedAt: { gte: cutoff90 } },
    orderBy: { loggedAt: "desc" },
    take: 5000,
  });

  // ===== Fridge Temperature Logs (3 months) =====
  const fridgeLogs = await prisma.temperatureLog.findMany({
    where: { propertyId, loggedAt: { gte: cutoff90 } },
    orderBy: { loggedAt: "desc" },
    take: 8000,
    include: {
      unit: { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  const propertyUsers = await prisma.propertyMembership.findMany({
  where: { propertyId, isActive: true },
  select: { user: { select: { id: true, name: true, email: true } } },
});

  // ===== Maintenance Logs (2 weeks) =====
  const maintenance = await prisma.maintenanceRequest.findMany({
    where: { propertyId, createdAt: { gte: cutoff14 } },
    orderBy: { createdAt: "desc" },
    take: 2000,
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

  // ---- serialize for client ----
  const safeFood = foodLogs.map((l: any) => ({
    id: l.id,
    loggedAt: iso(l.loggedAt),
    logDate: iso(l.logDate),
    period: l.period ?? null,
    status: l.status ?? null,
    foodName: l.foodName,
    tempC: serializeDecimal(l.tempC),
    notes: l.notes ?? null,
    eventId: l.eventId ?? null,
    createdByUserId: l.createdByUserId ?? null,
  }));

  const safeEventFood = eventFoodLogs.map((l: any) => ({
    id: l.id,
    eventName: l.eventName,
    eventDate: iso(l.eventDate),
    loggedAt: iso(l.loggedAt),
    logDate: iso(l.logDate),
    period: l.period ?? null,
    status: l.status ?? null,
    foodName: l.foodName,
    tempC: serializeDecimal(l.tempC),
    notes: l.notes ?? null,
    eventId: l.eventId ?? null,
    createdByUserId: l.createdByUserId ?? null,
  }));

  const safeFridge = fridgeLogs.map((l: any) => ({
    id: l.id,
    loggedAt: iso(l.loggedAt),
    period: l.period ?? null,
    status: l.status ?? null,
    valueC: serializeDecimal(l.valueC),
    notes: l.notes ?? null,
    unit: l.unit ? { ...l.unit } : null,
    createdBy: l.createdBy ? { ...l.createdBy } : null,
  }));

  const safeMaint = maintenance.map((m: any) => ({
    id: m.id,
    createdAt: iso(m.createdAt),
    urgency: m.urgency,
    title: m.title,
    details: m.details ?? null,
    location: m.location ?? null,
    equipment: m.equipment ?? null,
    reportedBy: m.reportedBy ? { ...m.reportedBy } : null,
    read: m.read
      ? { id: m.read.id, readAt: iso(m.read.readAt), admin: m.read.admin ? { ...m.read.admin } : null }
      : null,
    completed: m.completed
      ? {
          id: m.completed.id,
          completedAt: iso(m.completed.completedAt),
          admin: m.completed.admin ? { ...m.completed.admin } : null,
        }
      : null,
  }));

const safeUsers = propertyUsers.map((m: any) => ({
  id: m.user.id,
  name: m.user.name ?? null,
  email: m.user.email,
}));

  // ===== Blast Chilling Logs (subset of Food logs) =====
  const safeBlast = safeFood.filter((l: any) => {
    const n = (l.notes ?? "") as string;
    return n.includes("[BLAST_CHILL_START]") || n.includes("[BLAST_CHILL_END]");
  });



  return (
    <ReportsEHOBoard
      cutoff90ISO={cutoff90.toISOString()}
      cutoff14ISO={cutoff14.toISOString()}
      foodLogs={safeFood}
      blastChillLogs={safeBlast} 
      eventFoodLogs={safeEventFood}
      fridgeLogs={safeFridge}
      maintenanceLogs={safeMaint}
      users={safeUsers}
    />
  );
}