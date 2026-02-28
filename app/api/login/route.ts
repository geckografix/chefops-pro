import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/src/lib/prisma";

// ####ADD CODE HERE#### (use iron-session directly so we can set maxAge per login)
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionUser } from "@/src/lib/session";

type SessionData = { user?: SessionUser };

function verifyPassword(password: string, storedHash: string) {
  // PBKDF2 format: pbkdf2_sha256$iterations$salt$hash
  if (storedHash.startsWith("pbkdf2_")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;

    const algoPart = parts[0]; // pbkdf2_sha256
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const hashHex = parts[3];

    const digest = algoPart.replace("pbkdf2_", ""); // sha256
    if (!iterations || !salt || !hashHex) return false;

    const derived = crypto
      .pbkdf2Sync(password, salt, iterations, 32, digest as any)
      .toString("hex");

    return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hashHex, "hex"));
  }

  // Default: bcrypt
  return bcrypt.compareSync(password, storedHash);
}

export async function POST(req: Request) {
  let email = "";
  let password = "";
  let remember = true;

  const contentType = req.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    const body = await req.json().catch(() => ({} as any));
    email = String(body?.email || "").trim().toLowerCase();
    password = String(body?.password || "");
    remember = Boolean(body?.remember);
  } else {
    const form = await req.formData();
    email = String(form.get("email") || "").trim().toLowerCase();
    password = String(form.get("password") || "");
    // common checkbox values: "on" / "true"
    const r = String(form.get("remember") || "");
    remember = r === "on" || r === "true" || r === "1";
  }

  // Helper to respond as JSON for fetch(), redirect for forms
  const fail = (status: number, code: string) => {
    if (isJson) return NextResponse.json({ error: code }, { status });
    return NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
  };

  if (!email || !password) return fail(400, "missing");

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      memberships: { where: { isActive: true }, select: { propertyId: true }, take: 1 },
    },
  });

  if (!user) return fail(401, "invalid");

  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) return fail(401, "invalid");

  const activePropertyId = user.memberships[0]?.propertyId ?? null;

  // ####ADD CODE HERE#### (session cookie duration)
  // iron-session cookieOptions.maxAge is seconds.
  // - remember=true  -> 30 days
  // - remember=false -> session cookie (no maxAge)
  const maxAge = remember ? 60 * 60 * 24 * 30 : undefined;

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, {
    ...sessionOptions,
    cookieOptions: {
      ...sessionOptions.cookieOptions,
      maxAge,
    },
  });

  session.user = {
    userId: user.id,
    email: user.email,
    activePropertyId,
  };

  await session.save();

  if (isJson) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/dashboard/rotas", req.url));
}