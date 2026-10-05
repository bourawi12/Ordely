"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./admin.module.css";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/quality", label: "Call quality" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/merchants", label: "Merchants" },
  { href: "/admin/cohorts", label: "Cohorts" },
];

/** Section tabs. The selected period follows from one section to the next. */
export default function AdminNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const period = new URLSearchParams();
  for (const key of ["range", "from", "to"]) {
    const v = params.get(key);
    if (v) period.set(key, v);
  }
  const suffix = period.toString() ? `?${period}` : "";
  return (
    <nav className={styles.tabs} aria-label="Back office sections">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={`${t.href}${suffix}`}
            className={styles.tab}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
