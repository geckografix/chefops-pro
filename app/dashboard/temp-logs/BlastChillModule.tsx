"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePropertySettings } from "@/src/lib/usePropertySettings";

type FoodTempStatus = "OK" | "OUT_OF_RANGE";

function minutesBetweenLocal(startLocal: string, endLocal: string) {
  const a = new Date(startLocal).getTime();
  const b = new Date(endLocal).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

function toISOFromLocal(local: string) {
  // local = "YYYY-MM-DDTHH:mm"
  const d = new Date(local);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
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
  // Chromium supports showPicker
  // @ts-ignore
  if (typeof input.showPicker === "function") input.showPicker();
  else {
    input.focus();
    input.click();
  }
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

  const [foodName, setFoodName] = useState("");
  const [startAt, setStartAt] = useState<string>(""); // "YYYY-MM-DDTHH:mm"
  const [startTempC, setStartTempC] = useState<string>("");
  const [finishAt, setFinishAt] = useState<string>("");
  const [finishTempC, setFinishTempC] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [batchId, setBatchId] = useState<string>(() =>
  `bc_${Math.random().toString(36).slice(2, 10)}`
);

  const startRef = useRef<HTMLInputElement | null>(null);
  const finishRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // One-time: make placeholders readable inside this module
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
      el.remove();
    };
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

  async function save() {
    setMsg(null);

    const name = foodName.trim();
    if (!name) return setMsg("Food / dish name is required.");
    if (!startAt) return setMsg("Start date/time is required.");
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

    setBusy(true);
    try {
      const extraNotes = notes.trim() ? ` ${notes.trim()}` : "";

      // START (immutable create)
      const startRes = await fetch("/api/temp-logs/upsert", {
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

      if (!startRes.ok) {
        const e = await startRes.json().catch(() => ({} as any));
        throw new Error(e?.error || "Failed to save Blast Chill START.");
      }

      // END
      const endRes = await fetch("/api/temp-logs/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: name,
          tempC: ft,
          period: null,
          status: computedStatus,
          loggedAt: finishISO,
          notes: `[BLAST_CHILL_END][BC:${batchId}]${extraNotes}`.trim(),
        }),
      });

      if (!endRes.ok) {
        const e = await endRes.json().catch(() => ({} as any));
        throw new Error(e?.error || "Failed to save Blast Chill FINISH.");
      }

      setMsg(computedStatus === "OUT_OF_RANGE" ? "Saved — OUT OF RANGE (amber)." : "Saved — OK.");

      // reset
      setFoodName("");
      setStartAt("");
      setStartTempC("");
      setFinishAt("");
      setFinishTempC("");
      setNotes("");
      setBatchId(`bc_${Math.random().toString(36).slice(2, 10)}`);
      await onSaved();
    } catch (err: any) {
      setMsg(err?.message || "Save failed.");
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
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Food / dish name</label>
            <input
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g., Beef lasagne"
              style={inputStyle}
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
            >
              {formatLocal(startAt)}
            </button>
          </div>
          <div>
            <label style={labelStyle}>Start temp (°C)</label>
            <input
              value={startTempC}
              onChange={(e) => setStartTempC(e.target.value)}
              inputMode="decimal"
              placeholder="required"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Finish date/time</label>
            <button
              type="button"
              onClick={() => openDateTimePicker(finishRef.current)}
              style={pickerButtonStyle}
            >
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
              background:
                computedStatus === "OUT_OF_RANGE"
                  ? "rgba(245, 158, 11, 0.22)"
                  : "rgba(16, 185, 129, 0.18)",
              borderColor:
                computedStatus === "OUT_OF_RANGE"
                  ? "rgba(245, 158, 11, 0.70)"
                  : "rgba(16, 185, 129, 0.70)",
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
            <b style={{ color: computedStatus === "OUT_OF_RANGE" ? "#fbbf24" : "inherit" }}>
              {computedStatus}
            </b>
            {minutes != null && minutes < 0 ? " (finish must be after start)" : ""}
          </div>
        </div>

        <button onClick={save} disabled={busy} style={buttonStyle}>
          {busy ? "Saving…" : "Save blast chill"}
        </button>

        {msg ? (
          <div style={{ padding: 12, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10 }}>
            {msg}
          </div>
        ) : null}
      </div>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  marginBottom: 6,
  color: "rgba(255,255,255,0.92)",
};

const pickerButtonStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.92)", // off-white
  fontWeight: 800,
  cursor: "pointer",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 800,
};

const hiddenInputStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 0,
  height: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "rgba(255,255,255,0.92)", // off-white
  outline: "none",
};