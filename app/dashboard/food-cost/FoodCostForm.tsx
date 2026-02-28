"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./food-cost.module.scss";

type MonthRecord = {
  id: string;
  monthStartISO: string;
  foodPurchasesPence: number;
  foodSalesPence: number;
  creditsPence: number;
  openingStockPence: number;
  closingStockPence: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthStartISOFromYYYYMM(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  return d.toISOString();
}

function yyyymmNowUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${pad2(m)}`;
}

function toPence(input: string) {
  const cleaned = input.replace(/[£,\s]/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

function fromPence(pence: number) {
  return (pence / 100).toFixed(2);
}

export default function FoodCostForm() {
  const [month, setMonth] = useState<string>(yyyymmNowUTC());

  // inputs as strings for nice typing
  const [foodPurchases, setFoodPurchases] = useState("0.00");
  const [foodSales, setFoodSales] = useState("0.00");
  const [credits, setCredits] = useState("0.00");
  const [openingStock, setOpeningStock] = useState("0.00");
  const [closingStock, setClosingStock] = useState("0.00");

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const monthStartISO = useMemo(() => monthStartISOFromYYYYMM(month), [month]);

  const computed = useMemo(() => {
    const purchasesP = toPence(foodPurchases);
    const salesP = toPence(foodSales);
    const creditsP = toPence(credits);
    const openingP = toPence(openingStock);
    const closingP = toPence(closingStock);

    const stockAdj = openingP - closingP;
    const cost = purchasesP - creditsP + stockAdj;

    const pct = salesP > 0 ? (cost / salesP) * 100 : null;

    return {
      purchasesP,
      salesP,
      creditsP,
      openingP,
      closingP,
      stockAdj,
      cost,
      pct,
    };
  }, [foodPurchases, foodSales, credits, openingStock, closingStock]);

  async function load() {
    setMsg(null);
    setBusy(true);

    const r = await fetch(`/api/food-cost/month?monthStart=${encodeURIComponent(monthStartISO)}`);
    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg(data?.error || "Could not load this month.");
      return;
    }

    const data = (await r.json()) as { ok: true; record: MonthRecord };
    setFoodPurchases(fromPence(data.record.foodPurchasesPence));
    setFoodSales(fromPence(data.record.foodSalesPence));
    setCredits(fromPence(data.record.creditsPence));
    setOpeningStock(fromPence(data.record.openingStockPence));
    setClosingStock(fromPence(data.record.closingStockPence));
    setMsg(null);
  }

  async function save() {
    setMsg(null);
    setBusy(true);

    const r = await fetch(`/api/food-cost/month`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthStartISO,
        foodPurchasesPence: computed.purchasesP,
        foodSalesPence: computed.salesP,
        creditsPence: computed.creditsP,
        openingStockPence: computed.openingP,
        closingStockPence: computed.closingP,
      }),
    });

    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg(data?.error || "Could not save.");
      return;
    }

    setMsg("Saved.");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStartISO]);

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>

        <div className={styles.result}>
          <div className={styles.resultLabel}>Food Cost %</div>
          <div className={styles.resultValue}>
            {computed.pct === null ? "—" : `${computed.pct.toFixed(1)}%`}
          </div>
          <div className={styles.resultSub}>
            Cost = Purchases − Credits + (Opening − Closing)
          </div>
        </div>
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Food purchases (£)</span>
          <input value={foodPurchases} onChange={(e) => setFoodPurchases(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Food sales (£)</span>
          <input value={foodSales} onChange={(e) => setFoodSales(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Credits / returns (£)</span>
          <input value={credits} onChange={(e) => setCredits(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Opening stock (£)</span>
          <input value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Closing stock (£)</span>
          <input value={closingStock} onChange={(e) => setClosingStock(e.target.value)} />
        </label>

        <div className={styles.breakdown}>
          <div>
            <b>Stock adjustment:</b> £{fromPence(computed.stockAdj)}
          </div>
          <div>
            <b>Food cost (£):</b> £{fromPence(computed.cost)}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btn} onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>

        <button className={styles.btnGhost} onClick={load} disabled={busy}>
          Refresh
        </button>
      </div>
    </div>
  );
}
