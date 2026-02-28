"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./food-cost.module.scss";
import MonthPanel from "./MonthPanel";

export type YearRecord = {
  monthStartISO: string;
  foodPurchasesPence: number;
  foodSalesPence: number;
  creditsPence: number;
  openingStockPence: number;
  closingStockPence: number;
};

type YearResponse = {
  ok: true;
  year: number;
  isAdmin: boolean;
  records: YearRecord[];
};

function bpsToPctString(bps: number | null) {
  return bps === null ? "" : (bps / 100).toFixed(2);
}

function pctStringToBps(input: string) {
  const cleaned = input.replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100); // 28.50 -> 2850
}

function monthNameShortFromISO(iso: string) {
  const d = new Date(iso);
  const m = d.getUTCMonth(); // 0..11
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m]!;
}

// Financial year skeleton: Apr(startYear) ... Mar(startYear+1)
function buildFinancialYearSkeleton(startYear: number): YearRecord[] {
  const out: YearRecord[] = [];

  // Apr..Dec of startYear (month index 3..11)
  for (let m = 3; m <= 11; m++) {
    const d = new Date(Date.UTC(startYear, m, 1, 0, 0, 0));
    out.push({
      monthStartISO: d.toISOString(),
      foodPurchasesPence: 0,
      foodSalesPence: 0,
      creditsPence: 0,
      openingStockPence: 0,
      closingStockPence: 0,
    });
  }

  // Jan..Mar of next year (month index 0..2)
  for (let m = 0; m <= 2; m++) {
    const d = new Date(Date.UTC(startYear + 1, m, 1, 0, 0, 0));
    out.push({
      monthStartISO: d.toISOString(),
      foodPurchasesPence: 0,
      foodSalesPence: 0,
      creditsPence: 0,
      openingStockPence: 0,
      closingStockPence: 0,
    });
  }

  return out; // length 12
}

function calcCostPence(r: YearRecord) {
  const stockAdj = r.openingStockPence - r.closingStockPence;
  return r.foodPurchasesPence - r.creditsPence + stockAdj;
}

function ytdPct(records: YearRecord[]) {
  let totalCost = 0;
  let totalSales = 0;

  for (const r of records) {
    totalCost += calcCostPence(r);
    totalSales += r.foodSalesPence;
  }

  return totalSales > 0 ? (totalCost / totalSales) * 100 : null;
}

function ytdBoxClass(actualPct: number | null, targetBps: number | null) {
  if (actualPct === null || targetBps === null) return styles.pctBoxNeutral;
  const targetPct = targetBps / 100;
  return actualPct <= targetPct ? styles.pctBoxGood : styles.pctBoxBad;
}

