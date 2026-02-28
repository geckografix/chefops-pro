"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./forgot-password.module.scss";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});

    setBusy(false);
    setDone(true);
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Forgot password</h1>
      <p className={styles.sub}>Enter your email and we’ll send you a reset link.</p>

      <div className={styles.card}>
        {done ? (
          <>
            <p className={styles.notice}>
              If an account exists for <b>{email || "that email"}</b>, a reset link has been created.
            </p>
            <p className={styles.small}>
              In development, the reset link is printed in your terminal running <code>npm run dev</code>.
            </p>
            <Link className={styles.backLink} href="/login">
              Back to login
            </Link>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.label}>
              Email
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>

            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Creating link..." : "Send reset link"}
            </button>

            <Link className={styles.backLink} href="/login">
              Back to login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}