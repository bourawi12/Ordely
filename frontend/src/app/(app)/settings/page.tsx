import { logout } from "@/app/(auth)/actions";
import Icon from "@/components/Icon";
import ui from "@/components/app/ui.module.css";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await api.me();

  return (
    <section className={`${ui.card} ${ui.cardPad}`} style={{ maxWidth: 560 }}>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>Account</h2>
      </div>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.9rem 2rem", margin: "0 0 1.75rem" }}>
        <dt className={ui.muted}>Name</dt>
        <dd style={{ margin: 0 }}>{user.name}</dd>
        <dt className={ui.muted}>Email</dt>
        <dd style={{ margin: 0 }}>{user.email}</dd>
        <dt className={ui.muted}>Member since</dt>
        <dd style={{ margin: 0 }}>{formatDateTime(user.createdAt)}</dd>
      </dl>
      <form action={logout}>
        <button type="submit" className={ui.btnGhost}>
          <Icon name="logout" size={18} /> Log out
        </button>
      </form>
    </section>
  );
}
