"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./nav.module.scss";

type NavLink = {
  href: string;
  label: string;
  disabled?: boolean;
};

export default function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/dashboard", label: "Dashboard" },
    ...(isAdmin ? [{ href: "/dashboard/settings", label: "Settings" }] : []),
    ...(isAdmin ? [{ href: "/dashboard/settings/users", label: "Users & Access" }] : []),
    ...(isAdmin ? [{ href: "/dashboard/reports-eho", label: "Reports (EHO)" } satisfies NavLink] : []),
    { href: "/dashboard/food-cost", label: "Food Cost" },
    { href: "/dashboard/temp-logs", label: "Food temps" },
    { href: "/dashboard/temperature", label: "Fridge Temps" },
    ...(isAdmin ? [{ href: "/dashboard/refrigeration", label: "Refrigeration" } satisfies NavLink] : []),
    { href: "/dashboard/rotas", label: "Rotas" },
    { href: "/dashboard/stock-ordering", label: "Stock & Ordering" },
    { href: "/dashboard/team-log", label: "Team Log" },
    { href: "/dashboard/maintenance", label: "Maintenance" },
    
  ];

  return (
    <nav className={styles.nav} aria-label="Primary">
      {links.map((l) => {
        const isActive = l.href !== "#" && pathname === l.href;
        const className = [styles.link, isActive ? styles.active : "", l.disabled ? styles.disabled : ""]
          .filter(Boolean)
          .join(" ");

        if (l.disabled) {
          return (
            <span key={l.label} className={className} aria-disabled="true">
              {l.label}
            </span>
          );
        }

        return (
          <Link key={l.href} href={l.href} className={className}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}