
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { redirect } from "next/navigation";
import styles from "./rotas.module.scss";
import AddShiftForm from "./AddShiftForm";
import ShiftBlock from "./shiftBlock";
import PublishWeekButton from "./PublishWeekButton";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const RAIL_START_HOUR = 6; // 06:00
const RAIL_END_HOUR = 23; // 23:00

const DAY_START_MIN = RAIL_START_HOUR * 60;
const DAY_END_MIN = RAIL_END_HOUR * 60;
const DAY_DURATION_MIN = DAY_END_MIN - DAY_START_MIN;

type SessionUser = {
  userId: string;
  email: string;
  name?: string | null;
  activePropertyId?: string | null;
};

type PropertyUser = {
  id: string;
  name: string | null;
  email: string;
};

function mondayOfWeekUTC(d = new Date()) {
  // Canonical weekStart: Monday 00:00:00.000 UTC
  const date = new Date(d);

  // Convert "now" into a UTC-midnight anchor first
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

  // JS: Sun=0..Sat=6. We want Mon=0..Sun=6
  const day = (utc.getUTCDay() + 6) % 7;

  utc.setUTCDate(utc.getUTCDate() - day); // back to Monday
  return utc;
}

function formatDateUK(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hourMarkers() {
  const hours: number[] = [];
  for (let h = RAIL_START_HOUR; h <= RAIL_END_HOUR; h++) hours.push(h);
  return hours;
}

function timeToMinutes(t: string) {
  // expects "HH:MM"
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type RotaShiftForLane = {
  id: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  role: string;
  notes: string | null;
  userId: string | null;
  dayIndex: number;
  user?: { id: string; name: string | null; email: string } | null;
};

type LaneShift = {
  id: string;
  startMin: number;
  endMin: number;
  raw: RotaShiftForLane;
};

function assignOverlapLanes(shifts: RotaShiftForLane[]) {
  const prepared: LaneShift[] = shifts
    .map((s) => {
      const startMin = timeToMinutes(s.startTime);
      const endMin = timeToMinutes(s.endTime);

      const clampedStart = clamp(startMin, DAY_START_MIN, DAY_END_MIN);
      const clampedEnd = clamp(endMin, DAY_START_MIN, DAY_END_MIN);
      const safeEnd = Math.max(clampedEnd, clampedStart + 15);

      return {
        id: s.id,
        startMin: clampedStart,
        endMin: safeEnd,
        raw: s,
      };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const lanesEndMin: number[] = [];
  const withLanes: Array<LaneShift & { laneIndex: number }> = [];
  const OVERLAP_TOLERANCE_MIN = 5;

  for (const s of prepared) {
    let laneIndex = -1;
    for (let i = 0; i < lanesEndMin.length; i++) {
      if (s.startMin >= lanesEndMin[i] - OVERLAP_TOLERANCE_MIN) {
        laneIndex = i;
        break;
      }
    }

    if (laneIndex === -1) {
      laneIndex = lanesEndMin.length;
      lanesEndMin.push(s.endMin);
    } else {
      lanesEndMin[laneIndex] = s.endMin;
    }

    withLanes.push({ ...s, laneIndex });
  }

  return {
    shifts: withLanes,
    laneCount: lanesEndMin.length,
  };
}

export default async function RotasPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string; mine?: string }> | { week?: string; mine?: string };
}) {
  // Resolve search params safely (works whether it’s a Promise or plain object)
  const sp = await Promise.resolve(searchParams);

  const session = await getSession();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const propertyId = user.activePropertyId;

  if (!propertyId) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Rotas</h1>
        <p className={styles.sub}>No active property set for your account.</p>
      </main>
    );
  }

  // Role check
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: user.userId, isActive: true },
    select: { role: true },
  });
  const isAdmin = membership?.role === "PROPERTY_ADMIN";

  // Users in property (for AddShiftForm dropdown)
  const memberships = await prisma.propertyMembership.findMany({
    where: { propertyId, isActive: true },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const propertyUsers: PropertyUser[] = memberships.map((m: { user: PropertyUser }) => m.user);

// This week + next week (canonical UTC week starts)
const weekStart = mondayOfWeekUTC(new Date());
const nextWeekStart = mondayOfWeekUTC(addDays(weekStart, 7));

  // Ensure rotaWeek rows exist
  await Promise.all([
    prisma.rotaWeek.upsert({
      where: { propertyId_weekStart: { propertyId, weekStart } },
      update: {},
      create: { propertyId, weekStart },
    }),
    prisma.rotaWeek.upsert({
      where: { propertyId_weekStart: { propertyId, weekStart: nextWeekStart } },
      update: {},
      create: { propertyId, weekStart: nextWeekStart },
    }),
  ]);

  const [week, nextWeek] = await Promise.all([
    prisma.rotaWeek.findUnique({
      where: { propertyId_weekStart: { propertyId, weekStart } },
      include: {
        shifts: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: [{ dayIndex: "asc" }, { startTime: "asc" }],
        },
      },
    }),
    prisma.rotaWeek.findUnique({
      where: { propertyId_weekStart: { propertyId, weekStart: nextWeekStart } },
      include: {
        shifts: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: [{ dayIndex: "asc" }, { startTime: "asc" }],
        },
      },
    }),
  ]);

  const nextWeekPublished = Boolean(nextWeek?.isPublished);

  // Which tab did they request?
  const requestedWeekKey = sp?.week === "next" ? "next" : "this";

  // Staff can view next week ONLY if it's published
  if (!isAdmin && requestedWeekKey === "next" && !nextWeekPublished) {
    redirect("/dashboard/rotas?week=this");
  }

  // Helpers for grouping
  function groupByDay(w: typeof week): Record<number, RotaShiftForLane[]> {
    const byDay: Record<number, RotaShiftForLane[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    if (w?.shifts?.length) {
      for (const s of w.shifts) byDay[s.dayIndex].push(s as RotaShiftForLane);
    }
    return byDay;
  }

  const byDayThis = groupByDay(week);
  const byDayNext = groupByDay(nextWeek);

  const weekSections = [
    { label: "This week", start: weekStart, byDay: byDayThis },
    { label: "Next week", start: nextWeekStart, byDay: byDayNext },
  ] as const;

  const activeWeekKey = requestedWeekKey;
  const activeWeek = activeWeekKey === "next" ? weekSections[1] : weekSections[0];

 

  // Employees default to "My shifts" unless mine=0 is set
  const mineMode = isAdmin ? false : sp?.mine !== "0";

 

  return (
    <main className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Rotas</h1>
          <p className={styles.sub}>
            Two-week view: <b>{formatDateUK(weekStart)}</b> and <b>{formatDateUK(nextWeekStart)}</b>
          </p>
        </div>
        <div className={styles.tools}>
          <span className={styles.pill}>{user.name || user.email}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabBar">
        <a
          href="/dashboard/rotas?week=this"
          className={`tab ${activeWeekKey === "this" ? "tabActive" : ""}`}
          aria-current={activeWeekKey === "this" ? "page" : undefined}
        >
          This week
        </a>

        {isAdmin || nextWeekPublished ? (
          <a
            href="/dashboard/rotas?week=next"
            className={`tab ${activeWeekKey === "next" ? "tabActive" : ""}`}
            aria-current={activeWeekKey === "next" ? "page" : undefined}
          >
            Next week
          </a>
        ) : null}

        
      </div>

      {!isAdmin ? (
        <div className="tabBar" style={{ marginTop: 10 }}>
          <a
            href={`/dashboard/rotas?week=${activeWeekKey}&mine=1`}
            className={`tab ${mineMode ? "tabActive" : ""}`}
            aria-current={mineMode ? "page" : undefined}
          >
            My shifts
          </a>
          <a
            href={`/dashboard/rotas?week=${activeWeekKey}&mine=0`}
            className={`tab ${!mineMode ? "tabActive" : ""}`}
            aria-current={!mineMode ? "page" : undefined}
          >
            Whole team
          </a>
        </div>
      ) : null}

      {/* Admin form - ONLY for the active tab/week */}
      {isAdmin ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {isAdmin && activeWeekKey === "next" && !nextWeekPublished ? (
            <PublishWeekButton
  weekStartISO={nextWeekStart.toISOString()}
  isPublished={nextWeekPublished}
/>
          ) : null}

          <AddShiftForm users={propertyUsers} weekStartISO={activeWeek.start.toISOString()} label={activeWeek.label} />
        </div>
      ) : null}

      {/* Render ONLY the active week */}
      <section
        className={`${styles.weekWrap} ${activeWeekKey === "next" ? styles.weekWrapNext : ""}`}
        style={{ marginTop: 14 }}
      >
        <h2 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 900 }}>
          {activeWeek.label} — Week starting {formatDateUK(activeWeek.start)}
        </h2>

        <div className={styles.weekRows}>
          {DAYS.map((day, idx) => {
            const allShifts = activeWeek.byDay[idx] || [];
            const shifts = mineMode ? allShifts.filter((s) => s.userId === user.userId) : allShifts;

            const dayDate = addDays(activeWeek.start, idx);

            // Employees: hide past days ONLY in "this week" view
            if (!isAdmin && activeWeekKey === "this") {
              const today = startOfToday();
              if (dayDate.getTime() < today.getTime()) return null;
            }

            return (
              <section key={`${activeWeek.label}-${day}`} className={styles.dayRow}>
                <div className={styles.dayLeft}>
                  <div className={styles.dayName}>
                    {day}{" "}
                    <span style={{ color: "var(--muted)", fontWeight: 800 }}>
                      ({formatDateUK(dayDate)})
                    </span>
                  </div>
                  <div className={styles.dayMeta}>{shifts.length} shift(s)</div>
                </div>

                <div className={styles.dayTimeline}>
                  <div className={styles.rail}>
                    {/* hour ruler */}
                    <div className={styles.railHours}>
                      {hourMarkers().map((h) => (
                        <div key={h} className={styles.hourTick}>
                          <span className={styles.hourLabel}>{String(h).padStart(2, "0")}:00</span>
                        </div>
                      ))}
                    </div>

                    {/* track: positioned shift pills */}
                    <div className={styles.railTrack}>
                      {shifts.length ? (
                        (() => {
                          const PILL_HEIGHT = 32;
                          const PILL_GAP = 6;

                          const { shifts: laneShifts, laneCount } = assignOverlapLanes(shifts);
                          const MAX_VISIBLE_LANES = 4;
                          const hiddenLaneCount = Math.max(0, laneCount - MAX_VISIBLE_LANES);

                          const visibleLaneShifts = laneShifts.filter((ls) => ls.laneIndex < MAX_VISIBLE_LANES);
                          const visibleLaneCount = Math.min(laneCount, MAX_VISIBLE_LANES);

                          const railMinHeight =
                            visibleLaneCount > 0
                              ? visibleLaneCount * (PILL_HEIGHT + PILL_GAP) - PILL_GAP
                              : PILL_HEIGHT;

                          return (
                            <div style={{ position: "relative", minHeight: `${railMinHeight}px` }}>
                              {visibleLaneShifts.map((ls) => {
                                const s = ls.raw;
                                const leftPct = ((ls.startMin - DAY_START_MIN) / DAY_DURATION_MIN) * 100;
                                const widthPct = ((ls.endMin - ls.startMin) / DAY_DURATION_MIN) * 100;
                                const topPx = ls.laneIndex * (PILL_HEIGHT + PILL_GAP);

                                const employeeName = s.user?.name || s.user?.email || "";
                                const timeText = `${s.startTime}–${s.endTime}`;
                                const titleText = employeeName ? `${employeeName} / ${timeText}` : timeText;

                                return (
                                  <ShiftBlock
                                    key={s.id}
                                    shiftId={s.id}
                                    isAdmin={isAdmin}
                                    users={propertyUsers}
                                    startTime={s.startTime}
                                    endTime={s.endTime}
                                    role={s.role}
                                    notes={s.notes}
                                    assigneeUserId={s.userId}
                                    style={{
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                      top: `${topPx}px`,
                                      height: `${PILL_HEIGHT}px`,
                                    }}
                                    employeeName={employeeName}
                                    timeText={timeText}
                                    titleText={titleText}
                                  />
                                );
                              })}

                              {hiddenLaneCount > 0 ? (
                                <div
                                  style={{
                                    position: "absolute",
                                    right: 10,
                                    bottom: 6,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    color: "var(--muted)",
                                    background: "rgba(0,0,0,0.25)",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    borderRadius: 999,
                                    padding: "4px 8px",
                                  }}
                                  title="More overlapping shifts exist in this day"
                                >
                                  +{hiddenLaneCount} more
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      ) : (
                        <div className={styles.empty}>No shifts</div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <div className={styles.footer}>Admin can add shifts. Staff can view only.</div>
    </main>
  );
}
