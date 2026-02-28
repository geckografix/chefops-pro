import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

// Delete anything older than 3 months + 1 day (UTC)
function retentionCutoffUtc(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  return cutoff;
}

export async function POST(req: Request) {
  try {
    const secret = process.env.CHEFOPS_CRON_SECRET;
    const header = req.headers.get("x-chefops-cron-secret") ?? "";

    if (!secret || header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoff = retentionCutoffUtc(new Date());

    const result = await prisma.foodTemperatureLog.deleteMany({
      where: { loggedAt: { lt: cutoff } },
    });

    return NextResponse.json({
      ok: true,
      deleted: result.count,
      cutoff: cutoff.toISOString(),
    });
  } catch (err: any) {
    console.error("TEMP-LOGS RETENTION ERROR:", err);
    return NextResponse.json(
      { error: "Retention purge failed.", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
