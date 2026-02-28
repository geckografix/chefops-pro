"use client";

export default function PrintControls({
  rangeLabel,
}: {
  rangeLabel: string;
}) {
  return (
    <div
      className="no-print"
      style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}
    >
      <button
        onClick={() => window.print()}
        style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer" }}
      >
        Print / Save as PDF
      </button>

      <div style={{ opacity: 0.75 }}>{rangeLabel}</div>
    </div>
  );
}
