"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./reset-password.module.scss";

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const r = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data?.error || "Reset failed");
      return;
    }

    setDone(true);
    window.setTimeout(() => router.push("/login"), 900);
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Reset password</h1>
      <p className={styles.sub}>Set a new password for your account.</p>

      <div className={styles.card}>
        {done ? (
          <p className={styles.notice}>Password updated. Redirecting to login…</p>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.label}>
              New password
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            {error ? <div className={styles.noticeError}>{error}</div> : null}

            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
