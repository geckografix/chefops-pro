"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./login.module.scss";
import { APP_NAME, APP_LOGO_SRC } from "@/src/lib/brand";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ ADD
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ✅ ADD remember
      body: JSON.stringify({ email, password, remember }),
    });

    setBusy(false);

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data?.error || "Login failed");
      return;
    }

   router.push("/dashboard/rotas");
  }

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <h1 className={styles.title}>{APP_NAME}</h1>
        <p className={styles.sub}>Sign in to your property.</p>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <Image src={APP_LOGO_SRC} alt={APP_NAME} width={220} height={56} priority />
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            Email
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hotel.com"
              autoComplete="email"
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={remember ? "current-password" : "off"}
            />
          </label>

          {/* ✅ ADD remember row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
            <input
              id="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={busy}
            />
            <label htmlFor="remember" style={{ fontSize: 13, opacity: 0.85, cursor: "pointer" }}>
              Remember me
            </label>
          </div>

          {error ? <div className={styles.errorBox}>{error}</div> : null}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>

          <div className={styles.forgotWrap}>
            <Link className={styles.forgotLink} href="/forgot-password">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}