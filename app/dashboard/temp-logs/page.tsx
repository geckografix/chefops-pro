import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { redirect } from "next/navigation";
import FoodTempLogsClient from "./FoodTempLogsClient";

export default async function TempLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const sp = await Promise.resolve(searchParams);

  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (!membership) redirect("/dashboard");

  const activeTab = sp?.tab === "blast" ? "blast" : "food";

  return <FoodTempLogsClient role={membership.role} activeTab={activeTab} />;
}
