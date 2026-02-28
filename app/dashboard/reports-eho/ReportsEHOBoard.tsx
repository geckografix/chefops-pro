"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Person = { id: string; name: string | null; email: string };

type FoodLog = {
  id: string;
  loggedAt: string | null;
  logDate: string | null;
  period: string | null;
  status: string | null;
  foodName: string;
  tempC: string | null;
  notes: string | null;
  eventId: string | null;
  createdByUserId: string | null;
};

type EventFoodLog = {
  id: string;
  eventName: string;
  eventDate: string | null;
  loggedAt: string | null;
  logDate: string | null;
  period: string | null;
  status: string | null;
  foodName: string;
  tempC: string | null;
  notes: string | null;
  eventId: string | null;
  createdByUserId: string | null;
};

type FridgeLog = {
  id: string;
  loggedAt: string | null;
  period: string | null;
  status: string | null;
  valueC: string | null;
  notes: string | null;
  unit: { id: string; name: string; type: string } | null;
  createdBy: Person | null;
};

type MaintenanceLog = {
  id: string;
  createdAt: string | null;
  urgency: "H24" | "H48" | "WEEK";
  title: string;
  details: string | null;
  location: string | null;
  equipment: string | null;
  reportedBy: Person | null;
  read: { id: string; readAt: string | null; admin: Person | null } | null;
  completed: { id: string; completedAt: string | null; admin: Person | null } | null;
};

type BlastBatch = {
  key: string;
  foodName: string;
  startAt: string | null;
  startTempC: string | null;
  startByUserId: string | null;
  endAt: string | null;
  endTempC: string | null;
  endByUserId: string | null;
  minutes: number | null;
  status: string; // "OK" | "OUT_OF_RANGE" | "IN_PROGRESS"
  notes: string | null;
};

function displayPerson(p: Person | null) {
  if (!p) return "Unknown";
  return p.name?.trim() ? p.name : p.email;
}

function fmtDT(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB");
}

function escapeCsvCell(v: any) {
  const s = v == null ? "" : String(v);
  const needs = s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    alert("Nothing to export.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv =
    headers.join(",") +
    "\n" +
    rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isBlastStart(notes: string | null) {
  return (notes ?? "").includes("[BLAST_CHILL_START]");
}
function isBlastEnd(notes: string | null) {
  return (notes ?? "").includes("[BLAST_CHILL_END]");
}
function minutesBetween(aISO: string | null, bISO: string | null) {
  if (!aISO || !bISO) return null;
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}
function cleanBlastNotes(notes: string | null) {
  if (!notes) return null;
  return (
    notes
      .replace(/\[BLAST_CHILL_START\]\s*/g, "")
      .replace(/\[BLAST_CHILL_END\]\s*/g, "")
      .replace(/\[BC:[^\]]+\]\s*/g, "")
      .replace(/\(mins=\-?\d+\)\s*/g, "")
      .trim() || null
  );
}
function getBlastBatchId(notes: string | null) {
  if (!notes) return null;
  const m = notes.match(/\[BC:([^\]]+)\]/);
  return m ? m[1] : null;
}

