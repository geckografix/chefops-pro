"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./temperature.module.scss";
import { usePropertySettings } from "@/src/lib/usePropertySettings";

type Unit = {
  id: string;
  name: string;
  type: "FRIDGE" | "FREEZER";
};

type LastLog = {
  unitId: string;
  period: "AM" | "PM";
  status: "NORMAL" | "DEFROST";
  valueC: string | null;
  notes: string | null;
  loggedAt: string;
  byEmail: string;
};

function tenthToC(v: number) {
  return (v / 10).toFixed(1);
}

function isOutOfRange(
  unitType: Unit["type"],
  status: LastLog["status"],
  valueC: string | null,
  settings: {
    fridgeMinTenthC: number;
    fridgeMaxTenthC: number;
    freezerMinTenthC: number;
    freezerMaxTenthC: number;
  } | null
) {
  if (status === "DEFROST") return false;
  if (valueC === null) return false;

  const v = Number(valueC);
  if (Number.isNaN(v)) return false;

  // Fallbacks only apply while settings is loading
  const fridgeMin = settings ? settings.fridgeMinTenthC / 10 : 0;
  const fridgeMax = settings ? settings.fridgeMaxTenthC / 10 : 8;

  const freezerMin = settings ? settings.freezerMinTenthC / 10 : -99;
  const freezerMax = settings ? settings.freezerMaxTenthC / 10 : -18;

  if (unitType === "FRIDGE") return v < fridgeMin || v > fridgeMax;
  return v < freezerMin || v > freezerMax;
}

export default function TemperatureSheetPage() {
  const { settings } = usePropertySettings();
  const [units, setUnits] = useState<Unit[]>([]);
  const [latest, setLatest] = useState<Record<string, LastLog>>({});
  const [am, setAm] = useState<Record<string, string>>({});
  const [pm, setPm] = useState<Record<string, string>>({});
  const [notesAM, setNotesAM] = useState<Record<string, string>>({});
  const [notesPM, setNotesPM] = useState<Record<string, string>>({});
  const [defAM, setDefAM] = useState<Record<string, boolean>>({});
  const [defPM, setDefPM] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function loadUnits() {
    const r = await fetch("/api/refrigeration");
    if (!r.ok) return;
    const data = await r.json();
    setUnits(data.units || []);
  }

  async function loadLastLogsToday() {
    const r = await fetch("/api/temperature/today");
    if (!r.ok) return;
    const data = await r.json();
    setLatest(data.latest || {});
  }

  useEffect(() => {
    loadUnits();
    loadLastLogsToday();
  }, []);

  async function logTemp(unitId: string, period: "AM" | "PM") {
    setMsg(null);

    const isDef = period === "AM" ? !!defAM[unitId] : !!defPM[unitId];
    const status: LastLog["status"] = isDef ? "DEFROST" : "NORMAL";

    const valueStr = period === "AM" ? am[unitId] : pm[unitId];
    const valueC = isDef ? null : Number(valueStr);
    const notes =
      (period === "AM" ? notesAM[unitId] : notesPM[unitId])?.trim() || null;

    if (status === "NORMAL") {
      if (!valueStr || Number.isNaN(valueC as number)) {
        setMsg("Please enter a valid temperature.");
        return;
      }
    }

    const key = `${unitId}:${period}`;
    setBusyKey(key);

    const r = await fetch("/api/temperature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId,
        period,
        status,
        valueC,
        notes,
      }),
    });

    setBusyKey(null);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg(data?.error || "Could not log temperature.");
      return;
    }

    if (period === "AM") {
      setAm((p) => ({ ...p, [unitId]: "" }));
      setNotesAM((p) => ({ ...p, [unitId]: "" }));
      setDefAM((p) => ({ ...p, [unitId]: false }));
    } else {
      setPm((p) => ({ ...p, [unitId]: "" }));
      setNotesPM((p) => ({ ...p, [unitId]: "" }));
      setDefPM((p) => ({ ...p, [unitId]: false }));
    }

    setMsg("Temperature logged.");
    await loadLastLogsToday();
  }

  const sortedUnits = useMemo(
    () => [...units].sort((a, b) => a.name.localeCompare(b.name)),
    [units]
  );

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Temperature Sheet</h1>

      <p className={styles.subtitle}>
        Log AM / PM temperatures for each fridge or freezer.
      </p>

      <div className={styles.guidance}>
  {settings ? (
    <>
      Permitted ranges: Fridges {tenthToC(settings.fridgeMinTenthC)}°C → {tenthToC(settings.fridgeMaxTenthC)}°C ·
      Freezers {tenthToC(settings.freezerMinTenthC)}°C → {tenthToC(settings.freezerMaxTenthC)}°C
    </>
  ) : (
    <>Permitted ranges: Fridges 0.0°C → 8.0°C · Freezers ≤ −18.0°C</>
  )}
