import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { NextResponse } from "next/server";
import crypto from "crypto";

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// PBKDF2 password hashing (Node built-in, no extra deps)
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 120_000;
  const keylen = 32;
  const digest = "sha256";

  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, keylen, digest)
    .toString("hex");

  // store as: pbkdf2_sha256$iterations$salt$hash
  return `pbkdf2_${digest}$${iterations}$${salt}$${hash}`;
}

export async function POST(req: Request) {
  const form = await req.formData();

  const propertyName = String(form.get("propertyName") || "").trim();
  const ownerName = String(form.get("ownerName") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  // Basic validation
  if (!propertyName || !ownerName || !email || !password) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const now = new Date();
  const trialEndsAt = addDays(now, 7);

  const passwordHash = hashPassword(password);

  // Create everything in one transaction
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: ownerName,
        email,
        passwordHash,
      },
      select: { id: true, name: true, email: true },
    });

    const property = await tx.property.create({
      data: {
        name: propertyName,
        subscriptionStatus: "TRIALING",
        trialStartsAt: now,
        trialEndsAt,
        subscriptionActive: true,
      },
      select: { id: true },
    });

    await tx.propertyMembership.create({
      data: {
        propertyId: property.id,
        userId: user.id,
        role: "PROPERTY_ADMIN",
        isActive: true,
      },
    });

    return { user, property };
  });

  // Log them in (iron-session)
  const session = await getSession();
  session.user = {
    userId: created.user.id,
    email: created.user.email,
    name: created.user.name ?? null,
    activePropertyId: created.property.id,
  };
  await session.save();

  return NextResponse.redirect(new URL("/dashboard/rotas", req.url));
}