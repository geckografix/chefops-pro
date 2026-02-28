import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionUser } from "./session";
import { prisma } from "@/src/lib/prisma";

type SessionData = { user?: SessionUser };

export async function getSession() {
  const cookieStore = await cookies(); // ✅ IMPORTANT in Next 16
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

type PropertyAccessInfo = {
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  trialEndsAt: Date | null;
  subscriptionActive: boolean;
  role: "PROPERTY_ADMIN" | "PROPERTY_USER" | null;
};

export async function getSessionAndPropertyAccess() {
  const session = await getSession();
  const propertyId = session.user?.activePropertyId ?? null;
  const userId = session.user?.userId ?? null;

  if (!session.user || !propertyId || !userId) {
    return {
      session,
      propertyId,
      access: null as PropertyAccessInfo | null,
      isBlocked: false,
      isTrialExpired: false,
    };
  }

  const [property, membership] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionActive: true,
      },
    }),
    prisma.propertyMembership.findFirst({
      where: { propertyId, userId, isActive: true },
      select: { role: true },
    }),
  ]);

  if (!property) {
    return {
      session,
      propertyId,
      access: null as PropertyAccessInfo | null,
      isBlocked: false,
      isTrialExpired: false,
    };
  }

  const now = new Date();
  const isTrialExpired =
    property.subscriptionStatus === "TRIALING" &&
    property.trialEndsAt !== null &&
    property.trialEndsAt.getTime() < now.getTime();

  const isBlocked =
    !property.subscriptionActive ||
    property.subscriptionStatus === "PAST_DUE" ||
    property.subscriptionStatus === "CANCELED" ||
    isTrialExpired;

  const access: PropertyAccessInfo = {
    subscriptionStatus: property.subscriptionStatus,
    trialEndsAt: property.trialEndsAt,
    subscriptionActive: property.subscriptionActive,
    role: membership?.role ?? null,
  };

  return {
    session,
    propertyId,
    access,
    isBlocked,
    isTrialExpired,
  };
}
