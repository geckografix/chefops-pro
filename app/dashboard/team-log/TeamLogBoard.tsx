"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type Person = { id: string; name: string | null; email: string };
type ReadRec = {
  id: string;
  readerId: string;
  readAt: string | null;
  reader: Person | null;
};

export type TeamHandoverItem = {
  id: string;
  message: string;
  handoverDate: string | null; // ISO
  createdAt: string | null; // ISO
  author: Person | null;
  reads: ReadRec[];
};

function chip(isRead: boolean) {
  const base: CSSProperties = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.4,
  };

  const t = isRead
    ? {
        label: "Read",
        bg: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.35)",
        text: "rgba(34,197,94,0.95)",
      }
    : {
        label: "Unread",
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(245,158,11,0.35)",
        text: "rgba(245,158,11,0.95)",
      };

  return (
    <span style={{ ...base, background: t.bg, border: `1px solid ${t.border}`, color: t.text }}>
      {t.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function displayPerson(p: Person | null) {
  if (!p) return "Unknown";
  return p.name?.trim() ? p.name : p.email;
}
export default function TeamLogBoard({
  currentUserId,
  handovers,
}: {
  currentUserId: string;
  handovers: TeamHandoverItem[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const { grouped, unread, read } = useMemo(() => {
    const unread = handovers.filter(
      (h) => !(h.reads?.some((r) => r.readerId === currentUserId) ?? false)
    );
    const read = handovers.filter(
      (h) => (h.reads?.some((r) => r.readerId === currentUserId) ?? false)
    );

    // group by handoverDate (start-of-day UTC stored server-side)
    const map = new Map<string, TeamHandoverItem[]>();
    for (const h of handovers) {
      const key = h.handoverDate ?? "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }

    const grouped = Array.from(map.entries()).map(([dateISO, items]) => ({ dateISO, items }));
    return { grouped, unread, read };
  }, [handovers, currentUserId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = message.trim();
    if (!msg) return;

    setBusy(true);
    try {
      const res = await fetch("/api/team-log/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to add handover");
        return;
      }

      setMessage("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markRead(handoverId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/team-log/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handoverId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to mark as read");
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Team Log (Handover)</h1>

      {/* Add handover */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Add handover note</h2>
        <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the PM handover for the AM team…"
            disabled={busy}
            rows={4}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
          />
          <button type="submit" className="btn" disabled={busy || !message.trim()}>
            {busy ? "Saving..." : "Add handover"}
          </button>
        </form>
      </div>

      {/* Stock & Ordering style sections */}
      <Section title={`Unread (needs action) • ${unread.length}`}>
        {unread.length === 0 ? (
          <Empty text="Nothing unread. You're up to date." />
        ) : (
          unread.map((h) => <Row key={h.id} h={h} />)
        )}
      </Section>

      <Section title={`Read • ${read.length}`}>
        {read.length === 0 ? (
          <Empty text="No read confirmations yet." />
        ) : (
          read.map((h) => <Row key={h.id} h={h} />)
        )}
      </Section>

      {/* History by day (keep this for context + audit trail) */}
      <Section title="History by day (last 14 days)">
        {grouped.length === 0 ? (
          <Empty text="No handovers yet." />
        ) : (
          grouped.map((day) => (
            <div key={day.dateISO} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85, marginBottom: 8 }}>
                {fmtDate(day.dateISO === "unknown" ? null : day.dateISO) || "Day"}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {day.items.map((h) => (
                  <Row key={h.id} h={h} />
                ))}
              </div>
            </div>
          ))
        )}
      </Section>

      <div style={{ marginTop: 20, fontSize: 12, opacity: 0.75 }}>
        Tip: PM team leave one or more notes. AM team tick each note once read. Only the most recent 14 days are kept.
      </div>
    </div>
  );

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h3>
        <div style={{ display: "grid", gap: 8 }}>{children}</div>
      </div>
    );
  }

  function Empty({ text }: { text: string }) {
    return (
      <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", opacity: 0.7 }}>
        {text}
      </div>
    );
  }

  function Row({ h }: { h: TeamHandoverItem }) {
    const isRead = h.reads?.some((r) => r.readerId === currentUserId) ?? false;
    const readBy = (h.reads ?? [])
  .map((r) => displayPerson(r.reader))
  .filter(Boolean);

const readByText = readBy.length > 0 ? readBy.join(", ") : "";
    const authorName = h.author?.name || h.author?.email || "Unknown";

    return (
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.85 }}>
              {authorName} • {h.createdAt ? fmtTime(h.createdAt) : ""} • {chip(isRead)}
            </div>

            <div style={{ marginTop: 8, fontSize: 14, whiteSpace: "pre-wrap" }}>{h.message}</div>
            {/* ####ADD CODE HERE#### (Read by list for accountability) */}
                {(h.reads?.length ?? 0) > 0 ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                    <strong>Read by:</strong> {readByText}
                    <span style={{ opacity: 0.75 }}> ({h.reads.length})</span>
                </div>
                ) : (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    <strong>Read by:</strong> nobody yet
                </div>
                )}

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {h.handoverDate ? `Day: ${fmtDate(h.handoverDate)}` : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isRead && (
              <button type="button" className="btn" disabled={busy} onClick={() => markRead(h.id)}>
                ✅ Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}