import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { InviteAuditAction } from "@prisma/client";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const propertyId = session.user.activePropertyId;
  if (!propertyId) return NextResponse.redirect(new URL("/login", req.url));

  // Admin check
  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard/rotas", req.url));
  }

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const role = String(form.get("role") || "PROPERTY_USER");

  if (!email) {
    return NextResponse.redirect(new URL("/dashboard/settings/invites?error=missing_email", req.url));
  }

  if (role !== "PROPERTY_USER" && role !== "PROPERTY_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard/settings/invites?error=bad_role", req.url));
  }

  // Create raw token (only shown once) and store hash
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawToken);

  // Expires in 7 days (you can change later)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.propertyInvite.create({
  data: {
    propertyId,
    email,
    role: role as "PROPERTY_USER" | "PROPERTY_ADMIN",
    publicToken: rawToken,
    tokenHash,
    expiresAt,
    createdById: session.user.userId,
  },
});
await prisma.inviteAudit.create({
  data: {
    propertyId,
    inviteId: invite.id,
    action: InviteAuditAction.CREATED,
    actorUserId: session.user.userId,
  },
});
  // Build invite link for the user to copy
  const inviteUrl = new URL(`/invite/${rawToken}`, req.url);

  return NextResponse.redirect(
    new URL(`/dashboard/settings/invites?created=1&invite=${encodeURIComponent(inviteUrl.toString())}`, req.url)
  );
}
