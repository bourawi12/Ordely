"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import Logo from "@/components/Logo";
import { logout } from "@/app/(auth)/actions";
import type { Usage, User } from "@/lib/api";
import { initials } from "@/lib/format";
import styles from "./shell.module.css";

const COLLAPSED_KEY = "ordely.sidebarCollapsed";
const MOBILE_QUERY = "(max-width: 960px)";

const NAV: { href: string; label: string; icon: IconName; subtitle?: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/call-logs", label: "Call Logs", icon: "phoneCall", subtitle: "All outgoing confirmation calls" },
  { href: "/orders", label: "Orders", icon: "bag", subtitle: "Every order and its confirmation status" },
  { href: "/analytics", label: "Analytics", icon: "bars", subtitle: "Trends across your confirmations" },
  { href: "/integrations", label: "Integrations", icon: "plug", subtitle: "Connect your store and tools" },
  { href: "/settings", label: "Settings", icon: "settings", subtitle: "Your account" },
];

export default function AppShell({
  user,
  usage,
  children,
}: {
  user: User;
  usage: Usage | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // Desktop only: sidebar shrunk to an icon rail. Remembered per browser.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage unavailable (private mode); keep the default.
    }
  }, []);

  const toggleSidebar = () => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setMenuOpen((open) => !open);
      return;
    }
    setCollapsed((was) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, was ? "0" : "1");
      } catch {
        // Ignore; the toggle still works for this visit.
      }
      return !was;
    });
  };
  const current = NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  const firstName = user.name.split(" ")[0];

  // Close the mobile drawer after navigating.
  useEffect(() => setMenuOpen(false), [pathname]);

  const usedPct = usage ? Math.min(100, (usage.used / Math.max(usage.limit, 1)) * 100) : 0;

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
      <aside
        id="app-sidebar"
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
      >
        <Link href="/" className={styles.brand} aria-label="Ordely home">
          <Logo className={styles.brandFull} />
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <rect width="64" height="64" rx="16" fill="currentColor" />
              <path d="M18 30 Q32 46 46 30" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </span>
        </Link>
        <nav className={styles.nav}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${current?.href === item.href ? styles.active : ""}`}
              aria-current={current?.href === item.href ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size={22} />
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>
        {usage && (
          <div className={styles.plan}>
            <p className={styles.planName}>{usage.plan}</p>
            <p className={styles.planUsage}>
              {usage.used} / {usage.limit} calls used
            </p>
            <div className={styles.planBar} role="progressbar" aria-valuenow={usage.used} aria-valuemax={usage.limit}>
              <span style={{ width: `${usedPct}%` }} />
            </div>
            <a href="mailto:hello@ordely.tn?subject=Upgrade%20Ordely%20plan" className={styles.planBtn}>
              Upgrade plan
            </a>
          </div>
        )}
      </aside>
      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={toggleSidebar}
            aria-controls="app-sidebar"
            aria-expanded={menuOpen || !collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="menu" size={20} />
          </button>
          <div className={styles.titles}>
            <h1 className={styles.title}>{current?.label ?? "Ordely"}</h1>
            <p className={styles.subtitle}>
              {current?.href === "/dashboard" || !current ? `Welcome back, ${firstName}` : current.subtitle}
            </p>
          </div>
          <button type="button" className={styles.iconBtn} aria-label="Notifications">
            <Icon name="bell" size={20} />
          </button>
          <details className={styles.user}>
            <summary className={styles.userBtn}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className={styles.userName}>{user.name}</span>
            </summary>
            <div className={styles.userMenu}>
              <p>{user.email}</p>
              <Link href="/settings">
                <Icon name="settings" size={18} /> Settings
              </Link>
              <form action={logout}>
                <button type="submit">
                  <Icon name="logout" size={18} /> Log out
                </button>
              </form>
            </div>
          </details>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
