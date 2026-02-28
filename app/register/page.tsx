import styles from "./register.module.scss";

export default function RegisterPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create your ChefOps Pro account</h1>
        <p className={styles.sub}>
          Start a <b>7-day free trial</b> for your property. Invite your team once you’re set up.
        </p>

        <form className={styles.form} action="/api/register" method="post">
          <label className={styles.label}>
            Property name
            <input className="input" name="propertyName" placeholder="e.g. Village Hotel" required />
          </label>

          <label className={styles.label}>
            Your name
            <input className="input" name="ownerName" placeholder="e.g. Jordan Smith" required />
          </label>

          <label className={styles.label}>
            Email
            <input className="input" type="email" name="email" placeholder="you@company.com" required />
          </label>

          <label className={styles.label}>
            Password
            <input className="input" type="password" name="password" required minLength={8} />
          </label>

          <button className="button" type="submit">
            Start free trial
          </button>

          <p className={styles.small}>
            Already have an account? <a className={styles.link} href="/login">Log in</a>
          </p>
        </form>
      </div>
    </main>
  );
}