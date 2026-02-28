import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import EhoPackDoc from "./EhoPackDoc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function iso(v: any) {
  return v ? (v.toISOString?.() ?? String(v)) : null;
}

function dec(v: any) {
  return v == null ? null : v.toString?.() ?? String(v);
}

function displayPerson(p: { name: string | null; email: string } | null) {
  if (!p) return "Unknown";
  return p.name?.trim() ? p.name : p.email;
}

async function toNodeBuffer(out: any): Promise<Buffer> {
  if (!out) return Buffer.alloc(0);

  if (Buffer.isBuffer(out)) return out;
  if (out instanceof Uint8Array) return Buffer.from(out);
  if (out instanceof ArrayBuffer) return Buffer.from(new Uint8Array(out));

  // Some libs return Response/Blob-ish objects
  if (typeof out?.arrayBuffer === "function") {
    const ab = await out.arrayBuffer();
    return Buffer.from(new Uint8Array(ab));
  }

  // PDFKit PDFDocument is a stream: collect chunks
  if (typeof out?.on === "function") {
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      out.on("data", (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      out.on("end", () => resolve(Buffer.concat(chunks)));
      out.on("error", (e: any) => reject(e));
    });
  }

  throw new Error(
    `Unknown PDF output type: ${Object.prototype.toString.call(out)}`
  );
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.json({ error: "No active property" }, { status: 400 });

  // Admin-only
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { name: true },
  });

  const cutoff90 = daysAgo(90);
  const cutoff14 = daysAgo(14);

  const [foodLogs, eventFoodLogs, fridgeLogs, maintenance] = await Promise.all([
    prisma.foodTemperatureLog.findMany({
      where: { propertyId, loggedAt: { gte: cutoff90 } },
      orderBy: { loggedAt: "desc" },
      take: 6000,
    }),
    prisma.eventFoodTemperatureLog.findMany({
      where: { propertyId, loggedAt: { gte: cutoff90 } },
      orderBy: { loggedAt: "desc" },
      take: 6000,
    }),
    prisma.temperatureLog.findMany({
      where: { propertyId, loggedAt: { gte: cutoff90 } },
      orderBy: { loggedAt: "desc" },
      take: 9000,
      include: {
        unit: { select: { name: true, type: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: { propertyId, createdAt: { gte: cutoff14 } },
      orderBy: { createdAt: "desc" },
      take: 2500,
      include: {
        reportedBy: { select: { name: true, email: true } },
        read: { select: { readAt: true, admin: { select: { name: true, email: true } } } },
        completed: {
          select: { completedAt: true, admin: { select: { name: true, email: true } } },
        },
      },
    }),
  ]);

  const foodAll = [
    ...foodLogs.map((l: any) => ({
      kind: "standard" as const,
      id: l.id,
      loggedAt: iso(l.loggedAt),
      period: l.period ?? null,
      status: l.status ?? null,
      foodName: l.foodName,
      tempC: dec(l.tempC),
      notes: l.notes ?? null,
    })),
    ...eventFoodLogs.map((l: any) => ({
      kind: "event" as const,
      id: l.id,
      loggedAt: iso(l.loggedAt),
      period: l.period ?? null,
      status: l.status ?? null,
      foodName: l.foodName,
      tempC: dec(l.tempC),
      notes: l.notes ?? null,
      eventName: l.eventName,
      eventDate: iso(l.eventDate),
    })),
  ];

  const fridge = fridgeLogs.map((l: any) => ({
    id: l.id,
    loggedAt: iso(l.loggedAt),
    unitName: l.unit?.name ?? "Unit",
    unitType: l.unit?.type ?? "",
    period: l.period ?? null,
    status: l.status ?? null,
    valueC: dec(l.valueC),
    loggedBy: displayPerson(l.createdBy),
    notes: l.notes ?? null,
  }));

  const maint = maintenance.map((m: any) => ({
    id: m.id,
    createdAt: iso(m.createdAt),
    urgency: m.urgency,
    title: m.title,
    location: m.location ?? null,
    equipment: m.equipment ?? null,
    reportedBy: displayPerson(m.reportedBy),
    readByAdmin: m.read ? displayPerson(m.read.admin) : null,
    readAt: m.read ? iso(m.read.readAt) : null,
    completedByAdmin: m.completed ? displayPerson(m.completed.admin) : null,
    completedAt: m.completed ? iso(m.completed.completedAt) : null,
  }));

  const generatedAtISO = new Date().toISOString();

  // No JSX in .ts — create element explicitly
  const doc = React.createElement(EhoPackDoc as any, {
    propertyName: property?.name ?? "Property",
    generatedAtISO,
    cutoff90ISO: cutoff90.toISOString(),
    cutoff14ISO: cutoff14.toISOString(),
    foodLogs: foodAll,
    fridgeLogs: fridge,
    maintLogs: maint,
  });

  try {
    const instance = pdf(doc as any);

    // Depending on version, toBuffer() may return bytes OR a PDFDocument stream
    const out =
      typeof (instance as any).toBuffer === "function"
        ? await (instance as any).toBuffer()
        : typeof (instance as any).toStream === "function"
        ? await (instance as any).toStream()
        : instance;

    const buf = await toNodeBuffer(out);

    const head = buf.subarray(0, 4).toString("utf8");
    if (!buf.length || head !== "%PDF") {
      console.error("EHO PDF invalid output:", {
        length: buf.length,
        head,
        sample: buf.subarray(0, 120).toString("utf8"),
      });
      return NextResponse.json(
        { error: "PDF generation failed (invalid PDF output)", length: buf.length, head },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

  const bytes = new Uint8Array(buf);

return new Response(bytes, {
  status: 200,
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="chef-ops-pro-eho-pack-${propertyId}-${generatedAtISO.slice(0, 10)}.pdf"`,
    "Cache-Control": "no-store",
    "Content-Length": String(bytes.byteLength),
  },
});
  } catch (err: any) {
    console.error("EHO PDF generation exception:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: String(err?.message || err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}