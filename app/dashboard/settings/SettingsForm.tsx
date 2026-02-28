"use client";

import { useMemo, useState } from "react";
import styles from "./settings.module.scss";

type PropertySettings = {
  fridgeMinTenthC: number;
  fridgeMaxTenthC: number;
  freezerMinTenthC: number;
  freezerMaxTenthC: number;

  foodCostTargetBps: number;

  cookedMinTenthC: number;
  reheatedMinTenthC: number;

  chilledMinTenthC: number;
  chilledMaxTenthC: number;

  blastChillTargetTenthC: number;
  blastChillMaxMinutes: number;
};

function tenthToC(v: number) {
  return (v / 10).toFixed(1);
}
function cToTenth(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10);
}
function bpsToPct(v: number) {
  return (v / 100).toFixed(2);
}
function pctToBps(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export default function SettingsForm({ initial }: { initial: PropertySettings }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState(() => ({
    fridgeMinC: tenthToC(initial.fridgeMinTenthC),
    fridgeMaxC: tenthToC(initial.fridgeMaxTenthC),
    freezerMinC: tenthToC(initial.freezerMinTenthC),
    freezerMaxC: tenthToC(initial.freezerMaxTenthC),

    foodCostPct: bpsToPct(initial.foodCostTargetBps),

    cookedMinC: tenthToC(initial.cookedMinTenthC),
    reheatedMinC: tenthToC(initial.reheatedMinTenthC),
    chilledMinC: tenthToC(initial.chilledMinTenthC),
    chilledMaxC: tenthToC(initial.chilledMaxTenthC),

    blastChillTargetC: tenthToC(initial.blastChillTargetTenthC),
    blastChillMaxMinutes: String(initial.blastChillMaxMinutes),
  }));

  const payload = useMemo(
    () => ({
      fridgeMinTenthC: cToTenth(form.fridgeMinC),
      fridgeMaxTenthC: cToTenth(form.fridgeMaxC),
      freezerMinTenthC: cToTenth(form.freezerMinC),
      freezerMaxTenthC: cToTenth(form.freezerMaxC),

      foodCostTargetBps: pctToBps(form.foodCostPct),

      cookedMinTenthC: cToTenth(form.cookedMinC),
      reheatedMinTenthC: cToTenth(form.reheatedMinC),
      chilledMinTenthC: cToTenth(form.chilledMinC),
      chilledMaxTenthC: cToTenth(form.chilledMaxC),

      blastChillTargetTenthC: cToTenth(form.blastChillTargetC),
      blastChillMaxMinutes: Number(form.blastChillMaxMinutes) || 90,
    }),
    [form]
  );

  async function handleSave() {
    setBusy(true);
    setSaved(null);
    setErr(null);

    try {
      const res = await fetch("/api/property-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Save failed");

      setSaved("Saved");
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.section}>
        <h2 className={styles.h2}>Refrigeration thresholds</h2>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>Fridge min (°C)</label>
            <input
              className={styles.input}
              value={form.fridgeMinC}
              onChange={(e) => setForm((p) => ({ ...p, fridgeMinC: e.target.value }))}
              inputMode="decimal"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Fridge max (°C)</label>
            <input
              className={styles.input}
              value={form.fridgeMaxC}
              onChange={(e) => setForm((p) => ({ ...p, fridgeMaxC: e.target.value }))}
              inputMode="decimal"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Freezer min (°C)</label>
            <input
              className={styles.input}
              value={form.freezerMinC}
              onChange={(e) => setForm((p) => ({ ...p, freezerMinC: e.target.value }))}
              inputMode="decimal"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Freezer max (°C)</label>
            <input
              className={styles.input}
              value={form.freezerMaxC}
              onChange={(e) => setForm((p) => ({ ...p, freezerMaxC: e.target.value }))}
              inputMode="decimal"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.h2}>Food cost target</h2>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>Target food cost (%)</label>
            <input
              className={styles.input}
              value={form.foodCostPct}
              onChange={(e) => setForm((p) => ({ ...p, foodCostPct: e.target.value }))}
              inputMode="decimal"
            />
            <div className={styles.hint}>Example: 30.00</div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.h2}>Food temperature thresholds</h2>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>Cooked min (°C)</label>
            <input
              className={styles.input}
              value={form.cookedMinC}
              onChange={(e) => setForm((p) => ({ ...p, cookedMinC: e.target.value }))}
              inputMode="decimal"
            />
          </div>
          

          <div className={styles.field}>
            <label className={styles.label}>Reheated min (°C)</label>
            <input
              className={styles.input}
              value={form.reheatedMinC}
              onChange={(e) => setForm((p) => ({ ...p, reheatedMinC: e.target.value }))}
              inputMode="decimal"
            />
          </div>
          

          <div className={styles.field}>
            <label className={styles.label}>Chilled min (°C)</label>
            <input
              className={styles.input}
              value={form.chilledMinC}
              onChange={(e) => setForm((p) => ({ ...p, chilledMinC: e.target.value }))}
              inputMode="decimal"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Chilled max (°C)</label>
            <input
              className={styles.input}
              value={form.chilledMaxC}
              onChange={(e) => setForm((p) => ({ ...p, chilledMaxC: e.target.value }))}
              inputMode="decimal"
            />
          </div>
          {/* NEW: Blast chill requirement */}
  <div className={styles.field}>
    <label className={styles.label}>Blast chill target (°C)</label>
    <input
      className={styles.input}
      value={form.blastChillTargetC}
      onChange={(e) => setForm((p) => ({ ...p, blastChillTargetC: e.target.value }))}
      inputMode="decimal"
    />
    <div className={styles.hint}>Must reach this temp or colder within the time limit.</div>
  </div>

  <div className={styles.field}>
    <label className={styles.label}>Blast chill time limit (minutes)</label>
    <input
      className={styles.input}
      value={form.blastChillMaxMinutes}
      onChange={(e) => setForm((p) => ({ ...p, blastChillMaxMinutes: e.target.value }))}
      inputMode="numeric"
    />
    <div className={styles.hint}>
  Set your SOP time limit (default is 90).
  The Time Frame MUST NOT EXCEED 90 Mins.
</div>
  </div>

        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btn} disabled={busy} onClick={handleSave}>
          {busy ? "Saving..." : "Save settings"}
        </button>

        {saved ? <span className={styles.ok}>{saved}</span> : null}
        {err ? <span className={styles.err}>{err}</span> : null}
      </div>
    </div>
  );
}