import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.scss";
import FoodCostSummaryCard from "./FoodCostSummaryCard";
import MaintenanceSummaryCard from "./MaintenanceSummaryCard";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function mondayOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function todayStartEnd() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatTimeUK(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  // role check (for admin-only quick actions)
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  const isAdmin = membership?.role === "PROPERTY_ADMIN";

  // ===== Temperature snapshot =====
  const units = await prisma.refrigerationUnit.findMany({
    where: { propertyId, isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  const { start, end } = todayStartEnd();

  const logsToday = await prisma.temperatureLog.findMany({
    where: {
      propertyId,
      loggedAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      unitId: true,
      period: true, // AM/PM/OTHER
      status: true, // NORMAL/DEFROST
      loggedAt: true,
    },
    orderBy: { loggedAt: "desc" },
  });

  const unitHasAM = new Set<string>();
  const unitHasPM = new Set<string>();
  let latestLogAt: Date | null = null;
  let defrostCount = 0;

  for (const l of logsToday) {
    if (!latestLogAt) latestLogAt = l.loggedAt;
    if (l.status === "DEFROST") defrostCount += 1;

    if (l.period === "AM") unitHasAM.add(l.unitId);
    if (l.period === "PM") unitHasPM.add(l.unitId);
  }

  const totalUnits = units.length;
  const missingAM = Math.max(0, totalUnits - unitHasAM.size);
  const missingPM = Math.max(0, totalUnits - unitHasPM.size);

  // ===== Rotas snapshot (today) =====
  const now = new Date();
  const weekStart = mondayOfWeek(now);
  const jsDay = now.getDay(); // 0=Sun..6=Sat
  const dayName = DAYS[jsDay];
  const dayIndex = (jsDay + 6) % 7; // convert to 0=Mon..6=Sun

  const week = await prisma.rotaWeek.findUnique({
    where: { propertyId_weekStart: { propertyId, weekStart } },
    include: {
      shifts: {
        where: { dayIndex },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { startTime: "asc" },
      },
    },
  });

  const shiftsToday = week?.shifts ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.sub}>{dayName} overview for your property</p>
        </div>

        <div className={styles.quickLinks}>
          {isAdmin ? (
          <Link className={styles.linkPill} href="/dashboard/rotas">
            Rotas
          </Link>
          ) : null}
          {isAdmin ? (
          <Link className={styles.linkPill} href="/dashboard/refrigeration">
            Refrigeration
          </Link>
          ) : null}
          {isAdmin ? (
          <Link className={styles.linkPill} href="/dashboard/settings/invites">
              Invites
            </Link>
            ) : null}
          
        </div>
      </div>

      <section className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Temperature logs today</div>

          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Units</div>
              <div className={styles.kpiValue}>{totalUnits}</div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Missing AM</div>
              <div className={styles.kpiValue}>{missingAM}</div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Missing PM</div>
              <div className={styles.kpiValue}>{missingPM}</div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>DEFROST entries</div>
              <div className={styles.kpiValue}>{defrostCount}</div>
            </div>
          </div>

          <div className={styles.metaRow}>
            <span className={styles.meta}>
              Latest log: <b>{latestLogAt ? formatTimeUK(latestLogAt) : "None today"}</b>
            </span>

            <Link className={styles.cta} href="/dashboard/temperature">
              Go to Temperature →
            </Link>
          </div>
        </div>
            <div className={styles.card}>
  <div className={styles.cardTitle}>Cumulative Food Cost (YTD)</div>
  <FoodCostSummaryCard />
  <div className={styles.metaRow}>
    <span className={styles.meta}>Based on this year’s saved monthly inputs</span>
    <Link className={styles.cta} href="/dashboard/food-cost">
      Go to Food Cost →
    </Link>
  </div>
</div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Today’s shifts</div>

          {shiftsToday.length ? (
            <div className={styles.shiftList}>
              {shiftsToday.slice(0, 6).map((s: any) => {
                const who = s.user?.name || s.user?.email || "Unassigned";
                return (
                  <div key={s.id} className={styles.shiftRow}>
                    <div className={styles.shiftWho}>{who}</div>
                    <div className={styles.shiftWhen}>
                      {s.startTime}–{s.endTime}
                    </div>
                  </div>
                );
              })}

              {shiftsToday.length > 6 ? <div className={styles.small}>+ {shiftsToday.length - 6} more</div> : null}
            </div>
          ) : (
            <div className={styles.empty}>No shifts scheduled today.</div>
          )}

          <div className={styles.metaRow}>
            <span className={styles.meta}>
              Week starting <b>{new Intl.DateTimeFormat("en-GB").format(weekStart)}</b>
            </span>

            <Link className={styles.cta} href="/dashboard/rotas">
              Go to Rotas →
            </Link>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Quick actions</div>

          <div className={styles.actions}>
            <Link className={styles.actionBtn} href="/dashboard/temperature">
              Log temperatures
            </Link>
            <Link className={styles.actionBtn} href="/dashboard/rotas">
              View rotas
            </Link>
            <Link className={styles.actionBtn} href="/dashboard/team-log">
              View team log
            </Link>

            {isAdmin ? (
              <>
                <Link className={styles.actionBtn} href="/dashboard/refrigeration">
                  Manage units
                </Link>
                <Link className={styles.actionBtn} href="/dashboard/settings/invites">
                  Invite staff
                </Link>
              </>
            ) : (
              <Link className={styles.actionBtn} href="/dashboard/refrigeration">
                View units
              </Link>
            )}
          </div>

          <p className={styles.small}>
            Next upgrades: amber alerts, “next shift” highlight, and a live “to-do” list for missing logs.
          </p>
        </div>
        {/* (Maintenance summary card - excludes completed) */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Maintenance (open)</div>
          <MaintenanceSummaryCard propertyId={propertyId} />
          <div className={styles.metaRow}>
            <span className={styles.meta}>Unread + Read items only (excluding completed)</span>
            <Link className={styles.cta} href="/dashboard/maintenance">
              Go to Maintenance →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

