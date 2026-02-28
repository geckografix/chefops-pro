import { prisma } from "@/src/lib/prisma";
import styles from "./invite.module.scss";
import crypto from "crypto";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function InvitePage(props: Props) {
  const { token } = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;

  const error = searchParams?.error || null;

  // If token is missing, treat as invalid
  if (!token) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Invite not valid</h1>
        <p className={styles.sub}>This invite link is missing a token.</p>
      </main>
    );
  }

  const tokenHash = sha256Hex(token);

  // Look up invite by token hash
  const invite = await prisma.propertyInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      usedAt: true,
      expiresAt: true,
      property: { select: { name: true } },
    },
  });

  const now = new Date();

  const invalid = !invite;
  const expired = invite ? invite.expiresAt <= now : false;
  const used = invite ? !!invite.usedAt : false;

  // Decide what to show
  if (invalid) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Invite not valid</h1>
        <p className={styles.sub}>This invite link isn’t recognised. Ask your admin to send a fresh invite.</p>
      </main>
    );
  }

  if (expired) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Invite expired</h1>
        <p className={styles.sub}>
          This invite for <b>{invite.email}</b> has expired. Ask your admin to send a new one.
        </p>
      </main>
    );
  }

  if (used) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Invite already used</h1>
        <p className={styles.sub}>
          This invite for <b>{invite.email}</b> has already been accepted. Try logging in instead.
        </p>
        <p className={styles.small}>
          Tip: if you don’t know your password yet, ask your admin (we’ll add “Forgot password” next).
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Join {invite.property.name}</h1>
      <p className={styles.sub}>
        You’re accepting an invite for <b>{invite.email}</b> as <b>{invite.role}</b>.
      </p>

      {error ? <p className={styles.noticeError}>Something went wrong: {error}</p> : null}

      <div className={styles.card}>
        <form className={styles.form} action="/api/invite/accept" method="post">
          <input type="hidden" name="token" value={token} />

          <label className={styles.label}>
            Email
            <input className="input" type="email" value={invite.email} readOnly />
          </label>

          <label className={styles.label}>
            Your name
            <input className="input" name="name" placeholder="e.g. Sam Taylor" autoComplete="name" required />
          </label>

          <label className={styles.label}>
            Create a password
            <input
              className="input"
              type="password"
              name="password"
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <button className={`btn ${styles.primaryBtn}`} type="submit">
  Accept invite
</button>
        </form>

        <p className={`${styles.small} ${styles.postHelp}`}>
  After accepting, you’ll be logged in automatically.
</p>
      </div>
    </main>
  );
}

