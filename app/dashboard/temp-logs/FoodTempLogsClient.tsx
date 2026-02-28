"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePropertySettings } from "@/src/lib/usePropertySettings";
import BlastChillModule from "./BlastChillModule";

type Role = "PROPERTY_ADMIN" | "PROPERTY_USER";
type LogPeriod = "AM" | "PM" | "OTHER";
type FoodTempStatus = "OK" | "OUT_OF_RANGE" | "DISCARDED" | "REHEATED" | "COOLED";

type FoodTempLog = {
  id: string;
  loggedAt: string;
  logDate: string;
  period: LogPeriod | null;
  status: FoodTempStatus;
  foodName: string;
  tempC: string | null; // Decimal serialized as string
  notes: string | null;
  createdByUserId: string | null;
};

type Compliance = {
  amCount: number;
  pmCount: number;
  amMin: number;
  pmMin: number;
  amMissing: number;
  pmMissing: number;
  amOk: boolean;
  pmOk: boolean;
};

type TodayResponse = {
  logDate: string;
  logs: FoodTempLog[];
  compliance: Compliance;
};

const PERIODS: { value: LogPeriod | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
  { value: "OTHER", label: "Other" },
];

const STATUSES: { value: FoodTempStatus; label: string }[] = [
  { value: "OK", label: "OK" },
  { value: "OUT_OF_RANGE", label: "Out of range" },
  { value: "DISCARDED", label: "Discarded" },
  { value: "REHEATED", label: "Reheated" },
  { value: "COOLED", label: "Cooled" },
];

type CheckType = "HOT_HOLD" | "COLD_HOLD" | "COOKED_REHEAT" | "SPOT_CHECK";

