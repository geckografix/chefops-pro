import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import ProcurementBoard from "./ProcurementBoard";

export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string; // "food" | "supplies"
};

//// ####ADD CODE HERE#### (Serialize Prisma output for Client Components)
// Client Components can only receive plain JSON-serializable data.
// Prisma Decimal + Date objects must be converted (Decimal -> string, Date -> ISO string).
function serializeProcurementItems(items: any[]) {
  return items.map((i) => ({
    ...i,
    quantity: i.quantity ? i.quantity.toString() : null,
    neededBy: i.neededBy ? i.neededBy.toISOString() : null,
    decidedAt: i.decidedAt ? i.decidedAt.toISOString() : null,
    deliveredAt: i.deliveredAt ? i.deliveredAt.toISOString() : null,
    createdAt: i.createdAt ? i.createdAt.toISOString() : null,
    updatedAt: i.updatedAt ? i.updatedAt.toISOString() : null,
  }));
}

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });
  if (!membership) redirect("/login");

  const isAdmin = membership.role === "PROPERTY_ADMIN";

  const activeTab = sp?.tab === "supplies" ? "supplies" : "food";
  const category: "FOOD" | "SUPPLIES" =
    activeTab === "supplies" ? "SUPPLIES" : "FOOD";

  const items = await prisma.procurementRequest.findMany({
    where: { propertyId, category },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
  });

  const safeItems = serializeProcurementItems(items);

  return (
    <ProcurementBoard activeTab={activeTab} isAdmin={isAdmin} items={safeItems} />
  );
}

