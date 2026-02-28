"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./rotas.module.scss";

type UserPick = { id: string; name: string | null; email: string };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function formatDayLabel(weekStartISO: string, dayIndex: number, dayName: string) {
  const start = new Date(weekStartISO);
  const d = new Date(start);
  d.setDate(d.getDate() + dayIndex);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");

  return `${dayName} (${dd}/${mm})`;
}
export default function AddShiftForm({
  users,
  weekStartISO,
  label,
}: {
  users: UserPick[];
  weekStartISO: string; // ISO string for the Monday of the week being edited
  label: string; // e.g. "This week" or "Next week"
}) {
  const router = useRouter();

  const [dayIndex, setDayIndex] = useState<number>(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [role, setRole] = useState("CHEF");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dangerMsg, setDangerMsg] = useState<string | null>(null);

  const userOptions = useMemo(() => {
    return [...users].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [users]);

  async function submit() {
    setMsg(null);
    setBusy(true);

    const r = await fetch("/api/rotas/shift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart: weekStartISO,
        dayIndex,
        startTime,
        endTime,
        role,
        notes,
        assigneeUserId: assigneeUserId || null,
      }),
    });

    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg(data?.error || "Could not add shift.");
      return;
    }

    setMsg("Shift added.");
    setNotes("");
    router.refresh();
  }
async function clearWeek() {
  setDangerMsg(null);

  const ok = window.confirm(
    `Clear ALL shifts for ${label}?\n\nThis will remove every shift in that week for this property.`
  );
  if (!ok) return;

  setBusy(true);
  const r = await fetch("/api/rotas/week/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weekStart: weekStartISO }),
  });
  setBusy(false);

  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    setDangerMsg(data?.error || "Could not clear this week.");
    return;
  }

  setDangerMsg("Week cleared.");
  router.refresh();
}
  return (
    <div className={styles.addBox}>
      <div className={styles.addTitle}>
        Add shift (Admin) — {label}
        <span style={{ marginLeft: 8, color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
          ({new Date(weekStartISO).toLocaleDateString("en-GB")})
        </span>
      </div>

      {msg ? <div className={styles.addMsg}>{msg}</div> : null}
      {dangerMsg ? <div className={styles.addMsg}>{dangerMsg}</div> : null}
      <div className={styles.addGrid}>
        <label className={styles.field}>
          <span>Day</span>
          <select value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))}>
            {DAYS.map((d, i) => (
                <option key={d} value={i}>
                    {formatDayLabel(weekStartISO, i, d)}
                </option>
          ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Start</span>
          <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="09:00" />
        </label>

        <label className={styles.field}>
          <span>End</span>
          <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="17:00" />
        </label>

        <label className={styles.field}>
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="CHEF">CHEF</option>
            <option value="SOUS_CHEF">SOUS_CHEF</option>
            <option value="CDP">CDP</option>
            <option value="COMMIS">COMMIS</option>
            <option value="KP">KP</option>
            <option value="OTHER">OTHER</option>
          </select>
        </label>

        <label className={styles.fieldWide}>
          <span>Assign to (optional)</span>
          <select value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)}>
            <option value="">Unassigned</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name || u.email) + " (" + u.email + ")"}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldWide}>
          <span>Notes (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Training / split shift / cover"
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
  <button className={styles.addBtn} onClick={submit} disabled={busy}>
    {busy ? "Working..." : "Add shift"}
  </button>

  <button
    className={styles.addBtn}
    onClick={clearWeek}
    disabled={busy}
    style={{ background: "rgba(239, 68, 68, 0.14)", borderColor: "rgba(239, 68, 68, 0.25)" }}
  >
    Clear this week rota
  </button>
</div>
    </div>
  );
}