export default function ReportsEHOBoard({
  cutoff90ISO,
  cutoff14ISO,
  foodLogs,
  blastChillLogs,
  eventFoodLogs,
  fridgeLogs,
  maintenanceLogs,
  users,
}: {
  cutoff90ISO: string;
  cutoff14ISO: string;
  foodLogs: FoodLog[];
  blastChillLogs: FoodLog[];
  eventFoodLogs: EventFoodLog[];
  fridgeLogs: FridgeLog[];
  maintenanceLogs: MaintenanceLog[];
  users: Person[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"food" | "blast" | "fridge" | "maintenance">("food");
  const [q, setQ] = useState("");

  const userById = useMemo(() => {
  const m = new Map<string, Person>();
  for (const u of users) m.set(u.id, u);
  return m;
}, [users]);

function displayUser(userId: string | null) {
  if (!userId) return "—";
  const u = userById.get(userId);
  if (!u) return "Unknown user";
  return u.name?.trim() ? u.name : u.email;
}

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (s: any) => String(s ?? "").toLowerCase().includes(needle);

    // Food tab should NOT include blast logs
    const standardFood = foodLogs
      .filter((l) => !isBlastStart(l.notes) && !isBlastEnd(l.notes))
      .map((l) => ({ kind: "standard" as const, ...l }));

    const foodAll = [
      ...standardFood,
      ...eventFoodLogs.map((l) => ({ kind: "event" as const, ...l })),
    ].filter((l: any) => {
      if (!needle) return true;
      return (
        match(l.foodName) ||
        match(l.status) ||
        match(l.period) ||
        match(l.notes) ||
        match(l.eventName) ||
        match(l.eventId)
      );
    });

    // ---- Blast batches (pair START + END into one record) ----
    const blastRows = blastChillLogs
      .slice()
      .sort((a, b) => (a.loggedAt ?? "").localeCompare(b.loggedAt ?? "")); // oldest → newest

    const openStartByBatch = new Map<string, FoodLog>();
    const openStartByFood = new Map<string, FoodLog>(); // fallback if no batch id exists
    const batches: BlastBatch[] = [];

    for (const row of blastRows) {
      const name = row.foodName;
      const batchId = getBlastBatchId(row.notes);

      // START
      if (isBlastStart(row.notes)) {
        if (batchId) openStartByBatch.set(batchId, row);
        else openStartByFood.set(name, row);
        continue;
      }

      // END
      if (isBlastEnd(row.notes)) {
        const start = batchId ? openStartByBatch.get(batchId) ?? null : openStartByFood.get(name) ?? null;

        const mins = minutesBetween(start?.loggedAt ?? null, row.loggedAt ?? null);

        batches.push({
          key: batchId ? `${name}:${batchId}:${row.id}` : `${name}:${row.id}`,
          foodName: name,
          startAt: start?.loggedAt ?? null,
          startTempC: start?.tempC ?? null,
          startByUserId: start?.createdByUserId ?? null,
          endAt: row.loggedAt ?? null,
          endTempC: row.tempC ?? null,
          endByUserId: row.createdByUserId ?? null,
          minutes: mins,
          status: row.status ?? "OK",
          notes: cleanBlastNotes(row.notes),
        });

        // consume matched start
        if (batchId) openStartByBatch.delete(batchId);
        else openStartByFood.delete(name);
      }
    }

    // unmatched STARTs (only genuine open batches)
    for (const [batchId, start] of openStartByBatch.entries()) {
      batches.push({
        key: `${start.foodName}:${batchId}:${start.id}:open`,
        foodName: start.foodName,
        startAt: start.loggedAt ?? null,
        startTempC: start.tempC ?? null,
        startByUserId: start.createdByUserId ?? null,
        endAt: null,
        endTempC: null,
        endByUserId: null,
        minutes: null,
        status: "IN_PROGRESS",
        notes: cleanBlastNotes(start.notes),
      });
    }

    for (const [name, start] of openStartByFood.entries()) {
      batches.push({
        key: `${name}:${start.id}:open`,
        foodName: name,
        startAt: start.loggedAt ?? null,
        startTempC: start.tempC ?? null,
        startByUserId: start.createdByUserId ?? null,
        endAt: null,
        endTempC: null,
        endByUserId: null, // ✅ FIX: no "row" here
        minutes: null,
        status: "IN_PROGRESS",
        notes: cleanBlastNotes(start.notes),
      });
    }
      for (const [name, start] of openStartByFood.entries()) {
  batches.push({
    key: `${name}:${start.id}:open`,
    foodName: name,
    startAt: start.loggedAt ?? null,
    startTempC: start.tempC ?? null,
    startByUserId: start.createdByUserId ?? null,
    endAt: null,
    endTempC: null,
    endByUserId: null,
    minutes: null,
    status: "IN_PROGRESS",
    notes: cleanBlastNotes(start.notes),
  });
}

//// ==== ADD THIS SNIPPET ====
batches.sort((a, b) => {
  const aKey = a.endAt ?? a.startAt ?? "";
  const bKey = b.endAt ?? b.startAt ?? "";
  return bKey.localeCompare(aKey); // newest first
});
    const blast = batches.filter((b) => {
      if (!needle) return true;
      return match(b.foodName) || match(b.status) || match(b.notes) || match(b.minutes);
    });

    const fridge = fridgeLogs.filter((l) => {
      if (!needle) return true;
      return match(l.unit?.name) || match(l.unit?.type) || match(l.status) || match(l.period) || match(l.notes);
    });

    const maint = maintenanceLogs.filter((m) => {
      if (!needle) return true;
      return (
        match(m.title) ||
        match(m.details) ||
        match(m.location) ||
        match(m.equipment) ||
        match(m.urgency) ||
        match(displayPerson(m.reportedBy)) ||
        match(displayPerson(m.read?.admin ?? null)) ||
        match(displayPerson(m.completed?.admin ?? null))
      );
    });

    return { foodAll, blast, fridge, maint };
  }, [q, foodLogs, blastChillLogs, eventFoodLogs, fridgeLogs, maintenanceLogs]);

  function exportFoodCsv() {
    const rows = filtered.foodAll.map((l: any) => ({
      Type: l.kind === "event" ? "Event food temp" : "Food temp",
      LoggedAt: l.loggedAt,
      LogDate: l.logDate,
      Period: l.period,
      Status: l.status,
      FoodName: l.foodName,
      TempC: l.tempC,
      Notes: l.notes,
      EventName: l.kind === "event" ? l.eventName : "",
      EventDate: l.kind === "event" ? l.eventDate : "",
      EventId: l.eventId ?? "",
      CreatedByUserId: l.createdByUserId ?? "",
    }));
    downloadCsv("eho-food-temperature-logs-3-months.csv", rows);
  }

  function exportBlastCsv() {
    const rows = filtered.blast.map((b: BlastBatch) => ({
      FoodName: b.foodName,
      Notes: b.notes ?? "",
      StartAt: fmtDT(b.startAt),
      StartTempC: b.startTempC ?? "",
      StartBy: displayUser(b.startByUserId),
      EndAt: fmtDT(b.endAt),
      EndTempC: b.endTempC ?? "",
      EndBy: displayUser(b.endByUserId),
      Minutes: b.minutes ?? "",
      Status: b.status,
    }));
    downloadCsv("eho-blast-chilling-logs-3-months.csv", rows);
  }

  function exportFridgeCsv() {
    const rows = filtered.fridge.map((l) => ({
      LoggedAt: l.loggedAt,
      UnitName: l.unit?.name ?? "",
      UnitType: l.unit?.type ?? "",
      Period: l.period,
      Status: l.status,
      ValueC: l.valueC,
      Notes: l.notes,
      LoggedBy: displayPerson(l.createdBy),
    }));
    downloadCsv("eho-fridge-temperature-logs-3-months.csv", rows);
  }

  function exportMaintenanceCsv() {
    const rows = filtered.maint.map((m) => ({
      CreatedAt: m.createdAt,
      Urgency: m.urgency,
      Title: m.title,
      Details: m.details ?? "",
      Location: m.location ?? "",
      Equipment: m.equipment ?? "",
      ReportedBy: displayPerson(m.reportedBy),
      ReadByAdmin: m.read ? displayPerson(m.read.admin) : "",
      ReadAt: m.read?.readAt ?? "",
      CompletedByAdmin: m.completed ? displayPerson(m.completed.admin) : "",
      CompletedAt: m.completed?.completedAt ?? "",
    }));
    downloadCsv("eho-maintenance-logs-2-weeks.csv", rows);
  }

  async function downloadEhoPackPdf() {
    const res = await fetch("/api/reports/eho-pack");
    const ct = res.headers.get("content-type") || "";

    if (!res.ok || !ct.includes("application/pdf")) {
      const text = await res.text().catch(() => "");
      alert(`EHO Pack failed.\nStatus: ${res.status}\nContent-Type: ${ct}\n\n${text.slice(0, 500)}`);
      return;
    }

    const blob = await res.blob();
    if (!blob || blob.size < 1000) {
      alert("PDF generated but looks empty/corrupt. Please try again.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chef-Ops-Pro-EHO-Pack-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>Reports (EHO)</h1>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Food + fridge temperatures (last 3 months) • Maintenance (last 2 weeks)
          </div>
        </div>

        <button type="button" className="btn" onClick={() => router.refresh()}>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="tabBar" style={{ marginTop: 14, marginBottom: 12 }}>
        <button
          type="button"
          className={`tab ${tab === "food" ? "tabActive" : ""}`}
          onClick={() => setTab("food")}
          aria-current={tab === "food" ? "page" : undefined}
        >
          Food temps (3m)
        </button>

        <button
          type="button"
          className={`tab ${tab === "blast" ? "tabActive" : ""}`}
          onClick={() => setTab("blast")}
          aria-current={tab === "blast" ? "page" : undefined}
        >
          Blast chilling (3m)
        </button>

        <button
          type="button"
          className={`tab ${tab === "fridge" ? "tabActive" : ""}`}
          onClick={() => setTab("fridge")}
          aria-current={tab === "fridge" ? "page" : undefined}
        >
          Fridge temps (3m)
        </button>

        <button
          type="button"
          className={`tab ${tab === "maintenance" ? "tabActive" : ""}`}
          onClick={() => setTab("maintenance")}
          aria-current={tab === "maintenance" ? "page" : undefined}
        >
          Maintenance (2w)
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search logs…"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 320, maxWidth: "100%" }}
        />

        <button type="button" className="btn" onClick={downloadEhoPackPdf}>
          Download EHO Pack (PDF)
        </button>

        {tab === "food" ? (
          <button type="button" className="btn" onClick={exportFoodCsv}>
            Export CSV
          </button>
        ) : tab === "blast" ? (
          <button type="button" className="btn" onClick={exportBlastCsv}>
            Export CSV
          </button>
        ) : tab === "fridge" ? (
          <button type="button" className="btn" onClick={exportFridgeCsv}>
            Export CSV
          </button>
        ) : (
          <button type="button" className="btn" onClick={exportMaintenanceCsv}>
            Export CSV
          </button>
        )}
      </div>

      {/* Content */}
      {tab === "food" ? (
        <Section
          title={`Food temperature logs (since ${new Date(cutoff90ISO).toLocaleDateString("en-GB")}) • ${filtered.foodAll.length}`}
        >
          {filtered.foodAll.length === 0 ? (
            <Empty />
          ) : (
            filtered.foodAll.slice(0, 400).map((l: any) => (
              <div key={`${l.kind}-${l.id}`} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      {l.foodName} {l.tempC != null ? <span style={{ opacity: 0.85 }}>• {l.tempC}°C</span> : null}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      {l.kind === "event" ? (
                        <>
                          <strong>Event:</strong> {l.eventName} {l.eventDate ? `• ${fmtDT(l.eventDate)}` : ""}
                        </>
                      ) : (
                        <span style={{ fontWeight: 700 }}>Standard log</span>
                      )}
                      {l.loggedAt ? <> • {fmtDT(l.loggedAt)}</> : null}
                      {l.period ? <> • {l.period}</> : null}
                      {l.status ? <> • {l.status}</> : null}
                    </div>
                    {l.notes ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{l.notes}</div> : null}
                  </div>
                </div>
              </div>
            ))
          )}
          {filtered.foodAll.length > 400 ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Showing first 400 rows on-screen. Export CSV for full list.</div>
          ) : null}
        </Section>
      ) : null}

      {tab === "blast" ? (
        <Section
          title={`Blast chilling batches (since ${new Date(cutoff90ISO).toLocaleDateString("en-GB")}) • ${filtered.blast.length}`}
        >
          {filtered.blast.length === 0 ? (
            <Empty />
          ) : (
            filtered.blast.slice(0, 400).map((b: BlastBatch) => (
              <div key={b.key} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                {/* Line 1 */}
                <div style={{ fontWeight: 900, fontSize: 14 }}>{b.foodName}</div>

                {/* Line 2 */}
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{b.notes ? b.notes : "—"}</div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
  <b>Logged by:</b>{" "}
  START {displayUser(b.startByUserId)}
  {b.endByUserId ? ` → END ${displayUser(b.endByUserId)}` : ""}
</div>
                {/* Line 3 */}
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                  <b>Start:</b> {b.startAt ? fmtDT(b.startAt) : "—"}
                  {b.startTempC ? <span style={{ opacity: 0.9 }}> • {b.startTempC}°C</span> : null}
                </div>

                {/* Line 4 */}
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                  <b>End:</b> {b.endAt ? fmtDT(b.endAt) : "—"}
                  {b.endTempC ? <span style={{ opacity: 0.9 }}> • {b.endTempC}°C</span> : null}
                </div>

                {/* Line 5 */}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.95 }}>
                    Total blast chill time:{" "}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {b.minutes == null ? "—" : `${b.minutes} min`}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      fontWeight: 900,
                      background:
                        b.status === "OUT_OF_RANGE"
                          ? "rgba(245,158,11,0.18)"
                          : b.status === "IN_PROGRESS"
                          ? "rgba(148,163,184,0.18)"
                          : "rgba(16,185,129,0.14)",
                    }}
                    title={b.status}
                  >
                    {b.status === "IN_PROGRESS" ? "IN PROGRESS" : b.status}
                  </div>
                </div>
              </div>
            ))
          )}

          {filtered.blast.length > 400 ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Showing first 400 rows on-screen. Export CSV for full list.</div>
          ) : null}
        </Section>
      ) : null}

      {tab === "fridge" ? (
        <Section
          title={`Fridge temperature logs (since ${new Date(cutoff90ISO).toLocaleDateString("en-GB")}) • ${filtered.fridge.length}`}
        >
          {filtered.fridge.length === 0 ? (
            <Empty />
          ) : (
            filtered.fridge.slice(0, 500).map((l) => (
              <div key={l.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {l.unit?.name ?? "Unit"} {l.valueC != null ? <span style={{ opacity: 0.85 }}>• {l.valueC}°C</span> : null}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  {l.unit?.type ? <>{l.unit.type}</> : null}
                  {l.loggedAt ? <> • {fmtDT(l.loggedAt)}</> : null}
                  {l.period ? <> • {l.period}</> : null}
                  {l.status ? <> • {l.status}</> : null}
                  {l.createdBy ? <> • Logged by {displayPerson(l.createdBy)}</> : null}
                </div>
                {l.notes ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{l.notes}</div> : null}
              </div>
            ))
          )}
          {filtered.fridge.length > 500 ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Showing first 500 rows on-screen. Export CSV for full list.</div>
          ) : null}
        </Section>
      ) : null}

      {tab === "maintenance" ? (
        <Section
          title={`Maintenance logs (since ${new Date(cutoff14ISO).toLocaleDateString("en-GB")}) • ${filtered.maint.length}`}
        >
          {filtered.maint.length === 0 ? (
            <Empty />
          ) : (
            filtered.maint.slice(0, 300).map((m) => {
              const state = m.completed ? "Completed" : m.read ? "Read" : "Unread";
              return (
                <div key={m.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {m.title} <span style={{ opacity: 0.85 }}>• {m.urgency} • {state}</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                    Reported by {displayPerson(m.reportedBy)}
                    {m.createdAt ? <> • {fmtDT(m.createdAt)}</> : null}
                    {m.location ? <> • Location: {m.location}</> : null}
                    {m.equipment ? <> • Equipment: {m.equipment}</> : null}
                  </div>

                  {m.details ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{m.details}</div> : null}

                  {m.read ? (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                      <strong>Read:</strong> {displayPerson(m.read.admin)} {m.read.readAt ? `• ${fmtDT(m.read.readAt)}` : ""}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                      <strong>Read:</strong> not yet
                    </div>
                  )}

                  {m.completed ? (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                      <strong>Completed:</strong> {displayPerson(m.completed.admin)}{" "}
                      {m.completed.completedAt ? `• ${fmtDT(m.completed.completedAt)}` : ""}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {filtered.maint.length > 300 ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Showing first 300 rows on-screen. Export CSV for full list.</div>
          ) : null}
        </Section>
      ) : null}
    </div>
  );

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginTop: 12 }}>
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
}