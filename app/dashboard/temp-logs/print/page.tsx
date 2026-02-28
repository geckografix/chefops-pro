import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { redirect } from "next/navigation";
import PrintControls from "./PrintControls";

function utcDayStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}
function monthsAgoUtc(months: number, now = new Date()) {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtTime(d: Date) {
  return d.toISOString().slice(11, 16);
}

export default async function PrintTempLogsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (!membership) redirect("/dashboard");

  const now = new Date();
  const from = utcDayStart(monthsAgoUtc(3, now));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

  const logs = await prisma.foodTemperatureLog.findMany({
    where: { propertyId, loggedAt: { gte: from, lt: to } },
    orderBy: [{ logDate: "asc" }, { period: "asc" }, { loggedAt: "asc" }],
    select: {
      id: true,
      loggedAt: true,
      logDate: true,
      period: true,
      status: true,
      foodName: true,
      tempC: true,
      notes: true,
    },
  });
type LogRow = typeof logs[number];
  const grouped = new Map<string, LogRow[]>();
  for (const l of logs) {
    const key = fmtDate(l.logDate);
    const arr = grouped.get(key) ?? [];
    arr.push(l);
    grouped.set(key, arr);
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; vertical-align: top; }
        th { text-align: left; }
        h1, h2 { margin: 0 0 8px; }
        .meta { opacity: 0.75; margin-bottom: 16px; }
      `}</style>

      <PrintControls
  rangeLabel={`Range: ${fmtDate(from)} → ${fmtDate(new Date(to.getTime() - 1))}`}
/>

      <h1>Food Temp Logs (Last 3 Months)</h1>
      <div className="meta">
        Property: {propertyId} • Generated: {new Date().toISOString()}
      </div>

      {grouped.size === 0 ? (
        <div>No logs in the last 3 months.</div>
      ) : (
        Array.from(grouped.entries()).map(([day, dayLogs]) => (
          <div key={day} style={{ marginBottom: 18, pageBreakInside: "avoid" }}>
            <h2 style={{ marginTop: 18 }}>{day}</h2>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Time (UTC)</th>
                  <th style={{ width: 60 }}>Period</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th>Food</th>
                  <th style={{ width: 80 }}>Temp °C</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {dayLogs.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtTime(l.loggedAt)}</td>
                    <td>{l.period ?? ""}</td>
                    <td>{l.status}</td>
                    <td>{l.foodName}</td>
                    <td>{l.tempC === null ? "" : String(l.tempC)}</td>
                    <td>{l.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
