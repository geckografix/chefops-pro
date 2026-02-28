import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { APP_NAME } from "@/src/lib/brand";

type Person = { id: string; name: string | null; email: string };

type FoodLog = {
  kind: "standard" | "event";
  id: string;
  loggedAt: string | null;
  period: string | null;
  status: string | null;
  foodName: string;
  tempC: string | null;
  notes: string | null;
  eventName?: string;
  eventDate?: string | null;
};

type FridgeLog = {
  id: string;
  loggedAt: string | null;
  unitName: string;
  unitType: string;
  period: string | null;
  status: string | null;
  valueC: string | null;
  loggedBy: string;
  notes: string | null;
};

type MaintLog = {
  id: string;
  createdAt: string | null;
  urgency: string;
  title: string;
  location: string | null;
  equipment: string | null;
  reportedBy: string;
  readByAdmin: string | null;
  readAt: string | null;
  completedByAdmin: string | null;
  completedAt: string | null;
};

function fmtDT(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB");
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  meta: { fontSize: 9, color: "#444", marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  table: { borderWidth: 1, borderColor: "#ddd" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" },
  headRow: { flexDirection: "row", backgroundColor: "#f3f3f3", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  cell: { padding: 4 },
  small: { color: "#666" },
  footer: { position: "absolute", bottom: 18, left: 24, right: 24, fontSize: 8, color: "#666" },
});

function TableRow({
  cols,
  widths,
  header,
}: {
  cols: string[];
  widths: number[];
  header?: boolean;
}) {
  return (
    <View style={header ? styles.headRow : styles.row}>
      {cols.map((c, idx) => (
        <View key={idx} style={[styles.cell, { width: `${widths[idx]}%` }]}>
          <Text style={header ? { fontWeight: 700 } : undefined}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

export default function EhoPackDoc({
  propertyName,
  generatedAtISO,
  foodLogs,
  fridgeLogs,
  maintLogs,
  cutoff90ISO,
  cutoff14ISO,
}: {
  propertyName: string;
  generatedAtISO: string;
  cutoff90ISO: string;
  cutoff14ISO: string;
  foodLogs: FoodLog[];
  fridgeLogs: FridgeLog[];
  maintLogs: MaintLog[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.h1}>EHO Pack</Text>
        <Text style={styles.meta}>
          Property: {propertyName} • Generated: {fmtDT(generatedAtISO)}
        </Text>
        <Text style={styles.meta}>
          Food & Fridge temps from: {new Date(cutoff90ISO).toLocaleDateString("en-GB")} • Maintenance from:{" "}
          {new Date(cutoff14ISO).toLocaleDateString("en-GB")}
        </Text>

        {/* Food temps */}
        <Text style={styles.sectionTitle}>Food Temperature Logs (last 3 months)</Text>
        <View style={styles.table}>
          <TableRow
            header
            widths={[18, 10, 10, 20, 10, 32]}
            cols={["Logged At", "Type", "Period", "Food", "Temp", "Notes / Event"]}
          />
          {foodLogs.map((l) => (
            <TableRow
              key={`${l.kind}-${l.id}`}
              widths={[18, 10, 10, 20, 10, 32]}
              cols={[
                fmtDT(l.loggedAt),
                l.kind === "event" ? "Event" : "Std",
                l.period ?? "",
                l.foodName,
                l.tempC ? `${l.tempC}°C` : "",
                l.kind === "event"
                  ? `${l.eventName ?? ""}${l.eventDate ? ` (${fmtDT(l.eventDate)})` : ""}${l.notes ? ` • ${l.notes}` : ""}`
                  : l.notes ?? "",
              ]}
            />
          ))}
        </View>

        {/* Fridge temps */}
        <Text style={styles.sectionTitle}>Fridge Temperature Logs (last 3 months)</Text>
        <View style={styles.table}>
          <TableRow
            header
            widths={[18, 18, 10, 10, 10, 14, 20]}
            cols={["Logged At", "Unit", "Type", "Period", "Temp", "Status", "Logged by"]}
          />
          {fridgeLogs.map((l) => (
            <TableRow
              key={l.id}
              widths={[18, 18, 10, 10, 10, 14, 20]}
              cols={[
                fmtDT(l.loggedAt),
                l.unitName,
                l.unitType,
                l.period ?? "",
                l.valueC ? `${l.valueC}°C` : "",
                l.status ?? "",
                l.loggedBy,
              ]}
            />
          ))}
        </View>

        {/* Maintenance */}
        <Text style={styles.sectionTitle}>Maintenance Logs (last 2 weeks)</Text>
        <View style={styles.table}>
          <TableRow
            header
            widths={[16, 10, 24, 16, 16, 18]}
            cols={["Created", "Urgency", "Issue", "Reported by", "Read", "Completed"]}
          />
          {maintLogs.map((m) => (
            <TableRow
              key={m.id}
              widths={[16, 10, 24, 16, 16, 18]}
              cols={[
                fmtDT(m.createdAt),
                m.urgency,
                `${m.title}${m.location ? ` • ${m.location}` : ""}${m.equipment ? ` • ${m.equipment}` : ""}`,
                m.reportedBy,
                m.readByAdmin ? `${m.readByAdmin}${m.readAt ? ` • ${fmtDT(m.readAt)}` : ""}` : "Not read",
                m.completedByAdmin
                  ? `${m.completedByAdmin}${m.completedAt ? ` • ${fmtDT(m.completedAt)}` : ""}`
                  : "Not completed",
              ]}
            />
          ))}
        </View>

        <Text style={styles.footer}>ChefOps Pro • EHO Pack</Text>
      </Page>
    </Document>
  );
}