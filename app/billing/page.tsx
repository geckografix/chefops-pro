import styles from "./billing.module.scss";
import Link from "next/link";

export default function BillingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Subscription required</h1>

        <p className={styles.sub}>
          Your free trial has ended, or your subscription isn’t active.
          To continue using ChefOps Pro, you’ll need an active monthly subscription for your property.
        </p>

        <div className={styles.actions}>
          <button className="button" type="button" disabled>
            Subscribe (coming next)
          </button>

          <Link className={styles.link} href="/login">
            Back to login
          </Link>
        </div>

        <p className={styles.small}>
          Next step: we’ll connect this button to Stripe Checkout and activate your property automatically.
        </p>
      </div>
    </main>
  );
}