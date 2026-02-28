import Link from "next/link";
import { APP_NAME } from "@/src/lib/brand";

export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>Access removed</h1>

      <p style={{ opacity: 0.85, marginBottom: 14 }}>
  Your access to {APP_NAME} for this property has been removed by an administrator.
</p>

      <p style={{ opacity: 0.75, marginBottom: 18 }}>
        If you believe this is a mistake, speak to your manager or log in with a different account.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="button" href="/login">
          Go to login
        </Link>
      </div>
    </main>
  );
}