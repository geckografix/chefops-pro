"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./food-cost.module.scss";
import type { YearRecord } from "./YearFoodCostBoard";

function toPence(input: string) {
  const cleaned = input.replace(/[£,\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function yearFromISO(iso: string) {
  return new Date(iso).getUTCFullYear();
}

function fromPence(p: number) {
  return ((p || 0) / 100).toFixed(2);
}

function clearIfZero(value: string) {
  const v = value.trim();
  return v === "0.00" || v === "0" ? "" : value;
}

function calcCostPence(r: YearRecord) {
  const stockAdj = r.openingStockPence - r.closingStockPence;
  return r.foodPurchasesPence - r.creditsPence + stockAdj;
}

function monthPct(r: YearRecord) {
  const cost = calcCostPence(r);
  return r.foodSalesPence > 0 ? (cost / r.foodSalesPence) * 100 : null;
}

function pctBoxClass(actualPct: number | null, targetBps: number | null) {
  if (actualPct === null || targetBps === null) return styles.pctBoxNeutral;
  const targetPct = targetBps / 100;
  return actualPct <= targetPct ? styles.pctBoxGood : styles.pctBoxBad;
}

export default function MonthPanel({
  monthLabel,
  record,
  isAdmin,
  busy,
  onSave,
  targetBps,
}: {
  monthLabel: string;
  record: YearRecord;
  isAdmin: boolean;
  busy: boolean;
  onSave: (monthStartISO: string, patch: Partial<YearRecord>) => Promise<void>;
  targetBps: number | null;
}) {
  // Admin editable fields (strings for inputs)
  const [purchases, setPurchases] = useState(fromPence(record.foodPurchasesPence));
  const [credits, setCredits] = useState(fromPence(record.creditsPence));
  const [opening, setOpening] = useState(fromPence(record.openingStockPence));
  const [closing, setClosing] = useState(fromPence(record.closingStockPence));
  const [sales, setSales] = useState(fromPence(record.foodSalesPence));

  // Prevent wiping while user is actively typing
  const isEditingRef = useRef(false);
  const markEditing = () => {
    isEditingRef.current = true;
  };

  // Re-sync inputs whenever the record values change (e.g., after leaving page and coming back)
  useEffect(() => {
    if (isEditingRef.current) return;

    setPurchases(fromPence(record.foodPurchasesPence));
    setCredits(fromPence(record.creditsPence));
    setOpening(fromPence(record.openingStockPence));
    setClosing(fromPence(record.closingStockPence));
    setSales(fromPence(record.foodSalesPence));
  }, [
    record.monthStartISO,
    record.foodPurchasesPence,
    record.creditsPence,
    record.openingStockPence,
    record.closingStockPence,
    record.foodSalesPence,
  ]);

  const costP = useMemo(() => calcCostPence(record), [record]);
  const pct = useMemo(() => monthPct(record), [record]);
  const stockAdjP = record.openingStockPence - record.closingStockPence;

  async function handleSave() {
    // After save we can allow re-sync again
    isEditingRef.current = false;

    await onSave(record.monthStartISO, {
      foodPurchasesPence: toPence(purchases),
      creditsPence: toPence(credits),
      openingStockPence: toPence(opening),
      closingStockPence: toPence(closing),
      foodSalesPence: toPence(sales),
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.headerRow} style={{ alignItems: "baseline" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{monthLabel}</h3>
  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{yearFromISO(record.monthStartISO)}</div>
</div>

        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <div style={{ color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>
            Cost: <b>£{fromPence(costP)}</b>
          </div>

          <div style={{ color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>
            Sales: <b>£{fromPence(record.foodSalesPence)}</b>
          </div>

          <div className={`${styles.pctBox} ${pctBoxClass(pct, targetBps)}`}>
  {pct === null ? "—" : `${pct.toFixed(1)}%`}
</div>
        </div>
      </div>

      {isAdmin ? (
        <>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Purchases (£)</span>
              <input
                value={purchases}
                onFocus={() => setPurchases((v) => clearIfZero(v))}
                onChange={(e) => {
                  markEditing();
                  setPurchases(e.target.value);
                }}
                inputMode="decimal"
              />
            </label>

            <label className={styles.field}>
              <span>Credits/Returns (£)</span>
              <input
                value={credits}
                onFocus={() => setCredits((v) => clearIfZero(v))}
                onChange={(e) => {
                  markEditing();
                  setCredits(e.target.value);
                }}
                inputMode="decimal"
              />
            </label>

            <label className={styles.field}>
              <span>Opening stock (£)</span>
              <input
                value={opening}
                onFocus={() => setOpening((v) => clearIfZero(v))}
                onChange={(e) => {
                  markEditing();
                  setOpening(e.target.value);
                }}
                inputMode="decimal"
              />
            </label>

            <label className={styles.field}>
              <span>Closing stock (£)</span>
              <input
                value={closing}
                onFocus={() => setClosing((v) => clearIfZero(v))}
                onChange={(e) => {
                  markEditing();
                  setClosing(e.target.value);
                }}
                inputMode="decimal"
              />
            </label>

            <label className={styles.field}>
              <span>Food sales (£)</span>
              <input
                value={sales}
                onFocus={() => setSales((v) => clearIfZero(v))}
                onChange={(e) => {
                  markEditing();
                  setSales(e.target.value);
                }}
                inputMode="decimal"
              />
            </label>

            <div className={styles.breakdown}>
              <div>
                <b>Stock adjustment:</b> £{fromPence(stockAdjP)} (Opening − Closing)
              </div>
              <div>
                <b>Cost formula:</b> Purchases − Credits + (Open − Close)
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.btn} disabled={busy} onClick={handleSave}>
              {busy ? "Saving..." : "Save FC %"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
