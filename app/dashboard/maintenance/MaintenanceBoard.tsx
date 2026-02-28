"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type Person = { id: string; name: string | null; email: string };

type ReadInfo = {
  id: string;
  readAt: string | null;
  admin: Person | null;
};

type CompletedInfo = {
  id: string;
  completedAt: string | null;
  admin: Person | null;
};

export type MaintenanceItem = {
  id: string;
  title: string;
  details: string | null;
  location: string | null;
  equipment: string | null;
  urgency: "H24" | "H48" | "WEEK";
  createdAt: string | null;

  reportedBy: Person | null;
  read: ReadInfo | null;
  completed: CompletedInfo | null;
};

function displayPerson(p: Person | null) {
  if (!p) return "Unknown";
  return p.name?.trim() ? p.name : p.email;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB");
}

function urgencyChip(urgency: MaintenanceItem["urgency"]) {
  const base: CSSProperties = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.4,
  };

  const tokens: Record<MaintenanceItem["urgency"], { label: string; bg: string; border: string; text: string }> = {
    H24: { label: "24 Hours", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", text: "rgba(239,68,68,0.95)" },
    H48: { label: "48 Hours", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "rgba(245,158,11,0.95)" },
    WEEK:{ label: "Week",     bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", text: "rgba(59,130,246,0.95)" },
  };

  const t = tokens[urgency];
  return (
    <span style={{ ...base, background: t.bg, border: `1px solid ${t.border}`, color: t.text }}>
      {t.label}
    </span>
  );
}

function statusChip(item: MaintenanceItem) {
  const base: CSSProperties = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.4,
  };

  const isCompleted = !!item.completed;
  const isRead = !!item.read;

  const t = isCompleted
    ? { label: "Completed", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", text: "rgba(34,197,94,0.95)" }
    : isRead
    ? { label: "Read", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", text: "rgba(59,130,246,0.95)" }
    : { label: "Unread", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "rgba(245,158,11,0.95)" };

  return (
    <span style={{ ...base, background: t.bg, border: `1px solid ${t.border}`, color: t.text }}>
      {t.label}
    </span>
  );
}

export default function MaintenanceBoard({
  isAdmin,
  requests,
}: {
  isAdmin: boolean;
  requests: MaintenanceItem[];
}) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);

  // Create form
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [equipment, setEquipment] = useState("");
  const [urgency, setUrgency] = useState<MaintenanceItem["urgency"]>("WEEK");

  const grouped = useMemo(() => {
    const unread = requests.filter((r) => !r.read && !r.completed);
    const read = requests.filter((r) => r.read && !r.completed);
    const completed = requests.filter((r) => !!r.completed);

    // optional: sort within groups by urgency then createdAt desc
    const urgencyRank: Record<MaintenanceItem["urgency"], number> = { H24: 0, H48: 1, WEEK: 2 };
    const sortFn = (a: MaintenanceItem, b: MaintenanceItem) => {
      const ua = urgencyRank[a.urgency];
      const ub = urgencyRank[b.urgency];
      if (ua !== ub) return ua - ub;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    };

    return {
      unread: [...unread].sort(sortFn),
      read: [...read].sort(sortFn),
      completed: [...completed].sort((a, b) => {
        const ta = a.completed?.completedAt ? new Date(a.completed.completedAt).getTime() : 0;
        const tb = b.completed?.completedAt ? new Date(b.completed.completedAt).getTime() : 0;
        return tb - ta;
      }),
    };
  }, [requests]);

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;

    setBusy(true);
    try {
      const res = await fetch("/api/maintenance/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          details: details.trim() ? details.trim() : null,
          location: location.trim() ? location.trim() : null,
          equipment: equipment.trim() ? equipment.trim() : null,
          urgency,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to create request");
        return;
      }

      setTitle("");
      setDetails("");
      setLocation("");
      setEquipment("");
      setUrgency("WEEK");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markRead(requestId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/maintenance/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
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

  async function markComplete(requestId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/maintenance/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to mark as completed");
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Maintenance</h1>

      {/* Add request */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Log a maintenance item</h2>

        <form onSubmit={createRequest} style={{ display: "grid", gap: 8 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Oven not heating, Missing floor tile)"
            disabled={busy}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
              disabled={busy}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 240 }}
            />
            <input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Equipment (optional)"
              disabled={busy}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 240 }}
            />
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as MaintenanceItem["urgency"])}
              disabled={busy}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 180 }}
            >
              <option value="H24">24 Hours</option>
              <option value="H48">48 Hours</option>
              <option value="WEEK">Week</option>
            </select>
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Details (optional)"
            disabled={busy}
            rows={3}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
          />

          <button type="submit" className="btn" disabled={busy || !title.trim()}>
            {busy ? "Saving..." : "Add maintenance item"}
          </button>
        </form>
      </div>

      <Section title={`Unread (Admin has not read) • ${grouped.unread.length}`}>
        {grouped.unread.length === 0 ? (
          <Empty text="Nothing unread right now." />
        ) : (
          grouped.unread.map((i) => (
            <Row
              key={i.id}
              item={i}
              isAdmin={isAdmin}
              busy={busy}
              onRead={markRead}
              onComplete={markComplete}
            />
          ))
        )}
      </Section>

      <Section title={`Read (not completed) • ${grouped.read.length}`}>
        {grouped.read.length === 0 ? (
          <Empty text="Nothing in progress right now." />
        ) : (
          grouped.read.map((i) => (
            <Row
              key={i.id}
              item={i}
              isAdmin={isAdmin}
              busy={busy}
              onRead={markRead}
              onComplete={markComplete}
            />
          ))
        )}
      </Section>

      <Section title={`Completed • ${grouped.completed.length}`}>
        {grouped.completed.length === 0 ? (
          <Empty text="No completed items yet." />
        ) : (
          grouped.completed.map((i) => (
            <Row
              key={i.id}
              item={i}
              isAdmin={isAdmin}
              busy={busy}
              onRead={markRead}
              onComplete={markComplete}
            />
          ))
        )}
      </Section>

      <div style={{ marginTop: 20, fontSize: 12, opacity: 0.75 }}>
        Tip: Staff log maintenance. Admin acknowledges (Read) and then marks Completed for full accountability.
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
}

