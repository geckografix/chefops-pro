import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Header from "../components/Header";
import styles from "./dashboardLayout.module.scss";
import { getSessionAndPropertyAccess } from "@/src/lib/session-helpers";
import { prisma } from "@/src/lib/prisma";
import Image from "next/image";

function daysLeftUntil(date: Date) {
  const now = new Date();
  const ms = date.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { session, propertyId, isBlocked, access } = await getSessionAndPropertyAccess();

  if (!session?.user) redirect("/login");
  if (!propertyId) redirect("/login");
  const membership = await prisma.propertyMembership.findFirst({
  where: {
    propertyId,
    userId: session.user.userId,
    isActive: true,
  },
  select: { role: true },
});

  if (!membership) redirect("/no-access"); // inactive or no access
  if (isBlocked) redirect("/billing");

  // Trial badge info
  let trialDaysLeft: number | null = null;
  const subStatus = access?.subscriptionStatus ?? null;
  if (subStatus === "TRIALING" && access?.trialEndsAt) {
    trialDaysLeft = daysLeftUntil(access.trialEndsAt);
  }

  // IMPORTANT: admin check (membership role)
  const isAdmin = membership.role === "PROPERTY_ADMIN";

  return (
    <div className={styles.shell}>
      <Header trialDaysLeft={trialDaysLeft} subscriptionStatus={subStatus} isAdmin={isAdmin} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}