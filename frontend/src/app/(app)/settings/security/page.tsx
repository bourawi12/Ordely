import type { Metadata } from "next";
import { logout } from "@/app/(auth)/actions";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PasswordForm } from "../settings-forms";
import styles from "../settings.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Security settings — Ordely" };

export default async function SecuritySettingsPage() {
  const user = await api.me();

  return (
    <>
      <header className={styles.pageHead}>
        <h2>Security</h2>
        <p>Your password and this browser&apos;s session.</p>
      </header>
      <PasswordForm />

      <section className={`${ui.card} ${styles.card}`}>
        <div className={styles.cardBody}>
          <div className={styles.cardHead}>
            <h3>Session</h3>
            <p>You are signed in on this browser.</p>
          </div>
          <dl className={styles.facts}>
            <dt>Signed in as</dt>
            <dd>{user.email}</dd>
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </dl>
        </div>
        <form action={logout} className={styles.cardFoot}>
          <p className={styles.status}>Logging out only ends the session on this browser.</p>
          <button type="submit" className={ui.btnGhost}>
            <Icon name="logout" size={17} />
            Log out
          </button>
        </form>
      </section>
    </>
  );
}