</div>

      {msg && <div className={styles.notice}>{msg}</div>}

      <div className={styles.sheet}>
        <div className={styles.header}>
          <div>Unit</div>
          <div>AM</div>
          <div>PM</div>
          <div>Today</div>
        </div>

        {sortedUnits.map((u) => {
          const lastAM = latest[`${u.id}:AM`];
          const lastPM = latest[`${u.id}:PM`];

          const amAmber = lastAM ? isOutOfRange(u.type, lastAM.status, lastAM.valueC, settings) : false;
          const pmAmber = lastPM ? isOutOfRange(u.type, lastPM.status, lastPM.valueC, settings) : false;

          const defA = !!defAM[u.id];
          const defP = !!defPM[u.id];

          return (
            <div key={u.id} className={styles.row}>
              <div>
                <div className={styles.unitName}>{u.name}</div>
                <div className={styles.unitType}>{u.type}</div>
              </div>

              {/* AM */}
              <div className={styles.cell}>
                <input
                  className="input"
                  value={am[u.id] || ""}
                  onChange={(e) =>
                    setAm((p) => ({ ...p, [u.id]: e.target.value }))
                  }
                  placeholder={defA ? "DEF" : "°C"}
                  disabled={defA}
                />

                <button
                  type="button"
                  className={`btn ${styles.defBtn} ${
                    defA ? styles.defBtnActive : ""
                  }`}
                  onClick={() =>
                    setDefAM((p) => ({ ...p, [u.id]: !p[u.id] }))
                  }
                >
                  DEF
                </button>

                <button
                  className="btn"
                  onClick={() => logTemp(u.id, "AM")}
                  disabled={busyKey === `${u.id}:AM`}
                >
                  {busyKey === `${u.id}:AM` ? "…" : "Log"}
                </button>

                <input
                  className={`input ${styles.notesInput}`}
                  value={notesAM[u.id] || ""}
                  onChange={(e) =>
                    setNotesAM((p) => ({ ...p, [u.id]: e.target.value }))
                  }
                  placeholder="Notes"
                />
              </div>

              {/* PM */}
              <div className={styles.cell}>
                <input
                  className="input"
                  value={pm[u.id] || ""}
                  onChange={(e) =>
                    setPm((p) => ({ ...p, [u.id]: e.target.value }))
                  }
                  placeholder={defP ? "DEF" : "°C"}
                  disabled={defP}
                />

                <button
                  type="button"
                  className={`btn ${styles.defBtn} ${
                    defP ? styles.defBtnActive : ""
                  }`}
                  onClick={() =>
                    setDefPM((p) => ({ ...p, [u.id]: !p[u.id] }))
                  }
                >
                  DEF
                </button>

                <button
                  className="btn"
                  onClick={() => logTemp(u.id, "PM")}
                  disabled={busyKey === `${u.id}:PM`}
                >
                  {busyKey === `${u.id}:PM` ? "…" : "Log"}
                </button>

                <input
                  className={`input ${styles.notesInput}`}
                  value={notesPM[u.id] || ""}
                  onChange={(e) =>
                    setNotesPM((p) => ({ ...p, [u.id]: e.target.value }))
                  }
                  placeholder="Notes"
                />
              </div>

              {/* Today */}
              <div className={styles.today}>
                <div>
                  <b>AM:</b>{" "}
                  {lastAM ? (
                    <>
                      {lastAM.status === "DEFROST" ? (
                        <>
                          <span className={styles.valueAmber}>DEF</span>
                          <span className={styles.badgeAmber}>DEFROST</span>
                        </>
                      ) : (
                        <>
                          <span
                            className={
                              amAmber
                                ? styles.valueAmber
                                : styles.valueOk
                            }
                          >
                            {lastAM.valueC}°C
                          </span>
                          {amAmber && (
                            <span className={styles.badgeAmber}>AMBER</span>
                          )}
                        </>
                      )}
                      <span className={styles.noteInline}>
                        {" "}
                        ({new Date(lastAM.loggedAt).toLocaleTimeString()}){" "}
                        {lastAM.byEmail}
                        {lastAM.notes ? ` — ${lastAM.notes}` : ""}
                      </span>
                    </>
                  ) : (
                    <span className={styles.empty}>—</span>
                  )}
                </div>

                <div className={styles.todayLine}>
                  <b>PM:</b>{" "}
                  {lastPM ? (
                    <>
                      {lastPM.status === "DEFROST" ? (
                        <>
                          <span className={styles.valueAmber}>DEF</span>
                          <span className={styles.badgeAmber}>DEFROST</span>
                        </>
                      ) : (
                        <>
                          <span
                            className={
                              pmAmber
                                ? styles.valueAmber
                                : styles.valueOk
                            }
                          >
                            {lastPM.valueC}°C
                          </span>
                          {pmAmber && (
                            <span className={styles.badgeAmber}>AMBER</span>
                          )}
                        </>
                      )}
                      <span className={styles.noteInline}>
                        {" "}
                        ({new Date(lastPM.loggedAt).toLocaleTimeString()}){" "}
                        {lastPM.byEmail}
                        {lastPM.notes ? ` — ${lastPM.notes}` : ""}
                      </span>
                    </>
                  ) : (
                    <span className={styles.empty}>—</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        Next: 90-day EHO report, printable logs, and per-unit temperature rules.
      </div>
    </main>
  );
}