function Row({
  item,
  isAdmin,
  busy,
  onRead,
  onComplete,
}: {
  item: MaintenanceItem;
  isAdmin: boolean;
  busy: boolean;
  onRead: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const reportedBy = displayPerson(item.reportedBy);

  const showRead = item.read ? `Read by ${displayPerson(item.read.admin)} • ${fmtDateTime(item.read.readAt)}` : null;
  const showCompleted = item.completed
    ? `Completed by ${displayPerson(item.completed.admin)} • ${fmtDateTime(item.completed.completedAt)}`
    : null;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {item.title}{" "}
            <span style={{ fontWeight: 500, opacity: 0.85 }}>
              • {statusChip(item)} • {urgencyChip(item.urgency)}
            </span>
          </div>

          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
            Reported by {reportedBy}
            {item.createdAt ? <> • {fmtDateTime(item.createdAt)}</> : null}
          </div>

          {(item.location || item.equipment) && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              {item.location ? <span><strong>Location:</strong> {item.location}</span> : null}
              {item.location && item.equipment ? <span> • </span> : null}
              {item.equipment ? <span><strong>Equipment:</strong> {item.equipment}</span> : null}
            </div>
          )}

          {item.details ? (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
              {item.details}
            </div>
          ) : null}

          {showRead ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              <strong>{showRead}</strong>
            </div>
          ) : null}

          {showCompleted ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
              <strong>{showCompleted}</strong>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Admin actions */}
          {isAdmin && !item.read && !item.completed && (
            <button type="button" className="btn" disabled={busy} onClick={() => onRead(item.id)}>
              ✅ Mark read
            </button>
          )}

          {isAdmin && !item.completed && (
            <button type="button" className="btn" disabled={busy} onClick={() => onComplete(item.id)}>
              ✅ Mark completed
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function displayPerson(p: Person | null) {
    if (!p) return "Unknown";
    return p.name?.trim() ? p.name : p.email;
  }

  function fmtDateTime(iso: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-GB");
  }

  function urgencyChip(urgency: MaintenanceItem["urgency"]) {
    const base: CSSProperties = {
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.4,
    };

    const tokens: Record<
      MaintenanceItem["urgency"],
      { label: string; bg: string; border: string; text: string }
    > = {
      H24: {
        label: "24 Hours",
        bg: "rgba(239,68,68,0.12)",
        border: "rgba(239,68,68,0.35)",
        text: "rgba(239,68,68,0.95)",
      },
      H48: {
        label: "48 Hours",
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(245,158,11,0.35)",
        text: "rgba(245,158,11,0.95)",
      },
      WEEK: {
        label: "Week",
        bg: "rgba(59,130,246,0.12)",
        border: "rgba(59,130,246,0.35)",
        text: "rgba(59,130,246,0.95)",
      },
    };

    const t = tokens[urgency];
    return (
      <span style={{ ...base, background: t.bg, border: `1px solid ${t.border}`, color: t.text }}>
        {t.label}
      </span>
    );
  }

  function statusChip(item: MaintenanceItem) {
    const base: CSSProperties = {
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.4,
    };

    const isCompleted = !!item.completed;
    const isRead = !!item.read;

    const t = isCompleted
      ? {
          label: "Completed",
          bg: "rgba(34,197,94,0.12)",
          border: "rgba(34,197,94,0.35)",
          text: "rgba(34,197,94,0.95)",
        }
      : isRead
      ? {
          label: "Read",
          bg: "rgba(59,130,246,0.12)",
          border: "rgba(59,130,246,0.35)",
          text: "rgba(59,130,246,0.95)",
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
}