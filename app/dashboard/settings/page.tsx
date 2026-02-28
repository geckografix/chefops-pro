import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import SettingsForm from "./SettingsForm";
import styles from "./settings.module.scss";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });

  if (membership?.role !== "PROPERTY_ADMIN") {
    redirect("/dashboard");
  }

  const settings = await prisma.propertySettings.upsert({
    where: { propertyId },
    create: { propertyId },
    update: {},
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subTitle}>Property SOP thresholds (admin only).</p>
      </div>

      <SettingsForm initial={settings} />
    </div>
  );
}