export default function FoodTempLogsClient({
  role,
  activeTab,
}: {
  role: Role;
  activeTab: "food" | "blast";
}) {
  const { settings } = usePropertySettings();

  const THRESH = useMemo(
    () => ({
      // v1 fixed rules (can move into Settings later if you want)
      HOT_HOLD_MIN: 63,
      COLD_HOLD_MAX: 8,
      // Driven by Settings (fallback is safe until settings loads)
      COOKED_REHEAT_MIN: settings ? settings.cookedMinTenthC / 10 : 75,
    }),
    [settings]
  );

  const CHECK_TYPES: { value: CheckType; label: string }[] = useMemo(
    () => [
      { value: "SPOT_CHECK", label: "Spot check" },
      { value: "HOT_HOLD", label: `Hot hold (>= ${THRESH.HOT_HOLD_MIN}°C)` },
      { value: "COLD_HOLD", label: `Cold hold (<= ${THRESH.COLD_HOLD_MAX}°C)` },
      {
        value: "COOKED_REHEAT",
        label: `Cooked/Reheat (>= ${THRESH.COOKED_REHEAT_MIN}°C)`,
      },
    ],
    [THRESH]
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<FoodTempLog[]>([]);
  const [compliance, setCompliance] = useState<Compliance | null>(null);

  // Form state (create ONLY)
  const [foodName, setFoodName] = useState("");
  const [tempC, setTempC] = useState<string>("");
  const [period, setPeriod] = useState<LogPeriod | "">("");
  const [status, setStatus] = useState<FoodTempStatus>("OK");
  const [notes, setNotes] = useState<string>("");

  // Check type (auto-status helper)
  const [checkType, setCheckType] = useState<CheckType>("SPOT_CHECK");

  async function fetchToday() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/temp-logs/today`, { cache: "no-store" });
      if (!res.ok) {
        const msg = await safeReadError(res);
        throw new Error(msg || `Failed to load logs (${res.status}).`);
      }

      const data = (await res.json()) as TodayResponse;
      setLogs(data.logs ?? []);
      setCompliance(data.compliance ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchToday();
  }, []);

  function resetForm() {
    setFoodName("");
    setTempC("");
    setPeriod("");
    setStatus("OK");
    setNotes("");
    setCheckType("SPOT_CHECK");
  }

  function computeSuggestedStatus(check: CheckType, tempStr: string): FoodTempStatus | null {
    const n = Number(tempStr);
    if (!Number.isFinite(n)) return null;
    if (check === "HOT_HOLD") return n >= THRESH.HOT_HOLD_MIN ? "OK" : "OUT_OF_RANGE";
    if (check === "COLD_HOLD") return n <= THRESH.COLD_HOLD_MAX ? "OK" : "OUT_OF_RANGE";
    if (check === "COOKED_REHEAT") return n >= THRESH.COOKED_REHEAT_MIN ? "OK" : "OUT_OF_RANGE";
    return null; // SPOT_CHECK = user decides
  }

  // Auto-suggest status when temp/checkType changes (but don’t fight user edits)
  useEffect(() => {
    const suggested = computeSuggestedStatus(checkType, tempC);
    if (!suggested) return;

    // Only auto-set if status is currently OK/OUT_OF_RANGE (i.e., not DISCARDED/REHEATED/COOLED)
    if (status === "OK" || status === "OUT_OF_RANGE") {
      setStatus(suggested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkType, tempC, THRESH.COOKED_REHEAT_MIN]);

  async function submit() {
    setBusy(true);
    setError(null);

    // Store checkType in notes for now (no schema change). Later we can add a dedicated column.
    const notePrefix = checkType !== "SPOT_CHECK" ? `[${checkType}] ` : "";
    const mergedNotes = (notePrefix + (notes ?? "")).trim();

    const payload: any = {
      foodName,
      tempC: tempC === "" ? null : tempC,
      period: period === "" ? null : period,
      status,
      notes: mergedNotes ? mergedNotes : null,
    };

    try {
      const res = await fetch("/api/temp-logs/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await safeReadError(res);
        throw new Error(msg || `Save failed (${res.status}).`);
      }

      await fetchToday();
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Food temp Logs</h1>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            {role === "PROPERTY_ADMIN" ? "Admin" : "User"} access • Logs stored in UTC • Immutable (no edits/deletes)
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {compliance ? (
            <>
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  opacity: compliance.amOk ? 0.6 : 1,
                }}
                title="Minimum 5 AM logs required"
              >
                AM {compliance.amCount}/{compliance.amMin}
                {compliance.amOk ? " ok" : ` (needs ${compliance.amMissing})`}
              </div>

              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  opacity: compliance.pmOk ? 0.6 : 1,
                }}
                title="Minimum 5 PM logs required"
              >
                PM {compliance.pmCount}/{compliance.pmMin}
                {compliance.pmOk ? " ok" : ` (needs ${compliance.pmMissing})`}
              </div>

              {compliance.amOk && compliance.pmOk ? (
                <div
                  title="Minimum AM and PM logs met"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #b7e3c1",
                    background: "#e9f8ee",
                    fontWeight: 700,
                  }}
                >
                  Day complete
                </div>
              ) : null}
            </>
          ) : null}

          <Link href="/dashboard/temp-logs/print" style={{ textDecoration: "none" }}>
            <span
              style={{
                display: "inline-block",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                cursor: "pointer",
              }}
            >
              Print last 3 months
            </span>
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabBar">
        <a
          href="/dashboard/temp-logs?tab=food"
          className={`tab ${activeTab === "food" ? "tabActive" : ""}`}
          aria-current={activeTab === "food" ? "page" : undefined}
        >
          Food Temperature
        </a>
        <a
          href="/dashboard/temp-logs?tab=blast"
          className={`tab ${activeTab === "blast" ? "tabActive" : ""}`}
          aria-current={activeTab === "blast" ? "page" : undefined}
        >
          Blast Chilling
        </a>
      </div>

      {/* Content switch */}
      {activeTab === "food" ? (
        <>
          <section style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Add food temp log</h2>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Check type</label>
                  <select value={checkType} onChange={(e) => setCheckType(e.target.value as any)} style={inputStyle}>
                    {CHECK_TYPES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Food / Dish name</label>
                  <input
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    placeholder="e.g., Chicken curry (hot hold)"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Temp °C</label>
                  <input
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                    placeholder="e.g., 63.5"
                    inputMode="decimal"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Period (optional)</label>
                  <select value={period} onChange={(e) => setPeriod(e.target.value as any)} style={inputStyle}>
                    {PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputStyle}>
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Probe used, corrective action, etc."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !foodName.trim()}
                  style={buttonStyle}
                >
                  {busy ? "Working…" : "Add log"}
                </button>
              </div>

              {error && (
                <div style={{ padding: 12, border: "1px solid #f3c2c2", borderRadius: 10 }}>
                  <strong>Problem:</strong> {error}
                </div>
              )}
            </div>
          </section>

          <section style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <h2 style={{ marginTop: 0 }}>Today’s entries</h2>
              <button
                type="button"
                onClick={fetchToday}
                disabled={loading}
                style={{ ...buttonStyle, padding: "8px 10px" }}
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {loading ? (
              <div>Loading…</div>
            ) : logs.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No entries yet today.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {logs.map((l) => (
                  <div key={l.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 700 }}>
                          {l.foodName}{" "}
                          <span style={{ fontWeight: 500, opacity: 0.75 }}>
                            {l.tempC ? `• ${l.tempC} °C` : ""}
                          </span>
                        </div>

                        <div style={{ opacity: 0.8 }}>
                          {formatTime(l.loggedAt)} • {l.status}
                          {l.period ? ` • ${l.period}` : ""}
                        </div>

                        {l.notes ? <div style={{ opacity: 0.85 }}>{l.notes}</div> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <BlastChillModule onSaved={fetchToday} />
      )}
    </div>
  );
}

async function safeReadError(res: Response) {
  try {
    const data = await res.json();
    return data?.error ? String(data.error) : null;
  } catch {
    return null;
  }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
};