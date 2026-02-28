import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { sessionOptions } from "../../../src/lib/session";
import { prisma } from "../../../src/lib/prisma";

export default async function RefrigerationPage() {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore as any, sessionOptions);

  if (!session.user) redirect("/login");
  if (!session.user.activePropertyId) redirect("/login");

  const memberships = await prisma.propertyMembership.findMany({
    where: { userId: session.user.userId, isActive: true },
  });

  const isAdmin = memberships.some(
    (m) => m.propertyId === session.user!.activePropertyId && m.role === "PROPERTY_ADMIN"
  );

  if (!isAdmin) {
    return (
      <main style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Refrigeration</h1>
        <p style={{ marginTop: 12 }}>You don’t have permission to manage refrigeration units.</p>
      </main>
    );
  }

  const units = await prisma.refrigerationUnit.findMany({
    where: { propertyId: session.user.activePropertyId, isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <main style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Refrigeration Units</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Add fridges/freezers for your property. These will appear on the temperature sheet.
      </p>

      <form
        action="/api/refrigeration"
        method="post"
        style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}
      >
        <input
          name="name"
          placeholder="e.g. Walk-in Fridge"
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10, minWidth: 260 }}
        />
        <select name="type" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }}>
          <option value="FRIDGE">Fridge</option>
          <option value="FREEZER">Freezer</option>
        </select>
        <button
          type="submit"
          formAction={async (formData: FormData) => {
            "use server";
            const name = String(formData.get("name") || "");
            const type = String(formData.get("type") || "FRIDGE");
            const cookieStore = await cookies();
            const session = await getIronSession(cookieStore as any, sessionOptions);
            if (!session.user?.activePropertyId) return;

            await prisma.refrigerationUnit.create({
              data: {
                propertyId: session.user.activePropertyId,
                name: name.trim(),
                type: type === "FREEZER" ? "FREEZER" : "FRIDGE",
              },
            });
          }}
          style={{ padding: "10px 14px", borderRadius: 12, border: "none", fontWeight: 800, cursor: "pointer" }}
        >
          Add
        </button>
      </form>

      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 800 }}>Current units</h2>
      <ul style={{ marginTop: 10 }}>
        {units.map((u) => (
          <li key={u.id}>
            {u.name} — <b>{u.type}</b>
          </li>
        ))}
      </ul>
    </main>
  );
}
