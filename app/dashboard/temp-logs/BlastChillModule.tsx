"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./blastchill.module.scss";
import { usePropertySettings } from "@/src/lib/usePropertySettings";

type FoodTempStatus = "OK" | "OUT_OF_RANGE";

function fmtUKDateTimeNoSeconds(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function notesForDisplay(raw: string | null | undefined) {
  if (!raw) return null;

  const cleaned = raw
    .replace(/\[(BLAST_CHILL_START|BLAST_CHILL_END)\]/g, "")
    .replace(/\[(BC:[^\]]+|LEGACY_START:[^\]]+)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length ? `NOTES: ${cleaned}` : null;
}

type OpenBlast = {
  id: string;
  batchId: string | null; // can be null for legacy starts
  foodName: string;
  startAt: string; // ISO
  startTempC: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdBy: { id: string; name: string | null; email: string } | null;
};

type TodayBatch = {
  batchId: string;
  foodName: string;
  notes: string | null;
  startAt: string | null;
  startTempC: string | null;
  endAt: string;
  endTempC: string | null;
  status: string | null;
  startBy: string | null;
  endBy: string | null;
};

function minutesBetweenLocal(startLocal: string, endLocal: string) {
  const a = new Date(startLocal).getTime();
  const b = new Date(endLocal).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function minutesBetweenISO(startISO: string | null, endISO: string | null) {
  if (!startISO || !endISO) return null;
  const a = new Date(startISO).getTime();
  const b = new Date(endISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function toISOFromLocal(local: string) {
  // local = "YYYY-MM-DDTHH:mm"
  const d = new Date(local);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function toLocalInputValueFromISO(iso: string) {
  // ISO -> "YYYY-MM-DDTHH:mm" in local time
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatLocal(local: string) {
  if (!local) return "Select date/time";
  const d = new Date(local);
  if (!Number.isFinite(d.getTime())) return "Select date/time";
  return d.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function openDateTimePicker(input: HTMLInputElement | null) {
  if (!input) return;
  // @ts-ignore - Chromium supports showPicker()
  if (typeof input.showPicker === "function") input.showPicker();
  else {
    input.focus();
    input.click();
  }
}

function newBatchId() {
  return `bc_${Math.random().toString(36).slice(2, 10)}`;
}

function displayPerson(p: { name: string | null; email: string } | null) {
  if (!p) return "Unknown";
  return p.name?.trim() ? p.name : p.email;
}

export default function BlastChillModule({
  onSaved,
}: {
  onSaved: () => Promise<void> | void;
}) {
  const { settings } = usePropertySettings();

  // Fallbacks until settings loads
  const targetC = settings ? settings.blastChillTargetTenthC / 10 : 5;
  const maxMins = settings ? settings.blastChillMaxMinutes : 90;

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [open, setOpen] = useState<OpenBlast[]>([]);
  const [loadingOpen, setLoadingOpen] = useState(false);

  const [todayDone, setTodayDone] = useState<TodayBatch[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);

  // Form state
  const [foodName, setFoodName] = useState("");
  const [startAt, setStartAt] = useState<string>(""); // "YYYY-MM-DDTHH:mm"
  const [startTempC, setStartTempC] = useState<string>("");
  const [finishAt, setFinishAt] = useState<string>("");
  const [finishTempC, setFinishTempC] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Batch identity (ties START + END together even if names repeat)
  // Init empty to avoid hydration mismatch; set on mount
  const [batchId, setBatchId] = useState<string>("");

  const [isFinishingExisting, setIsFinishingExisting] = useState(false);

  // Legacy support: if user selects an open item that has no batchId, track its DB id.
  // When saving FINISH we tag END with [LEGACY_START:<id>]
  const [legacyStartId, setLegacyStartId] = useState<string | null>(null);

  // Hidden inputs for native picker modal
  const startRef = useRef<HTMLInputElement | null>(null);
  const finishRef = useRef<HTMLInputElement | null>(null);

  async function loadOpen() {
    setLoadingOpen(true);
    try {
      const r = await fetch("/api/temp-logs/blast/open", { cache: "no-store" });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(data?.error || "Failed to load open blast chills.");
      setOpen(Array.isArray(data.open) ? (data.open as OpenBlast[]) : []);
    } catch {
      setOpen([]);
    } finally {
      setLoadingOpen(false);
    }
  }

  async function loadTodayDone() {
    setLoadingToday(true);
    try {
      const r = await fetch("/api/temp-logs/blast/today", { cache: "no-store" });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(data?.error || "Failed to load today’s blast chills.");
      setTodayDone(Array.isArray(data.today) ? (data.today as TodayBatch[]) : []);
    } catch {
      setTodayDone([]);
    } finally {
      setLoadingToday(false);
    }
  }

  // One-time: make placeholders readable inside this module
  useEffect(() => {
    const styleId = "blast-chill-placeholder-style";
    if (document.getElementById(styleId)) return;

    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `
      .blastChillWrap input::placeholder,
      .blastChillWrap textarea::placeholder {
        color: rgba(255,255,255,0.68) !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(el);

    return () => {
      try {
        el.parentNode?.removeChild(el);
      } catch {
        // ignore
      }
    };
  }, []);

  // Avoid hydration mismatch: generate batchId client-side only
  useEffect(() => {
    setBatchId(newBatchId());
  }, []);

  // Load open + today on mount
  useEffect(() => {
    loadOpen();
    loadTodayDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = useMemo(() => {
    if (!startAt || !finishAt) return null;
    return minutesBetweenLocal(startAt, finishAt);
  }, [startAt, finishAt]);

  const computedStatus: FoodTempStatus = useMemo(() => {
    const ft = Number(finishTempC);
    const tempFail = Number.isFinite(ft) ? ft > targetC : false;
    const timeFail = minutes != null ? minutes > maxMins : false;
    const orderFail = minutes != null ? minutes < 0 : false;
    return tempFail || timeFail || orderFail ? "OUT_OF_RANGE" : "OK";
  }, [finishTempC, minutes, targetC, maxMins]);

  function resetAllForNext() {
    setFoodName("");
    setStartAt("");
    setStartTempC("");
    setFinishAt("");
    setFinishTempC("");
    setNotes("");
    setLegacyStartId(null);
    setIsFinishingExisting(false);
    setBatchId(newBatchId()); // safe post-mount
  }

  async function saveStartOnly() {
    setMsg(null);

    // Guard: batchId must exist (prevents “bad starts” going forward)
    if (!batchId) return setMsg("Please wait a moment — preparing batch ID…");

    const name = foodName.trim();
    if (!name) return setMsg("Food / dish name is required.");
    if (!startAt) return setMsg("Start date/time is required.");

    const startISO = toISOFromLocal(startAt);
    if (!startISO) return setMsg("Invalid start date/time.");

    const st = Number(startTempC);
    if (!Number.isFinite(st)) return setMsg("Start temp is required and must be a valid number.");

    setBusy(true);
    try {
      const extraNotes = notes.trim() ? ` ${notes.trim()}` : "";
      const res = await fetch("/api/temp-logs/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: name,
          tempC: st,
          period: null,
          status: "OK",
          loggedAt: startISO,
          notes: `[BLAST_CHILL_START][BC:${batchId}]${extraNotes}`.trim(),
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({} as any));
        throw new Error(e?.error || "Failed to save Blast Chill START.");
      }

      setMsg("START saved. This batch is now open for completion.");
      resetAllForNext();
      await loadOpen();
      await loadTodayDone();
      await onSaved();
    } catch (err: any) {
      setMsg(err?.message || "Save START failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFinishOnly() {
    setMsg(null);

    // Guard: must have batchId OR legacyStartId when finishing
    if (!batchId && !legacyStartId) return setMsg("Please select an open batch to finish.");

    const name = foodName.trim();
    if (!name) return setMsg("Food / dish name is required.");
    if (!startAt) return setMsg("Start date/time is required (select an open batch or set it).");
    if (!finishAt) return setMsg("Finish date/time is required.");

    const startISO = toISOFromLocal(startAt);
    const finishISO = toISOFromLocal(finishAt);
    if (!startISO || !finishISO) return setMsg("Invalid date/time selected.");

    const mins = minutes;
    if (mins == null) return setMsg("Could not calculate minutes (check your times).");
    if (mins < 0) return setMsg("Finish time must be after start time.");

    const st = Number(startTempC);
    if (!Number.isFinite(st)) return setMsg("Start temp is required and must be a valid number.");
    const ft = Number(finishTempC);
    if (!Number.isFinite(ft)) return setMsg("Finish temp is required and must be a valid number.");

    const legacyTag = legacyStartId ? `[LEGACY_START:${legacyStartId}]` : "";
    const bcTag = !legacyStartId && batchId ? `[BC:${batchId}]` : "";

    setBusy(true);
    try {
      const extraNotes = notes.trim() ? ` ${notes.trim()}` : "";
      const endRes = await fetch("/api/temp-logs/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: name,
          tempC: ft,
          period: null,
          status: computedStatus,
          loggedAt: finishISO,
          notes: `[BLAST_CHILL_END]${bcTag}${legacyTag}${extraNotes} (mins=${mins})`.trim(),
        }),
      });

      if (!endRes.ok) {
        const e = await endRes.json().catch(() => ({} as any));
        throw new Error(e?.error || "Failed to save Blast Chill FINISH.");
      }

      setMsg(computedStatus === "OUT_OF_RANGE" ? "FINISH saved — OUT OF RANGE (amber)." : "FINISH saved — OK.");
      resetAllForNext();
      await loadOpen();
      await loadTodayDone();
      await onSaved();
    } catch (err: any) {
      setMsg(err?.message || "Save FINISH failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="blastChillWrap" style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Blast chilling</h2>

      <div style={{ opacity: 0.85, marginTop: 6 }}>
        Requirement (from Settings): Finish temp ≤ <b>{targetC}°C</b> within <b>{maxMins} minutes</b>
      </div>

      {/* hidden inputs to trigger native date/time picker modal */}
      <input
        ref={startRef}
        type="datetime-local"
        value={startAt}
        onChange={(e) => setStartAt(e.target.value)}
        style={hiddenInputStyle}
      />
      <input
        ref={finishRef}
        type="datetime-local"
        value={finishAt}
        onChange={(e) => setFinishAt(e.target.value)}
        style={hiddenInputStyle}
      />

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {/* OPEN LIST */}
        <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>Open blast chills</div>
            <button type="button" onClick={loadOpen} disabled={loadingOpen} style={buttonStyle}>
              {loadingOpen ? "Loading…" : "Refresh"}
            </button>
          </div>

          {open.length === 0 ? (
            <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>No open blast chills.</div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {open.slice(0, 30).map((o) => {
                const isLegacy = !o.batchId;
                return (
                  <div key={o.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>{o.foodName}</div>
                      {isLegacy ? (
                        <div
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.18)",
                            fontSize: 12,
                            fontWeight: 900,
                            opacity: 0.85,
                          }}
                          title="Older start logged before batch IDs were enforced"
                        >
                          LEGACY
                        </div>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      <b>Start:</b> {fmtUKDateTimeNoSeconds(o.startAt)}
                      {o.startTempC ? ` • ${o.startTempC}°C` : ""}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      <b>Started by:</b>{" "}
                      <span className={styles.highlightedAmber}>{displayPerson(o.createdBy)}</span>
                    </div>

                    {notesForDisplay(o.notes) ? (
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>{notesForDisplay(o.notes)}</div>
                    ) : null}

                    <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={buttonStyle}
                        onClick={() => {
                          setFoodName(o.foodName);
                          setStartAt(toLocalInputValueFromISO(o.startAt));
                          setStartTempC(o.startTempC ?? "");

                          if (o.batchId) {
                            setBatchId(o.batchId);
                            setLegacyStartId(null);
                          } else {
                            setLegacyStartId(o.id);
                          }

                          setIsFinishingExisting(true);
                          setMsg(null);
                        }}
                      >
                        Finish this batch
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FORM */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Food / Dish Name</label>
            <input
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g., Beef lasagne"
              style={{
                ...inputStyle,
                opacity: isFinishingExisting ? 0.7 : 1,
                cursor: isFinishingExisting ? "not-allowed" : "text",
              }}
              disabled={isFinishingExisting}
            />
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Corrective action, probe ref, etc."
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Start date/time</label>
            <button
              type="button"
              onClick={() => openDateTimePicker(startRef.current)}
              style={pickerButtonStyle}
              disabled={isFinishingExisting}
            >
              {formatLocal(startAt)}
            </button>
          </div>

          <div>
            <label style={labelStyle}>Start temp (°C) *</label>
            <input
              value={startTempC}
              onChange={(e) => setStartTempC(e.target.value)}
              inputMode="decimal"
              placeholder="required"
              style={inputStyle}
              disabled={isFinishingExisting}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Finish date/time</label>
            <button type="button" onClick={() => openDateTimePicker(finishRef.current)} style={pickerButtonStyle}>
              {formatLocal(finishAt)}
            </button>
          </div>

          <div>
            <label style={labelStyle}>Finish temp (°C) *</label>
            <input
              value={finishTempC}
              onChange={(e) => setFinishTempC(e.target.value)}
              inputMode="decimal"
              placeholder="required"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid",
              fontWeight: 900,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: computedStatus === "OUT_OF_RANGE" ? "rgba(245, 158, 11, 0.22)" : "rgba(16, 185, 129, 0.18)",
              borderColor:
                computedStatus === "OUT_OF_RANGE" ? "rgba(245, 158, 11, 0.70)" : "rgba(16, 185, 129, 0.70)",
              color: "inherit",
            }}
            role="status"
            aria-live="polite"
            title="Auto-calculated"
          >
            <span>Minutes:</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{minutes == null ? "—" : minutes}</span>
          </div>

          <div style={{ opacity: 0.9 }}>
            Status:{" "}
            <b style={{ color: computedStatus === "OUT_OF_RANGE" ? "#fbbf24" : "inherit" }}>{computedStatus}</b>
            {minutes != null && minutes < 0 ? " (finish must be after start)" : ""}
          </div>

          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Batch:{" "}
            <span style={{ fontFamily: "monospace" }}>
              {legacyStartId ? `LEGACY:${legacyStartId}` : batchId || "—"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={saveStartOnly} disabled={busy || !batchId} style={buttonStyle}>
            {busy ? "Saving…" : "Save START"}
          </button>

          <button
            type="button"
            onClick={saveFinishOnly}
            disabled={busy || (!batchId && !legacyStartId)}
            style={buttonStyle}
          >
            {busy ? "Saving…" : "Save FINISH"}
          </button>
        </div>

        {/* TODAY (completed) */}
        <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>Today’s completed blast chills</div>
            <button type="button" onClick={loadTodayDone} disabled={loadingToday} style={buttonStyle}>
              {loadingToday ? "Loading…" : "Refresh"}
            </button>
          </div>

          {todayDone.length === 0 ? (
            <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>No completed blast chills yet today.</div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {todayDone.slice(0, 50).map((b) => {
                const mins = minutesBetweenISO(b.startAt, b.endAt);
                return (
                  <div key={b.batchId} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 900 }}>{b.foodName}</div>

                    {notesForDisplay(b.notes) ? (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{notesForDisplay(b.notes)}</div>
                    ) : null}

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      <b>Logged by:</b>{" "}
                      {b.startBy ? (
                        <>
                          START{" "}
                          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--brand)", opacity: 1 }}>
                            {b.startBy}
                          </span>
                        </>
                      ) : (
                        "START —"
                      )}
                      {b.endBy ? (
                        <>
                          {" "}
                          → END{" "}
                          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--brand)", opacity: 1 }}>
                            {b.endBy}
                          </span>
                        </>
                      ) : (
                        ""
                      )}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                      <b>Start:</b> {b.startAt ? fmtUKDateTimeNoSeconds(b.startAt) : "—"}
                      {b.startTempC ? (
                        <span style={{ opacity: 0.9, color: "var(--brand)", fontWeight: 800, fontSize: 13 }}>
                          {" "}
                          • {b.startTempC}°C
                        </span>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                      <b>End:</b> {fmtUKDateTimeNoSeconds(b.endAt)}
                      {b.endTempC ? (
                        <span style={{ opacity: 0.9, color: "var(--brand)", fontWeight: 800, fontSize: 13 }}>
                          {" "}
                          • {b.endTempC}°C
                        </span>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.95 }}>
                        Status: <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.status ?? "—"}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.18)",
                            fontWeight: 900,
                            background:
                              b.status === "OUT_OF_RANGE"
                                ? "rgba(245,158,11,0.18)"
                                : "rgba(16,185,129,0.14)",
                          }}
                        >
                          {b.status ?? "OK"}
                        </div>

                        {mins != null && (
                          <div
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(255,255,255,0.18)",
                              fontWeight: 900,
                              background: "rgba(255,255,255,0.08)",
                            }}
                          >
                            {mins} min
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {msg ? (
          <div style={{ padding: 12, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10 }}>
            {msg}
          </div>
        ) : null}
      </div>
    </section>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 700,
  marginBottom: 6,
  color: "rgba(255,255,255,0.92)",
};

const pickerButtonStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 800,
  cursor: "pointer",
};

const buttonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 800,
};

const hiddenInputStyle: CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 0,
  height: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "rgba(255,255,255,0.92)",
  outline: "none",
};