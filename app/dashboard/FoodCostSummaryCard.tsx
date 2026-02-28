import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";

function calcCostPence(r: {
  foodPurchasesPence: number | null;
  creditsPence: number | null;
  openingStockPence: number | null;
  closingStockPence: number | null;
}) {
  const purchases = r.foodPurchasesPence ?? 0;
  const credits = r.creditsPence ?? 0;
  const opening = r.openingStockPence ?? 0;
  const closing = r.closingStockPence ?? 0;
  const stockAdj = opening - closing;
  return purchases - credits + stockAdj;
}

function penceToPounds(pence: number) {
  return (pence / 100).toFixed(2);
}

function badgeStyle(actualPct: number | null, targetBps: number | null): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    padding: "6px 12px",
    borderRadius: 12,
    border: "2px solid rgba(255,255,255,0.35)",
    color: "#fff",
    fontWeight: 900,
    background: "rgba(255,255,255,0.14)",
    lineHeight: 1,
  };

  if (actualPct === null || targetBps === null) return base;

  const targetPct = targetBps / 100;
  const ok = actualPct <= targetPct;

  return {
    ...base,
    background: ok ? "var(--ok, #22c55e)" : "var(--bad, #ef4444)",
  };
}

function financialYearStartYearUTC(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0=Jan .. 11=Dec
  // FY starts in April (month index 3)
  return m >= 3 ? y : y - 1;
}

export default async function FoodCostSummaryCard() {
  const session = await getSession();
  if (!session?.user) return null;

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return null;

  const fyStartYear = financialYearStartYearUTC(new Date());
  const start = new Date(Date.UTC(fyStartYear, 3, 1, 0, 0, 0, 0)); // Apr 1
  const end = new Date(Date.UTC(fyStartYear + 1, 3, 1, 0, 0, 0, 0)); // next Apr 1

  // Pull target from property (basis points)
  const prop = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { targetFoodCostPct: true },
  });
  const targetBps = typeof prop?.targetFoodCostPct === "number" ? prop.targetFoodCostPct : null;

  const rows = await prisma.monthlyFoodCost.findMany({
    where: { propertyId, monthStart: { gte: start, lt: end } },
    select: {
      foodPurchasesPence: true,
      creditsPence: true,
      openingStockPence: true,
      closingStockPence: true,
      foodSalesPence: true,
    },
  });

  let totalCost = 0;
  let totalSales = 0;

  for (const r of rows) {
    totalCost += calcCostPence(r);
    totalSales += r.foodSalesPence ?? 0;
  }

  const ytdPct = totalSales > 0 ? (totalCost / totalSales) * 100 : null;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        padding: 16,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, opacity: 0.9 }}>Cumulative Food Cost (FY)</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {fyStartYear}–{fyStartYear + 1} • Apr–Mar
          </div>
        </div>

        <div style={badgeStyle(ytdPct, targetBps)}>{ytdPct === null ? "—" : `${ytdPct.toFixed(1)}%`}</div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, opacity: 0.9 }}>
        <div>
          <span style={{ opacity: 0.75 }}>Total Cost:</span> £{penceToPounds(totalCost)}
        </div>
        <div>
          <span style={{ opacity: 0.75 }}>Total Sales:</span> £{penceToPounds(totalSales)}
        </div>
        <div>
          <span style={{ opacity: 0.75 }}>Target:</span> {targetBps === null ? "—" : `${(targetBps / 100).toFixed(2)}%`}
        </div>
      </div>
    </div>
  );
}