export default function YearFoodCostBoard() {
  const thisYear = new Date().getUTCFullYear();

  // IMPORTANT: "year" now means FINANCIAL YEAR START (e.g. 2026 = Apr 2026 -> Mar 2027)
  const [year, setYear] = useState<number>(thisYear);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [months, setMonths] = useState<YearRecord[]>(buildFinancialYearSkeleton(thisYear));

  const [targetBps, setTargetBps] = useState<number | null>(null);
  const [targetInput, setTargetInput] = useState<string>("");

  const yearOptions = useMemo(() => {
    const start = thisYear - 10;
    const end = thisYear + 2;
    const out: number[] = [];
    for (let y = start; y <= end; y++) out.push(y);
    return out;
  }, [thisYear]);

  async function loadYear() {
    setMsg(null);
    setBusy(true);

    // Fetch two calendar years: startYear and startYear+1
    const [r1, r2] = await Promise.all([
      fetch(`/api/food-cost/year?year=${year}`),
      fetch(`/api/food-cost/year?year=${year + 1}`),
    ]);

    if (!r1.ok || !r2.ok) {
      setBusy(false);
      const data = await (r1.ok ? r2 : r1).json().catch(() => ({}));
      setMsg((data as any)?.error || "Could not load financial year.");
      return;
    }

    const data1 = (await r1.json()) as YearResponse;
    const data2 = (await r2.json()) as YearResponse;

    // Admin status should match — take from first
    setIsAdmin(Boolean(data1.isAdmin));

    // Build FY skeleton (Apr..Mar)
    const base = buildFinancialYearSkeleton(year);

    // Merge records from both years
    const allRecords = [...(data1.records ?? []), ...(data2.records ?? [])];

    const map = new Map<string, any>();
    for (const x of allRecords as any[]) {
      const iso = new Date((x as any).monthStart ?? (x as any).monthStartISO).toISOString();
      map.set(iso, x);
    }

    const merged = base.map((b) => {
      const hit = map.get(b.monthStartISO);
      return hit
        ? {
            ...b,
            foodPurchasesPence: hit.foodPurchasesPence ?? 0,
            foodSalesPence: hit.foodSalesPence ?? 0,
            creditsPence: hit.creditsPence ?? 0,
            openingStockPence: hit.openingStockPence ?? 0,
            closingStockPence: hit.closingStockPence ?? 0,
          }
        : b;
    });

    setMonths(merged);

    // Load target
    const tr = await fetch("/api/food-cost/target");
    if (tr.ok) {
      const tdata = await tr.json().catch(() => null);
      const bps = typeof (tdata as any)?.targetFoodCostPct === "number" ? (tdata as any).targetFoodCostPct : null;
      setTargetBps(bps);
      setTargetInput(bpsToPctString(bps));
    } else {
      setTargetBps(null);
      setTargetInput("");
    }

    setBusy(false);
  }

  useEffect(() => {
    loadYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const ytd = useMemo(() => ytdPct(months), [months]);

  function upsertMonthInState(saved: any) {
    const savedISO = new Date(saved.monthStart).toISOString();

    setMonths((prev) =>
      prev.map((m) =>
        m.monthStartISO === savedISO
          ? {
              ...m,
              foodPurchasesPence: saved.foodPurchasesPence ?? m.foodPurchasesPence,
              foodSalesPence: saved.foodSalesPence ?? m.foodSalesPence,
              creditsPence: saved.creditsPence ?? m.creditsPence,
              openingStockPence: saved.openingStockPence ?? m.openingStockPence,
              closingStockPence: saved.closingStockPence ?? m.closingStockPence,
            }
          : m
      )
    );
  }

  async function saveMonth(monthStartISO: string, patch: Partial<YearRecord>) {
    setMsg(null);
    setBusy(true);

    const r = await fetch(`/api/food-cost/month`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthStartISO, ...patch }),
    });

    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg((data as any)?.error || "Could not save month.");
      return;
    }

    const data = await r.json().catch(() => null);
    if ((data as any)?.record) upsertMonthInState((data as any).record);

    setMsg("Saved.");
  }

  async function saveTarget() {
    setMsg(null);
    setBusy(true);

    const bps = targetInput.trim() ? pctStringToBps(targetInput) : null;

    const r = await fetch("/api/food-cost/target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetFoodCostPct: bps }),
    });

    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg((data as any)?.error || "Could not save target.");
      return;
    }

    setMsg("Target saved.");
    await loadYear();
  }

  return (
    <>
      <div className={styles.ytdBar}>
        <div className={styles.ytdLeft}>
          <div className={styles.ytdTitle}>Financial Year Food Cost % (Apr–Mar)</div>

          <div className={`${styles.ytdValue} ${styles.pctBox} ${ytdBoxClass(ytd, targetBps)}`}>
            {ytd === null ? "—" : `${ytd.toFixed(1)}%`}
          </div>

          <div className={styles.ytdSub}>Calculated as (Total Cost ÷ Total Sales) × 100</div>
        </div>

        <div className={styles.ytdRight}>
          {isAdmin ? (
            <label className={styles.field}>
              <span>Target Food Cost %</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="e.g. 28.50"
                  inputMode="decimal"
                />
                <button className={styles.btnGhost} onClick={saveTarget} disabled={busy}>
                  Save
                </button>
              </div>
            </label>
          ) : null}

          <label className={styles.field}>
  <span>Financial year</span>
  <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
    {yearOptions.map((y) => (
      <option key={y} value={y}>
        {y}–{y + 1}
      </option>
    ))}
  </select>
</label>

          <button className={styles.btnGhost} onClick={loadYear} disabled={busy}>
            {busy ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}

      <div className={styles.monthGrid}>
        {months.map((m) => (
          <MonthPanel
            key={m.monthStartISO}
            monthLabel={monthNameShortFromISO(m.monthStartISO)}
            record={m}
            isAdmin={isAdmin}
            busy={busy}
            onSave={saveMonth}
            targetBps={targetBps}
          />
        ))}
      </div>
    </>
  );
}
