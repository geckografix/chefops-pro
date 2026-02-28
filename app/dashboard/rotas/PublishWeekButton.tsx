"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./rotas.module.scss";

export default function PublishWeekButton({
  weekStartISO,
  isPublished,
}: {
  weekStartISO: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function doPublish() {
    setMsg(null);
    const ok = window.confirm("Publish next week rota?\n\nStaff will be able to view it.");
    if (!ok) return;

    setBusy(true);
    const r = await fetch("/api/rotas/week/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStartISO }),
    });
    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg(data?.error || "Could not publish.");
      return;
    }

    setMsg("Published. Staff can now view next week.");
    router.refresh();
  }

  async function doUnpublish() {
    setMsg(null);
    const ok = window.confirm("UN-PUBLISH next week rota?\n\nStaff will no longer be able to view it.");
    if (!ok) return;

    setBusy(true);
    const r = await fetch("/api/rotas/week/unpublish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStartISO }),
    });
    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg(data?.error || "Could not unpublish.");
      return;
    }

    setMsg("Unpublished. Staff can no longer view next week.");
    router.refresh();
  }

  return (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {!isPublished ? (
      <button className={styles.addBtn} onClick={doPublish} disabled={busy}>
        {busy ? "Publishing..." : "Publish next week (make LIVE)"}
      </button>
    ) : (
      <button className={styles.addBtn} onClick={doUnpublish} disabled={busy}>
        {busy ? "Unpublishing..." : "Unpublish next week (hide from staff)"}
      </button>
    )}

    {msg ? <div className={styles.addMsg}>{msg}</div> : null}
  </div>
);
}
