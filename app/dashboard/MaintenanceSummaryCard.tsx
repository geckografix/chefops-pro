import Link from "next/link";
import { prisma } from "@/src/lib/prisma";

export default async function MaintenanceSummaryCard({ propertyId }: { propertyId: string }) {
  const [unreadCount, readCount] = await Promise.all([
    prisma.maintenanceRequest.count({
      where: {
        propertyId,
        completed: null,
        read: null,
      },
    }),
    prisma.maintenanceRequest.count({
      where: {
        propertyId,
        completed: null,
        read: { isNot: null },
      },
    }),
  ]);

  return (
    <Link
      href="/dashboard/maintenance"
      style={{ textDecoration: "none", color: "inherit" }}
      aria-label="Open Maintenance"
    >
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Maintenance</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Unread + Read items (excluding completed)
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", fontSize: 12 }}>
              <strong>Unread:</strong> {unreadCount}
            </div>
            <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", fontSize: 12 }}>
              <strong>Read:</strong> {readCount}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          View & update →
        </div>
      </div>
    </Link>
  );
}