"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./rotas.module.scss";

type UserPick = { id: string; name: string | null; email: string };

const ROLE_OPTIONS = ["CHEF", "SOUS_CHEF", "CDP", "COMMIS", "KP", "OTHER"] as const;

export default function ShiftBlock({
  shiftId,
  style,
  employeeName,
  timeText,
  titleText,
  isAdmin,

  // Edit support
  users,
  startTime,
  endTime,
  role,
  notes,
  assigneeUserId,
}: {
  shiftId: string;
  style: React.CSSProperties;
  employeeName: string;
  timeText: string;
  titleText: string;
  isAdmin: boolean;

  users?: UserPick[];
  startTime?: string;
  endTime?: string;
  role?: string;
  notes?: string | null;
  assigneeUserId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // modal state
  const [open, setOpen] = useState(false);
  const [editStart, setEditStart] = useState(startTime || "09:00");
  const [editEnd, setEditEnd] = useState(endTime || "17:00");
  const [editRole, setEditRole] = useState(role || "CHEF");
  const [editAssignee, setEditAssignee] = useState<string>(assigneeUserId || "");
  const [editNotes, setEditNotes] = useState(notes || "");
  const [editMsg, setEditMsg] = useState<string | null>(null);

  const userOptions = useMemo(() => {
    const list = users || [];
    return [...list].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [users]);

  async function onDelete() {
    const ok = window.confirm("Delete this shift?");
    if (!ok) return;

    setBusy(true);
    const r = await fetch(`/api/rotas/shift/${shiftId}`, { method: "DELETE" });
    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      alert(data?.error || "Could not delete shift.");
      return;
    }

    router.refresh();
  }

  function openEdit() {
    // refresh modal fields from latest props (safe)
    setEditStart(startTime || "09:00");
    setEditEnd(endTime || "17:00");
    setEditRole(role || "CHEF");
    setEditAssignee(assigneeUserId || "");
    setEditNotes(notes || "");
    setEditMsg(null);
    setOpen(true);
  }

  async function saveEdit() {
    setEditMsg(null);

    if (!editStart || !editEnd) {
      setEditMsg("Start and end time are required.");
      return;
    }

    setBusy(true);
    const r = await fetch(`/api/rotas/shift/${shiftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: editStart,
        endTime: editEnd,
        role: editRole,
        notes: editNotes,
        assigneeUserId: editAssignee || null,
      }),
    });
    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setEditMsg(data?.error || "Could not update shift.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className={styles.shiftBlock} style={style} title={titleText}>
        {isAdmin ? (
          <div className={styles.shiftActions}>
            <button
              type="button"
              className={styles.shiftEditBtn}
              onClick={openEdit}
              disabled={busy}
              aria-label="Edit shift"
              title="Edit shift"
            >
              ✎
            </button>

            <button
              type="button"
              className={styles.shiftDeleteBtn}
              onClick={onDelete}
              disabled={busy}
              aria-label="Delete shift"
              title="Delete shift"
            >
              {busy ? "…" : "×"}
            </button>
          </div>
        ) : null}

        {employeeName ? (
          <>
            <div className={styles.shiftName}>{employeeName}</div>
            <div className={styles.shiftTimeLine}>{timeText}</div>
          </>
        ) : (
          <div className={styles.shiftTimeLine}>{timeText}</div>
        )}
      </div>

      {open ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalTitle}>Edit shift</div>
            {editMsg ? <div className={styles.modalMsg}>{editMsg}</div> : null}

            <div className={styles.modalGrid}>
              <label className={styles.field}>
                <span>Start</span>
                <input value={editStart} onChange={(e) => setEditStart(e.target.value)} placeholder="09:00" />
              </label>

              <label className={styles.field}>
                <span>End</span>
                <input value={editEnd} onChange={(e) => setEditEnd(e.target.value)} placeholder="17:00" />
              </label>

              <label className={styles.field}>
                <span>Role</span>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldWide}>
                <span>Assign to (optional)</span>
                <select value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}>
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
                <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes" />
              </label>
            </div>

            <div className={styles.modalBtns}>
              <button className={styles.addBtn} onClick={saveEdit} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </button>
              <button className={styles.modalCancelBtn} onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

