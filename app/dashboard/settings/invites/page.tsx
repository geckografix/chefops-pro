import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import CopyInviteLink from "./CopyInviteLink";
import styles from "./invites.module.scss";

export default async function InvitesPage(props: {
  searchParams?: Promise<{ invite?: string; created?: string; error?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;

  const session = await getSession();
  if (!session?.user) redirect("/login");

  const propertyId = session.user.activePropertyId;
  if (!propertyId) redirect("/login");

  const membership = await prisma.propertyMembership.findFirst({
    where: { propertyId, userId: session.user.userId, isActive: true },
    select: { role: true },
  });

  const isAdmin = membership?.role === "PROPERTY_ADMIN";
  if (!isAdmin) redirect("/dashboard/rotas");

  const inviteLink = searchParams?.invite ? decodeURIComponent(searchParams.invite) : null;
  const created = searchParams?.created === "1";
  const error = searchParams?.error || null;

  const pendingInvites = await prisma.propertyInvite.findMany({
    where: {
      propertyId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      publicToken: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  return (
    <main className={styles.page}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 className={styles.title}>Invites</h1>
          <p className={styles.sub}>Invite staff members to join this property.</p>
        </div>

        {/* ####ADD CODE HERE#### (Users & Access link) */}
        <Link className="button" href="/dashboard/settings/users">
          Users & Access
        </Link>
      </div>
      <div className={styles.card}>
  <h2 className={styles.h2}>Current users</h2>
  <p className={styles.small}>
    View active staff and remove access when employment has ended.
  </p>
  <Link className="button" href="/dashboard/settings/users">
    Manage users & access
  </Link>
</div>
      {error ? <p className={styles.noticeError}>Something went wrong: {error}</p> : null}

      {created && inviteLink ? (
        <div className={styles.notice}>
          <div className={styles.noticeTitle}>Invite link created</div>
          <div className={styles.inviteBox}>
            <code className={styles.code}>{inviteLink}</code>
          </div>
          <p className={styles.small}>
            Copy this link and send it to the staff member. (Next we’ll add a copy button.)
          </p>
        </div>
      ) : null}

      <div className={styles.card}>
        <h2 className={styles.h2}>Create invite</h2>
        <form className={styles.form} action="/api/invites" method="post">
          <label className={styles.label}>
            Staff email
            <input className="input" type="email" name="email" placeholder="staff@company.com" required />
          </label>

          <label className={styles.label}>
            Role
            <select className="input" name="role" defaultValue="PROPERTY_USER">
              <option value="PROPERTY_USER">Staff</option>
              <option value="PROPERTY_ADMIN">Admin</option>
            </select>
          </label>

          <button className="button" type="submit">
            Create invite
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.h2}>Pending invites</h2>

        {pendingInvites.length ? (
          <div className={styles.inviteTable}>
            <div className={styles.inviteHead}>
              <div>Email</div>
              <div>Role</div>
              <div>Expires</div>
              <div>Link</div>
              <div>Actions</div>
            </div>

            {pendingInvites.map((inv: any) => (
              <div key={inv.id} className={styles.inviteRow}>
                <div className={styles.inviteEmail}>{inv.email}</div>
                <div>{inv.role}</div>
                <div>{new Intl.DateTimeFormat("en-GB").format(inv.expiresAt)}</div>

                <div className={styles.inviteLink}>
                  <code className={styles.codeInline}>
                    {inv.publicToken ? `${baseUrl}/invite/${inv.publicToken}` : "—"}
                  </code>
                </div>

                <div className={styles.inviteActions}>
                  {inv.publicToken ? <CopyInviteLink text={`${baseUrl}/invite/${inv.publicToken}`} /> : null}

                  <form action="/api/invites/revoke" method="post">
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <button className="button" type="submit">
                      Revoke
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No pending invites.</div>
        )}
      </div>
    </main>
  );
}