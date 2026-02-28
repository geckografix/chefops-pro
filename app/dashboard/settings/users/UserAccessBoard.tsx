"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Member = {
  id: string;
  role: "PROPERTY_ADMIN" | "PROPERTY_USER";
  isActive: boolean;
  createdAt: string | Date;
  user: { id: string; name: string | null; email: string };
};

type PendingInvite = {
  id: string;
  email: string;
  role: "PROPERTY_ADMIN" | "PROPERTY_USER";
  publicToken: string | null;
  expiresAt: string | Date;
  createdAt: string | Date;
};

function displayName(m: Member) {
  const n = m.user?.name?.trim();
  return n ? n : m.user.email;
}

function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB").format(d);
}

export default function UserAccessBoard({
  members,
  pendingInvites,
  baseUrl,
}: {
  members: Member[];
  pendingInvites: PendingInvite[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { active, inactive } = useMemo(() => {
    const active = members.filter((m) => m.isActive);
    const inactive = members.filter((m) => !m.isActive);
    return { active, inactive };
  }, [members]);

  async function deactivate(memberId: string) {
    setBusyId(memberId);
    try {
      const res = await fetch("/api/memberships/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Failed to remove access");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(memberId: string) {
    setBusyId(memberId);
    try {
      const res = await fetch("/api/memberships/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Failed to restore access");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!confirm("Revoke this invite?")) return;

    setBusyId(inviteId);
    try {
      const res = await fetch("/api/invites/revoke-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Failed to revoke invite");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied.");
    } catch {
      alert("Copy failed (browser blocked clipboard).");
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>Users & Access</h1>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Manage who can access this property. “Remove access” deactivates their membership.
          </div>
        </div>

        <Link className="btn" href="/dashboard/settings/invites">
          Manage invites
        </Link>
      </div>

      {/* Pending invites */}
      <Section title={`Pending invites (${pendingInvites.length})`}>
        {pendingInvites.length === 0 ? (
          <Empty text="No pending invites." />
        ) : (
          pendingInvites.map((inv) => {
            const roleLabel = inv.role === "PROPERTY_ADMIN" ? "Admin" : "Staff";
            const link = inv.publicToken ? `${baseUrl}/invite/${inv.publicToken}` : null;
            const busy = busyId === inv.id;

            return (
              <Card key={inv.id}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {inv.email}{" "}
                    <span style={{ opacity: 0.7, fontWeight: 700 }}>• {roleLabel} • Pending</span>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    Expires: <b>{fmtDate(inv.expiresAt)}</b>
                  </div>

                  {link ? (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9, wordBreak: "break-all" }}>
                      <code style={{ opacity: 0.9 }}>{link}</code>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>No public link available.</div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {link ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => copy(link)}
                    >
                      Copy link
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="btnDanger"
                    disabled={busy}
                    onClick={() => revokeInvite(inv.id)}
                  >
                    {busy ? "Working..." : "Revoke"}
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </Section>

      {/* Active users */}
      <Section title={`Active users (${active.length})`}>
        {active.length === 0 ? (
          <Empty text="No active users." />
        ) : (
          active.map((m) => {
            const who = displayName(m);
            const roleLabel = m.role === "PROPERTY_ADMIN" ? "Admin" : "Staff";
            const busy = busyId === m.id;

            return (
              <Card key={m.id}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {who}{" "}
                    <span style={{ opacity: 0.7, fontWeight: 700 }}>• {roleLabel} • Active</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{m.user.email}</div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btnDanger"
                    disabled={busy}
                    onClick={() => deactivate(m.id)}
                  >
                    {busy ? "Working..." : "Remove access"}
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </Section>

      {/* Inactive users */}
      <Section title={`Inactive users (${inactive.length})`}>
        {inactive.length === 0 ? (
          <Empty text="No inactive users." />
        ) : (
          inactive.map((m) => {
            const who = displayName(m);
            const roleLabel = m.role === "PROPERTY_ADMIN" ? "Admin" : "Staff";
            const busy = busyId === m.id;

            return (
              <Card key={m.id}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {who}{" "}
                    <span style={{ opacity: 0.7, fontWeight: 700 }}>• {roleLabel} • Inactive</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{m.user.email}</div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => reactivate(m.id)}
                  >
                    {busy ? "Working..." : "Re-activate"}
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </Section>
    </div>
  );

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h2>
        <div style={{ display: "grid", gap: 8 }}>{children}</div>
      </div>
    );
  }

  function Card({ children }: { children: React.ReactNode }) {
    return (
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 14,
          padding: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {children}
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