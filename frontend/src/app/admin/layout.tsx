import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AdminNav from "@/components/admin/AdminNav";
import styles from "@/components/admin/admin.module.css";
import Logo from "@/components/Logo";
import { api } from "@/lib/api";
import { accentStyle, themeClass } from "@/lib/theme";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Back office — Ordely", robots: { index: false } };

/**
 * Internal back office, Ordely team only. Merchants are sent back to their dashboard; the API
 * refuses them anyway (403), this only keeps them from seeing an empty page.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // api.me() redirects to /login without a valid session.
  const user = await api.me();
  if (!user.isPlatformAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className={`theme-scope ${themeClass(user.themeMode)} ${styles.shell}`} style={accentStyle(user.accentColor)}>
      <header className={styles.top}>
        <Link href="/admin" className={styles.brand} aria-label="Back office home">
          <Logo />
          <span className={styles.badge}>Back office</span>
        </Link>
        <div className={styles.topRight}>
          <span>{user.email}</span>
          <Link href="/dashboard">Back to the app</Link>
        </div>
      </header>
      <Suspense fallback={<nav className={styles.tabs} />}>
        <AdminNav />
      </Suspense>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
