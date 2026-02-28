import { getSession } from "@/src/lib/session-helpers";
import { redirect } from "next/navigation";
import styles from "./food-cost.module.scss";
import YearFoodCostBoard from "./YearFoodCostBoard";

export default async function FoodCostPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Monthly Food Cost %</h1>
        <p className={styles.sub}>No active property set for your account.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Monthly Food Cost %</h1>
          <p className={styles.sub}>
            Track purchases vs sales and keep food cost on target.
          </p>
        </div>
      </div>

      <YearFoodCostBoard />
    </main>
  );
}
