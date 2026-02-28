import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import UserAccessBoard from "./UserAccessBoard";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (membership?.role !== "PROPERTY_ADMIN") redirect("/dashboard");

  const [members, pendingInvites] = await Promise.all([
    prisma.propertyMembership.findMany({
      where: { propertyId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.propertyInvite.findMany({
      where: {
        propertyId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        publicToken: true,
        expiresAt: true,
        createdAt: true,
      },
      take: 200,
    }),
  ]);

  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  return <UserAccessBoard members={members as any} pendingInvites={pendingInvites as any} baseUrl={baseUrl} />;
}