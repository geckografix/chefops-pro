"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Nav from "./Nav";
import styles from "./header.module.scss";
import { APP_NAME, APP_LOGO_SRC } from "@/src/lib/brand";

type HeaderProps = {
  trialDaysLeft: number | null;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | null;
  isAdmin: boolean;
};

export default function Header({ trialDaysLeft, subscriptionStatus, isAdmin }: HeaderProps) {
  const showTrial = subscriptionStatus === "TRIALING" && trialDaysLeft !== null;

  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const burgerRef = useRef<HTMLButtonElement | null>(null);

  // Close drawer when route changes (clicking a Link)
  const pathname = usePathname();
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close drawer on outside click (NO overlay)
  useEffect(() => {
    if (!menuOpen) return;

    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (!t) return;

      if (drawerRef.current?.contains(t)) return;
      if (burgerRef.current?.contains(t)) return;

      setMenuOpen(false);
    }

    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.brandTop}>
          <Link href="https://chef-ops-pro.com/" target="_blank" className={styles.logoLink} aria-label={`${APP_NAME} Home`}>
  <Image
    src={APP_LOGO_SRC}
    alt={APP_NAME}
    width={180}
    height={36}
    priority
    className={styles.logoImg}
  />
</Link>

          {isAdmin ? <span className={styles.adminBadge}>ADMIN</span> : null}

          {/* Mobile hamburger */}
          <button
            ref={burgerRef}
            type="button"
            className={styles.hamburger}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={styles.hamburgerBars} />
          </button>
        </div>

        <div className={styles.tagline}>Kitchen operations, locked in.</div>
      </div>

      {/* Desktop nav */}
      <div className={styles.navDesktop}>
        <Nav isAdmin={isAdmin} />
      </div>

      {/* Mobile nav drawer (NO overlay) */}
      <div
  ref={drawerRef}
  className={`${styles.navMobile} ${menuOpen ? styles.navMobileOpen : ""}`}
>
  <div className={styles.navMobileInner}>
    <button
      type="button"
      className={styles.drawerClose}
      aria-label="Close menu"
      onClick={() => setMenuOpen(false)}
    >
      ×
    </button>

    <Nav isAdmin={isAdmin} />
  </div>
</div>

      <div className={styles.actions}>
        {showTrial ? (
          <Link className={styles.trialBadge} href="/billing" title="Manage subscription">
            Trial: {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left
          </Link>
        ) : null}

        <form action="/api/logout" method="post">
          <button className="btn" type="submit">
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}