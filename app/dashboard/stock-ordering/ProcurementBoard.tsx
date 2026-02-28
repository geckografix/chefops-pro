"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type Person = { id: string; name: string | null; email: string };

export type ProcurementItem = {
  id: string;
  category: "FOOD" | "SUPPLIES";
  status: "REQUESTED" | "ORDERED" | "REJECTED" | "DELIVERED" | "CANCELED";
  itemName: string;
  quantity: string | null; // serialized from Prisma Decimal
  unit: string | null;
  neededBy: string | null; // ISO string
  notes: string | null;
  rejectedReason: string | null;
  rejectedNote: string | null;
  decidedAt: string | null; // ISO string
  deliveredAt: string | null; // ISO string
  createdAt: string | null; // ISO string
  updatedAt: string | null; // ISO string

  requestedBy: Person;
  decidedBy: Person | null;
};

export default function ProcurementBoard({
  activeTab,
  isAdmin,
  items,
}: {
  activeTab: "food" | "supplies";
  isAdmin: boolean;
  items: ProcurementItem[];
}) {
  const router = useRouter();

  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("MENU_CHANGE");
  const [rejectNote, setRejectNote] = useState<string>("");

  const category = activeTab === "supplies" ? "SUPPLIES" : "FOOD";

  const grouped = useMemo(() => {
    const requested = items.filter((i) => i.status === "REQUESTED");
    const ordered = items.filter((i) => i.status === "ORDERED");
    const rejected = items.filter((i) => i.status === "REJECTED");
    const other = items.filter(
      (i) => i.status !== "REQUESTED" && i.status !== "ORDERED" && i.status !== "REJECTED"
    );
    return { requested, ordered, rejected, other };
  }, [items]);

  function fmtQty(q: string | null) {
  return q ? q : "";
}

  function chip(status: ProcurementItem["status"]) {
  const base: CSSProperties = {
    display: "inline-block",
    padding: "var(--proc-chip-pad-y) var(--proc-chip-pad-x)",
    borderRadius: "var(--proc-chip-radius)",
    fontSize: "var(--proc-chip-font-size)",
    fontWeight: 800,
    lineHeight: 1.4,
  };

  const tokensByStatus: Record<
    ProcurementItem["status"],
    { label: string; bg: string; border: string; text: string }
  > = {
    REQUESTED: {
      label: "Requested",
      bg: "var(--proc-requested-bg)",
      border: "var(--proc-requested-border)",
      text: "var(--proc-requested-text)",
    },
    ORDERED: {
      label: "Ordered",
      bg: "var(--proc-ordered-bg)",
      border: "var(--proc-ordered-border)",
      text: "var(--proc-ordered-text)",
    },
    REJECTED: {
      label: "Not ordering",
      bg: "var(--proc-rejected-bg)",
      border: "var(--proc-rejected-border)",
      text: "var(--proc-rejected-text)",
    },
    DELIVERED: {
      label: "Delivered",
      bg: "var(--proc-delivered-bg)",
      border: "var(--proc-delivered-border)",
      text: "var(--proc-delivered-text)",
    },
    CANCELED: {
      label: "Canceled",
      bg: "var(--proc-canceled-bg)",
      border: "var(--proc-canceled-border)",
      text: "var(--proc-canceled-text)",
    },
  };

  const t = tokensByStatus[status] ?? {
    label: String(status),
    bg: "var(--proc-default-bg)",
    border: "var(--proc-default-border)",
    text: "var(--proc-default-text)",
  };

  return (
    <span
      style={{
        ...base,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.text,
      }}
    >
      {t.label}
    </span>
  );
}

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    const name = itemName.trim();
    if (!name) return;

    setBusy(true);
    try {
      const res = await fetch("/api/procurement/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          itemName: name,
          quantity: quantity.trim() ? quantity.trim() : null,
          unit: unit.trim() ? unit.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to add request");
        return;
      }

      // Quick-entry UX: clear + keep focus in first field
      setItemName("");
      setQuantity("");
      setUnit("");
      setNotes("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markOrdered(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/procurement/requests/ordered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to mark as ordered");
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

function openReject(id: string) {
    setRejectId(id);
    setRejectReason("MENU_CHANGE");
    setRejectNote("");
    setRejectOpen(true);
  }

  function closeReject() {
    setRejectOpen(false);
    setRejectId(null);
    setRejectNote("");
  }

  async function submitReject() {
    if (!rejectId) return;

    // If OTHER, note is mandatory (API enforces too, but we’ll help the user)
    if (rejectReason === "OTHER" && !rejectNote.trim()) {
      alert("Please add a note when the reason is OTHER.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/procurement/requests/rejected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rejectId,
          rejectedReason: rejectReason,
          rejectedNote: rejectNote.trim() ? rejectNote.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to reject item");
        return;
      }

      closeReject();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Stock & Ordering</h1>

      {/* Tabs */}
      <div className="tabBar" style={{ marginBottom: 16 }}>
        <button
  type="button"
  className={`tab ${activeTab === "food" ? "tabActive" : ""}`}
  onClick={() => router.push("/dashboard/stock-ordering?tab=food")}
  disabled={busy}
  aria-current={activeTab === "food" ? "page" : undefined}
>
  Food
</button>
        <button
  type="button"
  className={`tab ${activeTab === "supplies" ? "tabActive" : ""}`}
  onClick={() => router.push("/dashboard/stock-ordering?tab=supplies")}
  disabled={busy}
  aria-current={activeTab === "supplies" ? "page" : undefined}
>
  Supplies
</button>
      </div>

      {/* Add request */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>
          Add {activeTab === "supplies" ? "supply" : "food"} request
        </h2>

        <form onSubmit={createRequest} style={{ display: "grid", gap: 8 }}>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Product name (e.g. Chicken breast, Blue roll)"
            disabled={busy}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty (optional)"
              disabled={busy}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 160 }}
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit (optional, e.g. kg, case)"
              disabled={busy}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 220 }}
            />
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            disabled={busy}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />

          <button
  type="submit"
  className="btn"
  disabled={busy || !itemName.trim()}
>
  {busy ? "Saving..." : "Add request"}
</button>
        </form>
      </div>

      {/* Lists */}
      <Section title="Requested (pending)">
        {grouped.requested.length === 0 ? (
          <Empty />
        ) : (
          grouped.requested.map((i) => (
            <Row key={i.id} item={i} isAdmin={isAdmin} busy={busy} onOrdered={markOrdered} />
          ))
        )}
      </Section>

      <Section title="Ordered">
        {grouped.ordered.length === 0 ? (
          <Empty />
        ) : (
          grouped.ordered.map((i) => <Row key={i.id} item={i} isAdmin={isAdmin} busy={busy} onOrdered={markOrdered} />)
        )}
      </Section>

      <Section title="Not ordering">
        {grouped.rejected.length === 0 ? (
          <Empty />
        ) : (
          grouped.rejected.map((i) => <Row key={i.id} item={i} isAdmin={isAdmin} busy={busy} onOrdered={markOrdered} />)
        )}
      </Section>

      {grouped.other.length > 0 && (
        <Section title="Other">
          {grouped.other.map((i) => (
            <Row key={i.id} item={i} isAdmin={isAdmin} busy={busy} onOrdered={markOrdered} />
          ))}
        </Section>
      )}

{/* ####ADD CODE HERE#### (Reject modal) */}
{rejectOpen && (
  <div
    role="dialog"
    aria-modal="true"
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 50,
    }}
    onClick={closeReject}
  >
    <div
      style={{
        width: "min(560px, 100%)",
        borderRadius: 16,
        background: "#0b1220",
        border: "1px solid rgba(255,255,255,0.12)",
        padding: 14,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 style={{ fontSize: 16, marginBottom: 10 }}>Mark as “Not ordering”</h3>

      <label style={{ display: "block", fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
        Reason (required)
      </label>

      <select
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        disabled={busy}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.06)",
          color: "white",
          marginBottom: 10,
        }}
      >
        <option value="MENU_CHANGE">Menu change</option>
        <option value="OUT_OF_SEASON">Out of season</option>
        <option value="SUPPLIER_OUT_OF_STOCK">Supplier out of stock</option>
        <option value="ALREADY_IN_STOCK">Already in stock</option>
        <option value="BUDGET_COST_CONTROL">Budget / cost control</option>
        <option value="NOT_APPROVED">Not approved</option>
        <option value="OTHER">Other (add note)</option>
      </select>

      <label style={{ display: "block", fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
        Note {rejectReason === "OTHER" ? "(required)" : "(optional)"}
      </label>

      <input
        value={rejectNote}
        onChange={(e) => setRejectNote(e.target.value)}
        disabled={busy}
        placeholder={rejectReason === "OTHER" ? "Please explain..." : "Optional note"}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.06)",
          color: "white",
          marginBottom: 12,
        }}
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" disabled={busy} onClick={closeReject}>
          Cancel
        </button>
        <button type="button" className="btnDanger" disabled={busy} onClick={submitReject}>
          {busy ? "Saving..." : "Confirm not ordering"}
        </button>
      </div>
    </div>
  </div>
)}

      <div style={{ marginTop: 20, fontSize: 12, opacity: 0.75 }}>
  Tip: Staff add items as they run low. Admin marks items as ordered so everyone knows what’s been done.
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

  function Empty() {
    return (
      <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", opacity: 0.7 }}>
        Nothing here yet.
      </div>
    );
  }

  function Row({
    item,
    isAdmin,
    busy,
    onOrdered,
  }: {
    item: ProcurementItem;
    isAdmin: boolean;
    busy: boolean;
    onOrdered: (id: string) => void;
  }) {
    const qty = fmtQty(item.quantity);
    const qtyText = qty ? `${qty}${item.unit ? ` ${item.unit}` : ""}` : item.unit ? item.unit : "";

    return (
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {item.itemName} {qtyText ? <span style={{ fontWeight: 500, opacity: 0.8 }}>({qtyText})</span> : null}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
  Requested by {item.requestedBy?.name || item.requestedBy?.email} • {chip(item.status)}
  {item.createdAt ? (
    <>
      {" "}
      • {new Date(item.createdAt).toLocaleString()}
    </>
  ) : null}
</div>

            {item.status === "REJECTED" && (
              <div style={{ marginTop: 6, fontSize: 12 }}>
                <strong>Reason:</strong> {item.rejectedReason || "—"}
                {item.rejectedNote ? <span> • {item.rejectedNote}</span> : null}
              </div>
            )}

            {item.notes ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{item.notes}</div>
            ) : null}
          </div>

          {/* Admin actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin && item.status === "REQUESTED" && (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => onOrdered(item.id)}
                >
                  ✅ Ordered
                </button>

                <button
                  type="button"
                  className="btnDanger"
                  disabled={busy}
                  onClick={() => openReject(item.id)}
                >
                  ❌ Not ordering
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}
